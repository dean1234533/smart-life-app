import { useState, useEffect } from "react";
import { X, Share, MoreVertical, Plus, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DISMISSED_KEY = "install_banner_dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState(null); // 'ios' | 'android' | 'desktop'
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Already installed or user already dismissed — don't show
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (isIOS()) setPlatform("ios");
    else if (isAndroid()) setPlatform("android");
    else setPlatform("desktop");

    setShow(true);

    // Android native install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") dismiss();
    else setInstalling(false);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="mx-4 mt-3 mb-1 rounded-2xl border border-accent/30 bg-accent/5 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-heading font-semibold">Add to your home screen</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Install the app for the best experience
            </p>
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground shrink-0 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions */}
        <div className="px-4 pb-4 space-y-2">
          {/* Android with native prompt */}
          {platform === "android" && deferredPrompt && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              {installing ? "Installing…" : "Install App"}
            </button>
          )}

          {/* Android without native prompt (already added or manual) */}
          {platform === "android" && !deferredPrompt && (
            <div className="space-y-2">
              <Step n={1} text={<>Open this page in <strong>Chrome</strong></>} />
              <Step n={2} text={<>Tap the <strong>3-dot menu</strong> <InlineIcon><MoreVertical className="w-3 h-3" /></InlineIcon> at the top right</>} />
              <Step n={3} text={<>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></>} />
            </div>
          )}

          {/* iOS */}
          {platform === "ios" && (
            <div className="space-y-2">
              <Step n={1} text={<>Open this page in <strong>Safari</strong> (must be Safari)</>} />
              <Step n={2} text={<>Tap the <strong>Share</strong> button <InlineIcon><Share className="w-3 h-3" /></InlineIcon> at the bottom of the screen</>} />
              <Step n={3} text={<>Scroll down and tap <strong>"Add to Home Screen"</strong> <InlineIcon><Plus className="w-3 h-3" /></InlineIcon></>} />
              <Step n={4} text={<>Tap <strong>Add</strong> — it will appear on your home screen like a real app</>} />
            </div>
          )}

          {/* Desktop */}
          {platform === "desktop" && (
            <div className="space-y-2">
              <Step n={1} text={<>Open this page in <strong>Chrome</strong> or <strong>Edge</strong></>} />
              <Step n={2} text={<>Look for the <strong>install icon</strong> in the address bar (right side)</>} />
              <Step n={3} text={<>Click it and select <strong>"Install"</strong></>} />
            </div>
          )}

          <p className="text-[10px] text-muted-foreground pt-1">
            Once installed: runs full-screen, works offline, and you'll get booking &amp; task notifications.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Step({ n, text }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <p className="text-sm text-muted-foreground leading-snug">{text}</p>
    </div>
  );
}

function InlineIcon({ children }) {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-muted mx-0.5 align-middle">
      {children}
    </span>
  );
}
