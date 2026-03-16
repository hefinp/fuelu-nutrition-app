import {
  Utensils, Wheat, Trash2, Loader2, Pencil,
  ChevronDown, ChevronUp, Globe,
} from "lucide-react";
import type { UserMeal, UserSavedFood } from "@shared/schema";
import { type MealSlot, SLOT_COLOURS, MacroBar, MacroChips } from "@/components/meals-food-shared";

export function getMealKey(meal: UserMeal) {
  return `meal-${meal.id}`;
}

export function getMealSlot(meal: UserMeal): MealSlot | null {
  return meal.mealSlot as MealSlot | null;
}

export function isImportedMeal(meal: UserMeal) {
  return meal.source === "imported" && meal.sourceUrl && meal.sourceUrl !== "custom://created" && meal.sourceUrl !== "photo://recipe-book";
}

interface MealCardProps {
  meal: UserMeal;
  isOpen: boolean;
  onToggle: () => void;
  onLog: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isLogging?: boolean;
}

export function MealCard({ meal, isOpen, onToggle, onLog, onEdit, onDelete, isLogging }: MealCardProps) {
  const slot = getMealSlot(meal);
  const isCustom = meal.source === "manual";
  const hasSourceLink = isImportedMeal(meal);

  return (
    <div className="group relative rounded-xl border border-zinc-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 transition-colors text-left"
        data-testid={`button-meal-${meal.id}`}
      >
        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
          <Utensils className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium text-zinc-900 truncate">{meal.name}</p>
            {slot && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SLOT_COLOURS[slot]}`}>{slot}</span>}
            {isCustom && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-zinc-100 text-zinc-500">custom</span>}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">{meal.caloriesPerServing} kcal · P:{meal.proteinPerServing}g · C:{meal.carbsPerServing}g · F:{meal.fatPerServing}g</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
            data-testid={`button-edit-meal-${meal.id}`}
            title="Edit"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            data-testid={`button-delete-meal-${meal.id}`}
            title="Remove"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <div className="text-zinc-300 ml-1">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 bg-zinc-50 border-t border-zinc-100">
          <MacroChips cal={meal.caloriesPerServing} p={meal.proteinPerServing} c={meal.carbsPerServing} f={meal.fatPerServing} />
          <MacroBar p={meal.proteinPerServing} c={meal.carbsPerServing} f={meal.fatPerServing} />

          {meal.ingredients && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ingredients</p>
              <ul className="text-xs text-zinc-600 space-y-0.5 max-h-28 overflow-y-auto">
                {meal.ingredients.split("\n").filter(Boolean).map((ing, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-300 shrink-0" />{ing}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meal.instructions && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Instructions</p>
              <p className="text-xs text-zinc-600 leading-relaxed line-clamp-4">{meal.instructions}</p>
            </div>
          )}

          {hasSourceLink && (
            <a
              href={meal.sourceUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 mt-2"
            >
              <Globe className="w-3 h-3" />View original
            </a>
          )}

          <button
            onClick={onLog}
            disabled={isLogging}
            className="w-full mt-3 py-2.5 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            data-testid={`button-log-meal-${meal.id}`}
          >
            {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Utensils className="w-3.5 h-3.5" />Log today</>}
          </button>
        </div>
      )}
    </div>
  );
}

interface FoodCardProps {
  food: UserSavedFood;
  isOpen: boolean;
  onToggle: () => void;
  onLog: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isLogging?: boolean;
}

export function FoodCard({ food, isOpen, onToggle, onLog, onEdit, onDelete, isLogging }: FoodCardProps) {
  return (
    <div className="group relative rounded-xl border border-zinc-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 transition-colors text-left"
        data-testid={`button-food-${food.id}`}
      >
        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
          <Wheat className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 truncate">{food.name}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{food.calories100g} kcal / 100g · {food.servingGrams}g serving</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            data-testid={`button-edit-food-${food.id}`}
            title="Edit"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            data-testid={`button-delete-food-${food.id}`}
            title="Remove"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <div className="text-zinc-300 ml-1">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 bg-zinc-50 border-t border-zinc-100">
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            <div className="bg-orange-50 rounded-lg p-1.5 text-center">
              <p className="text-xs font-bold text-orange-600">{food.calories100g}</p>
              <p className="text-[10px] text-orange-400">kcal</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-1.5 text-center">
              <p className="text-xs font-bold text-blue-600">{Number(food.protein100g).toFixed(1)}g</p>
              <p className="text-[10px] text-blue-400">prot</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-1.5 text-center">
              <p className="text-xs font-bold text-amber-600">{Number(food.carbs100g).toFixed(1)}g</p>
              <p className="text-[10px] text-amber-400">carbs</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-1.5 text-center">
              <p className="text-xs font-bold text-rose-600">{Number(food.fat100g).toFixed(1)}g</p>
              <p className="text-[10px] text-rose-400">fat</p>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2">Default serving: {food.servingGrams}g</p>
          <button
            onClick={onLog}
            disabled={isLogging}
            className="w-full mt-3 py-2.5 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            data-testid={`button-log-food-${food.id}`}
          >
            {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Utensils className="w-3.5 h-3.5" />Log {food.servingGrams}g today</>}
          </button>
        </div>
      )}
    </div>
  );
}
