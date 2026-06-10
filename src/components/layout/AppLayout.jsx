import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

function GeometricBackground() {
  // Hexagon grid pattern — two drifting layers for parallax feel
  const hexPath = "M 50 0 L 93.3 25 L 93.3 75 L 50 100 L 6.7 75 L 6.7 25 Z";
  const cols = 8;
  const rows = 16;
  const W = 100;
  const H = 86.6;

  const hexes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * W + (r % 2 === 1 ? W / 2 : 0);
      const y = r * H * 0.75;
      hexes.push({ x, y, key: `${r}-${c}` });
    }
  }

  return (
    <div className="geo-bg">
      {/* Layer 1 — slower drift */}
      <svg className="geo-layer-1" viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid slice">
        <g stroke="rgba(34,211,238,0.22)" strokeWidth="1" fill="none">
          {hexes.map(({ x, y, key }) => (
            <path key={key} d={hexPath} transform={`translate(${x - 50}, ${y})`} />
          ))}
        </g>
      </svg>
      {/* Layer 2 — faster counter-drift, slightly offset */}
      <svg
        className="geo-layer-2"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 800 1200"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="rgba(34,211,238,0.11)" strokeWidth="1.5" fill="none">
          {hexes.map(({ x, y, key }) => (
            <path key={`2-${key}`} d={hexPath} transform={`translate(${x}, ${y + 43})`} />
          ))}
        </g>
      </svg>
      {/* Subtle radial glow in center */}
      <div
        className="geo-glow"
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "60vw",
          height: "60vw",
          maxWidth: 400,
          maxHeight: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default function AppLayout() {
  return (
    <div className="relative min-h-screen">
      <GeometricBackground />
      <main className="relative z-10 pb-24 max-w-lg mx-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}