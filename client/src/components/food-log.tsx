import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Trash2, ClipboardList, CalendarDays,
  ChevronLeft, ChevronRight, ChevronDown, BookOpen, UtensilsCrossed,
} from "lucide-react";
import type { SavedMealPlan } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────────────────

interface FoodLogEntry {
  id: number;
  date: string;
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
}

export interface PrefillEntry {
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodLogProps {
  dailyCaloriesTarget?: number;
  dailyProteinTarget?: number;
  dailyCarbsTarget?: number;
  dailyFatTarget?: number;
  prefill?: PrefillEntry | null;
  onPrefillConsumed?: () => void;
}

interface PlanMeal {
  slot: string;
  meal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateStr(dt);
}

function getWeekRange(): { from: string; to: string; days: string[] } {
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7));
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(toDateStr(d));
  }
  return { from: days[0], to: days[6], days };
}

const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const WEEK_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snacks"] as const;

function extractPlanMeals(plan: SavedMealPlan, selectedDay?: string): PlanMeal[] {
  const data = plan.planData as any;
  const meals: PlanMeal[] = [];
  if (plan.planType === "daily") {
    for (const slot of MEAL_SLOTS) {
      for (const m of (data[slot] ?? [])) {
        meals.push({ slot: slot.charAt(0).toUpperCase() + slot.slice(1), ...m, meal: m.meal });
      }
    }
  } else {
    const dayKey = selectedDay ?? "monday";
    const dayPlan = (data.dayMealPlan ?? {})[dayKey] ?? {};
    for (const slot of MEAL_SLOTS) {
      for (const m of (dayPlan[slot] ?? [])) {
        meals.push({ slot: slot.charAt(0).toUpperCase() + slot.slice(1), ...m, meal: m.meal });
      }
    }
  }
  return meals;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const over = value > max && max > 0;
  return (
    <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${over ? "bg-red-400" : color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MacroGrid({
  cal, prot, carbs, fat,
  calTarget, protTarget, carbsTarget, fatTarget,
}: {
  cal: number; prot: number; carbs: number; fat: number;
  calTarget?: number; protTarget?: number; carbsTarget?: number; fatTarget?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {[
        { label: "Calories", value: cal, target: calTarget, color: "bg-orange-400", unit: "kcal" },
        { label: "Protein", value: prot, target: protTarget, color: "bg-red-400", unit: "g" },
        { label: "Carbs", value: carbs, target: carbsTarget, color: "bg-blue-400", unit: "g" },
        { label: "Fat", value: fat, target: fatTarget, color: "bg-yellow-400", unit: "g" },
      ].map(({ label, value, target, color, unit }) => (
        <div key={label} className="bg-zinc-50 rounded-xl p-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-zinc-500 font-medium">{label}</span>
            <span className="text-xs font-bold text-zinc-900">
              {value}<span className="font-normal text-zinc-400">/{target ?? "–"}{unit}</span>
            </span>
          </div>
          <ProgressBar value={value} max={target ?? 0} color={color} />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function FoodLog({
  dailyCaloriesTarget, dailyProteinTarget, dailyCarbsTarget, dailyFatTarget,
  prefill, onPrefillConsumed,
}: FoodLogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = todayStr();

  // View state
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [selectedDate, setSelectedDate] = useState(today);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formTab, setFormTab] = useState<"manual" | "plan">("manual");
  const [form, setForm] = useState({ mealName: "", calories: "", protein: "", carbs: "", fat: "" });

  // Plan picker state
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);
  const [selectedWeekDay, setSelectedWeekDay] = useState<string>("monday");

  const weekRange = getWeekRange();

  // Prefill from meal-plan card log button
  useEffect(() => {
    if (prefill) {
      setForm({
        mealName: prefill.mealName,
        calories: String(prefill.calories),
        protein: String(prefill.protein),
        carbs: String(prefill.carbs),
        fat: String(prefill.fat),
      });
      setView("daily");
      setSelectedDate(today);
      setShowForm(true);
      setFormTab("manual");
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: dailyEntries = [], isLoading: dailyLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?date=${selectedDate}`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load food log");
      return res.json();
    },
    enabled: view === "daily",
  });

  const { data: weeklyEntries = [], isLoading: weeklyLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log-week", weekRange.from, weekRange.to],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?from=${weekRange.from}&to=${weekRange.to}`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load weekly food log");
      return res.json();
    },
    enabled: view === "weekly",
  });

  const { data: savedPlans = [], isLoading: plansLoading } = useQuery<SavedMealPlan[]>({
    queryKey: ["/api/saved-meal-plans"],
    queryFn: async () => {
      const res = await fetch("/api/saved-meal-plans", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load saved plans");
      return res.json();
    },
    enabled: showForm && formTab === "plan",
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: (entry: { date: string; mealName: string; calories: number; protein: number; carbs: number; fat: number }) =>
      apiRequest("POST", "/api/food-log", entry).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week", weekRange.from, weekRange.to] });
      setForm({ mealName: "", calories: "", protein: "", carbs: "", fat: "" });
      setShowForm(false);
      toast({ title: "Meal logged" });
    },
    onError: () => toast({ title: "Failed to log meal", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/food-log/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week", weekRange.from, weekRange.to] });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.mealName.trim()) return;
    addMutation.mutate({
      date: selectedDate,
      mealName: form.mealName.trim(),
      calories: parseInt(form.calories) || 0,
      protein: parseInt(form.protein) || 0,
      carbs: parseInt(form.carbs) || 0,
      fat: parseInt(form.fat) || 0,
    });
  }

  function openFormForDay(date: string) {
    setSelectedDate(date);
    setView("daily");
    setShowForm(true);
    setFormTab("manual");
    setForm({ mealName: "", calories: "", protein: "", carbs: "", fat: "" });
  }

  function prefillFromPlan(meal: PlanMeal) {
    setForm({
      mealName: meal.meal,
      calories: String(meal.calories),
      protein: String(meal.protein),
      carbs: String(meal.carbs),
      fat: String(meal.fat),
    });
    setFormTab("manual");
  }

  function toggleFormOpen() {
    setShowForm(v => !v);
    if (!showForm) {
      setFormTab("manual");
      setForm({ mealName: "", calories: "", protein: "", carbs: "", fat: "" });
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const isToday = selectedDate === today;

  const totalCal = dailyEntries.reduce((s, e) => s + e.calories, 0);
  const totalProt = dailyEntries.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = dailyEntries.reduce((s, e) => s + e.carbs, 0);
  const totalFat = dailyEntries.reduce((s, e) => s + e.fat, 0);

  const weekTotalCal = weeklyEntries.reduce((s, e) => s + e.calories, 0);
  const weekTotalProt = weeklyEntries.reduce((s, e) => s + e.protein, 0);
  const weekTotalCarbs = weeklyEntries.reduce((s, e) => s + e.carbs, 0);
  const weekTotalFat = weeklyEntries.reduce((s, e) => s + e.fat, 0);

  const entriesByDay = weekRange.days.reduce<Record<string, FoodLogEntry[]>>((acc, d) => {
    acc[d] = weeklyEntries.filter(e => e.date === d);
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6">

      {/* ── Header row 1: Title ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-violet-100 text-violet-600 rounded-lg shrink-0">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Food Log</h2>
          <p className="text-xs text-zinc-500">
            {view === "daily" ? (isToday ? "Track what you eat today" : `Logging for ${formatDateLabel(selectedDate)}`) : "This week's nutrition"}
          </p>
        </div>
      </div>

      {/* ── Header row 2: Toolbar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center bg-zinc-100 rounded-xl p-0.5" data-testid="toggle-food-log-view">
          <button
            onClick={() => setView("daily")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === "daily" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-view-daily"
          >
            Daily
          </button>
          <button
            onClick={() => setView("weekly")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === "weekly" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-view-weekly"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Weekly
          </button>
        </div>

        <button
          onClick={toggleFormOpen}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
          data-testid="button-add-log-entry"
        >
          <Plus className="w-4 h-4" />
          Log Meal
        </button>
      </div>

      {/* ── Log-meal form (shown in both views) ────────────────────────── */}
      {showForm && (
        <div className="mb-4 bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-zinc-200">
            <button
              type="button"
              onClick={() => setFormTab("manual")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${formTab === "manual" ? "bg-white text-zinc-900 border-b-2 border-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}
              data-testid="button-form-tab-manual"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              Manual entry
            </button>
            <button
              type="button"
              onClick={() => setFormTab("plan")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${formTab === "plan" ? "bg-white text-zinc-900 border-b-2 border-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}
              data-testid="button-form-tab-plan"
            >
              <BookOpen className="w-3.5 h-3.5" />
              From saved plan
            </button>
          </div>

          {/* Manual entry tab */}
          {formTab === "manual" && (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {!isToday && view === "daily" && (
                <p className="text-[11px] text-violet-600 font-medium bg-violet-50 rounded-lg px-2.5 py-1.5">
                  Logging to {formatDateLabel(selectedDate)}
                </p>
              )}
              <input
                type="text"
                required
                placeholder="Meal name"
                value={form.mealName}
                onChange={e => setForm(f => ({ ...f, mealName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                data-testid="input-log-meal-name"
              />
              <div className="grid grid-cols-4 gap-2">
                {(["calories", "protein", "carbs", "fat"] as const).map(field => (
                  <div key={field}>
                    <label className="text-[10px] text-zinc-500 capitalize">
                      {field === "calories" ? "kcal" : field + " g"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form[field]}
                      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 text-center bg-white"
                      placeholder="0"
                      data-testid={`input-log-${field}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="flex-1 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  data-testid="button-log-save"
                >
                  {addMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors"
                  data-testid="button-log-cancel"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* From saved plan tab */}
          {formTab === "plan" && (
            <div className="p-4">
              {plansLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : savedPlans.length === 0 ? (
                <div className="text-center py-6 text-zinc-400">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No saved plans yet.</p>
                  <p className="text-xs mt-1">Generate a meal plan to save it here.</p>
                </div>
              ) : (
                <div className="space-y-2" data-testid="plan-picker-list">
                  {savedPlans.map(plan => {
                    const isOpen = expandedPlanId === plan.id;
                    const planMeals = extractPlanMeals(plan, plan.planType === "weekly" ? selectedWeekDay : undefined);
                    return (
                      <div key={plan.id} className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => setExpandedPlanId(isOpen ? null : plan.id)}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-50 transition-colors text-left"
                          data-testid={`button-expand-plan-${plan.id}`}
                        >
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">{plan.name}</p>
                            <p className="text-xs text-zinc-400 mt-0.5 capitalize">
                              {plan.planType} · {plan.mealStyle ?? "simple"}
                            </p>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isOpen && (
                          <div className="border-t border-zinc-100 px-3 pb-3 pt-2">
                            {/* Day selector for weekly plans */}
                            {plan.planType === "weekly" && (
                              <div className="flex gap-1 mb-3 flex-wrap">
                                {WEEK_DAYS.map((d, i) => (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => setSelectedWeekDay(d)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${selectedWeekDay === d ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
                                    data-testid={`button-week-day-${d}`}
                                  >
                                    {WEEK_SHORT[i]}
                                  </button>
                                ))}
                              </div>
                            )}

                            {planMeals.length === 0 ? (
                              <p className="text-xs text-zinc-400 py-2">No meals found.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {planMeals.map((m, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => prefillFromPlan(m)}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50 hover:bg-violet-50 hover:border-violet-200 border border-transparent transition-colors text-left"
                                    data-testid={`button-plan-meal-${idx}`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-zinc-900 truncate">{m.meal}</p>
                                      <p className="text-[10px] text-zinc-400 mt-0.5">{m.slot}</p>
                                    </div>
                                    <div className="text-right ml-3 shrink-0">
                                      <p className="text-xs font-bold text-zinc-900">{m.calories} kcal</p>
                                      <p className="text-[10px] text-zinc-400">P:{m.protein}g C:{m.carbs}g F:{m.fat}g</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="mt-3 w-full py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors"
                data-testid="button-log-cancel-plan"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Daily View ─────────────────────────────────────────────────── */}
      {view === "daily" && (
        <>
          {/* Day navigation */}
          <div className="flex items-center justify-between mb-4 bg-zinc-50 rounded-xl px-2 py-1.5">
            <button
              onClick={() => setSelectedDate(d => shiftDate(d, -1))}
              className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
              data-testid="button-prev-day"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center">
              <span className="text-sm font-semibold text-zinc-800" data-testid="text-log-date">
                {isToday ? "Today" : formatDateLabel(selectedDate)}
              </span>
              {isToday && (
                <span className="block text-[10px] text-zinc-400">{formatDateLabel(selectedDate)}</span>
              )}
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(today)}
                  className="block mx-auto text-[10px] text-violet-500 hover:text-violet-700 font-medium transition-colors mt-0.5"
                  data-testid="button-go-to-today"
                >
                  Back to today
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedDate(d => shiftDate(d, 1))}
              disabled={selectedDate >= today}
              className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="button-next-day"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Macro progress bars */}
          <MacroGrid
            cal={totalCal} prot={totalProt} carbs={totalCarbs} fat={totalFat}
            calTarget={dailyCaloriesTarget} protTarget={dailyProteinTarget}
            carbsTarget={dailyCarbsTarget} fatTarget={dailyFatTarget}
          />

          {/* Entry list */}
          {dailyLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            </div>
          ) : dailyEntries.length === 0 ? (
            <div className="text-center py-6 text-zinc-400">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No entries for {isToday ? "today" : formatDateLabel(selectedDate)}.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dailyEntries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 p-3 bg-zinc-50 rounded-xl border border-transparent hover:border-zinc-200 transition-colors"
                  data-testid={`log-entry-${entry.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{entry.mealName}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {entry.calories} kcal &nbsp;·&nbsp; P: {entry.protein}g &nbsp;·&nbsp; C: {entry.carbs}g &nbsp;·&nbsp; F: {entry.fat}g
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(entry.id)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    data-testid={`button-delete-log-${entry.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Weekly View ────────────────────────────────────────────────── */}
      {view === "weekly" && (
        <>
          <MacroGrid
            cal={weekTotalCal} prot={weekTotalProt} carbs={weekTotalCarbs} fat={weekTotalFat}
            calTarget={dailyCaloriesTarget ? dailyCaloriesTarget * 7 : undefined}
            protTarget={dailyProteinTarget ? dailyProteinTarget * 7 : undefined}
            carbsTarget={dailyCarbsTarget ? dailyCarbsTarget * 7 : undefined}
            fatTarget={dailyFatTarget ? dailyFatTarget * 7 : undefined}
          />

          {weeklyLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            </div>
          ) : (
            <div className="space-y-1" data-testid="weekly-log-table">
              {weekRange.days.map(d => {
                const dayEntries = entriesByDay[d] ?? [];
                const dayCal = dayEntries.reduce((s, e) => s + e.calories, 0);
                const dayProt = dayEntries.reduce((s, e) => s + e.protein, 0);
                const dayCarbs = dayEntries.reduce((s, e) => s + e.carbs, 0);
                const dayFat = dayEntries.reduce((s, e) => s + e.fat, 0);
                const isDayToday = d === today;

                return (
                  <div
                    key={d}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs ${isDayToday ? "bg-violet-50 border border-violet-100" : "bg-zinc-50"}`}
                    data-testid={`weekly-day-${d}`}
                  >
                    <span className={`font-semibold shrink-0 w-[90px] ${isDayToday ? "text-violet-700" : "text-zinc-700"}`}>
                      {formatDateLabel(d).split(",")[0] ?? formatDateLabel(d)}
                      {isDayToday && <span className="ml-1 text-[10px] text-violet-400 font-normal">today</span>}
                    </span>

                    <div className="flex-1 min-w-0">
                      {dayEntries.length > 0 ? (
                        <span className="text-zinc-500">
                          <span className="font-semibold text-zinc-900">{dayCal}</span> kcal
                          <span className="text-zinc-400 ml-1.5 hidden sm:inline">P:{dayProt}g C:{dayCarbs}g F:{dayFat}g</span>
                        </span>
                      ) : (
                        <span className="text-zinc-300 italic">—</span>
                      )}
                    </div>

                    <button
                      onClick={() => openFormForDay(d)}
                      className={`shrink-0 p-1.5 rounded-lg transition-colors ${isDayToday ? "text-violet-500 hover:bg-violet-100" : "text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"}`}
                      title={`Log meal for ${formatDateLabel(d)}`}
                      data-testid={`button-log-for-day-${d}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
