import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Circle, CalendarDays, Info, Lightbulb, Loader2, ChevronDown, ChevronUp,
  Sparkles, Heart, CheckCircle2, ExternalLink, Plus, X, Droplet, TrendingUp,
  Lock, Shield,
} from "lucide-react";
import { Link } from "wouter";
import type { UserPreferences, CycleSymptom, CyclePeriodLog } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import {
  getCyclePhase, getCyclePredictions, getUpcomingPhases,
  PHASE_NUTRITION_CALLOUTS, formatShortDate, type CyclePhase,
} from "@/lib/cycle";
import { apiRequest } from "@/lib/queryClient";
import { useActiveFlow } from "@/contexts/active-flow-context";

const PHASE_EMOJI: Record<string, string> = {
  menstrual: "🌑",
  follicular: "🌒",
  ovulatory: "🌕",
  luteal: "🌖",
};

const PHASE_STRIP_COLORS: Record<CyclePhase, { bg: string; text: string; activeBg: string }> = {
  menstrual: { bg: "bg-rose-100", text: "text-rose-600", activeBg: "bg-rose-500" },
  follicular: { bg: "bg-emerald-100", text: "text-emerald-600", activeBg: "bg-emerald-500" },
  ovulatory: { bg: "bg-amber-100", text: "text-amber-600", activeBg: "bg-amber-500" },
  luteal: { bg: "bg-violet-100", text: "text-violet-600", activeBg: "bg-violet-500" },
};

const SYMPTOM_OPTIONS = {
  energy: [
    { value: "low", label: "Low" },
    { value: "medium", label: "Med" },
    { value: "high", label: "High" },
  ],
  bloating: [
    { value: "none", label: "None" },
    { value: "mild", label: "Mild" },
    { value: "severe", label: "Severe" },
  ],
  cravings: [
    { value: "none", label: "None" },
    { value: "sweet", label: "Sweet" },
    { value: "salty", label: "Salty" },
    { value: "both", label: "Both" },
  ],
  mood: [
    { value: "balanced", label: "Balanced" },
    { value: "anxious", label: "Anxious" },
    { value: "low", label: "Low" },
  ],
  appetite: [
    { value: "low", label: "Low" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "High" },
  ],
} as const;

const SYMPTOM_LABELS: Record<string, string> = {
  energy: "Energy",
  bloating: "Bloating",
  cravings: "Cravings",
  mood: "Mood",
  appetite: "Appetite",
};

