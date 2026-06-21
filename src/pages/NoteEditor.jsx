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
  notesService, shoppingListsService, recipesService, mapSessionsService,
  tasksService, contactsService, expensesService, calendarEventsService, getOrCreateUser
} from "@/lib/firestoreService";
import { invokeGemini } from "@/services/geminiService";
import { getNearbyStores, buildDirectionsUrl } from "@/services/googleMapsService";
import { checkGoogleCalendarStatus, pushEventToGoogle } from "@/services/googleCalendarService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { useUserPrefs } from "@/hooks/useUserPrefs";

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
  const { prefs } = useUserPrefs();
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

  // Core analysis — shared by the manual button and auto-save on note save.
  // Returns { result, allShoppingItems, suggestedTitle } or throws.
  const runAnalysis = async (noteContent, noteTitle) => {
    let pastItemsContext = '';
    try {
      const pastLists = await shoppingListsService.list(uid, { limit: 10 });
      const pastItems = pastLists
        .flatMap(l => (l.items || []).map(i => i.name || i))
        .filter(Boolean);
      const unique = [...new Set(pastItems)].slice(0, 40);
      if (unique.length) {
        pastItemsContext = `\n\nUser's past shopping items (use these to personalise suggestions): ${unique.join(', ')}`;
      }
    } catch {}

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now()+86400000).toISOString().split('T')[0];

    const prompt = `Analyze this note and extract structured data.

Note: "${noteContent}"
${noteTitle ? `Title: "${noteTitle}"` : ""}${pastItemsContext}

ai_summary: Think like a human who read this note — interpret it, don't copy it. One short sentence. NEVER repeat vague phrases like "some bits", "other bits", "a few things" — translate them into what they actually mean. Never reference "the list" or "the suggestions". Include time/date if mentioned. Examples: "some bits from shops" → "Shopping trip." | "bits tomorrow at 12" → "Shopping tomorrow at 12." | "dentist tomorrow 2pm" → "Dentist tomorrow at 2pm." | "pay Dave a tenner" → "Pay Dave £10."

SHOPPING RULES:
- shopping_items = ONLY items the user explicitly named (not vague phrases like "other bits")
- shopping_suggestions = YOUR suggestions of specific products they likely need. If ANY shopping intent is detected (even just "other bits" or "some stuff"), you MUST suggest at least 8 real products by name (e.g. "Semi-skimmed milk", "Wholemeal bread"). Use their past items above to personalise. Never leave this empty when shopping is mentioned.

CALENDAR RULES (today=${today}):
- calendar_events: extract every activity that has a time or date, even casual ones
- Convert to ISO 8601: "tomorrow at 12" → ${tomorrow}T12:00:00, "noon"→12:00, "morning"→09:00, "afternoon"→14:00, "evening"→18:00
- Skip only if there is truly no time or date at all

Also extract: detected_intent, recipes (if meal plan), extracted_actions, new_contacts, expenses, tags, suggested_title.
ai_suggestions: smart tips only — NEVER suggest setting reminders, adding to calendar, or creating shopping lists. The app does all of that automatically.`;

    const schema = {
      type: "object",
      properties: {
        ai_summary: { type: "string" },
        detected_intent: { type: "string", enum: ["shopping", "meeting", "task", "reminder", "general", "decision", "promise", "meal_plan"] },
        shopping_items: { type: "array", items: { type: "string" } },
        shopping_suggestions: { type: "array", items: { type: "string" } },
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
        new_contacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              phone: { type: "string" },
              email: { type: "string" },
              notes: { type: "string" }
            }
          }
        },
        expenses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              amount: { type: "number" },
              currency: { type: "string" }
            }
          }
        },
        calendar_events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              event_date: { type: "string" },
              duration_minutes: { type: "number" },
              location: { type: "string" },
              attendees: { type: "array", items: { type: "string" } }
            }
          }
        },
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

    const shoppingKeywords = /\b(shop|shops|supermarket|tesco|sainsbury|asda|lidl|aldi|morrisons|shopping|groceries|grocery|buy|buying|pick up|get some|get a few|bits and bobs|bits|some bits|other bits|a few things|some stuff|market|corner shop|co.?op)\b/i;
    const looksLikeShopping = shoppingKeywords.test(noteContent) ||
      result.detected_intent === 'shopping' ||
      result.shopping_items?.length > 0;

    const vaguePattern = /^(other bits?|some bits?|a few things?|some stuff|etc\.?|and more|other things?|bits and bobs|miscellaneous|other items?|various)$/i;
    const explicitItems = (result.shopping_items || []).filter(i => !vaguePattern.test(i.trim()));
    const hasVague = (result.shopping_items || []).some(i => vaguePattern.test(i.trim()));

    let allShoppingItems = [
      ...explicitItems,
      ...(result.shopping_suggestions || []).filter(
        s => !explicitItems.some(e => e.toLowerCase() === s.toLowerCase())
      ),
    ];

    // Always run a dedicated suggestion call when shopping is detected
    if (looksLikeShopping) {
      try {
        const suggestPrompt = `The user said: "${noteContent}"
${pastItemsContext}

They're going shopping. Suggest 10 specific items they probably need to buy.${explicitItems.length ? ` They mentioned: ${explicitItems.join(', ')}.` : ''}
Use their past shopping history above to personalise the list.
Return ONLY a JSON array of strings — real product names like "Semi-skimmed milk", "Wholemeal bread", "Free range eggs". No vague phrases. No explanation.`;

        const extraSuggestions = await invokeGemini(suggestPrompt, { type: "array", items: { type: "string" } }, uid, userApiKey);
        if (Array.isArray(extraSuggestions) && extraSuggestions.length) {
          const deduped = extraSuggestions.filter(
            s => !allShoppingItems.some(e => e.toLowerCase() === s.toLowerCase())
          );
          allShoppingItems = [...explicitItems, ...deduped];
        }
      } catch {}
    }

    // Parse calendar events from main result
    const calendarEvents = (result.calendar_events || []).map(ev => {
      const d = new Date(ev.event_date);
      if (!ev.title || isNaN(d)) return null;
      const end = new Date(d.getTime() + (ev.duration_minutes || 60) * 60000);
      return { title: ev.title, event_date: d.toISOString(), end_date: end.toISOString(), location: ev.location || '', attendees: ev.attendees || [] };
    }).filter(Boolean);

    return { result, allShoppingItems, looksLikeShopping, calendarEvents };
  };

  const analyzeNote = async () => {
    if (!content.trim()) return;
    setIsAnalyzing(true);
    setShoppingSuggestions(null);
    setRecipeSuggestions(null);
    setNearbyStores(null);

    try {
      const { result, allShoppingItems, looksLikeShopping, calendarEvents } = await runAnalysis(content, title);
      setAiResult(result);
      if (!title && result.suggested_title) setTitle(result.suggested_title);

      if (looksLikeShopping && allShoppingItems.length) {
        setShoppingSuggestions(allShoppingItems);
        fetchNearbyStores();
      }

      if (result.extracted_actions?.length) {
        for (const action of result.extracted_actions) {
          await tasksService.create(uid, {
            title: action.action,
            description: "",
            status: "pending",
            priority: action.priority || "medium",
            due_date: action.due_date || null,
          }).catch(() => {});
        }
        toast.success(`${result.extracted_actions.length} task${result.extracted_actions.length > 1 ? "s" : ""} saved`);
      }

      if (result.new_contacts?.length) {
        for (const c of result.new_contacts) {
          await contactsService.create(uid, {
            name: c.name,
            phone: c.phone || "",
            email: c.email || "",
            notes: c.notes || "",
          }).catch(() => {});
        }
        toast.success(`${result.new_contacts.length} contact${result.new_contacts.length > 1 ? "s" : ""} saved`);
      }

      if (result.expenses?.length) {
        for (const exp of result.expenses) {
          await expensesService.create(uid, {
            description: exp.description,
            amount: exp.amount,
            currency: exp.currency || "GBP",
          }).catch(() => {});
        }
        toast.success(`${result.expenses.length} expense${result.expenses.length > 1 ? "s" : ""} saved`);
      }

      if (result.detected_intent === "meal_plan" && result.recipes?.length) {
        setRecipeSuggestions(result.recipes);
      }

      if (calendarEvents.length > 0) {
        setDetectedEvents(calendarEvents);
        for (const ev of calendarEvents) {
          await calendarEventsService.create(uid, { ...ev, source_type: "note", source_id: isNew ? "pending" : id }).catch(() => {});
        }
        try {
          const googleConnected = await checkGoogleCalendarStatus();
          if (googleConnected) {
            let pushed = 0;
            for (const ev of calendarEvents) {
              const ok = await pushEventToGoogle(ev);
              if (ok) pushed++;
            }
            if (pushed > 0) toast.success(`${pushed} event${pushed > 1 ? "s" : ""} added to Google Calendar!`);
            else toast.error("Calendar sync failed — try reconnecting Google Calendar in Settings.");
          } else {
            toast.success(`${calendarEvents.length} event${calendarEvents.length > 1 ? "s" : ""} saved. Connect Google Calendar in Settings to sync to your phone.`);
          }
        } catch {
          toast.success(`${calendarEvents.length} event${calendarEvents.length > 1 ? "s" : ""} saved locally.`);
        }
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

  const handleSave = async () => {
    if (prefs.autoScan && content.trim() && !aiResult) {
      setIsAnalyzing(true);
      try {
        const { result, allShoppingItems, looksLikeShopping, calendarEvents } = await runAnalysis(content, title);
        if (!title && result.suggested_title) setTitle(result.suggested_title);
        setAiResult(result);

        if (result.extracted_actions?.length) {
          for (const action of result.extracted_actions)
            await tasksService.create(uid, { title: action.action, description: "", status: "pending", priority: action.priority || "medium", due_date: action.due_date || null }).catch(() => {});
          toast.success(`${result.extracted_actions.length} task${result.extracted_actions.length > 1 ? "s" : ""} saved`);
        }

        if (result.new_contacts?.length) {
          for (const c of result.new_contacts)
            await contactsService.create(uid, { name: c.name, phone: c.phone || "", email: c.email || "", notes: c.notes || "" }).catch(() => {});
          toast.success(`${result.new_contacts.length} contact${result.new_contacts.length > 1 ? "s" : ""} saved`);
        }

        if (result.expenses?.length) {
          for (const exp of result.expenses)
            await expensesService.create(uid, { description: exp.description, amount: exp.amount, currency: exp.currency || "GBP" }).catch(() => {});
          toast.success(`${result.expenses.length} expense${result.expenses.length > 1 ? "s" : ""} saved`);
        }

        if (looksLikeShopping && allShoppingItems.length) {
          await shoppingListsService.create(uid, {
            items: allShoppingItems.map((item) => ({ name: item, checked: false })),
            title: title || result.suggested_title || "Shopping List",
          });
          toast.success(`Shopping list saved (${allShoppingItems.length} items)`);
        }

        if (result.detected_intent === "meal_plan" && result.recipes?.length) {
          for (const recipe of result.recipes) await recipesService.create(uid, recipe);
          toast.success(`${result.recipes.length} recipes saved`);
        }

        if (calendarEvents.length > 0) {
          for (const ev of calendarEvents) {
            await calendarEventsService.create(uid, { ...ev, source_type: "note", source_id: "pending" }).catch(() => {});
          }
          try {
            const googleConnected = await checkGoogleCalendarStatus();
            if (googleConnected) {
              for (const ev of calendarEvents) await pushEventToGoogle(ev).catch(() => {});
              toast.success(`${calendarEvents.length} event${calendarEvents.length > 1 ? "s" : ""} added to Google Calendar!`);
            } else {
              toast.success(`${calendarEvents.length} calendar event${calendarEvents.length > 1 ? "s" : ""} saved.`);
            }
          } catch {
            toast.success(`${calendarEvents.length} calendar event${calendarEvents.length > 1 ? "s" : ""} saved.`);
          }
        }

        const saveData = {
          title: title || result.suggested_title || "Untitled Note",
          content,
          is_pinned: isPinned,
          ai_summary: result.ai_summary,
          tags: result.tags,
          detected_intent: result.detected_intent,
          extracted_actions: result.extracted_actions,
          related_people: result.related_people,
          ai_suggestions: result.ai_suggestions,
        };
        saveMutation.mutate(saveData);
        return;
      } catch {
        toast.error("Auto-scan failed, saving note without analysis.");
      } finally {
        setIsAnalyzing(false);
      }
    }

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
