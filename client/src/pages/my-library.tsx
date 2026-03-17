import { useState } from "react";
import { Link } from "wouter";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { TrialBanner } from "@/components/trial-banner";
import type { TrialInfo } from "@shared/trial";
import {
  UtensilsCrossed, Wheat, Plus, Loader2, X,
  Link2, Search, Users2, ArrowLeft, Repeat,
} from "lucide-react";
import type { UserMeal, UserSavedFood, MealTemplate } from "@shared/schema";
import {
  type MealSlot, type ActiveTab,
  SLOT_OPTIONS, SLOT_COLOURS, todayStr,
} from "@/components/meals-food-shared";
import {
  MealCard, FoodCard, getMealKey, getMealSlot,
} from "@/components/meal-food-cards";
import { CommunityBrowserModal } from "@/components/community-browser-modal";
import { ImportModal } from "@/components/import-modal";
import { EditMealModal } from "@/components/edit-meal-modal";
import { EditFoodModal } from "@/components/edit-food-modal";
import { AddFoodModal } from "@/components/add-food-modal";
import { CreateMealModal } from "@/components/create-meal-modal";
import { MealTemplateModal } from "@/components/meal-template-modal";

const PAGE_SIZE = 20;

type PaginatedResponse<T> = { items: T[]; nextCursor: string | null };

