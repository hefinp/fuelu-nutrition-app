import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  UtensilsCrossed, Wheat, Plus, Trash2, Loader2, X, Pencil,
  ChevronDown, ChevronUp, Link2, Camera, ArrowLeft, ImagePlus,
  Check, AlertCircle, Utensils, Globe, BookOpen, Search, Barcode, Sparkles, Send, Users2,
} from "lucide-react";
import type { FavouriteMeal, UserRecipe, UserSavedFood } from "@shared/schema";
import { CommunityBrowserModal } from "@/components/recipe-library";
import type { FoodResult, ExtendedFoodResult } from "@/components/food-log-shared";

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
type AddFoodTab = "search" | "scan" | "ai" | "manual";

function AddFoodModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (food: UserSavedFood) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AddFoodTab>("search");

  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [prot, setProt] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [serving, setServing] = useState("100");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedResult, setSelectedResult] = useState<FoodResult | ExtendedFoodResult | null>(null);
  const [resultServing, setResultServing] = useState("100");

  const [scannerError, setScannerError] = useState(false);
  const [scanLookingUp, setScanLookingUp] = useState(false);
  const [scannedFood, setScannedFood] = useState<ExtendedFoodResult | null>(null);
  const [scanServingGrams, setScanServingGrams] = useState("100");
  const [scanKey, setScanKey] = useState(0);
  const zxingModuleRef = useRef<typeof import("@zxing/browser") | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);

  const [aiMode, setAiMode] = useState<"describe" | "label">("describe");
  const [aiDescription, setAiDescription] = useState("");
  const [aiPhotoFile, setAiPhotoFile] = useState<File | null>(null);
  const [aiResult, setAiResult] = useState<ExtendedFoodResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiServingGrams, setAiServingGrams] = useState("100");
  const [aiProductName, setAiProductName] = useState("");
  const [aiLabelPhotoFile, setAiLabelPhotoFile] = useState<File | null>(null);
  const aiPhotoRef = useRef<HTMLInputElement>(null);
  const aiLabelPhotoRef = useRef<HTMLInputElement>(null);

  const { data: labelScanAvailability } = useQuery<{ available: boolean }>({ queryKey: ["/api/food-log/label-scan-available"], staleTime: Infinity });
  const labelScanAvailable = labelScanAvailability?.available ?? false;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    import("@zxing/browser").then(mod => { zxingModuleRef.current = mod; }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== "scan" || scannedFood) {
      scanControlsRef.current?.stop();
      scanControlsRef.current = null;
      return;
    }
    let cancelled = false;
    setScannerError(false);
    setScanLookingUp(false);
    (async () => {
      try {
        const mod = zxingModuleRef.current ?? await import("@zxing/browser");
        if (!zxingModuleRef.current) zxingModuleRef.current = mod;
        const { BrowserMultiFormatReader } = mod;
        if (cancelled || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, async (result) => {
          if (!result || cancelled) return;
          cancelled = true;
          controls.stop();
          scanControlsRef.current = null;
          const barcode = result.getText();
          setScanLookingUp(true);
          try {
            const res = await fetch(`/api/barcode/${encodeURIComponent(barcode)}`);
            if (res.ok) {
              const food: ExtendedFoodResult = await res.json();
              setScannedFood(food);
              setScanServingGrams(String(food.servingGrams || 100));
            } else {
              toast({ title: "Barcode not found", description: "This product isn't in any database yet. Try the Search or AI tab.", variant: "destructive" });
              setScanKey(k => k + 1);
            }
          } catch {
            toast({ title: "Barcode lookup failed", variant: "destructive" });
            setScanKey(k => k + 1);
          }
          setScanLookingUp(false);
        });
        if (!cancelled) scanControlsRef.current = controls;
      } catch {
        if (!cancelled) setScannerError(true);
      }
    })();
    return () => { cancelled = true; scanControlsRef.current?.stop(); scanControlsRef.current = null; };
  }, [tab, scanKey, scannedFood]);

  const { data: foodResults = [], isLoading: searchLoading } = useQuery<FoodResult[]>({
    queryKey: ["/api/food-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: tab === "search" && debouncedQuery.length >= 2,
    staleTime: 60_000,
  });

  async function handleAiEstimate() {
    if (!aiDescription.trim() && !aiPhotoFile) return;
    setAiLoading(true);
    try {
      const body: { imageBase64?: string; description?: string } = {};
      if (aiPhotoFile) body.imageBase64 = await fileToBase64(aiPhotoFile);
      if (aiDescription.trim()) body.description = aiDescription.trim();
      const res = await apiRequest("POST", "/api/food-log/recognize-food", body);
      const food: ExtendedFoodResult = await res.json();
      setAiResult(food);
      setAiServingGrams(String(food.servingGrams || 100));
    } catch {
      toast({ title: "Could not identify food", description: "Try a more detailed description.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAiLabelScan() {
    if (!aiLabelPhotoFile) return;
    setAiLoading(true);
    try {
      const b64 = await fileToBase64(aiLabelPhotoFile);
      const res = await apiRequest("POST", "/api/food-log/extract-label", { imageBase64: b64 });
      const food: ExtendedFoodResult = await res.json();
      if (aiProductName.trim()) food.name = aiProductName.trim();
      setAiResult(food);
      setAiServingGrams(String(food.servingGrams || 100));
    } catch {
      toast({ title: "Could not read label", description: "Try a clearer photo of the nutrition panel.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: (payload: { name: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number; servingGrams: number }) =>
      apiRequest("POST", "/api/my-foods", payload).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-foods"] });
      toast({ title: `${data.name} added to My Foods` });
      onSaved(data);
      onClose();
    },
    onError: () => toast({ title: "Failed to save food", variant: "destructive" }),
  });

  function saveFromResult(food: FoodResult | ExtendedFoodResult, servGrams: string) {
    saveMutation.mutate({
      name: food.name,
      calories100g: food.calories100g,
      protein100g: food.protein100g,
      carbs100g: food.carbs100g,
      fat100g: food.fat100g,
      servingGrams: parseInt(servGrams) || 100,
    });
  }

  function saveManual() {
    saveMutation.mutate({
      name: name.trim(),
      calories100g: parseInt(cal) || 0,
      protein100g: parseFloat(prot) || 0,
      carbs100g: parseFloat(carbs) || 0,
      fat100g: parseFloat(fat) || 0,
      servingGrams: parseInt(serving) || 100,
    });
  }

  const manualValid = name.trim().length > 0 && (parseInt(cal) >= 0);

  const addFoodTabs: { id: AddFoodTab; label: string; icon: typeof Search }[] = [
    { id: "search", label: "Search", icon: Search },
    { id: "scan", label: "Barcode", icon: Barcode },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "manual", label: "Manual", icon: Pencil },
  ];

  function ConfirmPanel({ food, servGrams, setServGrams, onSave, onReset, testPrefix }: {
    food: FoodResult | ExtendedFoodResult;
    servGrams: string;
    setServGrams: (v: string) => void;
    onSave: () => void;
    onReset: () => void;
    testPrefix: string;
  }) {
    const f = (parseFloat(servGrams) || 0) / 100;
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 leading-snug" data-testid={`text-${testPrefix}-food-name`}>{food.name}</p>
            {"sourceType" in food && food.sourceType === "estimated" && (
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-violet-50 border border-violet-200 rounded-full text-[9px] font-medium text-violet-700">
                <Sparkles className="w-2.5 h-2.5" />AI-estimated
              </span>
            )}
            {"source" in food && food.source && !("sourceType" in food && food.sourceType) && (
              <p className="text-[10px] text-zinc-400 mt-0.5">
                {food.source === "community" ? "Community database" : food.source === "open_food_facts" ? "Open Food Facts" : "USDA database"}
              </p>
            )}
          </div>
          <button type="button" onClick={onReset} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors shrink-0" data-testid={`button-${testPrefix}-reset`}>
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="flex items-center gap-2 bg-zinc-50 rounded-xl p-2.5">
          <label className="text-[10px] text-zinc-500 font-medium shrink-0">Serving (g)</label>
          <input type="number" min={1} value={servGrams} onChange={e => setServGrams(e.target.value)} className="w-20 text-sm font-semibold text-zinc-900 bg-transparent border-none outline-none text-right" data-testid={`input-${testPrefix}-serving`} />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: "kcal", value: Math.round(food.calories100g * f), color: "bg-orange-50 text-orange-700" },
            { label: "protein", value: Math.round(food.protein100g * f), color: "bg-red-50 text-red-700" },
            { label: "carbs", value: Math.round(food.carbs100g * f), color: "bg-blue-50 text-blue-700" },
            { label: "fat", value: Math.round(food.fat100g * f), color: "bg-yellow-50 text-yellow-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`${color} rounded-lg p-1.5 text-center`}>
              <p className="text-sm font-bold">{value}</p>
              <p className="text-[9px] font-medium uppercase tracking-wide opacity-70">{label}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saveMutation.isPending}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50"
          data-testid={`button-${testPrefix}-save`}
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save to My Foods</>}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <h3 className="text-base font-semibold text-zinc-900">Add Food to My Foods</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700" data-testid="button-add-food-close"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-3">
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              {addFoodTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold transition-colors rounded-lg ${tab === t.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                  data-testid={`button-addfood-tab-${t.id}`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "search" && (
              <div className="space-y-2">
                {selectedResult ? (
                  <ConfirmPanel
                    food={selectedResult}
                    servGrams={resultServing}
                    setServGrams={setResultServing}
                    onSave={() => saveFromResult(selectedResult, resultServing)}
                    onReset={() => setSelectedResult(null)}
                    testPrefix="addfood-search"
                  />
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search foods, brands..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-8 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
                        data-testid="input-addfood-search"
                      />
                      {searchQuery && (
                        <button type="button" onClick={() => { setSearchQuery(""); setDebouncedQuery(""); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {searchLoading && debouncedQuery.length >= 2 && (
                      <div className="flex items-center justify-center gap-2 py-6 text-zinc-400">
                        <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Searching...</span>
                      </div>
                    )}
                    {!searchLoading && debouncedQuery.length >= 2 && foodResults.length === 0 && (
                      <div className="text-center py-6 text-zinc-400">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No results for "{debouncedQuery}"</p>
                        <button type="button" onClick={() => { setAiResult(null); setAiDescription(debouncedQuery); setAiPhotoFile(null); setAiMode("describe"); setTab("ai"); }} className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 font-medium hover:text-violet-800" data-testid="button-addfood-search-try-ai">
                          <Sparkles className="w-3 h-3" />Try AI estimate instead
                        </button>
                      </div>
                    )}
                    {!searchLoading && debouncedQuery.length < 2 && !searchQuery && (
                      <div className="text-center py-6 text-zinc-300">
                        <Search className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">Start typing to search 3M+ foods</p>
                      </div>
                    )}
                    {foodResults.length > 0 && (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto" data-testid="addfood-search-results">
                        {foodResults.map(food => (
                          <button
                            key={food.id}
                            type="button"
                            onClick={() => { setSelectedResult(food); setResultServing("100"); }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-100 transition-colors text-left"
                            data-testid={`button-addfood-result-${food.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-zinc-900 truncate">{food.name}</p>
                              <p className="text-[10px] text-zinc-400 mt-0.5">P:{food.protein100g}g · C:{food.carbs100g}g · F:{food.fat100g}g per 100g</p>
                            </div>
                            <div className="ml-3 shrink-0 text-right">
                              <p className="text-xs font-bold text-zinc-900">{food.calories100g}</p>
                              <p className="text-[10px] text-zinc-400">kcal/100g</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "scan" && (
              <div className="space-y-3">
                {scannedFood ? (
                  <ConfirmPanel
                    food={scannedFood}
                    servGrams={scanServingGrams}
                    setServGrams={setScanServingGrams}
                    onSave={() => saveFromResult(scannedFood, scanServingGrams)}
                    onReset={() => { setScannedFood(null); setScanKey(k => k + 1); }}
                    testPrefix="addfood-scan"
                  />
                ) : scannerError ? (
                  <div className="text-center py-8">
                    <Barcode className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-600">Camera not available</p>
                    <p className="text-xs text-zinc-400 mt-1">Allow camera access or try the Search tab.</p>
                  </div>
                ) : (
                  <>
                    <div className="relative overflow-hidden rounded-2xl bg-zinc-900 aspect-[4/3]">
                      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted data-testid="video-addfood-barcode-scanner" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="relative w-56 h-28 z-10">
                          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl" />
                          <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr" />
                          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl" />
                          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white rounded-br" />
                          {!scanLookingUp && (
                            <div className="absolute inset-x-2 h-0.5 bg-white/70 top-1/2 -translate-y-1/2 animate-pulse" />
                          )}
                        </div>
                      </div>
                      {scanLookingUp && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
                          <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                          <p className="text-white text-xs font-medium">Looking up product...</p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 text-center">Point camera at a barcode — it will scan automatically</p>
                  </>
                )}
              </div>
            )}

            {tab === "ai" && (
              <div className="space-y-3">
                {aiResult ? (
                  <ConfirmPanel
                    food={aiResult}
                    servGrams={aiServingGrams}
                    setServGrams={setAiServingGrams}
                    onSave={() => saveFromResult(aiResult, aiServingGrams)}
                    onReset={() => { setAiResult(null); setAiDescription(""); setAiPhotoFile(null); setAiLabelPhotoFile(null); }}
                    testPrefix="addfood-ai"
                  />
                ) : (
                  <>
                    {labelScanAvailable && (
                      <div className="flex bg-zinc-100 p-0.5 rounded-xl">
                        <button type="button" onClick={() => setAiMode("describe")} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${aiMode === "describe" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`} data-testid="button-addfood-ai-mode-describe">
                          <Sparkles className="w-3 h-3" />Describe
                        </button>
                        <button type="button" onClick={() => setAiMode("label")} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${aiMode === "label" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`} data-testid="button-addfood-ai-mode-label">
                          <Camera className="w-3 h-3" />Label Scan
                        </button>
                      </div>
                    )}
                    {aiMode === "describe" || !labelScanAvailable ? (
                      <>
                        <div>
                          <p className="text-[10px] text-zinc-500 font-medium mb-1.5">What food are you adding?</p>
                          <input type="text" placeholder="e.g. chicken breast, 200g" value={aiDescription} onChange={e => setAiDescription(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAiEstimate(); } }} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white" data-testid="input-addfood-ai-description" />
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => aiPhotoRef.current?.click()} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${aiPhotoFile ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"}`} data-testid="button-addfood-ai-photo">
                            <Camera className="w-3.5 h-3.5" />
                            {aiPhotoFile ? <span className="truncate max-w-[120px]">{aiPhotoFile.name}</span> : "Add photo (optional)"}
                          </button>
                          {aiPhotoFile && <button type="button" onClick={() => setAiPhotoFile(null)} className="text-[10px] text-zinc-400 hover:text-zinc-600">Remove</button>}
                        </div>
                        <button type="button" onClick={handleAiEstimate} disabled={aiLoading || (!aiDescription.trim() && !aiPhotoFile)} className="w-full py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid="button-addfood-ai-estimate">
                          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {aiLoading ? "Estimating..." : "Estimate macros"}
                        </button>
                        <input ref={aiPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAiPhotoFile(f); e.target.value = ""; }} />
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-[10px] text-zinc-500 font-medium mb-1.5">Product name (optional)</p>
                          <input type="text" placeholder="e.g. Fage Total 0%" value={aiProductName} onChange={e => setAiProductName(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white" data-testid="input-addfood-ai-product-name" />
                        </div>
                        <button type="button" onClick={() => aiLabelPhotoRef.current?.click()} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${aiLabelPhotoFile ? "bg-green-50 text-green-700 border border-green-200" : "bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100"}`} data-testid="button-addfood-ai-label-photo">
                          <Camera className="w-4 h-4" />
                          {aiLabelPhotoFile ? <span className="truncate max-w-[180px]">{aiLabelPhotoFile.name}</span> : "Photograph nutrition label"}
                        </button>
                        {aiLabelPhotoFile && <button type="button" onClick={() => setAiLabelPhotoFile(null)} className="text-[10px] text-zinc-400 hover:text-zinc-600 text-center w-full">Remove photo</button>}
                        <button type="button" onClick={handleAiLabelScan} disabled={aiLoading || !aiLabelPhotoFile} className="w-full py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid="button-addfood-ai-read-label">
                          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                          {aiLoading ? "Reading label..." : "Read nutrition label"}
                        </button>
                        <input ref={aiLabelPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAiLabelPhotoFile(f); e.target.value = ""; }} />
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "manual" && (
              <div className="space-y-4">
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
                <button
                  onClick={saveManual}
                  disabled={!manualValid || saveMutation.isPending}
                  className="w-full py-3 bg-zinc-900 text-white text-sm font-semibold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="button-add-food-save"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Food"}
                </button>
              </div>
            )}
          </div>
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
type PickerTab = "myfoods" | "search" | "scan" | "ai";
interface Ingredient {
  key: string;
  name: string;
  calories100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  grams: number;
}

function ingredientFromSaved(f: UserSavedFood): Ingredient {
  return { key: `saved-${f.id}`, name: f.name, calories100g: f.calories100g, protein100g: Number(f.protein100g), carbs100g: Number(f.carbs100g), fat100g: Number(f.fat100g), grams: f.servingGrams };
}
function ingredientFromSearch(f: FoodResult | ExtendedFoodResult): Ingredient {
  return { key: `search-${f.id}-${Date.now()}`, name: f.name, calories100g: f.calories100g, protein100g: f.protein100g, carbs100g: f.carbs100g, fat100g: f.fat100g, grams: 100 };
}

function CreateMealModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"pick" | "details">("pick");
  const [showAddFood, setShowAddFood] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>("search");

  const { data: myFoods = [] } = useQuery<UserSavedFood[]>({ queryKey: ["/api/my-foods"] });

  const [selected, setSelected] = useState<Ingredient[]>([]);

  const [mealName, setMealName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [mealSlot, setMealSlot] = useState<MealSlot>("dinner");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [scannerError, setScannerError] = useState(false);
  const [scanLookingUp, setScanLookingUp] = useState(false);
  const [scannedFood, setScannedFood] = useState<ExtendedFoodResult | null>(null);
  const [scanServingGrams, setScanServingGrams] = useState("100");
  const [scanKey, setScanKey] = useState(0);
  const zxingModuleRef = useRef<typeof import("@zxing/browser") | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);

  const [aiMode, setAiMode] = useState<"describe" | "label">("describe");
  const [aiDescription, setAiDescription] = useState("");
  const [aiPhotoFile, setAiPhotoFile] = useState<File | null>(null);
  const [aiResult, setAiResult] = useState<ExtendedFoodResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiServingGrams, setAiServingGrams] = useState("100");
  const [aiProductName, setAiProductName] = useState("");
  const [aiLabelPhotoFile, setAiLabelPhotoFile] = useState<File | null>(null);
  const aiPhotoRef = useRef<HTMLInputElement>(null);
  const aiLabelPhotoRef = useRef<HTMLInputElement>(null);

  const { data: labelScanAvailability } = useQuery<{ available: boolean }>({ queryKey: ["/api/food-log/label-scan-available"], staleTime: Infinity });
  const labelScanAvailable = labelScanAvailability?.available ?? false;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    import("@zxing/browser").then(mod => { zxingModuleRef.current = mod; }).catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== "pick" || pickerTab !== "scan" || scannedFood) {
      scanControlsRef.current?.stop();
      scanControlsRef.current = null;
      return;
    }
    let cancelled = false;
    setScannerError(false);
    setScanLookingUp(false);
    (async () => {
      try {
        const mod = zxingModuleRef.current ?? await import("@zxing/browser");
        if (!zxingModuleRef.current) zxingModuleRef.current = mod;
        const { BrowserMultiFormatReader } = mod;
        if (cancelled || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, async (result) => {
          if (!result || cancelled) return;
          cancelled = true;
          controls.stop();
          scanControlsRef.current = null;
          const barcode = result.getText();
          setScanLookingUp(true);
          try {
            const res = await fetch(`/api/barcode/${encodeURIComponent(barcode)}`);
            if (res.ok) {
              const food: ExtendedFoodResult = await res.json();
              setScannedFood(food);
              setScanServingGrams(String(food.servingGrams || 100));
            } else {
              toast({ title: "Barcode not found", description: "This product isn't in any database yet. Try the Search or AI tab.", variant: "destructive" });
              setScanKey(k => k + 1);
            }
          } catch {
            toast({ title: "Barcode lookup failed", variant: "destructive" });
            setScanKey(k => k + 1);
          }
          setScanLookingUp(false);
        });
        if (!cancelled) scanControlsRef.current = controls;
      } catch {
        if (!cancelled) setScannerError(true);
      }
    })();
    return () => { cancelled = true; scanControlsRef.current?.stop(); scanControlsRef.current = null; };
  }, [step, pickerTab, scanKey, scannedFood]);

  const { data: foodResults = [], isLoading: searchLoading } = useQuery<FoodResult[]>({
    queryKey: ["/api/food-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: step === "pick" && pickerTab === "search" && debouncedQuery.length >= 2,
    staleTime: 60_000,
  });

  function addIngredient(ing: Ingredient) {
    setSelected(prev => [...prev, ing]);
    toast({ title: `${ing.name} added` });
  }

  function removeIngredient(key: string) {
    setSelected(prev => prev.filter(s => s.key !== key));
  }

  function updateGrams(key: string, grams: number) {
    setSelected(prev => prev.map(s => s.key === key ? { ...s, grams: Math.max(1, grams) } : s));
  }

  function toggleSavedFood(food: UserSavedFood) {
    const existingKey = `saved-${food.id}`;
    const exists = selected.find(s => s.key === existingKey);
    if (exists) {
      setSelected(prev => prev.filter(s => s.key !== existingKey));
    } else {
      setSelected(prev => [...prev, ingredientFromSaved(food)]);
    }
  }

  async function handleAiEstimate() {
    if (!aiDescription.trim() && !aiPhotoFile) return;
    setAiLoading(true);
    try {
      const body: { imageBase64?: string; description?: string } = {};
      if (aiPhotoFile) {
        body.imageBase64 = await fileToBase64(aiPhotoFile);
      }
      if (aiDescription.trim()) body.description = aiDescription.trim();
      const res = await apiRequest("POST", "/api/food-log/recognize-food", body);
      const food: ExtendedFoodResult = await res.json();
      setAiResult(food);
      setAiServingGrams(String(food.servingGrams || 100));
    } catch {
      toast({ title: "Could not identify food", description: "Try a more detailed description.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAiLabelScan() {
    if (!aiLabelPhotoFile) return;
    setAiLoading(true);
    try {
      const b64 = await fileToBase64(aiLabelPhotoFile);
      const res = await apiRequest("POST", "/api/food-log/extract-label", { imageBase64: b64 });
      const food: ExtendedFoodResult = await res.json();
      if (aiProductName.trim()) food.name = aiProductName.trim();
      setAiResult(food);
      setAiServingGrams(String(food.servingGrams || 100));
    } catch {
      toast({ title: "Could not read label", description: "Try a clearer photo of the nutrition panel.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  const totals = selected.reduce((acc, ing) => {
    const factor = ing.grams / 100;
    return {
      cal: acc.cal + Math.round(ing.calories100g * factor),
      prot: acc.prot + Math.round(ing.protein100g * factor),
      carbs: acc.carbs + Math.round(ing.carbs100g * factor),
      fat: acc.fat + Math.round(ing.fat100g * factor),
    };
  }, { cal: 0, prot: 0, carbs: 0, fat: 0 });

  const saveMutation = useMutation({
    mutationFn: () => {
      const ingredientLines = selected.map(s => `${s.grams}g ${s.name}`).join("\n");
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

  const pickerTabs: { id: PickerTab; label: string; icon: typeof Search }[] = [
    { id: "search", label: "Search", icon: Search },
    { id: "scan", label: "Barcode", icon: Barcode },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "myfoods", label: "My Foods", icon: Wheat },
  ];

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
            <div className="px-6 py-4 space-y-3">
              <div className="flex bg-zinc-100 p-1 rounded-xl">
                {pickerTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setPickerTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold transition-colors rounded-lg ${pickerTab === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                    data-testid={`button-picker-tab-${tab.id}`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {pickerTab === "search" && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search foods, brands..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-8 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
                      data-testid="input-create-food-search"
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => { setSearchQuery(""); setDebouncedQuery(""); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {searchLoading && debouncedQuery.length >= 2 && (
                    <div className="flex items-center justify-center gap-2 py-6 text-zinc-400">
                      <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Searching...</span>
                    </div>
                  )}
                  {!searchLoading && debouncedQuery.length >= 2 && foodResults.length === 0 && (
                    <div className="text-center py-6 text-zinc-400">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No results for "{debouncedQuery}"</p>
                      {labelScanAvailable && (
                        <button type="button" onClick={() => { setAiResult(null); setAiDescription(debouncedQuery); setAiPhotoFile(null); setAiMode("describe"); setPickerTab("ai"); }} className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 font-medium hover:text-violet-800" data-testid="button-search-try-ai">
                          <Sparkles className="w-3 h-3" />Try AI estimate instead
                        </button>
                      )}
                    </div>
                  )}
                  {!searchLoading && debouncedQuery.length < 2 && !searchQuery && (
                    <div className="text-center py-6 text-zinc-300">
                      <Search className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Start typing to search 3M+ foods</p>
                    </div>
                  )}
                  {foodResults.length > 0 && (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto" data-testid="create-food-search-results">
                      {foodResults.map(food => (
                        <button
                          key={food.id}
                          type="button"
                          onClick={() => addIngredient(ingredientFromSearch(food))}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-100 transition-colors text-left"
                          data-testid={`button-search-add-${food.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-900 truncate">{food.name}</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">P:{food.protein100g}g · C:{food.carbs100g}g · F:{food.fat100g}g per 100g</p>
                          </div>
                          <div className="ml-3 shrink-0 flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-xs font-bold text-zinc-900">{food.calories100g}</p>
                              <p className="text-[10px] text-zinc-400">kcal/100g</p>
                            </div>
                            <Plus className="w-4 h-4 text-zinc-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {pickerTab === "scan" && (
                <div className="space-y-3">
                  {scannedFood ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 leading-snug" data-testid="text-create-scan-product">{scannedFood.name}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {(scannedFood as ExtendedFoodResult).source === "community" ? "Community database" :
                             (scannedFood as ExtendedFoodResult).source === "open_food_facts" ? "Open Food Facts" : "USDA database"}
                          </p>
                        </div>
                        <button type="button" onClick={() => { setScannedFood(null); setScanKey(k => k + 1); }} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors shrink-0" data-testid="button-create-scan-reset">
                          <X className="w-4 h-4 text-zinc-400" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-50 rounded-xl p-2.5">
                        <label className="text-[10px] text-zinc-500 font-medium shrink-0">Serving (g)</label>
                        <input type="number" min={1} value={scanServingGrams} onChange={e => setScanServingGrams(e.target.value)} className="w-20 text-sm font-semibold text-zinc-900 bg-transparent border-none outline-none text-right" data-testid="input-create-scan-serving" />
                      </div>
                      {(() => {
                        const f = (parseFloat(scanServingGrams) || 0) / 100;
                        return (
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { label: "kcal", value: Math.round(scannedFood.calories100g * f), color: "bg-orange-50 text-orange-700" },
                              { label: "protein", value: Math.round(scannedFood.protein100g * f), color: "bg-red-50 text-red-700" },
                              { label: "carbs", value: Math.round(scannedFood.carbs100g * f), color: "bg-blue-50 text-blue-700" },
                              { label: "fat", value: Math.round(scannedFood.fat100g * f), color: "bg-yellow-50 text-yellow-700" },
                            ].map(({ label, value, color }) => (
                              <div key={label} className={`${color} rounded-lg p-1.5 text-center`}>
                                <p className="text-sm font-bold">{value}</p>
                                <p className="text-[9px] font-medium uppercase tracking-wide opacity-70">{label}</p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => {
                          const grams = parseInt(scanServingGrams) || 100;
                          addIngredient({ ...ingredientFromSearch(scannedFood), grams });
                          setScannedFood(null);
                          setScanKey(k => k + 1);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors"
                        data-testid="button-create-scan-add"
                      >
                        <Plus className="w-4 h-4" />Add to meal
                      </button>
                    </div>
                  ) : scannerError ? (
                    <div className="text-center py-8">
                      <Barcode className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
                      <p className="text-sm font-medium text-zinc-600">Camera not available</p>
                      <p className="text-xs text-zinc-400 mt-1">Allow camera access or try the Search tab.</p>
                    </div>
                  ) : (
                    <>
                      <div className="relative overflow-hidden rounded-2xl bg-zinc-900 aspect-[4/3]">
                        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted data-testid="video-create-barcode-scanner" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="absolute inset-0 bg-black/30" />
                          <div className="relative w-56 h-28 z-10">
                            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl" />
                            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr" />
                            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl" />
                            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white rounded-br" />
                            {!scanLookingUp && (
                              <div className="absolute inset-x-2 h-0.5 bg-white/70 top-1/2 -translate-y-1/2 animate-pulse" />
                            )}
                          </div>
                        </div>
                        {scanLookingUp && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
                            <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                            <p className="text-white text-xs font-medium">Looking up product...</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 text-center">Point camera at a barcode — it will scan automatically</p>
                    </>
                  )}
                </div>
              )}

              {pickerTab === "ai" && (
                <div className="space-y-3">
                  {!aiResult ? (
                    <>
                      {labelScanAvailable && (
                        <div className="flex bg-zinc-100 p-0.5 rounded-xl">
                          <button type="button" onClick={() => setAiMode("describe")} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${aiMode === "describe" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`} data-testid="button-create-ai-mode-describe">
                            <Sparkles className="w-3 h-3" />Describe
                          </button>
                          <button type="button" onClick={() => setAiMode("label")} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${aiMode === "label" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`} data-testid="button-create-ai-mode-label">
                            <Camera className="w-3 h-3" />Label Scan
                          </button>
                        </div>
                      )}
                      {aiMode === "describe" || !labelScanAvailable ? (
                        <>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-medium mb-1.5">What food are you adding?</p>
                            <input type="text" placeholder="e.g. chicken breast, 200g" value={aiDescription} onChange={e => setAiDescription(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAiEstimate(); } }} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white" data-testid="input-create-ai-description" />
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => aiPhotoRef.current?.click()} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${aiPhotoFile ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"}`} data-testid="button-create-ai-photo">
                              <Camera className="w-3.5 h-3.5" />
                              {aiPhotoFile ? <span className="truncate max-w-[120px]">{aiPhotoFile.name}</span> : "Add photo (optional)"}
                            </button>
                            {aiPhotoFile && <button type="button" onClick={() => setAiPhotoFile(null)} className="text-[10px] text-zinc-400 hover:text-zinc-600">Remove</button>}
                          </div>
                          <button type="button" onClick={handleAiEstimate} disabled={aiLoading || (!aiDescription.trim() && !aiPhotoFile)} className="w-full py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid="button-create-ai-estimate">
                            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {aiLoading ? "Estimating..." : "Estimate macros"}
                          </button>
                          <input ref={aiPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAiPhotoFile(f); e.target.value = ""; }} />
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-medium mb-1.5">Product name (optional)</p>
                            <input type="text" placeholder="e.g. Fage Total 0%" value={aiProductName} onChange={e => setAiProductName(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white" data-testid="input-create-ai-product-name" />
                          </div>
                          <button type="button" onClick={() => aiLabelPhotoRef.current?.click()} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${aiLabelPhotoFile ? "bg-green-50 text-green-700 border border-green-200" : "bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100"}`} data-testid="button-create-ai-label-photo">
                            <Camera className="w-4 h-4" />
                            {aiLabelPhotoFile ? <span className="truncate max-w-[180px]">{aiLabelPhotoFile.name}</span> : "Photograph nutrition label"}
                          </button>
                          {aiLabelPhotoFile && <button type="button" onClick={() => setAiLabelPhotoFile(null)} className="text-[10px] text-zinc-400 hover:text-zinc-600 text-center w-full">Remove photo</button>}
                          <button type="button" onClick={handleAiLabelScan} disabled={aiLoading || !aiLabelPhotoFile} className="w-full py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid="button-create-ai-read-label">
                            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                            {aiLoading ? "Reading label..." : "Read nutrition label"}
                          </button>
                          <input ref={aiLabelPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAiLabelPhotoFile(f); e.target.value = ""; }} />
                        </>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 leading-snug" data-testid="text-create-ai-food-name">{aiResult.name}</p>
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-violet-50 border border-violet-200 rounded-full text-[9px] font-medium text-violet-700">
                            <Sparkles className="w-2.5 h-2.5" />AI-estimated
                          </span>
                        </div>
                        <button type="button" onClick={() => { setAiResult(null); setAiDescription(""); setAiPhotoFile(null); setAiLabelPhotoFile(null); }} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors shrink-0" data-testid="button-create-ai-reset">
                          <X className="w-4 h-4 text-zinc-400" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-50 rounded-xl p-2.5">
                        <label className="text-[10px] text-zinc-500 font-medium shrink-0">Serving (g)</label>
                        <input type="number" min={1} value={aiServingGrams} onChange={e => setAiServingGrams(e.target.value)} className="w-20 text-sm font-semibold text-zinc-900 bg-transparent border-none outline-none text-right" data-testid="input-create-ai-serving" />
                      </div>
                      {(() => {
                        const f = (parseFloat(aiServingGrams) || 0) / 100;
                        return (
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { label: "kcal", value: Math.round(aiResult.calories100g * f), color: "bg-orange-50 text-orange-700" },
                              { label: "protein", value: Math.round(aiResult.protein100g * f), color: "bg-red-50 text-red-700" },
                              { label: "carbs", value: Math.round(aiResult.carbs100g * f), color: "bg-blue-50 text-blue-700" },
                              { label: "fat", value: Math.round(aiResult.fat100g * f), color: "bg-yellow-50 text-yellow-700" },
                            ].map(({ label, value, color }) => (
                              <div key={label} className={`${color} rounded-lg p-1.5 text-center`}>
                                <p className="text-sm font-bold">{value}</p>
                                <p className="text-[9px] font-medium uppercase tracking-wide opacity-70">{label}</p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => {
                          const grams = parseInt(aiServingGrams) || 100;
                          addIngredient({ ...ingredientFromSearch(aiResult), grams });
                          setAiResult(null);
                          setAiDescription("");
                          setAiPhotoFile(null);
                          setAiLabelPhotoFile(null);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors"
                        data-testid="button-create-ai-add"
                      >
                        <Plus className="w-4 h-4" />Add to meal
                      </button>
                    </div>
                  )}
                </div>
              )}

              {pickerTab === "myfoods" && (
                <div className="space-y-2">
                  {myFoods.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Wheat className="w-5 h-5 text-zinc-300" />
                      </div>
                      <p className="text-sm font-medium text-zinc-500 mb-1">No foods saved yet</p>
                      <p className="text-xs text-zinc-400 mb-4">Add foods to My Foods first, then you can pick them here.</p>
                    </div>
                  ) : (
                    myFoods.map(food => {
                      const isSelected = selected.some(s => s.key === `saved-${food.id}`);
                      const sel = selected.find(s => s.key === `saved-${food.id}`);
                      return (
                        <div key={food.id} className={`rounded-xl border transition-all ${isSelected ? "border-zinc-900 bg-zinc-50" : "border-zinc-100 bg-white"}`}>
                          <button
                            className="w-full flex items-center gap-3 p-3 text-left"
                            onClick={() => toggleSavedFood(food)}
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
                          {isSelected && sel && (
                            <div className="px-3 pb-3 flex items-center gap-2">
                              <label className="text-xs text-zinc-500 shrink-0">Serving (g):</label>
                              <input
                                type="number"
                                value={sel.grams}
                                min={1}
                                onChange={e => updateGrams(sel.key, parseInt(e.target.value) || 1)}
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
                    })
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

              {selected.length > 0 && (
                <div className="bg-zinc-50 rounded-2xl p-3 space-y-2">
                  <p className="text-xs font-medium text-zinc-500">Ingredients ({selected.length})</p>
                  {selected.map(ing => (
                    <div key={ing.key} className="flex items-center gap-2 text-xs">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-zinc-700 truncate">{ing.name}</span>
                      </div>
                      <input
                        type="number"
                        value={ing.grams}
                        min={1}
                        onChange={e => updateGrams(ing.key, parseInt(e.target.value) || 1)}
                        className="w-16 text-xs border border-zinc-200 rounded-lg px-1.5 py-1 text-center focus:outline-none focus:ring-1 focus:ring-zinc-300"
                        data-testid={`input-ing-grams-${ing.key}`}
                      />
                      <span className="text-zinc-400 text-[10px] shrink-0">g · {Math.round(ing.calories100g * ing.grams / 100)} kcal</span>
                      <button type="button" onClick={() => removeIngredient(ing.key)} className="text-zinc-300 hover:text-red-500 shrink-0" data-testid={`button-remove-ing-${ing.key}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <MacroChips cal={totals.cal} p={totals.prot} c={totals.carbs} f={totals.fat} />
                </div>
              )}
            </div>
          )}

          {step === "details" && (
            <div className="px-6 py-5 space-y-4">
              {selected.length > 0 && (
                <div className="bg-zinc-50 rounded-2xl p-4">
                  <p className="text-xs font-medium text-zinc-500 mb-2">Selected foods</p>
                  <div className="space-y-1 mb-3">
                    {selected.map(s => (
                      <div key={s.key} className="flex items-center justify-between text-xs text-zinc-600">
                        <span>{s.name}</span>
                        <span>{s.grams}g · {Math.round(s.calories100g * s.grams / 100)} kcal</span>
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
            setSelected(prev => [...prev, ingredientFromSaved(food)]);
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
  const [showCommunityBrowser, setShowCommunityBrowser] = useState(false);
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
                onClick={() => setShowCommunityBrowser(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
                data-testid="button-browse-community"
              >
                <Users2 className="w-3.5 h-3.5" />Community
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
    </div>
  );
}
