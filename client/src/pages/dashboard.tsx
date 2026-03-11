import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { CalculatorForm } from "@/components/calculator-form";
import { ResultsDisplay } from "@/components/results-display";
import { SavedMealPlans } from "@/components/saved-meal-plans";
import { useCalculations } from "@/hooks/use-calculations";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, BookOpen, Settings, X, SlidersHorizontal } from "lucide-react";
import type { Calculation } from "@shared/schema";

export default function Dashboard() {
  const [activeResult, setActiveResult] = useState<Calculation | null>(null);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMetricsPanel, setShowMetricsPanel] = useState(false);
  const { data: history } = useCalculations();
  const { user, logout, isLoggingOut } = useAuth();
  const [, setLocation] = useLocation();

  const lastCalculation: Partial<Calculation> | undefined = history?.[0];

  async function handleLogout() {
    setShowUserMenu(false);
    await logout();
    setLocation("/");
  }

  function handleOpenMetrics() {
    setShowUserMenu(false);
    setShowMetricsPanel(true);
  }

  function handleMetricsResult(result: Calculation) {
    setActiveResult(result);
    setShowMetricsPanel(false);
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight text-zinc-900">NutriSync</h1>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Saved plans toggle */}
                <button
                  onClick={() => setShowSavedPlans(v => !v)}
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${showSavedPlans ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                  data-testid="button-saved-plans"
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">My Plans</span>
                </button>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(v => !v)}
                    className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors"
                    data-testid="button-user-menu"
                  >
                    <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline max-w-[120px] truncate">{user.name}</span>
                  </button>

                  <AnimatePresence>
                    {showUserMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -8 }}
                          className="absolute right-0 top-10 z-20 bg-white border border-zinc-100 rounded-xl shadow-lg py-1 w-52"
                        >
                          <div className="px-3 py-2 border-b border-zinc-100">
                            <p className="text-xs font-semibold text-zinc-900 truncate">{user.name}</p>
                            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                          </div>
                          <button
                            onClick={handleOpenMetrics}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                            data-testid="button-open-metrics"
                          >
                            <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
                            My Metrics
                          </button>
                          <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            data-testid="button-logout"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <Link
                href="/auth"
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
                data-testid="link-sign-in"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Metrics slide-over panel */}
      <AnimatePresence>
        {showMetricsPanel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setShowMetricsPanel(false)}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-zinc-400" />
                  <h2 className="font-semibold text-zinc-900">My Metrics</h2>
                </div>
                <button
                  onClick={() => setShowMetricsPanel(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                  data-testid="button-close-metrics"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable form area */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <p className="text-sm text-zinc-500 mb-6">
                  Update your body metrics below to recalculate your personalized calorie targets and macros.
                </p>
                <CalculatorForm
                  onResult={handleMetricsResult}
                  defaultValues={lastCalculation}
                  compact
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {/* Saved Plans Section */}
        <AnimatePresence>
          {showSavedPlans && user && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-10"
            >
              <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6 mb-2">
                <div className="flex items-center gap-2 mb-5">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">Saved Plans</h2>
                    <p className="text-xs text-zinc-500">Plans are saved automatically each time you generate one</p>
                  </div>
                </div>
                <SavedMealPlans />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results area */}
        <AnimatePresence mode="wait">
          {activeResult ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-display font-bold text-zinc-900 tracking-tight">Your Nutrition Plan</h2>
                  <p className="text-zinc-500 text-sm mt-1">Based on your latest metrics. Update them anytime via your profile.</p>
                </div>
                {user && (
                  <button
                    onClick={handleOpenMetrics}
                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
                    data-testid="button-edit-metrics"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">Edit Metrics</span>
                  </button>
                )}
              </div>
              <ResultsDisplay data={activeResult} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[500px] text-center"
            >
              <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-12 max-w-md w-full">
                <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <SlidersHorizontal className="w-7 h-7 text-zinc-400" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-2">Set up your metrics</h3>
                <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                  Enter your body metrics to receive a scientifically calculated daily calorie target and macro breakdown.
                </p>
                {user ? (
                  <button
                    onClick={handleOpenMetrics}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-medium text-sm hover:bg-zinc-800 transition-colors"
                    data-testid="button-enter-metrics-cta"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Enter My Metrics
                  </button>
                ) : (
                  <Link
                    href="/auth"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-medium text-sm hover:bg-zinc-800 transition-colors"
                    data-testid="link-signin-cta"
                  >
                    Sign in to get started
                  </Link>
                )}
                {!user && (
                  <button
                    onClick={handleOpenMetrics}
                    className="mt-3 block w-full text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
                    data-testid="button-enter-metrics-guest"
                  >
                    Continue as guest
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
