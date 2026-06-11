import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Phone, Search, Clock, Sparkles, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { recordingsService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

const CALL_TYPE_COLORS = {
  Sales:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Support:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Personal:  "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Business:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Other:     "bg-muted text-muted-foreground border-border",
};

const SENTIMENT_ICONS = {
  Positive: { Icon: TrendingUp,   className: "text-emerald-400" },
  Neutral:  { Icon: Minus,        className: "text-muted-foreground" },
  Negative: { Icon: TrendingDown, className: "text-rose-400" },
};

const ALL_FILTERS = ["All", "Sales", "Support", "Personal", "Business", "Other"];

export default function PhoneCalls() {
  const uid = useCurrentUid();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const { data: allRecordings = [], isLoading } = useQuery({
    queryKey: ["recordings", uid],
    queryFn: () => recordingsService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  // Only show phone call type recordings
  const calls = allRecordings.filter((r) => r.recording_type === "phone_call");

  const filtered = calls.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.title?.toLowerCase().includes(q) ||
      r.caller_name?.toLowerCase().includes(q) ||
      r.ai_summary?.toLowerCase().includes(q) ||
      r.transcription?.toLowerCase().includes(q);
    const matchesFilter = filter === "All" || r.call_type === filter;
    return matchesSearch && matchesFilter;
  });

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="px-4 pt-12 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-display font-bold">Phone Calls</h1>
        </div>
        <Button
          onClick={() => navigate("/phone-calls/new")}
          size="sm"
          className="rounded-xl bg-indigo-500 hover:bg-indigo-500/90 text-white gap-1.5"
        >
          <Phone className="w-4 h-4" />
          Record Call
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search calls, callers, summaries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-muted/50 border-0 rounded-xl"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {ALL_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              filter === f
                ? "bg-indigo-500 text-white"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      {calls.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Total Calls", value: calls.length },
            {
              label: "Avg Duration",
              value: calls.length
                ? formatDuration(Math.round(calls.reduce((s, r) => s + (r.duration_seconds || 0), 0) / calls.length))
                : "—",
            },
            {
              label: "Action Items",
              value: calls.reduce((s, r) => s + (r.extracted_actions?.length || 0), 0),
            },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-2xl bg-card border border-border/50 text-center">
              <p className="text-lg font-display font-bold">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="font-heading font-semibold mb-1">
            {calls.length === 0 ? "No calls recorded yet" : "No calls match your search"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {calls.length === 0
              ? "Put your phone on speaker and record your next call"
              : "Try a different search term or filter"}
          </p>
          {calls.length === 0 && (
            <Button
              onClick={() => navigate("/phone-calls/new")}
              className="rounded-xl bg-indigo-500 hover:bg-indigo-500/90 text-white gap-2"
            >
              <Phone className="w-4 h-4" />
              Record Your First Call
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((call, i) => {
            const createdAt =
              call.createdAt?.toDate?.() ||
              (call.created_date ? new Date(call.created_date) : null);
            const sentiment = call.sentiment;
            const SentimentInfo = SENTIMENT_ICONS[sentiment];
            const typeColor = CALL_TYPE_COLORS[call.call_type] || CALL_TYPE_COLORS.Other;

            return (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={`/phone-calls/${call.id}`}
                  className="block p-4 rounded-2xl bg-card border border-border/50 hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-heading font-semibold text-sm truncate">
                          {call.caller_name || call.title || "Unknown Caller"}
                        </h3>
                        {SentimentInfo && (
                          <SentimentInfo.Icon className={`w-3.5 h-3.5 shrink-0 ${SentimentInfo.className}`} />
                        )}
                      </div>

                      {call.ai_summary && (
                        <div className="flex items-start gap-1 mt-1">
                          <Sparkles className="w-3 h-3 text-accent mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {call.ai_summary}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {call.call_type && (
                          <Badge className={`text-[10px] px-1.5 py-0 border ${typeColor}`}>
                            {call.call_type}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDuration(call.duration_seconds)}
                        </span>
                        {call.extracted_actions?.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {call.extracted_actions.length} actions
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
