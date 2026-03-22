import { storage } from "./storage";
import type { User, Tier } from "@shared/schema";

const TIER_RANK: Record<string, number> = {
  free: 0,
  simple: 1,
  advanced: 2,
  payg: 1,
};

export function getTierRank(tier: string): number {
  return TIER_RANK[tier] ?? 0;
}

export async function hasTierAccess(user: User, featureKey: string): Promise<boolean> {
  if (user.betaUser && !user.betaTierLocked) return true;

  const effectiveTier = getEffectiveTier(user);
  const uiTier = effectiveTier === "payg" ? "free" : effectiveTier;

  const gate = await storage.getFeatureGate(featureKey);
  if (!gate) return true;

  const userRank = getTierRank(uiTier);
  const requiredRank = getTierRank(gate.requiredTier);

  return userRank >= requiredRank;
}

export async function deductCredits(_userId: number, _featureKey: string): Promise<boolean> {
  return true;
}

export function getEffectiveTier(user: User): Tier {
  const storedTier = (user.tier as Tier) || "free";

  if (user.betaUser) {
    return storedTier;
  }

  if (user.tierExpiresAt && new Date(user.tierExpiresAt) < new Date()) {
    return "free";
  }

  return storedTier;
}

export async function getUserTierStatus(user: User) {
  const effectiveTier = getEffectiveTier(user);
  const uiTier = effectiveTier === "payg" ? "free" : effectiveTier;
  const gates = await storage.getFeatureGates();
  const tierRank = getTierRank(uiTier);

  const features: Record<string, boolean> = {};
  for (const gate of gates) {
    if (user.betaUser && !user.betaTierLocked) {
      features[gate.featureKey] = true;
    } else {
      features[gate.featureKey] = tierRank >= getTierRank(gate.requiredTier);
    }
  }

  return {
    tier: uiTier,
    betaUser: user.betaUser,
    creditBalance: user.creditBalance,
    tierExpiresAt: user.tierExpiresAt,
    pendingTier: user.pendingTier,
    paymentFailedAt: user.paymentFailedAt,
    monthlySpend: 0,
    suggestUpgrade: null,
    features,
  };
}
