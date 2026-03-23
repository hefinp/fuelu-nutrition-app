import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Flag, X, Loader2 } from "lucide-react";

const REASONS = [
  { value: "inappropriate", label: "Inappropriate" },
  { value: "offensive", label: "Offensive" },
  { value: "spam", label: "Spam" },
  { value: "inaccurate_nutrition", label: "Inaccurate nutrition" },
  { value: "other", label: "Other" },
] as const;

interface ReportContentDialogProps {
  contentType: "community_meal" | "comment";
  contentId: number;
  onClose: () => void;
}

export function ReportContentDialog({ contentType, contentId, onClose }: ReportContentDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/community/report", {
        contentType,
        contentId,
        reason,
        note: note.trim() || undefined,
      }),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: "Report submitted", description: data.message });
      onClose();
    },
    onError: () => toast({ title: "Failed to submit report", variant: "destructive" }),
  });

  return (
    <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 space-y-2.5" data-testid={`report-dialog-${contentType}-${contentId}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5 text-red-500" />
          <span className="text-xs font-semibold text-red-700">Report content</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-red-400 hover:text-red-600 transition-colors"
          data-testid={`button-close-report-${contentType}-${contentId}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-red-600 font-medium">Why are you reporting this?</p>
        <div className="flex flex-wrap gap-1">
          {REASONS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              data-testid={`report-reason-${r.value}`}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors border ${
                reason === r.value
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white text-red-700 border-red-200 hover:border-red-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Additional details (optional)"
        maxLength={500}
        rows={2}
        className="w-full text-xs px-2.5 py-2 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 bg-white resize-none"
        data-testid={`input-report-note-${contentType}-${contentId}`}
      />

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={!reason || mutation.isPending}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
        data-testid={`button-submit-report-${contentType}-${contentId}`}
      >
        {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
        Submit report
      </button>
    </div>
  );
}

export function ReportButton({ contentType, contentId }: { contentType: "community_meal" | "comment"; contentId: number }) {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return <ReportContentDialog contentType={contentType} contentId={contentId} onClose={() => setIsOpen(false)} />;
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-red-500 transition-colors"
      data-testid={`button-report-${contentType}-${contentId}`}
    >
      <Flag className="w-3 h-3" />
      Report
    </button>
  );
}
