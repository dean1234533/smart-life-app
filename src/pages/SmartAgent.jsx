import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Sparkles, ChefHat, CheckSquare, Loader2, Mic, MicOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { invokeGeminiAgent, invokeGemini, transcribeAudio } from "@/services/geminiService";
import { getOrCreateUser, recipesService, tasksService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { toast } from "sonner";

const SYSTEM_PROMPT = `You are a Smart Life Agent — an AI personal assistant embedded in the Smart Life app.
You can manage the user's recipes, tasks, and more using the available tools.
When a user asks you to find, generate, or suggest a recipe, call find_recipe to create it, then present it nicely and ask if they'd like to save it. If they say yes, call save_recipe.
Be helpful, concise, and proactive. Use markdown for formatting when appropriate.`;

const AGENT_TOOLS = [
  {
    name: 'find_recipe',
    description: 'Generate a complete recipe for a dish. Use when the user asks to find, create, or suggest a recipe.',
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
    description: "Save a recipe to the user's recipe collection in the app.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Recipe name' },
        ingredients: { type: 'array', items: { type: 'string' }, description: 'List of ingredients with quantities' },
        instructions: { type: 'string', description: 'Step-by-step cooking instructions' },
      },
      required: ['title', 'ingredients', 'instructions'],
    },
  },
  {
    name: 'list_recipes',
    description: "List all recipes the user has saved in the app.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'create_task',
    description: 'Create a new task for the user.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Optional details about the task' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: "List the user's current pending tasks.",
    parameters: { type: 'object', properties: {} },
  },
];

const SUGGESTIONS = [
  "Find me a recipe for chicken tikka masala",
  "What tasks do I have pending?",
  "Add a task to buy groceries",
  "Show me my saved recipes",
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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

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
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }, [uid, userApiKey]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone not available. Try Safari or Chrome.");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      toast.error(err.name === 'NotAllowedError' ? "Microphone access denied — allow it in browser settings." : `Microphone error: ${err.message}`);
      return;
    }
    const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
    const mimeType = preferredTypes.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const actualType = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: actualType });
      setIsTranscribing(true);
      try {
        const text = await transcribeAudio(blob, uid, userApiKey);
        if (text?.trim()) {
          send(text.trim());
        } else {
          toast.error("Couldn't hear anything — try again.");
        }
      } catch (err) {
        toast.error(`Transcription failed: ${err.message}`);
      } finally {
        setIsTranscribing(false);
      }
    };
    recorder.start(250);
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

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

      {/* Full-screen tap-to-stop overlay while recording */}
      <AnimatePresence>
        {isRecording && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={stopRecording}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className="w-28 h-28 rounded-full bg-red-500/20 border-2 border-red-400 flex items-center justify-center mb-6"
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-red-500/30 flex items-center justify-center"
              >
                <Mic className="w-9 h-9 text-red-400" />
              </motion.div>
            </motion.div>
            <p className="text-white text-lg font-semibold mb-1">Listening...</p>
            <p className="text-white/60 text-sm">Tap anywhere to stop</p>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Full-screen transcribing overlay */}
      <AnimatePresence>
        {isTranscribing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
            <p className="text-white text-base font-medium">Transcribing...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-5 text-center px-6"
          >
            {/* Large tap-to-talk button */}
            <button
              onClick={startRecording}
              disabled={loading}
              className="relative flex items-center justify-center focus:outline-none"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.15, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute w-36 h-36 rounded-full bg-accent"
              />
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                className="absolute w-28 h-28 rounded-full bg-accent"
              />
              <div className="relative w-20 h-20 rounded-full bg-accent flex items-center justify-center shadow-lg">
                <Mic className="w-9 h-9 text-accent-foreground" />
              </div>
            </button>

            <div>
              <p className="font-heading font-semibold text-foreground mb-1">Tap to speak</p>
              <p className="text-sm text-muted-foreground">or type below — I can find recipes,{"\n"}save them, manage tasks, and more.</p>
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
            placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : "Ask your Smart Life Agent..."}
            rows={1}
            disabled={isRecording || isTranscribing}
            className="flex-1 resize-none rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all max-h-32 disabled:opacity-60"
            style={{ minHeight: 44 }}
          />

          {/* Mic button — tap to start, tap again to stop */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading || isTranscribing}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40 ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                : "border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

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
