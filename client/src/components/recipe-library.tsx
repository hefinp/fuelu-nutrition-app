import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type UserRecipe, type UserPreferences } from "@shared/schema";
import {
  BookOpen, Plus, X, Loader2, ExternalLink, Trash2, ChefHat,
  UtensilsCrossed, Globe, AlertCircle, Check, AlertTriangle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
type MealStyle = "simple" | "gourmet" | "michelin";

interface ParsedRecipe {
  name: string;
  imageUrl: string | null;
  ingredients: string[];
  servings: number;
  sourceUrl: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  hasNutrition: boolean;
  suggestedSlot: string | null;
}

const MEAL_SLOT_OPTIONS: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

const MEAL_STYLE_OPTIONS: { value: MealStyle; label: string; desc: string }[] = [
  { value: "simple", label: "Simple", desc: "Everyday meals" },
  { value: "gourmet", label: "Gourmet", desc: "Flavourful & creative" },
  { value: "michelin", label: "Michelin", desc: "Fine dining" },
];

const SLOT_COLOURS: Record<MealSlot, string> = {
  breakfast: "bg-amber-50 text-amber-700 border-amber-200",
  lunch: "bg-green-50 text-green-700 border-green-200",
  dinner: "bg-blue-50 text-blue-700 border-blue-200",
  snack: "bg-purple-50 text-purple-700 border-purple-200",
};

const STYLE_COLOURS: Record<MealStyle, string> = {
  simple: "bg-zinc-100 text-zinc-600",
  gourmet: "bg-orange-50 text-orange-700",
  michelin: "bg-indigo-50 text-indigo-700",
};

function sourceDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function isMacrosComplete(recipe: UserRecipe): boolean {
  return recipe.caloriesPerServing > 0 && recipe.proteinPerServing > 0 &&
    recipe.carbsPerServing > 0 && recipe.fatPerServing > 0;
}

export function RecipeLibrary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: recipes = [], isLoading } = useQuery<UserRecipe[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: prefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const savedSites: string[] = prefs?.recipeWebsites ?? [];

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">My Recipes</h2>
            <p className="text-xs text-zinc-500">Import recipes from the web to use in meal plans</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          data-testid="button-import-recipe"
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Import Recipe
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-3">
            <UtensilsCrossed className="w-5 h-5 text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-600 mb-1">No recipes yet</p>
          <p className="text-xs text-zinc-400 max-w-[220px]">
            Paste any recipe URL to import it — it'll appear in your meal plan generation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recipes.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <ImportModal
            savedSites={savedSites}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: UserRecipe }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const complete = isMacrosComplete(recipe);

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/recipes/${recipe.id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe removed" });
    },
    onError: () => toast({ title: "Failed to remove recipe", variant: "destructive" }),
  });

  return (
    <div
      className="relative flex flex-col border border-zinc-100 rounded-2xl overflow-hidden bg-zinc-50"
      data-testid={`card-recipe-${recipe.id}`}
    >
      {recipe.imageUrl && (
        <div className="h-28 bg-zinc-100 overflow-hidden">
          <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-900 leading-tight line-clamp-2">{recipe.name}</p>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid={`button-delete-recipe-${recipe.id}`}
            className="flex-shrink-0 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            {deleteMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {!complete && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl" data-testid={`banner-incomplete-${recipe.id}`}>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 leading-tight">Macros incomplete — won't appear in meal plans</p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${SLOT_COLOURS[recipe.mealSlot as MealSlot] ?? "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
            {recipe.mealSlot}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STYLE_COLOURS[recipe.mealStyle as MealStyle] ?? "bg-zinc-100 text-zinc-600"}`}>
            {recipe.mealStyle}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {[
            { label: "Cal", value: recipe.caloriesPerServing || "—" },
            { label: "P", value: recipe.proteinPerServing ? `${recipe.proteinPerServing}g` : "—" },
            { label: "C", value: recipe.carbsPerServing ? `${recipe.carbsPerServing}g` : "—" },
            { label: "F", value: recipe.fatPerServing ? `${recipe.fatPerServing}g` : "—" },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-lg px-1.5 py-1 text-center border border-zinc-100">
              <p className="text-xs font-bold text-zinc-900">{m.value}</p>
              <p className="text-[10px] text-zinc-400">{m.label}</p>
            </div>
          ))}
        </div>

        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors mt-auto"
          data-testid={`link-recipe-source-${recipe.id}`}
        >
          <Globe className="w-3 h-3" />
          {sourceDomain(recipe.sourceUrl)}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

function ImportModal({ savedSites, onClose }: { savedSites: string[]; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [url, setUrl] = useState("");
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [mealSlot, setMealSlot] = useState<MealSlot>("dinner");
  const [mealStyle, setMealStyle] = useState<MealStyle>("simple");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const fetchMutation = useMutation({
    mutationFn: (importUrl: string) => apiRequest("POST", "/api/recipes/import", { url: importUrl }) as Promise<ParsedRecipe>,
    onSuccess: (data) => {
      setParsed(data);
      setCalories(data.calories !== null ? String(data.calories) : "");
      setProtein(data.protein !== null ? String(data.protein) : "");
      setCarbs(data.carbs !== null ? String(data.carbs) : "");
      setFat(data.fat !== null ? String(data.fat) : "");
      if (data.suggestedSlot) setMealSlot(data.suggestedSlot as MealSlot);
      setFetchError(null);
      setStep("confirm");
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Could not import that recipe. Try a different URL.";
      setFetchError(msg);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/recipes", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe saved!", description: "It will appear in your meal plan generation." });
      onClose();
    },
    onError: () => toast({ title: "Failed to save recipe", variant: "destructive" }),
  });

  const handleFetch = () => {
    setFetchError(null);
    let cleaned = url.trim();
    if (cleaned && !cleaned.startsWith("http")) cleaned = "https://" + cleaned;
    fetchMutation.mutate(cleaned);
  };

  const handleSave = () => {
    if (!parsed) return;
    saveMutation.mutate({
      name: parsed.name,
      sourceUrl: parsed.sourceUrl,
      imageUrl: parsed.imageUrl,
      servings: parsed.servings,
      caloriesPerServing: parseInt(calories) || 0,
      proteinPerServing: parseInt(protein) || 0,
      carbsPerServing: parseInt(carbs) || 0,
      fatPerServing: parseInt(fat) || 0,
      ingredients: JSON.stringify(parsed.ingredients),
      mealSlot,
      mealStyle,
    });
  };

  const macrosComplete = calories && protein && carbs && fat &&
    parseInt(calories) > 0 && parseInt(protein) > 0 && parseInt(carbs) > 0 && parseInt(fat) > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed inset-x-4 top-[10%] mx-auto max-w-lg bg-white rounded-3xl shadow-2xl z-50 overflow-hidden max-h-[82vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-zinc-500" />
            <h3 className="font-semibold text-zinc-900 text-sm">
              {step === "input" ? "Import a Recipe" : "Confirm & Save"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors" data-testid="button-close-import">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {step === "input" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Recipe URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleFetch()}
                    placeholder="https://www.allrecipes.com/recipe/..."
                    className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none transition-colors"
                    data-testid="input-recipe-url"
                  />
                  <button
                    onClick={handleFetch}
                    disabled={!url.trim() || fetchMutation.isPending}
                    data-testid="button-fetch-recipe"
                    className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    {fetchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                  </button>
                </div>
              </div>

              {fetchError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {fetchError}
                </div>
              )}

              {savedSites.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-2">Your saved sites — navigate to a recipe then paste the URL above</p>
                  <div className="flex flex-wrap gap-1.5">
                    {savedSites.map(site => (
                      <a
                        key={site}
                        href={site.startsWith("http") ? site : `https://${site}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 rounded-full text-xs font-medium text-zinc-700 transition-colors"
                        data-testid={`link-saved-site-${site}`}
                      >
                        <Globe className="w-3 h-3" />
                        {site.replace(/^https?:\/\/(www\.)?/, "")}
                        <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-zinc-100">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Works with most major recipe websites including AllRecipes, BBC Good Food, Tasty, Serious Eats, and many more that publish structured recipe data.
                </p>
              </div>
            </div>
          )}

          {step === "confirm" && parsed && (
            <div className="space-y-5">
              {/* Recipe preview */}
              <div className="flex gap-3 items-start">
                {parsed.imageUrl && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-100">
                    <img src={parsed.imageUrl} alt={parsed.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900 text-sm leading-snug">{parsed.name}</p>
                  <a href={parsed.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 mt-0.5">
                    <Globe className="w-3 h-3" />
                    {sourceDomain(parsed.sourceUrl)}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <p className="text-xs text-zinc-500 mt-0.5">{parsed.servings} serving{parsed.servings !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Nutrition (editable) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">Macros per serving</p>
                  {!parsed.hasNutrition && (
                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                      Not found — please fill in
                    </span>
                  )}
                  {parsed.hasNutrition && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                      <Check className="w-3 h-3" /> Auto-filled
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Calories", value: calories, set: setCalories, testId: "input-calories" },
                    { label: "Protein (g)", value: protein, set: setProtein, testId: "input-protein" },
                    { label: "Carbs (g)", value: carbs, set: setCarbs, testId: "input-carbs" },
                    { label: "Fat (g)", value: fat, set: setFat, testId: "input-fat" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-xs text-zinc-500 mb-1">{f.label}</label>
                      <input
                        type="number"
                        min="0"
                        value={f.value}
                        onChange={e => f.set(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none transition-colors"
                        data-testid={f.testId}
                      />
                    </div>
                  ))}
                </div>

                {!macrosComplete && (
                  <div className="flex items-start gap-2 mt-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl" data-testid="banner-macros-warning">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">Missing macros — this recipe will be saved but won't appear in meal plans until all values are filled in.</p>
                  </div>
                )}
              </div>

              {/* Meal slot */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">Meal slot</p>
                  {parsed.suggestedSlot && (
                    <span className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full">
                      suggested from recipe
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {MEAL_SLOT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMealSlot(opt.value)}
                      data-testid={`slot-${opt.value}`}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        mealSlot === opt.value
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meal style */}
              <div>
                <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">Meal style</p>
                <div className="flex flex-col gap-2">
                  {MEAL_STYLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMealStyle(opt.value)}
                      data-testid={`style-${opt.value}`}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        mealStyle === opt.value
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        mealStyle === opt.value ? "border-white" : "border-zinc-300"
                      }`}>
                        {mealStyle === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${mealStyle === opt.value ? "text-white" : "text-zinc-900"}`}>{opt.label}</p>
                        <p className={`text-xs ${mealStyle === opt.value ? "text-zinc-300" : "text-zinc-400"}`}>{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ingredients preview */}
              {parsed.ingredients.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">Ingredients ({parsed.ingredients.length})</p>
                  <div className="bg-zinc-50 rounded-xl p-3 max-h-32 overflow-y-auto">
                    <ul className="space-y-0.5">
                      {parsed.ingredients.map((ing, i) => (
                        <li key={i} className="text-xs text-zinc-600 flex gap-1.5">
                          <span className="text-zinc-300">•</span>
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-zinc-100 bg-white">
          {step === "input" && (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
          )}
          {step === "confirm" && (
            <div className="flex gap-2">
              <button
                onClick={() => { setStep("input"); setParsed(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                data-testid="button-back-to-url"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                data-testid="button-save-recipe"
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save Recipe"}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
