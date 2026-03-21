import type { WeightEntry, FoodLogEntry } from "@shared/schema";

export type AdaptiveTdeeResult = {
  estimatedTdee: number;
  avgDailyCalories: number;
  avgDailyWeightChangeKg: number;
  avgDailyExerciseCalories: number;
  confidence: "low" | "medium" | "high";
  logDays: number;
  weightEntryCount: number;
};

export function computeAdaptiveTdee(
  weightEntries: WeightEntry[],
  foodLogEntries: FoodLogEntry[],
  windowDays = 14,
  exerciseCaloriesByDay?: Record<string, number>
): AdaptiveTdeeResult | null {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const recentWeight = weightEntries
    .filter((e) => new Date(e.recordedAt!) >= cutoff)
    .sort((a, b) => new Date(a.recordedAt!).getTime() - new Date(b.recordedAt!).getTime());

  const recentFood = foodLogEntries.filter((e) => {
    const d = new Date(e.date);
    return d >= cutoff;
  });

  if (recentWeight.length < 2 || recentFood.length === 0) return null;

  const uniqueDays = new Set(recentFood.map((e) => e.date));
  const logDays = uniqueDays.size;

  if (logDays < 4) return null;

  const totalCalories = recentFood.reduce((sum, e) => sum + e.calories, 0);
  const avgDailyCalories = totalCalories / logDays;

  let totalExerciseCalories = 0;
  if (exerciseCaloriesByDay) {
    for (const day of uniqueDays) {
      totalExerciseCalories += exerciseCaloriesByDay[day] ?? 0;
    }
  }
  const avgDailyExerciseCalories = totalExerciseCalories / logDays;

  const firstWeight = parseFloat(String(recentWeight[0].weight));
  const lastWeight = parseFloat(String(recentWeight[recentWeight.length - 1].weight));
  const firstDate = new Date(recentWeight[0].recordedAt!);
  const lastDate = new Date(recentWeight[recentWeight.length - 1].recordedAt!);
  const daysBetween = Math.max(
    1,
    (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const totalWeightChangeKg = lastWeight - firstWeight;
  const avgDailyWeightChangeKg = totalWeightChangeKg / daysBetween;

  const estimatedTdee = Math.round(
    avgDailyCalories - (avgDailyWeightChangeKg * 7700)
  );

  let confidence: "low" | "medium" | "high" = "low";
  if (logDays >= 10 && recentWeight.length >= 4) confidence = "high";
  else if (logDays >= 6 && recentWeight.length >= 3) confidence = "medium";

  if (avgDailyExerciseCalories > 0 && confidence !== "high") {
    confidence = confidence === "low" ? "medium" : "high";
  }

  return {
    estimatedTdee,
    avgDailyCalories,
    avgDailyWeightChangeKg,
    avgDailyExerciseCalories,
    confidence,
    logDays,
    weightEntryCount: recentWeight.length,
  };
}

export function buildExplanation(
  currentCalories: number,
  suggestedCalories: number,
  result: AdaptiveTdeeResult
): string {
  const delta = suggestedCalories - currentCalories;
  const absKg = Math.abs(result.avgDailyWeightChangeKg * 7).toFixed(2);
  const direction = result.avgDailyWeightChangeKg < 0 ? "losing" : "gaining";
  const expectedDirection = currentCalories < result.estimatedTdee ? "losing" : "gaining";

  if (Math.abs(delta) < 50) {
    return `Your intake and weight are well-matched — no adjustment needed. You've been averaging ${Math.round(result.avgDailyCalories)} kcal/day and your weight has been stable.`;
  }

  if (direction === "losing" && delta > 0) {
    return `You're ${direction} about ${absKg} kg/week — faster than your goal. We've adjusted your target up by ${Math.abs(delta)} kcal to slow the rate of loss and protect muscle.`;
  }

  if (direction === "gaining" && delta < 0) {
    return `You're ${direction} about ${absKg} kg/week — more than intended. We've adjusted your target down by ${Math.abs(delta)} kcal to bring the rate in line with your goal.`;
  }

  if (direction === "losing" && delta < 0) {
    return `You're ${direction} ${absKg} kg/week but eating ${Math.round(result.avgDailyCalories)} kcal/day on average — your metabolism appears lower than estimated. Target adjusted down by ${Math.abs(delta)} kcal.`;
  }

  if (direction === "gaining" && delta > 0) {
    return `You're ${direction} ${absKg} kg/week while eating ${Math.round(result.avgDailyCalories)} kcal/day — your metabolism appears higher than estimated. Target adjusted up by ${Math.abs(delta)} kcal.`;
  }

  const exerciseNote = result.avgDailyExerciseCalories > 50
    ? ` Your Strava data shows ~${Math.round(result.avgDailyExerciseCalories)} kcal/day in exercise.`
    : "";

  return `Based on your last 14 days of data, your estimated real TDEE is ${result.estimatedTdee} kcal. We've ${delta > 0 ? "increased" : "decreased"} your daily target by ${Math.abs(delta)} kcal to better match your actual metabolism.${exerciseNote}`;
}
