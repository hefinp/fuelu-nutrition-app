import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  NotebookPen, ChevronLeft, ChevronRight, Plus, ClipboardList,
} from "lucide-react";
import {
  DarkMacroCard,
  todayStr, formatDateLabel, shiftDate,
} from "@/components/food-log-shared";
import type { FoodLogEntry, MealSlot } from "@/components/food-log-shared";
import { FoodLogDrawer } from "@/components/food-log-drawer";
import { Link } from "wouter";
import { DiaryWaterSection } from "@/components/diary/diary-water-section";
import { DiaryWeightSection } from "@/components/diary/diary-weight-section";
import { DiaryStravaSection, type DiaryActivityData } from "@/components/diary/diary-strava-section";
import { DiaryFoodSection } from "@/components/diary/diary-food-section";

interface MyDiaryWidgetProps {
  calTarget?: number;
  protTarget?: number;
  carbsTarget?: number;
  fatTarget?: number;
  fibreTarget?: number;
  sugarTarget?: number;
  saturatedFatTarget?: number;
  onCreatePlan?: () => void;
}

export function MyDiaryWidget({ calTarget, protTarget, carbsTarget, fatTarget, fibreTarget, sugarTarget, saturatedFatTarget, onCreatePlan }: MyDiaryWidgetProps) {
  const { user } = useAuth();
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDefaultSlot, setDrawerDefaultSlot] = useState<MealSlot | null>(null);
  const [waterPopupOpen, setWaterPopupOpen] = useState(false);
  const [weightPopupOpen, setWeightPopupOpen] = useState(false);

  const { data: dailyEntries = [], isLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?date=${selectedDate}`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load food log");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: stravaStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/strava/status"],
    enabled: !!user,
  });

  const { data: activityData, isLoading: activitiesLoading, isError: activitiesError } = useQuery<{ activities: DiaryActivityData[]; totalCalories: number }>({
    queryKey: ["/api/strava/activities/date", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/strava/activities/date/${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activities");
      return res.json();
    },
    enabled: stravaStatus?.connected === true,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const confirmedEntries = dailyEntries.filter(e => e.confirmed !== false);
  const totalCal = confirmedEntries.reduce((s, e) => s + e.calories, 0);
  const totalProt = confirmedEntries.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = confirmedEntries.reduce((s, e) => s + e.carbs, 0);
  const totalFat = confirmedEntries.reduce((s, e) => s + e.fat, 0);
  const totalFibre = confirmedEntries.reduce((s, e) => s + (e.fibre ?? 0), 0);
  const totalSugar = confirmedEntries.reduce((s, e) => s + (e.sugar ?? 0), 0);
  const totalSatFat = confirmedEntries.reduce((s, e) => s + (e.saturatedFat ?? 0), 0);
  const hasExtendedMacros = confirmedEntries.some(e => e.fibre != null || e.sugar != null || e.saturatedFat != null) || fibreTarget != null || sugarTarget != null || saturatedFatTarget != null;

  function handleOpenDrawer(slot?: MealSlot | null) {
    setDrawerDefaultSlot(slot ?? null);
    setDrawerOpen(true);
  }

  return (
    <>
      <div className="bg-white rounded-3xl border border-zinc-100 shadow-lg p-4 sm:p-6" data-testid="widget-my-diary">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
            <NotebookPen className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-display font-bold text-zinc-900">My Diary</h3>
            <p className="text-xs text-zinc-400">Your daily food log</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/my-library" className="text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors" data-testid="link-saved-meals">Saved Meals</Link>
            <Link href="/diary" className="text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors" data-testid="link-full-diary">Full Diary</Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-4 relative">
          <button
            onClick={() => handleOpenDrawer()}
            className="flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
            data-testid="button-diary-widget-log-meal"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Meal
          </button>
          <DiaryWaterSection
            selectedDate={selectedDate}
            open={waterPopupOpen}
            onToggle={() => setWaterPopupOpen(prev => !prev)}
            onClose={() => setWaterPopupOpen(false)}
          />
          <DiaryWeightSection
            open={weightPopupOpen}
            onToggle={() => setWeightPopupOpen(prev => !prev)}
            onClose={() => setWeightPopupOpen(false)}
          />
        </div>

        {onCreatePlan && (
          <button
            onClick={onCreatePlan}
            className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-semibold text-sm transition-colors mb-4"
            data-testid="button-diary-create-plan"
          >
            <ClipboardList className="w-4 h-4" /> Create Plan
          </button>
        )}

        <div className="flex items-center justify-between bg-zinc-50 rounded-xl px-2 py-1.5 mb-4">
          <button
            onClick={() => setSelectedDate(d => shiftDate(d, -1))}
            className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
            data-testid="button-diary-widget-prev-day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <span className="text-sm font-semibold text-zinc-800" data-testid="text-diary-widget-date">
              {isToday ? "Today" : formatDateLabel(selectedDate)}
            </span>
            {isToday && <span className="block text-[10px] text-zinc-400">{formatDateLabel(selectedDate)}</span>}
            {!isToday && (
              <button
                onClick={() => setSelectedDate(today)}
                className="block mx-auto text-[10px] text-zinc-400 hover:text-zinc-600 font-medium transition-colors mt-0.5"
                data-testid="button-diary-widget-go-to-today"
              >
                Back to today
              </button>
            )}
          </div>
          <button
            onClick={() => setSelectedDate(d => shiftDate(d, 1))}
            className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
            data-testid="button-diary-widget-next-day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {stravaStatus?.connected && (
          <DiaryStravaSection
            activities={activityData?.activities ?? []}
            totalCalories={activityData?.totalCalories ?? 0}
            isLoading={activitiesLoading}
            isError={activitiesError}
          />
        )}

        <DarkMacroCard
          cal={totalCal} prot={totalProt} carbs={totalCarbs} fat={totalFat}
          fibre={hasExtendedMacros ? totalFibre : undefined}
          sugar={hasExtendedMacros ? totalSugar : undefined}
          saturatedFat={hasExtendedMacros ? totalSatFat : undefined}
          calTarget={calTarget} protTarget={protTarget}
          carbsTarget={carbsTarget} fatTarget={fatTarget}
          fibreTarget={fibreTarget} sugarTarget={sugarTarget}
          saturatedFatTarget={saturatedFatTarget}
        />

        <DiaryFoodSection
          dailyEntries={dailyEntries}
          isLoading={isLoading}
          onOpenDrawer={handleOpenDrawer}
        />
      </div>

      <FoodLogDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setDrawerDefaultSlot(null); }}
        selectedDate={selectedDate}
        dailyTotals={{ calories: totalCal, protein: totalProt, carbs: totalCarbs, fat: totalFat }}
        dailyTargets={{ calories: calTarget, protein: protTarget, carbs: carbsTarget, fat: fatTarget }}
        defaultSlot={drawerDefaultSlot}
      />
    </>
  );
}
