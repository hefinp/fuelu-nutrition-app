import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalculatorForm } from "@/components/calculator-form";
import { NutritionDisplay, MealPlanGenerator } from "@/components/results-display";
import { SavedMealPlans } from "@/components/saved-meal-plans";
import { WeightTracker } from "@/components/weight-tracker";
import { PreferencesForm } from "@/components/preferences-form";
import { FoodLog } from "@/components/food-log";
import { RecipeLibrary } from "@/components/recipe-library";
import { HydrationTracker } from "@/components/hydration-tracker";
import { SortableWidget } from "@/components/sortable-widget";
import { Switch } from "@/components/ui/switch";
import { useDashboardLayout, WIDE_WIDGETS } from "@/hooks/use-dashboard-layout";
import type { WidgetId } from "@/hooks/use-dashboard-layout";
import type { PrefillEntry } from "@/components/food-log";
import type { Meal } from "@/components/results-display";
import { useCalculations } from "@/hooks/use-calculations";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { Calculation, UserPreferences } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  LogOut, BookOpen, Settings, X, SlidersHorizontal,
  ChevronDown, Salad, LayoutDashboard, Check, Loader2,
  Link2, Mail, Droplets, ClipboardList, UtensilsCrossed, Scale, BookMarked,
} from "lucide-react";
import { SiGoogle, SiApple, SiStrava } from "react-icons/si";

// Detect whether the viewport is desktop-width (xl = 1280px)
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1280;
  });
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1280);
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isDesktop;
}

