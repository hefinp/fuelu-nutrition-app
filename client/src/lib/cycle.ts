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

export const PHASE_NUTRITION_CALLOUTS: Record<CyclePhase, string[]> = {
  menstrual: [
    "Iron-rich foods prioritised to replace lost iron (spinach, lentils, red meat)",
    "Vitamin C meals included to boost iron absorption",
    "Anti-inflammatory ingredients favoured to ease cramps",
  ],
  follicular: [
    "Lean proteins featured to support rising oestrogen and energy",
    "Complex carbs included for sustained fuel as activity picks up",
    "Fermented foods added to support gut and hormone balance",
  ],
  ovulatory: [
    "Antioxidant-rich foods to manage inflammation at peak oestrogen",
    "High-fibre meals to support oestrogen clearance",
    "Omega-3 sources (salmon, walnuts) prioritised for inflammatory balance",
  ],
  luteal: [
    "Magnesium target increased — eases PMS, cravings, and mood dips",
    "Calorie target increased by ~50 kcal to match raised metabolic rate",
    "Comfort foods balanced with nutrient density to support progesterone",
  ],
};

export function getCyclePhase(lastPeriodDate: string, cycleLength: number = 28, referenceDate?: string): CycleInfo | null {
  if (!lastPeriodDate) return null;

  const start = new Date(lastPeriodDate);
  if (isNaN(start.getTime())) return null;

  const ref = referenceDate ? new Date(referenceDate) : new Date();
  if (isNaN(ref.getTime())) return null;
  ref.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  const diffMs = ref.getTime() - start.getTime();
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

export interface CyclePredictions {
  nextPeriodDate: Date;
  daysUntilNextPeriod: number;
  ovulationDate: Date;
  fertileWindowStart: Date;
  fertileWindowEnd: Date;
}

export function getCyclePredictions(
  lastPeriodDate: string,
  cycleLength: number = 28,
): CyclePredictions | null {
  if (!lastPeriodDate) return null;

  const start = new Date(lastPeriodDate);
  if (isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysSincePeriod = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const cyclesElapsed = Math.floor(daysSincePeriod / Math.max(cycleLength, 21));
  const currentCycleStart = new Date(start);
  currentCycleStart.setDate(currentCycleStart.getDate() + cyclesElapsed * Math.max(cycleLength, 21));

  const nextPeriodDate = new Date(currentCycleStart);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + Math.max(cycleLength, 21));

  const daysUntilNextPeriod = Math.round((nextPeriodDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const ovulationOffset = Math.max(cycleLength, 21) - 14;
  const ovulationDate = new Date(currentCycleStart);
  ovulationDate.setDate(ovulationDate.getDate() + ovulationOffset);

  const fertileWindowStart = new Date(ovulationDate);
  fertileWindowStart.setDate(fertileWindowStart.getDate() - 5);

  const fertileWindowEnd = new Date(ovulationDate);

  return { nextPeriodDate, daysUntilNextPeriod, ovulationDate, fertileWindowStart, fertileWindowEnd };
}

export interface UpcomingPhaseDay {
  date: Date;
  phase: CyclePhase;
  day: number;
  isToday: boolean;
}

export function getUpcomingPhases(
  lastPeriodDate: string,
  cycleLength: number = 28,
  periodLength: number = 5,
  days: number = 21,
): UpcomingPhaseDay[] {
  if (!lastPeriodDate) return [];

  const start = new Date(lastPeriodDate);
  if (isNaN(start.getTime())) return [];
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result: UpcomingPhaseDay[] = [];
  const cl = Math.max(cycleLength, 21);
  const pl = Math.max(2, Math.min(periodLength, 8));

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    const diffMs = date.getTime() - start.getTime();
    const daysSincePeriod = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const day = (daysSincePeriod % cl) + 1;

    let phase: CyclePhase;
    if (day <= pl) {
      phase = "menstrual";
    } else if (day <= 13) {
      phase = "follicular";
    } else if (day <= 16) {
      phase = "ovulatory";
    } else {
      phase = "luteal";
    }

    result.push({ date, phase, day, isToday: i === 0 });
  }

  return result;
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
