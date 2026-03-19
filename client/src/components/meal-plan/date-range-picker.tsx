import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatShort, DAY_LABELS, toDateStr } from "../results-pdf";

interface DateRangePickerProps {
  weekStart: string;
  onWeekChange: (dir: -7 | 7) => void;
  planMode: 'daily' | 'weekly';
  selectedDates: string[];
  onToggleDate: (dateStr: string) => void;
  testIdPrefix?: string;
}

export function DateRangePicker({ weekStart, onWeekChange, planMode, selectedDates, onToggleDate, testIdPrefix = "" }: DateRangePickerProps) {
  const pfx = testIdPrefix ? `${testIdPrefix}-` : "";
  const today = toDateStr(new Date());
  return (
    <>
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => onWeekChange(-7)}
          className="p-1 hover:bg-zinc-200 rounded-lg text-zinc-500"
          data-testid={`button-${pfx}week-prev`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-zinc-700 min-w-[120px] text-center" data-testid={`text-${pfx}week-label`}>
          {formatShort(weekStart)} – {formatShort(addDays(weekStart, 6))}
        </span>
        <button
          onClick={() => onWeekChange(7)}
          className="p-1 hover:bg-zinc-200 rounded-lg text-zinc-500"
          data-testid={`button-${pfx}week-next`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {planMode === 'daily' && (
        <div className="flex gap-1.5 flex-wrap mt-2 justify-center">
          {DAY_LABELS.map((label, i) => {
            const dateStr = addDays(weekStart, i);
            const isSelected = selectedDates.includes(dateStr);
            const isPast = dateStr < today;
            return (
              <button
                key={dateStr}
                type="button"
                data-testid={`chip-${pfx}day-${label.toLowerCase()}`}
                onClick={() => !isPast && onToggleDate(dateStr)}
                disabled={isPast}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isPast
                    ? "bg-zinc-100 text-zinc-300 cursor-not-allowed"
                    : isSelected
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-500 hover:bg-zinc-200 border border-zinc-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
