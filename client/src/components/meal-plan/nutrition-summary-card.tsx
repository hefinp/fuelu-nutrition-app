import { CalendarDays } from "lucide-react";

interface NutritionSummaryCardProps {
  dayLabel: string;
  calories: number;
  targetCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  dayKey: string;
}

export function NutritionSummaryCard({ dayLabel, calories, targetCalories, protein, carbs, fat, dayKey }: NutritionSummaryCardProps) {
  const calPct = targetCalories > 0 ? Math.min(100, Math.round((calories / targetCalories) * 100)) : 0;

  return (
    <div className="bg-zinc-900 text-white rounded-2xl relative overflow-hidden mb-3" data-testid={`nutrition-summary-${dayKey}`}>
      <div className="absolute top-[-40%] right-[-10%] w-48 h-48 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl pointer-events-none" />
      <div className="relative z-10 p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{dayLabel}</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold leading-none" data-testid={`text-day-calories-${dayKey}`}>{calories}<span className="text-xs font-normal text-zinc-400 ml-0.5">/{targetCalories}</span></p>
            <p className="text-zinc-500 text-[10px] mt-0.5">kcal</p>
          </div>
        </div>
        <div className="w-full h-1 bg-white/10 rounded-full mb-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${calPct >= 100 ? 'bg-amber-500' : 'bg-white/70'}`}
            style={{ width: `${calPct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-white/10 rounded-lg px-2 py-1.5" data-testid={`tile-custom-protein-${dayKey}`}>
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
              <span className="text-[10px] text-zinc-400">Protein</span>
            </div>
            <p className="text-sm font-bold leading-none">{protein}<span className="text-[10px] font-normal text-zinc-400 ml-0.5">g</span></p>
          </div>
          <div className="bg-white/10 rounded-lg px-2 py-1.5" data-testid={`tile-custom-carbs-${dayKey}`}>
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
              <span className="text-[10px] text-zinc-400">Carbs</span>
            </div>
            <p className="text-sm font-bold leading-none">{carbs}<span className="text-[10px] font-normal text-zinc-400 ml-0.5">g</span></p>
          </div>
          <div className="bg-white/10 rounded-lg px-2 py-1.5" data-testid={`tile-custom-fat-${dayKey}`}>
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-3))" }} />
              <span className="text-[10px] text-zinc-400">Fat</span>
            </div>
            <p className="text-sm font-bold leading-none">{fat}<span className="text-[10px] font-normal text-zinc-400 ml-0.5">g</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
