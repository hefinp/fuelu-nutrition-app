import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, X, Loader2, UtensilsCrossed, AlertCircle,
} from "lucide-react";
import { DuplicateWarningBanner, type DuplicateWarning } from "@/components/duplicate-warning-banner";
import type { UserSavedFood } from "@shared/schema";
import {
  type MealSlot, type Ingredient,
  SLOT_OPTIONS, MacroChips,
  ingredientFromSaved, slotForTimeOfDay,
} from "@/components/meals-food-shared";
import { IngredientPickerModal } from "@/components/ingredient-picker-modal";
import { AddFoodModal } from "@/components/add-food-modal";
import { useMobileViewport } from "@/hooks/use-mobile-viewport";

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onInput={resize}
      placeholder={placeholder}
      rows={2}
      className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none overflow-y-auto"
      style={{ maxHeight: 200 }}
      data-testid={testId}
    />
  );
}

export function CreateMealModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { overlayStyle, panelMaxHeight } = useMobileViewport();
  const [showAddFood, setShowAddFood] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const [selected, setSelected] = useState<Ingredient[]>([]);
  const [mealName, setMealName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [mealSlot, setMealSlot] = useState<MealSlot | null>(null);
  const [dupWarning, setDupWarning] = useState<{ message: string; exactMatch: boolean; existingCount: number } | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const stopScrollLeak = useCallback((e: React.TouchEvent | React.WheelEvent) => {
    e.stopPropagation();
  }, []);

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
    if (selected.find(s => s.key === existingKey)) {
      setSelected(prev => prev.filter(s => s.key !== existingKey));
    } else {
      setSelected(prev => [...prev, ingredientFromSaved(food)]);
    }
  }

  const totals = useMemo(() => selected.reduce((acc, ing) => {
    const factor = ing.grams / 100;
    return {
      cal: acc.cal + Math.round(ing.calories100g * factor),
      prot: acc.prot + Math.round(ing.protein100g * factor),
      carbs: acc.carbs + Math.round(ing.carbs100g * factor),
      fat: acc.fat + Math.round(ing.fat100g * factor),
    };
  }, { cal: 0, prot: 0, carbs: 0, fat: 0 }), [selected]);

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!mealName.trim()) missing.push("Add a meal name");
    if (selected.length === 0) missing.push("Add at least one ingredient");
    return missing;
  }, [mealName, selected]);

  const canSave = missingFields.length === 0;

  function buildMealPayload(confirm = false) {
    const ingredientLines = selected.map(s => `${s.grams}g ${s.name}`).join("\n");
    return {
      name: mealName.trim(),
      source: "manual" as const,
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
      mealSlot: mealSlot ?? slotForTimeOfDay(),
      mealStyle: "simple",
      ...(confirm ? { confirmDuplicate: true } : {}),
    };
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildMealPayload>) => {
      const res = await fetch("/api/user-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const json = await res.json();
      if (res.status === 409 && json.duplicateWarning) {
        throw { isDuplicate: true, warning: json };
      }
      if (!res.ok) throw new Error(json.message || "Failed to save meal");
      return json;
    },
    onSuccess: () => {
      setDupWarning(null);
      queryClient.invalidateQueries({ queryKey: ["/api/user-meals"] });
      toast({ title: `${mealName} saved to My Meals` });
      onSaved();
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as Record<string, unknown>;
      if (e?.isDuplicate) {
        setDupWarning(e.warning as DuplicateWarning);
        return;
      }
      toast({ title: "Failed to save meal", variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-x-0 top-0 bottom-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm max-h-[100dvh]" style={overlayStyle} onClick={onClose} onWheel={stopScrollLeak} onTouchMove={stopScrollLeak}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[85vh] flex flex-col overflow-hidden" style={panelMaxHeight != null ? { maxHeight: panelMaxHeight } : undefined} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-zinc-100 shrink-0">
          <h3 className="text-base font-semibold text-zinc-900" data-testid="text-create-meal-title">Create Meal</h3>
          <button onClick={onClose} className="p-2 -mr-1 text-zinc-500 hover:text-zinc-700 rounded-xl hover:bg-zinc-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" data-testid="button-create-meal-close"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Name</label>
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
            <label className="block text-xs font-medium text-zinc-600 mb-1.5 sm:mb-2">Meal slot</label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {SLOT_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setMealSlot(mealSlot === o.value ? null : o.value)}
                  className={`py-2.5 sm:py-1.5 rounded-lg text-xs font-medium border transition-colors h-11 sm:h-auto ${mealSlot === o.value ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"}`}
                  data-testid={`button-create-slot-${o.value}`}
                >{o.label}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-600">Ingredients</label>
            </div>

            <div className="space-y-2">
              <div className="bg-zinc-50 rounded-2xl p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
                {selected.length > 0 ? (
                  <>
                    {selected.map(ing => {
                      const factor = ing.grams / 100;
                      const ingCal = Math.round(ing.calories100g * factor);
                      const ingProt = Math.round(ing.protein100g * factor * 10) / 10;
                      const ingCarbs = Math.round(ing.carbs100g * factor * 10) / 10;
                      const ingFat = Math.round(ing.fat100g * factor * 10) / 10;
                      return (
                        <div key={ing.key} className="bg-white rounded-xl border border-zinc-100 p-2.5 sm:p-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="flex-1 text-xs font-medium text-zinc-800 truncate min-w-0">{ing.name}</span>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <input
                                type="number"
                                value={ing.grams}
                                min={1}
                                onChange={e => updateGrams(ing.key, parseInt(e.target.value) || 1)}
                                className="w-16 sm:w-[4.5rem] text-xs border border-zinc-200 rounded-lg px-1.5 sm:px-2 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-zinc-300"
                                data-testid={`input-create-ing-grams-${ing.key}`}
                              />
                              <span className="text-zinc-400 text-[10px]">g</span>
                            </div>
                            <button type="button" onClick={() => removeIngredient(ing.key)} className="p-1.5 -mr-1 text-zinc-300 hover:text-red-500 shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center" data-testid={`button-create-remove-ing-${ing.key}`}>
                              <X className="w-4 h-4" />
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
                  </>
                ) : (
                  <div className="text-center py-4 text-zinc-400 text-xs" data-testid="text-create-no-ingredients">
                    No ingredients yet — add some using the picker below
                  </div>
                )}
                <div className="pt-1 border-t border-zinc-100">
                  <p className="text-[10px] text-zinc-400 mb-1">Meal total</p>
                  <MacroChips cal={totals.cal} p={totals.prot} c={totals.carbs} f={totals.fat} />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 sm:py-2 rounded-xl border border-dashed border-zinc-300 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors min-h-[44px] sm:min-h-0"
                data-testid="button-create-toggle-picker"
              >
                <Plus className="w-3.5 h-3.5" />
                Add ingredient
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 mb-1.5">
              Instructions
              <span className="text-zinc-400 text-[10px] font-normal">(optional)</span>
            </label>
            <AutoGrowTextarea
              value={instructions}
              onChange={setInstructions}
              placeholder="Add cooking steps, tips, or notes…"
              testId="textarea-create-instructions"
            />
          </div>
        </div>

        <div className="px-4 sm:px-6 pt-3 sm:pt-4 border-t border-zinc-100 shrink-0" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))" }}>
          {!canSave && !dupWarning && (
            <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl" data-testid="banner-create-validation">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {missingFields.map(msg => (
                  <p key={msg} className="text-xs text-amber-700 font-medium">{msg}</p>
                ))}
              </div>
            </div>
          )}

          {dupWarning ? (
            <DuplicateWarningBanner
              warning={dupWarning}
              onConfirm={() => { setDupWarning(null); saveMutation.mutate(buildMealPayload(true)); }}
              onCancel={() => setDupWarning(null)}
              testPrefix="create-meal-dup"
            />
          ) : (
            <button
              onClick={() => saveMutation.mutate(buildMealPayload())}
              disabled={!canSave || saveMutation.isPending}
              className="w-full py-3 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 min-h-[48px]"
              data-testid="button-create-meal-save"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UtensilsCrossed className="w-4 h-4" />Save Meal</>}
            </button>
          )}
        </div>
      </div>

      {showPicker && (
        <IngredientPickerModal
          onClose={() => setShowPicker(false)}
          onAddIngredient={(ing) => { addIngredient(ing); }}
          selected={selected}
          onToggleSavedFood={toggleSavedFood}
          onUpdateGrams={updateGrams}
          testPrefix="create"
          onAddFoodRequest={() => setShowAddFood(true)}
        />
      )}

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
