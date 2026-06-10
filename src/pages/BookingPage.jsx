import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getDocs, collection, query, where, limit, doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { bookingsService, getOrCreateUser } from "@/lib/firestoreService";
import { sendBookingConfirmation } from "@/services/emailService";
import { format, addDays, startOfDay, isBefore, isAfter, getDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, Sparkles, Globe, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function generateTimeSlots(noBookingBefore, noBookingAfter, bufferMinutes, durationMinutes = 30) {
  const slots = [];
  const [sh, sm] = noBookingBefore.split(":").map(Number);
  const [eh, em] = noBookingAfter.split(":").map(Number);
  let current = sh * 60 + sm;
  const end = eh * 60 + em;
  const step = durationMinutes + bufferMinutes;
  while (current + durationMinutes <= end) {
    const hh = Math.floor(current / 60).toString().padStart(2, "0");
    const mm = (current % 60).toString().padStart(2, "0");
    slots.push(`${hh}:${mm}`);
    current += step;
  }
  return slots;
}

function formatInTimezone(date, timezone) {
  try {
    return new Date(date).toLocaleString("en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: timezone,
    });
  } catch {
    return new Date(date).toLocaleString();
  }
}

function formatTimeInTimezone(date, timezone) {
  try {
    return new Date(date).toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", timeZone: timezone,
    });
  } catch {
    return new Date(date).toLocaleTimeString();
  }
}

