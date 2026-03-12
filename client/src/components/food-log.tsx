import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ClipboardList } from "lucide-react";

interface FoodLogEntry {
  id: number;
  date: string;
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
}

export interface PrefillEntry {
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodLogProps {
  dailyCaloriesTarget?: number;
  dailyProteinTarget?: number;
  dailyCarbsTarget?: number;
  dailyFatTarget?: number;
  prefill?: PrefillEntry | null;
  onPrefillConsumed?: () => void;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const over = value > max && max > 0;
  return (
    <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${over ? "bg-red-400" : color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function FoodLog({ dailyCaloriesTarget, dailyProteinTarget, dailyCarbsTarget, dailyFatTarget, prefill, onPrefillConsumed }: FoodLogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const date = todayStr();
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ mealName: "", calories: "", protein: "", carbs: "", fat: "" });

  useEffect(() => {
    if (prefill) {
      setForm({
        mealName: prefill.mealName,
        calories: String(prefill.calories),
        protein: String(prefill.protein),
        carbs: String(prefill.carbs),
        fat: String(prefill.fat),
      });
      setShowForm(true);
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);

  const { data: entries = [], isLoading } = useQuery<FoodLogEntry[]>({
    queryKey: ["/api/food-log", date],
    queryFn: async () => {
      const res = await fetch(`/api/food-log?date=${date}`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to load food log");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: (entry: { date: string; mealName: string; calories: number; protein: number; carbs: number; fat: number }) =>
      apiRequest("POST", "/api/food-log", entry).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log", date] });
      setForm({ mealName: "", calories: "", protein: "", carbs: "", fat: "" });
      setShowForm(false);
      toast({ title: "Meal logged" });
    },
    onError: () => toast({ title: "Failed to log meal", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/food-log/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-log", date] });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.mealName.trim()) return;
    addMutation.mutate({
      date,
      mealName: form.mealName.trim(),
      calories: parseInt(form.calories) || 0,
      protein: parseInt(form.protein) || 0,
      carbs: parseInt(form.carbs) || 0,
      fat: parseInt(form.fat) || 0,
    });
  }

  const totalCal = entries.reduce((s, e) => s + e.calories, 0);
  const totalProt = entries.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = entries.reduce((s, e) => s + e.carbs, 0);
  const totalFat = entries.reduce((s, e) => s + e.fat, 0);

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-violet-100 text-violet-600 rounded-lg">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Food Log</h2>
            <p className="text-xs text-zinc-500">Track what you eat today</p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
          data-testid="button-add-log-entry"
        >
          <Plus className="w-4 h-4" />
          Log Meal
        </button>
      </div>

      <div className="flex items-center justify-center mb-5 bg-zinc-50 rounded-xl px-4 py-2">
        <span className="text-sm font-medium text-zinc-700" data-testid="text-log-date">
          Today
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: "Calories", value: totalCal, target: dailyCaloriesTarget, color: "bg-orange-400", unit: "kcal" },
          { label: "Protein", value: totalProt, target: dailyProteinTarget, color: "bg-red-400", unit: "g" },
          { label: "Carbs", value: totalCarbs, target: dailyCarbsTarget, color: "bg-blue-400", unit: "g" },
          { label: "Fat", value: totalFat, target: dailyFatTarget, color: "bg-yellow-400", unit: "g" },
        ].map(({ label, value, target, color, unit }) => (
          <div key={label} className="bg-zinc-50 rounded-xl p-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs text-zinc-500 font-medium">{label}</span>
              <span className="text-xs font-bold text-zinc-900">
                {value}<span className="font-normal text-zinc-400">/{target ?? "–"}{unit}</span>
              </span>
            </div>
            <ProgressBar value={value} max={target ?? 0} color={color} />
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
          <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">Add entry</p>
          <input
            type="text"
            required
            placeholder="Meal name"
            value={form.mealName}
            onChange={e => setForm(f => ({ ...f, mealName: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
            data-testid="input-log-meal-name"
          />
          <div className="grid grid-cols-4 gap-2">
            {(["calories", "protein", "carbs", "fat"] as const).map(field => (
              <div key={field}>
                <label className="text-[10px] text-zinc-500 capitalize">{field === "calories" ? "kcal" : field + " g"}</label>
                <input
                  type="number"
                  min={0}
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 text-center"
                  placeholder="0"
                  data-testid={`input-log-${field}`}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="flex-1 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              data-testid="button-log-save"
            >
              {addMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors"
              data-testid="button-log-cancel"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-6 text-zinc-400">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No entries for today.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="flex items-center gap-2 p-3 bg-zinc-50 rounded-xl border border-transparent hover:border-zinc-200 transition-colors"
              data-testid={`log-entry-${entry.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">{entry.mealName}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {entry.calories} kcal &nbsp;·&nbsp; P: {entry.protein}g &nbsp;·&nbsp; C: {entry.carbs}g &nbsp;·&nbsp; F: {entry.fat}g
                </p>
              </div>
              <button
                onClick={() => deleteMutation.mutate(entry.id)}
                disabled={deleteMutation.isPending}
                className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                data-testid={`button-delete-log-${entry.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
