import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed, Loader2, X, Download, ShoppingCart, RefreshCw, Save, Check, ClipboardList, ChevronDown, ChevronUp, CalendarDays, AlertTriangle, AlertCircle, Zap, Lock, ArrowRight, Trash2, Plus, GripVertical, Wand2, Timer, Moon, Shield, BookOpen, MoreHorizontal, Undo2, ArrowLeftRight } from "lucide-react";
import { Link } from "wouter";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ToastAction } from "@/components/ui/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserPreferences, SavedMealPlan } from "@shared/schema";
import { getCyclePhase } from "@/lib/cycle";
import type { Calculation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useActiveFlow } from "@/contexts/active-flow-context";
import { toDateStr, addDays, getMonday, formatShort, DAY_LABELS } from "./results-pdf";
import { exportMealPlanToPDF, exportShoppingListToPDF } from "./results-pdf";
import { RECIPES } from "@shared/recipes";
import { SavedMealPlans } from "@/components/saved-meal-plans";
import type { PrefillEntry } from "@/components/food-log-shared";
import { isSlotPast, isDayPast } from "@/lib/mealTime";

import { DateRangePicker } from "./meal-plan/date-range-picker";
import { PlanTypeToggle, MealStyleSelector, SlotToggles } from "./meal-plan/shared-controls";
import { ReplacePicker } from "./meal-plan/replace-picker";
import { AddMealPopover } from "./meal-plan/add-meal-popover";
import { CopyMovePopover } from "./meal-plan/copy-move-popover";
import { NutritionSummaryCard } from "./meal-plan/nutrition-summary-card";
import type { MealPlan, ReplacePickerState, AddMealPopoverState, CopyMovePopoverState, DragSourceState, DropTargetState } from "./meal-plan/types";

export type { Meal } from "./meal-plan/types";
import type { Meal } from "./meal-plan/types";

interface GenerationLimits {
  tier: string;
  limits: { daily: number | null; weekly: number | null };
  used: { daily: number; weekly: number };
  remaining: { daily: number | null; weekly: number | null };
}

function isSlotLockedForDates(slot: string, dates: string[]): boolean {
  if (dates.length === 0) return false;
  return dates.every(d => isSlotPast(d, slot));
}

