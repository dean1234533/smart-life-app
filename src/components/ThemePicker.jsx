import { useState, useEffect } from "react";
import { Palette, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BG_COLORS = [
  { id: "dark-blue",   label: "Dark Blue", hex: "#0d1520", bg: "222 35% 9%",  card: "220 30% 13%", border: "215 25% 22%", muted: "215 25% 17%" },
  { id: "dark-gray",   label: "Gray",      hex: "#111318", bg: "225 15% 8%",  card: "225 12% 12%", border: "225 10% 20%", muted: "225 10% 15%" },
  { id: "dark-green",  label: "Forest",    hex: "#0a1410", bg: "150 30% 7%",  card: "150 25% 11%", border: "150 20% 19%", muted: "150 20% 14%" },
  { id: "dark-purple", label: "Midnight",  hex: "#100d1a", bg: "260 30% 8%",  card: "260 25% 12%", border: "260 20% 20%", muted: "260 20% 15%" },
  { id: "dark-rose",   label: "Noir",      hex: "#160a0d", bg: "345 30% 7%",  card: "345 25% 11%", border: "345 20% 19%", muted: "345 20% 14%" },
  { id: "pitch-black", label: "Black",     hex: "#080808", bg: "0 0% 4%",     card: "0 0% 8%",     border: "0 0% 14%",    muted: "0 0% 10%" },
];

function applyBg(bgColor) {
  const root = document.documentElement;
  root.style.setProperty("--background", bgColor.bg);
  root.style.setProperty("--card", bgColor.card);
  root.style.setProperty("--popover", bgColor.card);
  root.style.setProperty("--border", bgColor.border);
  root.style.setProperty("--input", bgColor.border);
  root.style.setProperty("--muted", bgColor.muted);
  root.style.setProperty("--sidebar-background", bgColor.card);
  root.style.setProperty("--sidebar-border", bgColor.border);
  root.style.setProperty("--sidebar-accent", bgColor.muted);
  const geoBg = document.querySelector(".geo-bg");
  if (geoBg) geoBg.style.backgroundColor = bgColor.hex;
}

const THEMES = [
  { id: "cyan",   label: "Cyan",   accent: "186 100% 60%", bg: "222 35% 9%",  card: "220 30% 13%", border: "215 25% 22%", muted: "215 25% 17%", mutedFg: "215 20% 68%", previewAccent: "#22d4ee", previewBg: "#0f1625" },
  { id: "purple", label: "Purple", accent: "265 90% 70%",  bg: "255 30% 8%",  card: "255 25% 12%", border: "255 20% 20%", muted: "255 20% 15%", mutedFg: "255 15% 65%", previewAccent: "#a855f7", previewBg: "#110f1e" },
  { id: "rose",   label: "Rose",   accent: "338 90% 65%",  bg: "340 30% 8%",  card: "340 25% 12%", border: "340 20% 20%", muted: "340 20% 15%", mutedFg: "340 15% 65%", previewAccent: "#f43f77", previewBg: "#1a0d13" },
  { id: "amber",  label: "Amber",  accent: "38 100% 60%",  bg: "30 30% 8%",   card: "30 25% 12%",  border: "30 20% 20%",  muted: "30 20% 15%",  mutedFg: "30 15% 65%",  previewAccent: "#fbbf24", previewBg: "#1a1409" },
  { id: "green",  label: "Green",  accent: "142 80% 55%",  bg: "150 30% 7%",  card: "150 25% 11%", border: "150 20% 19%", muted: "150 20% 14%", mutedFg: "150 15% 65%", previewAccent: "#22c55e", previewBg: "#0a1510" },
  { id: "blue",   label: "Blue",   accent: "213 100% 65%", bg: "220 35% 8%",  card: "220 30% 12%", border: "220 25% 20%", muted: "220 25% 15%", mutedFg: "220 20% 65%", previewAccent: "#3b82f6", previewBg: "#0c1220" },
];

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--primary", theme.accent);
  root.style.setProperty("--ring", theme.accent);
  root.style.setProperty("--background", theme.bg);
  root.style.setProperty("--card", theme.card);
  root.style.setProperty("--popover", theme.card);
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--input", theme.border);
  root.style.setProperty("--muted", theme.muted);
  root.style.setProperty("--muted-foreground", theme.mutedFg);
  root.style.setProperty("--sidebar-background", theme.card);
  root.style.setProperty("--sidebar-border", theme.border);
  root.style.setProperty("--sidebar-primary", theme.accent);
  root.style.setProperty("--sidebar-accent", theme.muted);
}

