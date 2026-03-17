import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, ChevronDown, ChevronUp, Sparkles, Lightbulb, Loader2,
  CheckCircle2, ExternalLink, Heart, Info, Shield, Lock, TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import type { UserPreferences, VitalitySymptom } from "@shared/schema";
import {
  getVitalityPhase, VITALITY_NUTRITION_CALLOUTS, PHASE_EMOJI,
  type VitalityPhase,
} from "@/lib/vitality";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

const SYMPTOM_OPTIONS = {
  energy: [
    { value: "low", label: "Low" },
    { value: "medium", label: "Med" },
    { value: "high", label: "High" },
  ],
  motivation: [
    { value: "low", label: "Low" },
    { value: "medium", label: "Med" },
    { value: "high", label: "High" },
  ],
  focus: [
    { value: "low", label: "Low" },
    { value: "medium", label: "Med" },
    { value: "high", label: "High" },
  ],
  stress: [
    { value: "low", label: "Low" },
    { value: "medium", label: "Med" },
    { value: "high", label: "High" },
  ],
  sleepQuality: [
    { value: "poor", label: "Poor" },
    { value: "fair", label: "Fair" },
    { value: "good", label: "Good" },
  ],
  libido: [
    { value: "low", label: "Low" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "High" },
  ],
} as const;

