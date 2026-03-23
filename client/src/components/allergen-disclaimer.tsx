import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import type { UserPreferences } from "@shared/schema";
import { ALLERGEN_KEYWORDS } from "./allergen-utils";

export const ALLERGEN_DISCLAIMER_TEXT = "Always check ingredient labels. AI-generated meals may not capture all allergens.";

export function AllergenDisclaimer({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-100 ${className}`} data-testid="allergen-disclaimer">
      <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-[10px] leading-relaxed text-amber-700">
        {ALLERGEN_DISCLAIMER_TEXT}
      </p>
    </div>
  );
}

function detectAllergens(ingredients: string[], userAllergies: string[]): string[] {
  if (userAllergies.length === 0 || ingredients.length === 0) return [];
  const detected: string[] = [];
  const ingredientText = ingredients.join(" ").toLowerCase();
  for (const allergy of userAllergies) {
    const keywords = ALLERGEN_KEYWORDS[allergy] ?? [];
    if (keywords.some(kw => ingredientText.includes(kw))) {
      detected.push(allergy);
    }
  }
  return detected;
}

const ALLERGEN_LABEL: Record<string, string> = {
  gluten: "Gluten",
  crustaceans: "Crustaceans",
  eggs: "Eggs",
  fish: "Fish",
  peanuts: "Peanuts",
  soy: "Soy",
  milk: "Dairy",
  nuts: "Nuts",
  celery: "Celery",
  mustard: "Mustard",
  sesame: "Sesame",
  sulphites: "Sulphites",
  lupin: "Lupin",
  molluscs: "Molluscs",
};

export function AllergenTags({ ingredientNames }: { ingredientNames: string[] }) {
  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const userAllergies: string[] = Array.isArray(preferences?.allergies) ? preferences.allergies : [];
  const detected = detectAllergens(ingredientNames, userAllergies);

  if (detected.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1" data-testid="allergen-tags">
      <span className="text-[10px] font-medium text-amber-600">May contain:</span>
      {detected.map(a => (
        <span
          key={a}
          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
          data-testid={`allergen-tag-${a}`}
        >
          {ALLERGEN_LABEL[a] ?? a}
        </span>
      ))}
    </div>
  );
}
