import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cast, Monitor, Maximize2, Minimize2, Copy, CheckCheck,
  Loader2, Wifi, WifiOff, AlertCircle, ArrowLeft, X, Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  generateRoomCode, startSender, startReceiver, captureScreen,
} from '@/services/mirrorService';

const APP_URL = 'https://smart-life-app.pages.dev';

// ── Sender (phone / source device) ───────────────────────────────────────────
function SenderView() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('idle'); // idle | requesting | casting | error
  const [roomCode, setRoomCode] = useState('');
  const [connState, setConnState] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const cleanupRef = useRef(null);
  const previewRef = useRef(null);

  const receiverUrl = `${APP_URL}/mirror?room=${roomCode}`;

  const handleConnState = useCallback((state) => {
    setConnState(state);
    if (state === 'connected') toast.success('TV connected! Mirroring started.');
    if (state === 'disconnected') { toast.info('TV disconnected'); setConnState('disconnected'); }
  }, []);

  const startCast = async () => {
    setPhase('requesting');
    setError('');
    try {
      const stream = await captureScreen();
      const code = generateRoomCode();
      setRoomCode(code);
      setPhase('casting');

      const { cleanup } = await startSender(code, stream, handleConnState);
      cleanupRef.current = cleanup;

      // Show preview
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        previewRef.current.play().catch(() => {});
      }

      // Stop cast if user closes the stream from browser UI
      stream.getVideoTracks()[0].onended = () => stopCast();
    } catch (e) {
      setPhase(e.name === 'NotAllowedError' ? 'idle' : 'error');
      if (e.name !== 'NotAllowedError') setError(e.message);
    }
  };

  const stopCast = useCallback(async () => {
    if (cleanupRef.current) { await cleanupRef.current(); cleanupRef.current = null; }
    if (previewRef.current) previewRef.current.srcObject = null;
    setPhase('idle');
    setRoomCode('');
    setConnState('');
  }, []);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(receiverUrl); } catch {
      const el = Object.assign(document.createElement('textarea'), { value: receiverUrl, style: 'position:fixed;left:-9999px' });
      document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const connColor = connState === 'connected' ? 'text-emerald-400' : connState === 'disconnected' ? 'text-red-400' : 'text-amber-400';
  const connLabel = { connected: 'TV connected — mirroring live', disconnected: 'TV disconnected', connecting: 'Waiting for TV to connect...', '': 'Waiting for TV to connect...' }[connState] || connState;

  return (
    <div className="px-4 pt-12 pb-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Cast className="w-5 h-5 text-accent" />
        <h1 className="text-2xl font-display font-bold">Screen Mirror</h1>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-20 h-20 rounded-3xl bg-accent/20 flex items-center justify-center">
                <Cast className="w-10 h-10 text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-1">Cast Your Screen</h2>
                <p className="text-sm text-muted-foreground">
                  Share your phone or laptop screen to any TV, monitor, or device with a browser — no cables needed.
                </p>
              </div>
              <Button onClick={startCast} className="rounded-2xl bg-accent text-accent-foreground px-8 py-3 text-base">
                <Cast className="w-5 h-5 mr-2" />Start Casting
              </Button>
            </div>

            <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">How it works</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2"><span className="text-accent font-bold shrink-0">1.</span>Tap Start Casting and choose what to share (screen, window, or tab)</div>
                <div className="flex items-start gap-2"><span className="text-accent font-bold shrink-0">2.</span>A room code appears — open the shown URL on your TV's browser</div>
                <div className="flex items-start gap-2"><span className="text-accent font-bold shrink-0">3.</span>Your screen streams instantly, peer-to-peer over your WiFi</div>
              </div>
            </div>

            <div className="rounded-2xl bg-muted/30 p-4 space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground/70">Device compatibility</p>
              <p>✅ Android Chrome · Desktop Chrome / Firefox / Edge / Safari</p>
              <p>✅ iOS Safari 15.4+ (tab capture)</p>
              <p>❌ iOS Chrome (use Safari on iPhone/iPad)</p>
              <p className="pt-1">TV receiver: Any browser — Samsung Internet, LG Browser, Silk, Firefox, Chrome</p>
            </div>
          </motion.div>
        )}

        {phase === 'requesting' && (
          <motion.div key="requesting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Choose what to share in the browser dialog…</p>
          </motion.div>
        )}

        {phase === 'casting' && (
          <motion.div key="casting" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-4">
            {/* Connection status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border/40 text-xs ${connColor}`}>
              {connState === 'connected' ? <Wifi className="w-3.5 h-3.5" /> : connState === 'disconnected' ? <WifiOff className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {connLabel}
            </div>

            {/* Room code card */}
            <div className="rounded-2xl bg-card border border-border/50 p-5 space-y-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Room code — type this on your TV</p>
                <p className="text-5xl font-mono font-bold tracking-[0.2em] text-accent">{roomCode}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Or open this URL on your TV's browser:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] bg-muted/50 px-2 py-1.5 rounded-lg break-all text-muted-foreground">
                    {receiverUrl}
                  </code>
                  <button onClick={copyUrl} className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Works on any TV browser: Samsung Internet · LG Browser · Silk · Firefox · Chrome
              </p>
            </div>

            {/* Preview */}
            <div className="rounded-2xl overflow-hidden bg-black aspect-video relative">
              <video ref={previewRef} muted autoPlay playsInline className="w-full h-full object-contain" />
              <div className="absolute top-2 left-2 bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
              </div>
            </div>

            <Button onClick={stopCast} variant="outline" className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10">
              <X className="w-4 h-4 mr-2" />Stop Casting
            </Button>
          </motion.div>
        )}

        {phase === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-2xl bg-destructive/10 border border-destructive/30 p-6 space-y-3 text-center">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
            <p className="text-sm font-medium">Cast failed</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button onClick={() => setPhase('idle')} size="sm" className="rounded-xl">Try again</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Receiver (TV / display side) ─────────────────────────────────────────────
function ReceiverView({ initialRoom }) {
  const [roomInput, setRoomInput] = useState(initialRoom || '');
  const [phase, setPhase] = useState(initialRoom ? 'connecting' : 'enter'); // enter | connecting | live | ended | error
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const videoRef = useRef(null);
  const cleanupRef = useRef(null);
  const containerRef = useRef(null);

  const connect = useCallback(async (code) => {
    setPhase('connecting');
    setError('');
    try {
      const { cleanup } = await startReceiver(
        code.trim().toUpperCase(),
        (stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          setPhase('live');
        },
        (state) => {
          if (state === 'disconnected' || state === 'ended') setPhase('ended');
        }
      );
      cleanupRef.current = cleanup;
    } catch (e) {
      setPhase('error');
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (initialRoom) connect(initialRoom);
    return () => cleanupRef.current?.();
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-black flex flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {phase === 'enter' && (
          <motion.div key="enter" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-5 p-8 text-center">
            <Monitor className="w-12 h-12 text-white/40" />
            <div>
              <h2 className="text-white text-xl font-semibold mb-1">Receive Screen Mirror</h2>
              <p className="text-white/50 text-sm">Enter the room code shown on the casting device</p>
            </div>
            <Input
              value={roomInput}
              onChange={e => setRoomInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && roomInput.length >= 5 && connect(roomInput)}
              placeholder="ROOM CODE"
              className="text-center text-2xl font-mono tracking-widest bg-white/10 border-white/20 text-white placeholder:text-white/30 w-48 h-14 rounded-2xl"
              maxLength={8}
              autoCapitalize="characters"
            />
            <Button onClick={() => connect(roomInput)} disabled={roomInput.length < 5}
              className="rounded-2xl bg-white text-black hover:bg-white/90 px-8">
              Connect
            </Button>
          </motion.div>
        )}

        {phase === 'connecting' && (
          <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 text-white/60">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-sm">Connecting to room {roomInput}…</p>
          </motion.div>
        )}

        {phase === 'live' && (
          <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-screen h-screen object-contain"
            />
            {/* Overlay controls */}
            <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 hover:opacity-100 transition-opacity">
              <button onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 transition-colors">
                {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </div>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white/70 text-[10px] font-medium">MIRROR {roomInput}</span>
            </div>
          </motion.div>
        )}

        {(phase === 'ended' || phase === 'error') && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 p-8 text-center">
            {phase === 'ended'
              ? <><WifiOff className="w-10 h-10 text-white/40" /><p className="text-white text-lg font-medium">Cast ended</p><p className="text-white/50 text-sm">The casting device stopped sharing.</p></>
              : <><AlertCircle className="w-10 h-10 text-red-400" /><p className="text-white text-lg font-medium">Connection failed</p><p className="text-white/50 text-sm max-w-xs">{error}</p></>
            }
            <Button onClick={() => setPhase('enter')} variant="outline"
              className="rounded-2xl border-white/20 text-white hover:bg-white/10">
              Try another code
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page root — decides sender vs receiver ────────────────────────────────────
export default function Mirror() {
  const [searchParams] = useSearchParams();
  const roomParam = searchParams.get('room');

  // If a room code is in the URL, this device is a receiver (TV)
  if (roomParam || searchParams.has('receive')) {
    return <ReceiverView initialRoom={roomParam} />;
  }

  return <SenderView />;
}
