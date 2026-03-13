import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Activity, Ruler, Scale, User, Target, ChevronDown, Flame, Zap, Dumbbell, TrendingUp, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCreateCalculation } from "@/hooks/use-calculations";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import type { Calculation, UserPreferences } from "@shared/schema";

const formSchema = z.object({
  weight: z.string().min(1, "Weight is required"),
  height: z.string().min(1, "Height is required"),
  age: z.coerce.number().min(10).max(120),
  gender: z.enum(["male", "female"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["fat_loss", "tone", "maintain", "muscle", "bulk"]),
  targetType: z.enum(["weekly", "monthly"]),
  targetAmount: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary", light: "Light", moderate: "Moderate",
  active: "Active", very_active: "Very Active",
};
const GOAL_LABELS: Record<string, string> = {
  fat_loss: "Fat Loss", tone: "Tone & Define", maintain: "Maintain",
  muscle: "Build Muscle", bulk: "Bulk Up",
};

function AccordionSection({
  title, icon, summary, defaultOpen = true, children,
}: {
  title: string;
  icon: React.ReactNode;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-50/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-zinc-400">{icon}</span>
          <span className="text-sm font-semibold text-zinc-900">{title}</span>
          {summary && !open && (
            <span className="text-xs text-zinc-400 font-normal ml-1">{summary}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CalculatorForm({
  onResult,
  defaultValues,
  compact = false,
  onPendingChange,
}: {
  onResult: (result: Calculation) => void;
  defaultValues?: Partial<Calculation>;
  compact?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { toast } = useToast();
  const createCalc = useCreateCalculation();
  const [prefilled, setPrefilled] = useState(false);
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const updatePrefsMutation = useMutation({
    mutationFn: (updates: Partial<UserPreferences>) =>
      apiRequest("PUT", "/api/user/preferences", { ...prefs, ...updates }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] }),
  });

  const cycleTrackingEnabled = prefs?.cycleTrackingEnabled ?? false;
  const [cycleReenableDialog, setCycleReenableDialog] = useState(false);

  function handleCycleToggle(enabled: boolean) {
    if (enabled && prefs?.lastPeriodDate) {
      setCycleReenableDialog(true);
    } else {
      updatePrefsMutation.mutate({ cycleTrackingEnabled: enabled });
    }
  }

  function handleCycleContinue() {
    updatePrefsMutation.mutate({ cycleTrackingEnabled: true });
    setCycleReenableDialog(false);
  }

  async function handleCycleStartFresh() {
    await apiRequest("DELETE", "/api/user/cycle-data");
    updatePrefsMutation.mutate({ cycleTrackingEnabled: true });
    queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    setCycleReenableDialog(false);
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      weight: "", height: "", age: 30,
      gender: "male", activityLevel: "moderate",
      goal: "maintain", targetType: "weekly", targetAmount: "",
    },
  });

  useEffect(() => {
    if (!defaultValues || prefilled) return;
    const validGoals = ["fat_loss", "tone", "maintain", "muscle", "bulk"];
    const goal = validGoals.includes(defaultValues.goal ?? "") ? (defaultValues.goal as FormValues["goal"]) : "maintain";
    const validActivity = ["sedentary", "light", "moderate", "active", "very_active"];
    const activityLevel = validActivity.includes(defaultValues.activityLevel ?? "") ? (defaultValues.activityLevel as FormValues["activityLevel"]) : "moderate";
    form.reset({
      weight: defaultValues.weight ? String(defaultValues.weight) : "",
      height: defaultValues.height ? String(defaultValues.height) : "",
      age: defaultValues.age ?? 30,
      gender: (defaultValues.gender as FormValues["gender"]) ?? "male",
      activityLevel,
      goal,
      targetType: (defaultValues.targetType as FormValues["targetType"]) ?? "weekly",
      targetAmount: defaultValues.targetAmount ? String(defaultValues.targetAmount) : "",
    });
    setPrefilled(true);
  }, [defaultValues, prefilled, form]);

  useEffect(() => {
    onPendingChange?.(createCalc.isPending);
  }, [createCalc.isPending, onPendingChange]);

  const onSubmit = (data: FormValues) => {
    createCalc.mutate(data, {
      onSuccess: (result) => {
        toast({ title: "Calculation Complete", description: "Your personalized macro goals are ready." });
        onResult(result);
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const fieldClass = "w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all duration-200";

  const watched = form.watch();

  useEffect(() => {
    if (prefilled && watched.gender !== "female" && cycleTrackingEnabled) {
      updatePrefsMutation.mutate({ cycleTrackingEnabled: false });
    }
  }, [watched.gender, cycleTrackingEnabled, prefilled]);

  if (compact) {
    const metricsSummary = [
      watched.weight && `${watched.weight} kg`,
      watched.height && `${watched.height} cm`,
      watched.age && `${watched.age} yrs`,
    ].filter(Boolean).join(" · ");

    const goalsSummary = [
      watched.goal ? GOAL_LABELS[watched.goal] : "",
      watched.activityLevel ? ACTIVITY_LABELS[watched.activityLevel] : "",
    ].filter(Boolean).join(" · ");

    return (
      <form id="calculator-form" onSubmit={form.handleSubmit(onSubmit)}>
        {/* ── Section 1: Metrics ── */}
        <AccordionSection
          title="Metrics"
          icon={<Scale className="w-4 h-4" />}
          summary={metricsSummary}
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">Weight (kg)</label>
                <input type="number" step="0.1" {...form.register("weight")}
                  className={fieldClass} placeholder="e.g. 75" data-testid="input-weight" />
                {form.formState.errors.weight && (
                  <p className="text-destructive text-xs">{form.formState.errors.weight.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">Height (cm)</label>
                <input type="number" {...form.register("height")}
                  className={fieldClass} placeholder="e.g. 180" data-testid="input-height" />
                {form.formState.errors.height && (
                  <p className="text-destructive text-xs">{form.formState.errors.height.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">Age</label>
                <input type="number" {...form.register("age")}
                  className={fieldClass} placeholder="e.g. 30" data-testid="input-age" />
                {form.formState.errors.age && (
                  <p className="text-destructive text-xs">{form.formState.errors.age.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">Gender</label>
                <div className="flex gap-2">
                  {["male", "female"].map((g) => (
                    <label key={g} className={`flex-1 cursor-pointer text-center px-3 py-3 rounded-xl border text-sm transition-all ${
                      watched.gender === g ? "bg-zinc-900 text-white border-zinc-900" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                    }`}>
                      <input type="radio" value={g} {...form.register("gender")} className="hidden" />
                      <span className="capitalize">{g}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

          {/* Cycle tracking toggle — compact form, shown only when Female selected */}
          <AnimatePresence initial={false}>
            {watched.gender === "female" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 border border-zinc-200">
                    <div className="flex items-start gap-2.5">
                      <Circle className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-zinc-800">Cycle Tracking</p>
                        <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">
                          Optimises meal plans based on your menstrual cycle phase, including iron needs during menstruation and energy adjustments in the luteal phase.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={cycleTrackingEnabled}
                      onCheckedChange={handleCycleToggle}
                      data-testid="toggle-cycle-tracking"
                      className="flex-shrink-0 mt-0.5"
                    />
                  </div>
                  {cycleTrackingEnabled && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-500">Last period</label>
                        <input
                          type="date"
                          max={new Date().toISOString().slice(0, 10)}
                          defaultValue={prefs?.lastPeriodDate ?? ""}
                          key={prefs?.lastPeriodDate}
                          onBlur={e => e.target.value && updatePrefsMutation.mutate({ lastPeriodDate: e.target.value })}
                          data-testid="settings-input-last-period"
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-500">Cycle (days)</label>
                        <input
                          type="number"
                          min={21}
                          max={35}
                          defaultValue={prefs?.cycleLength ?? 28}
                          key={prefs?.cycleLength}
                          onBlur={e => updatePrefsMutation.mutate({ cycleLength: parseInt(e.target.value) || 28 })}
                          data-testid="settings-input-cycle-length"
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-500">Period (days)</label>
                        <input
                          type="number"
                          min={2}
                          max={8}
                          defaultValue={prefs?.periodLength ?? 5}
                          key={prefs?.periodLength}
                          onBlur={e => updatePrefsMutation.mutate({ periodLength: parseInt(e.target.value) || 5 })}
                          data-testid="settings-input-period-length"
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Activity Level</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: "sedentary", label: "Sed." },
                  { id: "light", label: "Light" },
                  { id: "moderate", label: "Mod." },
                  { id: "active", label: "Active" },
                  { id: "very_active", label: "V. Active" },
                ].map((level) => (
                  <label key={level.id} className={`cursor-pointer text-center px-1 py-2.5 rounded-xl border text-xs transition-all ${
                    watched.activityLevel === level.id ? "bg-zinc-900 text-white border-zinc-900" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  }`}>
                    <input type="radio" value={level.id} {...form.register("activityLevel")} className="hidden" />
                    {level.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* ── Section 2: Goals ── */}
        <AccordionSection
          title="Goals"
          icon={<Target className="w-4 h-4" />}
          summary={goalsSummary}
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Body Goal</label>
              <div className="space-y-2">
                {[
                  { id: "fat_loss", label: "Fat Loss", desc: "−500 kcal/day", icon: Flame },
                  { id: "tone", label: "Tone & Define", desc: "−250 kcal/day", icon: Zap },
                  { id: "maintain", label: "Maintain", desc: "Stay at current weight", icon: Scale },
                  { id: "muscle", label: "Build Muscle", desc: "+300 kcal/day", icon: Dumbbell },
                  { id: "bulk", label: "Bulk Up", desc: "+600 kcal/day", icon: TrendingUp },
                ].map((g) => (
                  <label key={g.id} className={`cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                    watched.goal === g.id ? "bg-zinc-900 text-white border-zinc-900" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  }`}>
                    <input type="radio" value={g.id} {...form.register("goal")} className="hidden" />
                    <g.icon className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <span className={`font-semibold block text-xs ${watched.goal === g.id ? "text-white" : "text-zinc-900"}`}>{g.label}</span>
                      <span className={`text-xs ${watched.goal === g.id ? "text-zinc-300" : "text-zinc-400"}`}>{g.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {watched.goal !== "maintain" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700">Target Period</label>
                  <div className="flex gap-2">
                    {["weekly", "monthly"].map((type) => (
                      <label key={type} className={`flex-1 cursor-pointer text-center px-3 py-2.5 rounded-xl border text-sm transition-all ${
                        watched.targetType === type ? "bg-zinc-900 text-white border-zinc-900" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                      }`}>
                        <input type="radio" value={type} {...form.register("targetType")} className="hidden" />
                        <span className="capitalize">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700">
                    Target {watched.goal === "fat_loss" || watched.goal === "tone" ? "Loss" : "Gain"} (kg)
                  </label>
                  <input type="number" step="0.1" {...form.register("targetAmount")}
                    className={fieldClass} placeholder="e.g. 2" data-testid="input-target-amount" />
                </div>
              </>
            )}
          </div>
        </AccordionSection>
      </form>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-display font-bold tracking-tight text-zinc-900">Enter Metrics</h2>
        <p className="text-zinc-500 mt-2 text-sm">Provide your accurate body metrics for precise calculation.</p>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
              <Scale className="w-4 h-4 text-zinc-400" />Weight (kg)
            </label>
            <input type="number" step="0.1" {...form.register("weight")}
              className={fieldClass} placeholder="e.g. 75" data-testid="input-weight" />
            {form.formState.errors.weight && <p className="text-destructive text-xs">{form.formState.errors.weight.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-zinc-400" />Height (cm)
            </label>
            <input type="number" {...form.register("height")}
              className={fieldClass} placeholder="e.g. 180" data-testid="input-height" />
            {form.formState.errors.height && <p className="text-destructive text-xs">{form.formState.errors.height.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
              <User className="w-4 h-4 text-zinc-400" />Age
            </label>
            <input type="number" {...form.register("age")}
              className={fieldClass} placeholder="e.g. 30" data-testid="input-age" />
            {form.formState.errors.age && <p className="text-destructive text-xs">{form.formState.errors.age.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">Gender</label>
            <div className="flex gap-4">
              {["male", "female"].map((g) => (
                <label key={g} className={`flex-1 cursor-pointer text-center px-4 py-3 rounded-xl border transition-all duration-200 ${
                  watched.gender === g ? "bg-zinc-900 text-white border-zinc-900 shadow-md" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                }`}>
                  <input type="radio" value={g} {...form.register("gender")} className="hidden" />
                  <span className="capitalize">{g}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Cycle tracking toggle — full form, shown only when Female selected */}
        <AnimatePresence initial={false}>
          {watched.gender === "female" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="flex items-start gap-3">
                    <Circle className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-800">Cycle Tracking</p>
                      <p className="text-sm text-zinc-500 leading-relaxed mt-0.5">
                        Optimises meal plans based on your menstrual cycle phase, including iron needs during menstruation and energy adjustments in the luteal phase.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={cycleTrackingEnabled}
                    onCheckedChange={handleCycleToggle}
                    data-testid="toggle-cycle-tracking"
                    className="flex-shrink-0 mt-0.5"
                  />
                </div>
                {cycleTrackingEnabled && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-500">Last period</label>
                      <input
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        defaultValue={prefs?.lastPeriodDate ?? ""}
                        key={prefs?.lastPeriodDate}
                        onBlur={e => e.target.value && updatePrefsMutation.mutate({ lastPeriodDate: e.target.value })}
                        data-testid="settings-input-last-period-full"
                        className="w-full px-2.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-500">Cycle (days)</label>
                      <input
                        type="number"
                        min={21}
                        max={35}
                        defaultValue={prefs?.cycleLength ?? 28}
                        key={prefs?.cycleLength}
                        onBlur={e => updatePrefsMutation.mutate({ cycleLength: parseInt(e.target.value) || 28 })}
                        data-testid="settings-input-cycle-length-full"
                        className="w-full px-2.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-500">Period (days)</label>
                      <input
                        type="number"
                        min={2}
                        max={8}
                        defaultValue={prefs?.periodLength ?? 5}
                        key={prefs?.periodLength}
                        onBlur={e => updatePrefsMutation.mutate({ periodLength: parseInt(e.target.value) || 5 })}
                        data-testid="settings-input-period-length-full"
                        className="w-full px-2.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
            <Activity className="w-4 h-4 text-zinc-400" />Activity Level
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: "sedentary", label: "Sedentary" }, { id: "light", label: "Light" },
              { id: "moderate", label: "Moderate" }, { id: "active", label: "Active" },
              { id: "very_active", label: "Very Active" },
            ].map((level) => (
              <label key={level.id} className={`cursor-pointer text-center px-2 py-3 rounded-xl border text-sm transition-all duration-200 ${
                watched.activityLevel === level.id ? "bg-zinc-900 text-white border-zinc-900 shadow-md" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
              }`}>
                <input type="radio" value={level.id} {...form.register("activityLevel")} className="hidden" />
                <span className="capitalize block">{level.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">Body Goal</label>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: "fat_loss", label: "Fat Loss", desc: "Lose body fat, preserve muscle · −500 kcal/day", icon: Flame },
              { id: "tone", label: "Tone & Define", desc: "Lean out and improve definition · −250 kcal/day", icon: Zap },
              { id: "maintain", label: "Maintain & Balance", desc: "Stay at current weight, optimise health", icon: Scale },
              { id: "muscle", label: "Build Muscle", desc: "Lean muscle gain with minimal fat · +300 kcal/day", icon: Dumbbell },
              { id: "bulk", label: "Bulk Up", desc: "Maximum muscle growth, faster gains · +600 kcal/day", icon: TrendingUp },
            ].map((g) => (
              <label key={g.id} className={`cursor-pointer flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-200 ${
                watched.goal === g.id ? "bg-zinc-900 text-white border-zinc-900 shadow-md" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
              }`}>
                <input type="radio" value={g.id} {...form.register("goal")} className="hidden" />
                <g.icon className="w-5 h-5 flex-shrink-0" />
                <div className="text-left">
                  <span className={`font-semibold text-sm block ${watched.goal === g.id ? "text-white" : "text-zinc-900"}`}>{g.label}</span>
                  <span className={`text-xs ${watched.goal === g.id ? "text-zinc-300" : "text-zinc-400"}`}>{g.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
        {watched.goal !== "maintain" && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Target Type</label>
              <div className="flex gap-3 mb-4">
                {["weekly", "monthly"].map((type) => (
                  <label key={type} className={`flex-1 cursor-pointer text-center px-4 py-3 rounded-xl border transition-all duration-200 ${
                    watched.targetType === type ? "bg-zinc-900 text-white border-zinc-900 shadow-md" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  }`}>
                    <input type="radio" value={type} {...form.register("targetType")} className="hidden" />
                    <span className="capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Target {watched.goal === "fat_loss" || watched.goal === "tone" ? "Loss" : "Gain"} (kg)
              </label>
              <input type="number" step="0.1" {...form.register("targetAmount")}
                className={fieldClass} placeholder="e.g. 2" data-testid="input-target-amount" />
            </div>
          </>
        )}
        <button
          type="submit"
          disabled={createCalc.isPending}
          data-testid="button-generate-plan"
          className="w-full mt-6 px-6 py-4 rounded-xl font-semibold bg-zinc-900 text-white shadow-xl shadow-zinc-900/20
                   hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-zinc-900/30 active:translate-y-0
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                   transition-all duration-200 ease-out flex justify-center items-center gap-2"
        >
          {createCalc.isPending ? (
            <span className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
              Calculating...
            </span>
          ) : "Generate Nutrition Plan"}
        </button>
      </form>
    </motion.div>
  );
}
