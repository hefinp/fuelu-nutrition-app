import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type UserPreferences } from "@shared/schema";
import { Check, Loader2 } from "lucide-react";

type Diet = NonNullable<UserPreferences["diet"]>;
type Allergy = NonNullable<UserPreferences["allergies"]>[number];

const DIET_OPTIONS: { value: Diet; label: string; emoji: string }[] = [
  { value: "vegetarian", label: "Vegetarian", emoji: "🥦" },
  { value: "vegan",      label: "Vegan",       emoji: "🌱" },
  { value: "pescatarian",label: "Pescatarian", emoji: "🐟" },
  { value: "halal",      label: "Halal",       emoji: "☪️" },
  { value: "kosher",     label: "Kosher",      emoji: "✡️" },
];

const ALLERGY_OPTIONS: { value: Allergy; label: string }[] = [
  { value: "gluten",    label: "Gluten" },
  { value: "dairy",     label: "Dairy" },
  { value: "eggs",      label: "Eggs" },
  { value: "nuts",      label: "Tree Nuts" },
  { value: "peanuts",   label: "Peanuts" },
  { value: "shellfish", label: "Shellfish" },
  { value: "fish",      label: "Fish" },
  { value: "soy",       label: "Soy" },
];

export function PreferencesForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const [diet, setDiet] = useState<Diet | null>(null);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    setDiet(data.diet ?? null);
    setAllergies(data.allergies ?? []);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (prefs: UserPreferences) =>
      apiRequest("PUT", "/api/user/preferences", prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Preferences saved", description: "Your meal plans will now reflect these preferences." });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    },
  });

  const toggleAllergy = (a: Allergy) => {
    setAllergies(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  };

  const handleSave = () => {
    mutation.mutate({ diet: diet ?? undefined, allergies });
  };

  const hasChanges =
    (diet ?? null) !== (data?.diet ?? null) ||
    JSON.stringify([...allergies].sort()) !== JSON.stringify([...(data?.allergies ?? [])].sort());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-zinc-100">
      <h3 className="text-sm font-semibold text-zinc-900 mb-1">Food Preferences & Allergies</h3>
      <p className="text-xs text-zinc-500 mb-5">
        Your meal plans will automatically avoid ingredients that don't suit you.
      </p>

      {/* Diet type */}
      <div className="mb-5">
        <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2.5">Diet type</p>
        <div className="flex flex-wrap gap-2">
          {/* None pill */}
          <button
            type="button"
            onClick={() => setDiet(null)}
            data-testid="diet-none"
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              diet === null
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            None
          </button>
          {DIET_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDiet(prev => prev === opt.value ? null : opt.value)}
              data-testid={`diet-${opt.value}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                diet === opt.value
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
              }`}
            >
              <span>{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <div className="mb-6">
        <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2.5">Allergies & intolerances</p>
        <div className="grid grid-cols-2 gap-2">
          {ALLERGY_OPTIONS.map(opt => {
            const active = allergies.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleAllergy(opt.value)}
                data-testid={`allergy-${opt.value}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                  active
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                  active ? "bg-red-500" : "bg-zinc-100"
                }`}>
                  {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </div>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={mutation.isPending || !hasChanges}
        data-testid="button-save-preferences"
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {mutation.isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        ) : (
          "Save Preferences"
        )}
      </button>
    </div>
  );
}
