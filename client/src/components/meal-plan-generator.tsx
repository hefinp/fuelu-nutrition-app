import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed, Loader2, X, Download, ShoppingCart, RefreshCw, Save, Check, ThumbsDown, ClipboardList, ChevronDown, ChevronLeft, ChevronRight, Salad, ChefHat, Star, Circle, CalendarDays, AlertTriangle, Zap, Lock } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserPreferences } from "@shared/schema";
import { getCyclePhase } from "@/lib/cycle";
import type { Calculation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { RECIPES } from "./results-recipes";
import { toDateStr, addDays, getMonday, formatShort, DAY_LABELS } from "./results-pdf";
import { exportMealPlanToPDF, exportShoppingListToPDF } from "./results-pdf";

export interface Meal {
  meal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  vitalityRationale?: string;
}

interface DayMealPlan {
  breakfast: Meal[];
  lunch: Meal[];
  dinner: Meal[];
  snacks: Meal[];
  dayTotalCalories: number;
  dayTotalProtein: number;
  dayTotalCarbs: number;
  dayTotalFat: number;
}

type MealPlan = any;

export function MealPlanGenerator({ data, onLogMeal }: { data: Calculation; onLogMeal?: (meal: Meal) => void }) {
  const { user } = useAuth();
  const isMealPremium = !!(user?.betaUser || (user?.tier && user.tier !== "free"));
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [planMode, setPlanMode] = useState<'daily' | 'weekly'>('daily');
  const [mealStyle, setMealStyle] = useState<'simple' | 'gourmet' | 'michelin'>('simple');
  const [shoppingDaysOpen, setShoppingDaysOpen] = useState(false);
  const [shoppingDaysInput, setShoppingDaysInput] = useState("7");
  const [planSaved, setPlanSaved] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([toDateStr(new Date())]);
  const [weekStart, setWeekStart] = useState<string>(getMonday(toDateStr(new Date())));
  const [ignoreCycle, setIgnoreCycle] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const prevWeekRef = useRef(weekStart);
  useEffect(() => {
    if (prevWeekRef.current !== weekStart) {
      prevWeekRef.current = weekStart;
      setSelectedDates([weekStart]);
    }
  }, [weekStart]);

  const { data: mealPlanPrefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });
  const hasCycleData = !!(mealPlanPrefs?.cycleTrackingEnabled && mealPlanPrefs?.lastPeriodDate && data.gender === "female");
  const cycleEnabledButMissing = !!(mealPlanPrefs?.cycleTrackingEnabled && !mealPlanPrefs?.lastPeriodDate && data.gender === "female");
  const hasVitalityBoost = !!(mealPlanPrefs?.vitalityInsightsEnabled && mealPlanPrefs?.hormoneBoostingMeals && data.gender === "male");
  const dailyRef = selectedDates[0] || toDateStr(new Date());
  const cycleInfo = hasCycleData
    ? getCyclePhase(mealPlanPrefs!.lastPeriodDate!, mealPlanPrefs!.cycleLength ?? 28, dailyRef)
    : null;
  const weekCycleInfo = hasCycleData
    ? getCyclePhase(mealPlanPrefs!.lastPeriodDate!, mealPlanPrefs!.cycleLength ?? 28, weekStart)
    : null;

  const generateMealPlan = useMutation({
    mutationFn: async (planType: 'daily' | 'weekly') => {
      const res = await apiRequest('POST', '/api/meal-plans', {
        dailyCalories: data.dailyCalories,
        weeklyCalories: data.weeklyCalories,
        proteinGoal: data.proteinGoal,
        carbsGoal: data.carbsGoal,
        fatGoal: data.fatGoal,
        planType,
        mealStyle,
        calculationId: data.id,
        ...(planType === 'daily' ? { targetDates: selectedDates } : { weekStartDate: weekStart }),
      });
      return await res.json();
    },
    onSuccess: (planData) => {
      setMealPlan(planData);
      setPlanSaved(false);
    },
    onError: (error: Error) => {
      let title = "Failed to generate meal plan";
      let description = "Something went wrong. Please try again.";
      try {
        const match = error.message.match(/^(\d+):\s*(.*)/s);
        if (match) {
          const status = parseInt(match[1], 10);
          const body = JSON.parse(match[2]);
          if (status === 403 && body.message) {
            title = "Plan upgrade required";
            description = body.message;
          } else if (body.message) {
            description = body.message;
          }
        }
      } catch {}
      toast({ title, description, variant: "destructive" });
    },
  });

  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (!mealPlan) throw new Error("No plan to save");
      const planTypeLabel = mealPlan.planType === 'weekly' ? 'Weekly' : 'Daily';
      const dateLabel = mealPlan.planType === 'weekly'
        ? ` (${formatShort(weekStart)} – ${formatShort(addDays(weekStart, 6))})`
        : selectedDates.length === 1
          ? ` (${formatShort(selectedDates[0])})`
          : ` (${formatShort(selectedDates[0])} +${selectedDates.length - 1})`;
      const savePlanData: Record<string, any> = { ...mealPlan };
      if (mealPlanPrefs?.cycleTrackingEnabled && data.gender === "female") {
        savePlanData.cycleOptimised = hasCycleData && !ignoreCycle;
      }
      const res = await apiRequest('POST', '/api/saved-meal-plans', {
        planData: savePlanData,
        planType: mealPlan.planType === 'multi-daily' ? 'daily' : mealPlan.planType,
        mealStyle,
        calculationId: data.id,
        name: `${planTypeLabel} Plan${dateLabel}`,
      });
      return await res.json();
    },
    onSuccess: () => {
      setPlanSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      toast({ title: "Plan saved", description: "Meals added to your food log as planned entries." });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    },
  });

  const replaceMealMutation = useMutation({
    mutationFn: async ({ slot, currentMealName, targetDate }: { slot: string; currentMealName: string; targetDate?: string }) => {
      const res = await apiRequest('POST', '/api/meal-plans/replace-meal', {
        slot,
        mealStyle,
        dailyCalories: data.dailyCalories,
        proteinGoal: data.proteinGoal,
        carbsGoal: data.carbsGoal,
        fatGoal: data.fatGoal,
        currentMealName,
        ...(targetDate ? { targetDate } : {}),
      });
      return { slot, meal: await res.json() };
    },
    onError: () => {
      toast({ title: "Replace failed", description: "Could not find an alternative meal. Try again.", variant: "destructive" });
    },
  });

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
          <UtensilsCrossed className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-display font-bold text-zinc-900">Meal Planning</h2>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Plan Type</p>
        <div className="relative bg-zinc-100 rounded-2xl p-1 flex items-stretch" data-testid="plan-type-toggle">
          <div
            className="absolute top-1 bottom-1 rounded-xl bg-white shadow transition-all duration-300 ease-out"
            style={{ width: `calc((100% - 8px) / 2)`, left: planMode === 'daily' ? '4px' : `calc(4px + (100% - 8px) / 2)` }}
          />
          {([
            { key: 'daily' as const, label: 'Daily' },
            { key: 'weekly' as const, label: 'Weekly' },
          ]).map(opt => (
            <button
              key={opt.key}
              type="button"
              data-testid={`toggle-plan-type-${opt.key}`}
              onClick={() => { setPlanMode(opt.key); setMealPlan(null); }}
              className={`relative z-10 flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                planMode === opt.key ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Meal Style</p>
        {(() => {
          const styles = [
            { key: 'simple' as const,  icon: Salad,   label: 'Simple' },
            { key: 'gourmet' as const, icon: ChefHat, label: 'Fancy' },
            { key: 'michelin' as const,icon: Star,    label: 'Michelin' },
          ];
          const idx = styles.findIndex(s => s.key === mealStyle);
          const descriptions: Record<string, string> = {
            simple:  'Quick, clean meals — ideal for busy weeks.',
            gourmet: 'Bold flavours and restaurant-style dishes.',
            michelin:'Fine-dining tasting menus — truffle, Wagyu and more.',
          };
          return (
            <>
              <div className="relative bg-zinc-100 rounded-2xl p-1 flex items-stretch" data-testid="meal-style-scale">
                <div
                  className="absolute top-1 bottom-1 rounded-xl bg-white shadow transition-all duration-300 ease-out"
                  style={{ width: `calc((100% - 8px) / 3)`, left: `calc(4px + ${idx} * (100% - 8px) / 3)` }}
                />
                {styles.map((style) => (
                  <button
                    key={style.key}
                    type="button"
                    data-testid={`toggle-meal-style-${style.key}`}
                    onClick={() => { setMealStyle(style.key); setMealPlan(null); }}
                    className={`relative z-10 flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-semibold transition-colors duration-200 ${
                      mealStyle === style.key ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    <style.icon className="w-4 h-4" />
                    <span>{style.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-2">{descriptions[mealStyle]}</p>
            </>
          );
        })()}
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Schedule</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(prev => addDays(prev, -7))}
            className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-500"
            data-testid="button-week-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-zinc-700 min-w-[120px] text-center" data-testid="text-week-label">
            {formatShort(weekStart)} – {formatShort(addDays(weekStart, 6))}
          </span>
          <button
            onClick={() => setWeekStart(prev => addDays(prev, 7))}
            className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-500"
            data-testid="button-week-next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {planMode === 'daily' && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Days</p>
          <div className="flex gap-1.5 flex-wrap">
            {DAY_LABELS.map((label, i) => {
              const dateStr = addDays(weekStart, i);
              const isSelected = selectedDates.includes(dateStr);
              return (
                <button
                  key={dateStr}
                  type="button"
                  data-testid={`chip-day-${label.toLowerCase()}`}
                  onClick={() => {
                    setSelectedDates(prev =>
                      isSelected
                        ? prev.filter(d => d !== dateStr).length > 0 ? prev.filter(d => d !== dateStr) : prev
                        : [...prev, dateStr].sort()
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {cycleEnabledButMissing && !ignoreCycle && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 mb-4" data-testid="callout-cycle-missing">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-800">
              Cycle tracking is on, but your last period date isn't set — plans won't be cycle-optimised.
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("cycle-tracker-widget");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="text-[11px] font-medium text-amber-800 hover:text-amber-950 underline underline-offset-2 transition-colors"
                data-testid="link-go-to-cycle-tracker"
              >
                Go to Cycle Tracker
              </button>
              <span className="text-amber-300">|</span>
              <button
                type="button"
                onClick={() => setIgnoreCycle(true)}
                className="text-[11px] font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
                data-testid="button-ignore-cycle"
              >
                Ignore cycle tracking for now
              </button>
            </div>
          </div>
        </div>
      )}

      {planMode === 'daily' && cycleInfo && (
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-4 ${cycleInfo.bgClass} ${cycleInfo.borderClass}`}>
          <Circle className={`w-3.5 h-3.5 flex-shrink-0 ${cycleInfo.colorClass}`} />
          <p className={`text-xs font-medium ${cycleInfo.textClass}`}>
            {cycleInfo.name} phase · Day {cycleInfo.day} · {cycleInfo.shortTip}
          </p>
        </div>
      )}
      {planMode === 'weekly' && weekCycleInfo && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-4 ${weekCycleInfo.bgClass} ${weekCycleInfo.borderClass}`}>
          <Circle className={`w-3 h-3 flex-shrink-0 ${weekCycleInfo.colorClass}`} />
          <p className={`text-xs ${weekCycleInfo.textClass}`}>
            {weekCycleInfo.name} phase from {formatShort(weekStart)} · {weekCycleInfo.shortTip}
          </p>
        </div>
      )}

      {mealPlanPrefs?.vitalityInsightsEnabled && data.gender === "male" && (
        isMealPremium ? (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 mb-4" data-testid="vitality-hormone-boost-toggle">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-800">Hormone-boosting meals</p>
                <p className="text-[10px] text-amber-600">Prioritise zinc, magnesium, vitamin D-rich foods</p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await apiRequest("PUT", "/api/user/preferences", {
                  ...mealPlanPrefs,
                  hormoneBoostingMeals: !mealPlanPrefs?.hormoneBoostingMeals,
                });
                queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
              }}
              className={`w-10 h-6 rounded-full transition-colors shrink-0 ml-3 ${mealPlanPrefs?.hormoneBoostingMeals ? "bg-amber-500" : "bg-zinc-200"}`}
              data-testid="button-toggle-hormone-boost"
            >
              <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${mealPlanPrefs?.hormoneBoostingMeals ? "translate-x-5" : "translate-x-1"}`} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 mb-4 opacity-75" data-testid="vitality-hormone-boost-locked">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-zinc-500">Hormone-boosting meals</p>
                <p className="text-[10px] text-zinc-400">Upgrade to premium to unlock</p>
              </div>
            </div>
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Premium</span>
          </div>
        )
      )}

      <button
        onClick={() => generateMealPlan.mutate(planMode)}
        disabled={generateMealPlan.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-sm transition-colors"
        data-testid="button-create-plan"
      >
        {generateMealPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UtensilsCrossed className="w-4 h-4" />}
        Create Plan
      </button>

      {mealPlan && (
        <div className="mt-6 pt-6 border-t border-zinc-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-display font-bold text-zinc-900 capitalize">
                {mealPlan.planType === 'multi-daily' ? 'Multi-Day' : mealPlan.planType} Meal Plan
              </h3>
              {mealPlan.planType === 'weekly' && (mealPlan as any).weekStartDate && (
                <p className="text-xs text-zinc-400 mt-0.5">
                  <CalendarDays className="w-3 h-3 inline mr-1" />
                  {formatShort((mealPlan as any).weekStartDate)} – {formatShort(addDays((mealPlan as any).weekStartDate, 6))}
                </p>
              )}
              {(mealPlan.planType === 'daily' || mealPlan.planType === 'multi-daily') && selectedDates.length > 0 && (
                <p className="text-xs text-zinc-400 mt-0.5">
                  <CalendarDays className="w-3 h-3 inline mr-1" />
                  {selectedDates.length === 1
                    ? formatShort(selectedDates[0])
                    : `${formatShort(selectedDates[0])} + ${selectedDates.length - 1} more`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!planSaved && (
                <button
                  onClick={() => { setMealPlan(null); setPlanSaved(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200 min-h-[36px]"
                  data-testid="button-discard-plan"
                >
                  <X className="w-3.5 h-3.5" /> Discard
                </button>
              )}
              <button
                onClick={() => savePlanMutation.mutate()}
                disabled={savePlanMutation.isPending || planSaved}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors min-h-[36px] ${
                  planSaved
                    ? "bg-zinc-100 text-zinc-600 border border-zinc-200 cursor-default"
                    : "bg-zinc-900 hover:bg-zinc-700 text-white"
                }`}
                data-testid="button-save-plan"
              >
                {savePlanMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                ) : planSaved ? (
                  <><Check className="w-3.5 h-3.5" /> Saved</>
                ) : (
                  <><Save className="w-3.5 h-3.5" /> Save Plan</>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => {
                if (mealPlan.planType === 'daily') {
                  setShoppingDaysOpen(true);
                } else {
                  exportShoppingListToPDF(mealPlan, data);
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors"
              data-testid="button-export-shopping-list"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Shopping List
            </button>
            <button
              onClick={() => exportMealPlanToPDF(mealPlan, data)}
              className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors"
              data-testid="button-export-pdf"
            >
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </button>
          </div>

          {mealPlan.planType === 'multi-daily' ? (
            <div className="space-y-6">
              {(mealPlan as any).targetDates?.map((dateStr: string) => {
                const dayPlan = (mealPlan as any).days?.[dateStr];
                if (!dayPlan) return null;
                const [y, m, d] = dateStr.split("-").map(Number);
                const dateLabel = new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                return (
                  <div key={dateStr}>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {dateLabel}
                    </p>
                    <DailyMealView
                      plan={{ ...dayPlan, planType: 'daily' }}
                      onLogMeal={onLogMeal}
                      onReplace={(slot, mealName, idx) => {
                        replaceMealMutation.mutate({ slot, currentMealName: mealName, targetDate: dateStr }, {
                          onSuccess: ({ slot: s, meal: newMeal }) => {
                            setMealPlan((prev: any) => {
                              if (!prev) return prev;
                              const key = s === 'snack' ? 'snacks' : s;
                              const updatedDay = { ...prev.days[dateStr] };
                              const arr = [...(updatedDay[key] || [])];
                              arr[idx] = newMeal;
                              updatedDay[key] = arr;
                              const allMeals = [...updatedDay.breakfast, ...updatedDay.lunch, ...updatedDay.dinner, ...updatedDay.snacks];
                              updatedDay.dayTotalCalories = allMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
                              return { ...prev, days: { ...prev.days, [dateStr]: updatedDay } };
                            });
                            setPlanSaved(false);
                          },
                        });
                      }}
                      replacingSlot={replaceMealMutation.isPending ? replaceMealMutation.variables?.slot : undefined}
                    />
                  </div>
                );
              })}
            </div>
          ) : mealPlan.planType === 'daily' ? (
            <DailyMealView
              plan={mealPlan}
              onLogMeal={onLogMeal}
              onReplace={(slot, mealName, idx) => {
                const dailyTargetDate = (mealPlan as any).targetDate;
                replaceMealMutation.mutate({ slot, currentMealName: mealName, ...(dailyTargetDate ? { targetDate: dailyTargetDate } : {}) }, {
                  onSuccess: ({ slot: s, meal: newMeal }) => {
                    setMealPlan((prev: any) => {
                      if (!prev) return prev;
                      const key = s === 'snack' ? 'snacks' : s;
                      const updated = { ...prev };
                      const arr = [...(updated[key] || [])];
                      arr[idx] = newMeal;
                      updated[key] = arr;
                      const allMeals = [...updated.breakfast, ...updated.lunch, ...updated.dinner, ...updated.snacks];
                      updated.dayTotalCalories = allMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
                      updated.dayTotalProtein = allMeals.reduce((sum: number, m: any) => sum + m.protein, 0);
                      updated.dayTotalCarbs = allMeals.reduce((sum: number, m: any) => sum + m.carbs, 0);
                      updated.dayTotalFat = allMeals.reduce((sum: number, m: any) => sum + m.fat, 0);
                      return updated;
                    });
                    setPlanSaved(false);
                  },
                });
              }}
              replacingSlot={replaceMealMutation.isPending ? replaceMealMutation.variables?.slot : undefined}
            />
          ) : (
            <WeeklyMealView
              plan={mealPlan}
              onLogMeal={onLogMeal}
              onReplace={(day, slot, mealName, idx) => {
                const dayOffsets: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
                const ws = (mealPlan as any).weekStartDate as string | undefined;
                const targetDate = ws ? addDays(ws, dayOffsets[day] ?? 0) : undefined;
                replaceMealMutation.mutate({ slot, currentMealName: mealName, targetDate }, {
                  onSuccess: ({ slot: s, meal: newMeal }) => {
                    setMealPlan((prev: any) => {
                      if (!prev) return prev;
                      const updated = { ...prev };
                      const dayPlan = { ...updated[day] };
                      const key = s === 'snack' ? 'snacks' : s;
                      const arr = [...(dayPlan[key] || [])];
                      arr[idx] = newMeal;
                      dayPlan[key] = arr;
                      const allDayMeals = [...dayPlan.breakfast, ...dayPlan.lunch, ...dayPlan.dinner, ...dayPlan.snacks];
                      dayPlan.dayTotalCalories = allDayMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
                      dayPlan.dayTotalProtein = allDayMeals.reduce((sum: number, m: any) => sum + m.protein, 0);
                      dayPlan.dayTotalCarbs = allDayMeals.reduce((sum: number, m: any) => sum + m.carbs, 0);
                      dayPlan.dayTotalFat = allDayMeals.reduce((sum: number, m: any) => sum + m.fat, 0);
                      updated[day] = dayPlan;
                      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                      updated.weekTotalCalories = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalCalories || 0), 0);
                      updated.weekTotalProtein = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalProtein || 0), 0);
                      updated.weekTotalCarbs = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalCarbs || 0), 0);
                      updated.weekTotalFat = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalFat || 0), 0);
                      return updated;
                    });
                    setPlanSaved(false);
                  },
                });
              }}
              replacingSlot={replaceMealMutation.isPending ? replaceMealMutation.variables?.slot : undefined}
            />
          )}
        </div>
      )}

      {shoppingDaysOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-display font-bold text-zinc-900">Shopping List</h3>
            </div>
            <p className="text-sm text-zinc-500 mb-5 mt-1">
              How many days are you shopping for? Ingredient quantities will be scaled accordingly.
            </p>
            <div className="mb-5">
              <label className="block text-sm font-medium text-zinc-700 mb-2">Number of days</label>
              <input
                type="number"
                min="1"
                max="30"
                value={shoppingDaysInput}
                onChange={e => setShoppingDaysInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const d = Math.max(1, parseInt(shoppingDaysInput) || 1);
                    setShoppingDaysOpen(false);
                    exportShoppingListToPDF(mealPlan!, data, d);
                  }
                }}
                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
                data-testid="input-shopping-days"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShoppingDaysOpen(false)}
                className="flex-1 px-4 py-2.5 border border-zinc-200 text-zinc-700 rounded-xl font-medium text-sm hover:bg-zinc-50 transition-colors"
                data-testid="button-shopping-days-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const d = Math.max(1, parseInt(shoppingDaysInput) || 1);
                  setShoppingDaysOpen(false);
                  exportShoppingListToPDF(mealPlan!, data, d);
                }}
                className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-medium text-sm transition-colors"
                data-testid="button-shopping-days-confirm"
              >
                Generate PDF
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function DailyMealView({ plan, onReplace, replacingSlot, onLogMeal }: { plan: any; onReplace?: (slot: string, mealName: string, idx: number) => void; replacingSlot?: string; onLogMeal?: (meal: Meal) => void }) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [localDisliked, setLocalDisliked] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });
  const serverDisliked = new Set((prefs?.dislikedMeals ?? []).map(m => m.toLowerCase()));

  const isDisliked = (name: string) => localDisliked.has(name.toLowerCase()) || serverDisliked.has(name.toLowerCase());

  const dislikeMutation = useMutation({
    mutationFn: (mealName: string) => {
      setLocalDisliked(prev => new Set(Array.from(prev).concat(mealName.toLowerCase())));
      return apiRequest("POST", "/api/preferences/disliked-meals", { mealName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Meal disliked", description: "It won't appear in future generated plans." });
    },
    onError: (_err, mealName) => {
      setLocalDisliked(prev => { const s = new Set(prev); s.delete(mealName.toLowerCase()); return s; });
      toast({ title: "Sign in to dislike meals", variant: "destructive" });
    },
  });

  return (
    <>
      <div className="bg-zinc-900 text-white rounded-3xl shadow-2xl relative overflow-hidden mb-8">
        <div className="absolute top-[-50%] right-[-10%] w-96 h-96 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold" data-testid="text-daily-macro-title">Daily Totals</h3>
              <p className="text-zinc-400 text-xs mt-0.5">Meal plan summary</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold leading-none" data-testid="text-daily-calories">{plan.dayTotalCalories ?? 0}</p>
              <p className="text-zinc-400 text-xs mt-0.5">Total kcal</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-daily-protein">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                <span className="text-xs text-zinc-400 font-medium">Protein</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.dayTotalProtein ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-daily-carbs">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                <span className="text-xs text-zinc-400 font-medium">Carbs</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.dayTotalCarbs ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-daily-fat">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-3))" }} />
                <span className="text-xs text-zinc-400 font-medium">Fat</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.dayTotalFat ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
          </div>
        </div>
      </div>

      {["breakfast", "lunch", "dinner", "snacks"].map((slotKey) => {
        const meals: Meal[] = plan[slotKey] || [];
        if (meals.length === 0) return null;
        return (
          <div key={slotKey} className="mb-6">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
              {slotKey.charAt(0).toUpperCase() + slotKey.slice(1)}
            </h4>
            {meals.map((meal, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setSelectedMeal(meal)}
                  className="flex-1 flex justify-between p-2 bg-zinc-50 rounded hover:bg-zinc-100 transition-colors text-left cursor-pointer border border-transparent hover:border-zinc-200"
                  data-testid={`meal-card-daily-${slotKey}-${idx}`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900 text-sm">{meal.meal}</p>
                    <p className="text-xs text-zinc-500">P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g</p>
                    {meal.vitalityRationale && (
                      <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1" data-testid={`vitality-rationale-daily-${slotKey}-${idx}`}>
                        <Zap className="w-2.5 h-2.5 flex-shrink-0" />
                        {meal.vitalityRationale}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-zinc-900 text-sm">{meal.calories}</p>
                    <p className="text-xs text-zinc-500">kcal</p>
                  </div>
                </button>
                {onLogMeal && (
                  <button
                    onClick={() => onLogMeal(meal)}
                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                    title="Log this meal"
                    data-testid={`button-log-daily-${slotKey}-${idx}`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { if (!isDisliked(meal.meal)) dislikeMutation.mutate(meal.meal); }}
                  className={`p-1.5 rounded transition-colors shrink-0 ${isDisliked(meal.meal) ? 'bg-red-50 text-red-500 cursor-default' : 'bg-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-500'}`}
                  title={isDisliked(meal.meal) ? "Disliked" : "Dislike this meal"}
                  data-testid={`button-dislike-daily-${slotKey}-${idx}`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
                {onReplace && (
                  <button
                    onClick={() => onReplace(slotKey, meal.meal, idx)}
                    disabled={replacingSlot === slotKey}
                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                    title="Replace meal"
                    data-testid={`button-replace-daily-${slotKey}-${idx}`}
                  >
                    {replacingSlot === slotKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {selectedMeal && (
        <RecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </>
  );
}

function WeeklyMealView({ plan, onReplace, replacingSlot, onLogMeal }: { plan: any; onReplace?: (day: string, slot: string, mealName: string, idx: number) => void; replacingSlot?: string; onLogMeal?: (meal: Meal) => void }) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>("monday");
  const [localDisliked, setLocalDisliked] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });
  const serverDisliked = new Set((prefs?.dislikedMeals ?? []).map(m => m.toLowerCase()));
  const isDisliked = (name: string) => localDisliked.has(name.toLowerCase()) || serverDisliked.has(name.toLowerCase());

  const dislikeMutation = useMutation({
    mutationFn: (mealName: string) => {
      setLocalDisliked(prev => new Set(Array.from(prev).concat(mealName.toLowerCase())));
      return apiRequest("POST", "/api/preferences/disliked-meals", { mealName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Meal disliked", description: "It won't appear in future generated plans." });
    },
    onError: (_err, mealName) => {
      setLocalDisliked(prev => { const s = new Set(prev); s.delete(mealName.toLowerCase()); return s; });
      toast({ title: "Sign in to dislike meals", variant: "destructive" });
    },
  });

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  return (
    <>
      <div className="bg-zinc-900 text-white rounded-3xl shadow-2xl relative overflow-hidden mb-6">
        <div className="absolute top-[-50%] right-[-10%] w-96 h-96 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold" data-testid="text-weekly-macro-title">Weekly Totals</h3>
              <p className="text-zinc-400 text-xs mt-0.5">Meal plan summary</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold leading-none" data-testid="text-weekly-calories">{plan.weekTotalCalories ?? 0}</p>
              <p className="text-zinc-400 text-xs mt-0.5">Week kcal</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-weekly-protein">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                <span className="text-xs text-zinc-400 font-medium">Protein</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.weekTotalProtein ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-weekly-carbs">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                <span className="text-xs text-zinc-400 font-medium">Carbs</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.weekTotalCarbs ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-weekly-fat">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-3))" }} />
                <span className="text-xs text-zinc-400 font-medium">Fat</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.weekTotalFat ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
          </div>
        </div>
      </div>

      {days.map(day => {
        const dayPlan = plan[day];
        if (!dayPlan) return null;
        const isExpanded = expandedDay === day;
        return (
          <div key={day} className="border border-zinc-100 rounded-2xl mb-3 overflow-hidden">
            <button
              onClick={() => setExpandedDay(isExpanded ? null : day)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
              data-testid={`accordion-day-${day}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-zinc-900 capitalize w-24">{day}</span>
                <span className="text-xs text-zinc-500">{dayPlan.dayTotalCalories} kcal</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    {["breakfast", "lunch", "dinner", "snacks"].map(slotKey => {
                      const meals: Meal[] = dayPlan[slotKey] || [];
                      if (meals.length === 0) return null;
                      return (
                        <div key={slotKey}>
                          <h5 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">
                            {slotKey.charAt(0).toUpperCase() + slotKey.slice(1)}
                          </h5>
                          <div className="space-y-1.5">
                            {meals.map((meal, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <button
                                  onClick={() => setSelectedMeal(meal)}
                                  className="flex-1 flex justify-between p-2 bg-white rounded hover:bg-zinc-100 transition-colors text-left cursor-pointer border border-transparent hover:border-zinc-200"
                                  data-testid={`meal-card-${day}-${slotKey}-${idx}`}
                                >
                                  <div className="flex-1">
                                    <p className="font-medium text-zinc-900 text-sm">{meal.meal}</p>
                                    <p className="text-xs text-zinc-500">P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g</p>
                                    {meal.vitalityRationale && (
                                      <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1" data-testid={`vitality-rationale-${day}-${slotKey}-${idx}`}>
                                        <Zap className="w-2.5 h-2.5 flex-shrink-0" />
                                        {meal.vitalityRationale}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="font-bold text-zinc-900 text-sm">{meal.calories}</p>
                                    <p className="text-xs text-zinc-500">kcal</p>
                                  </div>
                                </button>
                                {onLogMeal && (
                                  <button
                                    onClick={() => onLogMeal(meal)}
                                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                                    title="Log this meal"
                                    data-testid={`button-log-${day}-${slotKey}-${idx}`}
                                  >
                                    <ClipboardList className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => { if (!isDisliked(meal.meal)) dislikeMutation.mutate(meal.meal); }}
                                  className={`p-1.5 rounded transition-colors shrink-0 ${isDisliked(meal.meal) ? 'bg-red-50 text-red-500 cursor-default' : 'bg-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-500'}`}
                                  title={isDisliked(meal.meal) ? "Disliked" : "Dislike this meal"}
                                  data-testid={`button-dislike-${day}-${slotKey}-${idx}`}
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>
                                {onReplace && (
                                  <button
                                    onClick={() => onReplace(day, slotKey, meal.meal, idx)}
                                    disabled={replacingSlot === slotKey}
                                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                                    title="Replace meal"
                                    data-testid={`button-replace-${day}-${slotKey}-${idx}`}
                                  >
                                    {replacingSlot === slotKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {selectedMeal && (
        <RecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </>
  );
}

function RecipeModal({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const recipe = RECIPES[meal.meal];

  if (!recipe) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-zinc-600">Recipe not available for this meal.</p>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900">{meal.meal}</h3>
            <p className="text-sm text-zinc-500 mt-1">Click outside to close</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-xs text-orange-600 font-medium">Calories</p>
            <p className="text-lg font-bold text-orange-700">{meal.calories}</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-xs text-red-600 font-medium">Protein</p>
            <p className="text-lg font-bold text-red-700">{meal.protein}g</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-600 font-medium">Carbs</p>
            <p className="text-lg font-bold text-blue-700">{meal.carbs}g</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-xs text-yellow-600 font-medium">Fat</p>
            <p className="text-lg font-bold text-yellow-700">{meal.fat}g</p>
          </div>
        </div>

        <div className="bg-zinc-50 p-4 rounded-xl mb-4">
          <h4 className="text-sm font-semibold text-zinc-900 mb-3">Ingredients</h4>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, idx) => (
              <li key={idx} className="flex justify-between text-sm text-zinc-700">
                <span>{ing.item}</span>
                <span className="font-medium text-zinc-900">{ing.quantity}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-zinc-50 p-4 rounded-xl mb-4">
          <h4 className="text-sm font-semibold text-zinc-900 mb-2">Instructions</h4>
          <p className="text-sm text-zinc-600 leading-relaxed">{recipe.instructions}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}
