import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100 sticky top-0 z-50 bg-white/90 backdrop-blur-sm safe-area-inset-top">
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
            <p>By creating an account or using FuelU you agree to these Terms of Service and our <Link href="/privacy" className="underline text-zinc-900 hover:text-zinc-600">Privacy Policy</Link>. If you do not agree, please do not use the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">2. Eligibility &amp; Minimum Age</h2>
            <p>You must be at least <strong>16 years old</strong> to use FuelU if you are located in the European Union or the United Kingdom. In all other regions, you must be at least <strong>13 years old</strong>. By creating an account, you confirm that you meet the applicable minimum age requirement.</p>
            <p className="mt-2">If you are under 18, you should review these terms with a parent or guardian. We do not knowingly collect data from users below the applicable minimum age. If we discover an underage account, we will delete it and all associated data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">3. Description of Service</h2>
            <p>FuelU is a nutrition calculator, meal-planning tool, and wellness tracker. It provides estimated calorie targets, macronutrient breakdowns, sample meal plans, food logging, cycle-aware nutrition adjustments, and AI-powered insights based on the body metrics and goals you supply.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">4. Health Disclaimer</h2>
            <p><strong>FuelU is not a medical service and does not provide medical advice.</strong> All calorie targets, macro breakdowns, meal plans, cycle-phase recommendations, vitality insights, and AI-generated suggestions are estimates based on widely used formulas and general nutritional guidelines. They should not be treated as medical advice, diagnosis, or treatment.</p>
            <p className="mt-2">You should consult a qualified healthcare professional before making significant dietary changes, especially if you have a medical condition, eating disorder, food allergies, pregnancy, or special nutritional needs. FuelU is not a substitute for professional medical advice.</p>
            <p className="mt-2">By using the service, you acknowledge that you follow any nutrition plans, meal suggestions, or insights at your own risk.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">5. AI-Generated Content</h2>
            <p>FuelU uses artificial intelligence (powered by OpenAI) to generate meal plans, nutrition insights, food recognition results, and wellness recommendations. You should be aware that:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>AI-generated content may contain errors, inaccuracies, or suggestions that are not suitable for your specific health situation.</li>
              <li>AI outputs are not reviewed by a medical professional before being shown to you.</li>
              <li>Nutritional values in AI-generated meal plans are estimates and may differ from actual values.</li>
              <li>You should independently verify any AI-generated information before relying on it, particularly for allergy or medical dietary needs.</li>
            </ul>
            <p className="mt-3">FuelU does not guarantee the accuracy, completeness, or suitability of any AI-generated content.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">6. User Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information when creating your account and using the calculator. FuelU reserves the right to suspend or terminate accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">7. Account Deletion</h2>
            <p>You may delete your account at any time from the Account settings page. Account deletion is permanent and irreversible &mdash; all your data, including meal plans, food logs, weight history, cycle data, and preferences, will be permanently removed from our systems.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">8. Limitation of Liability</h2>
            <p>FuelU and its operators shall not be held liable for any direct, indirect, incidental, or consequential damages arising from your use of the service, including but not limited to health outcomes resulting from following generated meal plans or AI-generated suggestions. The service is provided &ldquo;as is&rdquo; without warranties of any kind.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">9. Intellectual Property</h2>
            <p>All content, design, and code comprising FuelU are the property of its operators. You may not reproduce, distribute, or create derivative works from the service without prior written consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">10. Modifications</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the service after changes are posted constitutes acceptance of the revised terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">11. Governing Law</h2>
            <p>These terms are governed by the laws of New Zealand. Any disputes arising from the use of FuelU shall be resolved in accordance with the jurisdiction of the courts of New Zealand.</p>
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
