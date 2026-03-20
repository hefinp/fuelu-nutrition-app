import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, ArrowLeft, Sparkles, BookOpen, Zap, Brain, Apple, ExternalLink,
  Loader2, AlertCircle, RefreshCw, BarChart2, Lock, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import type { UserPreferences } from "@shared/schema";

type VitalityInsightsData = {
  trendData: { date: string; energy: number | null; focus: number | null; motivation: number | null }[];
  foodCorrelations: { food: string; count: number; avgEnergy: number; avgFocus: number | null; highEnergyRate: number; highFocusRate: number }[];
  weekSummary: { loggedDays: number; topEnergy: string | null; topFocus: string | null; topMotivation: string | null; topStress: string | null; topSleep: string | null };
  hasEnoughData: boolean;
  daysLogged: number;
  totalFoodLogs: number;
};

type AiInsightsData = {
  narrative: string | null;
  sources: { title: string; url: string }[];
  insufficientData: boolean;
  cached: boolean;
};

type ResearchPulseData = {
  items: { summary: string; source: { title: string; url: string } | null }[];
  cached: boolean;
};

const ENERGY_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };
const FOCUS_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };
const STRESS_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };
const SLEEP_LABELS: Record<string, string> = { poor: "Poor", fair: "Fair", good: "Good" };

