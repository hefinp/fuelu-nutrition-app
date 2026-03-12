import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { UserPreferences } from "@shared/schema";

export type WidgetId =
  | "nutrition"
  | "recipe-library"
  | "food-log"
  | "meal-plan"
  | "hydration"
  | "weight";

export const DEFAULT_LEFT: WidgetId[] = ["nutrition", "recipe-library"];
export const DEFAULT_RIGHT: WidgetId[] = ["food-log", "meal-plan", "hydration", "weight"];

export function useDashboardLayout(isLoggedIn: boolean) {
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    enabled: isLoggedIn,
  });

  const [leftOrder, setLeftOrder] = useState<WidgetId[]>(DEFAULT_LEFT);
  const [rightOrder, setRightOrder] = useState<WidgetId[]>(DEFAULT_RIGHT);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!prefs) return;
    const layout = prefs.dashboardLayout;
    if (layout?.left?.length) setLeftOrder(layout.left as WidgetId[]);
    if (layout?.right?.length) setRightOrder(layout.right as WidgetId[]);
  }, [prefs]);

  const saveMutation = useMutation({
    mutationFn: (layout: { left: WidgetId[]; right: WidgetId[] }) =>
      apiRequest("PUT", "/api/user/preferences", {
        ...prefs,
        dashboardLayout: layout,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    },
  });

  const saveLayout = useCallback(() => {
    saveMutation.mutate({ left: leftOrder, right: rightOrder });
    setIsEditing(false);
  }, [leftOrder, rightOrder, saveMutation]);

  const cancelEdit = useCallback(() => {
    // Reset to what's saved
    const layout = prefs?.dashboardLayout;
    setLeftOrder((layout?.left as WidgetId[] | undefined) ?? DEFAULT_LEFT);
    setRightOrder((layout?.right as WidgetId[] | undefined) ?? DEFAULT_RIGHT);
    setIsEditing(false);
  }, [prefs]);

  return {
    leftOrder,
    rightOrder,
    setLeftOrder,
    setRightOrder,
    isEditing,
    setIsEditing,
    saveLayout,
    cancelEdit,
    isSaving: saveMutation.isPending,
  };
}
