import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  X, Loader2, Camera, Plus, Search, Barcode, Sparkles, BadgeCheck,
} from "lucide-react";
import type { FoodResult, ExtendedFoodResult } from "@/components/food-log-shared";
import { fileToBase64 } from "@/components/meals-food-shared";

export interface FoodPickerState {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  debouncedQuery: string;
  setDebouncedQuery: (v: string) => void;
  foodResults: FoodResult[];
  searchLoading: boolean;

  scannerError: boolean;
  scanLookingUp: boolean;
  scannedFood: ExtendedFoodResult | null;
  setScannedFood: (f: ExtendedFoodResult | null) => void;
  scanServingGrams: string;
  setScanServingGrams: (v: string) => void;
  scanKey: number;
  setScanKey: React.Dispatch<React.SetStateAction<number>>;
  videoRef: React.RefObject<HTMLVideoElement>;

  aiMode: "describe" | "label";
  setAiMode: (m: "describe" | "label") => void;
  aiDescription: string;
  setAiDescription: (v: string) => void;
  aiPhotoFile: File | null;
  setAiPhotoFile: (f: File | null) => void;
  aiResult: ExtendedFoodResult | null;
  setAiResult: (f: ExtendedFoodResult | null) => void;
  aiLoading: boolean;
  aiServingGrams: string;
  setAiServingGrams: (v: string) => void;
  aiProductName: string;
  setAiProductName: (v: string) => void;
  aiLabelPhotoFile: File | null;
  setAiLabelPhotoFile: (f: File | null) => void;
  aiPhotoRef: React.RefObject<HTMLInputElement>;
  aiLabelPhotoRef: React.RefObject<HTMLInputElement>;
  labelScanAvailable: boolean;

  handleAiEstimate: () => Promise<void>;
  handleAiLabelScan: () => Promise<void>;
  resetAi: () => void;
  resetScan: () => void;
}

