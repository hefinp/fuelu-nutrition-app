import { useState, useEffect, useMemo } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  UtensilsCrossed, Wheat, Plus, Loader2, X,
  Link2, Search, Users2, ArrowRight, Repeat,
} from "lucide-react";
import type { UserMeal, UserSavedFood, MealTemplate, CommunityMeal } from "@shared/schema";
import { ConfirmDialog, useConfirmDialog } from "@/components/confirm-dialog";

type EnrichedTemplate = MealTemplate & { mealName?: string | null };
import {
  type MealSlot, type ActiveTab,
  SLOT_OPTIONS, SLOT_COLOURS, todayStr,
} from "@/components/meals-food-shared";
import {
  MealCard, FoodCard, getMealKey,
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

async function fetchPaginated<T>(url: string, cursor?: string, filters?: Record<string, string>): Promise<PaginatedResponse<T>> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set("cursor", cursor);
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v);
    }
  }
  const res = await fetch(`${url}?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export function MyMealsFoodWidget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("meals");
  const [showImport, setShowImport] = useState(false);
  const [showCreateMeal, setShowCreateMeal] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [addFoodInitialTab, setAddFoodInitialTab] = useState<"search" | "scan" | "ai" | "manual">("search");
  const [showCommunityBrowser, setShowCommunityBrowser] = useState(false);
  const [mealSearch, setMealSearch] = useState("");
  const [foodSearch, setFoodSearch] = useState("");
  const [mealSlotFilter, setMealSlotFilter] = useState<MealSlot | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<UserMeal | null>(null);
  const [editFoodTarget, setEditFoodTarget] = useState<UserSavedFood | null>(null);
  const [templateTarget, setTemplateTarget] = useState<UserMeal | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const [debouncedMealSearch, setDebouncedMealSearch] = useState("");
  const [debouncedFoodSearch, setDebouncedFoodSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedMealSearch(mealSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [mealSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFoodSearch(foodSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [foodSearch]);

  useEffect(() => { setExpandedId(null); }, [activeTab]);

  const { data: templates = [] } = useQuery<EnrichedTemplate[]>({
    queryKey: ["/api/meal-templates"],
  });
  const templateMealIds = new Set(templates.map(t => t.userMealId));

  const mealFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (debouncedMealSearch) f.search = debouncedMealSearch;
    if (mealSlotFilter !== "all") f.slot = mealSlotFilter;
    return f;
  }, [debouncedMealSearch, mealSlotFilter]);

  const foodFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (debouncedFoodSearch) f.search = debouncedFoodSearch;
    return f;
  }, [debouncedFoodSearch]);

  const mealsQuery = useInfiniteQuery<PaginatedResponse<UserMeal>>({
    queryKey: ["/api/user-meals", "paginated", mealFilters],
    queryFn: ({ pageParam }) => fetchPaginated<UserMeal>("/api/user-meals", pageParam as string | undefined, mealFilters),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const foodsQuery = useInfiniteQuery<PaginatedResponse<UserSavedFood>>({
    queryKey: ["/api/my-foods", "paginated", foodFilters],
    queryFn: ({ pageParam }) => fetchPaginated<UserSavedFood>("/api/my-foods", pageParam as string | undefined, foodFilters),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const meals = mealsQuery.data?.pages.flatMap(p => p.items) ?? [];
  const myFoods = foodsQuery.data?.pages.flatMap(p => p.items) ?? [];

  const mealsLoading = mealsQuery.isLoading;
  const foodsLoading = foodsQuery.isLoading;

  const { data: mySharedMeals = [] } = useQuery<CommunityMeal[]>({
    queryKey: ["/api/community-meals/my"],
  });

  const sharedMealByRecipeId = useMemo(() => {
    const map = new Map<number, CommunityMeal>();
    for (const sm of mySharedMeals) {
      if (sm.sourceRecipeId != null) {
        map.set(sm.sourceRecipeId, sm);
      }
    }
    return map;
  }, [mySharedMeals]);

  const sharedMealIds = useMemo(() => mySharedMeals.map(m => m.id), [mySharedMeals]);

  const { data: commentCounts = {} } = useQuery<Record<number, number>>({
    queryKey: ["/api/community-meals/comment-counts", sharedMealIds.join(",")],
    queryFn: async () => {
      if (sharedMealIds.length === 0) return {};
      const res = await fetch(`/api/community-meals/comment-counts?ids=${sharedMealIds.join(",")}`, { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: sharedMealIds.length > 0,
  });

  const [sharingMealId, setSharingMealId] = useState<number | null>(null);

  const shareMutation = useMutation({
    mutationFn: (meal: UserMeal) => {
      setSharingMealId(meal.id);
      return apiRequest("POST", "/api/community-meals", {
        recipeId: meal.id,
        name: meal.name,
        slot: meal.mealSlot || "dinner",
        style: meal.mealStyle || "simple",
        caloriesPerServing: meal.caloriesPerServing,
        proteinPerServing: meal.proteinPerServing,
        carbsPerServing: meal.carbsPerServing,
        fatPerServing: meal.fatPerServing,
        ingredientsJson: meal.ingredientsJson || undefined,
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-meals/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community-meals"] });
      toast({ title: "Shared with community" });
      setSharingMealId(null);
    },
    onError: () => {
      toast({ title: "Failed to share", variant: "destructive" });
      setSharingMealId(null);
    },
  });

  const unshareMutation = useMutation({
    mutationFn: (params: { communityMealId: number; userMealId: number }) => {
      setSharingMealId(params.userMealId);
      return apiRequest("DELETE", `/api/community-meals/${params.communityMealId}/unshare`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-meals/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community-meals"] });
      toast({ title: "Unshared from community" });
      setSharingMealId(null);
    },
    onError: () => {
      toast({ title: "Failed to unshare", variant: "destructive" });
      setSharingMealId(null);
    },
  });

  function getSharedMeal(meal: UserMeal): CommunityMeal | null {
    return sharedMealByRecipeId.get(meal.id) ?? null;
  }

  const logMutation = useMutation({
    mutationFn: (entry: { name: string; cal: number; prot: number; carbs: number; fat: number; slot?: string | null; source?: string }) =>
      apiRequest("POST", "/api/food-log", {
        date: todayStr(),
        mealName: entry.name,
        calories: entry.cal,
        protein: entry.prot,
        carbs: entry.carbs,
        fat: entry.fat,
        mealSlot: entry.slot ?? null,
        source: entry.source ?? "meal",
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

  const invalidateMeals = () => { queryClient.invalidateQueries({ queryKey: ["/api/user-meals"] }); queryClient.invalidateQueries({ queryKey: ["/api/meal-templates"] }); };
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

  function logMeal(meal: UserMeal, slot: MealSlot) {
    logMutation.mutate({ name: meal.name, cal: meal.caloriesPerServing, prot: meal.proteinPerServing, carbs: meal.carbsPerServing, fat: meal.fatPerServing, slot });
  }

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-display font-bold text-zinc-900">My Meals & Food</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Your saved meals, recipes & foods</p>
            </div>
          </div>
          <Link href="/my-library" className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors" data-testid="link-view-all-library">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex bg-zinc-100 rounded-xl p-1 mb-4">
          <button
            onClick={() => setActiveTab("meals")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "meals" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-tab-meals"
          >
            Meals
          </button>
          <button
            onClick={() => setActiveTab("foods")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "foods" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-tab-foods"
          >
            My Foods
          </button>
          <button
            onClick={() => setActiveTab("saved-plans")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "saved-plans" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-tab-saved-plans"
          >
            Saved Plans
          </button>
        </div>
      </div>

      <div className="px-6 pb-6">
        {activeTab === "meals" && (
          <div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowImport(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
                data-testid="button-import-recipe"
              >
                <Link2 className="w-3.5 h-3.5" />Import
              </button>
              <button
                onClick={() => setShowCreateMeal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-700 transition-all"
                data-testid="button-create-meal"
              >
                <Plus className="w-3.5 h-3.5" />Create Meal
              </button>
            </div>

            {mealsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
            ) : meals.length === 0 && !debouncedMealSearch && mealSlotFilter === "all" ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <UtensilsCrossed className="w-5 h-5 text-zinc-300" />
                </div>
                <p className="text-sm font-medium text-zinc-500 mb-1">No meals saved yet</p>
                <p className="text-xs text-zinc-400">Import a recipe or create a meal from your saved foods.</p>
              </div>
            ) : (
              <>
                <div className="mb-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search your meals..."
                      value={mealSearch}
                      onChange={e => setMealSearch(e.target.value)}
                      className="w-full pl-8 pr-8 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
                      data-testid="input-meal-search"
                    />
                    {mealSearch && (
                      <button type="button" onClick={() => setMealSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600" data-testid="button-meal-search-clear">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {([{ value: "all" as const, label: "All" }, ...SLOT_OPTIONS] as { value: MealSlot | "all"; label: string }[]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setMealSlotFilter(opt.value)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${mealSlotFilter === opt.value ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"}`}
                        data-testid={`button-meal-filter-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {meals.length === 0 ? (
                  <div className="text-center py-8" data-testid="text-no-meals-match">
                    <Search className="w-8 h-8 mx-auto mb-2 text-zinc-200" />
                    <p className="text-sm text-zinc-400">No meals match your filters</p>
                    <button type="button" onClick={() => { setMealSearch(""); setMealSlotFilter("all"); }} className="mt-2 text-xs text-zinc-500 hover:text-zinc-700 font-medium" data-testid="button-meal-filter-clear-all">
                      Clear filters
                    </button>
                  </div>
                ) : (
                <div className="space-y-1.5">
                  {meals.map(meal => {
                    const key = getMealKey(meal);
                    const shared = getSharedMeal(meal);
                    return (
                      <MealCard
                        key={key}
                        meal={meal}
                        isOpen={expandedId === key}
                        onToggle={() => setExpandedId(expandedId === key ? null : key)}
                        onLog={(slot) => logMeal(meal, slot)}
                        onEdit={() => setEditTarget(meal)}
                        onDelete={() => confirm({ title: `Remove "${meal.name}"?`, description: `This will permanently remove "${meal.name}" from your saved meals.`, confirmLabel: "Remove", onConfirm: () => deleteMealMutation.mutate(meal.id) })}
                        onTemplate={() => setTemplateTarget(meal)}
                        hasTemplate={templateMealIds.has(meal.id)}
                        isLogging={logMutation.isPending}
                        sharedMeal={shared}
                        onShare={() => shareMutation.mutate(meal)}
                        onUnshare={() => shared && unshareMutation.mutate({ communityMealId: shared.id, userMealId: meal.id })}
                        isSharing={sharingMealId === meal.id}
                        commentCount={shared ? (commentCounts[shared.id] ?? 0) : undefined}
                      />
                    );
                  })}
                </div>
                )}
                {mealsQuery.hasNextPage && (
                  <button
                    onClick={() => mealsQuery.fetchNextPage()}
                    disabled={mealsQuery.isFetchingNextPage}
                    className="w-full mt-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 rounded-xl border border-zinc-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                    data-testid="button-load-more-meals"
                  >
                    {mealsQuery.isFetchingNextPage
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : "Load more meals"}
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => setShowCommunityBrowser(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
              data-testid="button-browse-community"
            >
              <Users2 className="w-4 h-4" />Community meals
            </button>
          </div>
        )}

        {activeTab === "foods" && (
          <div>
            <p className="text-xs text-zinc-400 mb-3" data-testid="text-my-foods-subtitle">Your personal nutrition database — custom brands, home recipes & staples with your own verified macros.</p>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setAddFoodInitialTab("search"); setShowAddFood(true); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-700 transition-all"
                data-testid="button-search-add-food"
              >
                <Search className="w-3.5 h-3.5" />Search & Add
              </button>
              <button
                onClick={() => { setAddFoodInitialTab("manual"); setShowAddFood(true); }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-all"
                data-testid="button-add-food"
              >
                <Plus className="w-3.5 h-3.5" />Custom
              </button>
            </div>

            {foodsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
            ) : myFoods.length === 0 && !debouncedFoodSearch ? (
              <div className="text-center py-10" data-testid="text-my-foods-empty">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Wheat className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-sm font-medium text-zinc-700 mb-1">Your personal food list</p>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-[260px] mx-auto">Save foods you eat regularly that aren't in our database, or items with your own verified macros.</p>
                <button
                  onClick={() => { setAddFoodInitialTab("search"); setShowAddFood(true); }}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-700 transition-all"
                  data-testid="button-add-first-food"
                >
                  <Search className="w-3.5 h-3.5" />Search & add your first food
                </button>
              </div>
            ) : (() => {
              const filteredFoods = myFoods;
              return (
              <>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search your foods..."
                    value={foodSearch}
                    onChange={e => setFoodSearch(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
                    data-testid="input-food-search"
                  />
                  {foodSearch && (
                    <button type="button" onClick={() => setFoodSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600" data-testid="button-food-search-clear">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {filteredFoods.length === 0 ? (
                  <div className="text-center py-8" data-testid="text-no-foods-match">
                    <Search className="w-8 h-8 mx-auto mb-2 text-zinc-200" />
                    <p className="text-sm text-zinc-400">No foods match your search</p>
                    <button type="button" onClick={() => setFoodSearch("")} className="mt-2 text-xs text-zinc-500 hover:text-zinc-700 font-medium" data-testid="button-food-search-clear-all">
                      Clear search
                    </button>
                  </div>
                ) : (
              <div className="space-y-1.5">
                {filteredFoods.map(food => (
                  <FoodCard
                    key={food.id}
                    food={food}
                    isOpen={expandedId === `food-${food.id}`}
                    onToggle={() => setExpandedId(expandedId === `food-${food.id}` ? null : `food-${food.id}`)}
                    onLog={(slot) => {
                      const factor = food.servingGrams / 100;
                      logMutation.mutate({
                        name: food.name,
                        cal: Math.round(food.calories100g * factor),
                        prot: Math.round(food.protein100g * factor),
                        carbs: Math.round(food.carbs100g * factor),
                        fat: Math.round(food.fat100g * factor),
                        slot,
                        source: "search",
                      });
                    }}
                    onEdit={() => setEditFoodTarget(food)}
                    onDelete={() => confirm({ title: `Remove "${food.name}"?`, description: `This will permanently remove "${food.name}" from your saved foods.`, confirmLabel: "Remove", onConfirm: () => deleteFoodMutation.mutate(food.id) })}
                    isLogging={logMutation.isPending}
                  />
                ))}
              </div>
                )}
                {foodsQuery.hasNextPage && (
                  <button
                    onClick={() => foodsQuery.fetchNextPage()}
                    disabled={foodsQuery.isFetchingNextPage}
                    className="w-full mt-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 rounded-xl border border-zinc-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                    data-testid="button-load-more-foods"
                  >
                    {foodsQuery.isFetchingNextPage
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : "Load more foods"}
                  </button>
                )}
              </>
              );
            })()}
          </div>
        )}

        {activeTab === "saved-plans" && (
          <div>
            {templates.length === 0 ? (
              <div className="text-center py-12" data-testid="text-no-templates">
                <Repeat className="w-8 h-8 mx-auto mb-2 text-zinc-200" />
                <p className="text-sm text-zinc-400">No recurring templates yet</p>
                <p className="text-xs text-zinc-300 mt-1">Set a meal as recurring from the Meals tab</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map(t => {
                  const meal = meals.find(m => m.id === t.userMealId);
                  const displayName = meal?.name ?? t.mealName ?? "Unknown meal";
                  return (
                    <div
                      key={t.id}
                      className={`rounded-xl border p-3 transition-colors ${t.active ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50 opacity-60"}`}
                      data-testid={`template-card-${t.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{displayName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SLOT_COLOURS[t.mealSlot as MealSlot] ?? "bg-zinc-100 text-zinc-600"}`}>
                              {t.mealSlot}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {t.daysOfWeek.length === 7 ? "Every day" : t.daysOfWeek.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ")}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!t.active && (
                            <span className="text-[10px] text-zinc-400 font-medium">Paused</span>
                          )}
                          <button
                            onClick={() => {
                              if (meal) setTemplateTarget(meal);
                            }}
                            className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
                            data-testid={`button-edit-template-${t.id}`}
                          >
                            <UtensilsCrossed className="w-3.5 h-3.5 text-zinc-400" />
                          </button>
                        </div>
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
          onSaved={() => invalidateFoods()}
          initialTab={addFoodInitialTab}
        />
      )}
      {showCommunityBrowser && (
        <CommunityBrowserModal onClose={() => setShowCommunityBrowser(false)} />
      )}
      {editTarget && (
        <EditMealModal
          meal={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { invalidateMeals(); setEditTarget(null); }}
        />
      )}
      {editFoodTarget && (
        <EditFoodModal
          food={editFoodTarget}
          onClose={() => setEditFoodTarget(null)}
          onSaved={() => { invalidateFoods(); setEditFoodTarget(null); }}
        />
      )}
      {templateTarget && (
        <MealTemplateModal
          meal={templateTarget}
          existingTemplate={templates.find(t => t.userMealId === templateTarget.id) ?? null}
          onClose={() => setTemplateTarget(null)}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
