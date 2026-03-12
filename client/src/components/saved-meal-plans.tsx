import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SavedMealPlan, UserPreferences } from "@shared/schema";
import { Calendar, Trash2, Pencil, Check, X, UtensilsCrossed, ChefHat, Loader2, ChevronDown, ChevronUp, Download, ShoppingCart, ThumbsDown, ClipboardList, Mail } from "lucide-react";
import { RECIPES, exportMealPlanToPDF, exportShoppingListToPDF, buildShoppingList, CATEGORY_ORDER, type Meal } from "./results-display";
import type { Calculation } from "@shared/schema";
import type { PrefillEntry } from "./food-log";

function buildCalcStub(plan: SavedMealPlan): Calculation {
  const d = plan.planData as any;
  const isWeekly = plan.planType === 'weekly';
  return {
    id: 0,
    userId: null,
    goal: '',
    dailyCalories: isWeekly ? Math.round((d.weekTotalCalories || 0) / 7) : (d.dayTotalCalories || 0),
    weeklyCalories: isWeekly ? (d.weekTotalCalories || 0) : (d.dayTotalCalories || 0) * 7,
    proteinGoal: isWeekly ? Math.round((d.weekTotalProtein || 0) / 7) : (d.dayTotalProtein || 0),
    carbsGoal: isWeekly ? Math.round((d.weekTotalCarbs || 0) / 7) : (d.dayTotalCarbs || 0),
    fatGoal: isWeekly ? Math.round((d.weekTotalFat || 0) / 7) : (d.dayTotalFat || 0),
    age: null, weight: null, height: null, gender: null, activityLevel: null, createdAt: null,
  } as unknown as Calculation;
}

