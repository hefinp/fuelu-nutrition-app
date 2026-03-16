import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  UtensilsCrossed, Wheat, Plus, Trash2, Loader2, X, Pencil,
  ChevronDown, ChevronUp, Link2,
  Utensils, Globe, Search, Users2,
} from "lucide-react";
import type { FavouriteMeal, UserRecipe, UserSavedFood } from "@shared/schema";
import {
  type MealSlot, type ActiveTab,
  SLOT_OPTIONS, SLOT_COLOURS, MacroBar, MacroChips, todayStr,
} from "@/components/meals-food-shared";
import { CommunityBrowserModal } from "@/components/community-browser-modal";
import { ImportModal } from "@/components/import-modal";
import { EditMealModal } from "@/components/edit-meal-modal";
import { EditFoodModal } from "@/components/edit-food-modal";
import { AddFoodModal } from "@/components/add-food-modal";
import { CreateMealModal } from "@/components/create-meal-modal";

const PAGE_SIZE = 20;

type PaginatedResponse<T> = { items: T[]; nextCursor: string | null };

async function fetchPaginated<T>(url: string, cursor?: string): Promise<PaginatedResponse<T>> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set("cursor", cursor);
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
  const [showCommunityBrowser, setShowCommunityBrowser] = useState(false);
  const [mealSearch, setMealSearch] = useState("");
  const [mealSlotFilter, setMealSlotFilter] = useState<MealSlot | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{ type: "favourite" | "recipe"; item: FavouriteMeal | UserRecipe } | null>(null);
  const [editFoodTarget, setEditFoodTarget] = useState<UserSavedFood | null>(null);

  const favsQuery = useInfiniteQuery<PaginatedResponse<FavouriteMeal>>({
    queryKey: ["/api/favourites", "paginated"],
    queryFn: ({ pageParam }) => fetchPaginated<FavouriteMeal>("/api/favourites", pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const recsQuery = useInfiniteQuery<PaginatedResponse<UserRecipe>>({
    queryKey: ["/api/recipes", "paginated"],
    queryFn: ({ pageParam }) => fetchPaginated<UserRecipe>("/api/recipes", pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const foodsQuery = useInfiniteQuery<PaginatedResponse<UserSavedFood>>({
    queryKey: ["/api/my-foods", "paginated"],
    queryFn: ({ pageParam }) => fetchPaginated<UserSavedFood>("/api/my-foods", pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const favourites = favsQuery.data?.pages.flatMap(p => p.items) ?? [];
  const recipes = recsQuery.data?.pages.flatMap(p => p.items) ?? [];
  const myFoods = foodsQuery.data?.pages.flatMap(p => p.items) ?? [];

  const favsLoading = favsQuery.isLoading;
  const recsLoading = recsQuery.isLoading;
  const foodsLoading = foodsQuery.isLoading;
  const mealsLoading = favsLoading || recsLoading;

  type MealEntry =
    | { kind: "favourite"; item: FavouriteMeal }
    | { kind: "recipe"; item: UserRecipe };

  const mealEntries: MealEntry[] = [
    ...favourites.map(f => ({ kind: "favourite" as const, item: f })),
    ...recipes.map(r => ({ kind: "recipe" as const, item: r })),
  ].sort((a, b) => {
    const aTime = new Date(a.item.createdAt ?? 0).getTime();
    const bTime = new Date(b.item.createdAt ?? 0).getTime();
    return bTime - aTime;
  });

  const filteredMealEntries = mealEntries.filter(entry => {
    if (mealSlotFilter !== "all") {
      const slot = getMealSlot(entry);
      if (slot !== mealSlotFilter) return false;
    }
    if (mealSearch.trim()) {
      const name = getMealName(entry).toLowerCase();
      if (!name.includes(mealSearch.trim().toLowerCase())) return false;
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

  const invalidateFavs = () => { queryClient.invalidateQueries({ queryKey: ["/api/favourites"] }); };
  const invalidateRecs = () => { queryClient.invalidateQueries({ queryKey: ["/api/recipes"] }); };
  const invalidateFoods = () => { queryClient.invalidateQueries({ queryKey: ["/api/my-foods"] }); };

  const deleteFavMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/favourites/${id}`, undefined),
    onSuccess: () => { invalidateFavs(); toast({ title: "Removed" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const deleteRecMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/recipes/${id}`, undefined),
    onSuccess: () => { invalidateRecs(); toast({ title: "Removed" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const deleteFoodMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/my-foods/${id}`, undefined),
    onSuccess: () => { invalidateFoods(); toast({ title: "Removed from My Foods" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  function getKey(entry: MealEntry) {
    return `${entry.kind}-${entry.item.id}`;
  }

  function logMeal(entry: MealEntry) {
    if (entry.kind === "favourite") {
      const f = entry.item as FavouriteMeal;
      logMutation.mutate({ name: f.mealName, cal: f.calories, prot: f.protein, carbs: f.carbs, fat: f.fat, slot: f.mealSlot });
    } else {
      const r = entry.item as UserRecipe;
      logMutation.mutate({ name: r.name, cal: r.caloriesPerServing, prot: r.proteinPerServing, carbs: r.carbsPerServing, fat: r.fatPerServing, slot: r.mealSlot });
    }
  }

  function deleteMeal(entry: MealEntry) {
    if (entry.kind === "favourite") deleteFavMutation.mutate(entry.item.id);
    else deleteRecMutation.mutate(entry.item.id);
  }

  function getMealSlot(entry: MealEntry): MealSlot | null {
    if (entry.kind === "favourite") return (entry.item as FavouriteMeal).mealSlot as MealSlot | null;
    return (entry.item as UserRecipe).mealSlot as MealSlot;
  }

  function getMealName(entry: MealEntry) {
    if (entry.kind === "favourite") return (entry.item as FavouriteMeal).mealName;
    return (entry.item as UserRecipe).name;
  }

  function getMacros(entry: MealEntry) {
    if (entry.kind === "favourite") {
      const f = entry.item as FavouriteMeal;
      return { cal: f.calories, prot: f.protein, carbs: f.carbs, fat: f.fat };
    }
    const r = entry.item as UserRecipe;
    return { cal: r.caloriesPerServing, prot: r.proteinPerServing, carbs: r.carbsPerServing, fat: r.fatPerServing };
  }

  function isCustomMeal(entry: MealEntry) {
    return entry.kind === "recipe" && (entry.item as UserRecipe).sourceUrl === "custom://created";
  }

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-zinc-900 text-base leading-tight">My Meals & Food</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Your saved meals, recipes & foods</p>
            </div>
          </div>
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
            ) : mealEntries.length === 0 ? (
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

                {filteredMealEntries.length === 0 ? (
                  <div className="text-center py-8" data-testid="text-no-meals-match">
                    <Search className="w-8 h-8 mx-auto mb-2 text-zinc-200" />
                    <p className="text-sm text-zinc-400">No meals match your filters</p>
                    <button type="button" onClick={() => { setMealSearch(""); setMealSlotFilter("all"); }} className="mt-2 text-xs text-zinc-500 hover:text-zinc-700 font-medium" data-testid="button-meal-filter-clear-all">
                      Clear filters
                    </button>
                  </div>
                ) : (
                <div className="space-y-1.5">
                {filteredMealEntries.map(entry => {
                  const key = getKey(entry);
                  const isOpen = expandedId === key;
                  const macros = getMacros(entry);
                  const slot = getMealSlot(entry);
                  const name = getMealName(entry);
                  const isCustom = isCustomMeal(entry);
                  const recipe = entry.kind === "recipe" ? (entry.item as UserRecipe) : null;
                  const favItem = entry.kind === "favourite" ? (entry.item as FavouriteMeal) : null;

                  return (
                    <div key={key} className="group relative rounded-xl border border-zinc-100 overflow-hidden">
                      <button
                        onClick={() => setExpandedId(isOpen ? null : key)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 transition-colors text-left"
                        data-testid={`button-meal-${entry.kind}-${entry.item.id}`}
                      >
                        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                          <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium text-zinc-900 truncate">{name}</p>
                            {slot && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SLOT_COLOURS[slot]}`}>{slot}</span>}
                            {isCustom && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-zinc-100 text-zinc-500">custom</span>}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">{macros.cal} kcal · P:{macros.prot}g · C:{macros.carbs}g · F:{macros.fat}g</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); setEditTarget({ type: entry.kind, item: entry.item }); }}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                            data-testid={`button-edit-meal-${entry.kind}-${entry.item.id}`}
                            title="Edit"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); deleteMeal(entry); }}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            data-testid={`button-delete-meal-${entry.kind}-${entry.item.id}`}
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <div className="text-zinc-300 ml-1">
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 bg-zinc-50 border-t border-zinc-100">
                          <MacroChips cal={macros.cal} p={macros.prot} c={macros.carbs} f={macros.fat} />
                          <MacroBar p={macros.prot} c={macros.carbs} f={macros.fat} />

                          {(recipe?.ingredients || favItem?.ingredients) && (
                            <div className="mt-3">
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ingredients</p>
                              <ul className="text-xs text-zinc-600 space-y-0.5 max-h-28 overflow-y-auto">
                                {(recipe?.ingredients || favItem?.ingredients || "").split("\n").filter(Boolean).map((ing, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-300 shrink-0" />{ing}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {(recipe?.instructions || favItem?.instructions) && (
                            <div className="mt-3">
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Instructions</p>
                              <p className="text-xs text-zinc-600 leading-relaxed line-clamp-4">{recipe?.instructions || favItem?.instructions}</p>
                            </div>
                          )}

                          {recipe && !isCustom && recipe.sourceUrl && recipe.sourceUrl !== "photo://recipe-book" && (
                            <a
                              href={recipe.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 mt-2"
                            >
                              <Globe className="w-3 h-3" />View original
                            </a>
                          )}

                          <button
                            onClick={() => logMeal(entry)}
                            disabled={logMutation.isPending}
                            className="w-full mt-3 py-2.5 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                            data-testid={`button-log-meal-${entry.kind}-${entry.item.id}`}
                          >
                            {logMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Utensils className="w-3.5 h-3.5" />Log today</>}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
                )}
                {(favsQuery.hasNextPage || recsQuery.hasNextPage) && (
                  <button
                    onClick={() => {
                      if (favsQuery.hasNextPage) favsQuery.fetchNextPage();
                      if (recsQuery.hasNextPage) recsQuery.fetchNextPage();
                    }}
                    disabled={favsQuery.isFetchingNextPage || recsQuery.isFetchingNextPage}
                    className="w-full mt-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 rounded-xl border border-zinc-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                    data-testid="button-load-more-meals"
                  >
                    {(favsQuery.isFetchingNextPage || recsQuery.isFetchingNextPage)
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
            <button
              onClick={() => setShowAddFood(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 mb-4 rounded-xl bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-700 transition-all"
              data-testid="button-add-food"
            >
              <Plus className="w-3.5 h-3.5" />Add Food
            </button>

            {foodsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
            ) : myFoods.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Wheat className="w-5 h-5 text-zinc-300" />
                </div>
                <p className="text-sm font-medium text-zinc-500 mb-1">No foods saved yet</p>
                <p className="text-xs text-zinc-400">Add individual foods here to use them when building meals.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {myFoods.map(food => {
                  const isOpen = expandedId === `food-${food.id}`;
                  return (
                    <div key={food.id} className="group relative rounded-xl border border-zinc-100 overflow-hidden">
                      <button
                        onClick={() => setExpandedId(isOpen ? null : `food-${food.id}`)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 transition-colors text-left"
                        data-testid={`button-food-${food.id}`}
                      >
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                          <Wheat className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{food.name}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{food.calories100g} kcal · P:{Number(food.protein100g).toFixed(1)}g · C:{Number(food.carbs100g).toFixed(1)}g · F:{Number(food.fat100g).toFixed(1)}g per 100g</p>
                        </div>
                        <div className="flex items-center shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); setEditFoodTarget(food); }}
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                            data-testid={`button-edit-food-${food.id}`}
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); deleteFoodMutation.mutate(food.id); }}
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            data-testid={`button-delete-food-${food.id}`}
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="shrink-0 text-zinc-300 ml-1">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 bg-zinc-50 border-t border-zinc-100">
                          <p className="text-xs text-zinc-500 mt-3 mb-2">Per 100g:</p>
                          <div className="grid grid-cols-4 gap-1.5">
                            <div className="bg-orange-50 rounded-lg p-1.5 text-center">
                              <p className="text-xs font-bold text-orange-600">{food.calories100g}</p>
                              <p className="text-[10px] text-orange-400">kcal</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-1.5 text-center">
                              <p className="text-xs font-bold text-blue-600">{Number(food.protein100g).toFixed(1)}g</p>
                              <p className="text-[10px] text-blue-400">prot</p>
                            </div>
                            <div className="bg-amber-50 rounded-lg p-1.5 text-center">
                              <p className="text-xs font-bold text-amber-600">{Number(food.carbs100g).toFixed(1)}g</p>
                              <p className="text-[10px] text-amber-400">carbs</p>
                            </div>
                            <div className="bg-rose-50 rounded-lg p-1.5 text-center">
                              <p className="text-xs font-bold text-rose-600">{Number(food.fat100g).toFixed(1)}g</p>
                              <p className="text-[10px] text-rose-400">fat</p>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-400 mt-2">Default serving: {food.servingGrams}g</p>
                          <button
                            onClick={() => {
                              const factor = food.servingGrams / 100;
                              logMutation.mutate({
                                name: food.name,
                                cal: Math.round(food.calories100g * factor),
                                prot: Math.round(Number(food.protein100g) * factor),
                                carbs: Math.round(Number(food.carbs100g) * factor),
                                fat: Math.round(Number(food.fat100g) * factor),
                                slot: null,
                              });
                            }}
                            disabled={logMutation.isPending}
                            className="w-full mt-3 py-2.5 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                            data-testid={`button-log-food-${food.id}`}
                          >
                            {logMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Utensils className="w-3.5 h-3.5" />Log {food.servingGrams}g today</>}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
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
          </div>
        )}
      </div>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/recipes"] })}
        />
      )}
      {showCreateMeal && (
        <CreateMealModal
          onClose={() => setShowCreateMeal(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/recipes"] })}
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
          type={editTarget.type}
          item={editTarget.item}
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
    </div>
  );
}
