import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Droplets, X, Loader2 } from "lucide-react";

const QUICK_WATER_AMOUNTS = [250, 500, 750, 1000];

interface DiaryWaterSectionProps {
  selectedDate: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function DiaryWaterSection({ selectedDate, open, onToggle, onClose }: DiaryWaterSectionProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const popupRef = useRef<HTMLDivElement>(null);
  const [customWater, setCustomWater] = useState("");

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

  const waterMutation = useMutation({
    mutationFn: (amountMl: number) =>
      apiRequest("POST", "/api/hydration", { date: selectedDate, amountMl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hydration"] });
      setCustomWater("");
      onClose();
      toast({ title: "Water logged" });
    },
    onError: () => toast({ title: "Failed to log water", variant: "destructive" }),
  });

  const handleCustomWaterAdd = () => {
    const val = parseInt(customWater);
    if (!val || val <= 0) return;
    waterMutation.mutate(val);
  };

  return (
    <>
      <button
        onClick={onToggle}
        className="flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
        data-testid="button-diary-widget-log-water"
      >
        <Droplets className="w-3.5 h-3.5" />
        Log Water
      </button>

      {open && (
        <div
          ref={popupRef}
          className="absolute left-0 top-full mt-2 z-50 w-64 bg-white rounded-2xl border border-zinc-200 shadow-xl p-4"
          data-testid="popup-diary-widget-water"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-zinc-800">Log Water</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors"
              data-testid="button-close-water-popup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {QUICK_WATER_AMOUNTS.map(ml => (
              <button
                key={ml}
                onClick={() => waterMutation.mutate(ml)}
                disabled={waterMutation.isPending}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-xl border border-blue-200 hover:border-blue-300 transition-all disabled:opacity-50"
                data-testid={`button-water-quick-${ml}`}
              >
                +{ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={customWater}
              onChange={e => setCustomWater(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCustomWaterAdd()}
              placeholder="Custom (ml)"
              className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-xl focus:border-blue-400 focus:outline-none transition-colors"
              data-testid="input-water-custom"
            />
            <button
              onClick={handleCustomWaterAdd}
              disabled={!customWater || waterMutation.isPending}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="button-water-custom-add"
            >
              {waterMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
