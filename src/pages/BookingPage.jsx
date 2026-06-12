import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { bookingsService } from "@/lib/firestoreService";
import { format, addDays, startOfDay, isBefore, getDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, Sparkles, Globe, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const WORKER_URL = import.meta.env.VITE_CALENDAR_WORKER_URL;

const DEFAULT_WORKING_HOURS = {
  startTime: "09:00",
  endTime: "18:00",
  slotDurationMinutes: 30,
  bufferMinutes: 0,
  workDays: [1, 2, 3, 4, 5],
};

function computeFreeSlots(busyTimes, workingHours, hiddenSlots, existingBookings, date) {
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
      const isBusy = busyTimes.some(ev => {
        const evStart = new Date(ev.start);
        const evEnd = new Date(ev.end || new Date(evStart.getTime() + 3600000));
        return slotStart < evEnd && slotEnd > evStart;
      });
      const isHidden = hiddenSlots.includes(slotStart.toISOString());
      const isBooked = existingBookings.some(b => {
        if (!b.confirmed) return false;
        const bd = b.slot?.toDate ? b.slot.toDate() : new Date(b.slot);
        return Math.abs(bd.getTime() - slotStart.getTime()) < slotDurationMinutes * 60000;
      });
      if (!isBusy && !isHidden && !isBooked) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          label: `${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`,
          duration: slotDurationMinutes,
        });
      }
    }
    current += step;
  }
  return slots;
}

function formatInTimezone(isoString, timezone) {
  try {
    return new Date(isoString).toLocaleString("en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: timezone,
    });
  } catch { return new Date(isoString).toLocaleString(); }
}

