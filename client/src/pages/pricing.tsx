import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTierPricing, useTierStatus } from "@/hooks/use-tier";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Check, ArrowRight, Zap, Crown, Rocket, Loader2 } from "lucide-react";

const TIER_META: Record<string, { name: string; icon: typeof Check; color: string; description: string }> = {
  free: { name: "Free", icon: Zap, color: "bg-zinc-100 text-zinc-700", description: "Get started with the basics" },
  simple: { name: "Simple", icon: Rocket, color: "bg-blue-100 text-blue-700", description: "For regular meal planners" },
  advanced: { name: "Advanced", icon: Crown, color: "bg-amber-100 text-amber-700", description: "Full access to every feature" },
};

const DEFAULT_FEATURES: Record<string, string[]> = {
  free: ["Basic calorie calculator", "Manual food logging", "Weight tracking", "1 saved meal plan", "Weekly AI nutrition summary"],
  simple: ["Everything in Free", "AI meal plans (Simple tier)", "Barcode scanning", "PDF export", "Up to 5 saved meal plans", "Hydration tracking"],
  advanced: ["Everything in Simple", "AI meal plans (all tiers)", "AI food recognition", "AI insights & trends", "Cycle-aware nutrition", "Unlimited saved plans", "Priority support"],
};

export default function PricingPage() {
  usePageMeta({
    title: "Pricing — FuelU | Simple, Transparent Nutrition Plans",
    description: "Choose the FuelU plan that fits your nutrition journey. Free, Simple, or Advanced — upgrade or downgrade anytime. No ads on paid plans.",
    ogTitle: "FuelU Pricing — Plans for Every Nutrition Goal",
    ogDescription: "Compare FuelU plans: Free basics, Simple meal planning, or Advanced AI features. No ads on any paid plan.",
    ogImage: `${window.location.origin}/icon-512.png`,
    ogUrl: "https://fuelumealplan.com/pricing",
    ogType: "website",
  });

  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: pricing, isLoading } = useTierPricing();
  const { data: tierStatus } = useTierStatus();

  const hasActiveSubscription = tierStatus && (tierStatus.tier === "simple" || tierStatus.tier === "advanced");

  const checkoutMutation = useMutation({
    mutationFn: async (params: { tier: string; billing: "monthly" | "annual" }) => {
      const endpoint = hasActiveSubscription ? "/api/stripe/update-subscription" : "/api/stripe/create-checkout";
      const res = await apiRequest("POST", endpoint, params);
      return res.json();
    },
    onSuccess: (data: { url?: string; message?: string; tier?: string }) => {
      if (data.url) {
        window.location.href = data.url;
      } else if (data.message) {
        toast({ title: "Plan updated", description: data.message });
        queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        navigate("/billing");
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const tiers = pricing?.tiers ?? [];

  const rawTier = tierStatus?.tier || user?.tier || "free";
  const currentTier = rawTier === "payg" ? "free" : rawTier;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100 sticky top-0 z-50 bg-white/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center relative">
              <div className="w-3 h-3 bg-white rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[calc(50%-6px)] bg-white rounded-t-sm" />
            </div>
            <Link href="/" className="font-bold text-xl tracking-tight text-zinc-900" data-testid="link-pricing-home">FuelU</Link>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="text-sm font-medium px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors" data-testid="link-pricing-dashboard">
                Dashboard
              </Link>
            ) : (
              <Link href="/auth" className="text-sm font-medium px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors" data-testid="link-pricing-signin">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="font-bold text-3xl sm:text-4xl tracking-tight text-zinc-900 mb-3" data-testid="text-pricing-title">
            Simple, transparent pricing
          </h1>
          <p className="text-zinc-500 text-lg max-w-lg mx-auto">
            Choose the plan that fits your nutrition journey. Upgrade or downgrade anytime.
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full" data-testid="badge-no-ads">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-emerald-800">No ads — on every paid plan. Upgrade to go ad-free.</span>
          </div>

          <div className="flex items-center justify-center gap-3 mt-8" data-testid="toggle-billing">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${billing === "monthly" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
              data-testid="button-billing-monthly"
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5 ${billing === "annual" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
              data-testid="button-billing-annual"
            >
              Annual
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${billing === "annual" ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-700"}`}>Save ~20%</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {["free", "simple", "advanced"].map((tierKey) => {
              const meta = TIER_META[tierKey];
              const tierData = tiers.find(t => t.tier === tierKey);
              const monthlyPrice = tierData ? tierData.monthlyPriceUsd / 100 : 0;
              const annualPrice = tierData ? tierData.annualPriceUsd / 100 : 0;
              const annualMonthly = annualPrice / 12;
              const displayPrice = billing === "annual" ? annualMonthly : monthlyPrice;
              const features = (tierData?.features as string[])?.length ? tierData!.features as string[] : DEFAULT_FEATURES[tierKey];
              const isCurrent = currentTier === tierKey;
              const isPopular = tierKey === "advanced";
              const Icon = meta.icon;

              return (
                <div
                  key={tierKey}
                  className={`relative bg-white border rounded-2xl p-6 flex flex-col ${isPopular ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"}`}
                  data-testid={`card-tier-${tierKey}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-zinc-900 text-white text-xs font-medium px-3 py-1 rounded-full">Most popular</span>
                    </div>
                  )}

                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${meta.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className="font-semibold text-lg text-zinc-900">{meta.name}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{meta.description}</p>

                  <div className="mt-4 mb-6">
                    {tierKey === "free" ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-zinc-900">$0</span>
                        <span className="text-sm text-zinc-400">/month</span>
                      </div>
                    ) : tierData ? (
                      billing === "annual" ? (
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-zinc-900" data-testid={`text-annual-price-${tierKey}`}>${annualPrice.toFixed(2)}</span>
                            <span className="text-sm text-zinc-400">/year</span>
                            <span className="text-xs text-zinc-300 line-through ml-1">${monthlyPrice.toFixed(2)}/mo</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-sm text-zinc-500" data-testid={`text-monthly-equivalent-${tierKey}`}>${annualMonthly.toFixed(2)}/mo</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-zinc-900" data-testid={`text-monthly-price-${tierKey}`}>${displayPrice.toFixed(2)}</span>
                          <span className="text-sm text-zinc-400">/month</span>
                        </div>
                      )
                    ) : (
                      <div className="text-sm text-zinc-400">Coming soon</div>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {tierKey !== "free" && (
                      <li className="flex items-start gap-2 text-sm text-zinc-600" data-testid={`feature-no-ads-${tierKey}`}>
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" strokeWidth={3} />
                        No ads
                      </li>
                    )}
                    {features.map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" strokeWidth={3} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2.5 text-sm font-medium rounded-xl bg-zinc-100 text-zinc-400 cursor-not-allowed"
                      data-testid={`button-tier-current-${tierKey}`}
                    >
                      Current plan
                    </button>
                  ) : tierKey === "free" ? (
                    <div />
                  ) : user ? (
                    <button
                      onClick={() => checkoutMutation.mutate({ tier: tierKey, billing })}
                      disabled={checkoutMutation.isPending}
                      className={`w-full py-2.5 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                        isPopular
                          ? "bg-zinc-900 text-white hover:bg-zinc-800"
                          : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      } disabled:opacity-40`}
                      data-testid={`button-tier-select-${tierKey}`}
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {hasActiveSubscription ? "Switch plan" : "Get started"}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  ) : (
                    <Link
                      href="/auth?tab=register"
                      className={`w-full py-2.5 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                        isPopular
                          ? "bg-zinc-900 text-white hover:bg-zinc-800"
                          : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      }`}
                      data-testid={`link-tier-signup-${tierKey}`}
                    >
                      Sign up free
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-100 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded-md flex items-center justify-center relative">
              <div className="w-2 h-2 bg-white rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-[calc(50%-4px)] bg-white rounded-t-sm" />
            </div>
            <span className="font-semibold text-sm text-zinc-900">FuelU</span>
          </div>
          <p className="text-xs text-zinc-400">&copy; 2026 FuelU. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
