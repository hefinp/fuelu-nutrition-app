import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserSavedFood } from "@shared/schema";
import { X, Loader2, Check } from "lucide-react";
import { useMobileViewport } from "@/hooks/use-mobile-viewport";

export function EditFoodModal({
  food,
  onClose,
  onSaved,
}: {
  food: UserSavedFood;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { overlayStyle, panelMaxHeight, isKeyboardOpen } = useMobileViewport();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(food.name);
  const [cal, setCal] = useState(String(food.calories100g));
  const [prot, setProt] = useState(String(food.protein100g));
  const [carbs, setCarbs] = useState(String(food.carbs100g));
  const [fat, setFat] = useState(String(food.fat100g));
  const [serving, setServing] = useState(String(food.servingGrams));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

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
    <div className={`fixed inset-x-0 top-0 bottom-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm ${isKeyboardOpen ? 'pb-0' : 'pb-16'} sm:pb-0 max-h-[100dvh]`} style={overlayStyle} onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[92dvh] flex flex-col overflow-hidden" style={panelMaxHeight != null ? { maxHeight: panelMaxHeight } : undefined} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 sm:px-6 pb-3 sm:pb-4 border-b border-zinc-100 shrink-0" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
          <h3 className="text-base font-semibold text-zinc-900">Edit Food</h3>
          <button onClick={onClose} className="p-2 -mr-1 text-zinc-400 hover:text-zinc-700" data-testid="button-edit-food-close"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid="input-edit-food-name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Nutrition per 100g</label>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {[
                { label: "Calories (kcal)", value: cal, set: setCal, testid: "input-edit-food-cal" },
                { label: "Protein (g)", value: prot, set: setProt, testid: "input-edit-food-prot" },
                { label: "Carbs (g)", value: carbs, set: setCarbs, testid: "input-edit-food-carbs" },
                { label: "Fat (g)", value: fat, set: setFat, testid: "input-edit-food-fat" },
              ].map(({ label, value, set, testid }) => (
                <div key={label}>
                  <label className="text-[10px] text-zinc-400">{label}</label>
                  <input type="number" value={value} onChange={e => set(e.target.value)} min={0} step="0.1"
                    className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-2 sm:py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" data-testid={testid} />
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
        <div className="px-4 sm:px-6 pb-6 pt-3 sm:pt-4 border-t border-zinc-100 shrink-0" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 min-h-[48px]"
            data-testid="button-edit-food-save"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