export default function BookingPage() {
  const { slug } = useParams();
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", reason: "" });
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  const [ownerUid, setOwnerUid] = useState(null);
  const [workingHours, setWorkingHours] = useState(DEFAULT_WORKING_HOURS);
  const [hiddenSlots, setHiddenSlots] = useState([]);
  const [busyTimes, setBusyTimes] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);
  const [linkId, setLinkId] = useState(null);
  const [linkTitle, setLinkTitle] = useState("Book a Time");
  const [bookerTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => { loadPage(); }, [slug]);

  const loadPage = async () => {
    setLoading(true);
    setError("");
    try {
      // Resolve owner UID — from slug or ?uid= query param
      const params = new URLSearchParams(window.location.search);
      let foundUid = params.get("uid") || null;
      let foundLinkId = null;
      let foundTitle = "Book a Time";

      if (slug) {
        // slugIndex is publicly readable — contains uid, linkId, active, title
        const slugSnap = await getDoc(doc(firestore, "slugIndex", slug));
        if (slugSnap.exists()) {
          const entry = slugSnap.data();
          foundUid = entry.uid;
          foundLinkId = entry.linkId;
          if (entry.active === false) { setError("This booking link is inactive."); setLoading(false); return; }
          foundTitle = entry.title || "Book a Time";
          if (entry.slotDurationMinutes) {
            setWorkingHours(wh => ({ ...wh, slotDurationMinutes: entry.slotDurationMinutes }));
          }
        }
      }

      if (!foundUid) { setError("Booking link not found."); setLoading(false); return; }

      setOwnerUid(foundUid);
      setLinkId(foundLinkId);
      setLinkTitle(foundTitle);

      // Load owner's availability settings from Worker KV (public — no auth needed)
      if (WORKER_URL) {
        try {
          const settingsRes = await fetch(`${WORKER_URL}/availability/settings/${encodeURIComponent(foundUid)}`);
          if (settingsRes.ok) {
            const settings = await settingsRes.json();
            if (settings?.workingHours) setWorkingHours({ ...DEFAULT_WORKING_HOURS, ...settings.workingHours });
            if (settings?.hiddenSlots) setHiddenSlots(settings.hiddenSlots || []);
          }
        } catch {} // silently fall back to defaults
      }

      // Load existing confirmed bookings (silently ignore if Firestore rules block unauthenticated reads)
      if (foundLinkId) {
        try {
          const bks = await bookingsService.listByLink(foundUid, foundLinkId);
          setExistingBookings(bks);
        } catch {} // non-fatal — slots will still show from working hours
      }

      // Fetch busy times from Google Calendar (public endpoint — may return empty if not connected)
      if (WORKER_URL) {
        try {
          const now = new Date();
          const twoWeeks = new Date(now.getTime() + 14 * 24 * 3600000);
          const res = await fetch(
            `${WORKER_URL}/calendar/freebusy/${encodeURIComponent(foundUid)}?timeMin=${now.toISOString()}&timeMax=${twoWeeks.toISOString()}`
          );
          if (res.ok) {
            const data = await res.json();
            setBusyTimes(data.busyTimes || []);
          }
        } catch {} // silently fallback — slots still show from working hours
      }
    } catch {
      setError("Failed to load booking page. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const today = startOfDay(new Date());
  const weekStart = addDays(today, weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getSlotsForDate = (date) =>
    computeFreeSlots(busyTimes, workingHours, hiddenSlots, existingBookings, date);

  const hasSlotsOnDay = (date) => !isBefore(date, today) && getSlotsForDate(date).length > 0;

  const confirmBooking = async () => {
    if (!ownerUid || !selectedSlot) return;
    setBooking(true);
    try {
      // 1. Save booking to Firestore
      await bookingsService.create(ownerUid, {
        linkId: linkId || null,
        bookerName: form.name,
        bookerEmail: form.email,
        reasonForMeeting: form.reason,
        slot: selectedSlot.start,
        slotEnd: selectedSlot.end,
        timezone: bookerTimezone,
        confirmed: true,
      });

      // 2. Push event to owner's Google Calendar via worker
      if (WORKER_URL) {
        await fetch(`${WORKER_URL}/booking/public`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerUid,
            summary: `${form.name} — ${linkTitle}`,
            description: `Booked by: ${form.name}\nEmail: ${form.email}\n\nAbout: ${form.reason}`,
            start: selectedSlot.start,
            end: selectedSlot.end,
            attendeeEmail: form.email,
          }),
        }).catch(() => {}); // non-blocking — booking is saved to Firestore regardless
      }

      setStep(4);
    } catch {
      toast.error("Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-xl font-display font-bold mb-2">Booking Unavailable</h2>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-accent/5" />
      </div>
      <div className="relative z-10 max-w-lg mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-2xl font-display font-bold">{linkTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">Pick a time that works for you</p>
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Globe className="w-3 h-3" /><span>{bookerTimezone}</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Pick date */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-center justify-between mb-4">
                <button disabled={weekOffset === 0} onClick={() => setWeekOffset(w => w - 1)}
                  className="p-2 rounded-xl hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <p className="text-sm font-medium">
                  {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
                </p>
                <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1.5 mb-6">
                {weekDays.map(day => {
                  const available = hasSlotsOnDay(day);
                  const isPast = isBefore(day, today);
                  return (
                    <button key={day.toISOString()} disabled={!available || isPast}
                      onClick={() => { setSelectedDate(day); setStep(2); }}
                      className={`flex flex-col items-center py-2.5 px-1 rounded-xl text-xs transition-all ${available && !isPast
                        ? "bg-card border border-accent/30 hover:border-accent hover:bg-accent/10 cursor-pointer"
                        : "bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
                      }`}>
                      <span className="text-[10px] text-muted-foreground mb-1">{format(day, "EEE")}</span>
                      <span className="font-semibold">{format(day, "d")}</span>
                      {available && !isPast && <div className="w-1 h-1 rounded-full bg-accent mt-1" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Step 2: Pick time */}
          {step === 2 && selectedDate && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
                <ChevronLeft className="w-4 h-4" />{format(selectedDate, "EEEE, MMMM d")}
              </button>
              <h2 className="font-heading font-semibold mb-4">
                Available Times <span className="text-xs font-normal text-muted-foreground ml-1">({bookerTimezone})</span>
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {getSlotsForDate(selectedDate).map(slot => (
                  <button key={slot.start} onClick={() => { setSelectedSlot(slot); setStep(3); }}
                    className="p-3 rounded-xl bg-card border border-border hover:border-accent hover:bg-accent/10 text-sm font-medium transition-all">
                    <span>{slot.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{slot.duration}min</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Fill form */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
                <ChevronLeft className="w-4 h-4" />
                {selectedDate && format(selectedDate, "MMM d")} at {selectedSlot?.label}
              </button>
              <h2 className="font-heading font-semibold mb-4">Your Details</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Your Name</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Jane Smith"
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Your Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="jane@example.com"
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">What's this about?</label>
                  <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                    placeholder="Brief description..." rows={3}
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 resize-none" />
                </div>
                <Button onClick={confirmBooking}
                  disabled={!form.name || !form.email || !form.reason || booking}
                  className="w-full rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground py-3 mt-2">
                  {booking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Booking...</> : "Confirm Booking"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Confirmed */}
          {step === 4 && selectedSlot && (
            <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-display font-bold mb-2">Booking Confirmed!</h2>
              <p className="text-muted-foreground text-sm mb-1">{formatInTimezone(selectedSlot.start, bookerTimezone)}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                <Globe className="w-3 h-3" />{bookerTimezone}
              </p>
              <div className="mt-6 p-4 rounded-2xl bg-card border border-border text-left space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Booked by</p>
                  <p className="text-sm font-medium">{form.name} · {form.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">About</p>
                  <p className="text-sm">{form.reason}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
