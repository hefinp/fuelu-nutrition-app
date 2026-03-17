import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useTierStatus } from "@/hooks/use-tier";
import { useToast } from "@/hooks/use-toast";
import type { PublicUser } from "@shared/schema";
import {
  Crown, CreditCard, AlertTriangle, ArrowRight, Loader2, CheckCircle2,
  Coins, ArrowUpRight, User, Lock, ChevronRight, Zap,
} from "lucide-react";

type Tab = "profile" | "plan";

export default function AccountPage() {
  const { user, isLoading: authLoading } = useAuth();
  const search = useSearch();
  const { toast } = useToast();
  const { data: tierStatus, isLoading: tierLoading } = useTierStatus();

  const searchParams = new URLSearchParams(search);
  const initialTab = (searchParams.get("tab") as Tab) || "profile";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const tab = (new URLSearchParams(search).get("tab") as Tab) || "profile";
    setActiveTab(tab);
  }, [search]);

  const successParam = searchParams.get("success");
  const cancelledParam = searchParams.get("cancelled");

  useEffect(() => {
    if (successParam) {
      toast({
        title: successParam === "credits" ? "Credits added!" : "Subscription activated!",
        description: successParam === "credits" ? "Your credit balance has been updated." : "Welcome to your new plan.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }
    if (cancelledParam) {
      toast({ title: "Checkout cancelled", description: "No changes were made to your account." });
    }
  }, [successParam, cancelledParam]);

  const { data: transactions = [] } = useQuery<{ id: number; amount: number; type: string; featureKey: string | null; description: string | null; createdAt: string }[]>({
    queryKey: ["/api/tier/credit-transactions"],
    enabled: !!user && (tierStatus?.tier === "payg" || (tierStatus?.creditBalance ?? 0) > 0),
  });

  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
    }
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string }) => {
      const res = await apiRequest("PUT", "/api/auth/profile", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (updated: PublicUser) => {
      queryClient.setQueryData<PublicUser | null>(["/api/auth/me"], (old) => old ? { ...old, ...updated } : old ?? null);
      toast({ title: "Profile updated", description: "Your profile has been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("PUT", "/api/auth/password", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

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
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data: { message: string; periodEnd?: number }) => {
      const endDate = data.periodEnd ? new Date(data.periodEnd * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
      toast({ title: "Subscription cancelled", description: endDate ? `You'll keep access until ${endDate}.` : "You'll keep access until the end of your billing period." });
      queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const downgradeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/downgrade-to-free", {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data: { message: string; periodEnd?: number }) => {
      const endDate = data.periodEnd ? new Date(data.periodEnd * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
      toast({ title: "Switching to Free", description: endDate ? `You'll have full access until ${endDate}.` : data.message });
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
        <p className="text-sm text-zinc-600">Please sign in to view your account.</p>
        <Link href="/auth" className="text-sm text-zinc-500 hover:text-zinc-800 underline" data-testid="link-account-signin">Sign in</Link>
      </div>
    );
  }

  const tier = tierStatus?.tier || "free";
  const betaUser = tierStatus?.betaUser || false;
  const creditBalance = tierStatus?.creditBalance ?? 0;
  const tierExpiresAt = tierStatus?.tierExpiresAt;
  const pendingTier = tierStatus?.pendingTier;
  const paymentFailed = !!tierStatus?.paymentFailedAt;
  const isPaid = tier === "simple" || tier === "advanced";

  const tierNames: Record<string, string> = { free: "Free", simple: "Simple", advanced: "Advanced", payg: "Pay As You Go" };

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    const updates: { name?: string; email?: string } = {};
    if (profileName !== user!.name) updates.name = profileName;
    if (profileEmail !== user!.email) updates.email = profileEmail;
    if (Object.keys(updates).length === 0) {
      toast({ title: "No changes", description: "Your profile is already up to date." });
      return;
    }
    profileMutation.mutate(updates);
  }

  function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-white rounded-full" />
            </div>
            <span className="font-semibold text-sm text-zinc-900">My Account</span>
          </div>
          <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors" data-testid="link-account-dashboard">
            Back to app
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-1 mb-6 p-1 bg-white border border-zinc-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "profile" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
            data-testid="tab-profile"
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab("plan")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "plan" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
            data-testid="tab-plan"
          >
            <Crown className="w-4 h-4" />
            Plan & Billing
          </button>
        </div>

        {activeTab === "profile" && (
          <div className="space-y-6">
            <form onSubmit={handleProfileSave} className="bg-white rounded-2xl border border-zinc-100 p-6 space-y-4" data-testid="form-profile">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-900">Profile Details</h2>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Full Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                  data-testid="input-profile-name"
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Email Address</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={e => setProfileEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                  data-testid="input-profile-email"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={profileMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-40"
                data-testid="button-save-profile"
              >
                {profileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
              </button>
            </form>

            <form onSubmit={handlePasswordSave} className="bg-white rounded-2xl border border-zinc-100 p-6 space-y-4" data-testid="form-password">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-900">Change Password</h2>
              </div>

              {user.provider ? (
                <p className="text-xs text-zinc-500">
                  You signed in with {user.provider === "google" ? "Google" : "Apple"}. Password changes are not available for social sign-in accounts.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                      data-testid="input-current-password"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                      data-testid="input-new-password"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                      data-testid="input-confirm-password"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={passwordMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-40"
                    data-testid="button-change-password"
                  >
                    {passwordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
                  </button>
                </>
              )}
            </form>
          </div>
        )}

        {activeTab === "plan" && (
          <div className="space-y-6">
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
                {!isPaid && !betaUser && (
                  <Link
                    href="/pricing"
                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
                    data-testid="link-upgrade"
                  >
                    Upgrade
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
                {isPaid && (
                  <>
                    <Link
                      href="/pricing"
                      className="flex items-center gap-1.5 px-4 py-2 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors"
                      data-testid="link-change-plan"
                    >
                      Change plan
                    </Link>
                    {!pendingTier && (
                      <button
                        onClick={() => {
                          if (window.confirm("Switch to the Free tier? You'll keep access to your current plan until the end of your billing period.")) {
                            downgradeMutation.mutate();
                          }
                        }}
                        disabled={downgradeMutation.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors disabled:opacity-40"
                        data-testid="button-downgrade-free"
                      >
                        {downgradeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Switch to Free"}
                      </button>
                    )}
                  </>
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

            {(tier === "payg" || creditBalance > 0) && (
              <div className="bg-white rounded-2xl border border-zinc-100 p-6" data-testid="card-credit-balance">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Coins className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">Credit Balance</h2>
                      <p className="text-2xl font-bold text-zinc-900 mt-1" data-testid="text-credit-balance">{creditBalance}</p>
                    </div>
                  </div>
                  <Link
                    href="/pricing"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-colors"
                    data-testid="link-buy-more-credits"
                  >
                    Buy more
                  </Link>
                </div>

                {transactions.length > 0 && (
                  <div className="border-t border-zinc-100 pt-4 mt-4">
                    <p className="text-xs font-medium text-zinc-500 mb-2">Recent transactions</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {transactions.slice(0, 10).map(tx => (
                        <div key={tx.id} className="flex items-center justify-between text-xs" data-testid={`row-transaction-${tx.id}`}>
                          <span className="text-zinc-600">{tx.description || tx.type}</span>
                          <span className={`font-medium ${tx.amount > 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tierStatus?.suggestUpgrade && !betaUser && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl" data-testid="banner-upgrade-suggestion">
                <Coins className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Save money with a subscription</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Your credit usage this month (${((tierStatus?.monthlySpend ?? 0) / 100).toFixed(2)}) exceeds the {tierStatus.suggestUpgrade === "advanced" ? "Advanced" : "Simple"} plan price. Consider upgrading to save.
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-2 inline-block text-xs font-medium text-blue-700 underline hover:text-blue-900"
                    data-testid="link-upgrade-suggestion"
                  >
                    View plans
                  </Link>
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

            <div className="bg-white rounded-2xl border border-zinc-100 p-5" data-testid="card-billing-link">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Full Billing History</p>
                  <p className="text-xs text-zinc-400 mt-0.5">View the legacy billing page</p>
                </div>
                <Link
                  href="/billing"
                  className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
                  data-testid="link-billing-page"
                >
                  View <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {isPaid && !pendingTier && (
              <div className="bg-white rounded-2xl border border-red-100 p-6" data-testid="card-cancel-subscription">
                <h2 className="text-sm font-semibold text-zinc-900 mb-1">Cancel subscription</h2>
                <p className="text-xs text-zinc-400 mb-4">
                  You'll keep access to your current plan features until the end of your billing period. After that, your account will revert to the Free tier.
                </p>
                <button
                  onClick={() => {
                    if (window.confirm("Cancel your subscription? You'll keep access until the end of your billing period, then revert to the Free tier.")) {
                      cancelMutation.mutate();
                    }
                  }}
                  disabled={cancelMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors disabled:opacity-40"
                  data-testid="button-cancel-subscription"
                >
                  {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel subscription"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
