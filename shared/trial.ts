import type { Tier } from "./schema";

export type TrialPhase = "advanced" | "simple" | "expired" | "none";

export interface TrialInfo {
  phase: TrialPhase;
  effectiveTier: Tier;
  daysRemaining: number;
  totalDays: number;
  dayNumber: number;
  isActive: boolean;
  showStepDownMessage: boolean;
  showExpiredMessage: boolean;
}

export function getTrialDayNumber(trialStartDate: Date | string | null): number {
  if (!trialStartDate) return 0;
  const start = new Date(trialStartDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function computeTrialInfo(
  trialStatus: string,
  trialStartDate: Date | string | null,
  trialStepDownSeen: boolean,
  trialExpiredSeen: boolean,
  betaUser: boolean,
  currentTier: string
): TrialInfo {
  const noTrial: TrialInfo = {
    phase: "none",
    effectiveTier: currentTier as Tier,
    daysRemaining: 0,
    totalDays: 21,
    dayNumber: 0,
    isActive: false,
    showStepDownMessage: false,
    showExpiredMessage: false,
  };

  if (betaUser) return noTrial;
  if (trialStatus === "none") return noTrial;
  if (!trialStartDate) return noTrial;

  const dayNumber = getTrialDayNumber(trialStartDate);

  if (trialStatus === "expired") {
    return {
      phase: "expired",
      effectiveTier: "free",
      daysRemaining: 0,
      totalDays: 21,
      dayNumber,
      isActive: false,
      showStepDownMessage: false,
      showExpiredMessage: !trialExpiredSeen,
    };
  }

  if (dayNumber <= 14) {
    return {
      phase: "advanced",
      effectiveTier: "advanced",
      daysRemaining: 21 - dayNumber + 1,
      totalDays: 21,
      dayNumber,
      isActive: true,
      showStepDownMessage: false,
      showExpiredMessage: false,
    };
  }

  if (dayNumber <= 21) {
    return {
      phase: "simple",
      effectiveTier: "simple",
      daysRemaining: 21 - dayNumber + 1,
      totalDays: 21,
      dayNumber,
      isActive: true,
      showStepDownMessage: !trialStepDownSeen,
      showExpiredMessage: false,
    };
  }

  return {
    phase: "expired",
    effectiveTier: "free",
    daysRemaining: 0,
    totalDays: 21,
    dayNumber,
    isActive: false,
    showStepDownMessage: false,
    showExpiredMessage: !trialExpiredSeen,
  };
}
