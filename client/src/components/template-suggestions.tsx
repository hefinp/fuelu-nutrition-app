import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Repeat, Plus, X, Loader2 } from "lucide-react";
import { type MealSlot, SLOT_COLOURS } from "@/components/meals-food-shared";

interface TemplateSuggestion {
  templateId: number;
  mealSlot: string;
  meal: {
    id: number;
    name: string;
    caloriesPerServing: number;
    proteinPerServing: number;
    carbsPerServing: number;
    fatPerServing: number;
    mealSlot: string | null;
  };
}

interface Props {
  date: string;
}

export function TemplateSuggestions({ date }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suggestions = [] } = useQuery<TemplateSuggestion[]>({
    queryKey: ["/api/meal-templates/suggestions", date],
    queryFn: async () => {
      const res = await fetch(`/api/meal-templates/suggestions?date=${date}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (s: TemplateSuggestion) =>
      apiRequest("POST", "/api/food-log", {
        date,
        mealName: s.meal.name,
        calories: s.meal.caloriesPerServing,
        protein: Math.round(s.meal.proteinPerServing),
        carbs: Math.round(s.meal.carbsPerServing),
        fat: Math.round(s.meal.fatPerServing),
        mealSlot: s.mealSlot,
        source: "meal",
      }).then(r => r.json()),
    onSuccess: (_, s) => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log", date] });
      queryClient.invalidateQueries({ queryKey: ["/api/meal-templates/suggestions", date] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log/recent"] });
      toast({ title: `${s.meal.name} added to log` });
    },
    onError: () => toast({ title: "Failed to add meal", variant: "destructive" }),
  });

  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  function dismiss(templateId: number) {
    setDismissed(prev => new Set(prev).add(templateId));
  }

  const visible = suggestions.filter(s => !dismissed.has(s.templateId));
  if (visible.length === 0) return null;

  return (
    <div className="mb-4 space-y-1.5" data-testid="template-suggestions">
      <div className="flex items-center gap-1.5 mb-1">
        <Repeat className="w-3.5 h-3.5 text-emerald-500" />
        <p className="text-xs font-medium text-zinc-500">Recurring meals for today</p>
      </div>
      {visible.map(s => {
        const slot = s.mealSlot as MealSlot;
        return (
          <div
            key={s.templateId}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50"
            data-testid={`suggestion-${s.templateId}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-medium text-zinc-800 truncate">{s.meal.name}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SLOT_COLOURS[slot]}`}>{slot}</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {s.meal.caloriesPerServing} kcal · P:{Math.round(s.meal.proteinPerServing)}g · C:{Math.round(s.meal.carbsPerServing)}g · F:{Math.round(s.meal.fatPerServing)}g
              </p>
            </div>
            <button
              onClick={() => addMutation.mutate(s)}
              disabled={addMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors min-h-[32px] shrink-0"
              data-testid={`button-add-suggestion-${s.templateId}`}
            >
              {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add
            </button>
            <button
              onClick={() => dismiss(s.templateId)}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors shrink-0"
              data-testid={`button-skip-suggestion-${s.templateId}`}
              title="Skip"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
