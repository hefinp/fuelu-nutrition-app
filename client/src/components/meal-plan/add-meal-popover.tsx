import { motion } from "framer-motion";
import { X, Search, Loader2, Link2, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { AddMealPopoverState, Meal } from "./types";
import { ImportModal } from "@/components/import-modal";
import { CreateMealModal } from "@/components/create-meal-modal";
import { apiRequest } from "@/lib/queryClient";

interface AddMealPopoverProps {
  popoverState: AddMealPopoverState;
  onClose: () => void;
  onAddMeal: (dayKey: string, slotKey: string, userMeal: any) => void;
}

export function AddMealPopover({ popoverState, onClose, onAddMeal }: AddMealPopoverProps) {
  const [mealSearchQuery, setMealSearchQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showCreateMeal, setShowCreateMeal] = useState(false);
  const queryClient = useQueryClient();

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  const { data: userMealsData, isLoading: userMealsLoading } = useQuery<{ items: any[] }>({
    queryKey: ["/api/user-meals"],
    enabled: true,
  });

  const [loadingMealId, setLoadingMealId] = useState<number | null>(null);

  const filteredUserMeals = (userMealsData?.items ?? []).filter(m =>
    !mealSearchQuery || m.name.toLowerCase().includes(mealSearchQuery.toLowerCase())
  );

  const handlePickMeal = async (m: any) => {
    if (m.ingredientsJson && Array.isArray(m.ingredientsJson) && m.ingredientsJson.length > 0) {
      onAddMeal(popoverState.dayKey, popoverState.slotKey, m);
      return;
    }
    setLoadingMealId(m.id);
    try {
      const res = await apiRequest('GET', `/api/user-meals/${m.id}/ingredients`);
      const rows: any[] = await res.json();
      if (rows && rows.length > 0) {
        const ingredientsJson = rows.map((r: any) => ({
          name: r.name ?? 'Unknown',
          grams: r.grams ?? 0,
          calories100g: r.calories100g ?? 0,
          protein100g: r.protein100g ?? 0,
          carbs100g: r.carbs100g ?? 0,
          fat100g: r.fat100g ?? 0,
        }));
        onAddMeal(popoverState.dayKey, popoverState.slotKey, { ...m, ingredientsJson });
      } else {
        onAddMeal(popoverState.dayKey, popoverState.slotKey, m);
      }
    } catch {
      onAddMeal(popoverState.dayKey, popoverState.slotKey, m);
    } finally {
      setLoadingMealId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl p-5 flex flex-col max-h-[85vh] sm:max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-sm font-bold text-zinc-900">Add Meal</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg" data-testid="button-close-add-meal">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="relative mb-3 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search your meals..."
            value={mealSearchQuery}
            onChange={e => setMealSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            autoFocus={!isMobile}
            data-testid="input-search-meal"
          />
        </div>
        <div className="flex gap-2 mb-3 shrink-0">
          <button
            onClick={() => setShowImport(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
            data-testid="button-popover-import"
          >
            <Link2 className="w-3.5 h-3.5" />Import
          </button>
          <button
            onClick={() => setShowCreateMeal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-700 transition-all"
            data-testid="button-popover-create-meal"
          >
            <Plus className="w-3.5 h-3.5" />Create Meal
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 overscroll-contain">
          {userMealsLoading ? (
            <div className="flex items-center justify-center py-6" data-testid="loading-meals"><Loader2 className="w-4 h-4 animate-spin text-zinc-400" /></div>
          ) : filteredUserMeals.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center" data-testid="text-no-meals-found">
              {(userMealsData?.items ?? []).length === 0 ? "No meals in your library yet." : "No meals match your search."}
            </p>
          ) : (
            filteredUserMeals.map((m: any) => (
              <button
                key={m.id}
                onClick={() => handlePickMeal(m)}
                disabled={loadingMealId === m.id}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-50 text-left transition-colors disabled:opacity-50"
                data-testid={`button-pick-meal-${m.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{m.name}</p>
                  <p className="text-[10px] text-zinc-400">P:{m.proteinPerServing}g C:{m.carbsPerServing}g F:{m.fatPerServing}g</p>
                </div>
                {loadingMealId === m.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400 ml-2 shrink-0" />
                ) : (
                  <span className="text-xs font-semibold text-zinc-700 ml-2 shrink-0">{m.caloriesPerServing} kcal</span>
                )}
              </button>
            ))
          )}
        </div>
      </motion.div>
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ["/api/user-meals"] }); }}
        />
      )}
      {showCreateMeal && (
        <CreateMealModal
          onClose={() => setShowCreateMeal(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ["/api/user-meals"] }); }}
        />
      )}
    </div>
  );
}