export function MealPlanGenerator({ data, onLogMeal, overrideTargets, pendingOpen, onOpenHandled }: { data: Calculation; onLogMeal?: (meal: Meal | PrefillEntry) => void; overrideTargets?: { dailyCalories?: number; proteinGoal?: number; carbsGoal?: number; fatGoal?: number } | null; pendingOpen?: boolean; onOpenHandled?: () => void }) {
  const effectiveCals = overrideTargets?.dailyCalories ?? data.dailyCalories;
  const effectiveProtein = overrideTargets?.proteinGoal ?? data.proteinGoal;
  const effectiveCarbs = overrideTargets?.carbsGoal ?? data.carbsGoal;
  const effectiveFat = overrideTargets?.fatGoal ?? data.fatGoal;
  const { user } = useAuth();
  const isMealPremium = !!(user?.betaUser || (user?.tier && user.tier !== "free"));
  const [planMode, setPlanMode] = useState<'daily' | 'weekly'>('daily');
  const [mealStyle, setMealStyle] = useState<'simple' | 'fancy' | 'gourmet'>('simple');
  const [selectedDates, setSelectedDates] = useState<string[]>([toDateStr(new Date())]);
  const [weekStart, setWeekStart] = useState<string>(getMonday(toDateStr(new Date())));
  const [ignoreCycle, setIgnoreCycle] = useState(false);
  const [customSlots, setCustomSlots] = useState<Record<string, Record<string, Meal[]>>>({});
  const [customPlanReady, setCustomPlanReady] = useState<MealPlan | null>(null);
  const [customPlanSaved, setCustomPlanSaved] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [addMealPopover, setAddMealPopover] = useState<AddMealPopoverState | null>(null);
  const [baseCustomSlots, setBaseCustomSlots] = useState<Set<string>>(new Set(['breakfast', 'lunch', 'dinner', 'snacks']));
  const [bannerCollapsed, setBannerCollapsed] = useState(false);
  const [showSavedPlansInline, setShowSavedPlansInline] = useState(false);
  const [customDiscardConfirmOpen, setCustomDiscardConfirmOpen] = useState(false);
  const [dragSource, setDragSource] = useState<DragSourceState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null);
  const [copyMovePopover, setCopyMovePopover] = useState<CopyMovePopoverState | null>(null);
  const [touchDragging, setTouchDragging] = useState<{ dayKey: string; slotKey: string; mealIdx: number; mealName: string } | null>(null);
  const [touchGhost, setTouchGhost] = useState<{ x: number; y: number } | null>(null);
  const [replacePicker, setReplacePicker] = useState<ReplacePickerState | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const slotRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setFlowActive } = useActiveFlow();

  useEffect(() => {
    if (pendingOpen) {
      setBannerCollapsed(false);
      setCustomModalOpen(true);
      onOpenHandled?.();
    }
  }, [pendingOpen, onOpenHandled]);

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

  const { data: generationLimits, refetch: refetchLimits } = useQuery<GenerationLimits>({
    queryKey: ["/api/meal-plans/generation-limits"],
    enabled: !!user,
  });

  const SLOT_HOURS: Record<string, number> = { breakfast: 8, lunch: 12, dinner: 19, snack: 15 };
  const fastingEnabled = !!(mealPlanPrefs?.fastingEnabled && mealPlanPrefs?.fastingProtocol);
  const fastingProtocol = mealPlanPrefs?.fastingProtocol;

  useEffect(() => {
    if (!mealPlanPrefs) return;
    const allSlots = new Set(['breakfast', 'lunch', 'dinner', 'snacks']);
    if (!mealPlanPrefs.fastingEnabled || !mealPlanPrefs.fastingProtocol) {
      setBaseCustomSlots(allSlots);
      return;
    }
    const protocol = mealPlanPrefs.fastingProtocol;
    if (protocol === 'omad') {
      allSlots.delete('breakfast');
      allSlots.delete('snacks');
    } else if (protocol === '5:2') {
      if (planMode === 'daily' && selectedDates.length > 0) {
        const fastDays = mealPlanPrefs.fastingDays ?? ['monday', 'thursday'];
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const selectedDayNames = selectedDates.map(d => {
          const [y, mo, da] = d.split('-').map(Number);
          return dayNames[new Date(y, mo - 1, da).getDay()];
        });
        const allFastingDays = selectedDayNames.every(dn => (fastDays as readonly string[]).includes(dn));
        if (allFastingDays) {
          allSlots.delete('breakfast');
          allSlots.delete('dinner');
          allSlots.delete('snacks');
        }
      }
    } else {
      const wStart = mealPlanPrefs.eatingWindowStart ?? 12;
      const wEnd = mealPlanPrefs.eatingWindowEnd ?? 20;
      for (const [slot, hour] of Object.entries(SLOT_HOURS)) {
        const mappedSlot = slot === 'snack' ? 'snacks' : slot;
        const inWindow = wStart < wEnd ? (hour >= wStart && hour < wEnd) : (hour >= wStart || hour < wEnd);
        if (!inWindow) allSlots.delete(mappedSlot);
      }
    }
    setBaseCustomSlots(allSlots);
  }, [mealPlanPrefs, selectedDates, planMode]);

  const toggleCustomSlot = useCallback((slot: string) => {
    setBaseCustomSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      return next;
    });
  }, []);

  const customEnabledSlots = useMemo(() => {
    if (planMode !== 'daily') return new Set(baseCustomSlots);
    const next = new Set<string>();
    for (const slot of baseCustomSlots) {
      if (!isSlotLockedForDates(slot, selectedDates)) next.add(slot);
    }
    return next;
  }, [baseCustomSlots, selectedDates, planMode]);

  const hasCycleData = !!(mealPlanPrefs?.cycleTrackingEnabled && mealPlanPrefs?.lastPeriodDate && data.gender === "female");
  const cycleEnabledButMissing = !!(mealPlanPrefs?.cycleTrackingEnabled && !mealPlanPrefs?.lastPeriodDate && data.gender === "female");
  const hasVitalityBoost = !!(mealPlanPrefs?.vitalityInsightsEnabled && mealPlanPrefs?.vitalityMeals && data.gender === "male");
  const dailyRef = selectedDates[0] || toDateStr(new Date());
  const cycleInfo = hasCycleData
    ? getCyclePhase(mealPlanPrefs!.lastPeriodDate!, mealPlanPrefs!.cycleLength ?? 28, dailyRef)
    : null;
  const weekCycleInfo = hasCycleData
    ? getCyclePhase(mealPlanPrefs!.lastPeriodDate!, mealPlanPrefs!.cycleLength ?? 28, weekStart)
    : null;

  useEffect(() => {
    const isActive = customModalOpen;
    setFlowActive("meal-plan", isActive);
    return () => setFlowActive("meal-plan", false);
  }, [customModalOpen, setFlowActive]);

  useEffect(() => {
    if (customModalOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      const today = toDateStr(new Date());
      setSelectedDates(prev => {
        const valid = prev.filter(d => d >= today);
        return valid.length > 0 ? valid : [today];
      });
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [customModalOpen]);

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
      ...(userMeal.ingredientsJson ? { ingredientsJson: userMeal.ingredientsJson } : {}),
      ...(userMeal.instructions ? { instructions: userMeal.instructions } : {}),
    };
    setCustomSlots(prev => {
      const day = { ...(prev[dayKey] || {}) };
      day[slotKey] = [...(day[slotKey] || []), meal];
      return { ...prev, [dayKey]: day };
    });
    setAddMealPopover(null);
    setCustomPlanReady(null);
    setCustomPlanSaved(false);
  }, []);

  const removeMealFromSlot = useCallback((dayKey: string, slotKey: string, idx: number) => {
    let removedMeal: Meal | null = null;
    setCustomSlots(prev => {
      const day = { ...(prev[dayKey] || {}) };
      const arr = [...(day[slotKey] || [])];
      removedMeal = arr[idx] || null;
      arr.splice(idx, 1);
      day[slotKey] = arr;
      return { ...prev, [dayKey]: day };
    });
    setCustomPlanReady(null);
    setCustomPlanSaved(false);
    if (removedMeal) {
      const restored = removedMeal;
      toast({
        title: "Meal removed",
        description: `${restored.meal} was removed.`,
        action: (
          <ToastAction
            altText="Undo remove"
            onClick={() => {
              setCustomSlots(prev => {
                const day = { ...(prev[dayKey] || {}) };
                const arr = [...(day[slotKey] || [])];
                arr.splice(idx, 0, restored);
                day[slotKey] = arr;
                return { ...prev, [dayKey]: day };
              });
              setCustomPlanReady(null);
              setCustomPlanSaved(false);
            }}
            data-testid="button-undo-remove-meal"
          >
            <Undo2 className="w-3 h-3 mr-1" /> Undo
          </ToastAction>
        ),
      });
    }
  }, [toast]);

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

  const isLimitReached = useMemo(() => {
    if (!generationLimits) return false;
    const rem = planMode === 'weekly' ? generationLimits.remaining.weekly : generationLimits.remaining.daily;
    return rem !== null && rem <= 0;
  }, [generationLimits, planMode]);

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
        ...(ignoreCycle ? { ignoreCycle: true } : {}),
      });
      return await res.json();
    },
    onSuccess: (planData) => {
      const slotKeys = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
      const mapMeals = (arr: any[]) => arr
        .filter((m: any) => m.meal !== '__past__')
        .map((m: any) => {
          let ingredientsJson = m.ingredientsJson;
          let instructions = m.instructions;
          if (!ingredientsJson || !Array.isArray(ingredientsJson) || ingredientsJson.length === 0) {
            const recipe = (RECIPES as Record<string, { ingredients: Array<{ item: string; quantity: string }>; instructions: string }>)[m.meal];
            if (recipe) {
              ingredientsJson = recipe.ingredients.map(ing => ({ name: ing.item, quantity: ing.quantity }));
              if (!instructions) instructions = recipe.instructions;
            }
          }
          return {
            meal: m.meal, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat,
            ...(ingredientsJson ? { ingredientsJson } : {}),
            ...(instructions ? { instructions } : {}),
          };
        });

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
      refetchLimits();
      toast({ title: "Slots filled", description: "Empty slots have been filled. You can still edit before saving." });
    },
    onError: (error: Error) => {
      let title = "Autofill failed";
      let description = "Something went wrong. Please try again.";
      try {
        const match = error.message.match(/^(\d+):\s*(.*)/s);
        if (match) {
          const status = parseInt(match[1], 10);
          const body = JSON.parse(match[2]);
          if (status === 429 && body.message) {
            title = "Generation limit reached";
            description = body.message;
            refetchLimits();
          } else if (status === 403 && body.message) {
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

  const handleRandomReplace = useCallback((dayKey: string, slotKey: string, mealIdx: number, mealName: string) => {
    const apiSlot = slotKey === 'snacks' ? 'snack' : slotKey;
    const dayKeys = getCustomDayKeys();
    const dayDateStr = planMode === 'weekly' ? addDays(weekStart, dayKeys.indexOf(dayKey)) : dayKey;
    replaceMealMutation.mutate({ slot: apiSlot, currentMealName: mealName, targetDate: dayDateStr }, {
      onSuccess: ({ meal: newMeal }) => {
        if (!newMeal || newMeal.meal === null) {
          toast({ title: "No alternative found", description: "No replacement matches your dietary restrictions.", variant: "destructive" });
          return;
        }
        setCustomSlots(prev => {
          const day = { ...(prev[dayKey] || {}) };
          const arr = [...(day[slotKey] || [])];
          if (mealIdx < arr.length) {
            arr[mealIdx] = { meal: newMeal.meal, calories: newMeal.calories, protein: newMeal.protein, carbs: newMeal.carbs, fat: newMeal.fat };
          }
          day[slotKey] = arr;
          return { ...prev, [dayKey]: day };
        });
        setCustomPlanReady(null);
        setCustomPlanSaved(false);
        toast({ title: "Meal replaced", description: `Swapped with ${newMeal.meal}` });
      },
    });
  }, [replaceMealMutation, getCustomDayKeys, planMode, weekStart, toast]);

  const handleLibraryReplace = useCallback((item: { name: string; calories: number; protein: number; carbs: number; fat: number }) => {
    if (!replacePicker) return;
    const { dayKey, slotKey, mealIdx } = replacePicker;
    const newMeal: Meal = { meal: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat };
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
    setReplacePicker(null);
    toast({ title: "Meal replaced", description: `Swapped with ${item.name}` });
  }, [replacePicker, toast]);

  const handleDateToggle = useCallback((dateStr: string) => {
    setSelectedDates(prev => {
      const without = prev.filter(d => d !== dateStr);
      return prev.includes(dateStr) && without.length > 0 ? without : [...prev.filter(d => d !== dateStr), dateStr].sort();
    });
  }, []);

  const handlePlanModeChange = useCallback((mode: 'daily' | 'weekly') => {
    setPlanMode(mode);
  }, []);

  const handleMealStyleChange = useCallback((style: 'simple' | 'fancy' | 'gourmet') => {
    setMealStyle(style);
  }, []);

  const remainingLabel = useMemo(() => {
    if (!generationLimits) return null;
    const rem = planMode === 'weekly' ? generationLimits.remaining.weekly : generationLimits.remaining.daily;
    if (rem === null) return null;
    const type = planMode === 'weekly' ? 'weekly' : 'daily';
    return `${rem} ${type} generate${rem !== 1 ? 's' : ''} left`;
  }, [generationLimits, planMode]);

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
          <UtensilsCrossed className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-display font-bold text-zinc-900">Meal Planning</h3>
      </div>

      <button
        onClick={() => { setBannerCollapsed(false); setCustomModalOpen(true); }}
        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-semibold text-sm transition-colors"
        data-testid="button-launch-planner"
      >
        <ClipboardList className="w-4 h-4" /> Create Plan
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

      {/* Custom Planner Modal */}
      <AnimatePresence>
        {customModalOpen && (
          <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setCustomModalOpen(false)}>
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
                    {planMode === 'weekly' ? 'Weekly' : 'Daily'} Meal Plan
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Build your plan, then generate or save</p>
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
                    <PlanTypeToggle planMode={planMode} onChangePlanMode={handlePlanModeChange} />
                    <DateRangePicker
                      weekStart={weekStart}
                      onWeekChange={(dir) => setWeekStart(prev => addDays(prev, dir))}
                      planMode={planMode}
                      selectedDates={selectedDates}
                      onToggleDate={handleDateToggle}
                    />
                    <SlotToggles
                      enabledSlots={customEnabledSlots}
                      onToggleSlot={toggleCustomSlot}
                      planMode={planMode}
                      selectedDates={selectedDates}
                    />
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Meal Style</p>
                      <MealStyleSelector mealStyle={mealStyle} onChangeMealStyle={handleMealStyleChange} />
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

              <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4">
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
                    <Moon className={`w-3.5 h-3.5 flex-shrink-0 ${cycleInfo.colorClass}`} />
                    <p className={`text-xs font-medium ${cycleInfo.textClass}`}>
                      {cycleInfo.name} phase · Day {cycleInfo.day} · {cycleInfo.shortTip}
                    </p>
                  </div>
                )}
                {planMode === 'weekly' && weekCycleInfo && (
                  <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border mb-2 ${weekCycleInfo.bgClass} ${weekCycleInfo.borderClass}`}>
                    <Moon className={`w-3 h-3 flex-shrink-0 ${weekCycleInfo.colorClass}`} />
                    <p className={`text-xs ${weekCycleInfo.textClass}`}>
                      {weekCycleInfo.name} phase from {formatShort(weekStart)} · {weekCycleInfo.shortTip}
                    </p>
                  </div>
                )}

                {!customHasAnyMeals && (
                  <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="custom-builder-empty-state">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                      <ClipboardList className="w-7 h-7 text-zinc-400" />
                    </div>
                    <p className="text-sm text-zinc-500 mb-1 max-w-xs">
                      Your plan is empty.
                    </p>
                    <p className="text-xs text-zinc-400 max-w-xs">
                      Tap "Add" on any meal slot to build your plan, or use the button below to auto-generate.
                    </p>

                    {(fastingEnabled || hasCycleData || hasVitalityBoost) && (
                      <div className="flex flex-wrap justify-center gap-2 mt-5">
                        {fastingEnabled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-100" data-testid="badge-fasting">
                            <Timer className="w-3 h-3" />
                            {fastingProtocol?.toUpperCase()} fasting
                          </span>
                        )}
                        {hasCycleData && !ignoreCycle && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-50 text-pink-700 text-[10px] font-medium border border-pink-100" data-testid="badge-cycle">
                            <Moon className="w-3 h-3" />
                            {cycleInfo ? `${cycleInfo.name} phase` : 'Cycle-optimised'}
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
                  </div>
                )}
                <div className="space-y-4 mb-4">
                  {getCustomDayKeys().map((dayKey, dayIdx) => {
                    const dayLabel = planMode === 'weekly'
                      ? dayKey.charAt(0).toUpperCase() + dayKey.slice(1)
                      : (() => { const [y, m, d] = dayKey.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); })();
                    const dayNutrition = getDayNutrition(dayKey);
                    const dayDateStr = planMode === 'weekly' ? addDays(weekStart, dayIdx) : dayKey;
                    const dayIsPast = isDayPast(dayDateStr);
                    return (
                      <div key={dayKey} className={`border rounded-2xl p-3 ${dayIsPast ? 'border-zinc-100 opacity-60' : 'border-zinc-100'}`}>
                        <NutritionSummaryCard
                          dayLabel={dayLabel}
                          calories={dayNutrition.calories}
                          targetCalories={effectiveCals}
                          protein={dayNutrition.protein}
                          carbs={dayNutrition.carbs}
                          fat={dayNutrition.fat}
                          dayKey={dayKey}
                        />
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
                                      onClick={() => setAddMealPopover({ dayKey, slotKey })}
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
                                {meals.map((meal, idx) => {
                                  const replacingTarget = replaceMealMutation.variables;
                                  const dayKeys = getCustomDayKeys();
                                  const replacingDateStr = planMode === 'weekly' ? addDays(weekStart, dayKeys.indexOf(dayKey)) : dayKey;
                                  const isBeingReplaced = replaceMealMutation.isPending &&
                                    replacingTarget?.slot === (slotKey === 'snacks' ? 'snack' : slotKey) &&
                                    replacingTarget?.currentMealName === meal.meal &&
                                    replacingTarget?.targetDate === replacingDateStr;
                                  return (
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
                                        onClick={() => handleRandomReplace(dayKey, slotKey, idx, meal.meal)}
                                        disabled={isBeingReplaced}
                                        className="p-1 text-zinc-300 hover:text-emerald-500 transition-colors shrink-0"
                                        title="Random replace"
                                        data-testid={`button-random-replace-${dayKey}-${slotKey}-${idx}`}
                                      >
                                        {isBeingReplaced ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                      </button>
                                    )}
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
                                  );
                                })}
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
                    <div className="flex items-center justify-between px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 mb-1.5" data-testid="custom-vitality-nutrient-dense-toggle">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <p className="text-xs font-medium text-amber-800">Nutrient-dense meals</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest("PUT", "/api/user/preferences", {
                            ...mealPlanPrefs,
                            vitalityMeals: !mealPlanPrefs?.vitalityMeals,
                          });
                          queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
                        }}
                        className={`w-10 h-6 rounded-full transition-colors shrink-0 ml-3 ${mealPlanPrefs?.vitalityMeals ? "bg-amber-500" : "bg-zinc-200"}`}
                        data-testid="button-custom-toggle-vitality-meals"
                      >
                        <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${mealPlanPrefs?.vitalityMeals ? "translate-x-5" : "translate-x-1"}`} />
                      </button>
                    </div>
                  ) : (
                    <Link href="/pricing">
                      <div className="flex items-center justify-between px-2 py-1 rounded-lg border border-zinc-200 bg-zinc-50 mb-1.5 cursor-pointer hover:bg-zinc-100 transition-colors" data-testid="custom-vitality-nutrient-dense-locked">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                          <p className="text-xs font-medium text-zinc-600">Nutrient-dense meals</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                    </Link>
                  )
                )}

                {remainingLabel && (
                  <p className="text-[10px] text-zinc-400 text-center mb-1" data-testid="text-generation-remaining">
                    {remainingLabel}
                  </p>
                )}
                {isLimitReached && (
                  <div className="flex items-center justify-center gap-2 mb-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200" data-testid="banner-generation-limit">
                    <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                    <p className="text-[10px] text-amber-700">
                      Generation limit reached.{' '}
                      <Link href="/pricing" className="underline font-medium" data-testid="link-upgrade-limit">Upgrade</Link> for more.
                    </p>
                  </div>
                )}

                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => autofillMutation.mutate()}
                    disabled={autofillMutation.isPending || customEnabledSlots.size === 0 || isLimitReached}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-sm transition-colors"
                    data-testid="button-autofill-plan"
                  >
                    {autofillMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {customHasAnyMeals ? 'Autofill Empty Slots' : 'Generate Full Plan'}
                  </button>
                </div>
                {customHasAnyMeals && (
                  <>
                  <div className="flex items-start gap-1.5 mb-2" data-testid="banner-health-disclaimer-custom">
                    <AlertCircle className="w-3 h-3 text-zinc-300 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-zinc-400 leading-snug">
                      This is not medical advice. Consult a healthcare professional before making dietary changes.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {!customPlanSaved && (
                        <button
                          onClick={() => setCustomDiscardConfirmOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs transition-colors bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200 min-h-[36px]"
                          data-testid="button-discard-custom-plan"
                        >
                          <X className="w-3.5 h-3.5" /> Discard
                        </button>
                      )}
                      <button
                        onClick={() => customSavePlanMutation.mutate()}
                        disabled={customSavePlanMutation.isPending || customPlanSaved}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs transition-colors min-h-[36px] ${
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
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportShoppingListToPDF(buildPlanFromSlots(), data)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors min-h-[36px]"
                        data-testid="button-export-custom-shopping-list"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Shopping List
                      </button>
                      <button
                        onClick={() => exportMealPlanToPDF(buildPlanFromSlots(), data)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors min-h-[36px]"
                        data-testid="button-export-custom-pdf"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                    </div>
                  </div>
                  </>
                )}

                <AlertDialog open={customDiscardConfirmOpen} onOpenChange={setCustomDiscardConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Discard plan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will clear all meals you've added. Any unsaved changes will be lost.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-discard-custom-cancel">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          const prevSlots = JSON.parse(JSON.stringify(customSlots));
                          const prevPlanReady = customPlanReady;
                          setCustomSlots({});
                          setCustomPlanReady(null);
                          setCustomPlanSaved(false);
                          setCustomDiscardConfirmOpen(false);
                          toast({
                            title: "Plan discarded",
                            description: "Tap Undo to restore it.",
                            action: (
                              <ToastAction
                                altText="Undo discard"
                                onClick={() => {
                                  setCustomSlots(prevSlots);
                                  setCustomPlanReady(prevPlanReady);
                                  setCustomPlanSaved(false);
                                }}
                                data-testid="button-undo-discard-custom"
                              >
                                <Undo2 className="w-3 h-3 mr-1" /> Undo
                              </ToastAction>
                            ),
                          });
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        data-testid="button-discard-custom-confirm"
                      >
                        Discard
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Touch drag ghost */}
      {touchDragging && touchGhost && (
        <div
          className="fixed z-[70] pointer-events-none px-3 py-1.5 bg-white border border-blue-300 rounded-lg shadow-lg text-xs font-medium text-zinc-900 whitespace-nowrap"
          style={{ left: touchGhost.x, top: touchGhost.y, transform: 'translate(-50%, -120%)' }}
        >
          {touchDragging.mealName}
        </div>
      )}

      {/* Add Meal Popover */}
      <AnimatePresence>
        {addMealPopover && (
          <AddMealPopover
            popoverState={addMealPopover}
            onClose={() => setAddMealPopover(null)}
            onAddMeal={addMealToSlot}
          />
        )}
      </AnimatePresence>

      {/* Copy/Move Popover */}
      <AnimatePresence>
        {copyMovePopover && (
          <CopyMovePopover
            popover={copyMovePopover}
            onCopyMove={executeCopyMove}
            onReplace={executeReplace}
            onClose={() => setCopyMovePopover(null)}
          />
        )}
      </AnimatePresence>

      {/* Replace Picker */}
      <AnimatePresence>
        {replacePicker && (
          <ReplacePicker
            replacePicker={replacePicker}
            onClose={() => setReplacePicker(null)}
            onReplace={handleLibraryReplace}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
