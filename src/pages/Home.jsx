import { useQuery } from "@tanstack/react-query";
import InstallBanner from "../components/InstallBanner";
import DailyBriefing from "../components/home/DailyBriefing";
import QuickActions from "../components/home/QuickActions";
import SmartSuggestions from "../components/home/SmartSuggestions";
import RecentActivity from "../components/home/RecentActivity";
import ThemePicker from "../components/ThemePicker";
import QuickNav from "../components/home/QuickNav";
import { useAuth } from "@/lib/AuthContext";
import { tasksService, notesService, recordingsService, memoriesService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { useWeather } from "@/hooks/useWeather";

export default function Home() {
  const uid = useCurrentUid();
  const { user, profile } = useAuth();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", uid],
    queryFn: () => tasksService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", uid],
    queryFn: () => notesService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const { data: recordings = [] } = useQuery({
    queryKey: ["recordings", uid],
    queryFn: () => recordingsService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const { data: memories = [] } = useQuery({
    queryKey: ["memories", uid],
    queryFn: () => memoriesService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const { weather, loading: weatherLoading, error: weatherError, permState, requestLocation } = useWeather();
  const pendingTasks = tasks.filter((t) => t.status === "pending");

  return (
    <div className="pt-12 space-y-6">
      <div className="flex justify-end items-center gap-2 px-4">
        <QuickNav />
        <ThemePicker uid={uid} />
      </div>
      <InstallBanner />
      <div className="px-4 space-y-6">
      <DailyBriefing
        user={profile}
        taskCount={pendingTasks.length}
        noteCount={notes.length}
        memoryCount={memories.length}
        weather={weather}
        weatherLoading={weatherLoading}
        weatherError={weatherError}
        permState={permState}
        requestLocation={requestLocation}
      />
      <QuickActions />
      <SmartSuggestions />
      <RecentActivity notes={notes} recordings={recordings} tasks={tasks} />
      </div>
    </div>
  );
}
