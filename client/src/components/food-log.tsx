import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Plus, ClipboardList, BookOpen, ChevronDown, Pencil, Trash2,
} from "lucide-react";
import {
  type MealSlot, type FoodLogEntry,
  SLOT_LABELS, SLOT_ICONS, SLOT_COLORS, ALL_SLOTS,
  todayStr,
  DarkMacroCard,
  LoggedMealModal,
} from "@/components/food-log-shared";
import { FoodLogDrawer } from "@/components/food-log-drawer";
import { TemplateSuggestions } from "@/components/template-suggestions";
import { ConfirmDialog, useConfirmDialog } from "@/components/confirm-dialog";
import { useActiveFlow } from "@/contexts/active-flow-context";

export type { PrefillEntry } from "@/components/food-log-shared";

interface FoodLogProps {
  dailyCaloriesTarget?: number;
  dailyProteinTarget?: number;
  dailyCarbsTarget?: number;
  dailyFatTarget?: number;
  dailyFibreTarget?: number;
  dailySugarTarget?: number;
  dailySaturatedFatTarget?: number;
  prefill?: import("@/components/food-log-shared").PrefillEntry | null;
  onPrefillConsumed?: () => void;
}

export function FoodLog({
  dailyCaloriesTarget, dailyProteinTarget, dailyCarbsTarget, dailyFatTarget,
  dailyFibreTarget, dailySugarTarget, dailySaturatedFatTarget,
  prefill, onPrefillConsumed,
}: FoodLogProps) {
  const today = todayStr();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());
  const [selectedEntry, setSelectedEntry] = useState<FoodLogEntry | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { setFlowActive } = useActiveFlow();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      setDeletingId(id);
      await apiRequest("DELETE", `/api/food-log/${id}`);
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

  useEffect(() => {
    setFlowActive("food-log", drawerOpen);
    return () => setFlowActive("food-log", false);
  }, [drawerOpen, setFlowActive]);

  useEffect(() => {
    if (prefill) setDrawerOpen(true);
  }, [prefill]);

  const { data: dailyEntries = [], isLoading: dailyLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log", today],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?date=${today}`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load food log");
      return res.json();
    },
  });

  const confirmedDaily = dailyEntries.filter(e => e.confirmed !== false);
  const totalCal = confirmedDaily.reduce((s, e) => s + e.calories, 0);
  const totalProt = confirmedDaily.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = confirmedDaily.reduce((s, e) => s + e.carbs, 0);
  const totalFat = confirmedDaily.reduce((s, e) => s + e.fat, 0);
  const totalFibre = confirmedDaily.reduce((s, e) => s + (e.fibre ?? 0), 0);
  const totalSugar = confirmedDaily.reduce((s, e) => s + (e.sugar ?? 0), 0);
  const totalSatFat = confirmedDaily.reduce((s, e) => s + (e.saturatedFat ?? 0), 0);
  const hasExtendedMacros = confirmedDaily.some(e => e.fibre != null || e.sugar != null || e.saturatedFat != null) || dailyFibreTarget != null || dailySugarTarget != null || dailySaturatedFatTarget != null;

  const plannedDaily = dailyEntries.filter(e => e.confirmed === false);
  const plannedCal = plannedDaily.reduce((s, e) => s + e.calories, 0);

  const bySlot: Record<string, FoodLogEntry[]> = {};
  for (const slot of ALL_SLOTS) bySlot[slot] = [];
  bySlot["other"] = [];
  for (const e of dailyEntries) {
    const key = e.mealSlot && ALL_SLOTS.includes(e.mealSlot as MealSlot) ? e.mealSlot : "other";
    bySlot[key].push(e);
  }
  const filledSlots = [...ALL_SLOTS, "other"].filter(s => (bySlot[s] ?? []).length > 0);

  function toggleSlot(slot: string) {
    setExpandedSlots(prev => {
      const next = new Set(prev);
      next.has(slot) ? next.delete(slot) : next.add(slot);
      return next;
    });
  }

  const allExpanded = filledSlots.length > 0 && filledSlots.every(s => expandedSlots.has(s));

  function toggleAllDetail() {
    if (allExpanded) {
      setExpandedSlots(new Set());
    } else {
      setExpandedSlots(new Set(filledSlots));
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-md p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg shrink-0">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-display font-bold text-zinc-900">Food Log</h3>
          <p className="text-xs text-zinc-400">Track what you eat today</p>
        </div>
      </div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
          data-testid="button-add-log-entry"
        >
          <Plus className="w-4 h-4" />
          Log Meal
        </button>
      </div>

      <DarkMacroCard
        cal={totalCal} prot={totalProt} carbs={totalCarbs} fat={totalFat}
        fibre={hasExtendedMacros ? totalFibre : undefined}
        sugar={hasExtendedMacros ? totalSugar : undefined}
        saturatedFat={hasExtendedMacros ? totalSatFat : undefined}
        calTarget={dailyCaloriesTarget} protTarget={dailyProteinTarget}
        carbsTarget={dailyCarbsTarget} fatTarget={dailyFatTarget}
        fibreTarget={dailyFibreTarget} sugarTarget={dailySugarTarget}
        saturatedFatTarget={dailySaturatedFatTarget}
      />

      {plannedDaily.length > 0 && (
        <p className="text-xs text-zinc-400 mb-3 flex items-center gap-1" data-testid="text-planned-summary">
          <span className="inline-block w-2 h-2 rounded-full bg-zinc-300" />
          {plannedDaily.length} planned meal{plannedDaily.length !== 1 ? "s" : ""} ({plannedCal} kcal) awaiting confirmation
        </p>
      )}

      <TemplateSuggestions date={today} />

      {dailyLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : dailyEntries.length === 0 ? (
        <div className="text-center py-6 text-zinc-400">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No entries for today.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filledSlots.map(slotKey => {
            const entries = bySlot[slotKey] ?? [];
            const sl = slotKey as MealSlot;
            const SlotIcon = SLOT_ICONS[sl];
            const slotColor = SLOT_COLORS[sl];
            const label = SLOT_LABELS[sl] ?? "Other";
            const isExpanded = expandedSlots.has(slotKey);

            const confirmed = entries.filter(e => e.confirmed !== false);
            const hasPlanned = entries.some(e => e.confirmed === false);
            const slotCal = confirmed.reduce((s, e) => s + e.calories, 0);
            const slotProt = confirmed.reduce((s, e) => s + e.protein, 0);
            const slotCarbs = confirmed.reduce((s, e) => s + e.carbs, 0);
            const slotFat = confirmed.reduce((s, e) => s + e.fat, 0);

            return (
              <div
                key={slotKey}
                data-testid={`widget-slot-${slotKey}`}
                className={`rounded-2xl border transition-colors overflow-hidden ${
                  isExpanded ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSlot(slotKey)}
                  data-testid={`button-expand-slot-${slotKey}`}
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-bold text-zinc-800">{slotCal} kcal</span>
                      <span className="text-[10px] text-zinc-400">
                        P {slotProt}g · C {slotCarbs}g · F {slotFat}g
                      </span>
                    </div>
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
                              <div
                                key={entry.id}
                                className={`flex items-center gap-1.5 py-2 px-2.5 rounded-xl border border-zinc-100 bg-white hover:bg-zinc-50 transition-colors ${
                                  isPlanned ? "opacity-55" : ""
                                }`}
                                data-testid={`log-entry-${entry.id}`}
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
                                  data-testid={`button-edit-entry-${entry.id}`}
                                  aria-label="Edit entry"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); confirm({ title: "Delete entry?", description: `Remove "${entry.mealName}" from your food log?`, confirmLabel: "Delete", onConfirm: () => deleteMutation.mutate(entry.id) }); }}
                                  disabled={isDeleting}
                                  className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
                                  data-testid={`button-delete-entry-${entry.id}`}
                                  aria-label="Delete entry"
                                >
                                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        {dailyEntries.length > 0 ? (
          <button
            type="button"
            onClick={toggleAllDetail}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
            data-testid="button-toggle-detail"
          >
            {allExpanded ? "Less detail" : "More detail"}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                allExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
        ) : (
          <span />
        )}
        <Link
          href={`/diary?date=${today}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
          data-testid="link-view-diary"
        >
          <BookOpen className="w-3.5 h-3.5" />
          View full diary
        </Link>
      </div>

      {(drawerOpen || !!prefill) && (
        <FoodLogDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          selectedDate={today}
          prefill={prefill}
          onPrefillConsumed={onPrefillConsumed}
          dailyTotals={{ calories: totalCal, protein: totalProt, carbs: totalCarbs, fat: totalFat }}
          dailyTargets={{ calories: dailyCaloriesTarget, protein: dailyProteinTarget, carbs: dailyCarbsTarget, fat: dailyFatTarget }}
        />
      )}

      {selectedEntry && (
        <LoggedMealModal
          entry={selectedEntry}
          userRecipes={[]}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
