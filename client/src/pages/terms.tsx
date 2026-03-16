import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
            data-testid="link-terms-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-zinc-900 mb-2" data-testid="text-terms-title">Terms of Service</h1>
        <p className="text-sm text-zinc-400 mb-10">Last updated: March 2026</p>

        <div className="prose prose-zinc max-w-none space-y-8 text-zinc-700 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">1. Acceptance of Terms</h2>
            <p>By creating an account or using FuelU you agree to these Terms of Service. If you do not agree, please do not use the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">2. Description of Service</h2>
            <p>FuelU is a nutrition calculator and meal-planning tool. It provides estimated calorie targets, macronutrient breakdowns, and sample meal plans based on the body metrics and goals you supply. The service is provided free of charge.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">3. Health Disclaimer</h2>
            <p>FuelU is not a medical service. All calorie targets, macro breakdowns, and meal plans are estimates based on widely used formulas (Mifflin-St Jeor) and should not be treated as medical advice. You should consult a qualified healthcare professional before making significant dietary changes, especially if you have a medical condition, food allergies, or special nutritional needs.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">4. User Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information when creating your account and using the calculator. FuelU reserves the right to suspend or terminate accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">5. Limitation of Liability</h2>
            <p>FuelU and its operators shall not be held liable for any direct, indirect, incidental, or consequential damages arising from your use of the service, including but not limited to health outcomes resulting from following generated meal plans. The service is provided &ldquo;as is&rdquo; without warranties of any kind.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">6. Intellectual Property</h2>
            <p>All content, design, and code comprising FuelU are the property of its operators. You may not reproduce, distribute, or create derivative works from the service without prior written consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">7. Modifications</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the service after changes are posted constitutes acceptance of the revised terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">8. Governing Law</h2>
            <p>These terms are governed by applicable law. Any disputes arising from the use of FuelU shall be resolved in accordance with the jurisdiction of the service operator.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span className="text-xs text-zinc-400">&copy; 2026 FuelU</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors" data-testid="link-terms-privacy">Privacy</Link>
            <Link href="/terms" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
