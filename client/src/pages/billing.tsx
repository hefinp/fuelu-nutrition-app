import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useTierStatus } from "@/hooks/use-tier";
import { useToast } from "@/hooks/use-toast";
import { Crown, CreditCard, AlertTriangle, ArrowRight, Loader2, CheckCircle2, ArrowUpRight } from "lucide-react";

export default function BillingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: tierStatus, isLoading: tierLoading } = useTierStatus();
  const [upgradedTier, setUpgradedTier] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(4);
  const confirmedRef = useRef(false);

  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get("success");
  const cancelled = searchParams.get("cancelled");
  const sessionId = searchParams.get("session_id");

  const confirmMutation = useMutation({
    mutationFn: (sid: string) => apiRequest("POST", "/api/stripe/confirm-subscription", { sessionId: sid }).then(r => r.json()),
    onSuccess: (data: { tier: string }) => {
      setUpgradedTier(data.tier);
      queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  useEffect(() => {
    if (success === "subscription" && sessionId && !confirmedRef.current) {
      confirmedRef.current = true;
      confirmMutation.mutate(sessionId);
    }
    if (cancelled) {
      toast({ title: "Checkout cancelled", description: "No changes were made to your account." });
    }
  }, []);

  useEffect(() => {
    if (!upgradedTier) return;
    if (countdown <= 0) {
      navigate("/dashboard");
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [upgradedTier, countdown]);

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/create-portal", {});
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/cancel-subscription", {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Subscription cancelled", description: "You'll keep access until the end of your billing period." });
      queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (authLoading || tierLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-zinc-600">Please sign in to manage your subscription.</p>
        <Link href="/auth" className="text-sm text-zinc-500 hover:text-zinc-800 underline" data-testid="link-billing-signin">Sign in</Link>
      </div>
    );
  }

  const tier = tierStatus?.tier === "payg" ? "free" : (tierStatus?.tier || "free");
  const betaUser = tierStatus?.betaUser || false;
  const tierExpiresAt = tierStatus?.tierExpiresAt;
  const pendingTier = tierStatus?.pendingTier;
  const paymentFailed = !!tierStatus?.paymentFailedAt;
  const isPaid = tier === "simple" || tier === "advanced";

  const tierNames: Record<string, string> = { free: "Free", simple: "Simple", advanced: "Advanced" };

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-white rounded-full" />
            </div>
            <span className="font-semibold text-sm text-zinc-900">Account & Billing</span>
          </div>
          <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors" data-testid="link-billing-dashboard">
            Back to app
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {success === "subscription" && confirmMutation.isPending && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl" data-testid="banner-confirming-upgrade">
            <Loader2 className="w-5 h-5 text-emerald-600 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Confirming your subscription…</p>
              <p className="text-xs text-emerald-600 mt-0.5">Just a moment while we activate your account.</p>
            </div>
          </div>
        )}

        {upgradedTier && (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl" data-testid="banner-upgrade-success">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">
                Your account has been upgraded to {upgradedTier.charAt(0).toUpperCase() + upgradedTier.slice(1)}!
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Redirecting you to the dashboard in {countdown}s…
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                className="mt-2 text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
                data-testid="link-go-to-dashboard"
              >
                Go now
              </button>
            </div>
          </div>
        )}

        {paymentFailed && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl" data-testid="banner-payment-failed">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Payment failed</p>
              <p className="text-xs text-red-600 mt-1">
                Your last payment failed and your account has been reverted to the Free tier. Please update your payment method to restore access.
              </p>
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="mt-2 text-xs font-medium text-red-700 underline hover:text-red-900"
                data-testid="link-update-payment"
              >
                Update payment method
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-zinc-100 p-6" data-testid="card-current-plan">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Current Plan</h2>
              <div className="flex items-center gap-2 mt-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <span className="text-lg font-bold text-zinc-900" data-testid="text-current-tier">{tierNames[tier] || tier}</span>
                {betaUser && (
                  <span className="text-xs font-medium px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full" data-testid="badge-beta">
                    Beta
                  </span>
                )}
                {pendingTier && (
                  <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full" data-testid="badge-pending-tier">
                    Switching to {tierNames[pendingTier] || pendingTier}
                  </span>
                )}
              </div>
            </div>
            {isPaid && tierExpiresAt && (
              <div className="text-right">
                <p className="text-xs text-zinc-400">Next billing date</p>
                <p className="text-sm font-medium text-zinc-700" data-testid="text-billing-date">
                  {new Date(tierExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/pricing"
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
              data-testid="link-change-plan"
            >
              Change plan
              <ArrowRight className="w-4 h-4" />
            </Link>
            {isPaid && (
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors disabled:opacity-40"
                data-testid="button-cancel-subscription"
              >
                {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel subscription"}
              </button>
            )}
          </div>
        </div>

        {isPaid && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-6" data-testid="card-payment-method">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-zinc-400" />
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Payment Method</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Manage your payment details via Stripe</p>
                </div>
              </div>
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-colors disabled:opacity-40"
                data-testid="button-manage-billing"
              >
                {portalMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                  <>Manage <ArrowUpRight className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {betaUser && (
          <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-2xl" data-testid="banner-beta-user">
            <CheckCircle2 className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-purple-800">Beta Access</p>
              <p className="text-xs text-purple-600 mt-1">
                As a beta user, you have full access to all features indefinitely. Thank you for being an early supporter!
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
