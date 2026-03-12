import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";

export default function AuthPage() {
  const search = useSearch();
  const initialTab = new URLSearchParams(search).get("tab") === "register" ? "register" : "login";
  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [, setLocation] = useLocation();
  const { login, register, isLoggingIn, isRegistering } = useAuth();

  const oauthError = new URLSearchParams(search).get("error");

  useEffect(() => {
    const t = new URLSearchParams(search).get("tab");
    if (t === "register") setTab("register");
  }, [search]);

  const { data: providers } = useQuery<{ google: boolean; apple: boolean }>({
    queryKey: ["/api/auth/providers"],
  });

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regError, setRegError] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      await login({ email: loginEmail, password: loginPassword });
      setLocation("/dashboard");
    } catch (err: any) {
      setLoginError(err.message || "Login failed");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    try {
      await register({ email: regEmail, name: regName, password: regPassword });
      setLocation("/dashboard");
    } catch (err: any) {
      setRegError(err.message || "Registration failed");
    }
  }

  const hasOAuth = providers?.google || providers?.apple;

  const oauthErrorMessage =
    oauthError === "google_failed" ? "Google sign-in failed. Please try again." :
    oauthError === "apple_failed" ? "Apple sign-in failed. Please try again." :
    null;

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
        {/* Tabs */}
        <div className="flex bg-zinc-100 rounded-xl p-1 mb-8">
          <button
            onClick={() => { setTab("login"); setLoginError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === "login" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="tab-login"
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab("register"); setRegError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === "register" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            data-testid="tab-register"
          >
            Create Account
          </button>
        </div>

        {/* OAuth error */}
        {oauthErrorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" data-testid="error-oauth">
            {oauthErrorMessage}
          </div>
        )}

        {/* OAuth buttons */}
        {hasOAuth && (
          <div className="space-y-2.5 mb-6">
            {providers?.google && (
              <a
                href="/api/auth/google"
                data-testid="button-google-signin"
                className="flex items-center justify-center gap-3 w-full py-2.5 px-4 bg-white border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
              >
                <SiGoogle className="w-4 h-4 text-[#4285F4]" />
                Continue with Google
              </a>
            )}
            {providers?.apple && (
              <a
                href="/api/auth/apple"
                data-testid="button-apple-signin"
                className="flex items-center justify-center gap-3 w-full py-2.5 px-4 bg-zinc-900 border border-zinc-900 rounded-xl text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
              >
                <SiApple className="w-4 h-4" />
                Continue with Apple
              </a>
            )}

            <div className="relative pt-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-zinc-400">or continue with email</span>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {tab === "login" ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleLogin}
              className="space-y-4"
            >
              {!hasOAuth && (
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900 mb-1">Welcome back</h2>
                  <p className="text-sm text-zinc-500">Sign in to access your nutrition plans.</p>
                </div>
              )}

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" data-testid="error-login">
                  {loginError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                  data-testid="input-login-email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showLoginPw ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent pr-11"
                    data-testid="input-login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw(!showLoginPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 bg-zinc-900 text-white rounded-xl font-medium text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="button-login-submit"
              >
                {isLoggingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>

              <div className="flex items-center justify-between text-sm text-zinc-500">
                <span>
                  No account?{" "}
                  <button type="button" onClick={() => setTab("register")} className="text-zinc-900 font-medium hover:underline">
                    Create one
                  </button>
                </span>
                <a href="/forgot-password" className="text-zinc-400 hover:text-zinc-700 transition-colors text-xs" data-testid="link-forgot-password">
                  Forgot password?
                </a>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="register"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleRegister}
              className="space-y-4"
            >
              {!hasOAuth && (
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900 mb-1">Create account</h2>
                  <p className="text-sm text-zinc-500">Start tracking your nutrition journey.</p>
                </div>
              )}

              {regError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" data-testid="error-register">
                  {regError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                  data-testid="input-register-name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                  data-testid="input-register-email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showRegPw ? "text" : "password"}
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent pr-11"
                    data-testid="input-register-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPw(!showRegPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-2.5 bg-zinc-900 text-white rounded-xl font-medium text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="button-register-submit"
              >
                {isRegistering && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account
              </button>

              <p className="text-center text-sm text-zinc-500">
                Already have an account?{" "}
                <button type="button" onClick={() => setTab("login")} className="text-zinc-900 font-medium hover:underline">
                  Sign in
                </button>
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
