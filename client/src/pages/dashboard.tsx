import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { CalculatorForm } from "@/components/calculator-form";
import { ResultsDisplay } from "@/components/results-display";
import { SavedMealPlans } from "@/components/saved-meal-plans";
import { useCalculations } from "@/hooks/use-calculations";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, LogOut, User, BookOpen } from "lucide-react";
import type { Calculation } from "@shared/schema";

export default function Dashboard() {
  const [activeResultId, setActiveResultId] = useState<number | null>(null);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { data: history } = useCalculations();
  const { user, logout, isLoggingOut } = useAuth();
  const [, setLocation] = useLocation();

  const activeResult = history?.find(c => c.id === activeResultId);

  // Pre-fill form from the most recent calculation (if logged in)
  const lastCalculation: Partial<Calculation> | undefined = history?.[0];

  async function handleLogout() {
    setShowUserMenu(false);
    await logout();
    setLocation("/");
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
                          className="absolute right-0 top-10 z-20 bg-white border border-zinc-100 rounded-xl shadow-lg py-1 w-48"
                        >
                          <div className="px-3 py-2 border-b border-zinc-100">
                            <p className="text-xs font-semibold text-zinc-900 truncate">{user.name}</p>
                            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                          </div>
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
                <User className="w-4 h-4" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

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

        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-zinc-900 tracking-tight mb-4">
            Optimize your nutrition
          </h2>
          <p className="text-zinc-500 text-lg leading-relaxed">
            Enter your biometrics to receive a scientifically calculated daily and weekly calorie target, complete with optimal macronutrient breakdowns.
          </p>
          {user && (
            <p className="text-sm text-zinc-400 mt-2">
              Welcome back, <span className="font-medium text-zinc-600">{user.name}</span>. Your form is pre-filled from your last session.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5">
            <CalculatorForm
              onResult={(id) => setActiveResultId(id)}
              defaultValues={lastCalculation}
            />
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
                  {!user && (
                    <Link
                      href="/auth"
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors underline underline-offset-2"
                    >
                      Sign in to save your plans
                    </Link>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
