import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { TrialBanner } from "@/components/trial-banner";
import type { TrialInfo } from "@shared/trial";
import { Link, useLocation } from "wouter";
import {
  Loader2, Plus, Trash2, ClipboardList, CalendarDays,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Check, Star,
  Sparkles, X, ArrowLeft, Lock, Shield,
  Calendar, CalendarPlus, ChefHat, Circle, Download, ShoppingCart, Mail, Pencil, AlertTriangle,
} from "lucide-react";
import { useTierStatus } from "@/hooks/use-tier";
import type { UserMeal, Calculation, SavedMealPlan, UserPreferences } from "@shared/schema";
import { RECIPES, exportMealPlanToPDF, exportShoppingListToPDF, buildShoppingList } from "@/components/results-display";
import {
  type MealSlot, type FoodLogEntry,
  SLOT_LABELS, SLOT_ICONS, SLOT_COLORS, ALL_SLOTS,
  todayStr, formatDateLabel, shiftDate,
  getWeekRange, formatWeekLabel,
  MacroGrid, LoggedMealModal,
} from "@/components/food-log-shared";
import { FoodLogDrawer } from "@/components/food-log-drawer";
import { TemplateSuggestions } from "@/components/template-suggestions";
import { SavedWeeklyView, SavedDailyView, PHASE_STYLES, buildCalcStub } from "@/components/saved-meal-plans";
import { getMonday, addDays, toDateStr } from "@/components/results-pdf";
import { AnimatePresence, motion } from "framer-motion";

interface DiaryProps {
  dailyCaloriesTarget?: number;
  dailyProteinTarget?: number;
  dailyCarbsTarget?: number;
  dailyFatTarget?: number;
  dailyFibreTarget?: number;
  dailySugarTarget?: number;
  dailySaturatedFatTarget?: number;
  initialDate?: string;
}

export default function DiaryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: calcHistory = [] } = useQuery<Calculation[]>({
    queryKey: ["/api/calculations"],
  });
  const calcData = calcHistory[0] ?? null;

  const { data: effectiveTargets } = useQuery<{ dailyCalories: number; proteinGoal: number; carbsGoal: number; fatGoal: number; fibreGoal: number | null } | null>({
    queryKey: ["/api/calculations/effective-targets"],
    enabled: !!user,
  });

  if (authLoading) return null;
  if (!user) {
    navigate("/auth");
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get("date") ?? undefined;

  const targets = {
    dailyCaloriesTarget: effectiveTargets?.dailyCalories ?? calcData?.dailyCalories ?? undefined,
    dailyProteinTarget: effectiveTargets?.proteinGoal ?? calcData?.proteinGoal ?? undefined,
    dailyCarbsTarget: effectiveTargets?.carbsGoal ?? calcData?.carbsGoal ?? undefined,
    dailyFatTarget: effectiveTargets?.fatGoal ?? calcData?.fatGoal ?? undefined,
    dailyFibreTarget: effectiveTargets?.fibreGoal ?? calcData?.fibreGoal ?? undefined,
    dailySugarTarget: calcData?.sugarGoal ?? undefined,
    dailySaturatedFatTarget: calcData?.saturatedFatGoal ?? undefined,
    initialDate: dateParam,
  };

  return <DiaryContent {...targets} />;
}