async function fetchPaginated<T>(url: string, cursor?: string): Promise<PaginatedResponse<T>> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`${url}?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export default function MyLibraryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("meals");
  const [showImport, setShowImport] = useState(false);
  const [showCreateMeal, setShowCreateMeal] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showCommunityBrowser, setShowCommunityBrowser] = useState(false);
  const [mealSearch, setMealSearch] = useState("");
  const [foodSearch, setFoodSearch] = useState("");
  const [mealSlotFilter, setMealSlotFilter] = useState<MealSlot | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<UserMeal | null>(null);
  const [editFoodTarget, setEditFoodTarget] = useState<UserSavedFood | null>(null);
  const [templateTarget, setTemplateTarget] = useState<UserMeal | null>(null);

  const { data: templates = [] } = useQuery<MealTemplate[]>({
    queryKey: ["/api/meal-templates"],
  });
  const templateMealIds = new Set(templates.map(t => t.userMealId));

  const mealsQuery = useInfiniteQuery<PaginatedResponse<UserMeal>>({
    queryKey: ["/api/user-meals", "paginated"],
    queryFn: ({ pageParam }) => fetchPaginated<UserMeal>("/api/user-meals", pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const foodsQuery = useInfiniteQuery<PaginatedResponse<UserSavedFood>>({
    queryKey: ["/api/my-foods", "paginated"],
    queryFn: ({ pageParam }) => fetchPaginated<UserSavedFood>("/api/my-foods", pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const meals = mealsQuery.data?.pages.flatMap(p => p.items) ?? [];
  const myFoods = foodsQuery.data?.pages.flatMap(p => p.items) ?? [];

  const mealsLoading = mealsQuery.isLoading;
  const foodsLoading = foodsQuery.isLoading;

  const filteredMeals = meals.filter(meal => {
    if (mealSlotFilter !== "all") {
      const slot = getMealSlot(meal);
      if (slot !== mealSlotFilter) return false;
    }
    if (mealSearch.trim()) {
      if (!meal.name.toLowerCase().includes(mealSearch.trim().toLowerCase())) return false;
    }
    return true;
  });

  const filteredFoods = myFoods.filter(food => {
    if (foodSearch.trim()) {
      return food.name.toLowerCase().includes(foodSearch.trim().toLowerCase());
    }
    return true;
  });

  const logMutation = useMutation({
    mutationFn: (entry: { name: string; cal: number; prot: number; carbs: number; fat: number; slot?: string | null }) =>
      apiRequest("POST", "/api/food-log", {
        date: todayStr(),
        mealName: entry.name,
        calories: entry.cal,
        protein: entry.prot,
        carbs: entry.carbs,
        fat: entry.fat,
        mealSlot: entry.slot ?? null,
      }).then(r => r.json()),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log", todayStr()] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log/recent"] });
      setExpandedId(null);
      toast({ title: `${vars.name} logged for today` });
    },
    onError: () => toast({ title: "Failed to log meal", variant: "destructive" }),
  });

  const invalidateMeals = () => { queryClient.invalidateQueries({ queryKey: ["/api/user-meals"] }); };
  const invalidateFoods = () => { queryClient.invalidateQueries({ queryKey: ["/api/my-foods"] }); };

  const deleteMealMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/user-meals/${id}`, undefined),
    onSuccess: () => { invalidateMeals(); toast({ title: "Removed" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });
  const deleteFoodMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/my-foods/${id}`, undefined),
    onSuccess: () => { invalidateFoods(); toast({ title: "Removed from My Foods" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  function logMeal(meal: UserMeal) {
    logMutation.mutate({ name: meal.name, cal: meal.caloriesPerServing, prot: meal.proteinPerServing, carbs: meal.carbsPerServing, fat: meal.fatPerServing, slot: meal.mealSlot });
  }

  function logFood(food: UserSavedFood) {
    const factor = food.servingGrams / 100;
    logMutation.mutate({
      name: food.name,
      cal: Math.round(food.calories100g * factor),
      prot: Math.round(food.protein100g * factor),
      carbs: Math.round(food.carbs100g * factor),
      fat: Math.round(food.fat100g * factor),
      slot: null,
    });
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50/50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-zinc-500 mb-2">Sign in to view your library</p>
          <Link href="/auth" className="text-sm font-medium text-zinc-900 hover:underline" data-testid="link-sign-in-library">Sign in</Link>
        </div>
      </div>
    );
  }

  const mealCount = meals.length;
  const foodCount = myFoods.length;

  return (
    <div className="min-h-screen bg-zinc-50/50 pb-36 sm:pb-6">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 transition-colors" data-testid="link-back-dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-zinc-900 text-base leading-tight">My Library</h1>
              <p className="text-[11px] text-zinc-400">{mealCount} meals · {foodCount} foods</p>
            </div>
          </div>
        </div>
      </header>

      {user && !user.isManagedClient && (user as any).trialInfo && (
        <TrialBanner trialInfo={(user as any).trialInfo as TrialInfo} />
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex bg-zinc-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab("meals")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "meals" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-library-tab-meals"
          >
            Meals ({mealCount})
          </button>
          <button
            onClick={() => setActiveTab("foods")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "foods" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-library-tab-foods"
          >
            My Foods ({foodCount})
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "templates" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-library-tab-templates"
          >
            Templates ({templates.length})
          </button>
        </div>

        {activeTab === "meals" && (
          <div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowImport(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
                data-testid="button-library-import-recipe"
              >
                <Link2 className="w-4 h-4" />Import
              </button>
              <button
                onClick={() => setShowCreateMeal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700 transition-all"
                data-testid="button-library-create-meal"
              >
                <Plus className="w-4 h-4" />Create Meal
              </button>
            </div>

            {mealsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
            ) : meals.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <UtensilsCrossed className="w-6 h-6 text-zinc-300" />
                </div>
                <p className="text-sm font-medium text-zinc-500 mb-1">No meals saved yet</p>
                <p className="text-xs text-zinc-400">Import a recipe or create a meal from your saved foods.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search your meals..."
                      value={mealSearch}
                      onChange={e => setMealSearch(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
                      data-testid="input-library-meal-search"
                    />
                    {mealSearch && (
                      <button type="button" onClick={() => setMealSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600" data-testid="button-library-meal-search-clear">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {([{ value: "all" as const, label: "All" }, ...SLOT_OPTIONS] as { value: MealSlot | "all"; label: string }[]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setMealSlotFilter(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${mealSlotFilter === opt.value ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"}`}
                        data-testid={`button-library-meal-filter-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredMeals.length === 0 ? (
                  <div className="text-center py-12" data-testid="text-library-no-meals-match">
                    <Search className="w-8 h-8 mx-auto mb-2 text-zinc-200" />
                    <p className="text-sm text-zinc-400">No meals match your filters</p>
                    <button type="button" onClick={() => { setMealSearch(""); setMealSlotFilter("all"); }} className="mt-2 text-xs text-zinc-500 hover:text-zinc-700 font-medium" data-testid="button-library-meal-filter-clear-all">
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredMeals.map(meal => (
                      <MealCard
                        key={getMealKey(meal)}
                        meal={meal}
                        isOpen={expandedId === getMealKey(meal)}
                        onToggle={() => setExpandedId(expandedId === getMealKey(meal) ? null : getMealKey(meal))}
                        onLog={() => logMeal(meal)}
                        onEdit={() => setEditTarget(meal)}
                        onDelete={() => deleteMealMutation.mutate(meal.id)}
                        onTemplate={() => setTemplateTarget(meal)}
                        hasTemplate={templateMealIds.has(meal.id)}
                        isLogging={logMutation.isPending}
                      />
                    ))}
                  </div>
                )}

                {mealsQuery.hasNextPage && (
                  <button
                    onClick={() => mealsQuery.fetchNextPage()}
                    disabled={mealsQuery.isFetchingNextPage}
                    className="w-full mt-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 rounded-xl border border-zinc-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                    data-testid="button-library-load-more-meals"
                  >
                    {mealsQuery.isFetchingNextPage
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : "Load more meals"}
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => setShowCommunityBrowser(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
              data-testid="button-library-browse-community"
            >
              <Users2 className="w-4 h-4" />Community meals
            </button>
          </div>
        )}

        {activeTab === "foods" && (
          <div>
            <p className="text-xs text-zinc-400 mb-3" data-testid="text-library-foods-subtitle">Your personal nutrition database — save custom brands, home recipes, and staples with your own verified macros.</p>
            <button
              onClick={() => setShowAddFood(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 mb-4 rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700 transition-all"
              data-testid="button-library-add-food"
            >
              <Plus className="w-4 h-4" />Add Custom Food
            </button>

            {foodsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
            ) : myFoods.length === 0 ? (
              <div className="text-center py-16" data-testid="text-library-foods-empty">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Wheat className="w-6 h-6 text-amber-400" />
                </div>
                <p className="text-sm font-medium text-zinc-700 mb-1">Your personal food list</p>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-[280px] mx-auto">Save foods you eat regularly that aren't in our database, or items with your own verified macros.</p>
                <button
                  onClick={() => setShowAddFood(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700 transition-all"
                  data-testid="button-library-add-first-food"
                >
                  <Plus className="w-4 h-4" />Add your first custom food
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search your foods..."
                      value={foodSearch}
                      onChange={e => setFoodSearch(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
                      data-testid="input-library-food-search"
                    />
                    {foodSearch && (
                      <button type="button" onClick={() => setFoodSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600" data-testid="button-library-food-search-clear">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {filteredFoods.length === 0 ? (
                  <div className="text-center py-12" data-testid="text-library-no-foods-match">
                    <Search className="w-8 h-8 mx-auto mb-2 text-zinc-200" />
                    <p className="text-sm text-zinc-400">No foods match your search</p>
                    <button type="button" onClick={() => setFoodSearch("")} className="mt-2 text-xs text-zinc-500 hover:text-zinc-700 font-medium" data-testid="button-library-food-search-clear-all">
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredFoods.map(food => (
                      <FoodCard
                        key={food.id}
                        food={food}
                        isOpen={expandedId === `food-${food.id}`}
                        onToggle={() => setExpandedId(expandedId === `food-${food.id}` ? null : `food-${food.id}`)}
                        onLog={() => logFood(food)}
                        onEdit={() => setEditFoodTarget(food)}
                        onDelete={() => deleteFoodMutation.mutate(food.id)}
                        isLogging={logMutation.isPending}
                      />
                    ))}
                  </div>
                )}

                {foodsQuery.hasNextPage && (
                  <button
                    onClick={() => foodsQuery.fetchNextPage()}
                    disabled={foodsQuery.isFetchingNextPage}
                    className="w-full mt-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 rounded-xl border border-zinc-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                    data-testid="button-library-load-more-foods"
                  >
                    {foodsQuery.isFetchingNextPage
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : "Load more foods"}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "templates" && (
          <div>
            {templates.length === 0 ? (
              <div className="text-center py-16" data-testid="text-library-no-templates">
                <Repeat className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
                <p className="text-sm text-zinc-400">No recurring templates yet</p>
                <p className="text-xs text-zinc-300 mt-1">Set a meal as recurring from the Meals tab</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {templates.map(t => {
                  const meal = meals.find(m => m.id === t.userMealId);
                  return (
                    <div
                      key={t.id}
                      className={`rounded-xl border p-4 transition-colors ${t.active ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50 opacity-60"}`}
                      data-testid={`template-card-${t.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{meal?.name ?? "Unknown meal"}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SLOT_COLOURS[t.mealSlot as MealSlot] ?? "bg-zinc-100 text-zinc-600"}`}>
                              {t.mealSlot}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {t.daysOfWeek.length === 7 ? "Every day" : t.daysOfWeek.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ")}
                            </span>
                            {!t.active && (
                              <span className="text-[10px] text-amber-500 font-medium">Paused</span>
                            )}
                          </div>
                          {meal && (
                            <p className="text-xs text-zinc-400 mt-1">
                              {meal.caloriesPerServing} kcal · P:{meal.proteinPerServing}g · C:{meal.carbsPerServing}g · F:{meal.fatPerServing}g
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => { if (meal) setTemplateTarget(meal); }}
                          className="p-2 hover:bg-zinc-100 rounded-xl transition-colors shrink-0"
                          data-testid={`button-edit-template-${t.id}`}
                        >
                          <Repeat className="w-4 h-4 text-zinc-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSaved={() => invalidateMeals()}
        />
      )}
      {showCreateMeal && (
        <CreateMealModal
          onClose={() => setShowCreateMeal(false)}
          onSaved={() => invalidateMeals()}
        />
      )}
      {showAddFood && (
        <AddFoodModal
          onClose={() => setShowAddFood(false)}
          onSaved={() => {}}
        />
      )}
      {showCommunityBrowser && (
        <CommunityBrowserModal onClose={() => setShowCommunityBrowser(false)} />
      )}
      {editTarget && (
        <EditMealModal
          meal={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => setEditTarget(null)}
        />
      )}
      {editFoodTarget && (
        <EditFoodModal
          food={editFoodTarget}
          onClose={() => setEditFoodTarget(null)}
          onSaved={() => setEditFoodTarget(null)}
        />
      )}
      {templateTarget && (
        <MealTemplateModal
          meal={templateTarget}
          existingTemplate={templates.find(t => t.userMealId === templateTarget.id) ?? null}
          onClose={() => setTemplateTarget(null)}
        />
      )}
    </div>
  );
}