async function savePreferenceToFirestore(uid, themeId, bgId) {
  if (!uid) return;
  try {
    const { updateUserDoc } = await import("@/lib/firestoreService");
    await updateUserDoc(uid, { colourPreference: `${themeId}|${bgId}` });
  } catch { /* non-blocking */ }
}

export default function ThemePicker({ uid }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => localStorage.getItem("mindflow-theme") || "cyan");
  const [activeBg, setActiveBg] = useState(() => localStorage.getItem("mindflow-bg") || "dark-blue");

  // Apply saved theme on mount
  useEffect(() => {
    const saved = THEMES.find((t) => t.id === active);
    if (saved) applyTheme(saved);
    const savedBg = BG_COLORS.find((b) => b.id === activeBg);
    if (savedBg) applyBg(savedBg);
  }, []);

  // Load preference from Firestore if uid provided
  useEffect(() => {
    if (!uid) return;
    const loadPref = async () => {
      try {
        const { getOrCreateUser } = await import("@/lib/firestoreService");
        const profile = await getOrCreateUser(uid);
        if (profile?.colourPreference && profile.colourPreference.includes('|')) {
          const [themeId, bgId] = profile.colourPreference.split('|');
          const theme = THEMES.find(t => t.id === themeId);
          const bg = BG_COLORS.find(b => b.id === bgId);
          if (theme) { setActive(themeId); applyTheme(theme); localStorage.setItem("mindflow-theme", themeId); }
          if (bg) { setActiveBg(bgId); applyBg(bg); localStorage.setItem("mindflow-bg", bgId); }
        }
      } catch { /* non-blocking */ }
    };
    loadPref();
  }, [uid]);

  const select = (theme) => {
    setActive(theme.id);
    applyTheme(theme);
    localStorage.setItem("mindflow-theme", theme.id);
    savePreferenceToFirestore(uid, theme.id, activeBg);
  };

  const selectBg = (bgColor) => {
    setActiveBg(bgColor.id);
    applyBg(bgColor);
    localStorage.setItem("mindflow-bg", bgColor.id);
    savePreferenceToFirestore(uid, active, bgColor.id);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card hover:bg-muted transition-colors"
        title="Change theme"
      >
        <Palette className="w-4 h-4 text-accent" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 w-80 rounded-2xl border border-border bg-card p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-heading font-semibold text-sm">Appearance</span>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-2">Accent Color</p>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {THEMES.map((theme) => (
                  <button key={theme.id} onClick={() => select(theme)}
                    className="relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all"
                    style={{ borderColor: active === theme.id ? theme.previewAccent : "transparent", background: theme.previewBg }}
                  >
                    <div className="w-8 h-8 rounded-full" style={{ background: theme.previewAccent, boxShadow: `0 0 12px ${theme.previewAccent}66` }} />
                    <span className="text-[11px] font-medium" style={{ color: active === theme.id ? theme.previewAccent : "#aaa" }}>{theme.label}</span>
                    {active === theme.id && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: theme.previewAccent }}>
                        <Check className="w-2.5 h-2.5 text-black" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-2">Background</p>
              <div className="grid grid-cols-3 gap-3">
                {BG_COLORS.map((bgColor) => (
                  <button key={bgColor.id} onClick={() => selectBg(bgColor)}
                    className="relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all"
                    style={{ borderColor: activeBg === bgColor.id ? "#fff4" : "transparent", background: bgColor.hex }}
                  >
                    <div className="w-8 h-8 rounded-full border border-white/20" style={{ background: bgColor.hex }} />
                    <span className="text-[11px] font-medium" style={{ color: activeBg === bgColor.id ? "#fff" : "#777" }}>{bgColor.label}</span>
                    {activeBg === bgColor.id && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center bg-white/20">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
