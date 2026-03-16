import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X, Loader2, Calendar, Repeat, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import type { UserMeal, MealTemplate } from "@shared/schema";
import { type MealSlot, SLOT_OPTIONS, SLOT_COLOURS } from "@/components/meals-food-shared";

const DAYS = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
] as const;

interface Props {
  meal: UserMeal;
  existingTemplate?: MealTemplate | null;
  onClose: () => void;
}

export function MealTemplateModal({ meal, existingTemplate, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSlot, setSelectedSlot] = useState<MealSlot>(
    (existingTemplate?.mealSlot as MealSlot) || (meal.mealSlot as MealSlot) || "breakfast"
  );
  const [selectedDays, setSelectedDays] = useState<Set<string>>(
    new Set(existingTemplate?.daysOfWeek ?? [])
  );
  const [isActive, setIsActive] = useState(existingTemplate?.active !== false);

  function toggleDay(day: string) {
    setSelectedDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  }

  function selectAll() {
    setSelectedDays(new Set(DAYS.map(d => d.value)));
  }

  function selectWeekdays() {
    setSelectedDays(new Set(DAYS.slice(0, 5).map(d => d.value)));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (existingTemplate) {
        return apiRequest("PATCH", `/api/meal-templates/${existingTemplate.id}`, {
          mealSlot: selectedSlot,
          daysOfWeek: Array.from(selectedDays),
          active: isActive,
        }).then(r => r.json());
      }
      return apiRequest("POST", "/api/meal-templates", {
        userMealId: meal.id,
        mealSlot: selectedSlot,
        daysOfWeek: Array.from(selectedDays),
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-templates"] });
      toast({ title: existingTemplate ? "Template updated" : `${meal.name} set as recurring` });
      onClose();
    },
    onError: () => toast({ title: "Failed to save template", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingTemplate) return;
      return apiRequest("DELETE", `/api/meal-templates/${existingTemplate.id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-templates"] });
      toast({ title: "Recurring template removed" });
      onClose();
    },
    onError: () => toast({ title: "Failed to remove template", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-emerald-600" />
            <h2 className="font-display font-semibold text-zinc-900">
              {existingTemplate ? "Edit Template" : "Set as Recurring"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors" data-testid="button-template-close">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          <div className="bg-zinc-50 rounded-xl p-3">
            <p className="text-sm font-medium text-zinc-900">{meal.name}</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {meal.caloriesPerServing} kcal · P:{meal.proteinPerServing}g · C:{meal.carbsPerServing}g · F:{meal.fatPerServing}g
            </p>
          </div>

          {existingTemplate && (
            <div className="flex items-center justify-between bg-zinc-50 rounded-xl p-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">Active</p>
                <p className="text-xs text-zinc-400">Suggestions appear when active</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className="text-zinc-900"
                data-testid="button-template-toggle-active"
              >
                {isActive ? (
                  <ToggleRight className="w-8 h-8 text-emerald-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-zinc-300" />
                )}
              </button>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-zinc-700 mb-2 block">Meal slot</label>
            <div className="flex gap-1.5 flex-wrap">
              {SLOT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedSlot(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedSlot === opt.value
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                  }`}
                  data-testid={`button-template-slot-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 mb-2 block">Repeat on</label>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {DAYS.map(day => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`w-10 h-10 rounded-xl text-xs font-medium border transition-all ${
                    selectedDays.has(day.value)
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                  }`}
                  data-testid={`button-template-day-${day.value}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-[11px] text-zinc-500 hover:text-zinc-700 font-medium"
                data-testid="button-template-select-all"
              >
                Every day
              </button>
              <span className="text-zinc-300">·</span>
              <button
                onClick={selectWeekdays}
                className="text-[11px] text-zinc-500 hover:text-zinc-700 font-medium"
                data-testid="button-template-select-weekdays"
              >
                Weekdays
              </button>
            </div>
          </div>

          {selectedDays.size > 0 && (
            <div className="bg-emerald-50 rounded-xl p-3 flex items-start gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700">
                {meal.name} will be suggested for <span className="font-semibold">{selectedSlot}</span> on{" "}
                <span className="font-semibold">
                  {selectedDays.size === 7
                    ? "every day"
                    : Array.from(selectedDays).map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ")}
                </span>.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 shrink-0 space-y-2">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={selectedDays.size === 0 || saveMutation.isPending}
            className="w-full py-3 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 min-h-[48px]"
            data-testid="button-template-save"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : existingTemplate ? (
              "Update Template"
            ) : (
              "Set Recurring"
            )}
          </button>
          {existingTemplate && (
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="w-full py-2.5 text-red-500 text-xs font-medium rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
              data-testid="button-template-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Remove recurring template
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
