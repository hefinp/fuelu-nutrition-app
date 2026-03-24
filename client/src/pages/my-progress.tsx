import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, ArrowLeft, LineChart as LineChartIcon, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ClientMetric {
  id: number;
  clientId: number;
  nutritionistId: number;
  metricType: string;
  customLabel: string | null;
  value: string;
  unit: string | null;
  notes: string | null;
  recordedAt: string;
  createdAt: string;
}

const METRIC_TYPE_LABELS: Record<string, { label: string; defaultUnit: string }> = {
  weight: { label: "Weight", defaultUnit: "kg" },
  body_fat: { label: "Body Fat %", defaultUnit: "%" },
  waist_circumference: { label: "Waist Circumference", defaultUnit: "cm" },
  blood_pressure_systolic: { label: "Blood Pressure (Systolic)", defaultUnit: "mmHg" },
  blood_pressure_diastolic: { label: "Blood Pressure (Diastolic)", defaultUnit: "mmHg" },
  blood_glucose: { label: "Blood Glucose", defaultUnit: "mg/dL" },
  custom: { label: "Custom", defaultUnit: "" },
};

function getMetricLabel(metric: ClientMetric): string {
  if (metric.metricType === "custom") return metric.customLabel || "Custom";
  return METRIC_TYPE_LABELS[metric.metricType]?.label ?? metric.metricType;
}

export default function MyProgressPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const { data: metrics = [], isLoading, error } = useQuery<ClientMetric[]>({
    queryKey: ["/api/my-nutritionist/metrics"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/my-nutritionist/metrics");
      if (!res.ok) {
        if (res.status === 403) throw new Error("not_linked");
        throw new Error("Failed to fetch metrics");
      }
      return res.json();
    },
    enabled: !!user,
    retry: (count, err) => (err as Error)?.message !== "not_linked" && count < 3,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-zinc-600 mb-4">You must be signed in.</p>
          <Link href="/auth" className="text-zinc-900 font-semibold underline" data-testid="link-sign-in">Sign In</Link>
        </div>
      </div>
    );
  }

  const isNotLinked = (error as Error)?.message === "not_linked";
  if (isNotLinked) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <LineChartIcon className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-zinc-900 mb-2">No nutritionist linked</h2>
          <p className="text-sm text-zinc-500 mb-4">Your progress tracking will appear here once a nutritionist links your account and starts logging metrics.</p>
          <Link href="/dashboard" className="text-sm text-zinc-900 font-semibold underline" data-testid="link-back-dashboard">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const metricTypes = Array.from(new Set(metrics.map(m => m.metricType)));

  const filteredMetrics = selectedFilter === "all"
    ? metrics
    : metrics.filter(m => m.metricType === selectedFilter);

  const chartData = selectedFilter !== "all"
    ? metrics
        .filter(m => m.metricType === selectedFilter)
        .slice()
        .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
        .map(m => ({
          date: new Date(m.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          value: parseFloat(m.value),
        }))
    : [];

  const beforeAfterByType: Record<string, { first: ClientMetric; last: ClientMetric }> = {};
  for (const type of metricTypes) {
    const ofType = metrics.filter(m => m.metricType === type).slice().sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    if (ofType.length >= 2) {
      beforeAfterByType[type] = { first: ofType[0], last: ofType[ofType.length - 1] };
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-50 safe-area-inset-top">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            data-testid="link-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex-1" />
          <span className="text-sm font-semibold text-zinc-900">My Progress</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : metrics.length === 0 ? (
          <div className="text-center py-16">
            <LineChartIcon className="w-10 h-10 text-zinc-300 mx-auto mb-3" data-testid="icon-no-metrics" />
            <p className="text-sm text-zinc-500">No metrics logged yet.</p>
            <p className="text-xs text-zinc-400 mt-1">Your nutritionist will log health metrics here to track your progress over time.</p>
          </div>
        ) : (
          <>
            {Object.keys(beforeAfterByType).length > 0 && (
              <section data-testid="section-before-after">
                <h2 className="text-sm font-semibold text-zinc-900 mb-3">Before vs After</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(beforeAfterByType).map(([type, { first, last }]) => {
                    const label = type === "custom"
                      ? (first.customLabel || "Custom")
                      : (METRIC_TYPE_LABELS[type]?.label ?? type);
                    const unit = first.unit || METRIC_TYPE_LABELS[type]?.defaultUnit || "";
                    const firstVal = parseFloat(first.value);
                    const lastVal = parseFloat(last.value);
                    const diff = lastVal - firstVal;
                    const TrendIcon = diff < 0 ? TrendingDown : diff > 0 ? TrendingUp : Minus;
                    const trendColor = diff < 0 ? "text-emerald-600" : diff > 0 ? "text-rose-600" : "text-zinc-400";
                    return (
                      <div key={type} className="bg-white border border-zinc-100 rounded-xl p-4" data-testid={`card-before-after-${type}`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-medium text-zinc-500">{label}</span>
                          <TrendIcon className={`w-3.5 h-3.5 mt-0.5 ${trendColor}`} />
                        </div>
                        <div className="flex items-end gap-4 mt-2">
                          <div>
                            <div className="text-xs text-zinc-400">Start</div>
                            <div className="text-base font-bold text-zinc-900" data-testid={`value-first-${type}`}>{first.value} {unit}</div>
                            <div className="text-xs text-zinc-400">
                              {new Date(first.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-400">Latest</div>
                            <div className="text-base font-bold text-zinc-900" data-testid={`value-last-${type}`}>{last.value} {unit}</div>
                            <div className="text-xs text-zinc-400">
                              {new Date(last.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          </div>
                        </div>
                        <div className={`text-xs font-medium mt-2 ${trendColor}`}>
                          {diff > 0 ? "+" : ""}{diff.toFixed(1)} {unit}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section data-testid="section-filter">
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <button
                  type="button"
                  onClick={() => setSelectedFilter("all")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selectedFilter === "all" ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                  data-testid="filter-all"
                >
                  All
                </button>
                {metricTypes.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedFilter(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selectedFilter === type ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                    data-testid={`filter-${type}`}
                  >
                    {type === "custom" ? "Custom" : METRIC_TYPE_LABELS[type]?.label ?? type}
                  </button>
                ))}
              </div>

              {selectedFilter !== "all" && chartData.length >= 2 && (
                <div className="bg-white border border-zinc-100 rounded-xl p-4 mb-4" data-testid="section-chart">
                  <h3 className="text-xs font-medium text-zinc-500 mb-3">
                    {selectedFilter !== "all" ? (METRIC_TYPE_LABELS[selectedFilter]?.label ?? selectedFilter) : ""} Trend
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }} />
                      <Line type="monotone" dataKey="value" stroke="#18181b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden" data-testid="table-metrics">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500">Metric</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500">Value</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500">Date</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500 hidden sm:table-cell">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMetrics.map((metric, idx) => (
                      <tr
                        key={metric.id}
                        className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}
                        data-testid={`row-metric-${metric.id}`}
                      >
                        <td className="px-4 py-2.5 text-zinc-900 font-medium">{getMetricLabel(metric)}</td>
                        <td className="px-4 py-2.5 text-zinc-700">{metric.value} {metric.unit || ""}</td>
                        <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">
                          {new Date(metric.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400 text-xs hidden sm:table-cell">{metric.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
