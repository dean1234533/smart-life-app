import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Sparkles, Loader2, Trash2, Pin, PinOff,
  CheckCircle2, Tag, Users, CalendarDays, Bell,
  ShoppingCart, ChefHat, MapPin, Navigation, Check, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { extractAndSaveCalendarEvents } from "@/utils/extractCalendarEvents";
import {
  notesService, shoppingListsService, recipesService, mapSessionsService, getOrCreateUser
} from "@/lib/firestoreService";
import { invokeGemini } from "@/services/geminiService";
import { getNearbyStores, buildDirectionsUrl } from "@/services/googleMapsService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

function ConfirmCard({ icon: Icon, color, title, items, onAccept, onDismiss }) {
  if (!items?.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl border bg-card" style={{ borderColor: `${color}33` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color }} />
          <span className="text-xs font-heading font-semibold" style={{ color }}>{title}</span>
        </div>
        <div className="flex gap-1.5">
          <button onClick={onDismiss}
            className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive">
            <X className="w-3.5 h-3.5" />
          </button>
          <button onClick={onAccept}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
            style={{ background: color }}>
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <ul className="space-y-1">
        {items.slice(0, 5).map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
            <span className="text-xs mt-0.5">•</span>{item}
          </li>
        ))}
        {items.length > 5 && <li className="text-xs text-muted-foreground">+{items.length - 5} more</li>}
      </ul>
    </motion.div>
  );
}

