import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ClipboardList, ArrowLeft, Plus, Trash2, CheckCircle2, Circle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { followUpsService } from "@/lib/firestoreService";
import { useCurrentUid } from \"@/hooks/useCurrentUid\";

export default function FollowUps() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uid = useCurrentUid();
  const [filter, setFilter] = useState("pending");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ description: "", expectedBy: "" });

  const { data: followUps = [], isLoading } = useQuery({
    queryKey: ["followUps", uid],
    queryFn: () => followUpsService.list(uid),
    enabled: !!uid,
  });

  const createMutation = useMutation({
    mutationFn: (data) => followUpsService.create(uid, { ...data, resolved: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followUps", uid] });
      setShowNew(false);
      setForm({ description: "", expectedBy: "" });
      toast.success("Follow-up added");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, resolved }) => followUpsService.update(uid, id, { resolved }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["followUps", uid] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => followUpsService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followUps", uid] });
      toast.success("Follow-up removed");
    },
  });

  const pending = followUps.filter(f => !f.resolved);
  const resolved = followUps.filter(f => f.resolved);
  const displayed = filter === "pending" ? pending : filter === "resolved" ? resolved : followUps;

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-display font-bold">Follow-ups</h1>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}
          className="rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
          <Plus className="w-4 h-4" />Add
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-2xl font-display font-bold text-amber-400">{pending.length}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="p-3 rounded-2xl bg-success/10 border border-success/20">
          <p className="text-2xl font-display font-bold text-success">{resolved.length}</p>
          <p className="text-xs text-muted-foreground">Resolved</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {["pending", "resolved", "all"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors capitalize ${
              filter === f ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            }`}>{f}</button>
        ))}
      </div>

      {/* New Form */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-card border border-border mb-5 space-y-3">
            <h3 className="text-sm font-heading font-semibold">New Follow-up</h3>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Send the contract to John" className="rounded-xl" autoFocus />
            <Input value={form.expectedBy} onChange={e => setForm({ ...form, expectedBy: e.target.value })}
              type="date" className="rounded-xl" />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button size="sm" disabled={!form.description.trim()} onClick={() => createMutation.mutate(form)}
                className="flex-1 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">Save</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No {filter !== "all" ? filter : ""} follow-ups</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {displayed.map((fu) => (
              <motion.div key={fu.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-border/50">
                <button onClick={() => toggleMutation.mutate({ id: fu.id, resolved: !fu.resolved })} className="shrink-0 mt-0.5">
                  {fu.resolved
                    ? <CheckCircle2 className="w-5 h-5 text-success" />
                    : <Circle className="w-5 h-5 text-muted-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${fu.resolved ? "line-through text-muted-foreground" : ""}`}>{fu.description}</p>
                  {fu.expectedBy && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />By {fu.expectedBy}
                    </p>
                  )}
                </div>
                <button onClick={() => deleteMutation.mutate(fu.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
