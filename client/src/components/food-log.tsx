import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ClipboardList, CalendarDays } from "lucide-react";

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

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDateLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
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
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return { from: days[0], to: days[6], days };
}

function dayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

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

export function FoodLog({ dailyCaloriesTarget, dailyProteinTarget, dailyCarbsTarget, dailyFatTarget, prefill, onPrefillConsumed }: FoodLogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const date = todayStr();
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ mealName: "", calories: "", protein: "", carbs: "", fat: "" });

  const weekRange = getWeekRange();

  useEffect(() => {
    if (prefill) {
      setForm({
        mealName: prefill.mealName,
        calories: String(prefill.calories),
        protein: String(prefill.protein),
        carbs: String(prefill.carbs),
        fat: String(prefill.fat),
      });
      setShowForm(true);
      setView("daily");
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);

  const { data: dailyEntries = [], isLoading: dailyLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log", date],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?date=${date}`, { credentials: "include" });
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

  const addMutation = useMutation({
    mutationFn: (entry: { date: string; mealName: string; calories: number; protein: number; carbs: number; fat: number }) =>
      apiRequest("POST", "/api/food-log", entry).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log", date] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/food-log", date] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week", weekRange.from, weekRange.to] });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.mealName.trim()) return;
    addMutation.mutate({
      date,
      mealName: form.mealName.trim(),
      calories: parseInt(form.calories) || 0,
      protein: parseInt(form.protein) || 0,
      carbs: parseInt(form.carbs) || 0,
      fat: parseInt(form.fat) || 0,
    });
  }

  const totalCal = dailyEntries.reduce((s, e) => s + e.calories, 0);
  const totalProt = dailyEntries.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = dailyEntries.reduce((s, e) => s + e.carbs, 0);
  const totalFat = dailyEntries.reduce((s, e) => s + e.fat, 0);

  const weeklyCaloriesTarget = dailyCaloriesTarget ? dailyCaloriesTarget * 7 : undefined;
  const weeklyProteinTarget = dailyProteinTarget ? dailyProteinTarget * 7 : undefined;
  const weeklyCarbsTarget = dailyCarbsTarget ? dailyCarbsTarget * 7 : undefined;
  const weeklyFatTarget = dailyFatTarget ? dailyFatTarget * 7 : undefined;

  const weekTotalCal = weeklyEntries.reduce((s, e) => s + e.calories, 0);
  const weekTotalProt = weeklyEntries.reduce((s, e) => s + e.protein, 0);
  const weekTotalCarbs = weeklyEntries.reduce((s, e) => s + e.carbs, 0);
  const weekTotalFat = weeklyEntries.reduce((s, e) => s + e.fat, 0);

  const entriesByDay = weekRange.days.reduce<Record<string, FoodLogEntry[]>>((acc, d) => {
    acc[d] = weeklyEntries.filter(e => e.date === d);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-violet-100 text-violet-600 rounded-lg">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Food Log</h2>
            <p className="text-xs text-zinc-500">{view === "daily" ? "Track what you eat today" : "This week's nutrition"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

          {view === "daily" && (
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
              data-testid="button-add-log-entry"
            >
              <Plus className="w-4 h-4" />
              Log Meal
            </button>
          )}
        </div>
      </div>

      {/* ── Daily View ─────────────────────────────────────────────────── */}
      {view === "daily" && (
        <>
          <div className="flex items-center justify-center mb-5 bg-zinc-50 rounded-xl px-4 py-2">
            <span className="text-sm font-medium text-zinc-700" data-testid="text-log-date">
              Today &middot; {formatDateLabel()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Calories", value: totalCal, target: dailyCaloriesTarget, color: "bg-orange-400", unit: "kcal" },
              { label: "Protein", value: totalProt, target: dailyProteinTarget, color: "bg-red-400", unit: "g" },
              { label: "Carbs", value: totalCarbs, target: dailyCarbsTarget, color: "bg-blue-400", unit: "g" },
              { label: "Fat", value: totalFat, target: dailyFatTarget, color: "bg-yellow-400", unit: "g" },
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

          {showForm && (
            <form onSubmit={handleSubmit} className="mb-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
              <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">Add entry</p>
              <input
                type="text"
                required
                placeholder="Meal name"
                value={form.mealName}
                onChange={e => setForm(f => ({ ...f, mealName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
                data-testid="input-log-meal-name"
              />
              <div className="grid grid-cols-4 gap-2">
                {(["calories", "protein", "carbs", "fat"] as const).map(field => (
                  <div key={field}>
                    <label className="text-[10px] text-zinc-500 capitalize">{field === "calories" ? "kcal" : field + " g"}</label>
                    <input
                      type="number"
                      min={0}
                      value={form[field]}
                      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 text-center"
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

          {dailyLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            </div>
          ) : dailyEntries.length === 0 ? (
            <div className="text-center py-6 text-zinc-400">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No entries for today.</p>
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
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Calories", value: weekTotalCal, target: weeklyCaloriesTarget, color: "bg-orange-400", unit: "kcal" },
              { label: "Protein", value: weekTotalProt, target: weeklyProteinTarget, color: "bg-red-400", unit: "g" },
              { label: "Carbs", value: weekTotalCarbs, target: weeklyCarbsTarget, color: "bg-blue-400", unit: "g" },
              { label: "Fat", value: weekTotalFat, target: weeklyFatTarget, color: "bg-yellow-400", unit: "g" },
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
                const isToday = d === date;
                const hasEntries = dayEntries.length > 0;

                return (
                  <div
                    key={d}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs ${isToday ? "bg-violet-50 border border-violet-100" : "bg-zinc-50"}`}
                    data-testid={`weekly-day-${d}`}
                  >
                    <span className={`font-semibold w-24 shrink-0 ${isToday ? "text-violet-700" : "text-zinc-700"}`}>
                      {dayLabel(d)}{isToday && <span className="ml-1 text-[10px] text-violet-400 font-normal">today</span>}
                    </span>
                    {hasEntries ? (
                      <span className="text-zinc-500 text-right">
                        <span className="font-semibold text-zinc-900">{dayCal}</span> kcal
                        <span className="text-zinc-400 ml-1.5">P:{dayProt}g C:{dayCarbs}g F:{dayFat}g</span>
                      </span>
                    ) : (
                      <span className="text-zinc-300 italic">—</span>
                    )}
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
