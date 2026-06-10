import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import AnimatedBackground from "./AnimatedBackground";
import { useUserPrefs } from "@/hooks/useUserPrefs";

export default function AppLayout() {
  const { prefs } = useUserPrefs();

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground type={prefs.background || 'hexagons'} />
      <main className="relative z-10 pb-24 max-w-lg mx-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
