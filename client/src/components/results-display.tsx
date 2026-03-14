import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { UtensilsCrossed, Loader2, X, Download, ShoppingCart, RefreshCw, Save, Check, ThumbsDown, ClipboardList, ChevronDown, ChevronLeft, ChevronRight, Salad, ChefHat, Star, Pill, Circle, CalendarDays, AlertTriangle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserPreferences } from "@shared/schema";
import { getCyclePhase } from "@/lib/cycle";
import type { Calculation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateStr(dt);
}

function getMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  dt.setDate(dt.getDate() - ((dow + 6) % 7));
  return toDateStr(dt);
}

function formatShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function drawPDFLogo(doc: jsPDF, pageW: number) {
  // White rounded square — inverted for dark header background
  const sqX = pageW - 56;
  const sqY = 10;
  const sqSize = 8;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(sqX, sqY, sqSize, sqSize, 1.5, 1.5, "F");

  // Dark circle inside (matches dashboard logo in inverted form)
  doc.setFillColor(24, 24, 27); // zinc-900
  doc.circle(sqX + sqSize / 2, sqY + sqSize / 2, 1.8, "F");

  // "Fuelr" wordmark
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Fuelr", sqX + sqSize + 2.5, sqY + 6);
}

export function exportMealPlanToPDF(mealPlan: any, data: Calculation) {
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
  const pdfDateLabel = (() => {
    if (mealPlan.planType === "weekly" && (mealPlan as any).weekStartDate) {
      const ws = (mealPlan as any).weekStartDate as string;
      return `${formatShort(ws)} – ${formatShort(addDays(ws, 6))}`;
    }
    if ((mealPlan as any).targetDate) {
      return formatShort((mealPlan as any).targetDate as string);
    }
    if ((mealPlan as any).targetDates?.length) {
      const dates = (mealPlan as any).targetDates as string[];
      return dates.length === 1 ? formatShort(dates[0]) : `${formatShort(dates[0])} + ${dates.length - 1} more days`;
    }
    return `Generated ${new Date().toLocaleDateString()}`;
  })();
  doc.text(`${mealPlan.planType === "weekly" ? "Weekly" : "Daily"} Meal Plan  ·  ${pdfDateLabel}`, 14, 22);
  drawPDFLogo(doc, pageW);
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
    y += 12;
  }

  // ── Recipes section ──────────────────────────────────────────────────────────
  // Collect all unique meal names from the plan (preserving order of first appearance)
  const uniqueMealNames: string[] = [];
  const slots = ["breakfast", "lunch", "dinner", "snacks"] as const;
  const collectMeals = (dayPlan: any) => {
    slots.forEach(slot => {
      (dayPlan[slot] || []).forEach((m: any) => {
        if (!uniqueMealNames.includes(m.meal)) uniqueMealNames.push(m.meal);
      });
    });
  };
  if (mealPlan.planType === "daily") {
    collectMeals(mealPlan);
  } else {
    ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].forEach(day => {
      if (mealPlan[day]) collectMeals(mealPlan[day]);
    });
  }

  // Only include meals that have a recipe entry
  const recipeMeals = uniqueMealNames.filter(name => (RECIPES as any)[name]);

  if (recipeMeals.length > 0) {
    // Section divider — start on a new page for clarity
    doc.addPage();
    y = 20;

    // Section header bar
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Recipes", 14, 12.5);
    y = 26;

    recipeMeals.forEach((mealName, idx) => {
      const recipe = (RECIPES as any)[mealName] as { ingredients: Array<{ item: string; quantity: string }>; instructions: string };

      // Estimate height needed: meal title (10) + ingredients (~5 per line / 2 cols) + instructions (~5 per line) + padding
      const ingRowCount = Math.ceil(recipe.ingredients.length / 2);
      const instrLines = doc.splitTextToSize(recipe.instructions, pageW - 28).length;
      const estimatedH = 12 + ingRowCount * 6 + instrLines * 5 + 16;
      checkPage(Math.min(estimatedH, 60));

      // Subtle separator between recipes (skip before first)
      if (idx > 0) {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(14, y, pageW - 14, y);
        y += 6;
      }

      // Meal name
      checkPage(14);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 24, 27);
      const nameLines = doc.splitTextToSize(mealName, pageW - 28);
      doc.text(nameLines, 14, y);
      y += nameLines.length * 6 + 3;

      // Macro line
      checkPage(8);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130, 130, 130);
      const planMeal = uniqueMealNames.includes(mealName)
        ? (() => {
            for (const slot of slots) {
              const found = (mealPlan[slot] || []).find((m: any) => m.meal === mealName);
              if (found) return found;
              if (mealPlan.planType === "weekly") {
                for (const day of ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]) {
                  const df = (mealPlan[day]?.[slot] || []).find((m: any) => m.meal === mealName);
                  if (df) return df;
                }
              }
            }
            return null;
          })()
        : null;
      if (planMeal) {
        doc.text(`${planMeal.calories} kcal  ·  Protein ${planMeal.protein}g  ·  Carbs ${planMeal.carbs}g  ·  Fat ${planMeal.fat}g`, 14, y);
        y += 6;
      }

      // Ingredients header
      checkPage(10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("Ingredients", 14, y);
      y += 5;

      // Ingredients two-column
      const ingColW = (pageW - 28) / 2;
      let leftY = y;
      let rightY = y;
      recipe.ingredients.forEach((ing, i) => {
        const col = i % 2;
        const xBase = col === 0 ? 14 : 14 + ingColW + 4;
        const curY = col === 0 ? leftY : rightY;
        checkPage(7);

        // Bullet dot
        doc.setFillColor(160, 160, 160);
        doc.circle(xBase + 1.2, curY - 1.2, 0.8, "F");

        // Item name
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 40);
        const itemLines = doc.splitTextToSize(ing.item, ingColW - 36);
        doc.text(itemLines, xBase + 4, curY);

        // Quantity right-aligned
        doc.setFont("helvetica", "bold");
        doc.setTextColor(80, 80, 80);
        doc.text(ing.quantity, xBase + ingColW - 2, curY, { align: "right" });

        const rowH = itemLines.length > 1 ? itemLines.length * 4.5 : 5.5;
        if (col === 0) leftY += rowH;
        else rightY += rowH;
      });
      y = Math.max(leftY, rightY) + 4;

      // Instructions header
      checkPage(10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("Method", 14, y);
      y += 5;

      // Instructions text
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      const instrTextLines = doc.splitTextToSize(recipe.instructions, pageW - 28);
      instrTextLines.forEach((line: string) => {
        checkPage(6);
        doc.text(line, 14, y);
        y += 4.8;
      });

      y += 6;
    });
  }

  checkPage(20);
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, y, pageW - 14, y);
  y += 8;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(140, 140, 140);
  const disclaimerLines = doc.splitTextToSize(
    "Disclaimer: All calorie targets, macronutrient breakdowns, and meal plans are estimates based on the Mifflin-St Jeor equation. They should not be treated as medical advice. Consult a qualified healthcare professional before making significant dietary changes.",
    pageW - 28
  );
  disclaimerLines.forEach((line: string) => {
    checkPage(5);
    doc.text(line, 14, y);
    y += 4;
  });

  doc.save(`meal-plan-${mealPlan.planType}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Shopping list helpers ────────────────────────────────────────────────────

function categoriseIngredient(item: string): string {
  const l = item.toLowerCase();
  if (/chicken|beef|salmon|tuna|turkey|pork|lamb|fish|prawn|duck|sea bass|cod|egg|mince/.test(l)) return "Protein";
  if (/milk|yogurt|cheese|cream|butter|ricotta|feta|mozzarella|cottage/.test(l)) return "Dairy";
  if (/rice|pasta|oats|bread|noodle|flour|lentil|bean|chickpea|couscous|quinoa|bulgur|cracker|pita|tortilla|crispbread|muffin|bagel|sourdough|flatbread/.test(l)) return "Grains & Carbs";
  if (/pepper|onion|garlic|spinach|broccoli|tomato|cucumber|avocado|mushroom|courgette|asparagus|potato|bok choy|lettuce|leaf|coriander|parsley|mint|basil|dill|herb|lemon|lime|apple|banana|mango|berr|cherry|pomegranate|melon|fruit|ginger|kale|rocket/.test(l)) return "Produce";
  if (/oil|sauce|vinegar|soy|miso|honey|sugar|salt|pepper|spice|cumin|paprika|cinnamon|turmeric|oregano|thyme|rosemary|chilli|sriracha|harissa|tahini|hummus|pesto|stock|wine|mayo|mustard|curry|ras el hanout|flax|seed|coconut|almond/.test(l)) return "Pantry & Spices";
  return "Other";
}

function tryParseQty(q: string): { num: number; unit: string } | null {
  const m = q.match(/^(\d+)(?:\/(\d+))?\s*(.*)$/);
  if (!m) return null;
  const num = m[2] ? parseInt(m[1]) / parseInt(m[2]) : parseFloat(m[1]);
  return { num, unit: m[3].trim().toLowerCase() };
}

function combineQuantities(existing: string, incoming: string): string {
  const a = tryParseQty(existing);
  const b = tryParseQty(incoming);
  if (a && b && a.unit === b.unit) {
    const total = Math.round((a.num + b.num) * 10) / 10;
    return `${total}${a.unit ? ' ' + a.unit : ''}`.trim();
  }
  return existing; // keep first if units differ or non-numeric
}

function scaleQuantity(quantity: string, multiplier: number): string {
  if (multiplier === 1) return quantity;
  const parsed = tryParseQty(quantity);
  if (!parsed) return quantity;
  const scaled = Math.round(parsed.num * multiplier * 10) / 10;
  return `${scaled}${parsed.unit ? ' ' + parsed.unit : ''}`.trim();
}

export function buildShoppingList(mealPlan: any, multiplier = 1): Record<string, Array<{ item: string; quantity: string }>> {
  const mealNames: string[] = [];
  const slots = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;

  if (mealPlan.planType === 'weekly') {
    const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    days.forEach(day => {
      if (!mealPlan[day]) return;
      slots.forEach(slot => (mealPlan[day][slot] || []).forEach((m: any) => mealNames.push(m.meal)));
    });
  } else {
    slots.forEach(slot => (mealPlan[slot] || []).forEach((m: any) => mealNames.push(m.meal)));
  }

  // ingredient key → { category, item display, combined quantity }
  const map = new Map<string, { category: string; item: string; quantity: string }>();

  mealNames.forEach(mealName => {
    const recipe = (RECIPES as Record<string, { ingredients: Array<{ item: string; quantity: string }> }>)[mealName];
    if (!recipe) return;
    recipe.ingredients.forEach(({ item, quantity }) => {
      const key = item.toLowerCase().replace(/[^a-z]/g, '');
      if (map.has(key)) {
        const entry = map.get(key)!;
        entry.quantity = combineQuantities(entry.quantity, quantity);
      } else {
        map.set(key, { category: categoriseIngredient(item), item, quantity });
      }
    });
  });

  // Scale all quantities by multiplier
  if (multiplier !== 1) {
    map.forEach(entry => {
      entry.quantity = scaleQuantity(entry.quantity, multiplier);
    });
  }

  // Group by category
  const grouped: Record<string, Array<{ item: string; quantity: string }>> = {};
  map.forEach(({ category, item, quantity }) => {
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push({ item, quantity });
  });
  // Sort each group alphabetically
  Object.values(grouped).forEach(arr => arr.sort((a, b) => a.item.localeCompare(b.item)));
  return grouped;
}

export const CATEGORY_ORDER = ["Protein", "Produce", "Grains & Carbs", "Dairy", "Pantry & Spices", "Other"];

export function exportShoppingListToPDF(mealPlan: any, data: Calculation, days = 1) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  const newLine = (gap = 6) => { y += gap; };
  const checkPage = (needed = 14) => { if (y + needed > 280) { doc.addPage(); y = 20; } };

  // Header
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
  doc.text("Shopping List", 14, 12);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 180, 180);
  const planLabel = mealPlan.planType === "weekly" ? "Weekly" : `Daily · ${days} day${days !== 1 ? 's' : ''}`;
  doc.text(`${planLabel} Meal Plan  ·  Generated ${new Date().toLocaleDateString()}`, 14, 22);
  drawPDFLogo(doc, pageW);
  y = 38;

  // Sub-header note
  doc.setFontSize(9); doc.setFont("helvetica", "italic"); doc.setTextColor(120, 120, 120);
  const noteText = mealPlan.planType === "daily" && days > 1
    ? `Quantities scaled for ${days} days. Add staples you already have at home.`
    : "Quantities are combined across all meals. Add staples you already have at home.";
  doc.text(noteText, 14, y);
  y += 12;

  const grouped = buildShoppingList(mealPlan, mealPlan.planType === "daily" ? days : 1);
  const categoryOrder = CATEGORY_ORDER.filter(c => grouped[c]);
  // Append any categories not in our order list
  Object.keys(grouped).forEach(c => { if (!categoryOrder.includes(c)) categoryOrder.push(c); });

  const colW = (pageW - 28) / 2;
  const categories = categoryOrder;

  categories.forEach(category => {
    const items = grouped[category];
    if (!items?.length) return;
    checkPage(20);

    // Category header
    doc.setFillColor(24, 24, 27);
    doc.roundedRect(14, y, pageW - 28, 9, 2, 2, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(category.toUpperCase(), 18, y + 6.2);
    y += 13;

    // Two-column layout for items
    let leftY = y;
    let rightY = y;
    items.forEach((entry, i) => {
      const col = i % 2;
      const xBase = col === 0 ? 14 : 14 + colW + 4;
      const curY  = col === 0 ? leftY : rightY;
      checkPage(10);

      // Checkbox
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.roundedRect(xBase, curY - 3.5, 4, 4, 0.8, 0.8);

      // Item name
      doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30);
      const label = doc.splitTextToSize(entry.item, colW - 32);
      doc.text(label, xBase + 6, curY);

      // Quantity — right-aligned within column
      doc.setFont("helvetica", "bold"); doc.setTextColor(80, 80, 80);
      doc.text(entry.quantity, xBase + colW - 4, curY, { align: "right" });

      if (col === 0) leftY  += (label.length > 1 ? label.length * 5 : 7);
      else           rightY += (label.length > 1 ? label.length * 5 : 7);
    });

    y = Math.max(leftY, rightY) + 4;
  });

  const daysSuffix = mealPlan.planType === "daily" && days > 1 ? `-${days}days` : "";
  doc.save(`shopping-list-${mealPlan.planType}${daysSuffix}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export interface Recipe {
  instructions: string;
  ingredients: Array<{ item: string; quantity: string }>;
}

export const RECIPES: Record<string, Recipe> = {
  // ── Breakfasts ──────────────────────────────────────────────────────────────
  "Scrambled eggs (3) with whole grain toast": {
    instructions: "Whisk 3 eggs with a pinch of salt. Melt butter in a non-stick pan on medium heat, pour in eggs and stir slowly until just set. Serve on toasted whole grain bread.",
    ingredients: [
      { item: "Eggs", quantity: "3" },
      { item: "Butter", quantity: "1 tsp" },
      { item: "Whole grain bread", quantity: "2 slices" },
      { item: "Salt & pepper", quantity: "to taste" },
    ],
  },
  "Oatmeal with berries and almonds": {
    instructions: "Bring 200ml water or milk to a simmer. Stir in oats and cook 3-5 minutes until creamy. Top with fresh berries, sliced almonds, and a drizzle of honey.",
    ingredients: [
      { item: "Rolled oats", quantity: "60g" },
      { item: "Milk or water", quantity: "200ml" },
      { item: "Fresh berries", quantity: "100g" },
      { item: "Almonds, sliced", quantity: "25g" },
      { item: "Honey", quantity: "1 tsp (optional)" },
    ],
  },
  "Greek yogurt with granola and honey": {
    instructions: "Spoon Greek yogurt into a bowl. Top with granola and drizzle with honey. Add fresh fruit if desired.",
    ingredients: [
      { item: "Greek yogurt (full-fat)", quantity: "200g" },
      { item: "Granola", quantity: "45g" },
      { item: "Honey", quantity: "1 tbsp" },
      { item: "Fresh fruit", quantity: "80g (optional)" },
    ],
  },
  "Egg white omelette with spinach and feta": {
    instructions: "Whisk egg whites with a pinch of salt. Pour into a non-stick pan on medium heat. When the edges set, add spinach and feta to one half, fold and cook 1 more minute.",
    ingredients: [
      { item: "Egg whites", quantity: "5 (or 150ml carton)" },
      { item: "Baby spinach", quantity: "60g" },
      { item: "Feta cheese", quantity: "30g" },
      { item: "Olive oil spray", quantity: "1 spray" },
      { item: "Salt & pepper", quantity: "to taste" },
    ],
  },
  "Protein smoothie with oats and almond butter": {
    instructions: "Add all ingredients to a blender. Blend until smooth. Add more milk for a thinner consistency.",
    ingredients: [
      { item: "Protein powder (vanilla)", quantity: "1 scoop (30g)" },
      { item: "Rolled oats", quantity: "40g" },
      { item: "Almond butter", quantity: "1 tbsp" },
      { item: "Banana", quantity: "1/2" },
      { item: "Milk or almond milk", quantity: "250ml" },
    ],
  },
  "Cottage cheese with berries and flaxseed": {
    instructions: "Spoon cottage cheese into a bowl. Top with fresh berries and sprinkle with ground flaxseed.",
    ingredients: [
      { item: "Low-fat cottage cheese", quantity: "200g" },
      { item: "Mixed berries", quantity: "120g" },
      { item: "Ground flaxseed", quantity: "1 tbsp" },
      { item: "Honey", quantity: "1 tsp (optional)" },
    ],
  },
  "Smoked salmon with eggs and rye toast": {
    instructions: "Poach or scramble eggs. Serve on toasted rye bread with smoked salmon and a squeeze of lemon.",
    ingredients: [
      { item: "Smoked salmon", quantity: "80g" },
      { item: "Eggs", quantity: "2" },
      { item: "Rye bread", quantity: "2 slices" },
      { item: "Lemon", quantity: "1/4" },
      { item: "Capers (optional)", quantity: "1 tsp" },
    ],
  },
  "Chia seed pudding with coconut milk and nuts": {
    instructions: "Mix chia seeds with coconut milk. Refrigerate overnight or for at least 2 hours. Top with mixed nuts and fresh fruit before serving.",
    ingredients: [
      { item: "Chia seeds", quantity: "40g" },
      { item: "Coconut milk", quantity: "200ml" },
      { item: "Mixed nuts", quantity: "25g" },
      { item: "Fresh fruit", quantity: "80g" },
    ],
  },
  // ── Lunches ─────────────────────────────────────────────────────────────────
  "Grilled chicken breast with brown rice and broccoli": {
    instructions: "Season chicken with olive oil, garlic, salt and pepper. Grill 6-7 min each side. Cook rice per packet. Steam broccoli 4-5 min.",
    ingredients: [
      { item: "Chicken breast", quantity: "180g" },
      { item: "Brown rice", quantity: "60g (dry)" },
      { item: "Broccoli florets", quantity: "150g" },
      { item: "Olive oil", quantity: "1 tbsp" },
      { item: "Garlic clove", quantity: "1" },
    ],
  },
  "Turkey and avocado salad with olive oil dressing": {
    instructions: "Slice turkey and avocado. Arrange over mixed leaves with cucumber and tomato. Whisk olive oil, lemon juice, salt and pepper and drizzle over.",
    ingredients: [
      { item: "Turkey breast slices", quantity: "120g" },
      { item: "Avocado", quantity: "1/2" },
      { item: "Mixed salad leaves", quantity: "80g" },
      { item: "Cherry tomatoes", quantity: "80g" },
      { item: "Olive oil", quantity: "2 tbsp" },
      { item: "Lemon juice", quantity: "1 tbsp" },
    ],
  },
  "Tuna salad with olive oil dressing": {
    instructions: "Drain tuna and flake into a bowl. Add cucumber, red onion, and cherry tomatoes. Dress with olive oil and lemon juice.",
    ingredients: [
      { item: "Canned tuna in water", quantity: "160g (drained)" },
      { item: "Mixed salad leaves", quantity: "80g" },
      { item: "Cucumber", quantity: "1/4" },
      { item: "Red onion", quantity: "1/4 small" },
      { item: "Olive oil", quantity: "2 tbsp" },
      { item: "Lemon juice", quantity: "1 tbsp" },
    ],
  },
  "Quinoa bowl with chickpeas and vegetables": {
    instructions: "Cook quinoa per packet. Drain and rinse chickpeas. Combine with roasted peppers, cucumber, and parsley. Dress with lemon and olive oil.",
    ingredients: [
      { item: "Quinoa", quantity: "60g (dry)" },
      { item: "Chickpeas", quantity: "120g (cooked)" },
      { item: "Bell pepper", quantity: "1/2" },
      { item: "Cucumber", quantity: "1/2" },
      { item: "Olive oil", quantity: "1.5 tbsp" },
      { item: "Lemon juice", quantity: "1 tbsp" },
    ],
  },
  "Salmon with sweet potato and asparagus": {
    instructions: "Bake salmon at 200°C for 12-15 min. Cube sweet potato and roast with olive oil at 200°C for 25 min. Roast asparagus last 10 min alongside.",
    ingredients: [
      { item: "Salmon fillet", quantity: "160g" },
      { item: "Sweet potato", quantity: "180g" },
      { item: "Asparagus", quantity: "120g" },
      { item: "Olive oil", quantity: "1.5 tbsp" },
      { item: "Lemon", quantity: "1/2" },
    ],
  },
  "Beef and brown rice bowl with mixed vegetables": {
    instructions: "Season lean beef strips with soy sauce and garlic. Stir-fry 3-4 min. Cook brown rice. Steam or stir-fry mixed vegetables. Combine in a bowl.",
    ingredients: [
      { item: "Lean beef strips", quantity: "160g" },
      { item: "Brown rice", quantity: "60g (dry)" },
      { item: "Mixed stir-fry vegetables", quantity: "150g" },
      { item: "Soy sauce", quantity: "1 tbsp" },
      { item: "Garlic clove", quantity: "1" },
      { item: "Sesame oil", quantity: "1 tsp" },
    ],
  },
  "Chicken Caesar salad with whole grain croutons": {
    instructions: "Grill chicken breast and slice. Toss romaine lettuce with Caesar dressing and parmesan. Add chicken and whole grain croutons on top.",
    ingredients: [
      { item: "Chicken breast", quantity: "160g" },
      { item: "Romaine lettuce", quantity: "120g" },
      { item: "Parmesan, grated", quantity: "20g" },
      { item: "Whole grain bread, cubed", quantity: "1 slice" },
      { item: "Caesar dressing", quantity: "2 tbsp" },
      { item: "Olive oil", quantity: "1 tsp" },
    ],
  },
  "Lean turkey mince bowl with quinoa and greens": {
    instructions: "Brown turkey mince with garlic and cumin. Cook quinoa. Wilt spinach in the pan. Serve mince over quinoa and greens.",
    ingredients: [
      { item: "Lean turkey mince", quantity: "160g" },
      { item: "Quinoa", quantity: "60g (dry)" },
      { item: "Baby spinach", quantity: "80g" },
      { item: "Garlic clove", quantity: "1" },
      { item: "Ground cumin", quantity: "1 tsp" },
      { item: "Olive oil", quantity: "1 tbsp" },
    ],
  },
  // ── Dinners ─────────────────────────────────────────────────────────────────
  "Baked chicken with roasted vegetables and sweet potato": {
    instructions: "Season chicken with herbs, olive oil, salt and pepper. Bake at 200°C for 25-30 min. Cube sweet potato and vegetables, roast alongside last 25 min.",
    ingredients: [
      { item: "Chicken breast", quantity: "200g" },
      { item: "Sweet potato", quantity: "200g" },
      { item: "Mixed vegetables (courgette, pepper, onion)", quantity: "200g" },
      { item: "Olive oil", quantity: "1.5 tbsp" },
      { item: "Mixed dried herbs", quantity: "1 tsp" },
    ],
  },
  "Lean beef with mashed potatoes and green beans": {
    instructions: "Grill or pan-fry lean beef steak to your liking. Boil potatoes, mash with a little butter and milk. Steam green beans 4-5 min.",
    ingredients: [
      { item: "Lean beef steak", quantity: "180g" },
      { item: "Potatoes", quantity: "240g" },
      { item: "Butter", quantity: "1 tsp" },
      { item: "Milk", quantity: "2 tbsp" },
      { item: "Green beans", quantity: "150g" },
    ],
  },
  "Grilled salmon with wild rice and vegetables": {
    instructions: "Season salmon and grill 4-5 min each side. Cook wild rice per packet. Steam or stir-fry vegetables with a little olive oil.",
    ingredients: [
      { item: "Salmon fillet", quantity: "180g" },
      { item: "Wild rice", quantity: "60g (dry)" },
      { item: "Mixed vegetables", quantity: "180g" },
      { item: "Olive oil", quantity: "1 tbsp" },
      { item: "Lemon", quantity: "1/2" },
    ],
  },
  "Pork tenderloin with sweet potato and spinach": {
    instructions: "Rub pork with garlic, rosemary, olive oil. Roast at 190°C for 20-25 min. Roast sweet potato alongside. Sauté spinach with garlic in olive oil.",
    ingredients: [
      { item: "Pork tenderloin", quantity: "180g" },
      { item: "Sweet potato", quantity: "200g" },
      { item: "Baby spinach", quantity: "120g" },
      { item: "Garlic cloves", quantity: "2" },
      { item: "Olive oil", quantity: "1.5 tbsp" },
      { item: "Dried rosemary", quantity: "1 tsp" },
    ],
  },
  "Turkey meatballs with wholemeal spaghetti and marinara": {
    instructions: "Mix turkey mince with egg, breadcrumbs, garlic, and herbs. Shape into balls and bake at 190°C for 18-20 min. Serve over cooked wholemeal spaghetti with marinara sauce.",
    ingredients: [
      { item: "Lean turkey mince", quantity: "180g" },
      { item: "Wholemeal spaghetti", quantity: "70g (dry)" },
      { item: "Passata or marinara", quantity: "150ml" },
      { item: "Egg", quantity: "1" },
      { item: "Breadcrumbs", quantity: "2 tbsp" },
      { item: "Garlic clove", quantity: "1" },
    ],
  },
  "Chicken fajitas with brown rice and black beans": {
    instructions: "Slice chicken and season with cumin, paprika, garlic. Stir-fry with sliced peppers and onion. Serve over brown rice with drained black beans.",
    ingredients: [
      { item: "Chicken breast", quantity: "180g" },
      { item: "Brown rice", quantity: "60g (dry)" },
      { item: "Black beans", quantity: "100g (cooked)" },
      { item: "Bell peppers", quantity: "150g" },
      { item: "Onion", quantity: "1/2" },
      { item: "Ground cumin & paprika", quantity: "1 tsp each" },
    ],
  },
  "Grilled white fish with quinoa and roasted vegetables": {
    instructions: "Season fish with lemon, olive oil, salt. Grill 3-4 min each side. Cook quinoa per packet. Roast vegetables at 200°C for 20 min.",
    ingredients: [
      { item: "White fish fillet (cod/haddock)", quantity: "200g" },
      { item: "Quinoa", quantity: "60g (dry)" },
      { item: "Courgette", quantity: "1 small" },
      { item: "Cherry tomatoes", quantity: "100g" },
      { item: "Olive oil", quantity: "1.5 tbsp" },
      { item: "Lemon", quantity: "1/2" },
    ],
  },
  "Lean lamb stir-fry with brown rice and bok choy": {
    instructions: "Slice lean lamb and marinate in soy, ginger, and garlic for 10 min. Stir-fry 3-4 min. Add bok choy and cook 2 more min. Serve over brown rice.",
    ingredients: [
      { item: "Lean lamb leg strips", quantity: "180g" },
      { item: "Brown rice", quantity: "60g (dry)" },
      { item: "Bok choy", quantity: "2 heads" },
      { item: "Soy sauce", quantity: "1.5 tbsp" },
      { item: "Fresh ginger", quantity: "1 tsp (grated)" },
      { item: "Garlic clove", quantity: "1" },
    ],
  },
  // ── Snacks ──────────────────────────────────────────────────────────────────
  "Protein bar and apple": {
    instructions: "Enjoy a quality protein bar alongside a fresh apple for a balanced snack.",
    ingredients: [
      { item: "Protein bar (20g+ protein)", quantity: "1" },
      { item: "Apple", quantity: "1 medium" },
    ],
  },
  "Greek yogurt with granola": {
    instructions: "Spoon Greek yogurt into a bowl or container. Top with granola and eat immediately.",
    ingredients: [
      { item: "Greek yogurt", quantity: "150g" },
      { item: "Granola", quantity: "40g" },
    ],
  },
  "Trail mix and banana": {
    instructions: "Combine nuts and dried fruit in a small bag for a portable snack. Eat alongside a banana.",
    ingredients: [
      { item: "Almonds", quantity: "15g" },
      { item: "Cashews", quantity: "15g" },
      { item: "Dried cranberries", quantity: "15g" },
      { item: "Banana", quantity: "1 medium" },
    ],
  },
  "Cottage cheese with berries": {
    instructions: "Spoon cottage cheese into a bowl and top with fresh mixed berries.",
    ingredients: [
      { item: "Low-fat cottage cheese", quantity: "150g" },
      { item: "Mixed berries", quantity: "100g" },
    ],
  },
  "Peanut butter and whole grain crackers": {
    instructions: "Spread peanut butter evenly on whole grain crackers for a filling snack.",
    ingredients: [
      { item: "Peanut butter (natural)", quantity: "2 tbsp" },
      { item: "Whole grain crackers", quantity: "8 crackers" },
    ],
  },
  "Hard-boiled eggs and almonds": {
    instructions: "Boil eggs 8-10 min, peel and slice. Serve alongside a small handful of almonds.",
    ingredients: [
      { item: "Eggs", quantity: "2" },
      { item: "Almonds", quantity: "25g" },
      { item: "Salt (optional)", quantity: "pinch" },
    ],
  },
  "Tuna on rice cakes": {
    instructions: "Drain tuna and mix with a little lemon juice. Spoon onto rice cakes.",
    ingredients: [
      { item: "Canned tuna in water", quantity: "100g (drained)" },
      { item: "Rice cakes", quantity: "3" },
      { item: "Lemon juice", quantity: "1 tsp" },
      { item: "Black pepper", quantity: "to taste" },
    ],
  },
  "Edamame with sea salt": {
    instructions: "Boil or microwave edamame per packet instructions. Drain and toss with sea salt.",
    ingredients: [
      { item: "Edamame (shelled or in pods)", quantity: "150g" },
      { item: "Sea salt", quantity: "1/4 tsp" },
    ],
  },

  // ── Gourmet Breakfasts ───────────────────────────────────────────────────────
  "Shakshuka with poached eggs and crusty sourdough": {
    instructions: "Sauté onion, garlic and peppers until soft. Add cumin, paprika and tinned tomatoes; simmer 10 min. Make wells in the sauce and crack in eggs. Cover and cook 5-7 min until whites are set. Finish with fresh herbs. Serve with sourdough.",
    ingredients: [
      { item: "Eggs", quantity: "2" },
      { item: "Tinned chopped tomatoes", quantity: "400g tin" },
      { item: "Red pepper", quantity: "1" },
      { item: "Onion", quantity: "1/2" },
      { item: "Garlic cloves", quantity: "2" },
      { item: "Ground cumin & paprika", quantity: "1 tsp each" },
      { item: "Sourdough bread", quantity: "2 slices" },
      { item: "Fresh coriander or parsley", quantity: "handful" },
    ],
  },
  "Avocado toast with poached eggs and everything bagel seasoning": {
    instructions: "Toast bread. Mash avocado with lemon juice, salt and pepper. Spread on toast. Poach eggs in simmering water with a splash of vinegar for 3-4 min. Place on top and sprinkle with everything bagel seasoning.",
    ingredients: [
      { item: "Eggs", quantity: "2" },
      { item: "Sourdough or seeded bread", quantity: "2 slices" },
      { item: "Ripe avocado", quantity: "1" },
      { item: "Lemon juice", quantity: "1 tsp" },
      { item: "Everything bagel seasoning", quantity: "1 tsp" },
      { item: "Chilli flakes (optional)", quantity: "pinch" },
    ],
  },
  "Smoked salmon bagel with cream cheese, capers and dill": {
    instructions: "Split and toast the bagel. Spread generously with cream cheese. Layer on smoked salmon, capers, thinly sliced red onion and fresh dill. Finish with a squeeze of lemon.",
    ingredients: [
      { item: "Smoked salmon", quantity: "80g" },
      { item: "Whole grain bagel", quantity: "1" },
      { item: "Cream cheese", quantity: "2 tbsp" },
      { item: "Capers", quantity: "1 tbsp" },
      { item: "Red onion, thinly sliced", quantity: "a few rings" },
      { item: "Fresh dill", quantity: "small handful" },
      { item: "Lemon", quantity: "1/4" },
    ],
  },
  "Bircher muesli with apple, toasted hazelnuts and pomegranate": {
    instructions: "Combine oats, grated apple and yogurt with a little honey. Refrigerate overnight. Top with toasted hazelnuts, pomegranate seeds and a drizzle of honey before serving.",
    ingredients: [
      { item: "Rolled oats", quantity: "60g" },
      { item: "Greek yogurt", quantity: "100g" },
      { item: "Apple, grated", quantity: "1/2" },
      { item: "Hazelnuts, toasted and chopped", quantity: "25g" },
      { item: "Pomegranate seeds", quantity: "2 tbsp" },
      { item: "Honey", quantity: "1 tsp" },
      { item: "Milk or apple juice", quantity: "60ml" },
    ],
  },
  "Savory crepes with goat cheese, spinach and sun-dried tomatoes": {
    instructions: "Make thin crepes from flour, egg and milk. Wilt spinach in a pan with garlic. Fill each crepe with crumbled goat cheese, wilted spinach and sun-dried tomatoes. Fold and heat through in the pan.",
    ingredients: [
      { item: "Plain flour", quantity: "60g" },
      { item: "Egg", quantity: "1" },
      { item: "Milk", quantity: "150ml" },
      { item: "Baby spinach", quantity: "80g" },
      { item: "Goat cheese", quantity: "50g" },
      { item: "Sun-dried tomatoes", quantity: "4" },
      { item: "Garlic clove", quantity: "1" },
    ],
  },
  "Eggs Benedict with Canadian bacon and light hollandaise": {
    instructions: "Toast English muffins. Pan-fry Canadian bacon 2 min each side. Poach eggs 3-4 min. Make a quick hollandaise by whisking egg yolk with lemon juice over low heat, then slowly drizzle in melted butter. Assemble and top with hollandaise.",
    ingredients: [
      { item: "Eggs", quantity: "2" },
      { item: "English muffins", quantity: "1 (split)" },
      { item: "Canadian bacon", quantity: "2 slices" },
      { item: "Butter", quantity: "30g (for hollandaise)" },
      { item: "Egg yolk", quantity: "1 (for hollandaise)" },
      { item: "Lemon juice", quantity: "1 tsp" },
    ],
  },
  "Coconut overnight oats with mango, lime and toasted coconut": {
    instructions: "Mix oats with coconut milk, chia seeds and maple syrup. Refrigerate overnight. In the morning, top with diced fresh mango, lime zest and toasted coconut flakes.",
    ingredients: [
      { item: "Rolled oats", quantity: "60g" },
      { item: "Coconut milk", quantity: "150ml" },
      { item: "Chia seeds", quantity: "1 tbsp" },
      { item: "Ripe mango, diced", quantity: "1/2" },
      { item: "Toasted coconut flakes", quantity: "2 tbsp" },
      { item: "Lime zest", quantity: "1/2 lime" },
      { item: "Maple syrup", quantity: "1 tsp" },
    ],
  },
  "Huevos rancheros with black beans and pico de gallo": {
    instructions: "Warm tortillas in a dry pan. Fry eggs sunny-side-up. Heat black beans with cumin and garlic. Make pico de gallo by combining diced tomato, onion, jalapeño and coriander. Assemble tortillas with beans, egg and pico de gallo.",
    ingredients: [
      { item: "Eggs", quantity: "2" },
      { item: "Corn tortillas", quantity: "2" },
      { item: "Black beans", quantity: "100g (cooked)" },
      { item: "Tomatoes, diced", quantity: "2" },
      { item: "Red onion, diced", quantity: "1/4" },
      { item: "Jalapeño", quantity: "1/2 (optional)" },
      { item: "Fresh coriander", quantity: "small handful" },
      { item: "Ground cumin", quantity: "1/2 tsp" },
    ],
  },

  // ── Gourmet Lunches ──────────────────────────────────────────────────────────
  "Chicken shawarma bowl with hummus, tabbouleh and flatbread": {
    instructions: "Marinate chicken in olive oil, cumin, coriander, turmeric and garlic. Grill or pan-fry until cooked through. Make tabbouleh with bulgur wheat, parsley, tomato and lemon. Serve over hummus with warm flatbread.",
    ingredients: [
      { item: "Chicken thigh (boneless)", quantity: "180g" },
      { item: "Hummus", quantity: "3 tbsp" },
      { item: "Bulgur wheat", quantity: "50g (dry)" },
      { item: "Fresh parsley", quantity: "large handful" },
      { item: "Cherry tomatoes", quantity: "80g" },
      { item: "Flatbread", quantity: "1 small" },
      { item: "Cumin, coriander, turmeric", quantity: "1 tsp each" },
      { item: "Olive oil", quantity: "1.5 tbsp" },
    ],
  },
  "Pan-seared tuna nicoise with green beans and soft-boiled egg": {
    instructions: "Sear tuna steak in a hot pan with olive oil, 90 sec each side (keep it pink). Blanch green beans. Boil egg 6 min (jammy). Arrange over mixed leaves with olives, cherry tomatoes and a Dijon-lemon dressing.",
    ingredients: [
      { item: "Fresh tuna steak", quantity: "160g" },
      { item: "Egg", quantity: "1" },
      { item: "Green beans", quantity: "100g" },
      { item: "Mixed leaves", quantity: "60g" },
      { item: "Cherry tomatoes", quantity: "80g" },
      { item: "Kalamata olives", quantity: "8" },
      { item: "Dijon mustard", quantity: "1 tsp" },
      { item: "Olive oil & lemon", quantity: "1.5 tbsp / 1 tbsp" },
    ],
  },
  "Thai beef salad with glass noodles, mint and chilli-lime dressing": {
    instructions: "Sear beef steak, slice thinly. Soak glass noodles per packet. Make dressing with fish sauce, lime juice, palm sugar and chilli. Toss with noodles, beef, cucumber, fresh mint and coriander.",
    ingredients: [
      { item: "Lean beef steak", quantity: "160g" },
      { item: "Glass noodles", quantity: "50g (dry)" },
      { item: "Cucumber", quantity: "1/2" },
      { item: "Fresh mint and coriander", quantity: "large handful" },
      { item: "Fish sauce", quantity: "1.5 tbsp" },
      { item: "Lime juice", quantity: "2 tbsp" },
      { item: "Palm sugar or honey", quantity: "1 tsp" },
      { item: "Red chilli", quantity: "1 (deseeded)" },
    ],
  },
  "Mediterranean stuffed peppers with couscous and feta": {
    instructions: "Halve peppers and roast at 200°C for 20 min. Cook couscous and mix with sun-dried tomatoes, olives, crumbled feta and herbs. Fill peppers and bake a further 10 min.",
    ingredients: [
      { item: "Bell peppers", quantity: "2 large" },
      { item: "Couscous", quantity: "60g (dry)" },
      { item: "Feta cheese", quantity: "40g" },
      { item: "Sun-dried tomatoes", quantity: "4" },
      { item: "Kalamata olives", quantity: "8" },
      { item: "Fresh basil or oregano", quantity: "small handful" },
      { item: "Olive oil", quantity: "1 tbsp" },
    ],
  },
  "Prawn and avocado salad with lime, chilli and mixed grains": {
    instructions: "Cook prawns in a hot pan with garlic and chilli, 2 min each side. Mix cooked grains with lime dressing, sliced avocado, cucumber and coriander. Top with prawns.",
    ingredients: [
      { item: "Raw prawns", quantity: "180g (peeled)" },
      { item: "Mixed grains (quinoa, brown rice)", quantity: "60g (dry)" },
      { item: "Avocado", quantity: "1/2" },
      { item: "Cucumber", quantity: "1/3" },
      { item: "Fresh coriander", quantity: "small handful" },
      { item: "Lime juice", quantity: "1.5 tbsp" },
      { item: "Red chilli", quantity: "1/2" },
    ],
  },
  "Chicken souvlaki wrap with tzatziki and roasted vegetables": {
    instructions: "Marinate chicken in olive oil, oregano, garlic and lemon. Grill until cooked through and slightly charred. Roast peppers and courgette. Make tzatziki with yogurt, cucumber, garlic and dill. Assemble in warm flatbread.",
    ingredients: [
      { item: "Chicken breast", quantity: "180g" },
      { item: "Flatbread or pitta", quantity: "1 large" },
      { item: "Greek yogurt", quantity: "3 tbsp" },
      { item: "Cucumber, grated", quantity: "1/4" },
      { item: "Bell peppers and courgette", quantity: "150g combined" },
      { item: "Dried oregano", quantity: "1 tsp" },
      { item: "Garlic clove", quantity: "1" },
    ],
  },
  "Spiced chickpea and spinach curry with basmati rice": {
    instructions: "Sauté onion, garlic and ginger until soft. Add garam masala, cumin and coriander. Stir in chopped tomatoes and chickpeas; simmer 15 min. Wilt in spinach. Serve with fluffy basmati rice.",
    ingredients: [
      { item: "Chickpeas", quantity: "200g (cooked)" },
      { item: "Baby spinach", quantity: "100g" },
      { item: "Basmati rice", quantity: "60g (dry)" },
      { item: "Tinned chopped tomatoes", quantity: "200g" },
      { item: "Onion", quantity: "1/2" },
      { item: "Garlic cloves", quantity: "2" },
      { item: "Garam masala, cumin, coriander", quantity: "1 tsp each" },
    ],
  },
  "Roasted red pepper and lentil soup with sourdough": {
    instructions: "Roast red peppers at 220°C for 25 min, peel. Sauté onion and garlic, add red lentils, roasted peppers, stock and smoked paprika. Simmer 20 min then blend until smooth. Serve with a drizzle of olive oil and crusty sourdough.",
    ingredients: [
      { item: "Red peppers", quantity: "2 large" },
      { item: "Red lentils", quantity: "80g" },
      { item: "Vegetable stock", quantity: "600ml" },
      { item: "Onion", quantity: "1/2" },
      { item: "Garlic cloves", quantity: "2" },
      { item: "Smoked paprika", quantity: "1 tsp" },
      { item: "Sourdough bread", quantity: "1 slice" },
    ],
  },

  // ── Gourmet Dinners ──────────────────────────────────────────────────────────
  "Herb-crusted salmon with lemon risotto and asparagus": {
    instructions: "Press a mix of breadcrumbs, parsley, lemon zest and olive oil onto the salmon. Bake at 200°C for 14-16 min. Make risotto with arborio rice, white wine, lemon juice and parmesan. Roast asparagus alongside the salmon.",
    ingredients: [
      { item: "Salmon fillet", quantity: "180g" },
      { item: "Arborio rice", quantity: "70g (dry)" },
      { item: "Asparagus", quantity: "120g" },
      { item: "White wine", quantity: "60ml" },
      { item: "Parmesan, grated", quantity: "25g" },
      { item: "Lemon", quantity: "1" },
      { item: "Fresh parsley", quantity: "small handful" },
      { item: "Breadcrumbs", quantity: "2 tbsp" },
    ],
  },
  "Moroccan lamb tagine with apricots, couscous and harissa": {
    instructions: "Brown lamb pieces in a tagine or casserole. Add onion, garlic, ras el hanout, cinnamon and chopped tomatoes. Braise 45 min. Add dried apricots last 15 min. Serve over couscous with a spoonful of harissa.",
    ingredients: [
      { item: "Lean lamb shoulder, cubed", quantity: "180g" },
      { item: "Couscous", quantity: "70g (dry)" },
      { item: "Dried apricots", quantity: "6" },
      { item: "Tinned tomatoes", quantity: "200g" },
      { item: "Ras el hanout", quantity: "1.5 tsp" },
      { item: "Cinnamon", quantity: "1/4 tsp" },
      { item: "Harissa paste", quantity: "1 tsp" },
    ],
  },
  "Thai green chicken curry with jasmine rice and bok choy": {
    instructions: "Fry green curry paste in coconut oil for 1 min. Add sliced chicken and cook 5 min. Pour in coconut milk and simmer 15 min. Add bok choy last 3 min. Serve over jasmine rice with fresh basil and lime.",
    ingredients: [
      { item: "Chicken breast, sliced", quantity: "180g" },
      { item: "Jasmine rice", quantity: "70g (dry)" },
      { item: "Bok choy", quantity: "2 heads" },
      { item: "Light coconut milk", quantity: "200ml" },
      { item: "Green curry paste", quantity: "1.5 tbsp" },
      { item: "Fresh basil", quantity: "small handful" },
      { item: "Lime", quantity: "1/2" },
    ],
  },
  "Seared duck breast with sweet potato puree and cherry jus": {
    instructions: "Score duck skin and season well. Sear skin-down in a cold pan, then increase heat — 8 min skin side, 4 min flesh side. Rest 5 min. Boil sweet potato, mash with butter. Reduce chicken stock with cherries and a splash of red wine for jus.",
    ingredients: [
      { item: "Duck breast", quantity: "180g" },
      { item: "Sweet potato", quantity: "250g" },
      { item: "Fresh or frozen cherries", quantity: "80g" },
      { item: "Chicken stock", quantity: "100ml" },
      { item: "Red wine", quantity: "2 tbsp" },
      { item: "Butter", quantity: "1 tsp" },
    ],
  },
  "Pan-seared sea bass with chorizo, white beans and gremolata": {
    instructions: "Sauté diced chorizo until crispy. Add cannellini beans and a little stock; simmer 5 min. Make gremolata with lemon zest, garlic and parsley. Sear sea bass fillets skin-down for 4 min, flip 1 min. Serve over the bean stew and top with gremolata.",
    ingredients: [
      { item: "Sea bass fillets", quantity: "180g" },
      { item: "Chorizo, diced", quantity: "40g" },
      { item: "Cannellini beans", quantity: "150g (cooked)" },
      { item: "Chicken stock", quantity: "80ml" },
      { item: "Lemon zest", quantity: "1 lemon" },
      { item: "Garlic clove", quantity: "1" },
      { item: "Fresh flat-leaf parsley", quantity: "small handful" },
    ],
  },
  "Miso-glazed cod with edamame fried rice and pickled ginger": {
    instructions: "Mix white miso, mirin, honey and soy. Marinate cod 30 min. Grill under the broiler for 8-10 min. Stir-fry cooked rice with edamame, egg, soy and sesame oil. Serve cod over fried rice with pickled ginger on the side.",
    ingredients: [
      { item: "Cod fillet", quantity: "180g" },
      { item: "White miso paste", quantity: "1.5 tbsp" },
      { item: "Mirin", quantity: "1 tbsp" },
      { item: "Cooked brown rice", quantity: "150g" },
      { item: "Edamame", quantity: "80g" },
      { item: "Egg", quantity: "1" },
      { item: "Pickled ginger", quantity: "1 tbsp" },
      { item: "Sesame oil & soy sauce", quantity: "1 tsp each" },
    ],
  },
  "Chicken piccata with capers, lemon butter sauce and linguine": {
    instructions: "Pound chicken breasts thin, dredge in flour. Pan-fry in olive oil 3-4 min each side. Remove and make sauce in same pan with white wine, lemon juice, capers and a knob of butter. Cook linguine al dente. Serve chicken over pasta with the sauce.",
    ingredients: [
      { item: "Chicken breast, pounded thin", quantity: "180g" },
      { item: "Linguine", quantity: "70g (dry)" },
      { item: "Capers", quantity: "1.5 tbsp" },
      { item: "White wine", quantity: "60ml" },
      { item: "Lemon juice", quantity: "2 tbsp" },
      { item: "Butter", quantity: "1.5 tbsp" },
      { item: "Plain flour (for dredging)", quantity: "2 tbsp" },
    ],
  },
  "Beef tenderloin with dauphinoise potato and green peppercorn sauce": {
    instructions: "Thinly slice potatoes and layer with cream, garlic and gruyère. Bake at 170°C for 60 min. Sear beef medallions in a very hot pan, 3 min each side for medium-rare. Rest 5 min. Make sauce by searing the pan with beef stock, cream and green peppercorns.",
    ingredients: [
      { item: "Beef tenderloin medallion", quantity: "180g" },
      { item: "Potatoes, thinly sliced", quantity: "250g" },
      { item: "Double cream", quantity: "100ml" },
      { item: "Gruyère, grated", quantity: "25g" },
      { item: "Beef stock", quantity: "80ml" },
      { item: "Green peppercorns in brine", quantity: "1 tbsp" },
      { item: "Garlic clove", quantity: "1" },
    ],
  },

  // ── Gourmet Snacks ───────────────────────────────────────────────────────────
  "Baba ganoush with toasted pita and cucumber": {
    instructions: "Char aubergine directly over a gas flame or under the grill until completely blackened. Scoop out flesh and blend with tahini, garlic, lemon juice and olive oil. Serve with toasted pitta triangles and sliced cucumber.",
    ingredients: [
      { item: "Aubergine (eggplant)", quantity: "1 large" },
      { item: "Tahini", quantity: "1.5 tbsp" },
      { item: "Lemon juice", quantity: "1.5 tbsp" },
      { item: "Garlic clove", quantity: "1" },
      { item: "Pitta bread", quantity: "1 (toasted)" },
      { item: "Cucumber", quantity: "1/3" },
    ],
  },
  "Whipped ricotta with honey, walnuts and pomegranate": {
    instructions: "Blend ricotta with a little salt and lemon zest until very smooth. Spread into a bowl. Top with a generous drizzle of honey, chopped toasted walnuts and pomegranate seeds.",
    ingredients: [
      { item: "Ricotta cheese", quantity: "120g" },
      { item: "Honey", quantity: "1.5 tbsp" },
      { item: "Walnuts, toasted and chopped", quantity: "20g" },
      { item: "Pomegranate seeds", quantity: "2 tbsp" },
      { item: "Lemon zest", quantity: "pinch" },
    ],
  },
  "Smoked salmon and cream cheese on rye crispbreads": {
    instructions: "Spread cream cheese generously onto rye crispbreads. Top with smoked salmon, a squeeze of lemon and fresh dill. Finish with black pepper.",
    ingredients: [
      { item: "Smoked salmon", quantity: "60g" },
      { item: "Cream cheese", quantity: "2 tbsp" },
      { item: "Rye crispbreads", quantity: "3" },
      { item: "Fresh dill", quantity: "small handful" },
      { item: "Lemon juice", quantity: "squeeze" },
    ],
  },
  "Roasted spiced chickpeas with tahini dip": {
    instructions: "Drain and dry chickpeas well. Toss with olive oil, smoked paprika, cumin and salt. Roast at 200°C for 25-30 min until crispy. Make dip by stirring tahini with lemon juice, garlic and a little water.",
    ingredients: [
      { item: "Chickpeas", quantity: "200g (cooked, drained)" },
      { item: "Olive oil", quantity: "1 tbsp" },
      { item: "Smoked paprika & cumin", quantity: "1/2 tsp each" },
      { item: "Tahini", quantity: "1.5 tbsp" },
      { item: "Lemon juice", quantity: "1 tbsp" },
      { item: "Garlic clove", quantity: "1/2" },
    ],
  },
  "Caprese skewers with fresh mozzarella and basil pesto": {
    instructions: "Thread fresh mozzarella balls, cherry tomatoes and basil leaves onto small skewers. Drizzle with store-bought or homemade pesto and a little balsamic glaze.",
    ingredients: [
      { item: "Fresh mozzarella (bocconcini)", quantity: "100g" },
      { item: "Cherry tomatoes", quantity: "100g" },
      { item: "Fresh basil leaves", quantity: "12 leaves" },
      { item: "Basil pesto", quantity: "1 tbsp" },
      { item: "Balsamic glaze", quantity: "1 tsp" },
    ],
  },
  "Prosciutto-wrapped melon with rocket": {
    instructions: "Cut melon into wedges and remove the skin. Wrap each wedge with a slice of prosciutto. Arrange over rocket leaves and finish with a drizzle of olive oil and cracked black pepper.",
    ingredients: [
      { item: "Melon (cantaloupe or honeydew)", quantity: "1/4 melon" },
      { item: "Prosciutto", quantity: "3 slices" },
      { item: "Rocket (arugula)", quantity: "30g" },
      { item: "Olive oil", quantity: "1 tsp" },
      { item: "Black pepper", quantity: "to taste" },
    ],
  },
  "Nut butter energy balls with oats, dates and dark chocolate": {
    instructions: "Blend pitted dates until sticky. Mix with oats, almond butter and a pinch of salt. Fold in dark chocolate chips. Roll into balls and refrigerate for at least 30 min before eating.",
    ingredients: [
      { item: "Medjool dates, pitted", quantity: "6" },
      { item: "Rolled oats", quantity: "50g" },
      { item: "Almond butter", quantity: "1.5 tbsp" },
      { item: "Dark chocolate chips", quantity: "15g" },
      { item: "Sea salt", quantity: "pinch" },
    ],
  },
  "Tuna tartare on cucumber rounds with sesame and soy": {
    instructions: "Finely dice sushi-grade tuna. Mix with soy sauce, sesame oil, lime juice and a little sriracha. Slice cucumber into rounds. Top each with a small spoonful of tartare and garnish with sesame seeds and microgreens.",
    ingredients: [
      { item: "Sushi-grade tuna", quantity: "120g" },
      { item: "Cucumber", quantity: "1/2" },
      { item: "Soy sauce", quantity: "1 tbsp" },
      { item: "Sesame oil", quantity: "1 tsp" },
      { item: "Lime juice", quantity: "1 tsp" },
      { item: "Sriracha", quantity: "1/4 tsp" },
      { item: "Sesame seeds & microgreens", quantity: "1 tsp / small handful" },
    ],
  },

  // ── Michelin Breakfasts ──────────────────────────────────────────────────────
  "Croque Madame with Gruyère, smoked ham and fried egg": {
    instructions: "Make a béchamel by melting butter, whisking in flour then milk; season well. Spread on both slices of bread. Layer smoked ham and Gruyère between slices. Top with more béchamel and cheese. Grill until golden and bubbling. Meanwhile fry an egg in butter until the white is set. Place on top of the toast and serve immediately.",
    ingredients: [
      { item: "Sourdough or thick white bread", quantity: "2 slices" },
      { item: "Smoked cooked ham", quantity: "60g" },
      { item: "Gruyère cheese, grated", quantity: "50g" },
      { item: "Egg", quantity: "1" },
      { item: "Butter", quantity: "15g" },
      { item: "Plain flour", quantity: "1 tbsp" },
      { item: "Whole milk", quantity: "80ml" },
      { item: "Dijon mustard", quantity: "1 tsp" },
    ],
  },
  "Slow scrambled eggs with crème fraîche, chives and smoked trout on rye": {
    instructions: "Whisk eggs with crème fraîche and a pinch of salt. Melt butter in a non-stick pan on the lowest heat. Add eggs and stir very gently and continuously for 8–10 minutes until softly set and creamy. Remove from heat just before fully done. Serve on toasted rye with flaked smoked trout and fresh chives.",
    ingredients: [
      { item: "Eggs", quantity: "3" },
      { item: "Crème fraîche", quantity: "1 tbsp" },
      { item: "Smoked trout fillets", quantity: "80g" },
      { item: "Rye bread", quantity: "2 slices" },
      { item: "Butter", quantity: "1 tsp" },
      { item: "Fresh chives, chopped", quantity: "1 tbsp" },
      { item: "Salt & black pepper", quantity: "to taste" },
    ],
  },
  "Ricotta pancakes with blueberry compote and lemon curd": {
    instructions: "Separate eggs. Mix yolks with ricotta, flour, baking powder and lemon zest. Whisk whites to soft peaks and fold in gently. Cook spoonfuls in a buttered pan on low-medium heat, 2–3 min per side. For the compote, simmer blueberries with sugar and a squeeze of lemon for 5 minutes. Serve pancakes topped with compote and a spoonful of lemon curd.",
    ingredients: [
      { item: "Ricotta cheese", quantity: "125g" },
      { item: "Eggs", quantity: "2 (separated)" },
      { item: "Plain flour", quantity: "40g" },
      { item: "Baking powder", quantity: "1/2 tsp" },
      { item: "Lemon", quantity: "1 (zest + juice)" },
      { item: "Fresh or frozen blueberries", quantity: "100g" },
      { item: "Lemon curd", quantity: "2 tbsp" },
      { item: "Butter", quantity: "1 tsp" },
      { item: "Caster sugar", quantity: "1 tsp" },
    ],
  },
  "Brioche French toast with mascarpone, caramelised banana and maple syrup": {
    instructions: "Whisk eggs with milk and a pinch of cinnamon. Dip brioche slices and pan-fry in butter on medium heat until golden, 2–3 min each side. Meanwhile, halve the banana and fry cut-side down in a little butter and a pinch of sugar until caramelised, about 2 minutes. Serve toast topped with a spoonful of mascarpone, the caramelised banana and a drizzle of maple syrup.",
    ingredients: [
      { item: "Brioche", quantity: "2 thick slices" },
      { item: "Eggs", quantity: "2" },
      { item: "Whole milk", quantity: "3 tbsp" },
      { item: "Banana", quantity: "1" },
      { item: "Mascarpone", quantity: "2 tbsp" },
      { item: "Maple syrup", quantity: "1 tbsp" },
      { item: "Butter", quantity: "1 tbsp" },
      { item: "Ground cinnamon", quantity: "pinch" },
    ],
  },
  "Baked eggs in tomato and chorizo sauce with crusty sourdough": {
    instructions: "Slice chorizo and fry in a medium oven-proof frying pan for 2 minutes until the oils release. Add sliced garlic and cook 1 minute. Pour in tinned tomatoes, season with smoked paprika, salt and pepper, and simmer 8–10 min. Make wells in the sauce and crack in the eggs. Bake in a 190°C oven for 8–10 minutes until the whites are set but yolks remain runny. Scatter with parsley and serve with sourdough.",
    ingredients: [
      { item: "Cooking chorizo", quantity: "80g, sliced" },
      { item: "Tinned chopped tomatoes", quantity: "400g tin" },
      { item: "Eggs", quantity: "2" },
      { item: "Garlic cloves", quantity: "2" },
      { item: "Smoked paprika", quantity: "1/2 tsp" },
      { item: "Sourdough bread", quantity: "2 slices" },
      { item: "Fresh parsley", quantity: "small handful" },
    ],
  },
  "Poached eggs with wilted spinach, lemon hollandaise and smoked salmon": {
    instructions: "Make a quick hollandaise: whisk 2 egg yolks with 1 tsp lemon juice in a heatproof bowl over simmering water until thick. Slowly whisk in melted butter until glossy; season. Wilt spinach in a pan with a little butter. Poach eggs in simmering water with a splash of vinegar, 3–4 min. Toast English muffins. Layer spinach, smoked salmon and egg, then spoon hollandaise generously over the top.",
    ingredients: [
      { item: "Eggs", quantity: "2" },
      { item: "Smoked salmon", quantity: "80g" },
      { item: "Baby spinach", quantity: "80g" },
      { item: "Sourdough or English muffin", quantity: "1 muffin / 2 slices" },
      { item: "Butter", quantity: "50g (for hollandaise)" },
      { item: "Egg yolks", quantity: "2 (for hollandaise)" },
      { item: "Lemon juice", quantity: "1.5 tsp" },
      { item: "White wine vinegar", quantity: "1 tsp (for poaching)" },
    ],
  },
  "Smoked salmon and cream cheese omelette with chives and sourdough": {
    instructions: "Whisk 3 eggs with a pinch of salt and pepper. Melt butter in a non-stick pan over medium heat. Pour in eggs and draw the edges in with a spatula until just set but still creamy on top. Add cream cheese and smoked salmon to one half, fold over and slide onto a plate. Finish with snipped chives and serve with toasted sourdough.",
    ingredients: [
      { item: "Eggs", quantity: "3" },
      { item: "Smoked salmon", quantity: "60g" },
      { item: "Cream cheese", quantity: "1.5 tbsp" },
      { item: "Fresh chives, snipped", quantity: "1 tbsp" },
      { item: "Butter", quantity: "1 tsp" },
      { item: "Sourdough bread", quantity: "1 thick slice" },
      { item: "Salt & pepper", quantity: "to taste" },
    ],
  },
  "Warm spiced oats with poached pear, cardamom cream and toasted pistachios": {
    instructions: "Halve pear and simmer gently in water with a little honey and a star anise for 8 min until tender. Cook oats with milk, ground cinnamon and cardamom until creamy. Whip crème fraîche with a pinch of cardamom. Serve oats topped with the poached pear, a dollop of cardamom cream and a scatter of toasted pistachios.",
    ingredients: [
      { item: "Rolled oats", quantity: "60g" },
      { item: "Whole milk", quantity: "220ml" },
      { item: "Ripe pear", quantity: "1" },
      { item: "Crème fraîche", quantity: "2 tbsp" },
      { item: "Pistachios, toasted and roughly chopped", quantity: "20g" },
      { item: "Ground cardamom", quantity: "1/4 tsp" },
      { item: "Ground cinnamon", quantity: "1/4 tsp" },
      { item: "Honey", quantity: "1 tsp" },
      { item: "Star anise", quantity: "1" },
    ],
  },

  // ── Michelin Lunches ─────────────────────────────────────────────────────────
  "Pan-seared salmon with asparagus, lemon caper butter and new potatoes": {
    instructions: "Boil new potatoes until tender, drain and crush lightly with butter. Trim asparagus and blanch 3 min. Season salmon skin-side down, sear in a hot pan with oil, 4 min; flip and cook 2 more min. Remove fish. Add butter, capers and lemon juice to the pan and swirl for 1 min. Plate potatoes and asparagus, lay salmon on top and pour over the caper butter.",
    ingredients: [
      { item: "Salmon fillet", quantity: "200g" },
      { item: "New potatoes", quantity: "200g" },
      { item: "Asparagus spears", quantity: "120g" },
      { item: "Butter", quantity: "20g" },
      { item: "Capers", quantity: "1 tbsp" },
      { item: "Lemon", quantity: "1/2" },
      { item: "Olive oil", quantity: "1 tbsp" },
    ],
  },
  "Seared sea bass fillet with chorizo, butter beans and wilted spinach": {
    instructions: "Fry sliced chorizo until crispy; set aside, keeping the oil in the pan. Add garlic and butter beans, cook 2 min. Add white wine, let it reduce by half, then add baby spinach and stir until wilted. Season the sea bass fillets, score the skin and sear skin-side down in a separate hot pan with oil for 3–4 min until crispy, flip for 1 min. Serve the bean mixture in a shallow bowl topped with the fish and the crispy chorizo.",
    ingredients: [
      { item: "Sea bass fillets", quantity: "200g (2 fillets)" },
      { item: "Cooking chorizo", quantity: "60g, sliced" },
      { item: "Butter beans", quantity: "240g tin, drained" },
      { item: "Baby spinach", quantity: "80g" },
      { item: "Garlic clove", quantity: "1" },
      { item: "Dry white wine", quantity: "50ml" },
      { item: "Olive oil", quantity: "1 tbsp" },
    ],
  },
  "Seared scallops with pea purée, crispy pancetta and lemon butter": {
    instructions: "Fry pancetta rashers until crispy; drain and set aside. Blitz peas with butter, mint, salt and a splash of the cooking water until smooth; keep warm. Pat scallops very dry. Heat a pan until very hot, add a little oil and sear scallops 1.5 min per side without moving. Remove, add butter and lemon juice to the pan, swirl to make a sauce. Plate the purée, set scallops on top, drizzle with the lemon butter and crumble over the pancetta.",
    ingredients: [
      { item: "King scallops", quantity: "6 (fresh or defrosted)" },
      { item: "Frozen peas", quantity: "200g" },
      { item: "Pancetta rashers", quantity: "3" },
      { item: "Butter", quantity: "25g" },
      { item: "Fresh mint leaves", quantity: "5 leaves" },
      { item: "Lemon juice", quantity: "1 tsp" },
      { item: "Olive oil", quantity: "1 tsp" },
    ],
  },
  "Grilled ribeye steak salad with blue cheese, walnuts and bitter leaves": {
    instructions: "Bring steak to room temperature. Season generously with salt and pepper. Grill or pan-sear 3–4 min per side for medium-rare; rest 5 minutes. Toast walnuts in a dry pan 2–3 min. Whisk together olive oil, red wine vinegar, Dijon and a little honey for the dressing. Toss chicory and rocket with dressing. Slice the steak and arrange over the leaves. Crumble over blue cheese and scatter walnuts.",
    ingredients: [
      { item: "Ribeye steak", quantity: "200g" },
      { item: "Blue cheese (e.g. Stilton or Gorgonzola)", quantity: "40g" },
      { item: "Walnuts", quantity: "30g" },
      { item: "Chicory or radicchio", quantity: "1 head" },
      { item: "Rocket", quantity: "40g" },
      { item: "Olive oil", quantity: "2 tbsp" },
      { item: "Red wine vinegar", quantity: "1 tsp" },
      { item: "Dijon mustard", quantity: "1/2 tsp" },
    ],
  },
  "Crispy duck leg with Puy lentil salad, mustard dressing and watercress": {
    instructions: "Season duck leg generously and roast at 180°C for 60–70 min until the skin is golden and crispy. Cook Puy lentils in stock for 20–25 min until just tender; drain. While warm, toss with shallot, parsley, olive oil, red wine vinegar and wholegrain mustard. Arrange lentils on a plate, top with the duck leg and lay watercress alongside.",
    ingredients: [
      { item: "Duck leg", quantity: "1 (approx 300g)" },
      { item: "Puy lentils", quantity: "80g (dry)" },
      { item: "Watercress", quantity: "50g" },
      { item: "Shallot, finely diced", quantity: "1" },
      { item: "Fresh parsley, chopped", quantity: "small handful" },
      { item: "Wholegrain mustard", quantity: "1 tsp" },
      { item: "Red wine vinegar", quantity: "1 tbsp" },
      { item: "Olive oil", quantity: "2 tbsp" },
      { item: "Chicken stock", quantity: "300ml" },
    ],
  },
  "Roasted red pepper and goat cheese tart with dressed rocket salad": {
    instructions: "Unroll a sheet of shop-bought puff pastry. Score a 1cm border all around and prick the centre with a fork. Spread crème fraîche within the border; season. Layer with sliced roasted red peppers (from a jar). Crumble over goat cheese and scatter with thyme leaves. Bake at 200°C for 18–20 min until golden. Toss rocket with olive oil, lemon juice and black pepper. Serve alongside the warm tart.",
    ingredients: [
      { item: "Ready-rolled puff pastry", quantity: "1 sheet (approx 320g)" },
      { item: "Roasted red peppers (jar)", quantity: "150g, drained and sliced" },
      { item: "Soft goat cheese", quantity: "80g" },
      { item: "Crème fraîche", quantity: "2 tbsp" },
      { item: "Fresh thyme", quantity: "few sprigs" },
      { item: "Rocket", quantity: "50g" },
      { item: "Olive oil", quantity: "1 tbsp" },
      { item: "Lemon juice", quantity: "1 tsp" },
    ],
  },
  "Warm chicken liver salad with crispy bacon, baby spinach and balsamic": {
    instructions: "Grill or fry bacon rashers until crispy; set aside. Trim chicken livers. Heat olive oil in a pan over high heat and fry livers 2 min per side until browned outside but still slightly pink inside. Deglaze with balsamic vinegar and let it reduce for 30 seconds. Arrange baby spinach on plates, top with livers, crumble over the bacon. Drizzle with the pan juices and any extra olive oil.",
    ingredients: [
      { item: "Chicken livers", quantity: "200g, trimmed" },
      { item: "Bacon rashers", quantity: "3" },
      { item: "Baby spinach", quantity: "80g" },
      { item: "Balsamic vinegar", quantity: "1.5 tbsp" },
      { item: "Olive oil", quantity: "1.5 tbsp" },
      { item: "Sourdough bread, toasted", quantity: "1 slice (optional)" },
    ],
  },
  "Seared tuna steak with mango salsa, wild rice and lime crème fraîche": {
    instructions: "Cook wild rice per packet (about 25 min). Make salsa by combining diced mango, red onion, chilli, coriander and lime juice; season. Whisk crème fraîche with lime zest and a pinch of salt. Heat a pan until very hot. Season tuna, brush with oil and sear 1–1.5 min per side (it should remain pink inside). Serve tuna over rice with the salsa on top and a spoonful of lime crème fraîche on the side.",
    ingredients: [
      { item: "Tuna steak", quantity: "180g" },
      { item: "Wild rice blend", quantity: "70g (dry)" },
      { item: "Ripe mango", quantity: "1/2, diced" },
      { item: "Red onion, finely diced", quantity: "1/4" },
      { item: "Red chilli, deseeded and diced", quantity: "1/2" },
      { item: "Fresh coriander, chopped", quantity: "small handful" },
      { item: "Lime", quantity: "1" },
      { item: "Crème fraîche", quantity: "2 tbsp" },
      { item: "Olive oil", quantity: "1 tsp" },
    ],
  },

  // ── Michelin Dinners ─────────────────────────────────────────────────────────
  "Ribeye steak with truffle butter, dauphinoise potatoes and tenderstem broccoli": {
    instructions: "Make dauphinoise: slice potatoes thinly, layer in a buttered dish with double cream, garlic and seasoning; cover with foil and bake 50 min at 170°C, uncover for last 15 min. Make truffle butter by mixing softened butter with truffle oil, salt and a little garlic. Bring steak to room temp; season generously. Sear in a screaming hot pan 3–4 min each side for medium-rare; rest 5 min. Blanch tenderstem broccoli 3 min. Top steak with a slice of truffle butter.",
    ingredients: [
      { item: "Ribeye steak", quantity: "220g" },
      { item: "Potatoes (e.g. Maris Piper)", quantity: "300g" },
      { item: "Double cream", quantity: "150ml" },
      { item: "Garlic cloves", quantity: "2" },
      { item: "Tenderstem broccoli", quantity: "150g" },
      { item: "Butter", quantity: "40g" },
      { item: "Truffle oil", quantity: "1 tsp" },
    ],
  },
  "Duck breast with cherry and port sauce, potato gratin and wilted greens": {
    instructions: "Score the duck skin in a crosshatch pattern. Place skin-side down in a cold pan, then bring to medium heat. Cook 12–15 min as the fat renders until the skin is golden. Flip and cook 3 min more for medium. Rest 8 min. Meanwhile, make the sauce: deglaze the pan with port, add chicken stock and pitted cherries; reduce by half. For the gratin: layer sliced potato with cream, garlic and cheese; bake at 180°C for 45 min. Wilt greens with butter. Slice duck and plate with the sauce.",
    ingredients: [
      { item: "Duck breast", quantity: "1 (approx 200g)" },
      { item: "Potatoes", quantity: "250g" },
      { item: "Double cream", quantity: "100ml" },
      { item: "Gruyère or cheddar, grated", quantity: "40g" },
      { item: "Port", quantity: "60ml" },
      { item: "Chicken stock", quantity: "100ml" },
      { item: "Fresh or frozen cherries", quantity: "80g, pitted" },
      { item: "Spring greens or Savoy cabbage", quantity: "100g" },
      { item: "Butter", quantity: "1 tbsp" },
    ],
  },
  "Rack of lamb with herb crust, roasted garlic mash and red wine jus": {
    instructions: "Blend breadcrumbs with rosemary, thyme, parsley and a little olive oil. Sear the lamb rack on all sides in a hot pan 3 min. Press the herb crust onto the fat side. Roast at 200°C for 18–20 min for medium-rare. Rest 10 min. Slow-roast a whole garlic bulb alongside. Squeeze the soft garlic into mashed potato with butter and cream. Make the jus: deglaze the roasting tin with red wine and stock, reduce until syrupy.",
    ingredients: [
      { item: "Rack of lamb (6–8 bones)", quantity: "approx 400g" },
      { item: "Potatoes", quantity: "300g" },
      { item: "Garlic bulb", quantity: "1 (plus 2 extra cloves)" },
      { item: "Red wine", quantity: "100ml" },
      { item: "Chicken or lamb stock", quantity: "100ml" },
      { item: "Fresh rosemary & thyme", quantity: "2 sprigs each" },
      { item: "Fresh parsley", quantity: "small handful" },
      { item: "Breadcrumbs", quantity: "30g" },
      { item: "Butter", quantity: "30g" },
      { item: "Double cream", quantity: "2 tbsp" },
    ],
  },
  "Pan-roasted sea bass with saffron mussels, new potatoes and parsley oil": {
    instructions: "Boil new potatoes until tender; halve. Soak saffron in 1 tbsp hot water. Steam mussels: heat shallot, garlic and white wine in a lidded pan, add mussels, cover and cook 3–4 min until opened; discard any that don't open. Strain the liquor and stir in saffron, butter and cream to make a sauce. Season sea bass, score the skin and sear skin-side down in a very hot pan 4 min until crispy, flip 1 min. Blend parsley with olive oil for the parsley oil. Plate potatoes and mussels, lay fish on top, pour over sauce, drizzle with parsley oil.",
    ingredients: [
      { item: "Sea bass fillets", quantity: "200g" },
      { item: "Fresh mussels", quantity: "400g (cleaned)" },
      { item: "New potatoes", quantity: "200g" },
      { item: "Saffron", quantity: "good pinch" },
      { item: "Dry white wine", quantity: "100ml" },
      { item: "Shallot", quantity: "1" },
      { item: "Double cream", quantity: "3 tbsp" },
      { item: "Butter", quantity: "15g" },
      { item: "Fresh flat-leaf parsley", quantity: "large handful" },
      { item: "Olive oil", quantity: "2 tbsp" },
    ],
  },
  "Slow-braised beef short ribs with creamy polenta, gremolata and roasted roots": {
    instructions: "Season short ribs and sear all over in a casserole. Set aside. Fry onion, carrot and celery until soft. Add tomato paste, red wine and stock; return ribs, bring to a simmer, cover and braise at 160°C for 3–3.5 hours until the meat falls off the bone. Roast parsnips and carrots alongside. For polenta: bring salted water to boil, whisk in polenta and stir constantly for 5 min; finish with butter and parmesan. Make gremolata with lemon zest, garlic and parsley. Serve ribs over polenta, with roots and the braising jus.",
    ingredients: [
      { item: "Beef short ribs", quantity: "400g (bone-in)" },
      { item: "Coarse polenta", quantity: "80g" },
      { item: "Parmesan, grated", quantity: "30g" },
      { item: "Parsnips and carrots", quantity: "200g mixed" },
      { item: "Red wine", quantity: "150ml" },
      { item: "Beef stock", quantity: "300ml" },
      { item: "Onion, carrot, celery", quantity: "1 each" },
      { item: "Tomato paste", quantity: "1 tbsp" },
      { item: "Lemon zest, garlic, flat-leaf parsley", quantity: "for gremolata" },
      { item: "Butter", quantity: "20g" },
    ],
  },
  "Chicken supreme with wild mushroom and tarragon cream sauce, pommes purée": {
    instructions: "Sear chicken supremes skin-side down in butter and oil, 5–6 min until golden; flip and roast at 190°C for 15 min. Rest 5 min. For the sauce: sauté shallot, then add sliced mushrooms and cook until any liquid evaporates. Splash in white wine, reduce, then add double cream and fresh tarragon; simmer 5 min. For the purée: boil potatoes, drain well, pass through a ricer; beat in generous butter and warm cream until silky.",
    ingredients: [
      { item: "Chicken supreme (skin-on breast)", quantity: "2 pieces (approx 180g each)" },
      { item: "Chestnut or mixed wild mushrooms", quantity: "150g, sliced" },
      { item: "Double cream", quantity: "100ml" },
      { item: "Dry white wine", quantity: "60ml" },
      { item: "Fresh tarragon leaves", quantity: "1 tbsp" },
      { item: "Potatoes", quantity: "300g" },
      { item: "Butter", quantity: "50g" },
      { item: "Shallot", quantity: "1" },
      { item: "Olive oil", quantity: "1 tbsp" },
    ],
  },
  "Salmon en croûte with spinach and cream cheese filling, lemon dill sauce": {
    instructions: "Wilt spinach with garlic; squeeze out moisture and mix with cream cheese, dill and seasoning. Lay a puff pastry sheet on a baking tray. Place salmon fillet in the centre, top with spinach mixture, fold pastry over and seal the edges. Brush with egg wash and score lightly. Bake at 200°C for 25–30 min until deep golden. Make the sauce: heat crème fraîche gently with lemon juice, zest and fresh dill — do not boil.",
    ingredients: [
      { item: "Salmon fillet (skinless)", quantity: "350g" },
      { item: "Ready-rolled puff pastry", quantity: "1 sheet (approx 320g)" },
      { item: "Baby spinach", quantity: "100g" },
      { item: "Cream cheese", quantity: "80g" },
      { item: "Fresh dill", quantity: "2 tbsp, chopped" },
      { item: "Egg", quantity: "1 (for egg wash)" },
      { item: "Crème fraîche", quantity: "100ml (for sauce)" },
      { item: "Lemon", quantity: "1 (zest and juice)" },
      { item: "Garlic clove", quantity: "1" },
    ],
  },
  "Slow-roasted pork belly with apple and cider jus, roasted roots and mustard greens": {
    instructions: "Score pork belly skin, rub generously with salt, pepper and fennel seeds; refrigerate uncovered overnight if possible. Roast skin-side up at 150°C for 2.5 hours, then increase to 220°C for 20–25 min until crackling is crisp. Roast parsnips and carrots tossed in olive oil alongside at 200°C for 30 min. For the jus: reduce dry cider and chicken stock with a quartered apple and a little thyme; sieve and season. Sauté greens with wholegrain mustard and butter.",
    ingredients: [
      { item: "Pork belly slices or joint", quantity: "400g" },
      { item: "Dry cider", quantity: "150ml" },
      { item: "Chicken stock", quantity: "100ml" },
      { item: "Apple", quantity: "1, cored and quartered" },
      { item: "Parsnips and carrots", quantity: "200g mixed" },
      { item: "Spring greens or kale", quantity: "100g" },
      { item: "Wholegrain mustard", quantity: "1 tsp" },
      { item: "Fennel seeds", quantity: "1 tsp" },
      { item: "Fresh thyme", quantity: "3 sprigs" },
      { item: "Butter", quantity: "15g" },
    ],
  },

  // ── Michelin Snacks ──────────────────────────────────────────────────────────
  "Parma ham with marinated artichoke hearts and olives": {
    instructions: "Arrange Parma ham slices on a board. Drain artichoke hearts and olives; toss together with a drizzle of olive oil, a squeeze of lemon and black pepper. Serve alongside crusty bread or breadsticks.",
    ingredients: [
      { item: "Parma ham", quantity: "4 slices" },
      { item: "Marinated artichoke hearts (jar)", quantity: "80g, drained" },
      { item: "Mixed olives", quantity: "40g" },
      { item: "Olive oil", quantity: "1 tsp" },
      { item: "Lemon juice", quantity: "1/2 tsp" },
      { item: "Crusty bread or breadsticks", quantity: "to serve" },
    ],
  },
  "Smoked mackerel pâté with dark rye crispbreads and cucumber": {
    instructions: "Flake the smoked mackerel into a bowl, discarding skin and any bones. Beat in cream cheese, lemon juice, horseradish sauce and black pepper until smooth and creamy. Taste and adjust seasoning. Spoon into a small dish. Slice cucumber into rounds. Serve alongside the rye crispbreads and cucumber for dipping and spreading.",
    ingredients: [
      { item: "Smoked mackerel fillet", quantity: "150g" },
      { item: "Cream cheese", quantity: "50g" },
      { item: "Lemon juice", quantity: "1 tbsp" },
      { item: "Creamed horseradish", quantity: "1 tsp" },
      { item: "Rye crispbreads", quantity: "4" },
      { item: "Cucumber", quantity: "1/3" },
      { item: "Black pepper", quantity: "to taste" },
    ],
  },
  "Crostini with ricotta, honey and toasted walnuts": {
    instructions: "Slice a baguette or sourdough on the diagonal. Brush lightly with olive oil and toast in a hot oven or under the grill for 3–4 min until golden. While warm, spread generously with ricotta. Drizzle with good honey, scatter over the toasted walnuts and finish with a pinch of sea salt and black pepper.",
    ingredients: [
      { item: "Sourdough or baguette", quantity: "3–4 slices" },
      { item: "Ricotta", quantity: "80g" },
      { item: "Walnuts, toasted and roughly chopped", quantity: "25g" },
      { item: "Runny honey", quantity: "1 tbsp" },
      { item: "Olive oil", quantity: "1 tsp" },
      { item: "Sea salt & black pepper", quantity: "to taste" },
    ],
  },
  "Burrata with slow-roasted cherry tomatoes, basil and aged balsamic": {
    instructions: "Toss cherry tomatoes with olive oil, a pinch of sugar, salt and pepper. Spread on a baking tray and slow-roast at 140°C for 40–50 min until wrinkled and sweet. Allow to cool slightly. Place burrata on a plate, arrange warm tomatoes around it, scatter fresh basil leaves, drizzle with the best olive oil you have and finish with a few drops of aged balsamic glaze.",
    ingredients: [
      { item: "Burrata", quantity: "1 ball (approx 125g)" },
      { item: "Cherry tomatoes", quantity: "200g" },
      { item: "Fresh basil leaves", quantity: "handful" },
      { item: "Aged balsamic glaze", quantity: "1 tsp" },
      { item: "Extra virgin olive oil", quantity: "1.5 tbsp" },
      { item: "Sourdough, toasted (optional)", quantity: "1 slice" },
    ],
  },
  "Manchego cheese with quince paste, Marcona almonds and Serrano ham": {
    instructions: "Slice Manchego into thin shards. Slice quince paste into small cubes or spread onto crispbreads. Arrange everything on a board or plate — cheese, quince, a few slices of Serrano ham and a small pile of Marcona almonds. Serve with crispbreads or crackers.",
    ingredients: [
      { item: "Manchego cheese", quantity: "60g" },
      { item: "Quince paste (membrillo)", quantity: "30g" },
      { item: "Marcona almonds", quantity: "25g" },
      { item: "Serrano ham", quantity: "2 slices" },
      { item: "Crispbreads or crackers", quantity: "3–4" },
    ],
  },
  "Smoked salmon blinis with crème fraîche and capers": {
    instructions: "If making blinis from scratch: mix buckwheat flour, plain flour, baking powder, egg and milk to a thick batter; fry small spoonfuls in butter 1–2 min per side until golden. (Shop-bought blinis can be warmed in a low oven.) Top each blini with a small spoonful of crème fraîche, a fold of smoked salmon, a few capers and a tiny squeeze of lemon.",
    ingredients: [
      { item: "Smoked salmon", quantity: "80g" },
      { item: "Blinis (shop-bought or homemade)", quantity: "8" },
      { item: "Crème fraîche", quantity: "3 tbsp" },
      { item: "Capers", quantity: "1 tbsp" },
      { item: "Lemon", quantity: "1/4" },
      { item: "Fresh dill (optional)", quantity: "small sprig" },
    ],
  },
  "Brie with honey, walnuts and sliced pear on crispbreads": {
    instructions: "Toast walnut halves in a dry pan for 2 minutes until lightly golden. Slice pear thinly. Arrange crispbreads on a board. Top each with a slice of ripe Brie, a piece of pear, a walnut half and a small drizzle of runny honey. Finish with a grind of black pepper.",
    ingredients: [
      { item: "Ripe Brie", quantity: "60g, sliced" },
      { item: "Ripe pear", quantity: "1/2, thinly sliced" },
      { item: "Walnuts", quantity: "25g" },
      { item: "Runny honey", quantity: "1.5 tsp" },
      { item: "Crispbreads or water crackers", quantity: "4" },
      { item: "Black pepper", quantity: "to taste" },
    ],
  },
  "Warm rosemary and chilli marinated olives with sourdough": {
    instructions: "Gently warm olive oil in a small pan with crushed garlic, rosemary sprigs, dried chilli flakes and lemon zest for 5 minutes — don't let it fry, just infuse. Pour over drained mixed olives in a bowl and toss well. Serve warm with slices of sourdough for dipping.",
    ingredients: [
      { item: "Mixed olives", quantity: "150g, drained" },
      { item: "Olive oil", quantity: "3 tbsp" },
      { item: "Fresh rosemary", quantity: "2 sprigs" },
      { item: "Garlic clove, crushed", quantity: "1" },
      { item: "Dried chilli flakes", quantity: "1/4 tsp" },
      { item: "Lemon zest", quantity: "1/2 lemon" },
      { item: "Sourdough bread", quantity: "2 slices" },
    ],
  },
};

export interface Meal {
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

interface MicroItem { name: string; amount: number; unit: string; note?: string }
interface MicroCategory { label: string; items: MicroItem[] }

function getMicronutrients(age: number, gender: string): MicroCategory[] {
  const m = gender === 'male';
  const o = age >= 51;
  const e = age >= 71;
  return [
    {
      label: "Vitamins",
      items: [
        { name: "Vitamin A",              amount: m ? 900 : 700,                            unit: "mcg" },
        { name: "Vitamin C",              amount: m ? 90 : 75,                              unit: "mg" },
        { name: "Vitamin D",              amount: e ? 20 : 15,                              unit: "mcg" },
        { name: "Vitamin E",              amount: 15,                                        unit: "mg" },
        { name: "Vitamin K",              amount: m ? 120 : 90,                             unit: "mcg" },
        { name: "Vitamin B1 (Thiamine)",  amount: m ? 1.2 : 1.1,                           unit: "mg" },
        { name: "Vitamin B2 (Riboflavin)",amount: m ? 1.3 : 1.1,                           unit: "mg" },
        { name: "Vitamin B3 (Niacin)",    amount: m ? 16 : 14,                             unit: "mg NE" },
        { name: "Vitamin B6",             amount: m ? (o ? 1.7 : 1.3) : (o ? 1.5 : 1.3),  unit: "mg" },
        { name: "Vitamin B12",            amount: 2.4,                                       unit: "mcg" },
        { name: "Folate",                 amount: 400,                                       unit: "mcg DFE" },
        { name: "Biotin (B7)",            amount: 30,                                        unit: "mcg" },
        { name: "Pantothenic Acid (B5)",  amount: 5,                                         unit: "mg" },
      ],
    },
    {
      label: "Minerals & Fibre",
      items: [
        { name: "Calcium",    amount: (o && !m) || e ? 1200 : 1000,                unit: "mg" },
        { name: "Iron",       amount: m ? 8 : (o ? 8 : 18),                        unit: "mg" },
        { name: "Magnesium",  amount: m ? (age < 31 ? 400 : 420) : (age < 31 ? 310 : 320), unit: "mg" },
        { name: "Zinc",       amount: m ? 11 : 8,                                  unit: "mg" },
        { name: "Potassium",  amount: m ? 3400 : 2600,                             unit: "mg" },
        { name: "Phosphorus", amount: 700,                                          unit: "mg" },
        { name: "Sodium",     amount: 2300,                                         unit: "mg", note: "max" },
        { name: "Selenium",   amount: 55,                                           unit: "mcg" },
        { name: "Iodine",     amount: 150,                                          unit: "mcg" },
        { name: "Copper",     amount: 900,                                          unit: "mcg" },
        { name: "Manganese",  amount: m ? 2.3 : 1.8,                              unit: "mg" },
        { name: "Dietary Fibre", amount: m ? (o ? 30 : 38) : (o ? 21 : 25),      unit: "g" },
      ],
    },
  ];
}

export function NutritionDisplay({ data }: { data: Calculation }) {
  const [expanded, setExpanded] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["Vitamins"]));
  const toggleSection = (label: string) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const microCategories = getMicronutrients(data.age ?? 30, data.gender ?? 'male');

  const chartData = [
    { name: "Protein", value: data.proteinGoal, color: "hsl(var(--chart-1))" },
    { name: "Carbs", value: data.carbsGoal, color: "hsl(var(--chart-2))" },
    { name: "Fat", value: data.fatGoal, color: "hsl(var(--chart-3))" },
  ];

  const totalCal = data.dailyCalories;

  return (
    <div className="space-y-4">
      {/* Nutrition Distribution card */}
      <div className="bg-zinc-900 text-white rounded-3xl shadow-2xl relative overflow-hidden">
        {/* Abstract background flair */}
        <div className="absolute top-[-50%] right-[-10%] w-96 h-96 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold">Nutrition Distribution</h3>
              <p className="text-zinc-400 text-xs mt-0.5">Daily macronutrient targets</p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="text-2xl font-bold">{totalCal}</p>
              <p className="text-zinc-400 text-xs">kcal / day</p>
            </div>
          </div>

          {/* Compact macro row — always visible */}
          <div className="grid grid-cols-3 gap-2">
            {chartData.map((item) => (
              <div key={item.name} className="bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-zinc-400 font-medium">{item.name}</span>
                </div>
                <p className="text-xl font-bold leading-none">{item.value}<span className="text-xs font-normal text-zinc-400 ml-0.5">g</span></p>
                {expanded && (
                  <p className="text-[10px] text-zinc-500 mt-1">{item.value * 7}g / week</p>
                )}
              </div>
            ))}
          </div>

          {/* Expanded: pie chart */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="h-52 mt-4 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
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
                    <span className="text-xs font-semibold text-zinc-400 tracking-widest uppercase">MACROS</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expand / collapse toggle */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="w-full mt-4 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            data-testid="button-nutrition-expand"
          >
            {expanded ? "Show less" : "Show more"}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Health Disclaimer */}
      <p className="text-xs text-zinc-400 leading-relaxed px-1" data-testid="text-health-disclaimer">
        Results are estimates. Consult a qualified healthcare professional before making dietary changes.
      </p>

      {/* Micronutrient Recommendations accordion — only shown when expanded */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-6 pt-5 pb-4">
                <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-zinc-900">Recommended Micronutrients</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Daily reference values based on your age &amp; sex (DRI)</p>
                </div>
              </div>

              {microCategories.map((cat) => {
                const isOpen = openSections.has(cat.label);
                return (
                  <div key={cat.label} className="border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => toggleSection(cat.label)}
                      className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-zinc-50 transition-colors text-left"
                      data-testid={`accordion-${cat.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <span className="text-sm font-semibold text-zinc-700">{cat.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">{cat.items.length} nutrients</span>
                        <ChevronDown
                          className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 pt-1">
                            {cat.items.map((item) => (
                              <div key={item.name} className="flex items-center justify-between py-1 border-b border-zinc-50">
                                <span className="text-xs text-zinc-600">{item.name}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-zinc-900">{item.amount} {item.unit}</span>
                                  {item.note && (
                                    <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                                      {item.note}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              <div className="px-6 py-3 border-t border-zinc-50 bg-zinc-50/50">
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Reference values from the Dietary Reference Intakes (DRI). Individual needs may vary — consult a healthcare professional for personalised guidance.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MealPlanGenerator({ data, onLogMeal }: { data: Calculation; onLogMeal?: (meal: Meal) => void }) {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [planMode, setPlanMode] = useState<'daily' | 'weekly'>('daily');
  const [mealStyle, setMealStyle] = useState<'simple' | 'gourmet' | 'michelin'>('simple');
  const [shoppingDaysOpen, setShoppingDaysOpen] = useState(false);
  const [shoppingDaysInput, setShoppingDaysInput] = useState("7");
  const [planSaved, setPlanSaved] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([toDateStr(new Date())]);
  const [weekStart, setWeekStart] = useState<string>(getMonday(toDateStr(new Date())));
  const [ignoreCycle, setIgnoreCycle] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const prevWeekRef = useRef(weekStart);
  useEffect(() => {
    if (prevWeekRef.current !== weekStart) {
      prevWeekRef.current = weekStart;
      setSelectedDates([weekStart]);
    }
  }, [weekStart]);

  const { data: mealPlanPrefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });
  const hasCycleData = !!(mealPlanPrefs?.cycleTrackingEnabled && mealPlanPrefs?.lastPeriodDate && data.gender === "female");
  const cycleEnabledButMissing = !!(mealPlanPrefs?.cycleTrackingEnabled && !mealPlanPrefs?.lastPeriodDate && data.gender === "female");
  const dailyRef = selectedDates[0] || toDateStr(new Date());
  const cycleInfo = hasCycleData
    ? getCyclePhase(mealPlanPrefs!.lastPeriodDate!, mealPlanPrefs!.cycleLength ?? 28, dailyRef)
    : null;
  const weekCycleInfo = hasCycleData
    ? getCyclePhase(mealPlanPrefs!.lastPeriodDate!, mealPlanPrefs!.cycleLength ?? 28, weekStart)
    : null;

  const generateMealPlan = useMutation({
    mutationFn: async (planType: 'daily' | 'weekly') => {
      const res = await apiRequest('POST', '/api/meal-plans', {
        dailyCalories: data.dailyCalories,
        weeklyCalories: data.weeklyCalories,
        proteinGoal: data.proteinGoal,
        carbsGoal: data.carbsGoal,
        fatGoal: data.fatGoal,
        planType,
        mealStyle,
        calculationId: data.id,
        ...(planType === 'daily' ? { targetDates: selectedDates } : { weekStartDate: weekStart }),
      });
      return await res.json();
    },
    onSuccess: (planData) => {
      setMealPlan(planData);
      setPlanSaved(false);
    },
  });

  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (!mealPlan) throw new Error("No plan to save");
      const planTypeLabel = mealPlan.planType === 'weekly' ? 'Weekly' : 'Daily';
      const dateLabel = mealPlan.planType === 'weekly'
        ? ` (${formatShort(weekStart)} – ${formatShort(addDays(weekStart, 6))})`
        : selectedDates.length === 1
          ? ` (${formatShort(selectedDates[0])})`
          : ` (${formatShort(selectedDates[0])} +${selectedDates.length - 1})`;
      const savePlanData: Record<string, any> = { ...mealPlan };
      if (mealPlanPrefs?.cycleTrackingEnabled && data.gender === "female") {
        savePlanData.cycleOptimised = hasCycleData && !ignoreCycle;
      }
      const res = await apiRequest('POST', '/api/saved-meal-plans', {
        planData: savePlanData,
        planType: mealPlan.planType === 'multi-daily' ? 'daily' : mealPlan.planType,
        mealStyle,
        calculationId: data.id,
        name: `${planTypeLabel} Plan${dateLabel}`,
      });
      return await res.json();
    },
    onSuccess: () => {
      setPlanSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/saved-meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-log"] });
      toast({ title: "Plan saved", description: "Meals added to your food log as planned entries." });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    },
  });

  const replaceMealMutation = useMutation({
    mutationFn: async ({ slot, currentMealName }: { slot: string; currentMealName: string }) => {
      const res = await apiRequest('POST', '/api/meal-plans/replace-meal', {
        slot,
        mealStyle,
        dailyCalories: data.dailyCalories,
        proteinGoal: data.proteinGoal,
        carbsGoal: data.carbsGoal,
        fatGoal: data.fatGoal,
        currentMealName,
      });
      return { slot, meal: await res.json() };
    },
    onError: () => {
      toast({ title: "Replace failed", description: "Could not find an alternative meal. Try again.", variant: "destructive" });
    },
  });

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 sm:p-6">
      {/* Card header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
          <UtensilsCrossed className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-display font-bold text-zinc-900">Meal Planning</h2>
      </div>

      {/* 1. Plan type selector */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Plan Type</p>
        <div className="relative bg-zinc-100 rounded-2xl p-1 flex items-stretch" data-testid="plan-type-toggle">
          <div
            className="absolute top-1 bottom-1 rounded-xl bg-white shadow transition-all duration-300 ease-out"
            style={{ width: `calc((100% - 8px) / 2)`, left: planMode === 'daily' ? '4px' : `calc(4px + (100% - 8px) / 2)` }}
          />
          {([
            { key: 'daily' as const, label: 'Daily' },
            { key: 'weekly' as const, label: 'Weekly' },
          ]).map(opt => (
            <button
              key={opt.key}
              type="button"
              data-testid={`toggle-plan-type-${opt.key}`}
              onClick={() => { setPlanMode(opt.key); setMealPlan(null); }}
              className={`relative z-10 flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                planMode === opt.key ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Meal style selector */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Meal Style</p>
        {(() => {
          const styles = [
            { key: 'simple' as const,  icon: Salad,   label: 'Simple' },
            { key: 'gourmet' as const, icon: ChefHat, label: 'Fancy' },
            { key: 'michelin' as const,icon: Star,    label: 'Michelin' },
          ];
          const idx = styles.findIndex(s => s.key === mealStyle);
          const descriptions: Record<string, string> = {
            simple:  'Quick, clean meals — ideal for busy weeks.',
            gourmet: 'Bold flavours and restaurant-style dishes.',
            michelin:'Fine-dining tasting menus — truffle, Wagyu and more.',
          };
          return (
            <>
              <div className="relative bg-zinc-100 rounded-2xl p-1 flex items-stretch" data-testid="meal-style-scale">
                <div
                  className="absolute top-1 bottom-1 rounded-xl bg-white shadow transition-all duration-300 ease-out"
                  style={{ width: `calc((100% - 8px) / 3)`, left: `calc(4px + ${idx} * (100% - 8px) / 3)` }}
                />
                {styles.map((style) => (
                  <button
                    key={style.key}
                    type="button"
                    data-testid={`toggle-meal-style-${style.key}`}
                    onClick={() => { setMealStyle(style.key); setMealPlan(null); }}
                    className={`relative z-10 flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-semibold transition-colors duration-200 ${
                      mealStyle === style.key ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    <style.icon className="w-4 h-4" />
                    <span>{style.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-2">{descriptions[mealStyle]}</p>
            </>
          );
        })()}
      </div>

      {/* 3. Date range picker (always visible) */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Schedule</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(prev => addDays(prev, -7))}
            className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-500"
            data-testid="button-week-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-zinc-700 min-w-[120px] text-center" data-testid="text-week-label">
            {formatShort(weekStart)} – {formatShort(addDays(weekStart, 6))}
          </span>
          <button
            onClick={() => setWeekStart(prev => addDays(prev, 7))}
            className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-500"
            data-testid="button-week-next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4. Day chips (daily mode only) */}
      {planMode === 'daily' && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Days</p>
          <div className="flex gap-1.5 flex-wrap">
            {DAY_LABELS.map((label, i) => {
              const dateStr = addDays(weekStart, i);
              const isSelected = selectedDates.includes(dateStr);
              return (
                <button
                  key={dateStr}
                  type="button"
                  data-testid={`chip-day-${label.toLowerCase()}`}
                  onClick={() => {
                    setSelectedDates(prev =>
                      isSelected
                        ? prev.filter(d => d !== dateStr).length > 0 ? prev.filter(d => d !== dateStr) : prev
                        : [...prev, dateStr].sort()
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cycle data missing callout */}
      {cycleEnabledButMissing && !ignoreCycle && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 mb-4" data-testid="callout-cycle-missing">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-800">
              Cycle tracking is on, but your last period date isn't set — plans won't be cycle-optimised.
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("cycle-tracker-widget");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="text-[11px] font-medium text-amber-800 hover:text-amber-950 underline underline-offset-2 transition-colors"
                data-testid="link-go-to-cycle-tracker"
              >
                Go to Cycle Tracker
              </button>
              <span className="text-amber-300">|</span>
              <button
                type="button"
                onClick={() => setIgnoreCycle(true)}
                className="text-[11px] font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
                data-testid="button-ignore-cycle"
              >
                Ignore cycle tracking for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cycle phase banners */}
      {planMode === 'daily' && cycleInfo && (
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-4 ${cycleInfo.bgClass} ${cycleInfo.borderClass}`}>
          <Circle className={`w-3.5 h-3.5 flex-shrink-0 ${cycleInfo.colorClass}`} />
          <p className={`text-xs font-medium ${cycleInfo.textClass}`}>
            {cycleInfo.name} phase · Day {cycleInfo.day} · {cycleInfo.shortTip}
          </p>
        </div>
      )}
      {planMode === 'weekly' && weekCycleInfo && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-4 ${weekCycleInfo.bgClass} ${weekCycleInfo.borderClass}`}>
          <Circle className={`w-3 h-3 flex-shrink-0 ${weekCycleInfo.colorClass}`} />
          <p className={`text-xs ${weekCycleInfo.textClass}`}>
            {weekCycleInfo.name} phase from {formatShort(weekStart)} · {weekCycleInfo.shortTip}
          </p>
        </div>
      )}

      {/* Create Plan button */}
      <button
        onClick={() => generateMealPlan.mutate(planMode)}
        disabled={generateMealPlan.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-sm transition-colors"
        data-testid="button-create-plan"
      >
        {generateMealPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UtensilsCrossed className="w-4 h-4" />}
        Create Plan
      </button>

      {/* Generated meal plan */}
      {mealPlan && (
        <div className="mt-6 pt-6 border-t border-zinc-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-display font-bold text-zinc-900 capitalize">
                {mealPlan.planType === 'multi-daily' ? 'Multi-Day' : mealPlan.planType} Meal Plan
              </h3>
              {mealPlan.planType === 'weekly' && (mealPlan as any).weekStartDate && (
                <p className="text-xs text-zinc-400 mt-0.5">
                  <CalendarDays className="w-3 h-3 inline mr-1" />
                  {formatShort((mealPlan as any).weekStartDate)} – {formatShort(addDays((mealPlan as any).weekStartDate, 6))}
                </p>
              )}
              {(mealPlan.planType === 'daily' || mealPlan.planType === 'multi-daily') && selectedDates.length > 0 && (
                <p className="text-xs text-zinc-400 mt-0.5">
                  <CalendarDays className="w-3 h-3 inline mr-1" />
                  {selectedDates.length === 1
                    ? formatShort(selectedDates[0])
                    : `${formatShort(selectedDates[0])} + ${selectedDates.length - 1} more`}
                </p>
              )}
            </div>
            <button
              onClick={() => savePlanMutation.mutate()}
              disabled={savePlanMutation.isPending || planSaved}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                planSaved
                  ? "bg-zinc-100 text-zinc-600 border border-zinc-200 cursor-default"
                  : "bg-zinc-900 hover:bg-zinc-700 text-white"
              }`}
              data-testid="button-save-plan"
            >
              {savePlanMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : planSaved ? (
                <><Check className="w-4 h-4" /> Saved</>
              ) : (
                <><Save className="w-4 h-4" /> Save Plan</>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => {
                if (mealPlan.planType === 'daily') {
                  setShoppingDaysOpen(true);
                } else {
                  exportShoppingListToPDF(mealPlan, data);
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors"
              data-testid="button-export-shopping-list"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Shopping List
            </button>
            <button
              onClick={() => exportMealPlanToPDF(mealPlan, data)}
              className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl font-medium text-xs transition-colors"
              data-testid="button-export-pdf"
            >
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </button>
          </div>

          {mealPlan.planType === 'multi-daily' ? (
            <div className="space-y-6">
              {(mealPlan as any).targetDates?.map((dateStr: string) => {
                const dayPlan = (mealPlan as any).days?.[dateStr];
                if (!dayPlan) return null;
                const [y, m, d] = dateStr.split("-").map(Number);
                const dateLabel = new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                return (
                  <div key={dateStr}>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {dateLabel}
                    </p>
                    <DailyMealView
                      plan={{ ...dayPlan, planType: 'daily' }}
                      onLogMeal={onLogMeal}
                      onReplace={(slot, mealName, idx) => {
                        replaceMealMutation.mutate({ slot, currentMealName: mealName }, {
                          onSuccess: ({ slot: s, meal: newMeal }) => {
                            setMealPlan((prev: any) => {
                              if (!prev) return prev;
                              const key = s === 'snack' ? 'snacks' : s;
                              const updatedDay = { ...prev.days[dateStr] };
                              const arr = [...(updatedDay[key] || [])];
                              arr[idx] = newMeal;
                              updatedDay[key] = arr;
                              const allMeals = [...updatedDay.breakfast, ...updatedDay.lunch, ...updatedDay.dinner, ...updatedDay.snacks];
                              updatedDay.dayTotalCalories = allMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
                              return { ...prev, days: { ...prev.days, [dateStr]: updatedDay } };
                            });
                            setPlanSaved(false);
                          },
                        });
                      }}
                      replacingSlot={replaceMealMutation.isPending ? replaceMealMutation.variables?.slot : undefined}
                    />
                  </div>
                );
              })}
            </div>
          ) : mealPlan.planType === 'daily' ? (
            <DailyMealView
              plan={mealPlan}
              onLogMeal={onLogMeal}
              onReplace={(slot, mealName, idx) => {
                replaceMealMutation.mutate({ slot, currentMealName: mealName }, {
                  onSuccess: ({ slot: s, meal: newMeal }) => {
                    setMealPlan((prev: any) => {
                      if (!prev) return prev;
                      const key = s === 'snack' ? 'snacks' : s;
                      const updated = { ...prev };
                      const arr = [...(updated[key] || [])];
                      arr[idx] = newMeal;
                      updated[key] = arr;
                      const allMeals = [...updated.breakfast, ...updated.lunch, ...updated.dinner, ...updated.snacks];
                      updated.dayTotalCalories = allMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
                      updated.dayTotalProtein = allMeals.reduce((sum: number, m: any) => sum + m.protein, 0);
                      updated.dayTotalCarbs = allMeals.reduce((sum: number, m: any) => sum + m.carbs, 0);
                      updated.dayTotalFat = allMeals.reduce((sum: number, m: any) => sum + m.fat, 0);
                      return updated;
                    });
                    setPlanSaved(false);
                  },
                });
              }}
              replacingSlot={replaceMealMutation.isPending ? replaceMealMutation.variables?.slot : undefined}
            />
          ) : (
            <WeeklyMealView
              plan={mealPlan}
              onLogMeal={onLogMeal}
              onReplace={(day, slot, mealName, idx) => {
                replaceMealMutation.mutate({ slot, currentMealName: mealName }, {
                  onSuccess: ({ slot: s, meal: newMeal }) => {
                    setMealPlan((prev: any) => {
                      if (!prev) return prev;
                      const updated = { ...prev };
                      const dayPlan = { ...updated[day] };
                      const key = s === 'snack' ? 'snacks' : s;
                      const arr = [...(dayPlan[key] || [])];
                      arr[idx] = newMeal;
                      dayPlan[key] = arr;
                      const allDayMeals = [...dayPlan.breakfast, ...dayPlan.lunch, ...dayPlan.dinner, ...dayPlan.snacks];
                      dayPlan.dayTotalCalories = allDayMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
                      dayPlan.dayTotalProtein = allDayMeals.reduce((sum: number, m: any) => sum + m.protein, 0);
                      dayPlan.dayTotalCarbs = allDayMeals.reduce((sum: number, m: any) => sum + m.carbs, 0);
                      dayPlan.dayTotalFat = allDayMeals.reduce((sum: number, m: any) => sum + m.fat, 0);
                      updated[day] = dayPlan;
                      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                      updated.weekTotalCalories = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalCalories || 0), 0);
                      updated.weekTotalProtein = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalProtein || 0), 0);
                      updated.weekTotalCarbs = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalCarbs || 0), 0);
                      updated.weekTotalFat = days.reduce((sum: number, d: string) => sum + (updated[d]?.dayTotalFat || 0), 0);
                      return updated;
                    });
                    setPlanSaved(false);
                  },
                });
              }}
              replacingSlot={replaceMealMutation.isPending ? replaceMealMutation.variables?.slot : undefined}
            />
          )}
        </div>
      )}

      {/* Shopping days dialog — daily plans only */}
      {shoppingDaysOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-display font-bold text-zinc-900">Shopping List</h3>
            </div>
            <p className="text-sm text-zinc-500 mb-5 mt-1">
              How many days are you shopping for? Ingredient quantities will be scaled accordingly.
            </p>
            <div className="mb-5">
              <label className="block text-sm font-medium text-zinc-700 mb-2">Number of days</label>
              <input
                type="number"
                min="1"
                max="30"
                value={shoppingDaysInput}
                onChange={e => setShoppingDaysInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const d = Math.max(1, parseInt(shoppingDaysInput) || 1);
                    setShoppingDaysOpen(false);
                    exportShoppingListToPDF(mealPlan!, data, d);
                  }
                }}
                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
                data-testid="input-shopping-days"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShoppingDaysOpen(false)}
                className="flex-1 px-4 py-2.5 border border-zinc-200 text-zinc-700 rounded-xl font-medium text-sm hover:bg-zinc-50 transition-colors"
                data-testid="button-shopping-days-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const d = Math.max(1, parseInt(shoppingDaysInput) || 1);
                  setShoppingDaysOpen(false);
                  exportShoppingListToPDF(mealPlan!, data, d);
                }}
                className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-medium text-sm transition-colors"
                data-testid="button-shopping-days-confirm"
              >
                Generate PDF
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function DailyMealView({ plan, onReplace, replacingSlot, onLogMeal }: { plan: any; onReplace?: (slot: string, mealName: string, idx: number) => void; replacingSlot?: string; onLogMeal?: (meal: Meal) => void }) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [localDisliked, setLocalDisliked] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });
  const serverDisliked = new Set((prefs?.dislikedMeals ?? []).map(m => m.toLowerCase()));

  const isDisliked = (name: string) => localDisliked.has(name.toLowerCase()) || serverDisliked.has(name.toLowerCase());

  const dislikeMutation = useMutation({
    mutationFn: (mealName: string) => {
      setLocalDisliked(prev => new Set(Array.from(prev).concat(mealName.toLowerCase())));
      return apiRequest("POST", "/api/preferences/disliked-meals", { mealName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Meal disliked", description: "It won't appear in future generated plans." });
    },
    onError: (_err, mealName) => {
      setLocalDisliked(prev => { const s = new Set(prev); s.delete(mealName.toLowerCase()); return s; });
      toast({ title: "Sign in to dislike meals", variant: "destructive" });
    },
  });

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

      {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map(mealType => {
        const slotKey = mealType === 'snacks' ? 'snack' : mealType;
        return (
          <div key={mealType} className="mb-6">
            <h4 className="text-lg font-semibold text-zinc-900 capitalize mb-3">{mealType}</h4>
            <div className="space-y-2">
              {plan[mealType]?.map((meal: Meal, idx: number) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedMeal(meal)}
                    className="flex-1 flex justify-between p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors text-left cursor-pointer border border-transparent hover:border-zinc-200"
                    data-testid={`meal-card-${slotKey}-${idx}`}
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
                  {onLogMeal && (
                    <button
                      onClick={() => onLogMeal(meal)}
                      className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors shrink-0"
                      title="Log this meal"
                      data-testid={`button-log-${slotKey}-${idx}`}
                    >
                      <ClipboardList className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { if (!isDisliked(meal.meal)) dislikeMutation.mutate(meal.meal); }}
                    className={`p-2 rounded-lg transition-colors shrink-0 ${isDisliked(meal.meal) ? 'bg-red-50 text-red-500 cursor-default' : 'bg-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-500'}`}
                    title={isDisliked(meal.meal) ? "Disliked" : "Dislike this meal"}
                    data-testid={`button-dislike-${slotKey}-${idx}`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                  {onReplace && (
                    <button
                      onClick={() => onReplace(slotKey, meal.meal, idx)}
                      disabled={replacingSlot === slotKey}
                      className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 rounded-lg transition-colors shrink-0"
                      title="Replace meal"
                      data-testid={`button-replace-${slotKey}-${idx}`}
                    >
                      {replacingSlot === slotKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {selectedMeal && (
        <RecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </>
  );
}

function WeeklyMealView({ plan, onReplace, replacingSlot, onLogMeal }: { plan: any; onReplace?: (day: string, slot: string, mealName: string, idx: number) => void; replacingSlot?: string; onLogMeal?: (meal: Meal) => void }) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [localDisliked, setLocalDisliked] = useState<Set<string>>(new Set());

  const toggleDay = (day: string) =>
    setExpandedDays(prev => { const s = new Set(prev); s.has(day) ? s.delete(day) : s.add(day); return s; });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<UserPreferences>({ queryKey: ["/api/user/preferences"] });
  const serverDisliked = new Set((prefs?.dislikedMeals ?? []).map(m => m.toLowerCase()));

  const isDisliked = (name: string) => localDisliked.has(name.toLowerCase()) || serverDisliked.has(name.toLowerCase());

  const dislikeMutation = useMutation({
    mutationFn: (mealName: string) => {
      setLocalDisliked(prev => new Set(Array.from(prev).concat(mealName.toLowerCase())));
      return apiRequest("POST", "/api/preferences/disliked-meals", { mealName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Meal disliked", description: "It won't appear in future generated plans." });
    },
    onError: (_err, mealName) => {
      setLocalDisliked(prev => { const s = new Set(prev); s.delete(mealName.toLowerCase()); return s; });
      toast({ title: "Sign in to dislike meals", variant: "destructive" });
    },
  });

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
        const isOpen = expandedDays.has(day);

        return (
          <div key={day} className="mb-3 bg-zinc-50 rounded-2xl overflow-hidden">
            <button
              onClick={() => toggleDay(day)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-100 transition-colors text-left"
              data-testid={`button-day-${day}`}
            >
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-bold text-zinc-900 capitalize">{day}</h4>
                <span className="text-xs text-zinc-500">{dayPlan.dayTotalCalories} kcal · P {dayPlan.dayTotalProtein}g · C {dayPlan.dayTotalCarbs}g · F {dayPlan.dayTotalFat}g</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 pt-1">
                    {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map(mealType => {
                      const slotKey = mealType === 'snacks' ? 'snack' : mealType;
                      return (
                        <div key={mealType} className="mb-3">
                          <h5 className="text-sm font-semibold text-zinc-700 capitalize mb-2">{mealType}</h5>
                          <div className="space-y-1">
                            {dayPlan[mealType]?.map((meal: Meal, idx: number) => (
                              <div key={idx} className="flex items-center gap-1">
                                <button
                                  onClick={() => setSelectedMeal(meal)}
                                  className="flex-1 flex justify-between p-2 bg-white rounded hover:bg-zinc-100 transition-colors text-left cursor-pointer border border-transparent hover:border-zinc-200"
                                  data-testid={`meal-card-${day}-${slotKey}-${idx}`}
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
                                {onLogMeal && (
                                  <button
                                    onClick={() => onLogMeal(meal)}
                                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                                    title="Log this meal"
                                    data-testid={`button-log-${day}-${slotKey}-${idx}`}
                                  >
                                    <ClipboardList className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => { if (!isDisliked(meal.meal)) dislikeMutation.mutate(meal.meal); }}
                                  className={`p-1.5 rounded transition-colors shrink-0 ${isDisliked(meal.meal) ? 'bg-red-50 text-red-500 cursor-default' : 'bg-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-500'}`}
                                  title={isDisliked(meal.meal) ? "Disliked" : "Dislike this meal"}
                                  data-testid={`button-dislike-${day}-${slotKey}-${idx}`}
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>
                                {onReplace && (
                                  <button
                                    onClick={() => onReplace(day, slotKey, meal.meal, idx)}
                                    disabled={replacingSlot === slotKey}
                                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 rounded transition-colors shrink-0"
                                    title="Replace meal"
                                    data-testid={`button-replace-${day}-${slotKey}-${idx}`}
                                  >
                                    {replacingSlot === slotKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
            className="mt-4 w-full px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
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
          className="w-full px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}
