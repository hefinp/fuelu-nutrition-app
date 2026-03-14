import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Loader2, Plus, ClipboardList, BookOpen,
} from "lucide-react";
import {
  type MealSlot, type FoodLogEntry,
  SLOT_LABELS, SLOT_ICONS, SLOT_COLORS, ALL_SLOTS,
  todayStr,
  MacroGrid,
} from "@/components/food-log-shared";
import { FoodLogDrawer } from "@/components/food-log-drawer";

export type { PrefillEntry } from "@/components/food-log-shared";

interface FoodLogProps {
  dailyCaloriesTarget?: number;
  dailyProteinTarget?: number;
  dailyCarbsTarget?: number;
  dailyFatTarget?: number;
  prefill?: import("@/components/food-log-shared").PrefillEntry | null;
  onPrefillConsumed?: () => void;
}

export function FoodLog({
  dailyCaloriesTarget, dailyProteinTarget, dailyCarbsTarget, dailyFatTarget,
  prefill, onPrefillConsumed,
}: FoodLogProps) {
  const today = todayStr();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (prefill) {
      setDrawerOpen(true);
    }
  }, [prefill]);

  const { data: dailyEntries = [], isLoading: dailyLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log", today],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?date=${today}`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load food log");
      return res.json();
    },
  });

  const confirmedDaily = dailyEntries.filter(e => e.confirmed !== false);
  const plannedDaily = dailyEntries.filter(e => e.confirmed === false);
  const totalCal = confirmedDaily.reduce((s, e) => s + e.calories, 0);
  const totalProt = confirmedDaily.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = confirmedDaily.reduce((s, e) => s + e.carbs, 0);
  const totalFat = confirmedDaily.reduce((s, e) => s + e.fat, 0);
  const plannedCal = plannedDaily.reduce((s, e) => s + e.calories, 0);

  const bySlot: Record<string, FoodLogEntry[]> = {};
  for (const slot of ALL_SLOTS) bySlot[slot] = [];
  bySlot["other"] = [];
  for (const e of dailyEntries) {
    const key = e.mealSlot && ALL_SLOTS.includes(e.mealSlot as MealSlot) ? e.mealSlot : "other";
    bySlot[key].push(e);
  }
  const filledSlots = [...ALL_SLOTS, "other"].filter(s => (bySlot[s] ?? []).length > 0);

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900">Food Log</h2>
            <p className="text-xs text-zinc-500">Track what you eat today</p>
          </div>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
          data-testid="button-add-log-entry"
        >
          <Plus className="w-4 h-4" />
          Log Meal
        </button>
      </div>

      <MacroGrid
        cal={totalCal} prot={totalProt} carbs={totalCarbs} fat={totalFat}
        calTarget={dailyCaloriesTarget} protTarget={dailyProteinTarget}
        carbsTarget={dailyCarbsTarget} fatTarget={dailyFatTarget}
      />

      {plannedDaily.length > 0 && (
        <p className="text-xs text-zinc-400 mb-3 flex items-center gap-1" data-testid="text-planned-summary">
          <span className="inline-block w-2 h-2 rounded-full bg-zinc-300" />
          {plannedDaily.length} planned meal{plannedDaily.length !== 1 ? "s" : ""} ({plannedCal} kcal) awaiting confirmation
        </p>
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
        <div className="space-y-3">
          {filledSlots.map(slotKey => {
            const entries = bySlot[slotKey] ?? [];
            const sl = slotKey as MealSlot;
            const SlotIcon = SLOT_ICONS[sl];
            const slotColor = SLOT_COLORS[sl];
            const label = SLOT_LABELS[sl] ?? "Other";
            const slotCal = entries.reduce((s, e) => s + e.calories, 0);

            return (
              <div key={slotKey} data-testid={`widget-slot-${slotKey}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {SlotIcon && slotColor && (
                    <div className={`p-1 rounded-md ${slotColor}`}>
                      <SlotIcon className="w-3 h-3" />
                    </div>
                  )}
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex-1">{label}</span>
                  <span className="text-[10px] text-zinc-400 font-medium">{slotCal} kcal</span>
                </div>
                <div className="space-y-1 ml-1">
                  {entries.map(entry => {
                    const isPlanned = entry.confirmed === false;
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${
                          isPlanned ? "opacity-60" : ""
                        }`}
                        data-testid={`log-entry-${entry.id}`}
                      >
                        <p className={`text-sm truncate flex-1 ${isPlanned ? "text-zinc-400 italic" : "text-zinc-700"}`}>
                          {entry.mealName}
                          {isPlanned && <span className="ml-1 text-[10px] not-italic text-zinc-400">(Planned)</span>}
                        </p>
                        <span className="text-xs text-zinc-500 font-medium ml-2 shrink-0">{entry.calories} kcal</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 text-center">
        <Link
          href={`/diary?date=${today}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
          data-testid="link-view-diary"
        >
          <BookOpen className="w-3.5 h-3.5" />
          View full diary
        </Link>
      </div>

      <FoodLogDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedDate={today}
        prefill={prefill}
        onPrefillConsumed={onPrefillConsumed}
      />
    </div>
  );
}
