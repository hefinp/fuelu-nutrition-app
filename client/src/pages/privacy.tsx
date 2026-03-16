import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            data-testid="link-privacy-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-zinc-900 mb-2" data-testid="text-privacy-title">Privacy Policy</h1>
        <p className="text-sm text-zinc-400 mb-10">Last updated: March 2026</p>

        <div className="prose prose-zinc max-w-none space-y-8 text-zinc-700 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">1. Information We Collect</h2>
            <p>When you create a FuelU account we collect your email address and a securely hashed password. To generate personalised nutrition plans we also collect body metrics you provide (age, height, weight, gender, activity level, and fitness goal). We do not collect data beyond what is needed to deliver the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">2. How We Use Your Data</h2>
            <p>Your data is used solely to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Authenticate your account and maintain your session.</li>
              <li>Calculate calorie targets, macronutrient breakdowns, and meal plans based on your metrics.</li>
              <li>Store your saved meal plans and weight-tracking entries so they are available when you return.</li>
              <li>Improve the service through aggregated, anonymised usage statistics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">3. Cookies &amp; Sessions</h2>
            <p>FuelU uses a single session cookie to keep you signed in. We do not use third-party tracking cookies or advertising pixels. The session cookie is HTTP-only and expires when you sign out or after a period of inactivity.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">4. Data Storage &amp; Security</h2>
            <p>All data is stored in a secured PostgreSQL database. Passwords are hashed using industry-standard algorithms and are never stored in plain text. Communication between your browser and our servers is encrypted via HTTPS.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">5. Data Sharing</h2>
            <p>We do not sell, rent, or share your personal data with third parties. We may disclose information only if required by law or to protect the rights and safety of FuelU and its users.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">6. Your Rights</h2>
            <p>You may update or delete your account data at any time through the application. If you have questions about your data, please contact us through the application.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">7. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. Significant changes will be communicated through the application. Continued use of FuelU after changes constitutes acceptance of the updated policy.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span className="text-xs text-zinc-400">&copy; 2026 FuelU</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium">Privacy</Link>
            <Link href="/terms" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors" data-testid="link-privacy-terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
