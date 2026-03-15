import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  X, Loader2, Pencil, Camera, Check, Search, Barcode, Sparkles,
} from "lucide-react";
import type { UserSavedFood } from "@shared/schema";
import type { FoodResult, ExtendedFoodResult } from "@/components/food-log-shared";
import { type AddFoodTab, fileToBase64 } from "@/components/meals-food-shared";

function ConfirmPanel({ food, servGrams, setServGrams, onSave, onReset, testPrefix, saving }: {
  food: FoodResult | ExtendedFoodResult;
  servGrams: string;
  setServGrams: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
  testPrefix: string;
  saving: boolean;
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
        disabled={saving}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50"
        data-testid={`button-${testPrefix}-save`}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save to My Foods</>}
      </button>
    </div>
  );
}

export function AddFoodModal({ onClose, onSaved }: { onClose: () => void; onSaved: (food: UserSavedFood) => void }) {
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
                    saving={saveMutation.isPending}
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
                    saving={saveMutation.isPending}
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
                    saving={saveMutation.isPending}
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
