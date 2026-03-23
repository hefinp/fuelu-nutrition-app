import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Search, Plus, ArrowLeftRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ReplacePickerState } from "./types";

interface ReplacePickerProps {
  replacePicker: ReplacePickerState;
  onClose: () => void;
  onReplace: (item: { name: string; calories: number; protein: number; carbs: number; fat: number }) => void;
}

const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  snacks: "Snack",
};

export function ReplacePicker({ replacePicker, onClose, onReplace }: ReplacePickerProps) {
  const isSnackSlot = replacePicker.slotKey === 'snack' || replacePicker.slotKey === 'snacks';
  const [replaceSearchQuery, setReplaceSearchQuery] = useState("");
  const [addFoodForm, setAddFoodForm] = useState<{ name: string; calories: string; protein: string; carbs: string; fat: string } | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setReplaceSearchQuery("");
    setAddFoodForm(null);
  }, [replacePicker]);

  const { data: userMealsData } = useQuery<{ items: any[] }>({
    queryKey: ["/api/user-meals"],
    enabled: !isSnackSlot,
  });

  const { data: userFoodsData } = useQuery<{ items: any[] }>({
    queryKey: ["/api/my-foods"],
    enabled: isSnackSlot,
  });

  const addFoodMutation = useMutation({
    mutationFn: async (food: { name: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number }) => {
      const res = await apiRequest('POST', '/api/my-foods', { ...food, servingGrams: 100, source: 'user_manual', confirmDuplicate: true });
      return await res.json();
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-foods"] });
      onReplace({
        name: created.name,
        calories: Math.round((created.calories100g ?? 0) * (created.servingGrams ?? 100) / 100),
        protein: Math.round((created.protein100g ?? 0) * (created.servingGrams ?? 100) / 100),
        carbs: Math.round((created.carbs100g ?? 0) * (created.servingGrams ?? 100) / 100),
        fat: Math.round((created.fat100g ?? 0) * (created.servingGrams ?? 100) / 100),
      });
    },
  });

  const filteredUserFoods = (userFoodsData?.items ?? []).filter(f =>
    !replaceSearchQuery || f.name.toLowerCase().includes(replaceSearchQuery.toLowerCase())
  );

  const filteredUserMeals = (userMealsData?.items ?? []).filter(m =>
    !replaceSearchQuery || m.name.toLowerCase().includes(replaceSearchQuery.toLowerCase())
  );

  const slotLabel = SLOT_LABELS[replacePicker.slotKey] ?? replacePicker.slotKey;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-2xl w-[calc(100%-2rem)] sm:max-w-md shadow-2xl p-5 max-h-[70dvh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-zinc-900">
            <ArrowLeftRight className="w-3.5 h-3.5 inline mr-1.5" />
            Replace {slotLabel}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg" data-testid="button-close-replace-picker">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder={isSnackSlot ? "Search your foods..." : "Search your meals..."}
            value={replaceSearchQuery}
            onChange={e => setReplaceSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            data-testid="input-search-replace"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1">
          {isSnackSlot ? (
            <>
              {filteredUserFoods.length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center" data-testid="text-no-foods-found">
                  {userFoodsData?.items?.length === 0 ? "No foods saved yet." : "No foods match your search."}
                </p>
              ) : (
                filteredUserFoods.map((f: any) => (
                  <button
                    key={f.id}
                    onClick={() => onReplace({
                      name: f.name,
                      calories: Math.round((f.calories100g ?? 0) * (f.servingGrams ?? 100) / 100),
                      protein: Math.round((f.protein100g ?? 0) * (f.servingGrams ?? 100) / 100),
                      carbs: Math.round((f.carbs100g ?? 0) * (f.servingGrams ?? 100) / 100),
                      fat: Math.round((f.fat100g ?? 0) * (f.servingGrams ?? 100) / 100),
                    })}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-50 text-left transition-colors"
                    data-testid={`button-pick-food-${f.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{f.name}</p>
                      <p className="text-[10px] text-zinc-400">
                        {f.servingGrams ?? 100}g · P:{Math.round((f.protein100g ?? 0) * (f.servingGrams ?? 100) / 100)}g C:{Math.round((f.carbs100g ?? 0) * (f.servingGrams ?? 100) / 100)}g F:{Math.round((f.fat100g ?? 0) * (f.servingGrams ?? 100) / 100)}g
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 ml-2 shrink-0">
                      {Math.round((f.calories100g ?? 0) * (f.servingGrams ?? 100) / 100)} kcal
                    </span>
                  </button>
                ))
              )}
              {!addFoodForm ? (
                <button
                  onClick={() => setAddFoodForm({ name: '', calories: '', protein: '', carbs: '', fat: '' })}
                  className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
                  data-testid="button-add-food-inline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Food
                </button>
              ) : (
                <div className="border border-zinc-200 rounded-xl p-3 mt-2 space-y-2">
                  <input placeholder="Food name" value={addFoodForm.name} onChange={e => setAddFoodForm(p => p ? { ...p, name: e.target.value } : p)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" data-testid="input-new-food-name" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Calories" type="number" value={addFoodForm.calories} onChange={e => setAddFoodForm(p => p ? { ...p, calories: e.target.value } : p)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" data-testid="input-new-food-cal" />
                    <input placeholder="Protein (g)" type="number" value={addFoodForm.protein} onChange={e => setAddFoodForm(p => p ? { ...p, protein: e.target.value } : p)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" data-testid="input-new-food-protein" />
                    <input placeholder="Carbs (g)" type="number" value={addFoodForm.carbs} onChange={e => setAddFoodForm(p => p ? { ...p, carbs: e.target.value } : p)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" data-testid="input-new-food-carbs" />
                    <input placeholder="Fat (g)" type="number" value={addFoodForm.fat} onChange={e => setAddFoodForm(p => p ? { ...p, fat: e.target.value } : p)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" data-testid="input-new-food-fat" />
                  </div>
                  <button
                    onClick={() => {
                      if (!addFoodForm.name || !addFoodForm.calories) return;
                      addFoodMutation.mutate({
                        name: addFoodForm.name,
                        calories100g: parseInt(addFoodForm.calories) || 0,
                        protein100g: parseInt(addFoodForm.protein) || 0,
                        carbs100g: parseInt(addFoodForm.carbs) || 0,
                        fat100g: parseInt(addFoodForm.fat) || 0,
                      });
                    }}
                    disabled={!addFoodForm.name || !addFoodForm.calories || addFoodMutation.isPending}
                    className="w-full py-1.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                    data-testid="button-confirm-new-food"
                  >
                    {addFoodMutation.isPending ? 'Saving…' : 'Use This Food'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {filteredUserMeals.length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center" data-testid="text-no-replace-meals-found">
                  {(userMealsData?.items ?? []).length === 0 ? "No meals in your library yet." : "No meals match your search."}
                </p>
              ) : (
                filteredUserMeals.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => onReplace({
                      name: m.name,
                      calories: m.caloriesPerServing,
                      protein: m.proteinPerServing,
                      carbs: m.carbsPerServing,
                      fat: m.fatPerServing,
                    })}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-50 text-left transition-colors"
                    data-testid={`button-pick-replace-meal-${m.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{m.name}</p>
                      <p className="text-[10px] text-zinc-400">P:{m.proteinPerServing}g C:{m.carbsPerServing}g F:{m.fatPerServing}g</p>
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 ml-2 shrink-0">{m.caloriesPerServing} kcal</span>
                  </button>
                ))
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
