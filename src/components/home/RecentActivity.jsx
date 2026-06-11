import { motion } from "framer-motion";
import { StickyNote, Mic, CheckCircle2, Brain } from "lucide-react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Link } from "react-router-dom";

const iconMap = {
  note: StickyNote,
  voice: Mic,
  task: CheckCircle2,
  memory: Brain,
};

const colorMap = {
  note: "text-accent bg-accent/10",
  voice: "text-success bg-success/10",
  task: "text-chart-1 bg-chart-1/10",
  memory: "text-chart-5 bg-chart-5/10",
};

function dateLabel(dateStr) {
  if (!dateStr) return "Unknown";
  try {
    const d = typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "d MMMM yyyy");
  } catch {
    return "Unknown";
  }
}

function dayKey(dateStr) {
  if (!dateStr) return "unknown";
  try {
    const d = typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
    return format(d, "yyyy-MM-dd");
  } catch {
    return "unknown";
  }
}

export default function RecentActivity({ notes, recordings, tasks }) {
  const activities = [
    ...(notes || []).map((n) => ({
      type: "note",
      title: n.title || "Untitled Note",
      subtitle: n.ai_summary || n.content?.substring(0, 60) || "",
      date: n.created_date,
      link: `/notes/${n.id}`,
    })),
    ...(recordings || []).map((r) => ({
      type: "voice",
      title: r.title || "Recording",
      subtitle: r.ai_summary || "Voice recording",
      date: r.created_date,
      link: `/recordings/${r.id}`,
    })),
    ...(tasks || [])
      .filter((t) => t.status === "completed")
      .map((t) => ({
        type: "task",
        title: t.title,
        subtitle: "Task completed",
        date: t.updated_date,
        link: "/tasks",
      })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
          <Brain className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No activity yet</p>
        <p className="text-xs text-muted-foreground/70">Start by creating a note or recording</p>
      </div>
    );
  }

  // Group by day
  const groups = [];
  const seen = {};
  for (const item of activities) {
    const key = dayKey(item.date);
    if (!seen[key]) {
      seen[key] = true;
      groups.push({ key, label: dateLabel(item.date), items: [] });
    }
    groups[groups.length - 1].items.push(item);
  }

  return (
    <div>
      <h2 className="text-sm font-heading font-semibold mb-3">Recent Activity</h2>
      <div className="space-y-4">
        {groups.map((group, gi) => (
          <div key={group.key}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((activity, i) => {
                const Icon = iconMap[activity.type];
                const colors = colorMap[activity.type];
                return (
                  <motion.div
                    key={`${gi}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (gi * 3 + i) * 0.04 }}
                  >
                    <Link
                      to={activity.link}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        {activity.subtitle && (
                          <p className="text-[11px] text-muted-foreground truncate">{activity.subtitle}</p>
                        )}
                      </div>
                      {activity.date && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(typeof activity.date === "string" ? parseISO(activity.date) : new Date(activity.date), "HH:mm")}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
