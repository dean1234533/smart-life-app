import { Sun, Moon, CloudSun } from "lucide-react";
import { motion } from "framer-motion";

export default function DailyBriefing({ user, taskCount, noteCount, memoryCount }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const Icon = hour < 12 ? Sun : hour < 18 ? CloudSun : Moon;
  const firstName = user?.full_name?.split(" ")[0] || "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary p-6 text-primary-foreground"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-accent/10 -translate-y-8 translate-x-8 blur-2xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-accent/5 translate-y-6 -translate-x-6 blur-xl" />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent/20 border border-accent/40">
            <Icon className="w-5 h-5 text-accent drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
          </div>
          <span className="text-base font-heading font-semibold tracking-wide" style={{color: 'hsl(186 100% 72%)'}}>
            {greeting}
          </span>
        </div>
        <h1 className="text-3xl font-display font-bold mb-4 tracking-tight">{firstName}</h1>
        <p className="text-sm text-primary-foreground/70 mb-4">
          Here's your daily briefing from MindFlow
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
            <p className="text-2xl font-bold">{taskCount}</p>
            <p className="text-[10px] text-primary-foreground/70">Pending Tasks</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
            <p className="text-2xl font-bold">{noteCount}</p>
            <p className="text-[10px] text-primary-foreground/70">Recent Notes</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
            <p className="text-2xl font-bold">{memoryCount}</p>
            <p className="text-[10px] text-primary-foreground/70">Memories</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}