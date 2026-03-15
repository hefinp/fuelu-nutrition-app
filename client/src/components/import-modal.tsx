import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, X, Loader2, ArrowLeft, ImagePlus,
  AlertCircle, Globe, BookOpen, Camera,
} from "lucide-react";
import {
  type MealSlot, type ImportStep, type ParsedRecipe,
  SLOT_OPTIONS, fileToBase64,
} from "@/components/meals-food-shared";

export function ImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>("method");
  const [url, setUrl] = useState("");
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [urlError, setUrlError] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (u: string) => apiRequest("POST", "/api/recipes/import", { url: u }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.message) { setUrlError(data.message); return; }
      setParsed(data);
      setCalories(data.calories != null ? String(data.calories) : "");
      setProtein(data.protein != null ? String(data.protein) : "");
      setCarbs(data.carbs != null ? String(data.carbs) : "");
      setFat(data.fat != null ? String(data.fat) : "");
      setSlot((data.suggestedSlot as MealSlot) || "dinner");
      setStep("confirm");
    },
    onError: () => setUrlError("Could not load that URL. Try a different recipe site."),
  });

  const photoMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const images = await Promise.all(files.map(async f => ({
        base64: await fileToBase64(f),
        mimeType: f.type || "image/jpeg",
      })));
      return apiRequest("POST", "/api/recipes/import-photo", { images }).then(r => r.json());
    },
    onSuccess: (data) => {
      if (data.message) { toast({ title: data.message, variant: "destructive" }); return; }
      setParsed(data);
      setCalories(data.calories != null ? String(data.calories) : "");
      setProtein(data.protein != null ? String(data.protein) : "");
      setCarbs(data.carbs != null ? String(data.carbs) : "");
      setFat(data.fat != null ? String(data.fat) : "");
      setSlot((data.suggestedSlot as MealSlot) || "dinner");
      setStep("confirm");
    },
    onError: () => toast({ title: "Failed to extract recipe from photo", variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/recipes", {
      name: parsed!.name,
      sourceUrl: parsed!.sourceUrl,
      imageUrl: parsed!.imageUrl,
      servings: parsed!.servings,
      caloriesPerServing: parseInt(calories) || 0,
      proteinPerServing: parseInt(protein) || 0,
      carbsPerServing: parseInt(carbs) || 0,
      fatPerServing: parseInt(fat) || 0,
      ingredients: parsed!.ingredients.join("\n"),
      mealSlot: slot,
      mealStyle: "simple",
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: `${parsed!.name} saved to Meals` });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Failed to save recipe", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            {step !== "method" && (
              <button onClick={() => setStep("method")} className="p-1 text-zinc-400 hover:text-zinc-700 mr-1" data-testid="button-import-back">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3 className="text-base font-semibold text-zinc-900">Import Recipe</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700" data-testid="button-import-close"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === "method" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">How would you like to import a recipe?</p>
              <button
                onClick={() => setStep("url")}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all text-left"
                data-testid="button-import-method-url"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">From a website</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Paste a URL from any recipe site</p>
                </div>
              </button>
              <button
                onClick={() => setStep("photo")}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all text-left"
                data-testid="button-import-method-photo"
              >
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">From a photo</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Take or upload a photo of a recipe book page</p>
                </div>
              </button>
            </div>
          )}

          {step === "url" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Recipe URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={e => { setUrl(e.target.value); setUrlError(""); }}
                    placeholder="https://www.bbcgoodfood.com/recipes/..."
                    className="flex-1 text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    data-testid="input-import-url"
                    onKeyDown={e => { if (e.key === "Enter" && url.trim()) importMutation.mutate(url.trim()); }}
                  />
                  <button
                    onClick={() => { setUrlError(""); importMutation.mutate(url.trim()); }}
                    disabled={!url.trim() || importMutation.isPending}
                    className="px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                    data-testid="button-import-url-fetch"
                  >
                    {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                  </button>
                </div>
                {urlError && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{urlError}</p>}
              </div>
            </div>
          )}

          {step === "photo" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">Upload a photo (or two pages) of a recipe from a cookbook. AI will extract the ingredients and nutrition information.</p>
              <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={e => setPhotoFiles(Array.from(e.target.files ?? []).slice(0, 2))} data-testid="input-import-photo" />
              {photoFiles.length === 0 ? (
                <button
                  onClick={() => photoRef.current?.click()}
                  className="w-full border-2 border-dashed border-zinc-200 rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-zinc-300 hover:bg-zinc-50 transition-all"
                  data-testid="button-import-photo-pick"
                >
                  <ImagePlus className="w-8 h-8 text-zinc-300" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-600">Tap to choose a photo</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Up to 2 pages of a recipe book</p>
                  </div>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {photoFiles.map((f, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-200">
                        <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setPhotoFiles(prev => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {photoFiles.length < 2 && (
                      <button onClick={() => photoRef.current?.click()} className="w-24 h-24 border-2 border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center gap-1 text-zinc-400 hover:border-zinc-300 text-xs">
                        <Plus className="w-4 h-4" />Add page
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => photoMutation.mutate(photoFiles)}
                    disabled={photoMutation.isPending}
                    className="w-full py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    data-testid="button-import-photo-extract"
                  >
                    {photoMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Extracting recipe...</> : "Extract Recipe"}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "confirm" && parsed && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Recipe name</label>
                <p className="text-sm font-semibold text-zinc-900">{parsed.name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2">Meal slot</label>
                <div className="grid grid-cols-4 gap-2">
                  {SLOT_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => setSlot(o.value)}
                      className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${slot === o.value ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"}`}
                      data-testid={`button-import-slot-${o.value}`}
                    >{o.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2">Nutrition per serving</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Calories (kcal)", value: calories, set: setCalories },
                    { label: "Protein (g)", value: protein, set: setProtein },
                    { label: "Carbs (g)", value: carbs, set: setCarbs },
                    { label: "Fat (g)", value: fat, set: setFat },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label className="text-[10px] text-zinc-400">{label}</label>
                      <input type="number" value={value} onChange={e => set(e.target.value)} min={0}
                        className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-zinc-300" />
                    </div>
                  ))}
                </div>
              </div>
              {parsed.ingredients.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Ingredients ({parsed.ingredients.length})</label>
                  <ul className="text-xs text-zinc-600 space-y-0.5 max-h-32 overflow-y-auto">
                    {parsed.ingredients.map((ing, i) => <li key={i} className="flex items-start gap-1"><span className="mt-1 w-1 h-1 rounded-full bg-zinc-300 shrink-0" />{ing}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {step === "confirm" && parsed && (
          <div className="px-6 pb-6 pt-4 border-t border-zinc-100 shrink-0">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full py-3 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              data-testid="button-import-save"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><BookOpen className="w-4 h-4" />Save to My Meals</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
