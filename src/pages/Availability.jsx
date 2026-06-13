import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format, addDays, startOfDay, getDay } from "date-fns";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { getOrCreateUser, updateUserDoc } from "@/lib/firestoreService";
import { fetchGoogleEvents, checkGoogleCalendarStatus } from "@/services/googleCalendarService";
import { firebaseAuth } from "@/lib/firebase";

const WORKER_URL = import.meta.env.VITE_CALENDAR_WORKER_URL || '';

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DURATIONS = [15, 30, 45, 60, 90];

// All possible time slots shown in the picker: 05:00–22:30 in 30-min steps
const ALL_TIMES = Array.from({ length: 36 }, (_, i) => {
  const mins = 300 + i * 30; // start at 5:00
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

function makeDefaultSchedule() {
  return Object.fromEntries(
    [0,1,2,3,4,5,6].map(i => [i, { enabled: i >= 1 && i <= 5, slots: [] }])
  );
}

const DEFAULT_WORKING_HOURS = {
  slotDurationMinutes: 60,
  perDaySchedule: makeDefaultSchedule(),
};

function migrateWorkingHours(wh) {
  if (!wh) return DEFAULT_WORKING_HOURS;
  if (wh.perDaySchedule && Object.values(wh.perDaySchedule)[0]?.slots !== undefined) {
    return { ...DEFAULT_WORKING_HOURS, ...wh };
  }
  // Migrate old start/end range or previous {enabled,start,end} format to slots[]
  const oldEnabled = wh.workDays ?? [1,2,3,4,5];
  const oldStart = wh.startTime ?? wh.perDaySchedule?.[1]?.start ?? "09:00";
  const oldEnd   = wh.endTime   ?? wh.perDaySchedule?.[1]?.end   ?? "18:00";
  const [sh, sm] = oldStart.split(":").map(Number);
  const [eh, em] = oldEnd.split(":").map(Number);
  const dur = wh.slotDurationMinutes ?? 60;
  const defaultSlots = [];
  let cur = sh * 60 + sm;
  while (cur + dur <= eh * 60 + em) {
    defaultSlots.push(`${String(Math.floor(cur / 60)).padStart(2,"0")}:${String(cur % 60).padStart(2,"0")}`);
    cur += dur;
  }
  return {
    slotDurationMinutes: dur,
    perDaySchedule: Object.fromEntries(
      [0,1,2,3,4,5,6].map(i => {
        const wasEnabled = oldEnabled.includes ? oldEnabled.includes(i) : (wh.perDaySchedule?.[i]?.enabled ?? false);
        return [i, { enabled: wasEnabled, slots: wasEnabled ? defaultSlots : [] }];
      })
    ),
  };
}

function computeFreeSlots(events, workingHours, date) {
  const { slotDurationMinutes, perDaySchedule, workDays, startTime, endTime } = workingHours;
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

  // Backward compat: old start/end range format
  if (!workDays?.includes(dayOfWeek)) return [];
  const [sh, sm] = (startTime || "09:00").split(":").map(Number);
  const [eh, em] = (endTime   || "18:00").split(":").map(Number);
  const slots = [];
  let current = sh * 60 + sm;
  const step = slotDurationMinutes;
  while (current + step <= eh * 60 + em) {
    const slotStart = new Date(date);
    slotStart.setHours(Math.floor(current / 60), current % 60, 0, 0);
    if (slotStart > now) {
      const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60000);
      const label = `${String(Math.floor(current / 60)).padStart(2,"0")}:${String(current % 60).padStart(2,"0")}`;
      slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), label });
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
  const [selectedDay, setSelectedDay] = useState(1); // Mon selected by default
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
        // Prefer globalBookingRules.schedule (set via Booking Links) as it's the
        // canonical schedule. Fall back to workingHours for legacy users.
        const globalSchedule = profile?.globalBookingRules?.schedule;
        if (globalSchedule) {
          const dur = profile?.globalBookingRules?.slotDurationMinutes
            ?? profile?.workingHours?.slotDurationMinutes
            ?? 60;
          setWorkingHours({ slotDurationMinutes: dur, perDaySchedule: globalSchedule });
        } else if (profile?.workingHours) {
          setWorkingHours(migrateWorkingHours(profile.workingHours));
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
      // Keep both workingHours and globalBookingRules.schedule in sync so
      // Booking Links and Availability always show the same schedule.
      await updateUserDoc(uid, {
        workingHours,
        hiddenSlots,
        'globalBookingRules.schedule': workingHours.perDaySchedule,
        'globalBookingRules.slotDurationMinutes': workingHours.slotDurationMinutes,
      });
      // Also push to Worker KV so the public booking page can read it without auth
      if (WORKER_URL) {
        const idToken = await firebaseAuth.currentUser?.getIdToken().catch(() => null);
        if (idToken) {
          await fetch(`${WORKER_URL}/availability/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Firebase ${idToken}` },
            body: JSON.stringify({ workingHours, hiddenSlots }),
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

      {/* Session availability */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 mb-5 space-y-4">
        <div>
          <h2 className="text-sm font-heading font-semibold">Session Availability</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Tap a day, then tap the times you're available for sessions.</p>
        </div>

        {/* Session length */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Session length</label>
          <div className="flex gap-1.5 flex-wrap">
            {DURATIONS.map(d => (
              <button key={d} onClick={() => setWorkingHours(wh => ({ ...wh, slotDurationMinutes: d }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${workingHours.slotDurationMinutes === d ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                {d}m
              </button>
            ))}
          </div>
        </div>

        {/* Day picker */}
        <div className="flex gap-1">
          {DAY_LABELS.map((d, i) => {
            const cfg = workingHours.perDaySchedule?.[i] ?? { enabled: false, slots: [] };
            const count = cfg.slots?.length ?? 0;
            return (
              <button key={d} onClick={() => setSelectedDay(i)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all flex flex-col items-center gap-0.5
                  ${cfg.enabled && count > 0 ? "bg-accent text-accent-foreground" : cfg.enabled ? "bg-accent/40 text-accent-foreground" : "bg-muted text-muted-foreground"}
                  ${selectedDay === i ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""}`}>
                <span>{d}</span>
                <span className="text-[9px] opacity-80">{count > 0 ? `${count} slot${count > 1 ? "s" : ""}` : "off"}</span>
              </button>
            );
          })}
        </div>

        {/* Per-day slot grid */}
        {selectedDay !== null && (() => {
          const cfg = workingHours.perDaySchedule?.[selectedDay] ?? { enabled: false, slots: [] };
          const selectedSlots = new Set(cfg.slots ?? []);
          const toggleSlotTime = (t) => {
            const next = new Set(selectedSlots);
            next.has(t) ? next.delete(t) : next.add(t);
            setWorkingHours(wh => ({
              ...wh,
              perDaySchedule: {
                ...wh.perDaySchedule,
                [selectedDay]: { enabled: next.size > 0, slots: [...next].sort() }
              }
            }));
          };
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{DAY_LABELS[selectedDay]}</span>
                {selectedSlots.size > 0 && (
                  <button onClick={() => setWorkingHours(wh => ({
                    ...wh,
                    perDaySchedule: { ...wh.perDaySchedule, [selectedDay]: { enabled: false, slots: [] } }
                  }))} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                    Clear day
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {ALL_TIMES.map(t => (
                  <button key={t} onClick={() => toggleSlotTime(t)}
                    className={`py-2 rounded-lg text-xs font-medium transition-all ${selectedSlots.has(t)
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                {selectedSlots.size === 0 ? "No slots — tap times above to add them" : `${selectedSlots.size} slot${selectedSlots.size > 1 ? "s" : ""} selected`}
              </p>
            </div>
          );
        })()}

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
