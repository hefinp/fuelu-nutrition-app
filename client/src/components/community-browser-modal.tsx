import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type UserPreferences, type CommunityMeal } from "@shared/schema";
import {
  X, Loader2, UtensilsCrossed, Check, Users2, Heart, ShieldAlert, Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { DuplicateWarningBanner } from "@/components/duplicate-warning-banner";
import { MealCommentsSection } from "@/components/meal-comments";
import { AllergenDisclaimer } from "@/components/allergen-disclaimer";
import { ReportButton } from "@/components/report-content-dialog";
import { useTierStatus } from "@/hooks/use-tier";
import { useMobileViewport } from "@/hooks/use-mobile-viewport";
import { useAuth } from "@/hooks/use-auth";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
type MealStyle = "simple" | "fancy" | "gourmet";

const MEAL_SLOT_OPTIONS: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

const MEAL_STYLE_OPTIONS: { value: MealStyle; label: string; desc: string }[] = [
  { value: "simple", label: "Simple", desc: "Everyday meals" },
  { value: "fancy", label: "Fancy", desc: "Bold flavours & restaurant-style" },
  { value: "gourmet", label: "Gourmet", desc: "Fine dining" },
];

const SLOT_COLOURS: Record<MealSlot, string> = {
  breakfast: "bg-amber-50 text-amber-700 border-amber-200",
  lunch: "bg-green-50 text-green-700 border-green-200",
  dinner: "bg-blue-50 text-blue-700 border-blue-200",
  snack: "bg-purple-50 text-purple-700 border-purple-200",
};

const STYLE_COLOURS: Record<MealStyle, string> = {
  simple: "bg-zinc-100 text-zinc-600",
  fancy: "bg-orange-50 text-orange-700",
  gourmet: "bg-indigo-50 text-indigo-700",
};

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  gluten: ["wheat", "gluten", "flour", "bread", "barley", "rye", "oat", "pasta", "couscous", "semolina", "crouton", "cracker", "baguette", "sourdough", "brioche", "noodle"],
  dairy: ["milk", "cream", "butter", "cheese", "yogurt", "yoghurt", "whey", "lactose", "ghee", "cheddar", "mozzarella", "parmesan", "brie", "feta", "ricotta", "crème fraîche", "hollandaise"],
  eggs: ["egg", "yolk", "albumen", "mayonnaise"],
  nuts: ["almond", "cashew", "walnut", "pistachio", "pecan", "hazelnut", "macadamia", "pine nut", "brazil nut", "chestnut", "praline"],
  peanuts: ["peanut", "groundnut"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "crayfish", "scallop", "oyster", "mussel", "clam", "squid", "octopus"],
  fish: ["salmon", "tuna", "cod", "halibut", "trout", "anchovy", "tilapia", "haddock", "mackerel", "sardine", "bass", "snapper", "swordfish", "smoked salmon"],
  soy: ["soy", "soya", "tofu", "tempeh", "miso", "edamame"],
  celery: ["celery", "celeriac", "celery salt", "celery seed"],
  mustard: ["mustard", "dijon", "wholegrain mustard", "mustard seed", "mustard powder"],
  sesame: ["sesame", "tahini", "sesame oil", "sesame seed", "halvah"],
  sulphites: ["sulphite", "sulfite", "wine", "dried fruit", "vinegar", "molasses"],
  lupin: ["lupin", "lupini"],
  molluscs: ["mussel", "clam", "oyster", "squid", "octopus", "snail", "escargot", "calamari", "scallop"],
};

function detectAllergyConflicts(ingredients: string[], allergies: string[]): string[] {
  const conflicts: string[] = [];
  const ingredientText = ingredients.join(" ").toLowerCase();
  for (const allergy of allergies) {
    const keywords = ALLERGEN_KEYWORDS[allergy] ?? [];
    if (keywords.some(kw => ingredientText.includes(kw))) {
      conflicts.push(allergy);
    }
  }
  return conflicts;
}

