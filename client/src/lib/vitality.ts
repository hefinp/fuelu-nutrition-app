export type VitalityPhase = "morning" | "afternoon" | "evening";

export interface VitalityPhaseInfo {
  phase: VitalityPhase;
  name: string;
  tip: string;
  shortTip: string;
  colorClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

const PHASE_DATA: Record<VitalityPhase, Omit<VitalityPhaseInfo, "phase">> = {
  morning: {
    name: "Morning Peak",
    tip: "Energy peaks in the morning. Prioritise lean protein and zinc-rich foods to sustain focus and vitality.",
    shortTip: "Protein & zinc focus",
    colorClass: "text-amber-600",
    bgClass: "bg-amber-50",
    textClass: "text-amber-700",
    borderClass: "border-amber-200",
  },
  afternoon: {
    name: "Afternoon Plateau",
    tip: "Energy levels stabilise. Complex carbs and healthy fats help maintain steady focus through the day.",
    shortTip: "Sustained energy",
    colorClass: "text-blue-600",
    bgClass: "bg-blue-50",
    textClass: "text-blue-700",
    borderClass: "border-blue-200",
  },
  evening: {
    name: "Evening Recovery",
    tip: "Support overnight recovery with magnesium, zinc, and vitamin D-rich foods. Quality sleep is key for energy and wellbeing.",
    shortTip: "Recovery nutrients",
    colorClass: "text-indigo-600",
    bgClass: "bg-indigo-50",
    textClass: "text-indigo-700",
    borderClass: "border-indigo-200",
  },
};

export const VITALITY_NUTRITION_CALLOUTS: Record<VitalityPhase, string[]> = {
  morning: [
    "Lean protein prioritised for sustained morning energy (eggs, chicken, fish)",
    "Zinc-rich foods included for micronutrient density (pumpkin seeds, beef)",
    "Vitamin D sources favoured for overall wellbeing (eggs, salmon)",
  ],
  afternoon: [
    "Complex carbs for sustained energy and stress management (sweet potato, quinoa)",
    "Healthy fats to support nutrient absorption (avocado, olive oil, nuts)",
    "Cruciferous vegetables rich in fibre and vitamins (broccoli, cauliflower, kale)",
  ],
  evening: [
    "Magnesium target increased to support sleep and recovery (dark leafy greens, almonds)",
    "Zinc-rich foods to support overnight recovery (oysters, pumpkin seeds)",
    "Antioxidant-rich foods to reduce oxidative stress (berries, dark chocolate)",
  ],
};

export function getVitalityPhase(referenceDate?: Date): VitalityPhaseInfo {
  const now = referenceDate ?? new Date();
  const hour = now.getHours();

  let phase: VitalityPhase;
  if (hour >= 5 && hour < 12) {
    phase = "morning";
  } else if (hour >= 12 && hour < 18) {
    phase = "afternoon";
  } else {
    phase = "evening";
  }

  return { phase, ...PHASE_DATA[phase] };
}

export const PHASE_EMOJI: Record<VitalityPhase, string> = {
  morning: "🌅",
  afternoon: "☀️",
  evening: "🌙",
};
