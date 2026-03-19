import { motion } from "framer-motion";
import { X, UtensilsCrossed } from "lucide-react";
import { RECIPES } from "../results-recipes";
import type { Meal } from "./types";

interface RecipeModalProps {
  meal: Meal;
  onClose: () => void;
}

function MacroTiles({ meal }: { meal: Meal }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Calories</p>
        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{meal.calories}</p>
      </div>
      <div className="rounded-lg p-3" style={{ backgroundColor: "hsl(var(--chart-1) / 0.1)" }}>
        <p className="text-xs font-medium" style={{ color: "hsl(var(--chart-1))" }}>Protein</p>
        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{meal.protein}g</p>
      </div>
      <div className="rounded-lg p-3" style={{ backgroundColor: "hsl(var(--chart-2) / 0.1)" }}>
        <p className="text-xs font-medium" style={{ color: "hsl(var(--chart-2))" }}>Carbs</p>
        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{meal.carbs}g</p>
      </div>
      <div className="rounded-lg p-3" style={{ backgroundColor: "hsl(var(--chart-3) / 0.1)" }}>
        <p className="text-xs font-medium" style={{ color: "hsl(var(--chart-3))" }}>Fat</p>
        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{meal.fat}g</p>
      </div>
    </div>
  );
}

export function RecipeModal({ meal, onClose }: RecipeModalProps) {
  const recipe = RECIPES[meal.meal];
  const hasStructuredIngredients = Array.isArray(meal.ingredientsJson) && meal.ingredientsJson.length > 0;

  if (!recipe && !hasStructuredIngredients) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100" data-testid="text-recipe-modal-title">{meal.meal}</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              data-testid="button-close-recipe-modal"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <UtensilsCrossed className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No recipe details available for this meal.</p>
          </div>

          <div className="mb-4">
            <MacroTiles meal={meal} />
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            data-testid="button-close-recipe"
          >
            Close
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100" data-testid="text-recipe-modal-title">{meal.meal}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            data-testid="button-close-recipe-modal"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="mb-6">
          <MacroTiles meal={meal} />
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl mb-4">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Ingredients</h4>
          {Array.isArray(meal.ingredientsJson) && meal.ingredientsJson.length > 0 ? (
            <ul className="space-y-1.5">
              {meal.ingredientsJson.map((ing, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-sm text-zinc-700 dark:text-zinc-300" data-testid={`plan-ingredient-${idx}`}>
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="flex-1">{Math.round(ing.grams)}g {ing.name}</span>
                  <span className="text-zinc-400 dark:text-zinc-500 shrink-0">{Math.round(ing.calories100g * ing.grams / 100)} kcal</span>
                </li>
              ))}
            </ul>
          ) : recipe ? (
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, idx) => (
                <li key={idx} className="flex justify-between text-sm text-zinc-700 dark:text-zinc-300">
                  <span>{ing.item}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{ing.quantity}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {recipe?.instructions && (
          <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl mb-4">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Instructions</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{recipe.instructions}</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          data-testid="button-close-recipe"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}
