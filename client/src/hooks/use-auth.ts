import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PublicUser } from "@shared/schema";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<PublicUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json() as Promise<PublicUser>;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      queryClient.removeQueries({ queryKey: ["/api/nutritionist/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calculations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log/free-weekly-summary"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; name: string; password: string; inviteCode?: string; nutritionistInviteToken?: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json() as Promise<PublicUser>;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      queryClient.removeQueries({ queryKey: ["/api/nutritionist/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calculations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log/free-weekly-summary"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.removeQueries({ queryKey: ["/api/nutritionist/profile"] });
      queryClient.removeQueries({ queryKey: ["/api/nutritionist/clients"] });
      queryClient.removeQueries({ queryKey: ["/api/calculations"] });
      queryClient.removeQueries({ queryKey: ["/api/saved-meal-plans"] });
      queryClient.removeQueries({ queryKey: ["/api/user/preferences"] });
      queryClient.removeQueries({ queryKey: ["/api/tier/status"] });
      queryClient.removeQueries({ queryKey: ["/api/food-log/free-weekly-summary"] });
    },
  });

  return {
    user: user ?? null,
    isLoading,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: () => logoutMutation.mutateAsync(),
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
