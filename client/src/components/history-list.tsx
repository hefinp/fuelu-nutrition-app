import { motion } from "framer-motion";
import { format } from "date-fns";
import { useCalculations } from "@/hooks/use-calculations";
import { FileSearch } from "lucide-react";

export function HistoryList({ onSelect }: { onSelect: (id: number) => void }) {
  const { data: history, isLoading } = useCalculations();

  if (isLoading) {
    return (
      <div className="mt-12 space-y-4">
        <div className="h-6 w-32 bg-zinc-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-zinc-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="mt-16 text-center py-12 rounded-3xl border-2 border-dashed border-zinc-200">
        <FileSearch className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
        <h3 className="text-zinc-500 font-medium">No calculation history</h3>
        <p className="text-zinc-400 text-sm mt-1">Your past calculations will appear here.</p>
      </div>
    );
  }

  // Sort by newest first
  const sorted = [...history].sort((a, b) => {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  return (
    <div className="mt-16">
      <h3 className="text-lg font-display font-bold tracking-tight mb-6 text-zinc-900">Recent Calculations</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((item, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={item.id}
            onClick={() => onSelect(item.id)}
            className="group cursor-pointer bg-white p-5 rounded-3xl border border-zinc-100 shadow-lg hover:border-zinc-300"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="bg-zinc-50 px-3 py-1 rounded-lg text-xs font-medium text-zinc-500">
                {item.createdAt ? format(new Date(item.createdAt), 'MMM d, yyyy') : 'Unknown date'}
              </div>
              <span className="text-xs capitalize text-zinc-400">{item.gender}, {item.age}yo</span>
            </div>
            
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold text-zinc-900 tracking-tight">{item.dailyCalories}</span>
              <span className="text-sm font-medium text-zinc-500 mb-1">kcal</span>
            </div>
            
            <div className="flex gap-2 text-xs font-medium text-zinc-500 mt-4 pt-4 border-t border-zinc-50">
              <span className="text-[#159f8c]">P: {item.proteinGoal}g</span>
              <span className="text-[#deb868]">C: {item.carbsGoal}g</span>
              <span className="text-[#db7288]">F: {item.fatGoal}g</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