export default function NoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uid = useCurrentUid();
  const isNew = id === "new";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [isPinned, setIsPinned] = useState(false);
  const [detectedEvents, setDetectedEvents] = useState([]);
  const [userApiKey, setUserApiKey] = useState("");

  const [shoppingSuggestions, setShoppingSuggestions] = useState(null);
  const [recipeSuggestions, setRecipeSuggestions] = useState(null);
  const [nearbyStores, setNearbyStores] = useState(null);
  const [loadingStores, setLoadingStores] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getOrCreateUser(uid).then((profile) => {
      if (profile?.apiKey) setUserApiKey(profile.apiKey);
    }).catch(() => {});
  }, [uid]);

  const { data: note } = useQuery({
    queryKey: ["note", uid, id],
    queryFn: () => notesService.get(uid, id),
    enabled: !isNew && !!uid && !!id,
  });

  useEffect(() => {
    if (note) {
      setTitle(note.title || "");
      setContent(note.content || "");
      setIsPinned(note.is_pinned || false);
      if (note.ai_summary) {
        setAiResult({
          ai_summary: note.ai_summary,
          tags: note.tags,
          detected_intent: note.detected_intent,
          extracted_actions: note.extracted_actions,
          related_people: note.related_people,
          related_events: note.related_events,
          ai_suggestions: note.ai_suggestions,
        });
      }
    }
  }, [note]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isNew) return notesService.create(uid, data);
      return notesService.update(uid, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", uid] });
      toast.success("Note saved");
      navigate("/notes");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => notesService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", uid] });
      toast.success("Note deleted");
      navigate("/notes");
    },
  });

  const analyzeNote = async () => {
    if (!content.trim()) return;
    setIsAnalyzing(true);
    setShoppingSuggestions(null);
    setRecipeSuggestions(null);
    setNearbyStores(null);

    try {
      const prompt = `Analyze this note and extract structured information:

Note content: "${content}"
${title ? `Title: "${title}"` : ""}

Extract:
1. A brief AI summary (1-2 sentences)
2. Auto-detect the primary intent (shopping, meeting, task, reminder, general, decision, promise, meal_plan)
3. If intent is "shopping" or "meal_plan", extract a list of specific items/ingredients needed
4. If intent is "meal_plan", generate 2-3 recipes with ingredients and instructions
5. Extract any action items with due dates if mentioned
6. Identify people mentioned
7. Detect any events or dates mentioned
8. Generate relevant tags
9. Provide smart suggestions (e.g., create calendar event, add reminder, create shopping list)

For suggestions, provide confidence scores (0-1).`;

      const schema = {
        type: "object",
        properties: {
          ai_summary: { type: "string" },
          detected_intent: { type: "string", enum: ["shopping", "meeting", "task", "reminder", "general", "decision", "promise", "meal_plan"] },
          shopping_items: { type: "array", items: { type: "string" } },
          suggested_previous_items: { type: "array", items: { type: "string" } },
          recipes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                ingredients: { type: "array", items: { type: "string" } },
                instructions: { type: "string" },
                mealPlanDays: { type: "array", items: { type: "string" } }
              }
            }
          },
          extracted_actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string" },
                due_date: { type: "string" },
                priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                status: { type: "string" }
              }
            }
          },
          related_people: { type: "array", items: { type: "string" } },
          related_events: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          ai_suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                suggestion: { type: "string" },
                confidence: { type: "number" }
              }
            }
          },
          suggested_title: { type: "string" }
        }
      };

      const result = await invokeGemini(prompt, schema, uid, userApiKey);
      setAiResult(result);
      if (!title && result.suggested_title) setTitle(result.suggested_title);

      if ((result.detected_intent === "shopping" || result.detected_intent === "meal_plan") && result.shopping_items?.length) {
        setShoppingSuggestions(result.shopping_items);
        fetchNearbyStores();
      }
      if (result.detected_intent === "meal_plan" && result.recipes?.length) {
        setRecipeSuggestions(result.recipes);
      }

      const events = await extractAndSaveCalendarEvents(content, "note", isNew ? "pending" : id, uid, userApiKey);
      if (events.length > 0) {
        setDetectedEvents(events);
        toast.success(`${events.length} calendar event${events.length > 1 ? "s" : ""} added automatically!`);
      }
    } catch {
      toast.error("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchNearbyStores = async () => {
    if (!navigator.geolocation) return;
    setLoadingStores(true);
    try {
      const position = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      const { latitude, longitude } = position.coords;
      const { stores } = await getNearbyStores(latitude, longitude);
      if (stores.length > 0) {
        setNearbyStores(stores);
        if (uid) {
          mapSessionsService.create(uid, { stores, route: buildDirectionsUrl(stores.slice(0, 3)) }).catch(() => {});
        }
      }
    } catch { /* location denied */ }
    finally { setLoadingStores(false); }
  };

  const acceptShoppingList = async () => {
    if (!shoppingSuggestions?.length || !uid) return;
    await shoppingListsService.create(uid, {
      items: shoppingSuggestions.map(item => ({ name: item, checked: false })),
      generatedFrom: isNew ? null : id,
      title: title || "Shopping List",
    });
    toast.success("Shopping list saved!");
    setShoppingSuggestions(null);
    queryClient.invalidateQueries({ queryKey: ["shoppingLists"] });
  };

  const acceptRecipes = async () => {
    if (!recipeSuggestions?.length || !uid) return;
    for (const recipe of recipeSuggestions) {
      await recipesService.create(uid, recipe);
    }
    const allIngredients = recipeSuggestions.flatMap(r => r.ingredients || []);
    await shoppingListsService.create(uid, {
      items: allIngredients.map(item => ({ name: item, checked: false })),
      generatedFrom: isNew ? null : id,
      title: `Ingredients for meal plan`,
    });
    toast.success(`${recipeSuggestions.length} recipes + shopping list saved!`);
    setRecipeSuggestions(null);
    queryClient.invalidateQueries({ queryKey: ["recipes", "shoppingLists"] });
  };

  const handleSave = () => {
    const data = {
      title: title || "Untitled Note",
      content,
      is_pinned: isPinned,
      ...(aiResult || {}),
    };
    delete data.suggested_title;
    delete data.shopping_items;
    delete data.suggested_previous_items;
    delete data.recipes;
    saveMutation.mutate(data);
  };

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate("/notes")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />Back
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setIsPinned(!isPinned)} className="rounded-xl">
            {isPinned ? <PinOff className="w-4 h-4 text-accent" /> : <Pin className="w-4 h-4" />}
          </Button>
          {!isNew && (
            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate()} className="rounded-xl text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm"
            className="rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      <Input value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title..."
        className="border-0 text-xl font-heading font-semibold px-0 mb-3 focus-visible:ring-0 bg-transparent" />
      <Textarea value={content} onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing... AI will analyze your note and extract insights."
        className="border-0 min-h-[200px] px-0 resize-none focus-visible:ring-0 text-sm leading-relaxed bg-transparent" />

      <div className="mt-4">
        <Button onClick={analyzeNote} disabled={isAnalyzing || !content.trim()} variant="outline"
          className="w-full rounded-xl gap-2 border-accent/30 hover:bg-accent/5">
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <Sparkles className="w-4 h-4 text-accent" />}
          {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
        </Button>
      </div>

      <AnimatePresence>
        {aiResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
            {aiResult.ai_summary && (
              <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="text-xs font-heading font-semibold text-accent">AI Summary</span>
                </div>
                <p className="text-sm">{aiResult.ai_summary}</p>
              </div>
            )}

            {shoppingSuggestions && (
              <ConfirmCard icon={ShoppingCart} color="#22d3ee" title="Save Shopping List?"
                items={shoppingSuggestions} onAccept={acceptShoppingList} onDismiss={() => setShoppingSuggestions(null)} />
            )}

            {recipeSuggestions && (
              <ConfirmCard icon={ChefHat} color="#a855f7" title={`Save ${recipeSuggestions.length} Recipes + Shopping List?`}
                items={recipeSuggestions.map(r => r.title)} onAccept={acceptRecipes} onDismiss={() => setRecipeSuggestions(null)} />
            )}

            {(loadingStores || nearbyStores) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl border border-border/50 bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-accent" />
                  <span className="text-xs font-heading font-semibold text-accent">Nearby Supermarkets</span>
                </div>
                {loadingStores ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />Finding stores near you...
                  </div>
                ) : nearbyStores?.length ? (
                  <>
                    <div className="space-y-2 mb-3">
                      {nearbyStores.slice(0, 4).map((store, i) => (
                        <div key={i} className="flex items-center gap-3 py-1.5">
                          <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{store.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{store.address}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-medium">{store.distance?.toFixed(1)}km</p>
                            <p className={`text-[10px] ${store.openNow ? 'text-green-400' : 'text-red-400'}`}>
                              {store.openNow === undefined ? '' : store.openNow ? 'Open' : 'Closed'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {nearbyStores.length > 1 && (
                      <a href={buildDirectionsUrl(nearbyStores.slice(0, 3))} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-accent hover:underline">
                        <Navigation className="w-3 h-3" />Get shopping route
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No stores found nearby.</p>
                )}
              </motion.div>
            )}

            {aiResult.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {aiResult.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] rounded-lg">
                    <Tag className="w-2.5 h-2.5 mr-1" />{tag}
                  </Badge>
                ))}
              </div>
            )}

            {aiResult.related_people?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {aiResult.related_people.map((person) => (
                  <Badge key={person} className="text-[10px] rounded-lg bg-chart-5/10 text-chart-5 border-chart-5/20">
                    <Users className="w-2.5 h-2.5 mr-1" />{person}
                  </Badge>
                ))}
              </div>
            )}

            {aiResult.extracted_actions?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">Extracted Actions</h4>
                {aiResult.extracted_actions.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50">
                    <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-sm flex-1">{action.action}</span>
                    {action.due_date && (
                      <Badge variant="outline" className="text-[10px]">
                        <CalendarDays className="w-2.5 h-2.5 mr-1" />{action.due_date}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}

            {aiResult.ai_suggestions?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">AI Suggestions</h4>
                {aiResult.ai_suggestions.map((sug, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-accent/5 border border-accent/10">
                    <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="text-sm flex-1">{sug.suggestion}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{Math.round((sug.confidence || 0) * 100)}%</span>
                  </div>
                ))}
              </div>
            )}

            {detectedEvents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">Added to Calendar</h4>
                {detectedEvents.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-success/5 border border-success/20">
                    <Bell className="w-3.5 h-3.5 text-success shrink-0" />
                    <span className="text-sm flex-1">{ev.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(ev.event_date).toLocaleDateString()} {new Date(ev.event_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
