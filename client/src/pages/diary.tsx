import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  Loader2, Plus, Trash2, ClipboardList, CalendarDays,
  ChevronLeft, ChevronRight, ChevronDown, Check, Star,
  Sparkles, X, ArrowLeft,
} from "lucide-react";
import type { UserRecipe } from "@shared/schema";
import {
  type MealSlot, type FoodLogEntry, type PrefillEntry,
  SLOT_LABELS, SLOT_ICONS, SLOT_COLORS, ALL_SLOTS,
  todayStr, formatDateLabel, shiftDate,
  getWeekRange, formatWeekLabel,
  MacroGrid, LoggedMealModal,
} from "@/components/food-log-shared";
import { FoodLogDrawer } from "@/components/food-log-drawer";

interface DiaryProps {
  dailyCaloriesTarget?: number;
  dailyProteinTarget?: number;
  dailyCarbsTarget?: number;
  dailyFatTarget?: number;
  initialDate?: string;
}

export default function DiaryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: calcData } = useQuery<any>({
    queryKey: ["/api/calculations/latest"],
  });

  if (authLoading) return null;
  if (!user) {
    navigate("/auth");
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get("date") ?? undefined;

  const targets = {
    dailyCaloriesTarget: calcData?.dailyCalories ?? undefined,
    dailyProteinTarget: calcData?.proteinGoal ?? undefined,
    dailyCarbsTarget: calcData?.carbsGoal ?? undefined,
    dailyFatTarget: calcData?.fatGoal ?? undefined,
    initialDate: dateParam,
  };

  return <DiaryContent {...targets} />;
}

