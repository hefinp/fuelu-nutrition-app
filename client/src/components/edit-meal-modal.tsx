import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FavouriteMeal, UserRecipe } from "@shared/schema";
import { X, Loader2, Check } from "lucide-react";
import { type MealSlot, SLOT_OPTIONS } from "@/components/meals-food-shared";

export function EditMealModal({
  type,
  item,
  onClose,
  onSaved,
}: {
  type: "favourite" | "recipe";
  item: FavouriteMeal | UserRecipe;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isFav = type === "favourite";
  const fav = isFav ? (item as FavouriteMeal) : null;
  const rec = !isFav ? (item as UserRecipe) : null;

  const [name, setName] = useState(isFav ? fav!.mealName : rec!.name);
  const [cal, setCal] = useState(String(isFav ? fav!.calories : rec!.caloriesPerServing));
  const [prot, setProt] = useState(String(isFav ? fav!.protein : rec!.proteinPerServing));
  const [carbs, setCarbs] = useState(String(isFav ? fav!.carbs : rec!.carbsPerServing));
  const [fat, setFat] = useState(String(isFav ? fav!.fat : rec!.fatPerServing));
  const [mealSlot, setMealSlot] = useState<MealSlot>((isFav ? fav!.mealSlot : rec!.mealSlot) as MealSlot ?? "dinner");
  const [instructions, setInstructions] = useState(isFav ? fav!.instructions ?? "" : rec?.instructions ?? "");
  const [ingredients, setIngredients] = useState(isFav ? fav!.ingredients ?? "" : rec?.ingredients ?? "");

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isFav) {
        return apiRequest("PATCH", `/api/favourites/${fav!.id}`, {
          mealName: name.trim(),
          calories: parseInt(cal) || 0,
          protein: parseInt(prot) || 0,
          carbs: parseInt(carbs) || 0,
          fat: parseInt(fat) || 0,
          mealSlot,
          ingredients: ingredients.trim() || null,
          instructions: instructions.trim() || null,
        }).then(r => r.json());
      }
      return apiRequest("PATCH", `/api/recipes/${rec!.id}`, {
        name: name.trim(),
        caloriesPerServing: parseInt(cal) || 0,
        proteinPerServing: parseInt(prot) || 0,
        carbsPerServing: parseInt(carbs) || 0,
        fatPerServing: parseInt(fat) || 0,
        mealSlot,
        instructions: instructions.trim() || null,
        ingredients: ingredients.trim() || null,
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [isFav ? "/api/favourites" : "/api/recipes"] });
      toast({ title: "Updated" });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm pb-16 sm:pb-0" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <h3 className="text-base font-semibold text-zinc-900">Edit {isFav ? "Favourite" : "Recipe"}</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700" data-testid="button-edit-meal-close"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid="input-edit-name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-2">Meal slot</label>
            <div className="grid grid-cols-4 gap-2">
              {SLOT_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setMealSlot(o.value)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${mealSlot === o.value ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"}`}
                  data-testid={`button-edit-slot-${o.value}`}
                >{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Macros per serving</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Calories (kcal)", value: cal, set: setCal, testid: "input-edit-cal" },
                { label: "Protein (g)", value: prot, set: setProt, testid: "input-edit-prot" },
                { label: "Carbs (g)", value: carbs, set: setCarbs, testid: "input-edit-carbs" },
                { label: "Fat (g)", value: fat, set: setFat, testid: "input-edit-fat" },
              ].map(({ label, value, set, testid }) => (
                <div key={label}>
                  <label className="text-[10px] text-zinc-400">{label}</label>
                  <input type="number" value={value} onChange={e => set(e.target.value)} min={0}
                    className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid={testid} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Ingredients <span className="text-zinc-400 font-normal">(optional)</span></label>
            <textarea value={ingredients} onChange={e => setIngredients(e.target.value)} rows={4}
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none" data-testid="textarea-edit-ingredients" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Instructions <span className="text-zinc-400 font-normal">(optional)</span></label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={4}
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none" data-testid="textarea-edit-instructions" />
          </div>
        </div>
        <div className="px-6 pb-6 pt-4 border-t border-zinc-100 shrink-0">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            data-testid="button-edit-save"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
