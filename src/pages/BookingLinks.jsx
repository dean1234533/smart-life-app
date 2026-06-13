import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Link2, Plus, Trash2, ArrowLeft, Check, Copy, ToggleLeft, ToggleRight,
  Calendar, Settings, X, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { bookingLinksService, getOrCreateUser } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

const WORKER_URL = import.meta.env.VITE_CALENDAR_WORKER_URL || '';

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_TIMES = Array.from({ length: 36 }, (_, i) => {
  const mins = 300 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

function makeDefaultSchedule() {
  return Object.fromEntries(
    [0,1,2,3,4,5,6].map(i => [i, { enabled: false, slots: [] }])
  );
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const DEFAULT_RULES = {
  bufferMinutes: 15,
  maxBookingsPerDay: 8,
  slotDurationMinutes: 60,
  schedule: makeDefaultSchedule(),
};

export default function BookingLinks() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uid = useCurrentUid();
  const [showNew, setShowNew] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [globalRules, setGlobalRules] = useState(DEFAULT_RULES);
  const [savingRules, setSavingRules] = useState(false);
  const [selectedRuleDay, setSelectedRuleDay] = useState(1);
  const [busyTimes, setBusyTimes] = useState([]);

  const [newLink, setNewLink] = useState({
    title: "",
    slug: "",
    active: true,
    rules: {},
    slotDurationMinutes: 30,
  });

  useEffect(() => {
    if (!uid) return;
    loadGlobalRules(uid);
    if (WORKER_URL) {
      const now = new Date();
      const twoWeeks = new Date(now.getTime() + 14 * 24 * 3600000);
      fetch(`${WORKER_URL}/calendar/freebusy/${encodeURIComponent(uid)}?timeMin=${now.toISOString()}&timeMax=${twoWeeks.toISOString()}`)
        .then(r => r.ok ? r.json() : { busyTimes: [] })
        .then(d => setBusyTimes(d.busyTimes || []))
        .catch(() => {});
    }
  }, [uid]);

  const loadGlobalRules = async (userId) => {
    try {
      const profile = await getOrCreateUser(userId);
      if (profile?.globalBookingRules) {
        const r = { ...profile.globalBookingRules };
        if (!r.schedule) r.schedule = makeDefaultSchedule();
        // Migrate old {enabled,start,end} window format → slots[]
        Object.keys(r.schedule).forEach(i => {
          const d = r.schedule[i];
          if (d.start !== undefined && !Array.isArray(d.slots)) {
            r.schedule[i] = { enabled: d.enabled ?? false, slots: [] };
          }
        });
        setGlobalRules({ ...DEFAULT_RULES, ...r });
      }
    } catch { /* non-blocking */ }
  };

  // Re-register any existing links that may be missing from slugIndex
  // (e.g. created before the slug index was wired up)
  const syncSlugIndex = async (userId, existingLinks) => {
    try {
      const { firestore } = await import("@/lib/firebase");
      const { doc, getDoc, setDoc } = await import("firebase/firestore");
      for (const link of existingLinks) {
        if (!link.slug) continue;
        const slugRef = doc(firestore, "slugIndex", link.slug);
        const slugSnap = await getDoc(slugRef);
        if (!slugSnap.exists()) {
          await setDoc(slugRef, { uid: userId, linkId: link.id, active: link.active !== false, title: link.title || '', slotDurationMinutes: link.slotDurationMinutes || 30 });
        }
      }
    } catch { /* non-blocking */ }
  };

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["bookingLinks", uid],
    queryFn: () => bookingLinksService.list(uid),
    enabled: !!uid,
  });

  // Silently repair any links missing from slugIndex on page load (RQ v5 — no onSuccess)
  useEffect(() => {
    if (uid && links?.length) syncSlugIndex(uid, links);
  }, [uid, links]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const link = await bookingLinksService.create(uid, data);
      try {
        const { firestore } = await import("@/lib/firebase");
        const { doc, setDoc } = await import("firebase/firestore");
        await setDoc(doc(firestore, "slugIndex", data.slug), { uid, linkId: link.id, active: data.active !== false, title: data.title || '', slotDurationMinutes: data.slotDurationMinutes || 30 });
      } catch { /* non-blocking — ?uid= fallback still works */ }
      return link;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookingLinks", uid] });
      setShowNew(false);
      setNewLink({ title: "", slug: "", active: true, rules: {}, slotDurationMinutes: 30 });
      toast.success("Booking link created");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, slug }) => {
      await bookingLinksService.update(uid, id, data);
      if (slug) {
        try {
          const { firestore } = await import("@/lib/firebase");
          const { doc, updateDoc } = await import("firebase/firestore");
          const patch = {};
          if ("active" in data) patch.active = data.active;
          if ("title" in data) patch.title = data.title;
          if ("slotDurationMinutes" in data) patch.slotDurationMinutes = data.slotDurationMinutes;
          if (Object.keys(patch).length) await updateDoc(doc(firestore, "slugIndex", slug), patch);
        } catch { /* non-blocking */ }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookingLinks", uid] }),
    onError: (err) => toast.error(`Failed to update: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => bookingLinksService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookingLinks", uid] });
      toast.success("Link deleted");
    },
    onError: (err) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });

  const checkSlotConflict = (dayIndex, slotTime) => {
    if (!busyTimes.length) return false;
    const now = new Date();
    for (let d = 0; d < 14; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      date.setHours(0, 0, 0, 0);
      if (date.getDay() !== dayIndex) continue;
      const [h, m] = slotTime.split(":").map(Number);
      const slotStart = new Date(date);
      slotStart.setHours(h, m, 0, 0);
      if (slotStart <= now) continue;
      const conflicts = [15, 30, 45, 60].some(dur => {
        const slotEnd = new Date(slotStart.getTime() + dur * 60000);
        return busyTimes.some(ev => {
          const evStart = new Date(ev.start);
          const evEnd = new Date(ev.end || new Date(evStart.getTime() + 3600000));
          return slotStart < evEnd && slotEnd > evStart;
        });
      });
      if (conflicts) return true;
    }
    return false;
  };

  const saveGlobalRules = async () => {
    if (!uid) return;
    setSavingRules(true);
    try {
      const { updateUserDoc } = await import("@/lib/firestoreService");
      await updateUserDoc(uid, { globalBookingRules: globalRules });

      if (WORKER_URL && globalRules.schedule) {
        const { firebaseAuth } = await import("@/lib/firebase");
        const idToken = await firebaseAuth.currentUser?.getIdToken().catch(() => null);
        if (idToken) {
          const workingHours = {
            slotDurationMinutes: globalRules.slotDurationMinutes || 60,
            perDaySchedule: globalRules.schedule,
          };
          await fetch(`${WORKER_URL}/availability/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Firebase ${idToken}` },
            body: JSON.stringify({ workingHours }),
          }).catch(() => {});
        }
      }

      toast.success("Booking rules saved");

      // Fetch fresh busy times and report the result
      if (WORKER_URL) {
        try {
          const now = new Date();
          const twoWeeks = new Date(now.getTime() + 14 * 24 * 3600000);
          const res = await fetch(
            `${WORKER_URL}/calendar/freebusy/${encodeURIComponent(uid)}?timeMin=${now.toISOString()}&timeMax=${twoWeeks.toISOString()}`
          );
          if (!res.ok) {
            toast.info(`Calendar check failed (${res.status})`);
          } else {
            const freshBusy = (await res.json()).busyTimes || [];
            if (freshBusy.length === 0) {
              toast.info('Calendar returned no events — no conflict check possible');
            } else {
              const conflicts = [];
              for (let d = 0; d < 14; d++) {
                const date = new Date(now);
                date.setDate(date.getDate() + d);
                date.setHours(0, 0, 0, 0);
                const dow = date.getDay();
                const cfg = globalRules.schedule?.[dow];
                if (!cfg?.enabled || !cfg.slots?.length) continue;
                for (const slotTime of cfg.slots) {
                  const [h, m] = slotTime.split(":").map(Number);
                  const slotStart = new Date(date);
                  slotStart.setHours(h, m, 0, 0);
                  if (slotStart <= now) continue;
                  const clash = [15, 30, 45, 60].some(dur => {
                    const slotEnd = new Date(slotStart.getTime() + dur * 60000);
                    return freshBusy.some(ev => {
                      const evStart = new Date(ev.start);
                      const evEnd = new Date(ev.end || new Date(evStart.getTime() + 3600000));
                      return slotStart < evEnd && slotEnd > evStart;
                    });
                  });
                  if (clash) {
                    const label = `${DAY_LABELS[dow]} ${slotTime}`;
                    if (!conflicts.includes(label)) conflicts.push(label);
                  }
                }
              }
              if (conflicts.length > 0) {
                toast.warning(
                  `${conflicts.join(', ')} overlap${conflicts.length === 1 ? 's' : ''} with your calendar — won't show to clients`,
                  { duration: 12000 }
                );
              } else {
                toast.info(`Calendar checked — no conflicts (${freshBusy.length} events scanned)`);
              }
            }
          }
        } catch (e) {
          toast.info(`Calendar check error: ${e.message}`);
        }
      }
    } catch {
      toast.error("Failed to save rules");
    } finally {
      setSavingRules(false);
    }
  };

  const copyLink = async (link) => {
    const url = `${window.location.origin}/book/${link.slug}`;
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(url); copied = true; } catch {}
    }
    if (!copied) {
      const el = document.createElement("textarea");
      el.value = url;
      el.style.cssText = "position:fixed;left:-9999px;top:50%";
      document.body.appendChild(el);
      el.focus(); el.select();
      try { copied = document.execCommand("copy"); } catch {}
      el.remove();
    }
    if (copied) {
      setCopiedId(link.id);
      toast.success("Link copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      toast.info(`Copy: ${url}`, { duration: 8000 });
    }
  };

  const handleTitleChange = (t) => {
    setNewLink(l => ({ ...l, title: t, slug: slugify(t) }));
  };

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-display font-bold">Booking Links</h1>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}
          className="rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
          <Plus className="w-4 h-4" />New Link
        </Button>
      </div>

      {/* Global Booking Rules */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-accent" />
          <span className="text-sm font-heading font-semibold">Global Booking Rules</span>
          <span className="text-xs text-muted-foreground ml-auto">Applied to all links unless overridden</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">Session duration</label>
            <div className="flex gap-1.5">
              {[15, 30, 45, 60].map(mins => (
                <button key={mins} type="button"
                  onClick={() => setGlobalRules(r => ({ ...r, slotDurationMinutes: mins }))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${(globalRules.slotDurationMinutes || 60) === mins
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"}`}>
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">Buffer between bookings</label>
            <div className="flex items-center gap-1">
              <Input type="number" value={globalRules.bufferMinutes} min="0" max="120"
                onChange={e => setGlobalRules(r => ({ ...r, bufferMinutes: parseInt(e.target.value) || 0 }))}
                className="w-16 h-8 text-xs rounded-lg text-center" />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>

          {/* Per-day slot picker */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Available days & session times</label>
            <div className="flex gap-1">
              {DAY_LABELS.map((d, i) => {
                const cfg = globalRules.schedule?.[i] ?? { enabled: false, slots: [] };
                const count = cfg.slots?.length ?? 0;
                return (
                  <button key={d} onClick={() => setSelectedRuleDay(i)}
                    className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all flex flex-col items-center gap-0.5
                      ${cfg.enabled && count > 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}
                      ${selectedRuleDay === i ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""}`}>
                    <span>{d}</span>
                    <span className="text-[9px] opacity-80">{count > 0 ? `${count}` : "off"}</span>
                  </button>
                );
              })}
            </div>

            {selectedRuleDay !== null && (() => {
              const cfg = globalRules.schedule?.[selectedRuleDay] ?? { enabled: false, slots: [] };
              const selected = new Set(cfg.slots ?? []);
              const toggle = (t) => {
                const next = new Set(selected);
                if (next.has(t)) {
                  next.delete(t);
                } else {
                  next.add(t);
                  if (checkSlotConflict(selectedRuleDay, t)) {
                    toast.warning(`${t} overlaps with your calendar — it won't show to clients`, { duration: 6000 });
                  }
                }
                setGlobalRules(r => ({
                  ...r,
                  schedule: { ...r.schedule, [selectedRuleDay]: { enabled: next.size > 0, slots: [...next].sort() } }
                }));
              };
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{DAY_LABELS[selectedRuleDay]}</span>
                    {selected.size > 0 && (
                      <button onClick={() => setGlobalRules(r => ({
                        ...r, schedule: { ...r.schedule, [selectedRuleDay]: { enabled: false, slots: [] } }
                      }))} className="text-xs text-muted-foreground hover:text-destructive">Clear</button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {ALL_TIMES.map(t => (
                      <button key={t} onClick={() => toggle(t)}
                        className={`py-1.5 rounded-lg text-[11px] font-medium transition-all ${selected.has(t)
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    {selected.size === 0 ? "Tap times to mark as available" : `${selected.size} slot${selected.size > 1 ? "s" : ""}`}
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">Max bookings per day</label>
            <Input type="number" value={globalRules.maxBookingsPerDay} min="1" max="50"
              onChange={e => setGlobalRules(r => ({ ...r, maxBookingsPerDay: parseInt(e.target.value) || 1 }))}
              className="w-16 h-8 text-xs rounded-lg text-center" />
          </div>

          <Button size="sm" onClick={saveGlobalRules} disabled={savingRules}
            className="w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 mt-2">
            {savingRules ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Rules"}
          </Button>
        </div>
      </div>

      {/* Connected Calendars */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-accent" />
          <span className="text-sm font-heading font-semibold">Connected Calendars</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Connect your Google Calendar to show only genuinely free slots.
        </p>
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🗓️</span>
            <span className="text-sm">Google Calendar</span>
          </div>
          <Button size="sm" variant="outline"
            onClick={() => navigate("/settings")}
            className="rounded-xl h-7 text-xs">Connect in Settings</Button>
        </div>
      </div>

      {/* New Link Form */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-card border border-border mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-heading font-semibold">New Booking Link</h3>
              <button onClick={() => setShowNew(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Title</label>
              <Input value={newLink.title} onChange={e => handleTitleChange(e.target.value)}
                placeholder="e.g. 30-min Discovery Call" className="rounded-xl" autoFocus />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL slug</label>
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                <span className="text-xs text-muted-foreground shrink-0">{window.location.origin}/book/</span>
                <Input value={newLink.slug} onChange={e => setNewLink(l => ({ ...l, slug: slugify(e.target.value) }))}
                  placeholder="my-link" className="border-0 p-0 h-auto text-sm bg-transparent focus-visible:ring-0" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button size="sm" disabled={!newLink.title.trim() || !newLink.slug.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ ...newLink, slotDurationMinutes: globalRules.slotDurationMinutes || 60 })}
                className="flex-1 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Link"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Links List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : links.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-muted/30">
          <Link2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No booking links yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Create a link to share with clients</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const url = `${window.location.origin}/book/${link.slug}`;
            return (
              <div key={link.id} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${link.active ? "bg-green-400" : "bg-muted-foreground/30"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-sm truncate">{link.title}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">/book/{link.slug}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => copyLink(link)}
                      className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-accent">
                      {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => updateMutation.mutate({ id: link.id, data: { active: !link.active }, slug: link.slug })}
                      className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-accent">
                      {link.active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setExpandedId(expandedId === link.id ? null : link.id)}
                      className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-accent">
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${link.title}"?`)) {
                          deleteMutation.mutate(link.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-40">
                      {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === link.id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-border/40 pt-3">
                        <p className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Booking URL</p>
                        <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
                          <span className="text-xs font-mono flex-1 truncate">{url}</span>
                          <button onClick={() => copyLink(link)} className="text-accent shrink-0">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
