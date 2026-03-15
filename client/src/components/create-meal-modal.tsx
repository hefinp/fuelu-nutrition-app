import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, X, Loader2, Camera, ArrowLeft,
  Check, Search, Barcode, Sparkles, Wheat, UtensilsCrossed,
} from "lucide-react";
import type { UserSavedFood } from "@shared/schema";
import type { FoodResult, ExtendedFoodResult } from "@/components/food-log-shared";
import {
  type MealSlot, type PickerTab, type Ingredient,
  SLOT_OPTIONS, MacroChips, fileToBase64,
  ingredientFromSaved, ingredientFromSearch,
} from "@/components/meals-food-shared";
import { AddFoodModal } from "@/components/add-food-modal";

export function CreateMealModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
