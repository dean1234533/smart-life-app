import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Phone, Square, Loader2, Sparkles,
  CheckCircle2, CalendarDays, UserPlus, ClipboardList,
  DollarSign, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Check, X, Mic, Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  recordingsService, expensesService,
  contactsService, calendarEventsService, tasksService, getOrCreateUser,
} from "@/lib/firestoreService";
import { invokeGemini, transcribeAudio } from "@/services/geminiService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

// ── Reusable confirm card ───────────────────────────────────────────────────
function ConfirmCard({ icon: Icon, colorClass, title, children, onAccept, onDismiss, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl border border-indigo-500/20 bg-card"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${colorClass}`} />
          <span className={`text-xs font-heading font-semibold ${colorClass}`}>{title}</span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onDismiss}
            className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onAccept}
            disabled={loading}
            className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

// ── Category result card ────────────────────────────────────────────────────
function CategoryCard({ icon: Icon, colorClass, bgClass, label, children }) {
  return (
    <div className={`p-4 rounded-2xl border ${bgClass}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className={`w-4 h-4 ${colorClass}`} />
        <span className={`text-xs font-heading font-semibold uppercase tracking-wider ${colorClass}`}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}


export default function PhoneCallNew() {
  const uid = useCurrentUid();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [callerName, setCallerName] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [userApiKey, setUserApiKey] = useState("");
  const [savedCallId, setSavedCallId] = useState(null);

  // Confirm cards
  const [pendingCalendar, setPendingCalendar]   = useState(null);
  const [pendingExpenses, setPendingExpenses]   = useState(null);
  const [pendingContacts, setPendingContacts]   = useState(null);
  const [pendingTasks, setPendingTasks]         = useState(null);

  // Loading states
  const [savingCalendar, setSavingCalendar]   = useState(false);
  const [savingExpenses, setSavingExpenses]   = useState(false);
  const [savingContacts, setSavingContacts]   = useState(false);
  const [savingTasks, setSavingTasks]         = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);

  useEffect(() => {
    if (!uid) return;
    getOrCreateUser(uid)
      .then((p) => { if (p?.apiKey) setUserApiKey(p.apiKey); })
      .catch(() => {});
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    };
  }, [uid]);

  // ── Recording controls ─────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone not available. Try Chrome or Safari.");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Microphone access denied — please allow it in browser settings.");
      } else {
        toast.error(`Mic error: ${err.message}`);
      }
      return;
    }

    const preferredTypes = [
      "audio/webm;codecs=opus", "audio/webm", "audio/mp4",
      "audio/ogg;codecs=opus", "audio/ogg",
    ];
    const mimeType = preferredTypes.find((t) => {
      try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
    }) || "";

    const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const t = mr.mimeType || mimeType || "audio/webm";
      setAudioBlob(new Blob(chunksRef.current, { type: t }));
      stream.getTracks().forEach((t) => t.stop());
    };
    mr.start(250);
    setIsRecording(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  // ── AI Analysis ────────────────────────────────────────────────────────────
  const analyzeCall = async () => {
    if (!audioBlob || !uid) return;
    setIsProcessing(true);
    try {
      // Upload audio
      const filename = `phone-calls/${uid}/${Date.now()}.webm`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, audioBlob);
      const audioUrl = await getDownloadURL(storageRef);

      // Transcribe
      const transcriptText = await transcribeAudio(audioBlob, uid, userApiKey);
      setTranscription(transcriptText);

      // Phone-call-specific AI analysis
      const prompt = `You are analyzing a phone call recording transcription. The caller's name is: "${callerName || "Unknown"}".

Transcription:
"""
${transcriptText}
"""

Extract ALL of the following from this phone call:
1. A concise summary (2-3 sentences) of what the call was about
2. Call type: classify as exactly one of: Sales, Support, Personal, Business, Other
3. Overall sentiment of the call: Positive, Neutral, or Negative
4. Sentiment score from 0.0 (very negative) to 1.0 (very positive)
5. Caller details: name (use "${callerName || "Unknown"}" if not explicitly stated), company if mentioned, phone number if mentioned
6. Key points: bullet list of the 3-6 most important things discussed
7. Concerns or complaints raised during the call
8. Commitments or promises made by either party
9. Action items that need to happen after this call
10. Any appointments, meetings or dates agreed
11. Financial mentions: quotes, prices, invoices, amounts discussed
12. New contact information mentioned (names, emails, phone numbers)`;

      const schema = {
        type: "object",
        properties: {
          ai_summary:      { type: "string" },
          call_type:       { type: "string" },
          sentiment:       { type: "string" },
          sentiment_score: { type: "number" },
          caller_name:     { type: "string" },
          caller_company:  { type: "string" },
          caller_phone:    { type: "string" },
          key_points: {
            type: "array",
            items: { type: "string" },
          },
          concerns: {
            type: "array",
            items: { type: "string" },
          },
          commitments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                commitment: { type: "string" },
                by_whom:    { type: "string" },
              },
            },
          },
          extracted_actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action:   { type: "string" },
                due_date: { type: "string" },
                assignee: { type: "string" },
                priority: { type: "string" },
              },
            },
          },
          appointments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title:   { type: "string" },
                date:    { type: "string" },
                details: { type: "string" },
              },
            },
          },
          financials: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                amount:      { type: "number" },
                currency:    { type: "string" },
              },
            },
          },
          new_contacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name:  { type: "string" },
                phone: { type: "string" },
                email: { type: "string" },
              },
            },
          },
        },
      };

      const analysis = await invokeGemini(prompt, schema, uid, userApiKey);
      setAiResult(analysis);

      // Determine the call title
      const resolvedCaller = callerName || analysis.caller_name || "Unknown Caller";
      const callTitle = `Call with ${resolvedCaller}`;

      // Save to Firestore as a recording with phone_call type
      const rec = await recordingsService.create(uid, {
        title:             callTitle,
        recording_type:    "phone_call",
        caller_name:       resolvedCaller,
        caller_company:    analysis.caller_company || "",
        caller_phone:      analysis.caller_phone || "",
        call_type:         analysis.call_type || "Other",
        sentiment:         analysis.sentiment || "Neutral",
        sentiment_score:   analysis.sentiment_score ?? 0.5,
        audio_url:         audioUrl,
        duration_seconds:  duration,
        transcription:     transcriptText,
        ai_summary:        analysis.ai_summary || "",
        key_points:        analysis.key_points || [],
        concerns:          analysis.concerns || [],
        commitments:       analysis.commitments || [],
        extracted_actions: analysis.extracted_actions || [],
        appointments:      analysis.appointments || [],
        financials:        analysis.financials || [],
        status:            "completed",
      });

      setSavedCallId(rec?.id);
      queryClient.invalidateQueries({ queryKey: ["recordings", uid] });

      // Queue confirm cards
      if (analysis.appointments?.length)      setPendingCalendar(analysis.appointments);
      if (analysis.extracted_actions?.length) setPendingTasks(analysis.extracted_actions);
      if (analysis.financials?.length)        setPendingExpenses(analysis.financials);
      if (analysis.new_contacts?.length)      setPendingContacts(analysis.new_contacts);

    } catch (err) {
      console.error("Phone call analysis error:", err);
      toast.error(`Failed to analyze call: ${err?.message || "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Save helpers ───────────────────────────────────────────────────────────
  const acceptCalendar = async () => {
    if (!uid || !pendingCalendar) return;
    setSavingCalendar(true);
    for (const ev of pendingCalendar)
      await calendarEventsService.create(uid, { title: ev.title, date: ev.date, attendees: [], linkedSummaryId: savedCallId || null }).catch(() => {});
    toast.success(`${pendingCalendar.length} appointment${pendingCalendar.length > 1 ? "s" : ""} saved!`);
    setPendingCalendar(null);
    setSavingCalendar(false);
  };

  const acceptTasks = async () => {
    if (!uid || !pendingTasks) return;
    setSavingTasks(true);
    for (const action of pendingTasks)
      await tasksService.create(uid, { title: action.action, status: "pending", priority: action.priority || "medium", due_date: action.due_date || null, linkedSummaryId: savedCallId || null }).catch(() => {});
    toast.success(`${pendingTasks.length} task${pendingTasks.length > 1 ? "s" : ""} saved!`);
    setPendingTasks(null);
    setSavingTasks(false);
  };

  const acceptExpenses = async () => {
    if (!uid || !pendingExpenses) return;
    setSavingExpenses(true);
    for (const fin of pendingExpenses)
      await expensesService.create(uid, { description: fin.description, amount: fin.amount, currency: fin.currency || "GBP", linkedSummaryId: savedCallId || null }).catch(() => {});
    toast.success(`${pendingExpenses.length} financial item${pendingExpenses.length > 1 ? "s" : ""} saved!`);
    setPendingExpenses(null);
    setSavingExpenses(false);
  };

  const acceptContacts = async () => {
    if (!uid || !pendingContacts) return;
    setSavingContacts(true);
    for (const c of pendingContacts)
      await contactsService.create(uid, { name: c.name, phone: c.phone || "", email: c.email || "" }).catch(() => {});
    toast.success(`${pendingContacts.length} contact${pendingContacts.length > 1 ? "s" : ""} saved!`);
    setPendingContacts(null);
    setSavingContacts(false);
  };

  const formatTime = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ── Sentiment display ──────────────────────────────────────────────────────
  const SentimentIcon =
    aiResult?.sentiment === "Positive" ? TrendingUp
    : aiResult?.sentiment === "Negative" ? TrendingDown
    : Minus;
  const sentimentColor =
    aiResult?.sentiment === "Positive" ? "text-emerald-400"
    : aiResult?.sentiment === "Negative" ? "text-rose-400"
    : "text-muted-foreground";

  return (
    <div className="px-4 pt-12 pb-8">
      {/* Back */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/phone-calls")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Caller name input */}
      <div className="mb-8">
        <Input
          value={callerName}
          onChange={(e) => setCallerName(e.target.value)}
          placeholder="Caller name (optional)..."
          className="border-0 text-xl font-heading font-semibold px-0 focus-visible:ring-0 bg-transparent"
        />
      </div>

      {/* Recording instructions banner */}
      <AnimatePresence>
        {!audioBlob && !aiResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-8"
          >
            <Volume2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-heading font-semibold text-indigo-400 mb-1">
                How to record a phone call
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Put your phone on <strong>speakerphone</strong></li>
                <li>Keep this device near your phone</li>
                <li>Tap <strong>Start Recording</strong> below</li>
                <li>After the call, tap <strong>Stop → Analyze</strong></li>
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waveform + timer + controls */}
      <div className="flex flex-col items-center py-6">
        <div className="flex items-center gap-1 h-16 mb-6">
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-1 rounded-full ${isRecording ? "bg-indigo-400" : "bg-muted-foreground/20"}`}
              animate={
                isRecording
                  ? { height: [6, Math.random() * 52 + 8, 6] }
                  : { height: 6 }
              }
              transition={{
                duration: 0.7 + Math.random() * 0.5,
                repeat: Infinity,
                delay: i * 0.04,
              }}
            />
          ))}
        </div>

        <p className="text-4xl font-display font-bold mb-8 tabular-nums">
          {formatTime(duration)}
        </p>

        <div className="flex items-center gap-6">
          {!isRecording && !audioBlob && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg"
              style={{ boxShadow: "0 0 30px rgba(99,102,241,0.35)" }}
            >
              <Mic className="w-8 h-8 text-white" />
            </motion.button>
          )}
          {isRecording && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-rose-500 flex items-center justify-center shadow-lg"
            >
              <Square className="w-6 h-6 text-white" />
            </motion.button>
          )}
          {audioBlob && !isRecording && !aiResult && (
            <Button
              onClick={analyzeCall}
              disabled={isProcessing}
              className="rounded-xl bg-indigo-500 hover:bg-indigo-500/90 text-white gap-2 px-6 py-6"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              {isProcessing ? "Analyzing call..." : "Analyze Call"}
            </Button>
          )}
        </div>

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-muted-foreground">Transcribing and analysing your call...</p>
            <div className="flex justify-center gap-1 mt-3">
              {["Transcribing", "Extracting actions", "Detecting sentiment", "Categorising"].map(
                (step, i) => (
                  <motion.div
                    key={step}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                    className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-lg"
                  >
                    {step}
                  </motion.div>
                )
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Results ── */}
      <AnimatePresence>
        {aiResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 mt-4"
          >
            {/* Summary + Sentiment header */}
            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-heading font-semibold text-indigo-400">
                    AI Analysis
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {aiResult.call_type && (
                    <Badge className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                      {aiResult.call_type}
                    </Badge>
                  )}
                  <div className={`flex items-center gap-1 text-xs font-medium ${sentimentColor}`}>
                    <SentimentIcon className="w-3.5 h-3.5" />
                    {aiResult.sentiment}
                  </div>
                </div>
              </div>
              {aiResult.ai_summary && (
                <p className="text-sm leading-relaxed">{aiResult.ai_summary}</p>
              )}
            </div>

            {/* Caller info */}
            {(aiResult.caller_name || aiResult.caller_company) && (
              <CategoryCard
                icon={Phone}
                colorClass="text-indigo-400"
                bgClass="bg-indigo-500/5 border-indigo-500/20"
                label="Caller Details"
              >
                <div className="space-y-1">
                  {aiResult.caller_name && (
                    <p className="text-sm"><span className="text-muted-foreground text-xs">Name: </span>{aiResult.caller_name}</p>
                  )}
                  {aiResult.caller_company && (
                    <p className="text-sm"><span className="text-muted-foreground text-xs">Company: </span>{aiResult.caller_company}</p>
                  )}
                  {aiResult.caller_phone && (
                    <p className="text-sm"><span className="text-muted-foreground text-xs">Phone: </span>{aiResult.caller_phone}</p>
                  )}
                </div>
              </CategoryCard>
            )}

            {/* Key points */}
            {aiResult.key_points?.length > 0 && (
              <CategoryCard
                icon={ClipboardList}
                colorClass="text-amber-400"
                bgClass="bg-amber-500/5 border-amber-500/20"
                label="Key Points"
              >
                <ul className="space-y-1.5">
                  {aiResult.key_points.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </CategoryCard>
            )}

            {/* Concerns */}
            {aiResult.concerns?.length > 0 && (
              <CategoryCard
                icon={AlertTriangle}
                colorClass="text-rose-400"
                bgClass="bg-rose-500/5 border-rose-500/20"
                label="Concerns Raised"
              >
                {aiResult.concerns.map((c, i) => (
                  <p key={i} className="text-sm text-muted-foreground mt-1">• {c}</p>
                ))}
              </CategoryCard>
            )}

            {/* Commitments */}
            {aiResult.commitments?.length > 0 && (
              <CategoryCard
                icon={CheckCircle2}
                colorClass="text-emerald-400"
                bgClass="bg-emerald-500/5 border-emerald-500/20"
                label="Commitments Made"
              >
                {aiResult.commitments.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{c.commitment}{c.by_whom ? <span className="text-xs text-muted-foreground ml-1">— {c.by_whom}</span> : ""}</span>
                  </div>
                ))}
              </CategoryCard>
            )}

            {/* Full transcription */}
            {transcription && (
              <div className="p-4 rounded-2xl bg-muted/50">
                <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Transcription
                </h4>
                <p className="text-sm leading-relaxed line-clamp-6">{transcription}</p>
              </div>
            )}

            {/* ── Action confirm cards ── */}
            {pendingCalendar && (
              <ConfirmCard
                icon={CalendarDays}
                colorClass="text-green-400"
                title={`Save ${pendingCalendar.length} Appointment${pendingCalendar.length > 1 ? "s" : ""}?`}
                onAccept={acceptCalendar}
                onDismiss={() => setPendingCalendar(null)}
                loading={savingCalendar}
              >
                {pendingCalendar.map((ev, i) => (
                  <div key={i} className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <CalendarDays className="w-3 h-3 shrink-0" />
                    <span className="truncate">{ev.title}</span>
                    {ev.date && <span className="text-xs shrink-0">{ev.date}</span>}
                  </div>
                ))}
              </ConfirmCard>
            )}

            {pendingTasks && (
              <ConfirmCard
                icon={CheckCircle2}
                colorClass="text-indigo-400"
                title={`Save ${pendingTasks.length} Action Item${pendingTasks.length > 1 ? "s" : ""}?`}
                onAccept={acceptTasks}
                onDismiss={() => setPendingTasks(null)}
                loading={savingTasks}
              >
                {pendingTasks.map((t, i) => (
                  <p key={i} className="text-sm text-muted-foreground mt-1">
                    • {t.action}{t.due_date ? ` (due ${t.due_date})` : ""}
                  </p>
                ))}
              </ConfirmCard>
            )}

            {pendingExpenses && (
              <ConfirmCard
                icon={DollarSign}
                colorClass="text-rose-400"
                title={`Log ${pendingExpenses.length} Financial Item${pendingExpenses.length > 1 ? "s" : ""}?`}
                onAccept={acceptExpenses}
                onDismiss={() => setPendingExpenses(null)}
                loading={savingExpenses}
              >
                {pendingExpenses.map((fin, i) => (
                  <p key={i} className="text-sm text-muted-foreground mt-1">
                    • {fin.description} — {fin.currency || "£"}{fin.amount}
                  </p>
                ))}
              </ConfirmCard>
            )}

            {pendingContacts && (
              <ConfirmCard
                icon={UserPlus}
                colorClass="text-purple-400"
                title={`Save ${pendingContacts.length} Contact${pendingContacts.length > 1 ? "s" : ""}?`}
                onAccept={acceptContacts}
                onDismiss={() => setPendingContacts(null)}
                loading={savingContacts}
              >
                {pendingContacts.map((c, i) => (
                  <p key={i} className="text-sm text-muted-foreground mt-1">
                    • {c.name}{c.phone ? ` · ${c.phone}` : ""}{c.email ? ` · ${c.email}` : ""}
                  </p>
                ))}
              </ConfirmCard>
            )}

            <Button
              onClick={() => navigate("/phone-calls")}
              className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-500/90 text-white"
            >
              Done — View All Calls
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
