import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Phone, Sparkles, CheckCircle2, CalendarDays,
  AlertTriangle, Trash2, Clock, TrendingUp, TrendingDown,
  Minus, DollarSign, ClipboardList, Handshake, Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import { recordingsService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

const CALL_TYPE_COLORS = {
  Sales:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Support:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Personal: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Business: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Other:    "bg-muted text-muted-foreground border-border",
};

function SectionCard({ icon: Icon, iconColor, bg, border, label, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-2xl border ${bg} ${border}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className={`text-xs font-heading font-semibold uppercase tracking-wider ${iconColor}`}>
          {label}
        </span>
      </div>
      {children}
    </motion.div>
  );
}

export default function PhoneCallDetail() {
  const { id } = useParams();
  const uid = useCurrentUid();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: call, isLoading } = useQuery({
    queryKey: ["recording", uid, id],
    queryFn: () => recordingsService.get(uid, id),
    enabled: !!uid && !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => recordingsService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings", uid] });
      toast.success("Call recording deleted");
      navigate("/phone-calls");
    },
  });

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading || !call) {
    return (
      <div className="px-4 pt-12">
        <div className="h-40 rounded-2xl bg-muted animate-pulse mb-4" />
        <div className="h-24 rounded-2xl bg-muted animate-pulse mb-4" />
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  const createdAt =
    call.createdAt?.toDate?.() ||
    (call.created_date ? new Date(call.created_date) : null);

  const SentimentIcon =
    call.sentiment === "Positive" ? TrendingUp
    : call.sentiment === "Negative" ? TrendingDown
    : Minus;
  const sentimentColor =
    call.sentiment === "Positive" ? "text-emerald-400"
    : call.sentiment === "Negative" ? "text-rose-400"
    : "text-muted-foreground";

  const sentimentPct = call.sentiment_score != null
    ? Math.round(call.sentiment_score * 100)
    : null;

  const typeColor = CALL_TYPE_COLORS[call.call_type] || CALL_TYPE_COLORS.Other;

  return (
    <div className="px-4 pt-12 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate("/phone-calls")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (window.confirm("Delete this call recording?")) deleteMutation.mutate();
          }}
          className="rounded-xl text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Call identity */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Phone className="w-7 h-7 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-display font-bold leading-tight">
            {call.caller_name || call.title || "Phone Call"}
          </h1>
          {call.caller_company && (
            <p className="text-sm text-muted-foreground">{call.caller_company}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(call.duration_seconds)}
            </span>
            {createdAt && (
              <span className="text-xs text-muted-foreground">
                {format(createdAt, "MMM d, yyyy · h:mm a")}
              </span>
            )}
            {call.call_type && (
              <Badge className={`text-[10px] border ${typeColor}`}>
                {call.call_type}
              </Badge>
            )}
            {call.sentiment && (
              <div className={`flex items-center gap-1 text-xs font-medium ${sentimentColor}`}>
                <SentimentIcon className="w-3 h-3" />
                {call.sentiment}
                {sentimentPct !== null && (
                  <span className="text-[10px] opacity-70">({sentimentPct}%)</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audio player */}
      {call.audio_url && (
        <div className="mb-5 p-4 rounded-2xl bg-muted/30 flex items-center gap-3">
          <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <audio controls className="w-full" src={call.audio_url}>
            Your browser does not support audio playback.
          </audio>
        </div>
      )}

      <div className="space-y-4">
        {/* AI Summary */}
        {call.ai_summary && (
          <SectionCard
            icon={Sparkles}
            iconColor="text-indigo-400"
            bg="bg-indigo-500/5"
            border="border-indigo-500/20"
            label="AI Summary"
          >
            <p className="text-sm leading-relaxed">{call.ai_summary}</p>
          </SectionCard>
        )}

        {/* Key Points */}
        {call.key_points?.length > 0 && (
          <SectionCard
            icon={ClipboardList}
            iconColor="text-amber-400"
            bg="bg-amber-500/5"
            border="border-amber-500/20"
            label="Key Points"
          >
            <ul className="space-y-2">
              {call.key_points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Action Items */}
        {call.extracted_actions?.length > 0 && (
          <SectionCard
            icon={CheckCircle2}
            iconColor="text-emerald-400"
            bg="bg-emerald-500/5"
            border="border-emerald-500/20"
            label="Action Items"
          >
            <div className="space-y-2">
              {call.extracted_actions.map((action, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-sm flex-1">{action.action}</span>
                  {action.due_date && (
                    <Badge variant="secondary" className="text-[10px]">
                      {action.due_date}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Appointments */}
        {call.appointments?.length > 0 && (
          <SectionCard
            icon={CalendarDays}
            iconColor="text-green-400"
            bg="bg-green-500/5"
            border="border-green-500/20"
            label="Appointments"
          >
            <div className="space-y-2">
              {call.appointments.map((apt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <span className="text-sm flex-1">{apt.title}</span>
                  {apt.date && (
                    <span className="text-xs text-muted-foreground shrink-0">{apt.date}</span>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Concerns */}
        {call.concerns?.length > 0 && (
          <SectionCard
            icon={AlertTriangle}
            iconColor="text-rose-400"
            bg="bg-rose-500/5"
            border="border-rose-500/20"
            label="Concerns Raised"
          >
            {call.concerns.map((c, i) => (
              <p key={i} className="text-sm text-muted-foreground mt-1 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                {c}
              </p>
            ))}
          </SectionCard>
        )}

        {/* Commitments */}
        {call.commitments?.length > 0 && (
          <SectionCard
            icon={Handshake}
            iconColor="text-purple-400"
            bg="bg-purple-500/5"
            border="border-purple-500/20"
            label="Commitments"
          >
            {call.commitments.map((c, i) => (
              <div key={i} className="flex items-start gap-2 mt-1 text-sm">
                <Handshake className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                <span className="flex-1">{c.commitment}</span>
                {c.by_whom && (
                  <Badge variant="secondary" className="text-[9px] shrink-0">
                    {c.by_whom}
                  </Badge>
                )}
              </div>
            ))}
          </SectionCard>
        )}

        {/* Financials */}
        {call.financials?.length > 0 && (
          <SectionCard
            icon={DollarSign}
            iconColor="text-cyan-400"
            bg="bg-cyan-500/5"
            border="border-cyan-500/20"
            label="Financial Mentions"
          >
            {call.financials.map((fin, i) => (
              <div key={i} className="flex items-center gap-2 mt-1 text-sm">
                <DollarSign className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="flex-1">{fin.description}</span>
                {fin.amount && (
                  <span className="font-medium text-cyan-400 shrink-0">
                    {fin.currency || "£"}{fin.amount}
                  </span>
                )}
              </div>
            ))}
          </SectionCard>
        )}

        {/* Transcription */}
        {call.transcription && (
          <div className="p-4 rounded-2xl bg-muted/50">
            <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Full Transcription
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-line">{call.transcription}</p>
          </div>
        )}
      </div>
    </div>
  );
}
