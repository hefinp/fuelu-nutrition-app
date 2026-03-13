import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCreateCalculation } from "@/hooks/use-calculations";
import type { UserPreferences } from "@shared/schema";
import {
  X, ChevronRight, ChevronLeft, Loader2,
  Target, TrendingDown, Dumbbell, Flame,
} from "lucide-react";

type Goal = "lose" | "maintain" | "muscle";

const GOAL_OPTIONS: { value: Goal; label: string; desc: string; Icon: typeof Target; color: string }[] = [
  { value: "lose", label: "Lose Weight", desc: "Shed fat while keeping muscle", Icon: TrendingDown, color: "bg-rose-100 text-rose-600" },
  { value: "maintain", label: "Maintain", desc: "Stay right where you are", Icon: Target, color: "bg-emerald-100 text-emerald-600" },
  { value: "muscle", label: "Build Muscle", desc: "Gain lean mass with a surplus", Icon: Dumbbell, color: "bg-blue-100 text-blue-600" },
];

const DIET_CHIPS = [
  "Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Halal", "Kosher",
] as const;

const DIET_TO_PREF: Record<string, { diet?: string; allergy?: string }> = {
  Vegetarian: { diet: "vegetarian" },
  Vegan: { diet: "vegan" },
  "Gluten-free": { allergy: "gluten" },
  "Dairy-free": { allergy: "dairy" },
  "Nut-free": { allergy: "nuts" },
  Halal: { diet: "halal" },
  Kosher: { diet: "kosher" },
};

interface MacroPreview {
  dailyCalories: number;
  weeklyCalories: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
}

interface Props {
  userPrefs: UserPreferences | undefined;
  onComplete: (calculation: Record<string, unknown>) => void;
  onSkip: () => void;
}

