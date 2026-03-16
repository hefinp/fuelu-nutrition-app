import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type UserPreferences } from "@shared/schema";
import { Check, Loader2, X, Sparkles, ThumbsDown, Leaf, Sprout, Fish, Moon, Star, Globe, Droplets, Users2, ShieldAlert, Timer } from "lucide-react";

type Diet = NonNullable<UserPreferences["diet"]>;
type Allergy = NonNullable<UserPreferences["allergies"]>[number];

const DIET_OPTIONS = [
  { value: "vegetarian" as Diet, label: "Vegetarian", icon: Leaf },
  { value: "vegan"      as Diet, label: "Vegan",       icon: Sprout },
  { value: "pescatarian"as Diet, label: "Pescatarian", icon: Fish },
  { value: "halal"      as Diet, label: "Halal",       icon: Moon },
  { value: "kosher"     as Diet, label: "Kosher",      icon: Star },
];

const ALLERGY_OPTIONS: { value: Allergy; label: string }[] = [
  { value: "gluten",      label: "Gluten" },
  { value: "crustaceans", label: "Crustaceans" },
  { value: "eggs",        label: "Eggs" },
  { value: "fish",        label: "Fish" },
  { value: "peanuts",     label: "Peanuts" },
  { value: "soy",         label: "Soybeans" },
  { value: "milk",        label: "Milk (dairy)" },
  { value: "nuts",        label: "Tree Nuts" },
  { value: "celery",      label: "Celery" },
  { value: "mustard",     label: "Mustard" },
  { value: "sesame",      label: "Sesame" },
  { value: "sulphites",   label: "Sulphites" },
  { value: "lupin",       label: "Lupin" },
  { value: "molluscs",    label: "Molluscs" },
];

const ALL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealSlot = typeof ALL_SLOTS[number];

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

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

