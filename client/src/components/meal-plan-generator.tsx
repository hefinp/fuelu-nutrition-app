import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed, Loader2, X, Download, ShoppingCart, RefreshCw, Save, Check, ThumbsDown, ClipboardList, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Salad, ChefHat, Star, Circle, CalendarDays, AlertTriangle, Zap, Lock, ArrowRight, Trash2, Plus, Search, GripVertical, Copy, Move, Replace, Wand2, Coffee, Cookie, ArrowLeftRight, Timer, Moon, Shield, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserPreferences, SavedMealPlan } from "@shared/schema";
import { getCyclePhase } from "@/lib/cycle";
import type { Calculation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useActiveFlow } from "@/contexts/active-flow-context";
import { RECIPES } from "./results-recipes";
import { toDateStr, addDays, getMonday, formatShort, DAY_LABELS } from "./results-pdf";
import { exportMealPlanToPDF, exportShoppingListToPDF } from "./results-pdf";
import { SavedMealPlans } from "@/components/saved-meal-plans";
import type { PrefillEntry } from "@/components/food-log-shared";
import { isSlotPast, isDayPast } from "@/lib/mealTime";

export interface Meal {
  meal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  vitalityRationale?: string;
  ingredientsJson?: Array<{ name: string; grams: number; calories100g: number; protein100g?: number; carbs100g?: number; fat100g?: number }>;
}

interface DayMealPlan {
  breakfast: Meal[];
  lunch: Meal[];
  dinner: Meal[];
  snacks: Meal[];
  dayTotalCalories: number;
  dayTotalProtein: number;
  dayTotalCarbs: number;
  dayTotalFat: number;
}

type MealPlan = any;

function isSlotLockedForDates(slot: string, dates: string[]): boolean {
  if (dates.length === 0) return false;
  return dates.every(d => isSlotPast(d, slot));
}

