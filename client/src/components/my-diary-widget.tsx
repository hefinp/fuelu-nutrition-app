import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  NotebookPen, ChevronLeft, ChevronRight, Loader2, Trash2,
  Plus, Droplets, Activity, Flame, Clock, MapPin, X, Scale,
  ClipboardList, ExternalLink, ChevronDown, Pencil, GripVertical,
  ArrowRight, Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getActivityIcon } from "@/lib/activityIcons";
import {
  DarkMacroCard, SLOT_ICONS, SLOT_COLORS, SLOT_LABELS,
  todayStr, formatDateLabel, shiftDate,
  LoggedMealModal,
} from "@/components/food-log-shared";
import type { FoodLogEntry, MealSlot } from "@/components/food-log-shared";
import { FoodLogDrawer } from "@/components/food-log-drawer";
import { ConfirmDialog, useConfirmDialog } from "@/components/confirm-dialog";
import { Link } from "wouter";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

interface MyDiaryWidgetProps {
  calTarget?: number;
  protTarget?: number;
  carbsTarget?: number;
  fatTarget?: number;
  fibreTarget?: number;
  sugarTarget?: number;
  saturatedFatTarget?: number;
  onCreatePlan?: () => void;
}

interface DiaryActivityData {
  id: number;
  name: string;
  type: string;
  movingTime: number;
  distance: number;
  calories: number;
  averageHeartrate: number | null;
  deviceType: string | null;
}


function DraggableEntry({ entry, children }: { entry: FoodLogEntry; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entry-${entry.id}`,
    data: { entry },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1.5 ${isDragging ? "opacity-30" : ""}`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="p-1 rounded-md text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing transition-colors shrink-0 touch-none"
        data-testid={`drag-handle-${entry.id}`}
        aria-label="Drag to move or copy"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {children}
      </div>
    </div>
  );
}

function DroppableSlot({ slotKey, isValidTarget, children }: { slotKey: string; isValidTarget: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slotKey}`,
    data: { slotKey },
    disabled: !isValidTarget,
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-150 ${
        isOver && isValidTarget ? "ring-2 ring-blue-400 ring-inset bg-blue-50/30" : ""
      }`}
    >
      {children}
    </div>
  );
}

interface MoveCopyDialogState {
  entry: FoodLogEntry;
  targetSlot: MealSlot;
}

const QUICK_WATER_AMOUNTS = [250, 500, 750, 1000];

