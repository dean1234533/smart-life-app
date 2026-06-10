import { useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, X, FileText, Mic, Calendar, CheckSquare, Clock, Bot, Home, Share2, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const NAV_ITEMS = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Notes", icon: FileText, path: "/notes" },
  { label: "Tasks", icon: CheckSquare, path: "/tasks" },
  { label: "Calendar", icon: Calendar, path: "/calendar" },
  { label: "Recordings", icon: Mic, path: "/recordings" },
  { label: "Timeline", icon: Clock, path: "/timeline" },
  { label: "Availability", icon: Settings, path: "/availability" },
  { label: "Agent", icon: Bot, path: "/agent" },
];

export default function QuickNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card hover:bg-muted transition-colors"
        title="All sections"
      >
        <LayoutGrid className="w-4 h-4 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 w-72 rounded-2xl border border-border bg-card p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-heading font-semibold text-sm">Go to...</span>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setOpen(false)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 hover:bg-accent/10 hover:text-accent transition-colors"
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                    </Link>
                  );
                })}
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/book`;
                    try {
                      await navigator.clipboard.writeText(url);
                      toast.success("Booking link copied!");
                    } catch {
                      // fallback: select a temp input
                      const el = document.createElement("input");
                      el.value = url;
                      document.body.appendChild(el);
                      el.select();
                      document.execCommand("copy");
                      document.body.removeChild(el);
                      toast.success("Booking link copied!");
                    }
                    setOpen(false);
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 hover:bg-accent/10 hover:text-accent transition-colors"
                >
                  <Share2 className="w-5 h-5" />
                  <span className="text-[10px] font-medium text-center leading-tight">Share Link</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}