import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, Search, Barcode, Sparkles, Wheat, Plus, Check,
} from "lucide-react";
import { motion } from "framer-motion";
import type { UserSavedFood } from "@shared/schema";
import type { ExtendedFoodResult } from "@/components/food-log-shared";
import type { PickerTab, Ingredient } from "@/components/meals-food-shared";
import { ingredientFromSaved, ingredientFromSearch } from "@/components/meals-food-shared";
import {
  useFoodPicker, SearchPanel, ScannerView, ScannedFoodPanel, AiPanel,
} from "@/components/food-picker-tabs";

interface IngredientPickerModalProps {
  onClose: () => void;
  onAddIngredient: (ingredient: Ingredient, food?: ExtendedFoodResult) => void;
  selected: Ingredient[];
  onToggleSavedFood: (food: UserSavedFood) => void;
  onUpdateGrams: (key: string, grams: number) => void;
  testPrefix: string;
  onAddFoodRequest?: () => void;
}

export function IngredientPickerModal({
  onClose,
  onAddIngredient,
  selected,
  onToggleSavedFood,
  onUpdateGrams,
  testPrefix,
  onAddFoodRequest,
}: IngredientPickerModalProps) {
  const [pickerTab, setPickerTab] = useState<PickerTab>("search");
  const picker = useFoodPicker({ activeTab: pickerTab, scanActive: true });

  const { data: myFoods = [] } = useQuery<{ items: UserSavedFood[] }, Error, UserSavedFood[]>({
    queryKey: ["/api/my-foods", "all"],
    queryFn: () => fetch("/api/my-foods?limit=100", { credentials: "include" }).then(r => r.json()),
    select: (d) => d.items,
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const stopPropagation = useCallback((e: React.TouchEvent | React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  const pickerTabs: { id: PickerTab; label: string; icon: typeof Search }[] = [
    { id: "search", label: "Search", icon: Search },
    { id: "scan", label: "Scan", icon: Barcode },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "myfoods", label: "My Foods", icon: Wheat },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onWheel={stopPropagation}
      onTouchMove={stopPropagation}
      data-testid="modal-ingredient-picker"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-zinc-600" />
            <h3 className="text-base font-semibold text-zinc-900">Find ingredient</h3>
          </div>
          <button
            onClick={onClose}
            data-testid={`button-${testPrefix}-picker-close`}
            className="p-2 -mr-1 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-3 border-b border-zinc-100 shrink-0">
          <div className="flex bg-zinc-100 p-0.5 sm:p-1 rounded-xl overflow-hidden">
            {pickerTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setPickerTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 sm:py-1.5 text-[11px] sm:text-xs font-semibold transition-colors rounded-lg min-h-[40px] sm:min-h-0 ${pickerTab === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                data-testid={`button-${testPrefix}-picker-tab-${tab.id}`}
              >
                <tab.icon className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="hidden min-[380px]:inline truncate">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          {pickerTab === "search" && (
            <SearchPanel
              picker={picker}
              onSelectFood={(food) => {
                onAddIngredient(ingredientFromSearch(food));
                onClose();
              }}
              testPrefix={testPrefix}
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
                testPrefix={testPrefix}
                actionLabel="Add to meal"
                onAction={(food: ExtendedFoodResult, grams: number) => {
                  onAddIngredient({ ...ingredientFromSearch(food), grams }, food);
                  picker.resetScan();
                  onClose();
                }}
              />
            ) : (
              <ScannerView picker={picker} testPrefix={testPrefix} />
            )
          )}

          {pickerTab === "ai" && (
            <AiPanel
              picker={picker}
              testPrefix={testPrefix}
              actionLabel="Add to meal"
              onAction={(food: ExtendedFoodResult, grams: number) => {
                onAddIngredient({ ...ingredientFromSearch(food), grams }, food);
                picker.resetAi();
                onClose();
              }}
            />
          )}

          {pickerTab === "myfoods" && (
            <div className="space-y-1.5 sm:space-y-2">
              {myFoods.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-zinc-400 mb-2">No foods saved yet</p>
                  {onAddFoodRequest && (
                    <button
                      onClick={() => { onAddFoodRequest(); onClose(); }}
                      className="text-xs text-zinc-500 hover:text-zinc-700 font-medium"
                      data-testid={`button-${testPrefix}-add-food`}
                    >
                      <Plus className="w-3.5 h-3.5 inline mr-1" />Add new food to My Foods
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {myFoods.map(food => {
                    const key = `saved-${food.id}`;
                    const isSelected = selected.some(s => s.key === key);
                    const sel = selected.find(s => s.key === key);
                    return (
                      <div key={food.id} className={`rounded-xl border transition-all ${isSelected ? "border-zinc-900 bg-zinc-50" : "border-zinc-100 bg-white"}`}>
                        <button
                          className="w-full flex items-center gap-3 p-2.5 sm:p-3 text-left min-h-[44px]"
                          onClick={() => onToggleSavedFood(food)}
                          data-testid={`button-${testPrefix}-pick-food-${food.id}`}
                        >
                          <div className={`w-5 h-5 sm:w-4 sm:h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"}`}>
                            {isSelected && <Check className="w-3 h-3 sm:w-2.5 sm:h-2.5 text-white" />}
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
                              onChange={e => onUpdateGrams(sel.key, parseInt(e.target.value) || 1)}
                              className="w-20 text-xs border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-300"
                              data-testid={`input-${testPrefix}-myfood-grams-${food.id}`}
                            />
                            <p className="text-[10px] text-zinc-400">{"\u2248"} {Math.round(food.calories100g * sel.grams / 100)} kcal</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {onAddFoodRequest && (
                    <button
                      onClick={() => { onAddFoodRequest(); onClose(); }}
                      className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 text-sm transition-colors min-h-[44px]"
                      data-testid={`button-${testPrefix}-add-food`}
                    >
                      <Plus className="w-4 h-4" />Add new food to My Foods
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
