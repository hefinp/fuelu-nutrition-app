import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { arrayMove } from "@dnd-kit/sortable";
import type { UserPreferences } from "@shared/schema";

export type WidgetId =
  | "nutrition"
  | "my-meals-food"
  | "my-diary"
  | "food-log"
  | "meal-plan"
  | "hydration"
  | "activity"
  | "weight"
  | "cycle"
  | "vitality"
  | "weekly-summary"
  | "adaptive-tdee"
  | "macro-compliance"
  | "my-momentum";

export const HOME_WIDGETS = new Set<WidgetId>(["my-momentum", "my-diary", "my-meals-food"]);

export const PLANNING_WIDGETS = new Set<WidgetId>(["meal-plan", "nutrition"]);

export const INSIGHTS_WIDGETS = new Set<WidgetId>([
  "weight",
  "cycle",
  "vitality",
  "weekly-summary",
  "adaptive-tdee",
  "macro-compliance",
]);

export const DEFAULT_ORDER: WidgetId[] = [
  "my-momentum",
  "my-diary",
  "my-meals-food",
  "meal-plan",
  "nutrition",
  "food-log",
  "hydration",
  "activity",
  "weekly-summary",
  "adaptive-tdee",
  "macro-compliance",
  "weight",
  "cycle",
  "vitality",
];

const ALL_WIDGET_IDS: WidgetId[] = DEFAULT_ORDER;

// Legacy IDs that no longer exist — strip from saved layouts and replace if needed
const LEGACY_ID_MAP: Record<string, WidgetId | undefined> = {
  "recipe-library": "my-meals-food",
  "favourites": undefined,
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
      let base = (saved as string[]).flatMap(id => {
        const mapped = LEGACY_ID_MAP[id];
        if (id in LEGACY_ID_MAP) {
          return mapped ? [mapped as WidgetId] : [];
        }
        return [id as WidgetId];
      });
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

  const homeOrder = widgetOrder.filter(id => HOME_WIDGETS.has(id));
  const leftOrder = widgetOrder.filter(id => PLANNING_WIDGETS.has(id));
  const rightOrder = widgetOrder.filter(id => !HOME_WIDGETS.has(id) && !PLANNING_WIDGETS.has(id) && !INSIGHTS_WIDGETS.has(id));
  const insightsOrder = widgetOrder.filter(id => INSIGHTS_WIDGETS.has(id));

  const setHomeOrder = useCallback((updater: (prev: WidgetId[]) => WidgetId[]) => {
    setWidgetOrder(prev => {
      const newHome = updater(prev.filter(id => HOME_WIDGETS.has(id)));
      const left = prev.filter(id => PLANNING_WIDGETS.has(id));
      const centre = prev.filter(id => !HOME_WIDGETS.has(id) && !PLANNING_WIDGETS.has(id) && !INSIGHTS_WIDGETS.has(id));
      const right = prev.filter(id => INSIGHTS_WIDGETS.has(id));
      return mergeFourOrders(prev, newHome, left, centre, right);
    });
  }, []);

  const setLeftOrder = useCallback((updater: (prev: WidgetId[]) => WidgetId[]) => {
    setWidgetOrder(prev => {
      const home = prev.filter(id => HOME_WIDGETS.has(id));
      const newLeft = updater(prev.filter(id => PLANNING_WIDGETS.has(id)));
      const centre = prev.filter(id => !HOME_WIDGETS.has(id) && !PLANNING_WIDGETS.has(id) && !INSIGHTS_WIDGETS.has(id));
      const right = prev.filter(id => INSIGHTS_WIDGETS.has(id));
      return mergeFourOrders(prev, home, newLeft, centre, right);
    });
  }, []);

  const setRightOrder = useCallback((updater: (prev: WidgetId[]) => WidgetId[]) => {
    setWidgetOrder(prev => {
      const home = prev.filter(id => HOME_WIDGETS.has(id));
      const left = prev.filter(id => PLANNING_WIDGETS.has(id));
      const newCentre = updater(prev.filter(id => !HOME_WIDGETS.has(id) && !PLANNING_WIDGETS.has(id) && !INSIGHTS_WIDGETS.has(id)));
      const right = prev.filter(id => INSIGHTS_WIDGETS.has(id));
      return mergeFourOrders(prev, home, left, newCentre, right);
    });
  }, []);

  const setInsightsOrder = useCallback((updater: (prev: WidgetId[]) => WidgetId[]) => {
    setWidgetOrder(prev => {
      const home = prev.filter(id => HOME_WIDGETS.has(id));
      const left = prev.filter(id => PLANNING_WIDGETS.has(id));
      const centre = prev.filter(id => !HOME_WIDGETS.has(id) && !PLANNING_WIDGETS.has(id) && !INSIGHTS_WIDGETS.has(id));
      const newRight = updater(prev.filter(id => INSIGHTS_WIDGETS.has(id)));
      return mergeFourOrders(prev, home, left, centre, newRight);
    });
  }, []);

  const moveUp = useCallback((id: WidgetId) => {
    setWidgetOrder(prev => {
      const group = getMobileGroup(id);
      const groupIds = prev.filter(w => getMobileGroup(w) === group);
      const groupIdx = groupIds.indexOf(id);
      if (groupIdx <= 0) return prev;
      const newGroup = arrayMove(groupIds, groupIdx, groupIdx - 1);
      const result: WidgetId[] = [];
      let gi = 0;
      for (const w of prev) {
        if (getMobileGroup(w) === group) {
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
      const group = getMobileGroup(id);
      const groupIds = prev.filter(w => getMobileGroup(w) === group);
      const groupIdx = groupIds.indexOf(id);
      if (groupIdx < 0 || groupIdx >= groupIds.length - 1) return prev;
      const newGroup = arrayMove(groupIds, groupIdx, groupIdx + 1);
      const result: WidgetId[] = [];
      let gi = 0;
      for (const w of prev) {
        if (getMobileGroup(w) === group) {
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
    isSaving: saveMutation.isPending,
  };
}

export const MOBILE_PLANNING_IDS = new Set<WidgetId>(["meal-plan", "nutrition", "my-meals-food"]);
export const MOBILE_INSIGHTS_IDS = new Set<WidgetId>(["weight", "cycle", "vitality", "weekly-summary", "adaptive-tdee", "macro-compliance", "my-momentum"]);

function getMobileGroup(id: WidgetId): "planning" | "tracking" | "insights" {
  if (MOBILE_PLANNING_IDS.has(id)) return "planning";
  if (MOBILE_INSIGHTS_IDS.has(id)) return "insights";
  return "tracking";
}

function mergeFourOrders(
  original: WidgetId[],
  newHome: WidgetId[],
  newLeft: WidgetId[],
  newCentre: WidgetId[],
  newRight: WidgetId[]
): WidgetId[] {
  const result: WidgetId[] = [];
  let hi = 0;
  let li = 0;
  let ci = 0;
  let ri = 0;
  for (const id of original) {
    if (HOME_WIDGETS.has(id)) {
      if (hi < newHome.length) result.push(newHome[hi++]);
    } else if (PLANNING_WIDGETS.has(id)) {
      if (li < newLeft.length) result.push(newLeft[li++]);
    } else if (INSIGHTS_WIDGETS.has(id)) {
      if (ri < newRight.length) result.push(newRight[ri++]);
    } else {
      if (ci < newCentre.length) result.push(newCentre[ci++]);
    }
  }
  return result;
}
