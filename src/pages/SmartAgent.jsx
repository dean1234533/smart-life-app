import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Sparkles, ChefHat, CheckSquare, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { invokeGeminiAgent, invokeGemini } from "@/services/geminiService";
import { getOrCreateUser, recipesService, tasksService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { toast } from "sonner";

const SYSTEM_PROMPT = `You are a Smart Life Agent — a friendly, helpful AI personal assistant built into the Smart Life app.

You can do anything the user asks. Answer questions, give advice, create workout plans, find recipes, manage their tasks, and more.

IMPORTANT RULES:
- If the user asks for a workout, fitness plan, exercise routine, or training programme → call find_workout
- If the user asks for a recipe, meal, dish, or food idea → call find_recipe
- If the user wants to save a recipe → call save_recipe
- If the user asks to see their recipes → call list_recipes
- If the user asks to add a task, reminder, or to-do → call create_task
- If the user asks to see their tasks → call list_tasks
- If the user mentions shopping, groceries, a meal plan, needing food, or what to buy → call suggest_shopping_items
- If the user asks to add a specific item to a shopping list → call add_shopping_item
- If the user asks about anything current, real-world, or that needs up-to-date info — news, prices, local businesses, products, events, directions, "how to", "what is", "where can I", "best X near me" → call web_search
- For general advice, fitness tips, motivation, or things you already know well → answer directly without tools

Always show the full result to the user. Never say "I can't do that." Be warm, encouraging, and thorough.
Format workouts and recipes clearly with headings, sets/reps, and instructions. Use markdown.`;

const AGENT_TOOLS = [
  {
    name: 'find_workout',
    description: 'Create a complete workout or fitness plan. Use whenever the user asks for a workout, exercise, training, or fitness routine.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the user wants, e.g. "30 minute full body workout", "beginner chest day", "leg day for weight loss"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_recipe',
    description: 'Generate a complete recipe. Use when the user asks for a recipe, meal idea, or food suggestion.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Dish name or description, e.g. "spaghetti carbonara" or "quick vegetarian stir fry"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'save_recipe',
    description: "Save a recipe to the user's saved recipes.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        ingredients: { type: 'array', items: { type: 'string' } },
        instructions: { type: 'string' },
      },
      required: ['title', 'ingredients', 'instructions'],
    },
  },
  {
    name: 'list_recipes',
    description: "Show all of the user's saved recipes.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'create_task',
    description: 'Add a task or reminder for the user.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Optional extra details' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: "Show the user's current to-do list.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'add_shopping_item',
    description: "Add a single specific item to the user's shopping list.",
    parameters: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'The item to add, e.g. "milk", "protein powder"' },
      },
      required: ['item'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for current, real-world information. Use for anything that needs live data: news, prices, local businesses, products, events, how-to guides, facts.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query, e.g. "best protein powder UK 2024" or "weather Manchester this week"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'suggest_shopping_items',
    description: "Generate a smart shopping list based on what the user mentions — meals, plans, preferences, or general shopping needs. Always use this when the user talks about shopping, food, groceries, or meal planning.",
    parameters: {
      type: 'object',
      properties: {
        context: { type: 'string', description: "What the user mentioned, e.g. 'making pasta this week', 'healthy eating', 'weekly shop'" },
      },
      required: ['context'],
    },
  },
];

