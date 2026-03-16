import { AlertTriangle, Copy } from "lucide-react";

type DuplicateWarning = {
  message: string;
  exactMatch: boolean;
  existingCount: number;
};

export function DuplicateWarningBanner({
  warning,
  onConfirm,
  onCancel,
  confirmLabel = "Save anyway",
  testPrefix = "duplicate",
}: {
  warning: DuplicateWarning;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  testPrefix?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        warning.exactMatch
          ? "bg-amber-50 border-amber-200"
          : "bg-yellow-50 border-yellow-200"
      }`}
      data-testid={`${testPrefix}-warning`}
    >
      <div className="flex items-start gap-2 mb-2">
        {warning.exactMatch ? (
          <Copy className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
        )}
        <div>
          <p className={`text-xs font-semibold ${warning.exactMatch ? "text-amber-700" : "text-yellow-700"}`}>
            {warning.exactMatch ? "Exact duplicate found" : "Similar item found"}
          </p>
          <p className={`text-xs mt-0.5 ${warning.exactMatch ? "text-amber-600" : "text-yellow-600"}`}>
            {warning.message}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          data-testid={`${testPrefix}-cancel`}
          className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            warning.exactMatch
              ? "border-amber-200 text-amber-600 hover:bg-amber-100"
              : "border-yellow-200 text-yellow-600 hover:bg-yellow-100"
          }`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          data-testid={`${testPrefix}-confirm`}
          className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors ${
            warning.exactMatch
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-yellow-600 hover:bg-yellow-700"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
