import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, AtSign } from "lucide-react";
import type { PublicUser } from "@shared/schema";

export function UsernamePrompt() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<{ checking: boolean; available?: boolean; message?: string }>({ checking: false });

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 3) {
      setStatus({ checking: false });
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setStatus({ checking: false, available: false, message: "Only letters, numbers, underscores, and hyphens" });
      return;
    }
    setStatus({ checking: true });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setStatus({ checking: false, available: data.available, message: data.message });
      } catch {
        setStatus({ checking: false });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const mutation = useMutation({
    mutationFn: async (newUsername: string) => {
      const res = await apiRequest("PUT", "/api/auth/profile", { username: newUsername });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json() as Promise<PublicUser>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<PublicUser | null>(["/api/auth/me"], (old) => old ? { ...old, ...updated } : old ?? null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  if (!user || user.username) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    mutation.mutate(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/60 flex items-center justify-center px-4" data-testid="username-prompt-overlay">
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center">
            <AtSign className="w-5 h-5 text-zinc-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Choose a username</h2>
            <p className="text-sm text-zinc-500">This will be shown publicly in community features</p>
          </div>
        </div>

        <p className="text-sm text-zinc-600 mb-6">
          Your username keeps your real name and email private when interacting with others. Pick something unique — you can change it later in settings.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" data-testid="error-username-prompt">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Username</label>
            <input
              type="text"
              required
              autoFocus
              minLength={3}
              maxLength={20}
              value={username}
              onChange={e => { setUsername(e.target.value); setError(""); }}
              placeholder="your_username"
              className={`w-full px-4 py-2.5 border rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent ${status.available === false ? "border-red-400" : status.available === true ? "border-emerald-400" : "border-zinc-200"}`}
              data-testid="input-username-prompt"
            />
            {status.checking && (
              <p className="mt-1 text-xs text-zinc-400">Checking availability...</p>
            )}
            {!status.checking && status.available === true && (
              <p className="mt-1 text-xs text-emerald-600">Username is available</p>
            )}
            {!status.checking && status.available === false && status.message && (
              <p className="mt-1 text-xs text-red-600">{status.message}</p>
            )}
            <p className="mt-1.5 text-xs text-zinc-400">3–20 characters, letters, numbers, underscores, or hyphens</p>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending || status.checking || status.available === false}
            className="w-full py-2.5 bg-zinc-900 text-white rounded-xl font-medium text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="button-username-prompt-submit"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Set Username
          </button>
        </form>
      </div>
    </div>
  );
}
