import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTierStatus } from "@/hooks/use-tier";
import { useActiveFlow } from "@/contexts/active-flow-context";
import type { PublicUser, UserPreferences } from "@shared/schema";

declare global {
  interface Window {
    adsbygoogle: (Record<string, unknown> | unknown)[];
  }
}

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
const ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT as string | undefined;

interface AdPolicy {
  exclusions: string[];
  hasSensitiveProfile: boolean;
  diet: string | null;
  allergenCount: number;
}

type AllergenKey =
  | "gluten" | "crustaceans" | "eggs" | "fish" | "peanuts"
  | "soy" | "milk" | "nuts" | "celery" | "mustard"
  | "sesame" | "sulphites" | "lupin" | "molluscs";

type DietKey = "vegetarian" | "vegan" | "pescatarian" | "halal" | "kosher";

const FALLBACK_ADS = [
  {
    id: "ad-hydration",
    title: "Stay Hydrated",
    body: "Track your water intake and hit your daily hydration goals with smart reminders.",
    cta: "Learn More",
    href: "https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/",
    conflicts: { diets: [] as DietKey[], allergens: [] as AllergenKey[] },
  },
  {
    id: "ad-sleep",
    title: "Sleep & Recovery",
    body: "Quality sleep is essential for metabolism and muscle recovery. Evidence-based tips.",
    cta: "Read Guide",
    href: "https://www.sleepfoundation.org/nutrition",
    conflicts: { diets: [] as DietKey[], allergens: [] as AllergenKey[] },
  },
  {
    id: "ad-protein",
    title: "Protein & Muscle Health",
    body: "Getting enough protein supports muscle maintenance, satiety, and long-term health.",
    cta: "View Research",
    href: "https://www.healthline.com/nutrition/how-much-protein-per-day",
    conflicts: { diets: ["vegan", "vegetarian"] as DietKey[], allergens: [] as AllergenKey[] },
  },
  {
    id: "ad-plant-protein",
    title: "Plant-Based Protein Sources",
    body: "Legumes, tofu, tempeh, and seeds offer complete amino acid profiles for plant-based diets.",
    cta: "Explore Foods",
    href: "https://www.healthline.com/nutrition/protein-for-vegans-vegetarians",
    conflicts: { diets: [] as DietKey[], allergens: ["soy"] as AllergenKey[] },
  },
  {
    id: "ad-mindful",
    title: "Mindful Eating",
    body: "Research shows mindful eating improves digestion and reduces overeating. Start today.",
    cta: "Get Started",
    href: "https://www.health.harvard.edu/staying-healthy/8-steps-to-mindful-eating",
    conflicts: { diets: [] as DietKey[], allergens: [] as AllergenKey[] },
  },
  {
    id: "ad-fibre",
    title: "Fibre & Gut Health",
    body: "A fibre-rich diet supports a healthy gut microbiome and improves satiety.",
    cta: "Explore Foods",
    href: "https://www.nhs.uk/live-well/eat-well/digestive-health/how-to-get-more-fibre-into-your-diet/",
    conflicts: { diets: [] as DietKey[], allergens: [] as AllergenKey[] },
  },
  {
    id: "ad-omega3",
    title: "Omega-3 Benefits",
    body: "Omega-3 fatty acids support brain health, reduce inflammation, and protect the heart.",
    cta: "Learn More",
    href: "https://www.healthline.com/nutrition/omega-3-guide",
    conflicts: {
      diets: ["vegan", "vegetarian"] as DietKey[],
      allergens: ["fish", "crustaceans", "molluscs"] as AllergenKey[],
    },
  },
  {
    id: "ad-omega3-plant",
    title: "Plant Omega-3 Sources",
    body: "Chia seeds, flaxseeds, and hemp seeds are excellent plant-based omega-3 sources.",
    cta: "See Guide",
    href: "https://www.healthline.com/nutrition/7-plant-sources-of-omega-3s",
    conflicts: { diets: [] as DietKey[], allergens: ["nuts"] as AllergenKey[] },
  },
  {
    id: "ad-movement",
    title: "Daily Movement Matters",
    body: "Even 20–30 minutes of walking per day significantly improves metabolic health outcomes.",
    cta: "Read More",
    href: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
    conflicts: { diets: [] as DietKey[], allergens: [] as AllergenKey[] },
  },
];

