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

  const gate = await storage.getFeatureGate(featureKey);
  if (!gate) return true;

  const userRank = getTierRank(effectiveTier);
  const requiredRank = getTierRank(gate.requiredTier);

  if (effectiveTier === "payg" && gate.creditCost > 0) {
    return user.creditBalance >= gate.creditCost;
  }

  return userRank >= requiredRank;
}

export async function deductCredits(userId: number, featureKey: string): Promise<boolean> {
  const gate = await storage.getFeatureGate(featureKey);
  if (!gate || gate.creditCost <= 0) return true;

  const user = await storage.getUserById(userId);
  if (!user) return false;
  if (user.betaUser) return true;

  if (user.tier !== "payg") return true;

  if (user.creditBalance < gate.creditCost) return false;

  await storage.adjustCreditBalance(userId, -gate.creditCost);

  const costUsd = await estimateCreditCostUsd(gate.creditCost);
  await storage.createCreditTransaction({
    userId,
    amount: -gate.creditCost,
    type: "usage",
    featureKey,
    description: `Used ${gate.creditCost} credits for ${featureKey}`,
    costUsd,
  });
  return true;
}

async function estimateCreditCostUsd(creditCount: number): Promise<number> {
  const packs = await storage.getCreditPacks();
  const activePacks = packs.filter(p => p.active);
  if (activePacks.length === 0) return 0;
  const cheapest = activePacks.reduce((a, b) => (a.priceUsd / a.credits) < (b.priceUsd / b.credits) ? a : b);
  return Math.round((cheapest.priceUsd / cheapest.credits) * creditCount);
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
  const gates = await storage.getFeatureGates();
  const tierRank = getTierRank(effectiveTier);

  const features: Record<string, boolean> = {};
  for (const gate of gates) {
    if (user.betaUser && !user.betaTierLocked) {
      features[gate.featureKey] = true;
    } else if (effectiveTier === "payg" && gate.creditCost > 0) {
      features[gate.featureKey] = user.creditBalance >= gate.creditCost;
    } else {
      features[gate.featureKey] = tierRank >= getTierRank(gate.requiredTier);
    }
  }

  let monthlySpendUsd = 0;
  let suggestUpgrade: string | null = null;
  if (effectiveTier === "payg" || user.creditBalance > 0) {
    monthlySpendUsd = await storage.getMonthlySpendUsd(user.id);
    const pricing = await storage.getTierPricing();
    const simplePricing = pricing.find(p => p.tier === "simple" && p.active);
    const advancedPricing = pricing.find(p => p.tier === "advanced" && p.active);

    if (advancedPricing && monthlySpendUsd >= advancedPricing.monthlyPriceUsd) {
      suggestUpgrade = "advanced";
    } else if (simplePricing && monthlySpendUsd >= simplePricing.monthlyPriceUsd) {
      suggestUpgrade = "simple";
    }
  }

  return {
    tier: effectiveTier,
    betaUser: user.betaUser,
    creditBalance: user.creditBalance,
    tierExpiresAt: user.tierExpiresAt,
    pendingTier: user.pendingTier,
    paymentFailedAt: user.paymentFailedAt,
    monthlySpend: monthlySpendUsd,
    suggestUpgrade,
    features,
  };
}
