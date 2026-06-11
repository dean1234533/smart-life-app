import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Key, Loader2, Eye, EyeOff, Check,
  LogOut, ArrowLeft, Shield, Bell, Calendar, ExternalLink, Sparkles,
  Link2, Link2Off, Download,
  Trash2, FileJson, AlertTriangle, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { signOut, deleteUser } from "firebase/auth";
import { firebaseAuth, firestore } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { updateUserDoc, calendarEventsService, getOrCreateUser } from "@/lib/firestoreService";
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

  // Web search
  const [braveKey, setBraveKey] = useState('');
  const [showBraveKey, setShowBraveKey] = useState(false);

  // GDPR
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteSection, setShowDeleteSection] = useState(false);



  useEffect(() => {
    try { const k = localStorage.getItem('brave_search_key'); if (k) setBraveKey(k); } catch {}
    checkGoogleCalendarStatus().then(setGoogleConnected);
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar') === 'connected') {
      setGoogleConnected(true);
      toast.success('Google Calendar connected!');
      window.history.replaceState({}, '', '/settings');
    }
  }, []);


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

        {/* Web Search */}
        <section className="p-4 rounded-2xl bg-card border border-border/50 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold">Web Search</h2>
            <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Optional</span>
          </div>
          <p className="text-xs text-muted-foreground">
            The AI agent can already search the web for free using DuckDuckGo. Add a Brave Search API key for richer, more detailed results.
          </p>
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400">DuckDuckGo search is active — no setup needed</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Brave Search API key (optional — for fuller results):</p>
            <div className="relative">
              <Input
                type={showBraveKey ? "text" : "password"}
                value={braveKey}
                onChange={e => setBraveKey(e.target.value)}
                placeholder="BSA..."
                className="pr-10 rounded-xl text-sm"
              />
              <button onClick={() => setShowBraveKey(!showBraveKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showBraveKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => {
                try {
                  if (braveKey.trim()) { localStorage.setItem('brave_search_key', braveKey.trim()); toast.success('Brave Search key saved'); }
                  else { localStorage.removeItem('brave_search_key'); toast.success('Brave Search key removed'); }
                } catch { toast.error('Could not save key'); }
              }} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
                <Check className="w-3.5 h-3.5 mr-1.5" />Save
              </Button>
              <a href="https://api.search.brave.com/register" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent self-center">
                <ExternalLink className="w-3 h-3" />Get a free key
              </a>
            </div>
          </div>
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
            Export my data
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