export function SavedMealPlans({ onLogMeal }: { onLogMeal?: (meal: PrefillEntry) => void } = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [shoppingDialogId, setShoppingDialogId] = useState<number | null>(null);
  const [shoppingDays, setShoppingDays] = useState("7");
  const [emailingId, setEmailingId] = useState<number | null>(null);
  const [emailDaysDialogId, setEmailDaysDialogId] = useState<number | null>(null);
  const [emailDays, setEmailDays] = useState("7");

  const { data: plans = [], isLoading, isError } = useQuery<SavedMealPlan[]>({
    queryKey: ["/api/saved-meal-plans"],
    queryFn: async () => {
      const res = await fetch("/api/saved-meal-plans", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load saved plans");
      return res.json();
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PATCH", `/api/saved-meal-plans/${id}/name`, { name });
      if (!res.ok) throw new Error("Failed to rename");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/saved-meal-plans/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async ({ id, shoppingList }: { id: number; shoppingList?: Record<string, Array<{ item: string; quantity: string }>> }) => {
      setEmailingId(id);
      const res = await apiRequest("POST", `/api/saved-meal-plans/${id}/email`, { shoppingList });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to send email");
      }
    },
    onSuccess: () => {
      toast({ title: "Plan emailed!", description: "Check your inbox for the meal plan." });
      setEmailingId(null);
      setEmailDaysDialogId(null);
    },
    onError: (err: any) => {
      toast({ title: err.message || "Failed to send email", variant: "destructive" });
      setEmailingId(null);
    },
  });

  function startEdit(plan: SavedMealPlan) {
    setEditingId(plan.id);
    setEditName(plan.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  function confirmEdit(id: number) {
    if (editName.trim()) {
      renameMutation.mutate({ id, name: editName.trim() });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-10 text-red-400">
        <UtensilsCrossed className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Failed to load saved plans. Please try again.</p>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-400">
        <UtensilsCrossed className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No saved plans yet. Generate a meal plan and click Save Plan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence initial={false}>
        {plans.map((plan) => {
          const planData = plan.planData as any;
          const totalCal = plan.planType === 'weekly'
            ? planData?.weekTotalCalories
            : planData?.dayTotalCalories;
          const totalProtein = plan.planType === 'weekly'
            ? planData?.weekTotalProtein
            : planData?.dayTotalProtein;
          const isExpanded = expandedId === plan.id;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-100 rounded-3xl shadow-sm overflow-hidden"
              data-testid={`card-saved-plan-${plan.id}`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    {editingId === plan.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') confirmEdit(plan.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="flex-1 text-sm font-semibold px-2 py-1 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 min-w-0"
                          autoFocus
                          data-testid={`input-plan-name-${plan.id}`}
                        />
                        <button
                          onClick={() => confirmEdit(plan.id)}
                          disabled={renameMutation.isPending}
                          className="p-1 text-zinc-600 hover:bg-zinc-100 rounded-lg"
                          data-testid={`button-rename-confirm-${plan.id}`}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 text-zinc-400 hover:bg-zinc-100 rounded-lg"
                          data-testid={`button-rename-cancel-${plan.id}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <span className="text-sm font-semibold text-zinc-900 truncate">{plan.name}</span>
                        <button
                          onClick={() => startEdit(plan)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-all"
                          data-testid={`button-rename-${plan.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(plan.id)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    data-testid={`button-delete-plan-${plan.id}`}
                  >
                    {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${plan.planType === 'weekly' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                    <Calendar className="w-3 h-3" />
                    {plan.planType === 'weekly' ? 'Weekly' : 'Daily'}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${plan.mealStyle === 'michelin' ? 'bg-yellow-50 text-yellow-700' : plan.mealStyle === 'gourmet' ? 'bg-purple-50 text-purple-700' : 'bg-zinc-100 text-zinc-600'}`}>
                    <ChefHat className="w-3 h-3" />
                    {plan.mealStyle === 'michelin' ? 'Michelin' : plan.mealStyle === 'gourmet' ? 'Gourmet' : 'Simple'}
                  </span>
                </div>

                {(totalCal || totalProtein) && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {totalCal && (
                      <div className="bg-zinc-50 rounded-xl px-3 py-2">
                        <p className="text-xs text-zinc-500">Calories</p>
                        <p className="text-sm font-bold text-zinc-900">{totalCal.toLocaleString()} kcal</p>
                      </div>
                    )}
                    {totalProtein && (
                      <div className="bg-zinc-50 rounded-xl px-3 py-2">
                        <p className="text-xs text-zinc-500">Protein</p>
                        <p className="text-sm font-bold text-zinc-900">{totalProtein}g</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-400">
                    {new Date(plan.createdAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                    className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
                    data-testid={`button-toggle-plan-${plan.id}`}
                  >
                    {isExpanded ? (
                      <><ChevronUp className="w-3.5 h-3.5" /> Hide Plan</>
                    ) : (
                      <><ChevronDown className="w-3.5 h-3.5" /> View Plan</>
                    )}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && planData && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-zinc-100 p-5">
                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 mb-5">
                        <button
                          onClick={() => {
                            if (plan.planType === 'daily') {
                              setShoppingDialogId(plan.id);
                              setShoppingDays("7");
                            } else {
                              exportShoppingListToPDF(planData, buildCalcStub(plan));
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors"
                          data-testid={`button-saved-shopping-${plan.id}`}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Shopping List
                        </button>
                        <button
                          onClick={() => exportMealPlanToPDF(planData, buildCalcStub(plan))}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors"
                          data-testid={`button-saved-pdf-${plan.id}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export PDF
                        </button>
                        <button
                          onClick={() => {
                            if (plan.planType === 'daily') {
                              setEmailDaysDialogId(plan.id);
                              setEmailDays("7");
                            } else {
                              const shoppingList = buildShoppingList(planData);
                              emailMutation.mutate({ id: plan.id, shoppingList });
                            }
                          }}
                          disabled={emailingId === plan.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors disabled:opacity-50"
                          data-testid={`button-saved-email-${plan.id}`}
                        >
                          {emailingId === plan.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                          Email Plan
                        </button>
                      </div>

                      {/* Days dialog for daily shopping list */}
                      {shoppingDialogId === plan.id && (
                        <div className="flex items-center gap-2 mb-4 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                          <span className="text-xs text-zinc-600 font-medium">Scale for</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={shoppingDays}
                            onChange={e => setShoppingDays(e.target.value)}
                            className="w-16 px-2 py-1 text-xs border border-zinc-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            data-testid={`input-shopping-days-${plan.id}`}
                          />
                          <span className="text-xs text-zinc-600 font-medium">days</span>
                          <button
                            onClick={() => {
                              exportShoppingListToPDF(planData, buildCalcStub(plan), parseInt(shoppingDays) || 1);
                              setShoppingDialogId(null);
                            }}
                            className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-medium transition-colors"
                          >
                            Export
                          </button>
                          <button
                            onClick={() => setShoppingDialogId(null)}
                            className="p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {emailDaysDialogId === plan.id && (
                        <div className="flex items-center gap-2 mb-4 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                          <span className="text-xs text-zinc-600 font-medium">Scale shopping list for</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={emailDays}
                            onChange={e => setEmailDays(e.target.value)}
                            className="w-16 px-2 py-1 text-xs border border-zinc-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            data-testid={`input-email-days-${plan.id}`}
                          />
                          <span className="text-xs text-zinc-600 font-medium">days</span>
                          <button
                            onClick={() => {
                              const d = Math.max(1, parseInt(emailDays) || 1);
                              const shoppingList = buildShoppingList(planData, d);
                              emailMutation.mutate({ id: plan.id, shoppingList });
                            }}
                            disabled={emailingId === plan.id}
                            className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                            data-testid={`button-email-confirm-${plan.id}`}
                          >
                            {emailingId === plan.id && <Loader2 className="w-3 h-3 animate-spin" />}
                            Send
                          </button>
                          <button
                            onClick={() => setEmailDaysDialogId(null)}
                            className="p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {plan.planType === 'daily' ? (
                        <SavedDailyView plan={planData} onLogMeal={onLogMeal} />
                      ) : (
                        <SavedWeeklyView plan={planData} onLogMeal={onLogMeal} />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function SavedDailyView({ plan, onLogMeal }: { plan: any; onLogMeal?: (meal: PrefillEntry) => void }) {
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-orange-50 p-3 rounded-lg">
          <p className="text-xs text-orange-600 font-medium mb-1">Calories</p>
          <p className="text-lg font-bold text-orange-700">{plan.dayTotalCalories}</p>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <p className="text-xs text-red-600 font-medium mb-1">Protein</p>
          <p className="text-lg font-bold text-red-700">{plan.dayTotalProtein}g</p>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-xs text-blue-600 font-medium mb-1">Carbs</p>
          <p className="text-lg font-bold text-blue-700">{plan.dayTotalCarbs}g</p>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg">
          <p className="text-xs text-yellow-600 font-medium mb-1">Fat</p>
          <p className="text-lg font-bold text-yellow-700">{plan.dayTotalFat}g</p>
        </div>
      </div>

      {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map(mealType => (
        <div key={mealType} className="mb-4">
          <h5 className="text-sm font-semibold text-zinc-800 capitalize mb-2">{mealType}</h5>
          <div className="space-y-1.5">
            {plan[mealType]?.map((meal: Meal, idx: number) => (
              <div key={idx} className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedMeal(meal)}
                  className="flex-1 flex justify-between p-2.5 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors text-left cursor-pointer border border-transparent hover:border-zinc-200"
                >
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900 text-sm">{meal.meal}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-zinc-900 text-sm">{meal.calories}</p>
                    <p className="text-xs text-zinc-500">kcal</p>
                  </div>
                </button>
                {onLogMeal && (
                  <button
                    onClick={() => onLogMeal({ mealName: meal.meal, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat })}
                    className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors shrink-0"
                    title="Log this meal"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { if (!isDisliked(meal.meal)) dislikeMutation.mutate(meal.meal); }}
                  className={`p-2 rounded-lg transition-colors shrink-0 ${isDisliked(meal.meal) ? 'bg-red-50 text-red-500 cursor-default' : 'bg-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-500'}`}
                  title={isDisliked(meal.meal) ? "Disliked" : "Dislike this meal"}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {selectedMeal && (
        <SavedRecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </>
  );
}

function SavedWeeklyView({ plan, onLogMeal }: { plan: any; onLogMeal?: (meal: PrefillEntry) => void }) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [localDisliked, setLocalDisliked] = useState<Set<string>>(new Set());

  const toggleDay = (day: string) =>
    setExpandedDays(prev => { const s = new Set(prev); s.has(day) ? s.delete(day) : s.add(day); return s; });
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
      {days.map(day => {
        const dayPlan = plan[day];
        if (!dayPlan) return null;
        const isOpen = expandedDays.has(day);

        return (
          <div key={day} className="mb-2 bg-zinc-50 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleDay(day)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <h5 className="text-xs font-bold text-zinc-900 capitalize">{day}</h5>
                <span className="text-[10px] text-zinc-500">{dayPlan.dayTotalCalories} kcal · P {dayPlan.dayTotalProtein}g · C {dayPlan.dayTotalCarbs}g · F {dayPlan.dayTotalFat}g</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3 pt-1">
                    {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map(mealType => (
                      <div key={mealType} className="mb-2">
                        <h6 className="text-xs font-semibold text-zinc-600 capitalize mb-1">{mealType}</h6>
                        <div className="space-y-1">
                          {dayPlan[mealType]?.map((meal: Meal, idx: number) => (
                            <div key={idx} className="flex items-center gap-1">
                              <button
                                onClick={() => setSelectedMeal(meal)}
                                className="flex-1 flex justify-between p-2 bg-white rounded hover:bg-zinc-100 transition-colors text-left cursor-pointer border border-transparent hover:border-zinc-200"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-zinc-900 text-xs">{meal.meal}</p>
                                  <p className="text-[10px] text-zinc-500">P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g</p>
                                </div>
                                <div className="text-right ml-3">
                                  <p className="font-bold text-zinc-900 text-xs">{meal.calories}</p>
                                  <p className="text-[10px] text-zinc-500">kcal</p>
                                </div>
                              </button>
                              {onLogMeal && (
                                <button
                                  onClick={() => onLogMeal({ mealName: meal.meal, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat })}
                                  className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                                  title="Log this meal"
                                >
                                  <ClipboardList className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => { if (!isDisliked(meal.meal)) dislikeMutation.mutate(meal.meal); }}
                                className={`p-1.5 rounded transition-colors shrink-0 ${isDisliked(meal.meal) ? 'bg-red-50 text-red-500 cursor-default' : 'bg-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-500'}`}
                                title={isDisliked(meal.meal) ? "Disliked" : "Dislike this meal"}
                              >
                                <ThumbsDown className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {selectedMeal && (
        <SavedRecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </>
  );
}

function SavedRecipeModal({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const recipe = RECIPES[meal.meal];

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
          <h3 className="text-xl font-bold text-zinc-900">{meal.meal}</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="bg-orange-50 p-2.5 rounded-lg">
            <p className="text-xs text-orange-600 font-medium">Calories</p>
            <p className="text-lg font-bold text-orange-700">{meal.calories}</p>
          </div>
          <div className="bg-red-50 p-2.5 rounded-lg">
            <p className="text-xs text-red-600 font-medium">Protein</p>
            <p className="text-lg font-bold text-red-700">{meal.protein}g</p>
          </div>
          <div className="bg-blue-50 p-2.5 rounded-lg">
            <p className="text-xs text-blue-600 font-medium">Carbs</p>
            <p className="text-lg font-bold text-blue-700">{meal.carbs}g</p>
          </div>
          <div className="bg-yellow-50 p-2.5 rounded-lg">
            <p className="text-xs text-yellow-600 font-medium">Fat</p>
            <p className="text-lg font-bold text-yellow-700">{meal.fat}g</p>
          </div>
        </div>

        {recipe ? (
          <>
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
          </>
        ) : (
          <p className="text-zinc-500 text-sm mb-4">Recipe not available for this meal.</p>
        )}

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
