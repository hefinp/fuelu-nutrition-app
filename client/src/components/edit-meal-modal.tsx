import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FavouriteMeal, UserRecipe, UserSavedFood } from "@shared/schema";
import {
  X, Loader2, Check, Plus, Sparkles, Wheat, Search, Barcode,
  ChevronDown, ChevronUp, Wand2,
} from "lucide-react";
import {
  type MealSlot, type PickerTab, type Ingredient,
  SLOT_OPTIONS, MacroChips,
  ingredientFromSaved, ingredientFromSearch,
} from "@/components/meals-food-shared";
import {
  useFoodPicker, SearchPanel, ScannerView, ScannedFoodPanel, AiPanel,
} from "@/components/food-picker-tabs";
import type { ExtendedFoodResult } from "@/components/food-log-shared";

function parseIngredientsJson(raw: unknown): Ingredient[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  try {
    return raw.map((item: unknown, i: number): Ingredient => {
      if (typeof item !== "object" || item === null) throw new Error("invalid item");
      const obj = item as Record<string, unknown>;
      return {
        key: typeof obj.key === "string" ? obj.key : `ing-${i}`,
        name: String(obj.name ?? ""),
        calories100g: Number(obj.calories100g) || 0,
        protein100g: Number(obj.protein100g) || 0,
        carbs100g: Number(obj.carbs100g) || 0,
        fat100g: Number(obj.fat100g) || 0,
        grams: Number(obj.grams) || 100,
      };
    });
  } catch {
    return null;
  }
}

