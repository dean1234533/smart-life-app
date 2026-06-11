import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { nanoid } from 'nanoid';
import {
  Tv, Plus, Trash2, Check, X, Wifi, WifiOff,
  Power, Volume2, VolumeX, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  SkipBack, SkipForward, Play, Pause, Square, Info, Home, RotateCcw,
  Settings, Radio, Loader2, ArrowLeft, Cast, Monitor, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  getDevices, saveDevices, getActiveDeviceId, setActiveDeviceId,
  sendKey, testDevice, isProxyRunning, discoverDevices,
  rokuGetApps, rokuLaunchApp,
  STREAMING_SERVICES,
} from '@/services/tvRemoteService';

const DEVICE_TYPES = [
  { id: 'roku',    label: 'Roku',            hint: 'e.g. 192.168.1.42' },
  { id: 'samsung', label: 'Samsung Smart TV', hint: 'e.g. 192.168.1.21' },
  { id: 'lg',      label: 'LG Smart TV',      hint: 'e.g. 192.168.1.33' },
];

// ── Remote button ────────────────────────────────────────────────────────────
function RemoteBtn({ icon: Icon, label, action, onPress, className = '', disabled = false, size = 'md' }) {
  const [pressing, setPressing] = useState(false);
  const handlePress = async () => {
    if (disabled || pressing) return;
    setPressing(true);
    try { await onPress(action); } catch {}
    setTimeout(() => setPressing(false), 150);
  };
  const sz = size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-10 h-10 text-[11px]' : 'w-12 h-12';
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={handlePress}
      disabled={disabled}
      className={`${sz} flex flex-col items-center justify-center gap-0.5 rounded-2xl font-medium transition-all select-none
        ${pressing ? 'bg-accent/30' : 'bg-white/8 hover:bg-white/15 active:bg-accent/20'}
        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
        ${className}`}
      title={label}
    >
      {Icon && <Icon className={size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />}
      {label && !Icon && <span>{label}</span>}
    </motion.button>
  );
}

// ── D-pad ────────────────────────────────────────────────────────────────────
function DPad({ onPress, disabled }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 w-fit mx-auto">
      <div />
      <RemoteBtn icon={ChevronUp}    label="Up"    action="up"    onPress={onPress} disabled={disabled} size="lg" />
      <div />
      <RemoteBtn icon={ChevronLeft}  label="Left"  action="left"  onPress={onPress} disabled={disabled} size="lg" />
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => onPress('ok')}
        disabled={disabled}
        className="w-14 h-14 rounded-full bg-accent/80 hover:bg-accent text-white font-bold text-sm flex items-center justify-center shadow-lg disabled:opacity-30"
      >
        OK
      </motion.button>
      <RemoteBtn icon={ChevronRight} label="Right" action="right" onPress={onPress} disabled={disabled} size="lg" />
      <div />
      <RemoteBtn icon={ChevronDown}  label="Down"  action="down"  onPress={onPress} disabled={disabled} size="lg" />
      <div />
    </div>
  );
}

// ── Number pad ───────────────────────────────────────────────────────────────
function NumPad({ onPress, disabled }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {[1,2,3,4,5,6,7,8,9].map(n => (
        <RemoteBtn key={n} label={String(n)} action={`num${n}`} onPress={onPress} disabled={disabled} size="sm" />
      ))}
      <RemoteBtn label="*"  action="star"  onPress={onPress} disabled={disabled} size="sm" />
      <RemoteBtn label="0"  action="num0"  onPress={onPress} disabled={disabled} size="sm" />
      <RemoteBtn label="#"  action="hash"  onPress={onPress} disabled={disabled} size="sm" />
    </div>
  );
}

