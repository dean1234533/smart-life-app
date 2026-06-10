import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { calendarEventsService, tasksService, notesService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { fetchGoogleEvents, hasValidToken } from "@/services/googleCalendarService";
import { startOfMonth, endOfMonth } from "date-fns";

import { format, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Bell, Clock, Settings, Plus, X, LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function CalendarView() {
  const uid = useCurrentUid();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [googleEvents, setGoogleEvents] = useState([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!hasValidToken()) return;
    fetchGoogleEvents(startOfMonth(currentMonth), endOfMonth(currentMonth))
      .then(setGoogleEvents)
      .catch(() => {});
  }, [currentMonth]);

  const createEventMutation = useMutation({
    mutationFn: async (data) => {
      const event = await calendarEventsService.create(uid, data);
      if (hasValidToken()) {
        const { pushEventToGoogle } = await import("@/services/googleCalendarService");
        await pushEventToGoogle(data).catch(() => {});
      }
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", uid] });
      setShowForm(false);
      setNewTitle("");
      setNewTime("09:00");
      toast.success("Event added");
    },
  });

  const handleAddEvent = () => {
    if (!newTitle.trim()) return;
    const [h, m] = newTime.split(":").map(Number);
    const eventDate = new Date(selectedDate);
    eventDate.setHours(h, m, 0, 0);
    createEventMutation.mutate({ title: newTitle, event_date: eventDate.toISOString(), source_type: "manual", status: "confirmed" });
  };

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", uid],
    queryFn: () => tasksService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", uid],
    queryFn: () => notesService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const { data: calEvents = [] } = useQuery({
    queryKey: ["calendar-events", uid],
    queryFn: () => calendarEventsService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(days);

  const getEventsForDay = (date) => {
    const dayTasks = tasks.filter((t) => t.due_date && isSameDay(new Date(t.due_date), date));
    const dayNotes = notes.filter((n) => {
      const events = n.related_events || [];
      return events.some((e) => {
        const parsed = new Date(e);
        return !isNaN(parsed) && isSameDay(parsed, date);
      });
    });
    const dayCalEvents = calEvents.filter((e) => e.event_date && isSameDay(new Date(e.event_date), date));
    const dayGoogleEvents = googleEvents.filter((e) => e.event_date && isSameDay(new Date(e.event_date), date));
    return { tasks: dayTasks, notes: dayNotes, calEvents: [...dayCalEvents, ...dayGoogleEvents] };
  };

  const selectedEvents = getEventsForDay(selectedDate);
  const allSelectedItems = [
    ...selectedEvents.calEvents.map((e) => ({ type: "cal", ...e })),
    ...selectedEvents.tasks.map((t) => ({ type: "task", ...t })),
    ...selectedEvents.notes.map((n) => ({ type: "note", ...n })),
  ];

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const url = `${window.location.origin}/book`;
              try {
                await navigator.clipboard.writeText(url);
              } catch {
                const el = document.createElement("input");
                el.value = url;
                document.body.appendChild(el);
                el.select();
                document.execCommand("copy");
                document.body.removeChild(el);
              }
              toast.success("Booking link copied!");
            }}
            className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Share Link
          </button>
          <Link to="/availability" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="font-heading font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {dayLabels.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {paddedDays.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />;
          const events = getEventsForDay(day);
          const hasEvents = events.tasks.length > 0 || events.notes.length > 0 || events.calEvents.length > 0;
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all ${
                isSelected
                  ? "bg-accent text-accent-foreground font-semibold"
                  : isCurrentDay
                  ? "bg-accent/10 text-accent font-semibold"
                  : "hover:bg-muted"
              }`}
            >
              {format(day, "d")}
              {hasEvents && (
                <div className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-accent-foreground" : "bg-accent"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day events */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-semibold">
            {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE, MMM d")}
          </h3>
          <button onClick={() => setShowForm(!showForm)} className="p-1 rounded-lg hover:bg-muted transition-colors text-accent">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex gap-2 mb-3">
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Event title..." className="flex-1 h-8 text-sm rounded-xl" />
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-24 h-8 text-sm rounded-xl" />
              <Button size="sm" onClick={handleAddEvent} disabled={createEventMutation.isPending} className="h-8 rounded-xl">Add</Button>
            </motion.div>
          )}
        </AnimatePresence>

        {allSelectedItems.length === 0 && !showForm ? (
          <div className="text-center py-8 rounded-2xl bg-muted/30">
            <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No events for this day</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Events from notes, recordings, and tasks appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {allSelectedItems.map((item, i) => (
                <motion.div
                  key={item.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50"
                >
                  {item.type === "cal" ? (
                    <Clock className="w-5 h-5 text-success shrink-0" />
                  ) : item.type === "task" ? (
                    <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                  ) : (
                    <Bell className="w-5 h-5 text-chart-5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.type === "cal" && item.event_date && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(item.event_date), "h:mm a")}
                        {item.end_date ? ` – ${format(new Date(item.end_date), "h:mm a")}` : ""}
                        {item.location ? ` · ${item.location}` : ""}
                      </p>
                    )}
                    {item.type === "task" && (
                      <Badge
                        variant="secondary"
                        className={`text-[10px] mt-1 ${
                          item.priority === "urgent" ? "bg-destructive/10 text-destructive" :
                          item.priority === "high" ? "bg-chart-1/10 text-chart-1" :
                          "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.priority || "medium"}
                      </Badge>
                    )}
                    {item.type === "cal" && item.source_type === "booking" && (
                      <Badge variant="secondary" className="text-[10px] mt-1 bg-success/10 text-success">booking</Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}