import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalculatorForm } from "@/components/calculator-form";
import { ResultsDisplay } from "@/components/results-display";
import { useCalculations } from "@/hooks/use-calculations";
import { ArrowLeft } from "lucide-react";

export default function Dashboard() {
  const [activeResultId, setActiveResultId] = useState<number | null>(null);
  const { data: history } = useCalculations();

  const activeResult = history?.find(c => c.id === activeResultId);

  return (
    <div className="min-h-screen bg-zinc-50/50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight text-zinc-900">
              NutriSync
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-zinc-900 tracking-tight mb-4">
            Optimize your nutrition
          </h2>
          <p className="text-zinc-500 text-lg leading-relaxed">
            Enter your biometrics to receive a scientifically calculated daily and weekly calorie target, complete with optimal macronutrient breakdowns.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5">
            <CalculatorForm onResult={(id) => setActiveResultId(id)} />
          </div>
          
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {activeResult ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-4">
                    <button
                      onClick={() => setActiveResultId(null)}
                      className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Clear selection
                    </button>
                  </div>
                  <ResultsDisplay data={activeResult} />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center min-h-[400px] bg-zinc-100/50 rounded-3xl border border-zinc-200 border-dashed text-center p-8"
                >
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                    <div className="w-8 h-8 border-4 border-zinc-200 rounded-full border-t-zinc-400 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-700">Awaiting Input</h3>
                  <p className="text-zinc-500 max-w-sm mt-2">
                    Fill out the form on the left to generate your personalized nutrition plan.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
