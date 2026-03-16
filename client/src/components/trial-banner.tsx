import { Link } from "wouter";
import { Crown, Sparkles, Clock } from "lucide-react";
import type { TrialInfo } from "@shared/trial";

interface TrialBannerProps {
  trialInfo: TrialInfo;
}

export function TrialBanner({ trialInfo }: TrialBannerProps) {
  if (!trialInfo.isActive) return null;

  const isAdvanced = trialInfo.phase === "advanced";
  const tierLabel = isAdvanced ? "Advanced" : "Simple";
  const Icon = isAdvanced ? Crown : Sparkles;

  return (
    <div
      className={`w-full px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 ${
        isAdvanced
          ? "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border-b border-amber-100"
          : "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border-b border-blue-100"
      }`}
      data-testid="trial-banner"
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>
        You're experiencing <strong>{tierLabel}</strong> features
      </span>
      <span className="inline-flex items-center gap-1 ml-1">
        <Clock className="w-3.5 h-3.5" />
        {trialInfo.daysRemaining} {trialInfo.daysRemaining === 1 ? "day" : "days"} left
      </span>
      <Link
        href="/pricing"
        className={`ml-2 text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
          isAdvanced
            ? "bg-amber-200/60 hover:bg-amber-200 text-amber-900"
            : "bg-blue-200/60 hover:bg-blue-200 text-blue-900"
        }`}
        data-testid="trial-banner-view-plans"
      >
        View Plans
      </Link>
    </div>
  );
}
