import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Key, Loader2, Eye, EyeOff, Check,
  LogOut, ArrowLeft, Shield, Bell, Calendar, ExternalLink, Sparkles,
  Link2, Link2Off, Download, MessageSquare, Mail, Copy, CheckCheck,
  Cpu, Wifi, ChevronDown, Trash2, FileJson, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { signOut, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { firebaseAuth, firestore } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { updateUserDoc, calendarEventsService, getOrCreateUser } from "@/lib/firestoreService";
import { getChromeAIStatus, testOllamaConnection } from "@/services/geminiService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { useUserPrefs } from "@/hooks/useUserPrefs";
import { connectGoogleCalendar, disconnectGoogleCalendar, checkGoogleCalendarStatus } from "@/services/googleCalendarService";
import { BACKGROUNDS } from "@/components/layout/AnimatedBackground";
import { downloadICS } from "@/services/icalService";

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || "";

export default function Settings() {
  const navigate = useNavigate();
  const uid = useCurrentUid();
  const isAdmin = uid === ADMIN_UID;
  const { prefs, loading, setPref } = useUserPrefs();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [exportingICS, setExportingICS] = useState(false);

  // GDPR
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  // Local AI
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('llama3.2');
  const [ollamaExpanded, setOllamaExpanded] = useState(false);
  const [testingOllama, setTestingOllama] = useState(false);
  const [ollamaResult, setOllamaResult] = useState(null); // { ok, message }
  const [chromeAiStatus, setChromeAiStatus] = useState('checking'); // 'checking'|'readily'|'after-download'|'no'|'unavailable'

  // SMS auto-reply
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioPhone, setTwilioPhone] = useState("");
  const [smsPrompt, setSmsPrompt] = useState("You are a helpful assistant replying to text messages. Keep replies concise and friendly.");
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [smsCopied, setSmsCopied] = useState(false);

  // Email auto-reply
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [resendKey, setResendKey] = useState("");
  const [emailPrompt, setEmailPrompt] = useState("You are a helpful assistant replying to emails. Be polite and concise.");
  const [showResendKey, setShowResendKey] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    checkGoogleCalendarStatus().then(setGoogleConnected);
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar') === 'connected') {
      setGoogleConnected(true);
      toast.success('Google Calendar connected!');
      window.history.replaceState({}, '', '/settings');
    }
    // Load saved local AI settings from localStorage (device-specific)
    try {
      const savedUrl   = localStorage.getItem('local_ai_url')   || '';
      const savedModel = localStorage.getItem('local_ai_model') || 'llama3.2';
      if (savedUrl) setOllamaUrl(savedUrl);
      setOllamaModel(savedModel);
      if (savedUrl) setOllamaExpanded(true);
    } catch {}
    // Check Chrome built-in AI
    getChromeAIStatus().then(setChromeAiStatus).catch(() => setChromeAiStatus('unavailable'));
  }, []);

  useEffect(() => {
    if (!uid) return;
    getOrCreateUser(uid).then((profile) => {
      const sms = profile?.smsIntegration || {};
      if (sms.enabled !== undefined) setSmsEnabled(sms.enabled);
      if (sms.accountSid) setTwilioSid(sms.accountSid);
      if (sms.authToken) setTwilioToken(sms.authToken);
      if (sms.fromPhone) setTwilioPhone(sms.fromPhone);
      if (sms.systemPrompt) setSmsPrompt(sms.systemPrompt);
      const email = profile?.emailIntegration || {};
      if (email.enabled !== undefined) setEmailEnabled(email.enabled);
      if (email.resendApiKey) setResendKey(email.resendApiKey);
      if (email.systemPrompt) setEmailPrompt(email.systemPrompt);
    }).catch(() => {});
  }, [uid]);

  const saveApiKey = async () => {
    if (!uid || !apiKey.trim()) return;
    setSavingKey(true);
    try {
      await updateUserDoc(uid, { apiKey: apiKey.trim() });
      toast.success("API key saved");
    } catch {
      toast.error("Failed to save API key");
    } finally {
      setSavingKey(false);
    }
  };

  const toggleAutoScan = async (val) => {
    await setPref('autoScan', val);
    toast.success(val ? "Auto-scan enabled" : "Auto-scan disabled");
  };

  const handleConnectGoogle = async () => {
    if (!import.meta.env.VITE_CALENDAR_WORKER_URL) {
      toast.error("Calendar worker not configured — add VITE_CALENDAR_WORKER_URL to your env");
      return;
    }
    setConnectingGoogle(true);
    try {
      await connectGoogleCalendar(); // redirects browser — page will reload
    } catch (err) {
      toast.error(`Failed to connect: ${err.message}`);
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    await disconnectGoogleCalendar();
    setGoogleConnected(false);
    toast.success("Google Calendar disconnected");
  };

  const handleExportICS = async () => {
    if (!uid) return;
    setExportingICS(true);
    try {
      const events = await calendarEventsService.list(uid, { max: 500 });
      if (!events.length) { toast.error("No events to export"); return; }
      downloadICS(events, 'smart-life.ics');
      toast.success(`Exported ${events.length} events`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExportingICS(false);
    }
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("Notifications not supported in this browser");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      toast.success("Notifications enabled!");
    } else {
      toast.error("Notification permission denied");
    }
  };

  const saveSmsSettings = async () => {
    if (!uid) return;
    setSavingSms(true);
    const config = { enabled: smsEnabled, accountSid: twilioSid, authToken: twilioToken, fromPhone: twilioPhone, systemPrompt: smsPrompt };
    try {
      await updateUserDoc(uid, { smsIntegration: config });
      const workerUrl = import.meta.env.VITE_SMS_WORKER_URL;
      if (workerUrl) {
        const token = await firebaseAuth.currentUser?.getIdToken();
        const res = await fetch(`${workerUrl}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...config, geminiKey: '' }),
        });
        if (!res.ok) throw new Error('Worker registration failed');
      }
      toast.success('SMS settings saved');
    } catch (e) {
      toast.error(e.message || 'Failed to save SMS settings');
    } finally {
      setSavingSms(false);
    }
  };

  const saveEmailSettings = async () => {
    if (!uid) return;
    setSavingEmail(true);
    const config = { enabled: emailEnabled, resendApiKey: resendKey, systemPrompt: emailPrompt };
    try {
      await updateUserDoc(uid, { emailIntegration: config });
      const workerUrl = import.meta.env.VITE_EMAIL_WORKER_URL;
      if (workerUrl) {
        const token = await firebaseAuth.currentUser?.getIdToken();
        const res = await fetch(`${workerUrl}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...config, geminiKey: '' }),
        });
        if (!res.ok) throw new Error('Worker registration failed');
      }
      toast.success('Email settings saved');
    } catch (e) {
      toast.error(e.message || 'Failed to save email settings');
    } finally {
      setSavingEmail(false);
    }
  };

  const copyWebhookUrl = async (url, setCopied) => {
    try { await navigator.clipboard.writeText(url); } catch {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveLocalAI = () => {
    try {
      if (ollamaUrl.trim()) {
        localStorage.setItem('local_ai_url', ollamaUrl.trim());
        localStorage.setItem('local_ai_model', ollamaModel.trim() || 'llama3.2');
        toast.success('Local AI saved — it will be used before any cloud API');
      } else {
        localStorage.removeItem('local_ai_url');
        localStorage.removeItem('local_ai_model');
        toast.success('Local AI cleared');
      }
    } catch {
      toast.error('Failed to save — storage might be blocked');
    }
  };

  const handleTestOllama = async () => {
    if (!ollamaUrl.trim()) return;
    setTestingOllama(true);
    setOllamaResult(null);
    try {
      const { models, found } = await testOllamaConnection(ollamaUrl.trim(), ollamaModel.trim());
      if (found) {
        setOllamaResult({ ok: true, message: `Connected. Model "${ollamaModel}" is ready.` });
      } else {
        setOllamaResult({ ok: true, message: `Connected. Available models: ${models.slice(0, 5).join(', ') || 'none yet'}.` });
      }
    } catch (e) {
      setOllamaResult({ ok: false, message: e.message || 'Could not reach Ollama' });
    } finally {
      setTestingOllama(false);
    }
  };

  const handleExportData = async () => {
    if (!uid) return;
    setExportingData(true);
    try {
      const profile = await getOrCreateUser(uid);
      const SUBCOLLECTIONS = [
        'notes', 'tasks', 'calendarEvents', 'recordings', 'contacts',
        'expenses', 'recipes', 'shoppingLists', 'meetingSummaries', 'followUps',
        'bookingLinks', 'bookings', 'availability', 'memories', 'timelineEvents',
        'chatHistory', 'workouts', 'nutrition',
      ];
      const data = { profile, collections: {} };
      await Promise.all(
        SUBCOLLECTIONS.map(async (col) => {
          const snap = await getDocs(collection(firestore, 'users', uid, col));
          data.collections[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        })
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-life-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Your data has been exported');
    } catch (e) {
      toast.error(`Export failed: ${e.message}`);
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!uid || deleteConfirm !== 'DELETE') return;
    setDeletingAccount(true);
    try {
      // Delete all Firestore subcollections
      const SUBCOLLECTIONS = [
        'notes', 'tasks', 'calendarEvents', 'recordings', 'contacts',
        'expenses', 'recipes', 'shoppingLists', 'meetingSummaries', 'followUps',
        'bookingLinks', 'bookings', 'availability', 'memories', 'timelineEvents',
        'chatHistory', 'workouts', 'nutrition', 'rawTranscriptions',
        'aiProcessingLogs', 'dismissedActions', 'suggestedItems', 'mapSessions',
      ];
      await Promise.all(
        SUBCOLLECTIONS.map(async (col) => {
          const snap = await getDocs(collection(firestore, 'users', uid, col));
          await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        })
      );
      // Delete top-level user doc
      await deleteDoc(doc(firestore, 'users', uid));
      // Delete Firebase Auth account
      const user = firebaseAuth.currentUser;
      if (user) await deleteUser(user);
      // Clear localStorage
      localStorage.clear();
      toast.success('Account deleted. Goodbye.');
      navigate('/login');
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        toast.error('Please sign out and sign back in, then try deleting your account again.');
      } else {
        toast.error(`Delete failed: ${e.message}`);
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(firebaseAuth);
      navigate("/login");
    } catch {
      toast.error("Sign out failed");
    }
  };

  if (loading) {
    return (
      <div className="px-4 pt-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-display font-bold">Settings</h1>
        </div>
        <button onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 transition-colors">
          <LogOut className="w-4 h-4" />Sign out
        </button>
      </div>

      <div className="space-y-5">
        <section className="p-4 rounded-2xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold">Gemini API Key</h2>
            {isAdmin && (
              <span className="ml-auto text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full">Admin — using shared keys</span>
            )}
          </div>

          {isAdmin ? (
            <p className="text-xs text-muted-foreground">
              As admin, your requests use shared API keys with automatic fallback. No personal key needed.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Your API key is stored securely and only used for your AI requests.
              </p>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="pr-10 rounded-xl"
                />
                <button onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button onClick={saveApiKey} disabled={!apiKey.trim() || savingKey}
                size="sm" className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
                {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1.5" />Save Key</>}
              </Button>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent">
                <ExternalLink className="w-3 h-3" />Get a free key at Google AI Studio
              </a>
            </>
          )}
        </section>

        <section className="p-4 rounded-2xl bg-card border border-border/50 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold">AI Auto-Scan</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            When enabled, AI automatically scans every note and recording you save — extracting shopping lists, tasks, calendar events, expenses, and contacts without needing to tap "Analyze".
          </p>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm">Auto-scan notes & recordings</span>
              <p className="text-xs text-muted-foreground">{prefs.autoScan ? "On — saves everything automatically" : "Off — manual analysis only"}</p>
            </div>
            <Switch checked={prefs.autoScan} onCheckedChange={toggleAutoScan} />
          </div>
        </section>

        {/* Local AI */}
        <section className="p-4 rounded-2xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold">Local AI</h2>
            <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Free · No credits</span>
          </div>
          <p className="text-xs text-muted-foreground">
            When available, the app automatically uses AI running on your own device — no internet credits needed. It checks every time you open the app.
          </p>

          {/* Chrome built-in AI status */}
          <div className="rounded-xl bg-muted/30 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm">C</span>
              </div>
              <div>
                <p className="text-sm font-medium">Chrome AI</p>
                <p className="text-xs text-muted-foreground">Built into Chrome on your device</p>
              </div>
            </div>
            {chromeAiStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
            {chromeAiStatus === 'readily' && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                <Check className="w-3 h-3" />Active
              </span>
            )}
            {(chromeAiStatus === 'after-download' || chromeAiStatus === 'no' || chromeAiStatus === 'unavailable') && (
              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">Not available</span>
            )}
          </div>

          {/* Ollama auto-detect status */}
          <div className="rounded-xl bg-muted/30 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <Wifi className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Ollama</p>
                <p className="text-xs text-muted-foreground">
                  {ollamaUrl ? `Detected at ${ollamaUrl}` : 'Not detected on this device'}
                </p>
              </div>
            </div>
            {ollamaUrl
              ? <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"><Check className="w-3 h-3" />Active</span>
              : <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">Not running</span>
            }
          </div>

          {/* Manual override — collapsed by default */}
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <button
              onClick={() => setOllamaExpanded(!ollamaExpanded)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <span>Manual setup (advanced)</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${ollamaExpanded ? 'rotate-180' : ''}`} />
            </button>
            {ollamaExpanded && (
              <div className="border-t border-border/50 p-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Install <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Ollama</a> on your computer, start it, and the app will detect it automatically next time. Or enter a custom address below.
                </p>
                <Input
                  placeholder="Custom address (e.g. http://192.168.1.5:11434)"
                  value={ollamaUrl}
                  onChange={e => { setOllamaUrl(e.target.value); setOllamaResult(null); }}
                  className="rounded-xl text-sm"
                />
                <Input
                  placeholder="Model (e.g. llama3.2)"
                  value={ollamaModel}
                  onChange={e => { setOllamaModel(e.target.value); setOllamaResult(null); }}
                  className="rounded-xl text-sm"
                />
                {ollamaResult && (
                  <p className={`text-xs px-2 py-1.5 rounded-lg ${ollamaResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
                    {ollamaResult.message}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleTestOllama}
                    disabled={!ollamaUrl.trim() || testingOllama} className="rounded-xl flex-1">
                    {testingOllama ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
                  </Button>
                  <Button size="sm" onClick={saveLocalAI}
                    className="rounded-xl flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
                    <Check className="w-3.5 h-3.5 mr-1.5" />Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="p-4 rounded-2xl bg-card border border-border/50 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold">App Background</h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {BACKGROUNDS.map((bg) => (
              <button key={bg.id} onClick={() => setPref('background', bg.id)}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${prefs.background === bg.id ? 'border-accent scale-105' : 'border-border/50 hover:border-accent/50'}`}>
                <div className="absolute inset-0" style={{ background: bg.preview || '#0d1520' }} />
                <div className="absolute inset-0 flex items-end justify-center pb-1">
                  <span className="text-[9px] font-medium text-white/80">{bg.label}</span>
                </div>
                {prefs.background === bg.id && (
                  <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-accent flex items-center justify-center">
                    <Check className="w-2 h-2 text-accent-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="p-4 rounded-2xl bg-card border border-border/50 space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold">Push Notifications</h2>
          </div>
          <p className="text-xs text-muted-foreground">Get notified when a new booking is made.</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Booking notifications</span>
            <Switch checked={notificationsEnabled} onCheckedChange={() => requestNotifications()} />
          </div>
        </section>

        <section className="p-4 rounded-2xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold">Connected Calendars</h2>
          </div>

          {/* Google Calendar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Google Calendar</p>
                <p className="text-xs text-muted-foreground">{googleConnected ? "Connected — events sync automatically" : "Read & write your Google Calendar"}</p>
              </div>
            </div>
            {googleConnected ? (
              <Button size="sm" variant="outline" onClick={handleDisconnectGoogle}
                className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5 shrink-0">
                <Link2Off className="w-3.5 h-3.5" />Disconnect
              </Button>
            ) : (
              <Button size="sm" onClick={handleConnectGoogle} disabled={connectingGoogle}
                className="rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 shrink-0">
                {connectingGoogle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                Connect
              </Button>
            )}
          </div>

          {/* Apple Calendar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="black">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Apple Calendar</p>
                <p className="text-xs text-muted-foreground">Export events as .ics to import into Apple Calendar</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={handleExportICS} disabled={exportingICS}
              className="rounded-xl border-accent/30 hover:bg-accent/5 gap-1.5 shrink-0">
              {exportingICS ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export
            </Button>
          </div>

          <div className="pt-1 border-t border-border/50">
            <Button size="sm" variant="ghost" onClick={() => navigate("/booking-links")}
              className="w-full rounded-xl text-muted-foreground hover:text-foreground text-xs">
              Manage booking links →
            </Button>
          </div>
        </section>

        {/* SMS Auto-Reply */}
        <section className="p-4 rounded-2xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold">SMS Auto-Reply</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Automatically reply to incoming texts using AI. Requires a Twilio phone number.
          </p>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm">Enable SMS auto-reply</span>
              <p className="text-xs text-muted-foreground">{smsEnabled ? "On — replying to all incoming texts" : "Off — no messages will be sent"}</p>
            </div>
            <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
          </div>
          <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-accent hover:underline w-fit">
            <ExternalLink className="w-3 h-3" />No account? Sign up for Twilio (free trial includes a phone number)
          </a>
          <div className="space-y-2">
            <Input placeholder="Account SID (ACxxxxxxxx...)" value={twilioSid} onChange={e => setTwilioSid(e.target.value)} className="rounded-xl text-sm" />
            <div className="relative">
              <Input type={showTwilioToken ? "text" : "password"} placeholder="Auth Token" value={twilioToken} onChange={e => setTwilioToken(e.target.value)} className="pr-10 rounded-xl text-sm" />
              <button onClick={() => setShowTwilioToken(!showTwilioToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showTwilioToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Input placeholder="Your Twilio number (e.g. +12125551234)" value={twilioPhone} onChange={e => setTwilioPhone(e.target.value)} className="rounded-xl text-sm" />
            <textarea
              value={smsPrompt}
              onChange={e => setSmsPrompt(e.target.value)}
              placeholder="AI system prompt for SMS replies..."
              rows={2}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>
          <Button onClick={saveSmsSettings} disabled={savingSms} size="sm" className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
            {savingSms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1.5" />Save SMS Settings</>}
          </Button>
          {uid && import.meta.env.VITE_SMS_WORKER_URL && (
            <div className="space-y-1 pt-1 border-t border-border/50">
              <p className="text-xs text-muted-foreground">Paste this URL into Twilio → Phone Numbers → Messaging → Webhook:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[10px] bg-muted px-2 py-1.5 rounded-lg break-all text-muted-foreground">
                  {import.meta.env.VITE_SMS_WORKER_URL}/webhook/{uid}
                </code>
                <button onClick={() => copyWebhookUrl(`${import.meta.env.VITE_SMS_WORKER_URL}/webhook/${uid}`, setSmsCopied)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  {smsCopied ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Email Auto-Reply */}
        <section className="p-4 rounded-2xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold">Email Auto-Reply</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Automatically reply to incoming emails using AI. Uses Resend for sending — free tier includes 100 emails/day.
          </p>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm">Enable email auto-reply</span>
              <p className="text-xs text-muted-foreground">{emailEnabled ? "On — replying to incoming emails" : "Off — no emails will be sent"}</p>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>
          <a href="https://resend.com/signup" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-accent hover:underline w-fit">
            <ExternalLink className="w-3 h-3" />No account? Sign up for Resend (100 free emails/day)
          </a>
          <div className="space-y-2">
            <div className="relative">
              <Input type={showResendKey ? "text" : "password"} placeholder="Resend API Key (re_...)" value={resendKey} onChange={e => setResendKey(e.target.value)} className="pr-10 rounded-xl text-sm" />
              <button onClick={() => setShowResendKey(!showResendKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showResendKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <textarea
              value={emailPrompt}
              onChange={e => setEmailPrompt(e.target.value)}
              placeholder="AI system prompt for email replies..."
              rows={2}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>
          <Button onClick={saveEmailSettings} disabled={savingEmail} size="sm" className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
            {savingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1.5" />Save Email Settings</>}
          </Button>
          {uid && import.meta.env.VITE_EMAIL_WORKER_URL && (
            <div className="space-y-1 pt-1 border-t border-border/50">
              <p className="text-xs text-muted-foreground">Paste this URL into Resend → Inbound → Webhook URL:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[10px] bg-muted px-2 py-1.5 rounded-lg break-all text-muted-foreground">
                  {import.meta.env.VITE_EMAIL_WORKER_URL}/webhook/{uid}
                </code>
                <button onClick={() => copyWebhookUrl(`${import.meta.env.VITE_EMAIL_WORKER_URL}/webhook/${uid}`, setEmailCopied)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  {emailCopied ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* GDPR — Data & Privacy */}
        <section className="p-4 rounded-2xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold">Data &amp; Privacy</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Under UK GDPR you have the right to access, export, and erase all your data.
          </p>

          {/* Export */}
          <Button
            size="sm" variant="outline"
            onClick={handleExportData} disabled={exportingData}
            className="w-full rounded-xl gap-2"
          >
            {exportingData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
            Export my data (JSON)
          </Button>

          {/* Delete account */}
          {!showDeleteSection ? (
            <Button
              size="sm" variant="ghost"
              onClick={() => setShowDeleteSection(true)}
              className="w-full rounded-xl text-destructive hover:bg-destructive/10 gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />Delete my account
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-destructive/30 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive leading-relaxed">
                  This permanently deletes all your data — notes, tasks, recordings, calendar events, contacts, and more. This cannot be undone.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Type <strong>DELETE</strong> to confirm:</p>
              <Input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="rounded-xl text-sm border-destructive/30 focus:ring-destructive/30"
              />
              <div className="flex gap-2">
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { setShowDeleteSection(false); setDeleteConfirm(''); }}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== 'DELETE' || deletingAccount}
                  className="flex-1 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Delete account'}
                </Button>
              </div>
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="p-4 rounded-2xl bg-card border border-accent/30">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-heading font-semibold">Admin Panel</h2>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin")}
              className="w-full rounded-xl border-accent/30 hover:bg-accent/5">
              Open Admin Panel →
            </Button>
          </section>
        )}

        <section className="p-4 rounded-2xl bg-card border border-border/50">
          <Button variant="ghost" onClick={handleSignOut}
            className="w-full rounded-xl text-destructive hover:bg-destructive/10 gap-2">
            <LogOut className="w-4 h-4" />Sign Out
          </Button>
        </section>

        {/* Legal footer */}
        <div className="flex justify-center gap-4 pb-2 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}
