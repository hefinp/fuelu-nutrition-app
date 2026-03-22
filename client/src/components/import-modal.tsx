import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, X, Loader2, ArrowLeft, ImagePlus,
  AlertCircle, Globe, BookOpen, Camera, Play,
} from "lucide-react";
import { DuplicateWarningBanner, type DuplicateWarning } from "@/components/duplicate-warning-banner";
import {
  type MealSlot, type ImportStep, type ParsedRecipe, type Ingredient,
  SLOT_OPTIONS, fileToBase64, getSourceLabel,
} from "@/components/meals-food-shared";
import { useMobileViewport } from "@/hooks/use-mobile-viewport";

export function ImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const { overlayStyle, panelMaxHeight, isKeyboardOpen } = useMobileViewport(0.90);
  const [step, setStep] = useState<ImportStep>("method");
  const [url, setUrl] = useState("");
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [urlError, setUrlError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);
  const [dupWarning, setDupWarning] = useState<{ message: string; exactMatch: boolean; existingCount: number } | null>(null);
  const [instructions, setInstructions] = useState("");

  const importMutation = useMutation({
    mutationFn: (u: string) => apiRequest("POST", "/api/recipes/import", { url: u }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.message) { setUrlError(data.message); return; }
      setParsed(data);
      setCalories(data.calories != null ? String(data.calories) : "");
      setProtein(data.protein != null ? String(data.protein) : "");
      setCarbs(data.carbs != null ? String(data.carbs) : "");
      setFat(data.fat != null ? String(data.fat) : "");
      setInstructions(Array.isArray(data.instructions) && data.instructions.length > 0 ? data.instructions.join("\n") : "");
      setSlot((data.suggestedSlot as MealSlot) || "dinner");
      setUseWebsiteCalories(false);
      setStep("confirm");
    },
    onError: () => setUrlError("Could not load that URL. Try a different recipe site."),
  });

  const photoMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setUploadedPhotoUrls([]);
      const images = await Promise.all(files.map(async f => ({
        base64: await fileToBase64(f),
        mimeType: f.type || "image/jpeg",
      })));
      const [recipeData, uploadData] = await Promise.all([
        apiRequest("POST", "/api/recipes/import-photo", { images }).then(r => r.json()),
        apiRequest("POST", "/api/recipes/upload-photos", { images }).then(r => r.json()).catch(() => null),
      ]);
      return { ...recipeData, _uploadedUrls: uploadData?.urls || [], _uploadFailed: !uploadData };
    },
    onSuccess: (data) => {
      if (data.message) { toast({ title: data.message, variant: "destructive" }); return; }
      setParsed(data);
      setCalories(data.calories != null ? String(data.calories) : "");
      setProtein(data.protein != null ? String(data.protein) : "");
      setCarbs(data.carbs != null ? String(data.carbs) : "");
      setFat(data.fat != null ? String(data.fat) : "");
      setInstructions(Array.isArray(data.instructions) && data.instructions.length > 0 ? data.instructions.join("\n") : "");
      setSlot((data.suggestedSlot as MealSlot) || "dinner");
      setUseWebsiteCalories(false);
      if (data._uploadedUrls && data._uploadedUrls.length > 0) {
        setUploadedPhotoUrls(data._uploadedUrls);
      }
      if (data._uploadFailed) {
        toast({ title: "Recipe extracted, but source photos could not be saved" });
      }
      setStep("confirm");
    },
    onError: () => toast({ title: "Failed to extract recipe from photo", variant: "destructive" }),
  });

  const videoMutation = useMutation({
    mutationFn: (u: string) => apiRequest("POST", "/api/recipes/import-video", { url: u }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.message) { setVideoError(data.message); return; }
      setParsed(data);
      setCalories(data.calories != null ? String(data.calories) : "");
      setProtein(data.protein != null ? String(data.protein) : "");
      setCarbs(data.carbs != null ? String(data.carbs) : "");
      setFat(data.fat != null ? String(data.fat) : "");
      setInstructions(Array.isArray(data.instructions) && data.instructions.length > 0 ? data.instructions.join("\n") : "");
      setSlot((data.suggestedSlot as MealSlot) || "dinner");
      setUseWebsiteCalories(false);
      setStep("confirm");
    },
    onError: (err: Error) => {
      try {
        const body = err.message.replace(/^\d+:\s*/, "");
        const parsed = JSON.parse(body);
        if (parsed.message) { setVideoError(parsed.message); return; }
      } catch {}
      setVideoError("Could not process that video. Make sure it's a public video from Instagram, TikTok, or YouTube.");
    },
  });

  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [useWebsiteCalories, setUseWebsiteCalories] = useState(false);

  function buildImportPayload(confirm = false) {
    let calVal = parseInt(calories) || 0;
    let proVal = parseInt(protein) || 0;
    let carbVal = parseInt(carbs) || 0;
    let fatVal = parseInt(fat) || 0;

    const ingsJson = parsed!.ingredientsJson && parsed!.ingredientsJson.length > 0 ? parsed!.ingredientsJson : undefined;

    if (calVal === 0 && ingsJson && ingsJson.length > 0) {
      const totals = ingsJson.reduce(
        (acc: { cal: number; pro: number; carb: number; fat: number }, ing: Ingredient) => ({
          cal: acc.cal + (ing.calories100g * ing.grams / 100),
          pro: acc.pro + (ing.protein100g * ing.grams / 100),
          carb: acc.carb + (ing.carbs100g * ing.grams / 100),
          fat: acc.fat + (ing.fat100g * ing.grams / 100),
        }),
        { cal: 0, pro: 0, carb: 0, fat: 0 },
      );
      calVal = Math.round(totals.cal);
      proVal = Math.round(totals.pro);
      carbVal = Math.round(totals.carb);
      fatVal = Math.round(totals.fat);
    }

    if (useWebsiteCalories && parsed?.divergenceWarning && parsed.calories != null) {
      calVal = parsed.calories;
    }

    return {
      name: parsed!.name,
      source: "imported" as const,
      sourceUrl: parsed!.sourceUrl,
      imageUrl: parsed!.imageUrl,
      servings: parsed!.servings,
      caloriesPerServing: calVal,
      proteinPerServing: proVal,
      carbsPerServing: carbVal,
      fatPerServing: fatVal,
      ingredients: parsed!.ingredients.join("\n"),
      ingredientsJson: ingsJson,
      instructions: instructions.trim() || null,
      mealSlot: slot,
      mealStyle: "simple",
      ...(uploadedPhotoUrls.length > 0 ? { sourcePhotos: uploadedPhotoUrls } : {}),
      ...(confirm ? { confirmDuplicate: true } : {}),
    };
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildImportPayload>) => {
      const res = await fetch("/api/user-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const json = await res.json();
      if (res.status === 409 && json.duplicateWarning) {
        throw { isDuplicate: true, warning: json };
      }
      if (!res.ok) throw new Error(json.message || "Failed to save recipe");
      return json;
    },
    onSuccess: () => {
      setDupWarning(null);
      toast({ title: `${parsed!.name} saved to Meals` });
      onSaved();
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as Record<string, unknown>;
      if (e?.isDuplicate) {
        setDupWarning(e.warning as DuplicateWarning);
        return;
      }
      toast({ title: "Failed to save recipe", variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" style={overlayStyle} onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90dvh] flex flex-col overflow-hidden" style={panelMaxHeight != null ? { maxHeight: panelMaxHeight } : undefined} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            {step !== "method" && (
              <button onClick={() => { setStep("method"); setUploadedPhotoUrls([]); }} className="p-1 text-zinc-400 hover:text-zinc-700 mr-1" data-testid="button-import-back">
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
                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-white" />
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
                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">From a photo</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Take or upload a photo of a recipe book page</p>
                </div>
              </button>
              <button
                onClick={() => setStep("video")}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all text-left"
                data-testid="button-import-method-video"
              >
                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0">
                  <Play className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">From a video</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Paste a link from Instagram, TikTok, or YouTube</p>
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
              <p className="text-sm text-zinc-500">Upload a photo (or two pages) of a recipe from a cookbook. AI will extract the ingredients, instructions and nutrition information.</p>
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

          {step === "video" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">Paste a link to a cooking video from Instagram, TikTok, or YouTube. AI will extract the recipe from the video frames.</p>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Video URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={e => { setVideoUrl(e.target.value); setVideoError(""); }}
                    placeholder="https://www.instagram.com/reel/... or https://www.tiktok.com/..."
                    className="flex-1 text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    data-testid="input-import-video-url"
                    onKeyDown={e => { if (e.key === "Enter" && videoUrl.trim()) videoMutation.mutate(videoUrl.trim()); }}
                  />
                  <button
                    onClick={() => { setVideoError(""); videoMutation.mutate(videoUrl.trim()); }}
                    disabled={!videoUrl.trim() || videoMutation.isPending}
                    className="px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                    data-testid="button-import-video-fetch"
                  >
                    {videoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Extract"}
                  </button>
                </div>
                {videoError && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1" data-testid="text-import-video-error"><AlertCircle className="w-3 h-3" />{videoError}</p>}
                {videoMutation.isPending && (
                  <p className="text-xs text-zinc-400 mt-2">Extracting frames and analysing the video... this may take up to 30 seconds.</p>
                )}
              </div>
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
              {parsed.divergenceWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2" data-testid="divergence-warning">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">{parsed.divergenceWarning.message}</p>
                  </div>
                  <button
                    onClick={() => setUseWebsiteCalories(!useWebsiteCalories)}
                    className={`text-xs px-3 py-1 rounded-lg border transition-colors ${useWebsiteCalories ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                    data-testid="button-use-website-calories"
                  >
                    {useWebsiteCalories ? "Using website calories" : "Use website calories instead"}
                  </button>
                </div>
              )}
              {parsed.ingredientsJson && parsed.ingredientsJson.length > 0 ? (
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Ingredients ({parsed.ingredientsJson.length})</label>
                  <ul className="text-xs text-zinc-600 space-y-0.5 max-h-32 overflow-y-auto" data-testid="list-import-ingredients">
                    {parsed.ingredientsJson.map((ing, i) => (
                      <li key={i} className="flex items-start gap-1" data-testid={`import-ingredient-${i}`}>
                        <span className="mt-1 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                        <span className="flex-1">{Math.round(ing.grams)}g {ing.name}</span>
                        {ing.sourceDetail && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                            ing.sourceDetail === "usda_cached" || ing.sourceDetail === "nzfcd" || ing.sourceDetail === "fsanz" || ing.sourceDetail === "ausnut"
                              ? "bg-emerald-100 text-emerald-700"
                              : ing.sourceDetail === "barcode_scan" || ing.sourceDetail === "openfoodfacts" || ing.sourceDetail === "open_food_facts"
                              ? "bg-blue-100 text-blue-700"
                              : ing.sourceDetail === "nz_regional" || ing.sourceDetail === "au_regional" || ing.sourceDetail === "restaurant_nz"
                              ? "bg-teal-100 text-teal-700"
                              : ing.sourceDetail === "ai_generated"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-zinc-100 text-zinc-500"
                          }`} data-testid={`source-badge-${i}`}>{getSourceLabel(ing.sourceDetail)}</span>
                        )}
                        <span className="text-zinc-400 shrink-0">{Math.round(ing.calories100g * ing.grams / 100)} kcal</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : parsed.ingredients.length > 0 ? (
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Ingredients ({parsed.ingredients.length})</label>
                  <ul className="text-xs text-zinc-600 space-y-0.5 max-h-32 overflow-y-auto">
                    {parsed.ingredients.map((ing, i) => <li key={i} className="flex items-start gap-1"><span className="mt-1 w-1 h-1 rounded-full bg-zinc-300 shrink-0" />{ing}</li>)}
                  </ul>
                </div>
              ) : null}
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Instructions</label>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="No instructions extracted — you can add them manually"
                  rows={instructions ? Math.min(instructions.split("\n").length + 1, 8) : 3}
                  className="w-full text-xs text-zinc-600 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none"
                  data-testid="textarea-import-instructions"
                />
              </div>
            </div>
          )}
        </div>

        {step === "confirm" && parsed && (
          <div className="px-6 pb-6 pt-4 border-t border-zinc-100 shrink-0">
            {dupWarning ? (
              <DuplicateWarningBanner
                warning={dupWarning}
                onConfirm={() => { setDupWarning(null); saveMutation.mutate(buildImportPayload(true)); }}
                onCancel={() => setDupWarning(null)}
                testPrefix="import-dup"
              />
            ) : (
              <button
                onClick={() => saveMutation.mutate(buildImportPayload())}
                disabled={saveMutation.isPending}
                className="w-full py-3 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                data-testid="button-import-save"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><BookOpen className="w-4 h-4" />Save to My Meals</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
