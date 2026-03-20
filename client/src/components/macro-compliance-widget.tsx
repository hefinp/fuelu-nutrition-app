import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { CheckCircle2, Target, Loader2 } from "lucide-react";
import type { FoodLogEntry } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

interface MacroComplianceWidgetProps {
  dailyCalories?: number;
  proteinGoal?: number;
  carbsGoal?: number;
  fatGoal?: number;
}

const TOLERANCE = 0.10;

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function nDaysAgoStr(n: number) {
  return format(subDays(new Date(), n), "yyyy-MM-dd");
}

interface DayCompliance {
  dateStr: string;
  dayLabel: string;
  calories: boolean | null;
  protein: boolean | null;
  carbs: boolean | null;
  fat: boolean | null;
  logged: boolean;
}

const MACRO_COLORS: Record<string, string> = {
  calories: "bg-orange-400",
  protein: "bg-blue-400",
  carbs: "bg-amber-400",
  fat: "bg-rose-400",
};

const MACRO_LABELS: Record<string, string> = {
  calories: "Cal",
  protein: "Pro",
  carbs: "Crb",
  fat: "Fat",
};

export function MacroComplianceWidget({
  dailyCalories,
  proteinGoal,
  carbsGoal,
  fatGoal,
}: MacroComplianceWidgetProps) {
  const { user } = useAuth();
  const today = todayStr();
  const weekFrom = nDaysAgoStr(6);

  const { data: logEntries = [], isLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log-week-compliance", weekFrom, today],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?from=${weekFrom}&to=${today}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch food log: ${res.status}`);
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const hasTargets = !!(dailyCalories || proteinGoal || carbsGoal || fatGoal);

  const dayMap: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};
  for (const entry of logEntries) {
    if (!dayMap[entry.date]) {
      dayMap[entry.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    dayMap[entry.date].calories += entry.calories;
    dayMap[entry.date].protein += entry.protein;
    dayMap[entry.date].carbs += entry.carbs;
    dayMap[entry.date].fat += entry.fat;
  }

  function isHit(actual: number, target: number | undefined): boolean | null {
    if (!target) return null;
    const lo = target * (1 - TOLERANCE);
    const hi = target * (1 + TOLERANCE);
    return actual >= lo && actual <= hi;
  }

  const days: DayCompliance[] = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    const dayLabel = format(d, "EEEEE");
    const totals = dayMap[dateStr];
    const logged = !!totals;
    return {
      dateStr,
      dayLabel,
      logged,
      calories: logged ? isHit(totals.calories, dailyCalories) : null,
      protein: logged ? isHit(totals.protein, proteinGoal) : null,
      carbs: logged ? isHit(totals.carbs, carbsGoal) : null,
      fat: logged ? isHit(totals.fat, fatGoal) : null,
    };
  });

  const macros: Array<keyof Omit<DayCompliance, "dateStr" | "dayLabel" | "logged">> = [
    "calories",
    "protein",
    "carbs",
    "fat",
  ];

  const activeMacros = macros.filter(m =>
    m === "calories" ? !!dailyCalories :
    m === "protein" ? !!proteinGoal :
    m === "carbs" ? !!carbsGoal :
    !!fatGoal
  );

  const daysOnTarget = days.filter(
    d => d.logged && activeMacros.length > 0 && activeMacros.every(m => d[m] === true)
  ).length;

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 sm:p-6" data-testid="widget-macro-compliance">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
          <Target className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-display font-bold text-zinc-900">Macro Compliance</h3>
          <p className="text-xs text-zinc-400">Past 7 days vs your targets (±10%)</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : !hasTargets ? (
        <div className="text-center py-6 text-xs text-zinc-400">
          Enter your metrics to see compliance data.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-zinc-50 rounded-2xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-xs text-zinc-700">
              <span className="font-bold text-zinc-900">{daysOnTarget}/7</span> days all macros on target
            </p>
          </div>

          {/* 7-column grid */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {days.map((day) => (
              <div key={day.dateStr} className="flex flex-col items-center gap-1" data-testid={`compliance-day-${day.dateStr}`}>
                <span className="text-[10px] font-medium text-zinc-400 uppercase">{day.dayLabel}</span>
                {macros.map((macro) => {
                  const hit = day[macro];
                  return (
                    <div
                      key={macro}
                      title={`${MACRO_LABELS[macro]}: ${hit === null ? "no data" : hit ? "on target" : "missed"}`}
                      className={`w-full aspect-square rounded-sm ${
                        hit === null
                          ? "bg-zinc-100"
                          : hit
                          ? MACRO_COLORS[macro]
                          : "bg-zinc-200"
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {macros.map((macro) => (
              <div key={macro} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-sm ${MACRO_COLORS[macro]}`} />
                <span className="text-[10px] text-zinc-400">{macro.charAt(0).toUpperCase() + macro.slice(1)}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-zinc-200" />
              <span className="text-[10px] text-zinc-400">Missed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-zinc-100" />
              <span className="text-[10px] text-zinc-400">No log</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
