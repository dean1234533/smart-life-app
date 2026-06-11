import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Mic, Search, Clock, Sparkles, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { recordingsService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

export default function Recordings() {
  const uid = useCurrentUid();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ["recordings", uid],
    queryFn: () => recordingsService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const filtered = recordings.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.title?.toLowerCase().includes(q) ||
      r.transcription?.toLowerCase().includes(q) ||
      r.ai_summary?.toLowerCase().includes(q)
    );
  });

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Recordings</h1>
        <Button onClick={() => navigate("/recordings/new")} size="sm"
          className="rounded-xl bg-success hover:bg-success/90 text-success-foreground gap-1.5">
          <Mic className="w-4 h-4" />Record
        </Button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search recordings..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-muted/50 border-0 rounded-xl" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
            <Mic className="w-8 h-8 text-success" />
          </div>
          <h3 className="font-heading font-semibold mb-1">No recordings yet</h3>
          <p className="text-sm text-muted-foreground">Record a conversation and let AI extract insights</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((recording, i) => {
            const createdAt = recording.createdAt?.toDate?.() || (recording.created_date ? new Date(recording.created_date) : null);
            return (
              <motion.div key={recording.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link to={`/recordings/${recording.id}`}
                  className="block p-4 rounded-2xl bg-card border border-border/50 hover:border-success/30 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                      <Mic className="w-5 h-5 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-semibold text-sm truncate">{recording.title || "Untitled Recording"}</h3>
                      {recording.ai_summary && (
                        <div className="flex items-start gap-1 mt-1">
                          <Sparkles className="w-3 h-3 text-accent mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground line-clamp-2">{recording.ai_summary}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />{formatDuration(recording.duration_seconds)}
                        </span>
                        {recording.extracted_actions?.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />{recording.extracted_actions.length} actions
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {createdAt ? format(createdAt, "MMM d") : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
