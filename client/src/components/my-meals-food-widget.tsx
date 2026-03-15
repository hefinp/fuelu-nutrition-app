import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  UtensilsCrossed, Wheat, Plus, Trash2, Loader2, X, Pencil,
  ChevronDown, ChevronUp, Link2, Camera, ArrowLeft, ImagePlus,
  Check, AlertCircle, Utensils, Globe, BookOpen,
} from "lucide-react";
import type { FavouriteMeal, UserRecipe, UserSavedFood } from "@shared/schema";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
type ActiveTab = "meals" | "foods";
type ImportStep = "method" | "url" | "photo" | "confirm";

const SLOT_OPTIONS: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

const SLOT_COLOURS: Record<MealSlot, string> = {
  breakfast: "bg-amber-50 text-amber-700",
  lunch: "bg-green-50 text-green-700",
  dinner: "bg-blue-50 text-blue-700",
  snack: "bg-purple-50 text-purple-700",
};

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

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function macroBar(p: number, c: number, f: number) {
  const total = p + c + f || 1;
  return (
    <div className="flex h-1 rounded-full overflow-hidden gap-px mt-1.5">
      <div className="bg-blue-400" style={{ width: `${(p / total) * 100}%` }} />
      <div className="bg-amber-400" style={{ width: `${(c / total) * 100}%` }} />
      <div className="bg-rose-400" style={{ width: `${(f / total) * 100}%` }} />
    </div>
  );
}

function MacroChips({ cal, p, c, f }: { cal: number; p: number; c: number; f: number }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 mt-2">
      <div className="bg-orange-50 rounded-lg p-1.5 text-center">
        <p className="text-xs font-bold text-orange-600">{cal}</p>
        <p className="text-[10px] text-orange-400">kcal</p>
      </div>
      <div className="bg-blue-50 rounded-lg p-1.5 text-center">
        <p className="text-xs font-bold text-blue-600">{p}g</p>
        <p className="text-[10px] text-blue-400">prot</p>
      </div>
      <div className="bg-amber-50 rounded-lg p-1.5 text-center">
        <p className="text-xs font-bold text-amber-600">{c}g</p>
        <p className="text-[10px] text-amber-400">carbs</p>
      </div>
      <div className="bg-rose-50 rounded-lg p-1.5 text-center">
        <p className="text-xs font-bold text-rose-600">{f}g</p>
        <p className="text-[10px] text-rose-400">fat</p>
      </div>
    </div>
  );
}