function selectFallbackAd(prefs: UserPreferences | null): typeof FALLBACK_ADS[number] {
  const diet = (prefs?.diet ?? null) as DietKey | null;
  const allergens = (prefs?.allergies ?? []) as AllergenKey[];

  const eligible = FALLBACK_ADS.filter(ad => {
    if (diet && ad.conflicts.diets.includes(diet)) return false;
    for (const allergy of allergens) {
      if (ad.conflicts.allergens.includes(allergy)) return false;
    }
    return true;
  });

  const pool = eligible.length > 0 ? eligible : [FALLBACK_ADS[0]];
  const idx = Math.floor(Date.now() / (1000 * 60 * 10)) % pool.length;
  return pool[idx];
}

function shouldShowAds(user: PublicUser, effectiveTier: string): boolean {
  if (effectiveTier !== "free") return false;
  if (user.betaUser) return false;
  if (user.isManagedClient) return false;
  return true;
}

function AdSenseBannerSlot({ exclusions }: { exclusions: string[] }) {
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;
    if (!document.querySelector(`script[src*="pagead2.googlesyndication.com"]`)) {
      const script = document.createElement("script");
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (pushed.current || !insRef.current) return;
    pushed.current = true;
    try {
      const pushObj: Record<string, unknown> = {};
      if (exclusions.length > 0) {
        pushObj["google_ad_category_exclusion"] = exclusions;
      }
      (window.adsbygoogle = window.adsbygoogle || []).push(pushObj);
    } catch {
      // AdSense script not yet loaded — ad will initialise when script loads
    }
  }, [exclusions]);

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: "block", width: "100%", height: "50px" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={ADSENSE_SLOT}
      data-ad-format="horizontal"
      data-full-width-responsive="false"
    />
  );
}

export function AdBanner() {
  const { user } = useAuth();
  const { data: tierStatus, isLoading: tierLoading } = useTierStatus();
  const { isAnyFlowActive } = useActiveFlow();
  const [dismissed, setDismissed] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const fetchedRef = useRef(false);

  const { data: adPolicy } = useQuery<AdPolicy>({
    queryKey: ["/api/ads/policy"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!user || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/api/user/preferences", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setPrefs(data as UserPreferences);
      })
      .catch(() => {});
  }, [user]);

  if (!user) return null;
  if (tierLoading) return null;

  const effectiveTier = tierStatus?.tier ?? user.tier ?? "free";

  if (!shouldShowAds(user, effectiveTier)) return null;
  if (isAnyFlowActive) return null;
  if (dismissed) return null;

  const adSenseConfigured = !!(ADSENSE_CLIENT && ADSENSE_SLOT);
  const exclusions = adPolicy?.exclusions ?? [];
  const hasSensitiveProfile = adPolicy?.hasSensitiveProfile ?? false;

  const useProgrammaticAds = adSenseConfigured && !hasSensitiveProfile;
  const fallbackAd = !useProgrammaticAds ? selectFallbackAd(prefs) : null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-50 border-t border-zinc-200 shadow-sm"
      data-testid="ad-banner"
      role="complementary"
      aria-label="Sponsored health content"
    >
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-3">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide shrink-0 select-none">
          Ad
        </span>

        <div className="flex-1 min-w-0">
          {useProgrammaticAds ? (
            <AdSenseBannerSlot exclusions={exclusions} />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xs text-zinc-600 truncate">
                <span className="font-medium text-zinc-800">{fallbackAd!.title}:</span>{" "}
                {fallbackAd!.body}
              </p>
              <a
                href={fallbackAd!.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2 whitespace-nowrap"
                data-testid="ad-banner-cta"
              >
                {fallbackAd!.cta}
              </a>
            </div>
          )}
        </div>

        <Link
          href="/pricing"
          className="shrink-0 text-[10px] font-semibold text-zinc-400 hover:text-zinc-600 whitespace-nowrap underline underline-offset-1 transition-colors"
          data-testid="ad-banner-upgrade"
        >
          Remove ads
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          aria-label="Dismiss ad"
          data-testid="ad-banner-dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
