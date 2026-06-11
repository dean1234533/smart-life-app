import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import AnimatedBackground from "./AnimatedBackground";
import OfflineBanner from "@/components/OfflineBanner";
import { useUserPrefs } from "@/hooks/useUserPrefs";

export default function AppLayout() {
  const { prefs } = useUserPrefs();

  return (
    <div className="relative min-h-screen">
      <OfflineBanner />
      <AnimatedBackground type={prefs.background || 'hexagons'} />
      <main className="relative z-10 max-w-lg mx-auto w-full" style={{ paddingBottom: 'max(6rem, calc(5rem + env(safe-area-inset-bottom)))' }}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
