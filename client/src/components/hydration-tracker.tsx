import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type UserPreferences, type HydrationLog } from "@shared/schema";
import { getCyclePhase } from "@/lib/cycle";
import { Droplets, Trash2, Loader2, X } from "lucide-react";

const GLASS_ML = 250;
const CIRCUMFERENCE = 2 * Math.PI * 38;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDisplayAmount(ml: number, unit: "ml" | "glasses"): string {
  if (unit === "glasses") {
    const g = ml / GLASS_ML;
    return g % 1 === 0 ? `${g}` : g.toFixed(1);
  }
  return ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)}L` : `${ml}ml`;
}

function formatLoggedAt(ts: string | Date): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface HydrationResponse {
  logs: HydrationLog[];
  totalMl: number;
}

interface AlertInfo {
  message: string;
  level: "amber" | "red";
}

function getBehindAlert(hour: number, pct: number): AlertInfo | null {
  if (pct >= 0.75) return null;
  if (hour >= 19 && pct < 0.75) return { message: "Drink up — you're quite a bit behind today's target.", level: "red" };
  if (hour >= 15 && pct < 0.50) return { message: "Over halfway through the day — try to catch up before dinner.", level: "amber" };
  if (hour >= 12 && pct < 0.25) return { message: "You're a bit behind — try to drink more before lunch.", level: "amber" };
  return null;
}

const QUICK_AMOUNTS_ML = [250, 500, 750, 1000];

export function HydrationTracker() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = todayStr();
  const [customAmount, setCustomAmount] = useState("");
  const [alertDismissed, setAlertDismissed] = useState(false);

  const { data: prefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const baseGoalMl = prefs?.hydrationGoalMl ?? 2000;
  const unit: "ml" | "glasses" = prefs?.hydrationUnit ?? "ml";

  const cyclePhaseInfo = (prefs?.cycleTrackingEnabled && prefs?.lastPeriodDate)
    ? getCyclePhase(prefs.lastPeriodDate, prefs.cycleLength ?? 28)
    : null;
  const cycleHydrationBoost = (cyclePhaseInfo?.phase === "menstrual" || cyclePhaseInfo?.phase === "luteal") ? 250 : 0;
  const goalMl = baseGoalMl + cycleHydrationBoost;

  const goalDisplay = unit === "glasses"
    ? `${Math.round(goalMl / GLASS_ML)} glasses`
    : toDisplayAmount(goalMl, "ml");

  const { data, isLoading } = useQuery<HydrationResponse>({
    queryKey: ["/api/hydration", today],
    queryFn: () => apiRequest("GET", `/api/hydration?date=${today}`).then(r => r.json()) as Promise<HydrationResponse>,
  });

  const totalMl = data?.totalMl ?? 0;
  const logs = data?.logs ?? [];
  const pct = Math.min(totalMl / goalMl, 1);
  const dashOffset = CIRCUMFERENCE * (1 - pct);

  const ringColor = pct >= 1 ? "#22c55e" : pct >= 0.5 ? "#60a5fa" : "#fbbf24";

  const hour = new Date().getHours();
  const alert = getBehindAlert(hour, pct);

  // Dismiss resets each new day
  useEffect(() => {
    const key = `hydration-alert-dismissed-${today}`;
    setAlertDismissed(sessionStorage.getItem(key) === "1");
  }, [today, totalMl]);

  const dismissAlert = () => {
    sessionStorage.setItem(`hydration-alert-dismissed-${today}`, "1");
    setAlertDismissed(true);
  };

  const addMutation = useMutation({
    mutationFn: (amountMl: number) =>
      apiRequest("POST", "/api/hydration", { date: today, amountMl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hydration", today] });
      setCustomAmount("");
    },
    onError: () => toast({ title: "Failed to log water", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/hydration/${id}`, undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/hydration", today] }),
    onError: () => toast({ title: "Failed to remove entry", variant: "destructive" }),
  });

  const handleCustomAdd = () => {
    const val = unit === "glasses"
      ? Math.round(parseFloat(customAmount) * GLASS_ML)
      : parseInt(customAmount);
    if (!val || val <= 0) return;
    addMutation.mutate(val);
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-display font-bold text-zinc-900">Hydration</h3>
            <p className="text-xs text-zinc-400">
              Goal: {goalDisplay} per day
              {cycleHydrationBoost > 0 && (
                <span className="ml-1.5 text-rose-500 font-medium">
                  (+250ml for your cycle phase)
                </span>
              )}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-zinc-400">
          {new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>

      {/* Behind-schedule alert */}
      {alert && !alertDismissed && pct < 1 && (
        <div
          className={`flex items-start gap-2 px-3 py-2.5 rounded-xl mb-4 border text-xs ${
            alert.level === "red"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}
          data-testid="hydration-alert"
        >
          <Droplets className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p className="flex-1">{alert.message}</p>
          <button
            onClick={dismissAlert}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            data-testid="button-dismiss-hydration-alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : (
        <>
          {/* Ring + stats */}
          <div className="flex items-center gap-6 mb-5">
            <div className="relative flex-shrink-0" data-testid="hydration-ring">
              <svg width="96" height="96" viewBox="0 0 100 100" className="-rotate-90">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f4f4f5" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-zinc-900" data-testid="hydration-total">
                  {toDisplayAmount(totalMl, unit)}
                </span>
                <span className="text-[10px] text-zinc-400">of {goalDisplay}</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Progress</span>
                <span className="font-semibold text-zinc-900">{Math.round(pct * 100)}%</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct * 100}%`, backgroundColor: ringColor }}
                />
              </div>
              {pct >= 1 ? (
                <p className="text-xs text-green-600 font-medium">Goal reached! 🎉</p>
              ) : (
                <p className="text-xs text-zinc-400">
                  {toDisplayAmount(Math.max(goalMl - totalMl, 0), unit)} remaining
                </p>
              )}
            </div>
          </div>

          {/* Quick-add buttons */}
          <div className="mb-4">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Quick add</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS_ML.map(ml => (
                <button
                  key={ml}
                  onClick={() => addMutation.mutate(ml)}
                  disabled={addMutation.isPending}
                  data-testid={`button-add-${ml}ml`}
                  className="px-3 py-1.5 bg-zinc-50 hover:bg-blue-50 hover:text-blue-600 border border-zinc-200 hover:border-blue-200 text-zinc-700 text-xs font-medium rounded-xl transition-all disabled:opacity-50"
                >
                  +{toDisplayAmount(ml, unit)}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="flex gap-2 mb-5">
            <input
              type="number"
              min="1"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCustomAdd()}
              placeholder={unit === "glasses" ? "Custom (glasses)" : "Custom (ml)"}
              data-testid="input-custom-hydration"
              className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none transition-colors"
            />
            <button
              onClick={handleCustomAdd}
              disabled={!customAmount || addMutation.isPending}
              data-testid="button-add-custom-hydration"
              className="px-4 py-1.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
            </button>
          </div>

          {/* Today's log */}
          {logs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Today's log</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {logs.map(log => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-100"
                    data-testid={`hydration-entry-${log.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Droplets className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs font-medium text-zinc-700">
                        +{toDisplayAmount(log.amountMl, unit)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400">{formatLoggedAt(log.loggedAt!)}</span>
                      <button
                        onClick={() => deleteMutation.mutate(log.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-hydration-${log.id}`}
                        className="p-1 text-zinc-300 hover:text-red-400 transition-colors rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
