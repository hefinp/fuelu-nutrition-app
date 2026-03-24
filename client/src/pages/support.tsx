import { Link } from "wouter";
import { ArrowLeft, Mail, Link2, RefreshCw, Unplug, HelpCircle } from "lucide-react";
import { SiStrava } from "react-icons/si";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100 sticky top-0 z-50 bg-white/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center relative">
              <div className="w-3 h-3 bg-white rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[calc(50%-6px)] bg-white rounded-t-sm" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-zinc-900">FuelU</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            data-testid="link-support-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex items-center gap-3 mb-2">
          <SiStrava className="w-6 h-6" style={{ color: "#FC4C02" }} />
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-zinc-900" data-testid="text-support-title">Strava Integration Support</h1>
        </div>
        <p className="text-sm text-zinc-400 mb-10">Help with connecting and using Strava on FuelU</p>

        <div className="space-y-8 text-zinc-700 leading-relaxed text-[15px]">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-5 h-5 text-zinc-400" />
              <h2 className="text-xl font-semibold text-zinc-900" data-testid="text-support-connecting">Connecting Your Strava Account</h2>
            </div>
            <p className="mb-2">To connect your Strava account to FuelU:</p>
            <ol className="list-decimal pl-6 space-y-1.5">
              <li>Go to your <strong>Dashboard</strong> and open the <strong>Settings</strong> tab.</li>
              <li>Expand the <strong>Connections</strong> section.</li>
              <li>Click <strong>Connect</strong> next to Strava.</li>
              <li>You will be redirected to Strava to authorise FuelU. Grant the requested permissions.</li>
              <li>Once authorised, you will be returned to FuelU and your recent activities will begin syncing.</li>
            </ol>
            <p className="mt-2 text-sm text-zinc-500">Make sure you are logged in to the correct Strava account before authorising.</p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-5 h-5 text-zinc-400" />
              <h2 className="text-xl font-semibold text-zinc-900" data-testid="text-support-syncing">Data Syncing</h2>
            </div>
            <p className="mb-2">FuelU syncs your recent Strava activities automatically. Here are some common questions:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li><strong>What data is synced?</strong> Activity name, type, duration, distance, and estimated calories burned.</li>
              <li><strong>How often does it sync?</strong> Activities are refreshed each time you visit your Dashboard or Diary page.</li>
              <li><strong>Why is an activity missing?</strong> Only activities from the last 30 days are displayed. Private activities on Strava may also not appear depending on your Strava privacy settings.</li>
              <li><strong>Can I manually trigger a sync?</strong> Refreshing your Dashboard or Diary page will fetch the latest activities from Strava.</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Unplug className="w-5 h-5 text-zinc-400" />
              <h2 className="text-xl font-semibold text-zinc-900" data-testid="text-support-disconnecting">Disconnecting Strava</h2>
            </div>
            <p className="mb-2">If you no longer want FuelU to access your Strava data:</p>
            <ol className="list-decimal pl-6 space-y-1.5">
              <li>Go to your <strong>Dashboard</strong> and open the <strong>Settings</strong> tab.</li>
              <li>Expand the <strong>Connections</strong> section.</li>
              <li>Click <strong>Disconnect</strong> next to Strava.</li>
            </ol>
            <p className="mt-2 text-sm text-zinc-500">Disconnecting removes FuelU's access to your Strava data. Your past logged meals and nutrition plans are not affected. You can reconnect at any time by following the connection steps above.</p>
            <p className="mt-1 text-sm text-zinc-500">You can also revoke access directly from <a href="https://www.strava.com/settings/apps" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-700" style={{ color: "#FC4C02" }} data-testid="link-strava-settings">your Strava settings</a>.</p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-5 h-5 text-zinc-400" />
              <h2 className="text-xl font-semibold text-zinc-900" data-testid="text-support-faq">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-medium text-zinc-900">Does FuelU post anything to Strava?</p>
                <p className="text-sm text-zinc-600">No. FuelU only reads your activity data. We never post, modify, or delete anything on your Strava account.</p>
              </div>
              <div>
                <p className="font-medium text-zinc-900">Will disconnecting delete my FuelU data?</p>
                <p className="text-sm text-zinc-600">No. Disconnecting only revokes Strava access. Your FuelU account, meal logs, and nutrition plans remain intact.</p>
              </div>
              <div>
                <p className="font-medium text-zinc-900">I connected Strava but don't see any activities.</p>
                <p className="text-sm text-zinc-600">Make sure you have recent public or followers-only activities on Strava. Try refreshing the page. If the issue persists, disconnect and reconnect your account.</p>
              </div>
            </div>
          </section>

          <div className="flex justify-center py-4" data-testid="support-strava-powered-badge">
            <img src="/strava-powered-by.svg" alt="Powered by Strava" className="h-6" />
          </div>

          <section className="border-t border-zinc-100 pt-8">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-zinc-400" />
              <h2 className="text-xl font-semibold text-zinc-900" data-testid="text-support-contact">Need More Help?</h2>
            </div>
            <p>If you are still experiencing issues with the Strava integration, please reach out to us:</p>
            <a
              href="mailto:support@fuelu.app"
              className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
              data-testid="link-support-email"
            >
              <Mail className="w-4 h-4" />
              Contact Support
            </a>
            <p className="mt-3 text-sm text-zinc-500">We typically respond within 24 hours.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
