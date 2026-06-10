import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, X, Dumbbell, Apple,
  Flame, Clock, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { workoutsService, nutritionService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";

// ── Constants ──────────────────────────────────────────────────────────────

const WORKOUT_TYPES = [
  "Strength", "Cardio", "HIIT", "Yoga / Flexibility",
  "Running", "Cycling", "Swimming", "Sports", "Walk", "Other",
];

const WORKOUT_TYPE_ICONS = {
  "Strength": "🏋️", "Cardio": "🏃", "HIIT": "⚡", "Yoga / Flexibility": "🧘",
  "Running": "👟", "Cycling": "🚴", "Swimming": "🏊", "Sports": "⚽", "Walk": "🚶", "Other": "💪",
};

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-workout", "Post-workout"];

const MEAL_TYPE_ICONS = {
  "Breakfast": "🌅", "Lunch": "☀️", "Dinner": "🌙",
  "Snack": "🍎", "Pre-workout": "⚡", "Post-workout": "💧",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getEntryDate(item) {
  if (item.date) return parseISO(item.date);
  if (item.createdAt?.toDate) return item.createdAt.toDate();
  return new Date();
}

function MacroBadge({ label, value, unit = "g", color }) {
  if (!value && value !== 0) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${color}`}>
      {label} {value}{unit}
    </span>
  );
}

// ── Workout form ──────────────────────────────────────────────────────────

function WorkoutForm({ onSave, onCancel, isPending }) {
  const [form, setForm] = useState({
    name: "", type: "Strength", date: format(new Date(), "yyyy-MM-dd"),
    duration: "", calories: "", notes: "",
  });
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v.target ? v.target.value : v }));

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="p-4 rounded-2xl bg-card border border-purple-500/30 mb-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-semibold text-purple-400">Log Workout</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>

      <Input value={form.name} onChange={f("name")} placeholder="Workout name (e.g. Morning Run, Chest Day)" className="rounded-xl" autoFocus />

      <div className="relative">
        <select value={form.type} onChange={f("type")}
          className="w-full appearance-none bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent/30 pr-8">
          {WORKOUT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex rounded-xl overflow-hidden border border-border">
          <span className="bg-muted px-3 flex items-center text-xs text-muted-foreground border-r border-border shrink-0">mins</span>
          <Input value={form.duration} onChange={f("duration")} placeholder="Duration" type="number" min="1" className="border-0 rounded-none" />
        </div>
        <div className="flex rounded-xl overflow-hidden border border-border">
          <span className="bg-muted px-3 flex items-center text-xs text-muted-foreground border-r border-border shrink-0"><Flame className="w-3 h-3" /></span>
          <Input value={form.calories} onChange={f("calories")} placeholder="Cal burned" type="number" min="0" className="border-0 rounded-none" />
        </div>
      </div>

      <Input type="date" value={form.date} onChange={f("date")} className="rounded-xl" />

      <textarea value={form.notes} onChange={f("notes")} placeholder="Notes (exercises, distance, how you felt...)"
        rows={2} className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/30" />

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="flex-1 rounded-xl">Cancel</Button>
        <Button size="sm" disabled={!form.name.trim() || isPending}
          onClick={() => onSave({ ...form, duration: form.duration ? parseInt(form.duration) : null, calories: form.calories ? parseInt(form.calories) : null })}
          className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white">Save</Button>
      </div>
    </motion.div>
  );
}

// ── Nutrition form ─────────────────────────────────────────────────────────

function NutritionForm({ onSave, onCancel, isPending }) {
  const [form, setForm] = useState({
    name: "", mealType: "Breakfast", date: format(new Date(), "yyyy-MM-dd"),
    calories: "", protein: "", carbs: "", fat: "", notes: "",
  });
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v.target ? v.target.value : v }));

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="p-4 rounded-2xl bg-card border border-emerald-500/30 mb-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-semibold text-emerald-400">Log Meal</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>

      <Input value={form.name} onChange={f("name")} placeholder="Meal name (e.g. Chicken & rice, Protein shake)" className="rounded-xl" autoFocus />

      <div className="relative">
        <select value={form.mealType} onChange={f("mealType")}
          className="w-full appearance-none bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent/30 pr-8">
          {MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <div className="flex rounded-xl overflow-hidden border border-border">
        <span className="bg-muted px-3 flex items-center text-xs text-muted-foreground border-r border-border shrink-0"><Flame className="w-3 h-3 mr-1" />kcal</span>
        <Input value={form.calories} onChange={f("calories")} placeholder="Calories" type="number" min="0" className="border-0 rounded-none" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[["protein", "Protein g", "text-blue-400"], ["carbs", "Carbs g", "text-amber-400"], ["fat", "Fat g", "text-rose-400"]].map(([key, label, cls]) => (
          <div key={key} className="flex flex-col gap-1">
            <span className={`text-[10px] font-medium ${cls}`}>{label}</span>
            <Input value={form[key]} onChange={f(key)} placeholder="0" type="number" min="0" step="0.1" className="rounded-xl text-sm" />
          </div>
        ))}
      </div>

      <Input type="date" value={form.date} onChange={f("date")} className="rounded-xl" />

      <textarea value={form.notes} onChange={f("notes")} placeholder="Notes (optional)"
        rows={1} className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/30" />

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="flex-1 rounded-xl">Cancel</Button>
        <Button size="sm" disabled={!form.name.trim() || isPending}
          onClick={() => onSave({
            ...form,
            calories: form.calories ? parseInt(form.calories) : null,
            protein: form.protein ? parseFloat(form.protein) : null,
            carbs: form.carbs ? parseFloat(form.carbs) : null,
            fat: form.fat ? parseFloat(form.fat) : null,
          })}
          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">Save</Button>
      </div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Fitness() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uid = useCurrentUid();
  const [tab, setTab] = useState("workouts");
  const [showForm, setShowForm] = useState(false);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const todayStr = format(today, "yyyy-MM-dd");

  // ── Workouts ──
  const { data: workouts = [], isLoading: loadingWorkouts } = useQuery({
    queryKey: ["workouts", uid],
    queryFn: () => workoutsService.list(uid),
    enabled: !!uid,
  });

  const createWorkout = useMutation({
    mutationFn: (data) => workoutsService.create(uid, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workouts", uid] }); setShowForm(false); toast.success("Workout logged!"); },
  });

  const deleteWorkout = useMutation({
    mutationFn: (id) => workoutsService.delete(uid, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts", uid] }),
  });

  // ── Nutrition ──
  const { data: meals = [], isLoading: loadingNutrition } = useQuery({
    queryKey: ["nutrition", uid],
    queryFn: () => nutritionService.list(uid),
    enabled: !!uid,
  });

  const createMeal = useMutation({
    mutationFn: (data) => nutritionService.create(uid, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["nutrition", uid] }); setShowForm(false); toast.success("Meal logged!"); },
  });

  const deleteMeal = useMutation({
    mutationFn: (id) => nutritionService.delete(uid, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition", uid] }),
  });

  // ── Weekly workout summary ──
  const thisWeekWorkouts = useMemo(() =>
    workouts.filter((w) => isWithinInterval(getEntryDate(w), { start: weekStart, end: weekEnd })),
    [workouts, weekStart, weekEnd]
  );
  const weekStats = useMemo(() => ({
    sessions: thisWeekWorkouts.length,
    minutes: thisWeekWorkouts.reduce((s, w) => s + (w.duration || 0), 0),
    calories: thisWeekWorkouts.reduce((s, w) => s + (w.calories || 0), 0),
  }), [thisWeekWorkouts]);

  // ── Today's nutrition summary ──
  const todayMeals = useMemo(() =>
    meals.filter((m) => {
      const d = getEntryDate(m);
      return isWithinInterval(d, { start: startOfDay(today), end: endOfDay(today) });
    }),
    [meals, todayStr]
  );
  const todayNutrition = useMemo(() => ({
    calories: todayMeals.reduce((s, m) => s + (m.calories || 0), 0),
    protein: todayMeals.reduce((s, m) => s + (m.protein || 0), 0),
    carbs: todayMeals.reduce((s, m) => s + (m.carbs || 0), 0),
    fat: todayMeals.reduce((s, m) => s + (m.fat || 0), 0),
  }), [todayMeals]);

  const isWorkouts = tab === "workouts";
  const isLoading = isWorkouts ? loadingWorkouts : loadingNutrition;
  const items = isWorkouts ? workouts : meals;

  return (
    <div className="px-4 pt-12 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-display font-bold">Fitness</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}
          className={`rounded-xl text-white gap-1.5 ${isWorkouts ? "bg-purple-600 hover:bg-purple-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
          <Plus className="w-3.5 h-3.5" />{isWorkouts ? "Workout" : "Meal"}
        </Button>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border/50 mb-5">
        <button onClick={() => { setTab("workouts"); setShowForm(false); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${tab === "workouts" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Dumbbell className="w-3.5 h-3.5" />Workouts
        </button>
        <button onClick={() => { setTab("nutrition"); setShowForm(false); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${tab === "nutrition" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Apple className="w-3.5 h-3.5" />Nutrition
        </button>
      </div>

      {/* Summary cards */}
      {tab === "workouts" && workouts.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
            <p className="text-2xl font-display font-bold text-purple-400">{weekStats.sessions}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Sessions</p>
            <p className="text-[10px] text-muted-foreground">this week</p>
          </div>
          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
            <p className="text-2xl font-display font-bold text-purple-400">{weekStats.minutes}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Minutes</p>
            <p className="text-[10px] text-muted-foreground">this week</p>
          </div>
          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
            <p className="text-2xl font-display font-bold text-purple-400">{weekStats.calories || "—"}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Cal burned</p>
            <p className="text-[10px] text-muted-foreground">this week</p>
          </div>
        </div>
      )}

      {tab === "nutrition" && meals.length > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-5">
          <p className="text-[10px] font-heading font-semibold text-emerald-400 uppercase tracking-wider mb-2">Today</p>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-2xl font-display font-bold text-emerald-400">{todayNutrition.calories}</span>
            <span className="text-xs text-muted-foreground">kcal</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <MacroBadge label="Protein" value={todayNutrition.protein ? Math.round(todayNutrition.protein) : null} color="bg-blue-500/20 text-blue-300" />
            <MacroBadge label="Carbs" value={todayNutrition.carbs ? Math.round(todayNutrition.carbs) : null} color="bg-amber-500/20 text-amber-300" />
            <MacroBadge label="Fat" value={todayNutrition.fat ? Math.round(todayNutrition.fat) : null} color="bg-rose-500/20 text-rose-300" />
          </div>
        </div>
      )}

      {/* Form */}
      <AnimatePresence>
        {showForm && tab === "workouts" && (
          <WorkoutForm onSave={(data) => createWorkout.mutate(data)} onCancel={() => setShowForm(false)} isPending={createWorkout.isPending} />
        )}
        {showForm && tab === "nutrition" && (
          <NutritionForm onSave={(data) => createMeal.mutate(data)} onCancel={() => setShowForm(false)} isPending={createMeal.isPending} />
        )}
      </AnimatePresence>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            {isWorkouts ? <Dumbbell className="w-7 h-7 text-muted-foreground" /> : <Apple className="w-7 h-7 text-muted-foreground" />}
          </div>
          <h3 className="font-heading font-semibold mb-1">No {isWorkouts ? "workouts" : "meals"} logged yet</h3>
          <p className="text-sm text-muted-foreground">Tap the button above to log your first {isWorkouts ? "session" : "meal"}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const date = getEntryDate(item);
              return isWorkouts ? (
                <motion.div key={item.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-border/50">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 text-lg">
                    {WORKOUT_TYPE_ICONS[item.type] || "💪"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded-md">{item.type}</span>
                      {item.duration && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{item.duration}m
                        </span>
                      )}
                      {item.calories && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Flame className="w-2.5 h-2.5" />{item.calories}
                        </span>
                      )}
                    </div>
                    {item.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{item.notes}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{format(date, "EEE, MMM d yyyy")}</p>
                  </div>
                  <button onClick={() => deleteWorkout.mutate(item.id)} className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ) : (
                <motion.div key={item.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-border/50">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 text-lg">
                    {MEAL_TYPE_ICONS[item.mealType] || "🍽️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded-md">{item.mealType}</span>
                      {item.calories && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Flame className="w-2.5 h-2.5" />{item.calories} kcal
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <MacroBadge label="P" value={item.protein ? Math.round(item.protein) : null} color="bg-blue-500/15 text-blue-300" />
                      <MacroBadge label="C" value={item.carbs ? Math.round(item.carbs) : null} color="bg-amber-500/15 text-amber-300" />
                      <MacroBadge label="F" value={item.fat ? Math.round(item.fat) : null} color="bg-rose-500/15 text-rose-300" />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{format(date, "EEE, MMM d yyyy")}</p>
                  </div>
                  <button onClick={() => deleteMeal.mutate(item.id)} className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
