import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { availabilityService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, Link, Check, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DURATIONS = [15, 30, 45, 60, 90, 120];

export default function Availability() {
  const uid = useCurrentUid();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [copied, setCopied] = useState(false);

  const [newSlot, setNewSlot] = useState({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "17:00",
    slot_duration_minutes: 30,
    label: "",
    is_active: true,
  });

  const { data: slots = [] } = useQuery({
    queryKey: ["availability", uid],
    queryFn: () => availabilityService.list(uid),
    enabled: !!uid,
  });

  const createMutation = useMutation({
    mutationFn: (data) => availabilityService.create(uid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability", uid] });
      setShowAdd(false);
      toast.success("Availability slot added");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => availabilityService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability", uid] });
      toast.success("Slot removed");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => availabilityService.update(uid, id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["availability", uid] }),
  });

  const bookingLink = `${window.location.origin}/book`;

  const copyLink = () => {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    toast.success("Booking link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const slotsByDay = DAYS.map((day, i) => ({
    day,
    index: i,
    slots: slots.filter((s) => s.day_of_week === i),
  }));

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-display font-bold flex-1">Availability</h1>
        <Button size="sm" onClick={() => setShowAdd(true)} className="rounded-xl gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-3.5 h-3.5" />
          Add Slot
        </Button>
      </div>

      {/* Shareable booking link */}
      <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20 mb-6">
        <p className="text-xs font-heading font-semibold text-accent uppercase tracking-wider mb-2">Your Booking Link</p>
        <p className="text-xs text-muted-foreground mb-3">Share this link so others can book time with you based on your available slots.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted/60 rounded-xl px-3 py-2 text-xs text-foreground truncate font-mono">{bookingLink}</div>
          <Button size="sm" onClick={copyLink} className="rounded-xl shrink-0 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Add Slot Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-card border border-border mb-6 space-y-3"
          >
            <h3 className="text-sm font-heading font-semibold">New Availability Slot</h3>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Day</label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => (
                  <button
                    key={d}
                    onClick={() => setNewSlot({ ...newSlot, day_of_week: i })}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${newSlot.day_of_week === i ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Start</label>
                <input type="time" value={newSlot.start_time} onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                  className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent/50" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">End</label>
                <input type="time" value={newSlot.end_time} onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                  className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent/50" />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Slot Duration</label>
              <div className="flex flex-wrap gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setNewSlot({ ...newSlot, slot_duration_minutes: d })}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${newSlot.slot_duration_minutes === d ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Label (optional)</label>
              <input
                value={newSlot.label}
                onChange={(e) => setNewSlot({ ...newSlot, label: e.target.value })}
                placeholder="e.g. Morning meetings"
                className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button size="sm" onClick={() => createMutation.mutate(newSlot)} disabled={createMutation.isPending} className="flex-1 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
                Add Slot
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slots by day */}
      <div className="space-y-4">
        {slotsByDay.map(({ day, index, slots: daySlots }) => (
          <div key={day}>
            <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">{day}</h3>
            {daySlots.length === 0 ? (
              <div className="text-xs text-muted-foreground/50 pl-1">No slots</div>
            ) : (
              <div className="space-y-2">
                {daySlots.map((slot) => (
                  <div key={slot.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                    <Clock className="w-4 h-4 text-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{slot.start_time} – {slot.end_time}</p>
                      <p className="text-xs text-muted-foreground">{slot.slot_duration_minutes}min slots{slot.label ? ` · ${slot.label}` : ""}</p>
                    </div>
                    <button
                      onClick={() => toggleMutation.mutate({ id: slot.id, is_active: !slot.is_active })}
                      className={`w-9 h-5 rounded-full transition-colors ${slot.is_active ? "bg-accent" : "bg-muted"}`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform mx-0.5 ${slot.is_active ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                    <button onClick={() => deleteMutation.mutate(slot.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {slots.length === 0 && !showAdd && (
        <div className="text-center py-12 rounded-2xl bg-muted/30 mt-4">
          <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No availability slots yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Add slots to let others book time with you</p>
          <Button size="sm" onClick={() => setShowAdd(true)} className="mt-4 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add First Slot
          </Button>
        </div>
      )}
    </div>
  );
}