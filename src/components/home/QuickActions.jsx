import { Link } from "react-router-dom";
import { Plus, Mic, Brain, ListTodo } from "lucide-react";
import { motion } from "framer-motion";

const actions = [
  { icon: Plus, label: "New Note", path: "/notes/new", color: "bg-accent/10 text-accent" },
  { icon: Mic, label: "Record", path: "/recordings/new", color: "bg-success/10 text-success" },
  { icon: Brain, label: "Memories", path: "/timeline", color: "bg-chart-5/10 text-chart-5" },
  { icon: ListTodo, label: "Tasks", path: "/tasks", color: "bg-chart-1/10 text-chart-1" },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {actions.map((action, i) => {
        const Icon = action.icon;
        return (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={action.path}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card hover:bg-muted transition-colors border border-border/50"
            >
              <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-medium">{action.label}</span>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}