export function useFoodPicker(opts: {
  activeTab: string;
  scanActive: boolean;
}): FoodPickerState {
  const { toast } = useToast();

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

  const { data: labelScanAvailability } = useQuery<{ available: boolean }>({
    queryKey: ["/api/food-log/label-scan-available"],
    staleTime: Infinity,
  });
  const labelScanAvailable = labelScanAvailability?.available ?? false;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    import("@zxing/browser").then(mod => { zxingModuleRef.current = mod; }).catch(() => {});
  }, []);

  useEffect(() => {
    if (opts.activeTab !== "scan" || !opts.scanActive || scannedFood) {
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
  }, [opts.activeTab, opts.scanActive, scanKey, scannedFood]);

  const { data: foodResults = [], isLoading: searchLoading } = useQuery<FoodResult[]>({
    queryKey: ["/api/food-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: opts.activeTab === "search" && debouncedQuery.length >= 2,
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

  function resetAi() {
    setAiResult(null);
    setAiDescription("");
    setAiPhotoFile(null);
    setAiLabelPhotoFile(null);
  }

  function resetScan() {
    setScannedFood(null);
    setScanKey(k => k + 1);
  }

  return {
    searchQuery, setSearchQuery, debouncedQuery, setDebouncedQuery,
    foodResults, searchLoading,
    scannerError, scanLookingUp, scannedFood, setScannedFood,
    scanServingGrams, setScanServingGrams, scanKey, setScanKey, videoRef,
    aiMode, setAiMode, aiDescription, setAiDescription, aiPhotoFile, setAiPhotoFile,
    aiResult, setAiResult, aiLoading, aiServingGrams, setAiServingGrams,
    aiProductName, setAiProductName, aiLabelPhotoFile, setAiLabelPhotoFile,
    aiPhotoRef, aiLabelPhotoRef, labelScanAvailable,
    handleAiEstimate, handleAiLabelScan, resetAi, resetScan,
  };
}

export function MacroGrid({ food, servingGrams }: { food: FoodResult | ExtendedFoodResult; servingGrams: string }) {
  const f = (parseFloat(servingGrams) || 0) / 100;
  return (
    <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
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
  );
}

export function FoodResultCard({ food, onSelect, testId }: {
  food: FoodResult;
  onSelect: (f: FoodResult) => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(food)}
      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-100 transition-colors text-left"
      data-testid={testId}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-xs font-medium text-zinc-900 truncate">{food.name}</p>
          {food.verified && (
            <BadgeCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" data-testid={`badge-verified-${food.id}`} />
          )}
          {(food.source === "nzfcd" || food.source === "fsanz") && (
            <span
              className="shrink-0 inline-flex items-center px-1 py-0 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
              data-testid={`badge-region-${food.id}`}
            >
              {food.source === "nzfcd" ? "NZ" : "AU"}
            </span>
          )}
        </div>
        <p className="text-[10px] text-zinc-400 mt-0.5">P:{food.protein100g}g · C:{food.carbs100g}g · F:{food.fat100g}g per 100g</p>
      </div>
      <div className="ml-3 shrink-0 text-right">
        <p className="text-xs font-bold text-zinc-900">{food.calories100g}</p>
        <p className="text-[10px] text-zinc-400">kcal/100g</p>
      </div>
    </button>
  );
}

export function SearchPanel({ picker, onSelectFood, testPrefix, showTryAi, onSwitchToAi, extraButton }: {
  picker: FoodPickerState;
  onSelectFood: (food: FoodResult) => void;
  testPrefix: string;
  showTryAi?: boolean;
  onSwitchToAi?: () => void;
  extraButton?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          autoFocus
          placeholder="Search foods, brands..."
          value={picker.searchQuery}
          onChange={e => picker.setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-8 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
          data-testid={`input-${testPrefix}-search`}
        />
        {picker.searchQuery && (
          <button type="button" onClick={() => { picker.setSearchQuery(""); picker.setDebouncedQuery(""); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {picker.searchLoading && picker.debouncedQuery.length >= 2 && (
        <div className="flex items-center justify-center gap-2 py-6 text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Searching...</span>
        </div>
      )}
      {!picker.searchLoading && picker.debouncedQuery.length >= 2 && picker.foodResults.length === 0 && (
        <div className="text-center py-6 text-zinc-400">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No results for "{picker.debouncedQuery}"</p>
          {showTryAi !== false && picker.labelScanAvailable && onSwitchToAi && (
            <button type="button" onClick={onSwitchToAi} className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 font-medium hover:text-violet-800" data-testid={`button-${testPrefix}-try-ai`}>
              <Sparkles className="w-3 h-3" />Try AI estimate instead
            </button>
          )}
        </div>
      )}
      {!picker.searchLoading && picker.debouncedQuery.length < 2 && !picker.searchQuery && (
        <div className="text-center py-6 text-zinc-300">
          <Search className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Start typing to search 3M+ foods</p>
        </div>
      )}
      {picker.foodResults.length > 0 && (
        <div className="space-y-1.5 max-h-52 overflow-y-auto" data-testid={`${testPrefix}-search-results`}>
          {picker.foodResults.map(food => (
            <FoodResultCard
              key={food.id}
              food={food}
              onSelect={onSelectFood}
              testId={`button-${testPrefix}-result-${food.id}`}
            />
          ))}
        </div>
      )}
      {extraButton}
    </div>
  );
}

export function ScannerView({ picker, testPrefix }: { picker: FoodPickerState; testPrefix: string }) {
  if (picker.scannerError) {
    return (
      <div className="text-center py-8">
        <Barcode className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-600">Camera not available</p>
        <p className="text-xs text-zinc-400 mt-1">Allow camera access or try the Search tab.</p>
      </div>
    );
  }
  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900 aspect-[4/3]">
        <video ref={picker.videoRef} className="w-full h-full object-cover" playsInline muted data-testid={`video-${testPrefix}-barcode-scanner`} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-56 h-28 z-10">
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white rounded-br" />
            {!picker.scanLookingUp && (
              <div className="absolute inset-x-2 h-0.5 bg-white/70 top-1/2 -translate-y-1/2 animate-pulse" />
            )}
          </div>
        </div>
        {picker.scanLookingUp && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
            <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
            <p className="text-white text-xs font-medium">Looking up product...</p>
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-400 text-center">Point camera at a barcode — it will scan automatically</p>
    </>
  );
}

export function ScannedFoodPanel({ picker, testPrefix, actionLabel, actionIcon, onAction }: {
  picker: FoodPickerState;
  testPrefix: string;
  actionLabel: string;
  actionIcon?: React.ReactNode;
  onAction: (food: ExtendedFoodResult, grams: number) => void;
}) {
  if (!picker.scannedFood) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 leading-snug" data-testid={`text-${testPrefix}-scan-product`}>{picker.scannedFood.name}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            {(picker.scannedFood.source === "community" || picker.scannedFood.source === "canonical") ? "FuelU database" :
             picker.scannedFood.source === "open_food_facts" ? "Open Food Facts" : "USDA database"}
          </p>
        </div>
        <button type="button" onClick={picker.resetScan} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors shrink-0" data-testid={`button-${testPrefix}-scan-reset`}>
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>
      <div className="flex items-center gap-2 bg-zinc-50 rounded-xl p-2.5">
        <label className="text-[10px] text-zinc-500 font-medium shrink-0">Serving (g)</label>
        <input type="number" min={1} value={picker.scanServingGrams} onChange={e => picker.setScanServingGrams(e.target.value)} className="w-20 text-sm font-semibold text-zinc-900 bg-transparent border-none outline-none text-right" data-testid={`input-${testPrefix}-scan-serving`} />
      </div>
      <MacroGrid food={picker.scannedFood} servingGrams={picker.scanServingGrams} />
      <button
        type="button"
        onClick={() => onAction(picker.scannedFood!, parseInt(picker.scanServingGrams) || 100)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors"
        data-testid={`button-${testPrefix}-scan-action`}
      >
        {actionIcon || <Plus className="w-4 h-4" />}{actionLabel}
      </button>
    </div>
  );
}

export function AiPanel({ picker, testPrefix, actionLabel, actionIcon, onAction, saving }: {
  picker: FoodPickerState;
  testPrefix: string;
  actionLabel: string;
  actionIcon?: React.ReactNode;
  onAction: (food: ExtendedFoodResult, grams: number) => void;
  saving?: boolean;
}) {
  if (picker.aiResult) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 leading-snug" data-testid={`text-${testPrefix}-ai-food-name`}>{picker.aiResult.name}</p>
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-violet-50 border border-violet-200 rounded-full text-[9px] font-medium text-violet-700">
              <Sparkles className="w-2.5 h-2.5" />AI-estimated
            </span>
          </div>
          <button type="button" onClick={picker.resetAi} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors shrink-0" data-testid={`button-${testPrefix}-ai-reset`}>
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="flex items-center gap-2 bg-zinc-50 rounded-xl p-2.5">
          <label className="text-[10px] text-zinc-500 font-medium shrink-0">Serving (g)</label>
          <input type="number" min={1} value={picker.aiServingGrams} onChange={e => picker.setAiServingGrams(e.target.value)} className="w-20 text-sm font-semibold text-zinc-900 bg-transparent border-none outline-none text-right" data-testid={`input-${testPrefix}-ai-serving`} />
        </div>
        <MacroGrid food={picker.aiResult} servingGrams={picker.aiServingGrams} />
        <button
          type="button"
          onClick={() => onAction(picker.aiResult!, parseInt(picker.aiServingGrams) || 100)}
          disabled={saving}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50"
          data-testid={`button-${testPrefix}-ai-action`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{actionIcon || <Plus className="w-4 h-4" />}{actionLabel}</>}
        </button>
      </div>
    );
  }

  return (
    <>
      {picker.labelScanAvailable && (
        <div className="flex bg-zinc-100 p-0.5 rounded-xl">
          <button type="button" onClick={() => picker.setAiMode("describe")} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${picker.aiMode === "describe" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`} data-testid={`button-${testPrefix}-ai-mode-describe`}>
            <Sparkles className="w-3 h-3" />Describe
          </button>
          <button type="button" onClick={() => picker.setAiMode("label")} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${picker.aiMode === "label" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`} data-testid={`button-${testPrefix}-ai-mode-label`}>
            <Camera className="w-3 h-3" />Label Scan
          </button>
        </div>
      )}
      {picker.aiMode === "describe" || !picker.labelScanAvailable ? (
        <>
          <div>
            <p className="text-[10px] text-zinc-500 font-medium mb-1.5">What food are you adding?</p>
            <input type="text" placeholder="e.g. chicken breast, 200g" value={picker.aiDescription} onChange={e => picker.setAiDescription(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); picker.handleAiEstimate(); } }} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white" data-testid={`input-${testPrefix}-ai-description`} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => picker.aiPhotoRef.current?.click()} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${picker.aiPhotoFile ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"}`} data-testid={`button-${testPrefix}-ai-photo`}>
              <Camera className="w-3.5 h-3.5" />
              {picker.aiPhotoFile ? <span className="truncate max-w-[120px]">{picker.aiPhotoFile.name}</span> : "Add photo (optional)"}
            </button>
            {picker.aiPhotoFile && <button type="button" onClick={() => picker.setAiPhotoFile(null)} className="text-[10px] text-zinc-400 hover:text-zinc-600">Remove</button>}
          </div>
          <button type="button" onClick={picker.handleAiEstimate} disabled={picker.aiLoading || (!picker.aiDescription.trim() && !picker.aiPhotoFile)} className="w-full py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid={`button-${testPrefix}-ai-estimate`}>
            {picker.aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {picker.aiLoading ? "Estimating..." : "Estimate macros"}
          </button>
          <input ref={picker.aiPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) picker.setAiPhotoFile(f); e.target.value = ""; }} />
        </>
      ) : (
        <>
          <div>
            <p className="text-[10px] text-zinc-500 font-medium mb-1.5">Product name (optional)</p>
            <input type="text" placeholder="e.g. Fage Total 0%" value={picker.aiProductName} onChange={e => picker.setAiProductName(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white" data-testid={`input-${testPrefix}-ai-product-name`} />
          </div>
          <button type="button" onClick={() => picker.aiLabelPhotoRef.current?.click()} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${picker.aiLabelPhotoFile ? "bg-green-50 text-green-700 border border-green-200" : "bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100"}`} data-testid={`button-${testPrefix}-ai-label-photo`}>
            <Camera className="w-4 h-4" />
            {picker.aiLabelPhotoFile ? <span className="truncate max-w-[180px]">{picker.aiLabelPhotoFile.name}</span> : "Photograph nutrition label"}
          </button>
          {picker.aiLabelPhotoFile && <button type="button" onClick={() => picker.setAiLabelPhotoFile(null)} className="text-[10px] text-zinc-400 hover:text-zinc-600 text-center w-full">Remove photo</button>}
          <button type="button" onClick={picker.handleAiLabelScan} disabled={picker.aiLoading || !picker.aiLabelPhotoFile} className="w-full py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid={`button-${testPrefix}-ai-read-label`}>
            {picker.aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            {picker.aiLoading ? "Reading label..." : "Read nutrition label"}
          </button>
          <input ref={picker.aiLabelPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) picker.setAiLabelPhotoFile(f); e.target.value = ""; }} />
        </>
      )}
    </>
  );
}
