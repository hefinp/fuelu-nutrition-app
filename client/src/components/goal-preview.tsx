import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface GoalPreviewProps {
  currentCalories: number;
  currentProtein: number;
  currentCarbs: number;
  currentFat: number;
  addCalories: number;
  addProtein: number;
  addCarbs: number;
  addFat: number;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
}

function pct(value: number, target: number | undefined): number {
  if (!target || target <= 0) return 0;
  return Math.round((value / target) * 100);
}

function barColor(projected: number, target: number | undefined): string {
  if (!target) return "bg-zinc-300";
  const ratio = projected / target;
  if (ratio > 1.15) return "bg-red-400";
  if (ratio > 1.0) return "bg-amber-400";
  if (ratio >= 0.85) return "bg-emerald-400";
  return "bg-blue-400";
}

function statusIcon(projected: number, target: number | undefined) {
  if (!target) return null;
  const ratio = projected / target;
  if (ratio > 1.15) return <AlertTriangle className="w-3 h-3 text-red-500" />;
  if (ratio > 1.0) return <TrendingUp className="w-3 h-3 text-amber-500" />;
  if (ratio >= 0.85) return <Minus className="w-3 h-3 text-emerald-500" />;
  return <TrendingDown className="w-3 h-3 text-blue-500" />;
}

function statusText(projected: number, target: number | undefined): string {
  if (!target) return "";
  const diff = projected - target;
  if (diff > 0) return `+${diff} over`;
  if (diff < 0) return `${Math.abs(diff)} under`;
  return "on target";
}

export function GoalPreview({
  currentCalories, currentProtein, currentCarbs, currentFat,
  addCalories, addProtein, addCarbs, addFat,
  targetCalories, targetProtein, targetCarbs, targetFat,
}: GoalPreviewProps) {
  const hasTargets = !!(targetCalories || targetProtein || targetCarbs || targetFat);
  if (!hasTargets) return null;
  if (addCalories <= 0 && addProtein <= 0 && addCarbs <= 0 && addFat <= 0) return null;

  const projCal = currentCalories + addCalories;
  const projProt = currentProtein + addProtein;
  const projCarbs = currentCarbs + addCarbs;
  const projFat = currentFat + addFat;

  const rows = [
    { label: "Calories", unit: "kcal", current: currentCalories, add: addCalories, projected: projCal, target: targetCalories },
    { label: "Protein", unit: "g", current: currentProtein, add: addProtein, projected: projProt, target: targetProtein },
    { label: "Carbs", unit: "g", current: currentCarbs, add: addCarbs, projected: projCarbs, target: targetCarbs },
    { label: "Fat", unit: "g", current: currentFat, add: addFat, projected: projFat, target: targetFat },
  ].filter(r => r.target !== undefined && r.target > 0);

  if (rows.length === 0) return null;

  return (
    <div className="bg-zinc-50 rounded-xl p-3 space-y-2.5" data-testid="goal-preview">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Goal preview</p>
      {rows.map(r => (
        <div key={r.label} data-testid={`goal-preview-${r.label.toLowerCase()}`}>
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1">
              {statusIcon(r.projected, r.target)}
              <span className="text-xs font-medium text-zinc-700">{r.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400">{r.current}</span>
              <span className="text-[10px] font-semibold text-emerald-600">+{r.add}</span>
              <span className="text-[10px] text-zinc-400">=</span>
              <span className="text-xs font-bold text-zinc-900">{r.projected}</span>
              <span className="text-[10px] text-zinc-300">/ {r.target}{r.unit}</span>
            </div>
          </div>
          <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-zinc-300 rounded-full absolute left-0 top-0 transition-all"
              style={{ width: `${Math.min(pct(r.current, r.target), 100)}%` }}
            />
            <div
              className={`h-full rounded-full absolute left-0 top-0 transition-all ${barColor(r.projected, r.target)}`}
              style={{ width: `${Math.min(pct(r.projected, r.target), 100)}%` }}
            />
          </div>
          <div className="flex justify-end mt-0.5">
            <span className={`text-[10px] ${r.projected > (r.target ?? 0) * 1.15 ? "text-red-500 font-medium" : r.projected > (r.target ?? 0) ? "text-amber-500" : "text-zinc-400"}`}>
              {pct(r.projected, r.target)}% · {statusText(r.projected, r.target)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
