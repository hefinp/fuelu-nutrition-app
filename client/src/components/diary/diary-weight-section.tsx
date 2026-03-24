import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Scale, X, Loader2 } from "lucide-react";

interface DiaryWeightSectionProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function DiaryWeightSection({ open, onToggle, onClose }: DiaryWeightSectionProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const popupRef = useRef<HTMLDivElement>(null);
  const [weightInput, setWeightInput] = useState("");

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  const weightMutation = useMutation({
    mutationFn: (data: { weight: string; recordedAt: string }) =>
      apiRequest("POST", "/api/weight-entries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weight-entries"] });
      setWeightInput("");
      onClose();
      toast({ title: "Weight logged" });
    },
    onError: () => toast({ title: "Failed to log weight", variant: "destructive" }),
  });

  const handleWeightSubmit = () => {
    if (!weightInput) return;
    weightMutation.mutate({ weight: weightInput, recordedAt: new Date().toISOString() });
  };

  return (
    <>
      <button
        onClick={onToggle}
        className="flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
        data-testid="button-diary-widget-log-weight"
      >
        <Scale className="w-3.5 h-3.5" />
        Log Weight
      </button>

      {open && (
        <div
          ref={popupRef}
          className="absolute left-0 top-full mt-2 z-50 w-64 bg-white rounded-2xl border border-zinc-200 shadow-xl p-4"
          data-testid="popup-diary-widget-weight"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-zinc-700" />
              <span className="text-sm font-semibold text-zinc-800">Log Weight</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors"
              data-testid="button-close-weight-popup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.1"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleWeightSubmit()}
              placeholder="Weight (kg)"
              className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none transition-colors"
              data-testid="input-weight"
            />
            <button
              onClick={handleWeightSubmit}
              disabled={!weightInput || weightMutation.isPending}
              className="px-3 py-1.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="button-weight-submit"
            >
              {weightMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