export default function BookingPage() {
  const { slug } = useParams(); // /book/:slug
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState({ bookerName: "", bookerEmail: "", reasonForMeeting: "" });
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  const [ownerUid, setOwnerUid] = useState(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [bookingLink, setBookingLink] = useState(null);
  const [globalRules, setGlobalRules] = useState(null);
  const [existingBookings, setExistingBookings] = useState([]);
  const [bookerTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => { loadBookingLink(); }, [slug]);

  const loadBookingLink = async () => {
    setLoading(true);
    setError("");
    try {
      if (!slug) { setError("No booking link specified."); setLoading(false); return; }

      // Find the user that owns this slug by scanning all users' bookingLinks subcollections
      // In production, use a Firestore collection group query or a top-level slug index
      const slugIndex = await getDocs(
        query(collection(firestore, "slugIndex"), where("slug", "==", slug), limit(1))
      );

      let foundUid = null, foundLink = null;

      if (!slugIndex.empty) {
        const entry = slugIndex.docs[0].data();
        foundUid = entry.uid;
        const linkSnap = await getDoc(doc(firestore, "users", foundUid, "bookingLinks", entry.linkId));
        if (linkSnap.exists()) foundLink = { id: linkSnap.id, ...linkSnap.data() };
      }

      // Fallback: If no slug index, try to look up by URL param uid (passed as query param)
      if (!foundLink) {
        const params = new URLSearchParams(window.location.search);
        const uidParam = params.get("uid");
        if (uidParam) {
          foundUid = uidParam;
          const linksSnap = await getDocs(
            query(collection(firestore, "users", uidParam, "bookingLinks"), where("slug", "==", slug), limit(1))
          );
          if (!linksSnap.empty) foundLink = { id: linksSnap.docs[0].id, ...linksSnap.docs[0].data() };
        }
      }

      if (!foundLink || !foundLink.active) {
        setError("This booking link is inactive or not found.");
        setLoading(false);
        return;
      }

      setOwnerUid(foundUid);
      setBookingLink(foundLink);

      // Load owner's global rules + email
      if (foundUid) {
        const profile = await getOrCreateUser(foundUid);
        setGlobalRules(profile?.globalBookingRules || {
          bufferMinutes: 15, noBookingBefore: "09:00", noBookingAfter: "18:00",
          weekdaysOnly: true, maxBookingsPerDay: 8,
        });
        setOwnerEmail(profile?.email || "");

        // Load existing bookings for this link
        const bks = await bookingsService.listByLink(foundUid, foundLink.id);
        setExistingBookings(bks);
      }
    } catch (err) {
      setError("Failed to load booking page. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveRules = () => ({ ...globalRules, ...(bookingLink?.rules || {}) });

  const getAvailableTimesForDate = (date) => {
    const rules = getEffectiveRules();
    if (!rules) return [];
    const dow = getDay(date);
    if (rules.weekdaysOnly && (dow === 0 || dow === 6)) return [];

    const times = generateTimeSlots(
      rules.noBookingBefore || "09:00",
      rules.noBookingAfter || "18:00",
      rules.bufferMinutes || 15,
      30
    );

    return times.filter(t => {
      const [h, m] = t.split(":").map(Number);
      const dt = new Date(date);
      dt.setHours(h, m, 0, 0);
      if (!isAfter(dt, new Date())) return false;

      // Check not already booked
      const isBooked = existingBookings.some(b => {
        if (!b.confirmed) return false;
        const slotDate = b.slot?.toDate ? b.slot.toDate() : new Date(b.slot);
        return Math.abs(slotDate.getTime() - dt.getTime()) < 30 * 60 * 1000;
      });

      return !isBooked;
    }).map(t => ({ time: t, duration: 30 }));
  };

  const hasSlotsOnDay = (date) => getAvailableTimesForDate(date).length > 0;

  const today = startOfDay(new Date());
  const weekStart = addDays(today, weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const confirmBooking = async () => {
    if (!ownerUid || !bookingLink || !selectedDate || !selectedTime) return;
    setBooking(true);
    try {
      const [h, m] = selectedTime.time.split(":").map(Number);
      const slotDate = new Date(selectedDate);
      slotDate.setHours(h, m, 0, 0);

      await bookingsService.create(ownerUid, {
        linkId: bookingLink.id,
        bookerName: form.bookerName,
        bookerEmail: form.bookerEmail,
        reasonForMeeting: form.reasonForMeeting,
        slot: slotDate.toISOString(),
        timezone: bookerTimezone,
        confirmed: true,
      });

      // Send confirmation email
      await sendBookingConfirmation({
        bookerName: form.bookerName,
        bookerEmail: form.bookerEmail,
        ownerEmail,
        slot: slotDate.toISOString(),
        timezone: bookerTimezone,
        meetingTitle: bookingLink.title || "Meeting",
        duration: 30,
      }).catch(() => {}); // non-blocking

      setConfirmed(true);
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
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-accent/5" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-2xl font-display font-bold">{bookingLink?.title || "Book a Meeting"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a time that works for you</p>
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Globe className="w-3 h-3" />
            <span>{bookerTimezone}</span>
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
                <p className="text-sm font-medium">{format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}</p>
                <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1.5 mb-6">
                {weekDays.map((day) => {
                  const available = hasSlotsOnDay(day);
                  const isPast = isBefore(day, today);
                  return (
                    <button key={day.toISOString()} disabled={!available || isPast}
                      onClick={() => { setSelectedDate(day); setStep(2); }}
                      className={`flex flex-col items-center py-2.5 px-1 rounded-xl text-xs transition-all ${
                        available && !isPast
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
              <h2 className="font-heading font-semibold mb-4">Available Times
                <span className="text-xs text-muted-foreground font-normal ml-2">({bookerTimezone})</span>
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {getAvailableTimesForDate(selectedDate).map(({ time, duration }) => {
                  const [h, m] = time.split(":").map(Number);
                  const dt = new Date(selectedDate);
                  dt.setHours(h, m, 0, 0);
                  const displayTime = formatTimeInTimezone(dt, bookerTimezone);
                  return (
                    <button key={time} onClick={() => { setSelectedTime({ time, duration }); setStep(3); }}
                      className="p-3 rounded-xl bg-card border border-border hover:border-accent hover:bg-accent/10 text-sm font-medium transition-all">
                      <span>{displayTime}</span>
                      <span className="block text-[10px] text-muted-foreground">{duration}min</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
                <ChevronLeft className="w-4 h-4" />
                {selectedDate && format(selectedDate, "MMM d")} at {selectedTime?.time}
              </button>
              <h2 className="font-heading font-semibold mb-4">Your Details</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Your Name</label>
                  <input value={form.bookerName} onChange={e => setForm({ ...form, bookerName: e.target.value })}
                    placeholder="Jane Smith"
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Your Email</label>
                  <input type="email" value={form.bookerEmail} onChange={e => setForm({ ...form, bookerEmail: e.target.value })}
                    placeholder="jane@example.com"
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">What's this meeting about?</label>
                  <textarea value={form.reasonForMeeting} onChange={e => setForm({ ...form, reasonForMeeting: e.target.value })}
                    placeholder="Brief description..." rows={3}
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 resize-none" />
                </div>
                <Button onClick={confirmBooking}
                  disabled={!form.bookerName || !form.bookerEmail || !form.reasonForMeeting || booking}
                  className="w-full rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground py-3 mt-2">
                  {booking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Booking...</> : "Confirm Booking"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Confirmed */}
          {step === 4 && selectedDate && selectedTime && (
            <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-display font-bold mb-2">Booking Confirmed!</h2>
              {(() => {
                const [h, m] = selectedTime.time.split(":").map(Number);
                const dt = new Date(selectedDate);
                dt.setHours(h, m, 0, 0);
                return (
                  <>
                    <p className="text-muted-foreground text-sm mb-1">{formatInTimezone(dt, bookerTimezone)}</p>
                    <p className="text-muted-foreground text-sm flex items-center justify-center gap-1">
                      <Globe className="w-3 h-3" />{bookerTimezone}
                    </p>
                  </>
                );
              })()}
              <p className="text-xs text-muted-foreground mt-2">A confirmation email has been sent to {form.bookerEmail}</p>
              <div className="mt-6 p-4 rounded-2xl bg-card border border-border text-left">
                <p className="text-xs text-muted-foreground mb-1">Meeting with</p>
                <p className="font-medium">{form.bookerName}</p>
                <p className="text-xs text-muted-foreground mt-2 mb-1">About</p>
                <p className="text-sm">{form.reasonForMeeting}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
