import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, ChevronLeft, ChevronRight, Loader2, Link, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, addDays, startOfDay, getDay } from "date-fns";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { getOrCreateUser, updateUserDoc } from "@/lib/firestoreService";
import { fetchGoogleEvents, checkGoogleCalendarStatus } from "@/services/googleCalendarService";

const DEFAULT_WORKING_HOURS = {
  startTime: "09:00",
  endTime: "18:00",
  slotDurationMinutes: 30,
  bufferMinutes: 0,
  workDays: [1, 2, 3, 4, 5],
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DURATIONS = [15, 30, 45, 60, 90];

function computeFreeSlots(events, workingHours, date) {
  const { startTime, endTime, slotDurationMinutes, bufferMinutes = 0, workDays } = workingHours;
  const dayOfWeek = getDay(date);
  if (!workDays.includes(dayOfWeek)) return [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const slots = [];
  let current = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const step = slotDurationMinutes + bufferMinutes;
  const now = new Date();
  while (current + slotDurationMinutes <= endMinutes) {
    const slotStart = new Date(date);
    slotStart.setHours(Math.floor(current / 60), current % 60, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60000);
    if (slotStart > now) {
      const isBusy = events.some(ev => {
        const evStart = new Date(ev.event_date || ev.start);
        const evEnd = new Date(ev.end_date || ev.end || new Date(evStart.getTime() + 3600000));
        return slotStart < evEnd && slotEnd > evStart;
      });
      if (!isBusy) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          label: `${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`,
        });
      }
    }
    current += step;
  }
  return slots;
}

export default function Availability() {
  const uid = useCurrentUid();
  const navigate = useNavigate();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [workingHours, setWorkingHours] = useState(DEFAULT_WORKING_HOURS);
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
        if (profile?.workingHours) setWorkingHours({ ...DEFAULT_WORKING_HOURS, ...profile.workingHours });
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
      await updateUserDoc(uid, { workingHours, hiddenSlots });
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

      {/* Working hours */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 mb-5 space-y-4">
        <h2 className="text-sm font-heading font-semibold">Working Hours</h2>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Work days</label>
          <div className="flex gap-1">
            {DAY_LABELS.map((d, i) => (
              <button key={d} onClick={() => {
                const days = workingHours.workDays.includes(i)
                  ? workingHours.workDays.filter(x => x !== i)
                  : [...workingHours.workDays, i].sort((a, b) => a - b);
                setWorkingHours({ ...workingHours, workDays: days });
              }}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${workingHours.workDays.includes(i) ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Start</label>
            <input type="time" value={workingHours.startTime}
              onChange={e => setWorkingHours({ ...workingHours, startTime: e.target.value })}
              className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent/50" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">End</label>
            <input type="time" value={workingHours.endTime}
              onChange={e => setWorkingHours({ ...workingHours, endTime: e.target.value })}
              className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent/50" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Slot length</label>
          <div className="flex gap-1.5 flex-wrap">
            {DURATIONS.map(d => (
              <button key={d} onClick={() => setWorkingHours({ ...workingHours, slotDurationMinutes: d })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${workingHours.slotDurationMinutes === d ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                {d}m
              </button>
            ))}
          </div>
        </div>
        <Button size="sm" onClick={save} disabled={saving}
          className="w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1.5" />Save</>}
        </Button>
      </div>

      {/* Free slot toggles */}
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
                No free slots this week — all your working hours are booked or outside your set schedule.
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
