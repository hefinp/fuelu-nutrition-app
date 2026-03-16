import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type UserMeal, type UserPreferences, type CommunityMeal } from "@shared/schema";
import {
  BookOpen, Plus, X, Loader2, ExternalLink, Trash2, ChefHat,
  UtensilsCrossed, Globe, AlertCircle, Check, AlertTriangle,
  Camera, ArrowLeft, ImagePlus, Sparkles, Share2, Heart, Users2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { CommunityBrowserModal } from "@/components/community-browser-modal";
import { DuplicateWarningBanner, type DuplicateWarning } from "@/components/duplicate-warning-banner";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
type MealStyle = "simple" | "gourmet" | "michelin";
type ImportMethod = "web" | "photo";
type Step = "method" | "url" | "photo" | "confirm";

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

function isMacrosComplete(recipe: UserMeal): boolean {
  return recipe.caloriesPerServing > 0 && recipe.proteinPerServing > 0 &&
    recipe.carbsPerServing > 0 && recipe.fatPerServing > 0;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function RecipeLibrary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showCommunityBrowser, setShowCommunityBrowser] = useState(false);

  const { data: recipes = [], isLoading } = useQuery<{ items: UserMeal[] }, Error, UserMeal[]>({
    queryKey: ["/api/user-meals", "all"],
    queryFn: () => fetch("/api/user-meals?limit=100", { credentials: "include" }).then(r => r.json()),
    select: (d) => d.items,
  });

  const { data: prefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const { data: sharedMeals = [] } = useQuery<CommunityMeal[]>({
    queryKey: ["/api/community-meals/my"],
  });

  const savedSites: string[] = prefs?.recipeWebsites ?? [];

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">My Recipes</h2>
          <p className="text-xs text-zinc-500">Import recipes from the web or a photo</p>
        </div>
      </div>
      <div className="flex justify-end mb-5">
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
            Import from a recipe website or photograph a page from a recipe book.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              sharedMeal={sharedMeals.find(s => s.sourceRecipeId === recipe.id) ?? null}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => setShowCommunityBrowser(true)}
        data-testid="button-browse-community"
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-50 border border-zinc-200 text-zinc-600 text-sm font-medium rounded-xl hover:bg-zinc-100 hover:border-zinc-300 transition-colors"
      >
        <Users2 className="w-4 h-4" />
        Browse community meals
      </button>

      <AnimatePresence>
        {showModal && (
          <ImportModal
            savedSites={savedSites}
            onClose={() => setShowModal(false)}
          />
        )}
        {showCommunityBrowser && (
          <CommunityBrowserModal onClose={() => setShowCommunityBrowser(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function RecipeCard({ recipe, sharedMeal }: { recipe: UserMeal; sharedMeal: CommunityMeal | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const complete = isMacrosComplete(recipe);
  const isShared = !!sharedMeal;

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/user-meals/${recipe.id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community-meals/my"] });
      toast({ title: "Recipe removed" });
    },
    onError: () => toast({ title: "Failed to remove recipe", variant: "destructive" }),
  });

  const shareMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/community-meals", {
      recipeId: recipe.id,
      name: recipe.name,
      slot: recipe.mealSlot,
      style: recipe.mealStyle,
      caloriesPerServing: recipe.caloriesPerServing,
      proteinPerServing: recipe.proteinPerServing,
      carbsPerServing: recipe.carbsPerServing,
      fatPerServing: recipe.fatPerServing,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-meals/my"] });
      toast({ title: "Shared with community", description: "Your recipe is now in the community meal pool." });
    },
    onError: () => toast({ title: "Failed to share", variant: "destructive" }),
  });

  const unshareMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/community-meals/${sharedMeal!.id}/unshare`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-meals/my"] });
      toast({ title: "Unshared", description: "Recipe removed from the community pool." });
    },
    onError: () => toast({ title: "Failed to unshare", variant: "destructive" }),
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
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {complete && (
              <button
                onClick={() => isShared ? unshareMutation.mutate() : shareMutation.mutate()}
                disabled={shareMutation.isPending || unshareMutation.isPending}
                data-testid={`button-share-recipe-${recipe.id}`}
                title={isShared ? "Unshare from community" : "Share with community"}
                className={`p-1.5 rounded-lg transition-colors ${isShared ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100" : "text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50"}`}
              >
                {shareMutation.isPending || unshareMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Share2 className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-recipe-${recipe.id}`}
              className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              {deleteMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
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
          {isShared && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Heart className="w-2.5 h-2.5 fill-current" />
              {sharedMeal!.favouriteCount > 0 ? `${sharedMeal!.favouriteCount} favourited` : "Shared"}
            </span>
          )}
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
          href={recipe.sourceUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors mt-auto"
          data-testid={`link-recipe-source-${recipe.id}`}
        >
          <Globe className="w-3 h-3" />
          {sourceDomain(recipe.sourceUrl ?? "")}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

function ImportModal({ savedSites, onClose }: { savedSites: string[]; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("method");
  const [importMethod, setImportMethod] = useState<ImportMethod | null>(null);
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);

  const [url, setUrl] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [mealSlot, setMealSlot] = useState<MealSlot>("dinner");
  const [mealStyle, setMealStyle] = useState<MealStyle>("simple");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [dupWarning, setDupWarning] = useState<{ message: string; exactMatch: boolean; existingCount: number } | null>(null);

  const photo1Ref = useRef<HTMLInputElement>(null);
  const photo2Ref = useRef<HTMLInputElement>(null);

  function applyParsed(data: ParsedRecipe) {
    setParsed(data);
    setCalories(data.calories !== null ? String(data.calories) : "");
    setProtein(data.protein !== null ? String(data.protein) : "");
    setCarbs(data.carbs !== null ? String(data.carbs) : "");
    setFat(data.fat !== null ? String(data.fat) : "");
    if (data.suggestedSlot) setMealSlot(data.suggestedSlot as MealSlot);
    setStep("confirm");
  }

  const fetchMutation = useMutation({
    mutationFn: async (importUrl: string) => {
      const res = await apiRequest("POST", "/api/recipes/import", { url: importUrl });
      return res.json() as Promise<ParsedRecipe>;
    },
    onSuccess: applyParsed,
    onError: (e: any) => {
      let msg = e?.message ?? "Could not import that recipe. Try a different URL.";
      try {
        const match = msg.match(/^\d+: (.+)$/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          if (parsed.message) msg = parsed.message;
        }
      } catch {}
      setFetchError(msg);
    },
  });

  const photoMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const images = await Promise.all(
        files.map(async f => ({ base64: await fileToBase64(f), mimeType: f.type || "image/jpeg" }))
      );
      const res = await apiRequest("POST", "/api/recipes/import-photo", { images });
      return res.json() as Promise<ParsedRecipe>;
    },
    onSuccess: applyParsed,
    onError: (e: any) => {
      let msg = e?.message ?? "Could not read the recipe from that photo. Try again with a clearer image.";
      try {
        const match = msg.match(/^\d+: (.+)$/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          if (parsed.message) msg = parsed.message;
        }
      } catch {}
      setPhotoError(msg);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/user-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const json = await res.json();
      if (res.status === 409 && json.duplicateWarning) {
        throw { isDuplicate: true, warning: json };
      }
      if (!res.ok) throw new Error(json.message || "Failed to save recipe");
      return json;
    },
    onSuccess: () => {
      setDupWarning(null);
      queryClient.invalidateQueries({ queryKey: ["/api/user-meals"] });
      toast({ title: "Recipe saved!", description: "It will appear in your meal plan generation." });
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as Record<string, unknown>;
      if (e?.isDuplicate) {
        setDupWarning(e.warning as DuplicateWarning);
        return;
      }
      toast({ title: "Failed to save recipe", variant: "destructive" });
    },
  });

  function handleFetch() {
    setFetchError(null);
    let cleaned = url.trim();
    if (cleaned && !cleaned.startsWith("http")) cleaned = "https://" + cleaned;
    fetchMutation.mutate(cleaned);
  }

  function handlePhotoChange(index: number, file: File | null) {
    setPhotoError(null);
    if (!file) {
      const newPhotos = photos.filter((_, i) => i !== index);
      const newPreviews = photoPreviews.filter((_, i) => i !== index);
      setPhotos(newPhotos);
      setPhotoPreviews(newPreviews);
      return;
    }
    const url = URL.createObjectURL(file);
    if (index === 0) {
      const newPhotos = [file, ...photos.slice(1)];
      const newPreviews = [url, ...photoPreviews.slice(1)];
      setPhotos(newPhotos);
      setPhotoPreviews(newPreviews);
    } else {
      setPhotos([photos[0], file]);
      setPhotoPreviews([photoPreviews[0], url]);
    }
  }

  function handleAnalyse() {
    if (photos.length === 0) return;
    setPhotoError(null);
    photoMutation.mutate(photos);
  }

  function buildRecipePayload(confirm = false) {
    return {
      name: parsed!.name,
      source: "imported",
      sourceUrl: parsed!.sourceUrl,
      imageUrl: parsed!.imageUrl,
      servings: parsed!.servings,
      caloriesPerServing: parseInt(calories) || 0,
      proteinPerServing: parseInt(protein) || 0,
      carbsPerServing: parseInt(carbs) || 0,
      fatPerServing: parseInt(fat) || 0,
      ingredients: JSON.stringify(parsed!.ingredients),
      mealSlot,
      mealStyle,
      ...(confirm ? { confirmDuplicate: true } : {}),
    };
  }

  function handleSave() {
    if (!parsed) return;
    setDupWarning(null);
    saveMutation.mutate(buildRecipePayload());
  }

  function goBack() {
    if (step === "confirm") {
      setStep(importMethod === "photo" ? "photo" : "url");
      setParsed(null);
    } else if (step === "url" || step === "photo") {
      setStep("method");
      setFetchError(null);
      setPhotoError(null);
    }
  }

  function selectMethod(method: ImportMethod) {
    setImportMethod(method);
    setStep(method === "photo" ? "photo" : "url");
  }

  const macrosComplete = calories && protein && carbs && fat &&
    parseInt(calories) > 0 && parseInt(protein) > 0 && parseInt(carbs) > 0 && parseInt(fat) > 0;

  const headerTitle =
    step === "method" ? "Import a Recipe" :
    step === "url" ? "From the Web" :
    step === "photo" ? "From a Photo" :
    "Confirm & Save";

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
        className="fixed inset-x-4 top-[8%] mx-auto max-w-lg bg-white rounded-3xl shadow-2xl z-50 overflow-hidden max-h-[84vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {step !== "method" && (
              <button
                onClick={goBack}
                className="p-1.5 -ml-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <ChefHat className="w-4 h-4 text-zinc-500" />
            <h3 className="font-semibold text-zinc-900 text-sm">{headerTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
            data-testid="button-close-import"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* ── Method picker ── */}
          {step === "method" && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 mb-4">How would you like to add a recipe?</p>
              <button
                onClick={() => selectMethod("web")}
                data-testid="button-method-web"
                className="w-full flex items-center gap-4 p-4 border-2 border-zinc-100 hover:border-zinc-300 rounded-2xl text-left transition-all group"
              >
                <div className="w-10 h-10 bg-zinc-100 text-zinc-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-zinc-200 transition-colors">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">From the web</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Paste a URL from any recipe website</p>
                </div>
              </button>

              <button
                onClick={() => selectMethod("photo")}
                data-testid="button-method-photo"
                className="w-full flex items-center gap-4 p-4 border-2 border-zinc-100 hover:border-zinc-300 rounded-2xl text-left transition-all group"
              >
                <div className="w-10 h-10 bg-zinc-100 text-zinc-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-zinc-200 transition-colors">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">From a photo</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Take a photo of a recipe book — up to 2 pages</p>
                </div>
              </button>
            </div>
          )}

          {/* ── URL step ── */}
          {step === "url" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Recipe URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleFetch()}
                    placeholder="https://www.bbcgoodfood.com/recipes/..."
                    className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none transition-colors"
                    data-testid="input-recipe-url"
                    autoFocus
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
                  <p className="text-xs font-medium text-zinc-500 mb-2">Your saved sites</p>
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
                  Works with BBC Good Food, Serious Eats, Cookie and Kate, and most sites that publish structured recipe data.
                </p>
              </div>
            </div>
          )}

          {/* ── Photo step ── */}
          {step === "photo" && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Take a clear photo of the recipe page. If the recipe continues on the next page, add a second photo too — the AI will combine both.
              </p>

              {/* Photo slots */}
              <div className="space-y-3">
                {/* Photo 1 — required */}
                <div>
                  <p className="text-xs font-medium text-zinc-600 mb-1.5">Page 1 <span className="text-zinc-400 font-normal">(required)</span></p>
                  {photoPreviews[0] ? (
                    <div className="relative rounded-2xl overflow-hidden bg-zinc-100 aspect-[4/3]">
                      <img src={photoPreviews[0]} alt="Recipe page 1" className="w-full h-full object-cover" />
                      <button
                        onClick={() => { handlePhotoChange(0, null); if (photo1Ref.current) photo1Ref.current.value = ""; }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80 transition-colors"
                        data-testid="button-remove-photo-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => photo1Ref.current?.click()}
                      className="w-full aspect-[4/3] border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-zinc-400 hover:bg-zinc-50 transition-all text-zinc-400 hover:text-zinc-600"
                      data-testid="button-add-photo-1"
                    >
                      <Camera className="w-7 h-7" />
                      <span className="text-xs font-medium">Tap to take photo or choose file</span>
                    </button>
                  )}
                  <input
                    ref={photo1Ref}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    data-testid="input-photo-1"
                    onChange={e => handlePhotoChange(0, e.target.files?.[0] ?? null)}
                  />
                </div>

                {/* Photo 2 — optional, only shown if page 1 is selected */}
                {photoPreviews[0] && (
                  <div>
                    <p className="text-xs font-medium text-zinc-600 mb-1.5">Page 2 <span className="text-zinc-400 font-normal">(optional — if recipe continues)</span></p>
                    {photoPreviews[1] ? (
                      <div className="relative rounded-2xl overflow-hidden bg-zinc-100 aspect-[4/3]">
                        <img src={photoPreviews[1]} alt="Recipe page 2" className="w-full h-full object-cover" />
                        <button
                          onClick={() => { handlePhotoChange(1, null); if (photo2Ref.current) photo2Ref.current.value = ""; }}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80 transition-colors"
                          data-testid="button-remove-photo-2"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => photo2Ref.current?.click()}
                        className="w-full py-4 border-2 border-dashed border-zinc-200 rounded-2xl flex items-center justify-center gap-2 hover:border-zinc-400 hover:bg-zinc-50 transition-all text-zinc-400 hover:text-zinc-600"
                        data-testid="button-add-photo-2"
                      >
                        <ImagePlus className="w-4 h-4" />
                        <span className="text-xs font-medium">Add page 2</span>
                      </button>
                    )}
                    <input
                      ref={photo2Ref}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      data-testid="input-photo-2"
                      onChange={e => handlePhotoChange(1, e.target.files?.[0] ?? null)}
                    />
                  </div>
                )}
              </div>

              {photoError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {photoError}
                </div>
              )}

              <div className="flex items-start gap-2 px-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-zinc-500">AI reads the recipe and extracts ingredients and macros where visible. You can edit everything before saving.</p>
              </div>
            </div>
          )}

          {/* ── Confirm step ── */}
          {step === "confirm" && parsed && (
            <div className="space-y-5">
              <div className="flex gap-3 items-start">
                {parsed.imageUrl && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-100">
                    <img src={parsed.imageUrl} alt={parsed.name} className="w-full h-full object-cover" />
                  </div>
                )}
                {importMethod === "photo" && photoPreviews[0] && !parsed.imageUrl && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-100">
                    <img src={photoPreviews[0]} alt={parsed.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900 text-sm leading-snug">{parsed.name}</p>
                  {importMethod === "photo" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 mt-0.5">
                      <Camera className="w-3 h-3" /> From photo
                    </span>
                  ) : (
                    <a href={parsed.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 mt-0.5">
                      <Globe className="w-3 h-3" />
                      {sourceDomain(parsed.sourceUrl)}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                  <p className="text-xs text-zinc-500 mt-0.5">{parsed.servings} serving{parsed.servings !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Nutrition */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">Macros per serving</p>
                  {parsed.hasNutrition
                    ? <span className="flex items-center gap-1 text-[10px] text-emerald-600"><Check className="w-3 h-3" /> Auto-filled</span>
                    : <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">Not found — please fill in</span>
                  }
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
                    <span className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full">suggested</span>
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

              {/* Ingredients */}
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

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-zinc-100 bg-white">
          {step === "method" && (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
          )}

          {step === "url" && (
            <button
              onClick={handleFetch}
              disabled={!url.trim() || fetchMutation.isPending}
              data-testid="button-fetch-recipe-footer"
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {fetchMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</> : "Fetch Recipe"}
            </button>
          )}

          {step === "photo" && (
            <button
              onClick={handleAnalyse}
              disabled={photos.length === 0 || photoMutation.isPending}
              data-testid="button-analyse-photo"
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {photoMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Reading recipe…</>
                : <><Sparkles className="w-4 h-4" /> Analyse Recipe</>}
            </button>
          )}

          {step === "confirm" && (
            <div className="flex gap-2">
              <button
                onClick={goBack}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                data-testid="button-back-confirm"
              >
                Back
              </button>
              {dupWarning ? (
                <div className="flex-1">
                  <DuplicateWarningBanner
                    warning={dupWarning}
                    onConfirm={() => { setDupWarning(null); saveMutation.mutate(buildRecipePayload(true)); }}
                    onCancel={() => setDupWarning(null)}
                    testPrefix="recipe-dup"
                  />
                </div>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-recipe"
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save Recipe"}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
