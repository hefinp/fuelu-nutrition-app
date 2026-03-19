import { motion } from "framer-motion";
import { X } from "lucide-react";
import { RECIPES } from "../results-recipes";
import type { Meal } from "./types";

interface RecipeModalProps {
  meal: Meal;
  onClose: () => void;
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
          className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-zinc-600">Recipe not available for this meal.</p>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
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
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900">{meal.meal}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-xs text-orange-600 font-medium">Calories</p>
            <p className="text-lg font-bold text-orange-700">{meal.calories}</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-xs text-red-600 font-medium">Protein</p>
            <p className="text-lg font-bold text-red-700">{meal.protein}g</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-600 font-medium">Carbs</p>
            <p className="text-lg font-bold text-blue-700">{meal.carbs}g</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-xs text-yellow-600 font-medium">Fat</p>
            <p className="text-lg font-bold text-yellow-700">{meal.fat}g</p>
          </div>
        </div>

        <div className="bg-zinc-50 p-4 rounded-xl mb-4">
          <h4 className="text-sm font-semibold text-zinc-900 mb-3">Ingredients</h4>
          {Array.isArray(meal.ingredientsJson) && meal.ingredientsJson.length > 0 ? (
            <ul className="space-y-1.5">
              {meal.ingredientsJson.map((ing, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-sm text-zinc-700" data-testid={`plan-ingredient-${idx}`}>
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="flex-1">{Math.round(ing.grams)}g {ing.name}</span>
                  <span className="text-zinc-400 shrink-0">{Math.round(ing.calories100g * ing.grams / 100)} kcal</span>
                </li>
              ))}
            </ul>
          ) : recipe ? (
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, idx) => (
                <li key={idx} className="flex justify-between text-sm text-zinc-700">
                  <span>{ing.item}</span>
                  <span className="font-medium text-zinc-900">{ing.quantity}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {recipe?.instructions && (
          <div className="bg-zinc-50 p-4 rounded-xl mb-4">
            <h4 className="text-sm font-semibold text-zinc-900 mb-2">Instructions</h4>
            <p className="text-sm text-zinc-600 leading-relaxed">{recipe.instructions}</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}
