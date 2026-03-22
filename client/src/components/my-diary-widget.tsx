import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  NotebookPen, ChevronLeft, ChevronRight, Loader2, Trash2,
  Plus, Droplets, Activity, Flame, Clock, MapPin, X, Scale,
} from "lucide-react";
import { getActivityIcon } from "@/lib/activityIcons";
import {
  MacroGrid, SLOT_ICONS, SLOT_COLORS, SLOT_LABELS,
  todayStr, formatDateLabel, shiftDate,
} from "@/components/food-log-shared";
import type { FoodLogEntry, MealSlot } from "@/components/food-log-shared";
import { FoodLogDrawer } from "@/components/food-log-drawer";

interface MyDiaryWidgetProps {
  calTarget?: number;
  protTarget?: number;
  carbsTarget?: number;
  fatTarget?: number;
}

interface DiaryActivityData {
  id: number;
  name: string;
  type: string;
  movingTime: number;
  distance: number;
  calories: number;
  averageHeartrate: number | null;
}


const QUICK_WATER_AMOUNTS = [250, 500, 750, 1000];

export function MyDiaryWidget({ calTarget, protTarget, carbsTarget, fatTarget }: MyDiaryWidgetProps) {
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
    mutationFn: (id: number) => apiRequest("DELETE", `/api/food-log/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

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

  const slotOrder: (MealSlot | null)[] = ["breakfast", "lunch", "dinner", "snack", "drinks", null];
  const grouped: Record<string, FoodLogEntry[]> = {};
  for (const entry of dailyEntries) {
    const key = entry.mealSlot ?? "__none__";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }
  const orderedSlots = slotOrder.filter(s => grouped[s ?? "__none__"]?.length > 0);

  const activities = activityData?.activities ?? [];
  const totalActivityCal = activityData?.totalCalories ?? 0;

  const handleCustomWaterAdd = () => {
    const val = parseInt(customWater);
    if (!val || val <= 0) return;
    waterMutation.mutate(val);
  };

  return (
    <>
      <div className="bg-white rounded-3xl border border-zinc-100 shadow-md p-4 sm:p-6" data-testid="widget-my-diary">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
            <NotebookPen className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-display font-bold text-zinc-900">My Diary</h3>
            <p className="text-xs text-zinc-400">Your daily food log</p>
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
                    <div key={a.id} className="flex items-center gap-2 py-1" data-testid={`diary-widget-activity-${a.id}`}>
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

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
          <div className="space-y-4 max-h-[400px] overflow-y-auto -mx-1 px-1">
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
                          data-testid={`diary-widget-entry-${entry.id}`}
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
                            data-testid={`button-diary-widget-delete-${entry.id}`}
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

      <FoodLogDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedDate={selectedDate}
        dailyTotals={{ calories: totalCal, protein: totalProt, carbs: totalCarbs, fat: totalFat }}
        dailyTargets={{ calories: calTarget, protein: protTarget, carbs: carbsTarget, fat: fatTarget }}
      />
    </>
  );
}
