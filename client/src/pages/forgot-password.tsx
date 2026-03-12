import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Something went wrong");
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col items-center justify-center px-4">
      <div className="mb-8 flex items-center gap-2">
        <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
          <div className="w-3 h-3 bg-white rounded-full" />
        </div>
        <span className="font-display font-bold text-xl tracking-tight text-zinc-900">NutriSync</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-zinc-100 shadow-lg w-full max-w-md p-8"
      >
        {sent ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Check your inbox</h2>
            <p className="text-sm text-zinc-500 mb-6">
              If <strong>{email}</strong> is registered, we sent a password reset link. It expires in 1 hour.
            </p>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 hover:underline"
              data-testid="link-back-to-login"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 mb-1">Forgot password?</h2>
              <p className="text-sm text-zinc-500">Enter your email and we'll send you a reset link.</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" data-testid="error-forgot">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                  data-testid="input-forgot-email"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-zinc-900 text-white rounded-xl font-medium text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="button-forgot-submit"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Reset Link
              </button>

              <p className="text-center text-sm text-zinc-500">
                <Link href="/auth" className="text-zinc-900 font-medium hover:underline" data-testid="link-back-signin">
                  <span className="inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In</span>
                </Link>
              </p>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
