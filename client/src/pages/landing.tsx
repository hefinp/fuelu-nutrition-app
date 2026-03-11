import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Zap, BarChart3, CalendarDays, ShoppingCart } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Instant Calculations",
    description: "Enter your metrics and get precise daily calorie targets and macro splits in seconds.",
  },
  {
    icon: BarChart3,
    title: "Macro Breakdown",
    description: "Visual protein, carb, and fat targets tailored to your body type and fitness goal.",
  },
  {
    icon: CalendarDays,
    title: "Meal Plans",
    description: "AI-generated daily and weekly meal plans in Simple or Gourmet style, ready to export as PDF.",
  },
  {
    icon: ShoppingCart,
    title: "Shopping Lists",
    description: "Auto-generated shopping lists scaled to however many days you want to prep for.",
  },
];

const goals = [
  { label: "Fat Loss", color: "bg-rose-100 text-rose-700" },
  { label: "Tone & Define", color: "bg-amber-100 text-amber-700" },
  { label: "Maintain", color: "bg-emerald-100 text-emerald-700" },
  { label: "Build Muscle", color: "bg-blue-100 text-blue-700" },
  { label: "Bulk", color: "bg-purple-100 text-purple-700" },
];

export default function LandingPage({ loggedIn = false }: { loggedIn?: boolean }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-zinc-100 sticky top-0 z-50 bg-white/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-zinc-900">NutriSync</span>
          </div>
          <div className="flex items-center gap-3">
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
            Nutrition planning made simple
          </div>

          <h1 className="font-display font-bold text-5xl sm:text-6xl tracking-tight text-zinc-900 leading-tight mb-6">
            Your body.
            <br />
            <span className="text-zinc-400">Your fuel.</span>
          </h1>

          <p className="text-lg text-zinc-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Enter your metrics and goals — NutriSync calculates your exact daily calories, macro targets, and generates a personalised meal plan you can follow today.
          </p>

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

          {/* Goal pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-12">
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded-md flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
            <span className="font-display font-semibold text-sm text-zinc-900">NutriSync</span>
          </div>
          <p className="text-xs text-zinc-400">© 2026 NutriSync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
