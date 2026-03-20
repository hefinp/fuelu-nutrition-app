import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Pill, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { Calculation } from "@shared/schema";
import { getMicronutrients } from "./results-micronutrients";

export function NutritionDisplay({ data, overrideTargets }: { data: Calculation; overrideTargets?: { dailyCalories?: number; proteinGoal?: number; carbsGoal?: number; fatGoal?: number; fibreGoal?: number | null } | null }) {
  const displayData = overrideTargets ? {
    ...data,
    dailyCalories: overrideTargets.dailyCalories ?? data.dailyCalories,
    proteinGoal: overrideTargets.proteinGoal ?? data.proteinGoal,
    carbsGoal: overrideTargets.carbsGoal ?? data.carbsGoal,
    fatGoal: overrideTargets.fatGoal ?? data.fatGoal,
    fibreGoal: overrideTargets.fibreGoal !== undefined ? overrideTargets.fibreGoal : data.fibreGoal,
  } : data;
  const [expanded, setExpanded] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["Vitamins"]));
  const toggleSection = (label: string) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const microCategories = getMicronutrients(displayData.age ?? 30, displayData.gender ?? 'male');

  const chartData = [
    { name: "Protein", value: displayData.proteinGoal, color: "hsl(var(--chart-1))" },
    { name: "Carbs", value: displayData.carbsGoal, color: "hsl(var(--chart-2))" },
    { name: "Fat", value: displayData.fatGoal, color: "hsl(var(--chart-3))" },
  ];

  const subMacros = [
    { name: "Fibre", value: displayData.fibreGoal ?? 30, color: "#10b981", unit: "g", tip: "Daily target" },
    { name: "Sugar", value: displayData.sugarGoal ?? Math.round((displayData.dailyCalories * 0.1) / 4), color: "#f472b6", unit: "g", tip: "Max (total)" },
    { name: "Sat. Fat", value: displayData.saturatedFatGoal ?? Math.round((displayData.dailyCalories * 0.1) / 9), color: "#fb923c", unit: "g", tip: "Max" },
  ];

  const totalCal = displayData.dailyCalories;

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 text-white rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-[-50%] right-[-10%] w-96 h-96 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-6">
          <div className="mb-2">
            <h3 className="text-sm font-display font-bold">Nutrition Distribution</h3>
            <p className="text-zinc-400 text-xs mt-0.5">Daily macronutrient targets</p>
          </div>
          <div className="flex justify-end mb-3">
            <div className="text-right">
              <p className="text-2xl font-bold leading-none">{totalCal}</p>
              <p className="text-zinc-400 text-xs mt-0.5">kcal / day</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {chartData.map((item) => (
              <div key={item.name} className="bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-zinc-400 font-medium">{item.name}</span>
                </div>
                <p className="text-xl font-bold leading-none">{item.value}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
                {expanded && (
                  <p className="text-[10px] text-zinc-500 mt-1">{item.value * 7}g / week</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2">
            {subMacros.map((item) => (
              <div key={item.name} className="bg-white/5 rounded-xl p-2.5">
                <div className="flex items-center gap-1 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] text-zinc-500 font-medium">{item.name}</span>
                </div>
                <p className="text-base font-bold leading-none">{item.value}<span className="text-[10px] font-normal text-zinc-500 ml-0.5">{item.unit}</span></p>
                <p className="text-[9px] text-zinc-600 mt-0.5">{item.tip}</p>
              </div>
            ))}
          </div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="h-52 mt-4 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-semibold text-zinc-400 tracking-widest uppercase">MACROS</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="w-full mt-4 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            data-testid="button-nutrition-expand"
          >
            {expanded ? "Show less" : "Show more"}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed px-1" data-testid="text-health-disclaimer">
        Results are estimates. Consult a qualified healthcare professional before making dietary changes.
      </p>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-6 pt-5 pb-4">
                <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-zinc-900">Recommended Micronutrients</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Daily reference values based on your age &amp; sex (DRI)</p>
                </div>
              </div>

              {microCategories.map((cat) => {
                const isOpen = openSections.has(cat.label);
                return (
                  <div key={cat.label} className="border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => toggleSection(cat.label)}
                      className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-zinc-50 transition-colors text-left"
                      data-testid={`accordion-${cat.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <span className="text-sm font-semibold text-zinc-700">{cat.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">{cat.items.length} nutrients</span>
                        <ChevronDown
                          className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 pt-1">
                            {cat.items.map((item) => (
                              <div key={item.name} className="flex items-center justify-between py-1 border-b border-zinc-50">
                                <span className="text-xs text-zinc-600">{item.name}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-zinc-900">{item.amount} {item.unit}</span>
                                  {item.note && (
                                    <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                                      {item.note}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              <div className="px-6 py-3 border-t border-zinc-50 bg-zinc-50/50">
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Reference values from the Dietary Reference Intakes (DRI). Individual needs may vary — consult a healthcare professional for personalised guidance.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
