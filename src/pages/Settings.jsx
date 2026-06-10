import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Key, Loader2, Eye, EyeOff, Check,
  LogOut, ArrowLeft, Shield, Bell, Calendar, ExternalLink, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { updateUserDoc } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { useUserPrefs } from "@/hooks/useUserPrefs";

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
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-display font-bold">Settings</h1>
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

        <section className="p-4 rounded-2xl bg-card border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-heading font-semibold">Calendar Booking</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Manage booking links, global rules, and calendar connections.</p>
          <Button size="sm" variant="outline" onClick={() => navigate("/booking-links")}
            className="w-full rounded-xl border-accent/30 hover:bg-accent/5">
            Open Booking Links →
          </Button>
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
      </div>
    </div>
  );
}
