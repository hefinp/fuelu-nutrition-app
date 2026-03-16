import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Coffee, Salad, Moon, Apple, X, ExternalLink, Pencil, Loader2,
} from "lucide-react";
import type { SavedMealPlan, UserMeal } from "@shared/schema";

export interface RecipeDetail {
  instructions: string;
  ingredients: Array<{ item: string; quantity: string }>;
}

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface FoodResult {
  id: string;
  name: string;
  calories100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  servingSize: string;
  servingGrams: number;
}

export interface ExtendedFoodResult extends FoodResult {
  fibre100g?: number;
  sodium100g?: number;
  sugar100g?: number;
  saturatedFat100g?: number;
  source?: string;
  sourceType?: "label" | "estimated";
}

export interface FoodLogEntry {
  id: number;
  date: string;
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre?: number | null;
  sugar?: number | null;
  saturatedFat?: number | null;
  mealSlot: MealSlot | null;
  confirmed: boolean;
  createdAt: string;
}

export interface PrefillEntry {
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealSlot?: MealSlot | null;
}

export interface PlanMeal {
  slot: string;
  meal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const SLOT_ICONS: Record<MealSlot, typeof Coffee> = {
  breakfast: Coffee,
  lunch: Salad,
  dinner: Moon,
  snack: Apple,
};

export const SLOT_COLORS: Record<MealSlot, string> = {
  breakfast: "text-amber-600 bg-amber-50",
  lunch: "text-green-600 bg-green-50",
  dinner: "text-indigo-600 bg-indigo-50",
  snack: "text-pink-600 bg-pink-50",
};

export const ALL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
export const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export const WEEK_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MEAL_SLOTS_PLAN = ["breakfast", "lunch", "dinner", "snacks"] as const;

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateStr(dt);
}

export function getWeekRange(weekOffset = 0): { from: string; to: string; days: string[] } {
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7) + weekOffset * 7);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(toDateStr(d));
  }
  return { from: days[0], to: days[6], days };
}

