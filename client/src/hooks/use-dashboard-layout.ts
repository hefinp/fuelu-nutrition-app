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
  | "vitality"
  | "weekly-summary"
  | "adaptive-tdee"
  | "macro-compliance";

// Planning widgets go in the left desktop column and the Planning mobile tab
export const PLANNING_WIDGETS = new Set<WidgetId>(["meal-plan", "my-meals-food", "nutrition"]);

// Insights widgets go in the right-most desktop column and the Insights mobile tab
export const INSIGHTS_WIDGETS = new Set<WidgetId>([
  "weight",
  "cycle",
  "vitality",
  "weekly-summary",
  "adaptive-tdee",
  "macro-compliance",
]);

// Tracking widgets = everything not in PLANNING_WIDGETS and not in INSIGHTS_WIDGETS
// (currently: food-log, hydration)

// Default stacking order
export const DEFAULT_ORDER: WidgetId[] = [
  "meal-plan",
  "my-meals-food",
  "nutrition",
  "food-log",
  "hydration",
  "weekly-summary",
  "adaptive-tdee",
  "macro-compliance",
  "weight",
  "cycle",
  "vitality",
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

  // Desktop: derived left (planning) / centre (tracking) / right (insights) from flat order
  const leftOrder = widgetOrder.filter(id => PLANNING_WIDGETS.has(id));
  const rightOrder = widgetOrder.filter(id => !PLANNING_WIDGETS.has(id) && !INSIGHTS_WIDGETS.has(id));
  const insightsOrder = widgetOrder.filter(id => INSIGHTS_WIDGETS.has(id));

  // Reorder within the left column (desktop drag)
  const setLeftOrder = useCallback((updater: (prev: WidgetId[]) => WidgetId[]) => {
    setWidgetOrder(prev => {
      const newLeft = updater(prev.filter(id => PLANNING_WIDGETS.has(id)));
      const centre = prev.filter(id => !PLANNING_WIDGETS.has(id) && !INSIGHTS_WIDGETS.has(id));
      const right = prev.filter(id => INSIGHTS_WIDGETS.has(id));
      return mergeThreeOrders(prev, newLeft, centre, right);
    });
  }, []);

  const setRightOrder = useCallback((updater: (prev: WidgetId[]) => WidgetId[]) => {
    setWidgetOrder(prev => {
      const left = prev.filter(id => PLANNING_WIDGETS.has(id));
      const newCentre = updater(prev.filter(id => !PLANNING_WIDGETS.has(id) && !INSIGHTS_WIDGETS.has(id)));
      const right = prev.filter(id => INSIGHTS_WIDGETS.has(id));
      return mergeThreeOrders(prev, left, newCentre, right);
    });
  }, []);

  const setInsightsOrder = useCallback((updater: (prev: WidgetId[]) => WidgetId[]) => {
    setWidgetOrder(prev => {
      const left = prev.filter(id => PLANNING_WIDGETS.has(id));
      const centre = prev.filter(id => !PLANNING_WIDGETS.has(id) && !INSIGHTS_WIDGETS.has(id));
      const newRight = updater(prev.filter(id => INSIGHTS_WIDGETS.has(id)));
      return mergeThreeOrders(prev, left, centre, newRight);
    });
  }, []);

  // Mobile: move a widget up or down within its tab group in the flat list
  const moveUp = useCallback((id: WidgetId) => {
    setWidgetOrder(prev => {
      const group = getGroup(id);
      const groupIds = prev.filter(w => getGroup(w) === group);
      const groupIdx = groupIds.indexOf(id);
      if (groupIdx <= 0) return prev;
      const newGroup = arrayMove(groupIds, groupIdx, groupIdx - 1);
      const result: WidgetId[] = [];
      let gi = 0;
      for (const w of prev) {
        if (getGroup(w) === group) {
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
      const group = getGroup(id);
      const groupIds = prev.filter(w => getGroup(w) === group);
      const groupIdx = groupIds.indexOf(id);
      if (groupIdx < 0 || groupIdx >= groupIds.length - 1) return prev;
      const newGroup = arrayMove(groupIds, groupIdx, groupIdx + 1);
      const result: WidgetId[] = [];
      let gi = 0;
      for (const w of prev) {
        if (getGroup(w) === group) {
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
    insightsOrder,
    setLeftOrder,
    setRightOrder,
    setInsightsOrder,
    moveUp,
    moveDown,
    isEditing,
    setIsEditing,
    saveLayout,
    cancelEdit,
    isSaving: saveMutation.isPending,
  };
}

// Determine which group (planning / tracking / insights) a widget belongs to
function getGroup(id: WidgetId): "planning" | "tracking" | "insights" {
  if (PLANNING_WIDGETS.has(id)) return "planning";
  if (INSIGHTS_WIDGETS.has(id)) return "insights";
  return "tracking";
}

// Re-merge left, centre and right back into a flat order, preserving original positions
function mergeThreeOrders(
  original: WidgetId[],
  newLeft: WidgetId[],
  newCentre: WidgetId[],
  newRight: WidgetId[]
): WidgetId[] {
  const result: WidgetId[] = [];
  let li = 0;
  let ci = 0;
  let ri = 0;
  for (const id of original) {
    if (PLANNING_WIDGETS.has(id)) {
      if (li < newLeft.length) result.push(newLeft[li++]);
    } else if (INSIGHTS_WIDGETS.has(id)) {
      if (ri < newRight.length) result.push(newRight[ri++]);
    } else {
      if (ci < newCentre.length) result.push(newCentre[ci++]);
    }
  }
  return result;
}
