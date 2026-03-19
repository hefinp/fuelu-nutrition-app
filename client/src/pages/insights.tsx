import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, ArrowLeft, Sparkles, BookOpen, Zap, Brain, Apple, ExternalLink,
  Loader2, AlertCircle, RefreshCw, BarChart2, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { TrialBanner } from "@/components/trial-banner";
import type { TrialInfo } from "@shared/trial";
import { getCyclePhase } from "@/lib/cycle";
import type { UserPreferences } from "@shared/schema";

type TdeeTrendPoint = {
  date: string | null;
  adaptiveTdee: number;
  formulaTdee: number;
  confidence: string;
  status: string;
};

type InsightsData = {
  symptomByDay: { cycleDay: number; avgEnergy: number | null; avgMood: number | null; count: number }[];
  foodCorrelations: { food: string; count: number; avgEnergy: number; highEnergyRate: number }[];
  weekSummary: { loggedDays: number; topEnergy: string | null; topMood: string | null; topCravings: string | null; avgEnergy: number | null };
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
  phase: string;
  cached: boolean;
};

const PHASE_LABELS: Record<string, string> = {
  menstrual: "Menstrual", follicular: "Follicular", ovulatory: "Ovulatory", luteal: "Luteal",
};

const ENERGY_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };
const MOOD_LABELS: Record<string, string> = { low: "Low", anxious: "Anxious", balanced: "Balanced" };
const CRAVING_LABELS: Record<string, string> = { none: "None", sweet: "Sweet", salty: "Salty", both: "Sweet & Salty" };

