import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, Heart, Pill, Activity, AlertCircle, Utensils,
  StickyNote, Plus, Check, Loader2, Edit2
} from "lucide-react";

interface IntakeFormData {
  id: number;
  medicalHistory: string | null;
  medications: string | null;
  lifestyle: string | null;
  dietaryRestrictions: string | null;
  foodPreferences: string | null;
  notes: string | null;
  completedAt: string | null;
}

const SECTIONS = [
  { key: "medicalHistory" as const, label: "Medical History", icon: Heart, placeholder: "Previous conditions, surgeries, family history..." },
  { key: "medications" as const, label: "Medications & Supplements", icon: Pill, placeholder: "Current medications, vitamins, supplements..." },
  { key: "lifestyle" as const, label: "Lifestyle Habits", icon: Activity, placeholder: "Exercise routine, sleep patterns, stress levels, occupation..." },
  { key: "dietaryRestrictions" as const, label: "Dietary Restrictions", icon: AlertCircle, placeholder: "Allergies, intolerances, religious/ethical restrictions..." },
  { key: "foodPreferences" as const, label: "Food Preferences", icon: Utensils, placeholder: "Preferred cuisines, liked/disliked foods, cooking ability..." },
  { key: "notes" as const, label: "Additional Notes", icon: StickyNote, placeholder: "Any other relevant information..." },
];

type FormFields = {
  medicalHistory: string;
  medications: string;
  lifestyle: string;
  dietaryRestrictions: string;
  foodPreferences: string;
  notes: string;
};

export default function ClientIntakeFormWidget() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormFields>({
    medicalHistory: "",
    medications: "",
    lifestyle: "",
    dietaryRestrictions: "",
    foodPreferences: "",
    notes: "",
  });

  const { data: queryResult, isLoading, error } = useQuery<{ linked: boolean; form: IntakeFormData | null }>({
    queryKey: ["/api/my-intake-form"],
    queryFn: async () => {
      const res = await fetch("/api/my-intake-form", { credentials: "include" });
      if (res.status === 404 || res.status === 401) return { linked: false, form: null };
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const data = await res.json();
      return { linked: true, form: data };
    },
    retry: false,
  });

  const isLinked = queryResult?.linked ?? false;
  const intakeForm = queryResult?.form ?? null;

  const submitMutation = useMutation({
    mutationFn: (data: FormFields) =>
      apiRequest("POST", "/api/my-intake-form", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my-intake-form"] });
      toast({ title: "Intake form submitted successfully" });
      setIsEditing(false);
    },
    onError: (err: Error) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return null;
  if (error) return null;
  if (!isLinked) return null;

  const startEditing = () => {
    if (intakeForm) {
      setFormData({
        medicalHistory: intakeForm.medicalHistory ?? "",
        medications: intakeForm.medications ?? "",
        lifestyle: intakeForm.lifestyle ?? "",
        dietaryRestrictions: intakeForm.dietaryRestrictions ?? "",
        foodPreferences: intakeForm.foodPreferences ?? "",
        notes: intakeForm.notes ?? "",
      });
    }
    setIsEditing(true);
  };

  const handleSubmit = () => submitMutation.mutate(formData);

  if (!intakeForm && !isEditing) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 p-5 mb-4" data-testid="client-intake-banner">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
            <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Complete Your Intake Form</h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
              Your nutritionist needs some information to create your personalised plan. Fill out the intake form to get started.
            </p>
            <button
              type="button"
              onClick={startEditing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
              data-testid="button-client-start-intake"
            >
              <Plus className="w-4 h-4" />
              Fill Intake Form
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-5 mb-4" data-testid="client-intake-form-editing">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {intakeForm ? "Edit Intake Form" : "Your Intake Form"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-sm text-zinc-500 hover:text-zinc-700"
            data-testid="button-client-cancel-intake"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-4">
          {SECTIONS.map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key}>
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1.5">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </label>
              <textarea
                value={formData[key]}
                onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={3}
                className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                data-testid={`textarea-client-intake-${key}`}
              />
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              data-testid="button-client-submit-intake"
            >
              {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {intakeForm ? "Update Form" : "Submit Intake Form"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-sm rounded-xl text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-5 mb-4" data-testid="client-intake-completed">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Your Intake Form</h3>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Completed</span>
        </div>
        <button
          type="button"
          onClick={startEditing}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
          data-testid="button-client-edit-intake"
        >
          <Edit2 className="w-3 h-3" />
          Edit
        </button>
      </div>
      <div className="space-y-3">
        {SECTIONS.map(({ key, label, icon: Icon }) => {
          const value = intakeForm?.[key];
          if (!value) return null;
          return (
            <div key={key}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap pl-5">{value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
