import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { NotebookPen, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import {
  MacroGrid, SLOT_ICONS, SLOT_COLORS, SLOT_LABELS,
  todayStr, formatDateLabel, shiftDate,
} from "@/components/food-log-shared";
import type { FoodLogEntry, MealSlot } from "@/components/food-log-shared";

interface MyDiaryWidgetProps {
  calTarget?: number;
  protTarget?: number;
  carbsTarget?: number;
  fatTarget?: number;
}

export function MyDiaryWidget({ calTarget, protTarget, carbsTarget, fatTarget }: MyDiaryWidgetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;

  const { data: dailyEntries = [], isLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?date=${selectedDate}`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load food log");
      return res.json();
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/food-log/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  const confirmedEntries = dailyEntries.filter(e => e.confirmed !== false);
  const totalCal = confirmedEntries.reduce((s, e) => s + e.calories, 0);
  const totalProt = confirmedEntries.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = confirmedEntries.reduce((s, e) => s + e.carbs, 0);
  const totalFat = confirmedEntries.reduce((s, e) => s + e.fat, 0);

  const slotOrder: (MealSlot | null)[] = ["breakfast", "lunch", "dinner", "snack", "drinks", null];
  const grouped: Record<string, FoodLogEntry[]> = {};
  for (const entry of dailyEntries) {
    const key = entry.mealSlot ?? "__none__";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }
  const orderedSlots = slotOrder.filter(s => grouped[s ?? "__none__"]?.length > 0);

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-md p-4 sm:p-6" data-testid="widget-my-diary">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
          <NotebookPen className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-display font-bold text-zinc-900">My Diary</h3>
          <p className="text-xs text-zinc-400">Your daily food log</p>
        </div>
      </div>

      <div className="flex items-center justify-between bg-zinc-50 rounded-xl px-2 py-1.5 mb-4">
        <button
          onClick={() => setSelectedDate(d => shiftDate(d, -1))}
          className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
          data-testid="button-diary-widget-prev-day"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <span className="text-sm font-semibold text-zinc-800" data-testid="text-diary-widget-date">
            {isToday ? "Today" : formatDateLabel(selectedDate)}
          </span>
          {isToday && <span className="block text-[10px] text-zinc-400">{formatDateLabel(selectedDate)}</span>}
          {!isToday && (
            <button
              onClick={() => setSelectedDate(today)}
              className="block mx-auto text-[10px] text-zinc-400 hover:text-zinc-600 font-medium transition-colors mt-0.5"
              data-testid="button-diary-widget-go-to-today"
            >
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => setSelectedDate(d => shiftDate(d, 1))}
          className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
          data-testid="button-diary-widget-next-day"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <MacroGrid
        cal={totalCal} prot={totalProt} carbs={totalCarbs} fat={totalFat}
        calTarget={calTarget} protTarget={protTarget}
        carbsTarget={carbsTarget} fatTarget={fatTarget}
      />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : dailyEntries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <NotebookPen className="w-8 h-8 text-zinc-300" />
          <p className="text-sm text-zinc-400">No meals logged for this day</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto -mx-1 px-1">
          {orderedSlots.map(slot => {
            const key = slot ?? "__none__";
            const entries = grouped[key] ?? [];
            const SlotIcon = slot ? SLOT_ICONS[slot] : null;
            const slotColor = slot ? SLOT_COLORS[slot] : null;
            const label = slot ? SLOT_LABELS[slot] : "Other";

            return (
              <div key={key}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {SlotIcon && slotColor && (
                    <span className={`p-1 rounded-md ${slotColor}`}>
                      <SlotIcon className="w-3 h-3" />
                    </span>
                  )}
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</span>
                </div>
                <div className="space-y-1">
                  {entries.map(entry => {
                    const isPlanned = entry.confirmed === false;
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-2 rounded-xl p-2.5 ${isPlanned ? "bg-zinc-50/60 border border-dashed border-zinc-200 opacity-70" : "bg-zinc-50"}`}
                        data-testid={`diary-widget-entry-${entry.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">
                            {entry.mealName}
                            {isPlanned && <span className="ml-1.5 text-[10px] font-normal text-zinc-400">(Planned)</span>}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {entry.calories} kcal · P:{entry.protein}g C:{entry.carbs}g F:{entry.fat}g
                          </p>
                        </div>
                        <button
                          onClick={() => deleteMutation.mutate(entry.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                          data-testid={`button-diary-widget-delete-${entry.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