// ─── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>("method");
  const [url, setUrl] = useState("");
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [urlError, setUrlError] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (u: string) => apiRequest("POST", "/api/recipes/import", { url: u }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.message) { setUrlError(data.message); return; }
      setParsed(data);
      setCalories(data.calories != null ? String(data.calories) : "");
      setProtein(data.protein != null ? String(data.protein) : "");
      setCarbs(data.carbs != null ? String(data.carbs) : "");
      setFat(data.fat != null ? String(data.fat) : "");
      setSlot((data.suggestedSlot as MealSlot) || "dinner");
      setStep("confirm");
    },
    onError: () => setUrlError("Could not load that URL. Try a different recipe site."),
  });

  const photoMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const images = await Promise.all(files.map(async f => ({
        base64: await fileToBase64(f),
        mimeType: f.type || "image/jpeg",
      })));
      return apiRequest("POST", "/api/recipes/import-photo", { images }).then(r => r.json());
    },
    onSuccess: (data) => {
      if (data.message) { toast({ title: data.message, variant: "destructive" }); return; }
      setParsed(data);
      setCalories(data.calories != null ? String(data.calories) : "");
      setProtein(data.protein != null ? String(data.protein) : "");
      setCarbs(data.carbs != null ? String(data.carbs) : "");
      setFat(data.fat != null ? String(data.fat) : "");
      setSlot((data.suggestedSlot as MealSlot) || "dinner");
      setStep("confirm");
    },
    onError: () => toast({ title: "Failed to extract recipe from photo", variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/recipes", {
      name: parsed!.name,
      sourceUrl: parsed!.sourceUrl,
      imageUrl: parsed!.imageUrl,
      servings: parsed!.servings,
      caloriesPerServing: parseInt(calories) || 0,
      proteinPerServing: parseInt(protein) || 0,
      carbsPerServing: parseInt(carbs) || 0,
      fatPerServing: parseInt(fat) || 0,
      ingredients: parsed!.ingredients.join("\n"),
      mealSlot: slot,
      mealStyle: "simple",
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: `${parsed!.name} saved to Meals` });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Failed to save recipe", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            {step !== "method" && (
              <button onClick={() => setStep("method")} className="p-1 text-zinc-400 hover:text-zinc-700 mr-1" data-testid="button-import-back">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3 className="text-base font-semibold text-zinc-900">Import Recipe</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700" data-testid="button-import-close"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === "method" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">How would you like to import a recipe?</p>
              <button
                onClick={() => setStep("url")}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all text-left"
                data-testid="button-import-method-url"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">From a website</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Paste a URL from any recipe site</p>
                </div>
              </button>
              <button
                onClick={() => setStep("photo")}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all text-left"
                data-testid="button-import-method-photo"
              >
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">From a photo</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Take or upload a photo of a recipe book page</p>
                </div>
              </button>
            </div>
          )}

          {step === "url" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Recipe URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={e => { setUrl(e.target.value); setUrlError(""); }}
                    placeholder="https://www.bbcgoodfood.com/recipes/..."
                    className="flex-1 text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    data-testid="input-import-url"
                    onKeyDown={e => { if (e.key === "Enter" && url.trim()) importMutation.mutate(url.trim()); }}
                  />
                  <button
                    onClick={() => { setUrlError(""); importMutation.mutate(url.trim()); }}
                    disabled={!url.trim() || importMutation.isPending}
                    className="px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                    data-testid="button-import-url-fetch"
                  >
                    {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                  </button>
                </div>
                {urlError && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{urlError}</p>}
              </div>
            </div>
          )}

          {step === "photo" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">Upload a photo (or two pages) of a recipe from a cookbook. AI will extract the ingredients and nutrition information.</p>
              <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={e => setPhotoFiles(Array.from(e.target.files ?? []).slice(0, 2))} data-testid="input-import-photo" />
              {photoFiles.length === 0 ? (
                <button
                  onClick={() => photoRef.current?.click()}
                  className="w-full border-2 border-dashed border-zinc-200 rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-zinc-300 hover:bg-zinc-50 transition-all"
                  data-testid="button-import-photo-pick"
                >
                  <ImagePlus className="w-8 h-8 text-zinc-300" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-600">Tap to choose a photo</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Up to 2 pages of a recipe book</p>
                  </div>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {photoFiles.map((f, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-200">
                        <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setPhotoFiles(prev => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {photoFiles.length < 2 && (
                      <button onClick={() => photoRef.current?.click()} className="w-24 h-24 border-2 border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center gap-1 text-zinc-400 hover:border-zinc-300 text-xs">
                        <Plus className="w-4 h-4" />Add page
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => photoMutation.mutate(photoFiles)}
                    disabled={photoMutation.isPending}
                    className="w-full py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    data-testid="button-import-photo-extract"
                  >
                    {photoMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Extracting recipe...</> : "Extract Recipe"}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "confirm" && parsed && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Recipe name</label>
                <p className="text-sm font-semibold text-zinc-900">{parsed.name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2">Meal slot</label>
                <div className="grid grid-cols-4 gap-2">
                  {SLOT_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => setSlot(o.value)}
                      className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${slot === o.value ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"}`}
                      data-testid={`button-import-slot-${o.value}`}
                    >{o.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2">Nutrition per serving</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Calories (kcal)", value: calories, set: setCalories },
                    { label: "Protein (g)", value: protein, set: setProtein },
                    { label: "Carbs (g)", value: carbs, set: setCarbs },
                    { label: "Fat (g)", value: fat, set: setFat },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label className="text-[10px] text-zinc-400">{label}</label>
                      <input type="number" value={value} onChange={e => set(e.target.value)} min={0}
                        className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" />
                    </div>
                  ))}
                </div>
              </div>
              {parsed.ingredients.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Ingredients ({parsed.ingredients.length})</label>
                  <ul className="text-xs text-zinc-600 space-y-0.5 max-h-32 overflow-y-auto">
                    {parsed.ingredients.map((ing, i) => <li key={i} className="flex items-start gap-1"><span className="mt-1 w-1 h-1 rounded-full bg-zinc-300 shrink-0" />{ing}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {step === "confirm" && parsed && (
          <div className="px-6 pb-6 pt-4 border-t border-zinc-100 shrink-0">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full py-3 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              data-testid="button-import-save"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><BookOpen className="w-4 h-4" />Save to My Meals</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add / Edit Food Modal ─────────────────────────────────────────────────────
function AddFoodModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (food: UserSavedFood) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [prot, setProt] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [serving, setServing] = useState("100");

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/my-foods", {
      name: name.trim(),
      calories100g: parseInt(cal) || 0,
      protein100g: parseFloat(prot) || 0,
      carbs100g: parseFloat(carbs) || 0,
      fat100g: parseFloat(fat) || 0,
      servingGrams: parseInt(serving) || 100,
    }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-foods"] });
      toast({ title: `${name} added to My Foods` });
      onSaved(data);
      onClose();
    },
    onError: () => toast({ title: "Failed to save food", variant: "destructive" }),
  });

  const valid = name.trim().length > 0 && (parseInt(cal) >= 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
          <h3 className="text-base font-semibold text-zinc-900">Add Food to My Foods</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700" data-testid="button-add-food-close"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Food name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Brown Rice"
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid="input-food-name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Macros per 100g</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Calories (kcal)", value: cal, set: setCal, testid: "input-food-calories" },
                { label: "Protein (g)", value: prot, set: setProt, testid: "input-food-protein" },
                { label: "Carbs (g)", value: carbs, set: setCarbs, testid: "input-food-carbs" },
                { label: "Fat (g)", value: fat, set: setFat, testid: "input-food-fat" },
              ].map(({ label, value, set, testid }) => (
                <div key={label}>
                  <label className="text-[10px] text-zinc-400">{label}</label>
                  <input type="number" value={value} min={0} onChange={e => set(e.target.value)}
                    className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid={testid} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Default serving size (g)</label>
            <input type="number" value={serving} onChange={e => setServing(e.target.value)} min={1}
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid="input-food-serving" />
          </div>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!valid || saveMutation.isPending}
            className="w-full py-3 bg-zinc-900 text-white text-sm font-semibold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="button-add-food-save"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Food"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Meal Modal ───────────────────────────────────────────────────────────
function EditMealModal({
  type,
  item,
  onClose,
  onSaved,
}: {
  type: "favourite" | "recipe";
  item: FavouriteMeal | UserRecipe;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isFav = type === "favourite";
  const fav = isFav ? (item as FavouriteMeal) : null;
  const rec = !isFav ? (item as UserRecipe) : null;

  const [name, setName] = useState(isFav ? fav!.mealName : rec!.name);
  const [cal, setCal] = useState(String(isFav ? fav!.calories : rec!.caloriesPerServing));
  const [prot, setProt] = useState(String(isFav ? fav!.protein : rec!.proteinPerServing));
  const [carbs, setCarbs] = useState(String(isFav ? fav!.carbs : rec!.carbsPerServing));
  const [fat, setFat] = useState(String(isFav ? fav!.fat : rec!.fatPerServing));
  const [mealSlot, setMealSlot] = useState<MealSlot>((isFav ? fav!.mealSlot : rec!.mealSlot) as MealSlot ?? "dinner");
  const [instructions, setInstructions] = useState(rec?.instructions ?? "");
  const [ingredients, setIngredients] = useState(rec?.ingredients ?? "");

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isFav) {
        return apiRequest("PATCH", `/api/favourites/${fav!.id}`, {
          mealName: name.trim(),
          calories: parseInt(cal) || 0,
          protein: parseInt(prot) || 0,
          carbs: parseInt(carbs) || 0,
          fat: parseInt(fat) || 0,
          mealSlot,
        }).then(r => r.json());
      } else {
        return apiRequest("PATCH", `/api/recipes/${rec!.id}`, {
          name: name.trim(),
          caloriesPerServing: parseInt(cal) || 0,
          proteinPerServing: parseInt(prot) || 0,
          carbsPerServing: parseInt(carbs) || 0,
          fatPerServing: parseInt(fat) || 0,
          mealSlot,
          instructions: instructions.trim() || null,
          ingredients: ingredients.trim() || null,
        }).then(r => r.json());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favourites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Meal updated" });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Failed to update meal", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <h3 className="text-base font-semibold text-zinc-900">Edit Meal</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700" data-testid="button-edit-meal-close"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Meal name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid="input-edit-meal-name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-2">Meal slot</label>
            <div className="grid grid-cols-4 gap-2">
              {SLOT_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setMealSlot(o.value)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${mealSlot === o.value ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"}`}
                  data-testid={`button-edit-slot-${o.value}`}
                >{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-2">Nutrition per serving</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Calories (kcal)", value: cal, set: setCal },
                { label: "Protein (g)", value: prot, set: setProt },
                { label: "Carbs (g)", value: carbs, set: setCarbs },
                { label: "Fat (g)", value: fat, set: setFat },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="text-[10px] text-zinc-400">{label}</label>
                  <input type="number" value={value} min={0} onChange={e => set(e.target.value)}
                    className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" />
                </div>
              ))}
            </div>
          </div>
          {!isFav && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Ingredients (one per line)</label>
                <textarea value={ingredients} onChange={e => setIngredients(e.target.value)} rows={4} placeholder="e.g.&#10;200g chicken breast&#10;1 tbsp olive oil"
                  className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none" data-testid="textarea-edit-ingredients" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Instructions</label>
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={5} placeholder="Step-by-step cooking instructions..."
                  className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none" data-testid="textarea-edit-instructions" />
              </div>
            </>
          )}
        </div>
        <div className="px-6 pb-6 pt-4 border-t border-zinc-100 shrink-0">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
            className="w-full py-3 bg-zinc-900 text-white text-sm font-semibold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="button-edit-meal-save"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Meal Modal ─────────────────────────────────────────────────────────
function CreateMealModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"pick" | "details">("pick");
  const [showAddFood, setShowAddFood] = useState(false);

  const { data: myFoods = [] } = useQuery<UserSavedFood[]>({ queryKey: ["/api/my-foods"] });

  type SelectedFood = { food: UserSavedFood; grams: number };
  const [selected, setSelected] = useState<SelectedFood[]>([]);

  const [mealName, setMealName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [mealSlot, setMealSlot] = useState<MealSlot>("dinner");

  function toggleFood(food: UserSavedFood) {
    setSelected(prev => {
      const exists = prev.find(s => s.food.id === food.id);
      if (exists) return prev.filter(s => s.food.id !== food.id);
      return [...prev, { food, grams: food.servingGrams }];
    });
  }

  function updateGrams(foodId: number, grams: number) {
    setSelected(prev => prev.map(s => s.food.id === foodId ? { ...s, grams: Math.max(1, grams) } : s));
  }

  const totals = selected.reduce((acc, { food, grams }) => {
    const factor = grams / 100;
    return {
      cal: acc.cal + Math.round(food.calories100g * factor),
      prot: acc.prot + Math.round(Number(food.protein100g) * factor),
      carbs: acc.carbs + Math.round(Number(food.carbs100g) * factor),
      fat: acc.fat + Math.round(Number(food.fat100g) * factor),
    };
  }, { cal: 0, prot: 0, carbs: 0, fat: 0 });

  const saveMutation = useMutation({
    mutationFn: () => {
      const ingredientLines = selected.map(s => `${s.grams}g ${s.food.name}`).join("\n");
      return apiRequest("POST", "/api/recipes", {
        name: mealName.trim(),
        sourceUrl: "custom://created",
        imageUrl: null,
        servings: 1,
        caloriesPerServing: totals.cal,
        proteinPerServing: totals.prot,
        carbsPerServing: totals.carbs,
        fatPerServing: totals.fat,
        ingredients: ingredientLines,
        instructions: instructions.trim() || null,
        mealSlot,
        mealStyle: "simple",
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: `${mealName} saved to My Meals` });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Failed to save meal", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            {step === "details" && (
              <button onClick={() => setStep("pick")} className="p-1 text-zinc-400 hover:text-zinc-700 mr-1" data-testid="button-create-back">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3 className="text-base font-semibold text-zinc-900">
              {step === "pick" ? "Pick Foods" : "Meal Details"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700" data-testid="button-create-meal-close"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === "pick" && (
            <div className="px-6 py-5 space-y-4">
              {myFoods.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Wheat className="w-5 h-5 text-zinc-300" />
                  </div>
                  <p className="text-sm font-medium text-zinc-500 mb-1">No foods saved yet</p>
                  <p className="text-xs text-zinc-400 mb-4">Add foods to My Foods first, then you can build meals from them.</p>
                  <button
                    onClick={() => setShowAddFood(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl"
                    data-testid="button-create-add-first-food"
                  >
                    <Plus className="w-3.5 h-3.5" />Add a food
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {myFoods.map(food => {
                    const sel = selected.find(s => s.food.id === food.id);
                    const isSelected = !!sel;
                    return (
                      <div key={food.id} className={`rounded-xl border transition-all ${isSelected ? "border-zinc-900 bg-zinc-50" : "border-zinc-100 bg-white"}`}>
                        <button
                          className="w-full flex items-center gap-3 p-3 text-left"
                          onClick={() => toggleFood(food)}
                          data-testid={`button-pick-food-${food.id}`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"}`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 truncate">{food.name}</p>
                            <p className="text-xs text-zinc-400">{food.calories100g} kcal · P:{Number(food.protein100g).toFixed(1)}g · C:{Number(food.carbs100g).toFixed(1)}g · F:{Number(food.fat100g).toFixed(1)}g per 100g</p>
                          </div>
                        </button>
                        {isSelected && (
                          <div className="px-3 pb-3 flex items-center gap-2">
                            <label className="text-xs text-zinc-500 shrink-0">Serving (g):</label>
                            <input
                              type="number"
                              value={sel.grams}
                              min={1}
                              onChange={e => updateGrams(food.id, parseInt(e.target.value) || 1)}
                              className="w-20 text-sm border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                              data-testid={`input-grams-${food.id}`}
                            />
                            {(() => {
                              const f = sel.grams / 100;
                              return <p className="text-xs text-zinc-400">≈ {Math.round(food.calories100g * f)} kcal</p>;
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => setShowAddFood(true)}
                className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 text-sm transition-colors"
                data-testid="button-create-add-food"
              >
                <Plus className="w-4 h-4" />Add new food to My Foods
              </button>
            </div>
          )}

          {step === "details" && (
            <div className="px-6 py-5 space-y-4">
              {selected.length > 0 && (
                <div className="bg-zinc-50 rounded-2xl p-4">
                  <p className="text-xs font-medium text-zinc-500 mb-2">Selected foods</p>
                  <div className="space-y-1 mb-3">
                    {selected.map(s => (
                      <div key={s.food.id} className="flex items-center justify-between text-xs text-zinc-600">
                        <span>{s.food.name}</span>
                        <span>{s.grams}g · {Math.round(s.food.calories100g * s.grams / 100)} kcal</span>
                      </div>
                    ))}
                  </div>
                  <MacroChips cal={totals.cal} p={totals.prot} c={totals.carbs} f={totals.fat} />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Meal name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={mealName}
                  onChange={e => setMealName(e.target.value)}
                  placeholder="e.g. Chicken & Rice Bowl"
                  className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  data-testid="input-create-meal-name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Meal slot</label>
                <div className="grid grid-cols-4 gap-2">
                  {SLOT_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => setMealSlot(o.value)}
                      className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${mealSlot === o.value ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"}`}
                      data-testid={`button-create-slot-${o.value}`}
                    >{o.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Instructions</label>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  rows={6}
                  placeholder="Step 1: Cook the chicken in a pan over medium heat...&#10;Step 2: ..."
                  className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none"
                  data-testid="textarea-create-instructions"
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-zinc-100 shrink-0">
          {step === "pick" ? (
            <button
              onClick={() => setStep("details")}
              disabled={selected.length === 0}
              className="w-full py-3 bg-zinc-900 text-white text-sm font-semibold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-create-next"
            >
              Next — Add meal details ({selected.length} food{selected.length !== 1 ? "s" : ""} selected)
            </button>
          ) : (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!mealName.trim() || saveMutation.isPending}
              className="w-full py-3 bg-zinc-900 text-white text-sm font-semibold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-create-meal-save"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UtensilsCrossed className="w-4 h-4" />Save Meal</>}
            </button>
          )}
        </div>
      </div>

      {showAddFood && (
        <AddFoodModal
          onClose={() => setShowAddFood(false)}
          onSaved={(food) => {
            setSelected(prev => [...prev, { food, grams: food.servingGrams }]);
            setShowAddFood(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Main Widget ───────────────────────────────────────────────────────────────
export function MyMealsFoodWidget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("meals");
  const [showImport, setShowImport] = useState(false);
  const [showCreateMeal, setShowCreateMeal] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{ type: "favourite" | "recipe"; item: FavouriteMeal | UserRecipe } | null>(null);

  const { data: favourites = [], isLoading: favsLoading } = useQuery<FavouriteMeal[]>({ queryKey: ["/api/favourites"] });
  const { data: recipes = [], isLoading: recsLoading } = useQuery<UserRecipe[]>({ queryKey: ["/api/recipes"] });
  const { data: myFoods = [], isLoading: foodsLoading } = useQuery<UserSavedFood[]>({ queryKey: ["/api/my-foods"] });

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

  const deleteFavMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/favourites/${id}`, undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/favourites"] }); toast({ title: "Removed" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const deleteRecMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/recipes/${id}`, undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/recipes"] }); toast({ title: "Removed" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const deleteFoodMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/my-foods/${id}`, undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/my-foods"] }); toast({ title: "Removed from My Foods" }); },
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
      {/* Header */}
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

        {/* Tab toggle */}
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

      {/* Body */}
      <div className="px-6 pb-6">
        {/* ── Meals Tab ── */}
        {activeTab === "meals" && (
          <div>
            {/* Action buttons */}
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
              <div className="space-y-1.5">
                {mealEntries.map(entry => {
                  const key = getKey(entry);
                  const isOpen = expandedId === key;
                  const macros = getMacros(entry);
                  const slot = getMealSlot(entry);
                  const name = getMealName(entry);
                  const isCustom = isCustomMeal(entry);
                  const recipe = entry.kind === "recipe" ? (entry.item as UserRecipe) : null;

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
                          <p className="text-xs text-zinc-400 mt-0.5">{macros.cal} kcal · P:{macros.prot}g C:{macros.carbs}g F:{macros.fat}g</p>
                          {macroBar(macros.prot, macros.carbs, macros.fat)}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); setEditTarget({ type: entry.kind === "favourite" ? "favourite" : "recipe", item: entry.item }); }}
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
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="shrink-0 text-zinc-300 ml-1">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 bg-zinc-50 border-t border-zinc-100">
                          <MacroChips cal={macros.cal} p={macros.prot} c={macros.carbs} f={macros.fat} />

                          {recipe?.ingredients && (
                            <div className="mt-3">
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ingredients</p>
                              <ul className="text-xs text-zinc-600 space-y-0.5 max-h-28 overflow-y-auto">
                                {recipe.ingredients.split("\n").filter(Boolean).map((ing, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-300 shrink-0" />{ing}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {recipe?.instructions && (
                            <div className="mt-3">
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Instructions</p>
                              <p className="text-xs text-zinc-600 leading-relaxed line-clamp-4">{recipe.instructions}</p>
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
          </div>
        )}

        {/* ── Foods Tab ── */}
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
                        <button
                          onClick={e => { e.stopPropagation(); deleteFoodMutation.mutate(food.id); }}
                          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          data-testid={`button-delete-food-${food.id}`}
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
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
          </div>
        )}
      </div>

      {/* Modals */}
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
      {editTarget && (
        <EditMealModal
          type={editTarget.type}
          item={editTarget.item}
          onClose={() => setEditTarget(null)}
          onSaved={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