export function AllergiesForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [excludedFoods, setExcludedFoods] = useState<string[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    setAllergies(data.allergies ?? []);
    setExcludedFoods(data.excludedFoods ?? []);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (prefs: UserPreferences) =>
      apiRequest("PUT", "/api/user/preferences", prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Allergies saved", description: "Your meal plans will avoid these ingredients." });
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
    const payload: UserPreferences = {
      ...data,
      allergies,
      excludedFoods,
    };
    mutation.mutate(payload);
  };

  const hasChanges =
    JSON.stringify([...allergies].sort()) !== JSON.stringify([...(data?.allergies ?? [])].sort()) ||
    JSON.stringify(excludedFoods) !== JSON.stringify(data?.excludedFoods ?? []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
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

      <div>
        <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2.5">Foods to avoid</p>
        <p className="text-xs text-zinc-400 mb-2">Type a food keyword and press Enter</p>
        <TagInput
          tags={excludedFoods}
          onChange={setExcludedFoods}
          placeholder="e.g. mushroom, coconut, tofu..."
          testIdPrefix="excluded-foods"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={mutation.isPending || !hasChanges}
        data-testid="button-save-allergies"
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {mutation.isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        ) : (
          "Save"
        )}
      </button>
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
  const [preferredFoods, setPreferredFoods] = useState<string[]>([]);
  const [micronutrientOptimize, setMicronutrientOptimize] = useState(false);
  const [recipeWebsitesEnabled, setRecipeWebsitesEnabled] = useState(false);
  const [recipeWebsites, setRecipeWebsites] = useState<string[]>([]);
  const [recipeEnabledSlots, setRecipeEnabledSlots] = useState<MealSlot[]>([...ALL_SLOTS]);
  const [recipeWeeklyLimit, setRecipeWeeklyLimit] = useState(5);
  const [hydrationGoalMl, setHydrationGoalMl] = useState(2000);
  const [hydrationUnit, setHydrationUnit] = useState<"ml" | "glasses">("ml");
  const [includeCommunityMeals, setIncludeCommunityMeals] = useState(true);
  const [fastingEnabled, setFastingEnabled] = useState(false);
  const [fastingProtocol, setFastingProtocol] = useState<"16:8" | "18:6" | "20:4" | "5:2" | "omad">("16:8");
  const [eatingWindowStart, setEatingWindowStart] = useState(12);
  const [eatingWindowEnd, setEatingWindowEnd] = useState(20);
  type FastingDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
  const [fastingDays, setFastingDays] = useState<FastingDay[]>(["monday", "thursday"]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    setDiet(data.diet ?? null);
    setPreferredFoods(data.preferredFoods ?? []);
    setMicronutrientOptimize(data.micronutrientOptimize ?? false);
    setRecipeWebsitesEnabled(data.recipeWebsitesEnabled ?? false);
    setRecipeWebsites(data.recipeWebsites ?? []);
    setRecipeEnabledSlots((data.recipeEnabledSlots as MealSlot[] | undefined) ?? [...ALL_SLOTS]);
    setRecipeWeeklyLimit(data.recipeWeeklyLimit ?? 5);
    setHydrationGoalMl(data.hydrationGoalMl ?? 2000);
    setHydrationUnit((data.hydrationUnit as "ml" | "glasses" | undefined) ?? "ml");
    setIncludeCommunityMeals((data as any).includeCommunityMeals !== false);
    setFastingEnabled(data.fastingEnabled ?? false);
    setFastingProtocol(data.fastingProtocol ?? "16:8");
    setEatingWindowStart(data.eatingWindowStart ?? 12);
    setEatingWindowEnd(data.eatingWindowEnd ?? 20);
    setFastingDays((data.fastingDays as FastingDay[] | undefined) ?? ["monday", "thursday"]);
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

  const toggleSlot = (slot: MealSlot) => {
    setRecipeEnabledSlots(prev => {
      if (prev.includes(slot)) {
        const next = prev.filter(s => s !== slot);
        return next.length === 0 ? [...ALL_SLOTS] : next;
      }
      return [...prev, slot];
    });
  };

  const handleSave = () => {
    const payload: UserPreferences = {
      ...data,
      diet: diet ?? undefined,
      preferredFoods,
      micronutrientOptimize,
      recipeWebsitesEnabled,
      recipeWebsites,
      recipeEnabledSlots,
      recipeWeeklyLimit,
      hydrationGoalMl,
      hydrationUnit,
      includeCommunityMeals,
      fastingEnabled,
      fastingProtocol: fastingEnabled ? fastingProtocol : undefined,
      eatingWindowStart: fastingEnabled ? eatingWindowStart : undefined,
      eatingWindowEnd: fastingEnabled ? eatingWindowEnd : undefined,
      fastingDays: fastingEnabled && fastingProtocol === '5:2' ? fastingDays : undefined,
    };
    mutation.mutate(payload);
  };

  const hasChanges =
    (diet ?? null) !== (data?.diet ?? null) ||
    JSON.stringify(preferredFoods) !== JSON.stringify(data?.preferredFoods ?? []) ||
    micronutrientOptimize !== (data?.micronutrientOptimize ?? false) ||
    recipeWebsitesEnabled !== (data?.recipeWebsitesEnabled ?? false) ||
    JSON.stringify(recipeWebsites) !== JSON.stringify(data?.recipeWebsites ?? []) ||
    JSON.stringify([...recipeEnabledSlots].sort()) !== JSON.stringify([...(data?.recipeEnabledSlots ?? [...ALL_SLOTS])].sort()) ||
    recipeWeeklyLimit !== (data?.recipeWeeklyLimit ?? 5) ||
    hydrationGoalMl !== (data?.hydrationGoalMl ?? 2000) ||
    hydrationUnit !== (data?.hydrationUnit ?? "ml") ||
    includeCommunityMeals !== ((data as any)?.includeCommunityMeals !== false) ||
    fastingEnabled !== (data?.fastingEnabled ?? false) ||
    fastingProtocol !== (data?.fastingProtocol ?? "16:8") ||
    eatingWindowStart !== (data?.eatingWindowStart ?? 12) ||
    eatingWindowEnd !== (data?.eatingWindowEnd ?? 20) ||
    JSON.stringify([...fastingDays].sort()) !== JSON.stringify([...((data?.fastingDays as FastingDay[] | undefined) ?? ["monday", "thursday"])].sort());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
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
              <opt.icon className="w-3.5 h-3.5 flex-shrink-0" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
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

      {/* Recipe Websites */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setRecipeWebsitesEnabled(prev => !prev)}
          data-testid="toggle-recipe-websites"
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
            recipeWebsitesEnabled
              ? "bg-zinc-100 border-zinc-300"
              : "bg-white border-zinc-200 hover:border-zinc-400"
          }`}
        >
          <div className={`w-10 h-5 rounded-full relative transition-colors ${
            recipeWebsitesEnabled ? "bg-zinc-900" : "bg-zinc-300"
          }`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
              recipeWebsitesEnabled ? "left-5" : "left-0.5"
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <Globe className={`w-3.5 h-3.5 ${recipeWebsitesEnabled ? "text-zinc-600" : "text-zinc-400"}`} />
              <span className={`text-xs font-medium ${recipeWebsitesEnabled ? "text-zinc-900" : "text-zinc-600"}`}>
                Recipe website integration
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Include recipes from your favourite websites in meal plans</p>
          </div>
        </button>

        {recipeWebsitesEnabled && (
          <div className="mt-3 pl-1 space-y-4">
            <div>
              <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-1.5">Your recipe websites</p>
              <p className="text-xs text-zinc-400 mb-2">Add site URLs (e.g. allrecipes.com, bite.co.nz) — press Enter to add each one</p>
              <TagInput
                tags={recipeWebsites}
                onChange={setRecipeWebsites}
                placeholder="e.g. allrecipes.com, bbcgoodfood.com..."
                testIdPrefix="recipe-websites"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">Use my recipes for</p>
              <div className="flex flex-wrap gap-2">
                {ALL_SLOTS.map(slot => {
                  const active = recipeEnabledSlots.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => toggleSlot(slot)}
                      data-testid={`recipe-slot-${slot}`}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        active
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      {SLOT_LABELS[slot]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 uppercase tracking-wide mb-1.5" htmlFor="recipe-weekly-limit">
                Recipes per week
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="recipe-weekly-limit"
                  type="number"
                  min={1}
                  max={14}
                  value={recipeWeeklyLimit}
                  onChange={e => setRecipeWeeklyLimit(Math.min(14, Math.max(1, parseInt(e.target.value) || 1)))}
                  data-testid="input-recipe-weekly-limit"
                  className="w-20 px-3 py-1.5 text-sm border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none transition-colors"
                />
                <p className="text-xs text-zinc-400">Maximum recipes from your library that can appear in a single plan</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Community Meals */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setIncludeCommunityMeals(prev => !prev)}
          data-testid="toggle-community-meals"
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
            includeCommunityMeals
              ? "bg-zinc-100 border-zinc-300"
              : "bg-white border-zinc-200 hover:border-zinc-400"
          }`}
        >
          <div className={`w-10 h-5 rounded-full relative transition-colors ${
            includeCommunityMeals ? "bg-zinc-900" : "bg-zinc-300"
          }`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
              includeCommunityMeals ? "left-5" : "left-0.5"
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <Users2 className={`w-3.5 h-3.5 ${includeCommunityMeals ? "text-zinc-600" : "text-zinc-400"}`} />
              <span className={`text-xs font-medium ${includeCommunityMeals ? "text-zinc-900" : "text-zinc-600"}`}>
                Community meal suggestions
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Include community-shared and AI-curated meals in your plan suggestions</p>
          </div>
        </button>
      </div>

      {/* Intermittent Fasting */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setFastingEnabled(prev => !prev)}
          data-testid="toggle-fasting"
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
            fastingEnabled
              ? "bg-zinc-100 border-zinc-300"
              : "bg-white border-zinc-200 hover:border-zinc-400"
          }`}
        >
          <div className={`w-10 h-5 rounded-full relative transition-colors ${
            fastingEnabled ? "bg-zinc-900" : "bg-zinc-300"
          }`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
              fastingEnabled ? "left-5" : "left-0.5"
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <Timer className={`w-3.5 h-3.5 ${fastingEnabled ? "text-zinc-600" : "text-zinc-400"}`} />
              <span className={`text-xs font-medium ${fastingEnabled ? "text-zinc-900" : "text-zinc-600"}`}>
                Intermittent fasting
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Adapt meal plans to fit your fasting schedule</p>
          </div>
        </button>

        {fastingEnabled && (
          <div className="mt-3 pl-1 space-y-4">
            <div>
              <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">Protocol</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "16:8" as const, label: "16:8", desc: "16h fast, 8h eating" },
                  { value: "18:6" as const, label: "18:6", desc: "18h fast, 6h eating" },
                  { value: "20:4" as const, label: "20:4", desc: "20h fast, 4h eating" },
                  { value: "5:2" as const, label: "5:2", desc: "5 normal days, 2 low-cal" },
                  { value: "omad" as const, label: "OMAD", desc: "One meal a day" },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setFastingProtocol(opt.value);
                      if (opt.value === "16:8") { setEatingWindowStart(12); setEatingWindowEnd(20); }
                      else if (opt.value === "18:6") { setEatingWindowStart(12); setEatingWindowEnd(18); }
                      else if (opt.value === "20:4") { setEatingWindowStart(14); setEatingWindowEnd(18); }
                    }}
                    data-testid={`fasting-protocol-${opt.value}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      fastingProtocol === opt.value
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-1.5">
                {fastingProtocol === "16:8" && "Fast for 16 hours, eat within an 8-hour window"}
                {fastingProtocol === "18:6" && "Fast for 18 hours, eat within a 6-hour window"}
                {fastingProtocol === "20:4" && "Fast for 20 hours, eat within a 4-hour window"}
                {fastingProtocol === "5:2" && "Eat normally 5 days, restrict to ~500 cal on 2 fasting days"}
                {fastingProtocol === "omad" && "Eat one meal per day — all calories in a single sitting"}
              </p>
            </div>

            {fastingProtocol !== "5:2" && fastingProtocol !== "omad" && (
              <div>
                <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">Eating window</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500" htmlFor="eating-window-start">Start</label>
                    <select
                      id="eating-window-start"
                      value={eatingWindowStart}
                      onChange={e => setEatingWindowStart(parseInt(e.target.value))}
                      data-testid="select-eating-window-start"
                      className="px-2 py-1.5 text-xs border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none transition-colors"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-xs text-zinc-400">to</span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500" htmlFor="eating-window-end">End</label>
                    <select
                      id="eating-window-end"
                      value={eatingWindowEnd}
                      onChange={e => setEatingWindowEnd(parseInt(e.target.value))}
                      data-testid="select-eating-window-end"
                      className="px-2 py-1.5 text-xs border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none transition-colors"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 mt-1.5">
                  Meals outside this window will be skipped and calories redistributed
                </p>
              </div>
            )}

            {fastingProtocol === "5:2" && (
              <div>
                <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">Fasting days (~500 cal)</p>
                <div className="flex flex-wrap gap-2">
                  {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map(day => {
                    const active = fastingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setFastingDays(prev => {
                            if (prev.includes(day)) {
                              if (prev.length <= 2) {
                                return prev;
                              }
                              return prev.filter(d => d !== day);
                            }
                            if (prev.length >= 2) {
                              return [prev[1], day];
                            }
                            return [...prev, day];
                          });
                        }}
                        data-testid={`fasting-day-${day}`}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          active
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                        }`}
                      >
                        {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-zinc-400 mt-1.5">Select 2 days for low-calorie fasting meals</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hydration goal */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 mb-3">
          <Droplets className="w-3.5 h-3.5 text-blue-400" />
          <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">Daily water goal</p>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex rounded-xl border border-zinc-200 overflow-hidden">
            {(["ml", "glasses"] as const).map(u => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  if (u === hydrationUnit) return;
                  if (u === "glasses") {
                    setHydrationGoalMl(Math.round(hydrationGoalMl / 250) * 250);
                  }
                  setHydrationUnit(u);
                }}
                data-testid={`hydration-unit-${u}`}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  hydrationUnit === u
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {u === "ml" ? "ml" : "Glasses"}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={hydrationUnit === "glasses" ? 2 : 500}
            max={hydrationUnit === "glasses" ? 24 : 6000}
            step={hydrationUnit === "glasses" ? 1 : 100}
            value={hydrationUnit === "glasses" ? Math.round(hydrationGoalMl / 250) : hydrationGoalMl}
            onChange={e => {
              const v = parseInt(e.target.value) || 0;
              setHydrationGoalMl(hydrationUnit === "glasses" ? v * 250 : v);
            }}
            data-testid="input-hydration-goal"
            className="w-24 px-3 py-1.5 text-sm border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none transition-colors"
          />
          <span className="text-xs text-zinc-400">
            {hydrationUnit === "glasses"
              ? `(${hydrationGoalMl}ml)`
              : `(${Math.round(hydrationGoalMl / 250)} glasses)`}
          </span>
        </div>
        <p className="text-xs text-zinc-400">Recommended: 8 glasses / 2,000ml per day</p>
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
