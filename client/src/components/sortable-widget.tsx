import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown, HelpCircle, X } from "lucide-react";
import { type ReactNode, useState } from "react";

interface SortableWidgetProps {
  id: string;
  isEditing: boolean;
  isMobile: boolean;
  isPinned?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDismiss?: () => void;
  children: ReactNode;
}

const WIDGET_HELP: Record<string, { title: string; description: string; tips?: string[] }> = {
  nutrition: {
    title: "Nutrition Targets",
    description: "Displays your personalised daily calorie goal and macro breakdown — protein, carbohydrates, and fat — calculated from your age, weight, height, activity level, and goal.",
    tips: [
      "Targets update automatically whenever you run a new calculation.",
      "Use the calculator at the top of the page to adjust your goal or activity level.",
      "Macros are split using evidence-based ratios for your selected goal (fat loss, maintenance, or muscle gain).",
    ],
  },
  "food-log": {
    title: "Food Log",
    description: "Track everything you eat throughout the day. Log meals manually by searching for foods, scan a barcode with your camera, or take a photo and let AI identify the food for you.",
    tips: [
      "Tap the '+' button to add a food entry for any meal slot.",
      "Barcode scanning uses the Open Food Facts database — it works best on packaged goods.",
      "The AI photo feature can identify whole foods, restaurant dishes, and home-cooked meals.",
      "Your daily totals are shown at the top and update in real time as you log.",
    ],
  },
  "meal-plan": {
    title: "Meal Plan",
    description: "Generates a personalised weekly meal plan using AI, tailored to your calorie target, dietary preferences, allergies, and goal. Each plan includes breakfast, lunch, dinner, and snacks.",
    tips: [
      "Hit 'Generate plan' to create a new week of meals at any time.",
      "You can save favourite plans and reload them later from the saved plans list.",
      "Click any meal to log it directly to your food diary.",
      "Dietary preferences and allergies set in your settings are automatically respected.",
    ],
  },
  "my-meals-food": {
    title: "My Meals & Food",
    description: "Save, organise and log your favourite meals, imported recipes, and individual foods. Build custom meals from your saved foods, import recipes from any website or a photo, and log anything with one tap.",
    tips: [
      "Switch between the Meals and My Foods tabs to see different types of saved items.",
      "Import a recipe by pasting a URL from BBC Good Food, AllRecipes, or most other recipe sites.",
      "Use Create Meal to build a meal from your saved foods — macros are summed automatically.",
      "Star meals from your food diary to save them here instantly.",
    ],
  },
  hydration: {
    title: "Hydration Tracker",
    description: "Log your daily water intake and track progress toward your hydration goal. A general guideline is 2–3 litres per day, though your needs vary based on activity level, climate, and body weight.",
    tips: [
      "Tap a quick-add button (250 ml, 500 ml, 1 L) to log a drink in one tap.",
      "Your intake resets automatically at midnight each day.",
      "Staying well-hydrated supports metabolism, focus, and exercise performance.",
    ],
  },
  cycle: {
    title: "Cycle Tracker",
    description: "Adjusts your nutrition targets and recommendations across the four phases of your menstrual cycle — menstrual, follicular, ovulatory, and luteal. Each phase has different energy and nutrient demands.",
    tips: [
      "Log the start of your period to keep phase predictions accurate.",
      "Calorie and carbohydrate targets increase slightly during the luteal phase to match your body's higher energy use.",
      "You can enable or disable cycle tracking at any time in Settings.",
    ],
  },
  weight: {
    title: "Weight Tracker",
    description: "Log your weight over time and visualise your progress on a chart. Compare your trend against your goal weight and see how your rate of change aligns with your calorie target.",
    tips: [
      "Weigh yourself at a consistent time (e.g. first thing in the morning) for the most reliable trend.",
      "Day-to-day fluctuations of 1–2 kg are normal — focus on the weekly trend, not individual readings.",
      "The chart shows a rolling average to smooth out natural variation.",
    ],
  },
};

export function SortableWidget({
  id,
  isEditing,
  isMobile,
  isPinned,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDismiss,
  children,
}: SortableWidgetProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditing || isMobile || !!isPinned });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 50 : "auto",
  };

  const help = WIDGET_HELP[id];

  return (
    <div ref={setNodeRef} style={style} className={isMobile ? "snap-start scroll-mb-20" : undefined}>
      {isEditing ? (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          {isMobile ? (
            <>
              <button
                onClick={onMoveUp}
                disabled={!canMoveUp}
                data-testid={`button-move-up-${id}`}
                className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
                title="Move up"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={onMoveDown}
                disabled={!canMoveDown}
                data-testid={`button-move-down-${id}`}
                className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
                title="Move down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </>
          ) : isPinned ? (
            <div
              data-testid={`pinned-indicator-${id}`}
              className="p-1.5 rounded-lg bg-zinc-100 text-zinc-300 cursor-not-allowed"
              title="Pinned — cannot be moved"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          ) : (
            <div
              {...attributes}
              {...listeners}
              data-testid={`drag-handle-${id}`}
              className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing transition-colors"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
        </div>
      ) : (help || onDismiss) ? (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5">
          {help && (
            <button
              onClick={() => setHelpOpen(true)}
              data-testid={`button-help-${id}`}
              className="p-1 rounded-full text-zinc-300 hover:text-zinc-500 transition-colors"
              title={`About ${help.title}`}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              data-testid={`button-dismiss-${id}`}
              className="p-1 rounded-full text-zinc-300 hover:text-zinc-500 transition-colors"
              title="Hide widget"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : null}

      <div
        className={
          isEditing
            ? "ring-2 ring-dashed ring-zinc-300 ring-offset-2 rounded-3xl transition-shadow"
            : ""
        }
      >
        {children}
      </div>

      {helpOpen && help && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
          onClick={() => setHelpOpen(false)}
          data-testid={`help-overlay-${id}`}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setHelpOpen(false)}
              className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
              data-testid={`button-help-close-${id}`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-zinc-500" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900">{help.title}</h3>
            </div>

            <p className="text-sm text-zinc-600 leading-relaxed mb-4">{help.description}</p>

            {help.tips && help.tips.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Tips</p>
                <ul className="space-y-1.5">
                  {help.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
