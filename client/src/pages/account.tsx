import { useState, useEffect } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useTierStatus } from "@/hooks/use-tier";
import { useToast } from "@/hooks/use-toast";
import type { PublicUser, UserPreferences } from "@shared/schema";
import {
  Crown, CreditCard, AlertTriangle, ArrowRight, Loader2, CheckCircle2,
  ArrowUpRight, User, Lock, ChevronRight, Globe, Database, ExternalLink, Trash2, Mail, Download,
} from "lucide-react";
import { ConfirmDialog, useConfirmDialog } from "@/components/confirm-dialog";

type Tab = "profile" | "plan";

export default function AccountPage() {
  const { user, isLoading: authLoading } = useAuth();
  const search = useSearch();
  const { toast } = useToast();
  const { data: tierStatus, isLoading: tierLoading } = useTierStatus();
  const { confirm, dialogProps } = useConfirmDialog();

  const searchParams = new URLSearchParams(search);
  const initialTab = (searchParams.get("tab") as Tab) || "profile";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const tab = (new URLSearchParams(search).get("tab") as Tab) || "profile";
    setActiveTab(tab);
  }, [search]);

  const successParam = searchParams.get("success");
  const cancelledParam = searchParams.get("cancelled");

  useEffect(() => {
    if (successParam) {
      toast({
        title: "Subscription activated!",
        description: "Welcome to your new plan.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }
    if (cancelledParam) {
      toast({ title: "Checkout cancelled", description: "No changes were made to your account." });
    }
  }, [successParam, cancelledParam]);

  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available?: boolean; message?: string }>({ checking: false });
  const [profileCountry, setProfileCountry] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const { data: userPreferences } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    enabled: !!user,
  });

  type EmailPrefs = { mealPlans: boolean; reengagement: boolean; marketing: boolean };
  const { data: emailPrefs } = useQuery<EmailPrefs>({
    queryKey: ["/api/user/email-preferences"],
    enabled: !!user,
  });

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileUsername(user.username ?? "");
      setProfileEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    const trimmed = profileUsername.trim();
    if (!trimmed || trimmed.length < 3) {
      setUsernameStatus({ checking: false });
      return;
    }
    if (trimmed === user?.username) {
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
  }, [profileUsername, user?.username]);

  useEffect(() => {
    if (userPreferences) {
      // Default to NZ when no country has been saved yet
      setProfileCountry(userPreferences.country ?? "nz");
    }
  }, [userPreferences]);

  const profileMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string; username?: string }) => {
      const res = await apiRequest("PUT", "/api/auth/profile", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (updated: PublicUser) => {
      queryClient.setQueryData<PublicUser | null>(["/api/auth/me"], (old) => old ? { ...old, ...updated } : old ?? null);
      toast({ title: "Profile updated", description: "Your profile has been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const countryMutation = useMutation({
    mutationFn: async (country: string) => {
      const current = userPreferences ?? {};
      const res = await apiRequest("PUT", "/api/user/preferences", { ...current, country: country || undefined });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Country saved", description: "Your regional food database preference has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save country.", variant: "destructive" });
    },
  });

  const emailPrefsMutation = useMutation({
    mutationFn: async (prefs: EmailPrefs) => {
      const res = await apiRequest("PUT", "/api/user/email-preferences", prefs);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/email-preferences"] });
      toast({ title: "Email preferences saved", description: "Your email notification settings have been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("PUT", "/api/auth/password", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const [, setLocation] = useLocation();

  const deleteAccountMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("DELETE", "/api/auth/account", password ? { password } : {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      setDeleteConfirmOpen(false);
      queryClient.clear();
      setLocation("/");
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
    },
  });

  const [exportLoading, setExportLoading] = useState(false);
  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const res = await fetch("/api/auth/export-data", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: "Your data has been downloaded." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast({ title: "Export failed", description: message, variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
  };

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/create-portal", {});
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/cancel-subscription", {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data: { message: string; periodEnd?: number }) => {
      const endDate = data.periodEnd ? new Date(data.periodEnd * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
      toast({ title: "Subscription cancelled", description: endDate ? `You'll keep access until ${endDate}.` : "You'll keep access until the end of your billing period." });
      queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const downgradeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/downgrade-to-free", {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data: { message: string; periodEnd?: number }) => {
      const endDate = data.periodEnd ? new Date(data.periodEnd * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
      toast({ title: "Switching to Free", description: endDate ? `You'll have full access until ${endDate}.` : data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/tier/status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (authLoading || tierLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-zinc-600">Please sign in to view your account.</p>
        <Link href="/auth" className="text-sm text-zinc-500 hover:text-zinc-800 underline" data-testid="link-account-signin">Sign in</Link>
      </div>
    );
  }

  const tier = tierStatus?.tier === "payg" ? "free" : (tierStatus?.tier || "free");
  const betaUser = tierStatus?.betaUser || false;
  const tierExpiresAt = tierStatus?.tierExpiresAt;
  const pendingTier = tierStatus?.pendingTier;
  const paymentFailed = !!tierStatus?.paymentFailedAt;
  const isPaid = tier === "simple" || tier === "advanced";

  const tierNames: Record<string, string> = { free: "Free", simple: "Simple", advanced: "Advanced" };

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    const updates: { name?: string; email?: string; username?: string } = {};
    if (profileName !== user!.name) updates.name = profileName;
    if (profileEmail !== user!.email) updates.email = profileEmail;
    const trimmedUsername = profileUsername.trim();
    if (trimmedUsername && trimmedUsername !== (user!.username ?? "")) updates.username = trimmedUsername;
    if (Object.keys(updates).length === 0) {
      toast({ title: "No changes", description: "Your profile is already up to date." });
      return;
    }
    profileMutation.mutate(updates);
  }

  function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-white rounded-full" />
            </div>
            <span className="font-semibold text-sm text-zinc-900">My Account</span>
          </div>
          <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors" data-testid="link-account-dashboard">
            Back to app
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-1 mb-6 p-1 bg-white border border-zinc-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "profile" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
            data-testid="tab-profile"
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab("plan")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "plan" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
            data-testid="tab-plan"
          >
            <Crown className="w-4 h-4" />
            Plan & Billing
          </button>
        </div>

        {activeTab === "profile" && (
          <div className="space-y-6">
            <form onSubmit={handleProfileSave} className="bg-white rounded-2xl border border-zinc-100 p-6 space-y-4" data-testid="form-profile">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-900">Profile Details</h2>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Full Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                  data-testid="input-profile-name"
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Username</label>
                <input
                  type="text"
                  value={profileUsername}
                  onChange={e => setProfileUsername(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent ${usernameStatus.available === false ? "border-red-400" : usernameStatus.available === true ? "border-emerald-400" : "border-zinc-200"}`}
                  data-testid="input-profile-username"
                  minLength={3}
                  maxLength={20}
                  placeholder="your_username"
                />
                {usernameStatus.checking && (
                  <p className="text-xs text-zinc-400">Checking availability...</p>
                )}
                {!usernameStatus.checking && usernameStatus.available === true && (
                  <p className="text-xs text-emerald-600">Username is available</p>
                )}
                {!usernameStatus.checking && usernameStatus.available === false && usernameStatus.message && (
                  <p className="text-xs text-red-600">{usernameStatus.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Email Address</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={e => setProfileEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                  data-testid="input-profile-email"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={profileMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-40"
                data-testid="button-save-profile"
              >
                {profileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
              </button>
            </form>

            <div className="bg-white rounded-2xl border border-zinc-100 p-6 space-y-4" data-testid="card-region-settings">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-900">Regional Food Database</h2>
              </div>
              <p className="text-xs text-zinc-500">
                Select your country to prioritise local NZ and AU verified food data in search results.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Country</label>
                <select
                  value={profileCountry}
                  onChange={e => setProfileCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white"
                  data-testid="select-profile-country"
                >
                  <option value="">Not specified</option>
                  <option value="nz">New Zealand</option>
                  <option value="au">Australia</option>
                  <option value="us">United States</option>
                  <option value="uk">United Kingdom</option>
                  <option value="ca">Canada</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => countryMutation.mutate(profileCountry)}
                disabled={countryMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-40"
                data-testid="button-save-country"
              >
                {countryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save country"}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-100 p-6 space-y-4" data-testid="card-data-sources">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-900">Data Sources</h2>
              </div>
              <p className="text-xs text-zinc-500">
                Nutrition data in FuelU is sourced from the following open databases.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                  <div>
                    <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-zinc-900 hover:underline" data-testid="link-source-openfoodfacts">Open Food Facts</a>
                    <p className="text-xs text-zinc-500">Open database of food products from around the world, licensed under ODbL.</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                  <div>
                    <a href="https://www.foodcomposition.co.nz/" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-zinc-900 hover:underline" data-testid="link-source-nzfcd">NZ Food Composition Database (NZFCD)</a>
                    <p className="text-xs text-zinc-500">Provided by Plant &amp; Food Research New Zealand and the Ministry of Health.</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                  <div>
                    <a href="https://www.foodstandards.gov.au/science-data/monitoringnutrients/ausnut/ausnut-2011-13" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-zinc-900 hover:underline" data-testid="link-source-fsanz">FSANZ AUSNUT 2011–13</a>
                    <p className="text-xs text-zinc-500">Australian food nutrient database by Food Standards Australia New Zealand, under Creative Commons licensing.</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                  <div>
                    <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-zinc-900 hover:underline" data-testid="link-source-usda">USDA FoodData Central</a>
                    <p className="text-xs text-zinc-500">Comprehensive food nutrient database maintained by the U.S. Department of Agriculture.</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-100 p-6 space-y-4" data-testid="card-email-preferences">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-900">Email Preferences</h2>
              </div>
              <p className="text-xs text-zinc-500">
                Choose which types of emails you'd like to receive. Transactional emails like password resets are always sent.
              </p>
              {emailPrefs && (
                <div className="space-y-3">
                  {[
                    { key: "mealPlans" as const, label: "Meal Plan Emails", desc: "Receive your generated meal plans via email" },
                    { key: "reengagement" as const, label: "Re-engagement Reminders", desc: "Receive reminders when you haven't logged in a while" },
                    { key: "marketing" as const, label: "Promotional & Waitlist Emails", desc: "Receive invitations and promotional updates" },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-start gap-3 p-3 rounded-xl border border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer" data-testid={`toggle-email-${key}`}>
                      <input
                        type="checkbox"
                        checked={emailPrefs[key]}
                        onChange={(e) => {
                          emailPrefsMutation.mutate({ ...emailPrefs, [key]: e.target.checked });
                        }}
                        className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                        data-testid={`checkbox-email-${key}`}
                      />
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{label}</p>
                        <p className="text-xs text-zinc-500">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handlePasswordSave} className="bg-white rounded-2xl border border-zinc-100 p-6 space-y-4" data-testid="form-password">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-900">Change Password</h2>
              </div>

              {user.provider ? (
                <p className="text-xs text-zinc-500">
                  You signed in with {user.provider === "google" ? "Google" : "Apple"}. Password changes are not available for social sign-in accounts.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                      data-testid="input-current-password"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                      data-testid="input-new-password"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                      data-testid="input-confirm-password"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={passwordMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-40"
                    data-testid="button-change-password"
                  >
                    {passwordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
                  </button>
                </>
              )}
            </form>

            <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4" data-testid="card-export-data">
              <div className="flex items-center gap-2 mb-2">
                <Download className="w-4 h-4 text-zinc-500" />
                <h2 className="text-sm font-semibold text-zinc-900">Download My Data</h2>
              </div>
              <p className="text-xs text-zinc-500">
                Export all your personal data in a machine-readable JSON format. This includes your profile, preferences, food logs, meal plans, saved meals and recipes, weight history, cycle data, vitality data, and community contributions.
              </p>
              <button
                type="button"
                onClick={handleExportData}
                disabled={exportLoading}
                className="flex items-center gap-1.5 px-4 py-2 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors disabled:opacity-50"
                data-testid="button-export-data"
              >
                {exportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {exportLoading ? "Preparing export…" : "Download My Data"}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-red-100 p-6 space-y-4" data-testid="card-delete-account">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-semibold text-zinc-900">Delete Account</h2>
              </div>
              <p className="text-xs text-zinc-500">
                Permanently delete your account and all associated data. This action is irreversible &mdash; all your meal plans, food logs, weight history, cycle data, and preferences will be permanently removed.
              </p>
              <button
                type="button"
                onClick={() => { setDeleteConfirmOpen(true); setDeletePassword(""); setDeleteError(""); }}
                className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors"
                data-testid="button-delete-account"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete My Account
              </button>
            </div>

            {deleteConfirmOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-zinc-900">Delete your account?</h3>
                      <p className="text-xs text-zinc-500">This cannot be undone.</p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-600">
                    All your data will be permanently deleted, including meal plans, food logs, weight history, cycle data, saved recipes, and preferences. This action is irreversible.
                  </p>
                  {deleteError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" data-testid="error-delete-account">
                      {deleteError}
                    </div>
                  )}
                  {!user.provider && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-500">Enter your password to confirm</label>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={e => { setDeletePassword(e.target.value); setDeleteError(""); }}
                        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        data-testid="input-delete-password"
                        placeholder="Your current password"
                      />
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(false)}
                      className="flex-1 px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors"
                      data-testid="button-cancel-delete"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAccountMutation.mutate(deletePassword)}
                      disabled={deleteAccountMutation.isPending || (!user.provider && !deletePassword)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                      data-testid="button-confirm-delete"
                    >
                      {deleteAccountMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete permanently
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "plan" && (
          <div className="space-y-6">
            {paymentFailed && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl" data-testid="banner-payment-failed">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Payment failed</p>
                  <p className="text-xs text-red-600 mt-1">
                    Your last payment failed and your account has been reverted to the Free tier. Please update your payment method to restore access.
                  </p>
                  <button
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    className="mt-2 text-xs font-medium text-red-700 underline hover:text-red-900"
                    data-testid="link-update-payment"
                  >
                    Update payment method
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-zinc-100 p-6" data-testid="card-current-plan">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Current Plan</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <Crown className="w-5 h-5 text-amber-500" />
                    <span className="text-lg font-bold text-zinc-900" data-testid="text-current-tier">{tierNames[tier] || tier}</span>
                    {betaUser && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full" data-testid="badge-beta">
                        Beta
                      </span>
                    )}
                    {pendingTier && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full" data-testid="badge-pending-tier">
                        Switching to {tierNames[pendingTier] || pendingTier}
                      </span>
                    )}
                  </div>
                </div>
                {isPaid && tierExpiresAt && (
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">Next billing date</p>
                    <p className="text-sm font-medium text-zinc-700" data-testid="text-billing-date">
                      {new Date(tierExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/pricing"
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
                  data-testid="link-change-plan"
                >
                  Change plan
                  <ArrowRight className="w-4 h-4" />
                </Link>
                {isPaid && !pendingTier && (
                  <button
                    onClick={() => confirm({
                      title: "Switch to Free tier?",
                      description: "You'll keep access to your current plan until the end of your billing period. After that, your account will revert to the Free tier.",
                      confirmLabel: "Switch to Free",
                      onConfirm: () => downgradeMutation.mutate(),
                    })}
                    disabled={downgradeMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors disabled:opacity-40"
                    data-testid="button-downgrade-free"
                  >
                    {downgradeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Switch to Free"}
                  </button>
                )}
              </div>
            </div>

            {tier === "simple" && !betaUser && !pendingTier && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6" data-testid="card-advanced-upgrade-teaser">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900">Unlock the full FuelU experience</h3>
                </div>
                <ul className="space-y-2 mb-4">
                  {[
                    "Unlimited saved meal plans",
                    "Advanced analytics & trend insights",
                    "Full nutrition data export",
                    "Priority support",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-zinc-700">
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
                  data-testid="link-upgrade-to-advanced"
                >
                  <Crown className="w-3.5 h-3.5" />
                  Upgrade to Advanced
                </Link>
              </div>
            )}

            {isPaid && (
              <div className="bg-white rounded-2xl border border-zinc-100 p-6" data-testid="card-payment-method">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-zinc-400" />
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">Payment Method</h2>
                      <p className="text-xs text-zinc-400 mt-0.5">Manage your payment details via Stripe</p>
                    </div>
                  </div>
                  <button
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-colors disabled:opacity-40"
                    data-testid="button-manage-billing"
                  >
                    {portalMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                      <>Manage <ArrowUpRight className="w-3.5 h-3.5" /></>
                    )}
                  </button>
                </div>
              </div>
            )}

            {betaUser && (
              <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-2xl" data-testid="banner-beta-user">
                <CheckCircle2 className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-purple-800">Beta Access</p>
                  <p className="text-xs text-purple-600 mt-1">
                    As a beta user, you have full access to all features indefinitely. Thank you for being an early supporter!
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-zinc-100 p-5" data-testid="card-billing-link">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Full Billing History</p>
                  <p className="text-xs text-zinc-400 mt-0.5">View the legacy billing page</p>
                </div>
                <Link
                  href="/billing"
                  className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
                  data-testid="link-billing-page"
                >
                  View <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {isPaid && !pendingTier && (
              <div className="bg-white rounded-2xl border border-red-100 p-6" data-testid="card-cancel-subscription">
                <h2 className="text-sm font-semibold text-zinc-900 mb-1">Cancel subscription</h2>
                <p className="text-xs text-zinc-400 mb-4">
                  You'll keep access to your current plan features until the end of your billing period. After that, your account will revert to the Free tier.
                </p>
                <button
                  onClick={() => confirm({
                    title: "Cancel subscription?",
                    description: "You'll keep access until the end of your billing period, then revert to the Free tier.",
                    confirmLabel: "Cancel subscription",
                    onConfirm: () => cancelMutation.mutate(),
                  })}
                  disabled={cancelMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors disabled:opacity-40"
                  data-testid="button-cancel-subscription"
                >
                  {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel subscription"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