export default function Dashboard() {
  const [activeResult, setActiveResult] = useState<Calculation | null>(null);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMetricsPanel, setShowMetricsPanel] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [dashboardAccordionOpen, setDashboardAccordionOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [logPrefill, setLogPrefill] = useState<PrefillEntry | null>(null);
  const { data: history, isLoading: historyLoading } = useCalculations();
  const { user, logout, isLoggingOut } = useAuth();
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();

  const { data: userPrefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    enabled: !!user,
  });

  // Local hidden-widget state: derived from prefs, updated optimistically on toggle
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  useEffect(() => {
    setHiddenWidgets(userPrefs?.hiddenWidgets ?? []);
  }, [userPrefs?.hiddenWidgets]);

  const toggleWidgetMutation = useMutation({
    mutationFn: (newHidden: string[]) =>
      apiRequest("PUT", "/api/user/preferences", { ...userPrefs, hiddenWidgets: newHidden }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] }),
  });

  function toggleWidget(id: string) {
    const next = hiddenWidgets.includes(id)
      ? hiddenWidgets.filter(w => w !== id)
      : [...hiddenWidgets, id];
    setHiddenWidgets(next);
    toggleWidgetMutation.mutate(next);
  }

  const {
    widgetOrder,
    leftOrder,
    rightOrder,
    setLeftOrder,
    setRightOrder,
    moveUp,
    moveDown,
    isEditing,
    setIsEditing,
    saveLayout,
    cancelEdit,
    isSaving,
  } = useDashboardLayout(!!user);

  // PointerSensor for desktop; TouchSensor with delay for iOS/Android
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleLogMeal = useCallback((meal: Meal | PrefillEntry) => {
    const entry: PrefillEntry = "mealName" in meal
      ? meal
      : { mealName: meal.meal, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat };
    setLogPrefill(entry);
  }, []);

  const handlePrefillConsumed = useCallback(() => setLogPrefill(null), []);

  const lastCalculation: Partial<Calculation> | undefined = history?.[0];

  useEffect(() => {
    if (history && history.length > 0 && !activeResult) {
      setActiveResult(history[0]);
    }
  }, [history]);

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

  function handleLeftDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLeftOrder(prev => {
        const oldIdx = prev.indexOf(active.id as WidgetId);
        const newIdx = prev.indexOf(over.id as WidgetId);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  function handleRightDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRightOrder(prev => {
        const oldIdx = prev.indexOf(active.id as WidgetId);
        const newIdx = prev.indexOf(over.id as WidgetId);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  const hasMetrics = !!activeResult;

  const targetWeight = activeResult
    ? parseFloat(activeResult.weight) +
      (activeResult.targetAmount
        ? parseFloat(activeResult.targetAmount) *
          (activeResult.goal === "fat_loss" || activeResult.goal === "tone" ? -1 : 1)
        : 0)
    : undefined;

  // Single render function for all widgets — used by both mobile and desktop paths
  function renderWidget(id: WidgetId): JSX.Element | null {
    if (hiddenWidgets.includes(id)) return null;
    switch (id) {
      case "nutrition":
        return <NutritionDisplay data={activeResult!} />;
      case "recipe-library":
        return user ? <RecipeLibrary /> : null;
      case "food-log":
        return user ? (
          <FoodLog
            dailyCaloriesTarget={activeResult?.dailyCalories ?? undefined}
            dailyProteinTarget={activeResult?.proteinGoal ?? undefined}
            dailyCarbsTarget={activeResult?.carbsGoal ?? undefined}
            dailyFatTarget={activeResult?.fatGoal ?? undefined}
            prefill={logPrefill}
            onPrefillConsumed={handlePrefillConsumed}
          />
        ) : null;
      case "meal-plan":
        return <MealPlanGenerator data={activeResult!} onLogMeal={handleLogMeal} />;
      case "hydration":
        return user ? <HydrationTracker /> : null;
      case "weight":
        return user ? (
          <WeightTracker
            targetWeight={targetWeight}
            dailyCaloriesTarget={activeResult?.dailyCalories ?? undefined}
          />
        ) : (
          <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-8 flex flex-col items-center text-center justify-center">
            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
              <SlidersHorizontal className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-600 mb-1">Track your weight over time</p>
            <p className="text-xs text-zinc-400 mb-4">Sign in to log and chart your weight progress.</p>
            <Link href="/auth" className="text-sm font-medium text-zinc-900 hover:underline">
              Sign in to start tracking
            </Link>
          </div>
        );
      default:
        return null;
    }
  }

  // Visible widgets in order (nulls removed)
  const visibleMobileOrder = widgetOrder.filter(id => renderWidget(id) !== null);

  return (
    <div className="min-h-screen bg-zinc-50/50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight text-zinc-900">NutriSync</h1>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={() => setShowSavedPlans(v => !v)}
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${showSavedPlans ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
                  data-testid="button-saved-plans"
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">My Plans</span>
                </button>

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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setShowMetricsPanel(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-zinc-400" />
                  <h2 className="font-semibold text-zinc-900">Settings</h2>
                </div>
                <button
                  onClick={() => setShowMetricsPanel(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                  data-testid="button-close-metrics"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <CalculatorForm
                  onResult={handleMetricsResult}
                  defaultValues={lastCalculation}
                  compact
                  onPendingChange={setIsCalculating}
                />

                {user && (() => {
                  const WIDGET_CONFIG: { id: string; label: string; Icon: React.ElementType }[] = [
                    { id: "food-log",       label: "Food Log",         Icon: ClipboardList },
                    { id: "hydration",      label: "Hydration",        Icon: Droplets },
                    { id: "meal-plan",      label: "Meal Planner",     Icon: UtensilsCrossed },
                    { id: "nutrition",      label: "Nutrition",        Icon: SlidersHorizontal },
                    { id: "weight",         label: "Progress Tracker", Icon: Scale },
                    { id: "recipe-library", label: "Recipe Library",   Icon: BookMarked },
                  ];

                  const CONNECTIONS = [
                    { label: "Email",  Icon: Mail,      connected: true,                                    colour: "text-zinc-500" },
                    { label: "Google", Icon: SiGoogle,  connected: user.provider === "google",              colour: "text-blue-500" },
                    { label: "Apple",  Icon: SiApple,   connected: user.provider === "apple",               colour: "text-zinc-900" },
                    { label: "Strava", Icon: SiStrava,  connected: false,                                   colour: "text-orange-500" },
                  ];

                  return (
                    <>
                      {/* ── Dashboard accordion ── */}
                      <div className="border-t border-zinc-100">
                        <button
                          type="button"
                          onClick={() => setDashboardAccordionOpen(v => !v)}
                          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-50/60 transition-colors"
                          data-testid="button-accordion-dashboard"
                        >
                          <div className="flex items-center gap-2.5">
                            <LayoutDashboard className="w-4 h-4 text-zinc-400" />
                            <span className="text-sm font-semibold text-zinc-900">Dashboard</span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${dashboardAccordionOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {dashboardAccordionOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-4 pt-1 space-y-1">
                                {WIDGET_CONFIG.map(({ id, label, Icon }) => (
                                  <div key={id} className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2.5">
                                      <Icon className="w-4 h-4 text-zinc-400" />
                                      <span className="text-sm text-zinc-700">{label}</span>
                                    </div>
                                    <Switch
                                      checked={!hiddenWidgets.includes(id)}
                                      onCheckedChange={() => toggleWidget(id)}
                                      data-testid={`toggle-widget-${id}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* ── Preferences accordion ── */}
                      <div className="border-t border-zinc-100">
                        <button
                          type="button"
                          onClick={() => setPrefsOpen(v => !v)}
                          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-50/60 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <Salad className="w-4 h-4 text-zinc-400" />
                            <span className="text-sm font-semibold text-zinc-900">Preferences</span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${prefsOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {prefsOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-5 pt-1">
                                <PreferencesForm />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* ── Connections accordion ── */}
                      <div className="border-t border-zinc-100">
                        <button
                          type="button"
                          onClick={() => setConnectionsOpen(v => !v)}
                          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-50/60 transition-colors"
                          data-testid="button-accordion-connections"
                        >
                          <div className="flex items-center gap-2.5">
                            <Link2 className="w-4 h-4 text-zinc-400" />
                            <span className="text-sm font-semibold text-zinc-900">Connections</span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${connectionsOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {connectionsOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-4 pt-1 space-y-1">
                                {CONNECTIONS.map(({ label, Icon, connected, colour }) => (
                                  <div key={label} className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2.5">
                                      <Icon className={`w-4 h-4 ${colour}`} />
                                      <span className="text-sm text-zinc-700">{label}</span>
                                    </div>
                                    <span
                                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        connected
                                          ? "bg-green-50 text-green-700"
                                          : "bg-zinc-100 text-zinc-400"
                                      }`}
                                      data-testid={`status-connection-${label.toLowerCase()}`}
                                    >
                                      {connected ? "Connected" : "Not connected"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex-shrink-0 border-t border-zinc-100 px-6 py-4 bg-white">
                <button
                  type="submit"
                  form="calculator-form"
                  disabled={isCalculating}
                  data-testid="button-create-plan"
                  className="w-full px-6 py-4 rounded-xl font-semibold bg-zinc-900 text-white shadow-lg
                           hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                           transition-all duration-200 ease-out flex justify-center items-center gap-2"
                >
                  {isCalculating ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Calculating...
                    </span>
                  ) : "Calculate & Create Plan"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Saved Plans */}
        <AnimatePresence>
          {showSavedPlans && user && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">Saved Plans</h2>
                    <p className="text-xs text-zinc-500">Save your favorite meal plans after reviewing them</p>
                  </div>
                </div>
                <SavedMealPlans onLogMeal={handleLogMeal} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {user && historyLoading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-600 rounded-full animate-spin" />
          </div>
        )}

        {/* No metrics CTA */}
        {!historyLoading && !hasMetrics && (
          <AnimatePresence>
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
          </AnimatePresence>
        )}

        {/* Dashboard */}
        {!historyLoading && hasMetrics && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Dashboard header */}
            <div className="flex items-start justify-between mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-display font-bold text-zinc-900 tracking-tight">
                  {user ? `Welcome back, ${user.name.split(" ")[0]}` : "Your Dashboard"}
                </h2>
                <p className="text-zinc-500 text-sm mt-0.5">
                  Your current nutrition targets and weight progress.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {user && !isEditing && (
                  <>
                    <button
                      onClick={handleOpenMetrics}
                      className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
                      data-testid="button-edit-metrics"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <span className="hidden sm:inline">Edit Metrics</span>
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
                      data-testid="button-edit-layout"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span className="hidden sm:inline">Edit Layout</span>
                    </button>
                  </>
                )}

                {isEditing && (
                  <>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 border border-zinc-200 rounded-xl text-zinc-500 hover:bg-zinc-50 transition-colors"
                      data-testid="button-cancel-layout"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={saveLayout}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                      data-testid="button-save-layout"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Done
                    </button>
                  </>
                )}

                {!user && (
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
            </div>

            {isEditing && (
              <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-700">
                <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                <span>
                  {isDesktop
                    ? <>Drag the <strong>⠿</strong> handle on any card to reorder it within its column. Click <strong>Done</strong> to save.</>
                    : <>Tap the <strong>↑↓</strong> arrows on any card to reorder it. Tap <strong>Done</strong> to save.</>
                  }
                </span>
              </div>
            )}

            {/* ── MOBILE layout: single column, flat order ── */}
            <div className="flex flex-col gap-6 xl:hidden">
              {visibleMobileOrder.map((id, idx) => (
                <SortableWidget
                  key={id}
                  id={id}
                  isEditing={isEditing}
                  isMobile={true}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < visibleMobileOrder.length - 1}
                  onMoveUp={() => moveUp(id)}
                  onMoveDown={() => moveDown(id)}
                >
                  {renderWidget(id)!}
                </SortableWidget>
              ))}
            </div>

            {/* ── DESKTOP layout: two columns with drag-and-drop ── */}
            <div className="hidden xl:grid xl:grid-cols-12 gap-6">
              {/* Left column — wide widgets */}
              <div className="xl:col-span-7 flex flex-col gap-6">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleLeftDragEnd}
                >
                  <SortableContext items={leftOrder} strategy={verticalListSortingStrategy}>
                    {leftOrder.map(id => {
                      const content = renderWidget(id);
                      if (!content) return null;
                      return (
                        <SortableWidget key={id} id={id} isEditing={isEditing} isMobile={false}>
                          {content}
                        </SortableWidget>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>

              {/* Right column — narrow widgets */}
              <div className="xl:col-span-5 xl:col-start-8 flex flex-col gap-6">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleRightDragEnd}
                >
                  <SortableContext items={rightOrder} strategy={verticalListSortingStrategy}>
                    {rightOrder.map(id => {
                      const content = renderWidget(id);
                      if (!content) return null;
                      return (
                        <SortableWidget key={id} id={id} isEditing={isEditing} isMobile={false}>
                          {content}
                        </SortableWidget>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mt-4 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">&copy; 2026 NutriSync</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors" data-testid="link-dash-privacy">Privacy</Link>
            <Link href="/terms" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors" data-testid="link-dash-terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
