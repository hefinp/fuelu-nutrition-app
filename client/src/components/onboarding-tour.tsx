import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, SlidersHorizontal, UtensilsCrossed, ClipboardList,
  Droplets, Scale, BookMarked, Rocket, ChevronRight, ChevronLeft, X,
} from "lucide-react";

const STEPS = [
  {
    Icon: Sparkles,
    title: "Welcome to FuelU",
    description: "Let's take a 30-second tour of everything you can do. You can skip this at any time.",
    accent: "bg-violet-100 text-violet-600",
  },
  {
    Icon: SlidersHorizontal,
    title: "Enter Your Metrics",
    description: "Start by entering your weight, height, age, and fitness goal. FuelU calculates your daily calorie target and a personalised protein, carbs, and fat breakdown.",
    accent: "bg-blue-100 text-blue-600",
  },
  {
    Icon: UtensilsCrossed,
    title: "Meal Planning",
    description: "Generate daily or weekly meal plans in three styles — Simple, Fancy, or Michelin. Don't like a meal? Tap replace and get a new one instantly.",
    accent: "bg-amber-100 text-amber-600",
  },
  {
    Icon: ClipboardList,
    title: "Food Log",
    description: "Track what you eat each day with macro progress bars that show how close you are to your targets. Switch to weekly view for a broader picture.",
    accent: "bg-emerald-100 text-emerald-600",
  },
  {
    Icon: Droplets,
    title: "Hydration Tracker",
    description: "Set a daily water goal, log glasses or millilitres with quick-add buttons, and get a gentle nudge if you're falling behind.",
    accent: "bg-sky-100 text-sky-600",
  },
  {
    Icon: Scale,
    title: "Weight Tracker",
    description: "Log your weight over time and watch your progress on a chart. See your current weight, total change, and recent entries at a glance.",
    accent: "bg-rose-100 text-rose-600",
  },
  {
    Icon: BookMarked,
    title: "Recipe Library",
    description: "Import recipes from your favourite websites. FuelU extracts the nutrition info and can include them in your generated meal plans.",
    accent: "bg-orange-100 text-orange-600",
  },
  {
    Icon: Rocket,
    title: "You're All Set!",
    description: "Your dashboard is ready. You can customise which widgets you see and rearrange them from the settings panel. Enjoy!",
    accent: "bg-zinc-900 text-white",
  },
];

export function OnboardingTour({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  function goNext() {
    if (isLast) { onDismiss(); return; }
    setDirection(1);
    setStep(s => s + 1);
  }

  function goBack() {
    if (isFirst) return;
    setDirection(-1);
    setStep(s => s - 1);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      data-testid="onboarding-overlay"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative"
      >
        {!isLast && (
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors z-10"
            data-testid="button-skip-tour"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="p-8 pb-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ x: direction * 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction * -40, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex flex-col items-center text-center"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${current.accent}`}>
                <current.Icon className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-display font-bold text-zinc-900 mb-2" data-testid="onboarding-title">
                {current.title}
              </h2>
              <p className="text-sm text-zinc-500 leading-relaxed max-w-xs" data-testid="onboarding-description">
                {current.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-8 pt-6">
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-zinc-900" : "w-1.5 bg-zinc-200"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {!isFirst && (
              <button
                onClick={goBack}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                data-testid="button-tour-back"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={goNext}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isLast
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
              data-testid={isLast ? "button-tour-finish" : "button-tour-next"}
            >
              {isLast ? (
                <>
                  <Rocket className="w-4 h-4" />
                  Get Started
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {!isLast && (
            <button
              onClick={onDismiss}
              className="w-full mt-3 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
              data-testid="button-skip-tour-text"
            >
              Skip tour
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
