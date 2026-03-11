import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Flame, Calendar, UtensilsCrossed, Loader2, X, Download } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Calculation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import jsPDF from "jspdf";

const GOAL_LABELS: Record<string, string> = {
  fat_loss: "Fat Loss",
  tone: "Tone & Define",
  maintain: "Maintain & Balance",
  muscle: "Build Muscle",
  bulk: "Bulk Up",
  lose: "Lose Weight",
  gain: "Gain Weight",
};

function exportMealPlanToPDF(mealPlan: any, data: Calculation) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  const newLine = (gap = 6) => { y += gap; };
  const checkPage = (needed = 20) => {
    if (y + needed > 280) { doc.addPage(); y = 20; }
  };

  // Header
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Nutrition Plan", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text(`${mealPlan.planType === "weekly" ? "Weekly" : "Daily"} Meal Plan  ·  Generated ${new Date().toLocaleDateString()}`, 14, 22);
  y = 38;

  // Metrics summary bar
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, y, pageW - 28, 22, 3, 3, "F");
  const goalLabel = GOAL_LABELS[data.goal || "maintain"] || data.goal || "Maintain";
  const summaryItems = [
    `Goal: ${goalLabel}`,
    `Daily: ${data.dailyCalories} kcal`,
    `Weekly: ${data.weeklyCalories} kcal`,
    `Protein: ${data.proteinGoal}g`,
    `Carbs: ${data.carbsGoal}g`,
    `Fat: ${data.fatGoal}g`,
  ];
  const colW = (pageW - 28) / summaryItems.length;
  summaryItems.forEach((item, i) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    const [label, val] = item.split(": ");
    doc.text(label, 18 + i * colW, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 24, 27);
    doc.text(val, 18 + i * colW, y + 16);
  });
  y += 30;

  const renderDay = (dayPlan: any, dayLabel?: string) => {
    checkPage(30);
    if (dayLabel) {
      doc.setFillColor(24, 24, 27);
      doc.roundedRect(14, y, pageW - 28, 10, 2, 2, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(dayLabel.toUpperCase(), 18, y + 7);
      y += 14;
    }

    const mealTypes = ["breakfast", "lunch", "dinner", "snacks"] as const;
    mealTypes.forEach((mealType) => {
      const meals: any[] = dayPlan[mealType] || [];
      if (!meals.length) return;
      checkPage(20);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text(mealType.charAt(0).toUpperCase() + mealType.slice(1), 18, y);
      newLine(5);
      meals.forEach((meal) => {
        checkPage(10);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
        const mealText = doc.splitTextToSize(meal.meal, pageW - 80);
        doc.text(mealText, 22, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(80, 80, 80);
        doc.text(`${meal.calories} kcal  P:${meal.protein}g  C:${meal.carbs}g  F:${meal.fat}g`, pageW - 80, y);
        newLine(mealText.length > 1 ? mealText.length * 5 : 6);
      });
      newLine(2);
    });

    // Day totals
    checkPage(14);
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(14, y, pageW - 28, 10, 2, 2, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(
      `Total  ${dayPlan.dayTotalCalories} kcal  |  Protein ${dayPlan.dayTotalProtein}g  |  Carbs ${dayPlan.dayTotalCarbs}g  |  Fat ${dayPlan.dayTotalFat}g`,
      18, y + 7
    );
    y += 15;
  };

  if (mealPlan.planType === "daily") {
    renderDay(mealPlan);
  } else {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    days.forEach((day) => {
      if (mealPlan[day]) renderDay(mealPlan[day], day);
    });

    // Weekly totals
    checkPage(18);
    doc.setFillColor(24, 24, 27);
    doc.roundedRect(14, y, pageW - 28, 12, 3, 3, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(
      `Week Total: ${mealPlan.weekTotalCalories} kcal  |  P: ${mealPlan.weekTotalProtein}g  |  C: ${mealPlan.weekTotalCarbs}g  |  F: ${mealPlan.weekTotalFat}g`,
      18, y + 8
    );
  }

  doc.save(`meal-plan-${mealPlan.planType}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

interface Recipe {
  instructions: string;
  ingredients: Array<{ item: string; quantity: string }>;
}

const RECIPES: Record<string, Recipe> = {
  "Scrambled eggs (3) with whole grain toast": {
    instructions: "Heat butter in a pan, whisk 3 eggs with salt and pepper, cook over medium heat while stirring gently until fluffy. Serve on toasted whole grain bread with a pat of butter.",
    ingredients: [
      { item: "Eggs", quantity: "3" },
      { item: "Butter", quantity: "1 tbsp" },
      { item: "Whole grain bread", quantity: "2 slices" },
      { item: "Salt & pepper", quantity: "to taste" },
    ],
  },
  "Oatmeal with berries and almonds": {
    instructions: "Cook 50g oats with 200ml water or milk for 3-5 minutes. Top with fresh berries and sliced almonds. Drizzle with honey if desired.",
    ingredients: [
      { item: "Rolled oats", quantity: "50g" },
      { item: "Water or milk", quantity: "200ml" },
      { item: "Fresh berries", quantity: "100g" },
      { item: "Almonds", quantity: "30g" },
      { item: "Honey", quantity: "1 tbsp (optional)" },
    ],
  },
  "Greek yogurt with granola and honey": {
    instructions: "In a bowl, add 200g Greek yogurt, top with granola and a drizzle of honey. Add fresh fruit for extra nutrients.",
    ingredients: [
      { item: "Greek yogurt", quantity: "200g" },
      { item: "Granola", quantity: "50g" },
      { item: "Honey", quantity: "1 tbsp" },
      { item: "Fresh fruit", quantity: "100g" },
    ],
  },
  "Pancakes (2) with maple syrup and bacon": {
    instructions: "Make 2 pancakes using your favorite batter, cook until golden on both sides. Serve with maple syrup and 2-3 slices of crispy bacon.",
    ingredients: [
      { item: "Pancake batter", quantity: "1/2 cup" },
      { item: "Bacon", quantity: "3 slices" },
      { item: "Maple syrup", quantity: "2 tbsp" },
      { item: "Butter", quantity: "1 tbsp" },
    ],
  },
  "Smoothie bowl with fruit and nuts": {
    instructions: "Blend frozen berries, yogurt, and milk into a thick smoothie. Pour into a bowl and top with granola, nuts, and fresh fruit.",
    ingredients: [
      { item: "Frozen berries", quantity: "150g" },
      { item: "Greek yogurt", quantity: "150g" },
      { item: "Milk", quantity: "100ml" },
      { item: "Granola", quantity: "40g" },
      { item: "Mixed nuts", quantity: "30g" },
    ],
  },
  "Chia seed pudding with coconut milk": {
    instructions: "Mix 3 tbsp chia seeds with 200ml coconut milk and let sit overnight. Top with fresh fruit before serving.",
    ingredients: [
      { item: "Chia seeds", quantity: "3 tbsp" },
      { item: "Coconut milk", quantity: "200ml" },
      { item: "Fresh fruit", quantity: "100g" },
      { item: "Honey", quantity: "1 tbsp (optional)" },
    ],
  },
  "Grilled chicken breast with brown rice and broccoli": {
    instructions: "Season chicken breast and grill for 6-7 minutes per side. Cook 50g brown rice and steam fresh broccoli. Serve together.",
    ingredients: [
      { item: "Chicken breast", quantity: "200g" },
      { item: "Brown rice", quantity: "50g (dry)" },
      { item: "Broccoli", quantity: "150g" },
      { item: "Olive oil", quantity: "1 tbsp" },
      { item: "Salt & pepper", quantity: "to taste" },
    ],
  },
  "Turkey sandwich with avocado and vegetables": {
    instructions: "Layer turkey, avocado slices, lettuce, tomato, and cucumber on whole grain bread with mustard or mayo.",
    ingredients: [
      { item: "Turkey slices", quantity: "100g" },
      { item: "Whole grain bread", quantity: "2 slices" },
      { item: "Avocado", quantity: "1/2" },
      { item: "Lettuce", quantity: "2 leaves" },
      { item: "Tomato", quantity: "1 slice" },
      { item: "Cucumber", quantity: "1/4" },
      { item: "Mustard or mayo", quantity: "1 tbsp" },
    ],
  },
  "Tuna salad with olive oil dressing": {
    instructions: "Mix canned tuna with olive oil, lemon juice, salt, and pepper. Serve over mixed greens.",
    ingredients: [
      { item: "Canned tuna", quantity: "150g" },
      { item: "Mixed greens", quantity: "150g" },
      { item: "Olive oil", quantity: "2 tbsp" },
      { item: "Lemon juice", quantity: "1 tbsp" },
      { item: "Salt & pepper", quantity: "to taste" },
    ],
  },
  "Quinoa bowl with chickpeas and vegetables": {
    instructions: "Cook quinoa and mix with chickpeas, cucumber, tomatoes, bell peppers, and a lemon-olive oil dressing.",
    ingredients: [
      { item: "Quinoa", quantity: "50g (dry)" },
      { item: "Chickpeas", quantity: "100g" },
      { item: "Cucumber", quantity: "1/2" },
      { item: "Tomato", quantity: "1" },
      { item: "Bell pepper", quantity: "1/2" },
      { item: "Olive oil", quantity: "2 tbsp" },
      { item: "Lemon juice", quantity: "1 tbsp" },
    ],
  },
  "Salmon with sweet potato and asparagus": {
    instructions: "Bake salmon fillet at 200°C for 12-15 minutes. Bake sweet potato and roast asparagus with olive oil.",
    ingredients: [
      { item: "Salmon fillet", quantity: "180g" },
      { item: "Sweet potato", quantity: "200g" },
      { item: "Asparagus", quantity: "150g" },
      { item: "Olive oil", quantity: "1.5 tbsp" },
      { item: "Salt & pepper", quantity: "to taste" },
    ],
  },
  "Beef stir-fry with brown rice and mixed vegetables": {
    instructions: "Stir-fry lean beef with bell peppers, broccoli, and snap peas in a wok. Serve over brown rice with low-sodium soy sauce.",
    ingredients: [
      { item: "Lean beef", quantity: "180g" },
      { item: "Brown rice", quantity: "50g (dry)" },
      { item: "Bell peppers", quantity: "100g" },
      { item: "Broccoli", quantity: "100g" },
      { item: "Snap peas", quantity: "100g" },
      { item: "Soy sauce", quantity: "1 tbsp" },
      { item: "Sesame oil", quantity: "1 tbsp" },
    ],
  },
  "Baked chicken with roasted vegetables and pasta": {
    instructions: "Bake chicken breast, toss whole wheat pasta with roasted vegetables and olive oil.",
    ingredients: [
      { item: "Chicken breast", quantity: "180g" },
      { item: "Whole wheat pasta", quantity: "75g (dry)" },
      { item: "Mixed vegetables", quantity: "200g" },
      { item: "Olive oil", quantity: "2 tbsp" },
      { item: "Garlic", quantity: "2 cloves" },
    ],
  },
  "Lean beef with mashed potatoes and green beans": {
    instructions: "Grill lean beef steak, serve with mashed potatoes made from boiled potatoes and green beans.",
    ingredients: [
      { item: "Lean beef steak", quantity: "200g" },
      { item: "Potatoes", quantity: "250g" },
      { item: "Butter", quantity: "1 tbsp" },
      { item: "Green beans", quantity: "150g" },
      { item: "Salt & pepper", quantity: "to taste" },
    ],
  },
  "Grilled fish with wild rice and vegetables": {
    instructions: "Grill white fish fillet, serve with wild rice and steamed vegetables of your choice.",
    ingredients: [
      { item: "White fish fillet", quantity: "200g" },
      { item: "Wild rice", quantity: "50g (dry)" },
      { item: "Mixed vegetables", quantity: "200g" },
      { item: "Olive oil", quantity: "1 tbsp" },
      { item: "Lemon", quantity: "1/2" },
    ],
  },
  "Pork tenderloin with sweet potato and spinach": {
    instructions: "Roast pork tenderloin at 190°C, serve with roasted sweet potato and sautéed spinach.",
    ingredients: [
      { item: "Pork tenderloin", quantity: "200g" },
      { item: "Sweet potato", quantity: "200g" },
      { item: "Fresh spinach", quantity: "150g" },
      { item: "Olive oil", quantity: "2 tbsp" },
      { item: "Garlic", quantity: "2 cloves" },
    ],
  },
  "Turkey meatballs with spaghetti and marinara": {
    instructions: "Bake turkey meatballs, serve with whole wheat spaghetti and sugar-free marinara sauce.",
    ingredients: [
      { item: "Ground turkey", quantity: "200g" },
      { item: "Whole wheat spaghetti", quantity: "75g (dry)" },
      { item: "Marinara sauce", quantity: "200ml" },
      { item: "Breadcrumbs", quantity: "2 tbsp" },
      { item: "Egg", quantity: "1" },
    ],
  },
  "Chicken fajitas with brown rice and beans": {
    instructions: "Grill chicken strips with peppers and onions, serve in tortillas with brown rice and black beans.",
    ingredients: [
      { item: "Chicken breast", quantity: "200g" },
      { item: "Whole wheat tortillas", quantity: "2" },
      { item: "Bell peppers", quantity: "150g" },
      { item: "Onion", quantity: "1/2" },
      { item: "Black beans", quantity: "100g" },
      { item: "Brown rice", quantity: "50g (dry)" },
    ],
  },
  "Protein bar and apple": {
    instructions: "Enjoy a quality protein bar with a fresh apple as a convenient snack.",
    ingredients: [
      { item: "Protein bar", quantity: "1" },
      { item: "Apple", quantity: "1 medium" },
    ],
  },
  "Greek yogurt with granola": {
    instructions: "Mix Greek yogurt with granola for a quick protein-packed snack.",
    ingredients: [
      { item: "Greek yogurt", quantity: "150g" },
      { item: "Granola", quantity: "50g" },
    ],
  },
  "Trail mix and banana": {
    instructions: "Combine almonds, cashews, dried fruit, and chocolate chips. Pair with a banana.",
    ingredients: [
      { item: "Almonds", quantity: "20g" },
      { item: "Cashews", quantity: "20g" },
      { item: "Dried fruit", quantity: "20g" },
      { item: "Dark chocolate chips", quantity: "10g" },
      { item: "Banana", quantity: "1 medium" },
    ],
  },
  "Cottage cheese with berries": {
    instructions: "Serve cottage cheese topped with fresh blueberries or strawberries.",
    ingredients: [
      { item: "Cottage cheese", quantity: "150g" },
      { item: "Fresh berries", quantity: "100g" },
    ],
  },
  "Peanut butter and whole grain crackers": {
    instructions: "Spread peanut butter on whole grain crackers for a satisfying snack.",
    ingredients: [
      { item: "Peanut butter", quantity: "2 tbsp" },
      { item: "Whole grain crackers", quantity: "8-10" },
    ],
  },
  "Hard-boiled eggs and almonds": {
    instructions: "Boil eggs and pair with a handful of almonds for a protein-rich snack.",
    ingredients: [
      { item: "Hard-boiled eggs", quantity: "2" },
      { item: "Almonds", quantity: "30g" },
    ],
  },
};

interface Meal {
  meal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface DayMealPlan {
  breakfast: Meal[];
  lunch: Meal[];
  dinner: Meal[];
  snacks: Meal[];
  dayTotalCalories: number;
  dayTotalProtein: number;
  dayTotalCarbs: number;
  dayTotalFat: number;
}

type MealPlan = any;

export function ResultsDisplay({ data }: { data: Calculation }) {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<{ meal: string; calories: number; protein: number; carbs: number; fat: number } | null>(null);
  
  const generateMealPlan = useMutation({
    mutationFn: async (planType: 'daily' | 'weekly') => {
      const res = await apiRequest('POST', '/api/meal-plans', {
        dailyCalories: data.dailyCalories,
        weeklyCalories: data.weeklyCalories,
        proteinGoal: data.proteinGoal,
        carbsGoal: data.carbsGoal,
        fatGoal: data.fatGoal,
        planType,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setMealPlan(data);
    },
  });
  const chartData = [
    { name: "Protein", value: data.proteinGoal, color: "hsl(var(--chart-1))" },
    { name: "Carbs", value: data.carbsGoal, color: "hsl(var(--chart-2))" },
    { name: "Fat", value: data.fatGoal, color: "hsl(var(--chart-3))" },
  ];

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2, ease: "easeOut" }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Calories Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div variants={itemVariants} className="bg-white p-6 rounded-3xl subtle-shadow border border-zinc-100 flex items-start gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Daily Calories</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-4xl font-bold tracking-tighter text-zinc-900">{data.dailyCalories}</span>
              <span className="text-zinc-400 font-medium">kcal</span>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white p-6 rounded-3xl subtle-shadow border border-zinc-100 flex items-start gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Weekly Target</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-4xl font-bold tracking-tighter text-zinc-900">{data.weeklyCalories}</span>
              <span className="text-zinc-400 font-medium">kcal</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Macros Breakdown */}
      <motion.div variants={itemVariants} className="bg-zinc-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        {/* Abstract background flair */}
        <div className="absolute top-[-50%] right-[-10%] w-96 h-96 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center relative z-10">
          <div>
            <h3 className="text-2xl font-bold mb-2">Macro Distribution</h3>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              Based on your metrics, here is the optimal daily macronutrient split to achieve your body goals effectively.
            </p>

            <div className="space-y-4">
              {chartData.map((item) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 ml-6 text-sm">
                    <div className="bg-white/10 p-2 rounded">
                      <p className="text-zinc-400 text-xs">Daily</p>
                      <p className="text-lg font-bold">{item.value}g</p>
                    </div>
                    <div className="bg-white/10 p-2 rounded">
                      <p className="text-zinc-400 text-xs">Weekly</p>
                      <p className="text-lg font-bold">{item.value * 7}g</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => generateMealPlan.mutate('daily')}
                disabled={generateMealPlan.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors"
                data-testid="button-generate-daily"
              >
                {generateMealPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UtensilsCrossed className="w-4 h-4" />}
                Daily Meal Plan
              </button>
              <button
                onClick={() => generateMealPlan.mutate('weekly')}
                disabled={generateMealPlan.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors"
                data-testid="button-generate-weekly"
              >
                {generateMealPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UtensilsCrossed className="w-4 h-4" />}
                Weekly Plan
              </button>
            </div>
          </div>

          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-sm font-semibold text-zinc-400 tracking-widest uppercase">MACROS</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Meal Plan Display */}
      {mealPlan && (
        <motion.div variants={itemVariants} className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 capitalize">{mealPlan.planType} Meal Plan</h3>
            </div>
            <button
              onClick={() => exportMealPlanToPDF(mealPlan, data)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-medium text-sm transition-colors border border-zinc-200"
              data-testid="button-export-pdf"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>

          {mealPlan.planType === 'daily' ? (
            <DailyMealView plan={mealPlan} />
          ) : (
            <WeeklyMealView plan={mealPlan} />
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function DailyMealView({ plan }: { plan: any }) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-orange-50 p-4 rounded-xl">
          <p className="text-xs text-orange-600 font-medium mb-1">Calories</p>
          <p className="text-2xl font-bold text-orange-700">{plan.dayTotalCalories}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl">
          <p className="text-xs text-red-600 font-medium mb-1">Protein</p>
          <p className="text-2xl font-bold text-red-700">{plan.dayTotalProtein}g</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl">
          <p className="text-xs text-blue-600 font-medium mb-1">Carbs</p>
          <p className="text-2xl font-bold text-blue-700">{plan.dayTotalCarbs}g</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-xl">
          <p className="text-xs text-yellow-600 font-medium mb-1">Fat</p>
          <p className="text-2xl font-bold text-yellow-700">{plan.dayTotalFat}g</p>
        </div>
      </div>

      {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map(mealType => (
        <div key={mealType} className="mb-6">
          <h4 className="text-lg font-semibold text-zinc-900 capitalize mb-3">{mealType}</h4>
          <div className="space-y-2">
            {plan[mealType]?.map((meal: Meal, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelectedMeal(meal)}
                className="w-full flex justify-between p-3 bg-zinc-50 rounded-lg hover:bg-blue-50 transition-colors text-left cursor-pointer border border-transparent hover:border-blue-200"
              >
                <div className="flex-1">
                  <p className="font-medium text-zinc-900 text-sm">{meal.meal}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g</p>
                </div>
                <div className="text-right ml-4">
                  <p className="font-bold text-zinc-900 text-sm">{meal.calories}</p>
                  <p className="text-xs text-zinc-500">kcal</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {selectedMeal && (
        <RecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </>
  );
}

function WeeklyMealView({ plan }: { plan: any }) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-orange-50 p-4 rounded-xl">
          <p className="text-xs text-orange-600 font-medium mb-1">Week Total</p>
          <p className="text-2xl font-bold text-orange-700">{plan.weekTotalCalories}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl">
          <p className="text-xs text-red-600 font-medium mb-1">Protein</p>
          <p className="text-2xl font-bold text-red-700">{plan.weekTotalProtein}g</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl">
          <p className="text-xs text-blue-600 font-medium mb-1">Carbs</p>
          <p className="text-2xl font-bold text-blue-700">{plan.weekTotalCarbs}g</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-xl">
          <p className="text-xs text-yellow-600 font-medium mb-1">Fat</p>
          <p className="text-2xl font-bold text-yellow-700">{plan.weekTotalFat}g</p>
        </div>
      </div>

      {days.map(day => {
        const dayPlan = plan[day];
        if (!dayPlan) return null;
        
        return (
          <div key={day} className="mb-8 p-5 bg-zinc-50 rounded-2xl">
            <h4 className="text-lg font-bold text-zinc-900 capitalize mb-4">{day}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs text-zinc-500 font-medium mb-1">Calories</p>
                <p className="font-bold text-zinc-900">{dayPlan.dayTotalCalories}</p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs text-zinc-500 font-medium mb-1">Protein</p>
                <p className="font-bold text-zinc-900">{dayPlan.dayTotalProtein}g</p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs text-zinc-500 font-medium mb-1">Carbs</p>
                <p className="font-bold text-zinc-900">{dayPlan.dayTotalCarbs}g</p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs text-zinc-500 font-medium mb-1">Fat</p>
                <p className="font-bold text-zinc-900">{dayPlan.dayTotalFat}g</p>
              </div>
            </div>

            {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map(mealType => (
              <div key={mealType} className="mb-3">
                <h5 className="text-sm font-semibold text-zinc-700 capitalize mb-2">{mealType}</h5>
                <div className="space-y-1">
                  {dayPlan[mealType]?.map((meal: Meal, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedMeal(meal)}
                      className="w-full flex justify-between p-2 bg-white rounded hover:bg-blue-50 transition-colors text-left cursor-pointer border border-transparent hover:border-blue-200"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-zinc-900 text-sm">{meal.meal}</p>
                        <p className="text-xs text-zinc-500">P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-zinc-900 text-sm">{meal.calories}</p>
                        <p className="text-xs text-zinc-500">kcal</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {selectedMeal && (
        <RecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </>
  );
}

function RecipeModal({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const recipe = RECIPES[meal.meal];

  if (!recipe) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-zinc-600">Recipe not available for this meal.</p>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900">{meal.meal}</h3>
            <p className="text-sm text-zinc-500 mt-1">Click outside to close</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-xs text-orange-600 font-medium">Calories</p>
            <p className="text-lg font-bold text-orange-700">{meal.calories}</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-xs text-red-600 font-medium">Protein</p>
            <p className="text-lg font-bold text-red-700">{meal.protein}g</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-600 font-medium">Carbs</p>
            <p className="text-lg font-bold text-blue-700">{meal.carbs}g</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-xs text-yellow-600 font-medium">Fat</p>
            <p className="text-lg font-bold text-yellow-700">{meal.fat}g</p>
          </div>
        </div>

        <div className="bg-zinc-50 p-4 rounded-xl mb-4">
          <h4 className="text-sm font-semibold text-zinc-900 mb-3">Ingredients</h4>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, idx) => (
              <li key={idx} className="flex justify-between text-sm text-zinc-700">
                <span>{ing.item}</span>
                <span className="font-medium text-zinc-900">{ing.quantity}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-zinc-50 p-4 rounded-xl mb-4">
          <h4 className="text-sm font-semibold text-zinc-900 mb-2">Instructions</h4>
          <p className="text-sm text-zinc-600 leading-relaxed">{recipe.instructions}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}
