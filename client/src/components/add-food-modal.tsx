import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  X, Loader2, Pencil, Check, Search, Barcode, Sparkles,
} from "lucide-react";
import type { UserSavedFood } from "@shared/schema";
import type { FoodResult, ExtendedFoodResult } from "@/components/food-log-shared";
import { type AddFoodTab } from "@/components/meals-food-shared";
import {
  useFoodPicker, MacroGrid, SearchPanel, ScannerView, ScannedFoodPanel, AiPanel,
} from "@/components/food-picker-tabs";

function ConfirmPanel({ food, servGrams, setServGrams, onSave, onReset, testPrefix, saving }: {
  food: FoodResult | ExtendedFoodResult;
  servGrams: string;
  setServGrams: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
  testPrefix: string;
  saving: boolean;
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
      <MacroGrid food={food} servingGrams={servGrams} />
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

  const [selectedResult, setSelectedResult] = useState<FoodResult | ExtendedFoodResult | null>(null);
  const [resultServing, setResultServing] = useState("100");

  const picker = useFoodPicker({ activeTab: tab, scanActive: true });

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
                    onSave={() => saveFromResult(picker.scannedFood!, picker.scanServingGrams)}
                    onReset={picker.resetScan}
                    testPrefix="addfood-scan"
                    saving={saveMutation.isPending}
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
                    onSave={() => saveFromResult(picker.aiResult!, picker.aiServingGrams)}
                    onReset={picker.resetAi}
                    testPrefix="addfood-ai"
                    saving={saveMutation.isPending}
                  />
                ) : (
                  <AiPanel picker={picker} testPrefix="addfood" actionLabel="Save to My Foods" onAction={(food, grams) => saveFromResult(food, String(grams))} />
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
