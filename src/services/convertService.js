import JSZip from 'jszip';

// ── File type detection ───────────────────────────────────────────────────────
export function detectGroup(file) {
  const mime = file.type || '';
  const ext  = file.name.split('.').pop()?.toLowerCase() || '';
  if (mime.startsWith('image/') || ['jpg','jpeg','png','webp','gif','bmp','avif','svg','tiff','heic'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4','webm','mov','avi','mkv','m4v','flv','wmv'].includes(ext)) return 'video';
  if (mime.startsWith('audio/') || ['mp3','wav','ogg','flac','aac','m4a','opus','wma'].includes(ext)) return 'audio';
  return 'other';
}

// ── Output format definitions ─────────────────────────────────────────────────
export const IMAGE_OUTPUTS = [
  { format: 'jpeg', label: 'JPEG',  mime: 'image/jpeg', ext: 'jpg'  },
  { format: 'png',  label: 'PNG',   mime: 'image/png',  ext: 'png'  },
  { format: 'webp', label: 'WebP',  mime: 'image/webp', ext: 'webp' },
  { format: 'avif', label: 'AVIF',  mime: 'image/avif', ext: 'avif' },
];

export const VIDEO_OUTPUTS = [
  { format: 'mp4',  label: 'MP4',  ext: 'mp4',  args: ['-c:v','libx264','-preset','fast','-crf','23','-c:a','aac'] },
  { format: 'webm', label: 'WebM', ext: 'webm', args: ['-c:v','libvpx-vp9','-crf','33','-b:v','0','-c:a','libopus'] },
  { format: 'gif',  label: 'GIF',  ext: 'gif',  args: ['-vf','fps=10,scale=480:-1:flags=lanczos','-loop','0'] },
  { format: 'mp3',  label: 'MP3',  ext: 'mp3',  args: ['-vn','-b:a','192k'] },
  { format: 'wav',  label: 'WAV',  ext: 'wav',  args: ['-vn'] },
];

export const AUDIO_OUTPUTS = [
  { format: 'mp3',  label: 'MP3',  ext: 'mp3',  args: ['-b:a','192k'] },
  { format: 'wav',  label: 'WAV',  ext: 'wav',  args: [] },
  { format: 'ogg',  label: 'OGG',  ext: 'ogg',  args: ['-c:a','libvorbis','-q:a','4'] },
  { format: 'flac', label: 'FLAC', ext: 'flac', args: [] },
  { format: 'aac',  label: 'AAC',  ext: 'aac',  args: ['-c:a','aac','-b:a','192k'] },
];

// ── Image conversion — Canvas API (no deps, works offline) ───────────────────
export async function convertImage(file, outputFormat, quality = 0.85, maxDim = null) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      if (maxDim && (w > maxDim || h > maxDim)) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      // Fill white background for JPEG (no transparency)
      if (outputFormat === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);
      const mime = outputFormat === 'jpeg' ? 'image/jpeg' : `image/${outputFormat}`;
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Browser does not support this output format')),
        mime,
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')); };
    img.src = url;
  });
}

// ── FFmpeg (video/audio) — WASM core loaded lazily from CDN ──────────────────
let _ffmpeg = null;

async function loadFFmpeg(onLog) {
  if (_ffmpeg?.loaded) return _ffmpeg;
  const { FFmpeg }     = await import('@ffmpeg/ffmpeg');
  const { toBlobURL }  = await import('@ffmpeg/util');

  const BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  const [coreURL, wasmURL] = await Promise.all([
    toBlobURL(`${BASE}/ffmpeg-core.js`,   'text/javascript'),
    toBlobURL(`${BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  ]);

  const ff = new FFmpeg();
  if (onLog) ff.on('log', ({ message }) => onLog(message));
  await ff.load({ coreURL, wasmURL });
  _ffmpeg = ff;
  return ff;
}

export async function convertMedia(file, output, onProgress) {
  const ff = await loadFFmpeg(null);
  ff.on('progress', ({ progress }) => onProgress?.(Math.round(Math.max(0, Math.min(100, progress * 100)))));

  const { fetchFile } = await import('@ffmpeg/util');
  const inName  = `in.${file.name.split('.').pop() || 'tmp'}`;
  const outName = `out.${output.ext}`;

  await ff.writeFile(inName, await fetchFile(file));
  await ff.exec(['-i', inName, ...output.args, '-y', outName]);
  const data = await ff.readFile(outName);
  await ff.deleteFile(inName).catch(() => {});
  await ff.deleteFile(outName).catch(() => {});

  return new Blob([data.buffer], { type: `video/${output.ext}` });
}

// ── ZIP compression ────────────────────────────────────────────────────────────
export async function compressToZip(files) {
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// ── Images → PDF (uses jsPDF already in project) ──────────────────────────────
export async function imagesToPDF(files) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'px', hotfixes: ['px_scaling'] });
  let first = true;
  for (const file of files) {
    const blob = await convertImage(file, 'jpeg', 0.9);
    const dataUrl = await blobToDataUrl(blob);
    const img = await loadImageDimensions(dataUrl);
    const pW = doc.internal.pageSize.getWidth();
    const pH = doc.internal.pageSize.getHeight();
    const scale = Math.min(pW / img.width, pH / img.height);
    const w = img.width * scale, h = img.height * scale;
    const x = (pW - w) / 2, y = (pH - h) / 2;
    if (!first) doc.addPage();
    doc.addImage(dataUrl, 'JPEG', x, y, w, h);
    first = false;
  }
  return doc.output('blob');
}

// ── Download helper ────────────────────────────────────────────────────────────
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function getOutputFilename(original, ext) {
  const base = original.replace(/\.[^.]+$/, '');
  return `${base}_converted.${ext}`;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Internal helpers ──────────────────────────────────────────────────────────
function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
function loadImageDimensions(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
