import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { apiRequest } from "@/lib/queryClient";

export default function AuthPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialTab = params.get("tab") === "register" ? "register" : "login";
  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [, setLocation] = useLocation();
  const { login, register, isLoggingIn, isRegistering } = useAuth();
  const queryClient = useQueryClient();

  const oauthError = params.get("error");
  const oauthPending = params.get("oauth_pending"); // e.g. "google"
  const oauthEmail = params.get("email") ?? "";
  const nutritionistInviteToken = params.get("nutritionist_invite") ?? "";

  useEffect(() => {
    const t = new URLSearchParams(search).get("tab");
    if (t === "register") setTab("register");
  }, [search]);

  const { data: providers } = useQuery<{ google: boolean; apple: boolean }>({
    queryKey: ["/api/auth/providers"],
  });

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register form state
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regInviteCode, setRegInviteCode] = useState("");
  const [regError, setRegError] = useState("");
  const [inviteCodeError, setInviteCodeError] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [regDateOfBirth, setRegDateOfBirth] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available?: boolean; message?: string }>({ checking: false });

  // OAuth invite form state
  const [oauthInviteCode, setOauthInviteCode] = useState("");
  const [oauthUsername, setOauthUsername] = useState("");
  const [oauthInviteError, setOauthInviteError] = useState("");
  const [isSubmittingOauthInvite, setIsSubmittingOauthInvite] = useState(false);
  const [oauthUsernameStatus, setOauthUsernameStatus] = useState<{ checking: boolean; available?: boolean; message?: string }>({ checking: false });

  const { data: inviteConfig } = useQuery<{ required: boolean }>({
    queryKey: ["/api/auth/invite-required"],
  });

  useEffect(() => {
    const trimmed = regUsername.trim();
    if (!trimmed || trimmed.length < 3) {
      setUsernameStatus({ checking: false });
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setUsernameStatus({ checking: false, available: false, message: "Only letters, numbers, underscores, and hyphens" });
      return;
    }
    setUsernameStatus({ checking: true });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setUsernameStatus({ checking: false, available: data.available, message: data.message });
      } catch {
        setUsernameStatus({ checking: false });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [regUsername]);

  useEffect(() => {
    const trimmed = oauthUsername.trim();
    if (!trimmed || trimmed.length < 3) {
      setOauthUsernameStatus({ checking: false });
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setOauthUsernameStatus({ checking: false, available: false, message: "Only letters, numbers, underscores, and hyphens" });
      return;
    }
    setOauthUsernameStatus({ checking: true });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setOauthUsernameStatus({ checking: false, available: data.available, message: data.message });
      } catch {
        setOauthUsernameStatus({ checking: false });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [oauthUsername]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      await login({ identifier: loginIdentifier, password: loginPassword });
      setLocation("/dashboard");
    } catch (err: any) {
      setLoginError(err.message || "Login failed");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    setInviteCodeError("");
    try {
      await register({
        email: regEmail,
        name: regName,
        username: regUsername.trim(),
        password: regPassword,
        inviteCode: nutritionistInviteToken ? undefined : (regInviteCode || undefined),
        nutritionistInviteToken: nutritionistInviteToken || undefined,
        agreedToTerms: agreedToTerms as true,
        dateOfBirth: regDateOfBirth,
      });
      setLocation("/verify-email");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      if (msg.toLowerCase().includes("invite code")) {
        setInviteCodeError(msg);
      } else {
        setRegError(msg);
      }
    }
  }

  async function handleOAuthInvite(e: React.FormEvent) {
    e.preventDefault();
    setOauthInviteError("");
    setIsSubmittingOauthInvite(true);
    try {
      await apiRequest("POST", "/api/auth/oauth-invite", { inviteCode: oauthInviteCode, username: oauthUsername.trim() });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/dashboard");
    } catch (err: any) {
      setOauthInviteError(err.message || "Invalid invite code");
    } finally {
      setIsSubmittingOauthInvite(false);
    }
  }

  const hasOAuth = providers?.google || providers?.apple;

  const oauthErrorMessage =
    oauthError === "google_failed" ? "Google sign-in failed. Please try again." :
    oauthError === "apple_failed" ? "Apple sign-in failed. Please try again." :
    null;

  // ── OAuth invite gate mode ─────────────────────────────────────────────────
  if (oauthPending) {
    return (
      <div className="min-h-screen bg-zinc-50/50 flex flex-col items-center justify-center px-4">
        <div className="mb-8 flex items-center gap-2">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center relative">
            <div className="w-3 h-3 bg-white rounded-full" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[calc(50%-6px)] bg-white rounded-t-sm" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-zinc-900">FuelU</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-zinc-100 shadow-lg w-full max-w-md p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-zinc-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">One more step</h2>
              <p className="text-sm text-zinc-500">FuelU is in private beta</p>
            </div>
          </div>

          <p className="text-sm text-zinc-600 mb-6">
            You're signing in as <span className="font-medium text-zinc-900">{oauthEmail}</span>. Enter your invite code to complete registration.
          </p>

          <form onSubmit={handleOAuthInvite} className="space-y-4">
            {oauthInviteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" data-testid="error-oauth-invite">
                {oauthInviteError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Username</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={20}
                value={oauthUsername}
                onChange={e => { setOauthUsername(e.target.value); setOauthInviteError(""); }}
                placeholder="your_username"
                className={`w-full px-4 py-2.5 border rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent ${oauthUsernameStatus.available === false ? "border-red-400" : oauthUsernameStatus.available === true ? "border-emerald-400" : "border-zinc-200"}`}
                data-testid="input-oauth-username"
              />
              {oauthUsernameStatus.checking && (
                <p className="mt-1 text-xs text-zinc-400">Checking availability...</p>
              )}
              {!oauthUsernameStatus.checking && oauthUsernameStatus.available === true && (
                <p className="mt-1 text-xs text-emerald-600">Username is available</p>
              )}
              {!oauthUsernameStatus.checking && oauthUsernameStatus.available === false && oauthUsernameStatus.message && (
                <p className="mt-1 text-xs text-red-600">{oauthUsernameStatus.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Invite Code</label>
              <input
                type="text"
                required
                value={oauthInviteCode}
                onChange={e => { setOauthInviteCode(e.target.value); setOauthInviteError(""); }}
                placeholder="Enter your invite code"
                className={`w-full px-4 py-2.5 border rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent ${oauthInviteError ? "border-red-400" : "border-zinc-200"}`}
                data-testid="input-oauth-invite-code"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingOauthInvite}
              className="w-full py-2.5 bg-zinc-900 text-white rounded-xl font-medium text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-oauth-invite-submit"
            >
              {isSubmittingOauthInvite && <Loader2 className="w-4 h-4 animate-spin" />}
              Complete Sign In
            </button>

            <p className="text-center text-sm text-zinc-500">
              Don't have a code?{" "}
              <a href="/auth" className="text-zinc-900 font-medium hover:underline">Go back</a>
            </p>
          </form>
        </motion.div>
      </div>
    );
  }

  // ── Normal login / register ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col items-center justify-center px-4">
      <div className="mb-8 flex items-center gap-2">
        <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center relative">
          <div className="w-3 h-3 bg-white rounded-full" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[calc(50%-6px)] bg-white rounded-t-sm" />
        </div>
        <span className="font-display font-bold text-xl tracking-tight text-zinc-900">FuelU</span>
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
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email or username</label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={e => setLoginIdentifier(e.target.value)}
                  placeholder="you@example.com or your username"
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                  data-testid="input-login-identifier"
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

              {nutritionistInviteToken && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800" data-testid="banner-nutritionist-invite">
                  <span>You have been invited by your nutritionist. Create your account to get started.</span>
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
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={20}
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  placeholder="your_username"
                  className={`w-full px-4 py-2.5 border rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent ${usernameStatus.available === false ? "border-red-400" : usernameStatus.available === true ? "border-emerald-400" : "border-zinc-200"}`}
                  data-testid="input-register-username"
                />
                {usernameStatus.checking && (
                  <p className="mt-1 text-xs text-zinc-400" data-testid="username-checking">Checking availability...</p>
                )}
                {!usernameStatus.checking && usernameStatus.available === true && (
                  <p className="mt-1 text-xs text-emerald-600" data-testid="username-available">Username is available</p>
                )}
                {!usernameStatus.checking && usernameStatus.available === false && usernameStatus.message && (
                  <p className="mt-1 text-xs text-red-600" data-testid="username-unavailable">{usernameStatus.message}</p>
                )}
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

              {inviteConfig?.required && !nutritionistInviteToken && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Invite Code</label>
                  <input
                    type="text"
                    value={regInviteCode}
                    onChange={e => { setRegInviteCode(e.target.value); setInviteCodeError(""); }}
                    placeholder="Enter your invite code"
                    className={`w-full px-4 py-2.5 border rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent ${inviteCodeError ? "border-red-400" : "border-zinc-200"}`}
                    data-testid="input-register-invite-code"
                  />
                  {inviteCodeError && (
                    <p className="mt-1 text-xs text-red-600" data-testid="error-invite-code">{inviteCodeError}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  required
                  value={regDateOfBirth}
                  onChange={e => setRegDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                  data-testid="input-register-dob"
                />
                <p className="mt-1 text-xs text-zinc-400">You must be at least 16 years old (EU/UK) or 13 years old (other regions)</p>
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 shrink-0"
                    data-testid="checkbox-agree-terms"
                  />
                  <span className="text-xs text-zinc-600 leading-relaxed">
                    I agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-zinc-900 font-medium underline hover:text-zinc-700">Terms of Service</a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-zinc-900 font-medium underline hover:text-zinc-700">Privacy Policy</a>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isRegistering || !agreedToTerms || !regDateOfBirth}
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
