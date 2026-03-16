import type { Calculation } from "@shared/schema";
import { RECIPES } from "./results-recipes";

type jsPDFType = import("jspdf").default;

async function loadJsPDF(): Promise<typeof import("jspdf").default> {
  const mod = await import("jspdf");
  return mod.default;
}

const GOAL_LABELS: Record<string, string> = {
  fat_loss: "Fat Loss",
  tone: "Tone & Define",
  maintain: "Maintain & Balance",
  muscle: "Build Muscle",
  bulk: "Bulk Up",
  lose: "Lose Weight",
  gain: "Gain Weight",
};

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateStr(dt);
}

export function getMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  dt.setDate(dt.getDate() - ((dow + 6) % 7));
  return toDateStr(dt);
}

export function formatShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function drawPDFLogo(doc: jsPDFType, pageW: number) {
  const sqX = pageW - 56;
  const sqY = 10;
  const sqSize = 8;
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(sqX, sqY, sqSize, sqSize, 1.5, 1.5, "F");

  doc.setFillColor(255, 255, 255);
  doc.circle(sqX + sqSize / 2, sqY + sqSize / 2, 1.8, "F");

  const handleW = 0.8;
  const cx = sqX + sqSize / 2;
  const circleTop = sqY + sqSize / 2 - 1.8;
  doc.setFillColor(255, 255, 255);
  doc.rect(cx - handleW / 2, sqY, handleW, circleTop - sqY, "F");

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("FuelU", sqX + sqSize + 2.5, sqY + 6);
}

export async function exportMealPlanToPDF(mealPlan: any, data: Calculation) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  const newLine = (gap = 6) => { y += gap; };
  const checkPage = (needed = 20) => {
    if (y + needed > 280) { doc.addPage(); y = 20; }
  };

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

  const slots = ["breakfast", "lunch", "dinner", "snacks"] as const;

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

  const uniqueMealNames: string[] = [];
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

  const recipeMeals = uniqueMealNames.filter(name => (RECIPES as any)[name]);

  if (recipeMeals.length > 0) {
    doc.addPage();
    y = 20;

    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Recipes", 14, 12.5);
    y = 26;

    recipeMeals.forEach((mealName, idx) => {
      const recipe = (RECIPES as any)[mealName] as { ingredients: Array<{ item: string; quantity: string }>; instructions: string };

      const ingRowCount = Math.ceil(recipe.ingredients.length / 2);
      const instrLines = doc.splitTextToSize(recipe.instructions, pageW - 28).length;
      const estimatedH = 12 + ingRowCount * 6 + instrLines * 5 + 16;
      checkPage(Math.min(estimatedH, 60));

      if (idx > 0) {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(14, y, pageW - 14, y);
        y += 6;
      }

      checkPage(14);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 24, 27);
      const nameLines = doc.splitTextToSize(mealName, pageW - 28);
      doc.text(nameLines, 14, y);
      y += nameLines.length * 6 + 3;

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

      checkPage(10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("Ingredients", 14, y);
      y += 5;

      const ingColW = (pageW - 28) / 2;
      let leftY = y;
      let rightY = y;
      recipe.ingredients.forEach((ing, i) => {
        const col = i % 2;
        const xBase = col === 0 ? 14 : 14 + ingColW + 4;
        const curY = col === 0 ? leftY : rightY;
        checkPage(7);

        doc.setFillColor(160, 160, 160);
        doc.circle(xBase + 1.2, curY - 1.2, 0.8, "F");

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 40);
        const itemLines = doc.splitTextToSize(ing.item, ingColW - 36);
        doc.text(itemLines, xBase + 4, curY);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(80, 80, 80);
        doc.text(ing.quantity, xBase + ingColW - 2, curY, { align: "right" });

        const rowH = itemLines.length > 1 ? itemLines.length * 4.5 : 5.5;
        if (col === 0) leftY += rowH;
        else rightY += rowH;
      });
      y = Math.max(leftY, rightY) + 4;

      checkPage(10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("Method", 14, y);
      y += 5;

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
  return existing;
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

  if (multiplier !== 1) {
    map.forEach(entry => {
      entry.quantity = scaleQuantity(entry.quantity, multiplier);
    });
  }

  const grouped: Record<string, Array<{ item: string; quantity: string }>> = {};
  map.forEach(({ category, item, quantity }) => {
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push({ item, quantity });
  });
  Object.values(grouped).forEach(arr => arr.sort((a, b) => a.item.localeCompare(b.item)));
  return grouped;
}

export const CATEGORY_ORDER = ["Protein", "Produce", "Grains & Carbs", "Dairy", "Pantry & Spices", "Other"];

export async function exportShoppingListToPDF(mealPlan: any, data: Calculation, days = 1) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  const newLine = (gap = 6) => { y += gap; };
  const checkPage = (needed = 14) => { if (y + needed > 280) { doc.addPage(); y = 20; } };

  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
  doc.text("Shopping List", 14, 12);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 180, 180);
  const planLabel = mealPlan.planType === "weekly" ? "Weekly" : `Daily · ${days} day${days !== 1 ? 's' : ''}`;
  doc.text(`${planLabel} Meal Plan  ·  Generated ${new Date().toLocaleDateString()}`, 14, 22);
  drawPDFLogo(doc, pageW);
  y = 38;

  doc.setFontSize(9); doc.setFont("helvetica", "italic"); doc.setTextColor(120, 120, 120);
  const noteText = mealPlan.planType === "daily" && days > 1
    ? `Quantities scaled for ${days} days. Add staples you already have at home.`
    : "Quantities are combined across all meals. Add staples you already have at home.";
  doc.text(noteText, 14, y);
  y += 12;

  const grouped = buildShoppingList(mealPlan, mealPlan.planType === "daily" ? days : 1);
  const categoryOrder = CATEGORY_ORDER.filter(c => grouped[c]);
  Object.keys(grouped).forEach(c => { if (!categoryOrder.includes(c)) categoryOrder.push(c); });

  const colW = (pageW - 28) / 2;
  const categories = categoryOrder;

  categories.forEach(category => {
    const items = grouped[category];
    if (!items?.length) return;
    checkPage(20);

    doc.setFillColor(24, 24, 27);
    doc.roundedRect(14, y, pageW - 28, 9, 2, 2, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(category.toUpperCase(), 18, y + 6.2);
    y += 13;

    let leftY = y;
    let rightY = y;
    items.forEach((entry, i) => {
      const col = i % 2;
      const xBase = col === 0 ? 14 : 14 + colW + 4;
      const curY  = col === 0 ? leftY : rightY;
      checkPage(10);

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.roundedRect(xBase, curY - 3.5, 4, 4, 0.8, 0.8);

      doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30);
      const label = doc.splitTextToSize(entry.item, colW - 32);
      doc.text(label, xBase + 6, curY);

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