export function EditMealModal({
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

  const rawJson = isFav ? fav!.ingredientsJson : rec!.ingredientsJson;
  const plainIngredients = isFav ? (fav!.ingredients ?? "") : (rec!.ingredients ?? "");
  const parsedInitial = parseIngredientsJson(rawJson);

  const [name, setName] = useState(isFav ? fav!.mealName : rec!.name);
  const [mealSlot, setMealSlot] = useState<MealSlot>((isFav ? fav!.mealSlot : rec!.mealSlot) as MealSlot ?? "dinner");
  const [instructions, setInstructions] = useState(isFav ? fav!.instructions ?? "" : rec?.instructions ?? "");

  const [selected, setSelected] = useState<Ingredient[]>(parsedInitial ?? []);
  const [hasStructured, setHasStructured] = useState(parsedInitial !== null);
  const [converting, setConverting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>("search");

  const [manualCal, setManualCal] = useState(String(isFav ? fav!.calories : rec!.caloriesPerServing));
  const [manualProt, setManualProt] = useState(String(isFav ? fav!.protein : rec!.proteinPerServing));
  const [manualCarbs, setManualCarbs] = useState(String(isFav ? fav!.carbs : rec!.carbsPerServing));
  const [manualFat, setManualFat] = useState(String(isFav ? fav!.fat : rec!.fatPerServing));

  const { data: myFoods = [] } = useQuery<UserSavedFood[]>({ queryKey: ["/api/my-foods"] });
  const picker = useFoodPicker({ activeTab: pickerTab, scanActive: showPicker });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const stopScrollLeak = useCallback((e: React.TouchEvent | React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  const totals = useMemo(() => selected.reduce((acc, ing) => {
    const factor = ing.grams / 100;
    return {
      cal: acc.cal + Math.round(ing.calories100g * factor),
      prot: acc.prot + Math.round(ing.protein100g * factor),
      carbs: acc.carbs + Math.round(ing.carbs100g * factor),
      fat: acc.fat + Math.round(ing.fat100g * factor),
    };
  }, { cal: 0, prot: 0, carbs: 0, fat: 0 }), [selected]);

  async function addIngredientAndPersist(ing: Ingredient, food: ExtendedFoodResult) {
    setSelected(prev => [...prev, ing]);
    try {
      await apiRequest("POST", "/api/my-foods", {
        name: food.name,
        calories100g: Math.round(food.calories100g ?? 0),
        protein100g: Math.round((food.protein100g ?? 0) * 10) / 10,
        carbs100g: Math.round((food.carbs100g ?? 0) * 10) / 10,
        fat100g: Math.round((food.fat100g ?? 0) * 10) / 10,
        servingGrams: Math.round(ing.grams),
        source: "user-added",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/my-foods"] });
    } catch {
      toast({ title: `${ing.name} added (not saved to My Foods)`, variant: "destructive" });
      return;
    }
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
    if (selected.find(s => s.key === existingKey)) {
      setSelected(prev => prev.filter(s => s.key !== existingKey));
    } else {
      setSelected(prev => [...prev, ingredientFromSaved(food)]);
    }
  }

  async function convertIngredients() {
    if (!plainIngredients.trim()) return;
    setConverting(true);
    try {
      const res = await apiRequest("POST", "/api/meals/parse-ingredients", {
        ingredients: plainIngredients,
      });
      const parsed: Ingredient[] = await res.json();
      setSelected(parsed);
      setHasStructured(true);
      toast({ title: "Ingredients converted", description: "Review and adjust the values, then save." });
    } catch {
      toast({ title: "Conversion failed", description: "Try again or add ingredients manually.", variant: "destructive" });
    } finally {
      setConverting(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const cal = hasStructured ? totals.cal : parseInt(manualCal) || 0;
      const prot = hasStructured ? totals.prot : parseInt(manualProt) || 0;
      const carbs = hasStructured ? totals.carbs : parseInt(manualCarbs) || 0;
      const fat = hasStructured ? totals.fat : parseInt(manualFat) || 0;
      const ingredientsJson = hasStructured ? selected : null;
      const ingredientsText = hasStructured
        ? selected.map(s => `${s.grams}g ${s.name}`).join("\n")
        : plainIngredients;

      if (isFav) {
        return apiRequest("PATCH", `/api/favourites/${fav!.id}`, {
          mealName: name.trim(),
          calories: cal,
          protein: prot,
          carbs,
          fat,
          mealSlot,
          ingredients: ingredientsText || null,
          ingredientsJson,
          instructions: instructions.trim() || null,
        }).then(r => r.json());
      }
      return apiRequest("PATCH", `/api/recipes/${rec!.id}`, {
        name: name.trim(),
        caloriesPerServing: cal,
        proteinPerServing: prot,
        carbsPerServing: carbs,
        fatPerServing: fat,
        mealSlot,
        instructions: instructions.trim() || null,
        ingredients: ingredientsText || null,
        ingredientsJson,
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [isFav ? "/api/favourites" : "/api/recipes"] });
      toast({ title: "Updated" });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const pickerTabs: { id: PickerTab; label: string; icon: typeof Search }[] = [
    { id: "search", label: "Search", icon: Search },
    { id: "scan", label: "Barcode", icon: Barcode },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "myfoods", label: "My Foods", icon: Wheat },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm pb-16 sm:pb-0" onClick={onClose} onWheel={stopScrollLeak} onTouchMove={stopScrollLeak}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <h3 className="text-base font-semibold text-zinc-900">Edit {isFav ? "Favourite" : "Meal"}</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700" data-testid="button-edit-meal-close"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid="input-edit-name" />
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-600">Ingredients</label>
              {!hasStructured && plainIngredients.trim() && (
                <button
                  type="button"
                  onClick={convertIngredients}
                  disabled={converting}
                  className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800 disabled:opacity-50"
                  data-testid="button-convert-ingredients"
                >
                  {converting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {converting ? "Converting…" : "Convert ingredients"}
                </button>
              )}
            </div>

            {hasStructured ? (
              <div className="space-y-2">
                {selected.length > 0 ? (
                  <div className="bg-zinc-50 rounded-2xl p-3 space-y-2">
                    {selected.map(ing => {
                      const factor = ing.grams / 100;
                      const ingCal = Math.round(ing.calories100g * factor);
                      const ingProt = Math.round(ing.protein100g * factor * 10) / 10;
                      const ingCarbs = Math.round(ing.carbs100g * factor * 10) / 10;
                      const ingFat = Math.round(ing.fat100g * factor * 10) / 10;
                      return (
                        <div key={ing.key} className="bg-white rounded-xl border border-zinc-100 p-2.5 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="flex-1 text-xs font-medium text-zinc-800 truncate">{ing.name}</span>
                            <input
                              type="number"
                              value={ing.grams}
                              min={1}
                              onChange={e => updateGrams(ing.key, parseInt(e.target.value) || 1)}
                              className="w-16 text-xs border border-zinc-200 rounded-lg px-1.5 py-1 text-center focus:outline-none focus:ring-1 focus:ring-zinc-300"
                              data-testid={`input-edit-ing-grams-${ing.key}`}
                            />
                            <span className="text-zinc-400 text-[10px] shrink-0">g</span>
                            <button type="button" onClick={() => removeIngredient(ing.key)} className="text-zinc-300 hover:text-red-500 shrink-0" data-testid={`button-edit-remove-ing-${ing.key}`}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-700 text-[10px] font-medium">{ingCal} kcal</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-medium">P {ingProt}g</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-green-50 text-green-700 text-[10px] font-medium">C {ingCarbs}g</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-yellow-50 text-yellow-700 text-[10px] font-medium">F {ingFat}g</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-1 border-t border-zinc-100">
                      <p className="text-[10px] text-zinc-400 mb-1">Meal total</p>
                      <MacroChips cal={totals.cal} p={totals.prot} c={totals.carbs} f={totals.fat} />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-zinc-400 text-xs bg-zinc-50 rounded-2xl">
                    No ingredients yet — add some using the picker below
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowPicker(v => !v)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-zinc-300 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
                  data-testid="button-edit-toggle-picker"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add ingredient
                  {showPicker ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
                </button>

                {showPicker && (
                  <div className="border border-zinc-100 rounded-2xl p-3 space-y-3 bg-white">
                    <div className="flex bg-zinc-100 p-1 rounded-xl">
                      {pickerTabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setPickerTab(tab.id)}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold transition-colors rounded-lg ${pickerTab === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                          data-testid={`button-edit-picker-tab-${tab.id}`}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {pickerTab === "search" && (
                      <SearchPanel
                        picker={picker}
                        onSelectFood={food => addIngredientAndPersist(ingredientFromSearch(food), food)}
                        testPrefix="edit"
                        onSwitchToAi={() => {
                          picker.setAiResult(null);
                          picker.setAiDescription(picker.debouncedQuery);
                          picker.setAiPhotoFile(null);
                          picker.setAiMode("describe");
                          setPickerTab("ai");
                        }}
                      />
                    )}

                    {pickerTab === "scan" && (
                      picker.scannedFood ? (
                        <ScannedFoodPanel
                          picker={picker}
                          testPrefix="edit"
                          actionLabel="Add to meal"
                          onAction={(food: ExtendedFoodResult, grams: number) => {
                            addIngredientAndPersist({ ...ingredientFromSearch(food), grams }, food);
                            picker.resetScan();
                          }}
                        />
                      ) : (
                        <ScannerView picker={picker} testPrefix="edit" />
                      )
                    )}

                    {pickerTab === "ai" && (
                      <AiPanel
                        picker={picker}
                        testPrefix="edit"
                        actionLabel="Add to meal"
                        onAction={(food: ExtendedFoodResult, grams: number) => {
                          addIngredientAndPersist({ ...ingredientFromSearch(food), grams }, food);
                          picker.resetAi();
                        }}
                      />
                    )}

                    {pickerTab === "myfoods" && (
                      <div className="space-y-2">
                        {myFoods.length === 0 ? (
                          <p className="text-xs text-zinc-400 text-center py-4">No foods saved yet</p>
                        ) : (
                          myFoods.map(food => {
                            const key = `saved-${food.id}`;
                            const isSelected = selected.some(s => s.key === key);
                            const sel = selected.find(s => s.key === key);
                            return (
                              <div key={food.id} className={`rounded-xl border transition-all ${isSelected ? "border-zinc-900 bg-zinc-50" : "border-zinc-100 bg-white"}`}>
                                <button
                                  className="w-full flex items-center gap-3 p-2.5 text-left"
                                  onClick={() => toggleSavedFood(food)}
                                  data-testid={`button-edit-pick-food-${food.id}`}
                                >
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"}`}>
                                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-zinc-900 truncate">{food.name}</p>
                                    <p className="text-[10px] text-zinc-400">{food.calories100g} kcal/100g</p>
                                  </div>
                                </button>
                                {isSelected && sel && (
                                  <div className="px-2.5 pb-2.5 flex items-center gap-2">
                                    <label className="text-[10px] text-zinc-500 shrink-0">g:</label>
                                    <input
                                      type="number"
                                      value={sel.grams}
                                      min={1}
                                      onChange={e => updateGrams(sel.key, parseInt(e.target.value) || 1)}
                                      className="w-16 text-xs border border-zinc-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-300"
                                      data-testid={`input-edit-myfood-grams-${food.id}`}
                                    />
                                    <p className="text-[10px] text-zinc-400">≈ {Math.round(food.calories100g * sel.grams / 100)} kcal</p>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {plainIngredients.trim() ? (
                  <div className="bg-zinc-50 rounded-xl p-3">
                    <ul className="space-y-0.5">
                      {plainIngredients.split("\n").filter(Boolean).map((line, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-600">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-300 shrink-0" />{line}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-zinc-400 mt-2">Tap "Convert ingredients" above to enable editing with macro data.</p>
                    <button
                      type="button"
                      onClick={() => { setSelected([]); setHasStructured(true); setShowPicker(true); }}
                      className="mt-2 text-[10px] text-zinc-400 underline hover:text-zinc-600"
                      data-testid="button-edit-start-fresh"
                    >Or start with an empty structured list</button>
                  </div>
                ) : (
                  <div className="bg-zinc-50 rounded-xl p-4 text-center space-y-2">
                    <p className="text-xs text-zinc-500">
                      {isFav
                        ? "No ingredients recorded — this meal was saved from your food log without ingredient details."
                        : "No ingredients added yet."}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setHasStructured(true); setShowPicker(true); }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-zinc-300 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
                      data-testid="button-edit-start-structured"
                    >
                      <Plus className="w-3.5 h-3.5" />Add ingredients
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Instructions <span className="text-zinc-400 font-normal">(optional)</span></label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
              placeholder="Add cooking steps, tips, or notes…"
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none" data-testid="textarea-edit-instructions" />
          </div>

          {!hasStructured && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">Macros per serving</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Calories (kcal)", value: manualCal, set: setManualCal, testid: "input-edit-cal" },
                  { label: "Protein (g)", value: manualProt, set: setManualProt, testid: "input-edit-prot" },
                  { label: "Carbs (g)", value: manualCarbs, set: setManualCarbs, testid: "input-edit-carbs" },
                  { label: "Fat (g)", value: manualFat, set: setManualFat, testid: "input-edit-fat" },
                ].map(({ label, value, set, testid }) => (
                  <div key={label}>
                    <label className="text-[10px] text-zinc-400">{label}</label>
                    <input type="number" value={value} onChange={e => set(e.target.value)} min={0}
                      className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid={testid} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-zinc-100 shrink-0">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            data-testid="button-edit-save"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
