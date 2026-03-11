import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SavedMealPlan } from "@shared/schema";
import { Calendar, Trash2, Pencil, Check, X, UtensilsCrossed, ChefHat, Loader2 } from "lucide-react";

export function SavedMealPlans() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const { data: plans = [], isLoading } = useQuery<SavedMealPlan[]>({
    queryKey: ["/api/saved-meal-plans"],
    queryFn: async () => {
      const res = await fetch("/api/saved-meal-plans", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PATCH", `/api/saved-meal-plans/${id}/name`, { name });
      if (!res.ok) throw new Error("Failed to rename");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/saved-meal-plans/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
    },
  });

  function startEdit(plan: SavedMealPlan) {
    setEditingId(plan.id);
    setEditName(plan.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  function confirmEdit(id: number) {
    if (editName.trim()) {
      renameMutation.mutate({ id, name: editName.trim() });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-400">
        <UtensilsCrossed className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No saved plans yet. Generate a meal plan to save it automatically.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <AnimatePresence initial={false}>
        {plans.map((plan) => {
          const planData = plan.planData as any;
          const totalCal = plan.planType === 'weekly'
            ? planData?.weekTotalCalories
            : planData?.dayTotalCalories;
          const totalProtein = plan.planType === 'weekly'
            ? planData?.weekTotalProtein
            : planData?.dayTotalProtein;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm"
              data-testid={`card-saved-plan-${plan.id}`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  {editingId === plan.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmEdit(plan.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="flex-1 text-sm font-semibold px-2 py-1 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 min-w-0"
                        autoFocus
                        data-testid={`input-plan-name-${plan.id}`}
                      />
                      <button
                        onClick={() => confirmEdit(plan.id)}
                        disabled={renameMutation.isPending}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        data-testid={`button-rename-confirm-${plan.id}`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1 text-zinc-400 hover:bg-zinc-100 rounded-lg"
                        data-testid={`button-rename-cancel-${plan.id}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group">
                      <span className="text-sm font-semibold text-zinc-900 truncate">{plan.name}</span>
                      <button
                        onClick={() => startEdit(plan)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-all"
                        data-testid={`button-rename-${plan.id}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteMutation.mutate(plan.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  data-testid={`button-delete-plan-${plan.id}`}
                >
                  {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${plan.planType === 'weekly' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                  <Calendar className="w-3 h-3" />
                  {plan.planType === 'weekly' ? 'Weekly' : 'Daily'}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${plan.mealStyle === 'gourmet' ? 'bg-purple-50 text-purple-700' : 'bg-zinc-100 text-zinc-600'}`}>
                  <ChefHat className="w-3 h-3" />
                  {plan.mealStyle === 'gourmet' ? 'Gourmet' : 'Simple'}
                </span>
              </div>

              {(totalCal || totalProtein) && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {totalCal && (
                    <div className="bg-zinc-50 rounded-xl px-3 py-2">
                      <p className="text-xs text-zinc-500">Calories</p>
                      <p className="text-sm font-bold text-zinc-900">{totalCal.toLocaleString()} kcal</p>
                    </div>
                  )}
                  {totalProtein && (
                    <div className="bg-zinc-50 rounded-xl px-3 py-2">
                      <p className="text-xs text-zinc-500">Protein</p>
                      <p className="text-sm font-bold text-zinc-900">{totalProtein}g</p>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-zinc-400">
                {new Date(plan.createdAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
