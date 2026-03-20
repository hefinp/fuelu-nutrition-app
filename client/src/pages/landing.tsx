import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, ChefHat, Filter, FileDown, Check, ScanLine, Brain, HeartPulse } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

const features = [
  {
    icon: ChefHat,
    title: "Three Meal-Style Tiers",
    description: "Choose Simple, Gourmet, or Michelin-inspired meals — every plan is tailored to your cooking ambition.",
  },
  {
    icon: Filter,
    title: "Allergy & Preference Filtering",
    description: "Exclude allergens, flag disliked foods, and highlight your favourites — every meal respects your dietary choices.",
  },
  {
    icon: FileDown,
    title: "PDF Export & Email Delivery",
    description: "Download your plan or shopping list as a print-ready PDF, or email the full breakdown straight to your inbox.",
  },
  {
    icon: ScanLine,
    title: "Barcode & AI Food Scanning",
    description: "Scan barcodes or snap a photo — our AI reads nutrition labels and recognises foods to log macros instantly.",
  },
];

const highlights = [
  { icon: Brain, label: "AI Meal Plans", desc: "Three tiers of personalised plans" },
  { icon: ScanLine, label: "Smart Scanning", desc: "Barcode + AI food recognition" },
  { icon: HeartPulse, label: "Cycle-Aware", desc: "Nutrition adapts to your cycle" },
];

const goals = [
  { label: "Fat Loss", color: "bg-rose-100 text-rose-700" },
  { label: "Tone & Define", color: "bg-amber-100 text-amber-700" },
  { label: "Maintain", color: "bg-emerald-100 text-emerald-700" },
  { label: "Build Muscle", color: "bg-blue-100 text-blue-700" },
  { label: "Bulk", color: "bg-purple-100 text-purple-700" },
];

export default function LandingPage({ loggedIn = false }: { loggedIn?: boolean }) {
  usePageMeta({
    title: "FuelU — Personalised Meal Plans in Three Cooking Tiers",
    description: "Track macros, log meals with AI scanning, and get personalised nutrition plans in Simple, Gourmet, or Michelin-inspired tiers. Free to start — no credit card needed.",
    ogTitle: "FuelU — Personalised Meal Plans in Three Cooking Tiers",
    ogDescription: "AI-powered nutrition planning with three cooking tiers. Track macros, scan barcodes, export PDFs, and get cycle-aware meal plans built around how you actually eat.",
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
            Free nutrition planning — no credit card needed
          </div>

          <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight text-zinc-900 leading-tight mb-6">
            Nutrition, planned for you.
            <br />
            <span className="text-zinc-400">Simple. Gourmet. Michelin.</span>
          </h1>

          <p className="text-lg text-zinc-500 max-w-xl mx-auto mb-6 leading-relaxed">
            Track your macros, log meals with AI scanning, and get personalised plans in three cooking tiers — all built around how you actually eat.
          </p>

          <ul className="inline-flex flex-col gap-2 text-sm text-zinc-600 text-left mb-10 mx-auto">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
              Three meal-style tiers — Simple, Gourmet, and Michelin-inspired
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
              Barcode scanning &amp; AI food recognition — log meals in seconds
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
              PDF export, email delivery &amp; smart shopping lists
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

          {/* Feature highlights */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto mt-12">
            {highlights.map(h => (
              <div key={h.label} className="bg-zinc-50 border border-zinc-100 rounded-2xl p-3 sm:p-4 text-center" data-testid={`highlight-${h.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <h.icon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-sm text-zinc-900">{h.label}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{h.desc}</p>
              </div>
            ))}
          </div>

          {/* Goal pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-8">
            {goals.map(g => (
              <span key={g.label} className={`text-xs font-medium px-3 py-1 rounded-full ${g.color}`}>
                {g.label}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Feature cards */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i + 0.3, ease: "easeOut" }}
              className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6 hover:bg-zinc-100/60 transition-colors"
            >
              <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display font-semibold text-zinc-900 text-base mb-1.5">{f.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA banner */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
          className="bg-zinc-900 rounded-3xl px-8 py-12 text-center"
        >
          <h2 className="font-display font-bold text-3xl text-white mb-3 tracking-tight">
            Ready to hit your goals?
          </h2>
          <p className="text-zinc-400 text-sm mb-8 max-w-sm mx-auto">
            Create a free account and get your personalised plan in under a minute.
          </p>
          <Link
            href="/auth?tab=register"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-zinc-900 rounded-2xl font-medium hover:bg-zinc-100 transition-colors text-sm"
            data-testid="link-cta-get-started"
          >
            Create Free Account
            <ArrowRight className="w-4 h-4" />
          </Link>
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
