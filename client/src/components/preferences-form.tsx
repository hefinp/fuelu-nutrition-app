import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type UserPreferences } from "@shared/schema";
import { Check, Loader2, X, Sparkles, ThumbsDown } from "lucide-react";

type Diet = NonNullable<UserPreferences["diet"]>;
type Allergy = NonNullable<UserPreferences["allergies"]>[number];

const DIET_OPTIONS: { value: Diet; label: string; emoji: string }[] = [
  { value: "vegetarian", label: "Vegetarian", emoji: "🥦" },
  { value: "vegan",      label: "Vegan",       emoji: "🌱" },
  { value: "pescatarian",label: "Pescatarian", emoji: "🐟" },
  { value: "halal",      label: "Halal",       emoji: "☪️" },
  { value: "kosher",     label: "Kosher",      emoji: "✡️" },
];

const ALLERGY_OPTIONS: { value: Allergy; label: string }[] = [
  { value: "gluten",    label: "Gluten" },
  { value: "dairy",     label: "Dairy" },
  { value: "eggs",      label: "Eggs" },
  { value: "nuts",      label: "Tree Nuts" },
  { value: "peanuts",   label: "Peanuts" },
  { value: "shellfish", label: "Shellfish" },
  { value: "fish",      label: "Fish" },
  { value: "soy",       label: "Soy" },
];

function TagInput({
  tags,
  onChange,
  placeholder,
  testIdPrefix,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  testIdPrefix: string;
}) {
  const [input, setInput] = useState("");

  const addTag = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-zinc-200 bg-white min-h-[42px] focus-within:border-zinc-400 transition-colors"
      data-testid={`${testIdPrefix}-container`}
    >
      {tags.map((tag, i) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 text-xs font-medium text-zinc-700"
          data-testid={`${testIdPrefix}-tag-${i}`}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="hover:text-zinc-900 transition-colors"
            data-testid={`${testIdPrefix}-remove-${i}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[80px] text-xs outline-none bg-transparent placeholder:text-zinc-400"
        data-testid={`${testIdPrefix}-input`}
      />
    </div>
  );
}

export function PreferencesForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const [diet, setDiet] = useState<Diet | null>(null);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [excludedFoods, setExcludedFoods] = useState<string[]>([]);
  const [preferredFoods, setPreferredFoods] = useState<string[]>([]);
  const [micronutrientOptimize, setMicronutrientOptimize] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    setDiet(data.diet ?? null);
    setAllergies(data.allergies ?? []);
    setExcludedFoods(data.excludedFoods ?? []);
    setPreferredFoods(data.preferredFoods ?? []);
    setMicronutrientOptimize(data.micronutrientOptimize ?? false);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (prefs: UserPreferences) =>
      apiRequest("PUT", "/api/user/preferences", prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Preferences saved", description: "Your meal plans will now reflect these preferences." });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    },
  });

  const toggleAllergy = (a: Allergy) => {
    setAllergies(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  };

  const handleSave = () => {
    mutation.mutate({
      diet: diet ?? undefined,
      allergies,
      excludedFoods,
      preferredFoods,
      micronutrientOptimize,
      dislikedMeals: data?.dislikedMeals ?? [],
    });
  };

  const hasChanges =
    (diet ?? null) !== (data?.diet ?? null) ||
    JSON.stringify([...allergies].sort()) !== JSON.stringify([...(data?.allergies ?? [])].sort()) ||
    JSON.stringify(excludedFoods) !== JSON.stringify(data?.excludedFoods ?? []) ||
    JSON.stringify(preferredFoods) !== JSON.stringify(data?.preferredFoods ?? []) ||
    micronutrientOptimize !== (data?.micronutrientOptimize ?? false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-zinc-100">
      <h3 className="text-sm font-semibold text-zinc-900 mb-1">Food Preferences & Allergies</h3>
      <p className="text-xs text-zinc-500 mb-5">
        Your meal plans will automatically avoid ingredients that don't suit you.
      </p>

      <div className="mb-5">
        <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2.5">Diet type</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDiet(null)}
            data-testid="diet-none"
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              diet === null
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            None
          </button>
          {DIET_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDiet(prev => prev === opt.value ? null : opt.value)}
              data-testid={`diet-${opt.value}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                diet === opt.value
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
              }`}
            >
              <span>{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2.5">Allergies & intolerances</p>
        <div className="grid grid-cols-2 gap-2">
          {ALLERGY_OPTIONS.map(opt => {
            const active = allergies.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleAllergy(opt.value)}
                data-testid={`allergy-${opt.value}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                  active
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                  active ? "bg-red-500" : "bg-zinc-100"
                }`}>
                  {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </div>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2.5">Foods to avoid</p>
        <p className="text-xs text-zinc-400 mb-2">Type a food keyword and press Enter</p>
        <TagInput
          tags={excludedFoods}
          onChange={setExcludedFoods}
          placeholder="e.g. mushroom, coconut, tofu..."
          testIdPrefix="excluded-foods"
        />
      </div>

      <div className="mb-5">
        <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2.5">Preferred foods</p>
        <p className="text-xs text-zinc-400 mb-2">Meals containing these will be prioritised</p>
        <TagInput
          tags={preferredFoods}
          onChange={setPreferredFoods}
          placeholder="e.g. salmon, quinoa, spinach..."
          testIdPrefix="preferred-foods"
        />
      </div>

      <div className="mb-6">
        <button
          type="button"
          onClick={() => setMicronutrientOptimize(prev => !prev)}
          data-testid="toggle-micronutrient"
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
            micronutrientOptimize
              ? "bg-zinc-100 border-zinc-300"
              : "bg-white border-zinc-200 hover:border-zinc-400"
          }`}
        >
          <div className={`w-10 h-5 rounded-full relative transition-colors ${
            micronutrientOptimize ? "bg-zinc-900" : "bg-zinc-300"
          }`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
              micronutrientOptimize ? "left-5" : "left-0.5"
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className={`w-3.5 h-3.5 ${micronutrientOptimize ? "text-zinc-600" : "text-zinc-400"}`} />
              <span className={`text-xs font-medium ${micronutrientOptimize ? "text-zinc-900" : "text-zinc-600"}`}>
                Micronutrient optimisation
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Favour nutrient-dense meals (leafy greens, oily fish, legumes)</p>
          </div>
        </button>
      </div>

      {/* Disliked meals */}
      {(data?.dislikedMeals?.length ?? 0) > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
            <ThumbsDown className="w-3.5 h-3.5 text-zinc-400" />
            Disliked meals
          </p>
          <p className="text-xs text-zinc-400 mb-2">These meals won't appear in future generated plans.</p>
          <div className="flex flex-wrap gap-1.5">
            {(data?.dislikedMeals ?? []).map((meal, i) => (
              <DislikedMealTag key={i} meal={meal} />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={mutation.isPending || !hasChanges}
        data-testid="button-save-preferences"
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {mutation.isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        ) : (
          "Save Preferences"
        )}
      </button>
    </div>
  );
}

function DislikedMealTag({ meal }: { meal: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/preferences/disliked-meals/${encodeURIComponent(meal)}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Dislike removed", description: `${meal} will appear in future plans again.` });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 border border-red-100 text-xs font-medium text-red-700">
      {meal}
      <button
        type="button"
        onClick={() => deleteMutation.mutate()}
        disabled={deleteMutation.isPending}
        className="hover:text-red-900 transition-colors ml-0.5"
        data-testid={`button-remove-disliked-${meal}`}
      >
        {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
      </button>
    </span>
  );
}
