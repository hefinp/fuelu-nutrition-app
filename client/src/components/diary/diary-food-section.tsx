import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Trash2, Plus, ClipboardList, ChevronDown, Pencil,
  GripVertical, ArrowRight, Copy, ChevronsUpDown,
} from "lucide-react";
import {
  SLOT_ICONS, SLOT_COLORS, SLOT_LABELS,
  LoggedMealModal,
} from "@/components/food-log-shared";
import type { FoodLogEntry, MealSlot } from "@/components/food-log-shared";
import { ConfirmDialog, useConfirmDialog } from "@/components/confirm-dialog";
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

interface DiaryFoodSectionProps {
  dailyEntries: FoodLogEntry[];
  isLoading: boolean;
  onOpenDrawer: (slot?: MealSlot | null) => void;
}

export function DiaryFoodSection({ dailyEntries, isLoading, onOpenDrawer }: DiaryFoodSectionProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());
  const [selectedEntry, setSelectedEntry] = useState<FoodLogEntry | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeDragEntry, setActiveDragEntry] = useState<FoodLogEntry | null>(null);
  const [moveCopyDialog, setMoveCopyDialog] = useState<MoveCopyDialogState | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

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

  const slotOrder: (MealSlot | null)[] = ["breakfast", "lunch", "dinner", "snack", "drinks", null];
  const grouped: Record<string, FoodLogEntry[]> = {};
  for (const entry of dailyEntries) {
    const key = entry.mealSlot ?? "__none__";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }
  const orderedSlots = slotOrder.filter(s => s !== null || (grouped["__none__"]?.length ?? 0) > 0);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-1.5 -mx-1 px-1">
          {orderedSlots.map(slot => {
            const key = slot ?? "__none__";
            const entries = grouped[key] ?? [];
            const SlotIcon = slot ? SLOT_ICONS[slot] : null;
            const slotColor = slot ? SLOT_COLORS[slot] : null;
            const label = slot ? SLOT_LABELS[slot] : "Other";
            const isExpanded = expandedSlots.has(key);
            const isEmpty = entries.length === 0;
            const isRealSlot = slot !== null;

            const confirmed = entries.filter(e => e.confirmed !== false);
            const hasPlanned = entries.some(e => e.confirmed === false);
            const slotCal = confirmed.reduce((s, e) => s + e.calories, 0);
            const slotProt = confirmed.reduce((s, e) => s + e.protein, 0);
            const slotCarbs = confirmed.reduce((s, e) => s + e.carbs, 0);
            const slotFat = confirmed.reduce((s, e) => s + e.fat, 0);

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
                              onClick={() => onOpenDrawer(slot)}
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

        {orderedSlots.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const allKeys = orderedSlots.map(s => s ?? "__none__");
              const allExpanded = allKeys.every(k => expandedSlots.has(k));
              setExpandedSlots(allExpanded ? new Set() : new Set(allKeys));
            }}
            className="flex items-center justify-center gap-1.5 w-full mt-2 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
            data-testid="button-expand-collapse-all-slots"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
            {orderedSlots.map(s => s ?? "__none__").every(k => expandedSlots.has(k)) ? "Collapse All" : "Expand All"}
          </button>
        )}

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