export function CommunityBrowserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { overlayStyle, panelMaxHeight } = useMobileViewport();
  const { data: tierStatus } = useTierStatus();
  const { user } = useAuth();
  const showUpgradeNudge = !!tierStatus && !tierStatus.betaUser && !user?.isManagedClient && (tierStatus.tier === "free" || tierStatus.tier === "simple");
  const [selectedStyle, setSelectedStyle] = useState<MealStyle>("simple");
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>("breakfast");
  const [expandedMealId, setExpandedMealId] = useState<number | null>(null);
  const [savedMealIds, setSavedMealIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [mealDetails, setMealDetails] = useState<Record<number, CommunityMeal | "loading" | "error">>({});
  const [junctionIngredients, setJunctionIngredients] = useState<Record<number, Array<{ name: string; canonicalFood: { id: number } | null }>>>({});
  const [allergyWarning, setAllergyWarning] = useState<{ meal: CommunityMeal; conflicts: string[] } | null>(null);
  const [dupWarning, setDupWarning] = useState<{ mealId: number; message: string; exactMatch: boolean; existingCount: number } | null>(null);

  const { data: meals = [], isLoading } = useQuery<CommunityMeal[]>({
    queryKey: ["/api/community-meals", selectedStyle, selectedSlot],
    queryFn: async () => {
      const res = await fetch(`/api/community-meals?style=${selectedStyle}&slot=${selectedSlot}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const userAllergies: string[] = Array.isArray(preferences?.allergies) ? preferences.allergies : [];

  const handleStyleChange = (style: MealStyle) => {
    setSelectedStyle(style);
    setExpandedMealId(null);
  };

  const handleSlotChange = (slot: MealSlot) => {
    setSelectedSlot(slot);
    setExpandedMealId(null);
  };

  const handleToggleExpand = async (id: number) => {
    if (expandedMealId === id) {
      setExpandedMealId(null);
      return;
    }
    setExpandedMealId(id);
    if (mealDetails[id]) return;
    setMealDetails(prev => ({ ...prev, [id]: "loading" }));
    try {
      const [detailRes, junctionRes] = await Promise.all([
        fetch(`/api/community-meals/${id}/details`, { credentials: "include" }),
        fetch(`/api/community-meals/${id}/ingredients`, { credentials: "include" }),
      ]);
      if (!detailRes.ok) throw new Error("Failed");
      const detail: CommunityMeal = await detailRes.json();
      setMealDetails(prev => ({ ...prev, [id]: detail }));
      if (junctionRes.ok) {
        const jRows = await junctionRes.json();
        setJunctionIngredients(prev => ({ ...prev, [id]: jRows }));
      }
    } catch {
      setMealDetails(prev => ({ ...prev, [id]: "error" }));
    }
  };

  const doSave = async (meal: CommunityMeal, confirmDuplicate = false) => {
    if (savedMealIds.has(meal.id) || savingId === meal.id) return;
    setSavingId(meal.id);
    setAllergyWarning(null);
    setDupWarning(null);
    try {
      const detail = mealDetails[meal.id];
      const detailData = (detail && detail !== "loading" && detail !== "error") ? detail : null;
      const ingredientsArr = detailData?.ingredients ?? meal.ingredients;
      const instructionsText = detailData?.instructions ?? meal.instructions;
      const ingredientsJsonData = detailData?.ingredientsJson ?? meal.ingredientsJson;
      const payload: Record<string, unknown> = {
        name: meal.name,
        source: "community",
        caloriesPerServing: meal.caloriesPerServing,
        proteinPerServing: meal.proteinPerServing,
        carbsPerServing: meal.carbsPerServing,
        fatPerServing: meal.fatPerServing,
        mealSlot: meal.slot,
        ingredients: ingredientsArr && ingredientsArr.length > 0 ? ingredientsArr.join("\n") : undefined,
        ingredientsJson: Array.isArray(ingredientsJsonData) && ingredientsJsonData.length > 0 ? ingredientsJsonData : undefined,
        instructions: instructionsText || undefined,
      };
      if (confirmDuplicate) payload.confirmDuplicate = true;
      const res = await fetch("/api/user-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const json = await res.json();
      if (res.status === 409 && json.duplicateWarning) {
        setDupWarning({ mealId: meal.id, ...json });
        return;
      }
      if (!res.ok) throw new Error(json.message || "Failed to save");
      setSavedMealIds(prev => new Set(prev).add(meal.id));
      queryClient.invalidateQueries({ queryKey: ["/api/user-meals"] });
      toast({ title: "Saved to my meals", description: `${meal.name} added to your library.` });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const handleSave = (meal: CommunityMeal) => {
    if (savedMealIds.has(meal.id) || savingId === meal.id) return;
    const detail = mealDetails[meal.id];
    const detailObj = (detail && detail !== "loading" && detail !== "error") ? detail : null;
    const ingredientsText = detailObj?.ingredients ?? [];
    const ingredientsJsonNames = Array.isArray(detailObj?.ingredientsJson) ? (detailObj!.ingredientsJson as Array<{ name: string }>).map(i => i.name) : [];
    const ingredients = ingredientsText.length > 0 ? ingredientsText : ingredientsJsonNames;
    if (userAllergies.length > 0 && ingredients.length > 0) {
      const conflicts = detectAllergyConflicts(ingredients, userAllergies);
      if (conflicts.length > 0) {
        setAllergyWarning({ meal, conflicts });
        return;
      }
    }
    doSave(meal);
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const stopScrollLeak = useCallback((e: React.TouchEvent | React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-x-0 top-0 bottom-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm max-h-[100dvh]"
      style={overlayStyle}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onWheel={stopScrollLeak}
      onTouchMove={stopScrollLeak}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        style={panelMaxHeight != null ? { maxHeight: panelMaxHeight } : undefined}
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        data-testid="modal-community-browser"
      >
        <div className="flex items-center justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            <Users2 className="w-5 h-5 text-zinc-600" />
            <h2 className="text-base font-bold text-zinc-900">Community Meals</h2>
          </div>
          <button
            onClick={onClose}
            data-testid="button-close-community-browser"
            className="p-2 -mr-1 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-3 border-b border-zinc-100 space-y-2.5 sm:space-y-3 shrink-0">
          <div className="flex gap-1.5">
            {MEAL_STYLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleStyleChange(opt.value)}
                data-testid={`community-style-${opt.value}`}
                className={`flex-1 px-3 py-2.5 sm:py-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] sm:min-h-0 ${
                  selectedStyle === opt.value
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            {MEAL_SLOT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSlotChange(opt.value)}
                data-testid={`community-slot-${opt.value}`}
                className={`flex-1 px-2 py-2.5 sm:py-1.5 rounded-lg text-xs font-medium transition-all border min-h-[44px] sm:min-h-0 ${
                  selectedSlot === opt.value
                    ? SLOT_COLOURS[opt.value]
                    : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-zinc-50">
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-zinc-200 rounded w-3/4" />
                    <div className="h-3 bg-zinc-100 rounded w-1/2" />
                  </div>
                  <div className="h-6 w-10 bg-zinc-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : meals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-3">
                <UtensilsCrossed className="w-5 h-5 text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-500">No meals yet</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-[200px]">
                Be the first to share a {selectedStyle} {selectedSlot} recipe!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {meals.map(meal => {
                const isExpanded = expandedMealId === meal.id;
                const isSaved = savedMealIds.has(meal.id);
                const isSaving = savingId === meal.id;
                const microDots = Math.min(5, Math.max(1, meal.microScore));
                const detail = mealDetails[meal.id];
                const isLoadingDetails = detail === "loading";
                const isDetailError = detail === "error";
                const detailData = (detail && detail !== "loading" && detail !== "error") ? detail : null;
                const hasIngredients = (detailData?.ingredients && detailData.ingredients.length > 0) || (Array.isArray(detailData?.ingredientsJson) && detailData!.ingredientsJson!.length > 0);
                const isAllergyWarningOpen = allergyWarning?.meal.id === meal.id;

                return (
                  <div
                    key={meal.id}
                    data-testid={`community-meal-${meal.id}`}
                    className={`rounded-xl border transition-colors overflow-hidden ${
                      isExpanded ? "border-zinc-300 bg-white shadow-sm" : "border-zinc-100 bg-zinc-50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleExpand(meal.id)}
                      data-testid={`button-expand-meal-${meal.id}`}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-zinc-100 transition-colors min-h-[44px]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 leading-tight line-clamp-2">{meal.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {[
                            { label: "Cal", value: String(meal.caloriesPerServing) },
                            { label: "P", value: `${meal.proteinPerServing}g` },
                            { label: "C", value: `${meal.carbsPerServing}g` },
                            { label: "F", value: `${meal.fatPerServing}g` },
                          ].map(m => (
                            <span key={m.label} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white border border-zinc-100 rounded text-[10px] text-zinc-600">
                              <span className="font-bold">{m.value}</span>
                              <span className="text-zinc-400">{m.label}</span>
                            </span>
                          ))}
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            meal.source === "user"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              : "bg-violet-50 text-violet-600 border border-violet-100"
                          }`}>
                            {meal.source === "user" ? "community" : "AI-curated"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center gap-0.5 text-zinc-400">
                          <Heart className={`w-3.5 h-3.5 ${meal.favouriteCount > 0 || isSaved ? "fill-red-400 text-red-400" : ""}`} />
                          <span className="text-xs font-medium">{meal.favouriteCount}</span>
                        </div>
                        <div className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                          <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-zinc-100">
                        <div className="grid grid-cols-4 gap-1.5 mt-3">
                          {[
                            { label: "Calories", value: meal.caloriesPerServing, unit: "kcal", colour: "bg-orange-50 text-orange-700" },
                            { label: "Protein", value: meal.proteinPerServing, unit: "g", colour: "bg-blue-50 text-blue-700" },
                            { label: "Carbs", value: meal.carbsPerServing, unit: "g", colour: "bg-amber-50 text-amber-700" },
                            { label: "Fat", value: meal.fatPerServing, unit: "g", colour: "bg-rose-50 text-rose-700" },
                          ].map(m => (
                            <div key={m.label} className={`${m.colour} rounded-xl px-2 py-2.5 text-center`}>
                              <p className="text-sm font-bold">{m.value}<span className="text-[10px] font-medium ml-0.5 opacity-70">{m.unit}</span></p>
                              <p className="text-[10px] opacity-70 mt-0.5">{m.label}</p>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">Micro score</span>
                            <div className="flex gap-0.5 ml-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-2 h-2 rounded-full ${i < microDots ? "bg-emerald-500" : "bg-zinc-200"}`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${SLOT_COLOURS[meal.slot as MealSlot] ?? "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>
                            {meal.slot}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STYLE_COLOURS[meal.style as MealStyle] ?? "bg-zinc-100 text-zinc-500"}`}>
                            {meal.style}
                          </span>
                        </div>

                        {isLoadingDetails ? (
                          <div className="mt-3 space-y-2">
                            <div className="h-3 bg-zinc-100 animate-pulse rounded w-24" />
                            {[1, 2, 3, 4].map(i => (
                              <div key={i} className="h-2.5 bg-zinc-100 animate-pulse rounded" style={{ width: `${60 + i * 8}%` }} />
                            ))}
                            <div className="h-3 bg-zinc-100 animate-pulse rounded w-24 mt-3" />
                            {[1, 2, 3].map(i => (
                              <div key={i} className="h-2.5 bg-zinc-100 animate-pulse rounded w-full" />
                            ))}
                          </div>
                        ) : isDetailError ? (
                          <p className="mt-3 text-xs text-zinc-400 text-center">Could not load recipe details.</p>
                        ) : hasIngredients ? (
                          <div className="mt-3 space-y-3">
                            <div>
                              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Ingredients</p>
                              {Array.isArray(detailData!.ingredientsJson) && detailData!.ingredientsJson.length > 0 ? (
                                <ul className="space-y-1" data-testid={`list-community-ingredients-${meal.id}`}>
                                  {(detailData!.ingredientsJson as Array<{ name: string; grams: number; calories100g: number }>).map((ing, i) => {
                                    const jRows = junctionIngredients[meal.id];
                                    const hasCanonical = jRows?.some(j => j.name.toLowerCase().trim() === ing.name.toLowerCase().trim() && j.canonicalFood);
                                    return (
                                      <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-700" data-testid={`community-ingredient-${meal.id}-${i}`}>
                                        <span className="mt-0.5 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                                        <span className="flex-1">{Math.round(ing.grams)}g {ing.name}</span>
                                        {hasCanonical && (
                                          <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0" data-testid={`badge-fuelu-db-${meal.id}-${i}`}>FuelU DB</span>
                                        )}
                                        <span className="text-zinc-400 shrink-0">{Math.round(ing.calories100g * ing.grams / 100)} kcal</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : detailData!.ingredients && detailData!.ingredients.length > 0 ? (
                                <ul className="space-y-1">
                                  {detailData!.ingredients.map((ing, i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-700">
                                      <span className="mt-0.5 w-1 h-1 rounded-full bg-zinc-400 shrink-0" />
                                      {ing}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                            {detailData!.instructions && (
                              <div>
                                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Method</p>
                                <div className="space-y-1">
                                  {detailData!.instructions.split("\n").filter(Boolean).map((step, i) => (
                                    <p key={i} className="text-xs text-zinc-700 leading-relaxed">{step}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}

                        <AllergenDisclaimer className="mt-3" />

                        {isAllergyWarningOpen && allergyWarning && (
                          <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3" data-testid={`allergy-warning-${meal.id}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                              <p className="text-xs font-semibold text-red-700">Allergen conflict detected</p>
                            </div>
                            <p className="text-xs text-red-600 mb-3">
                              This meal may contain <span className="font-semibold">{allergyWarning.conflicts.join(", ")}</span>, which {allergyWarning.conflicts.length === 1 ? "is" : "are"} in your allergen list. Do you still want to save it?
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setAllergyWarning(null)}
                                data-testid={`button-allergy-cancel-${meal.id}`}
                                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => doSave(allergyWarning.meal)}
                                data-testid={`button-allergy-confirm-${meal.id}`}
                                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                              >
                                Save anyway
                              </button>
                            </div>
                          </div>
                        )}

                        {dupWarning && dupWarning.mealId === meal.id && (
                          <div className="mt-3" data-testid={`dup-warning-community-${meal.id}`}>
                            <DuplicateWarningBanner
                              warning={dupWarning}
                              onConfirm={() => { setDupWarning(null); doSave(meal, true); }}
                              onCancel={() => setDupWarning(null)}
                              testPrefix={`community-dup-${meal.id}`}
                            />
                          </div>
                        )}

                        {!isAllergyWarningOpen && !(dupWarning && dupWarning.mealId === meal.id) && (
                          <button
                            type="button"
                            onClick={() => handleSave(meal)}
                            disabled={isSaved || isSaving}
                            data-testid={`button-save-community-meal-${meal.id}`}
                            className={`mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              isSaved
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                                : "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]"
                            }`}
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isSaved ? (
                              <>
                                <Check className="w-4 h-4" />
                                Saved to my meals
                              </>
                            ) : (
                              <>
                                <Heart className="w-4 h-4" />
                                Save to my meals
                              </>
                            )}
                          </button>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <MealCommentsSection communityMealId={meal.id} />
                          <div className="shrink-0">
                            <ReportButton contentType="community_meal" contentId={meal.id} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {showUpgradeNudge && (
            <div
              className="mt-3 rounded-xl bg-violet-50 border border-violet-100 px-4 py-3.5 text-center"
              data-testid="banner-community-upgrade"
            >
              <Sparkles className="w-4 h-4 text-violet-400 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-zinc-800 mb-0.5">Love what you see?</p>
              <p className="text-xs text-zinc-500 mb-2.5">Generate a personalised 7-day meal plan in seconds.</p>
              <Link
                href="/pricing"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors"
                data-testid="link-community-upgrade-plans"
              >
                <Sparkles className="w-3 h-3" />
                See plans
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