const SYMPTOM_LABELS: Record<string, string> = {
  energy: "Energy",
  motivation: "Motivation",
  focus: "Focus",
  stress: "Stress",
  sleepQuality: "Sleep",
  libido: "Drive",
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

function symptomSummary(s: SymptomRecord): string {
  const parts: string[] = [];
  if (s.energy) parts.push(`Energy: ${s.energy}`);
  if (s.motivation) parts.push(`Motivation: ${s.motivation}`);
  if (s.focus) parts.push(`Focus: ${s.focus}`);
  if (s.stress && s.stress !== "low") parts.push(`Stress: ${s.stress}`);
  if (s.sleepQuality && s.sleepQuality !== "good") parts.push(`Sleep: ${s.sleepQuality}`);
  return parts.join(" · ");
}

function hasAnySymptom(s: VitalitySymptom): boolean {
  return !!(s.energy || s.motivation || s.focus || s.stress || s.sleepQuality || s.libido);
}

function weeklyPatternNote(entries: VitalitySymptom[]): string | null {
  if (entries.length < 3) return null;
  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (e.energy === "high") counts["high energy"] = (counts["high energy"] ?? 0) + 1;
    if (e.focus === "high") counts["strong focus"] = (counts["strong focus"] ?? 0) + 1;
    if (e.stress === "high") counts["high stress"] = (counts["high stress"] ?? 0) + 1;
    if (e.sleepQuality === "poor") counts["poor sleep"] = (counts["poor sleep"] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  const [pattern, ct] = sorted[0];
  return `This week: ${pattern} on ${ct} of ${entries.length} day${entries.length === 1 ? "" : "s"}`;
}

export function VitalityTracker() {
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
    energy: null, motivation: null, focus: null, stress: null, sleepQuality: null, libido: null,
  });
  const [symptomsInitialized, setSymptomsInitialized] = useState(false);

  const phaseInfo = getVitalityPhase();

  const { data: tipData, isLoading: tipLoading } = useQuery<{ tip: string; source: { title: string; url: string } | null }>({
    queryKey: ["/api/vitality/daily-tip", phaseInfo.phase, today],
    queryFn: async () => { const r = await fetch(`/api/vitality/daily-tip?phase=${phaseInfo.phase}`); if (!r.ok) throw new Error(`${r.status}`); return r.json(); },
    enabled: tipExpanded && isPremium,
    staleTime: 1000 * 60 * 60 * 12,
  });

  const { data: symptomsData } = useQuery<VitalitySymptom[]>({
    queryKey: ["/api/vitality/symptoms", sevenDaysAgo, today],
    queryFn: () =>
      apiRequest("GET", `/api/vitality/symptoms?from=${sevenDaysAgo}&to=${today}`)
        .then(r => r.json()) as Promise<VitalitySymptom[]>,
    enabled: isPremium,
  });

  useEffect(() => {
    if (!symptomsData || symptomsInitialized) return;
    const todayEntry = symptomsData.find(s => s.date === today);
    if (todayEntry) {
      setLocalSymptoms({
        energy: todayEntry.energy ?? null,
        motivation: todayEntry.motivation ?? null,
        focus: todayEntry.focus ?? null,
        stress: todayEntry.stress ?? null,
        sleepQuality: todayEntry.sleepQuality ?? null,
        libido: todayEntry.libido ?? null,
      });
    }
    setSymptomsInitialized(true);
  }, [symptomsData, symptomsInitialized, today]);

  const symptomMutation = useMutation({
    mutationFn: (body: SymptomRecord & { date: string }) =>
      apiRequest("POST", "/api/vitality/symptoms", body).then(r => r.json()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/vitality/symptoms", sevenDaysAgo, today] }),
  });

  function handleSymptomChange(field: SymptomField, value: string | null) {
    const updated = { ...localSymptoms, [field]: value };
    setLocalSymptoms(updated);
    symptomMutation.mutate({ date: today, ...updated });
  }

  const todaySummary = symptomSummary(localSymptoms);
  const historyEntries = (symptomsData ?? [])
    .filter(s => s.date !== today && hasAnySymptom(s))
    .slice(0, 6);
  const patternNote = weeklyPatternNote(symptomsData ?? []);

  if (!isPremium) {
    return (
      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b border-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Vitality Tracker</h3>
              <p className="text-xs text-zinc-400">Optimise your nutrition for male health</p>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5 text-amber-500" />
          </div>
          <h4 className="text-sm font-semibold text-zinc-800 mb-1" data-testid="vitality-premium-gate">Premium Feature</h4>
          <p className="text-xs text-zinc-500 mb-3 max-w-xs mx-auto">
            Track energy, focus, and motivation daily. Get AI-powered insights on how your diet affects your vitality, backed by research.
          </p>
          <Link href="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition-colors cursor-pointer" data-testid="link-vitality-upgrade">
            <Shield className="w-3 h-3" />
            Upgrade to unlock
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="vitality-tracker-widget" className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b border-zinc-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900" data-testid="vitality-tracker-title">Vitality Tracker</h3>
              <p className="text-xs text-zinc-400">Optimise your nutrition for male health</p>
            </div>
          </div>
          <Link href="/vitality-insights" className="text-xs text-amber-600 hover:text-amber-700 font-medium" data-testid="link-vitality-insights">
            Insights →
          </Link>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <motion.div
          key={phaseInfo.phase}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-4 border ${phaseInfo.bgClass} ${phaseInfo.borderClass}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{PHASE_EMOJI[phaseInfo.phase]}</span>
                <span className={`text-sm font-semibold ${phaseInfo.colorClass}`} data-testid="vitality-phase-name">
                  {phaseInfo.name}
                </span>
              </div>
              <p className="text-xs text-zinc-500">Daily testosterone rhythm</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${phaseInfo.bgClass} ${phaseInfo.textClass} border ${phaseInfo.borderClass} whitespace-nowrap`}>
              {phaseInfo.shortTip}
            </span>
          </div>
          <div className={`mt-3 pt-3 border-t ${phaseInfo.borderClass} flex items-start gap-2`}>
            <Info className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${phaseInfo.colorClass}`} />
            <p className="text-xs text-zinc-600 leading-relaxed">{phaseInfo.tip}</p>
          </div>
        </motion.div>

        <div className="border border-zinc-100 rounded-2xl overflow-hidden">
          <button
            onClick={() => setNutritionExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
            data-testid="button-vitality-nutrition-toggle"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
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
                  {VITALITY_NUTRITION_CALLOUTS[phaseInfo.phase].map((bullet, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${phaseInfo.colorClass}`} />
                      <p className="text-xs text-zinc-600 leading-relaxed">{bullet}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border border-zinc-100 rounded-2xl overflow-hidden">
          <button
            onClick={() => setTipExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
            data-testid="button-vitality-tip-toggle"
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
                      <p className="text-xs text-zinc-600 leading-relaxed" data-testid="text-vitality-tip">
                        {tipData.tip}
                      </p>
                      {tipData.source && (
                        <a
                          href={tipData.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 group"
                          data-testid="link-vitality-tip-source"
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

        <div className="border border-zinc-100 rounded-2xl overflow-hidden">
          <button
            onClick={() => setSymptomExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
            data-testid="button-vitality-symptom-toggle"
          >
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-amber-400" />
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
              <p className="text-xs text-zinc-500" data-testid="text-vitality-today-summary">{todaySummary}</p>
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
                <div className="px-4 pb-4 pt-1 space-y-3">
                  {(Object.keys(SYMPTOM_OPTIONS) as SymptomField[]).map(field => (
                    <div key={field}>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium mb-1.5">
                        {SYMPTOM_LABELS[field]}
                      </p>
                      <div className="flex gap-1.5">
                        {SYMPTOM_OPTIONS[field].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => handleSymptomChange(field, localSymptoms[field] === opt.value ? null : opt.value)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              localSymptoms[field] === opt.value
                                ? "bg-amber-500 text-white"
                                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                            }`}
                            data-testid={`btn-vitality-${field}-${opt.value}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {symptomMutation.isPending && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                    </div>
                  )}
                </div>

                {patternNote && (
                  <div className="border-t border-zinc-100 px-4 py-2.5">
                    <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1" data-testid="vitality-weekly-pattern">
                      <TrendingUp className="w-3 h-3 flex-shrink-0" />
                      {patternNote}
                    </p>
                  </div>
                )}

                {historyEntries.length > 0 && (
                  <div className="border-t border-zinc-100 px-4 py-3">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium mb-2">Recent</p>
                    <div className="space-y-1.5">
                      {historyEntries.map(entry => (
                        <div key={entry.date} className="flex items-baseline gap-2">
                          <span className="text-[10px] text-zinc-400 font-medium w-14 flex-shrink-0">
                            {formatHistoryDate(entry.date)}
                          </span>
                          <span className="text-[10px] text-zinc-500 truncate">
                            {[
                              entry.energy ? `E:${entry.energy}` : null,
                              entry.motivation ? `M:${entry.motivation}` : null,
                              entry.focus ? `F:${entry.focus}` : null,
                              entry.stress ? `S:${entry.stress}` : null,
                            ].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
