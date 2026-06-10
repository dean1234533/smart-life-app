import { motion } from "framer-motion";
import { Sparkles, ArrowRight, ShoppingCart, CalendarClock, UserCheck, Bell } from "lucide-react";

const defaultSuggestions = [
  {
    icon: CalendarClock,
    title: "Create your first note",
    description: "Start capturing your thoughts and let AI organize them",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: ShoppingCart,
    title: "Try a voice recording",
    description: "Record a meeting and let AI extract action items",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    icon: UserCheck,
    title: "Build your memory bank",
    description: "Tell MindFlow about important people and preferences",
    color: "text-chart-5",
    bgColor: "bg-chart-5/10",
  },
];

export default function SmartSuggestions({ suggestions }) {
  const items = suggestions?.length > 0 ? suggestions : defaultSuggestions;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-heading font-semibold">AI Suggestions</h2>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => {
          const Icon = item.icon || Bell;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-accent/30 transition-all cursor-pointer group"
            >
              <div className={`w-9 h-9 rounded-lg ${item.bgColor} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}