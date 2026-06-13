import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, Link, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, addDays, startOfDay, getDay } from "date-fns";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { getOrCreateUser, updateUserDoc } from "@/lib/firestoreService";
import { fetchGoogleEvents, checkGoogleCalendarStatus } from "@/services/googleCalendarService";
import { firebaseAuth } from "@/lib/firebase";

const WORKER_URL = import.meta.env.VITE_CALENDAR_WORKER_URL || '';

function computeFreeSlots(events, workingHours, date) {
  if (!workingHours) return [];
  const { slotDurationMinutes = 60, perDaySchedule, workDays, startTime, endTime } = workingHours;
  const dayOfWeek = getDay(date);
  const now = new Date();

  if (perDaySchedule) {
    const cfg = perDaySchedule[dayOfWeek];
    if (!cfg?.enabled || !cfg.slots?.length) return [];
    return cfg.slots.flatMap(slotTime => {
      const [h, m] = slotTime.split(":").map(Number);
      const slotStart = new Date(date);
      slotStart.setHours(h, m, 0, 0);
      if (slotStart <= now) return [];
      const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60000);
      const isBusy = events.some(ev => {
        const evStart = new Date(ev.event_date || ev.start);
        const evEnd   = new Date(ev.end_date || ev.end || new Date(evStart.getTime() + 3600000));
        return slotStart < evEnd && slotEnd > evStart;
      });
      if (isBusy) return [];
      return [{ start: slotStart.toISOString(), end: slotEnd.toISOString(), label: slotTime }];
    });
  }

  if (!workDays?.includes(dayOfWeek)) return [];
  const [sh, sm] = (startTime || "09:00").split(":").map(Number);
  const [eh, em] = (endTime   || "18:00").split(":").map(Number);
  const slots = [];
  let current = sh * 60 + sm;
  while (current + slotDurationMinutes <= eh * 60 + em) {
    const slotStart = new Date(date);
    slotStart.setHours(Math.floor(current / 60), current % 60, 0, 0);
    if (slotStart > now) {
      const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60000);
      const label = `${String(Math.floor(current / 60)).padStart(2,"0")}:${String(current % 60).padStart(2,"0")}`;
      slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), label });
    }
    current += slotDurationMinutes;
  }
  return slots;
}

