import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function LandingPage({ loggedIn = false }: { loggedIn?: boolean }) {
  usePageMeta({
    title: "FuelU — Personalised Nutrition, Simplified",
    description: "Smart nutrition planning built around the way you eat. Personalised meal plans, easy macro tracking, and dietary support — all in one place.",
    ogTitle: "FuelU — Personalised Nutrition, Simplified",
    ogDescription: "Smart nutrition planning built around the way you eat. Personalised meal plans, easy macro tracking, and dietary support — all in one place.",
    ogImage: `${window.location.origin}/icon-512.png`,
    ogUrl: "https://fuelu.app",
    ogType: "website",
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Coming Soon Banner */}
      <div className="bg-zinc-900 text-white text-center py-2.5 px-4 text-sm font-medium tracking-wide z-50" data-testid="banner-coming-soon">
        Coming Soon — We're launching shortly. Stay tuned!
      </div>

      {/* Nav */}
      <header className="border-b border-zinc-100 sticky top-0 z-50 bg-white/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center relative">
              <div className="w-3 h-3 bg-white rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[calc(50%-6px)] bg-white rounded-t-sm" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-zinc-900">FuelU</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
              data-testid="link-landing-pricing"
            >
              Pricing
            </Link>
            {loggedIn ? (
              <Link
                href="/dashboard"
                className="text-sm font-medium px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
                data-testid="link-landing-dashboard"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/auth"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                  data-testid="link-landing-signin"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth?tab=register"
                  className="text-sm font-medium px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
                  data-testid="link-landing-get-started"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 bg-zinc-100 text-zinc-600 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            Free to get started — no credit card needed
          </div>

          <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight text-zinc-900 leading-tight mb-6">
            Nutrition, planned for you.
            <br />
            <span className="text-zinc-400">Coming soon.</span>
          </h1>

          <p className="text-lg text-zinc-500 max-w-xl mx-auto mb-6 leading-relaxed">
            Smart nutrition planning built around the way you eat. We're putting the finishing touches on something we think you'll love.
          </p>

          <ul className="inline-flex flex-col gap-2 text-sm text-zinc-600 text-left mb-10 mx-auto">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
              Personalised meal plans tailored to your goals
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
              Macro tracking made easy
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
              Built around your dietary preferences
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
              <span className="font-semibold text-zinc-900">No ads. Ever.</span>
            </li>
          </ul>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {loggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl font-medium hover:bg-zinc-800 transition-colors text-sm"
                data-testid="link-hero-dashboard"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth?tab=register"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl font-medium hover:bg-zinc-800 transition-colors text-sm"
                  data-testid="link-hero-get-started"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/auth"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-zinc-200 text-zinc-700 rounded-2xl font-medium hover:bg-zinc-50 transition-colors text-sm"
                  data-testid="link-hero-signin"
                >
                  Sign in to your account
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded-md flex items-center justify-center relative">
              <div className="w-2 h-2 bg-white rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-[calc(50%-4px)] bg-white rounded-t-sm" />
            </div>
            <span className="font-display font-semibold text-sm text-zinc-900">FuelU</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors" data-testid="link-footer-privacy">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors" data-testid="link-footer-terms">Terms of Service</Link>
            <Link href="/data-sources" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors" data-testid="link-footer-data-sources">Data Sources</Link>
          </div>
          <p className="text-xs text-zinc-400">&copy; 2026 FuelU. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

/* ── Original detailed sections (preserved for launch restore) ──
   Feature highlight cards, goal pills, feature cards grid, and CTA banner
   were removed for pre-launch. To restore:
   1. Add back imports: ChefHat, Filter, FileDown, ScanLine, Brain, HeartPulse
   2. Restore the features, highlights, and goals arrays
   3. Re-insert the Feature highlights grid after the CTA buttons
   4. Re-insert the Goal pills after the highlights
   5. Re-insert the Feature cards section before the footer
   6. Re-insert the CTA banner section before the footer
   7. Update hero subtitle from "Coming soon." back to "Simple. Gourmet. Michelin."
   8. Update bullet points back to detailed feature descriptions
   9. Update meta tags back to detailed descriptions
── */
