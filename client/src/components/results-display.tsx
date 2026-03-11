import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Flame, Calendar, UtensilsCrossed, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Calculation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const RECIPES: Record<string, string> = {
  "Scrambled eggs (3) with whole grain toast": "Heat butter in a pan, whisk 3 eggs with salt and pepper, cook over medium heat while stirring gently until fluffy. Serve on toasted whole grain bread with a pat of butter.",
  "Oatmeal with berries and almonds": "Cook 50g oats with 200ml water or milk for 3-5 minutes. Top with fresh berries and sliced almonds. Drizzle with honey if desired.",
  "Greek yogurt with granola and honey": "In a bowl, add 200g Greek yogurt, top with granola and a drizzle of honey. Add fresh fruit for extra nutrients.",
  "Pancakes (2) with maple syrup and bacon": "Make 2 pancakes using your favorite batter, cook until golden on both sides. Serve with maple syrup and 2-3 slices of crispy bacon.",
  "Smoothie bowl with fruit and nuts": "Blend frozen berries, yogurt, and milk into a thick smoothie. Pour into a bowl and top with granola, nuts, and fresh fruit.",
  "Chia seed pudding with coconut milk": "Mix 3 tbsp chia seeds with 200ml coconut milk and let sit overnight. Top with fresh fruit before serving.",
  "Grilled chicken breast with brown rice and broccoli": "Season chicken breast and grill for 6-7 minutes per side. Cook 50g brown rice and steam fresh broccoli. Serve together.",
  "Turkey sandwich with avocado and vegetables": "Layer turkey, avocado slices, lettuce, tomato, and cucumber on whole grain bread with mustard or mayo.",
  "Tuna salad with olive oil dressing": "Mix canned tuna with olive oil, lemon juice, salt, and pepper. Serve over mixed greens.",
  "Quinoa bowl with chickpeas and vegetables": "Cook quinoa and mix with chickpeas, cucumber, tomatoes, bell peppers, and a lemon-olive oil dressing.",
  "Salmon with sweet potato and asparagus": "Bake salmon fillet at 200°C for 12-15 minutes. Bake sweet potato and roast asparagus with olive oil.",
  "Beef stir-fry with brown rice and mixed vegetables": "Stir-fry lean beef with bell peppers, broccoli, and snap peas in a wok. Serve over brown rice with low-sodium soy sauce.",
  "Baked chicken with roasted vegetables and pasta": "Bake chicken breast, toss whole wheat pasta with roasted vegetables and olive oil.",
  "Lean beef with mashed potatoes and green beans": "Grill lean beef steak, serve with mashed potatoes made from boiled potatoes and green beans.",
  "Grilled fish with wild rice and vegetables": "Grill white fish fillet, serve with wild rice and steamed vegetables of your choice.",
  "Pork tenderloin with sweet potato and spinach": "Roast pork tenderloin at 190°C, serve with roasted sweet potato and sautéed spinach.",
  "Turkey meatballs with spaghetti and marinara": "Bake turkey meatballs, serve with whole wheat spaghetti and sugar-free marinara sauce.",
  "Chicken fajitas with brown rice and beans": "Grill chicken strips with peppers and onions, serve in tortillas with brown rice and black beans.",
  "Protein bar and apple": "Enjoy a quality protein bar with a fresh apple as a convenient snack.",
  "Greek yogurt with granola": "Mix Greek yogurt with granola for a quick protein-packed snack.",
  "Trail mix and banana": "Combine almonds, cashews, dried fruit, and chocolate chips. Pair with a banana.",
  "Cottage cheese with berries": "Serve cottage cheese topped with fresh blueberries or strawberries.",
  "Peanut butter and whole grain crackers": "Spread peanut butter on whole grain crackers for a satisfying snack.",
  "Hard-boiled eggs and almonds": "Boil eggs and pair with a handful of almonds for a protein-rich snack.",
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
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 capitalize">{mealPlan.planType} Meal Plan</h3>
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
  const recipe = RECIPES[meal.meal] || "Recipe not available for this meal.";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900">{meal.meal}</h3>
            <p className="text-sm text-zinc-500 mt-1">Click outside or press ESC to close</p>
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
          <h4 className="text-sm font-semibold text-zinc-900 mb-2">Recipe Instructions</h4>
          <p className="text-sm text-zinc-600 leading-relaxed">{recipe}</p>
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
