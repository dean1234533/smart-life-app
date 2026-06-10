import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutGrid, X, FileText, Mic, Calendar, CheckSquare, Clock, Bot,
  Home, Share2, ShoppingCart, Users, DollarSign, ChefHat,
  MessageSquare, UserCog, BookOpen, Link as LinkIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const NAV_ITEMS = [
  { label: "Home",       icon: Home,          path: "/" },
  { label: "Notes",      icon: FileText,       path: "/notes" },
  { label: "Tasks",      icon: CheckSquare,    path: "/tasks" },
  { label: "Calendar",   icon: Calendar,       path: "/calendar" },
  { label: "Recordings", icon: Mic,            path: "/recordings" },
  { label: "Timeline",   icon: Clock,          path: "/timeline" },
  { label: "Agent",      icon: Bot,            path: "/agent" },
  { label: "Shopping",   icon: ShoppingCart,   path: "/shopping" },
  { label: "Contacts",   icon: Users,          path: "/contacts" },
  { label: "Expenses",   icon: DollarSign,     path: "/expenses" },
  { label: "Recipes",    icon: ChefHat,        path: "/recipes" },
  { label: "Meetings",   icon: MessageSquare,  path: "/meetings" },
  { label: "Follow-ups", icon: BookOpen,       path: "/follow-ups" },
  { label: "Availability", icon: UserCog,      path: "/availability" },
  { label: "Booking",    icon: LinkIcon,       path: "/booking-links" },
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
              className="fixed left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-border bg-card p-4 shadow-2xl overflow-y-auto"
              style={{
                bottom: 'max(7rem, calc(5.5rem + env(safe-area-inset-bottom)))',
                width: 'min(20rem, calc(100vw - 1.5rem))',
                maxHeight: 'min(70vh, calc(100vh - 12rem))',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-heading font-semibold text-sm">Go to...</span>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setOpen(false)}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/50 hover:bg-accent/10 hover:text-accent transition-colors"
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                    </Link>
                  );
                })}
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/book`;
                    let copied = false;
                    // Try modern API first (must await BEFORE closing modal or page loses focus)
                    if (navigator.clipboard && window.isSecureContext) {
                      try { await navigator.clipboard.writeText(url); copied = true; } catch {}
                    }
                    // Fallback: textarea trick
                    if (!copied) {
                      const el = document.createElement("textarea");
                      el.value = url;
                      el.style.cssText = "position:fixed;left:-9999px;top:50%;opacity:1";
                      document.body.appendChild(el);
                      el.focus(); el.select();
                      try { copied = document.execCommand("copy"); } catch {}
                      el.remove();
                    }
                    toast[copied ? "success" : "info"](copied ? "Booking link copied!" : `Your link: ${url}`, { duration: copied ? 3000 : 8000 });
                    setOpen(false);
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/50 hover:bg-accent/10 hover:text-accent transition-colors"
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
