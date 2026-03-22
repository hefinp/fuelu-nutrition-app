import { BookMarked } from "lucide-react";
import { SavedMealPlans } from "@/components/saved-meal-plans";
import type { PrefillEntry } from "@/components/food-log";

interface MyDiaryWidgetProps {
  onLogMeal?: (meal: PrefillEntry) => void;
}

export function MyDiaryWidget({ onLogMeal }: MyDiaryWidgetProps) {
  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-md p-4 sm:p-6" data-testid="widget-my-diary">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
          <BookMarked className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-display font-bold text-zinc-900">My Diary</h3>
          <p className="text-xs text-zinc-400">Your saved meal plans</p>
        </div>
      </div>
      <div className="max-h-[500px] overflow-y-auto -mx-1 px-1">
        <SavedMealPlans onLogMeal={onLogMeal} />
      </div>
    </div>
  );
}
