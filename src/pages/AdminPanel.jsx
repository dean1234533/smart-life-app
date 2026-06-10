import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Plus, Copy, Check, Loader2, ArrowLeft, Users, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { invitesService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { format } from "date-fns";

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || "";

function generateInviteId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const uid = useCurrentUid();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (uid === undefined) return;
    if (!uid || uid !== ADMIN_UID) { navigate("/"); return; }
    loadInvites();
  }, [uid]);

  const loadInvites = async () => {
    setLoading(true);
    try {
      const list = await invitesService.list();
      setInvites(list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async () => {
    setGenerating(true);
    try {
      const id = generateInviteId();
      const inv = await invitesService.create({ id, note: "" });
      await loadInvites();
      toast.success("Invite link generated!");
    } catch {
      toast.error("Failed to generate invite");
    } finally {
      setGenerating(false);
    }
  };

  const copyInvite = (inv) => {
    const url = `${window.location.origin}/register?invite=${inv.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(inv.id);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pendingInvites = invites.filter(i => !i.used);
  const usedInvites = invites.filter(i => i.used);

  if (loading) {
    return (
      <div className="px-4 pt-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" />Admin Panel
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-3 rounded-2xl bg-accent/10 border border-accent/20 text-center">
          <p className="text-2xl font-display font-bold text-accent">{invites.length}</p>
          <p className="text-xs text-muted-foreground">Total invites</p>
        </div>
        <div className="p-3 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
          <p className="text-2xl font-display font-bold text-green-400">{usedInvites.length}</p>
          <p className="text-xs text-muted-foreground">Used</p>
        </div>
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-2xl font-display font-bold text-amber-400">{pendingInvites.length}</p>
          <p className="text-xs text-muted-foreground">Available</p>
        </div>
      </div>

      {/* Generate */}
      <Button onClick={generateInvite} disabled={generating}
        className="w-full rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground gap-2 mb-6">
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Generate New Invite Link
      </Button>

      {/* Available Invites */}
      {pendingInvites.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Available Invites
          </h2>
          <div className="space-y-2">
            {pendingInvites.map(inv => (
              <motion.div key={inv.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50">
                <Link2 className="w-4 h-4 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    {window.location.origin}/register?invite={inv.id}
                  </p>
                  {inv.createdAt?.toDate && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Created {format(inv.createdAt.toDate(), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
                <button onClick={() => copyInvite(inv)}
                  className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-accent shrink-0">
                  {copiedId === inv.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Used Invites */}
      {usedInvites.length > 0 && (
        <div>
          <h2 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Used Invites
          </h2>
          <div className="space-y-2">
            {usedInvites.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/30">
                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-muted-foreground/60 truncate">...{inv.id.slice(-8)}</p>
                  {inv.usedAt?.toDate && (
                    <p className="text-[10px] text-muted-foreground/40">
                      Used {format(inv.usedAt.toDate(), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
                <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full shrink-0">used</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {invites.length === 0 && (
        <div className="text-center py-12 rounded-2xl bg-muted/30">
          <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No invites generated yet</p>
        </div>
      )}
    </div>
  );
}
