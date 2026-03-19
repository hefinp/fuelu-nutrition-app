export interface Meal {
  meal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  vitalityRationale?: string;
  ingredientsJson?: Array<{ name: string; grams: number; calories100g: number; protein100g?: number; carbs100g?: number; fat100g?: number }>;
}

export interface DayMealPlan {
  breakfast: Meal[];
  lunch: Meal[];
  dinner: Meal[];
  snacks: Meal[];
  dayTotalCalories: number;
  dayTotalProtein: number;
  dayTotalCarbs: number;
  dayTotalFat: number;
}

export interface DailyPlan extends DayMealPlan {
  planType: 'daily';
  targetDate?: string;
  cyclePhase?: string;
  cycleOptimised?: boolean;
}

export interface MultiDailyPlan {
  planType: 'multi-daily';
  targetDates: string[];
  days: Record<string, DayMealPlan>;
  cyclePhaseByDate?: Record<string, string>;
  cycleOptimised?: boolean;
}

export interface WeeklyPlan {
  planType: 'weekly';
  weekStartDate: string;
  monday?: DayMealPlan;
  tuesday?: DayMealPlan;
  wednesday?: DayMealPlan;
  thursday?: DayMealPlan;
  friday?: DayMealPlan;
  saturday?: DayMealPlan;
  sunday?: DayMealPlan;
  weekTotalCalories: number;
  weekTotalProtein: number;
  weekTotalCarbs: number;
  weekTotalFat: number;
  cyclePhaseByDay?: Record<string, string>;
  cycleOptimised?: boolean;
}

export type MealPlan = DailyPlan | MultiDailyPlan | WeeklyPlan;

export type SlotKey = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const SLOT_KEYS: SlotKey[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export type WeekDay = typeof WEEK_DAYS[number];

export interface ReplacePickerState {
  dayKey: string;
  slotKey: string;
  mealIdx: number;
  context: 'generator' | 'custom';
}

export interface AddMealPopoverState {
  dayKey: string;
  slotKey: string;
}

export interface CopyMovePopoverState {
  x: number;
  y: number;
  source: { dayKey: string; slotKey: string; mealIdx: number };
  target: { dayKey: string; slotKey: string };
}

export interface DragSourceState {
  dayKey: string;
  slotKey: string;
  mealIdx: number;
}

export interface DropTargetState {
  dayKey: string;
  slotKey: string;
}

export function getDayPlan(plan: MealPlan, dayKey: string): DayMealPlan | undefined {
  if (plan.planType === 'weekly') {
    return (plan as any)[dayKey] as DayMealPlan | undefined;
  }
  if (plan.planType === 'multi-daily') {
    return plan.days[dayKey];
  }
  return plan as DayMealPlan;
}

export function recalcDayTotals(dayPlan: DayMealPlan): void {
  const all = [...(dayPlan.breakfast || []), ...(dayPlan.lunch || []), ...(dayPlan.dinner || []), ...(dayPlan.snacks || [])];
  dayPlan.dayTotalCalories = all.reduce((s, m) => s + m.calories, 0);
  dayPlan.dayTotalProtein = all.reduce((s, m) => s + m.protein, 0);
  dayPlan.dayTotalCarbs = all.reduce((s, m) => s + m.carbs, 0);
  dayPlan.dayTotalFat = all.reduce((s, m) => s + m.fat, 0);
}

export function recalcWeekTotals(plan: WeeklyPlan): void {
  let wCal = 0, wPro = 0, wCarb = 0, wFat = 0;
  for (const d of WEEK_DAYS) {
    const dp = plan[d];
    if (dp) {
      wCal += dp.dayTotalCalories || 0;
      wPro += dp.dayTotalProtein || 0;
      wCarb += dp.dayTotalCarbs || 0;
      wFat += dp.dayTotalFat || 0;
    }
  }
  plan.weekTotalCalories = wCal;
  plan.weekTotalProtein = wPro;
  plan.weekTotalCarbs = wCarb;
  plan.weekTotalFat = wFat;
}
