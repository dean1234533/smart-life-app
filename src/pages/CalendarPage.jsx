import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin, Users, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isTomorrow, isThisWeek, startOfDay, addDays, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { calendarEventsService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

function toDate(val) {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  return new Date(val);
}

function dayLabel(date) {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isThisWeek(date)) return format(date, "EEEE");
  return format(date, "EEE, d MMM");
}

function groupByDay(events) {
  const map = new Map();
  for (const ev of events) {
    const d = toDate(ev.event_date);
    if (!d) continue;
    const key = startOfDay(d).getTime();
    if (!map.has(key)) map.set(key, { date: startOfDay(d), events: [] });
    map.get(key).events.push({ ...ev, _date: d });
  }
  return [...map.values()].sort((a, b) => a.date - b.date);
}

export default function CalendarPage() {
  const uid = useCurrentUid();
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["calendarEvents", uid],
    queryFn: () => calendarEventsService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => calendarEventsService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarEvents", uid] });
      toast.success("Event deleted");
    },
  });

  const now = new Date();
  const upcoming = events
    .map(ev => ({ ...ev, _date: toDate(ev.event_date) }))
    .filter(ev => ev._date)
    .sort((a, b) => a._date - b._date);

  const future = upcoming.filter(ev => ev._date >= startOfDay(now));
  const past = upcoming.filter(ev => ev._date < startOfDay(now)).reverse();

  const grouped = groupByDay(future);

  // Mini calendar strip — 7 days starting from weekOffset
  const weekStart = addDays(startOfDay(now), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const eventsByDay = (date) =>
    future.filter(ev => isSameDay(ev._date, date));

  const displayEvents = selectedDay
    ? future.filter(ev => isSameDay(ev._date, selectedDay))
    : future;

  const displayGrouped = selectedDay
    ? groupByDay(displayEvents)
    : grouped;

  return (
    <div className="px-4 pt-12 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Calendar</h1>
        <Badge variant="secondary" className="text-xs">
          {future.length} upcoming
        </Badge>
      </div>

      {/* Week strip */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { setWeekOffset(w => w - 1); setSelectedDay(null); }}
            className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">
            {format(weekStart, "MMM yyyy")}
          </span>
          <button onClick={() => { setWeekOffset(w => w + 1); setSelectedDay(null); }}
            className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const dayEvents = eventsByDay(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const isNow = isToday(day);
            return (
              <button
                key={day.getTime()}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                  isSelected ? "bg-accent text-accent-foreground" :
                  isNow ? "bg-accent/10 text-accent" :
                  "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="text-[10px] font-medium uppercase">{format(day, "EEE")[0]}</span>
                <span className={`text-sm font-semibold ${isNow && !isSelected ? "text-accent" : ""}`}>
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-accent-foreground" : "bg-accent"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : displayGrouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
            <CalendarDays className="w-8 h-8 text-accent" />
          </div>
          <p className="text-muted-foreground text-sm">
            {selectedDay ? "Nothing scheduled for this day." : "No upcoming events. Add one from a note or recording."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence>
            {displayGrouped.map(({ date, events: dayEvs }) => (
              <motion.div key={date.getTime()} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span>{dayLabel(date)}</span>
                  <span className="text-[10px] font-normal normal-case">{format(date, "d MMM")}</span>
                </h3>
                <div className="space-y-2">
                  {dayEvs.map((ev) => (
                    <div key={ev.id}
                      className="p-4 rounded-2xl border border-border/50 bg-card flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                        <CalendarDays className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{ev.title}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                          {ev._date && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {format(ev._date, "h:mm a")}
                              {ev.end_date && ` – ${format(toDate(ev.end_date), "h:mm a")}`}
                            </span>
                          )}
                          {ev.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />{ev.location}
                            </span>
                          )}
                          {ev.attendees?.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="w-3 h-3" />{ev.attendees.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(ev.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {past.length > 0 && !selectedDay && (
            <details className="group">
              <summary className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground list-none flex items-center gap-1.5 mb-2">
                <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                Past events · {past.length}
              </summary>
              <div className="space-y-2 mt-2 opacity-60">
                {past.slice(0, 10).map((ev) => (
                  <div key={ev.id} className="p-3 rounded-2xl border border-border/30 bg-muted/30 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">{ev._date ? format(ev._date, "d MMM · h:mm a") : ""}</p>
                    </div>
                    <button onClick={() => deleteMutation.mutate(ev.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
