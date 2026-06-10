import { useState, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { invokeGemini } from "@/services/geminiService";
import { getOrCreateUser } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

export default function AIChat({ onClose }) {
  const uid = useCurrentUid();
  const [userApiKey, setUserApiKey] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your MindFlow AI assistant. I can help you create notes, manage tasks, remember important details, and organize your life. What would you like to do?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getOrCreateUser(uid).then((profile) => {
      if (profile?.apiKey) setUserApiKey(profile.apiKey);
    }).catch(() => {});
  }, [uid]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    const conversationContext = messages
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    try {
      const prompt = `You are MindFlow, an AI personal operating system assistant. You help users organize their life by managing notes, tasks, memories, and schedules.

Previous conversation:
${conversationContext}

User message: ${userMessage}

Respond helpfully and proactively. If the user mentions:
- A task or to-do → offer to create it
- A meeting or event → suggest scheduling it
- A person → note any details about them
- Shopping → suggest a checklist
- A reminder → offer contextual or time-based options

Be concise, professional, and proactive. Use markdown for formatting.`;

      const schema = {
        type: "object",
        properties: {
          response: { type: "string", description: "Your response to the user" },
          detected_intent: { type: "string", enum: ["task", "meeting", "shopping", "reminder", "memory", "general"] },
          suggested_actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                title: { type: "string" },
                description: { type: "string" }
              }
            }
          }
        }
      };

      const data = await invokeGemini(prompt, schema, uid, userApiKey);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, actions: data.suggested_actions },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process that. Please check your API key in Settings." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-heading font-semibold">MindFlow AI</h3>
          <p className="text-[10px] text-muted-foreground">Your personal assistant</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[400px]">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user" ? "bg-accent text-accent-foreground" : "bg-muted"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p>{msg.content}</p>
                )}
                {msg.actions?.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {msg.actions.map((action, j) => (
                      <button
                        key={j}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors border border-accent/20"
                      >
                        <span className="font-medium">{action.title}</span>
                        {action.description && (
                          <span className="text-muted-foreground ml-1">— {action.description}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span className="text-xs text-muted-foreground">Thinking...</span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-3 border-t border-border/50">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask MindFlow anything..."
            className="flex-1 bg-muted/50 border-0 rounded-xl text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