export function OnboardingWizard({ userPrefs, onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const [goal, setGoal] = useState<Goal | null>(null);
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [macros, setMacros] = useState<MacroPreview | null>(null);
  const [macrosLoading, setMacrosLoading] = useState(false);

  const createCalc = useCreateCalculation();
  const queryClient = useQueryClient();

  const parsedAge = parseInt(age);
  const parsedHeight = parseFloat(heightCm);
  const parsedWeight = parseFloat(weightKg);
  const biometricsValid =
    Number.isFinite(parsedAge) && parsedAge >= 13 && parsedAge <= 99 &&
    Number.isFinite(parsedHeight) && parsedHeight >= 100 && parsedHeight <= 250 &&
    Number.isFinite(parsedWeight) && parsedWeight >= 30 && parsedWeight <= 300;

  useEffect(() => {
    if (!goal || !biometricsValid) { setMacros(null); return; }
    let cancelled = false;
    setMacrosLoading(true);
    fetch("/api/calculations/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ weight: weightKg, height: heightCm, age: parsedAge, gender: sex, goal }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setMacros(data ?? null); })
      .finally(() => { if (!cancelled) setMacrosLoading(false); });
    return () => { cancelled = true; };
  }, [goal, weightKg, heightCm, parsedAge, sex, biometricsValid]);

  const canAdvance = [
    goal !== null,
    biometricsValid,
    true,
    macros !== null,
  ];

  function goNext() {
    if (step < 3) {
      setDirection(1);
      setStep(s => s + 1);
    }
  }

  function goBack() {
    if (step > 0) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  }

  function toggleChip(chip: string) {
    setSelectedChips(prev =>
      prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
    );
  }

  const handleSave = useCallback(async () => {
    if (!macros || !goal) return;
    setSaving(true);
    setSaveError("");
    try {
      const result = await createCalc.mutateAsync({
        weight: weightKg,
        height: heightCm,
        age: parsedAge,
        gender: sex,
        activityLevel: "moderate",
        goal,
        targetType: "weekly",
        targetAmount: null,
      });

      const diets = selectedChips.map(c => DIET_TO_PREF[c]?.diet).filter(Boolean) as string[];
      const allergies = selectedChips.map(c => DIET_TO_PREF[c]?.allergy).filter(Boolean) as string[];
      const dietValue = diets[0] ?? null;

      await apiRequest("PUT", "/api/user/preferences", {
        ...userPrefs,
        diet: dietValue,
        allergies,
        onboardingComplete: true,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      onComplete(result as Record<string, unknown>);
    } catch (e) {
      setSaving(false);
      setSaveError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }, [macros, goal, selectedChips, userPrefs, weightKg, heightCm, parsedAge, sex, createCalc, queryClient, onComplete]);

  const stepContent = [
    <StepGoal key="goal" goal={goal} setGoal={setGoal} />,
    <StepAboutYou key="about" age={age} setAge={setAge} sex={sex} setSex={setSex} heightCm={heightCm} setHeightCm={setHeightCm} weightKg={weightKg} setWeightKg={setWeightKg} />,
    <StepDiet key="diet" selectedChips={selectedChips} toggleChip={toggleChip} />,
    <StepSummary key="summary" macros={macros} goal={goal} loading={macrosLoading} />,
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      data-testid="onboarding-wizard-overlay"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative"
      >
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors z-10"
          data-testid="button-wizard-skip"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 pb-0 min-h-[280px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ x: direction * 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction * -40, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {stepContent[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-8 pt-6">
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-zinc-900" : "w-1.5 bg-zinc-200"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={goBack}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                data-testid="button-wizard-back"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={goNext}
                disabled={!canAdvance[step]}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="button-wizard-next"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !macros}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-40"
                data-testid="button-wizard-save"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                Save and get started
              </button>
            )}
          </div>

          {saveError && (
            <p className="mt-3 text-xs text-red-600 text-center" data-testid="wizard-save-error">{saveError}</p>
          )}

          <button
            onClick={onSkip}
            className="w-full mt-3 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            data-testid="button-wizard-skip-text"
          >
            I'll do this myself
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StepGoal({ goal, setGoal }: { goal: Goal | null; setGoal: (g: Goal) => void }) {
  return (
    <div className="text-center">
      <h2 className="text-xl font-display font-bold text-zinc-900 mb-1" data-testid="wizard-step-title">
        What's your goal?
      </h2>
      <p className="text-sm text-zinc-400 mb-6">Pick the one that fits best right now.</p>
      <div className="flex flex-col gap-3">
        {GOAL_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setGoal(opt.value)}
            className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
              goal === opt.value
                ? "border-zinc-900 bg-zinc-50"
                : "border-zinc-100 hover:border-zinc-300"
            }`}
            data-testid={`wizard-goal-${opt.value}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${opt.color}`}>
              <opt.Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-sm text-zinc-900">{opt.label}</p>
              <p className="text-xs text-zinc-400">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepAboutYou({
  age, setAge, sex, setSex, heightCm, setHeightCm, weightKg, setWeightKg,
}: {
  age: string; setAge: (v: string) => void;
  sex: "male" | "female"; setSex: (v: "male" | "female") => void;
  heightCm: string; setHeightCm: (v: string) => void;
  weightKg: string; setWeightKg: (v: string) => void;
}) {
  return (
    <div className="text-center">
      <h2 className="text-xl font-display font-bold text-zinc-900 mb-1" data-testid="wizard-step-title">
        Tell us a little about yourself
      </h2>
      <p className="text-sm text-zinc-400 mb-6">We use this to calculate your ideal calorie target.</p>
      <div className="space-y-4 text-left">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Age</label>
            <input
              type="number"
              inputMode="numeric"
              min={13}
              max={99}
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="30"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              data-testid="wizard-input-age"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Sex</label>
            <div className="flex gap-2">
              {(["male", "female"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSex(s)}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all capitalize ${
                    sex === s ? "border-zinc-900 bg-zinc-50 text-zinc-900" : "border-zinc-200 text-zinc-400 hover:border-zinc-300"
                  }`}
                  data-testid={`wizard-sex-${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Height (cm)</label>
            <input
              type="number"
              inputMode="decimal"
              min={100}
              max={250}
              value={heightCm}
              onChange={e => setHeightCm(e.target.value)}
              placeholder="175"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              data-testid="wizard-input-height"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Weight (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              min={30}
              max={300}
              value={weightKg}
              onChange={e => setWeightKg(e.target.value)}
              placeholder="75"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              data-testid="wizard-input-weight"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDiet({ selectedChips, toggleChip }: { selectedChips: string[]; toggleChip: (c: string) => void }) {
  return (
    <div className="text-center">
      <h2 className="text-xl font-display font-bold text-zinc-900 mb-1" data-testid="wizard-step-title">
        Any dietary preferences or allergies?
      </h2>
      <p className="text-sm text-zinc-400 mb-6">Select all that apply — or skip if none.</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {DIET_CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => toggleChip(chip)}
            className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
              selectedChips.includes(chip)
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
            }`}
            data-testid={`wizard-chip-${chip.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepSummary({ macros, goal, loading }: { macros: MacroPreview | null; goal: Goal | null; loading?: boolean }) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400 mb-2" />
        <p className="text-sm text-zinc-400">Calculating your targets...</p>
      </div>
    );
  }
  if (!macros) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-zinc-400">Go back and fill in your details to see your plan.</p>
      </div>
    );
  }

  const goalLabel = goal === "lose" ? "Fat Loss" : goal === "muscle" ? "Muscle Gain" : "Maintenance";

  return (
    <div className="text-center">
      <h2 className="text-xl font-display font-bold text-zinc-900 mb-1" data-testid="wizard-step-title">
        Here's your personalised plan
      </h2>
      <p className="text-sm text-zinc-400 mb-6">Based on your inputs, we recommend:</p>

      <div className="bg-zinc-900 text-white rounded-2xl p-6 text-left space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">Goal</span>
          <span className="text-sm font-semibold">{goalLabel}</span>
        </div>
        <div className="border-t border-zinc-700" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">Daily Calories</span>
          <span className="text-2xl font-bold" data-testid="wizard-daily-calories">{macros.dailyCalories.toLocaleString()} kcal</span>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-zinc-400">Protein</p>
            <p className="text-lg font-bold" data-testid="wizard-protein">{macros.proteinGoal}g</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-zinc-400">Carbs</p>
            <p className="text-lg font-bold" data-testid="wizard-carbs">{macros.carbsGoal}g</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-zinc-400">Fat</p>
            <p className="text-lg font-bold" data-testid="wizard-fat">{macros.fatGoal}g</p>
          </div>
        </div>
      </div>
    </div>
  );
}

