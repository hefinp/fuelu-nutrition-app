import { useState, useEffect } from "react";
import {
  Utensils, Wheat, Trash2, Loader2, Pencil,
  ChevronDown, ChevronUp, Globe, Repeat,
  ScanBarcode, Sparkles, Search, Link, Camera,
} from "lucide-react";
import type { UserMeal, UserSavedFood } from "@shared/schema";
import { type MealSlot, SLOT_COLOURS, MacroBar, MacroChips } from "@/components/meals-food-shared";

export function getMealKey(meal: UserMeal) {
  return `meal-${meal.id}`;
}

export function getMealSlot(meal: UserMeal): MealSlot | null {
  return meal.mealSlot as MealSlot | null;
}

export function isWebImportedMeal(meal: UserMeal) {
  return meal.source === "imported" && meal.sourceUrl && meal.sourceUrl !== "custom://created" && meal.sourceUrl !== "photo://recipe-book" && !isVideoImportedMeal(meal);
}

export function isVideoImportedMeal(meal: UserMeal) {
  if (meal.source !== "imported" || !meal.sourceUrl) return false;
  return /^https?:\/\/.*(youtube|youtu\.be|instagram|tiktok)/i.test(meal.sourceUrl);
}

export function isPhotoImportedMeal(meal: UserMeal) {
  return meal.source === "imported" && meal.sourceUrl === "photo://recipe-book";
}

export function isImportedMeal(meal: UserMeal) {
  return isWebImportedMeal(meal);
}

interface MealCardProps {
  meal: UserMeal;
  isOpen: boolean;
  onToggle: () => void;
  onLog: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTemplate?: () => void;
  isLogging?: boolean;
  hasTemplate?: boolean;
}

export function MealCard({ meal, isOpen, onToggle, onLog, onEdit, onDelete, onTemplate, isLogging, hasTemplate }: MealCardProps) {
  const slot = getMealSlot(meal);
  const isCustom = meal.source === "manual";
  const hasSourceLink = isWebImportedMeal(meal);
  const isVideo = isVideoImportedMeal(meal);
  const isPhoto = isPhotoImportedMeal(meal);

  const hasStructured = Array.isArray(meal.ingredientsJson) && meal.ingredientsJson.length > 0;
  const [canonicalNames, setCanonicalNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !hasStructured) return;
    fetch(`/api/user-meals/${meal.id}/ingredients`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((rows: Array<{ name: string; canonicalFoodId: number | null }>) => {
        const names = new Set<string>();
        for (const r of rows) {
          if (r.canonicalFoodId != null) names.add(r.name.toLowerCase());
        }
        setCanonicalNames(names);
      })
      .catch(() => {});
  }, [isOpen, meal.id, hasStructured]);

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
            {meal.source === "manual" && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-zinc-100 text-zinc-500">custom</span>}
            {meal.source === "imported" && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-500">imported</span>}
            {isVideo && <Link className="w-3 h-3 text-violet-400" data-testid={`icon-video-source-${meal.id}`} />}
            {isPhoto && <Camera className="w-3 h-3 text-rose-400" data-testid={`icon-photo-source-${meal.id}`} />}
            {hasSourceLink && <Globe className="w-3 h-3 text-blue-400" data-testid={`icon-web-source-${meal.id}`} />}
            {meal.source === "logged" && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-500">logged</span>}
            {meal.source === "community" && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-50 text-purple-500">community</span>}
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

          {(Array.isArray(meal.ingredientsJson) && meal.ingredientsJson.length > 0) ? (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ingredients</p>
              <ul className="text-xs text-zinc-600 space-y-0.5 max-h-28 overflow-y-auto" data-testid={`list-ingredients-${meal.id}`}>
                {(meal.ingredientsJson as Array<{ name: string; grams: number; calories100g: number; protein100g: number; carbs100g: number; fat100g: number }>).map((ing, i) => {
                  const isLinked = canonicalNames.has(ing.name.toLowerCase());
                  return (
                    <li key={i} className="flex items-start gap-1.5" data-testid={`ingredient-item-${meal.id}-${i}`}>
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                      <span className="flex-1">{Math.round(ing.grams)}g {ing.name}</span>
                      {isLinked && (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0" data-testid={`badge-fuelu-db-${meal.id}-${i}`}>FuelU DB</span>
                      )}
                      <span className="text-zinc-400 shrink-0">{Math.round(ing.calories100g * ing.grams / 100)} kcal</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : meal.ingredients ? (
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
          ) : null}

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
              data-testid={`link-web-source-${meal.id}`}
            >
              <Globe className="w-3 h-3" />View original
            </a>
          )}

          {isVideo && meal.sourceUrl && (
            <a
              href={meal.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 mt-2"
              data-testid={`link-video-source-${meal.id}`}
            >
              <Link className="w-3 h-3" />Watch video
            </a>
          )}

          {isPhoto && meal.sourcePhotos && meal.sourcePhotos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {meal.sourcePhotos.map((photoUrl, i) => (
                <a
                  key={i}
                  href={photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700"
                  data-testid={`link-photo-source-${meal.id}-${i}`}
                >
                  <Camera className="w-3 h-3" />View source photo{meal.sourcePhotos!.length > 1 ? ` ${i + 1}` : ""}
                </a>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            {onTemplate && (
              <button
                onClick={onTemplate}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                  hasTemplate
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300"
                }`}
                data-testid={`button-template-meal-${meal.id}`}
              >
                <Repeat className="w-3.5 h-3.5" />
                {hasTemplate ? "Recurring" : "Set recurring"}
              </button>
            )}
            <button
              onClick={onLog}
              disabled={isLogging}
              className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              data-testid={`button-log-meal-${meal.id}`}
            >
              {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Utensils className="w-3.5 h-3.5" />Log today</>}
            </button>
          </div>
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

function FoodSourceBadge({ source }: { source?: string | null }) {
  if (!source) return null;
  const config: Record<string, { label: string; icon: typeof Pencil; bg: string; text: string }> = {
    manual: { label: "Manual", icon: Pencil, bg: "bg-zinc-100", text: "text-zinc-500" },
    search: { label: "Database", icon: Search, bg: "bg-blue-50", text: "text-blue-600" },
    barcode: { label: "Scanned", icon: ScanBarcode, bg: "bg-emerald-50", text: "text-emerald-600" },
    ai: { label: "AI estimate", icon: Sparkles, bg: "bg-violet-50", text: "text-violet-600" },
  };
  const c = config[source];
  if (!c) return null;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${c.bg} ${c.text}`} data-testid="badge-food-source">
      <Icon className="w-2.5 h-2.5" />{c.label}
    </span>
  );
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
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-zinc-900 truncate">{food.name}</p>
            <FoodSourceBadge source={food.source} />
          </div>
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
              <p className="text-xs font-bold text-blue-600">{food.protein100g.toFixed(1)}g</p>
              <p className="text-[10px] text-blue-400">prot</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-1.5 text-center">
              <p className="text-xs font-bold text-amber-600">{food.carbs100g.toFixed(1)}g</p>
              <p className="text-[10px] text-amber-400">carbs</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-1.5 text-center">
              <p className="text-xs font-bold text-rose-600">{food.fat100g.toFixed(1)}g</p>
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
