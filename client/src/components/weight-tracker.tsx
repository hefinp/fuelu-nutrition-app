import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useActiveFlow } from "@/contexts/active-flow-context";
import { format, subDays } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { Scale, Plus, Trash2, TrendingDown, TrendingUp, Minus, Flame, Sparkles, Loader2, ChevronDown, ChevronUp, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { WeightEntry, FoodLogEntry } from "@shared/schema";

// ── Tooltips ─────────────────────────────────────────────────────────────────

function WeightTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-zinc-500 mb-0.5">{label}</p>
      <p className="font-semibold text-zinc-900">{payload[0].value} kg</p>
    </div>
  );
}

function CaloriesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const consumed = payload[0]?.value ?? 0;
  const target = payload[0]?.payload?.target ?? 0;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-0.5">
      <p className="text-zinc-500 mb-1 font-medium">{label}</p>
      <p className="text-zinc-900"><span className="text-zinc-400">Consumed: </span><span className="font-semibold">{consumed} kcal</span></p>
      {target > 0 && <p className="text-zinc-900"><span className="text-zinc-400">Target: </span><span className="font-semibold">{target} kcal</span></p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WeightTracker({
  targetWeight,
  dailyCaloriesTarget,
  isAdvanced = false,
}: {
  targetWeight?: number;
  dailyCaloriesTarget?: number;
  isAdvanced?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"weight" | "calories">("weight");
  const [weightInput, setWeightInput] = useState("");
  const [dateInput, setDateInput] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showForm, setShowForm] = useState(false);
  const [showEntries, setShowEntries] = useState(false);
  const [weightInsight, setWeightInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const { setFlowActive } = useActiveFlow();

  useEffect(() => {
    setFlowActive("weight-log", showForm);
    return () => setFlowActive("weight-log", false);
  }, [showForm, setFlowActive]);

  const today = format(new Date(), "yyyy-MM-dd");
  const weekFrom = format(subDays(new Date(), 6), "yyyy-MM-dd");

  // ── Weight data ─────────────────────────────────────────────────────────────
  const { data: entries = [], isLoading: weightLoading } = useQuery<WeightEntry[]>({
    queryKey: ["/api/weight-entries"],
  });

  const addEntry = useMutation({
    mutationFn: (data: { weight: string; recordedAt: string }) =>
      apiRequest("POST", "/api/weight-entries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weight-entries"] });
      setWeightInput("");
      setDateInput(format(new Date(), "yyyy-MM-dd"));
      setShowForm(false);
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/weight-entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weight-entries"] });
    },
  });

  function handleWeightSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!weightInput) return;
    addEntry.mutate({ weight: weightInput, recordedAt: new Date(dateInput).toISOString() });
  }

  async function handleGetInsight() {
    if (entries.length < 3 || insightLoading) return;
    setInsightLoading(true);
    setWeightInsight(null);
    try {
      const payload = {
        entries: chartData.map(d => ({ date: d.date, weightKg: d.weight })),
        targetWeight,
      };
      const resp = await fetch("/api/weight/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await resp.json();
      setWeightInsight(data.insight ?? null);
    } catch {
      setWeightInsight("Unable to generate insight. Please try again later.");
    } finally {
      setInsightLoading(false);
    }
  }

  const chartData = entries.map((e) => ({
    id: e.id,
    date: format(new Date(e.recordedAt!), "d MMM"),
    weight: parseFloat(e.weight),
  }));
  const latestWeight = chartData.length > 0 ? chartData[chartData.length - 1].weight : null;
  const firstWeight = chartData.length > 0 ? chartData[0].weight : null;
  const change = latestWeight !== null && firstWeight !== null ? latestWeight - firstWeight : null;
  const allWeights = chartData.map((d) => d.weight);
  const minW = allWeights.length ? Math.min(...allWeights) : 0;
  const maxW = allWeights.length ? Math.max(...allWeights) : 100;
  const pad = Math.max(1, (maxW - minW) * 0.15);

  // ── Calories data ───────────────────────────────────────────────────────────
  const { data: logEntries = [], isLoading: calLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log-week", weekFrom, today, "cal-tracker"],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?from=${weekFrom}&to=${today}`, { credentials: "include" });
      return res.json();
    },
    enabled: activeTab === "calories",
    staleTime: 60_000,
  });

  const calMap = logEntries.reduce<Record<string, number>>((acc, e) => {
    acc[e.date] = (acc[e.date] || 0) + e.calories;
    return acc;
  }, {});

  const calChartData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    return {
      date: format(d, "EEE"),
      dateStr,
      consumed: Math.round(calMap[dateStr] || 0),
      target: dailyCaloriesTarget || 0,
      isToday: dateStr === today,
    };
  });

  const todayConsumed = calMap[today] ? Math.round(calMap[today]) : 0;
  const weekTotal = calChartData.reduce((s, d) => s + d.consumed, 0);
  const daysLogged = calChartData.filter(d => d.consumed > 0).length;
  const weekAvg = daysLogged > 0 ? Math.round(weekTotal / daysLogged) : 0;

  // ── Adaptive TDEE trend ─────────────────────────────────────────────────────
  const { data: tdeeTrend = [] } = useQuery<Array<{ date: string; adaptiveTdee: number; formulaTdee: number; confidence: string }>>({
    queryKey: ["/api/adaptive-tdee/trend"],
    enabled: isAdvanced && activeTab === "weight",
    staleTime: 300_000,
  });

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
          {activeTab === "weight"
            ? <Scale className="w-5 h-5" />
            : <Flame className="w-5 h-5" />}
        </div>
        <div>
          <h3 className="font-display font-bold text-zinc-900">Progress Tracker</h3>
          <p className="text-xs text-zinc-500">
            {activeTab === "weight" ? "Log your weight over time" : "Calories consumed vs planned"}
          </p>
        </div>
      </div>
      {activeTab === "weight" && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowForm(v => !v)}
            data-testid="button-log-weight-toggle"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Weight
          </button>
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex bg-zinc-100 rounded-xl p-1 mb-5">
        <button
          onClick={() => { setActiveTab("weight"); setShowForm(false); }}
          data-testid="button-tracker-tab-weight"
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === "weight" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          Weight
        </button>
        <button
          onClick={() => { setActiveTab("calories"); setShowForm(false); }}
          data-testid="button-tracker-tab-calories"
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === "calories" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          Calories
        </button>
      </div>

      {/* ── WEIGHT TAB ──────────────────────────────────────────────────────── */}
      {activeTab === "weight" && (
        <>
          {/* Log weight form */}
          <AnimatePresence>
            {showForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleWeightSubmit}
                className="overflow-hidden"
              >
                <div className="flex gap-3 mb-5 pt-1">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="20"
                      max="300"
                      required
                      value={weightInput}
                      onChange={e => setWeightInput(e.target.value)}
                      placeholder="e.g. 75.5"
                      data-testid="input-log-weight"
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={dateInput}
                      onChange={e => setDateInput(e.target.value)}
                      data-testid="input-log-date"
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={addEntry.isPending || !weightInput}
                      data-testid="button-save-weight"
                      className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Stats row */}
          {entries.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-zinc-50 rounded-2xl p-3 text-center">
                <p className="text-xs text-zinc-500 mb-0.5">Current</p>
                <p className="text-lg font-bold text-zinc-900" data-testid="stat-current-weight">{latestWeight} kg</p>
              </div>
              <div className="bg-zinc-50 rounded-2xl p-3 text-center">
                <p className="text-xs text-zinc-500 mb-0.5">Change</p>
                <div className="flex items-center justify-center gap-1">
                  {change === null ? (
                    <p className="text-lg font-bold text-zinc-400">—</p>
                  ) : change < 0 ? (
                    <>
                      <TrendingDown className="w-4 h-4 text-emerald-500" />
                      <p className="text-lg font-bold text-emerald-600">{change.toFixed(1)} kg</p>
                    </>
                  ) : change > 0 ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                      <p className="text-lg font-bold text-amber-600">+{change.toFixed(1)} kg</p>
                    </>
                  ) : (
                    <>
                      <Minus className="w-4 h-4 text-zinc-400" />
                      <p className="text-lg font-bold text-zinc-500">0 kg</p>
                    </>
                  )}
                </div>
              </div>
              <div className="bg-zinc-50 rounded-2xl p-3 text-center">
                <p className="text-xs text-zinc-500 mb-0.5">Entries</p>
                <p className="text-lg font-bold text-zinc-900">{entries.length}</p>
              </div>
            </div>
          )}

          {/* Weight chart */}
          {weightLoading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            </div>
          ) : chartData.length < 2 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
              <Scale className="w-7 h-7 text-zinc-300 mb-2" />
              <p className="text-sm font-medium text-zinc-500">
                {chartData.length === 0 ? "No weight entries yet" : "Add one more entry to see your graph"}
              </p>
              <p className="text-xs text-zinc-400 mt-1">Log your weight to start tracking progress</p>
            </div>
          ) : (
            <div className="h-52" data-testid="weight-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[Math.floor(minW - pad), Math.ceil(maxW + pad)]} tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<WeightTooltip />} />
                  {targetWeight && (
                    <ReferenceLine y={targetWeight} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5}
                      label={{ value: "Goal", position: "right", fontSize: 10, fill: "#22c55e" }} />
                  )}
                  <Line type="monotone" dataKey="weight" stroke="#18181b" strokeWidth={2}
                    dot={{ fill: "#18181b", r: 3, strokeWidth: 0 }}
                    activeDot={{ fill: "#18181b", r: 5, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* AI insight */}
          {entries.length >= 3 && (
            <div className="mt-4">
              <button
                onClick={handleGetInsight}
                disabled={insightLoading}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
                data-testid="button-weight-insight"
              >
                {insightLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                )}
                {insightLoading ? "Analysing…" : "Get AI insight"}
              </button>
              <AnimatePresence>
                {weightInsight && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-2 bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3"
                  >
                    <p className="text-xs text-violet-900 leading-relaxed" data-testid="text-weight-insight">{weightInsight}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Entry list — collapsible */}
          {entries.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowEntries(v => !v)}
                className="flex items-center gap-1.5 w-full text-xs font-medium text-zinc-400 uppercase tracking-wide hover:text-zinc-600 transition-colors"
                data-testid="toggle-recent-entries"
              >
                Recent entries
                {showEntries ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <AnimatePresence initial={false}>
                {showEntries && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 pt-2">
                      {[...entries].reverse().slice(0, 5).map((entry) => (
                        <div
                          key={entry.id}
                          data-testid={`weight-entry-${entry.id}`}
                          className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-zinc-50 group transition-colors"
                        >
                          <span className="text-sm text-zinc-500">{format(new Date(entry.recordedAt!), "d MMM yyyy")}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-zinc-900">{parseFloat(entry.weight)} kg</span>
                            <button
                              onClick={() => deleteEntry.mutate(entry.id)}
                              data-testid={`button-delete-entry-${entry.id}`}
                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-300 hover:text-red-500 transition-all rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        {/* ── TDEE Trend ─────────────────────────────────────────────────────── */}
        {isAdvanced && tdeeTrend.length > 0 && (
          <div className="mt-6 pt-5 border-t border-zinc-100" data-testid="section-tdee-trend-weight">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-indigo-500" />
              <p className="text-sm font-semibold text-zinc-900">Adaptive TDEE History</p>
            </div>
            <p className="text-xs text-zinc-400 mb-3">Your accepted adaptive calorie targets vs formula estimates</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tdeeTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e4e4e7", fontSize: "12px" }}
                    formatter={(val: number, name: string) => [
                      `${val} kcal`,
                      name === "adaptiveTdee" ? "Adaptive" : "Formula",
                    ]}
                  />
                  <Line type="monotone" dataKey="adaptiveTdee" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="adaptiveTdee" />
                  <Line type="monotone" dataKey="formulaTdee" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="formulaTdee" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        </>
      )}

      {/* ── CALORIES TAB ────────────────────────────────────────────────────── */}
      {activeTab === "calories" && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-zinc-50 rounded-2xl p-3 text-center">
              <p className="text-xs text-zinc-500 mb-0.5">Today</p>
              <p className="text-lg font-bold text-zinc-900" data-testid="stat-today-calories">{todayConsumed}</p>
              {dailyCaloriesTarget ? (
                <p className="text-[10px] text-zinc-400">/ {dailyCaloriesTarget} kcal</p>
              ) : (
                <p className="text-[10px] text-zinc-400">kcal</p>
              )}
            </div>
            <div className="bg-zinc-50 rounded-2xl p-3 text-center">
              <p className="text-xs text-zinc-500 mb-0.5">7-day avg</p>
              <p className="text-lg font-bold text-zinc-900">{weekAvg > 0 ? weekAvg : "—"}</p>
              <p className="text-[10px] text-zinc-400">kcal/day</p>
            </div>
            <div className="bg-zinc-50 rounded-2xl p-3 text-center">
              <p className="text-xs text-zinc-500 mb-0.5">Days logged</p>
              <p className="text-lg font-bold text-zinc-900">{daysLogged}<span className="text-sm font-normal text-zinc-400">/7</span></p>
            </div>
          </div>

          {/* Calories bar chart */}
          {calLoading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            </div>
          ) : daysLogged === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
              <Flame className="w-7 h-7 text-zinc-300 mb-2" />
              <p className="text-sm font-medium text-zinc-500">No meals logged this week</p>
              <p className="text-xs text-zinc-400 mt-1">Start logging meals to see your calorie chart</p>
            </div>
          ) : (
            <div className="h-52" data-testid="calories-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calChartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CaloriesTooltip />} />
                  {dailyCaloriesTarget && dailyCaloriesTarget > 0 && (
                    <ReferenceLine y={dailyCaloriesTarget} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5}
                      label={{ value: "Target", position: "right", fontSize: 10, fill: "#22c55e" }} />
                  )}
                  <Bar dataKey="consumed" radius={[4, 4, 0, 0]}>
                    {calChartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.isToday ? "#18181b" : "#d4d4d8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Daily breakdown list */}
          {daysLogged > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">This week</p>
              {[...calChartData].reverse().map((d) => {
                const pct = dailyCaloriesTarget && dailyCaloriesTarget > 0
                  ? Math.min(100, Math.round((d.consumed / dailyCaloriesTarget) * 100))
                  : null;
                const over = dailyCaloriesTarget && d.consumed > dailyCaloriesTarget;
                return (
                  <div key={d.dateStr} className={`flex items-center justify-between py-1.5 px-3 rounded-xl transition-colors ${d.isToday ? "bg-zinc-50" : "hover:bg-zinc-50"}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-sm w-8 shrink-0 ${d.isToday ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>{d.date}</span>
                      {d.consumed > 0 && dailyCaloriesTarget && pct !== null && (
                        <div className="w-16 bg-zinc-100 rounded-full h-1.5 hidden sm:block">
                          <div className={`h-full rounded-full ${over ? "bg-amber-400" : "bg-zinc-700"}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {d.consumed > 0 ? (
                        <>
                          <span className={`text-sm font-semibold ${d.isToday ? "text-zinc-900" : "text-zinc-700"}`}>{d.consumed}</span>
                          {dailyCaloriesTarget ? (
                            <span className={`text-xs ${over ? "text-amber-500" : "text-zinc-400"}`}>
                              {over ? `+${d.consumed - dailyCaloriesTarget}` : `/ ${dailyCaloriesTarget}`} kcal
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">kcal</span>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-zinc-300 italic">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
