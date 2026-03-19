import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { arrayMove } from "@dnd-kit/sortable";
import type { UserPreferences } from "@shared/schema";

export type WidgetId =
  | "nutrition"
  | "my-meals-food"
  | "food-log"
  | "meal-plan"
  | "hydration"
  | "weight"
  | "cycle"
  | "vitality";

// Planning widgets go in the left desktop column and the Planning mobile tab
export const PLANNING_WIDGETS = new Set<WidgetId>(["meal-plan", "my-meals-food", "nutrition"]);

// Default stacking order — planning widgets first so Meal Planner is at top of Planning tab
export const DEFAULT_ORDER: WidgetId[] = [
  "meal-plan",
  "my-meals-food",
  "nutrition",
  "food-log",
  "cycle",
  "vitality",
  "hydration",
  "weight",
];

// All known widget IDs — used to merge new widgets into saved layouts
const ALL_WIDGET_IDS: WidgetId[] = DEFAULT_ORDER;

// Legacy IDs that no longer exist — strip from saved layouts and replace if needed
const LEGACY_ID_MAP: Partial<Record<string, WidgetId>> = {
  "recipe-library": "my-meals-food",
  "favourites": undefined as any,
};

export function useDashboardLayout(isLoggedIn: boolean) {
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    enabled: isLoggedIn,
  });

  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(DEFAULT_ORDER);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!prefs) return;
    const saved = prefs.dashboardLayout?.order;
    if (saved?.length) {
      // Migrate legacy IDs: replace recipe-library → my-meals-food, remove favourites
      let base = (saved as string[]).flatMap(id => {
        const mapped = LEGACY_ID_MAP[id];
        if (id in LEGACY_ID_MAP) {
          return mapped ? [mapped as WidgetId] : [];
        }
        return [id as WidgetId];
      });
      // Merge any new widget IDs that aren't in the migrated layout
      const merged = [...base];
      for (const id of ALL_WIDGET_IDS) {
        if (!merged.includes(id)) {
          const anchor = merged.indexOf("food-log");
          merged.splice(anchor >= 0 ? anchor + 1 : merged.length, 0, id);
        }
      }
      setWidgetOrder(merged);
    }
  }, [prefs]);

  // Desktop: derived left (planning) / right (tracking) from flat order
  const leftOrder = widgetOrder.filter(id => PLANNING_WIDGETS.has(id));
  const rightOrder = widgetOrder.filter(id => !PLANNING_WIDGETS.has(id));

  // Reorder within the left column (desktop drag)
  const setLeftOrder = useCallback((updater: (prev: WidgetId[]) => WidgetId[]) => {
    setWidgetOrder(prev => {
      const newLeft = updater(prev.filter(id => PLANNING_WIDGETS.has(id)));
      const right = prev.filter(id => !PLANNING_WIDGETS.has(id));
      return mergeOrders(prev, newLeft, right);
    });
  }, []);

  const setRightOrder = useCallback((updater: (prev: WidgetId[]) => WidgetId[]) => {
    setWidgetOrder(prev => {
      const left = prev.filter(id => PLANNING_WIDGETS.has(id));
      const newRight = updater(prev.filter(id => !PLANNING_WIDGETS.has(id)));
      return mergeOrders(prev, left, newRight);
    });
  }, []);

  // Mobile: move a widget up or down within its tab group in the flat list
  const moveUp = useCallback((id: WidgetId) => {
    setWidgetOrder(prev => {
      const isPlanning = PLANNING_WIDGETS.has(id);
      const groupIds = prev.filter(w => PLANNING_WIDGETS.has(w) === isPlanning);
      const groupIdx = groupIds.indexOf(id);
      if (groupIdx <= 0) return prev;
      const newGroup = arrayMove(groupIds, groupIdx, groupIdx - 1);
      // Rebuild full order preserving the other group's positions
      const result: WidgetId[] = [];
      let gi = 0;
      for (const w of prev) {
        if (PLANNING_WIDGETS.has(w) === isPlanning) {
          result.push(newGroup[gi++]);
        } else {
          result.push(w);
        }
      }
      return result;
    });
  }, []);

  const moveDown = useCallback((id: WidgetId) => {
    setWidgetOrder(prev => {
      const isPlanning = PLANNING_WIDGETS.has(id);
      const groupIds = prev.filter(w => PLANNING_WIDGETS.has(w) === isPlanning);
      const groupIdx = groupIds.indexOf(id);
      if (groupIdx < 0 || groupIdx >= groupIds.length - 1) return prev;
      const newGroup = arrayMove(groupIds, groupIdx, groupIdx + 1);
      const result: WidgetId[] = [];
      let gi = 0;
      for (const w of prev) {
        if (PLANNING_WIDGETS.has(w) === isPlanning) {
          result.push(newGroup[gi++]);
        } else {
          result.push(w);
        }
      }
      return result;
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: (order: WidgetId[]) =>
      apiRequest("PUT", "/api/user/preferences", {
        ...prefs,
        dashboardLayout: { order },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    },
  });

  const saveLayout = useCallback(() => {
    saveMutation.mutate(widgetOrder);
    setIsEditing(false);
  }, [widgetOrder, saveMutation]);

  const cancelEdit = useCallback(() => {
    const saved = prefs?.dashboardLayout?.order;
    setWidgetOrder((saved as WidgetId[] | undefined) ?? DEFAULT_ORDER);
    setIsEditing(false);
  }, [prefs]);

  return {
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
    isSaving: saveMutation.isPending,
  };
}

// Re-merge left and right back into a flat order, preserving original positions
function mergeOrders(
  original: WidgetId[],
  newLeft: WidgetId[],
  newRight: WidgetId[]
): WidgetId[] {
  const result: WidgetId[] = [];
  let li = 0;
  let ri = 0;
  for (const id of original) {
    if (PLANNING_WIDGETS.has(id)) {
      if (li < newLeft.length) result.push(newLeft[li++]);
    } else {
      if (ri < newRight.length) result.push(newRight[ri++]);
    }
  }
  return result;
}
