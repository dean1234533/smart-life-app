import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, Download, RefreshCw, FileImage,
  FileVideo, FileAudio, X, Loader2,
  Music, ExternalLink, Check, AlertCircle, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  detectGroup, convertImage, convertMedia, compressToZip, imagesToPDF,
  downloadBlob, getOutputFilename, formatSize,
  IMAGE_OUTPUTS, VIDEO_OUTPUTS, AUDIO_OUTPUTS,
} from '@/services/convertService';

// ── Free music services ────────────────────────────────────────────────────────
const MUSIC_SERVICES = [
  // Mainstream free tier
  { id: 'spotify',    name: 'Spotify',            emoji: '🎵', color: '#1DB954', free: 'Free with ads', platforms: 'iOS · Android · Web · Desktop', url: 'https://spotify.com',                  desc: 'Millions of songs, podcasts & playlists. Best free tier of any major streamer.' },
  { id: 'ytmusic',    name: 'YouTube Music',       emoji: '▶️',  color: '#FF0000', free: 'Free with ads', platforms: 'iOS · Android · Web',           url: 'https://music.youtube.com',            desc: 'Every song ever uploaded to YouTube. Huge catalogue including rare/live tracks.' },
  { id: 'soundcloud', name: 'SoundCloud',          emoji: '☁️',  color: '#FF5500', free: 'Free',          platforms: 'iOS · Android · Web',           url: 'https://soundcloud.com',               desc: 'Indie artists, remixes, DJ sets & exclusive tracks not on other platforms.' },
  { id: 'deezer',     name: 'Deezer',              emoji: '🎶',  color: '#A238FF', free: 'Free with ads', platforms: 'iOS · Android · Web',           url: 'https://deezer.com',                   desc: '90 million tracks. Strong editorial playlists and Flow radio personalisation.' },
  { id: 'amazon',     name: 'Amazon Music',        emoji: '📦',  color: '#00A8E0', free: 'Free with ads', platforms: 'iOS · Android · Web · Echo',    url: 'https://music.amazon.com',             desc: 'Free tier with ads. Prime subscribers get a larger catalogue.' },
  { id: 'audiomack',  name: 'Audiomack',           emoji: '🎤',  color: '#FFA500', free: '100% Free',     platforms: 'iOS · Android · Web',           url: 'https://audiomack.com',                desc: 'Hip-hop, R&B, Afrobeats & reggae focus. No subscription ever needed.' },
  { id: 'pandora',    name: 'Pandora',             emoji: '📻',  color: '#005483', free: 'Free with ads', platforms: 'iOS · Android · Web (US)',      url: 'https://pandora.com',                  desc: 'Personalised radio powered by the Music Genome Project. US only.' },
  // Radio & live
  { id: 'iheart',     name: 'iHeartRadio',         emoji: '❤️',  color: '#CC0000', free: '100% Free',     platforms: 'iOS · Android · Web',           url: 'https://iheart.com',                   desc: 'Live radio stations, artist radio, and podcasts. No login required.' },
  { id: 'tunein',     name: 'TuneIn',              emoji: '📡',  color: '#00A0DD', free: 'Free',          platforms: 'iOS · Android · Web',           url: 'https://tunein.com',                   desc: '100,000+ live radio stations and 4 million podcasts from worldwide.' },
  { id: 'radiogarden',name: 'Radio.garden',        emoji: '🌍',  color: '#4CAF50', free: '100% Free',     platforms: 'iOS · Android · Web',           url: 'https://radio.garden',                 desc: 'Spin the globe and listen to live radio from anywhere on Earth.' },
  { id: 'bbcsounds',  name: 'BBC Sounds',          emoji: '🇬🇧', color: '#FF4800', free: '100% Free',     platforms: 'iOS · Android · Web (UK)',      url: 'https://bbc.co.uk/sounds',             desc: 'BBC Radio 1–6, live and on-demand. Best free service in the UK.' },
  { id: 'nts',        name: 'NTS Radio',           emoji: '📻',  color: '#222222', free: '100% Free',     platforms: 'iOS · Android · Web',           url: 'https://nts.live',                     desc: '24/7 independent music broadcasting from London & LA. No ads.' },
  { id: 'mixcloud',   name: 'Mixcloud',            emoji: '🎛️',  color: '#5000FF', free: 'Free',          platforms: 'iOS · Android · Web',           url: 'https://mixcloud.com',                 desc: 'DJ mixes, radio shows, and podcasts. Best for long-form listening.' },
  // Independent / CC
  { id: 'bandcamp',   name: 'Bandcamp',            emoji: '🎸',  color: '#1DA0C3', free: 'Free to listen',platforms: 'iOS · Android · Web',           url: 'https://bandcamp.com',                 desc: 'Stream every album free before buying. Best place to support indie artists.' },
  { id: 'fma',        name: 'Free Music Archive',  emoji: '📚',  color: '#8B4513', free: '100% Free',     platforms: 'Web',                           url: 'https://freemusicarchive.org',         desc: 'Hundreds of thousands of Creative Commons & public domain tracks. Legal downloads.' },
  { id: 'jamendo',    name: 'Jamendo',             emoji: '🎼',  color: '#E8471D', free: '100% Free',     platforms: 'iOS · Android · Web',           url: 'https://jamendo.com',                  desc: '600,000+ Creative Commons songs. Legal to stream and download for personal use.' },
  { id: 'ccmixter',   name: 'ccMixter',            emoji: '🎹',  color: '#558B2F', free: '100% Free',     platforms: 'Web',                           url: 'https://ccmixter.org',                 desc: 'Community remixes and samples. All tracks Creative Commons licensed.' },
  { id: 'archive',    name: 'Internet Archive',    emoji: '🗄️',  color: '#444444', free: '100% Free',     platforms: 'Web',                           url: 'https://archive.org/details/audio',   desc: 'Millions of public domain recordings, live concerts, old radio shows.' },
  // Niche / focus
  { id: 'lofi',       name: 'Lofi.co',             emoji: '☕',  color: '#6B7280', free: '100% Free',     platforms: 'Web',                           url: 'https://lofi.co',                      desc: 'Curated lo-fi beats and ambient streams for focus, work, or sleep.' },
  { id: 'lastfm',     name: 'Last.fm',             emoji: '🔴',  color: '#E31C23', free: 'Free',          platforms: 'iOS · Android · Web',           url: 'https://last.fm',                      desc: 'Scrobble your listening and discover music through charts and recommendations.' },
  { id: 'reverbnation',name: 'ReverbNation',       emoji: '🌊',  color: '#E4384E', free: '100% Free',     platforms: 'iOS · Android · Web',           url: 'https://reverbnation.com',             desc: 'Unsigned and independent artists. Discover music before it hits the mainstream.' },
  { id: 'npr',        name: 'NPR Music',           emoji: '🎙️',  color: '#357ABD', free: '100% Free',     platforms: 'Web',                           url: 'https://music.npr.org',                desc: 'Curated discovery, live sessions, and Tiny Desk concerts.' },
];

