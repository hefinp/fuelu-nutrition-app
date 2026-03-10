import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Flame, Calendar, Info } from "lucide-react";
import type { Calculation } from "@shared/schema";

export function ResultsDisplay({ data }: { data: Calculation }) {
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
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold">{item.value}</span>
                    <span className="text-zinc-400 text-sm">g</span>
                  </div>
                </div>
              ))}
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
    </motion.div>
  );
}
