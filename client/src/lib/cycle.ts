export type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal";

export interface CycleInfo {
  phase: CyclePhase;
  day: number;
  name: string;
  tip: string;
  shortTip: string;
  colorClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

const PHASE_DATA: Record<CyclePhase, Omit<CycleInfo, "phase" | "day">> = {
  menstrual: {
    name: "Menstrual",
    tip: "Prioritise iron-rich foods — red meat, lentils, spinach, and vitamin C to aid absorption.",
    shortTip: "Iron & vitamin C focus",
    colorClass: "text-rose-600",
    bgClass: "bg-rose-50",
    textClass: "text-rose-700",
    borderClass: "border-rose-200",
  },
  follicular: {
    name: "Follicular",
    tip: "Lean proteins and complex carbs support rising energy. Try eggs, quinoa, and fermented foods.",
    shortTip: "Lean protein & energy",
    colorClass: "text-emerald-600",
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-200",
  },
  ovulatory: {
    name: "Ovulatory",
    tip: "Antioxidant-rich foods help manage inflammation. Focus on salmon, berries, and leafy greens.",
    shortTip: "Antioxidant-rich meals",
    colorClass: "text-amber-600",
    bgClass: "bg-amber-50",
    textClass: "text-amber-700",
    borderClass: "border-amber-200",
  },
  luteal: {
    name: "Luteal",
    tip: "Magnesium-rich foods ease cravings and mood. Try turkey, dark chocolate, nuts, and sweet potato.",
    shortTip: "Magnesium & comfort foods",
    colorClass: "text-violet-600",
    bgClass: "bg-violet-50",
    textClass: "text-violet-700",
    borderClass: "border-violet-200",
  },
};

export function getCyclePhase(lastPeriodDate: string, cycleLength: number = 28): CycleInfo | null {
  if (!lastPeriodDate) return null;

  const start = new Date(lastPeriodDate);
  if (isNaN(start.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - start.getTime();
  if (diffMs < 0) return null;

  const daysSincePeriod = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const day = (daysSincePeriod % Math.max(cycleLength, 21)) + 1;

  let phase: CyclePhase;
  if (day <= 5) {
    phase = "menstrual";
  } else if (day <= 13) {
    phase = "follicular";
  } else if (day <= 16) {
    phase = "ovulatory";
  } else {
    phase = "luteal";
  }

  return { phase, day, ...PHASE_DATA[phase] };
}