function ScoreDot({ level }: { level: string | null }) {
  const colors: Record<string, string> = { low: "bg-red-400", medium: "bg-amber-400", high: "bg-emerald-400", poor: "bg-red-400", fair: "bg-amber-400", good: "bg-emerald-400" };
  return <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${colors[level ?? ""] ?? "bg-zinc-300"}`} />;
}

export default function VitalityInsightsPage({ onClose }: { onClose?: () => void } = {}) {
  const { user } = useAuth();
  const isPremium = !!(user?.betaUser || (user?.tier && user.tier !== "free"));
  const [aiRefreshCount, setAiRefreshCount] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [daysWindow, setDaysWindow] = useState(90);

  const { data: prefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });
  const isOptedIn = !!(prefs?.vitalityInsightsEnabled);
  const isEligible = isPremium && isOptedIn;

  const { data: insights, isLoading: insightsLoading } = useQuery<VitalityInsightsData>({
    queryKey: ["/api/vitality/insights", daysWindow],
    queryFn: async () => { const r = await fetch(`/api/vitality/insights?days=${daysWindow}`); if (!r.ok) throw new Error(`${r.status}`); return r.json(); },
    enabled: !!user && isEligible,
  });

  const { data: aiData, isLoading: aiLoading, refetch: refetchAi, isError: aiError } = useQuery<AiInsightsData>({
    queryKey: ["/api/vitality/ai-insights"],
    queryFn: async () => { const r = await fetch("/api/vitality/ai-insights"); if (!r.ok) throw new Error(`${r.status}`); return r.json() as Promise<AiInsightsData>; },
    enabled: !!user && aiEnabled && isEligible,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const { data: pulseData, isLoading: pulseLoading } = useQuery<ResearchPulseData>({
    queryKey: ["/api/vitality/research-pulse"],
    queryFn: async () => { const r = await fetch("/api/vitality/research-pulse"); if (!r.ok) throw new Error(`${r.status}`); return r.json() as Promise<ResearchPulseData>; },
    enabled: !!user && aiEnabled && isEligible,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-500">Please <Link href="/auth" className="underline">sign in</Link> to view insights.</p>
      </div>
    );
  }

  if (!isEligible) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link href="/dashboard">
              <button className="p-2 rounded-lg hover:bg-zinc-100 transition-colors" data-testid="btn-back-to-dashboard">
                <ArrowLeft className="w-4 h-4 text-zinc-600" />
              </button>
            </Link>
            <div className="flex items-center gap-2 flex-1">
              <span className="p-1.5 rounded-lg bg-amber-100">
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </span>
              <h1 className="text-base font-semibold text-zinc-900">Vitality Insights</h1>
            </div>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-800 mb-1" data-testid="vitality-insights-premium-gate">Advanced Analytics</h2>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-4">
            Detailed trend analysis, food correlations, and AI-powered narrative insights on male hormonal nutrition — available on Simple and above.
          </p>
          <Link href="/pricing">
            <button className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors" data-testid="button-vitality-upgrade">
              <Shield className="w-4 h-4" />
              See plans
            </button>
          </Link>
        </main>
      </div>
    );
  }

  const handleLoadAi = () => setAiEnabled(true);
  const handleRefreshAi = () => {
    if (aiRefreshCount >= 3) return;
    setAiRefreshCount(c => c + 1);
    refetchAi();
  };

  const chartData = (insights?.trendData ?? []).map(d => ({
    ...d,
    label: d.date.slice(5),
  }));
  const hasChartData = chartData.length >= 3;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {onClose ? (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 transition-colors" data-testid="btn-back-to-dashboard">
              <ArrowLeft className="w-4 h-4 text-zinc-600" />
            </button>
          ) : (
            <Link href="/dashboard">
              <button className="p-2 rounded-lg hover:bg-zinc-100 transition-colors" data-testid="btn-back-to-dashboard">
                <ArrowLeft className="w-4 h-4 text-zinc-600" />
              </button>
            </Link>
          )}
          <div className="flex items-center gap-2 flex-1">
            <span className="p-1.5 rounded-lg bg-amber-100">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </span>
            <h1 className="text-base font-semibold text-zinc-900">Vitality Insights</h1>
          </div>
          <div className="flex gap-1">
            {[30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => setDaysWindow(d)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  daysWindow === d ? "bg-amber-100 text-amber-700" : "text-zinc-400 hover:text-zinc-600"
                }`}
                data-testid={`btn-days-${d}`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-24">
        {insightsLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
            <p className="text-sm text-zinc-500">Analysing your data…</p>
          </div>
        )}

        {!insightsLoading && insights && (
          <>
            {!insights.hasEnoughData && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                  <BarChart2 className="w-5 h-5 text-zinc-400" />
                </div>
                <h3 className="font-semibold text-zinc-800 mb-1">Not enough data yet</h3>
                <p className="text-sm text-zinc-500 mb-1">
                  Log at least 7 days of vitality check-ins and food to unlock personalised insights.
                </p>
                <p className="text-xs text-zinc-400">
                  You've logged {insights.daysLogged} check-in {insights.daysLogged === 1 ? "day" : "days"} and {insights.totalFoodLogs} food {insights.totalFoodLogs === 1 ? "entry" : "entries"}.
                </p>
                <Link href="/dashboard">
                  <Button size="sm" variant="outline" className="mt-4 text-xs" data-testid="btn-go-log-vitality">
                    Start logging
                  </Button>
                </Link>
              </div>
            )}

            {insights.hasEnoughData && (
              <>
                <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-zinc-800 mb-4 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" /> This week
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-zinc-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">Days logged</p>
                      <p className="text-xl font-bold text-zinc-800" data-testid="stat-vitality-days-logged">{insights.weekSummary.loggedDays}</p>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">Energy</p>
                      <div className="flex items-center justify-center">
                        <ScoreDot level={insights.weekSummary.topEnergy} />
                        <p className="text-sm font-semibold text-zinc-800" data-testid="stat-vitality-energy">
                          {insights.weekSummary.topEnergy ? ENERGY_LABELS[insights.weekSummary.topEnergy] : "–"}
                        </p>
                      </div>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">Focus</p>
                      <div className="flex items-center justify-center">
                        <ScoreDot level={insights.weekSummary.topFocus} />
                        <p className="text-sm font-semibold text-zinc-800" data-testid="stat-vitality-focus">
                          {insights.weekSummary.topFocus ? FOCUS_LABELS[insights.weekSummary.topFocus] : "–"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-zinc-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">Stress</p>
                      <div className="flex items-center justify-center">
                        <ScoreDot level={insights.weekSummary.topStress === "low" ? "good" : insights.weekSummary.topStress === "high" ? "low" : insights.weekSummary.topStress} />
                        <p className="text-sm font-semibold text-zinc-800" data-testid="stat-vitality-stress">
                          {insights.weekSummary.topStress ? STRESS_LABELS[insights.weekSummary.topStress] : "–"}
                        </p>
                      </div>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">Sleep</p>
                      <div className="flex items-center justify-center">
                        <ScoreDot level={insights.weekSummary.topSleep} />
                        <p className="text-sm font-semibold text-zinc-800" data-testid="stat-vitality-sleep">
                          {insights.weekSummary.topSleep ? SLEEP_LABELS[insights.weekSummary.topSleep] : "–"}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {hasChartData && (
                  <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-zinc-800 mb-1 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-amber-500" /> Trends ({daysWindow} days)
                    </h2>
                    <p className="text-xs text-zinc-400 mb-4">1 = low, 2 = medium, 3 = high — daily scores over time</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
                          <YAxis domain={[1, 3]} ticks={[1, 2, 3]} tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e4e4e7", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                            labelFormatter={(label: string) => label}
                            formatter={(value: number, name: string) => [value, name === "energy" ? "Energy" : name === "focus" ? "Focus" : "Motivation"]}
                          />
                          <Legend formatter={(v: string) => v === "energy" ? "Energy" : v === "focus" ? "Focus" : "Motivation"} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="energy" stroke="#f59e0b" strokeWidth={2} dot={false} name="energy" connectNulls />
                          <Line type="monotone" dataKey="focus" stroke="#3b82f6" strokeWidth={2} dot={false} name="focus" connectNulls />
                          <Line type="monotone" dataKey="motivation" stroke="#10b981" strokeWidth={2} dot={false} name="motivation" connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                )}

                {insights.foodCorrelations.length > 0 && (
                  <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-zinc-800 mb-1 flex items-center gap-1.5">
                      <Apple className="w-4 h-4 text-emerald-500" /> Foods linked to higher energy
                    </h2>
                    <p className="text-xs text-zinc-400 mb-4">Based on days you logged both food and vitality check-ins</p>
                    <ul className="space-y-2.5">
                      {insights.foodCorrelations.map((f, i) => (
                        <li key={f.food} className="flex items-center gap-3" data-testid={`vitality-food-correlation-${i}`}>
                          <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-emerald-600">{i + 1}</span>
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-800 capitalize truncate">{f.food}</p>
                            <p className="text-xs text-zinc-400">logged {f.count}× · high energy {f.highEnergyRate}% of days</p>
                          </div>
                          <div className="w-16 bg-zinc-100 rounded-full h-1.5 flex-shrink-0">
                            <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: `${f.highEnergyRate}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            {!aiEnabled ? (
              <section className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="font-semibold text-zinc-800 mb-1 text-sm">AI-powered analysis</h3>
                <p className="text-xs text-zinc-500 mb-4 max-w-xs mx-auto">
                  Get a personalised vitality narrative and the latest research from PubMed & NIH on male hormonal nutrition, grounded in your actual data.
                </p>
                <Button
                  size="sm"
                  onClick={handleLoadAi}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                  data-testid="btn-load-vitality-ai-insights"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Load AI insights
                </Button>
                <p className="text-[10px] text-zinc-400 mt-2">Sources: PubMed · NIH · Sports Science · Endocrinology</p>
              </section>
            ) : (
              <>
                <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-1.5">
                      <Brain className="w-4 h-4 text-amber-500" /> Your patterns
                    </h2>
                    <button
                      onClick={handleRefreshAi}
                      disabled={aiRefreshCount >= 3 || aiLoading}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-40"
                      title={aiRefreshCount >= 3 ? "Max refreshes reached today" : "Refresh analysis"}
                      data-testid="btn-refresh-vitality-ai"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${aiLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {aiLoading && (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400 flex-shrink-0" />
                      <p className="text-xs text-zinc-400">Searching PubMed and analysing your data…</p>
                    </div>
                  )}

                  {aiError && !aiLoading && (
                    <div className="flex items-start gap-2 py-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-zinc-500">Unable to load AI analysis. Please try again later.</p>
                    </div>
                  )}

                  {aiData && !aiLoading && (
                    <>
                      {aiData.insufficientData ? (
                        <p className="text-xs text-zinc-400 py-2">Log at least 5 days of vitality check-ins to unlock your personalised AI analysis.</p>
                      ) : (
                        <>
                          <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line" data-testid="vitality-ai-narrative">
                            {aiData.narrative}
                          </p>
                          {aiData.sources.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-100 space-y-1.5">
                              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">Sources</p>
                              {aiData.sources.map((s, i) => (
                                <a
                                  key={i}
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-start gap-1.5 group"
                                  data-testid={`vitality-ai-source-${i}`}
                                >
                                  <ExternalLink className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5 group-hover:text-amber-600 transition-colors" />
                                  <span className="text-xs text-amber-500 group-hover:text-amber-700 transition-colors line-clamp-1">{s.title}</span>
                                </a>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-zinc-300 mt-2">
                            {aiData.cached ? "Cached · refreshes tomorrow" : "AI-generated · sourced from PubMed / NIH"}
                          </p>
                        </>
                      )}
                    </>
                  )}
                </section>

                <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-zinc-800 mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-500" /> Research Pulse
                  </h2>
                  <p className="text-xs text-zinc-400 mb-4">
                    Recent findings on male hormonal nutrition from sports science and endocrinology journals
                  </p>

                  {pulseLoading && (
                    <div className="flex items-center gap-2 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />
                      <p className="text-xs text-zinc-400">Fetching recent research…</p>
                    </div>
                  )}

                  {pulseData && !pulseLoading && pulseData.items.length > 0 && (
                    <ul className="space-y-4">
                      {pulseData.items.map((item, i) => (
                        <li key={i} className="flex gap-3" data-testid={`vitality-research-item-${i}`}>
                          <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[9px] font-bold text-blue-600">{i + 1}</span>
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-zinc-700 leading-snug">{item.summary}</p>
                            {item.source && (
                              <a
                                href={item.source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1 group"
                                data-testid={`vitality-research-source-${i}`}
                              >
                                <ExternalLink className="w-2.5 h-2.5 text-blue-400 group-hover:text-blue-600 transition-colors" />
                                <span className="text-[11px] text-blue-400 group-hover:text-blue-600 transition-colors truncate max-w-[220px]">{item.source.title}</span>
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="text-[10px] text-zinc-300 mt-4">
                    {pulseData?.cached ? "Cached · refreshes weekly" : "AI-generated · sourced from PubMed / NIH · refreshes weekly"}
                  </p>
                </section>
              </>
            )}

            <div className="flex items-start gap-2 p-3 bg-zinc-50 border border-zinc-100 rounded-xl mt-4" data-testid="banner-health-disclaimer">
              <AlertCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                This is not medical advice. Consult a healthcare professional before making dietary changes.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
