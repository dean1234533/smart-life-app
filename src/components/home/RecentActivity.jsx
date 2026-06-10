import { motion } from "framer-motion";
import { StickyNote, Mic, CheckCircle2, Brain } from "lucide-react";
import { format } from "date-fns";
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

export default function RecentActivity({ notes, recordings, tasks }) {
  const activities = [
    ...(notes || []).map((n) => ({
      type: "note",
      title: n.title || "Untitled Note",
      subtitle: n.ai_summary || n.content?.substring(0, 60) + "..." || "",
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
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

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

  return (
    <div>
      <h2 className="text-sm font-heading font-semibold mb-3">Recent Activity</h2>
      <div className="space-y-2">
        {activities.map((activity, i) => {
          const Icon = iconMap[activity.type];
          const colors = colorMap[activity.type];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
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
                  <p className="text-[11px] text-muted-foreground truncate">{activity.subtitle}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {activity.date ? format(new Date(activity.date), "MMM d") : ""}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}