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
            <p>When you create a FuelU account we collect your email address and a securely hashed password (or, if you use social sign-in, your name and email from your identity provider). To generate personalised nutrition plans we also collect body metrics you choose to provide, including:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Age, height, weight, gender, activity level, and fitness goal.</li>
              <li>Weight-tracking entries over time.</li>
              <li>Dietary preferences, allergies, and excluded or preferred foods.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">2. Health &amp; Sensitive Data</h2>
            <p>FuelU may collect data that is considered sensitive or &ldquo;special category&rdquo; data under applicable privacy laws. This includes:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Menstrual cycle information</strong> &mdash; last period date, cycle length, period length, and daily symptom logs (energy, bloating, cravings, mood, appetite).</li>
              <li><strong>Vitality &amp; wellness metrics</strong> &mdash; energy, motivation, focus, stress, sleep quality, and libido self-assessments.</li>
              <li><strong>Biometric data</strong> &mdash; height, weight, body-weight history, and age.</li>
              <li><strong>Dietary and health-related preferences</strong> &mdash; food allergies, dietary restrictions, and medical dietary needs.</li>
            </ul>
            <p className="mt-3">We collect this data <strong>only with your explicit consent</strong> (provided during onboarding or when you enable optional features) and solely to personalise your nutrition plans, calorie targets, and wellness insights. You may withdraw consent at any time by disabling the relevant feature or deleting your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">3. How We Use Your Data</h2>
            <p>Your data is used solely to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Authenticate your account and maintain your session.</li>
              <li>Calculate calorie targets, macronutrient breakdowns, and meal plans based on your metrics.</li>
              <li>Provide cycle-aware and vitality-aware nutrition adjustments when you opt in.</li>
              <li>Generate AI-powered insights, meal suggestions, and food recognition results.</li>
              <li>Store your saved meal plans, food logs, recipes, and weight-tracking entries.</li>
              <li>Process payments and manage your subscription or credit balance.</li>
              <li>Improve the service through aggregated, anonymised usage statistics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">4. Third-Party Data Processors</h2>
            <p>We share your data with the following third-party service providers, each of which processes data strictly in accordance with their own privacy policies and our data-processing agreements:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>OpenAI</strong> &mdash; powers AI meal plan generation, food recognition from photos, and nutrition insights. Anonymised or pseudonymised meal and nutrition data may be sent to OpenAI&rsquo;s API for processing. OpenAI does not use API data to train its models.</li>
              <li><strong>Stripe</strong> &mdash; processes subscription payments and credit purchases. Stripe receives your email and payment method details. FuelU does not store card numbers.</li>
              <li><strong>Google / Apple</strong> &mdash; if you use social sign-in (Google or Apple), these providers share your name and email with us to authenticate your identity.</li>
              <li><strong>USDA FoodData Central</strong> &mdash; food nutrition data is retrieved from the U.S. Department of Agriculture&rsquo;s public API. No personal data is sent to USDA.</li>
              <li><strong>Open Food Facts</strong> &mdash; barcode and food product data is retrieved from the Open Food Facts open database. No personal data is sent to Open Food Facts.</li>
            </ul>
            <p className="mt-3">We do not sell, rent, or share your personal data with advertisers or data brokers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">5. Cross-Border Data Transfers</h2>
            <p>FuelU is operated from New Zealand. Your data may be processed in countries outside your own, including the United States (where OpenAI and Stripe infrastructure is hosted) and the European Economic Area. Where data is transferred outside your jurisdiction, we rely on:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Standard Contractual Clauses (SCCs) approved by the European Commission, where applicable.</li>
              <li>The data-processing agreements of our sub-processors, which include equivalent safeguards.</li>
              <li>Your explicit consent, where required by applicable law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">6. Cookies &amp; Sessions</h2>
            <p>FuelU uses a single session cookie to keep you signed in. We do not use third-party tracking cookies or advertising pixels. The session cookie is HTTP-only and expires when you sign out or after a period of inactivity.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">7. Data Storage &amp; Security</h2>
            <p>All data is stored in a secured PostgreSQL database. Passwords are hashed using industry-standard algorithms (bcrypt) and are never stored in plain text. Communication between your browser and our servers is encrypted via HTTPS.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">8. Data Retention</h2>
            <p>We retain your personal data for as long as your account is active. Specifically:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Account data</strong> (email, name, hashed password) &mdash; retained until you delete your account.</li>
              <li><strong>Health &amp; biometric data</strong> (cycle logs, vitality logs, weight entries, body metrics) &mdash; retained until you delete your account or disable the relevant feature.</li>
              <li><strong>Food logs, meal plans, and recipes</strong> &mdash; retained until you delete your account or remove individual entries.</li>
              <li><strong>Payment records</strong> &mdash; Stripe retains transaction records per its own retention policy. We retain a reference to your Stripe customer ID until account deletion.</li>
              <li><strong>AI insights cache</strong> &mdash; cached for up to 24 hours and then automatically expired.</li>
            </ul>
            <p className="mt-3">When you delete your account, all associated data is permanently and irreversibly removed from our database.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">9. Your Rights</h2>
            <p>Depending on your location, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Access</strong> &mdash; request a copy of the data we hold about you.</li>
              <li><strong>Rectification</strong> &mdash; correct any inaccurate data via the app&rsquo;s account settings.</li>
              <li><strong>Erasure</strong> &mdash; permanently delete your account and all associated data using the &ldquo;Delete My Account&rdquo; feature.</li>
              <li><strong>Restriction &amp; Objection</strong> &mdash; request that we limit or stop processing your data in certain circumstances.</li>
              <li><strong>Portability</strong> &mdash; request your data in a structured, commonly used format.</li>
              <li><strong>Withdraw Consent</strong> &mdash; withdraw consent for health data processing at any time without affecting lawfulness of prior processing.</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, please contact us through the application or email the address listed in the Contact section below. We will respond within 30 days (or sooner where required by law).</p>
            <p className="mt-2"><strong>California residents (CCPA/CPRA):</strong> You have the right to know what personal information we collect, request its deletion, and opt out of the sale of personal information. We do not sell personal information. You will not receive discriminatory treatment for exercising your privacy rights.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">10. Children&rsquo;s Privacy</h2>
            <p>FuelU is not directed at children. We require users to be at least 16 years old (or 13 where permitted by local law). We do not knowingly collect personal data from anyone under the applicable minimum age. If we become aware that a user is under the minimum age, we will promptly delete their account and data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. Significant changes will be communicated through the application. Continued use of FuelU after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">12. Contact</h2>
            <p>If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us through the application or by email at the address provided in the app&rsquo;s support section.</p>
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
