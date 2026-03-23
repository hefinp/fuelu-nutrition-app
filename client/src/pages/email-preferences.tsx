import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";

type Prefs = {
  mealPlans: boolean;
  reengagement: boolean;
  marketing: boolean;
};

export default function EmailPreferencesPage() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing unsubscribe link.");
      setLoading(false);
      return;
    }
    fetch(`/api/email-preferences?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Failed to load preferences");
        }
        return res.json();
      })
      .then((data) => {
        setPrefs(data.preferences);
        setUserName(data.name || "");
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/email-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, preferences: prefs }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save");
      }
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnsubscribeAll() {
    setPrefs({ mealPlans: false, reengagement: false, marketing: false });
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/email-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, preferences: { mealPlans: false, reengagement: false, marketing: false } }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save");
      }
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !prefs) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl border border-zinc-100 p-8 max-w-md w-full text-center">
          <Mail className="w-8 h-8 text-zinc-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-zinc-900 mb-2">Email Preferences</h1>
          <p className="text-sm text-red-600" data-testid="text-error">{error || "Unable to load preferences."}</p>
        </div>
      </div>
    );
  }

  const categories = [
    { key: "mealPlans" as const, label: "Meal Plan Emails", desc: "Receive your generated meal plans via email" },
    { key: "reengagement" as const, label: "Re-engagement Reminders", desc: "Receive reminders when you haven't logged in a while" },
    { key: "marketing" as const, label: "Promotional & Waitlist Emails", desc: "Receive invitations and promotional updates" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100">
        <div className="max-w-lg mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
          <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-white rounded-full" />
          </div>
          <span className="font-semibold text-sm text-zinc-900">FuelU</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-zinc-100 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-zinc-400" />
            <h1 className="text-lg font-bold text-zinc-900" data-testid="heading-email-preferences">Email Preferences</h1>
          </div>
          {userName && (
            <p className="text-sm text-zinc-500">
              Managing email preferences for <strong className="text-zinc-700">{userName}</strong>
            </p>
          )}

          {saved && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl" data-testid="banner-saved">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-sm text-emerald-700">Your email preferences have been updated.</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700" data-testid="text-error">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            {categories.map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 p-3 rounded-xl border border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer" data-testid={`toggle-${key}`}>
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => {
                    setPrefs({ ...prefs, [key]: e.target.checked });
                    setSaved(false);
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  data-testid={`checkbox-${key}`}
                />
                <div>
                  <p className="text-sm font-medium text-zinc-900">{label}</p>
                  <p className="text-xs text-zinc-500">{desc}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-40"
              data-testid="button-save-preferences"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save preferences"}
            </button>
            <button
              onClick={handleUnsubscribeAll}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors disabled:opacity-40"
              data-testid="button-unsubscribe-all"
            >
              Unsubscribe from all
            </button>
          </div>

          <p className="text-xs text-zinc-400">
            Note: Transactional emails such as password resets will always be sent regardless of these settings.
          </p>
        </div>
      </main>
    </div>
  );
}