export function formatWeekLabel(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [, tm, td] = to.split("-").map(Number);
  const fromDate = new Date(fy, fm - 1, fd);
  const fromStr = fromDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const toStr = new Date(fy, tm - 1, td).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fromStr} – ${toStr}`;
}

export function normalizeSlot(slot: string): MealSlot | null {
  const s = slot.toLowerCase();
  if (s.includes("breakfast")) return "breakfast";
  if (s.includes("lunch")) return "lunch";
  if (s.includes("dinner")) return "dinner";
  if (s.includes("snack")) return "snack";
  return null;
}

interface PlanMealData {
  meal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

type PlanSlotData = PlanMealData[];
type DailyPlanData = Record<string, PlanSlotData>;
type WeeklyPlanData = Record<string, DailyPlanData>;

export function extractPlanMeals(plan: SavedMealPlan, selectedDay?: string): PlanMeal[] {
  const meals: PlanMeal[] = [];
  if (plan.planType === "daily") {
    const data = plan.planData as DailyPlanData;
    for (const slot of MEAL_SLOTS_PLAN) {
      const slotMeals: PlanMealData[] = (data[slot] as PlanSlotData) ?? [];
      for (const m of slotMeals) {
        meals.push({ slot: slot.charAt(0).toUpperCase() + slot.slice(1), meal: m.meal, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat });
      }
    }
  } else {
    const data = plan.planData as WeeklyPlanData;
    const dayKey = selectedDay ?? "monday";
    const dayPlan: DailyPlanData = (data[dayKey] as DailyPlanData) ?? {};
    for (const slot of MEAL_SLOTS_PLAN) {
      const slotMeals: PlanMealData[] = (dayPlan[slot] as PlanSlotData) ?? [];
      for (const m of slotMeals) {
        meals.push({ slot: slot.charAt(0).toUpperCase() + slot.slice(1), meal: m.meal, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat });
      }
    }
  }
  return meals;
}

export function ProgressBar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const over = value > max && max > 0;
  const barTestId = label ? `progress-${label.toLowerCase().replace(/[.\s]+/g, "-")}-fill` : undefined;
  return (
    <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`h-full rounded-full transition-all ${over ? "bg-red-600" : color}`}
        style={{ width: `${pct}%` }}
        data-testid={barTestId}
        data-pct={pct}
      />
    </div>
  );
}

export function MacroGrid({
  cal, prot, carbs, fat, fibre, sugar, saturatedFat,
  calTarget, protTarget, carbsTarget, fatTarget, fibreTarget, sugarTarget, saturatedFatTarget,
}: {
  cal: number; prot: number; carbs: number; fat: number;
  fibre?: number; sugar?: number; saturatedFat?: number;
  calTarget?: number; protTarget?: number; carbsTarget?: number; fatTarget?: number;
  fibreTarget?: number; sugarTarget?: number; saturatedFatTarget?: number;
}) {
  const primary = [
    { label: "Calories", value: cal, target: calTarget, color: "bg-green-500", unit: "kcal" },
    { label: "Protein", value: prot, target: protTarget, color: "bg-red-400", unit: "g" },
    { label: "Carbs", value: carbs, target: carbsTarget, color: "bg-blue-400", unit: "g" },
    { label: "Fat", value: fat, target: fatTarget, color: "bg-yellow-400", unit: "g" },
  ];
  const secondary = [
    { label: "Fibre", value: fibre ?? 0, target: fibreTarget, color: "bg-emerald-500", unit: "g" },
    { label: "Sugar", value: sugar ?? 0, target: sugarTarget, color: "bg-pink-400", unit: "g" },
    { label: "Sat. Fat", value: saturatedFat ?? 0, target: saturatedFatTarget, color: "bg-orange-400", unit: "g" },
  ];
  const hasSubMacros = fibre != null || sugar != null || saturatedFat != null;

  function MacroCell({ label, value, target, color, unit }: { label: string; value: number; target?: number; color: string; unit: string }) {
    const exceeded = target != null && target > 0 && value > target;
    const testId = `macro-${label.toLowerCase().replace(/[.\s]+/g, "-")}`;
    return (
      <div className="bg-zinc-50 rounded-xl p-3" data-testid={testId}>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs text-zinc-500 font-medium">{label}</span>
          <span className={`text-xs font-bold ${exceeded ? "text-red-600" : "text-zinc-900"}`} data-testid={`${testId}-value`}>
            {value}<span className="font-normal text-zinc-400">/{target ?? "–"}{unit}</span>
          </span>
        </div>
        <ProgressBar value={value} max={target ?? 0} color={color} label={label} />
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {primary.map(p => <MacroCell key={p.label} {...p} />)}
      </div>
      {hasSubMacros && (
        <div className="grid grid-cols-3 gap-2">
          {secondary.map(s => <MacroCell key={s.label} {...s} />)}
        </div>
      )}
    </div>
  );
}

export function LoggedMealModal({
  entry,
  userRecipes,
  recipes,
  onClose,
}: {
  entry: FoodLogEntry;
  userRecipes: UserMeal[];
  recipes?: Record<string, RecipeDetail>;
  onClose: () => void;
}) {
  const recipe = recipes?.[entry.mealName];
  const webRecipe = userRecipes.find(
    r => r.name.toLowerCase() === entry.mealName.toLowerCase()
  );

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    mealName: entry.mealName,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    fibre: entry.fibre ?? 0,
    sugar: entry.sugar ?? 0,
    saturatedFat: entry.saturatedFat ?? 0,
    mealSlot: entry.mealSlot,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (updates: typeof form) => {
      const res = await apiRequest("PATCH", `/api/food-log/${entry.id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week"] });
      toast({ title: "Entry updated" });
      setEditing(false);
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to update entry", variant: "destructive" });
    },
  });

  const setField = (key: keyof typeof form, value: string | number | null) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const numField = (label: string, key: keyof typeof form, color: string) => (
    <div className={`${color} p-2.5 rounded-lg`}>
      <label className="text-xs font-medium block mb-1">{label}</label>
      {editing ? (
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={form[key] as number}
          onChange={e => setField(key, Math.max(0, parseInt(e.target.value) || 0))}
          className="w-full bg-white/80 rounded-lg px-2 py-1.5 text-sm font-bold border border-zinc-200 min-h-[44px]"
          data-testid={`input-edit-${key}`}
        />
      ) : (
        <p className="text-lg font-bold">{entry[key] as number}{key !== "calories" ? "g" : ""}</p>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl my-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          {editing ? (
            <input
              type="text"
              value={form.mealName}
              onChange={e => setField("mealName", e.target.value)}
              className="text-xl font-bold text-zinc-900 pr-4 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 w-full min-h-[44px]"
              data-testid="input-edit-mealName"
            />
          ) : (
            <h3 className="text-xl font-bold text-zinc-900 pr-4">{entry.mealName}</h3>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 rounded-lg transition-colors shrink-0"
            data-testid="button-close-meal-detail"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {editing && (
          <div className="mb-4">
            <label className="text-xs font-medium text-zinc-600 block mb-1">Meal slot</label>
            <select
              value={form.mealSlot ?? ""}
              onChange={e => setField("mealSlot", e.target.value || null)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm min-h-[44px]"
              data-testid="select-edit-mealSlot"
            >
              <option value="">No slot</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-5">
          {numField("Calories", "calories", "bg-orange-50 text-orange-700")}
          {numField("Protein", "protein", "bg-red-50 text-red-700")}
          {numField("Carbs", "carbs", "bg-blue-50 text-blue-700")}
          {numField("Fat", "fat", "bg-yellow-50 text-yellow-700")}
        </div>

        {editing && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            {numField("Fibre", "fibre", "bg-green-50 text-green-700")}
            {numField("Sugar", "sugar", "bg-pink-50 text-pink-700")}
            {numField("Sat. Fat", "saturatedFat", "bg-purple-50 text-purple-700")}
          </div>
        )}

        {!editing && (
          <>
            {recipe ? (
              <>
                <div className="bg-zinc-50 p-4 rounded-xl mb-4">
                  <h4 className="text-sm font-semibold text-zinc-900 mb-3">Ingredients</h4>
                  <ul className="space-y-2">
                    {recipe.ingredients.map((ing, idx) => (
                      <li key={idx} className="flex justify-between text-sm text-zinc-700">
                        <span>{ing.item}</span>
                        <span className="font-medium text-zinc-900">{ing.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-zinc-50 p-4 rounded-xl mb-4">
                  <h4 className="text-sm font-semibold text-zinc-900 mb-2">Instructions</h4>
                  <p className="text-sm text-zinc-600 leading-relaxed">{recipe.instructions}</p>
                </div>
              </>
            ) : !webRecipe ? (
              <p className="text-zinc-500 text-sm mb-4">No recipe details available for this meal.</p>
            ) : null}

            {webRecipe && (
              <div className="bg-zinc-50 p-4 rounded-xl mb-4">
                <h4 className="text-sm font-semibold text-zinc-900 mb-2">Recipe source</h4>
                <a
                  href={webRecipe.sourceUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
                  data-testid="link-recipe-source"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  {webRecipe.sourceUrl}
                </a>
              </div>
            )}
          </>
        )}

        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => {
                  setForm({
                    mealName: entry.mealName,
                    calories: entry.calories,
                    protein: entry.protein,
                    carbs: entry.carbs,
                    fat: entry.fat,
                    fibre: entry.fibre ?? 0,
                    sugar: entry.sugar ?? 0,
                    saturatedFat: entry.saturatedFat ?? 0,
                    mealSlot: entry.mealSlot,
                  });
                  setEditing(false);
                }}
                className="flex-1 px-4 py-2 bg-zinc-100 text-zinc-700 rounded-xl font-medium hover:bg-zinc-200 transition-colors min-h-[48px]"
                data-testid="button-cancel-edit"
              >
                Cancel
              </button>
              <button
                onClick={() => updateMutation.mutate(form)}
                disabled={updateMutation.isPending || !form.mealName.trim()}
                className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 min-h-[48px]"
                data-testid="button-save-edit"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-700 rounded-xl font-medium hover:bg-zinc-200 transition-colors min-h-[48px]"
                data-testid="button-edit-entry"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors min-h-[48px]"
                data-testid="button-close-meal-detail-bottom"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
