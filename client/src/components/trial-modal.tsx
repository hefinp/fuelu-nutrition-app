import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Crown, Sparkles, ArrowRight, AlertTriangle, XCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { TrialInfo } from "@shared/trial";

interface TrialModalProps {
  trialInfo: TrialInfo;
  showOnLogin?: boolean;
}

const advancedFeatures = [
  "Advanced analytics dashboard",
  "Data export capabilities",
  "Priority support access",
  "AI-powered insights",
  "AI meal plan generation",
  "Cycle-aware nutrition",
  "Meal templates",
];

const simpleFeatures = [
  "AI-powered insights",
  "AI meal plan generation",
  "AI photo scanning",
  "Cycle-aware nutrition",
  "Meal templates",
];

const lostOnStepDown = [
  "Advanced analytics dashboard",
  "Data export capabilities",
  "Priority support access",
];

export function TrialModal({ trialInfo, showOnLogin = false }: TrialModalProps) {
  const [open, setOpen] = useState(false);
  const [hasShownThisSession, setHasShownThisSession] = useState(false);

  useEffect(() => {
    if (hasShownThisSession) return;

    if (trialInfo.showStepDownMessage) {
      setOpen(true);
      setHasShownThisSession(true);
      return;
    }

    if (trialInfo.showExpiredMessage) {
      setOpen(true);
      setHasShownThisSession(true);
      return;
    }

    if (showOnLogin && trialInfo.isActive) {
      setOpen(true);
      setHasShownThisSession(true);
    }
  }, [trialInfo, showOnLogin, hasShownThisSession]);

  const handleClose = async () => {
    if (trialInfo.showStepDownMessage) {
      await apiRequest("POST", "/api/auth/trial/acknowledge-stepdown", {});
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }
    if (trialInfo.showExpiredMessage) {
      await apiRequest("POST", "/api/auth/trial/acknowledge-expired", {});
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }
    setOpen(false);
  };

  if (trialInfo.showStepDownMessage) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-md" data-testid="trial-stepdown-modal">
          <DialogTitle className="sr-only">Trial Step Down</DialogTitle>
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            data-testid="trial-modal-close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Your trial has stepped down</h2>
            <p className="text-sm text-zinc-500 mb-4">
              You've moved from Advanced to Simple tier access. You still have{" "}
              <strong>{trialInfo.daysRemaining} days</strong> of Simple features remaining.
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4 text-left">
              <p className="text-sm font-medium text-red-800 mb-2">Features no longer available:</p>
              <ul className="space-y-1">
                {lostOnStepDown.map((f) => (
                  <li key={f} className="text-sm text-red-600 flex items-center gap-2">
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-medium text-blue-800 mb-2">You still have access to:</p>
              <ul className="space-y-1">
                {simpleFeatures.map((f) => (
                  <li key={f} className="text-sm text-blue-600 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/pricing" onClick={handleClose}>
                <Button className="w-full" data-testid="trial-modal-view-plans">
                  Upgrade to Advanced
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <Button variant="ghost" onClick={handleClose} data-testid="trial-modal-dismiss">
                Continue with Simple
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (trialInfo.showExpiredMessage) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-md" data-testid="trial-expired-modal">
          <DialogTitle className="sr-only">Trial Expired</DialogTitle>
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            data-testid="trial-modal-close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-7 h-7 text-zinc-500" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Your free trial has ended</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Your 21-day trial is complete. You're now on the Free plan. Upgrade to keep using the features you love.
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/pricing" onClick={handleClose}>
                <Button className="w-full" data-testid="trial-modal-choose-plan">
                  Choose a Plan
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <Button variant="ghost" onClick={handleClose} data-testid="trial-modal-stay-free">
                Stay on Free
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!trialInfo.isActive) return null;

  const isAdvanced = trialInfo.phase === "advanced";
  const tierLabel = isAdvanced ? "Advanced" : "Simple";
  const features = isAdvanced ? advancedFeatures : simpleFeatures;
  const Icon = isAdvanced ? Crown : Sparkles;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="trial-info-modal">
        <DialogTitle className="sr-only">Trial Information</DialogTitle>
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          data-testid="trial-modal-close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-center py-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            isAdvanced ? "bg-amber-100" : "bg-blue-100"
          }`}>
            <Icon className={`w-7 h-7 ${isAdvanced ? "text-amber-600" : "text-blue-600"}`} />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-1">
            Welcome to your free trial!
          </h2>
          <p className="text-sm text-zinc-500 mb-1">
            You're currently experiencing <strong>{tierLabel}</strong> features
          </p>
          <p className={`text-sm font-semibold mb-4 ${isAdvanced ? "text-amber-600" : "text-blue-600"}`}>
            {trialInfo.daysRemaining} {trialInfo.daysRemaining === 1 ? "day" : "days"} remaining
          </p>

          <div className={`rounded-xl p-4 mb-6 text-left ${
            isAdvanced ? "bg-amber-50 border border-amber-100" : "bg-blue-50 border border-blue-100"
          }`}>
            <p className={`text-sm font-medium mb-2 ${isAdvanced ? "text-amber-800" : "text-blue-800"}`}>
              Features you have access to:
            </p>
            <ul className="space-y-1">
              {features.map((f) => (
                <li key={f} className={`text-sm flex items-center gap-2 ${isAdvanced ? "text-amber-700" : "text-blue-700"}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {isAdvanced && (
            <p className="text-xs text-zinc-400 mb-4">
              After day 14, you'll step down to Simple tier for 7 more days.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Link href="/pricing" onClick={handleClose}>
              <Button className="w-full" data-testid="trial-modal-view-plans">
                View Plans
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleClose} data-testid="trial-modal-dismiss">
              Continue exploring
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
