import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalculatorForm } from "@/components/calculator-form";
import { NutritionDisplay, MealPlanGenerator } from "@/components/results-display";
import { SavedMealPlans } from "@/components/saved-meal-plans";
import { WeightTracker } from "@/components/weight-tracker";
import { PreferencesForm, AllergiesForm } from "@/components/preferences-form";
import { FoodLog } from "@/components/food-log";
import { FoodLogDrawer } from "@/components/food-log-drawer";
import { HydrationTracker } from "@/components/hydration-tracker";
import { ActivityWidget } from "@/components/activity-widget";
const CycleTracker = lazy(() => import("@/components/cycle-tracker").then(m => ({ default: m.CycleTracker })));
const VitalityTracker = lazy(() => import("@/components/vitality-tracker").then(m => ({ default: m.VitalityTracker })));
import { MyMealsFoodWidget } from "@/components/my-meals-food-widget";
import { MyMomentumWidget } from "@/components/my-momentum-widget";
import { MyDiaryWidget } from "@/components/my-diary-widget";
import { OnboardingTour } from "@/components/onboarding-tour";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { FeedbackWidget } from "@/components/feedback-widget";
import { InstallPrompt } from "@/components/install-prompt";
import ClientIntakeFormWidget from "@/components/client-intake-form";
import { SortableWidget } from "@/components/sortable-widget";
import { Switch } from "@/components/ui/switch";
import { MacroComplianceWidget } from "@/components/macro-compliance-widget";
import { useDashboardLayout, MOBILE_PLANNING_IDS, MOBILE_INSIGHTS_IDS } from "@/hooks/use-dashboard-layout";
import type { WidgetId } from "@/hooks/use-dashboard-layout";
import type { PrefillEntry } from "@/components/food-log";
import type { Meal } from "@/components/results-display";
import { useCalculations } from "@/hooks/use-calculations";
import { useAuth } from "@/hooks/use-auth";
import { useTierStatus } from "@/hooks/use-tier";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Calculation, NutritionistProfile, UserPreferences } from "@shared/schema";
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
  ChevronDown, Salad, LayoutDashboard, Check, Loader2, ShieldAlert,
  Link2, Mail, Droplets, ClipboardList, UtensilsCrossed, Scale, BookMarked, TrendingUp, Home,
  Sparkles, ScanLine, Heart, ShieldCheck, Zap, User, Crown, Briefcase, MessageSquare,
  CalendarDays, Activity, PenLine, Target, RefreshCw, NotebookPen, ChevronLeft, ChevronRight, Trash2,
} from "lucide-react";
import type { AdaptiveTdeeSuggestion } from "@shared/schema";
import { SiGoogle, SiApple, SiStrava } from "react-icons/si";
import {
  type FoodLogEntry, type MealSlot,
  SLOT_LABELS, SLOT_ICONS, SLOT_COLORS,
  todayStr, formatDateLabel, shiftDate, MacroGrid,
} from "@/components/food-log-shared";

function ClientUnreadBadge() {
  const { user } = useAuth();
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/my-nutritionist/messages/unread-count"],
    queryFn: () => apiRequest("GET", "/api/my-nutritionist/messages/unread-count").then(r => r.json()),
    enabled: !!user?.isManagedClient,
    refetchInterval: 10000,
  });
  if (!data?.count) return null;
  return (
    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full" data-testid="badge-client-unread">
      {data.count}
    </span>
  );
}

function ClientPendingSurveysBadge() {
  const { user } = useAuth();
  const { data } = useQuery<{ id: number }[]>({
    queryKey: ["/api/my-nutritionist/surveys/pending"],
    queryFn: () => apiRequest("GET", "/api/my-nutritionist/surveys/pending").then(r => r.json()),
    enabled: !!user?.isManagedClient,
    refetchInterval: 60000,
  });
  const count = data?.length ?? 0;
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full" data-testid="badge-pending-surveys">
      {count}
    </span>
  );
}