export default function Remote() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('streaming');

  // Device state
  const [devices, setDevices] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [helperOk, setHelperOk] = useState(null);
  const [sending, setSending] = useState(false);

  // Auto-discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState([]); // TVs found but not yet saved

  // Device form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('roku');
  const [formIp, setFormIp] = useState('');
  const [testing, setTesting] = useState(false);

  // Roku apps
  const [rokuApps, setRokuApps] = useState([]);

  const activeDevice = devices.find(d => d.id === activeId) || devices[0] || null;

  // Auto-scan when the helper becomes available
  const runDiscovery = useCallback(async () => {
    setDiscovering(true);
    try {
      const found = await discoverDevices();
      // Only show TVs not already saved
      const savedIps = new Set(getDevices().map(d => d.ip));
      setDiscovered(found.filter(d => !savedIps.has(d.ip)));
    } catch {
      // Silently fail — discovery is best-effort
    } finally {
      setDiscovering(false);
    }
  }, []);

  useEffect(() => {
    const devs = getDevices();
    setDevices(devs);
    setActiveId(getActiveDeviceId() || devs[0]?.id || null);
    isProxyRunning().then(ok => {
      setHelperOk(ok);
      if (ok) runDiscovery(); // auto-scan immediately if helper is already running
    });
  }, [runDiscovery]);

  useEffect(() => {
    if (!activeDevice || activeDevice.type !== 'roku' || !helperOk) return;
    rokuGetApps(activeDevice.ip).then(setRokuApps).catch(() => setRokuApps([]));
  }, [activeDevice?.id, helperOk]);

  const handleKey = useCallback(async (key) => {
    if (!activeDevice) {
      toast.error('No TV selected — go to the My TVs tab and add your TV first');
      return;
    }
    if (!helperOk) {
      toast.error('PC Helper not running — see the My TVs tab to get set up');
      return;
    }
    setSending(true);
    try {
      await sendKey(activeDevice, key);
    } catch (e) {
      toast.error('Could not send button press — make sure your TV is on and connected to WiFi');
    } finally {
      setSending(false);
    }
  }, [activeDevice, helperOk]);

  const addDevice = () => {
    if (!formIp.trim()) return;
    const label = DEVICE_TYPES.find(t => t.id === formType)?.label || 'TV';
    const dev = {
      id: nanoid(8),
      name: formName.trim() || `${label}`,
      type: formType,
      ip: formIp.trim(),
    };
    const updated = [...devices, dev];
    setDevices(updated);
    saveDevices(updated);
    if (!activeId) { setActiveId(dev.id); setActiveDeviceId(dev.id); }
    setShowForm(false);
    setFormName(''); setFormIp(''); setFormType('roku');
    toast.success(`${dev.name} added!`);
  };

  // One-tap add from the discovered list
  const addDiscovered = (found) => {
    const label = DEVICE_TYPES.find(t => t.id === found.type)?.label || 'TV';
    const dev = { id: nanoid(8), name: found.name || label, type: found.type, ip: found.ip };
    const updated = [...devices, dev];
    setDevices(updated);
    saveDevices(updated);
    if (!activeId) { setActiveId(dev.id); setActiveDeviceId(dev.id); }
    setDiscovered(prev => prev.filter(d => d.ip !== found.ip));
    toast.success(`${dev.name} added!`);
    setTab('remote');
  };

  const removeDevice = (id) => {
    const updated = devices.filter(d => d.id !== id);
    setDevices(updated);
    saveDevices(updated);
    if (activeId === id) {
      const next = updated[0]?.id || null;
      setActiveId(next);
      setActiveDeviceId(next);
    }
  };

  const selectDevice = (id) => {
    setActiveId(id);
    setActiveDeviceId(id);
  };

  const testConn = async () => {
    if (!formIp.trim()) return;
    setTesting(true);
    try {
      await testDevice({ type: formType, ip: formIp.trim() });
      toast.success('TV found! Tap Save to add it.');
    } catch {
      toast.error('Could not find your TV. Check the IP address and make sure it\'s on the same WiFi.');
    } finally {
      setTesting(false);
    }
  };

  const recheckHelper = async () => {
    setHelperOk(null);
    const ok = await isProxyRunning();
    setHelperOk(ok);
    if (ok) {
      toast.success('Connected! Scanning for your TVs...');
      runDiscovery();
    } else {
      toast.error('PC Helper not detected. Follow the steps below to get started.');
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-12 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Tv className="w-5 h-5 text-accent" />
        <h1 className="text-2xl font-display font-bold flex-1">TV Remote</h1>
        {activeDevice && (
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{activeDevice.name}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 mb-5">
        {[['streaming','Apps & Streaming'],['remote','Remote'],['mytvs','My TVs']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${tab===id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── STREAMING TAB ── */}
      {tab === 'streaming' && (
        <div className="space-y-4">
          {/* Screen mirror shortcut */}
          <Link to="/mirror"
            className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-accent/20 to-accent/5 border border-accent/20 hover:from-accent/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-accent/30 flex items-center justify-center">
              <Cast className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium">Mirror Your Screen</p>
              <p className="text-xs text-muted-foreground">Cast your phone screen to any TV or monitor</p>
            </div>
          </Link>

          <p className="text-xs font-medium text-muted-foreground">Tap to open a streaming app</p>
          <div className="grid grid-cols-4 gap-2">
            {STREAMING_SERVICES.map(svc => (
              <a key={svc.id} href={svc.url} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/8 transition-colors group">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
                  style={{ background: svc.color + '22', border: `1px solid ${svc.color}44` }}>
                  {svc.emoji}
                </div>
                <span className="text-[10px] text-center text-muted-foreground group-hover:text-foreground leading-tight">{svc.name}</span>
              </a>
            ))}
          </div>

          {activeDevice?.type === 'roku' && rokuApps.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <p className="text-xs font-medium text-muted-foreground">Installed on your Roku</p>
              <div className="grid grid-cols-4 gap-2">
                {rokuApps.map(app => (
                  <button key={app.id}
                    onClick={() => rokuLaunchApp(activeDevice.ip, app.id).catch(() => toast.error('Could not open that app'))}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/30 hover:bg-accent/10 transition-colors">
                    <span className="text-[10px] text-center leading-tight">{app.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REMOTE TAB ── */}
      {tab === 'remote' && (
        <div className="space-y-4">
          {/* No devices — show scanning state or nudge */}
          {devices.length === 0 && (
            discovering ? (
              <div className="rounded-2xl bg-accent/5 border border-accent/20 p-5 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-accent mx-auto animate-spin" />
                <p className="text-sm font-medium">Scanning your network for TVs...</p>
                <p className="text-xs text-muted-foreground">This takes about 5 seconds</p>
              </div>
            ) : discovered.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">TVs found on your network — tap to add:</p>
                {discovered.map(d => (
                  <div key={d.ip} className="flex items-center justify-between gap-3 bg-card rounded-xl p-3 border border-border/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Tv className="w-4 h-4 text-accent shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{DEVICE_TYPES.find(t => t.id === d.type)?.label}</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => addDiscovered(d)}
                      className="rounded-xl bg-accent text-accent-foreground shrink-0">
                      <Plus className="w-3.5 h-3.5 mr-1" />Add
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-muted/20 border border-border/40 p-5 text-center space-y-3">
                <Tv className="w-10 h-10 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-sm font-medium mb-1">No TV added yet</p>
                  <p className="text-xs text-muted-foreground">
                    {helperOk
                      ? 'Go to "My TVs" to scan your network and add your TV automatically.'
                      : 'Start the PC Helper first, then your TV will be found automatically.'}
                  </p>
                </div>
                <Button size="sm" onClick={() => setTab('mytvs')} className="rounded-xl bg-accent text-accent-foreground">
                  {helperOk ? <><Wifi className="w-3.5 h-3.5 mr-1.5" />Find my TV</> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Get started</>}
                </Button>
              </div>
            )
          )}

          {/* Device chips */}
          {devices.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {devices.map(d => (
                <button key={d.id} onClick={() => selectDevice(d.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                    activeId === d.id
                      ? 'bg-accent/20 border-accent/40 text-accent'
                      : 'bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground'
                  }`}>
                  {d.name}
                </button>
              ))}
            </div>
          )}

          {/* Connection status */}
          {devices.length > 0 && (
            <button
              onClick={recheckHelper}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm transition-colors ${
                helperOk === null ? 'bg-muted/30 text-muted-foreground'
                : helperOk ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {helperOk === null
                ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                : helperOk
                  ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                  : <AlertCircle className="w-4 h-4 shrink-0" />
              }
              <span className="flex-1 text-left">
                {helperOk === null
                  ? 'Checking connection...'
                  : helperOk
                    ? 'Connected — remote is ready'
                    : 'Not connected yet — tap to retry'
                }
              </span>
              {!helperOk && helperOk !== null && (
                <span onClick={(e) => { e.stopPropagation(); setTab('mytvs'); }}
                  className="text-xs underline shrink-0">Set up</span>
              )}
            </button>
          )}

          {/* The virtual remote */}
          {devices.length > 0 && (
            <div className="rounded-2xl bg-[#1a1a2e]/70 border border-white/8 p-5 space-y-5">
              {/* Power row */}
              <div className="flex justify-between items-center">
                <RemoteBtn icon={Power} label="Power" action="power" onPress={handleKey} disabled={sending}
                  className="!bg-red-600/30 hover:!bg-red-600/50" />
                <span className="text-xs text-white/30 font-medium tracking-wider">
                  {activeDevice?.name || '—'}
                </span>
                <RemoteBtn icon={Info} label="Info" action="options" onPress={handleKey} disabled={sending} />
              </div>

              {/* Vol / D-pad / Channel */}
              <div className="flex justify-between items-center gap-3">
                {/* Volume */}
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[9px] text-white/30 uppercase tracking-wider">Volume</span>
                  <RemoteBtn icon={Volume2}  label="Vol+"  action="volUp"   onPress={handleKey} disabled={sending} />
                  <RemoteBtn icon={VolumeX}  label="Mute"  action="mute"    onPress={handleKey} disabled={sending} size="sm" />
                  <RemoteBtn icon={Volume2}  label="Vol-"  action="volDown" onPress={handleKey} disabled={sending} className="opacity-60" />
                </div>

                {/* D-pad */}
                <DPad onPress={handleKey} disabled={sending} />

                {/* Channel */}
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[9px] text-white/30 uppercase tracking-wider">Channel</span>
                  <RemoteBtn icon={ChevronUp}   label="Ch+"  action="chUp"   onPress={handleKey} disabled={sending} />
                  <RemoteBtn icon={Radio}        label="Live" action="live"   onPress={handleKey} disabled={sending} size="sm" />
                  <RemoteBtn icon={ChevronDown}  label="Ch-"  action="chDown" onPress={handleKey} disabled={sending} className="opacity-60" />
                </div>
              </div>

              {/* Back / Home / Settings */}
              <div className="flex justify-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <RemoteBtn icon={RotateCcw} label="Back"     action="back"    onPress={handleKey} disabled={sending} />
                  <span className="text-[9px] text-white/30">Back</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <RemoteBtn icon={Home}      label="Home"     action="home"    onPress={handleKey} disabled={sending} />
                  <span className="text-[9px] text-white/30">Home</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <RemoteBtn icon={Settings}  label="Settings" action="options" onPress={handleKey} disabled={sending} />
                  <span className="text-[9px] text-white/30">Settings</span>
                </div>
              </div>

              {/* Media controls */}
              <div className="flex justify-center gap-2">
                <RemoteBtn icon={SkipBack}    label="Rewind"   action="rev"   onPress={handleKey} disabled={sending} />
                <RemoteBtn icon={Play}        label="Play"     action="play"  onPress={handleKey} disabled={sending} />
                <RemoteBtn icon={Pause}       label="Pause"    action="pause" onPress={handleKey} disabled={sending} />
                <RemoteBtn icon={Square}      label="Stop"     action="stop"  onPress={handleKey} disabled={sending} />
                <RemoteBtn icon={SkipForward} label="Forward"  action="fwd"   onPress={handleKey} disabled={sending} />
              </div>

              {/* Colour buttons */}
              <div className="flex gap-2 justify-center">
                {[
                  { a: 'red',    bg: 'bg-red-600/70' },
                  { a: 'green',  bg: 'bg-green-600/70' },
                  { a: 'yellow', bg: 'bg-yellow-500/70' },
                  { a: 'blue',   bg: 'bg-blue-600/70' },
                ].map(({ a, bg }) => (
                  <motion.button key={a} whileTap={{ scale: 0.85 }}
                    onClick={() => handleKey(a)} disabled={sending}
                    className={`w-10 h-5 rounded-full ${bg} disabled:opacity-30`} />
                ))}
              </div>

              {/* Number pad */}
              <div className="border-t border-white/8 pt-4">
                <NumPad onPress={handleKey} disabled={sending} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MY TVs TAB ── */}
      {tab === 'mytvs' && (
        <div className="space-y-4">

          {/* Connection status card */}
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold">PC Helper</h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                helperOk === null ? 'bg-muted text-muted-foreground'
                : helperOk ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
              }`}>
                {helperOk === null ? 'Checking...' : helperOk ? 'Connected' : 'Not running'}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              The remote works over your home WiFi. To reach your TV, a small helper program needs to be running on your <strong>Windows or Mac computer</strong> in the background. It takes about 2 minutes to set up once.
            </p>

            {/* Steps */}
            <div className="space-y-3">
              {[
                {
                  num: '1',
                  title: 'Make sure Node.js is installed on your computer',
                  detail: 'Download it free from nodejs.org — it takes about 2 minutes. If you already have it, skip to step 2.',
                  link: { label: 'Download Node.js', url: 'https://nodejs.org' },
                },
                {
                  num: '2',
                  title: 'Open Terminal (Mac) or Command Prompt (Windows)',
                  detail: 'On Mac: press Command + Space and type "Terminal". On Windows: press the Windows key and type "cmd".',
                },
                {
                  num: '3',
                  title: 'Go to the Smart Life app folder',
                  detail: 'Type this and press Enter: cd Downloads/smart-life-app',
                },
                {
                  num: '4',
                  title: 'Start the TV helper',
                  detail: 'Type this and press Enter: node scripts/tv-proxy/proxy.js — leave this window open while you use the remote.',
                },
                {
                  num: '5',
                  title: 'Come back here and tap the button below',
                  detail: 'Once the helper is running, tap "Check connection" and you\'re ready.',
                },
              ].map((step) => (
                <div key={step.num} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {step.num}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.detail}</p>
                    {step.link && (
                      <a href={step.link.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1">
                        {step.link.label} →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={recheckHelper} className="w-full rounded-xl bg-accent text-accent-foreground">
              {helperOk === null
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Checking...</>
                : helperOk
                  ? <><CheckCircle2 className="w-3.5 h-3.5 mr-2" />Connected — check again</>
                  : <><Wifi className="w-3.5 h-3.5 mr-2" />Check connection</>
              }
            </Button>
          </div>

          {/* ── Auto-discovered TVs ── */}
          {(discovering || discovered.length > 0) && (
            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                {discovering
                  ? <Loader2 className="w-4 h-4 text-accent animate-spin" />
                  : <CheckCircle2 className="w-4 h-4 text-accent" />
                }
                <p className="text-sm font-medium">
                  {discovering ? 'Scanning your network for TVs...' : `Found ${discovered.length} TV${discovered.length !== 1 ? 's' : ''} on your network`}
                </p>
              </div>
              {!discovering && discovered.map(d => (
                <div key={d.ip} className="flex items-center justify-between gap-3 bg-card rounded-xl p-3 border border-border/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tv className="w-4 h-4 text-accent shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{DEVICE_TYPES.find(t => t.id === d.type)?.label}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => addDiscovered(d)}
                    className="rounded-xl bg-accent text-accent-foreground shrink-0">
                    <Plus className="w-3.5 h-3.5 mr-1" />Add
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Scan button (when helper is connected but no discovered results showing) */}
          {helperOk && !discovering && discovered.length === 0 && (
            <Button variant="outline" onClick={runDiscovery} className="w-full rounded-xl gap-2">
              <Wifi className="w-4 h-4" />Scan for TVs on my network
            </Button>
          )}

          {/* Saved TVs list */}
          {devices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1">Your TVs</p>
              {devices.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                  <div
                    onClick={() => { selectDevice(d.id); setTab('remote'); }}
                    className={`w-2.5 h-2.5 rounded-full cursor-pointer shrink-0 ${activeId === d.id ? 'bg-accent' : 'bg-muted-foreground/30'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{DEVICE_TYPES.find(t => t.id === d.type)?.label}</p>
                  </div>
                  <button
                    onClick={() => { selectDevice(d.id); setTab('remote'); }}
                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${activeId === d.id ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-foreground'}`}>
                    {activeId === d.id ? 'Active' : 'Use'}
                  </button>
                  <button onClick={() => removeDevice(d.id)} className="text-muted-foreground hover:text-destructive p-1 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add TV form */}
          {!showForm ? (
            <Button onClick={() => setShowForm(true)} className="w-full rounded-xl bg-accent text-accent-foreground">
              <Plus className="w-4 h-4 mr-2" />Add my TV
            </Button>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Add a TV</h3>
                <button onClick={() => setShowForm(false)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Type */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">What kind of TV is it?</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {DEVICE_TYPES.map(t => (
                    <button key={t.id} onClick={() => setFormType(t.id)}
                      className={`py-2.5 text-xs rounded-xl border transition-all ${
                        formType === t.id
                          ? 'border-accent bg-accent/10 text-accent font-medium'
                          : 'border-border/50 text-muted-foreground hover:border-accent/30'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* IP */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">TV's IP address</p>
                <Input
                  placeholder={DEVICE_TYPES.find(t => t.id === formType)?.hint}
                  value={formIp}
                  onChange={e => setFormIp(e.target.value)}
                  className="rounded-xl"
                  inputMode="numeric"
                />
                <div className="mt-2 rounded-xl bg-muted/30 p-2.5 text-xs text-muted-foreground leading-relaxed">
                  <p className="font-medium text-foreground/70 mb-1">How to find your TV's IP address:</p>
                  <p>On your TV: go to <strong>Settings → Network → About</strong> (Samsung / LG)</p>
                  <p>or <strong>Settings → System → About</strong> (Roku)</p>
                </div>
              </div>

              {/* Name */}
              <Input
                placeholder="Give it a name, e.g. Living Room TV (optional)"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="rounded-xl"
              />

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={testConn}
                  disabled={!formIp.trim() || testing || !helperOk}
                  className="rounded-xl flex-1">
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  {testing ? 'Testing...' : 'Test connection'}
                </Button>
                <Button size="sm" onClick={addDevice} disabled={!formIp.trim()}
                  className="rounded-xl flex-1 bg-accent text-accent-foreground">
                  <Check className="w-3.5 h-3.5 mr-1.5" />Save TV
                </Button>
              </div>

              {!helperOk && (
                <p className="text-xs text-amber-400 text-center">
                  Start the PC Helper first (steps above) to test the connection
                </p>
              )}
            </div>
          )}

          {/* Supported TVs info */}
          <div className="rounded-2xl border border-border/50 bg-card/50 p-4 space-y-2">
            <p className="text-xs font-medium">Which TVs are supported?</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p><span className="text-foreground font-medium">Roku</span> — All Roku sticks, boxes, and Roku TVs</p>
              <p><span className="text-foreground font-medium">Samsung Smart TV</span> — 2016 and newer Samsung TVs</p>
              <p><span className="text-foreground font-medium">LG Smart TV</span> — LG webOS TVs (you'll see a pairing request on screen)</p>
              <p className="pt-1 text-muted-foreground/60">
                Chromecast, Fire Stick, Apple TV — use their own apps, or use the <strong>Mirror</strong> feature to cast your phone screen to the TV.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
