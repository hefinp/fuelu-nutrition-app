import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase, Users, Star, ChevronRight, Check } from "lucide-react";
import type { NutritionistProfile } from "@shared/schema";

const TIERS = [
  {
    id: "starter",
    name: "Starter",
    limit: 15,
    price: "Free",
    description: "Get started with a small client base",
    features: ["Up to 15 clients", "Client profiles & notes", "Onboarding invitations", "Client roster"],
    highlight: false,
  },
  {
    id: "professional",
    name: "Professional",
    limit: 40,
    price: "Coming soon",
    description: "Scale your practice with more clients",
    features: ["Up to 40 clients", "Everything in Starter", "Priority support", "Advanced reporting"],
    highlight: true,
  },
  {
    id: "practice",
    name: "Practice",
    limit: 999,
    price: "Coming soon",
    description: "Unlimited clients for large practices",
    features: ["Unlimited clients", "Everything in Professional", "Dedicated support", "Custom onboarding"],
    highlight: false,
  },
];

export default function NutritionistRegisterPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedTier, setSelectedTier] = useState("starter");
  const [bio, setBio] = useState("");
  const [credentials, setCredentials] = useState("");

  const { data: existingProfile, isLoading: profileLoading } = useQuery<NutritionistProfile | null>({
    queryKey: ["/api/nutritionist/profile"],
    retry: false,
    enabled: !!user,
  });

  const registerMutation = useMutation({
    mutationFn: (data: { tier: string; bio?: string; credentials?: string }) =>
      apiRequest("POST", "/api/nutritionist/profile", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Professional account created!", description: "Welcome to the FuelU nutritionist platform." });
      setLocation("/nutritionist/portal");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Registration failed", description: message, variant: "destructive" });
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-zinc-600 mb-4">You must be signed in to register as a nutritionist.</p>
          <Link href="/auth" className="text-zinc-900 font-semibold underline" data-testid="link-sign-in-nutritionist">Sign In</Link>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (existingProfile) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">You already have a professional account</h2>
          <p className="text-zinc-500 mb-6">Your nutritionist profile is active. Head to your professional portal.</p>
          <Link
            href="/nutritionist/portal"
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
            data-testid="link-go-to-portal"
          >
            Go to Professional Portal
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-16">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center relative">
              <div className="w-3 h-3 bg-white rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[calc(50%-6px)] bg-white rounded-t-sm" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight text-zinc-900">FuelU</h1>
          </Link>
          <span className="text-sm text-zinc-500">Professional Registration</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-zinc-900 tracking-tight mb-2">
            Register as a Nutritionist
          </h1>
          <p className="text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            Set up your professional account to manage clients, track their progress, and deliver personalised nutrition support.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {TIERS.map(tier => (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelectedTier(tier.id)}
              data-testid={`tier-card-${tier.id}`}
              className={`relative text-left p-5 rounded-2xl border-2 transition-all ${
                selectedTier === tier.id
                  ? "border-zinc-900 bg-white shadow-md"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-white px-2 py-0.5 rounded-full">
                  Popular
                </span>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-zinc-900">{tier.name}</span>
                {selectedTier === tier.id && (
                  <div className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500 mb-3">{tier.description}</p>
              <div className="flex items-center gap-1.5 mb-3">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-700">{tier.limit === 999 ? "Unlimited" : `Up to ${tier.limit}`} clients</span>
              </div>
              <ul className="space-y-1">
                {tier.features.map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <span className="text-sm font-semibold text-zinc-900">{tier.price}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Professional Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="credentials">
                Credentials <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <input
                id="credentials"
                type="text"
                value={credentials}
                onChange={e => setCredentials(e.target.value)}
                placeholder="e.g. RD, CNS, MSc Nutrition"
                maxLength={500}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-400 transition-colors"
                data-testid="input-credentials"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="bio">
                Professional Bio <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell clients a bit about your background and approach..."
                maxLength={1000}
                rows={4}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-400 transition-colors resize-none"
                data-testid="textarea-bio"
              />
              <p className="text-xs text-zinc-400 mt-1 text-right">{bio.length}/1000</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => registerMutation.mutate({ tier: selectedTier, bio: bio || undefined, credentials: credentials || undefined })}
          disabled={registerMutation.isPending}
          className="w-full py-4 px-6 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          data-testid="button-register-nutritionist"
        >
          {registerMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating your account...
            </>
          ) : (
            <>
              <Star className="w-4 h-4" />
              Create Professional Account
            </>
          )}
        </button>

        <p className="text-center text-xs text-zinc-400 mt-4">
          You can always change your details in your professional profile settings.
        </p>
      </main>
    </div>
  );
}
