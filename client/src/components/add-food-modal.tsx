import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  X, Loader2, Pencil, Check, Search, Barcode, Sparkles, AlertTriangle,
  UtensilsCrossed, ChevronDown, Clock, ExternalLink,
} from "lucide-react";
import type { UserSavedFood } from "@shared/schema";
import type { FoodResult, ExtendedFoodResult } from "@/components/food-log-shared";
import { type AddFoodTab } from "@/components/meals-food-shared";
import {
  useFoodPicker, MacroGrid, SearchPanel, ScannerView, ScannedFoodPanel, AiPanel,
} from "@/components/food-picker-tabs";
import { DuplicateWarningBanner } from "@/components/duplicate-warning-banner";
import { useMobileViewport } from "@/hooks/use-mobile-viewport";

function ConfirmPanel({ food, servGrams, setServGrams, onSave, onReset, testPrefix, saving, dupWarning, onConfirmDuplicate, onCancelDuplicate }: {
  food: FoodResult | ExtendedFoodResult;
  servGrams: string;
  setServGrams: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
  testPrefix: string;
  saving: boolean;
  dupWarning?: DuplicateWarning | null;
  onConfirmDuplicate?: () => void;
  onCancelDuplicate?: () => void;
}) {
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
              {food.source === "canonical" || food.source === "community" ? "FuelU database" : food.source === "open_food_facts" ? "Open Food Facts" : "USDA database"}
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
      <MacroGrid food={food} servingGrams={servGrams} />
      {dupWarning ? (
        <DuplicateWarningBanner
          warning={dupWarning}
          onConfirm={onConfirmDuplicate!}
          onCancel={onCancelDuplicate!}
          testPrefix={`${testPrefix}-dup`}
        />
      ) : (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50"
          data-testid={`button-${testPrefix}-save`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save to My Foods</>}
        </button>
      )}
    </div>
  );
}

type DuplicateWarning = { message: string; exactMatch: boolean; existingCount: number };
type FoodPayload = { name: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number; servingGrams: number; source?: string; confirmDuplicate?: boolean; canonicalFoodId?: number };

