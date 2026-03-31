import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Flame, Droplets, Target, CheckCircle2, Loader2, TrendingUp } from "lucide-react";
import type { FoodLogEntry } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

const TOLERANCE = 0.10;

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function nDaysAgoStr(n: number) {
  return format(subDays(new Date(), n), "yyyy-MM-dd");
}

interface MyMomentumWidgetProps {
  dailyCalories?: number;
  proteinGoal?: number;
  carbsGoal?: number;
  fatGoal?: number;
  hydrationGoalMl?: number;
}

export function MyMomentumWidget({
  dailyCalories,
  proteinGoal,
  carbsGoal,
  fatGoal,
  hydrationGoalMl = 2000,
}: MyMomentumWidgetProps) {
  const { user } = useAuth();
  const today = todayStr();
  const streakFrom = nDaysAgoStr(89);
  const weekFrom = nDaysAgoStr(6);

  const { data: allLogEntries = [], isLoading: logsLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log-momentum-streak", streakFrom, today],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?from=${streakFrom}&to=${today}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch food log: ${res.status}`);
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const weekDates = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), "yyyy-MM-dd"));

  const { data: weekHydration = {}, isLoading: hydrationLoading } = useQuery<Record<string, number>>({
    queryKey: ["/api/hydration-week-momentum", weekFrom, today],
    queryFn: async () => {
      const results: Record<string, number> = {};
      await Promise.all(
        weekDates.map(async (date) => {
          try {
            const res = await fetch(`/api/hydration?date=${date}`, { credentials: "include" });
            if (res.ok) {
              const data = await res.json();
              results[date] = data.totalMl ?? 0;
            } else {
              results[date] = 0;
            }
          } catch {
            results[date] = 0;
          }
        })
      );
      return results;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const isLoading = logsLoading || hydrationLoading;

  const loggedDates = new Set<string>();
  const dayTotals: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};

  for (const entry of allLogEntries) {
    loggedDates.add(entry.date);
    if (!dayTotals[entry.date]) {
      dayTotals[entry.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    dayTotals[entry.date].calories += entry.calories;
    dayTotals[entry.date].protein += entry.protein;
    dayTotals[entry.date].carbs += entry.carbs;
    dayTotals[entry.date].fat += entry.fat;
  }

  const todayHasLogs = loggedDates.has(today);
  let streak = 0;
  const startOffset = todayHasLogs ? 0 : 1;
  for (let i = startOffset; i < 90; i++) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    if (loggedDates.has(d)) {
      streak++;
    } else {
      break;
    }
  }

  function isHit(actual: number, target: number | undefined): boolean {
    if (!target) return false;
    const lo = target * (1 - TOLERANCE);
    const hi = target * (1 + TOLERANCE);
    return actual >= lo && actual <= hi;
  }

  let macroComplianceDays = 0;
  let calorieComplianceDays = 0;
  let hydrationComplianceDays = 0;

  for (let i = 0; i < 7; i++) {
    const date = weekDates[i];
    const totals = dayTotals[date];

    if (totals) {
      const calHit = isHit(totals.calories, dailyCalories);
      const proHit = isHit(totals.protein, proteinGoal);
      const carbHit = isHit(totals.carbs, carbsGoal);
      const fatHit = isHit(totals.fat, fatGoal);

      if (calHit) calorieComplianceDays++;

      const activeMacros: boolean[] = [];
      if (dailyCalories) activeMacros.push(calHit);
      if (proteinGoal) activeMacros.push(proHit);
      if (carbsGoal) activeMacros.push(carbHit);
      if (fatGoal) activeMacros.push(fatHit);
      if (activeMacros.length > 0 && activeMacros.every(Boolean)) {
        macroComplianceDays++;
      }
    }

    const totalMl = weekHydration[date] ?? 0;
    if (hydrationGoalMl > 0 && totalMl >= hydrationGoalMl) {
      hydrationComplianceDays++;
    }
  }

  const stats = [
    {
      icon: Flame,
      label: "Logging Streak",
      value: `${streak} day${streak !== 1 ? "s" : ""}`,
      color: "text-orange-500",
      bgColor: "bg-orange-50",
    },
    {
      icon: Target,
      label: "Macro Compliance",
      value: `${macroComplianceDays}/7 days`,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      icon: Droplets,
      label: "Hydration",
      value: `${hydrationComplianceDays}/7 days`,
      color: "text-cyan-500",
      bgColor: "bg-cyan-50",
    },
    {
      icon: CheckCircle2,
      label: "Calorie Target",
      value: `${calorieComplianceDays}/7 days`,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50",
    },
  ];

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-lg p-4 sm:p-6" data-testid="widget-my-momentum">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-display font-bold text-zinc-900">My Momentum</h3>
          <p className="text-xs text-zinc-400">Your streaks & weekly compliance</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`${stat.bgColor} rounded-2xl p-3 flex flex-col gap-1.5`}
              data-testid={`momentum-stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-center gap-1.5">
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                <span className="text-[11px] font-medium text-zinc-500">{stat.label}</span>
              </div>
              <span className="text-sm font-bold text-zinc-900">{stat.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
