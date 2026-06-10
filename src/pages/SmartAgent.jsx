import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { invokeGemini } from "@/services/geminiService";
import { getOrCreateUser } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

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

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-accent" />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-accent/60"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
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

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = newMessages
        .slice(-12)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      const prompt = `You are a Smart Life Agent — an AI personal assistant that helps users manage their notes, tasks, schedule, and life.

Conversation history:
${history}

Respond as the assistant. Be helpful, concise, and proactive. Use markdown for formatting when appropriate.`;

      const response = await invokeGemini(prompt, null, uid, userApiKey);
      const content = typeof response === "string" ? response : (response?.text || response?.response || JSON.stringify(response));
      setMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch (err) {
      console.error('SmartAgent error:', err);
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err?.message || 'Unknown error'}` }]);
    } finally {
      setLoading(false);
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
            className="flex flex-col items-center justify-center h-full gap-4 text-center px-6"
          >
            <div className="w-16 h-16 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <div>
              <p className="font-heading font-semibold text-foreground mb-1">How can I help you today?</p>
              <p className="text-sm text-muted-foreground">Ask me to manage your tasks, notes, schedule plans, or anything about your life.</p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              {[
                "Summarize my recent notes",
                "What tasks are pending?",
                "Add a reminder to call John",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-sm text-left px-4 py-2.5 rounded-xl border border-border bg-card hover:border-accent/40 hover:bg-accent/5 transition-all text-muted-foreground"
                >
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
            {loading && <TypingIndicator />}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 px-4 pb-24 pt-3 border-t border-border/50 glass" style={{ paddingBottom: 'max(6rem, calc(5rem + env(safe-area-inset-bottom)))' }}>
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
            onClick={send}
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
