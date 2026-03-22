import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, CheckCircle2, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface NutritionistPublicInfo {
  id: number;
  name: string;
}

export default function WaitlistSignupPage() {
  const [, params] = useRoute("/waitlist/:nutritionistId");
  const nutritionistId = params?.nutritionistId ? parseInt(params.nutritionistId) : null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: nutritionist, isLoading: infoLoading, error: infoError } = useQuery<NutritionistPublicInfo>({
    queryKey: ["/api/public/waitlist", nutritionistId],
    queryFn: () => apiRequest("GET", `/api/public/waitlist/${nutritionistId}`).then(r => r.json()),
    enabled: !!nutritionistId,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: (data: { name: string; email: string; notes?: string }) =>
      apiRequest("POST", `/api/public/waitlist/${nutritionistId}`, data).then(r => r.json()),
    onSuccess: () => {
      setSubmitted(true);
      setError(null);
    },
    onError: (err: any) => {
      setError(err?.message ?? "Something went wrong. Please try again.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    submitMutation.mutate({ name: name.trim(), email: email.trim(), notes: notes.trim() || undefined });
  }

  if (!nutritionistId || isNaN(nutritionistId)) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-zinc-100 p-8 max-w-md w-full text-center">
          <p className="text-zinc-500">Invalid waitlist link.</p>
        </div>
      </div>
    );
  }

  if (infoLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (infoError || !nutritionist) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-zinc-100 p-8 max-w-md w-full text-center">
          <p className="text-zinc-500">This waitlist link is invalid or no longer active.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-zinc-100 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">You're on the waitlist!</h2>
          <p className="text-sm text-zinc-500">
            Thanks for signing up. <strong>{nutritionist.name}</strong> will be in touch when a slot becomes available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-zinc-100 p-8 max-w-md w-full">
        <div className="mb-6">
          <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-zinc-500" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 mb-1">Join the waitlist</h1>
          <p className="text-sm text-zinc-500">
            Request a spot with <strong>{nutritionist.name}</strong>. You'll be notified when a slot opens up.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-waitlist-signup">
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Your name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              required
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-400"
              data-testid="input-signup-name"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Email address *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-400"
              data-testid="input-signup-email"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">A brief note (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Tell us a bit about your goals..."
              rows={3}
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-400 resize-none"
              data-testid="input-signup-notes"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" data-testid="text-signup-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitMutation.isPending || !name.trim() || !email.trim()}
            className="w-full py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            data-testid="button-signup-submit"
          >
            {submitMutation.isPending ? "Joining..." : "Join waitlist"}
          </button>
        </form>

        <p className="text-xs text-zinc-400 text-center mt-4">
          Powered by <span className="font-semibold">FuelU</span>
        </p>
      </div>
    </div>
  );
}
