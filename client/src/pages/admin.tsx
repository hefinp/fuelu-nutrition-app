import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { CheckCircle2, Circle, Plus, ShieldAlert, RefreshCw, Sparkles } from "lucide-react";
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

const ADMIN_EMAIL = "hefin.price@gmail.com";

interface InviteCode {
  code: string;
  usedAt: string | null;
  usedByEmail: string | null;
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [newCodes, setNewCodes] = useState("");

  const isAdmin = !!user && user.email === ADMIN_EMAIL;

  const { data: codes = [], isLoading: codesLoading, refetch } = useQuery<InviteCode[]>({
    queryKey: ["/api/admin/invite-codes"],
    enabled: isAdmin,
  });

  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useQuery<CommunityMealBalance>({
    queryKey: ["/api/admin/community-meal-balance"],
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-zinc-400" />
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

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-white rounded-full" />
            </div>
            <span className="font-semibold text-sm text-zinc-900">Fuelr Admin</span>
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
          <p className="text-xs text-zinc-400 mb-3">Enter one or more codes, separated by commas or new lines. They'll be uppercased automatically.</p>
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
            {addMutation.isPending ? "Adding…" : "Add codes"}
          </button>
        </div>

        {/* Community Meal Database */}
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Meal database</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Community + AI-curated meals by style and slot. Floor: 8 per bucket.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetchBalance()}
                className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
                title="Refresh"
                data-testid="button-refresh-balance"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${balanceLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => refillMutation.mutate()}
                disabled={refillMutation.isPending}
                data-testid="button-refill-balance"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {refillMutation.isPending ? "Generating…" : "Refresh & top up"}
              </button>
            </div>
          </div>

          {balanceLoading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-5 h-5 animate-spin text-zinc-300" />
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
                        const color = total >= 8 ? "text-emerald-600 bg-emerald-50 border-emerald-100" : total >= 4 ? "text-amber-600 bg-amber-50 border-amber-100" : "text-red-600 bg-red-50 border-red-100";
                        return (
                          <div
                            key={slot}
                            data-testid={`bucket-${style}-${slot}`}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs ${color}`}
                          >
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
            <button
              onClick={() => refetch()}
              className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
              title="Refresh"
              data-testid="button-refresh-codes"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${codesLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {codesLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin text-zinc-300" />
            </div>
          ) : codes.length === 0 ? (
            <div className="text-center py-12 text-sm text-zinc-400">No codes found.</div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {codes.map(c => (
                <div
                  key={c.code}
                  className="flex items-center justify-between px-5 py-3"
                  data-testid={`row-code-${c.code}`}
                >
                  <div className="flex items-center gap-3">
                    {c.usedAt
                      ? <CheckCircle2 className="w-4 h-4 text-zinc-300 shrink-0" />
                      : <Circle className="w-4 h-4 text-emerald-500 shrink-0" />
                    }
                    <span className={`font-mono text-sm font-medium ${c.usedAt ? "text-zinc-400" : "text-zinc-900"}`}>
                      {c.code}
                    </span>
                  </div>
                  {c.usedAt ? (
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">{c.usedByEmail}</p>
                      <p className="text-xs text-zinc-300">
                        {new Date(c.usedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Available
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