function EnergyDot({ level }: { level: string | null }) {
  const colors: Record<string, string> = { low: "bg-red-400", medium: "bg-amber-400", high: "bg-emerald-400" };
  return <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${colors[level ?? ""] ?? "bg-zinc-300"}`} />;
}

export default function InsightsPage({ onClose }: { onClose?: () => void } = {}) {
  const { user } = useAuth();
  const [aiRefreshCount, setAiRefreshCount] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(false);

  const { data: userPrefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    enabled: !!user,
  });

  const pulsePhase = useMemo(() => {
    if (!userPrefs?.cycleTrackingEnabled || !userPrefs?.lastPeriodDate) return null;
    const info = getCyclePhase(userPrefs.lastPeriodDate, userPrefs.cycleLength ?? 28);
    return info?.phase ?? null;
  }, [userPrefs?.cycleTrackingEnabled, userPrefs?.lastPeriodDate, userPrefs?.cycleLength]);

  const { data: insights, isLoading: insightsLoading } = useQuery<InsightsData>({
    queryKey: ["/api/cycle/insights"],
    enabled: !!user,
  });

  const { data: aiData, isLoading: aiLoading, refetch: refetchAi, isError: aiError } = useQuery<AiInsightsData>({
    queryKey: ["/api/cycle/ai-insights"],
    enabled: !!user && aiEnabled,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const { data: pulseData, isLoading: pulseLoading, refetch: refetchPulse } = useQuery<ResearchPulseData>({
    queryKey: ["/api/cycle/research-pulse", pulsePhase],
    enabled: !!user && aiEnabled && !!pulsePhase,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  const { data: tdeeTrend } = useQuery<TdeeTrendPoint[]>({
    queryKey: ["/api/adaptive-tdee/trend"],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-500">Please <Link href="/auth" className="underline">sign in</Link> to view insights.</p>
      </div>
    );
  }

  const handleLoadAi = () => {
    setAiEnabled(true);
  };

  const handleRefreshAi = () => {
    if (aiRefreshCount >= 3) return;
    setAiRefreshCount(c => c + 1);
    refetchAi();
  };

  const chartData = insights?.symptomByDay.filter(d => d.count >= 1) ?? [];
  const hasChartData = chartData.length >= 3;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
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
            <span className="p-1.5 rounded-lg bg-violet-100">
              <TrendingUp className="w-4 h-4 text-violet-600" />
            </span>
            <h1 className="text-base font-semibold text-zinc-900">Wellbeing Insights</h1>
          </div>
          <Badge variant="secondary" className="text-xs font-medium bg-violet-100 text-violet-700 border-0">
            90 days
          </Badge>
        </div>
      </header>

      {user && !user.isManagedClient && (user as any).trialInfo && (
        <TrialBanner trialInfo={(user as any).trialInfo as TrialInfo} />
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-24">
        {/* Loading state */}
        {insightsLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
            <p className="text-sm text-zinc-500">Analysing your data…</p>
          </div>
        )}

        {!insightsLoading && insights && (
          <>
            {/* Not enough data */}
            {!insights.hasEnoughData && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                  <BarChart2 className="w-5 h-5 text-zinc-400" />
                </div>
                <h3 className="font-semibold text-zinc-800 mb-1">Not enough data yet</h3>
                <p className="text-sm text-zinc-500 mb-1">
                  Log at least 7 days of symptoms and food to unlock personalised insights.
                </p>
                <p className="text-xs text-zinc-400">
                  You've logged {insights.daysLogged} symptom {insights.daysLogged === 1 ? "day" : "days"} and {insights.totalFoodLogs} food {insights.totalFoodLogs === 1 ? "entry" : "entries"}.
                </p>
                <Link href="/dashboard">
                  <Button size="sm" variant="outline" className="mt-4 text-xs" data-testid="btn-go-log">
                    Start logging
                  </Button>
                </Link>
              </div>
            )}

            {insights.hasEnoughData && (
              <>
                {/* Week summary */}
                <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-zinc-800 mb-4 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" /> This week
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-zinc-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">Days logged</p>
                      <p className="text-xl font-bold text-zinc-800" data-testid="stat-days-logged">{insights.weekSummary.loggedDays}</p>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">Energy</p>
                      <div className="flex items-center justify-center">
                        <EnergyDot level={insights.weekSummary.topEnergy} />
                        <p className="text-sm font-semibold text-zinc-800" data-testid="stat-energy">
                          {insights.weekSummary.topEnergy ? ENERGY_LABELS[insights.weekSummary.topEnergy] : "–"}
                        </p>
                      </div>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">Mood</p>
                      <p className="text-sm font-semibold text-zinc-800" data-testid="stat-mood">
                        {insights.weekSummary.topMood ? MOOD_LABELS[insights.weekSummary.topMood] : "–"}
                      </p>
                    </div>
                  </div>
                  {insights.weekSummary.topCravings && insights.weekSummary.topCravings !== "none" && (
                    <p className="text-xs text-zinc-500 mt-3 text-center">
                      Most common craving this week: <span className="font-medium text-zinc-700">{CRAVING_LABELS[insights.weekSummary.topCravings] ?? insights.weekSummary.topCravings}</span>
                    </p>
                  )}
                </section>

                {/* Symptom trend chart */}
                {hasChartData && (
                  <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-zinc-800 mb-1 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-violet-500" /> Energy & mood by cycle day
                    </h2>
                    <p className="text-xs text-zinc-400 mb-4">1 = low, 2 = medium/anxious, 3 = high/balanced</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                          <XAxis dataKey="cycleDay" tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} label={{ value: "Cycle day", position: "insideBottom", offset: -2, fontSize: 10, fill: "#a1a1aa" }} />
                          <YAxis domain={[1, 3]} ticks={[1, 2, 3]} tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e4e4e7", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                            formatter={(value: number, name: string) => [value.toFixed(1), name === "avgEnergy" ? "Energy" : "Mood"]}
                            labelFormatter={(l) => `Day ${l}`}
                          />
                          <Legend formatter={(v) => v === "avgEnergy" ? "Energy" : "Mood"} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="avgEnergy" stroke="#10b981" strokeWidth={2} dot={false} name="avgEnergy" connectNulls />
                          <Line type="monotone" dataKey="avgMood" stroke="#8b5cf6" strokeWidth={2} dot={false} name="avgMood" connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                )}

                {/* Food correlations */}
                {insights.foodCorrelations.length > 0 && (
                  <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-zinc-800 mb-1 flex items-center gap-1.5">
                      <Apple className="w-4 h-4 text-emerald-500" /> Foods linked to higher energy
                    </h2>
                    <p className="text-xs text-zinc-400 mb-4">Based on days you logged both food and symptoms</p>
                    <ul className="space-y-2.5">
                      {insights.foodCorrelations.map((f, i) => (
                        <li key={f.food} className="flex items-center gap-3" data-testid={`food-correlation-${i}`}>
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

            {/* TDEE Trend Chart */}
            {tdeeTrend && tdeeTrend.length > 0 && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-5" data-testid="section-tdee-trend">
                <h2 className="text-sm font-semibold text-zinc-800 mb-1 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-blue-500" /> Estimated TDEE over time
                </h2>
                <p className="text-xs text-zinc-400 mb-4">Your real-world energy expenditure vs formula estimate</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tdeeTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "#a1a1aa" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => v ? v.slice(5) : ""}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#a1a1aa" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}`}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e4e4e7", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                        formatter={(value: number, name: string) => [
                          `${value} kcal`,
                          name === "adaptiveTdee" ? "Adaptive TDEE" : "Formula TDEE",
                        ]}
                        labelFormatter={(l) => l || ""}
                      />
                      <Legend
                        formatter={(v) => v === "adaptiveTdee" ? "Adaptive TDEE" : "Formula TDEE"}
                        iconType="circle"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="adaptiveTdee"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#3b82f6" }}
                        name="adaptiveTdee"
                      />
                      <Line
                        type="monotone"
                        dataKey="formulaTdee"
                        stroke="#a1a1aa"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        dot={false}
                        name="formulaTdee"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-zinc-300 mt-3">Based on your accepted adaptive targets</p>
              </section>
            )}

            {/* AI sections — load on demand */}
            {!aiEnabled ? (
              <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50 p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                </div>
                <h3 className="font-semibold text-zinc-800 mb-1 text-sm">AI-powered analysis</h3>
                <p className="text-xs text-zinc-500 mb-4 max-w-xs mx-auto">
                  Get a personalised nutrition narrative and the latest research from PubMed & NIH, grounded in your actual data.
                </p>
                <Button
                  size="sm"
                  onClick={handleLoadAi}
                  className="bg-violet-600 hover:bg-violet-700 text-white text-xs"
                  data-testid="btn-load-ai-insights"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Load AI insights
                </Button>
                <p className="text-[10px] text-zinc-400 mt-2">Sources: PubMed · NIH · WHO · NHS</p>
              </section>
            ) : (
              <>
                {/* AI narrative */}
                <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-1.5">
                      <Brain className="w-4 h-4 text-violet-500" /> Your patterns
                    </h2>
                    <button
                      onClick={handleRefreshAi}
                      disabled={aiRefreshCount >= 3 || aiLoading}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-40"
                      title={aiRefreshCount >= 3 ? "Max refreshes reached today" : "Refresh analysis"}
                      data-testid="btn-refresh-ai"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${aiLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {aiLoading && (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-400 flex-shrink-0" />
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
                        <p className="text-xs text-zinc-400 py-2">Log at least 5 days of symptoms to unlock your personalised AI analysis.</p>
                      ) : (
                        <>
                          <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line" data-testid="ai-narrative">
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
                                  data-testid={`ai-source-${i}`}
                                >
                                  <ExternalLink className="w-3 h-3 text-violet-400 flex-shrink-0 mt-0.5 group-hover:text-violet-600 transition-colors" />
                                  <span className="text-xs text-violet-500 group-hover:text-violet-700 transition-colors line-clamp-1">{s.title}</span>
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

                {/* Research pulse */}
                {pulsePhase && (
                <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-zinc-800 mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-500" /> Current research
                  </h2>
                  <p className="text-xs text-zinc-400 mb-4">
                    {PHASE_LABELS[pulsePhase] ?? pulsePhase} phase — recent findings from nutrition science journals
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
                        <li key={i} className="flex gap-3" data-testid={`research-item-${i}`}>
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
                                data-testid={`research-source-${i}`}
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
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
