import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { nanoid } from 'nanoid';
import {
  Tv, Plus, Trash2, Check, X, Wifi, WifiOff, ChevronDown,
  Power, Volume2, VolumeX, ChevronUp, ChevronLeft, ChevronRight,
  SkipBack, SkipForward, Play, Pause, Square, Info, Home, RotateCcw,
  Settings, Radio, Loader2, ExternalLink, Terminal, ArrowLeft, Cast
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  getDevices, saveDevices, getActiveDeviceId, setActiveDeviceId,
  sendKey, testDevice, isProxyRunning,
  rokuGetApps, rokuLaunchApp,
  STREAMING_SERVICES,
} from '@/services/tvRemoteService';

const DEVICE_TYPES = [
  { id: 'roku',    label: 'Roku',           hint: 'e.g. 192.168.1.42' },
  { id: 'samsung', label: 'Samsung Smart TV', hint: 'e.g. 192.168.1.21' },
  { id: 'lg',      label: 'LG webOS TV',     hint: 'e.g. 192.168.1.33' },
];

// ── Remote button component ──────────────────────────────────────────────────
function RemoteBtn({ icon: Icon, label, action, onPress, className = '', disabled = false, size = 'md', color }) {
  const [pressing, setPressing] = useState(false);
  const handlePress = async () => {
    if (disabled || pressing) return;
    setPressing(true);
    try { await onPress(action); } catch {}
    setTimeout(() => setPressing(false), 150);
  };
  const sz = size === 'lg' ? 'w-14 h-14 text-lg' : size === 'sm' ? 'w-9 h-9 text-[11px]' : 'w-12 h-12';
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={handlePress}
      disabled={disabled}
      className={`${sz} flex flex-col items-center justify-center gap-0.5 rounded-2xl font-medium transition-all select-none
        ${pressing ? 'bg-accent/30' : 'bg-white/8 hover:bg-white/15'}
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'active:scale-90'}
        ${color || ''}
        ${className}`}
      title={label}
    >
      {Icon && <Icon className={size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'} />}
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
        className="w-14 h-14 rounded-full bg-accent/80 hover:bg-accent text-white font-bold text-xs flex items-center justify-center shadow-lg disabled:opacity-30"
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

// ── Colour buttons (satellite / Sky / cable) ─────────────────────────────────
function ColourButtons({ onPress, disabled }) {
  return (
    <div className="flex gap-2 justify-center">
      {[
        { a: 'red',    bg: 'bg-red-600/70' },
        { a: 'green',  bg: 'bg-green-600/70' },
        { a: 'yellow', bg: 'bg-yellow-500/70' },
        { a: 'blue',   bg: 'bg-blue-600/70' },
      ].map(({ a, bg }) => (
        <motion.button key={a} whileTap={{ scale: 0.85 }} onClick={() => onPress(a)} disabled={disabled}
          className={`w-9 h-5 rounded-full ${bg} disabled:opacity-30`} />
      ))}
    </div>
  );
}

export default function Remote() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('remote'); // 'streaming' | 'remote' | 'devices'

  // Device state
  const [devices, setDevices] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [proxyOk, setProxyOk] = useState(null); // null=checking, true, false
  const [sending, setSending] = useState(false);

  // Device form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('roku');
  const [formIp, setFormIp] = useState('');
  const [testing, setTesting] = useState(false);

  // Roku apps
  const [rokuApps, setRokuApps] = useState([]);

  const activeDevice = devices.find(d => d.id === activeId) || devices[0] || null;

  // ── Load saved state ───────────────────────────────────────────────────────
  useEffect(() => {
    const devs = getDevices();
    setDevices(devs);
    setActiveId(getActiveDeviceId() || devs[0]?.id || null);
    // Check proxy
    isProxyRunning().then(setProxyOk);
  }, []);

  // ── Load Roku apps when device changes ────────────────────────────────────
  useEffect(() => {
    if (!activeDevice || activeDevice.type !== 'roku' || !proxyOk) return;
    rokuGetApps(activeDevice.ip).then(setRokuApps).catch(() => setRokuApps([]));
  }, [activeDevice?.id, proxyOk]);

  // ── Send key ───────────────────────────────────────────────────────────────
  const handleKey = useCallback(async (key) => {
    if (!activeDevice) { toast.error('No device selected — add one in the Devices tab'); return; }
    if (!proxyOk) { toast.error('Proxy not running — see setup in the Devices tab'); return; }
    setSending(true);
    try {
      await sendKey(activeDevice, key);
    } catch (e) {
      toast.error(e.message || 'Key failed');
    } finally {
      setSending(false);
    }
  }, [activeDevice, proxyOk]);

  // ── Save device ────────────────────────────────────────────────────────────
  const addDevice = () => {
    if (!formIp.trim()) return;
    const dev = { id: nanoid(8), name: formName.trim() || `${DEVICE_TYPES.find(t=>t.id===formType)?.label} TV`, type: formType, ip: formIp.trim() };
    const updated = [...devices, dev];
    setDevices(updated);
    saveDevices(updated);
    if (!activeId) { setActiveId(dev.id); setActiveDeviceId(dev.id); }
    setShowForm(false);
    setFormName(''); setFormIp(''); setFormType('roku');
    toast.success(`${dev.name} added`);
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
      toast.success('Device found!');
    } catch (e) {
      toast.error(e.message || 'Could not reach device');
    } finally {
      setTesting(false);
    }
  };

  const recheckProxy = async () => {
    setProxyOk(null);
    const ok = await isProxyRunning();
    setProxyOk(ok);
    if (ok) toast.success('Proxy connected!');
    else toast.error('Proxy not running');
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-12 pb-6">
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
        {[['streaming','Streaming'],['remote','Remote'],['devices','Devices']].map(([id,label]) => (
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
              <p className="text-sm font-medium">Screen Mirror</p>
              <p className="text-xs text-muted-foreground">Cast this screen to any TV or monitor</p>
            </div>
          </Link>

          <p className="text-xs text-muted-foreground">Tap to open on this device. Long-press on mobile to launch the app directly.</p>
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
                  <button key={app.id} onClick={() => rokuLaunchApp(activeDevice.ip, app.id).catch(e => toast.error(e.message))}
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
          {/* Device selector */}
          {devices.length > 0 ? (
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
          ) : (
            <div className="rounded-xl bg-muted/20 p-4 text-center space-y-2">
              <Tv className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No devices added yet</p>
              <Button size="sm" onClick={() => setTab('devices')} className="rounded-xl bg-accent text-accent-foreground">
                <Plus className="w-3.5 h-3.5 mr-1.5" />Add a device
              </Button>
            </div>
          )}

          {/* Proxy status pill */}
          {devices.length > 0 && (
            <div
              onClick={recheckProxy}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                proxyOk === null ? 'bg-muted/30 text-muted-foreground'
                : proxyOk ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              {proxyOk === null ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : proxyOk ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>
                {proxyOk === null ? 'Checking proxy...' : proxyOk ? 'Proxy connected — remote ready' : 'Proxy not running — tap to retry'}
              </span>
              {!proxyOk && proxyOk !== null && (
                <button onClick={() => setTab('devices')} className="ml-auto underline">Setup</button>
              )}
            </div>
          )}

          {devices.length > 0 && (
            <div className="rounded-2xl bg-[#1a1a2e]/60 border border-white/8 p-5 space-y-5">
              {/* Power + Input row */}
              <div className="flex justify-between items-center">
                <RemoteBtn icon={Power} label="Power" action="power" onPress={handleKey} disabled={sending}
                  className="!bg-red-600/30 hover:!bg-red-600/50" />
                <span className="text-xs text-white/30 font-medium tracking-widest uppercase">
                  {activeDevice?.name || '—'}
                </span>
                <RemoteBtn icon={Info} label="Info" action="options" onPress={handleKey} disabled={sending} />
              </div>

              {/* Volume + Channel */}
              <div className="flex justify-between items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <RemoteBtn icon={Volume2}  label="Vol+"  action="volUp"   onPress={handleKey} disabled={sending} />
                  <RemoteBtn icon={VolumeX}  label="Mute"  action="mute"    onPress={handleKey} disabled={sending} size="sm" />
                  <RemoteBtn icon={Volume2}  label="Vol-"  action="volDown" onPress={handleKey} disabled={sending}
                    className="opacity-70" />
                </div>

                {/* D-pad */}
                <DPad onPress={handleKey} disabled={sending} />

                <div className="flex flex-col items-center gap-1">
                  <RemoteBtn icon={ChevronUp}   label="Ch+"  action="chUp"   onPress={handleKey} disabled={sending} />
                  <RemoteBtn icon={Radio}        label="Live" action="live"   onPress={handleKey} disabled={sending} size="sm" />
                  <RemoteBtn icon={ChevronDown}  label="Ch-"  action="chDown" onPress={handleKey} disabled={sending}
                    className="opacity-70" />
                </div>
              </div>

              {/* Back / Home / Settings */}
              <div className="flex justify-center gap-3">
                <RemoteBtn icon={RotateCcw}  label="Back"     action="back"    onPress={handleKey} disabled={sending} />
                <RemoteBtn icon={Home}       label="Home"     action="home"    onPress={handleKey} disabled={sending} />
                <RemoteBtn icon={Settings}   label="Settings" action="options" onPress={handleKey} disabled={sending} />
              </div>

              {/* Media controls */}
              <div className="flex justify-center gap-2">
                <RemoteBtn icon={SkipBack}    label="Rev"   action="rev"   onPress={handleKey} disabled={sending} />
                <RemoteBtn icon={Play}        label="Play"  action="play"  onPress={handleKey} disabled={sending} />
                <RemoteBtn icon={Pause}       label="Pause" action="pause" onPress={handleKey} disabled={sending} />
                <RemoteBtn icon={Square}      label="Stop"  action="stop"  onPress={handleKey} disabled={sending} />
                <RemoteBtn icon={SkipForward} label="Fwd"   action="fwd"   onPress={handleKey} disabled={sending} />
              </div>

              {/* Colour buttons */}
              <ColourButtons onPress={handleKey} disabled={sending} />

              {/* Number pad */}
              <div className="border-t border-white/8 pt-4">
                <NumPad onPress={handleKey} disabled={sending} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DEVICES TAB ── */}
      {tab === 'devices' && (
        <div className="space-y-4">
          {/* Proxy status + setup */}
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-heading font-semibold">Local Proxy</h3>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${proxyOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {proxyOk === null ? 'Checking...' : proxyOk ? 'Running' : 'Not running'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              The proxy runs on your PC/Mac so the app can reach your TV over WiFi. Start it once and keep it running while using the remote.
            </p>
            <div className="bg-muted/40 rounded-xl p-3 space-y-1.5 font-mono text-[11px] text-muted-foreground">
              <p className="text-foreground/80"># First time only:</p>
              <p>cd scripts/tv-proxy && npm install</p>
              <p className="text-foreground/80 pt-1"># Every time you want to use the remote:</p>
              <p>node scripts/tv-proxy/proxy.js</p>
            </div>
            <Button size="sm" variant="outline" onClick={recheckProxy} className="rounded-xl w-full">
              {proxyOk === null ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              {proxyOk ? 'Re-check connection' : 'Check connection'}
            </Button>
          </div>

          {/* Device list */}
          {devices.map(d => (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
              <div
                onClick={() => { selectDevice(d.id); setTab('remote'); }}
                className={`w-2 h-2 rounded-full cursor-pointer ${activeId === d.id ? 'bg-accent' : 'bg-muted-foreground/30'}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground">{DEVICE_TYPES.find(t=>t.id===d.type)?.label} · {d.ip}</p>
              </div>
              <button
                onClick={() => selectDevice(d.id)}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${activeId === d.id ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-foreground'}`}>
                {activeId === d.id ? 'Active' : 'Use'}
              </button>
              <button onClick={() => removeDevice(d.id)} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Add device form */}
          {!showForm ? (
            <Button onClick={() => setShowForm(true)} className="w-full rounded-xl bg-accent text-accent-foreground">
              <Plus className="w-4 h-4 mr-2" />Add a device
            </Button>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">New device</h3>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>

              {/* Type selector */}
              <div className="grid grid-cols-3 gap-1.5">
                {DEVICE_TYPES.map(t => (
                  <button key={t.id} onClick={() => setFormType(t.id)}
                    className={`py-2 text-xs rounded-xl border transition-all ${formType === t.id ? 'border-accent bg-accent/10 text-accent' : 'border-border/50 text-muted-foreground hover:border-accent/30'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <Input
                placeholder={DEVICE_TYPES.find(t => t.id === formType)?.hint || 'IP address'}
                value={formIp}
                onChange={e => setFormIp(e.target.value)}
                className="rounded-xl"
              />
              <Input
                placeholder="Nickname (optional, e.g. Living Room TV)"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="rounded-xl"
              />

              <div className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-2.5">
                Find your TV's IP: Settings → Network → About (Samsung / LG) · Settings → System → About (Roku)
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={testConn} disabled={!formIp.trim() || testing || !proxyOk}
                  className="rounded-xl flex-1">
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
                </Button>
                <Button size="sm" onClick={addDevice} disabled={!formIp.trim()}
                  className="rounded-xl flex-1 bg-accent text-accent-foreground">
                  <Check className="w-3.5 h-3.5 mr-1.5" />Add
                </Button>
              </div>
            </div>
          )}

          {/* Supported devices info */}
          <div className="rounded-2xl border border-border/50 bg-card/50 p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Supported devices</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><span className="text-foreground">Roku</span> — All Roku players & TVs (via ECP)</p>
              <p><span className="text-foreground">Samsung Smart TV</span> — 2016+ Tizen TVs (via WebSocket)</p>
              <p><span className="text-foreground">LG Smart TV</span> — webOS TVs (requires on-screen pairing)</p>
              <p className="pt-1 text-muted-foreground/60">Chromecast, Fire TV, Apple TV — use their native apps for full control, or cast directly from Chrome.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
