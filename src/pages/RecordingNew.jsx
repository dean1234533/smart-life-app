import { useState, useRef, useEffect } from "react";
import { extractAndSaveCalendarEvents } from "@/utils/extractCalendarEvents";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Mic, Square, Loader2, Sparkles, CheckCircle2,
  CalendarDays, Users, Check, X, DollarSign, UserPlus,
  ClipboardList, BookOpen
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  recordingsService, meetingSummariesService, followUpsService, expensesService,
  contactsService, calendarEventsService, tasksService, getOrCreateUser
} from "@/lib/firestoreService";
import { invokeGemini, transcribeAudio } from "@/services/geminiService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { useUserPrefs } from "@/hooks/useUserPrefs";

function ConfirmCard({ icon: Icon, colorClass, title, children, onAccept, onDismiss, loading }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl border border-accent/20 bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${colorClass}`} />
          <span className={`text-xs font-heading font-semibold ${colorClass}`}>{title}</span>
        </div>
        <div className="flex gap-1.5">
          <button onClick={onDismiss} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive">
            <X className="w-3.5 h-3.5" />
          </button>
          <button onClick={onAccept} disabled={loading}
            className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-accent-foreground">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

export default function RecordingNew() {
  const uid = useCurrentUid();
  const { prefs } = useUserPrefs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [userApiKey, setUserApiKey] = useState("");
  const [savedRecordingId, setSavedRecordingId] = useState(null);

  const [pendingCalendar, setPendingCalendar] = useState(null);
  const [pendingFollowUps, setPendingFollowUps] = useState(null);
  const [pendingExpenses, setPendingExpenses] = useState(null);
  const [pendingContacts, setPendingContacts] = useState(null);
  const [pendingTasks, setPendingTasks] = useState(null);
  const [pendingSummary, setPendingSummary] = useState(null);

  const [savingCalendar, setSavingCalendar] = useState(false);
  const [savingFollowUps, setSavingFollowUps] = useState(false);
  const [savingExpenses, setSavingExpenses] = useState(false);
  const [savingContacts, setSavingContacts] = useState(false);
  const [savingTasks, setSavingTasks] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!uid) return;
    getOrCreateUser(uid).then((profile) => {
      if (profile?.apiKey) setUserApiKey(profile.apiKey);
    }).catch(() => {});
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    };
  }, [uid]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone not available on this browser. Try opening the app in Safari or Chrome.");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error("Microphone access denied. Please allow microphone in your browser settings.");
      } else {
        toast.error(`Microphone error: ${err.message}`);
      }
      return;
    }

    // Pick the best supported MIME type — iOS only supports audio/mp4
    const preferredTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    const mimeType = preferredTypes.find((t) => {
      try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
    }) || '';

    const mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mediaRecorder.onstop = () => {
      const actualType = mediaRecorder.mimeType || mimeType || 'audio/webm';
      setAudioBlob(new Blob(chunksRef.current, { type: actualType }));
      stream.getTracks().forEach((t) => t.stop());
    };
    mediaRecorder.start(250);
    setIsRecording(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const processRecording = async () => {
    if (!audioBlob || !uid) return;
    setIsProcessing(true);
    try {
      // Upload to Firebase Storage
      const filename = `recordings/${uid}/${Date.now()}.webm`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, audioBlob);
      const audioUrl = await getDownloadURL(storageRef);

      // Transcribe using Gemini multimodal
      const transcriptText = await transcribeAudio(audioBlob, uid, userApiKey);
      setTranscription(transcriptText);

      // Full AI analysis
      const prompt = `Analyze this voice recording transcription comprehensively:

Transcription: "${transcriptText}"

Extract ALL of the following:
1. A clean summary (2-3 sentences)
2. Meeting title suggestion
3. Action items with assignees and deadlines
4. Dates/appointments mentioned with confidence scores
5. Decisions made
6. Promises made (by whom, to whom)
7. People mentioned
8. Tags
9. Calendar events to create (title, suggested date/time, attendees)
10. Follow-up actions to track ("I'll send the contract tomorrow", etc.)
11. Expense mentions ("the hotel cost £320", "we spent $50 on lunch")
12. Contact info detected (new phone numbers, email addresses)`;

      const schema = {
        type: "object",
        properties: {
          ai_summary: { type: "string" },
          suggested_title: { type: "string" },
          meeting_date: { type: "string" },
          attendees: { type: "array", items: { type: "string" } },
          decisions: { type: "array", items: { type: "string" } },
          extracted_actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string" },
                due_date: { type: "string" },
                assignee: { type: "string" },
                priority: { type: "string" },
                status: { type: "string" }
              }
            }
          },
          detected_dates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string" },
                context: { type: "string" },
                confidence: { type: "number" }
              }
            }
          },
          detected_decisions: { type: "array", items: { type: "string" } },
          detected_promises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                promise: { type: "string" },
                by_whom: { type: "string" },
                to_whom: { type: "string" }
              }
            }
          },
          related_people: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          calendar_events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                date: { type: "string" },
                attendees: { type: "array", items: { type: "string" } }
              }
            }
          },
          follow_up_actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                expected_by: { type: "string" }
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
          new_contacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                phone: { type: "string" },
                email: { type: "string" }
              }
            }
          }
        }
      };

      const analysis = await invokeGemini(prompt, schema, uid, userApiKey);
      setAiResult(analysis);
      if (!title && analysis.suggested_title) setTitle(analysis.suggested_title);

      // Save the recording
      const rec = await recordingsService.create(uid, {
        title: title || analysis.suggested_title || "Recording",
        audio_url: audioUrl,
        duration_seconds: duration,
        transcription: transcriptText,
        ai_summary: analysis.ai_summary,
        extracted_actions: analysis.extracted_actions,
        detected_dates: analysis.detected_dates,
        detected_decisions: analysis.detected_decisions,
        detected_promises: analysis.detected_promises,
        related_people: analysis.related_people,
        tags: analysis.tags,
        status: "completed",
      });
      setSavedRecordingId(rec?.id);
      queryClient.invalidateQueries({ queryKey: ["recordings", uid] });

      if (prefs.autoScan) {
        // Auto-save everything without confirmation cards
        if (analysis.calendar_events?.length) {
          for (const ev of analysis.calendar_events)
            await calendarEventsService.create(uid, { title: ev.title, date: ev.date, attendees: ev.attendees || [], linkedSummaryId: rec?.id || null }).catch(() => {});
          toast.success(`${analysis.calendar_events.length} calendar event(s) saved`);
        }
        if (analysis.follow_up_actions?.length) {
          for (const fu of analysis.follow_up_actions)
            await followUpsService.create(uid, { description: fu.description, expectedBy: fu.expected_by || null, resolved: false, linkedSummaryId: rec?.id || null }).catch(() => {});
          toast.success(`${analysis.follow_up_actions.length} follow-up(s) saved`);
        }
        if (analysis.expenses?.length) {
          for (const exp of analysis.expenses)
            await expensesService.create(uid, { description: exp.description, amount: exp.amount, currency: exp.currency || "GBP", linkedSummaryId: rec?.id || null }).catch(() => {});
          toast.success(`${analysis.expenses.length} expense(s) saved`);
        }
        if (analysis.new_contacts?.length) {
          for (const c of analysis.new_contacts)
            await contactsService.create(uid, { name: c.name, phone: c.phone || "", email: c.email || "" }).catch(() => {});
          toast.success(`${analysis.new_contacts.length} contact(s) saved`);
        }
        if (analysis.extracted_actions?.length) {
          for (const action of analysis.extracted_actions)
            await tasksService.create(uid, { title: action.action, description: "", status: "pending", priority: action.priority || "medium", due_date: action.due_date || null, linkedSummaryId: rec?.id || null }).catch(() => {});
          toast.success(`${analysis.extracted_actions.length} task(s) saved`);
        }
        if (analysis.ai_summary) {
          await meetingSummariesService.create(uid, {
            title: analysis.suggested_title || title || "Meeting",
            date: analysis.meeting_date || new Date().toISOString(),
            attendees: analysis.attendees || analysis.related_people || [],
            decisions: analysis.detected_decisions || [],
            followUpActions: (analysis.follow_up_actions || []).map((f) => f.description),
            summary: analysis.ai_summary,
          }).catch(() => {});
        }
      } else {
        if (analysis.calendar_events?.length) setPendingCalendar(analysis.calendar_events);
        if (analysis.follow_up_actions?.length) setPendingFollowUps(analysis.follow_up_actions);
        if (analysis.expenses?.length) setPendingExpenses(analysis.expenses);
        if (analysis.new_contacts?.length) setPendingContacts(analysis.new_contacts);
        if (analysis.extracted_actions?.length) setPendingTasks(analysis.extracted_actions);
      }

      if (!prefs.autoScan) {
        setPendingSummary({
          title: analysis.suggested_title || title || "Meeting",
          date: analysis.meeting_date || new Date().toISOString(),
          attendees: analysis.attendees || analysis.related_people || [],
          decisions: analysis.detected_decisions || [],
          followUpActions: (analysis.follow_up_actions || []).map(f => f.description),
          summary: analysis.ai_summary || "",
        });
      }

      const calEvents = await extractAndSaveCalendarEvents(transcriptText, "recording", rec?.id || "pending", uid, userApiKey);
      if (calEvents.length > 0) toast.success(`${calEvents.length} calendar event${calEvents.length > 1 ? "s" : ""} detected!`);

    } catch (err) {
      console.error('Recording processing error:', err);
      toast.error(`Failed to process recording: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const acceptCalendar = async () => {
    if (!uid || !pendingCalendar) return;
    setSavingCalendar(true);
    for (const ev of pendingCalendar) {
      await calendarEventsService.create(uid, {
        title: ev.title, date: ev.date,
        attendees: ev.attendees || [],
        linkedSummaryId: savedRecordingId || null,
      }).catch(() => {});
    }
    toast.success(`${pendingCalendar.length} calendar event${pendingCalendar.length > 1 ? "s" : ""} saved!`);
    setPendingCalendar(null);
    setSavingCalendar(false);
  };

  const acceptFollowUps = async () => {
    if (!uid || !pendingFollowUps) return;
    setSavingFollowUps(true);
    for (const fu of pendingFollowUps) {
      await followUpsService.create(uid, {
        description: fu.description,
        expectedBy: fu.expected_by || null,
        resolved: false,
        linkedSummaryId: savedRecordingId || null,
      }).catch(() => {});
    }
    toast.success(`${pendingFollowUps.length} follow-up${pendingFollowUps.length > 1 ? "s" : ""} saved!`);
    setPendingFollowUps(null);
    setSavingFollowUps(false);
  };

  const acceptExpenses = async () => {
    if (!uid || !pendingExpenses) return;
    setSavingExpenses(true);
    for (const exp of pendingExpenses) {
      await expensesService.create(uid, {
        description: exp.description,
        amount: exp.amount,
        currency: exp.currency || "GBP",
        linkedSummaryId: savedRecordingId || null,
      }).catch(() => {});
    }
    toast.success(`${pendingExpenses.length} expense${pendingExpenses.length > 1 ? "s" : ""} saved!`);
    setPendingExpenses(null);
    setSavingExpenses(false);
  };

  const acceptContacts = async () => {
    if (!uid || !pendingContacts) return;
    setSavingContacts(true);
    for (const c of pendingContacts) {
      await contactsService.create(uid, {
        name: c.name, phone: c.phone || "", email: c.email || "",
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
    toast.success(`${pendingContacts.length} contact${pendingContacts.length > 1 ? "s" : ""} saved!`);
    setPendingContacts(null);
    setSavingContacts(false);
  };

  const acceptTasks = async () => {
    if (!uid || !pendingTasks) return;
    setSavingTasks(true);
    for (const action of pendingTasks) {
      await tasksService.create(uid, {
        title: action.action,
        description: "",
        status: "pending",
        priority: action.priority || "medium",
        due_date: action.due_date || null,
        linkedSummaryId: savedRecordingId || null,
      }).catch(() => {});
    }
    toast.success(`${pendingTasks.length} task${pendingTasks.length > 1 ? "s" : ""} saved!`);
    setPendingTasks(null);
    setSavingTasks(false);
  };

  const acceptSummary = async () => {
    if (!uid || !pendingSummary) return;
    setSavingSummary(true);
    await meetingSummariesService.create(uid, pendingSummary).catch(() => {});
    toast.success("Meeting summary saved!");
    setPendingSummary(null);
    setSavingSummary(false);
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate("/recordings")} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />Back
        </button>
      </div>

      <Input value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Recording title..."
        className="border-0 text-xl font-heading font-semibold px-0 mb-8 focus-visible:ring-0 bg-transparent" />

      <div className="flex flex-col items-center py-8">
        <div className="flex items-center gap-1 h-16 mb-6">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div key={i} className={`w-1 rounded-full ${isRecording ? "bg-success" : "bg-muted-foreground/20"}`}
              animate={isRecording ? { height: [8, Math.random() * 50 + 10, 8] } : { height: 8 }}
              transition={{ duration: 0.8 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.05 }} />
          ))}
        </div>

        <p className="text-4xl font-display font-bold mb-8 tabular-nums">{formatTime(duration)}</p>

        <div className="flex items-center gap-6">
          {!isRecording && !audioBlob && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={startRecording}
              className="w-20 h-20 rounded-full bg-success flex items-center justify-center shadow-lg"
              style={{ boxShadow: "0 0 30px rgba(16, 185, 129, 0.3)" }}>
              <Mic className="w-8 h-8 text-white" />
            </motion.button>
          )}
          {isRecording && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-destructive flex items-center justify-center shadow-lg">
              <Square className="w-6 h-6 text-white" />
            </motion.button>
          )}
          {audioBlob && !isRecording && !aiResult && (
            <Button onClick={processRecording} disabled={isProcessing}
              className="rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground gap-2 px-6 py-6">
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {isProcessing ? "Analyzing..." : "Analyze Recording"}
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {aiResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
            {aiResult.ai_summary && (
              <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="text-xs font-heading font-semibold text-accent">AI Summary</span>
                </div>
                <p className="text-sm">{aiResult.ai_summary}</p>
              </div>
            )}

            {transcription && (
              <div className="p-4 rounded-2xl bg-muted/50">
                <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transcription</h4>
                <p className="text-sm leading-relaxed line-clamp-6">{transcription}</p>
              </div>
            )}

            {pendingSummary && (
              <ConfirmCard icon={BookOpen} colorClass="text-accent" title="Save Meeting Summary?"
                onAccept={acceptSummary} onDismiss={() => setPendingSummary(null)} loading={savingSummary}>
                <p className="text-sm text-muted-foreground line-clamp-2">{pendingSummary.summary}</p>
                {pendingSummary.decisions?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{pendingSummary.decisions.length} decision{pendingSummary.decisions.length > 1 ? "s" : ""} detected</p>
                )}
              </ConfirmCard>
            )}

            {pendingCalendar && (
              <ConfirmCard icon={CalendarDays} colorClass="text-green-400" title={`Create ${pendingCalendar.length} Calendar Event${pendingCalendar.length > 1 ? "s" : ""}?`}
                onAccept={acceptCalendar} onDismiss={() => setPendingCalendar(null)} loading={savingCalendar}>
                {pendingCalendar.map((ev, i) => (
                  <div key={i} className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <CalendarDays className="w-3 h-3 shrink-0" />
                    <span className="truncate">{ev.title}</span>
                    {ev.date && <span className="text-xs shrink-0">{ev.date}</span>}
                  </div>
                ))}
              </ConfirmCard>
            )}

            {pendingFollowUps && (
              <ConfirmCard icon={ClipboardList} colorClass="text-amber-400" title={`Track ${pendingFollowUps.length} Follow-Up${pendingFollowUps.length > 1 ? "s" : ""}?`}
                onAccept={acceptFollowUps} onDismiss={() => setPendingFollowUps(null)} loading={savingFollowUps}>
                {pendingFollowUps.map((fu, i) => (
                  <p key={i} className="text-sm text-muted-foreground mt-1 line-clamp-1">• {fu.description}</p>
                ))}
              </ConfirmCard>
            )}

            {pendingExpenses && (
              <ConfirmCard icon={DollarSign} colorClass="text-rose-400" title={`Log ${pendingExpenses.length} Expense${pendingExpenses.length > 1 ? "s" : ""}?`}
                onAccept={acceptExpenses} onDismiss={() => setPendingExpenses(null)} loading={savingExpenses}>
                {pendingExpenses.map((exp, i) => (
                  <p key={i} className="text-sm text-muted-foreground mt-1">• {exp.description} — {exp.currency || "£"}{exp.amount}</p>
                ))}
              </ConfirmCard>
            )}

            {pendingContacts && (
              <ConfirmCard icon={UserPlus} colorClass="text-purple-400" title={`Save ${pendingContacts.length} Contact${pendingContacts.length > 1 ? "s" : ""}?`}
                onAccept={acceptContacts} onDismiss={() => setPendingContacts(null)} loading={savingContacts}>
                {pendingContacts.map((c, i) => (
                  <p key={i} className="text-sm text-muted-foreground mt-1">• {c.name}{c.phone ? ` · ${c.phone}` : ""}{c.email ? ` · ${c.email}` : ""}</p>
                ))}
              </ConfirmCard>
            )}

            {pendingTasks && (
              <ConfirmCard icon={CheckCircle2} colorClass="text-accent" title={`Save ${pendingTasks.length} Task${pendingTasks.length > 1 ? "s" : ""}?`}
                onAccept={acceptTasks} onDismiss={() => setPendingTasks(null)} loading={savingTasks}>
                {pendingTasks.map((t, i) => (
                  <p key={i} className="text-sm text-muted-foreground mt-1">• {t.action}{t.due_date ? ` (due ${t.due_date})` : ""}</p>
                ))}
              </ConfirmCard>
            )}

            {aiResult.extracted_actions?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">Action Items</h4>
                {aiResult.extracted_actions.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                    <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-sm flex-1">{action.action}</span>
                    {action.assignee && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Users className="w-2.5 h-2.5 mr-0.5" />{action.assignee}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}

            {aiResult.detected_dates?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">Detected Dates</h4>
                {aiResult.detected_dates.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-success/5 border border-success/10">
                    <CalendarDays className="w-4 h-4 text-success shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm">{d.context}</span>
                      <span className="text-xs text-muted-foreground ml-2">{d.date}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{Math.round((d.confidence || 0) * 100)}%</span>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={() => navigate("/recordings")}
              className="w-full rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground">
              Done
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