export function MyDiaryWidget({ calTarget, protTarget, carbsTarget, fatTarget, fibreTarget, sugarTarget, saturatedFatTarget, onCreatePlan }: MyDiaryWidgetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [waterPopupOpen, setWaterPopupOpen] = useState(false);
  const [customWater, setCustomWater] = useState("");
  const waterPopupRef = useRef<HTMLDivElement>(null);
  const [weightPopupOpen, setWeightPopupOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const weightPopupRef = useRef<HTMLDivElement>(null);
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());
  const [selectedEntry, setSelectedEntry] = useState<FoodLogEntry | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [drawerDefaultSlot, setDrawerDefaultSlot] = useState<import("@/components/food-log-shared").MealSlot | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();
  const [activeDragEntry, setActiveDragEntry] = useState<FoodLogEntry | null>(null);
  const [moveCopyDialog, setMoveCopyDialog] = useState<MoveCopyDialogState | null>(null);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  useEffect(() => {
    if (!waterPopupOpen) return;
    function handleClick(e: MouseEvent) {
      if (waterPopupRef.current && !waterPopupRef.current.contains(e.target as Node)) {
        setWaterPopupOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [waterPopupOpen]);

  useEffect(() => {
    if (!weightPopupOpen) return;
    function handleClick(e: MouseEvent) {
      if (weightPopupRef.current && !weightPopupRef.current.contains(e.target as Node)) {
        setWeightPopupOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [weightPopupOpen]);

  const { data: dailyEntries = [], isLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?date=${selectedDate}`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load food log");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: stravaStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/strava/status"],
    enabled: !!user,
  });

  const { data: activityData, isLoading: activitiesLoading, isError: activitiesError } = useQuery<{ activities: DiaryActivityData[]; totalCalories: number }>({
    queryKey: ["/api/strava/activities/date", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/strava/activities/date/${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activities");
      return res.json();
    },
    enabled: stravaStatus?.connected === true,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      setDeletingId(id);
      await apiRequest("DELETE", `/api/food-log/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hydration"] });
      toast({ title: "Entry deleted" });
      setDeletingId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete entry", variant: "destructive" });
      setDeletingId(null);
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, mealSlot }: { id: number; mealSlot: MealSlot }) => {
      await apiRequest("PATCH", `/api/food-log/${id}`, { mealSlot });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week"] });
      toast({ title: "Entry moved" });
      setMoveCopyDialog(null);
    },
    onError: () => {
      toast({ title: "Failed to move entry", variant: "destructive" });
      setMoveCopyDialog(null);
    },
  });

  const copyMutation = useMutation({
    mutationFn: async ({ entry, mealSlot }: { entry: FoodLogEntry; mealSlot: MealSlot }) => {
      await apiRequest("POST", "/api/food-log", {
        date: entry.date,
        mealName: entry.mealName,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        fibre: entry.fibre ?? null,
        sugar: entry.sugar ?? null,
        saturatedFat: entry.saturatedFat ?? null,
        mealSlot,
        source: entry.source ?? null,
        volumeMl: entry.volumeMl ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log-week"] });
      toast({ title: "Entry copied" });
      setMoveCopyDialog(null);
    },
    onError: () => {
      toast({ title: "Failed to copy entry", variant: "destructive" });
      setMoveCopyDialog(null);
    },
  });

  function handleDragStart(event: DragStartEvent) {
    const entry = event.active.data.current?.entry as FoodLogEntry | undefined;
    if (entry) setActiveDragEntry(entry);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragEntry(null);
    const { active, over } = event;
    if (!over) return;

    const entry = active.data.current?.entry as FoodLogEntry | undefined;
    if (!entry) return;

    const targetSlotKey = over.data.current?.slotKey as string | undefined;
    if (!targetSlotKey) return;

    const sourceSlot = entry.mealSlot ?? "__none__";
    if (sourceSlot === targetSlotKey) return;

    const targetSlot = targetSlotKey as MealSlot;
    if (!["breakfast", "lunch", "dinner", "snack", "drinks"].includes(targetSlot)) return;

    setMoveCopyDialog({ entry, targetSlot });
  }

  function toggleSlot(slot: string) {
    setExpandedSlots(prev => {
      const next = new Set(prev);
      next.has(slot) ? next.delete(slot) : next.add(slot);
      return next;
    });
  }

  const waterMutation = useMutation({
    mutationFn: (amountMl: number) =>
      apiRequest("POST", "/api/hydration", { date: selectedDate, amountMl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hydration"] });
      setCustomWater("");
      setWaterPopupOpen(false);
      toast({ title: "Water logged" });
    },
    onError: () => toast({ title: "Failed to log water", variant: "destructive" }),
  });

  const weightMutation = useMutation({
    mutationFn: (data: { weight: string; recordedAt: string }) =>
      apiRequest("POST", "/api/weight-entries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weight-entries"] });
      setWeightInput("");
      setWeightPopupOpen(false);
      toast({ title: "Weight logged" });
    },
    onError: () => toast({ title: "Failed to log weight", variant: "destructive" }),
  });

  const handleWeightSubmit = () => {
    if (!weightInput) return;
    weightMutation.mutate({ weight: weightInput, recordedAt: new Date().toISOString() });
  };

  const confirmedEntries = dailyEntries.filter(e => e.confirmed !== false);
  const totalCal = confirmedEntries.reduce((s, e) => s + e.calories, 0);
  const totalProt = confirmedEntries.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = confirmedEntries.reduce((s, e) => s + e.carbs, 0);
  const totalFat = confirmedEntries.reduce((s, e) => s + e.fat, 0);
  const totalFibre = confirmedEntries.reduce((s, e) => s + (e.fibre ?? 0), 0);
  const totalSugar = confirmedEntries.reduce((s, e) => s + (e.sugar ?? 0), 0);
  const totalSatFat = confirmedEntries.reduce((s, e) => s + (e.saturatedFat ?? 0), 0);
  const hasExtendedMacros = confirmedEntries.some(e => e.fibre != null || e.sugar != null || e.saturatedFat != null) || fibreTarget != null || sugarTarget != null || saturatedFatTarget != null;

  const slotOrder: (MealSlot | null)[] = ["breakfast", "lunch", "dinner", "snack", "drinks", null];
  const grouped: Record<string, FoodLogEntry[]> = {};
  for (const entry of dailyEntries) {
    const key = entry.mealSlot ?? "__none__";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }
  const orderedSlots = slotOrder.filter(s => s !== null || (grouped["__none__"]?.length ?? 0) > 0);

  const activities = activityData?.activities ?? [];
  const totalActivityCal = activityData?.totalCalories ?? 0;

  const handleCustomWaterAdd = () => {
    const val = parseInt(customWater);
    if (!val || val <= 0) return;
    waterMutation.mutate(val);
  };

  return (
    <>
      <div className="bg-white rounded-3xl border border-zinc-100 shadow-lg p-4 sm:p-6" data-testid="widget-my-diary">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
            <NotebookPen className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-display font-bold text-zinc-900">My Diary</h3>
            <p className="text-xs text-zinc-400">Your daily food log</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/my-library" className="text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors" data-testid="link-saved-meals">Saved Meals</Link>
            <Link href="/diary" className="text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors" data-testid="link-full-diary">Full Diary</Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-4 relative">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
            data-testid="button-diary-widget-log-meal"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Meal
          </button>
          <button
            onClick={() => setWaterPopupOpen(prev => !prev)}
            className="flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
            data-testid="button-diary-widget-log-water"
          >
            <Droplets className="w-3.5 h-3.5" />
            Log Water
          </button>
          <button
            onClick={() => setWeightPopupOpen(prev => !prev)}
            className="flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
            data-testid="button-diary-widget-log-weight"
          >
            <Scale className="w-3.5 h-3.5" />
            Log Weight
          </button>

          {waterPopupOpen && (
            <div
              ref={waterPopupRef}
              className="absolute left-0 top-full mt-2 z-50 w-64 bg-white rounded-2xl border border-zinc-200 shadow-xl p-4"
              data-testid="popup-diary-widget-water"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-zinc-800">Log Water</span>
                </div>
                <button
                  onClick={() => setWaterPopupOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors"
                  data-testid="button-close-water-popup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {QUICK_WATER_AMOUNTS.map(ml => (
                  <button
                    key={ml}
                    onClick={() => waterMutation.mutate(ml)}
                    disabled={waterMutation.isPending}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-xl border border-blue-200 hover:border-blue-300 transition-all disabled:opacity-50"
                    data-testid={`button-water-quick-${ml}`}
                  >
                    +{ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={customWater}
                  onChange={e => setCustomWater(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCustomWaterAdd()}
                  placeholder="Custom (ml)"
                  className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-xl focus:border-blue-400 focus:outline-none transition-colors"
                  data-testid="input-water-custom"
                />
                <button
                  onClick={handleCustomWaterAdd}
                  disabled={!customWater || waterMutation.isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  data-testid="button-water-custom-add"
                >
                  {waterMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                </button>
              </div>
            </div>
          )}

          {weightPopupOpen && (
            <div
              ref={weightPopupRef}
              className="absolute left-0 top-full mt-2 z-50 w-64 bg-white rounded-2xl border border-zinc-200 shadow-xl p-4"
              data-testid="popup-diary-widget-weight"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-zinc-700" />
                  <span className="text-sm font-semibold text-zinc-800">Log Weight</span>
                </div>
                <button
                  onClick={() => setWeightPopupOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors"
                  data-testid="button-close-weight-popup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleWeightSubmit()}
                  placeholder="Weight (kg)"
                  className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none transition-colors"
                  data-testid="input-weight"
                />
                <button
                  onClick={handleWeightSubmit}
                  disabled={!weightInput || weightMutation.isPending}
                  className="px-3 py-1.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  data-testid="button-weight-submit"
                >
                  {weightMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                </button>
              </div>
            </div>
          )}
        </div>

        {onCreatePlan && (
          <button
            onClick={onCreatePlan}
            className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-semibold text-sm transition-colors mb-4"
            data-testid="button-diary-create-plan"
          >
            <ClipboardList className="w-4 h-4" /> Create Plan
          </button>
        )}

        <div className="flex items-center justify-between bg-zinc-50 rounded-xl px-2 py-1.5 mb-4">
          <button
            onClick={() => setSelectedDate(d => shiftDate(d, -1))}
            className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
            data-testid="button-diary-widget-prev-day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <span className="text-sm font-semibold text-zinc-800" data-testid="text-diary-widget-date">
              {isToday ? "Today" : formatDateLabel(selectedDate)}
            </span>
            {isToday && <span className="block text-[10px] text-zinc-400">{formatDateLabel(selectedDate)}</span>}
            {!isToday && (
              <button
                onClick={() => setSelectedDate(today)}
                className="block mx-auto text-[10px] text-zinc-400 hover:text-zinc-600 font-medium transition-colors mt-0.5"
                data-testid="button-diary-widget-go-to-today"
              >
                Back to today
              </button>
            )}
          </div>
          <button
            onClick={() => setSelectedDate(d => shiftDate(d, 1))}
            className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
            data-testid="button-diary-widget-next-day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {stravaStatus?.connected && (
          <>
            {activitiesLoading && (
              <div className="bg-orange-50/40 border border-orange-100 rounded-xl p-3 mb-4" data-testid="diary-widget-activity-loading">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-medium text-zinc-500">Loading activities...</span>
                  <Loader2 className="w-3 h-3 animate-spin text-zinc-400 ml-auto" />
                </div>
              </div>
            )}
            {activitiesError && (
              <div className="bg-orange-50/40 border border-orange-100 rounded-xl p-3 mb-4" data-testid="diary-widget-activity-error">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs text-zinc-400">Unable to load Strava activities</span>
                </div>
              </div>
            )}
            {!activitiesLoading && !activitiesError && activities.length > 0 && (
              <div className="bg-orange-50/40 border border-orange-100 rounded-xl p-3 mb-4" data-testid="diary-widget-activity-section">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1 rounded-md bg-orange-100/80">
                    <Activity className="w-3 h-3 text-orange-600" />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex-1">Activity</span>
                  {totalActivityCal > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-600" data-testid="diary-widget-activity-total-cal">
                      <Flame className="w-3 h-3" />
                      {totalActivityCal} kcal burned
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {activities.map((a) => (
                    <div key={a.id} data-testid={`diary-widget-activity-${a.id}`}>
                      <div className="flex items-center gap-2 py-1">
                        {((Icon) => (
                          <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                            <Icon className="w-3.5 h-3.5 text-orange-500" />
                          </div>
                        ))(getActivityIcon(a.type))}
                        <span className="text-xs font-medium text-zinc-700 flex-1 truncate">{a.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {a.movingTime >= 3600
                              ? `${Math.floor(a.movingTime / 3600)}h ${Math.floor((a.movingTime % 3600) / 60)}m`
                              : `${Math.floor(a.movingTime / 60)}m`}
                          </span>
                          {a.distance > 0 && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />
                              {(a.distance / 1000).toFixed(1)}km
                            </span>
                          )}
                          {a.calories > 0 && (
                            <span className="font-medium text-orange-500">{Math.round(a.calories)} cal</span>
                          )}
                        </div>
                        <a
                          href={`https://www.strava.com/activities/${a.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                          style={{ color: "#FC4C02" }}
                          data-testid={`diary-widget-activity-strava-link-${a.id}`}
                          title="View on Strava"
                          aria-label="View on Strava"
                        >
                          View on Strava
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      {a.deviceType && /garmin/i.test(a.deviceType) && (
                        <p className="text-[10px] text-zinc-400 ml-10 -mt-0.5" data-testid={`diary-widget-garmin-attr-${a.id}`}>Recorded with Garmin</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-center pt-2" data-testid="diary-widget-strava-powered-badge">
                  <img src="/strava-powered-by.svg" alt="Powered by Strava" className="h-4 opacity-60" />
                </div>
              </div>
            )}
          </>
        )}

        <DarkMacroCard
          cal={totalCal} prot={totalProt} carbs={totalCarbs} fat={totalFat}
          fibre={hasExtendedMacros ? totalFibre : undefined}
          sugar={hasExtendedMacros ? totalSugar : undefined}
          saturatedFat={hasExtendedMacros ? totalSatFat : undefined}
          calTarget={calTarget} protTarget={protTarget}
          carbsTarget={carbsTarget} fatTarget={fatTarget}
          fibreTarget={fibreTarget} sugarTarget={sugarTarget}
          saturatedFatTarget={saturatedFatTarget}
        />

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto -mx-1 px-1">
            {orderedSlots.map(slot => {
              const key = slot ?? "__none__";
              const entries = grouped[key] ?? [];
              const SlotIcon = slot ? SLOT_ICONS[slot] : null;
              const slotColor = slot ? SLOT_COLORS[slot] : null;
              const label = slot ? SLOT_LABELS[slot] : "Other";
              const isExpanded = expandedSlots.has(key);
              const isEmpty = entries.length === 0;

              const confirmed = entries.filter(e => e.confirmed !== false);
              const hasPlanned = entries.some(e => e.confirmed === false);
              const slotCal = confirmed.reduce((s, e) => s + e.calories, 0);
              const slotProt = confirmed.reduce((s, e) => s + e.protein, 0);
              const slotCarbs = confirmed.reduce((s, e) => s + e.carbs, 0);
              const slotFat = confirmed.reduce((s, e) => s + e.fat, 0);

              const isRealSlot = slot !== null;

              return (
                <DroppableSlot key={key} slotKey={key} isValidTarget={isRealSlot}>
                <div
                  data-testid={`diary-widget-slot-${key}`}
                  className={`rounded-2xl border transition-colors overflow-hidden ${
                    isExpanded ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSlot(key)}
                    data-testid={`button-expand-diary-slot-${key}`}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-zinc-100/60 transition-colors"
                  >
                    {SlotIcon != null && slotColor ? (
                      <div className={`p-1.5 rounded-lg ${slotColor}`}>
                        <SlotIcon className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-400">
                        <ClipboardList className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-700">{label}</span>
                        {hasPlanned && (
                          <span className="text-[9px] font-medium px-1 py-0.5 bg-zinc-200 text-zinc-500 rounded">
                            planned
                          </span>
                        )}
                      </div>
                      {!isEmpty ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-bold text-zinc-800">{slotCal} kcal</span>
                          <span className="text-[10px] text-zinc-400">
                            P {slotProt}g · C {slotCarbs}g · F {slotFat}g
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-400 mt-0.5">No entries yet</p>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
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
                        <div className="px-3 pb-2.5 border-t border-zinc-100">
                          <div className="space-y-1.5 mt-2">
                            {entries.map(entry => {
                              const isPlanned = entry.confirmed === false;
                              const isDeleting = deletingId === entry.id;
                              return (
                                <DraggableEntry key={entry.id} entry={entry}>
                                <div
                                  className={`flex items-center gap-1.5 py-2 px-2.5 rounded-xl border border-zinc-100 bg-white hover:bg-zinc-50 transition-colors flex-1 min-w-0 ${
                                    isPlanned ? "opacity-55" : ""
                                  }`}
                                  data-testid={`diary-widget-entry-${entry.id}`}
                                >
                                  <p className={`text-xs truncate flex-1 ${
                                    isPlanned ? "text-zinc-400 italic" : "text-zinc-600"
                                  }`}>
                                    {entry.mealName}
                                    {isPlanned && (
                                      <span className="ml-1 text-[10px] not-italic text-zinc-400">(Planned)</span>
                                    )}
                                  </p>
                                  <span className="text-[11px] text-zinc-500 font-medium shrink-0">
                                    {entry.calories} kcal
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry); }}
                                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors shrink-0"
                                    data-testid={`button-diary-widget-edit-${entry.id}`}
                                    aria-label="Edit entry"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); confirm({ title: "Delete entry?", description: `Remove "${entry.mealName}" from your food log?`, confirmLabel: "Delete", onConfirm: () => deleteMutation.mutate(entry.id) }); }}
                                    disabled={isDeleting}
                                    className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
                                    data-testid={`button-diary-widget-delete-${entry.id}`}
                                    aria-label="Delete entry"
                                  >
                                    {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                  </button>
                                </div>
                                </DraggableEntry>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => {
                                setDrawerDefaultSlot(slot);
                                setDrawerOpen(true);
                              }}
                              className="flex items-center justify-center w-full py-3 rounded-xl border border-dashed border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
                              data-testid={`button-add-to-slot-${key}`}
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                </DroppableSlot>
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDragEntry && (
              <div className="bg-white rounded-xl border border-zinc-200 shadow-lg px-3 py-2 flex items-center gap-2 max-w-[280px] opacity-90">
                <GripVertical className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <p className="text-xs text-zinc-700 truncate flex-1">{activeDragEntry.mealName}</p>
                <span className="text-[11px] text-zinc-500 font-medium shrink-0">{activeDragEntry.calories} kcal</span>
              </div>
            )}
          </DragOverlay>
          </DndContext>
        )}
      </div>

      <FoodLogDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setDrawerDefaultSlot(null); }}
        selectedDate={selectedDate}
        dailyTotals={{ calories: totalCal, protein: totalProt, carbs: totalCarbs, fat: totalFat }}
        dailyTargets={{ calories: calTarget, protein: protTarget, carbs: carbsTarget, fat: fatTarget }}
        defaultSlot={drawerDefaultSlot}
      />

      {selectedEntry && (
        <LoggedMealModal
          entry={selectedEntry}
          userRecipes={[]}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      <ConfirmDialog {...dialogProps} />

      {moveCopyDialog && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setMoveCopyDialog(null)}
          data-testid="dialog-move-copy-overlay"
        >
          <div
            className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
            data-testid="dialog-move-copy"
          >
            <h3 className="text-sm font-bold text-zinc-900 mb-1">Move or Copy?</h3>
            <p className="text-xs text-zinc-500 mb-4">
              "{moveCopyDialog.entry.mealName}" → {SLOT_LABELS[moveCopyDialog.targetSlot]}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => moveMutation.mutate({ id: moveCopyDialog.entry.id, mealSlot: moveCopyDialog.targetSlot })}
                disabled={moveMutation.isPending || copyMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                data-testid="button-move-entry"
              >
                {moveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                Move
              </button>
              <button
                type="button"
                onClick={() => copyMutation.mutate({ entry: moveCopyDialog.entry, mealSlot: moveCopyDialog.targetSlot })}
                disabled={moveMutation.isPending || copyMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                data-testid="button-copy-entry"
              >
                {copyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMoveCopyDialog(null)}
              className="w-full mt-2 py-2 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
              data-testid="button-cancel-move-copy"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