function DiaryContent({
  dailyCaloriesTarget,
  dailyProteinTarget,
  dailyCarbsTarget,
  dailyFatTarget,
  initialDate,
}: DiaryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = todayStr();

  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [selectedDate, setSelectedDate] = useState(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set([today]));

  const [selectedEntry, setSelectedEntry] = useState<FoodLogEntry | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [weeklyInsight, setWeeklyInsight] = useState<string | null>(null);
  const [weeklyInsightLoading, setWeeklyInsightLoading] = useState(false);
  const [weeklyInsightKey, setWeeklyInsightKey] = useState<string | null>(null);

  const isToday = selectedDate === today;
  const weekRange = getWeekRange(weekOffset);

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
    queryKey: ["/api/food-log-week", weekOffset, weekRange.from, weekRange.to],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?from=${weekRange.from}&to=${weekRange.to}`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load weekly food log");
      return res.json();
    },
    enabled: view === "weekly",
  });

  const { data: userRecipes = [] } = useQuery<UserRecipe[]>({
    queryKey: ["/api/recipes"],
    staleTime: 60_000,
  });

  const { data: favourites = [] } = useQuery<{ id: number; mealName: string }[]>({
    queryKey: ["/api/favourites"],
  });
  const favouriteNames = new Set(favourites.map(f => f.mealName));

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/food-log/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week"] });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/food-log/${id}/confirm`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week"] });
      toast({ title: "Meal confirmed" });
    },
    onError: () => toast({ title: "Failed to confirm", variant: "destructive" }),
  });

  const starMutation = useMutation({
    mutationFn: (entry: { mealName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot?: string | null }) =>
      apiRequest("POST", "/api/favourites", entry).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favourites"] });
      toast({ title: "Saved to favourites" });
    },
    onError: () => toast({ title: "Failed to save favourite", variant: "destructive" }),
  });

  const confirmedDaily = dailyEntries.filter(e => e.confirmed !== false);
  const plannedDaily = dailyEntries.filter(e => e.confirmed === false);
  const totalCal = confirmedDaily.reduce((s, e) => s + e.calories, 0);
  const totalProt = confirmedDaily.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = confirmedDaily.reduce((s, e) => s + e.carbs, 0);
  const totalFat = confirmedDaily.reduce((s, e) => s + e.fat, 0);
  const plannedCal = plannedDaily.reduce((s, e) => s + e.calories, 0);

  const confirmedWeekly = weeklyEntries.filter(e => e.confirmed !== false);
  const weekTotalCal = confirmedWeekly.reduce((s, e) => s + e.calories, 0);
  const weekTotalProt = confirmedWeekly.reduce((s, e) => s + e.protein, 0);
  const weekTotalCarbs = confirmedWeekly.reduce((s, e) => s + e.carbs, 0);
  const weekTotalFat = confirmedWeekly.reduce((s, e) => s + e.fat, 0);

  const entriesByDay = weekRange.days.reduce<Record<string, FoodLogEntry[]>>((acc, d) => {
    acc[d] = weeklyEntries.filter(e => e.date === d);
    return acc;
  }, {});

  function toggleDay(date: string) {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }

  function changeWeek(delta: number) {
    const nextOffset = weekOffset + delta;
    setWeekOffset(nextOffset);
    const nextRange = getWeekRange(nextOffset);
    if (nextRange.days.includes(today)) {
      setExpandedDays(new Set([today]));
    } else {
      setExpandedDays(new Set());
    }
  }

  async function handleFetchWeeklyInsights() {
    if (weeklyInsightLoading) return;
    const key = weekRange.from;
    setWeeklyInsightLoading(true);
    if (weeklyInsightKey !== key) setWeeklyInsight(null);
    setWeeklyInsightKey(key);
    try {
      const dayEntries = weekRange.days.map(d => {
        const es = entriesByDay[d] ?? [];
        const conf = es.filter(e => e.confirmed !== false);
        return {
          date: d,
          calories: conf.reduce((s, e) => s + e.calories, 0),
          protein: conf.reduce((s, e) => s + e.protein, 0),
          carbs: conf.reduce((s, e) => s + e.carbs, 0),
          fat: conf.reduce((s, e) => s + e.fat, 0),
        };
      }).filter(d => d.calories > 0);

      const resp = await fetch("/api/food-log/weekly-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: dayEntries,
          targets: {
            calories: dailyCaloriesTarget ?? 2000,
            protein: dailyProteinTarget ?? 150,
            carbs: dailyCarbsTarget ?? 200,
            fat: dailyFatTarget ?? 65,
          },
          weekLabel: weekOffset === 0 ? "this week" : `${weekRange.from} to ${weekRange.to}`,
        }),
        credentials: "include",
      });
      const data = await resp.json();
      setWeeklyInsight(data.summary ?? null);
    } catch {
      setWeeklyInsight("Unable to generate insights right now.");
    } finally {
      setWeeklyInsightLoading(false);
    }
  }

  function renderEntryRow(entry: FoodLogEntry) {
    const slot = entry.mealSlot as MealSlot | null;
    const SlotIcon = slot ? SLOT_ICONS[slot] : null;
    const slotColor = slot ? SLOT_COLORS[slot] : null;
    const isPlanned = entry.confirmed === false;

    return (
      <div
        key={entry.id}
        className={`flex items-center gap-2 rounded-xl transition-colors ${
          isPlanned
            ? "bg-zinc-50/60 border border-dashed border-zinc-200 opacity-70"
            : "bg-zinc-50 border border-transparent hover:border-zinc-200"
        }`}
        data-testid={`log-entry-${entry.id}`}
      >
        <button
          onClick={() => setSelectedEntry(entry)}
          className="flex items-center gap-2 flex-1 min-w-0 p-3 text-left"
          data-testid={`button-open-meal-detail-${entry.id}`}
        >
          {SlotIcon && slotColor && (
            <div className={`p-1.5 rounded-lg shrink-0 ${slotColor}`}>
              <SlotIcon className="w-3 h-3" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${isPlanned ? "text-zinc-500" : "text-zinc-900"}`}>
              {entry.mealName}
              {isPlanned && <span className="ml-1.5 text-[10px] font-normal text-zinc-400">(Planned)</span>}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {entry.calories} kcal · P:{entry.protein}g C:{entry.carbs}g F:{entry.fat}g
            </p>
          </div>
        </button>
        {isPlanned && (
          <button
            onClick={() => confirmMutation.mutate(entry.id)}
            disabled={confirmMutation.isPending}
            className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors shrink-0"
            data-testid={`button-confirm-log-${entry.id}`}
            title="Confirm this meal"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        {!isPlanned && !favouriteNames.has(entry.mealName) && (
          <button
            onClick={() => starMutation.mutate({
              mealName: entry.mealName,
              calories: entry.calories,
              protein: entry.protein,
              carbs: entry.carbs,
              fat: entry.fat,
              mealSlot: entry.mealSlot ?? null,
            })}
            disabled={starMutation.isPending}
            className="p-1.5 text-zinc-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors shrink-0"
            data-testid={`button-star-log-${entry.id}`}
            title="Save to favourites"
          >
            <Star className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => deleteMutation.mutate(entry.id)}
          disabled={deleteMutation.isPending}
          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 mr-2"
          data-testid={`button-delete-log-${entry.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 pb-20">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors" data-testid="link-back-dashboard">
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-zinc-900">Food Diary</h1>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
            data-testid="button-diary-log-meal"
          >
            <Plus className="w-4 h-4" />
            Log Meal
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center bg-zinc-100 rounded-xl p-0.5" data-testid="toggle-diary-view">
              <button
                onClick={() => setView("daily")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === "daily" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                data-testid="button-diary-view-daily"
              >
                Daily
              </button>
              <button
                onClick={() => setView("weekly")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === "weekly" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                data-testid="button-diary-view-weekly"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Weekly
              </button>
            </div>
          </div>

          {view === "daily" && (
            <>
              <div className="flex items-center justify-between mb-4 bg-zinc-50 rounded-xl px-2 py-1.5">
                <button
                  onClick={() => setSelectedDate(d => shiftDate(d, -1))}
                  className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
                  data-testid="button-diary-prev-day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <span className="text-sm font-semibold text-zinc-800" data-testid="text-diary-date">
                    {isToday ? "Today" : formatDateLabel(selectedDate)}
                  </span>
                  {isToday && <span className="block text-[10px] text-zinc-400">{formatDateLabel(selectedDate)}</span>}
                  {!isToday && (
                    <button
                      onClick={() => setSelectedDate(today)}
                      className="block mx-auto text-[10px] text-zinc-400 hover:text-zinc-600 font-medium transition-colors mt-0.5"
                      data-testid="button-diary-go-to-today"
                    >
                      Back to today
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSelectedDate(d => shiftDate(d, 1))}
                  disabled={selectedDate >= today}
                  className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  data-testid="button-diary-next-day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <MacroGrid
                cal={totalCal} prot={totalProt} carbs={totalCarbs} fat={totalFat}
                calTarget={dailyCaloriesTarget} protTarget={dailyProteinTarget}
                carbsTarget={dailyCarbsTarget} fatTarget={dailyFatTarget}
              />

              {plannedDaily.length > 0 && (
                <p className="text-xs text-zinc-400 mb-3 flex items-center gap-1" data-testid="text-diary-planned-summary">
                  <span className="inline-block w-2 h-2 rounded-full bg-zinc-300" />
                  {plannedDaily.length} planned meal{plannedDaily.length !== 1 ? "s" : ""} ({plannedCal} kcal) awaiting confirmation
                </p>
              )}

              {dailyLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : dailyEntries.length === 0 ? (
                <div className="text-center py-8 text-zinc-400">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No entries for {isToday ? "today" : formatDateLabel(selectedDate)}.</p>
                  <button
                    onClick={() => setDrawerOpen(true)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-4 py-2 rounded-xl transition-colors"
                    data-testid="button-diary-empty-log"
                  >
                    <Plus className="w-4 h-4" />
                    Log your first meal
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {dailyEntries.map(entry => renderEntryRow(entry))}
                </div>
              )}
            </>
          )}

          {view === "weekly" && (
            <>
              <div className="flex items-center justify-between mb-4 bg-zinc-50 rounded-xl px-2 py-1.5">
                <button
                  onClick={() => changeWeek(-1)}
                  className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
                  data-testid="button-diary-prev-week"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <span className="text-sm font-semibold text-zinc-800" data-testid="text-diary-week-label">
                    {weekOffset === 0 ? "This week" : formatWeekLabel(weekRange.from, weekRange.to)}
                  </span>
                  {weekOffset === 0 && (
                    <span className="block text-[10px] text-zinc-400">{formatWeekLabel(weekRange.from, weekRange.to)}</span>
                  )}
                  {weekOffset < 0 && (
                    <button
                      onClick={() => changeWeek(-weekOffset)}
                      className="block mx-auto text-[10px] text-zinc-400 hover:text-zinc-600 font-medium transition-colors mt-0.5"
                      data-testid="button-diary-go-to-current-week"
                    >
                      Back to this week
                    </button>
                  )}
                </div>
                <button
                  onClick={() => changeWeek(1)}
                  disabled={weekOffset >= 0}
                  className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  data-testid="button-diary-next-week"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <MacroGrid
                cal={weekTotalCal} prot={weekTotalProt} carbs={weekTotalCarbs} fat={weekTotalFat}
                calTarget={dailyCaloriesTarget ? dailyCaloriesTarget * 7 : undefined}
                protTarget={dailyProteinTarget ? dailyProteinTarget * 7 : undefined}
                carbsTarget={dailyCarbsTarget ? dailyCarbsTarget * 7 : undefined}
                fatTarget={dailyFatTarget ? dailyFatTarget * 7 : undefined}
              />

              {weekTotalCal > 0 && (
                <div className="mb-4">
                  {!weeklyInsight ? (
                    <button
                      onClick={handleFetchWeeklyInsights}
                      disabled={weeklyInsightLoading}
                      className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-colors px-3 py-2 rounded-full disabled:opacity-50"
                      data-testid="button-diary-weekly-insights"
                    >
                      {weeklyInsightLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {weeklyInsightLoading ? "Generating insights…" : "Get weekly insights"}
                    </button>
                  ) : (
                    <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                          <span className="text-xs font-semibold text-violet-700">Weekly Insights</span>
                        </div>
                        <button
                          onClick={handleFetchWeeklyInsights}
                          disabled={weeklyInsightLoading}
                          className="text-[10px] text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50"
                          data-testid="button-diary-refresh-insights"
                        >
                          Refresh
                        </button>
                      </div>
                      <div className="space-y-1" data-testid="text-diary-weekly-insights">
                        {weeklyInsight.split("\n").filter(l => l.trim()).map((line, i) => (
                          <p key={i} className="text-xs text-violet-900 leading-relaxed">{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {weeklyLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : (
                <div className="space-y-1.5" data-testid="diary-weekly-log-table">
                  {weekRange.days.map(d => {
                    const dayEntries = entriesByDay[d] ?? [];
                    const dayCal = dayEntries.reduce((s, e) => s + e.calories, 0);
                    const isDayToday = d === today;
                    const isExpanded = expandedDays.has(d);
                    const dayLabel = new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

                    const bySlot: Record<string, FoodLogEntry[]> = {};
                    for (const slot of ALL_SLOTS) bySlot[slot] = [];
                    bySlot["other"] = [];
                    for (const e of dayEntries) {
                      const key = e.mealSlot && ALL_SLOTS.includes(e.mealSlot) ? e.mealSlot : "other";
                      bySlot[key].push(e);
                    }

                    return (
                      <div
                        key={d}
                        className={`rounded-xl overflow-hidden border ${isDayToday ? "border-violet-200" : "border-zinc-100"}`}
                        data-testid={`diary-weekly-day-${d}`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleDay(d)}
                          onKeyDown={e => e.key === "Enter" && toggleDay(d)}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs cursor-pointer transition-colors ${isDayToday ? "bg-violet-50 hover:bg-violet-100" : "bg-zinc-50 hover:bg-zinc-100"}`}
                          data-testid={`button-diary-expand-day-${d}`}
                        >
                          <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          <span className={`font-semibold flex-1 ${isDayToday ? "text-violet-700" : "text-zinc-700"}`}>
                            {isDayToday ? "Today" : dayLabel}
                          </span>
                          {dayEntries.length > 0 && (
                            <span className={`font-bold ${isDayToday ? "text-violet-600" : "text-zinc-600"}`}>{dayCal} kcal</span>
                          )}
                          {dayEntries.length === 0 && (
                            <span className="text-zinc-300 italic">No entries</span>
                          )}
                        </div>
                        {isExpanded && dayEntries.length > 0 && (
                          <div className="px-3 pb-3 pt-1 space-y-1">
                            {[...ALL_SLOTS, "other"].map(slotKey => {
                              const items = bySlot[slotKey] ?? [];
                              if (items.length === 0) return null;
                              const sl = slotKey as MealSlot;
                              const SlotIcon = SLOT_ICONS[sl];
                              const label = SLOT_LABELS[sl] ?? "Other";
                              return (
                                <div key={slotKey}>
                                  <div className="flex items-center gap-1.5 mt-1.5 mb-1">
                                    {SlotIcon && <SlotIcon className="w-3 h-3 text-zinc-400" />}
                                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
                                  </div>
                                  {items.map(entry => (
                                    <div key={entry.id} className="flex items-center justify-between py-1 px-1 rounded-lg hover:bg-zinc-50 transition-colors">
                                      <button
                                        onClick={() => setSelectedEntry(entry)}
                                        className="text-left flex-1 min-w-0"
                                        data-testid={`button-diary-entry-detail-${entry.id}`}
                                      >
                                        <p className="text-xs text-zinc-700 truncate">{entry.mealName}</p>
                                      </button>
                                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                        <span className="text-[10px] text-zinc-500 font-medium">{entry.calories} kcal</span>
                                        <button
                                          onClick={() => deleteMutation.mutate(entry.id)}
                                          className="p-1 text-zinc-300 hover:text-red-400 transition-colors"
                                          data-testid={`button-diary-delete-${entry.id}`}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <FoodLogDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedDate={view === "daily" ? selectedDate : today}
      />

      {selectedEntry && (
        <LoggedMealModal
          entry={selectedEntry}
          userRecipes={userRecipes}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
