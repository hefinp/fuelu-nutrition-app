import { Salad, ChefHat, Star, Coffee, UtensilsCrossed, Cookie, Lock } from "lucide-react";
import { isSlotPast } from "@/lib/mealTime";

function isSlotLockedForDates(slot: string, dates: string[]): boolean {
  if (dates.length === 0) return false;
  return dates.every(d => isSlotPast(d, slot));
}

interface PlanTypeToggleProps {
  planMode: 'daily' | 'weekly';
  onChangePlanMode: (mode: 'daily' | 'weekly') => void;
  testIdPrefix?: string;
}

export function PlanTypeToggle({ planMode, onChangePlanMode, testIdPrefix = "" }: PlanTypeToggleProps) {
  const pfx = testIdPrefix ? `${testIdPrefix}-` : "";
  return (
    <div className="relative bg-zinc-100 rounded-xl p-0.5 flex items-stretch mb-2" data-testid={`${pfx}plan-type-toggle`}>
      <div
        className="absolute top-0.5 bottom-0.5 rounded-lg bg-white shadow transition-all duration-300 ease-out"
        style={{ width: `calc((100% - 4px) / 2)`, left: planMode === 'daily' ? '2px' : `calc(2px + (100% - 4px) / 2)` }}
      />
      {([
        { key: 'daily' as const, label: 'Daily' },
        { key: 'weekly' as const, label: 'Weekly' },
      ]).map(opt => (
        <button
          key={opt.key}
          type="button"
          data-testid={`toggle-${pfx}plan-type-${opt.key}`}
          onClick={() => onChangePlanMode(opt.key)}
          className={`relative z-10 flex-1 py-1 rounded-lg text-xs font-semibold transition-colors duration-200 ${
            planMode === opt.key ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface MealStyleSelectorProps {
  mealStyle: 'simple' | 'gourmet' | 'michelin';
  onChangeMealStyle: (style: 'simple' | 'gourmet' | 'michelin') => void;
  showDescription?: boolean;
  testIdPrefix?: string;
}

export function MealStyleSelector({ mealStyle, onChangeMealStyle, showDescription = true, testIdPrefix = "" }: MealStyleSelectorProps) {
  const pfx = testIdPrefix ? (testIdPrefix.endsWith('-') ? testIdPrefix : `${testIdPrefix}-`) : "";
  const styles = [
    { key: 'simple' as const,  icon: Salad,   label: 'Simple' },
    { key: 'gourmet' as const, icon: ChefHat, label: 'Fancy' },
    { key: 'michelin' as const, icon: Star,    label: 'Michelin' },
  ];
  const idx = styles.findIndex(s => s.key === mealStyle);
  const descriptions: Record<string, string> = {
    simple:  'Quick, clean meals — ideal for busy weeks.',
    gourmet: 'Bold flavours and restaurant-style dishes.',
    michelin: 'Fine-dining tasting menus — truffle, Wagyu and more.',
  };
  return (
    <>
      <div className="relative bg-zinc-100 rounded-xl p-0.5 flex items-stretch" data-testid={`${pfx}meal-style-scale`}>
        <div
          className="absolute top-0.5 bottom-0.5 rounded-lg bg-white shadow transition-all duration-300 ease-out"
          style={{ width: `calc((100% - 4px) / 3)`, left: `calc(2px + ${idx} * (100% - 4px) / 3)` }}
        />
        {styles.map((style) => (
          <button
            key={style.key}
            type="button"
            data-testid={`toggle-${pfx}meal-style-${style.key}`}
            onClick={() => onChangeMealStyle(style.key)}
            className={`relative z-10 flex-1 flex flex-col items-center gap-0.5 sm:gap-1 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors duration-200 ${
              mealStyle === style.key ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <style.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{style.label}</span>
          </button>
        ))}
      </div>
      {showDescription && (
        <p className="text-[10px] sm:text-xs text-zinc-400 mt-2">{descriptions[mealStyle]}</p>
      )}
    </>
  );
}

interface SlotTogglesProps {
  enabledSlots: Set<string>;
  onToggleSlot: (slot: string) => void;
  planMode: 'daily' | 'weekly';
  selectedDates: string[];
  slotKeys?: readonly { key: string; label: string }[];
  testIdPrefix?: string;
}

export function SlotToggles({ enabledSlots, onToggleSlot, planMode, selectedDates, slotKeys, testIdPrefix = "" }: SlotTogglesProps) {
  const pfx = testIdPrefix ? `toggle-${testIdPrefix}-slot-` : "toggle-slot-";
  const defaultSlotKeys = [
    { key: 'breakfast', label: 'Breakfast', icon: Coffee },
    { key: 'lunch', label: 'Lunch', icon: UtensilsCrossed },
    { key: 'dinner', label: 'Dinner', icon: ChefHat },
    { key: 'snack', label: 'Snacks', icon: Cookie },
  ] as const;
  const slots = slotKeys
    ? slotKeys.map(s => ({
        ...s,
        icon: s.key === 'breakfast' ? Coffee : s.key === 'lunch' ? UtensilsCrossed : s.key === 'dinner' ? ChefHat : Cookie,
      }))
    : defaultSlotKeys;

  const excludedSlots = slots.filter(s => !enabledSlots.has(s.key));

  return (
    <div className="mt-3">
      <div className="flex justify-center gap-2.5 sm:gap-3">
        {slots.map(({ key, label, icon: Icon }) => {
          const active = enabledSlots.has(key);
          const locked = planMode === 'daily' && isSlotLockedForDates(key, selectedDates);
          return (
            <button
              key={key}
              type="button"
              onClick={() => { if (!locked) onToggleSlot(key); }}
              disabled={locked}
              className={`flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-medium transition-all ${
                locked
                  ? 'bg-zinc-100 text-zinc-300 opacity-50 cursor-not-allowed'
                  : active
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
              }`}
              data-testid={`${pfx}${key}`}
            >
              {locked ? <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              {label}
            </button>
          );
        })}
      </div>
      {excludedSlots.length > 0 && (
        <p className="text-[10px] text-zinc-400 mt-1.5 text-center">
          {excludedSlots.map(s => s.key === 'snack' || s.key === 'snacks' ? 'Snacks' : s.key.charAt(0).toUpperCase() + s.key.slice(1)).join(', ')} will be skipped
        </p>
      )}
    </div>
  );
}
