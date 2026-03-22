import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Star, Trash2, Loader2, X, Utensils } from "lucide-react";
import type { UserMeal } from "@shared/schema";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function FavouritesWidget() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedMeal, setSelectedMeal] = useState<UserMeal | null>(null);
  const [loggingId, setLoggingId] = useState<number | null>(null);

  const { data: meals = [], isLoading } = useQuery<{ items: UserMeal[] }, Error, UserMeal[]>({
    queryKey: ["/api/user-meals", "all"],
    queryFn: () => fetch("/api/user-meals?limit=100", { credentials: "include" }).then(r => r.json()),
    select: (d) => d.items,
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/user-meals/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-meals"] });
      if (selectedMeal) setSelectedMeal(null);
      toast({ title: "Removed from My Meals" });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const logMutation = useMutation({
    mutationFn: (meal: UserMeal) =>
      apiRequest("POST", "/api/food-log", {
        date: todayStr(),
        mealName: meal.name,
        calories: meal.caloriesPerServing,
        protein: meal.proteinPerServing,
        carbs: meal.carbsPerServing,
        fat: meal.fatPerServing,
        mealSlot: meal.mealSlot ?? undefined,
        source: "meal",
      }).then(r => r.json()),
    onSuccess: (_, meal) => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log", todayStr()] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log/recent"] });
      setLoggingId(null);
      setSelectedMeal(null);
      toast({ title: `${meal.name} logged for today` });
    },
    onError: () => {
      setLoggingId(null);
      toast({ title: "Failed to log meal", variant: "destructive" });
    },
  });

  function handleLog(meal: UserMeal) {
    setLoggingId(meal.id);
    logMutation.mutate(meal);
  }

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-md overflow-hidden">
      <div className="px-6 pt-6 pb-4 flex items-center gap-3">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg shrink-0">
          <Star className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-display font-bold text-zinc-900">Favourites</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Your saved meals, one tap to log</p>
        </div>
      </div>

      <div className="px-6 pb-6">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        ) : meals.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Star className="w-5 h-5 text-zinc-300" />
            </div>
            <p className="text-sm font-medium text-zinc-500 mb-1">No meals yet</p>
            <p className="text-xs text-zinc-400">Star meals from your food log to save them here</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {meals.map(meal => (
              <div key={meal.id} className="group relative">
                <button
                  onClick={() => setSelectedMeal(prev => prev?.id === meal.id ? null : meal)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors text-left"
                  data-testid={`button-favourite-${meal.id}`}
                >
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                    <Utensils className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{meal.name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {meal.caloriesPerServing} kcal · P:{meal.proteinPerServing}g C:{meal.carbsPerServing}g F:{meal.fatPerServing}g
                    </p>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      removeMutation.mutate(meal.id);
                    }}
                    disabled={removeMutation.isPending}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all shrink-0"
                    data-testid={`button-remove-favourite-${meal.id}`}
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>

                {selectedMeal?.id === meal.id && (
                  <div className="mx-1 mb-2 bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-sm font-semibold text-zinc-900 leading-snug pr-4">{meal.name}</p>
                      <button
                        onClick={() => setSelectedMeal(null)}
                        className="text-zinc-400 hover:text-zinc-600 transition-colors shrink-0"
                        data-testid={`button-close-favourite-detail-${meal.id}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-4">
                      <div className="bg-orange-50 rounded-xl p-2 text-center">
                        <p className="text-xs font-bold text-orange-600">{meal.caloriesPerServing}</p>
                        <p className="text-[10px] text-orange-400 mt-0.5">kcal</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-2 text-center">
                        <p className="text-xs font-bold text-blue-600">{meal.proteinPerServing}g</p>
                        <p className="text-[10px] text-blue-400 mt-0.5">protein</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-2 text-center">
                        <p className="text-xs font-bold text-amber-600">{meal.carbsPerServing}g</p>
                        <p className="text-[10px] text-amber-400 mt-0.5">carbs</p>
                      </div>
                      <div className="bg-rose-50 rounded-xl p-2 text-center">
                        <p className="text-xs font-bold text-rose-600">{meal.fatPerServing}g</p>
                        <p className="text-[10px] text-rose-400 mt-0.5">fat</p>
                      </div>
                    </div>

                    {meal.mealSlot && (
                      <p className="text-xs text-zinc-400 mb-3 capitalize">Slot: {meal.mealSlot}</p>
                    )}

                    <button
                      onClick={() => handleLog(meal)}
                      disabled={logMutation.isPending && loggingId === meal.id}
                      className="w-full bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                      data-testid={`button-log-favourite-${meal.id}`}
                    >
                      {logMutation.isPending && loggingId === meal.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Utensils className="w-3.5 h-3.5" />
                          Log this meal today
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