type SymptomField = keyof typeof SYMPTOM_OPTIONS;
type SymptomRecord = { [K in SymptomField]: string | null };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nDaysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatHistoryDate(dateStr: string): string {
  const today = todayStr();
  const yesterday = nDaysAgoStr(1);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function symptomSummary(s: SymptomRecord | CycleSymptom): string {
  const parts: string[] = [];
  if (s.energy) parts.push(`Energy: ${s.energy}`);
  if (s.bloating && s.bloating !== "none") parts.push(`Bloating: ${s.bloating}`);
  if (s.cravings && s.cravings !== "none") {
    parts.push(s.cravings === "both" ? "Sweet & salty cravings" : `${s.cravings} cravings`);
  }
  if (s.mood && s.mood !== "balanced") parts.push(`Mood: ${s.mood}`);
  if (s.appetite && s.appetite !== "normal") parts.push(`Appetite: ${s.appetite}`);
  return parts.join(" · ");
}

function hasAnySymptom(s: CycleSymptom): boolean {
  return !!(s.energy || s.bloating || s.cravings || s.mood || s.appetite);
}

export function CycleTracker() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isPremium = !!(user?.betaUser || (user?.tier && user.tier !== "free"));

  const today = todayStr();
  const sevenDaysAgo = nDaysAgoStr(6);

  const { data: prefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const [tipExpanded, setTipExpanded] = useState(false);
  const [nutritionExpanded, setNutritionExpanded] = useState(false);
  const [symptomExpanded, setSymptomExpanded] = useState(false);
  const [localSymptoms, setLocalSymptoms] = useState<SymptomRecord>({
    energy: null, bloating: null, cravings: null, mood: null, appetite: null,
  });
  const [symptomsInitialized, setSymptomsInitialized] = useState(false);
  const { setFlowActive } = useActiveFlow();

  const lastPeriodDate = prefs?.lastPeriodDate ?? "";
  const cycleLength = prefs?.cycleLength ?? 28;
  const periodLength = prefs?.periodLength ?? 5;

  const cycleInfo = lastPeriodDate ? getCyclePhase(lastPeriodDate, cycleLength) : null;
  const predictions = lastPeriodDate ? getCyclePredictions(lastPeriodDate, cycleLength) : null;
  const upcomingPhases = lastPeriodDate
    ? getUpcomingPhases(lastPeriodDate, cycleLength, periodLength, 21)
    : [];

  const { data: tipData, isLoading: tipLoading } = useQuery<{ tip: string; source: { title: string; url: string } | null }>({
    queryKey: ["/api/cycle/daily-tip", cycleInfo?.phase, today],
    queryFn: () => fetch(`/api/cycle/daily-tip?phase=${cycleInfo!.phase}`).then(r => r.json()),
    enabled: isPremium && !!cycleInfo?.phase && tipExpanded,
    staleTime: 1000 * 60 * 60 * 12,
  });

  const { data: periodLogs } = useQuery<CyclePeriodLog[]>({
    queryKey: ["/api/cycle/periods"],
    queryFn: () => apiRequest("GET", "/api/cycle/periods").then(r => r.json()),
    enabled: isPremium && !!cycleInfo,
  });

  const [periodExpanded, setPeriodExpanded] = useState(false);
  const [logStartDate, setLogStartDate] = useState(today);
  const [showStartForm, setShowStartForm] = useState(false);

  useEffect(() => {
    setFlowActive("cycle-tracking", symptomExpanded || showStartForm || periodExpanded);
    return () => setFlowActive("cycle-tracking", false);
  }, [symptomExpanded, showStartForm, periodExpanded, setFlowActive]);

  const createPeriodMutation = useMutation({
    mutationFn: (body: { periodStartDate: string }) =>
      apiRequest("POST", "/api/cycle/periods", body).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycle/periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      setShowStartForm(false);
    },
  });

  const endPeriodMutation = useMutation({
    mutationFn: ({ id, periodEndDate }: { id: number; periodEndDate: string }) =>
      apiRequest("PATCH", `/api/cycle/periods/${id}`, { periodEndDate }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cycle/periods"] }),
  });

  const deletePeriodMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/cycle/periods/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycle/periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    },
  });

  const openPeriod = periodLogs?.find(l => !l.periodEndDate) ?? null;
  const openPeriodDays = openPeriod
    ? Math.floor((new Date(today + "T00:00:00").getTime() - new Date(openPeriod.periodStartDate + "T00:00:00").getTime()) / 86400000)
    : null;

  const { data: symptomsData } = useQuery<CycleSymptom[]>({
    queryKey: ["/api/cycle/symptoms", sevenDaysAgo, today],
    queryFn: () =>
      apiRequest("GET", `/api/cycle/symptoms?from=${sevenDaysAgo}&to=${today}`)
        .then(r => r.json()) as Promise<CycleSymptom[]>,
    enabled: isPremium && !!cycleInfo,
  });

  useEffect(() => {
    if (!symptomsData || symptomsInitialized) return;
    const todayEntry = symptomsData.find(s => s.date === today);
    if (todayEntry) {
      setLocalSymptoms({
        energy: todayEntry.energy ?? null,
        bloating: todayEntry.bloating ?? null,
        cravings: todayEntry.cravings ?? null,
        mood: todayEntry.mood ?? null,
        appetite: todayEntry.appetite ?? null,
      });
    }
    setSymptomsInitialized(true);
  }, [symptomsData, symptomsInitialized, today]);

  const updatePrefsMutation = useMutation({
    mutationFn: (updates: Partial<UserPreferences>) =>
      apiRequest("PUT", "/api/user/preferences", { ...prefs, ...updates }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] }),
  });

  const symptomMutation = useMutation({
    mutationFn: (body: SymptomRecord & { date: string }) =>
      apiRequest("POST", "/api/cycle/symptoms", body).then(r => r.json()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/cycle/symptoms", sevenDaysAgo, today] }),
  });

  function handleDateBlur(value: string) {
    if (value && value !== lastPeriodDate) {
      setSymptomsInitialized(false);
      updatePrefsMutation.mutate({ lastPeriodDate: value });
    }
  }

  function handleLengthBlur(value: string) {
    const n = parseInt(value, 10);
    if (!isNaN(n) && n >= 21 && n <= 35 && n !== cycleLength) {
      updatePrefsMutation.mutate({ cycleLength: n });
    }
  }

  function handlePeriodLengthBlur(value: string) {
    const n = parseInt(value, 10);
    if (!isNaN(n) && n >= 2 && n <= 8 && n !== periodLength) {
      updatePrefsMutation.mutate({ periodLength: n });
    }
  }

  function handleSymptomChange(field: SymptomField, value: string | null) {
    const updated = { ...localSymptoms, [field]: value };
    setLocalSymptoms(updated);
    symptomMutation.mutate({ date: today, ...updated });
  }

  const todaySummary = symptomSummary(localSymptoms);
  const historyEntries = (symptomsData ?? [])
    .filter(s => s.date !== today && hasAnySymptom(s))
    .slice(0, 6);

  if (!isPremium) {
    return (
      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b border-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Cycle Tracker</h3>
              <p className="text-xs text-zinc-400">Cycle-aware nutrition insights</p>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5 text-rose-500" />
          </div>
          <h4 className="text-sm font-semibold text-zinc-800 mb-1" data-testid="cycle-premium-gate">Premium Feature</h4>
          <p className="text-xs text-zinc-500 mb-3 max-w-xs mx-auto">
            Adapt your meal plans and macros to each phase of your cycle. Get phase-specific food recommendations and research-backed insights.
          </p>
          <Link href="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-100 text-rose-700 rounded-lg text-xs font-medium hover:bg-rose-200 transition-colors cursor-pointer" data-testid="link-cycle-upgrade">
            <Shield className="w-3 h-3" />
            Upgrade to unlock
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="cycle-tracker-widget" className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b border-zinc-50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
            <Circle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Cycle Tracker</h3>
            <p className="text-xs text-zinc-400">Meal plans adapt to your phase</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {cycleInfo ? (
          <>
            {/* Phase display card */}
            <motion.div
              key={cycleInfo.phase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-4 border ${cycleInfo.bgClass} ${cycleInfo.borderClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{PHASE_EMOJI[cycleInfo.phase]}</span>
                    <span className={`text-sm font-semibold ${cycleInfo.colorClass}`}>
                      {cycleInfo.name} Phase
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">Day {cycleInfo.day} of your cycle</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cycleInfo.bgClass} ${cycleInfo.textClass} border ${cycleInfo.borderClass} whitespace-nowrap`}>
                  {cycleInfo.shortTip}
                </span>
              </div>
              <div className={`mt-3 pt-3 border-t ${cycleInfo.borderClass} flex items-start gap-2`}>
                <Info className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${cycleInfo.colorClass}`} />
                <p className="text-xs text-zinc-600 leading-relaxed">{cycleInfo.tip}</p>
              </div>
            </motion.div>

            {/* Predictions row */}
            {predictions && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-zinc-50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">Next period</p>
                  <p className="text-sm font-semibold text-zinc-900 mt-1">
                    {formatShortDate(predictions.nextPeriodDate)}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {predictions.daysUntilNextPeriod === 0
                      ? "today"
                      : `in ${predictions.daysUntilNextPeriod}d`}
                  </p>
                </div>
                <div className="bg-zinc-50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">Ovulation</p>
                  <p className="text-sm font-semibold text-zinc-900 mt-1">
                    {formatShortDate(predictions.ovulationDate)}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">cycle day {cycleLength - 14}</p>
                </div>
                <div className="bg-zinc-50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">Fertile</p>
                  <p className="text-sm font-semibold text-zinc-900 mt-1">
                    {predictions.fertileWindowStart.getDate()}–{formatShortDate(predictions.fertileWindowEnd)}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">6-day window</p>
                </div>
              </div>
            )}

            {/* Phase timeline strip */}
            {upcomingPhases.length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium mb-2">Next 21 days</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {upcomingPhases.map((dayInfo, i) => {
                    const colors = PHASE_STRIP_COLORS[dayInfo.phase];
                    const d = dayInfo.date;
                    return (
                      <div
                        key={i}
                        className={`flex-shrink-0 w-8 h-9 rounded-lg flex flex-col items-center justify-center transition-all ${
                          dayInfo.isToday
                            ? `${colors.activeBg} text-white ring-2 ring-offset-1 ring-${dayInfo.phase === "menstrual" ? "rose" : dayInfo.phase === "follicular" ? "emerald" : dayInfo.phase === "ovulatory" ? "amber" : "violet"}-400`
                            : `${colors.bg} ${colors.text}`
                        }`}
                        title={`${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — ${dayInfo.phase}`}
                        data-testid={`phase-strip-day-${i}`}
                      >
                        <span className={`text-[11px] font-semibold leading-none`}>
                          {d.getDate()}
                        </span>
                        {i === 0 && (
                          <span className={`text-[8px] leading-none mt-0.5 font-medium opacity-80`}>
                            today
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Phase legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {(["menstrual", "follicular", "ovulatory", "luteal"] as CyclePhase[]).map(phase => (
                    <div key={phase} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-sm ${PHASE_STRIP_COLORS[phase].bg} border border-zinc-200`} />
                      <span className="text-[10px] text-zinc-400 capitalize">{phase}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phase nutrition callout */}
            <div className="border border-zinc-100 rounded-2xl overflow-hidden">
              <button
                onClick={() => setNutritionExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
                data-testid="button-cycle-nutrition-toggle"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <span className="text-xs font-medium text-zinc-700">This phase & your nutrition</span>
                </div>
                {nutritionExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>
              <AnimatePresence>
                {nutritionExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 space-y-2">
                      {PHASE_NUTRITION_CALLOUTS[cycleInfo.phase].map((bullet, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${cycleInfo.colorClass}`} />
                          <p className="text-xs text-zinc-600 leading-relaxed">{bullet}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* AI daily tip */}
            <div className="border border-zinc-100 rounded-2xl overflow-hidden">
              <button
                onClick={() => setTipExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
                data-testid="button-cycle-tip-toggle"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium text-zinc-700">Today's nutrition tip</span>
                </div>
                {tipExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>
              <AnimatePresence>
                {tipExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1">
                      {tipLoading ? (
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Searching research for a tip…
                        </div>
                      ) : tipData?.tip ? (
                        <div className="space-y-2">
                          <p className="text-xs text-zinc-600 leading-relaxed" data-testid="text-cycle-tip">
                            {tipData.tip}
                          </p>
                          {tipData.source && (
                            <a
                              href={tipData.source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 group"
                              data-testid="link-tip-source"
                            >
                              <ExternalLink className="w-2.5 h-2.5 text-zinc-400 group-hover:text-zinc-600 transition-colors flex-shrink-0" />
                              <span className="text-[10px] text-zinc-400 group-hover:text-zinc-600 transition-colors truncate max-w-[220px]">
                                {tipData.source.title}
                              </span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">Tip unavailable. Please try again later.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Symptom check-in */}
            <div className="border border-zinc-100 rounded-2xl overflow-hidden">
              <button
                onClick={() => setSymptomExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
                data-testid="button-symptom-toggle"
              >
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-medium text-zinc-700">How are you feeling today?</span>
                </div>
                {symptomExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>

              {!symptomExpanded && todaySummary && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-zinc-500">{todaySummary}</p>
                </div>
              )}

              <AnimatePresence>
                {symptomExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 space-y-2.5">
                      {(Object.keys(SYMPTOM_OPTIONS) as SymptomField[]).map(field => (
                        <div key={field} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400 w-14 flex-shrink-0">
                            {SYMPTOM_LABELS[field]}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {SYMPTOM_OPTIONS[field].map(opt => {
                              const active = localSymptoms[field] === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => handleSymptomChange(field, active ? null : opt.value)}
                                  disabled={symptomMutation.isPending}
                                  data-testid={`button-symptom-${field}-${opt.value}`}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-60 ${
                                    active
                                      ? "bg-zinc-900 text-white"
                                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <p className="text-[10px] text-zinc-400 pt-1">Saved automatically</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 7-day symptom history */}
            {historyEntries.length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium mb-2">
                  Recent symptom log
                </p>
                <div className="space-y-1.5">
                  {historyEntries.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-2 px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-100"
                      data-testid={`symptom-history-${entry.date}`}
                    >
                      <span className="text-xs text-zinc-400 w-16 flex-shrink-0 pt-0.5">
                        {formatHistoryDate(entry.date)}
                      </span>
                      <span className="text-xs text-zinc-600">{symptomSummary(entry)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Period log */}
            <div className="border border-zinc-100 rounded-2xl overflow-hidden">
              <button
                onClick={() => setPeriodExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
                data-testid="button-period-log-toggle"
              >
                <div className="flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-medium text-zinc-700">Period log</span>
                  {openPeriod && (
                    <span className="text-[10px] text-rose-500 font-medium">
                      · Day {(openPeriodDays ?? 0) + 1}
                    </span>
                  )}
                </div>
                {periodExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>

              <AnimatePresence>
                {periodExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 space-y-3">
                      {/* Active period or log start button */}
                      {openPeriod ? (
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium text-rose-700">
                              Period started {formatHistoryDate(openPeriod.periodStartDate)}
                            </p>
                            <p className="text-[10px] text-rose-400 mt-0.5">
                              Day {(openPeriodDays ?? 0) + 1}
                            </p>
                          </div>
                          <button
                            onClick={() => endPeriodMutation.mutate({ id: openPeriod.id, periodEndDate: today })}
                            disabled={endPeriodMutation.isPending}
                            className="text-[10px] font-medium text-rose-600 px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                            data-testid="button-end-period"
                          >
                            {endPeriodMutation.isPending ? "…" : "Mark as ended"}
                          </button>
                        </div>
                      ) : (
                        <div>
                          {!showStartForm ? (
                            <button
                              onClick={() => setShowStartForm(true)}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-rose-200 text-rose-500 text-xs font-medium hover:bg-rose-50 transition-colors"
                              data-testid="button-log-period-start"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Log period start
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <label className="text-xs text-zinc-500 font-medium">Period start date</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  max={today}
                                  value={logStartDate}
                                  onChange={e => setLogStartDate(e.target.value)}
                                  className="flex-1 px-2.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                                  data-testid="input-period-start-date"
                                />
                                <button
                                  onClick={() => createPeriodMutation.mutate({ periodStartDate: logStartDate })}
                                  disabled={createPeriodMutation.isPending || !logStartDate}
                                  className="px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-medium hover:bg-rose-600 transition-colors disabled:opacity-50"
                                  data-testid="button-confirm-period-start"
                                >
                                  {createPeriodMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                                </button>
                                <button
                                  onClick={() => setShowStartForm(false)}
                                  className="p-2 rounded-xl hover:bg-zinc-100 transition-colors"
                                  data-testid="button-cancel-period-start"
                                >
                                  <X className="w-3.5 h-3.5 text-zinc-400" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Period history */}
                      {periodLogs && periodLogs.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">History</p>
                          {periodLogs.slice(0, 5).map(log => (
                            <div
                              key={log.id}
                              className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-100"
                              data-testid={`period-log-${log.id}`}
                            >
                              <Droplet className="w-3 h-3 text-rose-300 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-zinc-700">
                                  {formatHistoryDate(log.periodStartDate)}
                                  {log.periodEndDate && ` – ${formatHistoryDate(log.periodEndDate)}`}
                                </p>
                                {log.computedCycleLength && (
                                  <p className="text-[10px] text-zinc-400">
                                    Cycle: {log.computedCycleLength} days
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => deletePeriodMutation.mutate(log.id)}
                                disabled={deletePeriodMutation.isPending}
                                className="p-1 rounded-lg hover:bg-zinc-200 transition-colors text-zinc-300 hover:text-zinc-500 flex-shrink-0"
                                data-testid={`button-delete-period-${log.id}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {periodLogs.filter(l => l.computedCycleLength).length >= 2 && (
                            <p className="text-[10px] text-zinc-400 text-center pt-1">
                              Avg cycle: {Math.round(periodLogs.filter(l => l.computedCycleLength).reduce((s, l) => s + l.computedCycleLength!, 0) / periodLogs.filter(l => l.computedCycleLength).length)} days
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Insights link */}
            <Link href="/insights">
              <button
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-zinc-100 text-zinc-500 text-xs font-medium hover:bg-zinc-50 transition-colors"
                data-testid="button-view-insights"
              >
                <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
                View wellbeing insights
              </button>
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-center text-center py-4 gap-2">
            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-1">
              <CalendarDays className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-700">Cycle setup incomplete</p>
            <p className="text-xs text-zinc-400">
              Open <span className="font-medium text-zinc-600">Settings → Metrics</span> to enter your last period date and cycle details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
