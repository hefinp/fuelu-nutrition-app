import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Scale, Plus, Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { WeightEntry } from "@shared/schema";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-zinc-500 mb-0.5">{label}</p>
      <p className="font-semibold text-zinc-900">{payload[0].value} kg</p>
    </div>
  );
}

export function WeightTracker({ targetWeight }: { targetWeight?: number }) {
  const [weightInput, setWeightInput] = useState("");
  const [dateInput, setDateInput] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showForm, setShowForm] = useState(false);

  const { data: entries = [], isLoading } = useQuery<WeightEntry[]>({
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!weightInput) return;
    addEntry.mutate({
      weight: weightInput,
      recordedAt: new Date(dateInput).toISOString(),
    });
  }

  const chartData = entries.map((e) => ({
    id: e.id,
    date: format(new Date(e.recordedAt!), "d MMM"),
    fullDate: format(new Date(e.recordedAt!), "d MMM yyyy"),
    weight: parseFloat(e.weight),
  }));

  const latestWeight = chartData.length > 0 ? chartData[chartData.length - 1].weight : null;
  const firstWeight = chartData.length > 0 ? chartData[0].weight : null;
  const change = latestWeight !== null && firstWeight !== null ? latestWeight - firstWeight : null;
  const allWeights = chartData.map((d) => d.weight);
  const minWeight = allWeights.length ? Math.min(...allWeights) : 0;
  const maxWeight = allWeights.length ? Math.max(...allWeights) : 100;
  const padding = Math.max(1, (maxWeight - minWeight) * 0.15);
  const yMin = Math.floor(minWeight - padding);
  const yMax = Math.ceil(maxWeight + padding);

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-zinc-100 rounded-lg">
            <Scale className="w-4 h-4 text-zinc-600" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900">Weight Tracker</h3>
            <p className="text-xs text-zinc-500">Log your weight to track progress over time</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          data-testid="button-log-weight-toggle"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            showForm ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          Log Weight
        </button>
      </div>

      {/* Log weight form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
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

      {/* Chart */}
      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-500 rounded-full animate-spin" />
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
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              {targetWeight && (
                <ReferenceLine
                  y={targetWeight}
                  stroke="#22c55e"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: "Goal", position: "right", fontSize: 10, fill: "#22c55e" }}
                />
              )}
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#18181b"
                strokeWidth={2}
                dot={{ fill: "#18181b", r: 3, strokeWidth: 0 }}
                activeDot={{ fill: "#18181b", r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entry list — last 5 */}
      {entries.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Recent entries</p>
          {[...entries].reverse().slice(0, 5).map((entry) => (
            <div
              key={entry.id}
              data-testid={`weight-entry-${entry.id}`}
              className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-zinc-50 group transition-colors"
            >
              <span className="text-sm text-zinc-500">
                {format(new Date(entry.recordedAt!), "d MMM yyyy")}
              </span>
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
      )}
    </div>
  );
}