const SUGGESTIONS = [
  "Give me a 30 minute full body workout",
  "Find me a quick healthy dinner recipe",
  "Add a reminder to drink more water",
  "What are the best foods for building muscle?",
  "Give me a beginner running plan",
  "Show me my to-do list",
];

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-accent" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-accent text-accent-foreground rounded-br-sm"
            : "bg-card border border-border text-foreground rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown
            className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={{
              p: ({ children }) => <p className="my-1">{children}</p>,
              ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="my-0.5">{children}</li>,
              strong: ({ children }) => <strong className="text-accent font-semibold">{children}</strong>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator({ status }) {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-accent" />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-2 items-center">
        {status ? (
          <>
            <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
            <span className="text-xs text-muted-foreground">{status}</span>
          </>
        ) : (
          [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-accent/60"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function SmartAgent() {
  const uid = useCurrentUid();
  const [userApiKey, setUserApiKey] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!uid) return;
    getOrCreateUser(uid).then((profile) => {
      if (profile?.apiKey) setUserApiKey(profile.apiKey);
    }).catch(() => {});
  }, [uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const executeToolCall = useCallback(async (name, args) => {
    switch (name) {
      case 'find_workout': {
        setToolStatus(`Building your workout...`);
        const result = await invokeGemini(
          `Create a complete, detailed workout plan for: ${args.query}.
Include:
- A short intro (what it targets, how long)
- Warm-up (3-5 minutes)
- Main workout (list each exercise with sets, reps or duration, and rest time)
- Cool-down
- Any tips or modifications for beginners

Format it clearly with bold headings and bullet points.`,
          null,
          uid,
          userApiKey
        );
        // invokeGemini with null schema returns a string
        if (typeof result === 'string') return { text: result };
        return result;
      }
      case 'find_recipe': {
        setToolStatus(`Generating recipe for "${args.query}"...`);
        const recipe = await invokeGemini(
          `Generate a complete, detailed recipe for: ${args.query}. Include exact quantities in ingredients.`,
          {
            type: 'object',
            properties: {
              title: { type: 'string' },
              ingredients: { type: 'array', items: { type: 'string' } },
              instructions: { type: 'string' },
            },
            required: ['title', 'ingredients', 'instructions'],
          },
          uid,
          userApiKey
        );
        return recipe;
      }
      case 'save_recipe': {
        setToolStatus(`Saving "${args.title}"...`);
        await recipesService.create(uid, {
          title: args.title,
          ingredients: args.ingredients,
          instructions: args.instructions,
        });
        toast.success(`Recipe "${args.title}" saved!`);
        return { success: true, message: `Recipe "${args.title}" has been saved to your Recipes.` };
      }
      case 'list_recipes': {
        setToolStatus('Loading your recipes...');
        const recipes = await recipesService.list(uid);
        if (!recipes.length) return { recipes: [], message: 'No saved recipes yet.' };
        return { recipes: recipes.map(r => ({ id: r.id, title: r.title })) };
      }
      case 'create_task': {
        setToolStatus(`Creating task "${args.title}"...`);
        await tasksService.create(uid, {
          title: args.title,
          description: args.description || '',
          status: 'pending',
        });
        toast.success(`Task "${args.title}" created!`);
        return { success: true, message: `Task "${args.title}" has been created.` };
      }
      case 'list_tasks': {
        setToolStatus('Loading your tasks...');
        const tasks = await tasksService.list(uid);
        const pending = tasks.filter(t => t.status !== 'done' && t.status !== 'completed');
        return { tasks: pending.map(t => ({ id: t.id, title: t.title })) };
      }
      case 'add_shopping_item': {
        setToolStatus(`Adding "${args.item}" to your shopping list...`);
        const { shoppingListsService } = await import('@/lib/firestoreService');
        const lists = await shoppingListsService.list(uid);
        let listId = lists[0]?.id;
        if (!listId) {
          const newList = await shoppingListsService.create(uid, { name: 'Shopping List', items: [] });
          listId = newList.id;
        }
        const list = lists[0] || { items: [] };
        const updatedItems = [...(list.items || []), { name: args.item, checked: false, id: Date.now().toString() }];
        await shoppingListsService.update(uid, listId, { items: updatedItems });
        toast.success(`"${args.item}" added to your shopping list`);
        return { success: true, message: `"${args.item}" has been added to your shopping list.` };
      }
      case 'web_search': {
        setToolStatus(`Searching for "${args.query}"...`);
        const q = encodeURIComponent(args.query);

        // Try Brave Search first (richer results, needs optional API key)
        const braveKey = (() => { try { return localStorage.getItem('brave_search_key'); } catch { return null; } })();
        if (braveKey) {
          try {
            const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=5`, {
              headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': braveKey },
              signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
              const data = await res.json();
              const results = (data.web?.results || []).slice(0, 5)
                .map(r => `**${r.title}**\n${r.description || ''}\n${r.url}`)
                .join('\n\n');
              if (results) return { results };
            }
          } catch {}
        }

        // Fallback: DuckDuckGo Instant Answers (free, no key needed)
        try {
          const res = await fetch(
            `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1&no_redirect=1`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (res.ok) {
            const data = await res.json();
            const parts = [];
            if (data.Answer) parts.push(data.Answer);
            if (data.AbstractText) parts.push(data.AbstractText);
            if (data.Definition) parts.push(data.Definition);
            (data.RelatedTopics || []).slice(0, 5).forEach(t => { if (t.Text) parts.push(t.Text); });
            if (parts.length) return { results: parts.join('\n\n') };
          }
        } catch {}

        return { results: 'No search results found. Try rephrasing your question.' };
      }
      case 'suggest_shopping_items': {
        setToolStatus('Building your shopping list...');
        const suggested = await invokeGemini(
          `The user said: "${args.context}"

Based on this, generate a helpful shopping list. Include:
1. The specific items they need
2. Any related items they probably need but didn't mention
3. Healthier alternatives or extras they might like

Group items into sections (e.g. Fresh Produce, Dairy, Meat, Bakery, Store Cupboard).
Keep it practical and realistic.

After the list, add 1-2 short suggestions for meals or food ideas they might enjoy based on what they mentioned.

Format clearly with bold section headings and bullet points.`,
          null,
          uid,
          userApiKey
        );
        return { text: typeof suggested === 'string' ? suggested : JSON.stringify(suggested) };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }, [uid, userApiKey]);


  const send = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    const userMsg = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);
    setToolStatus("");

    try {
      // Convert UI message history to Gemini multi-turn format
      let agentContents = nextMessages.slice(-10).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      // Agentic loop — runs until the model returns text (no more tool calls)
      for (let step = 0; step < 6; step++) {
        setToolStatus(step === 0 ? "" : toolStatus);
        const modelContent = await invokeGeminiAgent(agentContents, AGENT_TOOLS, SYSTEM_PROMPT, uid, userApiKey);
        if (!modelContent) throw new Error("Empty response from agent");

        const parts = modelContent.parts || [];
        const functionCalls = parts.filter((p) => p.functionCall);
        const textPart = parts.find((p) => p.text);

        if (functionCalls.length === 0) {
          setMessages((prev) => [...prev, { role: "assistant", content: textPart?.text || "" }]);
          break;
        }

        // Append model turn (with function calls) to context
        agentContents = [...agentContents, { role: "model", parts }];

        // Execute all tool calls and collect results
        const toolResultParts = [];
        for (const part of functionCalls) {
          const { name, args } = part.functionCall;
          const result = await executeToolCall(name, args);
          toolResultParts.push({ functionResponse: { name, response: result } });
        }
        setToolStatus("");

        // Append tool results as user turn
        agentContents = [...agentContents, { role: "user", parts: toolResultParts }];
      }
    } catch (err) {
      console.error("SmartAgent error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err?.message || "Unknown error"}` }]);
    } finally {
      setLoading(false);
      setToolStatus("");
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] pt-0">
      <div className="shrink-0 px-4 pt-12 pb-4 border-b border-border/50 glass">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center glow-cyan">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-base text-foreground">Smart Life Agent</h1>
            <p className="text-xs text-muted-foreground">Your personal AI assistant</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-5 text-center px-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <div>
              <p className="font-heading font-semibold text-foreground mb-1">What can I help with?</p>
              <p className="text-sm text-muted-foreground">Type below — I can find recipes, workouts,{"\n"}manage tasks, shopping lists, and more.</p>
            </div>

            <div className="flex flex-col gap-2 w-full mt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-sm text-left px-4 py-2.5 rounded-xl border border-border bg-card hover:border-accent/40 hover:bg-accent/5 transition-all text-muted-foreground flex items-center gap-2"
                >
                  {s.toLowerCase().includes("recipe") ? (
                    <ChefHat className="w-3.5 h-3.5 shrink-0 text-accent/60" />
                  ) : (
                    <CheckSquare className="w-3.5 h-3.5 shrink-0 text-accent/60" />
                  )}
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {loading && <TypingIndicator status={toolStatus} />}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className="shrink-0 px-4 pt-3 border-t border-border/50 glass"
        style={{ paddingBottom: 'max(6rem, calc(5rem + env(safe-area-inset-bottom)))' }}
      >
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask your Smart Life Agent..."
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all max-h-32"
            style={{ minHeight: 44 }}
          />

          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-2xl bg-accent flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-accent/80 transition-colors"
          >
            <Send className="w-4 h-4 text-accent-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
