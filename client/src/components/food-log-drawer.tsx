import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, X, Check, Barcode, BookOpen, UtensilsCrossed,
  Coffee, Salad, Moon, Apple, Search, Camera, Sparkles, Send, ChevronDown,
} from "lucide-react";
import type { SavedMealPlan } from "@shared/schema";
import {
  type MealSlot, type FoodResult, type ExtendedFoodResult,
  type FoodLogEntry, type PrefillEntry, type PlanMeal,
  SLOT_LABELS, SLOT_ICONS, ALL_SLOTS, WEEK_DAYS, WEEK_SHORT,
  normalizeSlot, extractPlanMeals, todayStr,
} from "@/components/food-log-shared";

interface FoodLogDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedDate: string;
  prefill?: PrefillEntry | null;
  onPrefillConsumed?: () => void;
}

export function FoodLogDrawer({
  open,
  onClose,
  selectedDate,
  prefill,
  onPrefillConsumed,
}: FoodLogDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formTab, setFormTab] = useState<"manual" | "plan" | "search" | "scan" | "ai">("manual");
  const [form, setForm] = useState({
    mealName: "", calories: "", protein: "", carbs: "", fat: "",
    fibre: "", sugar: "", saturatedFat: "",
    mealSlot: null as MealSlot | null,
  });

  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);
  const [selectedWeekDay, setSelectedWeekDay] = useState<string>("monday");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [servingGrams, setServingGrams] = useState("100");

  const [scannerError, setScannerError] = useState(false);
  const [scanLookingUp, setScanLookingUp] = useState(false);
  const [scanResult, setScanResult] = useState<{ type: "found" | "not_found"; barcode: string; name?: string } | null>(null);
  const [saveAsCustomFood, setSaveAsCustomFood] = useState(false);
  const [scannedFood, setScannedFood] = useState<ExtendedFoodResult | null>(null);
  const [scanServingGrams, setScanServingGrams] = useState("100");
  const [scanMealSlot, setScanMealSlot] = useState<MealSlot | null>(null);
  const [showScanAnother, setShowScanAnother] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const scanConfirmModeRef = useRef(false);
  const [showPhotoInterstitial, setShowPhotoInterstitial] = useState(false);
  const [photoLabelLoading, setPhotoLabelLoading] = useState(false);
  const [labelScanBarcode, setLabelScanBarcode] = useState<string>("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [scanMode, setScanMode] = useState<"barcode" | "ai">("barcode");
  const [aiRecognitionLoading, setAiRecognitionLoading] = useState(false);
  const aiPhotoInputRef = useRef<HTMLInputElement>(null);

  const [showAiAssist, setShowAiAssist] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiAssistPhotoFile, setAiAssistPhotoFile] = useState<File | null>(null);
  const aiAssistPhotoRef = useRef<HTMLInputElement>(null);

  const [aiTabMode, setAiTabMode] = useState<"describe" | "label">("describe");
  const [aiTabDescription, setAiTabDescription] = useState("");
  const [aiTabPhotoFile, setAiTabPhotoFile] = useState<File | null>(null);
  const [aiTabResult, setAiTabResult] = useState<ExtendedFoodResult | null>(null);
  const [aiTabLoading, setAiTabLoading] = useState(false);
  const [aiTabServingGrams, setAiTabServingGrams] = useState("100");
  const [aiTabMealSlot, setAiTabMealSlot] = useState<MealSlot | null>(null);
  const aiTabPhotoRef = useRef<HTMLInputElement>(null);
  const [aiTabProductName, setAiTabProductName] = useState("");
  const [aiTabLabelPhotoFile, setAiTabLabelPhotoFile] = useState<File | null>(null);
  const aiTabLabelPhotoRef = useRef<HTMLInputElement>(null);
  const zxingModuleRef = useRef<typeof import("@zxing/browser") | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!open) return;
    if (zxingModuleRef.current) return;
    import("@zxing/browser").then(mod => {
      zxingModuleRef.current = mod;
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open || formTab !== "scan" || scannedFood || showScanAnother || showPhotoInterstitial || scanMode === "ai") {
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
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          async (result) => {
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
                setScanMealSlot(null);
                setSaveAsCustomFood(false);
                setScanResult(null);
              } else {
                setLabelScanBarcode(barcode);
                setShowPhotoInterstitial(true);
              }
            } catch {
              setLabelScanBarcode("");
              setShowPhotoInterstitial(true);
            }
            setScanLookingUp(false);
          }
        );
        if (!cancelled) scanControlsRef.current = controls;
      } catch {
        if (!cancelled) setScannerError(true);
      }
    })();

    return () => {
      cancelled = true;
      scanControlsRef.current?.stop();
      scanControlsRef.current = null;
    };
  }, [open, formTab, scanKey, scannedFood, showScanAnother, showPhotoInterstitial, scanMode]);

  useEffect(() => {
    if (prefill && open) {
      setForm({
        mealName: prefill.mealName,
        calories: String(prefill.calories),
        protein: String(prefill.protein),
        carbs: String(prefill.carbs),
        fat: String(prefill.fat),
        mealSlot: prefill.mealSlot ?? null,
      });
      setFormTab("manual");
      onPrefillConsumed?.();
    }
  }, [prefill, open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const { data: savedPlans = [], isLoading: plansLoading } = useQuery<SavedMealPlan[]>({
    queryKey: ["/api/saved-meal-plans"],
    queryFn: async () => {
      const res = await fetch("/api/saved-meal-plans", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load saved plans");
      return res.json();
    },
    enabled: open && formTab === "plan",
  });

  const { data: foodResults = [], isLoading: searchLoading } = useQuery<FoodResult[]>({
    queryKey: ["/api/food-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && formTab === "search" && debouncedQuery.length >= 2,
    staleTime: 60_000,
  });

  const { data: recentFoods = [] } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log/recent"],
    queryFn: async () => {
      const res = await fetch("/api/food-log/recent", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
    staleTime: 30_000,
  });

  const { data: labelScanAvailability } = useQuery<{ available: boolean }>({
    queryKey: ["/api/food-log/label-scan-available"],
    staleTime: Infinity,
  });
  const labelScanAvailable = labelScanAvailability?.available ?? false;

  const addMutation = useMutation({
    mutationFn: (entry: {
      date: string; mealName: string; calories: number;
      protein: number; carbs: number; fat: number;
      fibre?: number | null; sugar?: number | null; saturatedFat?: number | null;
      mealSlot?: MealSlot | null;
    }) => apiRequest("POST", "/api/food-log", entry).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log/recent"] });
      toast({ title: "Meal logged" });
      if (scanConfirmModeRef.current) {
        scanConfirmModeRef.current = false;
        setScannedFood(null);
        setShowScanAnother(true);
      } else {
        resetFormAndClose();
      }
    },
    onError: () => toast({ title: "Failed to log meal", variant: "destructive" }),
  });

  function resetFormAndClose() {
    setForm({ mealName: "", calories: "", protein: "", carbs: "", fat: "", fibre: "", sugar: "", saturatedFat: "", mealSlot: null });
    setFormTab("manual");
    setScanResult(null);
    setSaveAsCustomFood(false);
    setScannedFood(null);
    setScanMealSlot(null);
    setShowScanAnother(false);
    setScanKey(0);
    setSearchQuery("");
    setDebouncedQuery("");
    setSelectedFood(null);
    setShowAiAssist(false);
    setAiDescription("");
    setAiAssistPhotoFile(null);
    setAiTabResult(null);
    setAiTabDescription("");
    setAiTabPhotoFile(null);
    setAiTabLabelPhotoFile(null);
    setAiTabProductName("");
    setShowPhotoInterstitial(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.mealName.trim()) return;

    if (saveAsCustomFood && scanResult?.type === "not_found" && scanResult.barcode) {
      try {
        await apiRequest("POST", "/api/custom-foods", {
          barcode: scanResult.barcode,
          name: form.mealName.trim(),
          calories100g: parseInt(form.calories) || 0,
          protein100g: parseFloat(form.protein) || 0,
          carbs100g: parseFloat(form.carbs) || 0,
          fat100g: parseFloat(form.fat) || 0,
          servingGrams: 100,
        });
      } catch {}
    }

    addMutation.mutate({
      date: selectedDate,
      mealName: form.mealName.trim(),
      calories: parseInt(form.calories) || 0,
      protein: parseInt(form.protein) || 0,
      carbs: parseInt(form.carbs) || 0,
      fat: parseInt(form.fat) || 0,
      fibre: form.fibre !== "" ? (parseInt(form.fibre) || 0) : null,
      sugar: form.sugar !== "" ? (parseInt(form.sugar) || 0) : null,
      saturatedFat: form.saturatedFat !== "" ? (parseInt(form.saturatedFat) || 0) : null,
      mealSlot: form.mealSlot,
    });
  }

  function prefillFromPlan(m: PlanMeal) {
    setForm({
      mealName: m.meal,
      calories: String(m.calories),
      protein: String(m.protein),
      carbs: String(m.carbs),
      fat: String(m.fat),
      mealSlot: normalizeSlot(m.slot),
    });
    setFormTab("manual");
  }

  async function addWholeDay(meals: PlanMeal[], dayLabel: string) {
    try {
      await Promise.all(
        meals.map(m =>
          apiRequest("POST", "/api/food-log", {
            date: selectedDate,
            mealName: m.meal,
            calories: Number(m.calories),
            protein: Number(m.protein),
            carbs: Number(m.carbs),
            fat: Number(m.fat),
            mealSlot: normalizeSlot(m.slot),
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week"] });
      toast({ title: `${meals.length} meal${meals.length !== 1 ? "s" : ""} added for ${dayLabel}` });
      resetFormAndClose();
    } catch {
      toast({ title: "Failed to log meals", variant: "destructive" });
    }
  }

  function selectFood(food: FoodResult) {
    setSelectedFood(food);
    setServingGrams(String(food.servingGrams));
  }

  function clearSearch() {
    setSearchQuery("");
    setDebouncedQuery("");
    setSelectedFood(null);
    setServingGrams("100");
  }

  function useSelectedFood() {
    if (!selectedFood) return;
    const grams = parseFloat(servingGrams) || 100;
    const factor = grams / 100;
    setForm(f => ({
      ...f,
      mealName: selectedFood.name,
      calories: String(Math.round(selectedFood.calories100g * factor)),
      protein: String(Math.round(selectedFood.protein100g * factor)),
      carbs: String(Math.round(selectedFood.carbs100g * factor)),
      fat: String(Math.round(selectedFood.fat100g * factor)),
    }));
    clearSearch();
    setFormTab("manual");
  }

  function logScannedFood() {
    if (!scannedFood) return;
    const grams = parseFloat(scanServingGrams) || 100;
    const f = grams / 100;
    scanConfirmModeRef.current = true;
    addMutation.mutate({
      date: selectedDate,
      mealName: scannedFood.name,
      calories: Math.round(scannedFood.calories100g * f),
      protein: Math.round(scannedFood.protein100g * f),
      carbs: Math.round(scannedFood.carbs100g * f),
      fat: Math.round(scannedFood.fat100g * f),
      fibre: scannedFood.fibre100g != null ? Math.round(scannedFood.fibre100g * f) : null,
      sugar: scannedFood.sugar100g != null ? Math.round(scannedFood.sugar100g * f) : null,
      saturatedFat: scannedFood.saturatedFat100g != null ? Math.round(scannedFood.saturatedFat100g * f) : null,
      mealSlot: scanMealSlot,
    });
  }

  function resetScanner() {
    setScannedFood(null);
    setShowScanAnother(false);
    setShowPhotoInterstitial(false);
    setLabelScanBarcode("");
    setScanKey(k => k + 1);
  }

  async function handlePhotoCapture(file: File) {
    setPhotoLabelLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiRequest("POST", "/api/food-log/extract-label", { imageBase64: base64 });
      if (!res.ok) throw new Error("scan failed");
      const food: ExtendedFoodResult = await res.json();
      setScannedFood(food);
      setScanServingGrams(String(food.servingGrams || 100));
      setScanMealSlot(null);
      setShowPhotoInterstitial(false);
    } catch {
      toast({ title: "Could not read label", description: "Try entering the food manually.", variant: "destructive" });
      setScanResult({ type: "not_found", barcode: labelScanBarcode });
      setSaveAsCustomFood(true);
      setFormTab("manual");
      setShowPhotoInterstitial(false);
    } finally {
      setPhotoLabelLoading(false);
    }
  }

  async function handleAiRecognitionPhoto(file: File) {
    setAiRecognitionLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiRequest("POST", "/api/food-log/recognize-food", { imageBase64: base64 });
      const food: ExtendedFoodResult = await res.json();
      setScannedFood(food);
      setScanServingGrams(String(food.servingGrams || 100));
      setScanMealSlot(null);
    } catch {
      toast({ title: "Could not identify food", description: "Try taking a clearer photo or enter manually.", variant: "destructive" });
    } finally {
      setAiRecognitionLoading(false);
    }
  }

  async function handleAiAssist() {
    const photoFile = aiAssistPhotoFile;
    if (!photoFile && !aiDescription.trim()) return;
    setAiAssistLoading(true);
    try {
      const body: { imageBase64?: string; description?: string } = {};
      if (photoFile) {
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(photoFile);
        });
        body.imageBase64 = b64;
      }
      if (aiDescription.trim()) body.description = aiDescription.trim();
      const res = await apiRequest("POST", "/api/food-log/recognize-food", body);
      const food: ExtendedFoodResult = await res.json();
      const serving = food.servingGrams || 100;
      const f = serving / 100;
      setForm(prev => ({
        ...prev,
        mealName: food.name,
        calories: String(Math.round(food.calories100g * f)),
        protein: String(Math.round(food.protein100g * f)),
        carbs: String(Math.round(food.carbs100g * f)),
        fat: String(Math.round(food.fat100g * f)),
      }));
      setShowAiAssist(false);
      setAiDescription("");
      setAiAssistPhotoFile(null);
      toast({ title: "AI filled in macros", description: `${food.name} — estimated values per ${serving}g serving.` });
    } catch {
      toast({ title: "Could not identify food", description: "Try a different description or photo.", variant: "destructive" });
    } finally {
      setAiAssistLoading(false);
    }
  }

  async function handleAiTabEstimate() {
    if (!aiTabDescription.trim() && !aiTabPhotoFile) return;
    setAiTabLoading(true);
    try {
      const body: { imageBase64?: string; description?: string } = {};
      if (aiTabPhotoFile) {
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(aiTabPhotoFile);
        });
        body.imageBase64 = b64;
      }
      if (aiTabDescription.trim()) body.description = aiTabDescription.trim();
      const res = await apiRequest("POST", "/api/food-log/recognize-food", body);
      const food: ExtendedFoodResult = await res.json();
      setAiTabResult(food);
      setAiTabServingGrams(String(food.servingGrams || 100));
      setAiTabMealSlot(null);
    } catch {
      toast({ title: "Could not identify food", description: "Try a more detailed description.", variant: "destructive" });
    } finally {
      setAiTabLoading(false);
    }
  }

  async function handleAiLabelScan() {
    if (!aiTabLabelPhotoFile) return;
    setAiTabLoading(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(aiTabLabelPhotoFile);
      });
      const res = await apiRequest("POST", "/api/food-log/extract-label", { imageBase64: b64 });
      const food: ExtendedFoodResult = await res.json();
      if (aiTabProductName.trim()) food.name = aiTabProductName.trim();
      setAiTabResult(food);
      setAiTabServingGrams(String(food.servingGrams || 100));
      setAiTabMealSlot(null);
    } catch {
      toast({ title: "Could not read label", description: "Try a clearer, well-lit photo of the nutrition information panel.", variant: "destructive" });
    } finally {
      setAiTabLoading(false);
    }
  }

  function logAiTabFood() {
    if (!aiTabResult) return;
    const grams = parseFloat(aiTabServingGrams) || 100;
    const f = grams / 100;
    addMutation.mutate({
      date: selectedDate,
      mealName: aiTabResult.name,
      calories: Math.round(aiTabResult.calories100g * f),
      protein: Math.round(aiTabResult.protein100g * f),
      carbs: Math.round(aiTabResult.carbs100g * f),
      fat: Math.round(aiTabResult.fat100g * f),
      fibre: aiTabResult.fibre100g != null ? Math.round(aiTabResult.fibre100g * f) : null,
      sugar: aiTabResult.sugar100g != null ? Math.round(aiTabResult.sugar100g * f) : null,
      saturatedFat: aiTabResult.saturatedFat100g != null ? Math.round(aiTabResult.saturatedFat100g * f) : null,
      mealSlot: aiTabMealSlot,
    });
  }

  const today = todayStr();
  const isToday = selectedDate === today;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="food-log-drawer">
      <div className="absolute inset-0 bg-black/50" onClick={resetFormAndClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
          <h2 className="text-lg font-display font-bold text-zinc-900">Log Meal</h2>
          <button
            onClick={resetFormAndClose}
            className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
            data-testid="button-close-drawer"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="flex bg-zinc-100 p-1 mx-4 my-3 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setFormTab("manual")}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors rounded-lg ${formTab === "manual" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-form-tab-manual"
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            Manual
          </button>
          <button
            type="button"
            onClick={() => setFormTab("search")}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors rounded-lg ${formTab === "search" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-form-tab-search"
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </button>
          <button
            type="button"
            onClick={() => { setScanResult(null); setSaveAsCustomFood(false); setScannerError(false); setFormTab("scan"); }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors rounded-lg ${formTab === "scan" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-form-tab-scan"
          >
            <Barcode className="w-3.5 h-3.5" />
            Scan
          </button>
          {labelScanAvailable && (
            <button
              type="button"
              onClick={() => { setAiTabResult(null); setAiTabDescription(""); setAiTabPhotoFile(null); setAiTabMode("describe"); setAiTabProductName(""); setAiTabLabelPhotoFile(null); setFormTab("ai"); }}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors rounded-lg ${formTab === "ai" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
              data-testid="button-form-tab-ai"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI
            </button>
          )}
          <button
            type="button"
            onClick={() => setFormTab("plan")}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors rounded-lg ${formTab === "plan" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="button-form-tab-plan"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Plan
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div>

            {formTab === "manual" && (
              <form id="manual-log-form" onSubmit={handleSubmit} className="p-4 pb-2 space-y-3">
                {!isToday && (
                  <p className="text-[11px] text-zinc-500 font-medium bg-zinc-100 rounded-lg px-2.5 py-1.5">
                    Logging to {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                )}

                {scanResult?.type === "found" && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Product found: <strong>{scanResult.name}</strong></span>
                  </div>
                )}
                {scanResult?.type === "not_found" && (
                  <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-medium text-amber-700">Product not found in any database</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">Fill in the details and we'll save it for future scans.</p>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-zinc-500 font-medium mb-1.5">Meal type</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {ALL_SLOTS.map(slot => {
                      const Icon = SLOT_ICONS[slot];
                      const active = form.mealSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, mealSlot: active ? null : slot }))}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
                          data-testid={`button-slot-${slot}`}
                        >
                          <Icon className="w-3 h-3" />
                          {SLOT_LABELS[slot]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!form.mealName && recentFoods.length > 0 && (
                  <div>
                    <p className="text-[10px] text-zinc-400 font-medium mb-1.5">Recent</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {recentFoods.map(food => (
                        <button
                          key={food.id}
                          type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            mealName: food.mealName,
                            calories: String(food.calories),
                            protein: String(food.protein),
                            carbs: String(food.carbs),
                            fat: String(food.fat),
                            mealSlot: (food.mealSlot as MealSlot) || f.mealSlot,
                          }))}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 hover:bg-zinc-100 transition-colors"
                          data-testid={`button-recent-food-${food.id}`}
                        >
                          <span className="font-medium max-w-[6rem] truncate">{food.mealName}</span>
                          <span className="text-zinc-400 shrink-0">{food.calories}kcal</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    required
                    placeholder="Meal name"
                    value={form.mealName}
                    onChange={e => setForm(f => ({ ...f, mealName: e.target.value }))}
                    className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                    data-testid="input-log-meal-name"
                  />
                  {labelScanAvailable && (
                    <button
                      type="button"
                      onClick={() => { setShowAiAssist(v => !v); setAiAssistPhotoFile(null); }}
                      className={`px-2.5 rounded-xl transition-colors shrink-0 ${showAiAssist ? "bg-violet-100 text-violet-700 border border-violet-200" : "bg-zinc-50 text-zinc-400 border border-zinc-200 hover:text-violet-600 hover:bg-violet-50"}`}
                      title="AI Fill"
                      data-testid="button-toggle-ai-assist"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {showAiAssist && labelScanAvailable && (
                  <div className="p-3 bg-gradient-to-br from-violet-50/50 to-amber-50/50 border border-violet-100 rounded-xl space-y-2">
                    <p className="text-[10px] text-violet-600 font-medium">Describe your meal or take a photo</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. chicken salad, 250g"
                        value={aiDescription}
                        onChange={e => setAiDescription(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAiAssist(); } }}
                        className="flex-1 px-3 py-2 text-sm border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                        data-testid="input-ai-description"
                      />
                      <button
                        type="button"
                        onClick={() => aiAssistPhotoRef.current?.click()}
                        className={`px-3 py-2 border rounded-lg transition-colors ${aiAssistPhotoFile ? "bg-violet-100 text-violet-700 border-violet-300" : "bg-white text-violet-600 border-violet-200 hover:bg-violet-50"}`}
                        title="Take a photo"
                        data-testid="button-ai-assist-photo"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    {aiAssistPhotoFile && (
                      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700">
                        <Camera className="w-3 h-3 shrink-0" />
                        <span className="truncate flex-1">{aiAssistPhotoFile.name}</span>
                        <button type="button" onClick={() => setAiAssistPhotoFile(null)} className="text-violet-400 hover:text-violet-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAiAssist()}
                      disabled={aiAssistLoading || (!aiDescription.trim() && !aiAssistPhotoFile)}
                      className="w-full py-2 bg-zinc-900 text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      data-testid="button-ai-fill-macros"
                    >
                      {aiAssistLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      {aiAssistLoading ? "Identifying…" : "Fill in macros"}
                    </button>
                    <input
                      ref={aiAssistPhotoRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      data-testid="input-ai-assist-photo-file"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setAiAssistPhotoFile(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {(["calories", "protein", "carbs", "fat"] as const).map(field => (
                    <div key={field}>
                      <label className="text-[10px] text-zinc-500 capitalize">
                        {field === "calories" ? "kcal" : field + " g"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={form[field]}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 text-center bg-white"
                        placeholder="0"
                        data-testid={`input-log-${field}`}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 mb-1.5 font-medium">Optional — sub-macros</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: "fibre", label: "Fibre g" },
                      { key: "sugar", label: "Sugar g" },
                      { key: "saturatedFat", label: "Sat. Fat g" },
                    ] as const).map(({ key, label }) => (
                      <div key={key}>
                        <label className="text-[10px] text-zinc-500">{label}</label>
                        <input
                          type="number"
                          min={0}
                          value={form[key]}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-full px-2 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 text-center bg-white"
                          placeholder="–"
                          data-testid={`input-log-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {scanResult?.type === "not_found" && (
                  <label className="flex items-center gap-2 cursor-pointer py-1" data-testid="label-save-custom-food">
                    <input
                      type="checkbox"
                      checked={saveAsCustomFood}
                      onChange={e => setSaveAsCustomFood(e.target.checked)}
                      className="w-3.5 h-3.5 accent-zinc-900"
                      data-testid="checkbox-save-custom-food"
                    />
                    <span className="text-xs text-zinc-600">Save this food for future barcode scans</span>
                  </label>
                )}
              </form>
            )}

            {formTab === "search" && (
              <div className="p-4">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search foods, brands…"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSelectedFood(null); }}
                    className="w-full pl-8 pr-8 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                    data-testid="input-food-search"
                  />
                  {searchQuery && (
                    <button type="button" onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {selectedFood && (
                  <div className="mb-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl" data-testid="food-serving-adjuster">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 truncate">{selectedFood.name}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">per 100g: {selectedFood.calories100g} kcal · P:{selectedFood.protein100g}g C:{selectedFood.carbs100g}g F:{selectedFood.fat100g}g</p>
                      </div>
                      <button type="button" onClick={() => setSelectedFood(null)} className="shrink-0 text-zinc-400 hover:text-zinc-600 mt-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <label className="text-[10px] text-zinc-500 font-medium shrink-0">Serving (g)</label>
                      <input
                        type="number"
                        min={1}
                        value={servingGrams}
                        onChange={e => setServingGrams(e.target.value)}
                        className="w-20 px-2 py-1 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-center bg-white"
                        data-testid="input-serving-grams"
                      />
                      <span className="text-[10px] text-zinc-400">{selectedFood.servingSize && selectedFood.servingSize !== `${selectedFood.servingGrams}g` ? `(1 serving = ${selectedFood.servingSize})` : ""}</span>
                    </div>
                    {(() => {
                      const f = (parseFloat(servingGrams) || 0) / 100;
                      return (
                        <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                          {[
                            { label: "kcal", value: Math.round(selectedFood.calories100g * f), color: "bg-orange-50 text-orange-700" },
                            { label: "protein", value: Math.round(selectedFood.protein100g * f), color: "bg-red-50 text-red-700" },
                            { label: "carbs", value: Math.round(selectedFood.carbs100g * f), color: "bg-blue-50 text-blue-700" },
                            { label: "fat", value: Math.round(selectedFood.fat100g * f), color: "bg-yellow-50 text-yellow-700" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className={`${color} rounded-lg p-1.5 text-center`}>
                              <p className="text-sm font-bold">{value}</p>
                              <p className="text-[9px] font-medium uppercase tracking-wide opacity-70">{label}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <div className="mb-2.5">
                      <p className="text-[10px] text-zinc-500 font-medium mb-1.5">Meal type</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {ALL_SLOTS.map(slot => {
                          const Icon = SLOT_ICONS[slot];
                          const active = form.mealSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, mealSlot: active ? null : slot }))}
                              className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-medium transition-colors ${active ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-400"}`}
                              data-testid={`button-search-slot-${slot}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {SLOT_LABELS[slot]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={useSelectedFood}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors"
                      data-testid="button-use-food"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Use this food
                    </button>
                  </div>
                )}

                {!selectedFood && (
                  <>
                    {searchLoading && debouncedQuery.length >= 2 && (
                      <div className="flex items-center justify-center gap-2 py-6 text-zinc-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Searching…</span>
                      </div>
                    )}
                    {!searchLoading && debouncedQuery.length >= 2 && foodResults.length === 0 && (
                      <div className="text-center py-6 text-zinc-400">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No results for "{debouncedQuery}"</p>
                        {labelScanAvailable ? (
                          <button
                            type="button"
                            onClick={() => { setAiTabResult(null); setAiTabDescription(debouncedQuery); setAiTabPhotoFile(null); setAiTabMode("describe"); setAiTabProductName(""); setAiTabLabelPhotoFile(null); setFormTab("ai"); }}
                            className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 font-medium hover:text-violet-800 transition-colors"
                            data-testid="button-search-try-ai"
                          >
                            <Sparkles className="w-3 h-3" />
                            Try AI estimate instead
                          </button>
                        ) : (
                          <p className="text-xs mt-1">Try a different name or use Manual entry.</p>
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
                      <div className="space-y-1.5 max-h-56 overflow-y-auto" data-testid="food-search-results">
                        {foodResults.map(food => (
                          <button
                            key={food.id}
                            type="button"
                            onClick={() => selectFood(food)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-zinc-100 hover:border-zinc-200 border border-zinc-100 transition-colors text-left"
                            data-testid={`button-food-result-${food.id}`}
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

            {formTab === "scan" && (
              <div className="p-4">
                <div className="flex bg-zinc-100 p-0.5 rounded-xl mb-3">
                  <button
                    type="button"
                    onClick={() => { setScanMode("barcode"); resetScanner(); }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${scanMode === "barcode" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                    data-testid="button-scan-mode-barcode"
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    Barcode
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScanMode("ai"); setScannedFood(null); setShowScanAnother(false); setShowPhotoInterstitial(false); }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${scanMode === "ai" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                    data-testid="button-scan-mode-ai"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Photo
                  </button>
                </div>

                {showScanAnother ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                      <Check className="w-7 h-7 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Logged!</p>
                      <p className="text-xs text-zinc-400 mt-0.5">Added to your food log for today</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={resetScanner} className="flex-1 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors" data-testid="button-scan-another">
                        Scan another
                      </button>
                      <button type="button" onClick={resetFormAndClose} className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 rounded-xl text-xs font-semibold hover:bg-zinc-200 transition-colors" data-testid="button-scan-done">
                        Done
                      </button>
                    </div>
                  </div>
                ) : scannedFood ? (
                  (() => {
                    const grams = parseFloat(scanServingGrams) || 100;
                    const f = grams / 100;
                    const mainCells = [
                      { label: "Calories", value: Math.round(scannedFood.calories100g * f), unit: "kcal", color: "bg-violet-50 text-violet-700" },
                      { label: "Protein", value: Math.round(scannedFood.protein100g * f * 10) / 10, unit: "g", color: "bg-red-50 text-red-700" },
                      { label: "Carbs", value: Math.round(scannedFood.carbs100g * f * 10) / 10, unit: "g", color: "bg-blue-50 text-blue-700" },
                      { label: "Fat", value: Math.round(scannedFood.fat100g * f * 10) / 10, unit: "g", color: "bg-yellow-50 text-yellow-700" },
                    ];
                    const secondaryCells = [
                      { label: "Fibre", value: Math.round((scannedFood.fibre100g ?? 0) * f * 10) / 10, unit: "g", color: "bg-green-50 text-green-700" },
                      { label: "Sodium", value: Math.round((scannedFood.sodium100g ?? 0) * f * 10) / 10, unit: "mg", color: "bg-orange-50 text-orange-700" },
                    ];
                    const mealSlots: { slot: MealSlot; label: string; icon: typeof Coffee }[] = [
                      { slot: "breakfast", label: "Breakfast", icon: Coffee },
                      { slot: "lunch", label: "Lunch", icon: Salad },
                      { slot: "dinner", label: "Dinner", icon: Moon },
                      { slot: "snack", label: "Snack", icon: Apple },
                    ];
                    return (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 leading-snug" data-testid="text-scan-product-name">{scannedFood.name}</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">
                              {scannedFood.sourceType === "label" ? "Nutrition label scan" :
                               scannedFood.sourceType === "estimated" ? "AI-estimated values" :
                               scannedFood.source === "community" ? "Community database" :
                               scannedFood.source === "open_food_facts" ? "Open Food Facts" : "USDA database"}
                            </p>
                            {scannedFood.sourceType === "estimated" && (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-[9px] font-medium text-amber-700" data-testid="badge-estimated-values">
                                Estimated values — verify before logging
                              </span>
                            )}
                          </div>
                          <button type="button" onClick={resetScanner} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors shrink-0" data-testid="button-scan-reset">
                            <X className="w-4 h-4 text-zinc-400" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 bg-zinc-50 rounded-xl p-2.5">
                          <label className="text-[10px] text-zinc-500 font-medium shrink-0">Serving size</label>
                          <input type="number" min="1" value={scanServingGrams} onChange={e => setScanServingGrams(e.target.value)} className="w-20 text-sm font-semibold text-zinc-900 bg-transparent border-none outline-none text-right" data-testid="input-scan-serving" />
                          <span className="text-xs text-zinc-400">g</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {mainCells.map(c => (
                            <div key={c.label} className={`rounded-xl p-2 ${c.color}`}>
                              <p className="text-[9px] font-medium opacity-70 mb-0.5">{c.label}</p>
                              <p className="text-sm font-bold leading-none">{c.value}<span className="text-[9px] font-normal ml-0.5">{c.unit}</span></p>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {secondaryCells.map(c => (
                            <div key={c.label} className={`rounded-lg p-1.5 flex items-center justify-between ${c.color}`}>
                              <p className="text-[9px] font-medium opacity-70">{c.label}</p>
                              <p className="text-xs font-semibold">{c.value}<span className="text-[9px] font-normal ml-0.5">{c.unit}</span></p>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 font-medium mb-1.5">Meal</p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {mealSlots.map(({ slot, label, icon: Icon }) => {
                              const active = scanMealSlot === slot;
                              return (
                                <button key={slot} type="button" onClick={() => setScanMealSlot(active ? null : slot)} className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-medium transition-colors ${active ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100"}`} data-testid={`button-scan-slot-${slot}`}>
                                  <Icon className="w-3.5 h-3.5" />
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <button type="button" onClick={logScannedFood} disabled={addMutation.isPending} className="w-full py-3 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60" data-testid="button-log-scanned-food">
                          {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                          Log this food
                        </button>
                      </div>
                    );
                  })()
                ) : showPhotoInterstitial ? (
                  <div className="text-center py-8 space-y-5">
                    {photoLabelLoading ? (
                      <>
                        <Loader2 className="w-10 h-10 animate-spin text-zinc-400 mx-auto" />
                        <p className="text-sm font-medium text-zinc-600">Reading nutrition label…</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
                          <Barcode className="w-7 h-7 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">Barcode not found</p>
                          <p className="text-xs text-zinc-400 mt-1">This product isn't in any database yet.</p>
                        </div>
                        <div className="space-y-2">
                          {labelScanAvailable && (
                            <button type="button" onClick={() => photoInputRef.current?.click()} className="w-full py-3 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2" data-testid="button-scan-photo-label">
                              <Camera className="w-4 h-4" />
                              Take a photo of the label
                            </button>
                          )}
                          <button type="button" onClick={() => { setScanResult({ type: "not_found", barcode: labelScanBarcode }); setSaveAsCustomFood(true); setFormTab("manual"); setShowPhotoInterstitial(false); }} className="w-full py-2.5 bg-zinc-100 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors" data-testid="button-scan-enter-manually">
                            Enter manually
                          </button>
                          <button type="button" onClick={resetScanner} className="w-full py-2 text-zinc-400 text-xs hover:text-zinc-600 transition-colors" data-testid="button-scan-try-again">
                            Try scanning again
                          </button>
                        </div>
                      </>
                    )}
                    <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="input-label-photo" onChange={e => { const file = e.target.files?.[0]; if (file) handlePhotoCapture(file); e.target.value = ""; }} />
                  </div>
                ) : scannerError && scanMode === "barcode" ? (
                  <div className="text-center py-8">
                    <Barcode className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-600">Camera not available</p>
                    <p className="text-xs text-zinc-400 mt-1">Allow camera access or try a different browser.</p>
                    <button type="button" onClick={() => { setScanResult({ type: "not_found", barcode: "" }); setSaveAsCustomFood(true); setFormTab("manual"); }} className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-medium" data-testid="button-scan-enter-manually">
                      Enter manually instead
                    </button>
                  </div>
                ) : scanMode === "ai" ? (
                  <div className="text-center py-6 space-y-4">
                    {aiRecognitionLoading ? (
                      <>
                        <Loader2 className="w-10 h-10 animate-spin text-zinc-400 mx-auto" />
                        <p className="text-sm font-medium text-zinc-600">Identifying food…</p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-50 to-amber-50 flex items-center justify-center mx-auto">
                          <Sparkles className="w-8 h-8 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">AI Food Recognition</p>
                          <p className="text-xs text-zinc-400 mt-1">Take a photo of your food and AI will identify it and estimate the macros.</p>
                        </div>
                        <button type="button" onClick={() => aiPhotoInputRef.current?.click()} className="w-full py-3 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2" data-testid="button-ai-take-photo">
                          <Camera className="w-4 h-4" />
                          Take a photo
                        </button>
                        <input ref={aiPhotoInputRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="input-ai-photo" onChange={e => { const file = e.target.files?.[0]; if (file) handleAiRecognitionPhoto(file); e.target.value = ""; }} />
                      </>
                    )}
                    <button type="button" onClick={resetFormAndClose} className="w-full py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors" data-testid="button-log-cancel-ai-scan">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative overflow-hidden rounded-2xl bg-zinc-900 aspect-[4/3]">
                      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted data-testid="video-barcode-scanner" />
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
                          <p className="text-white text-xs font-medium">Looking up product…</p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 text-center mt-2.5">Point camera at a barcode — it will scan automatically</p>
                    <button type="button" onClick={resetFormAndClose} className="mt-3 w-full py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors" data-testid="button-log-cancel-scan">
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}

            {formTab === "plan" && (
              <div className="p-4">
                {plansLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                  </div>
                ) : savedPlans.length === 0 ? (
                  <div className="text-center py-6 text-zinc-400">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No saved plans yet.</p>
                    <p className="text-xs mt-1">Generate a meal plan to save it here.</p>
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="plan-picker-list">
                    {savedPlans.map(plan => {
                      const isOpen = expandedPlanId === plan.id;
                      const planMeals = extractPlanMeals(plan, plan.planType === "weekly" ? selectedWeekDay : undefined);
                      return (
                        <div key={plan.id} className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                          <button type="button" onClick={() => setExpandedPlanId(isOpen ? null : plan.id)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-50 transition-colors text-left" data-testid={`button-expand-plan-${plan.id}`}>
                            <div>
                              <p className="text-sm font-semibold text-zinc-900">{plan.name}</p>
                              <p className="text-xs text-zinc-400 mt-0.5 capitalize">{plan.planType} · {plan.mealStyle ?? "simple"}</p>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                          {isOpen && (
                            <div className="border-t border-zinc-100 px-3 pb-3 pt-2">
                              {plan.planType === "weekly" && (
                                <div className="flex gap-1 mb-3 flex-wrap">
                                  {WEEK_DAYS.map((d, i) => (
                                    <button key={d} type="button" onClick={() => setSelectedWeekDay(d)} className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${selectedWeekDay === d ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`} data-testid={`button-week-day-${d}`}>
                                      {WEEK_SHORT[i]}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {planMeals.length === 0 ? (
                                <p className="text-xs text-zinc-400 py-2">No meals found.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {planMeals.map((m, idx) => (
                                    <button key={idx} type="button" onClick={() => prefillFromPlan(m)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-200 border border-transparent transition-colors text-left" data-testid={`button-plan-meal-${idx}`}>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-zinc-900 truncate">{m.meal}</p>
                                        <p className="text-[10px] text-zinc-400 mt-0.5">{m.slot}</p>
                                      </div>
                                      <div className="text-right ml-3 shrink-0">
                                        <p className="text-xs font-bold text-zinc-900">{m.calories} kcal</p>
                                        <p className="text-[10px] text-zinc-400">P:{m.protein}g C:{m.carbs}g F:{m.fat}g</p>
                                      </div>
                                    </button>
                                  ))}
                                  <button type="button" onClick={() => { const label = plan.planType === "weekly" ? (WEEK_SHORT[WEEK_DAYS.indexOf(selectedWeekDay as typeof WEEK_DAYS[number])] ?? selectedWeekDay) : "today"; addWholeDay(planMeals, label); }} className="w-full mt-1 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5" data-testid="button-add-whole-day">
                                    <Plus className="w-3.5 h-3.5" />
                                    Add whole day ({planMeals.length} meal{planMeals.length !== 1 ? "s" : ""})
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <button type="button" onClick={resetFormAndClose} className="mt-3 w-full py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors" data-testid="button-log-cancel-plan">
                  Cancel
                </button>
              </div>
            )}

            {formTab === "ai" && (
              <div className="p-4 space-y-3">
                {!aiTabResult ? (
                  <>
                    <div className="flex bg-zinc-100 p-0.5 rounded-xl">
                      <button type="button" onClick={() => setAiTabMode("describe")} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${aiTabMode === "describe" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`} data-testid="button-ai-mode-describe">
                        <Sparkles className="w-3 h-3" />
                        Describe
                      </button>
                      <button type="button" onClick={() => setAiTabMode("label")} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${aiTabMode === "label" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`} data-testid="button-ai-mode-label">
                        <Camera className="w-3 h-3" />
                        Label Scan
                      </button>
                    </div>
                    {aiTabMode === "describe" ? (
                      <>
                        <div>
                          <p className="text-[10px] text-zinc-500 font-medium mb-1.5">What are you eating?</p>
                          <input type="text" placeholder="e.g. chicken breast with rice, 300g" value={aiTabDescription} onChange={e => setAiTabDescription(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAiTabEstimate(); } }} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white" data-testid="input-ai-tab-description" />
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => aiTabPhotoRef.current?.click()} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${aiTabPhotoFile ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"}`} data-testid="button-ai-tab-photo">
                            <Camera className="w-3.5 h-3.5" />
                            {aiTabPhotoFile ? <span className="truncate max-w-[120px]">{aiTabPhotoFile.name}</span> : "Add photo (optional)"}
                          </button>
                          {aiTabPhotoFile && (
                            <button type="button" onClick={() => setAiTabPhotoFile(null)} className="text-[10px] text-zinc-400 hover:text-zinc-600" data-testid="button-ai-tab-clear-photo">
                              Remove
                            </button>
                          )}
                        </div>
                        <button type="button" onClick={handleAiTabEstimate} disabled={aiTabLoading || (!aiTabDescription.trim() && !aiTabPhotoFile)} className="w-full py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid="button-ai-tab-estimate">
                          {aiTabLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {aiTabLoading ? "Estimating…" : "Estimate macros"}
                        </button>
                        <input ref={aiTabPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="input-ai-tab-photo-file" onChange={e => { const f = e.target.files?.[0]; if (f) setAiTabPhotoFile(f); e.target.value = ""; }} />
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-[10px] text-zinc-500 font-medium mb-1.5">Product name (optional)</p>
                          <input type="text" placeholder="e.g. Fage Total 0%" value={aiTabProductName} onChange={e => setAiTabProductName(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white" data-testid="input-ai-tab-product-name" />
                        </div>
                        <button type="button" onClick={() => aiTabLabelPhotoRef.current?.click()} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${aiTabLabelPhotoFile ? "bg-green-50 text-green-700 border border-green-200" : "bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100"}`} data-testid="button-ai-tab-label-photo">
                          <Camera className="w-4 h-4" />
                          {aiTabLabelPhotoFile ? <span className="truncate max-w-[180px]">{aiTabLabelPhotoFile.name}</span> : "Photograph nutrition label"}
                        </button>
                        {aiTabLabelPhotoFile && (
                          <button type="button" onClick={() => setAiTabLabelPhotoFile(null)} className="text-[10px] text-zinc-400 hover:text-zinc-600 text-center w-full" data-testid="button-ai-tab-label-clear">
                            Remove photo
                          </button>
                        )}
                        <button type="button" onClick={handleAiLabelScan} disabled={aiTabLoading || !aiTabLabelPhotoFile} className="w-full py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid="button-ai-tab-read-label">
                          {aiTabLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                          {aiTabLoading ? "Reading label…" : "Read nutrition label"}
                        </button>
                        <input ref={aiTabLabelPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="input-ai-tab-label-photo-file" onChange={e => { const f = e.target.files?.[0]; if (f) setAiTabLabelPhotoFile(f); e.target.value = ""; }} />
                      </>
                    )}
                    <p className="text-[10px] text-zinc-400 text-center">Results are saved to the food database to improve future searches</p>
                  </>
                ) : (
                  (() => {
                    const grams = parseFloat(aiTabServingGrams) || 100;
                    const f = grams / 100;
                    const mealSlots: { slot: MealSlot; label: string; icon: typeof Coffee }[] = [
                      { slot: "breakfast", label: "Breakfast", icon: Coffee },
                      { slot: "lunch", label: "Lunch", icon: Salad },
                      { slot: "dinner", label: "Dinner", icon: Moon },
                      { slot: "snack", label: "Snack", icon: Apple },
                    ];
                    return (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 leading-snug" data-testid="text-ai-tab-food-name">{aiTabResult.name}</p>
                            {aiTabResult.sourceType === "label" ? (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded-full text-[9px] font-medium text-green-700">
                                <Camera className="w-2.5 h-2.5" />
                                Read from nutrition label
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-violet-50 border border-violet-200 rounded-full text-[9px] font-medium text-violet-700">
                                <Sparkles className="w-2.5 h-2.5" />
                                AI-estimated — verify before logging
                              </span>
                            )}
                          </div>
                          <button type="button" onClick={() => { setAiTabResult(null); setAiTabDescription(""); setAiTabPhotoFile(null); setAiTabLabelPhotoFile(null); }} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors shrink-0" data-testid="button-ai-tab-reset">
                            <X className="w-4 h-4 text-zinc-400" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 bg-zinc-50 rounded-xl p-3">
                          <label className="text-[10px] text-zinc-500 font-medium shrink-0">Serving size</label>
                          <input type="number" min="1" value={aiTabServingGrams} onChange={e => setAiTabServingGrams(e.target.value)} className="w-20 text-sm font-semibold text-zinc-900 bg-transparent border-none outline-none text-right" data-testid="input-ai-tab-serving" />
                          <span className="text-xs text-zinc-400">g</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { label: "Calories", value: Math.round(aiTabResult.calories100g * f), unit: "kcal", color: "bg-orange-50 text-orange-700" },
                            { label: "Protein", value: Math.round(aiTabResult.protein100g * f * 10) / 10, unit: "g", color: "bg-red-50 text-red-700" },
                            { label: "Carbs", value: Math.round(aiTabResult.carbs100g * f * 10) / 10, unit: "g", color: "bg-blue-50 text-blue-700" },
                            { label: "Fat", value: Math.round(aiTabResult.fat100g * f * 10) / 10, unit: "g", color: "bg-yellow-50 text-yellow-700" },
                          ].map(({ label, value, unit, color }) => (
                            <div key={label} className={`${color} rounded-xl p-2 text-center`}>
                              <p className="text-sm font-bold">{value}</p>
                              <p className="text-[9px] font-medium uppercase tracking-wide opacity-70">{unit === "kcal" ? "kcal" : label}</p>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {mealSlots.map(({ slot, label, icon: Icon }) => {
                            const active = aiTabMealSlot === slot;
                            return (
                              <button key={slot} type="button" onClick={() => setAiTabMealSlot(active ? null : slot)} className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-medium border transition-colors ${active ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"}`} data-testid={`button-ai-tab-slot-${slot}`}>
                                <Icon className="w-3.5 h-3.5" />
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <button type="button" onClick={logAiTabFood} disabled={addMutation.isPending} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50" data-testid="button-ai-tab-log">
                          {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Log this meal
                        </button>
                      </div>
                    );
                  })()
                )}
                <button type="button" onClick={resetFormAndClose} className="w-full py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors" data-testid="button-log-cancel-ai">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
        {formTab === "manual" && (
          <div className="shrink-0 border-t border-zinc-100 bg-white px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] flex gap-2">
            <button
              type="submit"
              form="manual-log-form"
              disabled={addMutation.isPending}
              className="flex-1 py-3 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              data-testid="button-log-save"
            >
              {addMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
            <button
              type="button"
              onClick={resetFormAndClose}
              className="px-5 py-3 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors"
              data-testid="button-log-cancel"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
