import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export interface TierStatus {
  tier: string;
  betaUser: boolean;
  creditBalance: number;
  tierExpiresAt: string | null;
  pendingTier: string | null;
  paymentFailedAt: string | null;
  monthlySpend: number;
  suggestUpgrade: string | null;
  features: Record<string, boolean>;
}

export interface TierPricingItem {
  id: number;
  tier: string;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  active: boolean;
  features: string[];
  displayOrder: number;
}

export interface CreditPackItem {
  id: number;
  credits: number;
  priceUsd: number;
  active: boolean;
}

export function useTierStatus() {
  const { user } = useAuth();
  return useQuery<TierStatus>({
    queryKey: ["/api/tier/status"],
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

export function useTierPricing() {
  return useQuery<{ tiers: TierPricingItem[]; creditPacks: CreditPackItem[] }>({
    queryKey: ["/api/tier/pricing"],
    staleTime: 5 * 60 * 1000,
  });
}

export function useHasFeature(featureKey: string): boolean {
  const { data } = useTierStatus();
  if (!data) return false;
  if (data.betaUser) return true;
  return data.features[featureKey] ?? false;
}
