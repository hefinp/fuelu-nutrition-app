import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, X, Loader2, ArrowLeft,
  Check, Search, Barcode, Sparkles, Wheat, UtensilsCrossed,
} from "lucide-react";
import type { UserSavedFood } from "@shared/schema";
import type { ExtendedFoodResult } from "@/components/food-log-shared";
import {
  type MealSlot, type PickerTab, type Ingredient,
  SLOT_OPTIONS, MacroChips,
  ingredientFromSaved, ingredientFromSearch,
} from "@/components/meals-food-shared";
import {
  useFoodPicker, SearchPanel, ScannerView, ScannedFoodPanel, AiPanel,
} from "@/components/food-picker-tabs";
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

  const picker = useFoodPicker({ activeTab: pickerTab, scanActive: step === "pick" });

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
        ingredientsJson: selected,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm pb-16 sm:pb-0" onClick={onClose}>
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
                <SearchPanel
                  picker={picker}
                  onSelectFood={(food) => addIngredient(ingredientFromSearch(food))}
                  testPrefix="create"
                  onSwitchToAi={() => {
                    picker.setAiResult(null);
                    picker.setAiDescription(picker.debouncedQuery);
                    picker.setAiPhotoFile(null);
                    picker.setAiMode("describe");
                    setPickerTab("ai");
                  }}
                  extraButton={
                    <div className="space-y-1.5 max-h-52 overflow-y-auto" />
                  }
                />
              )}

              {pickerTab === "scan" && (
                <div className="space-y-3">
                  {picker.scannedFood ? (
                    <ScannedFoodPanel
                      picker={picker}
                      testPrefix="create"
                      actionLabel="Add to meal"
                      onAction={(food: ExtendedFoodResult, grams: number) => {
                        addIngredient({ ...ingredientFromSearch(food), grams });
                        picker.resetScan();
                      }}
                    />
                  ) : (
                    <ScannerView picker={picker} testPrefix="create" />
                  )}
                </div>
              )}

              {pickerTab === "ai" && (
                <div className="space-y-3">
                  <AiPanel
                    picker={picker}
                    testPrefix="create"
                    actionLabel="Add to meal"
                    onAction={(food: ExtendedFoodResult, grams: number) => {
                      addIngredient({ ...ingredientFromSearch(food), grams });
                      picker.resetAi();
                    }}
                  />
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