function FreeWeeklySummaryCard() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery<{ summary: string | null; insufficientData?: boolean; cached?: boolean }>({
    queryKey: ["/api/food-log/free-weekly-summary"],
    staleTime: 60 * 60 * 1000,
    retry: false,
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4 mb-6 snap-start" data-testid="card-free-weekly-summary">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold text-emerald-800">Weekly Nutrition Summary</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-600">
          <Loader2 className="w-3 h-3 animate-spin" />
          Generating your summary...
        </div>
      </div>
    );
  }

  if (!data || data.insufficientData || !data.summary) return null;

  const bullets = data.summary.split("\n").filter(l => l.trim().startsWith("•")).map(l => l.trim());
  const displayLines = bullets.length > 0 ? bullets : data.summary.split("\n").filter(l => l.trim());

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4 mb-6 snap-start" data-testid="card-free-weekly-summary">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left cursor-pointer"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
        aria-controls="weekly-summary-content"
        data-testid="button-toggle-weekly-summary"
      >
        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
        </div>
        <div className="flex-1">
          <span className="text-sm font-semibold text-emerald-800">Weekly Nutrition Summary</span>
          <span className="ml-2 text-[10px] text-emerald-600 font-medium bg-emerald-100 px-1.5 py-0.5 rounded-full">Free</span>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-emerald-500 shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            id="weekly-summary-content"
            className="space-y-1.5 overflow-hidden mt-3"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {displayLines.slice(0, 4).map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-emerald-900 leading-relaxed">
                <span className="text-emerald-500 shrink-0 mt-0.5">•</span>
                <span>{line.replace(/^•\s*/, "")}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdaptiveTdeeCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: suggestion, isLoading } = useQuery<AdaptiveTdeeSuggestion | null>({
    queryKey: ["/api/adaptive-tdee/suggestion"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: effectiveTargets } = useQuery<{ hasOverrides: boolean } | null>({
    queryKey: ["/api/calculations/effective-targets"],
    enabled: !!user,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/adaptive-tdee/suggestion/${id}/accept`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/adaptive-tdee/suggestion"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calculations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calculations/effective-targets"] });
      toast({ title: "Target updated", description: "Your daily calorie target has been adjusted." });
    },
    onError: () => toast({ title: "Error", description: "Could not update target.", variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/adaptive-tdee/suggestion/${id}/dismiss`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/adaptive-tdee/suggestion"] });
    },
  });

  const calculateMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/adaptive-tdee/calculate").then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/adaptive-tdee/suggestion"] });
      if (data.throttled) {
        toast({ title: "Checked recently", description: data.message });
      } else if (data.hasOverride) {
        toast({ title: "Nutritionist targets active", description: data.message });
      } else if (data.eligible === false) {
        toast({ title: "Not enough data", description: data.message, variant: "destructive" });
      } else if (data.noChange) {
        toast({ title: "On track", description: data.message });
      }
    },
    onError: () => toast({ title: "Error", description: "Could not run calculation.", variant: "destructive" }),
  });

  const isOverridden = effectiveTargets?.hasOverrides ?? false;

  if (isLoading) return null;

  if (!suggestion) {
    if (isOverridden) return null;
    return (
      <div
        className="flex items-center justify-between bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 mb-6 snap-start"
        data-testid="card-adaptive-tdee-trigger"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-zinc-400" />
          <span className="text-xs text-zinc-500">Adaptive TDEE — no pending suggestion</span>
        </div>
        <button
          onClick={() => calculateMutation.mutate()}
          disabled={calculateMutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
          data-testid="button-calculate-adaptive-tdee"
        >
          {calculateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Check now
        </button>
      </div>
    );
  }

  const delta = suggestion.delta;

  return (
    <div
      className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 mb-6 snap-start"
      data-testid="card-adaptive-tdee"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Target className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-blue-900">Weekly Target Update</span>
            <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full capitalize">
              {suggestion.confidence} confidence
            </span>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed mb-3">{suggestion.explanation}</p>

          {isOverridden ? (
            <p className="text-xs text-blue-600 italic">
              Your nutritionist has set manual targets — this is informational only and cannot overwrite the override.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => acceptMutation.mutate(suggestion.id)}
                disabled={acceptMutation.isPending || dismissMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                data-testid="button-accept-adaptive-suggestion"
              >
                {acceptMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Accept ({delta > 0 ? "+" : ""}{delta} kcal)
              </button>
              <button
                onClick={() => dismissMutation.mutate(suggestion.id)}
                disabled={acceptMutation.isPending || dismissMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors disabled:opacity-50"
                data-testid="button-dismiss-adaptive-suggestion"
              >
                {dismissMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

const TAB_ORDER: Array<'favourites' | 'planning' | 'tracking' | 'insights'> = ['favourites', 'planning', 'tracking', 'insights'];

interface DiaryModalProps {
  open: boolean;
  onClose: () => void;
  calTarget?: number;
  protTarget?: number;
  carbsTarget?: number;
  fatTarget?: number;
}

function DiaryModal({ open, onClose, calTarget, protTarget, carbsTarget, fatTarget }: DiaryModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const { data: dailyEntries = [], isLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?date=${selectedDate}`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load food log");
      return res.json();
    },
    enabled: open && !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/food-log/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  const confirmedEntries = dailyEntries.filter(e => e.confirmed !== false);
  const totalCal = confirmedEntries.reduce((s, e) => s + e.calories, 0);
  const totalProt = confirmedEntries.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = confirmedEntries.reduce((s, e) => s + e.carbs, 0);
  const totalFat = confirmedEntries.reduce((s, e) => s + e.fat, 0);

  const slotOrder: (MealSlot | null)[] = ["breakfast", "lunch", "dinner", "snack", "drinks", null];
  const grouped: Record<string, FoodLogEntry[]> = {};
  for (const entry of dailyEntries) {
    const key = entry.mealSlot ?? "__none__";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }
  const orderedSlots = slotOrder.filter(s => grouped[s ?? "__none__"]?.length > 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="diary-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[51] bg-black/40"
            onClick={onClose}
          />
          <motion.div
            key="diary-modal-panel"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed z-[52] inset-x-4 top-[5%] bottom-[5%] max-w-lg mx-auto bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
            data-testid="diary-modal"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-900 rounded-lg text-white">
                  <NotebookPen className="w-4 h-4" />
                </div>
                <span className="text-base font-bold text-zinc-900">My Diary</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-600"
                data-testid="button-close-diary-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between mx-5 mt-4 mb-3 bg-zinc-50 rounded-xl px-2 py-1.5 shrink-0">
              <button
                onClick={() => setSelectedDate(d => shiftDate(d, -1))}
                className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
                data-testid="button-diary-modal-prev-day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center">
                <span className="text-sm font-semibold text-zinc-800" data-testid="text-diary-modal-date">
                  {isToday ? "Today" : formatDateLabel(selectedDate)}
                </span>
                {isToday && <span className="block text-[10px] text-zinc-400">{formatDateLabel(selectedDate)}</span>}
                {!isToday && (
                  <button
                    onClick={() => setSelectedDate(today)}
                    className="block mx-auto text-[10px] text-zinc-400 hover:text-zinc-600 font-medium transition-colors mt-0.5"
                    data-testid="button-diary-modal-go-to-today"
                  >
                    Back to today
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedDate(d => shiftDate(d, 1))}
                className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
                data-testid="button-diary-modal-next-day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5">
              <MacroGrid
                cal={totalCal} prot={totalProt} carbs={totalCarbs} fat={totalFat}
                calTarget={calTarget} protTarget={protTarget}
                carbsTarget={carbsTarget} fatTarget={fatTarget}
              />

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : dailyEntries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <NotebookPen className="w-8 h-8 text-zinc-300" />
                  <p className="text-sm text-zinc-400">No meals logged for this day</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orderedSlots.map(slot => {
                    const key = slot ?? "__none__";
                    const entries = grouped[key] ?? [];
                    const SlotIcon = slot ? SLOT_ICONS[slot] : null;
                    const slotColor = slot ? SLOT_COLORS[slot] : null;
                    const label = slot ? SLOT_LABELS[slot] : "Other";

                    return (
                      <div key={key}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {SlotIcon && slotColor && (
                            <span className={`p-1 rounded-md ${slotColor}`}>
                              <SlotIcon className="w-3 h-3" />
                            </span>
                          )}
                          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</span>
                        </div>
                        <div className="space-y-1">
                          {entries.map(entry => {
                            const isPlanned = entry.confirmed === false;
                            return (
                              <div
                                key={entry.id}
                                className={`flex items-center gap-2 rounded-xl p-2.5 ${isPlanned ? "bg-zinc-50/60 border border-dashed border-zinc-200 opacity-70" : "bg-zinc-50"}`}
                                data-testid={`diary-modal-entry-${entry.id}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-900 truncate">
                                    {entry.mealName}
                                    {isPlanned && <span className="ml-1.5 text-[10px] font-normal text-zinc-400">(Planned)</span>}
                                  </p>
                                  <p className="text-xs text-zinc-500 mt-0.5">
                                    {entry.calories} kcal · P:{entry.protein}g C:{entry.carbs}g F:{entry.fat}g
                                  </p>
                                </div>
                                <button
                                  onClick={() => deleteMutation.mutate(entry.id)}
                                  disabled={deleteMutation.isPending}
                                  className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                  data-testid={`button-diary-modal-delete-${entry.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Dashboard() {
  const [activeResult, setActiveResult] = useState<Calculation | null>(null);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(() =>
    sessionStorage.getItem("welcomeWidgetDismissed") === "1"
  );
  const [welcomeExiting, setWelcomeExiting] = useState(false);
  const welcomeWidgetRef = useRef<HTMLDivElement | null>(null);
  const welcomeHeightRef = useRef<number>(0);
  const isCoarsePointer = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const [showMetricsPanel, setShowMetricsPanel] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [dashboardAccordionOpen, setDashboardAccordionOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [allergiesOpen, setAllergiesOpen] = useState(false);
  const [logPrefill, setLogPrefill] = useState<PrefillEntry | null>(null);
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const { data: history, isLoading: historyLoading, isFetched: historyFetched } = useCalculations();
  const { user, logout, isLoggingOut } = useAuth();
  const { data: tierStatus } = useTierStatus();
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: userPrefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    enabled: !!user,
  });

  const { data: nutritionistProfile } = useQuery<NutritionistProfile | null>({
    queryKey: ["/api/nutritionist/profile"],
    enabled: !!user,
    retry: false,
  });

  const { data: stravaStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/strava/status"],
    enabled: !!user,
  });

  const { data: effectiveTargets } = useQuery<{ dailyCalories: number; proteinGoal: number; carbsGoal: number; fatGoal: number; fibreGoal: number | null; hasOverrides: boolean } | null>({
    queryKey: ["/api/calculations/effective-targets"],
    enabled: !!user,
  });

  const isNutritionist = !!nutritionistProfile;

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

  const [cycleStopConfirm, setCycleStopConfirm] = useState(false);
  const [mobileTab, setMobileTabRaw] = useState<'favourites' | 'planning' | 'tracking' | 'insights'>(() => {
    const stored = sessionStorage.getItem('fuelr_dashboard_tab_v2');
    if (stored === 'favourites' || stored === 'planning' || stored === 'tracking' || stored === 'insights') return stored;
    return 'favourites';
  });
  const [tabTransition, setTabTransition] = useState<{ direction: number; source: 'toggle' | 'bottomnav' }>({ direction: 0, source: 'toggle' });

  const setMobileTab = useCallback((tab: 'favourites' | 'planning' | 'tracking' | 'insights', source: 'toggle' | 'bottomnav' = 'toggle') => {
    setMobileTabRaw(prev => {
      const prevIdx = TAB_ORDER.indexOf(prev);
      const nextIdx = TAB_ORDER.indexOf(tab);
      const direction = nextIdx > prevIdx ? 1 : nextIdx < prevIdx ? -1 : 0;
      setTabTransition({ direction, source });
      return tab;
    });
    sessionStorage.setItem('fuelr_dashboard_tab_v2', tab);
  }, []);

  const updatePrefsMutation = useMutation({
    mutationFn: (updates: Partial<UserPreferences>) =>
      apiRequest("PUT", "/api/user/preferences", { ...userPrefs, ...updates }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] }),
  });

  function handleDismissWidget(id: string) {
    if (id === "cycle") {
      setCycleStopConfirm(true);
    } else {
      toggleWidget(id);
    }
  }

  function confirmStopCycleTracking() {
    updatePrefsMutation.mutate({ cycleTrackingEnabled: false });
    setCycleStopConfirm(false);
  }

  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const showOnboarding = !!user && userPrefs !== undefined && userPrefs?.onboardingComplete !== true && !onboardingDismissed;

  const dismissOnboarding = useCallback(() => {
    setOnboardingDismissed(true);
    apiRequest("PUT", "/api/user/preferences", { ...userPrefs, onboardingComplete: true })
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] }))
      .catch(() => {
        toast({ title: "Couldn't save progress", description: "Your setup was skipped but the preference may not have saved. You can re-open the wizard from settings.", variant: "destructive" });
      });
  }, [userPrefs, queryClient, toast]);

  const handleWizardComplete = useCallback((calculation: Record<string, unknown>) => {
    setOnboardingDismissed(true);
    setActiveResult(calculation as Calculation);
    queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    setTimeout(() => setShowTour(true), 400);
  }, [queryClient]);

  function toggleWidget(id: string) {
    const next = hiddenWidgets.includes(id)
      ? hiddenWidgets.filter(w => w !== id)
      : [...hiddenWidgets, id];
    setHiddenWidgets(next);
    toggleWidgetMutation.mutate(next);
  }

  const {
    widgetOrder,
    homeOrder,
    leftOrder,
    rightOrder,
    insightsOrder,
    setHomeOrder,
    setLeftOrder,
    setRightOrder,
    setInsightsOrder,
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
    sessionStorage.removeItem("welcomeWidgetDismissed");
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

  function handleHomeDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setHomeOrder(prev => {
        const oldIdx = prev.indexOf(active.id as WidgetId);
        const newIdx = prev.indexOf(over.id as WidgetId);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
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

  function handleInsightsDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setInsightsOrder(prev => {
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
        return <NutritionDisplay data={activeResult!} overrideTargets={effectiveTargets ? { dailyCalories: effectiveTargets.dailyCalories, proteinGoal: effectiveTargets.proteinGoal, carbsGoal: effectiveTargets.carbsGoal, fatGoal: effectiveTargets.fatGoal, fibreGoal: effectiveTargets.fibreGoal } : null} />;
      case "my-meals-food":
        return user ? <MyMealsFoodWidget /> : null;
      case "food-log":
        return user ? (
          <div id="food-log-section">
            <FoodLog
              dailyCaloriesTarget={effectiveTargets?.dailyCalories ?? activeResult?.dailyCalories ?? undefined}
              dailyProteinTarget={effectiveTargets?.proteinGoal ?? activeResult?.proteinGoal ?? undefined}
              dailyCarbsTarget={effectiveTargets?.carbsGoal ?? activeResult?.carbsGoal ?? undefined}
              dailyFatTarget={effectiveTargets?.fatGoal ?? activeResult?.fatGoal ?? undefined}
              prefill={logPrefill}
              onPrefillConsumed={handlePrefillConsumed}
            />
          </div>
        ) : null;
      case "meal-plan":
        return <MealPlanGenerator data={activeResult!} onLogMeal={handleLogMeal} overrideTargets={effectiveTargets ? { dailyCalories: effectiveTargets.dailyCalories, proteinGoal: effectiveTargets.proteinGoal, carbsGoal: effectiveTargets.carbsGoal, fatGoal: effectiveTargets.fatGoal } : null} />;
      case "hydration":
        return user ? <HydrationTracker /> : null;
      case "activity":
        return user ? <ActivityWidget /> : null;
      case "cycle":
        if (!user) return null;
        if (userPrefs?.cycleTrackingEnabled && lastCalculation?.gender === "female") return <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>}><CycleTracker /></Suspense>;
        if (lastCalculation?.gender === "female" && !userPrefs?.cycleTrackingEnabled) {
          return (
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border border-rose-100 p-5" data-testid="cycle-nudge-card">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/80 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-4.5 h-4.5 text-rose-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-zinc-800 mb-1">Cycle-Aware Nutrition</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-3">
                    Adapt your meal plans and macros to each phase of your cycle. Get phase-specific food recommendations and research-backed insights.
                  </p>
                  <button
                    onClick={() => updatePrefsMutation.mutate({ cycleTrackingEnabled: true })}
                    disabled={updatePrefsMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors disabled:opacity-50"
                    data-testid="button-enable-cycle-tracking"
                  >
                    {updatePrefsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Heart className="w-3 h-3" />}
                    Enable
                  </button>
                </div>
              </div>
            </div>
          );
        }
        return null;
      case "vitality":
        if (!user) return null;
        if (userPrefs?.vitalityInsightsEnabled && lastCalculation?.gender === "male") return <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>}><VitalityTracker /></Suspense>;
        if (lastCalculation?.gender === "male" && !userPrefs?.vitalityInsightsEnabled) {
          return (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-5" data-testid="vitality-nudge-card">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/80 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4.5 h-4.5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-zinc-800 mb-1">Vitality Insights</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-3">
                    Track energy, focus, and motivation. Get research-backed nutrition insights to support overall wellbeing.
                  </p>
                  <button
                    onClick={() => updatePrefsMutation.mutate({ vitalityInsightsEnabled: true })}
                    disabled={updatePrefsMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                    data-testid="button-enable-vitality-tracking"
                  >
                    {updatePrefsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Enable
                  </button>
                </div>
              </div>
            </div>
          );
        }
        return null;
      case "weight":
        return user ? (
          <WeightTracker
            targetWeight={targetWeight}
            dailyCaloriesTarget={effectiveTargets?.dailyCalories ?? activeResult?.dailyCalories ?? undefined}
            isAdvanced={!!(tierStatus?.betaUser || tierStatus?.tier === "advanced")}
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
      case "weekly-summary":
        return user ? <FreeWeeklySummaryCard /> : null;
      case "adaptive-tdee":
        if (!user) return null;
        if (tierStatus?.betaUser || tierStatus?.tier === "advanced") return <AdaptiveTdeeCard />;
        return null;
      case "macro-compliance":
        return user ? (
          <MacroComplianceWidget
            dailyCalories={effectiveTargets?.dailyCalories ?? activeResult?.dailyCalories ?? undefined}
            proteinGoal={effectiveTargets?.proteinGoal ?? activeResult?.proteinGoal ?? undefined}
            carbsGoal={effectiveTargets?.carbsGoal ?? activeResult?.carbsGoal ?? undefined}
            fatGoal={effectiveTargets?.fatGoal ?? activeResult?.fatGoal ?? undefined}
          />
        ) : null;
      case "my-momentum":
        return user ? (
          <MyMomentumWidget
            dailyCalories={effectiveTargets?.dailyCalories ?? activeResult?.dailyCalories ?? undefined}
            proteinGoal={effectiveTargets?.proteinGoal ?? activeResult?.proteinGoal ?? undefined}
            carbsGoal={effectiveTargets?.carbsGoal ?? activeResult?.carbsGoal ?? undefined}
            fatGoal={effectiveTargets?.fatGoal ?? activeResult?.fatGoal ?? undefined}
            hydrationGoalMl={userPrefs?.hydrationGoalMl ?? 2000}
          />
        ) : null;
      case "my-diary":
        return user ? <MyDiaryWidget
          calTarget={effectiveTargets?.dailyCalories ?? activeResult?.dailyCalories ?? undefined}
          protTarget={effectiveTargets?.proteinGoal ?? activeResult?.proteinGoal ?? undefined}
          carbsTarget={effectiveTargets?.carbsGoal ?? activeResult?.carbsGoal ?? undefined}
          fatTarget={effectiveTargets?.fatGoal ?? activeResult?.fatGoal ?? undefined}
        /> : null;
      default:
        return null;
    }
  }

  // All visible widgets (nulls removed)
  const allVisibleOrder = widgetOrder.filter(id => renderWidget(id) !== null);
  // Mobile: filter by active tab (Favourites / Planning / Tracking / Insights)
  // Favourites tab renders its own content (MyMealsFoodWidget standalone), so show empty widget list
  const visibleMobileOrder = mobileTab === 'favourites' ? [] : allVisibleOrder.filter(id => {
    if (mobileTab === 'planning') return MOBILE_PLANNING_IDS.has(id);
    if (mobileTab === 'insights') return MOBILE_INSIGHTS_IDS.has(id);
    return !MOBILE_PLANNING_IDS.has(id) && !MOBILE_INSIGHTS_IDS.has(id);
  });

  const headerRef = useRef<HTMLElement | null>(null);
  const tabToggleRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const updateSnapVars = useCallback(() => {
    const root = document.documentElement;
    const hH = headerRef.current?.offsetHeight ?? 0;
    const tH = tabToggleRef.current?.offsetHeight ?? 0;
    root.style.setProperty('--dashboard-header-h', `${hH}px`);
    root.style.setProperty('--dashboard-snap-top', `${hH + tH}px`);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("dashboard-snap");
    const ro = new ResizeObserver(updateSnapVars);
    roRef.current = ro;
    if (headerRef.current) ro.observe(headerRef.current);
    if (tabToggleRef.current) ro.observe(tabToggleRef.current);
    updateSnapVars();
    return () => {
      document.documentElement.classList.remove("dashboard-snap");
      ro.disconnect();
      roRef.current = null;
      document.documentElement.style.removeProperty('--dashboard-header-h');
      document.documentElement.style.removeProperty('--dashboard-snap-top');
    };
  }, [updateSnapVars]);

  const headerCallbackRef = useCallback((node: HTMLElement | null) => {
    if (headerRef.current) roRef.current?.unobserve(headerRef.current);
    headerRef.current = node;
    if (node) roRef.current?.observe(node);
    updateSnapVars();
  }, [updateSnapVars]);

  const tabToggleCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (tabToggleRef.current) roRef.current?.unobserve(tabToggleRef.current);
    tabToggleRef.current = node;
    if (node) roRef.current?.observe(node);
    updateSnapVars();
  }, [updateSnapVars]);

  useEffect(() => {
    if (welcomeDismissed) return;
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    if (!isMobile) return;
    const el = welcomeWidgetRef.current;
    if (!el) return;
    let exitTriggered = false;
    let exitTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio === 0 && !exitTriggered) {
          exitTriggered = true;
          const bannerEl = welcomeWidgetRef.current;
          if (!bannerEl) return;
          const bannerHeight = bannerEl.offsetHeight;
          const bannerMargin = parseFloat(getComputedStyle(bannerEl).marginBottom || "0");
          const totalRemoved = bannerHeight + bannerMargin;
          welcomeHeightRef.current = totalRemoved;
          document.documentElement.classList.remove("dashboard-snap");
          setWelcomeExiting(true);
          bannerEl.style.overflow = "hidden";
          bannerEl.style.height = bannerHeight + "px";
          requestAnimationFrame(() => {
            bannerEl.style.height = "0px";
            bannerEl.style.marginBottom = "0px";
          });
          let completed = false;
          const finalize = () => {
            if (completed) return;
            completed = true;
            const scrollCompensation = welcomeHeightRef.current;
            if (scrollCompensation > 0) {
              window.scrollTo({ top: Math.max(0, window.scrollY - scrollCompensation), behavior: "auto" });
            }
            sessionStorage.setItem("welcomeWidgetDismissed", "1");
            setWelcomeDismissed(true);
            setWelcomeExiting(false);
            requestAnimationFrame(() => {
              document.documentElement.classList.add("dashboard-snap");
            });
          };
          bannerEl.addEventListener("transitionend", (e) => {
            if (e.propertyName === "height") finalize();
          }, { once: true });
          exitTimer = setTimeout(finalize, 400);
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (exitTimer !== null) clearTimeout(exitTimer);
      if (!document.documentElement.classList.contains("dashboard-snap")) {
        document.documentElement.classList.add("dashboard-snap");
      }
    };
  }, [welcomeDismissed]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stravaParam = params.get("strava");
    if (stravaParam) {
      if (stravaParam === "connected") {
        toast({ title: "Strava connected", description: "Your Strava account has been linked successfully." });
        queryClient.invalidateQueries({ queryKey: ["/api/strava/status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/strava/activities"] });
        fetch("/api/strava/sync", { method: "POST", credentials: "include" }).catch(() => {});
      } else if (stravaParam === "error") {
        toast({ title: "Strava connection failed", description: "Something went wrong connecting to Strava. Please try again.", variant: "destructive" });
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-100 pb-36 sm:pb-20">
      {/* Header */}
      <header ref={headerCallbackRef} className="bg-white border-b border-zinc-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center relative">
              <div className="w-3 h-3 bg-white rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[calc(50%-6px)] bg-white rounded-t-sm" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight text-zinc-900">FuelU</h1>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={() => setShowDiaryModal(true)}
                  aria-label="My Diary"
                  className="hidden sm:flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                  data-testid="button-my-diary"
                >
                  <NotebookPen className="w-4 h-4" />
                  <span className="text-[10px] font-medium leading-none">Diary</span>
                </button>

                <button
                  onClick={handleOpenMetrics}
                  aria-label="Settings"
                  className="hidden sm:flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                  data-testid="button-settings-header"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-[10px] font-medium leading-none">Settings</span>
                </button>

                {!isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      aria-label="Edit Layout"
                      className="hidden sm:flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                      data-testid="button-edit-layout-header"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span className="text-[10px] font-medium leading-none">Layout</span>
                    </button>
                    <button
                      onClick={handleOpenMetrics}
                      aria-label="Settings"
                      className="sm:hidden flex items-center justify-center p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                      data-testid="button-settings-header-mobile"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      aria-label="Edit Layout"
                      className="sm:hidden flex items-center justify-center p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                      data-testid="button-edit-layout-header-mobile"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="hidden sm:flex items-center gap-2">
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50 transition-colors"
                        data-testid="button-cancel-layout"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                      <button
                        onClick={saveLayout}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                        data-testid="button-save-layout"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Done
                      </button>
                    </div>
                    <button
                      onClick={cancelEdit}
                      aria-label="Cancel"
                      className="sm:hidden flex items-center justify-center p-2 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50 transition-colors"
                      data-testid="button-cancel-layout-mobile"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={saveLayout}
                      disabled={isSaving}
                      aria-label="Done"
                      className="sm:hidden flex items-center justify-center p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                      data-testid="button-save-layout-mobile"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                  </>
                )}

                {user.isManagedClient && (
                  <Link
                    href="/messages"
                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 transition-colors relative"
                    data-testid="link-messages"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">Messages</span>
                    <ClientUnreadBadge />
                  </Link>
                )}

                {user.isManagedClient && (
                  <Link
                    href="/my-progress"
                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 transition-colors"
                    data-testid="link-my-progress"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span className="hidden sm:inline">My Progress</span>
                  </Link>
                )}

                {user.isManagedClient && (
                  <Link
                    href="/my-surveys"
                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 transition-colors relative"
                    data-testid="link-my-surveys"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span className="hidden sm:inline">Surveys</span>
                    <ClientPendingSurveysBadge />
                  </Link>
                )}

                {tierStatus && !user.isManagedClient && (tierStatus.tier === "free" || tierStatus.tier === "simple") && (
                  <Link
                    href="/pricing"
                    aria-label="Upgrade plan"
                    className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm"
                    data-testid="link-upgrade-cta"
                  >
                    <Zap className="w-4 h-4" />
                    <span className="hidden sm:inline">Upgrade</span>
                  </Link>
                )}

                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(v => !v)}
                    className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors"
                    data-testid="button-user-menu"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      {tierStatus && !user.isManagedClient && !tierStatus.betaUser && tierStatus.tier !== "advanced" && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white" data-testid="badge-upgrade-dot" />
                      )}
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
                          <div className="px-3 py-2.5 border-b border-zinc-100">
                            <p className="text-xs font-semibold text-zinc-900 truncate">{user.name}</p>
                            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                            {tierStatus && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  tierStatus.tier === "advanced"
                                    ? "bg-amber-100 text-amber-700"
                                    : tierStatus.tier === "simple"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-zinc-100 text-zinc-600"
                                }`} data-testid="badge-menu-tier">
                                  <Crown className="w-3 h-3" />
                                  {tierStatus.tier === "advanced" ? "Advanced" : tierStatus.tier === "simple" ? "Simple" : "Free"}
                                </span>
                                {tierStatus.betaUser && (
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700" data-testid="badge-menu-beta">
                                    Beta
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <Link
                            href="/account"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                            data-testid="link-my-account"
                          >
                            <User className="w-4 h-4 text-zinc-400" />
                            My Account
                          </Link>
                          <Link
                            href={isNutritionist ? "/nutritionist/portal" : "/nutritionist/register"}
                            onClick={() => setShowUserMenu(false)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                            data-testid="link-nutritionist-portal"
                          >
                            <Briefcase className="w-4 h-4 text-zinc-400" />
                            {isNutritionist ? "Professional Portal" : "Nutritionist Account"}
                          </Link>
                          <button
                            onClick={handleOpenMetrics}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                            data-testid="button-open-metrics"
                          >
                            <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
                            My Metrics
                          </button>
                          <button
                            onClick={() => { setShowTour(true); setShowUserMenu(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                            data-testid="button-take-tour"
                          >
                            <BookOpen className="w-4 h-4 text-zinc-400" />
                            Take the Tour
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

        {/* Personal / Professional tab strip — only visible to nutritionist account holders */}
        {user && isNutritionist && (
          <div className="border-t border-zinc-100" data-testid="tab-strip-professional">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-1 h-10">
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-zinc-900 bg-zinc-100"
                  data-testid="tab-personal-active"
                >
                  Personal
                </span>
                <Link
                  href="/nutritionist/portal"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors"
                  data-testid="tab-professional"
                >
                  Professional
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Metrics slide-over panel */}
      <AnimatePresence>
        {showMetricsPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-[55]"
              onClick={() => setShowMetricsPanel(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-[60] shadow-2xl flex flex-col"
            >
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-zinc-400" />
                  <h2 className="font-semibold text-zinc-900">Profile & Preferences</h2>
                </div>
                <button
                  onClick={() => setShowMetricsPanel(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                  data-testid="button-close-metrics"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pb-safe">
                {user && (() => {
                  const WIDGET_CONFIG: { id: string; label: string; Icon: React.ElementType }[] = [
                    { id: "food-log",        label: "Food Log",           Icon: ClipboardList },
                    { id: "my-meals-food",   label: "My Meals & Food",    Icon: UtensilsCrossed },
                    { id: "my-momentum",     label: "My Momentum",        Icon: TrendingUp },
                    { id: "my-diary",        label: "My Diary",           Icon: BookMarked },
                    { id: "hydration",       label: "Hydration",          Icon: Droplets },
                    { id: "activity",        label: "Activity",           Icon: Activity },
                    { id: "meal-plan",       label: "Meal Planner",       Icon: Salad },
                    { id: "nutrition",       label: "Nutrition",          Icon: SlidersHorizontal },
                    { id: "weight",          label: "Progress Tracker",   Icon: Scale },
                  ];

                  return (
                    <>
                      {/* ── Dashboard accordion (first) ── */}
                      <div className="border-b border-zinc-100">
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
                    </>
                  );
                })()}

                <CalculatorForm
                  onResult={handleMetricsResult}
                  defaultValues={lastCalculation}
                  compact
                  onPendingChange={setIsCalculating}
                />

                {user && (() => {
                  const CONNECTIONS = [
                    { label: "Email",  Icon: Mail,      connected: true,                                    colour: "text-zinc-500",   action: undefined as (() => void) | undefined },
                    { label: "Google", Icon: SiGoogle,  connected: user.provider === "google",              colour: "text-blue-500",   action: undefined as (() => void) | undefined },
                    { label: "Apple",  Icon: SiApple,   connected: user.provider === "apple",               colour: "text-zinc-900",   action: undefined as (() => void) | undefined },
                    { label: "Strava", Icon: SiStrava,  connected: !!stravaStatus?.connected,               colour: "text-orange-500", action: stravaStatus?.connected
                      ? () => { apiRequest("DELETE", "/api/strava/disconnect").then(() => { queryClient.invalidateQueries({ queryKey: ["/api/strava/status"] }); queryClient.invalidateQueries({ queryKey: ["/api/strava/activities"] }); }).catch(() => {}); }
                      : () => { apiRequest("GET", "/api/strava/auth").then(r => r.json()).then((d: { url: string }) => { window.open(d.url, "_blank"); }).catch(() => { toast({ title: "Strava unavailable", description: "Could not connect to Strava right now. Please try again.", variant: "destructive" }); }); }
                    },
                  ];

                  return (
                    <>
                      {/* ── Allergies & Intolerances accordion ── */}
                      <div className="border-t border-zinc-100">
                        <button
                          type="button"
                          onClick={() => setAllergiesOpen(v => !v)}
                          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-50/60 transition-colors"
                          data-testid="button-accordion-allergies"
                        >
                          <div className="flex items-center gap-2.5">
                            <ShieldAlert className="w-4 h-4 text-zinc-400" />
                            <span className="text-sm font-semibold text-zinc-900">Allergies & Intolerances</span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${allergiesOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {allergiesOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-5 pt-1">
                                <AllergiesForm />
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
                          data-testid="button-accordion-preferences"
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
                                {CONNECTIONS.map(({ label, Icon, connected, colour, action }) => (
                                  <div
                                    key={label}
                                    className={`flex items-center justify-between py-2.5 ${action ? "cursor-pointer hover:bg-zinc-50/60 -mx-2 px-2 rounded-lg transition-colors" : ""}`}
                                    onClick={action}
                                    data-testid={`connection-row-${label.toLowerCase()}`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <Icon className={`w-4 h-4 ${colour}`} />
                                      <span className="text-sm text-zinc-700">{label}</span>
                                    </div>
                                    {action ? (
                                      connected ? (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700" data-testid={`status-connection-${label.toLowerCase()}`}>Connected</span>
                                          <span
                                            className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                                            onClick={(e) => { e.stopPropagation(); action(); }}
                                            data-testid={`button-disconnect-${label.toLowerCase()}`}
                                          >
                                            Disconnect
                                          </span>
                                        </div>
                                      ) : (
                                        <span
                                          className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100"
                                          data-testid={`status-connection-${label.toLowerCase()}`}
                                        >
                                          Connect
                                        </span>
                                      )
                                    ) : (
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
                                    )}
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

        {tierStatus?.paymentFailedAt && (
          <div className="flex items-start gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-2xl" data-testid="banner-payment-failed-dashboard">
            <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Payment failed</p>
              <p className="text-xs text-red-600 mt-1">
                Your last payment failed and your account has been reverted to the Free tier.
              </p>
              <Link href="/billing" className="mt-2 inline-block text-xs font-medium text-red-700 underline hover:text-red-900" data-testid="link-payment-failed-billing">
                Update payment method
              </Link>
            </div>
          </div>
        )}

        {user && !isNutritionist && <ClientIntakeFormWidget />}

        {/* Loading */}
        {user && historyLoading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        )}

        {/* No metrics CTA */}
        {!historyLoading && historyFetched && !hasMetrics && (
          <AnimatePresence>
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[500px] text-center"
            >
              <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-8 sm:p-12 max-w-md w-full">
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

                <div className="mt-8 pt-6 border-t border-zinc-100">
                  <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-3">What you'll unlock</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Sparkles, label: "AI Meal Plans", color: "text-violet-500" },
                      { icon: ScanLine, label: "Smart Food Scanning", color: "text-blue-500" },
                      { icon: Heart, label: "Cycle-Aware Nutrition", color: "text-rose-500" },
                      { icon: ShieldCheck, label: "EU Allergen Filtering", color: "text-emerald-500" },
                    ].map(({ icon: Icon, label, color }) => (
                      <div key={label} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2" data-testid={`feature-chip-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
                        <span className="text-xs text-zinc-600 font-medium">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
            {/* Dashboard welcome widget — session-dismissable on mobile via scroll; always visible on desktop */}
            {(!isCoarsePointer || !welcomeDismissed || welcomeExiting) && (
            <div
              ref={welcomeWidgetRef}
              data-testid="widget-welcome"
              className="mb-6"
              style={isCoarsePointer ? {
                transition: "opacity 0.3s ease, transform 0.3s ease, height 0.35s ease, margin-bottom 0.35s ease",
                opacity: welcomeExiting ? 0 : 1,
                transform: welcomeExiting ? "translateY(-8px)" : "translateY(0)",
              } : undefined}
            >
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5" data-testid="widget-welcome-inner">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-display font-bold text-zinc-900 tracking-tight">
                    {user ? `Welcome back, ${user.name.split(" ")[0]}` : "Your Dashboard"}
                  </h2>
                  <p className="text-zinc-500 text-sm mt-0.5">
                    Your current nutrition targets and weight progress.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {!user && (
                    <button
                      onClick={handleOpenMetrics}
                      className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
                      data-testid="button-edit-metrics"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="hidden sm:inline">Settings</span>
                    </button>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="flex items-center gap-2 mt-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-700">
                  <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {isDesktop
                      ? <>Drag the <strong>⠿</strong> handle on any card to reorder it within its column. Click <strong>Done</strong> to save.</>
                      : <>Tap the <strong>↑↓</strong> arrows on any card to reorder it within its tab. Tap <strong>Done</strong> to save.</>
                    }
                  </span>
                </div>
              )}
            </div>
            </div>
            )}

            {/* ── MOBILE tab toggle: Favourites / Planning / Tracking / Insights ── */}
            <div ref={tabToggleCallbackRef} className="xl:hidden sticky z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-2 bg-zinc-100" style={{ top: 'var(--dashboard-header-h)' }}>
              <div className="flex items-center gap-2" data-testid="dashboard-tab-toggle">
                {(
                  [
                    { key: 'favourites' as const, label: 'Home', icon: Home },
                    { key: 'planning' as const, label: 'Planning', icon: CalendarDays },
                    { key: 'tracking' as const, label: 'Tracking', icon: Activity },
                    { key: 'insights' as const, label: 'Insights', icon: TrendingUp },
                  ] as Array<{ key: 'favourites' | 'planning' | 'tracking' | 'insights'; label: string; icon: React.ElementType }>
                ).map(tab => {
                  const isActive = mobileTab === tab.key;
                  const Icon = tab.icon;
                  return (
                    <motion.button
                      key={tab.key}
                      type="button"
                      onClick={() => setMobileTab(tab.key, 'toggle')}
                      data-testid={`tab-dashboard-${tab.key}`}
                      layout
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className={`relative flex items-center justify-center gap-1.5 h-10 rounded-xl overflow-hidden shrink-0 bg-zinc-900 text-white ${
                        isActive ? 'px-3.5' : 'w-10'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                      <AnimatePresence mode="wait">
                        {isActive && (
                          <motion.span
                            key="label"
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.18 }}
                            className="text-xs font-semibold whitespace-nowrap overflow-hidden"
                          >
                            {tab.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ── MOBILE animated tab content ── */}
            <AnimatePresence mode="wait" custom={tabTransition}>
              <motion.div
                key={mobileTab}
                custom={tabTransition}
                variants={{
                  enter: ({ direction, source }: { direction: number; source: 'toggle' | 'bottomnav' }) => ({
                    x: source === 'bottomnav' ? 0 : direction * 60,
                    y: source === 'bottomnav' ? 40 : 0,
                    opacity: 0,
                  }),
                  center: { x: 0, y: 0, opacity: 1 },
                  exit: ({ direction, source }: { direction: number; source: 'toggle' | 'bottomnav' }) => ({
                    x: source === 'bottomnav' ? 0 : direction * -60,
                    y: source === 'bottomnav' ? -20 : 0,
                    opacity: 0,
                  }),
                }}
                initial={false}
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="xl:hidden"
              >
                {/* ── MOBILE Favourites tab content ── */}
                {mobileTab === 'favourites' && (
                  <div className="mb-6 flex flex-col gap-6">
                    {user ? (
                      <>
                        {!hiddenWidgets.includes("my-momentum") && (
                          <MyMomentumWidget
                            dailyCalories={effectiveTargets?.dailyCalories ?? activeResult?.dailyCalories ?? undefined}
                            proteinGoal={effectiveTargets?.proteinGoal ?? activeResult?.proteinGoal ?? undefined}
                            carbsGoal={effectiveTargets?.carbsGoal ?? activeResult?.carbsGoal ?? undefined}
                            fatGoal={effectiveTargets?.fatGoal ?? activeResult?.fatGoal ?? undefined}
                            hydrationGoalMl={userPrefs?.hydrationGoalMl ?? 2000}
                          />
                        )}
                        {!hiddenWidgets.includes("my-diary") && <MyDiaryWidget
                          calTarget={effectiveTargets?.dailyCalories ?? activeResult?.dailyCalories ?? undefined}
                          protTarget={effectiveTargets?.proteinGoal ?? activeResult?.proteinGoal ?? undefined}
                          carbsTarget={effectiveTargets?.carbsGoal ?? activeResult?.carbsGoal ?? undefined}
                          fatTarget={effectiveTargets?.fatGoal ?? activeResult?.fatGoal ?? undefined}
                        />}
                        {!hiddenWidgets.includes("my-meals-food") && <MyMealsFoodWidget />}
                      </>
                    ) : (
                      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-8 text-center" data-testid="favourites-sign-in-prompt">
                        <Home className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-zinc-500 mb-1">Sign in to view your home</p>
                        <p className="text-xs text-zinc-400">Save meals and foods you love for quick access.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── MOBILE layout: tab-filtered widgets ── */}
                <div className="flex flex-col gap-6">
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
                      onDismiss={!isEditing ? () => handleDismissWidget(id) : undefined}
                    >
                      {renderWidget(id)!}
                    </SortableWidget>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* ── DESKTOP layout: Home, Planning, Tracking, Insights ── */}
            <div className="hidden xl:grid xl:grid-cols-4 gap-6">
              {/* Home column */}
              <div className="flex flex-col gap-6">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleHomeDragEnd}
                >
                  <SortableContext items={homeOrder} strategy={verticalListSortingStrategy}>
                    {homeOrder.map(id => {
                      const content = renderWidget(id);
                      if (!content) return null;
                      return (
                        <SortableWidget key={id} id={id} isEditing={isEditing} isMobile={false} onDismiss={!isEditing ? () => handleDismissWidget(id) : undefined}>
                          {content}
                        </SortableWidget>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>

              {/* Planning column */}
              <div className="flex flex-col gap-6">
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
                        <SortableWidget key={id} id={id} isEditing={isEditing} isMobile={false} onDismiss={!isEditing ? () => handleDismissWidget(id) : undefined}>
                          {content}
                        </SortableWidget>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>

              {/* Tracking column */}
              <div className="flex flex-col gap-6">
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
                        <SortableWidget key={id} id={id} isEditing={isEditing} isMobile={false} onDismiss={!isEditing ? () => handleDismissWidget(id) : undefined}>
                          {content}
                        </SortableWidget>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>

              {/* Insights column */}
              <div className="flex flex-col gap-6">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleInsightsDragEnd}
                >
                  <SortableContext items={insightsOrder} strategy={verticalListSortingStrategy}>
                    {insightsOrder.map(id => {
                      const content = renderWidget(id);
                      if (!content) return null;
                      return (
                        <SortableWidget key={id} id={id} isEditing={isEditing} isMobile={false} onDismiss={!isEditing ? () => handleDismissWidget(id) : undefined}>
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

      <footer className="hidden sm:block max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mt-4 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">&copy; 2026 FuelU</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors" data-testid="link-dash-privacy">Privacy</Link>
            <Link href="/terms" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors" data-testid="link-dash-terms">Terms</Link>
          </div>
        </div>
      </footer>

      <InstallPrompt />

      {/* ── Mobile bottom navigation bar ─────────────────────────────────── */}
      {user && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-100 safe-area-inset-bottom" data-testid="mobile-bottom-nav">
          <div className="flex items-stretch h-16">
            {[
              {
                id: "plan",
                icon: CalendarDays,
                label: "Plan",
                active: mobileTab === 'planning' && !showSavedPlans && !showMetricsPanel,
                action: () => {
                  setShowSavedPlans(false);
                  setShowMetricsPanel(false);
                  setMobileTab('planning', 'bottomnav');
                  window.scrollTo({ top: 0, behavior: "smooth" });
                },
              },
              {
                id: "track",
                icon: Activity,
                label: "Track",
                active: mobileTab === 'tracking' && !showSavedPlans && !showMetricsPanel,
                action: () => {
                  setShowSavedPlans(false);
                  setShowMetricsPanel(false);
                  setMobileTab('tracking', 'bottomnav');
                  window.scrollTo({ top: 0, behavior: "smooth" });
                },
              },
              {
                id: "log",
                icon: PenLine,
                label: "Log",
                active: showLogDrawer,
                action: () => {
                  setShowSavedPlans(false);
                  setShowMetricsPanel(false);
                  setShowLogDrawer(true);
                },
              },
              {
                id: "insights",
                icon: TrendingUp,
                label: "Insights",
                active: mobileTab === 'insights' && !showSavedPlans && !showMetricsPanel,
                action: () => {
                  setShowSavedPlans(false);
                  setShowMetricsPanel(false);
                  setMobileTab('insights', 'bottomnav');
                  window.scrollTo({ top: 0, behavior: "smooth" });
                },
              },
              {
                id: "settings",
                icon: Settings,
                label: "Settings",
                active: showMetricsPanel,
                action: handleOpenMetrics,
              },
            ].map(item => (
              <button
                key={item.id}
                onClick={item.action}
                data-testid={`mobile-nav-${item.id}`}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${item.active ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"}`}
              >
                <item.icon className={`w-5 h-5 ${item.active ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
                <span className={`text-[10px] font-medium ${item.active ? "text-zinc-900" : "text-zinc-400"}`}>
                  {item.label}
                </span>
                {item.active && (
                  <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-zinc-900" />
                )}
              </button>
            ))}
          </div>
        </nav>
      )}

      <FeedbackWidget />

      <AnimatePresence>
        {showOnboarding && (
          <OnboardingWizard
            userPrefs={userPrefs}
            onComplete={handleWizardComplete}
            onSkip={dismissOnboarding}
          />
        )}
        {showTour && (
          <OnboardingTour onDismiss={() => setShowTour(false)} />
        )}
      </AnimatePresence>

      {cycleStopConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setCycleStopConfirm(false)}
          data-testid="cycle-stop-overlay"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-zinc-900 mb-2">Stop cycle tracking?</h3>
            <p className="text-sm text-zinc-500 leading-relaxed mb-5">
              Your cycle data will be kept. You can re-enable cycle tracking anytime in Settings &rarr; Metrics.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCycleStopConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-700 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
                data-testid="button-cycle-stop-cancel"
              >
                Cancel
              </button>
              <button
                onClick={confirmStopCycleTracking}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 rounded-xl hover:bg-zinc-700 transition-colors"
                data-testid="button-cycle-stop-confirm"
              >
                Stop tracking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── My Diary Modal ─────────────────────────────────────────────────── */}
      <DiaryModal
        open={showDiaryModal}
        onClose={() => setShowDiaryModal(false)}
        calTarget={effectiveTargets?.dailyCalories ?? activeResult?.dailyCalories ?? undefined}
        protTarget={effectiveTargets?.proteinGoal ?? activeResult?.proteinGoal ?? undefined}
        carbsTarget={effectiveTargets?.carbsGoal ?? activeResult?.carbsGoal ?? undefined}
        fatTarget={effectiveTargets?.fatGoal ?? activeResult?.fatGoal ?? undefined}
      />

      {/* ── My Plans overlay ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSavedPlans && user && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[39] bg-black/20"
              onClick={() => setShowSavedPlans(false)}
            />
            {/* Panel — mobile: centered modal; desktop: drops down below header */}
            {isDesktop ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed z-40 left-0 right-0 top-16 max-h-[65vh] overflow-y-auto bg-white border-b border-zinc-200 shadow-2xl"
              >
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-zinc-900">Saved Plans</h2>
                        <p className="text-xs text-zinc-500">Your saved meal plans</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowSavedPlans(false)}
                      className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-600"
                      data-testid="button-close-saved-plans"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <SavedMealPlans onLogMeal={handleLogMeal} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed z-40 inset-x-4 top-[10%] bottom-[10%] max-w-lg mx-auto bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-zinc-100 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-zinc-100 rounded-lg text-zinc-600">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-zinc-900">Saved Plans</span>
                  </div>
                  <button
                    onClick={() => setShowSavedPlans(false)}
                    className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-600"
                    data-testid="button-close-saved-plans"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <SavedMealPlans onLogMeal={handleLogMeal} />
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* ── Global Log Drawer (triggered from mobile nav "Log" button) ───── */}
      {showLogDrawer && user && (
        <FoodLogDrawer
          open={showLogDrawer}
          onClose={() => setShowLogDrawer(false)}
          selectedDate={new Date().toISOString().split("T")[0]}
          dailyTargets={{
            calories: effectiveTargets?.dailyCalories ?? activeResult?.dailyCalories,
            protein: effectiveTargets?.proteinGoal ?? activeResult?.proteinGoal,
            carbs: effectiveTargets?.carbsGoal ?? activeResult?.carbsGoal,
            fat: effectiveTargets?.fatGoal ?? activeResult?.fatGoal,
          }}
        />
      )}

      <footer className="mt-8 pb-4 text-center">
        <p className="text-xs text-zinc-400" data-testid="text-dashboard-copyright">&copy; 2026 FuelU. All rights reserved.</p>
      </footer>

    </div>
  );
}
