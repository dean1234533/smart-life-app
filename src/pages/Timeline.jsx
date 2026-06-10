import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, StickyNote, Mic, CheckCircle2, Brain, Calendar, Handshake, Milestone, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { notesService, recordingsService, timelineEventsService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

const eventConfig = {
  note: { icon: StickyNote, color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
  meeting: { icon: Calendar, color: "text-success", bg: "bg-success/10", border: "border-success/20" },
  conversation: { icon: Mic, color: "text-chart-5", bg: "bg-chart-5/10", border: "border-chart-5/20" },
  decision: { icon: Milestone, color: "text-chart-1", bg: "bg-chart-1/10", border: "border-chart-1/20" },
  task: { icon: CheckCircle2, color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
  promise: { icon: Handshake, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
  milestone: { icon: Milestone, color: "text-success", bg: "bg-success/10", border: "border-success/20" },
};

function toDate(val) {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  return new Date(val);
}

export default function Timeline() {
  const uid = useCurrentUid();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["timelineEvents", uid],
    queryFn: () => timelineEventsService.list(uid, { orderField: 'event_date' }),
    enabled: !!uid,
    initialData: [],
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", uid],
    queryFn: () => notesService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const { data: recordings = [] } = useQuery({
    queryKey: ["recordings", uid],
    queryFn: () => recordingsService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const allItems = [
    ...events.map((e) => ({
      ...e,
      type: e.event_type,
      date: toDate(e.event_date || e.createdAt),
    })),
    ...notes.map((n) => ({
      id: `note-${n.id}`,
      type: "note",
      title: n.title || "Untitled Note",
      description: n.ai_summary || n.content?.substring(0, 100),
      date: toDate(n.createdAt || n.created_date),
      related_people: n.related_people,
      tags: n.tags,
    })),
    ...recordings.map((r) => ({
      id: `rec-${r.id}`,
      type: "conversation",
      title: r.title || "Recording",
      description: r.ai_summary,
      date: toDate(r.createdAt || r.created_date),
      related_people: r.related_people,
      tags: r.tags,
    })),
  ].filter(i => i.date).sort((a, b) => b.date - a.date);

  const filtered = allItems.filter((item) => {
    if (filter !== "all" && item.type !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.related_people?.some((p) => p.toLowerCase().includes(q)) ||
      item.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  const grouped = {};
  filtered.forEach((item) => {
    const d = item.date;
    let label;
    if (isToday(d)) label = "Today";
    else if (isYesterday(d)) label = "Yesterday";
    else if (isThisWeek(d)) label = "This Week";
    else if (isThisMonth(d)) label = "This Month";
    else label = format(d, "MMMM yyyy");
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(item);
  });

  const filters = [
    { value: "all", label: "All" },
    { value: "note", label: "Notes" },
    { value: "conversation", label: "Voice" },
    { value: "decision", label: "Decisions" },
    { value: "promise", label: "Promises" },
  ];

  return (
    <div className="px-4 pt-12 pb-6">
      <h1 className="text-2xl font-display font-bold mb-6">Timeline</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search your life..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-muted/50 border-0 rounded-xl" />
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              filter === f.value ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>{f.label}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-heading font-semibold mb-1">Your timeline is empty</h3>
          <p className="text-sm text-muted-foreground">Notes and recordings will appear here</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([label, items]) => (
            <div key={label}>
              <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label}</h3>
              <div className="relative pl-6 border-l-2 border-border/50 space-y-4">
                {items.map((item, i) => {
                  const config = eventConfig[item.type] || eventConfig.note;
                  const Icon = config.icon;
                  return (
                    <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }} className="relative">
                      <div className={`absolute -left-[calc(1.5rem+5px)] top-3 w-2.5 h-2.5 rounded-full ${config.bg} border-2 ${config.border}`} />
                      <div className="p-3 rounded-xl bg-card border border-border/50 hover:border-accent/20 transition-all">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {item.related_people?.slice(0, 2).map((p) => (
                                <Badge key={p} variant="secondary" className="text-[9px] px-1 py-0">{p}</Badge>
                              ))}
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {item.date ? format(item.date, "h:mm a") : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
