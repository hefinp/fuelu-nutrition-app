import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { CheckCircle2, Circle, Plus, ShieldAlert, RefreshCw, Sparkles, Settings, Users, Coins, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CommunityMealBucket {
  style: string;
  slot: string;
  total: number;
  userContributed: number;
  aiGenerated: number;
}

interface CommunityMealBalance {
  buckets: CommunityMealBucket[];
  gapsFound: number;
  mealsGenerated: number;
}

interface InviteCode {
  code: string;
  usedAt: string | null;
  usedByEmail: string | null;
}

interface TierPricingItem {
  id: number;
  tier: string;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
  active: boolean;
  features: string[];
  displayOrder: number;
}

interface FeatureGateItem {
  id: number;
  featureKey: string;
  requiredTier: string;
  creditCost: number;
  description: string | null;
}

interface CreditPackItem {
  id: number;
  credits: number;
  priceUsd: number;
  stripePriceId: string | null;
  active: boolean;
}

interface AdminUser {
  id: number;
  email: string;
  name: string;
  tier: string;
  betaUser: boolean;
  betaTierLocked: boolean;
  creditBalance: number;
}

const ADMIN_EMAIL = "hefin.price@gmail.com";
const TIER_OPTIONS = ["free", "simple", "advanced"];

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [newCodes, setNewCodes] = useState("");
  const [activeTab, setActiveTab] = useState<"codes" | "pricing" | "features" | "users">("codes");

  const isAdmin = !!user && user.email === ADMIN_EMAIL;

  const { data: codes = [], isLoading: codesLoading, refetch } = useQuery<InviteCode[]>({
    queryKey: ["/api/admin/invite-codes"],
    enabled: isAdmin,
  });

  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useQuery<CommunityMealBalance>({
    queryKey: ["/api/admin/community-meal-balance"],
    enabled: isAdmin,
  });

  const { data: tierPricing = [], refetch: refetchPricing } = useQuery<TierPricingItem[]>({
    queryKey: ["/api/admin/tier-pricing"],
    enabled: isAdmin,
  });

  const { data: featureGates = [], refetch: refetchGates } = useQuery<FeatureGateItem[]>({
    queryKey: ["/api/admin/feature-gates"],
    enabled: isAdmin,
  });

  const { data: creditPacks = [], refetch: refetchPacks } = useQuery<CreditPackItem[]>({
    queryKey: ["/api/admin/credit-packs"],
    enabled: isAdmin,
  });

  const { data: adminUsers = [], refetch: refetchUsers } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin,
  });

  const refillMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/community-meal-balance/refill", {}),
    onSuccess: async (res) => {
      const data: CommunityMealBalance = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community-meal-balance"] });
      toast({ title: "Gap-fill complete", description: data.mealsGenerated > 0 ? `Generated ${data.mealsGenerated} new meals` : "All buckets are healthy" });
    },
    onError: () => toast({ title: "Refill failed", variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: (codes: string) => apiRequest("POST", "/api/admin/invite-codes", { codes }),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
      setNewCodes("");
      const msg = [
        data.inserted?.length ? `Added: ${data.inserted.join(", ")}` : "",
        data.skipped?.length ? `Already existed: ${data.skipped.join(", ")}` : "",
      ].filter(Boolean).join(" · ");
      toast({ title: "Done", description: msg || "No changes made." });
    },
    onError: () => toast({ title: "Error", description: "Failed to add codes.", variant: "destructive" }),
  });

  const userTierMutation = useMutation({
    mutationFn: (data: { userId: number; tier?: string; betaUser?: boolean; betaTierLocked?: boolean }) => apiRequest("POST", "/api/admin/user-tier", data),
    onSuccess: async (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      if (variables.userId === user?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
      }
      toast({ title: "User updated" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const savePricingMutation = useMutation({
    mutationFn: (data: { tier: string; monthlyPriceUsd: number; annualPriceUsd: number; active: boolean; features: string[]; displayOrder: number }) =>
      apiRequest("POST", "/api/admin/tier-pricing", data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tier-pricing"] });
      toast({ title: "Pricing saved" });
    },
    onError: () => toast({ title: "Error saving pricing", variant: "destructive" }),
  });

  const saveGateMutation = useMutation({
    mutationFn: (data: { featureKey: string; requiredTier: string; creditCost: number; description: string }) =>
      apiRequest("POST", "/api/admin/feature-gates", data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-gates"] });
      toast({ title: "Feature gate saved" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const deleteGateMutation = useMutation({
    mutationFn: (key: string) => apiRequest("DELETE", `/api/admin/feature-gates/${key}`, {}),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-gates"] });
      toast({ title: "Feature gate deleted" });
    },
  });

  const saveCreditPackMutation = useMutation({
    mutationFn: (data: { id?: number; credits: number; priceUsd: number; stripePriceId?: string; active?: boolean }) =>
      apiRequest("POST", "/api/admin/credit-packs", data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/credit-packs"] });
      toast({ title: "Credit pack saved" });
    },
    onError: () => toast({ title: "Error saving credit pack", variant: "destructive" }),
  });

  const deleteCreditPackMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/credit-packs/${id}`, {}),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/credit-packs"] });
      toast({ title: "Credit pack deleted" });
    },
  });

  const syncStripeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/sync-stripe-prices", {}),
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tier-pricing"] });
      toast({ title: data?.message ?? "Stripe prices synced" });
    },
    onError: (err: any) => toast({ title: err?.message ?? "Stripe sync failed", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-3 text-center p-8">
        <ShieldAlert className="w-10 h-10 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-600">Access restricted</p>
        <p className="text-xs text-zinc-400">This page is only available to administrators.</p>
        <button onClick={() => navigate("/dashboard")} className="mt-2 text-xs text-zinc-500 hover:text-zinc-800 underline">
          Back to dashboard
        </button>
      </div>
    );
  }

  const available = codes.filter(c => !c.usedAt);
  const used = codes.filter(c => c.usedAt);
  const betaUsers = adminUsers.filter(u => u.betaUser);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center relative">
              <div className="w-2.5 h-2.5 bg-white rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-[calc(50%-5px)] bg-white rounded-t-sm" />
            </div>
            <span className="font-semibold text-sm text-zinc-900">FuelU Admin</span>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
            data-testid="link-admin-back"
          >
            Back to app
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
          {[
            { key: "codes" as const, label: "Codes", icon: CheckCircle2 },
            { key: "pricing" as const, label: "Pricing", icon: Coins },
            { key: "features" as const, label: "Features", icon: Settings },
            { key: "users" as const, label: "Users", icon: Users },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                activeTab === tab.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "codes" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total codes", value: codes.length },
                { label: "Available", value: available.length, color: "text-emerald-600" },
                { label: "Used", value: used.length, color: "text-zinc-400" },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-2xl border border-zinc-100 p-4 text-center">
                  <p className={`text-2xl font-bold ${stat.color ?? "text-zinc-900"}`}>{stat.value}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Add codes */}
            <div className="bg-white rounded-2xl border border-zinc-100 p-5">
              <h2 className="text-sm font-semibold text-zinc-900 mb-3">Add new codes</h2>
              <p className="text-xs text-zinc-400 mb-3">Enter one or more codes, separated by commas or new lines.</p>
              <textarea
                value={newCodes}
                onChange={e => setNewCodes(e.target.value)}
                placeholder={"BETA2121\nBETA2222\nFRIEND99"}
                rows={3}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none"
                data-testid="input-new-codes"
              />
              <button
                onClick={() => addMutation.mutate(newCodes)}
                disabled={!newCodes.trim() || addMutation.isPending}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                data-testid="button-add-codes"
              >
                <Plus className="w-4 h-4" />
                {addMutation.isPending ? "Adding..." : "Add codes"}
              </button>
            </div>

            {/* Community Meal Database */}
            <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Meal database</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Community + AI-curated meals by style and slot. Floor: 20 per bucket.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refetchBalance()}
                    className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
                    data-testid="button-refresh-balance"
                  >
                    {balanceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => refillMutation.mutate()}
                    disabled={refillMutation.isPending}
                    data-testid="button-refill-balance"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {refillMutation.isPending ? "Generating..." : "Refresh & top up"}
                  </button>
                </div>
              </div>
              {balanceLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
                </div>
              ) : !balance ? (
                <div className="text-center py-10 text-sm text-zinc-400">No data available.</div>
              ) : (
                <div className="p-5">
                  {balance.gapsFound > 0 && (
                    <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                      <span className="font-semibold">{balance.gapsFound} bucket{balance.gapsFound !== 1 ? "s" : ""} below floor.</span>
                      <span>Click "Refresh & top up" to auto-fill with AI.</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4">
                    {["simple", "gourmet", "michelin"].map(style => (
                      <div key={style}>
                        <p className="text-xs font-semibold text-zinc-700 capitalize mb-2 text-center">{style}</p>
                        <div className="space-y-1.5">
                          {["breakfast", "lunch", "dinner", "snack"].map(slot => {
                            const bucket = balance.buckets.find(b => b.style === style && b.slot === slot);
                            const total = bucket?.total ?? 0;
                            const color = total >= 20 ? "text-emerald-600 bg-emerald-50 border-emerald-100" : total >= 10 ? "text-amber-600 bg-amber-50 border-amber-100" : "text-red-600 bg-red-50 border-red-100";
                            return (
                              <div key={slot} data-testid={`bucket-${style}-${slot}`} className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs ${color}`}>
                                <span className="capitalize font-medium">{slot}</span>
                                <span className="font-bold">{total}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Code list */}
            <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <h2 className="text-sm font-semibold text-zinc-900">All codes</h2>
                <button onClick={() => refetch()} className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors" data-testid="button-refresh-codes">
                  {codesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
              </div>
              {codesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
                </div>
              ) : codes.length === 0 ? (
                <div className="text-center py-12 text-sm text-zinc-400">No codes found.</div>
              ) : (
                <div className="divide-y divide-zinc-50">
                  {codes.map(c => {
                    const codeUser = c.usedByEmail ? adminUsers.find(u => u.email === c.usedByEmail) : null;
                    return (
                      <div key={c.code} className="flex items-center justify-between px-5 py-3" data-testid={`row-code-${c.code}`}>
                        <div className="flex items-center gap-3">
                          {c.usedAt ? <CheckCircle2 className="w-4 h-4 text-zinc-300 shrink-0" /> : <Circle className="w-4 h-4 text-emerald-500 shrink-0" />}
                          <span className={`font-mono text-sm font-medium ${c.usedAt ? "text-zinc-400" : "text-zinc-900"}`}>{c.code}</span>
                        </div>
                        {c.usedAt ? (
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs text-zinc-500">{c.usedByEmail}</p>
                              <p className="text-xs text-zinc-300">
                                {new Date(c.usedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            {codeUser && (
                              <select
                                value={codeUser.tier}
                                onChange={(e) => userTierMutation.mutate({ userId: codeUser.id, tier: e.target.value })}
                                className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                                data-testid={`select-user-tier-${codeUser.id}`}
                              >
                                {TIER_OPTIONS.map(t => (
                                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Available</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "pricing" && (
          <PricingTab
            tierPricing={tierPricing}
            onSave={(data) => savePricingMutation.mutate(data)}
            isSaving={savePricingMutation.isPending}
            creditPacks={creditPacks}
            onSavePack={(data) => saveCreditPackMutation.mutate(data)}
            onDeletePack={(id) => deleteCreditPackMutation.mutate(id)}
            isSavingPack={saveCreditPackMutation.isPending}
            onSyncStripe={() => syncStripeMutation.mutate()}
            isSyncingStripe={syncStripeMutation.isPending}
          />
        )}

        {activeTab === "features" && (
          <FeaturesTab
            gates={featureGates}
            onSave={(data) => saveGateMutation.mutate(data)}
            onDelete={(key) => deleteGateMutation.mutate(key)}
            isSaving={saveGateMutation.isPending}
          />
        )}

        {activeTab === "users" && (
          <UsersTab
            users={adminUsers}
            onUpdateTier={(data) => userTierMutation.mutate(data)}
          />
        )}
      </main>
    </div>
  );
}

function PricingTab({ tierPricing, onSave, isSaving, creditPacks, onSavePack, onDeletePack, isSavingPack, onSyncStripe, isSyncingStripe }: {
  tierPricing: TierPricingItem[];
  onSave: (data: { tier: string; monthlyPriceUsd: number; annualPriceUsd: number; active: boolean; features: string[]; displayOrder: number }) => void;
  isSaving: boolean;
  creditPacks: CreditPackItem[];
  onSavePack: (data: { id?: number; credits: number; priceUsd: number; stripePriceId?: string; active?: boolean }) => void;
  onDeletePack: (id: number) => void;
  isSavingPack: boolean;
  onSyncStripe: () => void;
  isSyncingStripe: boolean;
}) {
  const [editTier, setEditTier] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ monthlyPriceUsd: number; annualPriceUsd: number; active: boolean; features: string; displayOrder: number }>({
    monthlyPriceUsd: 0, annualPriceUsd: 0, active: true, features: "", displayOrder: 0,
  });
  const [newPack, setNewPack] = useState({ credits: 100, priceUsd: 499, stripePriceId: "", active: true });

  const tiers = ["simple", "advanced"];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-zinc-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900">Tier Pricing</h2>
          <button
            onClick={onSyncStripe}
            disabled={isSyncingStripe}
            data-testid="button-sync-stripe-prices"
            className="flex items-center gap-1.5 text-xs text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {isSyncingStripe ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {isSyncingStripe ? "Syncing…" : "Sync Stripe Prices"}
          </button>
        </div>
        <div className="space-y-3">
          {tiers.map(tier => {
            const existing = tierPricing.find(t => t.tier === tier);
            const isEditing = editTier === tier;
            return (
              <div key={tier} className="border border-zinc-100 rounded-xl p-4" data-testid={`pricing-row-${tier}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-zinc-900 capitalize">{tier}</span>
                  <button
                    onClick={() => {
                      if (isEditing) {
                        setEditTier(null);
                      } else {
                        setEditTier(tier);
                        setEditData({
                          monthlyPriceUsd: existing?.monthlyPriceUsd ?? 0,
                          annualPriceUsd: existing?.annualPriceUsd ?? 0,
                          active: existing?.active ?? true,
                          features: (existing?.features as string[])?.join("\n") ?? "",
                          displayOrder: existing?.displayOrder ?? 0,
                        });
                      }
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-800 underline"
                    data-testid={`button-edit-pricing-${tier}`}
                  >
                    {isEditing ? "Cancel" : "Edit"}
                  </button>
                </div>
                {existing && !isEditing && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-400">Monthly</span>
                      <p className="font-medium text-zinc-700">${(existing.monthlyPriceUsd / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-zinc-400">Annual</span>
                      <p className="font-medium text-zinc-700">${(existing.annualPriceUsd / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-zinc-400">Status</span>
                      <p className={`font-medium ${existing.active ? "text-emerald-600" : "text-zinc-400"}`}>{existing.active ? "Active" : "Inactive"}</p>
                    </div>
                  </div>
                )}
                {isEditing && (
                  <div className="space-y-3 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500">Monthly (cents)</label>
                        <input
                          type="number"
                          value={editData.monthlyPriceUsd}
                          onChange={e => setEditData({ ...editData, monthlyPriceUsd: parseInt(e.target.value) || 0 })}
                          className="w-full mt-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          data-testid={`input-monthly-${tier}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Annual (cents)</label>
                        <input
                          type="number"
                          value={editData.annualPriceUsd}
                          onChange={e => setEditData({ ...editData, annualPriceUsd: parseInt(e.target.value) || 0 })}
                          className="w-full mt-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          data-testid={`input-annual-${tier}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Features (one per line)</label>
                      <textarea
                        value={editData.features}
                        onChange={e => setEditData({ ...editData, features: e.target.value })}
                        rows={4}
                        className="w-full mt-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none"
                        data-testid={`input-features-${tier}`}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={editData.active}
                          onChange={e => setEditData({ ...editData, active: e.target.checked })}
                          className="rounded"
                          data-testid={`checkbox-active-${tier}`}
                        />
                        Active
                      </label>
                      <input
                        type="number"
                        value={editData.displayOrder}
                        onChange={e => setEditData({ ...editData, displayOrder: parseInt(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        placeholder="Order"
                        data-testid={`input-order-${tier}`}
                      />
                    </div>
                    <button
                      onClick={() => {
                        onSave({
                          tier,
                          monthlyPriceUsd: editData.monthlyPriceUsd,
                          annualPriceUsd: editData.annualPriceUsd,
                          active: editData.active,
                          features: editData.features.split("\n").map(f => f.trim()).filter(Boolean),
                          displayOrder: editData.displayOrder,
                        });
                        setEditTier(null);
                      }}
                      disabled={isSaving}
                      className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                      data-testid={`button-save-pricing-${tier}`}
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Credit Packs (PAYG)</h2>
        <p className="text-xs text-zinc-400 mb-4">Manage credit pack options for pay-as-you-go users.</p>

        <div className="space-y-2 mb-6">
          {creditPacks.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">No credit packs configured yet.</p>
          ) : (
            creditPacks.map(pack => (
              <div key={pack.id} className="flex items-center justify-between px-3 py-2 border border-zinc-100 rounded-xl" data-testid={`pack-${pack.id}`}>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-zinc-900">{pack.credits} credits</span>
                  <span className="text-xs text-zinc-500">${(pack.priceUsd / 100).toFixed(2)}</span>
                  {pack.stripePriceId && <span className="text-xs text-zinc-300 font-mono">{pack.stripePriceId.slice(0, 20)}...</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pack.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-400"}`}>
                    {pack.active ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={() => onDeletePack(pack.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                    data-testid={`button-delete-pack-${pack.id}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-medium text-zinc-700 mb-3">Add credit pack</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-zinc-500">Credits</label>
              <input
                type="number"
                value={newPack.credits}
                onChange={e => setNewPack({ ...newPack, credits: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
                data-testid="input-pack-credits"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Price (cents)</label>
              <input
                type="number"
                value={newPack.priceUsd}
                onChange={e => setNewPack({ ...newPack, priceUsd: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
                data-testid="input-pack-price"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-zinc-500">Stripe Price ID (optional)</label>
              <input
                value={newPack.stripePriceId}
                onChange={e => setNewPack({ ...newPack, stripePriceId: e.target.value })}
                placeholder="price_..."
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
                data-testid="input-pack-stripe-id"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs pb-2">
                <input
                  type="checkbox"
                  checked={newPack.active}
                  onChange={e => setNewPack({ ...newPack, active: e.target.checked })}
                  className="rounded"
                  data-testid="checkbox-pack-active"
                />
                Active
              </label>
            </div>
          </div>
          <button
            onClick={() => {
              if (newPack.credits <= 0) return;
              onSavePack({
                credits: newPack.credits,
                priceUsd: newPack.priceUsd,
                ...(newPack.stripePriceId ? { stripePriceId: newPack.stripePriceId } : {}),
                active: newPack.active,
              });
              setNewPack({ credits: 100, priceUsd: 499, stripePriceId: "", active: true });
            }}
            disabled={newPack.credits <= 0 || isSavingPack}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            data-testid="button-add-pack"
          >
            <Plus className="w-3.5 h-3.5" />
            {isSavingPack ? "Saving..." : "Add pack"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeaturesTab({ gates, onSave, onDelete, isSaving }: { gates: FeatureGateItem[]; onSave: (data: { featureKey: string; requiredTier: string; creditCost: number; description: string }) => void; onDelete: (key: string) => void; isSaving: boolean }) {
  const [newGate, setNewGate] = useState({ featureKey: "", requiredTier: "simple", creditCost: 0, description: "" });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-zinc-100 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Feature Gates</h2>
        <p className="text-xs text-zinc-400 mb-4">Define which features require which tier. Unlocked beta users bypass all gates. Locked beta users are restricted to their assigned tier.</p>

        <div className="space-y-2 mb-6">
          {gates.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">No feature gates configured yet.</p>
          ) : (
            gates.map(gate => (
              <div key={gate.featureKey} className="flex items-center justify-between px-3 py-2 border border-zinc-100 rounded-xl" data-testid={`gate-${gate.featureKey}`}>
                <div>
                  <span className="text-sm font-medium text-zinc-900">{gate.featureKey}</span>
                  {gate.description && <p className="text-xs text-zinc-400">{gate.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full capitalize">{gate.requiredTier}</span>
                  {gate.creditCost > 0 && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{gate.creditCost} credits</span>
                  )}
                  <button
                    onClick={() => onDelete(gate.featureKey)}
                    className="text-xs text-red-500 hover:text-red-700"
                    data-testid={`button-delete-gate-${gate.featureKey}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-medium text-zinc-700 mb-3">Add feature gate</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              value={newGate.featureKey}
              onChange={e => setNewGate({ ...newGate, featureKey: e.target.value })}
              placeholder="feature_key"
              className="px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
              data-testid="input-gate-key"
            />
            <select
              value={newGate.requiredTier}
              onChange={e => setNewGate({ ...newGate, requiredTier: e.target.value })}
              className="px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white"
              data-testid="select-gate-tier"
            >
              <option value="free">Free</option>
              <option value="simple">Simple</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="number"
              value={newGate.creditCost}
              onChange={e => setNewGate({ ...newGate, creditCost: parseInt(e.target.value) || 0 })}
              placeholder="Credit cost (PAYG)"
              className="px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
              data-testid="input-gate-credit-cost"
            />
            <input
              value={newGate.description}
              onChange={e => setNewGate({ ...newGate, description: e.target.value })}
              placeholder="Description"
              className="px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
              data-testid="input-gate-description"
            />
          </div>
          <button
            onClick={() => {
              if (!newGate.featureKey.trim()) return;
              onSave(newGate);
              setNewGate({ featureKey: "", requiredTier: "simple", creditCost: 0, description: "" });
            }}
            disabled={!newGate.featureKey.trim() || isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            data-testid="button-add-gate"
          >
            <Plus className="w-3.5 h-3.5" />
            {isSaving ? "Saving..." : "Add gate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersTab({ users, onUpdateTier }: { users: AdminUser[]; onUpdateTier: (data: { userId: number; tier?: string; betaUser?: boolean; betaTierLocked?: boolean }) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-900">All Users</h2>
        <p className="text-xs text-zinc-400 mt-0.5">{users.length} registered users</p>
      </div>
      {users.length === 0 ? (
        <div className="text-center py-12 text-sm text-zinc-400">No users found.</div>
      ) : (
        <div className="divide-y divide-zinc-50">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between px-5 py-3" data-testid={`row-user-${u.id}`}>
              <div>
                <p className="text-sm font-medium text-zinc-900">{u.name}</p>
                <p className="text-xs text-zinc-400">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                {u.betaUser && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Beta</span>
                )}
                {u.betaUser && (
                  <button
                    onClick={() => onUpdateTier({ userId: u.id, betaTierLocked: !u.betaTierLocked })}
                    className={`text-xs px-2 py-0.5 rounded-full border ${u.betaTierLocked ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-zinc-50 text-zinc-400 border-zinc-200"}`}
                    title={u.betaTierLocked ? "Beta user locked to selected tier (gates enforced)" : "Beta user has full access (click to lock to tier)"}
                    data-testid={`button-lock-tier-${u.id}`}
                  >
                    {u.betaTierLocked ? "Locked" : "Unlocked"}
                  </button>
                )}
                {u.creditBalance > 0 && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{u.creditBalance} credits</span>
                )}
                <select
                  value={u.tier}
                  onChange={(e) => onUpdateTier({ userId: u.id, tier: e.target.value })}
                  className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  data-testid={`select-tier-${u.id}`}
                >
                  {TIER_OPTIONS.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