const MUSIC_CATEGORIES = [
  { id: 'mainstream', label: 'Mainstream (Free Tier)',  ids: ['spotify','ytmusic','soundcloud','deezer','amazon','audiomack','pandora'] },
  { id: 'radio',      label: 'Radio & Live Streams',    ids: ['iheart','tunein','radiogarden','bbcsounds','nts','mixcloud'] },
  { id: 'indie',      label: 'Independent & Free',      ids: ['bandcamp','fma','jamendo','ccmixter','archive'] },
  { id: 'niche',      label: 'Discover & Focus',        ids: ['lofi','lastfm','reverbnation','npr'] },
];

// ── Convert tab ───────────────────────────────────────────────────────────────
function ConvertTab() {
  const [files, setFiles] = useState([]);
  const [outputFmt, setOutputFmt] = useState(null);
  const [quality, setQuality] = useState(82);
  const [maxDim, setMaxDim] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | converting | done | error
  const [progress, setProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState(null);
  const [resultSize, setResultSize] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);
  const dragRef = useRef(null);

  const group = files.length > 0 ? detectGroup(files[0]) : null;
  const outputs = group === 'image' ? IMAGE_OUTPUTS : group === 'video' ? VIDEO_OUTPUTS : group === 'audio' ? AUDIO_OUTPUTS : [];

  const addFiles = (newFiles) => {
    const arr = Array.from(newFiles);
    if (!arr.length) return;
    setFiles(arr);
    setOutputFmt(null);
    setResultBlob(null);
    setPhase('idle');
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }, []);

  const convert = async () => {
    if (!files.length || !outputFmt) return;
    setPhase('converting');
    setProgress(0);
    setResultBlob(null);
    try {
      let blob;
      const output = outputs.find(o => o.format === outputFmt);

      if (group === 'image' && outputFmt === 'pdf') {
        blob = await imagesToPDF(files);
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: 'converted.pdf' });
        a.click(); URL.revokeObjectURL(url);
        setPhase('done'); setResultBlob(blob); setResultSize(blob.size);
        return;
      }

      if (group === 'image') {
        blob = await convertImage(files[0], outputFmt, quality / 100, maxDim ? parseInt(maxDim) : null);
      } else if (group === 'video' || group === 'audio') {
        blob = await convertMedia(files[0], output, (p) => setProgress(p));
      } else if (outputFmt === 'zip') {
        blob = await compressToZip(files);
      } else {
        throw new Error('Unsupported conversion');
      }

      setResultBlob(blob);
      setResultSize(blob.size);
      setPhase('done');
    } catch (e) {
      setErrorMsg(e.message);
      setPhase('error');
    }
  };

  const download = () => {
    if (!resultBlob) return;
    const output = outputs.find(o => o.format === outputFmt);
    downloadBlob(resultBlob, getOutputFilename(files[0]?.name || 'file', output?.ext || outputFmt));
  };

  const reset = () => {
    setFiles([]); setOutputFmt(null); setResultBlob(null); setPhase('idle');
  };

  const GroupIcon = group === 'image' ? FileImage : group === 'video' ? FileVideo : group === 'audio' ? FileAudio : Upload;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        ref={dragRef}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="rounded-2xl border-2 border-dashed border-border/50 hover:border-accent/50 bg-muted/20 hover:bg-accent/5 transition-all cursor-pointer p-8 flex flex-col items-center gap-3 text-center"
      >
        {files.length === 0 ? (
          <>
            <Upload className="w-10 h-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Drop files here or tap to browse</p>
              <p className="text-xs text-muted-foreground mt-0.5">Images · Video · Audio · Any files (for ZIP)</p>
            </div>
          </>
        ) : (
          <>
            <GroupIcon className="w-8 h-8 text-accent" />
            <div>
              <p className="text-sm font-medium">{files.length === 1 ? files[0].name : `${files.length} files selected`}</p>
              <p className="text-xs text-muted-foreground">
                {files.length === 1 ? formatSize(files[0].size) : formatSize(files.reduce((s,f) => s + f.size, 0))} total
                &nbsp;·&nbsp;<span className="text-accent">tap to change</span>
              </p>
            </div>
          </>
        )}
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
      </div>

      {/* Format selector */}
      {files.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Convert to</p>
          <div className="flex flex-wrap gap-2">
            {outputs.map(o => (
              <button key={o.format} onClick={() => setOutputFmt(o.format)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  outputFmt === o.format
                    ? 'border-accent bg-accent/20 text-accent'
                    : 'border-border/50 text-muted-foreground hover:border-accent/40'
                }`}>
                {o.label}
              </button>
            ))}
            {/* ZIP — always available */}
            <button onClick={() => setOutputFmt('zip')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                outputFmt === 'zip' ? 'border-accent bg-accent/20 text-accent' : 'border-border/50 text-muted-foreground hover:border-accent/40'
              }`}>
              ZIP
            </button>
            {/* PDF — for images */}
            {group === 'image' && (
              <button onClick={() => setOutputFmt('pdf')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  outputFmt === 'pdf' ? 'border-accent bg-accent/20 text-accent' : 'border-border/50 text-muted-foreground hover:border-accent/40'
                }`}>
                PDF
              </button>
            )}
          </div>

          {/* Image-only options */}
          {group === 'image' && outputFmt && outputFmt !== 'zip' && outputFmt !== 'pdf' && (
            <div className="space-y-3 p-3 rounded-xl bg-muted/20 border border-border/30">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Quality</label>
                <span className="text-xs font-medium">{quality}%</span>
              </div>
              <input type="range" min={10} max={100} value={quality}
                onChange={e => setQuality(Number(e.target.value))}
                className="w-full accent-accent h-1.5 rounded-full" />
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Max size (px)</label>
                <input type="number" value={maxDim} onChange={e => setMaxDim(e.target.value)}
                  placeholder="e.g. 1920 (optional)"
                  className="flex-1 bg-background border border-input rounded-lg px-2 py-1 text-xs" />
              </div>
            </div>
          )}

          {/* Video/audio note about FFmpeg loading */}
          {(group === 'video' || group === 'audio') && outputFmt && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              First run downloads the FFmpeg engine (~20 MB). Subsequent conversions are instant.
            </p>
          )}
        </div>
      )}

      {/* Progress / result */}
      <AnimatePresence>
        {phase === 'converting' && (
          <motion.div key="prog" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl bg-card border border-border/40 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              {group === 'image' ? 'Converting...' : progress > 0 ? `Converting… ${progress}%` : 'Loading FFmpeg engine...'}
            </div>
            {progress > 0 && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div className="h-full bg-accent rounded-full" animate={{ width: `${progress}%` }} />
              </div>
            )}
          </motion.div>
        )}

        {phase === 'done' && resultBlob && (
          <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-400">Conversion complete</p>
              <p className="text-xs text-muted-foreground">
                {formatSize(files[0].size)} → {formatSize(resultSize)}
                {resultSize < files[0].size ? ` (${Math.round((1 - resultSize / files[0].size) * 100)}% smaller)` : ''}
              </p>
            </div>
            <Button size="sm" onClick={download} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
              <Download className="w-3.5 h-3.5 mr-1.5" />Save
            </Button>
          </motion.div>
        )}

        {phase === 'error' && (
          <motion.div key="err" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{errorMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex gap-2">
        {files.length > 0 && (
          <Button onClick={reset} variant="outline" size="sm" className="rounded-xl">
            <X className="w-3.5 h-3.5 mr-1.5" />Clear
          </Button>
        )}
        {outputFmt && phase !== 'converting' && (
          <Button onClick={convert} className="rounded-xl bg-accent text-accent-foreground flex-1">
            <RefreshCw className="w-4 h-4 mr-2" />
            Convert{outputFmt === 'zip' ? ' to ZIP' : outputFmt === 'pdf' ? ' to PDF' : ` to ${outputFmt.toUpperCase()}`}
          </Button>
        )}
      </div>

      {/* Format info */}
      <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Supported formats</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><span className="text-foreground">Images</span> — JPEG, PNG, WebP, AVIF, GIF, BMP, SVG → JPEG, PNG, WebP, AVIF, PDF</p>
          <p><span className="text-foreground">Video</span> — MP4, WebM, MOV, AVI, MKV → MP4, WebM, GIF, MP3, WAV</p>
          <p><span className="text-foreground">Audio</span> — MP3, WAV, OGG, FLAC, AAC, M4A → MP3, WAV, OGG, FLAC, AAC</p>
          <p><span className="text-foreground">Any file</span> → Compress to ZIP</p>
          <p className="text-muted-foreground/60 pt-1">All conversion happens on your device — files never leave your phone.</p>
        </div>
      </div>
    </div>
  );
}

// ── Music tab ─────────────────────────────────────────────────────────────────
function MusicTab() {
  const [filter, setFilter] = useState('all');
  const svcMap = Object.fromEntries(MUSIC_SERVICES.map(s => [s.id, s]));

  const visibleCategories = filter === 'all'
    ? MUSIC_CATEGORIES
    : MUSIC_CATEGORIES.filter(c => c.id === filter);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/20 p-4">
        <p className="text-sm font-medium mb-1">100% Free & Legal Music</p>
        <p className="text-xs text-muted-foreground">
          Every service below lets you listen for free, legally. No piracy, no sketchy apps — all fully licensed.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {[['all','All'],['mainstream','Mainstream'],['radio','Radio'],['indie','Independent'],['niche','Discover']].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
              filter === id ? 'bg-accent/20 border-accent/40 text-accent' : 'border-border/40 text-muted-foreground hover:text-foreground'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {visibleCategories.map(cat => (
        <div key={cat.id} className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{cat.label}</h3>
          <div className="space-y-2">
            {cat.ids.map(id => {
              const svc = svcMap[id];
              if (!svc) return null;
              return (
                <a key={id} href={svc.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-2xl bg-card border border-border/40 hover:border-accent/30 hover:bg-card/80 transition-all group">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 border border-white/5"
                    style={{ background: svc.color + '22' }}>
                    {svc.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{svc.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">{svc.free}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{svc.desc}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{svc.platforms}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-accent shrink-0 mt-1 transition-colors" />
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Convert() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('convert');

  return (
    <div className="px-4 pt-12 pb-8">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          {tab === 'convert' ? <RefreshCw className="w-5 h-5 text-accent" /> : <Music className="w-5 h-5 text-accent" />}
          <h1 className="text-2xl font-display font-bold">
            {tab === 'convert' ? 'Convert & Compress' : 'Free Music'}
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 mb-5">
        <button onClick={() => setTab('convert')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${tab==='convert' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          <RefreshCw className="w-3.5 h-3.5" />Convert & Compress
        </button>
        <button onClick={() => setTab('music')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${tab==='music' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          <Music className="w-3.5 h-3.5" />Free Music
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'convert' ? <ConvertTab /> : <MusicTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
