import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ThumbsDown, ClipboardList, RefreshCw, ChevronDown, ArrowLeftRight, Zap, MoreHorizontal, Undo2, Bookmark } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ToastAction } from "@/components/ui/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserPreferences, UserMeal } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RecipeModal } from "./recipe-modal";
import type { Meal, MealPlan } from "./types";
import { AllergenDisclaimer, AllergenTags } from "@/components/allergen-disclaimer";

interface WeeklyMealViewProps {
  plan: MealPlan;
  onReplace?: (day: string, slot: string, mealName: string, idx: number) => void;
  replacingSlot?: string;
  onLogMeal?: (meal: Meal) => void;
  onReplaceFromLibrary?: (day: string, slot: string, idx: number) => void;
}

export function WeeklyMealView({ plan, onReplace, replacingSlot, onLogMeal, onReplaceFromLibrary }: WeeklyMealViewProps) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const firstAvailableDay = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].find(d => (plan as any)[d]) ?? "monday";
  const [expandedDay, setExpandedDay] = useState<string | null>(firstAvailableDay);
  const [localDisliked, setLocalDisliked] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });
  const { data: userMealsData } = useQuery<{ items: UserMeal[] }>({ queryKey: ["/api/user-meals"] });
  const savedMealNames = new Set((userMealsData?.items ?? []).map(m => m.name.toLowerCase()));
  const serverDisliked = new Set((prefs?.dislikedMeals ?? []).map(m => m.toLowerCase()));
  const isDisliked = (name: string) => localDisliked.has(name.toLowerCase()) || serverDisliked.has(name.toLowerCase());

  const undoDislike = useCallback(async (mealName: string) => {
    setLocalDisliked(prev => { const s = new Set(prev); s.delete(mealName.toLowerCase()); return s; });
    try {
      await apiRequest("DELETE", `/api/preferences/disliked-meals/${encodeURIComponent(mealName)}`);
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    } catch {}
  }, [queryClient]);

  const dislikeMutation = useMutation({
    mutationFn: (mealName: string) => {
      setLocalDisliked(prev => new Set(Array.from(prev).concat(mealName.toLowerCase())));
      return apiRequest("POST", "/api/preferences/disliked-meals", { mealName });
    },
    onSuccess: (_data, mealName) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({
        title: "Meal disliked",
        description: "It won't appear in future generated plans.",
        action: (
          <ToastAction altText="Undo dislike" onClick={() => undoDislike(mealName)} data-testid="button-undo-dislike">
            <Undo2 className="w-3 h-3 mr-1" /> Undo
          </ToastAction>
        ),
      });
    },
    onError: (_err, mealName) => {
      setLocalDisliked(prev => { const s = new Set(prev); s.delete(mealName.toLowerCase()); return s; });
      toast({ title: "Sign in to dislike meals", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { name: string; calories: number; protein: number; carbs: number; fat: number; ingredientsJson: any[]; instructions: string; mealSlot: string }) =>
      apiRequest("POST", "/api/user-meals", {
        name: payload.name,
        caloriesPerServing: payload.calories,
        proteinPerServing: payload.protein,
        carbsPerServing: payload.carbs,
        fatPerServing: payload.fat,
        ingredientsJson: payload.ingredientsJson.length > 0 ? payload.ingredientsJson : undefined,
        instructions: payload.instructions || undefined,
        mealSlot: payload.mealSlot,
        source: "ai-generated",
        confirmDuplicate: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-meals"] });
      toast({ title: "Saved to My Meals" });
    },
    onError: () => toast({ title: "Failed to save meal", variant: "destructive" }),
  });

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const weeklyPlan = plan as any;

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
              <p className="text-2xl font-bold leading-none" data-testid="text-weekly-calories">{weeklyPlan.weekTotalCalories ?? 0}</p>
              <p className="text-zinc-400 text-xs mt-0.5">Week kcal</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-weekly-protein">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                <span className="text-xs text-zinc-400 font-medium">Protein</span>
              </div>
              <p className="text-xl font-bold leading-none">{weeklyPlan.weekTotalProtein ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-weekly-carbs">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                <span className="text-xs text-zinc-400 font-medium">Carbs</span>
              </div>
              <p className="text-xl font-bold leading-none">{weeklyPlan.weekTotalCarbs ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-weekly-fat">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-3))" }} />
                <span className="text-xs text-zinc-400 font-medium">Fat</span>
              </div>
              <p className="text-xl font-bold leading-none">{weeklyPlan.weekTotalFat ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
          </div>
        </div>
      </div>

      {days.map(day => {
        const dayPlan = weeklyPlan[day];
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
                                  className="flex-1 flex justify-between p-2 rounded-xl hover:bg-zinc-50 transition-colors text-left cursor-pointer border border-zinc-100"
                                  data-testid={`meal-card-${day}-${slotKey}-${idx}`}
                                >
                                  <div className="flex-1">
                                    <p className="font-medium text-zinc-900 text-sm">{meal.meal}</p>
                                    <p className="text-xs text-zinc-500">{meal.calories} kcal · P: {meal.protein}g · C: {meal.carbs}g · F: {meal.fat}g</p>
                                    {meal.vitalityRationale && (
                                      <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1" data-testid={`vitality-rationale-${day}-${slotKey}-${idx}`}>
                                        <Zap className="w-2.5 h-2.5 flex-shrink-0" />
                                        {meal.vitalityRationale}
                                      </p>
                                    )}
                                    {Array.isArray(meal.ingredientsJson) && meal.ingredientsJson.length > 0 && (
                                      <AllergenTags ingredientNames={meal.ingredientsJson.map(i => i.name)} />
                                    )}
                                  </div>
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
                                      data-testid={`button-actions-${day}-${slotKey}-${idx}`}
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {onLogMeal && (
                                      <DropdownMenuItem onClick={() => onLogMeal(meal)} data-testid={`button-log-${day}-${slotKey}-${idx}`}>
                                        <ClipboardList className="w-3.5 h-3.5 mr-2" /> Log this meal
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => { if (!isDisliked(meal.meal)) dislikeMutation.mutate(meal.meal); }}
                                      disabled={isDisliked(meal.meal)}
                                      className={isDisliked(meal.meal) ? 'text-red-500' : ''}
                                      data-testid={`button-dislike-${day}-${slotKey}-${idx}`}
                                    >
                                      <ThumbsDown className="w-3.5 h-3.5 mr-2" /> {isDisliked(meal.meal) ? 'Disliked' : 'Dislike'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        if (!savedMealNames.has(meal.meal.toLowerCase())) {
                                          saveMutation.mutate({
                                            name: meal.meal,
                                            calories: meal.calories,
                                            protein: meal.protein,
                                            carbs: meal.carbs,
                                            fat: meal.fat,
                                            ingredientsJson: meal.ingredientsJson ?? [],
                                            instructions: "",
                                            mealSlot: slotKey,
                                          });
                                        }
                                      }}
                                      disabled={savedMealNames.has(meal.meal.toLowerCase())}
                                      data-testid={`button-save-library-${day}-${slotKey}-${idx}`}
                                    >
                                      <Bookmark className="w-3.5 h-3.5 mr-2" /> {savedMealNames.has(meal.meal.toLowerCase()) ? 'Saved' : 'Save to Library'}
                                    </DropdownMenuItem>
                                    {onReplaceFromLibrary && (
                                      <DropdownMenuItem onClick={() => onReplaceFromLibrary(day, slotKey, idx)} data-testid={`button-library-replace-${day}-${slotKey}-${idx}`}>
                                        <ArrowLeftRight className="w-3.5 h-3.5 mr-2" /> Replace from library
                                      </DropdownMenuItem>
                                    )}
                                    {onReplace && (
                                      <DropdownMenuItem
                                        onClick={() => onReplace(day, slotKey, meal.meal, idx)}
                                        disabled={replacingSlot === slotKey}
                                        data-testid={`button-replace-${day}-${slotKey}-${idx}`}
                                      >
                                        {replacingSlot === slotKey ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                                        Replace meal
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
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

      <AllergenDisclaimer className="mt-2 mb-4" />

      {selectedMeal && (
        <RecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </>
  );
}
