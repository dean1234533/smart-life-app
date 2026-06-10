import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, ArrowLeft, Search, Sparkles, Loader2,
  ChevronDown, ChevronRight, Users, CheckCircle2, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { meetingSummariesService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { invokeGemini } from "@/services/geminiService";
import { getOrCreateUser } from "@/lib/firestoreService";

export default function MeetingSummaries() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uid = useCurrentUid();
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [userApiKey, setUserApiKey] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!uid) return;
    getOrCreateUser(uid).then(p => { if (p?.apiKey) setUserApiKey(p.apiKey); }).catch(() => {});
  }, [uid]);

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ["meetingSummaries", uid],
    queryFn: () => meetingSummariesService.list(uid),
    enabled: !!uid,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => meetingSummariesService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetingSummaries", uid] });
      toast.success("Summary deleted");
    },
  });

  const handleSearch = async () => {
    if (!search.trim() || !summaries.length) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const context = summaries.map((s, i) =>
        `[${i}] Title: ${s.title}\nDate: ${s.date}\nSummary: ${s.summary}\nDecisions: ${(s.decisions || []).join("; ")}\nAttendees: ${(s.attendees || []).join(", ")}`
      ).join("\n\n");

      const result = await invokeGemini(
        `The user is searching their meeting knowledge base with the query: "${search}"

Here are all meeting summaries:
${context}

Find the most relevant meeting summary and identify the exact section that answers the query.
Return the index of the best match and the relevant excerpt.`,
        {
          type: "object",
          properties: {
            best_match_index: { type: "number" },
            relevant_excerpt: { type: "string" },
            explanation: { type: "string" }
          }
        },
        uid,
        userApiKey
      );

      const match = summaries[result.best_match_index];
      if (match) {
        setSearchResult({ summary: match, excerpt: result.relevant_excerpt, explanation: result.explanation });
      } else {
        toast.info("No matching meeting found.");
      }
    } catch {
      toast.error("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-display font-bold">Meeting Summaries</h1>
      </div>

      {/* AI Knowledge Base Search */}
      <div className="mb-6 p-4 rounded-2xl bg-accent/5 border border-accent/20 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-xs font-heading font-semibold text-accent">Search Knowledge Base</span>
        </div>
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="What did we agree with Sarah about the website?"
            className="rounded-xl flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button size="sm" onClick={handleSearch} disabled={searching || !search.trim()}
            className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shrink-0 gap-1.5">
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Search
          </Button>
        </div>

        <AnimatePresence>
          {searchResult && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-card border border-accent/20 space-y-2">
              <p className="text-xs font-heading font-semibold text-accent">{searchResult.summary.title}</p>
              <p className="text-sm leading-relaxed">{searchResult.excerpt}</p>
              {searchResult.explanation && (
                <p className="text-xs text-muted-foreground">{searchResult.explanation}</p>
              )}
              <button onClick={() => setSearchResult(null)} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-heading font-semibold mb-1">No meeting summaries yet</h3>
          <p className="text-sm text-muted-foreground">Record a conversation and save the AI summary here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map((s) => {
            const isOpen = expanded[s.id];
            return (
              <div key={s.id} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                <button
                  onClick={() => setExpanded(e => ({ ...e, [s.id]: !e[s.id] }))}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-sm truncate">{s.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.date && <span className="text-xs text-muted-foreground">{s.date.slice ? s.date.slice(0,10) : ""}</span>}
                      {s.attendees?.length > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" />{s.attendees.slice(0,2).join(", ")}{s.attendees.length > 2 ? ` +${s.attendees.length - 2}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(s.id); }}
                    className="text-muted-foreground hover:text-destructive ml-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-3">
                        {s.summary && <p className="text-sm leading-relaxed text-muted-foreground">{s.summary}</p>}

                        {s.decisions?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Decisions</h4>
                            {s.decisions.map((d, i) => (
                              <div key={i} className="flex items-start gap-2 py-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                                <p className="text-sm">{d}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {s.followUpActions?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Follow-ups</h4>
                            {s.followUpActions.map((f, i) => (
                              <p key={i} className="text-sm text-muted-foreground py-0.5">• {f}</p>
                            ))}
                          </div>
                        )}

                        {s.attendees?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {s.attendees.map((a, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] rounded-lg">
                                <Users className="w-2.5 h-2.5 mr-1" />{a}
                              </Badge>
                            ))}
                          </div>
                        )}
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