export default function Availability() {
  const uid = useCurrentUid();
  const navigate = useNavigate();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [workingHours, setWorkingHours] = useState(null);
  const [hiddenSlots, setHiddenSlots] = useState([]);
  const [saving, setSaving] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [copied, setCopied] = useState(false);

  const bookingLink = uid ? `${window.location.origin}/book?uid=${uid}` : "";

  useEffect(() => {
    if (!uid) return;
    (async () => {
      setLoading(true);
      try {
        const [connected, profile] = await Promise.all([
          checkGoogleCalendarStatus(),
          getOrCreateUser(uid),
        ]);
        setGoogleConnected(connected);
        // Load workingHours from Worker KV — single source of truth for the booking page
        if (WORKER_URL) {
          const res = await fetch(`${WORKER_URL}/availability/settings/${encodeURIComponent(uid)}`).catch(() => null);
          if (res?.ok) {
            const data = await res.json();
            if (data?.workingHours) setWorkingHours(data.workingHours);
          }
        }
        if (profile?.hiddenSlots) setHiddenSlots(profile.hiddenSlots);
        if (connected) {
          const now = new Date();
          const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 3600000);
          const calEvents = await fetchGoogleEvents(now, twoWeeksOut);
          setEvents(calEvents);
        }
      } catch {
        toast.error("Failed to load calendar data");
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const save = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      await updateUserDoc(uid, { hiddenSlots });
      // Only push hiddenSlots to Worker KV — schedule is managed by Booking Links
      // The Worker merges, so the existing workingHours schedule is preserved.
      if (WORKER_URL) {
        const idToken = await firebaseAuth.currentUser?.getIdToken().catch(() => null);
        if (idToken) {
          await fetch(`${WORKER_URL}/availability/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Firebase ${idToken}` },
            body: JSON.stringify({ hiddenSlots }),
          }).catch(() => {});
        }
      }
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleSlot = (startIso) => {
    setHiddenSlots(prev =>
      prev.includes(startIso) ? prev.filter(s => s !== startIso) : [...prev, startIso]
    );
  };

  const copyLink = () => {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    toast.success("Booking link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, weekOffset * 7 + i));

  if (loading) {
    return (
      <div className="px-4 pt-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-display font-bold flex-1">Availability</h1>
      </div>

      {!googleConnected && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Connect Google Calendar</p>
            <p className="text-xs text-muted-foreground mt-0.5">Connect your calendar so the app can read your free slots</p>
          </div>
          <Button size="sm" onClick={() => navigate("/settings")} className="rounded-xl shrink-0 bg-accent text-accent-foreground hover:bg-accent/90">
            Connect
          </Button>
        </div>
      )}

      {/* Booking link */}
      <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20 mb-5">
        <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Your Booking Link</p>
        <p className="text-xs text-muted-foreground mb-3">Share this so others can book a time with you.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted/60 rounded-xl px-3 py-2 text-xs truncate font-mono">{bookingLink}</div>
          <Button size="sm" onClick={copyLink} className="rounded-xl shrink-0 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Session schedule — managed in Booking Links */}
      <button onClick={() => navigate("/booking-links")}
        className="w-full p-4 rounded-2xl bg-card border border-border/50 mb-5 flex items-center justify-between text-left hover:border-accent/40 transition-colors">
        <div>
          <p className="text-sm font-heading font-semibold">Session Schedule</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {workingHours?.perDaySchedule
              ? (() => {
                  const activeDays = Object.values(workingHours.perDaySchedule).filter(d => d.enabled && d.slots?.length > 0);
                  const totalSlots = activeDays.reduce((sum, d) => sum + d.slots.length, 0);
                  return activeDays.length > 0
                    ? `${activeDays.length} day${activeDays.length > 1 ? "s" : ""}, ${totalSlots} slots set`
                    : "No sessions set yet";
                })()
              : "Tap to set your available session times"}
          </p>
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {/* Free slot toggles — hide individual slots from your booking page */}
      {googleConnected && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-heading font-semibold">Your Free Slots</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Tap a slot to hide it from your booking link</p>
            </div>
            <div className="flex items-center gap-1">
              <button disabled={weekOffset === 0} onClick={() => setWeekOffset(w => w - 1)}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground px-1 whitespace-nowrap">
                {format(days[0], "d MMM")} – {format(days[6], "d MMM")}
              </span>
              <button onClick={() => setWeekOffset(w => w + 1)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3 mt-3">
            {days.map(day => {
              const slots = computeFreeSlots(events, workingHours, day);
              if (slots.length === 0) return null;
              return (
                <div key={day.toISOString()}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {format(day, "EEEE d MMM")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map(slot => {
                      const hidden = hiddenSlots.includes(slot.start);
                      return (
                        <button key={slot.start} onClick={() => toggleSlot(slot.start)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${hidden
                            ? "bg-muted/30 text-muted-foreground/40 border-border/20 line-through"
                            : "bg-accent/10 text-accent border-accent/30 hover:bg-accent/20"
                          }`}>
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {days.every(d => computeFreeSlots(events, workingHours, d).length === 0) && (
              <p className="text-center py-8 text-sm text-muted-foreground">
                No free slots this week.
              </p>
            )}
          </div>

          <Button size="sm" variant="ghost" onClick={save} disabled={saving}
            className="w-full rounded-xl text-xs text-muted-foreground hover:text-foreground mt-3 gap-1.5">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Save hidden slots
          </Button>
        </div>
      )}
    </div>
  );
}