export function AddFoodModal({ onClose, onSaved, initialTab = "search" }: { onClose: () => void; onSaved: (food: UserSavedFood) => void; initialTab?: AddFoodTab }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { overlayStyle, panelMaxHeight, isKeyboardOpen } = useMobileViewport(0.90);
  const [tab, setTab] = useState<AddFoodTab>(initialTab);

  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [prot, setProt] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [serving, setServing] = useState("100");

  const [selectedResult, setSelectedResult] = useState<FoodResult | ExtendedFoodResult | null>(null);
  const [resultServing, setResultServing] = useState("100");
  const [dupWarning, setDupWarning] = useState<DuplicateWarning | null>(null);
  const [pendingPayload, setPendingPayload] = useState<FoodPayload | null>(null);

  const picker = useFoodPicker({ activeTab: tab, scanActive: true });

  const saveMutation = useMutation({
    mutationFn: async (payload: FoodPayload) => {
      const res = await fetch("/api/my-foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const json = await res.json();
      if (res.status === 409 && json.duplicateWarning) {
        throw { isDuplicate: true, warning: json };
      }
      if (!res.ok) throw new Error(json.message || "Failed to save food");
      return json;
    },
    onSuccess: (data) => {
      setDupWarning(null);
      setPendingPayload(null);
      queryClient.invalidateQueries({ queryKey: ["/api/my-foods"] });
      toast({ title: `${data.name} added to My Foods` });
      onSaved(data);
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as Record<string, unknown>;
      if (e?.isDuplicate) {
        setDupWarning(e.warning as DuplicateWarning);
        return;
      }
      toast({ title: "Failed to save food", variant: "destructive" });
    },
  });

  function doSave(payload: FoodPayload, confirm = false) {
    setPendingPayload(payload);
    saveMutation.mutate(confirm ? { ...payload, confirmDuplicate: true } : payload);
  }

  function saveFromResult(food: FoodResult | ExtendedFoodResult, servGrams: string, sourceOverride?: string) {
    setDupWarning(null);
    doSave({
      name: food.name,
      calories100g: food.calories100g,
      protein100g: food.protein100g,
      carbs100g: food.carbs100g,
      fat100g: food.fat100g,
      servingGrams: parseInt(servGrams) || 100,
      source: sourceOverride || tab,
      canonicalFoodId: food.canonicalFoodId,
    });
  }

  function saveManual() {
    setDupWarning(null);
    doSave({
      name: name.trim(),
      calories100g: parseInt(cal) || 0,
      protein100g: parseFloat(prot) || 0,
      carbs100g: parseFloat(carbs) || 0,
      fat100g: parseFloat(fat) || 0,
      servingGrams: parseInt(serving) || 100,
      source: "manual",
    });
  }

  const calNum = cal.trim() === "" ? NaN : Number(cal);
  const protNum = prot.trim() === "" ? NaN : Number(prot);
  const carbsNum = carbs.trim() === "" ? NaN : Number(carbs);
  const fatNum = fat.trim() === "" ? NaN : Number(fat);
  const calOk = !isNaN(calNum) && calNum >= 0;
  const protOk = !isNaN(protNum) && protNum >= 0;
  const carbsOk = !isNaN(carbsNum) && carbsNum >= 0;
  const fatOk = !isNaN(fatNum) && fatNum >= 0;
  const manualValid = name.trim().length > 0
    && calOk && protOk && carbsOk && fatOk
    && (calNum > 0 || protNum > 0 || carbsNum > 0 || fatNum > 0);

  const [restQuery, setRestQuery] = useState("");
  const [restDebouncedQuery, setRestDebouncedQuery] = useState("");
  const [restBrand, setRestBrand] = useState<string>("");
  const [restSelectedFood, setRestSelectedFood] = useState<FoodResult | null>(null);
  const [restServGrams, setRestServGrams] = useState("100");
  const [restBrandOpen, setRestBrandOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRestDebouncedQuery(restQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [restQuery]);

  const { data: restBrands = [] } = useQuery<string[]>({
    queryKey: ["/api/restaurant-foods/brands"],
    staleTime: 300000,
  });

  const restSearchEnabled = restDebouncedQuery.length >= 2 || restBrand.length > 0;
  const { data: restResults = [], isLoading: restLoading } = useQuery<FoodResult[]>({
    queryKey: ["/api/restaurant-foods/search", restDebouncedQuery, restBrand],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (restDebouncedQuery) params.set("q", restDebouncedQuery);
      if (restBrand) params.set("brand", restBrand);
      const res = await fetch(`/api/restaurant-foods/search?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: restSearchEnabled,
  });

  const addFoodTabs: { id: AddFoodTab; label: string; icon: typeof Search }[] = [
    { id: "search", label: "Search", icon: Search },
    { id: "restaurants", label: "Restaurants", icon: UtensilsCrossed },
    { id: "scan", label: "Barcode", icon: Barcode },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "manual", label: "Manual", icon: Pencil },
  ];

  return (
    <div className={`fixed inset-x-0 top-0 bottom-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm ${isKeyboardOpen ? 'pb-0' : 'pb-16'} sm:pb-0 max-h-[100dvh]`} style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[90dvh] flex flex-col overflow-hidden" style={panelMaxHeight != null ? { maxHeight: panelMaxHeight } : undefined} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pb-4 border-b border-zinc-100 shrink-0" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
          <div>
            <h3 className="text-base font-semibold text-zinc-900" data-testid="text-addfood-title">Add Food</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Search 3M+ foods or enter your own custom macros</p>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700" data-testid="button-add-food-close"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-3">
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              {addFoodTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setDupWarning(null); setPendingPayload(null); }}
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
                    onReset={() => { setSelectedResult(null); setDupWarning(null); }}
                    testPrefix="addfood-search"
                    saving={saveMutation.isPending}
                    dupWarning={dupWarning}
                    onConfirmDuplicate={() => { setDupWarning(null); if (pendingPayload) doSave(pendingPayload, true); }}
                    onCancelDuplicate={() => { setDupWarning(null); setPendingPayload(null); }}
                  />
                ) : (
                  <SearchPanel
                    picker={picker}
                    onSelectFood={(food) => { setSelectedResult(food); setResultServing("100"); }}
                    testPrefix="addfood"
                    onSwitchToAi={() => {
                      picker.setAiResult(null);
                      picker.setAiDescription(picker.debouncedQuery);
                      picker.setAiPhotoFile(null);
                      picker.setAiMode("describe");
                      setTab("ai");
                    }}
                  />
                )}
              </div>
            )}

            {tab === "scan" && (
              <div className="space-y-3">
                {picker.scannedFood ? (
                  <ConfirmPanel
                    food={picker.scannedFood}
                    servGrams={picker.scanServingGrams}
                    setServGrams={picker.setScanServingGrams}
                    onSave={() => saveFromResult(picker.scannedFood!, picker.scanServingGrams, "barcode")}
                    onReset={() => { picker.resetScan(); setDupWarning(null); }}
                    testPrefix="addfood-scan"
                    saving={saveMutation.isPending}
                    dupWarning={dupWarning}
                    onConfirmDuplicate={() => { setDupWarning(null); if (pendingPayload) doSave(pendingPayload, true); }}
                    onCancelDuplicate={() => { setDupWarning(null); setPendingPayload(null); }}
                  />
                ) : (
                  <ScannerView picker={picker} testPrefix="addfood" />
                )}
              </div>
            )}

            {tab === "ai" && (
              <div className="space-y-3">
                {picker.aiResult ? (
                  <ConfirmPanel
                    food={picker.aiResult}
                    servGrams={picker.aiServingGrams}
                    setServGrams={picker.setAiServingGrams}
                    onSave={() => saveFromResult(picker.aiResult!, picker.aiServingGrams, "ai")}
                    onReset={() => { picker.resetAi(); setDupWarning(null); }}
                    testPrefix="addfood-ai"
                    saving={saveMutation.isPending}
                    dupWarning={dupWarning}
                    onConfirmDuplicate={() => { setDupWarning(null); if (pendingPayload) doSave(pendingPayload, true); }}
                    onCancelDuplicate={() => { setDupWarning(null); setPendingPayload(null); }}
                  />
                ) : (
                  <AiPanel picker={picker} testPrefix="addfood" actionLabel="Save to My Foods" onAction={(food, grams) => saveFromResult(food, String(grams))} />
                )}
              </div>
            )}

            {tab === "restaurants" && (
              <div className="space-y-2">
                {restSelectedFood ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      {restSelectedFood.imageUrl && (
                        <img
                          src={restSelectedFood.imageUrl}
                          alt={restSelectedFood.name}
                          className="w-16 h-16 rounded-xl object-cover shrink-0"
                          data-testid="img-rest-food"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        {restSelectedFood.brand && (
                          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide" data-testid="text-rest-brand">{restSelectedFood.brand}</p>
                        )}
                        <p className="text-sm font-semibold text-zinc-900 leading-snug" data-testid="text-rest-food-name">{restSelectedFood.name}</p>
                        {restSelectedFood.cookTime && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-zinc-400">
                            <Clock className="w-3 h-3" />{restSelectedFood.cookTime}
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={() => { setRestSelectedFood(null); setDupWarning(null); }} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors shrink-0" data-testid="button-rest-reset">
                        <X className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>
                    {restSelectedFood.ingredientsList && restSelectedFood.ingredientsList.length > 0 && (
                      <div className="bg-zinc-50 rounded-xl p-2.5">
                        <p className="text-[10px] font-medium text-zinc-500 mb-1">Ingredients</p>
                        <p className="text-[11px] text-zinc-600 leading-relaxed">{(restSelectedFood.ingredientsList as string[]).join(", ")}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-zinc-50 rounded-xl p-2.5">
                      <label className="text-[10px] text-zinc-500 font-medium shrink-0">Serving (g)</label>
                      <input type="number" min={1} value={restServGrams} onChange={e => setRestServGrams(e.target.value)} className="w-20 text-sm font-semibold text-zinc-900 bg-transparent border-none outline-none text-right" data-testid="input-rest-serving" />
                    </div>
                    <MacroGrid food={restSelectedFood} servingGrams={restServGrams} />
                    {restSelectedFood.sourceUrl && (
                      <a href={restSelectedFood.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors" data-testid="link-rest-source">
                        <ExternalLink className="w-3 h-3" />View source
                      </a>
                    )}
                    {dupWarning ? (
                      <DuplicateWarningBanner
                        warning={dupWarning}
                        onConfirm={() => { setDupWarning(null); if (pendingPayload) doSave(pendingPayload, true); }}
                        onCancel={() => { setDupWarning(null); setPendingPayload(null); }}
                        testPrefix="rest-dup"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => saveFromResult(restSelectedFood, restServGrams, "restaurant")}
                        disabled={saveMutation.isPending}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        data-testid="button-rest-save"
                      >
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save to My Foods</>}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        value={restQuery}
                        onChange={e => setRestQuery(e.target.value)}
                        placeholder="Search restaurants & Hello Fresh..."
                        className="w-full text-sm border border-zinc-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                        data-testid="input-rest-search"
                      />
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setRestBrandOpen(!restBrandOpen)}
                        className="w-full flex items-center justify-between text-sm border border-zinc-200 rounded-xl px-3 py-2 text-left hover:bg-zinc-50 transition-colors"
                        data-testid="button-rest-brand-filter"
                      >
                        <span className={restBrand ? "text-zinc-900" : "text-zinc-400"}>
                          {restBrand || "All brands"}
                        </span>
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      </button>
                      {restBrandOpen && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                          <button
                            onClick={() => { setRestBrand(""); setRestBrandOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 ${!restBrand ? "font-semibold text-zinc-900" : "text-zinc-600"}`}
                            data-testid="button-rest-brand-all"
                          >
                            All brands
                          </button>
                          {restBrands.map(b => (
                            <button
                              key={b}
                              onClick={() => { setRestBrand(b); setRestBrandOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 ${restBrand === b ? "font-semibold text-zinc-900" : "text-zinc-600"}`}
                              data-testid={`button-rest-brand-${b.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {restLoading && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                      </div>
                    )}
                    {!restLoading && restSearchEnabled && restResults.length === 0 && (
                      <p className="text-center text-sm text-zinc-400 py-6" data-testid="text-rest-no-results">No results found</p>
                    )}
                    {!restLoading && restResults.length > 0 && (
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {restResults.map(food => {
                          const servCal = Math.round(food.calories100g * food.servingGrams / 100);
                          const servProt = Math.round(food.protein100g * food.servingGrams / 100);
                          return (
                            <button
                              key={food.id}
                              onClick={() => { setRestSelectedFood(food); setRestServGrams(String(food.servingGrams)); }}
                              className="w-full flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-zinc-50 transition-colors text-left"
                              data-testid={`button-rest-result-${food.id}`}
                            >
                              {food.imageUrl && (
                                <img src={food.imageUrl} alt={food.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                {food.brand && (
                                  <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wide">{food.brand}</p>
                                )}
                                <p className="text-sm font-medium text-zinc-900 leading-snug truncate">{food.name}</p>
                                <p className="text-[10px] text-zinc-400 mt-0.5">
                                  {servCal} kcal · {servProt}g protein · {food.servingGrams}g serve
                                  {food.cookTime && <span> · <Clock className="w-2.5 h-2.5 inline" /> {food.cookTime}</span>}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!restSearchEnabled && !restLoading && (
                      <p className="text-center text-[11px] text-zinc-400 py-4" data-testid="text-rest-hint">
                        Search NZ fast food chains & Hello Fresh recipes
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "manual" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Food name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Aldi Protein Bread, Mum's Dal"
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
                {dupWarning && (
                  <DuplicateWarningBanner
                    warning={dupWarning}
                    onConfirm={() => { setDupWarning(null); if (pendingPayload) doSave(pendingPayload, true); }}
                    onCancel={() => { setDupWarning(null); setPendingPayload(null); }}
                    testPrefix="addfood-dup"
                  />
                )}
                {!dupWarning && (
                  <button
                    onClick={saveManual}
                    disabled={!manualValid || saveMutation.isPending}
                    className="w-full py-3 bg-zinc-900 text-white text-sm font-semibold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
                    data-testid="button-add-food-save"
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Food"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
