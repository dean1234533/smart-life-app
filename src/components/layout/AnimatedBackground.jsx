import { useEffect, useRef } from 'react';

// ── Hexagons (original) ──────────────────────────────────────────────────
function HexBackground() {
  const hexPath = "M 50 0 L 93.3 25 L 93.3 75 L 50 100 L 6.7 75 L 6.7 25 Z";
  const cols = 8, rows = 16, W = 100, H = 86.6;
  const hexes = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      hexes.push({ x: c * W + (r % 2 ? W / 2 : 0), y: r * H * 0.75, key: `${r}-${c}` });

  return (
    <div className="geo-bg">
      <svg className="geo-layer-1" viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid slice">
        <g stroke="rgba(34,211,238,0.22)" strokeWidth="1" fill="none">
          {hexes.map(({ x, y, key }) => <path key={key} d={hexPath} transform={`translate(${x - 50},${y})`} />)}
        </g>
      </svg>
      <svg className="geo-layer-2" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid slice">
        <g stroke="rgba(34,211,238,0.11)" strokeWidth="1.5" fill="none">
          {hexes.map(({ x, y, key }) => <path key={`2-${key}`} d={hexPath} transform={`translate(${x},${y + 43})`} />)}
        </g>
      </svg>
      <div className="geo-glow" style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: '60vw', height: '60vw', maxWidth: 400, maxHeight: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
    </div>
  );
}

// ── Aurora ───────────────────────────────────────────────────────────────
function AuroraBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div className="aurora-blob aurora-1" />
      <div className="aurora-blob aurora-2" />
      <div className="aurora-blob aurora-3" />
      <div className="aurora-blob aurora-4" />
    </div>
  );
}

// ── Particles ────────────────────────────────────────────────────────────
function ParticleBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const N = 60;
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34,211,238,0.7)';
        ctx.fill();
      }
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(34,211,238,${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

// ── Matrix Rain ──────────────────────────────────────────────────────────
function MatrixBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const fontSize = 13;
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ';
    let cols = Math.floor(canvas.width / fontSize);
    let drops = Array(cols).fill(1);

    const draw = () => {
      cols = Math.floor(canvas.width / fontSize);
      if (drops.length !== cols) drops = Array(cols).fill(1);
      ctx.fillStyle = 'rgba(10,14,26,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(34,211,238,0.75)';
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

// ── Stars ────────────────────────────────────────────────────────────────
function StarsBackground() {
  const stars = Array.from({ length: 120 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 4,
    duration: 2 + Math.random() * 3,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {stars.map((s) => (
        <div key={s.id} className="star" style={{
          position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size, borderRadius: '50%',
          background: 'white',
          animationDelay: `${s.delay}s`,
          animationDuration: `${s.duration}s`,
        }} />
      ))}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%)' }} />
    </div>
  );
}

// ── Waves ────────────────────────────────────────────────────────────────
function WavesBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div className="wave wave-1" />
      <div className="wave wave-2" />
      <div className="wave wave-3" />
    </div>
  );
}

// ── Bubbles ──────────────────────────────────────────────────────────────
function BubblesBackground() {
  const bubbles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: 5 + Math.random() * 90,
    size: 20 + Math.random() * 80,
    delay: Math.random() * 8,
    duration: 6 + Math.random() * 8,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {bubbles.map((b) => (
        <div key={b.id} className="bubble" style={{
          position: 'absolute', bottom: '-100px', left: `${b.x}%`,
          width: b.size, height: b.size, borderRadius: '50%',
          border: '1px solid rgba(34,211,238,0.3)',
          background: 'rgba(34,211,238,0.04)',
          animationDelay: `${b.delay}s`,
          animationDuration: `${b.duration}s`,
        }} />
      ))}
    </div>
  );
}

export const BACKGROUNDS = [
  { id: 'hexagons', label: 'Hexagons', preview: 'linear-gradient(135deg, #0d1520 60%, #22d3ee22)' },
  { id: 'aurora',   label: 'Aurora',   preview: 'linear-gradient(135deg, #1e0a3c, #0e1a3a, #7c3aed44)' },
  { id: 'particles',label: 'Particles',preview: 'linear-gradient(135deg, #0d1520 40%, #22d3ee11)' },
  { id: 'matrix',   label: 'Matrix',   preview: 'linear-gradient(180deg, #000a00, #001a00)' },
  { id: 'stars',    label: 'Stars',    preview: 'linear-gradient(180deg, #06051a, #12103a)' },
  { id: 'waves',    label: 'Waves',    preview: 'linear-gradient(180deg, #0d1520, #0a1929)' },
  { id: 'bubbles',  label: 'Bubbles',  preview: 'linear-gradient(135deg, #0d1520, #0d2030)' },
];

export default function AnimatedBackground({ type = 'hexagons' }) {
  switch (type) {
    case 'aurora': return <AuroraBackground />;
    case 'particles': return <ParticleBackground />;
    case 'matrix': return <MatrixBackground />;
    case 'stars': return <StarsBackground />;
    case 'waves': return <WavesBackground />;
    case 'bubbles': return <BubblesBackground />;
    default: return <HexBackground />;
  }
}
