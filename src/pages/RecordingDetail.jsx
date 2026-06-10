import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mic, Sparkles, CheckCircle2, CalendarDays, Users, Trash2, Handshake, Milestone, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import { recordingsService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

export default function RecordingDetail() {
  const { id } = useParams();
  const uid = useCurrentUid();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: recording, isLoading } = useQuery({
    queryKey: ["recording", uid, id],
    queryFn: () => recordingsService.get(uid, id),
    enabled: !!uid && !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => recordingsService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings", uid] });
      toast.success("Recording deleted");
      navigate("/recordings");
    },
  });

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading || !recording) {
    return <div className="px-4 pt-12"><div className="h-40 rounded-2xl bg-muted animate-pulse" /></div>;
  }

  const createdAt = recording.createdAt?.toDate?.() || (recording.created_date ? new Date(recording.created_date) : null);

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate("/recordings")} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />Back
        </button>
        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate()} className="rounded-xl text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-start gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
          <Mic className="w-6 h-6 text-success" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold">{recording.title || "Recording"}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />{formatDuration(recording.duration_seconds)}
            </span>
            <span className="text-xs text-muted-foreground">
              {createdAt ? format(createdAt, "MMM d, yyyy") : ""}
            </span>
          </div>
        </div>
      </div>

      {recording.audio_url && (
        <div className="mb-6 p-4 rounded-2xl bg-muted/30">
          <audio controls className="w-full" src={recording.audio_url}>
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      <div className="space-y-5">
        {recording.ai_summary && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-accent/5 border border-accent/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-xs font-heading font-semibold text-accent">AI Summary</span>
            </div>
            <p className="text-sm leading-relaxed">{recording.ai_summary}</p>
          </motion.div>
        )}

        {recording.transcription && (
          <div className="p-4 rounded-2xl bg-muted/50">
            <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transcription</h3>
            <p className="text-sm leading-relaxed">{recording.transcription}</p>
          </div>
        )}

        {recording.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recording.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-[10px] rounded-lg">{tag}</Badge>)}
          </div>
        )}

        {recording.extracted_actions?.length > 0 && (
          <div>
            <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Action Items</h3>
            <div className="space-y-2">
              {recording.extracted_actions.map((action, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-sm flex-1">{action.action}</span>
                  {action.assignee && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Users className="w-2.5 h-2.5 mr-0.5" />{action.assignee}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {recording.detected_dates?.length > 0 && (
          <div>
            <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detected Dates</h3>
            <div className="space-y-2">
              {recording.detected_dates.map((d, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-success/5 border border-success/10">
                  <CalendarDays className="w-4 h-4 text-success shrink-0" />
                  <div className="flex-1"><span className="text-sm">{d.context}</span><span className="text-xs text-muted-foreground ml-2">{d.date}</span></div>
                  <span className="text-[10px] text-muted-foreground">{Math.round((d.confidence || 0) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recording.detected_decisions?.length > 0 && (
          <div>
            <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Decisions</h3>
            <div className="space-y-2">
              {recording.detected_decisions.map((d, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-chart-1/5 border border-chart-1/10">
                  <Milestone className="w-4 h-4 text-chart-1 shrink-0" /><span className="text-sm">{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recording.detected_promises?.length > 0 && (
          <div>
            <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Promises</h3>
            <div className="space-y-2">
              {recording.detected_promises.map((p, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                  <Handshake className="w-4 h-4 text-destructive shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm">{p.promise}</span>
                    <div className="flex gap-2 mt-1">
                      {p.by_whom && <Badge variant="secondary" className="text-[9px]">By: {p.by_whom}</Badge>}
                      {p.to_whom && <Badge variant="secondary" className="text-[9px]">To: {p.to_whom}</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recording.related_people?.length > 0 && (
          <div>
            <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">People Mentioned</h3>
            <div className="flex flex-wrap gap-2">
              {recording.related_people.map((p) => (
                <Badge key={p} className="rounded-lg bg-chart-5/10 text-chart-5 border-chart-5/20">
                  <Users className="w-3 h-3 mr-1" />{p}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