function DiaryContent({
  dailyCaloriesTarget,
  dailyProteinTarget,
  dailyCarbsTarget,
  dailyFatTarget,
  dailyFibreTarget,
  dailySugarTarget,
  dailySaturatedFatTarget,
  initialDate,
}: DiaryProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tierStatus, isLoading: tierLoading } = useTierStatus();
  const isAdvanced = tierLoading || !!(tierStatus && (tierStatus.betaUser || tierStatus.tier === "advanced"));
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

  const [diaryPlanExpanded, setDiaryPlanExpanded] = useState(false);
  const [diaryPlanEditingName, setDiaryPlanEditingName] = useState(false);
  const [diaryPlanEditName, setDiaryPlanEditName] = useState("");
  const [diaryShoppingDialogOpen, setDiaryShoppingDialogOpen] = useState(false);
  const [diaryShoppingDays, setDiaryShoppingDays] = useState("7");
  const [diaryEmailDialogOpen, setDiaryEmailDialogOpen] = useState(false);
  const [diaryEmailDays, setDiaryEmailDays] = useState("7");
  const [diaryEmailingPlan, setDiaryEmailingPlan] = useState(false);
  const [diaryScheduleOpen, setDiaryScheduleOpen] = useState(false);
  const [diaryScheduleWeekStart, setDiaryScheduleWeekStart] = useState(() => getMonday(toDateStr(new Date())));
  const [diaryScheduleDate, setDiaryScheduleDate] = useState(() => toDateStr(new Date()));
  const [diaryMismatchInfo, setDiaryMismatchInfo] = useState<{ storedPhase: string; targetPhase: string } | null>(null);
  const [diaryDuplicateInfo, setDiaryDuplicateInfo] = useState<{ count: number } | null>(null);

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

  const { data: savedPlans = [] } = useQuery<SavedMealPlan[]>({
    queryKey: ["/api/saved-meal-plans"],
    queryFn: async () => {
      const res = await fetch("/api/saved-meal-plans", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load saved plans");
      return res.json();
    },
    enabled: view === "weekly",
  });

  const { data: userPrefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });
  const showCycleBanner = !!(userPrefs?.cycleTrackingEnabled && userPrefs?.lastPeriodDate);

  const weekMonday = weekRange.from;
  const weekSunday = weekRange.to;
  const weekPlan: SavedMealPlan | null = (() => {
    const matches = savedPlans.filter(p => {
      const pd = p.planData as any;
      if (p.planType === 'weekly' && pd.weekStartDate) {
        return getMonday(pd.weekStartDate) === weekMonday;
      }
      if (p.planType === 'daily' && pd.targetDate) {
        return pd.targetDate >= weekMonday && pd.targetDate <= weekSunday;
      }
      if (pd.planType === 'multi-daily' && pd.days) {
        return Object.keys(pd.days).some((d: string) => d >= weekMonday && d <= weekSunday);
      }
      if (pd.targetDates && Array.isArray(pd.targetDates)) {
        return pd.targetDates.some((d: string) => d >= weekMonday && d <= weekSunday);
      }
      return false;
    });
    if (matches.length === 0) return null;
    return matches.reduce((latest, p) => {
      const la = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;
      const pa = p.createdAt ? new Date(p.createdAt).getTime() : 0;
      return pa > la ? p : latest;
    });
  })();

  const diaryPlanRenameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name cannot be empty");
      const res = await apiRequest("PATCH", `/api/saved-meal-plans/${id}/name`, { name: trimmed });
      if (!res.ok) throw new Error("Failed to rename");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
      setDiaryPlanEditingName(false);
    },
    onError: (err: any) => {
      toast({ title: err.message || "Failed to rename plan", variant: "destructive" });
    },
  });

  const diaryPlanDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/saved-meal-plans/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
      setDiaryPlanExpanded(false);
    },
    onError: () => {
      toast({ title: "Failed to delete plan", variant: "destructive" });
    },
  });

  const diaryPlanEmailMutation = useMutation({
    mutationFn: async ({ id, shoppingList }: { id: number; shoppingList?: Record<string, Array<{ item: string; quantity: string }>> }) => {
      setDiaryEmailingPlan(true);
      const res = await apiRequest("POST", `/api/saved-meal-plans/${id}/email`, { shoppingList });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to send email");
      }
    },
    onSuccess: () => {
      toast({ title: "Plan emailed!", description: "Check your inbox for the meal plan." });
      setDiaryEmailingPlan(false);
      setDiaryEmailDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: err.message || "Failed to send email", variant: "destructive" });
      setDiaryEmailingPlan(false);
    },
  });

  const diaryScheduleMutation = useMutation({
    mutationFn: async ({ planId, targetDate, weekStartDate, force, allowDuplicate }: { planId: number; targetDate?: string; weekStartDate?: string; force?: boolean; allowDuplicate?: boolean }) => {
      const res = await apiRequest("POST", `/api/saved-meal-plans/${planId}/schedule`, { targetDate, weekStartDate, force, allowDuplicate });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to schedule plan");
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      if (data.mismatch) {
        setDiaryMismatchInfo({ storedPhase: data.storedPhase, targetPhase: data.targetPhase });
        return;
      }
      if (data.duplicate) {
        setDiaryDuplicateInfo({ count: data.duplicateCount });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week"] });
      const dateRange = weekPlan?.planType === 'weekly' && variables.weekStartDate
        ? `${new Date(variables.weekStartDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(addDays(variables.weekStartDate, 6) + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
        : variables.targetDate ? new Date(variables.targetDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : 'today';
      toast({ title: "Meals scheduled!", description: `${data.entryCount} meals added to your food log for ${dateRange}.` });
      setDiaryScheduleOpen(false);
      setDiaryMismatchInfo(null);
      setDiaryDuplicateInfo(null);
    },
    onError: (err: any) => {
      toast({ title: err.message || "Failed to schedule plan", variant: "destructive" });
    },
  });

  const { data: userRecipes = [] } = useQuery<{ items: UserMeal[] }, Error, UserMeal[]>({
    queryKey: ["/api/user-meals", "all"],
    queryFn: () => fetch("/api/user-meals?limit=100", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
    select: (d) => d.items,
  });
  const favouriteMealNames = new Set(userRecipes.map(f => f.name));

  const { data: userFoods = [] } = useQuery<{ items: { id: number; name: string }[] }, Error, { id: number; name: string }[]>({
    queryKey: ["/api/my-foods", "all"],
    queryFn: () => fetch("/api/my-foods?limit=100", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
    select: (d) => d.items,
  });
  const favouriteFoodNames = new Set(userFoods.map(f => f.name));

  const isFoodSource = (source?: string | null) => source === "search" || source === "scan" || source === "ai";

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

  const starMealMutation = useMutation({
    mutationFn: (entry: { mealName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot?: string | null }) =>
      apiRequest("POST", "/api/user-meals", {
        name: entry.mealName,
        source: "logged",
        caloriesPerServing: entry.calories,
        proteinPerServing: entry.protein,
        carbsPerServing: entry.carbs,
        fatPerServing: entry.fat,
        mealSlot: entry.mealSlot ?? null,
        confirmDuplicate: true,
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-meals"] });
      toast({ title: "Saved to My Meals" });
    },
    onError: () => toast({ title: "Failed to save meal", variant: "destructive" }),
  });

  const starFoodMutation = useMutation({
    mutationFn: (entry: { mealName: string; calories: number; protein: number; carbs: number; fat: number }) =>
      apiRequest("POST", "/api/my-foods", {
        name: entry.mealName,
        calories100g: entry.calories,
        protein100g: entry.protein,
        carbs100g: entry.carbs,
        fat100g: entry.fat,
        confirmDuplicate: true,
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-foods"] });
      toast({ title: "Saved to My Foods" });
    },
    onError: () => toast({ title: "Failed to save food", variant: "destructive" }),
  });

  const confirmedDaily = dailyEntries.filter(e => e.confirmed !== false);
  const plannedDaily = dailyEntries.filter(e => e.confirmed === false);
  const totalCal = confirmedDaily.reduce((s, e) => s + e.calories, 0);
  const totalProt = confirmedDaily.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = confirmedDaily.reduce((s, e) => s + e.carbs, 0);
  const totalFat = confirmedDaily.reduce((s, e) => s + e.fat, 0);
  const totalFibre = confirmedDaily.some(e => e.fibre != null) ? confirmedDaily.reduce((s, e) => s + (e.fibre ?? 0), 0) : undefined;
  const totalSugar = confirmedDaily.some(e => e.sugar != null) ? confirmedDaily.reduce((s, e) => s + (e.sugar ?? 0), 0) : undefined;
  const totalSaturatedFat = confirmedDaily.some(e => e.saturatedFat != null) ? confirmedDaily.reduce((s, e) => s + (e.saturatedFat ?? 0), 0) : undefined;
  const plannedCal = plannedDaily.reduce((s, e) => s + e.calories, 0);

  const confirmedWeekly = weeklyEntries.filter(e => e.confirmed !== false);
  const weekTotalCal = confirmedWeekly.reduce((s, e) => s + e.calories, 0);
  const weekTotalProt = confirmedWeekly.reduce((s, e) => s + e.protein, 0);
  const weekTotalCarbs = confirmedWeekly.reduce((s, e) => s + e.carbs, 0);
  const weekTotalFat = confirmedWeekly.reduce((s, e) => s + e.fat, 0);
  const weekTotalFibre = confirmedWeekly.some(e => e.fibre != null) ? confirmedWeekly.reduce((s, e) => s + (e.fibre ?? 0), 0) : undefined;
  const weekTotalSugar = confirmedWeekly.some(e => e.sugar != null) ? confirmedWeekly.reduce((s, e) => s + (e.sugar ?? 0), 0) : undefined;
  const weekTotalSaturatedFat = confirmedWeekly.some(e => e.saturatedFat != null) ? confirmedWeekly.reduce((s, e) => s + (e.saturatedFat ?? 0), 0) : undefined;

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
    setDiaryPlanExpanded(false);
    setDiaryPlanEditingName(false);
    setDiaryShoppingDialogOpen(false);
    setDiaryEmailDialogOpen(false);
    setDiaryScheduleOpen(false);
    setDiaryMismatchInfo(null);
    setDiaryDuplicateInfo(null);
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
        {!isPlanned && !(isFoodSource(entry.source) ? favouriteFoodNames.has(entry.mealName) : favouriteMealNames.has(entry.mealName)) && (
          <button
            onClick={() => {
              if (isFoodSource(entry.source)) {
                starFoodMutation.mutate({
                  mealName: entry.mealName,
                  calories: entry.calories,
                  protein: entry.protein,
                  carbs: entry.carbs,
                  fat: entry.fat,
                });
              } else {
                starMealMutation.mutate({
                  mealName: entry.mealName,
                  calories: entry.calories,
                  protein: entry.protein,
                  carbs: entry.carbs,
                  fat: entry.fat,
                  mealSlot: entry.mealSlot ?? null,
                });
              }
            }}
            disabled={starMealMutation.isPending || starFoodMutation.isPending}
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
          <button
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigate("/dashboard");
              }
            }}
            className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
            data-testid="link-back-dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
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

      {user && !user.isManagedClient && (user as any).trialInfo && (
        <TrialBanner trialInfo={(user as any).trialInfo as TrialInfo} />
      )}

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
                fibre={totalFibre} sugar={totalSugar} saturatedFat={totalSaturatedFat}
                calTarget={dailyCaloriesTarget} protTarget={dailyProteinTarget}
                carbsTarget={dailyCarbsTarget} fatTarget={dailyFatTarget}
                fibreTarget={dailyFibreTarget} sugarTarget={dailySugarTarget}
                saturatedFatTarget={dailySaturatedFatTarget}
              />

              {plannedDaily.length > 0 && (
                <p className="text-xs text-zinc-400 mb-3 flex items-center gap-1" data-testid="text-diary-planned-summary">
                  <span className="inline-block w-2 h-2 rounded-full bg-zinc-300" />
                  {plannedDaily.length} planned meal{plannedDaily.length !== 1 ? "s" : ""} ({plannedCal} kcal) awaiting confirmation
                </p>
              )}

              <TemplateSuggestions date={selectedDate} />

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
                <div className="space-y-4">
                  {(() => {
                    const dailyBySlot: Record<string, FoodLogEntry[]> = {};
                    for (const slot of ALL_SLOTS) dailyBySlot[slot] = [];
                    dailyBySlot["other"] = [];
                    for (const e of dailyEntries) {
                      const key = e.mealSlot && ALL_SLOTS.includes(e.mealSlot as MealSlot) ? e.mealSlot : "other";
                      dailyBySlot[key].push(e);
                    }
                    return [...ALL_SLOTS, "other"].map(slotKey => {
                      const items = dailyBySlot[slotKey] ?? [];
                      if (items.length === 0) return null;
                      const sl = slotKey as MealSlot;
                      const SlotIcon = SLOT_ICONS[sl];
                      const slotColor = SLOT_COLORS[sl];
                      const label = SLOT_LABELS[sl] ?? "Other";
                      const slotCal = items.reduce((s, e) => s + e.calories, 0);
                      return (
                        <div key={slotKey} data-testid={`diary-slot-${slotKey}`}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {SlotIcon && slotColor && (
                              <div className={`p-1 rounded-md ${slotColor}`}>
                                <SlotIcon className="w-3 h-3" />
                              </div>
                            )}
                            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex-1">{label}</span>
                            <span className="text-[10px] text-zinc-400 font-medium">{slotCal} kcal</span>
                          </div>
                          <div className="space-y-1.5">
                            {items.map(entry => renderEntryRow(entry))}
                          </div>
                        </div>
                      );
                    });
                  })()}
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
                fibre={weekTotalFibre} sugar={weekTotalSugar} saturatedFat={weekTotalSaturatedFat}
                calTarget={dailyCaloriesTarget ? dailyCaloriesTarget * 7 : undefined}
                protTarget={dailyProteinTarget ? dailyProteinTarget * 7 : undefined}
                carbsTarget={dailyCarbsTarget ? dailyCarbsTarget * 7 : undefined}
                fatTarget={dailyFatTarget ? dailyFatTarget * 7 : undefined}
                fibreTarget={dailyFibreTarget ? dailyFibreTarget * 7 : undefined}
                sugarTarget={dailySugarTarget ? dailySugarTarget * 7 : undefined}
                saturatedFatTarget={dailySaturatedFatTarget ? dailySaturatedFatTarget * 7 : undefined}
              />

              {weekPlan && (() => {
                const planData = weekPlan.planData as any;
                const totalCal = weekPlan.planType === 'weekly' ? planData?.weekTotalCalories : planData?.dayTotalCalories;
                const totalProtein = weekPlan.planType === 'weekly' ? planData?.weekTotalProtein : planData?.dayTotalProtein;

                let cyclePhase: string | null = null;
                if (planData?.cyclePhase) {
                  cyclePhase = planData.cyclePhase;
                } else if (planData?.cyclePhaseByDay) {
                  const phases = Object.values(planData.cyclePhaseByDay).filter(Boolean) as string[];
                  cyclePhase = phases[0] ?? null;
                } else if (planData?.cyclePhaseByDate) {
                  const phases = Object.values(planData.cyclePhaseByDate).filter(Boolean) as string[];
                  cyclePhase = phases[0] ?? null;
                }
                const ps = cyclePhase && PHASE_STYLES[cyclePhase] ? PHASE_STYLES[cyclePhase] : null;

                return (
                  <div className="mb-4 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden" data-testid="card-diary-week-plan">
                    <button
                      onClick={() => setDiaryPlanExpanded(prev => !prev)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-zinc-50 transition-colors text-left"
                      data-testid="button-diary-plan-toggle"
                    >
                      <CalendarDays className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-zinc-900 truncate block">{weekPlan.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${weekPlan.planType === 'weekly' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                            <Calendar className="w-2.5 h-2.5" />
                            {weekPlan.planType === 'weekly' ? 'Weekly' : 'Daily'}
                          </span>
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${weekPlan.mealStyle === 'michelin' ? 'bg-yellow-50 text-yellow-700' : weekPlan.mealStyle === 'gourmet' ? 'bg-purple-50 text-purple-700' : 'bg-zinc-100 text-zinc-600'}`}>
                            <ChefHat className="w-2.5 h-2.5" />
                            {weekPlan.mealStyle === 'michelin' ? 'Michelin' : weekPlan.mealStyle === 'gourmet' ? 'Gourmet' : 'Simple'}
                          </span>
                          {showCycleBanner && ps && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${ps.bg} ${ps.text} ${ps.border}`}>
                              <Circle className="w-2 h-2" />
                              {ps.label}
                            </span>
                          )}
                          {planData?.cycleOptimised === false && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                              <AlertTriangle className="w-2 h-2" />
                              Not cycle-optimised
                            </span>
                          )}
                        </div>
                      </div>
                      {(totalCal || totalProtein) && (
                        <div className="text-right shrink-0">
                          {totalCal && <p className="text-[10px] font-bold text-zinc-700">{totalCal.toLocaleString()} kcal</p>}
                          {totalProtein && <p className="text-[10px] text-zinc-500">{totalProtein}g protein</p>}
                        </div>
                      )}
                      {diaryPlanExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      )}
                    </button>

                    <AnimatePresence>
                      {diaryPlanExpanded && planData && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-zinc-100 px-3.5 py-3">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                {diaryPlanEditingName ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      value={diaryPlanEditName}
                                      onChange={e => setDiaryPlanEditName(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') diaryPlanRenameMutation.mutate({ id: weekPlan.id, name: diaryPlanEditName });
                                        if (e.key === 'Escape') setDiaryPlanEditingName(false);
                                      }}
                                      className="flex-1 text-xs font-semibold px-2 py-1 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 min-w-0"
                                      autoFocus
                                      data-testid="input-diary-plan-rename"
                                    />
                                    <button
                                      onClick={() => diaryPlanRenameMutation.mutate({ id: weekPlan.id, name: diaryPlanEditName })}
                                      disabled={diaryPlanRenameMutation.isPending}
                                      className="p-1 text-zinc-600 hover:bg-zinc-100 rounded-lg"
                                      data-testid="button-diary-plan-rename-confirm"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setDiaryPlanEditingName(false)}
                                      className="p-1 text-zinc-400 hover:bg-zinc-100 rounded-lg"
                                      data-testid="button-diary-plan-rename-cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setDiaryPlanEditName(weekPlan.name); setDiaryPlanEditingName(true); }}
                                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                                    data-testid="button-diary-plan-rename"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Rename
                                  </button>
                                )}
                              </div>
                              <button
                                onClick={() => { if (confirm("Delete this plan?")) diaryPlanDeleteMutation.mutate(weekPlan.id); }}
                                disabled={diaryPlanDeleteMutation.isPending}
                                className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                data-testid="button-diary-plan-delete"
                              >
                                {diaryPlanDeleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 mb-3">
                              <button
                                onClick={() => {
                                  if (weekPlan.planType === 'daily') {
                                    setDiaryShoppingDialogOpen(true);
                                    setDiaryShoppingDays("7");
                                  } else {
                                    exportShoppingListToPDF(planData, buildCalcStub(weekPlan));
                                  }
                                }}
                                className="flex items-center gap-1 px-2 py-1 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg font-medium text-[10px] transition-colors"
                                data-testid="button-diary-plan-shopping"
                              >
                                <ShoppingCart className="w-3 h-3" />
                                Shopping List
                              </button>
                              <button
                                onClick={() => exportMealPlanToPDF(planData, buildCalcStub(weekPlan))}
                                className="flex items-center gap-1 px-2 py-1 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg font-medium text-[10px] transition-colors"
                                data-testid="button-diary-plan-pdf"
                              >
                                <Download className="w-3 h-3" />
                                Export PDF
                              </button>
                              <button
                                onClick={() => {
                                  if (weekPlan.planType === 'daily') {
                                    setDiaryEmailDialogOpen(true);
                                    setDiaryEmailDays("7");
                                  } else {
                                    const shoppingList = buildShoppingList(planData);
                                    diaryPlanEmailMutation.mutate({ id: weekPlan.id, shoppingList });
                                  }
                                }}
                                disabled={diaryEmailingPlan}
                                className="flex items-center gap-1 px-2 py-1 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg font-medium text-[10px] transition-colors disabled:opacity-50"
                                data-testid="button-diary-plan-email"
                              >
                                {diaryEmailingPlan ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                Email Plan
                              </button>
                              <button
                                onClick={() => {
                                  setDiaryScheduleOpen(prev => !prev);
                                  setDiaryScheduleWeekStart(getMonday(toDateStr(new Date())));
                                  setDiaryScheduleDate(toDateStr(new Date()));
                                }}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-[10px] transition-colors ${diaryScheduleOpen ? 'bg-zinc-900 text-white' : 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                                data-testid="button-diary-plan-schedule"
                              >
                                <CalendarPlus className="w-3 h-3" />
                                Schedule
                              </button>
                            </div>

                            {diaryShoppingDialogOpen && (
                              <div className="flex items-center gap-1.5 mb-3 p-2 bg-zinc-50 rounded-lg border border-zinc-200">
                                <span className="text-[10px] text-zinc-600 font-medium">Scale for</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={30}
                                  value={diaryShoppingDays}
                                  onChange={e => setDiaryShoppingDays(e.target.value)}
                                  className="w-14 px-1.5 py-0.5 text-[10px] border border-zinc-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-zinc-900"
                                  data-testid="input-diary-plan-shopping-days"
                                />
                                <span className="text-[10px] text-zinc-600 font-medium">days</span>
                                <button
                                  onClick={() => {
                                    exportShoppingListToPDF(planData, buildCalcStub(weekPlan), parseInt(diaryShoppingDays) || 1);
                                    setDiaryShoppingDialogOpen(false);
                                  }}
                                  className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] font-medium transition-colors"
                                  data-testid="button-diary-plan-shopping-export"
                                >
                                  Export
                                </button>
                                <button
                                  onClick={() => setDiaryShoppingDialogOpen(false)}
                                  className="p-0.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {diaryEmailDialogOpen && (
                              <div className="flex items-center gap-1.5 mb-3 p-2 bg-zinc-50 rounded-lg border border-zinc-200">
                                <span className="text-[10px] text-zinc-600 font-medium">Scale shopping list for</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={30}
                                  value={diaryEmailDays}
                                  onChange={e => setDiaryEmailDays(e.target.value)}
                                  className="w-14 px-1.5 py-0.5 text-[10px] border border-zinc-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-zinc-900"
                                  data-testid="input-diary-plan-email-days"
                                />
                                <span className="text-[10px] text-zinc-600 font-medium">days</span>
                                <button
                                  onClick={() => {
                                    const d = Math.max(1, parseInt(diaryEmailDays) || 1);
                                    const shoppingList = buildShoppingList(planData, d);
                                    diaryPlanEmailMutation.mutate({ id: weekPlan.id, shoppingList });
                                  }}
                                  disabled={diaryEmailingPlan}
                                  className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] font-medium transition-colors disabled:opacity-50 flex items-center gap-0.5"
                                  data-testid="button-diary-plan-email-confirm"
                                >
                                  {diaryEmailingPlan && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                                  Send
                                </button>
                                <button
                                  onClick={() => setDiaryEmailDialogOpen(false)}
                                  className="p-0.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {diaryScheduleOpen && (
                              <div className="mb-3 p-2 bg-zinc-50 rounded-lg border border-zinc-200">
                                {weekPlan.planType === 'weekly' ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => setDiaryScheduleWeekStart(addDays(diaryScheduleWeekStart, -7))}
                                      className="p-0.5 hover:bg-zinc-200 rounded-lg transition-colors"
                                      data-testid="button-diary-schedule-prev-week"
                                    >
                                      <ChevronLeft className="w-3.5 h-3.5 text-zinc-600" />
                                    </button>
                                    <span className="text-[10px] font-medium text-zinc-700 flex-1 text-center" data-testid="text-diary-schedule-week-range">
                                      {new Date(diaryScheduleWeekStart + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {new Date(addDays(diaryScheduleWeekStart, 6) + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                    </span>
                                    <button
                                      onClick={() => setDiaryScheduleWeekStart(addDays(diaryScheduleWeekStart, 7))}
                                      className="p-0.5 hover:bg-zinc-200 rounded-lg transition-colors"
                                      data-testid="button-diary-schedule-next-week"
                                    >
                                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                                    </button>
                                    <button
                                      onClick={() => diaryScheduleMutation.mutate({ planId: weekPlan.id, weekStartDate: diaryScheduleWeekStart })}
                                      disabled={diaryScheduleMutation.isPending}
                                      className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] font-medium transition-colors disabled:opacity-50 flex items-center gap-0.5"
                                      data-testid="button-diary-schedule-confirm"
                                    >
                                      {diaryScheduleMutation.isPending && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                                      Schedule
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="date"
                                      value={diaryScheduleDate}
                                      onChange={e => setDiaryScheduleDate(e.target.value)}
                                      className="flex-1 px-1.5 py-0.5 text-[10px] border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                                      data-testid="input-diary-schedule-date"
                                    />
                                    <button
                                      onClick={() => diaryScheduleMutation.mutate({ planId: weekPlan.id, targetDate: diaryScheduleDate })}
                                      disabled={diaryScheduleMutation.isPending}
                                      className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] font-medium transition-colors disabled:opacity-50 flex items-center gap-0.5"
                                      data-testid="button-diary-schedule-confirm"
                                    >
                                      {diaryScheduleMutation.isPending && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                                      Schedule
                                    </button>
                                  </div>
                                )}

                                {diaryMismatchInfo && (
                                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-[10px] text-amber-800 mb-1.5">
                                      This plan was made for <span className="font-semibold">{diaryMismatchInfo.storedPhase}</span> phase, but the target date falls in <span className="font-semibold">{diaryMismatchInfo.targetPhase}</span> phase.
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => {
                                          if (weekPlan.planType === 'weekly') {
                                            diaryScheduleMutation.mutate({ planId: weekPlan.id, weekStartDate: diaryScheduleWeekStart, force: true });
                                          } else {
                                            diaryScheduleMutation.mutate({ planId: weekPlan.id, targetDate: diaryScheduleDate, force: true });
                                          }
                                        }}
                                        disabled={diaryScheduleMutation.isPending}
                                        className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-medium transition-colors disabled:opacity-50"
                                        data-testid="button-diary-schedule-force"
                                      >
                                        Schedule anyway
                                      </button>
                                      <button
                                        onClick={() => { setDiaryMismatchInfo(null); setDiaryScheduleOpen(false); }}
                                        className="px-2 py-0.5 text-zinc-600 hover:bg-zinc-100 rounded-lg text-[10px] font-medium transition-colors"
                                        data-testid="button-diary-schedule-cancel-mismatch"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {diaryDuplicateInfo && (
                                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-[10px] text-amber-800 mb-1.5">
                                      {diaryDuplicateInfo.count} meal{diaryDuplicateInfo.count !== 1 ? 's' : ''} from this plan already exist in your food log for the selected date(s).
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => {
                                          if (weekPlan.planType === 'weekly') {
                                            diaryScheduleMutation.mutate({ planId: weekPlan.id, weekStartDate: diaryScheduleWeekStart, force: true, allowDuplicate: true });
                                          } else {
                                            diaryScheduleMutation.mutate({ planId: weekPlan.id, targetDate: diaryScheduleDate, force: true, allowDuplicate: true });
                                          }
                                        }}
                                        disabled={diaryScheduleMutation.isPending}
                                        className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-medium transition-colors disabled:opacity-50"
                                        data-testid="button-diary-schedule-allow-duplicate"
                                      >
                                        Add anyway
                                      </button>
                                      <button
                                        onClick={() => { setDiaryDuplicateInfo(null); setDiaryScheduleOpen(false); }}
                                        className="px-2 py-0.5 text-zinc-600 hover:bg-zinc-100 rounded-lg text-[10px] font-medium transition-colors"
                                        data-testid="button-diary-schedule-cancel-duplicate"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {weekPlan.planType === 'daily' ? (
                              <SavedDailyView plan={planData} />
                            ) : (
                              <SavedWeeklyView plan={planData} />
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}

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

        {!isAdvanced && (
          <div
            className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6 mt-4 text-center"
            data-testid="card-export-data-locked"
          >
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-800 mb-1">Export your nutrition data</h3>
            <p className="text-sm text-zinc-500 max-w-xs mx-auto mb-4">
              Download a full CSV or PDF of your food diary, macros, and weight history.
            </p>
            <Link href="/pricing">
              <button
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
                data-testid="button-export-data-upgrade"
              >
                <Shield className="w-4 h-4" />
                Upgrade to Advanced
              </button>
            </Link>
          </div>
        )}
      </main>

      <FoodLogDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedDate={view === "daily" ? selectedDate : today}
        dailyTotals={{ calories: totalCal, protein: totalProt, carbs: totalCarbs, fat: totalFat }}
        dailyTargets={{ calories: dailyCaloriesTarget, protein: dailyProteinTarget, carbs: dailyCarbsTarget, fat: dailyFatTarget }}
      />

      {selectedEntry && (
        <LoggedMealModal
          entry={selectedEntry}
          userRecipes={userRecipes}
          recipes={RECIPES}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
