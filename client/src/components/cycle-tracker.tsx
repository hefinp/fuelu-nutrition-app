import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Circle, CalendarDays, Info, Lightbulb, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { UserPreferences } from "@shared/schema";
import { getCyclePhase } from "@/lib/cycle";
import { apiRequest } from "@/lib/queryClient";

const PHASE_EMOJI: Record<string, string> = {
  menstrual: "🌑",
  follicular: "🌒",
  ovulatory: "🌕",
  luteal: "🌖",
};

export function CycleTracker() {
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const [localDate, setLocalDate] = useState<string>("");
  const [localLength, setLocalLength] = useState<string>("");
  const [tipExpanded, setTipExpanded] = useState(false);

  const updatePrefsMutation = useMutation({
    mutationFn: (updates: Partial<UserPreferences>) =>
      apiRequest("PUT", "/api/user/preferences", { ...prefs, ...updates }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] }),
  });

  const lastPeriodDate = prefs?.lastPeriodDate ?? "";
  const cycleLength = prefs?.cycleLength ?? 28;

  const cycleInfo = lastPeriodDate ? getCyclePhase(lastPeriodDate, cycleLength) : null;

  const today = new Date().toISOString().split("T")[0];
  const { data: tipData, isLoading: tipLoading } = useQuery<{ tip: string }>({
    queryKey: ["/api/cycle/daily-tip", cycleInfo?.phase, today],
    queryFn: () =>
      fetch(`/api/cycle/daily-tip?phase=${cycleInfo!.phase}`)
        .then(r => r.json()),
    enabled: !!cycleInfo?.phase && tipExpanded,
    staleTime: 1000 * 60 * 60 * 12,
  });

  function handleDateBlur(value: string) {
    if (value && value !== lastPeriodDate) {
      updatePrefsMutation.mutate({ lastPeriodDate: value });
    }
  }

  function handleLengthBlur(value: string) {
    const n = parseInt(value, 10);
    if (!isNaN(n) && n >= 21 && n <= 35 && n !== cycleLength) {
      updatePrefsMutation.mutate({ cycleLength: n });
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div id="cycle-tracker-widget" className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-zinc-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center">
            <Circle className="w-4 h-4 text-zinc-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Cycle Tracker</h3>
            <p className="text-xs text-zinc-400">Meal plans adapt to your phase</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {cycleInfo ? (
          <>
            {/* Phase display */}
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

            {/* Cycle progress bar */}
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                <span>Day 1</span>
                <span>Day {cycleLength}</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    cycleInfo.phase === "menstrual" ? "bg-rose-400" :
                    cycleInfo.phase === "follicular" ? "bg-emerald-400" :
                    cycleInfo.phase === "ovulatory" ? "bg-amber-400" :
                    "bg-violet-400"
                  }`}
                  style={{ width: `${Math.min((cycleInfo.day / cycleLength) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-zinc-300">
                <span>Menstrual</span>
                <span>Follicular</span>
                <span>Ovulatory</span>
                <span>Luteal</span>
              </div>
            </div>

            {/* AI daily tip card */}
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
                          Generating tip…
                        </div>
                      ) : tipData?.tip ? (
                        <p className="text-xs text-zinc-600 leading-relaxed" data-testid="text-cycle-tip">{tipData.tip}</p>
                      ) : (
                        <p className="text-xs text-zinc-400">Tip unavailable. Please try again later.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center py-4 gap-2">
            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-1">
              <CalendarDays className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-700">Enter your last period start date</p>
            <p className="text-xs text-zinc-400">
              NutriSync will calculate your current phase and tailor meal suggestions accordingly.
            </p>
          </div>
        )}

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Last period</label>
            <input
              type="date"
              max={todayStr}
              defaultValue={lastPeriodDate}
              key={lastPeriodDate}
              onChange={e => setLocalDate(e.target.value)}
              onBlur={e => handleDateBlur(e.target.value)}
              data-testid="input-last-period-date"
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900
                         focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Cycle length (days)</label>
            <input
              type="number"
              min={21}
              max={35}
              defaultValue={cycleLength}
              key={cycleLength}
              onChange={e => setLocalLength(e.target.value)}
              onBlur={e => handleLengthBlur(e.target.value)}
              data-testid="input-cycle-length"
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900
                         focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
