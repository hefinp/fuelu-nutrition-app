import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserSavedFood } from "@shared/schema";
import { X, Loader2, Check } from "lucide-react";

export function EditFoodModal({
  food,
  onClose,
  onSaved,
}: {
  food: UserSavedFood;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(food.name);
  const [cal, setCal] = useState(String(food.calories100g));
  const [prot, setProt] = useState(String(food.protein100g));
  const [carbs, setCarbs] = useState(String(food.carbs100g));
  const [fat, setFat] = useState(String(food.fat100g));
  const [serving, setServing] = useState(String(food.servingGrams));

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/my-foods/${food.id}`, {
        name: name.trim(),
        calories100g: parseInt(cal) || 0,
        protein100g: parseFloat(prot) || 0,
        carbs100g: parseFloat(carbs) || 0,
        fat100g: parseFloat(fat) || 0,
        servingGrams: parseInt(serving) || 100,
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-foods"] });
      toast({ title: "Food updated" });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Failed to update food", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm pb-16 sm:pb-0" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <h3 className="text-base font-semibold text-zinc-900">Edit Food</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700" data-testid="button-edit-food-close"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid="input-edit-food-name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Nutrition per 100g</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Calories (kcal)", value: cal, set: setCal, testid: "input-edit-food-cal" },
                { label: "Protein (g)", value: prot, set: setProt, testid: "input-edit-food-prot" },
                { label: "Carbs (g)", value: carbs, set: setCarbs, testid: "input-edit-food-carbs" },
                { label: "Fat (g)", value: fat, set: setFat, testid: "input-edit-food-fat" },
              ].map(({ label, value, set, testid }) => (
                <div key={label}>
                  <label className="text-[10px] text-zinc-400">{label}</label>
                  <input type="number" value={value} onChange={e => set(e.target.value)} min={0} step="0.1"
                    className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid={testid} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Default serving size (g)</label>
            <input type="number" value={serving} onChange={e => setServing(e.target.value)} min={1}
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid="input-edit-food-serving" />
          </div>
        </div>
        <div className="px-6 pb-6 pt-4 border-t border-zinc-100 shrink-0">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            data-testid="button-edit-food-save"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
