import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Link2, Plus, Trash2, ArrowLeft, Check, Copy, ToggleLeft, ToggleRight,
  Calendar, Settings, X, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { bookingLinksService, getOrCreateUser } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const DEFAULT_RULES = {
  bufferMinutes: 15,
  noBookingBefore: "09:00",
  noBookingAfter: "18:00",
  weekdaysOnly: true,
  maxBookingsPerDay: 8,
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

  const [newLink, setNewLink] = useState({
    title: "",
    slug: "",
    active: true,
    rules: {},
    visibilitySettings: {
      showGoogleCalendar: true,
      showOutlookCalendar: true,
      showAppleCalendar: true,
    },
  });

  useEffect(() => { if (uid) loadGlobalRules(uid); }, [uid]);

  const loadGlobalRules = async (userId) => {
    try {
      const profile = await getOrCreateUser(userId);
      if (profile?.globalBookingRules) setGlobalRules(profile.globalBookingRules);
    } catch { /* non-blocking */ }
  };

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["bookingLinks", uid],
    queryFn: () => bookingLinksService.list(uid),
    enabled: !!uid,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const link = await bookingLinksService.create(uid, data);
      try {
        const { firestore } = await import("@/lib/firebase");
        const { doc, setDoc } = await import("firebase/firestore");
        await setDoc(doc(firestore, "slugIndex", data.slug), { uid, linkId: link.id, active: data.active !== false });
      } catch { /* non-blocking — ?uid= fallback still works */ }
      return link;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookingLinks", uid] });
      setShowNew(false);
      setNewLink({ title: "", slug: "", active: true, rules: {}, visibilitySettings: { showGoogleCalendar: true, showOutlookCalendar: true, showAppleCalendar: true } });
      toast.success("Booking link created");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, slug }) => {
      await bookingLinksService.update(uid, id, data);
      if (slug && "active" in data) {
        try {
          const { firestore } = await import("@/lib/firebase");
          const { doc, updateDoc } = await import("firebase/firestore");
          await updateDoc(doc(firestore, "slugIndex", slug), { active: data.active });
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

  const saveGlobalRules = async () => {
    if (!uid) return;
    setSavingRules(true);
    try {
      const { updateUserDoc } = await import("@/lib/firestoreService");
      await updateUserDoc(uid, { globalBookingRules: globalRules });
      toast.success("Global booking rules saved");
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
            <label className="text-sm text-muted-foreground">Buffer between bookings</label>
            <div className="flex items-center gap-1">
              <Input type="number" value={globalRules.bufferMinutes} min="0" max="120"
                onChange={e => setGlobalRules(r => ({ ...r, bufferMinutes: parseInt(e.target.value) || 0 }))}
                className="w-16 h-8 text-xs rounded-lg text-center" />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">No bookings before</label>
            <Input type="time" value={globalRules.noBookingBefore}
              onChange={e => setGlobalRules(r => ({ ...r, noBookingBefore: e.target.value }))}
              className="w-28 h-8 text-xs rounded-lg" />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">No bookings after</label>
            <Input type="time" value={globalRules.noBookingAfter}
              onChange={e => setGlobalRules(r => ({ ...r, noBookingAfter: e.target.value }))}
              className="w-28 h-8 text-xs rounded-lg" />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">Weekdays only</label>
            <Switch checked={globalRules.weekdaysOnly}
              onCheckedChange={v => setGlobalRules(r => ({ ...r, weekdaysOnly: v }))} />
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

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Calendar visibility</label>
              {[
                { key: "showGoogleCalendar", label: "Google Calendar" },
                { key: "showOutlookCalendar", label: "Outlook Calendar" },
                { key: "showAppleCalendar", label: "Apple Calendar" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={newLink.visibilitySettings[key]}
                    onCheckedChange={v => setNewLink(l => ({
                      ...l, visibilitySettings: { ...l.visibilitySettings, [key]: v }
                    }))} />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button size="sm" disabled={!newLink.title.trim() || !newLink.slug.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(newLink)}
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
                      <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-3">
                        <p className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">Calendar Visibility</p>
                        {[
                          { key: "showGoogleCalendar", label: "Google Calendar" },
                          { key: "showOutlookCalendar", label: "Outlook Calendar" },
                          { key: "showAppleCalendar", label: "Apple Calendar" },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm">{label}</span>
                            <Switch
                              checked={link.visibilitySettings?.[key] ?? true}
                              onCheckedChange={v => updateMutation.mutate({
                                id: link.id,
                                data: { visibilitySettings: { ...link.visibilitySettings, [key]: v } }
                              })} />
                          </div>
                        ))}

                        <div className="pt-2 border-t border-border/40">
                          <p className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Booking URL</p>
                          <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
                            <span className="text-xs font-mono flex-1 truncate">{url}</span>
                            <button onClick={() => copyLink(link)} className="text-accent shrink-0">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
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
