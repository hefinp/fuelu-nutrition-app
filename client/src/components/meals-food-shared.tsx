import { useState, useRef, useEffect } from "react";
import { Sun, Sunset, Moon, Cookie } from "lucide-react";
import type { UserSavedFood } from "@shared/schema";
import type { FoodResult, ExtendedFoodResult } from "@/components/food-log-shared";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type ActiveTab = "meals" | "foods" | "saved-plans";
export type ImportStep = "method" | "url" | "photo" | "video" | "confirm";
export type AddFoodTab = "search" | "scan" | "ai" | "manual" | "restaurants";
export type PickerTab = "myfoods" | "search" | "scan" | "ai";

export const SLOT_OPTIONS: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export const SLOT_COLOURS: Record<MealSlot, string> = {
  breakfast: "bg-amber-50 text-amber-700",
  lunch: "bg-green-50 text-green-700",
  dinner: "bg-blue-50 text-blue-700",
  snack: "bg-purple-50 text-purple-700",
};

export interface DivergenceWarning {
  calculatedCalories: number;
  statedCalories: number;
  ratio: number;
  message: string;
  isExtreme?: boolean;
}

export interface ParsedRecipe {
  name: string;
  imageUrl: string | null;
  ingredients: string[];
  ingredientsJson?: Ingredient[];
  instructions: string[];
  servings: number;
  sourceUrl: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  hasNutrition: boolean;
  suggestedSlot: string | null;
  divergenceWarning?: DivergenceWarning | null;
}

export interface Ingredient {
  key: string;
  name: string;
  calories100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  grams: number;
  sourceDetail?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  usda_cached: "USDA",
  nzfcd: "NZFCD",
  ausnut: "AUSNUT",
  fsanz: "FSANZ",
  barcode_scan: "Barcode",
  openfoodfacts: "OFF",
  open_food_facts: "OFF",
  nz_regional: "NZ",
  au_regional: "AU",
  restaurant_nz: "Restaurant",
  user_manual: "Manual",
  ingredient_parsed: "Parsed",
  ai_generated: "AI estimate",
  db: "Database",
};

export function getSourceLabel(source?: string): string {
  if (!source) return "";
  return SOURCE_LABELS[source] ?? source;
}

export function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MacroBar({ p, c, f }: { p: number; c: number; f: number }) {
  const total = p + c + f || 1;
  return (
    <div className="flex h-1 rounded-full overflow-hidden gap-px mt-1.5">
      <div className="bg-blue-400" style={{ width: `${(p / total) * 100}%` }} />
      <div className="bg-amber-400" style={{ width: `${(c / total) * 100}%` }} />
      <div className="bg-rose-400" style={{ width: `${(f / total) * 100}%` }} />
    </div>
  );
}

export function MacroChips({ cal, p, c, f }: { cal: number; p: number; c: number; f: number }) {
  return (
    <div className="grid grid-cols-4 gap-1 sm:gap-1.5 mt-2">
      <div className="bg-orange-50 rounded-lg p-1 sm:p-1.5 text-center">
        <p className="text-xs font-bold text-orange-600">{cal}</p>
        <p className="text-[10px] text-orange-400">kcal</p>
      </div>
      <div className="bg-blue-50 rounded-lg p-1 sm:p-1.5 text-center">
        <p className="text-xs font-bold text-blue-600">{p}g</p>
        <p className="text-[10px] text-blue-400">prot</p>
      </div>
      <div className="bg-amber-50 rounded-lg p-1 sm:p-1.5 text-center">
        <p className="text-xs font-bold text-amber-600">{c}g</p>
        <p className="text-[10px] text-amber-400">carbs</p>
      </div>
      <div className="bg-rose-50 rounded-lg p-1 sm:p-1.5 text-center">
        <p className="text-xs font-bold text-rose-600">{f}g</p>
        <p className="text-[10px] text-rose-400">fat</p>
      </div>
    </div>
  );
}

export function ingredientFromSaved(f: UserSavedFood): Ingredient {
  return { key: `saved-${f.id}`, name: f.name, calories100g: f.calories100g, protein100g: f.protein100g, carbs100g: f.carbs100g, fat100g: f.fat100g, grams: f.servingGrams };
}

export function ingredientFromSearch(f: FoodResult | ExtendedFoodResult): Ingredient {
  return { key: `search-${f.id}-${Date.now()}`, name: f.name, calories100g: f.calories100g, protein100g: f.protein100g, carbs100g: f.carbs100g, fat100g: f.fat100g, grams: 100 };
}

export function slotForTimeOfDay(): MealSlot {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

const SLOT_PICKER_OPTIONS: { value: MealSlot; label: string; icon: typeof Sun }[] = [
  { value: "breakfast", label: "Breakfast", icon: Sunset },
  { value: "lunch", label: "Lunch", icon: Sun },
  { value: "dinner", label: "Dinner", icon: Moon },
  { value: "snack", label: "Snack", icon: Cookie },
];

interface SlotPickerProps {
  defaultSlot: MealSlot;
  onSelect: (slot: MealSlot) => void;
  onClose: () => void;
}

export function SlotPicker({ defaultSlot, onSelect, onClose }: SlotPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="flex gap-1.5 flex-wrap" data-testid="slot-picker">
      {SLOT_PICKER_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={(e) => { e.stopPropagation(); onSelect(opt.value); }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            opt.value === defaultSlot
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
          data-testid={`slot-option-${opt.value}`}
        >
          <opt.icon className="w-3 h-3" />
          {opt.label}
        </button>
      ))}
    </div>
  );
}
