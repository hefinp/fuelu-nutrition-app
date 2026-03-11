import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [, setLocation] = useLocation();
  const { login, register, isLoggingIn, isRegistering } = useAuth();

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
      setLocation("/");
    } catch (err: any) {
      setLoginError(err.message || "Login failed");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    try {
      await register({ email: regEmail, name: regName, password: regPassword });
      setLocation("/");
    } catch (err: any) {
      setRegError(err.message || "Registration failed");
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
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-1">Welcome back</h2>
                <p className="text-sm text-zinc-500">Sign in to access your nutrition plans.</p>
              </div>

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

              <p className="text-center text-sm text-zinc-500">
                No account?{" "}
                <button type="button" onClick={() => setTab("register")} className="text-zinc-900 font-medium hover:underline">
                  Create one
                </button>
              </p>
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
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-1">Create account</h2>
                <p className="text-sm text-zinc-500">Start tracking your nutrition journey.</p>
              </div>

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
