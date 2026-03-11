import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Activity, Ruler, Scale, User } from "lucide-react";
import { motion } from "framer-motion";
import { useCreateCalculation } from "@/hooks/use-calculations";
import { useToast } from "@/hooks/use-toast";
import type { Calculation } from "@shared/schema";

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

export function CalculatorForm({
  onResult,
  defaultValues,
  compact = false,
}: {
  onResult: (result: Calculation) => void;
  defaultValues?: Partial<Calculation>;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const createCalc = useCreateCalculation();
  const [prefilled, setPrefilled] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      weight: "",
      height: "",
      age: 30,
      gender: "male",
      activityLevel: "moderate",
      goal: "maintain",
      targetType: "weekly",
      targetAmount: "",
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

  const onSubmit = (data: FormValues) => {
    createCalc.mutate(data, {
      onSuccess: (result) => {
        toast({
          title: "Calculation Complete",
          description: "Your personalized macro goals are ready.",
        });
        onResult(result);
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: err.message,
          variant: "destructive",
        });
      },
    });
  };

  const fieldClass = "w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200";

  const formContent = (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Weight */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
            <Scale className="w-4 h-4 text-zinc-400" />
            Weight (kg)
          </label>
          <input
            type="number"
            step="0.1"
            {...form.register("weight")}
            className={fieldClass}
            placeholder="e.g. 75"
            data-testid="input-weight"
          />
          {form.formState.errors.weight && (
            <p className="text-destructive text-xs">{form.formState.errors.weight.message}</p>
          )}
        </div>

        {/* Height */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-zinc-400" />
            Height (cm)
          </label>
          <input
            type="number"
            {...form.register("height")}
            className={fieldClass}
            placeholder="e.g. 180"
            data-testid="input-height"
          />
          {form.formState.errors.height && (
            <p className="text-destructive text-xs">{form.formState.errors.height.message}</p>
          )}
        </div>

        {/* Age */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
            <User className="w-4 h-4 text-zinc-400" />
            Age
          </label>
          <input
            type="number"
            {...form.register("age")}
            className={fieldClass}
            placeholder="e.g. 30"
            data-testid="input-age"
          />
          {form.formState.errors.age && (
            <p className="text-destructive text-xs">{form.formState.errors.age.message}</p>
          )}
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">Gender</label>
          <div className="flex gap-4">
            {["male", "female"].map((g) => (
              <label
                key={g}
                className={`flex-1 cursor-pointer text-center px-4 py-3 rounded-xl border transition-all duration-200 ${
                  form.watch("gender") === g
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-md"
                    : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                }`}
              >
                <input type="radio" value={g} {...form.register("gender")} className="hidden" />
                <span className="capitalize">{g}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Level */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
          <Activity className="w-4 h-4 text-zinc-400" />
          Activity Level
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { id: "sedentary", label: "Sedentary" },
            { id: "light", label: "Light" },
            { id: "moderate", label: "Moderate" },
            { id: "active", label: "Active" },
            { id: "very_active", label: "Very Active" },
          ].map((level) => (
            <label
              key={level.id}
              className={`cursor-pointer text-center px-2 py-3 rounded-xl border text-sm transition-all duration-200 ${
                form.watch("activityLevel") === level.id
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-md"
                  : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              <input type="radio" value={level.id} {...form.register("activityLevel")} className="hidden" />
              <span className="capitalize block">{level.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Body Goal */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700">Body Goal</label>
        <div className="grid grid-cols-1 gap-2">
          {[
            { id: "fat_loss", label: "Fat Loss", desc: "Lose body fat, preserve muscle · −500 kcal/day", icon: "🔥" },
            { id: "tone", label: "Tone & Define", desc: "Lean out and improve definition · −250 kcal/day", icon: "⚡" },
            { id: "maintain", label: "Maintain & Balance", desc: "Stay at current weight, optimise health", icon: "⚖️" },
            { id: "muscle", label: "Build Muscle", desc: "Lean muscle gain with minimal fat · +300 kcal/day", icon: "💪" },
            { id: "bulk", label: "Bulk Up", desc: "Maximum muscle growth, faster gains · +600 kcal/day", icon: "🏋️" },
          ].map((g) => (
            <label
              key={g.id}
              className={`cursor-pointer flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-200 ${
                form.watch("goal") === g.id
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-md"
                  : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              <input type="radio" value={g.id} {...form.register("goal")} className="hidden" />
              <span className="text-xl">{g.icon}</span>
              <div className="text-left">
                <span className={`font-semibold text-sm block ${form.watch("goal") === g.id ? "text-white" : "text-zinc-900"}`}>{g.label}</span>
                <span className={`text-xs ${form.watch("goal") === g.id ? "text-zinc-300" : "text-zinc-400"}`}>{g.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Target Type and Amount — hidden for Maintain & Balance */}
      {form.watch("goal") !== "maintain" && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">Target Type</label>
            <div className="flex gap-3 mb-4">
              {["weekly", "monthly"].map((type) => (
                <label
                  key={type}
                  className={`flex-1 cursor-pointer text-center px-4 py-3 rounded-xl border transition-all duration-200 ${
                    form.watch("targetType") === type
                      ? "bg-zinc-900 text-white border-zinc-900 shadow-md"
                      : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  <input type="radio" value={type} {...form.register("targetType")} className="hidden" />
                  <span className="capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">
              Target {form.watch("goal") === "fat_loss" || form.watch("goal") === "tone" ? "Loss" : "Gain"} (kg)
            </label>
            <input
              type="number"
              step="0.1"
              {...form.register("targetAmount")}
              className={fieldClass}
              placeholder="e.g. 2"
              data-testid="input-target-amount"
            />
            {form.formState.errors.targetAmount && (
              <p className="text-destructive text-xs">{form.formState.errors.targetAmount.message}</p>
            )}
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
        ) : (
          "Generate Nutrition Plan"
        )}
      </button>
    </form>
  );

  if (compact) {
    return formContent;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-white p-8 rounded-3xl subtle-shadow border border-zinc-100"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Enter Metrics</h2>
        <p className="text-zinc-500 mt-2 text-sm">
          Provide your accurate body metrics for precise calculation.
        </p>
      </div>
      {formContent}
    </motion.div>
  );
}
