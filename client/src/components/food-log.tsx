import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Loader2, Plus, Trash2, ClipboardList,
  Check, Star, Sparkles, X, BookOpen,
} from "lucide-react";
import type { UserRecipe } from "@shared/schema";
import {
  type MealSlot, type FoodLogEntry,
  SLOT_ICONS, SLOT_COLORS,
  todayStr,
  MacroGrid, LoggedMealModal,
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = todayStr();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FoodLogEntry | null>(null);

  const [nudgeSuggestion, setNudgeSuggestion] = useState<string | null>(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [nudgeVisible, setNudgeVisible] = useState(false);

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

  const isOffTarget = dailyCaloriesTarget && confirmedDaily.length >= 2 && (() => {
    const pctOff = (actual: number, target: number) =>
      target > 0 ? Math.abs(actual - target) / target : 0;
    return pctOff(totalCal, dailyCaloriesTarget!) > 0.2 ||
      pctOff(totalProt, dailyProteinTarget ?? 0) > 0.2 ||
      pctOff(totalCarbs, dailyCarbsTarget ?? 0) > 0.2 ||
      pctOff(totalFat, dailyFatTarget ?? 0) > 0.2;
  })();

  async function handleFetchNudge() {
    if (nudgeLoading || !dailyCaloriesTarget) return;
    setNudgeLoading(true);
    setNudgeSuggestion(null);
    setNudgeVisible(true);
    try {
      const resp = await fetch("/api/food-log/daily-nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logged: { calories: totalCal, protein: totalProt, carbs: totalCarbs, fat: totalFat },
          targets: {
            calories: dailyCaloriesTarget,
            protein: dailyProteinTarget ?? 0,
            carbs: dailyCarbsTarget ?? 0,
            fat: dailyFatTarget ?? 0,
          },
        }),
        credentials: "include",
      });
      const data = await resp.json();
      setNudgeSuggestion(data.suggestion ?? null);
    } catch {
      setNudgeSuggestion("Unable to generate suggestion right now.");
    } finally {
      setNudgeLoading(false);
    }
  }

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
        <div className="space-y-2">
          {dailyEntries.map(entry => {
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
          })}
        </div>
      )}

      {isOffTarget && (
        <div className="mt-4">
          {!nudgeVisible ? (
            <button
              onClick={handleFetchNudge}
              className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors px-3 py-2 rounded-full"
              data-testid="button-ai-nudge"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Get a meal suggestion
            </button>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-700">Suggestion</span>
                <button
                  onClick={() => { setNudgeVisible(false); setNudgeSuggestion(null); }}
                  className="ml-auto text-amber-400 hover:text-amber-600 transition-colors"
                  data-testid="button-dismiss-nudge"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {nudgeLoading ? (
                <div className="flex items-center gap-2 text-xs text-amber-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Thinking…
                </div>
              ) : (
                <p className="text-xs text-amber-800 leading-relaxed" data-testid="text-nudge-suggestion">{nudgeSuggestion}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 text-center">
        <Link
          href="/diary"
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
