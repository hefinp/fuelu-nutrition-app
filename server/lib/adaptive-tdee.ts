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

/**
 * Computes an adaptive TDEE (Total Daily Energy Expenditure) estimate using a
 * sliding-window energy balance approach. Instead of relying solely on the
 * Mifflin-St Jeor formula, this uses the user's actual food log and weight
 * trend to infer what their real metabolic rate is.
 *
 * Algorithm:
 *   TDEE ≈ avgDailyCalories + avgDailyExerciseCalories − (avgDailyWeightChange × 7700)
 *
 * The 7700 constant is the approximate energy density of body tissue in kcal/kg.
 * This is the widely-cited value from Hall (2008) and is a simplification — real
 * tissue is a mix of fat (~7700 kcal/kg) and lean mass (~1800 kcal/kg), but 7700
 * is the standard used in clinical energy-balance equations.
 *
 * The default 14-day window balances responsiveness with noise smoothing; shorter
 * windows are too noisy from water-weight fluctuations, longer windows lag behind
 * real metabolic changes.
 *
 * Minimum data requirements (return null if not met):
 *   - At least 2 weight entries in the window (to compute a trend)
 *   - At least 4 unique days of food logging (to get a meaningful calorie average)
 */
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

  // Need ≥2 weight entries (for a trend line) and ≥1 food day to compute anything
  if (recentWeight.length < 2 || recentFood.length === 0) return null;

  const uniqueDays = new Set(recentFood.map((e) => e.date));
  const logDays = uniqueDays.size;

  // <4 logged days yields unreliable averages due to day-to-day variance
  if (logDays < 4) return null;

  const totalCalories = recentFood.reduce((sum, e) => sum + e.calories, 0);
  const avgDailyCalories = totalCalories / logDays;

  // Incorporate Strava exercise calories when available — these are added to
  // intake in the energy balance equation because they represent expenditure
  // not captured by BMR alone
  let totalExerciseCalories = 0;
  if (exerciseCaloriesByDay) {
    for (const day of uniqueDays) {
      totalExerciseCalories += exerciseCaloriesByDay[day] ?? 0;
    }
  }
  const avgDailyExerciseCalories = totalExerciseCalories / logDays;

  // Use first-to-last weight entries for trend rather than a regression,
  // which is simpler and sufficient for a 14-day window
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

  // Core energy balance: TDEE = intake + exercise − tissue energy change
  // 7700 kcal/kg is the standard energy density of body mass (Hall 2008)
  const estimatedTdee = Math.round(
    avgDailyCalories + avgDailyExerciseCalories - (avgDailyWeightChangeKg * 7700)
  );

  // Confidence scoring: more data = higher confidence in the estimate
  // "high" requires ≥10 food-log days + ≥4 weigh-ins (solid 2-week picture)
  // "medium" requires ≥6 food-log days + ≥3 weigh-ins (usable but less certain)
  // "low" is everything else that passed the minimum thresholds above
  let confidence: "low" | "medium" | "high" = "low";
  if (logDays >= 10 && recentWeight.length >= 4) confidence = "high";
  else if (logDays >= 6 && recentWeight.length >= 3) confidence = "medium";

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

/**
 * Generates a plain-language explanation for why a calorie adjustment is being
 * suggested. Handles four scenarios:
 *   1. No meaningful change needed (<50 kcal delta)
 *   2. Losing faster than goal → increase calories to preserve muscle
 *   3. Gaining faster than goal → decrease calories
 *   4. Metabolism appears different from formula estimate → adjust accordingly
 * The explanation is shown directly to the user in the adaptive TDEE suggestion card.
 */
export function buildExplanation(
  currentCalories: number,
  suggestedCalories: number,
  result: AdaptiveTdeeResult
): string {
  const delta = suggestedCalories - currentCalories;
  const absKg = Math.abs(result.avgDailyWeightChangeKg * 7).toFixed(2);
  const direction = result.avgDailyWeightChangeKg < 0 ? "losing" : "gaining";
  const expectedDirection = currentCalories < result.estimatedTdee ? "losing" : "gaining";

  // <50 kcal difference is within noise / measurement error — don't suggest a change
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