export function MealPlanGenerator({ data, onLogMeal, overrideTargets }: { data: Calculation; onLogMeal?: (meal: Meal | PrefillEntry) => void; overrideTargets?: { dailyCalories?: number; proteinGoal?: number; carbsGoal?: number; fatGoal?: number } | null }) {
  const effectiveCals = overrideTargets?.dailyCalories ?? data.dailyCalories;
  const effectiveProtein = overrideTargets?.proteinGoal ?? data.proteinGoal;
  const effectiveCarbs = overrideTargets?.carbsGoal ?? data.carbsGoal;
  const effectiveFat = overrideTargets?.fatGoal ?? data.fatGoal;
  const { user } = useAuth();
  const isMealPremium = !!(user?.betaUser || (user?.tier && user.tier !== "free"));
  const [widgetMode, setWidgetMode] = useState<'generator' | 'custom'>(() => {
    const saved = localStorage.getItem('fuelr-widget-mode');
    return saved === 'custom' ? 'custom' : 'generator';
  });
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [planMode, setPlanMode] = useState<'daily' | 'weekly'>('daily');
  const [mealStyle, setMealStyle] = useState<'simple' | 'gourmet' | 'michelin'>('simple');
  const [shoppingDaysOpen, setShoppingDaysOpen] = useState(false);
  const [shoppingDaysInput, setShoppingDaysInput] = useState("7");
  const [planSaved, setPlanSaved] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([toDateStr(new Date())]);
  const [weekStart, setWeekStart] = useState<string>(getMonday(toDateStr(new Date())));
  const [ignoreCycle, setIgnoreCycle] = useState(false);
  const [customSlots, setCustomSlots] = useState<Record<string, Record<string, Meal[]>>>({});
  const [customPlanReady, setCustomPlanReady] = useState<MealPlan | null>(null);
  const [customPlanSaved, setCustomPlanSaved] = useState(false);
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [addMealPopover, setAddMealPopover] = useState<{ dayKey: string; slotKey: string } | null>(null);
  const [mealSearchQuery, setMealSearchQuery] = useState("");
  const [baseSlots, setBaseSlots] = useState<Set<string>>(new Set(['breakfast', 'lunch', 'dinner', 'snack']));
  const [replacePicker, setReplacePicker] = useState<{ dayKey: string; slotKey: string; mealIdx: number; context: 'generator' | 'custom' } | null>(null);
  const [replacePickerTab, setReplacePickerTab] = useState<'meals' | 'foods'>('meals');
  const [replaceSearchQuery, setReplaceSearchQuery] = useState("");
  const [addFoodForm, setAddFoodForm] = useState<{ name: string; calories: string; protein: string; carbs: string; fat: string } | null>(null);
  const [baseCustomSlots, setBaseCustomSlots] = useState<Set<string>>(new Set(['breakfast', 'lunch', 'dinner', 'snacks']));
  const [bannerCollapsed, setBannerCollapsed] = useState(false);
  const [showSavedPlansInline, setShowSavedPlansInline] = useState(false);
  const [dragSource, setDragSource] = useState<{ dayKey: string; slotKey: string; mealIdx: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ dayKey: string; slotKey: string } | null>(null);
  const [copyMovePopover, setCopyMovePopover] = useState<{ x: number; y: number; source: { dayKey: string; slotKey: string; mealIdx: number }; target: { dayKey: string; slotKey: string } } | null>(null);
  const [touchDragging, setTouchDragging] = useState<{ dayKey: string; slotKey: string; mealIdx: number; mealName: string } | null>(null);
  const [touchGhost, setTouchGhost] = useState<{ x: number; y: number } | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const slotRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setFlowActive } = useActiveFlow();

  const prevWeekRef = useRef(weekStart);
  useEffect(() => {
    if (prevWeekRef.current !== weekStart) {
      prevWeekRef.current = weekStart;
      const today = toDateStr(new Date());
      const firstValid = (() => {
        for (let i = 0; i < 7; i++) {
          const d = addDays(weekStart, i);
          if (d >= today) return d;
        }
        return today;
      })();
      setSelectedDates([firstValid]);
    }
  }, [weekStart]);

  const { data: mealPlanPrefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });

  const SLOT_HOURS: Record<string, number> = { breakfast: 8, lunch: 12, dinner: 19, snack: 15 };
  const fastingEnabled = !!(mealPlanPrefs?.fastingEnabled && mealPlanPrefs?.fastingProtocol);
  const fastingProtocol = mealPlanPrefs?.fastingProtocol;

  useEffect(() => {
    if (!mealPlanPrefs) return;
    const allSlots = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
    if (!mealPlanPrefs.fastingEnabled || !mealPlanPrefs.fastingProtocol) {
      setBaseSlots(allSlots);
      return;
    }
    const protocol = mealPlanPrefs.fastingProtocol;
    if (protocol === 'omad') {
      allSlots.delete('breakfast');
      allSlots.delete('snack');
    } else if (protocol === '5:2') {
      // 5:2 is day-specific; backend handles fasting days automatically
    } else {
      const wStart = mealPlanPrefs.eatingWindowStart ?? 12;
      const wEnd = mealPlanPrefs.eatingWindowEnd ?? 20;
      for (const [slot, hour] of Object.entries(SLOT_HOURS)) {
        const inWindow = wStart < wEnd ? (hour >= wStart && hour < wEnd) : (hour >= wStart || hour < wEnd);
        if (!inWindow) allSlots.delete(slot);
      }
    }
    setBaseSlots(allSlots);
  }, [mealPlanPrefs]);

  const toggleSlot = useCallback((slot: string) => {
    setBaseSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      return next;
    });
  }, []);

  const toggleCustomSlot = useCallback((slot: string) => {
    setBaseCustomSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      return next;
    });
  }, []);

  // Derived: apply time-locking on top of user/fasting intent
  const enabledSlots = useMemo(() => {
    if (planMode !== 'daily') return new Set(baseSlots);
    const next = new Set<string>();
    for (const slot of baseSlots) {
      if (!isSlotLockedForDates(slot, selectedDates)) next.add(slot);
    }
    return next;
  }, [baseSlots, selectedDates, planMode]);

  const customEnabledSlots = useMemo(() => {
    if (planMode !== 'daily') return new Set(baseCustomSlots);
    const next = new Set<string>();
    for (const slot of baseCustomSlots) {
      if (!isSlotLockedForDates(slot, selectedDates)) next.add(slot);
    }
    return next;
  }, [baseCustomSlots, selectedDates, planMode]);

  useEffect(() => {
    if (replacePicker) setReplacePickerTab('meals');
  }, [replacePicker]);

  const excludeSlotsArray = ['breakfast', 'lunch', 'dinner', 'snack'].filter(s => !enabledSlots.has(s));

  const generateMealPlan = useMutation({
    mutationFn: async (planType: 'daily' | 'weekly') => {
      const today = toDateStr(new Date());
      const validDates = selectedDates.filter(d => d >= today);
      if (planType === 'daily' && validDates.length === 0) {
        throw new Error("No future dates selected");
      }
      const res = await apiRequest('POST', '/api/meal-plans', {
        dailyCalories: effectiveCals,
        weeklyCalories: data.weeklyCalories,
        proteinGoal: effectiveProtein,
        carbsGoal: effectiveCarbs,
        fatGoal: effectiveFat,
        planType,
        mealStyle,
        calculationId: data.id,
        clientToday: today,
        ...(planType === 'daily' ? { targetDates: validDates } : { weekStartDate: weekStart }),
        ...(excludeSlotsArray.length > 0 ? { excludeSlots: excludeSlotsArray } : {}),
      });
      return await res.json();
    },
    onSuccess: (planData) => {
      setMealPlan(planData);
      setPlanSaved(false);
      setGeneratorModalOpen(true);
      setBannerCollapsed(true);
    },
    onError: (error: Error) => {
      let title = "Failed to generate meal plan";
      let description = "Something went wrong. Please try again.";
      try {
        const match = error.message.match(/^(\d+):\s*(.*)/s);
        if (match) {
          const status = parseInt(match[1], 10);
          const body = JSON.parse(match[2]);
          if (status === 403 && body.message) {
            title = "Plan upgrade required";
            description = body.message;
          } else if (body.message) {
            description = body.message;
          }
        }
      } catch {}
      toast({ title, description, variant: "destructive" });
    },
  });
  const hasCycleData = !!(mealPlanPrefs?.cycleTrackingEnabled && mealPlanPrefs?.lastPeriodDate && data.gender === "female");
  const cycleEnabledButMissing = !!(mealPlanPrefs?.cycleTrackingEnabled && !mealPlanPrefs?.lastPeriodDate && data.gender === "female");
  const hasVitalityBoost = !!(mealPlanPrefs?.vitalityInsightsEnabled && mealPlanPrefs?.hormoneBoostingMeals && data.gender === "male");
  const dailyRef = selectedDates[0] || toDateStr(new Date());
  const cycleInfo = hasCycleData
    ? getCyclePhase(mealPlanPrefs!.lastPeriodDate!, mealPlanPrefs!.cycleLength ?? 28, dailyRef)
    : null;
  const weekCycleInfo = hasCycleData
    ? getCyclePhase(mealPlanPrefs!.lastPeriodDate!, mealPlanPrefs!.cycleLength ?? 28, weekStart)
    : null;

  useEffect(() => {
    const isActive = generateMealPlan.isPending || mealPlan !== null || customModalOpen;
    setFlowActive("meal-plan", isActive);
    return () => setFlowActive("meal-plan", false);
  }, [generateMealPlan.isPending, mealPlan, customModalOpen, setFlowActive]);

  useEffect(() => {
    localStorage.setItem('fuelr-widget-mode', widgetMode);
  }, [widgetMode]);

  useEffect(() => {
    if (generatorModalOpen || customModalOpen) {
      document.body.style.overflow = 'hidden';
      const today = toDateStr(new Date());
      setSelectedDates(prev => {
        const valid = prev.filter(d => d >= today);
        return valid.length > 0 ? valid : [today];
      });
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [generatorModalOpen, customModalOpen]);

  const { data: userMealsData } = useQuery<{ items: any[] }>({
    queryKey: ["/api/user-meals"],
    enabled: widgetMode === "custom" || replacePicker !== null,
  });
  const filteredUserMeals = (userMealsData?.items ?? []).filter(m =>
    m.caloriesPerServing > 0 && (!mealSearchQuery || m.name.toLowerCase().includes(mealSearchQuery.toLowerCase()))
  );

  const { data: userFoodsData } = useQuery<{ items: any[] }>({
    queryKey: ["/api/my-foods"],
    enabled: replacePicker !== null,
  });
  const filteredUserFoods = (userFoodsData?.items ?? []).filter(f =>
    !replaceSearchQuery || f.name.toLowerCase().includes(replaceSearchQuery.toLowerCase())
  );

  const { data: savedPlans = [] } = useQuery<SavedMealPlan[]>({
    queryKey: ["/api/saved-meal-plans"],
    queryFn: async () => {
      const res = await fetch("/api/saved-meal-plans", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load saved plans");
      return res.json();
    },
  });

  const thisMonday = getMonday(toDateStr(new Date()));
  const nextMonday = addDays(thisMonday, 7);

  const findPlanForWeek = (monday: string): SavedMealPlan | null => {
    const sunday = addDays(monday, 6);
    const matches = savedPlans.filter(p => {
      const pd = p.planData as any;
      if (p.planType === 'weekly' && pd.weekStartDate) {
        return getMonday(pd.weekStartDate) === monday;
      }
      if (p.planType === 'daily' && pd.targetDate) {
        return pd.targetDate >= monday && pd.targetDate <= sunday;
      }
      if (pd.planType === 'multi-daily' && pd.days) {
        return Object.keys(pd.days).some((d: string) => d >= monday && d <= sunday);
      }
      if (pd.targetDates && Array.isArray(pd.targetDates)) {
        return pd.targetDates.some((d: string) => d >= monday && d <= sunday);
      }
      return false;
    });
    if (matches.length === 0) return null;
    return matches.reduce((latest, p) => {
      const la = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;
      const pa = p.createdAt ? new Date(p.createdAt).getTime() : 0;
      return pa > la ? p : latest;
    });
  };

  const thisWeekPlan = findPlanForWeek(thisMonday);
  const nextWeekPlan = findPlanForWeek(nextMonday);

  const getCustomDayKeys = useCallback(() => {
    if (planMode === 'weekly') {
      return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    }
    return selectedDates.length > 0 ? selectedDates : [toDateStr(new Date())];
  }, [planMode, selectedDates]);

  const addMealToSlot = useCallback((dayKey: string, slotKey: string, userMeal: any) => {
    const meal: Meal = {
      meal: userMeal.name,
      calories: userMeal.caloriesPerServing,
      protein: userMeal.proteinPerServing,
      carbs: userMeal.carbsPerServing,
      fat: userMeal.fatPerServing,
    };
    setCustomSlots(prev => {
      const day = { ...(prev[dayKey] || {}) };
      day[slotKey] = [...(day[slotKey] || []), meal];
      return { ...prev, [dayKey]: day };
    });
    setAddMealPopover(null);
    setMealSearchQuery("");
    setCustomPlanReady(null);
    setCustomPlanSaved(false);
  }, []);

  const removeMealFromSlot = useCallback((dayKey: string, slotKey: string, idx: number) => {
    setCustomSlots(prev => {
      const day = { ...(prev[dayKey] || {}) };
      const arr = [...(day[slotKey] || [])];
      arr.splice(idx, 1);
      day[slotKey] = arr;
      return { ...prev, [dayKey]: day };
    });
    setCustomPlanReady(null);
    setCustomPlanSaved(false);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, dayKey: string, slotKey: string, mealIdx: number) => {
    setDragSource({ dayKey, slotKey, mealIdx });
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', '');
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dayKey: string, slotKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropTarget({ dayKey, slotKey });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dayKey: string, slotKey: string) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragSource) return;
    if (dragSource.dayKey === dayKey && dragSource.slotKey === slotKey) {
      setDragSource(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCopyMovePopover({
      x: rect.left + rect.width / 2,
      y: rect.top,
      source: dragSource,
      target: { dayKey, slotKey },
    });
    setDragSource(null);
  }, [dragSource]);

  const executeCopyMove = useCallback((action: 'copy' | 'move') => {
    if (!copyMovePopover) return;
    const { source, target } = copyMovePopover;
    setCustomSlots(prev => {
      const updated = { ...prev };
      const sourceDay = { ...(updated[source.dayKey] || {}) };
      const sourceSlotArr = [...(sourceDay[source.slotKey] || [])];
      const meal = sourceSlotArr[source.mealIdx];
      if (!meal) { setCopyMovePopover(null); return prev; }
      const targetDay = { ...(updated[target.dayKey] || {}) };
      targetDay[target.slotKey] = [...(targetDay[target.slotKey] || []), { ...meal }];
      updated[target.dayKey] = targetDay;
      if (action === 'move') {
        sourceSlotArr.splice(source.mealIdx, 1);
        sourceDay[source.slotKey] = sourceSlotArr;
        updated[source.dayKey] = sourceDay;
      }
      return updated;
    });
    setCopyMovePopover(null);
    setCustomPlanReady(null);
    setCustomPlanSaved(false);
  }, [copyMovePopover]);

  const executeReplace = useCallback(() => {
    if (!copyMovePopover) return;
    const { source, target } = copyMovePopover;
    setCustomSlots(prev => {
      const updated = { ...prev };
      const sourceDay = { ...(updated[source.dayKey] || {}) };
      const sourceSlotArr = [...(sourceDay[source.slotKey] || [])];
      const meal = sourceSlotArr[source.mealIdx];
      if (!meal) { setCopyMovePopover(null); return prev; }
      const targetDay = { ...(updated[target.dayKey] || {}) };
      targetDay[target.slotKey] = [{ ...meal }];
      updated[target.dayKey] = targetDay;
      return updated;
    });
    setCopyMovePopover(null);
    setCustomPlanReady(null);
    setCustomPlanSaved(false);
  }, [copyMovePopover]);

  const registerSlotRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) slotRefsMap.current.set(key, el);
    else slotRefsMap.current.delete(key);
  }, []);

  const findSlotAtPoint = useCallback((x: number, y: number): { dayKey: string; slotKey: string; el: HTMLDivElement } | null => {
    for (const [key, el] of slotRefsMap.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const [dayKey, slotKey] = key.split('::');
        return { dayKey, slotKey, el };
      }
    }
    return null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, dayKey: string, slotKey: string, mealIdx: number, mealName: string) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchTimerRef.current = setTimeout(() => {
      setTouchDragging({ dayKey, slotKey, mealIdx, mealName });
      setTouchGhost({ x: touch.clientX, y: touch.clientY });
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touchTimerRef.current && touchStartRef.current) {
      const dx = Math.abs(touch.clientX - touchStartRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartRef.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
    if (!touchDragging) return;
    e.preventDefault();
    setTouchGhost({ x: touch.clientX, y: touch.clientY });
    const hit = findSlotAtPoint(touch.clientX, touch.clientY);
    if (hit && !(hit.dayKey === touchDragging.dayKey && hit.slotKey === touchDragging.slotKey)) {
      setDropTarget({ dayKey: hit.dayKey, slotKey: hit.slotKey });
    } else {
      setDropTarget(null);
    }
  }, [touchDragging, findSlotAtPoint]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    if (!touchDragging) return;
    const touch = e.changedTouches[0];
    const hit = findSlotAtPoint(touch.clientX, touch.clientY);
    const source = { dayKey: touchDragging.dayKey, slotKey: touchDragging.slotKey, mealIdx: touchDragging.mealIdx };
    setTouchDragging(null);
    setTouchGhost(null);
    setDropTarget(null);
    if (hit && !(hit.dayKey === source.dayKey && hit.slotKey === source.slotKey)) {
      const rect = hit.el.getBoundingClientRect();
      setCopyMovePopover({
        x: rect.left + rect.width / 2,
        y: rect.top,
        source,
        target: { dayKey: hit.dayKey, slotKey: hit.slotKey },
      });
    }
  }, [touchDragging, findSlotAtPoint]);

  useEffect(() => {
    return () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    };
  }, []);

  const getDayNutrition = useCallback((dayKey: string) => {
    const day = customSlots[dayKey];
    if (!day) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    for (const slotMeals of Object.values(day)) {
      for (const m of slotMeals) {
        calories += m.calories;
        protein += m.protein;
        carbs += m.carbs;
        fat += m.fat;
      }
    }
    return { calories, protein, carbs, fat };
  }, [customSlots]);

  const autofillMutation = useMutation({
    mutationFn: async () => {
      const dayKeys = getCustomDayKeys();
      const allSlotKeys = ['breakfast', 'lunch', 'dinner', 'snacks'];
      const userExcludeSlots = allSlotKeys.filter(s => !customEnabledSlots.has(s));

      const slots: Record<string, Record<string, Meal[]>> = {};
      for (const dk of dayKeys) {
        const daySlots = customSlots[dk] || {};
        const dayDateStr = planMode === 'weekly'
          ? addDays(weekStart, dayKeys.indexOf(dk))
          : dk;
        const pastSlotKeys = allSlotKeys.filter(sk => isSlotPast(dayDateStr, sk));
        const filledSlots: Record<string, Meal[]> = {};
        for (const sk of allSlotKeys) {
          filledSlots[sk] = daySlots[sk] || [];
        }
        for (const psk of pastSlotKeys) {
          if (!filledSlots[psk]?.length) {
            filledSlots[psk] = [{
              meal: '__past__',
              calories: 0, protein: 0, carbs: 0, fat: 0,
            }];
          }
        }
        slots[dk] = filledSlots;
      }

      const res = await apiRequest('POST', '/api/meal-plans/autofill', {
        dailyCalories: effectiveCals,
        proteinGoal: effectiveProtein,
        carbsGoal: effectiveCarbs,
        fatGoal: effectiveFat,
        mealStyle,
        slots,
        planType: planMode,
        clientToday: toDateStr(new Date()),
        ...(planMode === 'daily' ? { targetDate: dayKeys[0] } : { weekStartDate: weekStart }),
        ...(userExcludeSlots.length > 0 ? { excludeSlots: userExcludeSlots } : {}),
      });
      return await res.json();
    },
    onSuccess: (planData) => {
      const slotKeys = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
      const mapMeals = (arr: any[]) => arr
        .filter((m: any) => m.meal !== '__past__')
        .map((m: any) => ({
          meal: m.meal, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat,
          ...(m.ingredientsJson ? { ingredientsJson: m.ingredientsJson } : {}),
        }));

      setCustomSlots(prev => {
        const merged = { ...prev };

        if (planData.planType === 'weekly') {
          const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          for (const dayName of weekDays) {
            const dayPlan = planData[dayName];
            if (!dayPlan) continue;
            merged[dayName] = { ...(merged[dayName] || {}) };
            for (const sk of slotKeys) {
              merged[dayName][sk] = mapMeals(dayPlan[sk] || []);
            }
          }
        } else {
          const dayKeys = getCustomDayKeys();
          const dayKey = dayKeys[0];
          merged[dayKey] = { ...(merged[dayKey] || {}) };
          for (const sk of slotKeys) {
            merged[dayKey][sk] = mapMeals(planData[sk] || []);
          }
        }

        return merged;
      });
      setCustomPlanSaved(false);
      setBannerCollapsed(true);
      toast({ title: "Slots filled", description: "Empty slots have been filled. You can still edit before saving." });
    },
    onError: () => {
      toast({ title: "Autofill failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const buildPlanFromSlots = useCallback(() => {
    const slotKeys = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
    const dayKeys = getCustomDayKeys();

    if (planMode === 'weekly') {
      const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const plan: Record<string, any> = { planType: 'weekly', weekStartDate: weekStart };
      let weekTotalCalories = 0, weekTotalProtein = 0, weekTotalCarbs = 0, weekTotalFat = 0;
      for (const dayName of weekDays) {
        const daySlots = customSlots[dayName] || {};
        const dayPlan: Record<string, any> = {};
        for (const sk of slotKeys) dayPlan[sk] = daySlots[sk] || [];
        const allMeals = slotKeys.flatMap(s => dayPlan[s]);
        dayPlan.dayTotalCalories = allMeals.reduce((sum, m) => sum + m.calories, 0);
        dayPlan.dayTotalProtein = allMeals.reduce((sum, m) => sum + m.protein, 0);
        dayPlan.dayTotalCarbs = allMeals.reduce((sum, m) => sum + m.carbs, 0);
        dayPlan.dayTotalFat = allMeals.reduce((sum, m) => sum + m.fat, 0);
        plan[dayName] = dayPlan;
        weekTotalCalories += dayPlan.dayTotalCalories;
        weekTotalProtein += dayPlan.dayTotalProtein;
        weekTotalCarbs += dayPlan.dayTotalCarbs;
        weekTotalFat += dayPlan.dayTotalFat;
      }
      plan.weekTotalCalories = weekTotalCalories;
      plan.weekTotalProtein = weekTotalProtein;
      plan.weekTotalCarbs = weekTotalCarbs;
      plan.weekTotalFat = weekTotalFat;
      return plan;
    } else {
      const dayKey = dayKeys[0];
      const daySlots = customSlots[dayKey] || {};
      const plan: Record<string, any> = { planType: 'daily' };
      for (const sk of slotKeys) plan[sk] = daySlots[sk] || [];
      const allMeals = slotKeys.flatMap(s => plan[s]);
      plan.dayTotalCalories = allMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
      plan.dayTotalProtein = allMeals.reduce((sum: number, m: any) => sum + m.protein, 0);
      plan.dayTotalCarbs = allMeals.reduce((sum: number, m: any) => sum + m.carbs, 0);
      plan.dayTotalFat = allMeals.reduce((sum: number, m: any) => sum + m.fat, 0);
      if (dayKey) plan.targetDate = dayKey;
      return plan;
    }
  }, [customSlots, getCustomDayKeys, planMode, weekStart]);

  const customSavePlanMutation = useMutation({
    mutationFn: async () => {
      const planData = buildPlanFromSlots();
      const planTypeLabel = planData.planType === 'weekly' ? 'Custom Weekly' : 'Custom Daily';
      const dateLabel = planData.planType === 'weekly'
        ? ` (${formatShort(weekStart)} – ${formatShort(addDays(weekStart, 6))})`
        : selectedDates.length === 1
          ? ` (${formatShort(selectedDates[0])})`
          : '';
      const res = await apiRequest('POST', '/api/saved-meal-plans', {
        planData,
        planType: planData.planType === 'weekly' ? 'weekly' : 'daily',
        mealStyle,
        calculationId: data.id,
        name: `${planTypeLabel} Plan${dateLabel}`,
      });
      return await res.json();
    },
    onSuccess: () => {
      setCustomPlanSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      toast({ title: "Custom plan saved", description: "Meals added to your food log as planned entries." });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    },
  });

  const customHasAnyMeals = Object.values(customSlots).some(day => Object.values(day).some(arr => arr.length > 0));

  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (!mealPlan) throw new Error("No plan to save");
      const planTypeLabel = mealPlan.planType === 'weekly' ? 'Weekly' : 'Daily';
      const dateLabel = mealPlan.planType === 'weekly'
        ? ` (${formatShort(weekStart)} – ${formatShort(addDays(weekStart, 6))})`
        : selectedDates.length === 1
          ? ` (${formatShort(selectedDates[0])})`
          : ` (${formatShort(selectedDates[0])} +${selectedDates.length - 1})`;
      const savePlanData: Record<string, any> = { ...mealPlan };
      if (mealPlanPrefs?.cycleTrackingEnabled && data.gender === "female") {
        savePlanData.cycleOptimised = hasCycleData && !ignoreCycle;
      }
      const res = await apiRequest('POST', '/api/saved-meal-plans', {
        planData: savePlanData,
        planType: mealPlan.planType === 'multi-daily' ? 'daily' : mealPlan.planType,
        mealStyle,
        calculationId: data.id,
        name: `${planTypeLabel} Plan${dateLabel}`,
      });
      return await res.json();
    },
    onSuccess: () => {
      setPlanSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      toast({ title: "Plan saved", description: "Meals added to your food log as planned entries." });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    },
  });

  const replaceMealMutation = useMutation({
    mutationFn: async ({ slot, currentMealName, targetDate }: { slot: string; currentMealName: string; targetDate?: string }) => {
      const res = await apiRequest('POST', '/api/meal-plans/replace-meal', {
        slot,
        mealStyle,
        dailyCalories: effectiveCals,
        proteinGoal: effectiveProtein,
        carbsGoal: effectiveCarbs,
        fatGoal: effectiveFat,
        currentMealName,
        ...(targetDate ? { targetDate } : {}),
      });
      return { slot, meal: await res.json() };
    },
    onError: () => {
      toast({ title: "Replace failed", description: "Could not find an alternative meal. Try again.", variant: "destructive" });
    },
  });

  const recalcDayTotals = (dayPlan: any) => {
    const all = [...(dayPlan.breakfast || []), ...(dayPlan.lunch || []), ...(dayPlan.dinner || []), ...(dayPlan.snacks || [])];
    dayPlan.dayTotalCalories = all.reduce((s: number, m: any) => s + m.calories, 0);
    dayPlan.dayTotalProtein = all.reduce((s: number, m: any) => s + m.protein, 0);
    dayPlan.dayTotalCarbs = all.reduce((s: number, m: any) => s + m.carbs, 0);
    dayPlan.dayTotalFat = all.reduce((s: number, m: any) => s + m.fat, 0);
  };

  const recalcWeekTotals = (plan: any) => {
    const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let wCal = 0, wPro = 0, wCarb = 0, wFat = 0;
    for (const d of weekDays) {
      if (plan[d]) { wCal += plan[d].dayTotalCalories || 0; wPro += plan[d].dayTotalProtein || 0; wCarb += plan[d].dayTotalCarbs || 0; wFat += plan[d].dayTotalFat || 0; }
    }
    plan.weekTotalCalories = wCal; plan.weekTotalProtein = wPro; plan.weekTotalCarbs = wCarb; plan.weekTotalFat = wFat;
  };

  const handleLibraryReplace = useCallback((item: { name: string; calories: number; protein: number; carbs: number; fat: number }) => {
    if (!replacePicker) return;
    const { dayKey, slotKey, mealIdx, context } = replacePicker;
    const newMeal: Meal = { meal: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat };
    if (context === 'generator') {
      if (!mealPlan) return;
      setMealPlan((prev: any) => {
        if (!prev) return prev;
        const plan = JSON.parse(JSON.stringify(prev));
        const backendSlotKey = slotKey === 'snack' ? 'snacks' : slotKey;
        if (plan.planType === 'weekly') {
          const dayPlan = plan[dayKey];
          if (dayPlan?.[backendSlotKey]) { dayPlan[backendSlotKey][mealIdx] = newMeal; recalcDayTotals(dayPlan); recalcWeekTotals(plan); }
        } else if (plan.planType === 'multi-daily') {
          const dayPlan = plan.days?.[dayKey];
          if (dayPlan?.[backendSlotKey]) { dayPlan[backendSlotKey][mealIdx] = newMeal; recalcDayTotals(dayPlan); }
        } else {
          if (plan[backendSlotKey]) { plan[backendSlotKey][mealIdx] = newMeal; recalcDayTotals(plan); }
        }
        return plan;
      });
      setPlanSaved(false);
    } else if (context === 'custom') {
      const customSlotKey = slotKey === 'snack' ? 'snacks' : slotKey;
      setCustomSlots(prev => {
        const day = { ...(prev[dayKey] || {}) };
        const arr = [...(day[customSlotKey] || [])];
        if (mealIdx < arr.length) { arr[mealIdx] = newMeal; }
        day[customSlotKey] = arr;
        return { ...prev, [dayKey]: day };
      });
      setCustomPlanReady(null);
      setCustomPlanSaved(false);
    }
    setReplacePicker(null);
    setReplaceSearchQuery("");
    setAddFoodForm(null);
    toast({ title: "Meal replaced", description: `Swapped with ${item.name}` });
  }, [replacePicker, mealPlan, toast]);

  const generatorPlanTitle = mealPlan
    ? `${mealPlan.planType === 'multi-daily' ? 'Multi-Day' : mealPlan.planType === 'weekly' ? 'Weekly' : 'Daily'} Meal Plan`
    : '';

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
          <UtensilsCrossed className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-display font-bold text-zinc-900">Meal Planning</h2>
      </div>

      <div className="flex bg-zinc-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => { setWidgetMode("generator"); }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${widgetMode === "generator" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
          data-testid="button-tab-generator"
        >
          Generator
        </button>
        <button
          onClick={() => { setWidgetMode("custom"); }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${widgetMode === "custom" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
          data-testid="button-tab-custom"
        >
          Custom
        </button>
      </div>

      <button
        onClick={() => { setBannerCollapsed(false); widgetMode === "generator" ? setGeneratorModalOpen(true) : setCustomModalOpen(true); }}
        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-semibold text-sm transition-colors"
        data-testid="button-launch-planner"
      >
        {widgetMode === "generator" ? (
          <><UtensilsCrossed className="w-4 h-4" /> Generate Plan</>
        ) : (
          <><ClipboardList className="w-4 h-4" /> Create Plan</>
        )}
      </button>

      {savedPlans.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4" data-testid="saved-plan-shortcuts">
          {([
            { label: 'This Week', plan: thisWeekPlan, monday: thisMonday, testId: 'shortcut-this-week' },
            { label: 'Next Week', plan: nextWeekPlan, monday: nextMonday, testId: 'shortcut-next-week' },
          ] as const).map(({ label, plan, monday, testId }) => {
            const sundayStr = formatShort(addDays(monday, 6));
            const mondayStr = formatShort(monday);
            const pd = plan?.planData as any;
            const cals = pd
              ? (pd.weekTotalCalories
                  ? `${Math.round(pd.weekTotalCalories / 7).toLocaleString()} kcal/day`
                  : pd.dayTotalCalories
                    ? `${pd.dayTotalCalories.toLocaleString()} kcal`
                    : null)
              : null;
            return (
              <div
                key={testId}
                onClick={() => {
                  const btn = document.querySelector('[data-testid="button-saved-plans"]') as HTMLButtonElement | null;
                  if (btn) btn.click();
                }}
                className={`rounded-xl border p-3 transition-colors cursor-pointer ${
                  plan
                    ? 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'
                    : 'bg-zinc-50/50 border-zinc-100 hover:bg-zinc-50'
                }`}
                data-testid={testId}
              >
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-[10px] text-zinc-400 mb-1.5">{mondayStr} – {sundayStr}</p>
                {plan ? (
                  <>
                    <p className="text-xs font-medium text-zinc-800 truncate" data-testid={`${testId}-name`}>
                      <CalendarDays className="w-3 h-3 inline mr-1 text-zinc-400" />
                      {plan.name}
                    </p>
                    {cals && (
                      <p className="text-[10px] text-zinc-500 mt-0.5" data-testid={`${testId}-cals`}>{cals}</p>
                    )}
                  </>
                ) : (
                  <p className="text-[10px] text-zinc-400 italic">No plan yet</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <button
          onClick={() => setShowSavedPlansInline(v => !v)}
          className="w-full flex flex-col items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
          data-testid="button-toggle-saved-plans-inline"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            My saved plans
          </div>
          {showSavedPlansInline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <AnimatePresence>
          {showSavedPlansInline && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mt-4"
            >
              <SavedMealPlans onLogMeal={onLogMeal} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {generatorModalOpen && (
          <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setGeneratorModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.25 }}
              className="bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:mx-4 flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-white border-b border-zinc-100 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-display font-bold text-zinc-900 capitalize" data-testid="text-modal-plan-title">
                    {mealPlan ? generatorPlanTitle : `${planMode === 'weekly' ? 'Weekly' : 'Daily'} Meal Plan`}
                  </h3>
                  {mealPlan ? (
                    <>
                      {mealPlan.planType === 'weekly' && (mealPlan as any).weekStartDate && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          <CalendarDays className="w-3 h-3 inline mr-1" />
                          {formatShort((mealPlan as any).weekStartDate)} – {formatShort(addDays((mealPlan as any).weekStartDate, 6))}
                        </p>
                      )}
                      {(mealPlan.planType === 'daily' || mealPlan.planType === 'multi-daily') && selectedDates.length > 0 && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          <CalendarDays className="w-3 h-3 inline mr-1" />
                          {selectedDates.length === 1
                            ? formatShort(selectedDates[0])
                            : `${formatShort(selectedDates[0])} + ${selectedDates.length - 1} more`}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-zinc-400 mt-0.5">Pick your schedule, then generate</p>
                  )}
                </div>
                <button
                  onClick={() => setGeneratorModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                  data-testid="button-close-generator-modal"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="bg-zinc-50 border-b border-zinc-100 shrink-0">
                <div className={`transition-all duration-300 ease-in-out overflow-hidden sm:!max-h-none ${bannerCollapsed ? 'max-h-0' : 'max-h-[500px]'}`}>
                  <div className="px-4 sm:px-6 py-3">
                    <div className="relative bg-zinc-100 rounded-xl p-0.5 flex items-stretch mb-2" data-testid="plan-type-toggle">
                      <div
                        className="absolute top-0.5 bottom-0.5 rounded-lg bg-white shadow transition-all duration-300 ease-out"
                        style={{ width: `calc((100% - 4px) / 2)`, left: planMode === 'daily' ? '2px' : `calc(2px + (100% - 4px) / 2)` }}
                      />
                      {([
                        { key: 'daily' as const, label: 'Daily' },
                        { key: 'weekly' as const, label: 'Weekly' },
                      ]).map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          data-testid={`toggle-plan-type-${opt.key}`}
                          onClick={() => { setPlanMode(opt.key); setMealPlan(null); }}
                          className={`relative z-10 flex-1 py-1 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                            planMode === opt.key ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <DateRangePicker
                      weekStart={weekStart}
                      onWeekChange={(dir) => setWeekStart(prev => addDays(prev, dir))}
                      planMode={planMode}
                      selectedDates={selectedDates}
                      onToggleDate={(dateStr) => {
                        setSelectedDates(prev => {
                          const without = prev.filter(d => d !== dateStr);
                          return prev.includes(dateStr) && without.length > 0 ? without : [...prev.filter(d => d !== dateStr), dateStr].sort();
                        });
                      }}
                    />

                    <div className="mt-3">
                      <div className="flex justify-center gap-2.5 sm:gap-3">
                        {([
                          { key: 'breakfast', label: 'Breakfast', icon: Coffee },
                          { key: 'lunch', label: 'Lunch', icon: UtensilsCrossed },
                          { key: 'dinner', label: 'Dinner', icon: ChefHat },
                          { key: 'snack', label: 'Snacks', icon: Cookie },
                        ] as const).map(({ key, label, icon: Icon }) => {
                          const active = enabledSlots.has(key);
                          const locked = planMode === 'daily' && isSlotLockedForDates(key, selectedDates);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => { if (!locked) toggleSlot(key); }}
                              disabled={locked}
                              className={`flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-medium transition-all ${
                                locked
                                  ? 'bg-zinc-100 text-zinc-300 opacity-50 cursor-not-allowed'
                                  : active
                                    ? 'bg-zinc-900 text-white shadow-sm'
                                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                              }`}
                              data-testid={`toggle-slot-${key}`}
                            >
                              {locked ? <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {excludeSlotsArray.length > 0 && (
                        <p className="text-[10px] text-zinc-400 mt-1.5 text-center">
                          {excludeSlotsArray.map(s => s === 'snack' ? 'Snacks' : s.charAt(0).toUpperCase() + s.slice(1)).join(', ')} will be skipped
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setBannerCollapsed(prev => !prev)}
                  className="w-full flex items-center justify-center py-1 sm:hidden"
                  data-testid="button-toggle-generator-banner"
                >
                  {bannerCollapsed ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronUp className="w-4 h-4 text-zinc-400" />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Meal Style</p>
                  {(() => {
                    const styles = [
                      { key: 'simple' as const,  icon: Salad,   label: 'Simple' },
                      { key: 'gourmet' as const, icon: ChefHat, label: 'Fancy' },
                      { key: 'michelin' as const,icon: Star,    label: 'Michelin' },
                    ];
                    const idx = styles.findIndex(s => s.key === mealStyle);
                    const descriptions: Record<string, string> = {
                      simple:  'Quick, clean meals — ideal for busy weeks.',
                      gourmet: 'Bold flavours and restaurant-style dishes.',
                      michelin:'Fine-dining tasting menus — truffle, Wagyu and more.',
                    };
                    return (
                      <>
                        <div className="relative bg-zinc-100 rounded-xl p-0.5 flex items-stretch" data-testid="meal-style-scale">
                          <div
                            className="absolute top-0.5 bottom-0.5 rounded-lg bg-white shadow transition-all duration-300 ease-out"
                            style={{ width: `calc((100% - 4px) / 3)`, left: `calc(2px + ${idx} * (100% - 4px) / 3)` }}
                          />
                          {styles.map((style) => (
                            <button
                              key={style.key}
                              type="button"
                              data-testid={`toggle-meal-style-${style.key}`}
                              onClick={() => { setMealStyle(style.key); setMealPlan(null); }}
                              className={`relative z-10 flex-1 flex flex-col items-center gap-0.5 sm:gap-1 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors duration-200 ${
                                mealStyle === style.key ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                              }`}
                            >
                              <style.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span>{style.label}</span>
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] sm:text-xs text-zinc-400 mt-2">{descriptions[mealStyle]}</p>
                      </>
                    );
                  })()}
                </div>

                {cycleEnabledButMissing && !ignoreCycle && (
                  <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 mb-2" data-testid="callout-cycle-missing">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-amber-800">
                        Cycle tracking is on, but your last period date isn't set — plans won't be cycle-optimised.
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById("cycle-tracker-widget");
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                          className="text-[11px] font-medium text-amber-800 hover:text-amber-950 underline underline-offset-2 transition-colors"
                          data-testid="link-go-to-cycle-tracker"
                        >
                          Go to Cycle Tracker
                        </button>
                        <span className="text-amber-300">|</span>
                        <button
                          type="button"
                          onClick={() => setIgnoreCycle(true)}
                          className="text-[11px] font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
                          data-testid="button-ignore-cycle"
                        >
                          Ignore cycle tracking for now
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {planMode === 'daily' && cycleInfo && (
                  <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border mb-2 ${cycleInfo.bgClass} ${cycleInfo.borderClass}`}>
                    <Circle className={`w-3.5 h-3.5 flex-shrink-0 ${cycleInfo.colorClass}`} />
                    <p className={`text-xs font-medium ${cycleInfo.textClass}`}>
                      {cycleInfo.name} phase · Day {cycleInfo.day} · {cycleInfo.shortTip}
                    </p>
                  </div>
                )}
                {planMode === 'weekly' && weekCycleInfo && (
                  <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border mb-2 ${weekCycleInfo.bgClass} ${weekCycleInfo.borderClass}`}>
                    <Circle className={`w-3 h-3 flex-shrink-0 ${weekCycleInfo.colorClass}`} />
                    <p className={`text-xs ${weekCycleInfo.textClass}`}>
                      {weekCycleInfo.name} phase from {formatShort(weekStart)} · {weekCycleInfo.shortTip}
                    </p>
                  </div>
                )}

                {mealPlanPrefs?.vitalityInsightsEnabled && data.gender === "male" && (
                  isMealPremium ? (
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 mb-2" data-testid="vitality-hormone-boost-toggle">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-amber-800">Hormone-boosting meals</p>
                          <p className="text-[10px] text-amber-600">Prioritise zinc, magnesium, vitamin D-rich foods</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest("PUT", "/api/user/preferences", {
                            ...mealPlanPrefs,
                            hormoneBoostingMeals: !mealPlanPrefs?.hormoneBoostingMeals,
                          });
                          queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
                        }}
                        className={`w-10 h-6 rounded-full transition-colors shrink-0 ml-3 ${mealPlanPrefs?.hormoneBoostingMeals ? "bg-amber-500" : "bg-zinc-200"}`}
                        data-testid="button-toggle-hormone-boost"
                      >
                        <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${mealPlanPrefs?.hormoneBoostingMeals ? "translate-x-5" : "translate-x-1"}`} />
                      </button>
                    </div>
                  ) : (
                    <Link href="/pricing">
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 mb-2 cursor-pointer hover:bg-zinc-100 transition-colors" data-testid="vitality-hormone-boost-locked">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-zinc-600">Hormone-boosting meals</p>
                            <p className="text-[10px] text-zinc-400">Available on Simple and above</p>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                    </Link>
                  )
                )}

                {!mealPlan ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                      <UtensilsCrossed className="w-7 h-7 text-zinc-400" />
                    </div>
                    <p className="text-sm text-zinc-500 mb-5 max-w-xs">
                      Choose your week, days, and meals above, then hit generate.
                    </p>

                    {(fastingEnabled || hasCycleData || hasVitalityBoost) && (
                      <div className="flex flex-wrap justify-center gap-2 mb-5">
                        {fastingEnabled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-100" data-testid="badge-fasting">
                            <Timer className="w-3 h-3" />
                            {fastingProtocol?.toUpperCase()} fasting
                          </span>
                        )}
                        {hasCycleData && !ignoreCycle && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-50 text-pink-700 text-[10px] font-medium border border-pink-100" data-testid="badge-cycle">
                            <Moon className="w-3 h-3" />
                            Cycle-optimised
                          </span>
                        )}
                        {hasVitalityBoost && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-100" data-testid="badge-vitality">
                            <Shield className="w-3 h-3" />
                            Vitality boost
                          </span>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => generateMealPlan.mutate(planMode)}
                      disabled={generateMealPlan.isPending || enabledSlots.size === 0}
                      className="flex items-center justify-center gap-2 px-8 py-3 bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-sm transition-colors"
                      data-testid="button-generate-plan"
                    >
                      {generateMealPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UtensilsCrossed className="w-4 h-4" />}
                      {generateMealPlan.isPending ? 'Generating…' : 'Generate Plan'}
                    </button>
                  </div>
                ) : mealPlan.planType === 'multi-daily' ? (
                  <div className="space-y-6">
                    {(mealPlan as any).targetDates?.map((dateStr: string) => {
                      const dayPlan = (mealPlan as any).days?.[dateStr];
                      if (!dayPlan) return null;
                      const [y, m, d] = dateStr.split("-").map(Number);
                      const dateLabel = new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                      return (
                        <div key={dateStr}>
                          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {dateLabel}
                          </p>
                          <DailyMealView
                            plan={{ ...dayPlan, planType: 'daily' }}
                            onLogMeal={onLogMeal}
                            onReplaceFromLibrary={(slot, idx) => setReplacePicker({ dayKey: dateStr, slotKey: slot === 'snacks' ? 'snack' : slot, mealIdx: idx, context: 'generator' })}
                            onReplace={(slot, mealName, idx) => {
                              replaceMealMutation.mutate({ slot, currentMealName: mealName, targetDate: dateStr }, {
                                onSuccess: ({ slot: s, meal: newMeal }) => {
                                  setMealPlan((prev: any) => {
                                    if (!prev) return prev;
                                    const key = s === 'snack' ? 'snacks' : s;
                                    const updatedDay = { ...prev.days[dateStr] };
                                    const arr = [...(updatedDay[key] || [])];
                                    arr[idx] = newMeal;
                                    updatedDay[key] = arr;
                                    const allMeals = [...updatedDay.breakfast, ...updatedDay.lunch, ...updatedDay.dinner, ...updatedDay.snacks];
                                    updatedDay.dayTotalCalories = allMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
                                    return { ...prev, days: { ...prev.days, [dateStr]: updatedDay } };
                                  });
                                  setPlanSaved(false);
                                },
                              });
                            }}
                            replacingSlot={replaceMealMutation.isPending ? replaceMealMutation.variables?.slot : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : mealPlan.planType === 'daily' ? (
                  <DailyMealView
                    plan={mealPlan}
                    onLogMeal={onLogMeal}
                    onReplaceFromLibrary={(slot, idx) => setReplacePicker({ dayKey: '__daily__', slotKey: slot === 'snacks' ? 'snack' : slot, mealIdx: idx, context: 'generator' })}
                    onReplace={(slot, mealName, idx) => {
                      const dailyTargetDate = (mealPlan as any).targetDate;
                      replaceMealMutation.mutate({ slot, currentMealName: mealName, ...(dailyTargetDate ? { targetDate: dailyTargetDate } : {}) }, {
                        onSuccess: ({ slot: s, meal: newMeal }) => {
                          setMealPlan((prev: any) => {
                            if (!prev) return prev;
                            const key = s === 'snack' ? 'snacks' : s;
                            const updated = { ...prev };
                            const arr = [...(updated[key] || [])];
                            arr[idx] = newMeal;
                            updated[key] = arr;
                            const allMeals = [...updated.breakfast, ...updated.lunch, ...updated.dinner, ...updated.snacks];
                            updated.dayTotalCalories = allMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
                            updated.dayTotalProtein = allMeals.reduce((sum: number, m: any) => sum + m.protein, 0);
                            updated.dayTotalCarbs = allMeals.reduce((sum: number, m: any) => sum + m.carbs, 0);
                            updated.dayTotalFat = allMeals.reduce((sum: number, m: any) => sum + m.fat, 0);
                            return updated;
                          });
                          setPlanSaved(false);
                        },
                      });
                    }}
                    replacingSlot={replaceMealMutation.isPending ? replaceMealMutation.variables?.slot : undefined}
                  />
                ) : (
                  <WeeklyMealView
                    plan={mealPlan}
                    onLogMeal={onLogMeal}
                    onReplaceFromLibrary={(day, slot, idx) => setReplacePicker({ dayKey: day, slotKey: slot === 'snacks' ? 'snack' : slot, mealIdx: idx, context: 'generator' })}
                    onReplace={(day, slot, mealName, idx) => {
                      const dayOffsets: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
                      const ws = (mealPlan as any).weekStartDate as string | undefined;
                      const targetDate = ws ? addDays(ws, dayOffsets[day] ?? 0) : undefined;
                      replaceMealMutation.mutate({ slot, currentMealName: mealName, targetDate }, {
                        onSuccess: ({ slot: s, meal: newMeal }) => {
                          setMealPlan((prev: any) => {
                            if (!prev) return prev;
                            const updated = { ...prev };
                            const dayPlan = { ...updated[day] };
                            const key = s === 'snack' ? 'snacks' : s;
                            const arr = [...(dayPlan[key] || [])];
                            arr[idx] = newMeal;
                            dayPlan[key] = arr;
                            const allDayMeals = [...dayPlan.breakfast, ...dayPlan.lunch, ...dayPlan.dinner, ...dayPlan.snacks];
                            dayPlan.dayTotalCalories = allDayMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
                            dayPlan.dayTotalProtein = allDayMeals.reduce((sum: number, m: any) => sum + m.protein, 0);
                            dayPlan.dayTotalCarbs = allDayMeals.reduce((sum: number, m: any) => sum + m.carbs, 0);
                            dayPlan.dayTotalFat = allDayMeals.reduce((sum: number, m: any) => sum + m.fat, 0);
                            updated[day] = dayPlan;
                            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                            updated.weekTotalCalories = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalCalories || 0), 0);
                            updated.weekTotalProtein = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalProtein || 0), 0);
                            updated.weekTotalCarbs = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalCarbs || 0), 0);
                            updated.weekTotalFat = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalFat || 0), 0);
                            return updated;
                          });
                          setPlanSaved(false);
                        },
                      });
                    }}
                    replacingSlot={replaceMealMutation.isPending ? replaceMealMutation.variables?.slot : undefined}
                  />
                )}
              </div>

              {mealPlan && (
                <div className="sticky bottom-0 z-10 bg-white border-t border-zinc-100 px-4 sm:px-6 pt-3 shrink-0" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    {!planSaved && (
                      <button
                        onClick={() => { setMealPlan(null); setPlanSaved(false); setBannerCollapsed(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200 min-h-[36px]"
                        data-testid="button-discard-plan"
                      >
                        <X className="w-3.5 h-3.5" /> Discard
                      </button>
                    )}
                    <button
                      onClick={() => savePlanMutation.mutate()}
                      disabled={savePlanMutation.isPending || planSaved}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors min-h-[36px] ${
                        planSaved
                          ? "bg-zinc-100 text-zinc-600 border border-zinc-200 cursor-default"
                          : "bg-zinc-900 hover:bg-zinc-700 text-white"
                      }`}
                      data-testid="button-save-plan"
                    >
                      {savePlanMutation.isPending ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                      ) : planSaved ? (
                        <><Check className="w-3.5 h-3.5" /> Saved</>
                      ) : (
                        <><Save className="w-3.5 h-3.5" /> Save Plan</>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (mealPlan.planType === 'daily') {
                          setShoppingDaysOpen(true);
                        } else {
                          exportShoppingListToPDF(mealPlan, data);
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors"
                      data-testid="button-export-shopping-list"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Shopping List
                    </button>
                    <button
                      onClick={() => exportMealPlanToPDF(mealPlan, data)}
                      className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors"
                      data-testid="button-export-pdf"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export PDF
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {shoppingDaysOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-display font-bold text-zinc-900">Shopping List</h3>
            </div>
            <p className="text-sm text-zinc-500 mb-5 mt-1">
              How many days are you shopping for? Ingredient quantities will be scaled accordingly.
            </p>
            <div className="mb-5">
              <label className="block text-sm font-medium text-zinc-700 mb-2">Number of days</label>
              <input
                type="number"
                min="1"
                max="30"
                value={shoppingDaysInput}
                onChange={e => setShoppingDaysInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const d = Math.max(1, parseInt(shoppingDaysInput) || 1);
                    setShoppingDaysOpen(false);
                    exportShoppingListToPDF(mealPlan!, data, d);
                  }
                }}
                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
                data-testid="input-shopping-days"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShoppingDaysOpen(false)}
                className="flex-1 px-4 py-2.5 border border-zinc-200 text-zinc-700 rounded-xl font-medium text-sm hover:bg-zinc-50 transition-colors"
                data-testid="button-shopping-days-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const d = Math.max(1, parseInt(shoppingDaysInput) || 1);
                  setShoppingDaysOpen(false);
                  exportShoppingListToPDF(mealPlan!, data, d);
                }}
                className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-medium text-sm transition-colors"
                data-testid="button-shopping-days-confirm"
              >
                Generate PDF
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {customModalOpen && (
          <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setCustomModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.25 }}
              className="bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:mx-4 flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-white border-b border-zinc-100 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-display font-bold text-zinc-900" data-testid="text-custom-modal-title">
                    Custom {planMode === 'weekly' ? 'Weekly' : 'Daily'} Builder
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Add meals to slots, then autofill the rest
                  </p>
                </div>
                <button
                  onClick={() => setCustomModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                  data-testid="button-close-custom-modal"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="bg-zinc-50 border-b border-zinc-100 shrink-0">
                <div className={`transition-all duration-300 ease-in-out overflow-hidden sm:!max-h-none ${bannerCollapsed ? 'max-h-0' : 'max-h-[500px]'}`}>
                  <div className="px-4 sm:px-6 py-3">
                    <div className="relative bg-zinc-100 rounded-xl p-0.5 flex items-stretch mb-3" data-testid="custom-plan-type-toggle">
                      <div
                        className="absolute top-0.5 bottom-0.5 rounded-lg bg-white shadow transition-all duration-300 ease-out"
                        style={{ width: `calc((100% - 4px) / 2)`, left: planMode === 'daily' ? '2px' : `calc(2px + (100% - 4px) / 2)` }}
                      />
                      {([
                        { key: 'daily' as const, label: 'Daily' },
                        { key: 'weekly' as const, label: 'Weekly' },
                      ]).map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          data-testid={`toggle-custom-plan-type-${opt.key}`}
                          onClick={() => { setPlanMode(opt.key); setMealPlan(null); }}
                          className={`relative z-10 flex-1 py-1 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                            planMode === opt.key ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <DateRangePicker
                      weekStart={weekStart}
                      onWeekChange={(dir) => setWeekStart(prev => addDays(prev, dir))}
                      planMode={planMode}
                      selectedDates={selectedDates}
                      onToggleDate={(dateStr) => {
                        setSelectedDates(prev => {
                          const without = prev.filter(d => d !== dateStr);
                          return prev.includes(dateStr) && without.length > 0 ? without : [...prev.filter(d => d !== dateStr), dateStr].sort();
                        });
                      }}
                      testIdPrefix="custom"
                    />
                    <div className="mt-3">
                      {(() => {
                        const styles = [
                          { key: 'simple' as const,  icon: Salad,   label: 'Simple' },
                          { key: 'gourmet' as const, icon: ChefHat, label: 'Fancy' },
                          { key: 'michelin' as const,icon: Star,    label: 'Michelin' },
                        ];
                        const idx = styles.findIndex(s => s.key === mealStyle);
                        return (
                          <div className="relative bg-zinc-100 rounded-xl p-0.5 flex items-stretch" data-testid="custom-meal-style-scale">
                            <div
                              className="absolute top-0.5 bottom-0.5 rounded-lg bg-white shadow transition-all duration-300 ease-out"
                              style={{ width: `calc((100% - 4px) / 3)`, left: `calc(2px + ${idx} * (100% - 4px) / 3)` }}
                            />
                            {styles.map((style) => (
                              <button
                                key={style.key}
                                type="button"
                                data-testid={`toggle-custom-meal-style-${style.key}`}
                                onClick={() => { setMealStyle(style.key); setMealPlan(null); }}
                                className={`relative z-10 flex-1 flex flex-col items-center gap-0.5 sm:gap-1 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors duration-200 ${
                                  mealStyle === style.key ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                                }`}
                              >
                                <style.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span>{style.label}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="mt-3">
                      <div className="flex justify-center gap-2.5 sm:gap-3">
                        {([
                          { key: 'breakfast', label: 'Breakfast', icon: Coffee },
                          { key: 'lunch', label: 'Lunch', icon: UtensilsCrossed },
                          { key: 'dinner', label: 'Dinner', icon: ChefHat },
                          { key: 'snacks', label: 'Snacks', icon: Cookie },
                        ] as const).map(({ key, label, icon: Icon }) => {
                          const active = customEnabledSlots.has(key);
                          const locked = planMode === 'daily' && isSlotLockedForDates(key, selectedDates);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => { if (!locked) toggleCustomSlot(key); }}
                              disabled={locked}
                              className={`flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-medium transition-all ${
                                locked
                                  ? 'bg-zinc-100 text-zinc-300 opacity-50 cursor-not-allowed'
                                  : active
                                    ? 'bg-zinc-900 text-white shadow-sm'
                                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                              }`}
                              data-testid={`toggle-custom-slot-${key}`}
                            >
                              {locked ? <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).filter(s => !customEnabledSlots.has(s)).length > 0 && (
                        <p className="text-[10px] text-zinc-400 mt-1.5 text-center">
                          {(['breakfast', 'lunch', 'dinner', 'snacks'] as const)
                            .filter(s => !customEnabledSlots.has(s))
                            .map(s => s === 'snacks' ? 'Snacks' : s.charAt(0).toUpperCase() + s.slice(1))
                            .join(', ')} will be skipped
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setBannerCollapsed(prev => !prev)}
                  className="w-full flex items-center justify-center py-1 sm:hidden"
                  data-testid="button-toggle-custom-banner"
                >
                  {bannerCollapsed ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronUp className="w-4 h-4 text-zinc-400" />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                <div className="space-y-4 mb-4">
                  {getCustomDayKeys().map((dayKey, dayIdx) => {
                    const dayLabel = planMode === 'weekly'
                      ? dayKey.charAt(0).toUpperCase() + dayKey.slice(1)
                      : (() => { const [y, m, d] = dayKey.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); })();
                    const dayNutrition = getDayNutrition(dayKey);
                    const calPct = effectiveCals > 0 ? Math.min(100, Math.round((dayNutrition.calories / effectiveCals) * 100)) : 0;
                    const dayDateStr = planMode === 'weekly' ? addDays(weekStart, dayIdx) : dayKey;
                    const dayIsPast = isDayPast(dayDateStr);
                    return (
                      <div key={dayKey} className={`border rounded-2xl p-3 ${dayIsPast ? 'border-zinc-100 opacity-60' : 'border-zinc-100'}`}>
                        <div className="bg-zinc-900 text-white rounded-2xl relative overflow-hidden mb-3" data-testid={`nutrition-summary-${dayKey}`}>
                          <div className="absolute top-[-40%] right-[-10%] w-48 h-48 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                          <div className="relative z-10 p-3 sm:p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <CalendarDays className="w-3.5 h-3.5 text-zinc-400" />
                                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{dayLabel}</span>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold leading-none" data-testid={`text-day-calories-${dayKey}`}>{dayNutrition.calories}<span className="text-xs font-normal text-zinc-400 ml-0.5">/{effectiveCals}</span></p>
                                <p className="text-zinc-500 text-[10px] mt-0.5">kcal</p>
                              </div>
                            </div>
                            <div className="w-full h-1 bg-white/10 rounded-full mb-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${calPct >= 100 ? 'bg-amber-500' : 'bg-white/70'}`}
                                style={{ width: `${calPct}%` }}
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              <div className="bg-white/10 rounded-lg px-2 py-1.5" data-testid={`tile-custom-protein-${dayKey}`}>
                                <div className="flex items-center gap-1 mb-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                                  <span className="text-[10px] text-zinc-400">Protein</span>
                                </div>
                                <p className="text-sm font-bold leading-none">{dayNutrition.protein}<span className="text-[10px] font-normal text-zinc-400 ml-0.5">g</span></p>
                              </div>
                              <div className="bg-white/10 rounded-lg px-2 py-1.5" data-testid={`tile-custom-carbs-${dayKey}`}>
                                <div className="flex items-center gap-1 mb-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                                  <span className="text-[10px] text-zinc-400">Carbs</span>
                                </div>
                                <p className="text-sm font-bold leading-none">{dayNutrition.carbs}<span className="text-[10px] font-normal text-zinc-400 ml-0.5">g</span></p>
                              </div>
                              <div className="bg-white/10 rounded-lg px-2 py-1.5" data-testid={`tile-custom-fat-${dayKey}`}>
                                <div className="flex items-center gap-1 mb-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-3))" }} />
                                  <span className="text-[10px] text-zinc-400">Fat</span>
                                </div>
                                <p className="text-sm font-bold leading-none">{dayNutrition.fat}<span className="text-[10px] font-normal text-zinc-400 ml-0.5">g</span></p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map(slotKey => {
                            const meals = customSlots[dayKey]?.[slotKey] || [];
                            const isDropping = dropTarget?.dayKey === dayKey && dropTarget?.slotKey === slotKey;
                            const slotIsPast = isSlotPast(dayDateStr, slotKey);
                            const slotReadOnly = dayIsPast || slotIsPast;
                            return (
                              <div
                                key={slotKey}
                                ref={(el) => registerSlotRef(`${dayKey}::${slotKey}`, el)}
                                className={`rounded-xl p-2 transition-colors ${slotReadOnly ? 'bg-zinc-50 opacity-60' : isDropping ? 'bg-blue-50 border-2 border-dashed border-blue-300' : 'bg-zinc-50'}`}
                                onDragOver={slotReadOnly ? undefined : (e) => handleDragOver(e, dayKey, slotKey)}
                                onDragLeave={slotReadOnly ? undefined : handleDragLeave}
                                onDrop={slotReadOnly ? undefined : (e) => handleDrop(e, dayKey, slotKey)}
                                data-testid={`custom-slot-${dayKey}-${slotKey}`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <h5 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                                    {slotKey.charAt(0).toUpperCase() + slotKey.slice(1)}
                                  </h5>
                                  {!slotReadOnly && (
                                    <button
                                      onClick={() => { setAddMealPopover({ dayKey, slotKey }); setMealSearchQuery(""); }}
                                      className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
                                      data-testid={`button-add-meal-${dayKey}-${slotKey}`}
                                    >
                                      <Plus className="w-3 h-3" /> Add
                                    </button>
                                  )}
                                </div>
                                {meals.length === 0 && (
                                  <p className="text-[10px] text-zinc-300 py-1">{slotReadOnly ? 'Past slot' : 'Drop a meal here or click Add'}</p>
                                )}
                                {meals.map((meal, idx) => (
                                  <div
                                    key={idx}
                                    draggable={!slotReadOnly}
                                    onDragStart={slotReadOnly ? undefined : (e) => handleDragStart(e, dayKey, slotKey, idx)}
                                    onTouchStart={slotReadOnly ? undefined : (e) => handleTouchStart(e, dayKey, slotKey, idx, meal.meal)}
                                    onTouchMove={slotReadOnly ? undefined : handleTouchMove}
                                    onTouchEnd={slotReadOnly ? undefined : handleTouchEnd}
                                    className={`flex items-center gap-1.5 py-1.5 px-2 bg-white rounded-lg border mb-1 select-none ${
                                      slotReadOnly
                                        ? 'border-zinc-100 cursor-default'
                                        : touchDragging?.dayKey === dayKey && touchDragging?.slotKey === slotKey && touchDragging?.mealIdx === idx
                                        ? 'border-blue-300 bg-blue-50 opacity-50 cursor-grab active:cursor-grabbing group'
                                        : 'border-zinc-100 cursor-grab active:cursor-grabbing group'
                                    }`}
                                    data-testid={`custom-meal-card-${dayKey}-${slotKey}-${idx}`}
                                  >
                                    {!slotReadOnly && <GripVertical className="w-3 h-3 text-zinc-300 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-zinc-900 truncate">{meal.meal}</p>
                                      <p className="text-[10px] text-zinc-400">{meal.calories} kcal · P:{meal.protein}g C:{meal.carbs}g F:{meal.fat}g</p>
                                    </div>
                                    {!slotReadOnly && (
                                    <button
                                      onClick={() => setReplacePicker({ dayKey, slotKey: slotKey === 'snacks' ? 'snack' : slotKey, mealIdx: idx, context: 'custom' })}
                                      className="p-1 text-zinc-300 hover:text-blue-500 transition-colors shrink-0"
                                      title="Replace from library"
                                      data-testid={`button-replace-custom-${dayKey}-${slotKey}-${idx}`}
                                    >
                                      <ArrowLeftRight className="w-3 h-3" />
                                    </button>
                                    )}
                                    {!slotReadOnly && (
                                    <button
                                      onClick={() => removeMealFromSlot(dayKey, slotKey, idx)}
                                      className="p-1 text-zinc-300 hover:text-red-500 transition-colors shrink-0"
                                      data-testid={`button-remove-meal-${dayKey}-${slotKey}-${idx}`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="sticky bottom-0 z-10 bg-white border-t border-zinc-100 px-4 sm:px-6 pt-3 shrink-0" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}>
                {mealPlanPrefs?.vitalityInsightsEnabled && data.gender === "male" && (
                  isMealPremium ? (
                    <div className="flex items-center justify-between px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 mb-1.5" data-testid="custom-vitality-hormone-boost-toggle">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <p className="text-xs font-medium text-amber-800">Hormone-boosting meals</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest("PUT", "/api/user/preferences", {
                            ...mealPlanPrefs,
                            hormoneBoostingMeals: !mealPlanPrefs?.hormoneBoostingMeals,
                          });
                          queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
                        }}
                        className={`w-10 h-6 rounded-full transition-colors shrink-0 ml-3 ${mealPlanPrefs?.hormoneBoostingMeals ? "bg-amber-500" : "bg-zinc-200"}`}
                        data-testid="button-custom-toggle-hormone-boost"
                      >
                        <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${mealPlanPrefs?.hormoneBoostingMeals ? "translate-x-5" : "translate-x-1"}`} />
                      </button>
                    </div>
                  ) : (
                    <Link href="/pricing">
                      <div className="flex items-center justify-between px-2 py-1 rounded-lg border border-zinc-200 bg-zinc-50 mb-1.5 cursor-pointer hover:bg-zinc-100 transition-colors" data-testid="custom-vitality-hormone-boost-locked">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                          <p className="text-xs font-medium text-zinc-600">Hormone-boosting meals</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                    </Link>
                  )
                )}

                <p className="text-[11px] text-zinc-400 text-center mb-1.5" data-testid="text-custom-slot-caption">Which meals to auto-complete?</p>
                <div className="flex justify-center gap-2.5 sm:gap-3 mb-2">
                  {([
                    { key: 'breakfast', label: 'Breakfast', icon: Coffee },
                    { key: 'lunch', label: 'Lunch', icon: UtensilsCrossed },
                    { key: 'dinner', label: 'Dinner', icon: ChefHat },
                    { key: 'snacks', label: 'Snacks', icon: Cookie },
                  ] as const).map(({ key, label, icon: Icon }) => {
                    const active = customEnabledSlots.has(key);
                    const locked = planMode === 'daily' && isSlotLockedForDates(key, selectedDates);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (locked) return;
                          setBaseCustomSlots(prev => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key); else next.add(key);
                            return next;
                          });
                        }}
                        disabled={locked}
                        className={`flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-medium transition-all ${
                          locked
                            ? 'bg-zinc-100 text-zinc-300 opacity-50 cursor-not-allowed'
                            : active
                              ? 'bg-zinc-900 text-white shadow-sm'
                              : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                        }`}
                        data-testid={`toggle-custom-slot-${key}`}
                      >
                        {locked ? <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => autofillMutation.mutate()}
                    disabled={autofillMutation.isPending || customEnabledSlots.size === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-sm transition-colors"
                    data-testid="button-autofill-plan"
                  >
                    {autofillMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {customHasAnyMeals ? 'Autofill Empty Slots' : 'Generate Full Plan'}
                  </button>
                </div>
                {customHasAnyMeals && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => customSavePlanMutation.mutate()}
                      disabled={customSavePlanMutation.isPending || customPlanSaved}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors min-h-[36px] ${
                        customPlanSaved
                          ? "bg-zinc-100 text-zinc-600 border border-zinc-200 cursor-default"
                          : "bg-zinc-900 hover:bg-zinc-700 text-white"
                      }`}
                      data-testid="button-save-custom-plan"
                    >
                      {customSavePlanMutation.isPending ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                      ) : customPlanSaved ? (
                        <><Check className="w-3.5 h-3.5" /> Saved</>
                      ) : (
                        <><Save className="w-3.5 h-3.5" /> Save Plan</>
                      )}
                    </button>
                    <button
                      onClick={() => exportShoppingListToPDF(buildPlanFromSlots(), data)}
                      className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors"
                      data-testid="button-export-custom-shopping-list"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Shopping List
                    </button>
                    <button
                      onClick={() => exportMealPlanToPDF(buildPlanFromSlots(), data)}
                      className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors"
                      data-testid="button-export-custom-pdf"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export PDF
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {addMealPopover && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setAddMealPopover(null); setMealSearchQuery(""); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-900">Add Meal to {addMealPopover.slotKey.charAt(0).toUpperCase() + addMealPopover.slotKey.slice(1)}</h3>
              <button onClick={() => { setAddMealPopover(null); setMealSearchQuery(""); }} className="p-1 hover:bg-zinc-100 rounded-lg" data-testid="button-close-add-meal">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search your meals..."
                value={mealSearchQuery}
                onChange={e => setMealSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                autoFocus
                data-testid="input-search-meal"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredUserMeals.length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center" data-testid="text-no-meals-found">
                  {userMealsData?.items?.length === 0 ? "No meals in your library yet. Add some from My Meals first." : "No meals match your search."}
                </p>
              ) : (
                filteredUserMeals.map(m => (
                  <button
                    key={m.id}
                    onClick={() => addMealToSlot(addMealPopover.dayKey, addMealPopover.slotKey, m)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-50 text-left transition-colors"
                    data-testid={`button-pick-meal-${m.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{m.name}</p>
                      <p className="text-[10px] text-zinc-400">P:{m.proteinPerServing}g C:{m.carbsPerServing}g F:{m.fatPerServing}g</p>
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 ml-2 shrink-0">{m.caloriesPerServing} kcal</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {copyMovePopover && (() => {
        const targetHasMeals = (customSlots[copyMovePopover.target.dayKey]?.[copyMovePopover.target.slotKey]?.length ?? 0) > 0;
        const popoverWidth = targetHasMeals ? 260 : 170;
        return (
          <div className="fixed inset-0 z-[60]" onClick={() => setCopyMovePopover(null)}>
            <div
              className="absolute bg-white rounded-xl shadow-2xl border border-zinc-200 p-1 flex gap-1"
              style={{ left: Math.min(copyMovePopover.x - popoverWidth / 2, window.innerWidth - popoverWidth - 8), top: Math.max(copyMovePopover.y - 44, 8) }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => executeCopyMove('copy')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-zinc-50 text-sm font-medium text-zinc-700 transition-colors"
                data-testid="button-copy-meal"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <div className="w-px bg-zinc-200 my-1" />
              <button
                onClick={() => executeCopyMove('move')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-zinc-50 text-sm font-medium text-zinc-700 transition-colors"
                data-testid="button-move-meal"
              >
                <Move className="w-3.5 h-3.5" /> Move
              </button>
              {targetHasMeals && (
                <>
                  <div className="w-px bg-zinc-200 my-1" />
                  <button
                    onClick={() => executeReplace()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-amber-50 text-sm font-medium text-amber-700 transition-colors"
                    data-testid="button-replace-meal"
                  >
                    <Replace className="w-3.5 h-3.5" /> Replace
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {touchDragging && touchGhost && !copyMovePopover && (
        <div
          className="fixed z-[70] pointer-events-none"
          style={{ left: touchGhost.x - 60, top: touchGhost.y - 20 }}
        >
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-blue-200 px-3 py-1.5 max-w-[140px]">
            <p className="text-[10px] font-medium text-zinc-900 truncate">{touchDragging.mealName}</p>
            <p className="text-[8px] text-blue-500">Drop on a slot</p>
          </div>
        </div>
      )}

      {replacePicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setReplacePicker(null); setReplaceSearchQuery(""); setAddFoodForm(null); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-900">
                <ArrowLeftRight className="w-3.5 h-3.5 inline mr-1.5" />
                Replace from Library
              </h3>
              <button onClick={() => { setReplacePicker(null); setReplaceSearchQuery(""); setAddFoodForm(null); }} className="p-1 hover:bg-zinc-100 rounded-lg" data-testid="button-close-replace-picker">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <div className="relative bg-zinc-100 rounded-xl p-0.5 flex items-stretch mb-3" data-testid="replace-picker-tab-toggle">
              <div
                className="absolute top-0.5 bottom-0.5 rounded-lg bg-white shadow transition-all duration-300 ease-out"
                style={{ width: 'calc((100% - 4px) / 2)', left: replacePickerTab === 'meals' ? '2px' : 'calc(2px + (100% - 4px) / 2)' }}
              />
              {([
                { key: 'meals' as const, label: 'My Meals' },
                { key: 'foods' as const, label: 'My Foods' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setReplacePickerTab(tab.key); setReplaceSearchQuery(""); setAddFoodForm(null); }}
                  className={`relative z-10 flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                    replacePickerTab === tab.key ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                  data-testid={`tab-replace-${tab.key}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder={replacePickerTab === 'foods' ? "Search your foods..." : "Search your meals..."}
                value={replaceSearchQuery}
                onChange={e => setReplaceSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                autoFocus
                data-testid="input-search-replace"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {replacePickerTab === 'foods' ? (
                <>
                  {filteredUserFoods.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4 text-center" data-testid="text-no-foods-found">
                      {userFoodsData?.items?.length === 0 ? "No foods saved yet." : "No foods match your search."}
                    </p>
                  ) : (
                    filteredUserFoods.map((f: any) => (
                      <button
                        key={f.id}
                        onClick={() => handleLibraryReplace({
                          name: f.name,
                          calories: Math.round((f.calories100g ?? 0) * (f.servingGrams ?? 100) / 100),
                          protein: Math.round((f.protein100g ?? 0) * (f.servingGrams ?? 100) / 100),
                          carbs: Math.round((f.carbs100g ?? 0) * (f.servingGrams ?? 100) / 100),
                          fat: Math.round((f.fat100g ?? 0) * (f.servingGrams ?? 100) / 100),
                        })}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-50 text-left transition-colors"
                        data-testid={`button-pick-food-${f.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{f.name}</p>
                          <p className="text-[10px] text-zinc-400">{f.servingGrams ?? 100}g serving</p>
                        </div>
                        <span className="text-xs font-semibold text-zinc-700 ml-2 shrink-0">
                          {Math.round((f.calories100g ?? 0) * (f.servingGrams ?? 100) / 100)} kcal
                        </span>
                      </button>
                    ))
                  )}
                  {!addFoodForm ? (
                    <button
                      onClick={() => setAddFoodForm({ name: '', calories: '', protein: '', carbs: '', fat: '' })}
                      className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
                      data-testid="button-add-food-inline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add New Food
                    </button>
                  ) : (
                    <div className="border border-zinc-200 rounded-xl p-3 mt-2 space-y-2">
                      <input placeholder="Food name" value={addFoodForm.name} onChange={e => setAddFoodForm(p => p ? { ...p, name: e.target.value } : p)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" data-testid="input-new-food-name" />
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Calories" type="number" value={addFoodForm.calories} onChange={e => setAddFoodForm(p => p ? { ...p, calories: e.target.value } : p)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" data-testid="input-new-food-cal" />
                        <input placeholder="Protein (g)" type="number" value={addFoodForm.protein} onChange={e => setAddFoodForm(p => p ? { ...p, protein: e.target.value } : p)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" data-testid="input-new-food-protein" />
                        <input placeholder="Carbs (g)" type="number" value={addFoodForm.carbs} onChange={e => setAddFoodForm(p => p ? { ...p, carbs: e.target.value } : p)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" data-testid="input-new-food-carbs" />
                        <input placeholder="Fat (g)" type="number" value={addFoodForm.fat} onChange={e => setAddFoodForm(p => p ? { ...p, fat: e.target.value } : p)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" data-testid="input-new-food-fat" />
                      </div>
                      <button
                        onClick={() => {
                          if (!addFoodForm.name || !addFoodForm.calories) return;
                          handleLibraryReplace({
                            name: addFoodForm.name,
                            calories: parseInt(addFoodForm.calories) || 0,
                            protein: parseInt(addFoodForm.protein) || 0,
                            carbs: parseInt(addFoodForm.carbs) || 0,
                            fat: parseInt(addFoodForm.fat) || 0,
                          });
                        }}
                        disabled={!addFoodForm.name || !addFoodForm.calories}
                        className="w-full py-1.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                        data-testid="button-confirm-new-food"
                      >
                        Use This Food
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {(userMealsData?.items ?? []).filter(m => m.caloriesPerServing > 0 && (!replaceSearchQuery || m.name.toLowerCase().includes(replaceSearchQuery.toLowerCase()))).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4 text-center" data-testid="text-no-replace-meals-found">
                      {(userMealsData?.items ?? []).length === 0 ? "No meals in your library yet." : "No meals match your search."}
                    </p>
                  ) : (
                    (userMealsData?.items ?? []).filter(m => m.caloriesPerServing > 0 && (!replaceSearchQuery || m.name.toLowerCase().includes(replaceSearchQuery.toLowerCase()))).map((m: any) => (
                      <button
                        key={m.id}
                        onClick={() => handleLibraryReplace({
                          name: m.name,
                          calories: m.caloriesPerServing,
                          protein: m.proteinPerServing,
                          carbs: m.carbsPerServing,
                          fat: m.fatPerServing,
                        })}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-50 text-left transition-colors"
                        data-testid={`button-pick-replace-meal-${m.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{m.name}</p>
                          <p className="text-[10px] text-zinc-400">P:{m.proteinPerServing}g C:{m.carbsPerServing}g F:{m.fatPerServing}g</p>
                        </div>
                        <span className="text-xs font-semibold text-zinc-700 ml-2 shrink-0">{m.caloriesPerServing} kcal</span>
                      </button>
                    ))
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function DateRangePicker({ weekStart, onWeekChange, planMode, selectedDates, onToggleDate, testIdPrefix = "" }: { weekStart: string; onWeekChange: (dir: -7 | 7) => void; planMode: 'daily' | 'weekly'; selectedDates: string[]; onToggleDate: (dateStr: string) => void; testIdPrefix?: string }) {
  const pfx = testIdPrefix ? `${testIdPrefix}-` : "";
  const today = toDateStr(new Date());
  return (
    <>
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => onWeekChange(-7)}
          className="p-1 hover:bg-zinc-200 rounded-lg text-zinc-500"
          data-testid={`button-${pfx}week-prev`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-zinc-700 min-w-[120px] text-center" data-testid={`text-${pfx}week-label`}>
          {formatShort(weekStart)} – {formatShort(addDays(weekStart, 6))}
        </span>
        <button
          onClick={() => onWeekChange(7)}
          className="p-1 hover:bg-zinc-200 rounded-lg text-zinc-500"
          data-testid={`button-${pfx}week-next`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {planMode === 'daily' && (
        <div className="flex gap-1.5 flex-wrap mt-2 justify-center">
          {DAY_LABELS.map((label, i) => {
            const dateStr = addDays(weekStart, i);
            const isSelected = selectedDates.includes(dateStr);
            const isPast = dateStr < today;
            return (
              <button
                key={dateStr}
                type="button"
                data-testid={`chip-${pfx}day-${label.toLowerCase()}`}
                onClick={() => !isPast && onToggleDate(dateStr)}
                disabled={isPast}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isPast
                    ? "bg-zinc-100 text-zinc-300 cursor-not-allowed"
                    : isSelected
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-500 hover:bg-zinc-200 border border-zinc-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function DailyMealView({ plan, onReplace, replacingSlot, onLogMeal, onReplaceFromLibrary }: { plan: any; onReplace?: (slot: string, mealName: string, idx: number) => void; replacingSlot?: string; onLogMeal?: (meal: Meal) => void; onReplaceFromLibrary?: (slot: string, idx: number) => void }) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [localDisliked, setLocalDisliked] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });
  const serverDisliked = new Set((prefs?.dislikedMeals ?? []).map(m => m.toLowerCase()));

  const isDisliked = (name: string) => localDisliked.has(name.toLowerCase()) || serverDisliked.has(name.toLowerCase());

  const dislikeMutation = useMutation({
    mutationFn: (mealName: string) => {
      setLocalDisliked(prev => new Set(Array.from(prev).concat(mealName.toLowerCase())));
      return apiRequest("POST", "/api/preferences/disliked-meals", { mealName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Meal disliked", description: "It won't appear in future generated plans." });
    },
    onError: (_err, mealName) => {
      setLocalDisliked(prev => { const s = new Set(prev); s.delete(mealName.toLowerCase()); return s; });
      toast({ title: "Sign in to dislike meals", variant: "destructive" });
    },
  });

  return (
    <>
      <div className="bg-zinc-900 text-white rounded-3xl shadow-2xl relative overflow-hidden mb-8">
        <div className="absolute top-[-50%] right-[-10%] w-96 h-96 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold" data-testid="text-daily-macro-title">Daily Totals</h3>
              <p className="text-zinc-400 text-xs mt-0.5">Meal plan summary</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold leading-none" data-testid="text-daily-calories">{plan.dayTotalCalories ?? 0}</p>
              <p className="text-zinc-400 text-xs mt-0.5">Total kcal</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-daily-protein">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                <span className="text-xs text-zinc-400 font-medium">Protein</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.dayTotalProtein ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-daily-carbs">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                <span className="text-xs text-zinc-400 font-medium">Carbs</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.dayTotalCarbs ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-daily-fat">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-3))" }} />
                <span className="text-xs text-zinc-400 font-medium">Fat</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.dayTotalFat ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
          </div>
        </div>
      </div>

      {["breakfast", "lunch", "dinner", "snacks"].map((slotKey) => {
        const meals: Meal[] = plan[slotKey] || [];
        if (meals.length === 0) return null;
        return (
          <div key={slotKey} className="mb-6">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
              {slotKey.charAt(0).toUpperCase() + slotKey.slice(1)}
            </h4>
            {meals.map((meal, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setSelectedMeal(meal)}
                  className="flex-1 flex justify-between p-2 bg-zinc-50 rounded hover:bg-zinc-100 transition-colors text-left cursor-pointer border border-transparent hover:border-zinc-200"
                  data-testid={`meal-card-daily-${slotKey}-${idx}`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900 text-sm">{meal.meal}</p>
                    <p className="text-xs text-zinc-500">P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g</p>
                    {meal.vitalityRationale && (
                      <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1" data-testid={`vitality-rationale-daily-${slotKey}-${idx}`}>
                        <Zap className="w-2.5 h-2.5 flex-shrink-0" />
                        {meal.vitalityRationale}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-zinc-900 text-sm">{meal.calories}</p>
                    <p className="text-xs text-zinc-500">kcal</p>
                  </div>
                </button>
                {onLogMeal && (
                  <button
                    onClick={() => onLogMeal(meal)}
                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                    title="Log this meal"
                    data-testid={`button-log-daily-${slotKey}-${idx}`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { if (!isDisliked(meal.meal)) dislikeMutation.mutate(meal.meal); }}
                  className={`p-1.5 rounded transition-colors shrink-0 ${isDisliked(meal.meal) ? 'bg-red-50 text-red-500 cursor-default' : 'bg-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-500'}`}
                  title={isDisliked(meal.meal) ? "Disliked" : "Dislike this meal"}
                  data-testid={`button-dislike-daily-${slotKey}-${idx}`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
                {onReplaceFromLibrary && (
                  <button
                    onClick={() => onReplaceFromLibrary(slotKey, idx)}
                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                    title="Replace from library"
                    data-testid={`button-library-replace-daily-${slotKey}-${idx}`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {onReplace && (
                  <button
                    onClick={() => onReplace(slotKey, meal.meal, idx)}
                    disabled={replacingSlot === slotKey}
                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                    title="Replace meal"
                    data-testid={`button-replace-daily-${slotKey}-${idx}`}
                  >
                    {replacingSlot === slotKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {selectedMeal && (
        <RecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </>
  );
}

function WeeklyMealView({ plan, onReplace, replacingSlot, onLogMeal, onReplaceFromLibrary }: { plan: any; onReplace?: (day: string, slot: string, mealName: string, idx: number) => void; replacingSlot?: string; onLogMeal?: (meal: Meal) => void; onReplaceFromLibrary?: (day: string, slot: string, idx: number) => void }) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const firstAvailableDay = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].find(d => plan[d]) ?? "monday";
  const [expandedDay, setExpandedDay] = useState<string | null>(firstAvailableDay);
  const [localDisliked, setLocalDisliked] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });
  const serverDisliked = new Set((prefs?.dislikedMeals ?? []).map(m => m.toLowerCase()));
  const isDisliked = (name: string) => localDisliked.has(name.toLowerCase()) || serverDisliked.has(name.toLowerCase());

  const dislikeMutation = useMutation({
    mutationFn: (mealName: string) => {
      setLocalDisliked(prev => new Set(Array.from(prev).concat(mealName.toLowerCase())));
      return apiRequest("POST", "/api/preferences/disliked-meals", { mealName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Meal disliked", description: "It won't appear in future generated plans." });
    },
    onError: (_err, mealName) => {
      setLocalDisliked(prev => { const s = new Set(prev); s.delete(mealName.toLowerCase()); return s; });
      toast({ title: "Sign in to dislike meals", variant: "destructive" });
    },
  });

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  return (
    <>
      <div className="bg-zinc-900 text-white rounded-3xl shadow-2xl relative overflow-hidden mb-6">
        <div className="absolute top-[-50%] right-[-10%] w-96 h-96 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold" data-testid="text-weekly-macro-title">Weekly Totals</h3>
              <p className="text-zinc-400 text-xs mt-0.5">Meal plan summary</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold leading-none" data-testid="text-weekly-calories">{plan.weekTotalCalories ?? 0}</p>
              <p className="text-zinc-400 text-xs mt-0.5">Week kcal</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-weekly-protein">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                <span className="text-xs text-zinc-400 font-medium">Protein</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.weekTotalProtein ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-weekly-carbs">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                <span className="text-xs text-zinc-400 font-medium">Carbs</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.weekTotalCarbs ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
            <div className="bg-white/10 rounded-xl p-3" data-testid="tile-weekly-fat">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--chart-3))" }} />
                <span className="text-xs text-zinc-400 font-medium">Fat</span>
              </div>
              <p className="text-xl font-bold leading-none">{plan.weekTotalFat ?? 0}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
            </div>
          </div>
        </div>
      </div>

      {days.map(day => {
        const dayPlan = plan[day];
        if (!dayPlan) return null;
        const isExpanded = expandedDay === day;
        return (
          <div key={day} className="border border-zinc-100 rounded-2xl mb-3 overflow-hidden">
            <button
              onClick={() => setExpandedDay(isExpanded ? null : day)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
              data-testid={`accordion-day-${day}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-zinc-900 capitalize w-24">{day}</span>
                <span className="text-xs text-zinc-500">{dayPlan.dayTotalCalories} kcal</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    {["breakfast", "lunch", "dinner", "snacks"].map(slotKey => {
                      const meals: Meal[] = dayPlan[slotKey] || [];
                      if (meals.length === 0) return null;
                      return (
                        <div key={slotKey}>
                          <h5 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">
                            {slotKey.charAt(0).toUpperCase() + slotKey.slice(1)}
                          </h5>
                          <div className="space-y-1.5">
                            {meals.map((meal, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <button
                                  onClick={() => setSelectedMeal(meal)}
                                  className="flex-1 flex justify-between p-2 bg-white rounded hover:bg-zinc-100 transition-colors text-left cursor-pointer border border-transparent hover:border-zinc-200"
                                  data-testid={`meal-card-${day}-${slotKey}-${idx}`}
                                >
                                  <div className="flex-1">
                                    <p className="font-medium text-zinc-900 text-sm">{meal.meal}</p>
                                    <p className="text-xs text-zinc-500">P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g</p>
                                    {meal.vitalityRationale && (
                                      <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1" data-testid={`vitality-rationale-${day}-${slotKey}-${idx}`}>
                                        <Zap className="w-2.5 h-2.5 flex-shrink-0" />
                                        {meal.vitalityRationale}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="font-bold text-zinc-900 text-sm">{meal.calories}</p>
                                    <p className="text-xs text-zinc-500">kcal</p>
                                  </div>
                                </button>
                                {onLogMeal && (
                                  <button
                                    onClick={() => onLogMeal(meal)}
                                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                                    title="Log this meal"
                                    data-testid={`button-log-${day}-${slotKey}-${idx}`}
                                  >
                                    <ClipboardList className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => { if (!isDisliked(meal.meal)) dislikeMutation.mutate(meal.meal); }}
                                  className={`p-1.5 rounded transition-colors shrink-0 ${isDisliked(meal.meal) ? 'bg-red-50 text-red-500 cursor-default' : 'bg-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-500'}`}
                                  title={isDisliked(meal.meal) ? "Disliked" : "Dislike this meal"}
                                  data-testid={`button-dislike-${day}-${slotKey}-${idx}`}
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>
                                {onReplaceFromLibrary && (
                                  <button
                                    onClick={() => onReplaceFromLibrary(day, slotKey, idx)}
                                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                                    title="Replace from library"
                                    data-testid={`button-library-replace-${day}-${slotKey}-${idx}`}
                                  >
                                    <ArrowLeftRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {onReplace && (
                                  <button
                                    onClick={() => onReplace(day, slotKey, meal.meal, idx)}
                                    disabled={replacingSlot === slotKey}
                                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                                    title="Replace meal"
                                    data-testid={`button-replace-${day}-${slotKey}-${idx}`}
                                  >
                                    {replacingSlot === slotKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {selectedMeal && (
        <RecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </>
  );
}

function RecipeModal({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const recipe = RECIPES[meal.meal];
  const hasStructuredIngredients = Array.isArray(meal.ingredientsJson) && meal.ingredientsJson.length > 0;

  if (!recipe && !hasStructuredIngredients) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-zinc-600">Recipe not available for this meal.</p>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900">{meal.meal}</h3>
            <p className="text-sm text-zinc-500 mt-1">Click outside to close</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-xs text-orange-600 font-medium">Calories</p>
            <p className="text-lg font-bold text-orange-700">{meal.calories}</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-xs text-red-600 font-medium">Protein</p>
            <p className="text-lg font-bold text-red-700">{meal.protein}g</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-600 font-medium">Carbs</p>
            <p className="text-lg font-bold text-blue-700">{meal.carbs}g</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-xs text-yellow-600 font-medium">Fat</p>
            <p className="text-lg font-bold text-yellow-700">{meal.fat}g</p>
          </div>
        </div>

        <div className="bg-zinc-50 p-4 rounded-xl mb-4">
          <h4 className="text-sm font-semibold text-zinc-900 mb-3">Ingredients</h4>
          {Array.isArray(meal.ingredientsJson) && meal.ingredientsJson.length > 0 ? (
            <ul className="space-y-1.5">
              {meal.ingredientsJson.map((ing, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-sm text-zinc-700" data-testid={`plan-ingredient-${idx}`}>
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="flex-1">{Math.round(ing.grams)}g {ing.name}</span>
                  <span className="text-zinc-400 shrink-0">{Math.round(ing.calories100g * ing.grams / 100)} kcal</span>
                </li>
              ))}
            </ul>
          ) : recipe ? (
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, idx) => (
                <li key={idx} className="flex justify-between text-sm text-zinc-700">
                  <span>{ing.item}</span>
                  <span className="font-medium text-zinc-900">{ing.quantity}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {recipe?.instructions && (
          <div className="bg-zinc-50 p-4 rounded-xl mb-4">
            <h4 className="text-sm font-semibold text-zinc-900 mb-2">Instructions</h4>
            <p className="text-sm text-zinc-600 leading-relaxed">{recipe.instructions}</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}
