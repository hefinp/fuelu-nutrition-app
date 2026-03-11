import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, mealPlanSchema } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { registerSchema, loginSchema, userPreferencesSchema, type UserPreferences } from "@shared/schema";
import passport from "passport";

const MEAL_DATABASE = {
  breakfast: [
    { meal: "Scrambled eggs (3) with whole grain toast", calories: 380, protein: 28, carbs: 26, fat: 16 },
    { meal: "Oatmeal with berries and almonds", calories: 340, protein: 14, carbs: 46, fat: 10 },
    { meal: "Greek yogurt with granola and honey", calories: 360, protein: 22, carbs: 44, fat: 8 },
    { meal: "Egg white omelette with spinach and feta", calories: 340, protein: 32, carbs: 12, fat: 16 },
    { meal: "Protein smoothie with oats and almond butter", calories: 400, protein: 30, carbs: 42, fat: 12 },
    { meal: "Cottage cheese with berries and flaxseed", calories: 300, protein: 26, carbs: 28, fat: 8 },
    { meal: "Smoked salmon with eggs and rye toast", calories: 420, protein: 34, carbs: 24, fat: 18 },
    { meal: "Chia seed pudding with coconut milk and nuts", calories: 360, protein: 14, carbs: 34, fat: 18 },
    { meal: "Banana and peanut butter overnight oats", calories: 370, protein: 14, carbs: 56, fat: 10 },
    { meal: "Mixed berry smoothie bowl with hemp seeds and granola", calories: 340, protein: 12, carbs: 52, fat: 10 },
    { meal: "Tofu scramble with peppers, onion and spinach", calories: 320, protein: 24, carbs: 18, fat: 14 },
    { meal: "Fruit and nut muesli with oat milk", calories: 350, protein: 12, carbs: 50, fat: 10 },
  ],
  lunch: [
    { meal: "Grilled chicken breast with brown rice and broccoli", calories: 500, protein: 46, carbs: 44, fat: 10 },
    { meal: "Turkey and avocado salad with olive oil dressing", calories: 460, protein: 36, carbs: 24, fat: 22 },
    { meal: "Tuna salad with olive oil dressing", calories: 400, protein: 38, carbs: 20, fat: 16 },
    { meal: "Quinoa bowl with chickpeas and vegetables", calories: 440, protein: 22, carbs: 56, fat: 12 },
    { meal: "Salmon with sweet potato and asparagus", calories: 520, protein: 42, carbs: 44, fat: 18 },
    { meal: "Beef and brown rice bowl with mixed vegetables", calories: 540, protein: 42, carbs: 52, fat: 14 },
    { meal: "Chicken Caesar salad with whole grain croutons", calories: 460, protein: 40, carbs: 28, fat: 18 },
    { meal: "Lean turkey mince bowl with quinoa and greens", calories: 480, protein: 44, carbs: 36, fat: 14 },
    { meal: "Lentil and roasted vegetable bowl with tahini dressing", calories: 450, protein: 20, carbs: 58, fat: 12 },
    { meal: "Black bean and roasted pepper burrito bowl with guacamole", calories: 470, protein: 18, carbs: 60, fat: 16 },
    { meal: "Chickpea and sweet potato bowl with spinach and lime", calories: 440, protein: 18, carbs: 62, fat: 10 },
  ],
  dinner: [
    { meal: "Baked chicken with roasted vegetables and sweet potato", calories: 580, protein: 46, carbs: 52, fat: 14 },
    { meal: "Lean beef with mashed potatoes and green beans", calories: 620, protein: 48, carbs: 54, fat: 18 },
    { meal: "Grilled salmon with wild rice and vegetables", calories: 560, protein: 46, carbs: 48, fat: 16 },
    { meal: "Pork tenderloin with sweet potato and spinach", calories: 560, protein: 44, carbs: 52, fat: 14 },
    { meal: "Turkey meatballs with wholemeal spaghetti and marinara", calories: 560, protein: 44, carbs: 58, fat: 12 },
    { meal: "Chicken fajitas with brown rice and black beans", calories: 580, protein: 44, carbs: 62, fat: 12 },
    { meal: "Grilled white fish with quinoa and roasted vegetables", calories: 520, protein: 46, carbs: 46, fat: 12 },
    { meal: "Lean lamb stir-fry with brown rice and bok choy", calories: 600, protein: 46, carbs: 54, fat: 18 },
    { meal: "Chickpea and spinach curry with basmati rice", calories: 540, protein: 22, carbs: 76, fat: 12 },
    { meal: "Lentil dahl with brown rice and wilted spinach", calories: 520, protein: 24, carbs: 78, fat: 8 },
    { meal: "Tofu and vegetable stir-fry with brown rice", calories: 500, protein: 26, carbs: 64, fat: 14 },
    { meal: "Roasted vegetable and quinoa bowl with tahini", calories: 510, protein: 20, carbs: 68, fat: 16 },
  ],
  snack: [
    { meal: "Protein bar and apple", calories: 260, protein: 22, carbs: 28, fat: 6 },
    { meal: "Greek yogurt with granola", calories: 220, protein: 18, carbs: 24, fat: 6 },
    { meal: "Trail mix and banana", calories: 280, protein: 10, carbs: 38, fat: 10 },
    { meal: "Cottage cheese with berries", calories: 200, protein: 20, carbs: 18, fat: 4 },
    { meal: "Peanut butter and whole grain crackers", calories: 260, protein: 12, carbs: 24, fat: 14 },
    { meal: "Hard-boiled eggs and almonds", calories: 220, protein: 18, carbs: 6, fat: 14 },
    { meal: "Tuna on rice cakes", calories: 200, protein: 22, carbs: 18, fat: 4 },
    { meal: "Edamame with sea salt", calories: 200, protein: 18, carbs: 14, fat: 8 },
    { meal: "Apple slices with sunflower seed butter", calories: 210, protein: 6, carbs: 30, fat: 10 },
    { meal: "Rice cakes with avocado and cherry tomatoes", calories: 200, protein: 4, carbs: 26, fat: 10 },
    { meal: "Roasted chickpeas with spices", calories: 220, protein: 10, carbs: 30, fat: 6 },
  ],
};

const GOURMET_MEAL_DATABASE = {
  breakfast: [
    { meal: "Shakshuka with poached eggs and crusty sourdough", calories: 420, protein: 28, carbs: 38, fat: 18 },
    { meal: "Avocado toast with poached eggs and everything bagel seasoning", calories: 400, protein: 24, carbs: 34, fat: 20 },
    { meal: "Smoked salmon bagel with cream cheese, capers and dill", calories: 440, protein: 32, carbs: 36, fat: 18 },
    { meal: "Bircher muesli with apple, toasted hazelnuts and pomegranate", calories: 380, protein: 16, carbs: 54, fat: 12 },
    { meal: "Savory crepes with goat cheese, spinach and sun-dried tomatoes", calories: 420, protein: 26, carbs: 36, fat: 18 },
    { meal: "Eggs Benedict with Canadian bacon and light hollandaise", calories: 460, protein: 32, carbs: 32, fat: 22 },
    { meal: "Coconut overnight oats with mango, lime and toasted coconut", calories: 380, protein: 14, carbs: 56, fat: 12 },
    { meal: "Huevos rancheros with black beans and pico de gallo", calories: 440, protein: 28, carbs: 44, fat: 16 },
    { meal: "Acai smoothie bowl with mixed berries, banana and coconut flakes", calories: 370, protein: 10, carbs: 60, fat: 10 },
    { meal: "Roasted tomato and lentil shakshuka with charred flatbread", calories: 400, protein: 20, carbs: 52, fat: 12 },
    { meal: "Sweet potato and black bean breakfast hash with avocado", calories: 390, protein: 14, carbs: 56, fat: 14 },
  ],
  lunch: [
    { meal: "Chicken shawarma bowl with hummus, tabbouleh and flatbread", calories: 540, protein: 44, carbs: 52, fat: 14 },
    { meal: "Pan-seared tuna nicoise with green beans and soft-boiled egg", calories: 480, protein: 42, carbs: 28, fat: 22 },
    { meal: "Thai beef salad with glass noodles, mint and chilli-lime dressing", calories: 460, protein: 36, carbs: 38, fat: 16 },
    { meal: "Mediterranean stuffed peppers with couscous and feta", calories: 440, protein: 22, carbs: 54, fat: 14 },
    { meal: "Prawn and avocado salad with lime, chilli and mixed grains", calories: 460, protein: 36, carbs: 38, fat: 16 },
    { meal: "Chicken souvlaki wrap with tzatziki and roasted vegetables", calories: 500, protein: 42, carbs: 44, fat: 14 },
    { meal: "Spiced chickpea and spinach curry with basmati rice", calories: 480, protein: 22, carbs: 64, fat: 12 },
    { meal: "Roasted red pepper and lentil soup with sourdough", calories: 420, protein: 20, carbs: 58, fat: 10 },
    { meal: "Moroccan roasted vegetable and chickpea bowl with chermoula", calories: 460, protein: 18, carbs: 64, fat: 14 },
    { meal: "Vietnamese-style tofu and glass noodle salad with lime dressing", calories: 420, protein: 20, carbs: 54, fat: 12 },
  ],
  dinner: [
    { meal: "Herb-crusted salmon with lemon risotto and asparagus", calories: 600, protein: 46, carbs: 56, fat: 18 },
    { meal: "Moroccan lamb tagine with apricots, couscous and harissa", calories: 620, protein: 46, carbs: 60, fat: 18 },
    { meal: "Thai green chicken curry with jasmine rice and bok choy", calories: 580, protein: 44, carbs: 58, fat: 16 },
    { meal: "Seared duck breast with sweet potato puree and cherry jus", calories: 600, protein: 44, carbs: 52, fat: 20 },
    { meal: "Pan-seared sea bass with chorizo, white beans and gremolata", calories: 560, protein: 46, carbs: 42, fat: 20 },
    { meal: "Miso-glazed cod with edamame fried rice and pickled ginger", calories: 560, protein: 46, carbs: 52, fat: 14 },
    { meal: "Chicken piccata with capers, lemon butter sauce and linguine", calories: 580, protein: 46, carbs: 54, fat: 16 },
    { meal: "Beef tenderloin with dauphinoise potato and green peppercorn sauce", calories: 640, protein: 48, carbs: 48, fat: 24 },
    { meal: "Moroccan vegetable tagine with couscous, preserved lemon and harissa", calories: 540, protein: 16, carbs: 80, fat: 14 },
    { meal: "Butternut squash and chickpea coconut curry with jasmine rice", calories: 560, protein: 18, carbs: 82, fat: 16 },
    { meal: "Roasted aubergine with pomegranate, walnut sauce and lentil rice", calories: 520, protein: 18, carbs: 72, fat: 16 },
  ],
  snack: [
    { meal: "Baba ganoush with toasted pita and cucumber", calories: 240, protein: 8, carbs: 30, fat: 10 },
    { meal: "Whipped ricotta with honey, walnuts and pomegranate", calories: 260, protein: 14, carbs: 24, fat: 14 },
    { meal: "Smoked salmon and cream cheese on rye crispbreads", calories: 220, protein: 18, carbs: 16, fat: 10 },
    { meal: "Roasted spiced chickpeas with tahini dip", calories: 240, protein: 12, carbs: 28, fat: 10 },
    { meal: "Caprese skewers with fresh mozzarella and basil pesto", calories: 240, protein: 14, carbs: 8, fat: 18 },
    { meal: "Prosciutto-wrapped melon with rocket", calories: 200, protein: 14, carbs: 20, fat: 6 },
    { meal: "Nut butter energy balls with oats, dates and dark chocolate", calories: 280, protein: 10, carbs: 34, fat: 12 },
    { meal: "Tuna tartare on cucumber rounds with sesame and soy", calories: 200, protein: 22, carbs: 10, fat: 8 },
    { meal: "Sliced avocado with lime, chilli flakes and sesame rice cakes", calories: 220, protein: 4, carbs: 24, fat: 14 },
    { meal: "Spiced roasted chickpeas with pomegranate molasses", calories: 230, protein: 10, carbs: 32, fat: 6 },
  ],
};

const MICHELIN_MEAL_DATABASE = {
  breakfast: [
    { meal: "Croque Madame with Gruyère, smoked ham and fried egg", calories: 480, protein: 32, carbs: 30, fat: 24 },
    { meal: "Slow scrambled eggs with crème fraîche, chives and smoked trout on rye", calories: 420, protein: 34, carbs: 24, fat: 20 },
    { meal: "Ricotta pancakes with blueberry compote and lemon curd", calories: 460, protein: 20, carbs: 56, fat: 16 },
    { meal: "Brioche French toast with mascarpone, caramelised banana and maple syrup", calories: 500, protein: 18, carbs: 58, fat: 22 },
    { meal: "Baked eggs in tomato and chorizo sauce with crusty sourdough", calories: 460, protein: 28, carbs: 38, fat: 20 },
    { meal: "Poached eggs with wilted spinach, lemon hollandaise and smoked salmon", calories: 440, protein: 32, carbs: 20, fat: 26 },
    { meal: "Smoked salmon and cream cheese omelette with chives and sourdough", calories: 480, protein: 36, carbs: 24, fat: 26 },
    { meal: "Warm spiced oats with poached pear, cardamom cream and toasted pistachios", calories: 420, protein: 14, carbs: 52, fat: 16 },
    { meal: "Coconut and passion fruit chia pudding with mango compote and lime", calories: 400, protein: 12, carbs: 54, fat: 14 },
    { meal: "Warm spiced oat porridge with caramelised apple, date syrup and toasted seeds", calories: 390, protein: 10, carbs: 62, fat: 10 },
    { meal: "Roasted cherry tomato and avocado bruschetta with microgreens and hemp oil", calories: 380, protein: 10, carbs: 50, fat: 16 },
  ],
  lunch: [
    { meal: "Pan-seared salmon with asparagus, lemon caper butter and new potatoes", calories: 540, protein: 44, carbs: 36, fat: 24 },
    { meal: "Seared sea bass fillet with chorizo, butter beans and wilted spinach", calories: 520, protein: 46, carbs: 34, fat: 20 },
    { meal: "Seared scallops with pea purée, crispy pancetta and lemon butter", calories: 480, protein: 40, carbs: 32, fat: 20 },
    { meal: "Grilled ribeye steak salad with blue cheese, walnuts and bitter leaves", calories: 540, protein: 44, carbs: 16, fat: 34 },
    { meal: "Crispy duck leg with Puy lentil salad, mustard dressing and watercress", calories: 560, protein: 46, carbs: 32, fat: 24 },
    { meal: "Roasted red pepper and goat cheese tart with dressed rocket salad", calories: 480, protein: 20, carbs: 44, fat: 24 },
    { meal: "Warm chicken liver salad with crispy bacon, baby spinach and balsamic", calories: 460, protein: 38, carbs: 24, fat: 22 },
    { meal: "Seared tuna steak with mango salsa, wild rice and lime crème fraîche", calories: 520, protein: 46, carbs: 44, fat: 12 },
    { meal: "Heritage tomato salad with white bean puree, basil oil and crispy capers", calories: 440, protein: 18, carbs: 56, fat: 16 },
    { meal: "Roasted beetroot and Puy lentil salad with orange dressing and walnuts", calories: 460, protein: 18, carbs: 60, fat: 16 },
    { meal: "Miso-glazed aubergine with black sesame rice and pickled cucumber", calories: 480, protein: 14, carbs: 70, fat: 14 },
  ],
  dinner: [
    { meal: "Ribeye steak with truffle butter, dauphinoise potatoes and tenderstem broccoli", calories: 680, protein: 52, carbs: 40, fat: 34 },
    { meal: "Duck breast with cherry and port sauce, potato gratin and wilted greens", calories: 640, protein: 46, carbs: 44, fat: 28 },
    { meal: "Rack of lamb with herb crust, roasted garlic mash and red wine jus", calories: 660, protein: 52, carbs: 40, fat: 30 },
    { meal: "Pan-roasted sea bass with saffron mussels, new potatoes and parsley oil", calories: 580, protein: 52, carbs: 42, fat: 18 },
    { meal: "Slow-braised beef short ribs with creamy polenta, gremolata and roasted roots", calories: 700, protein: 54, carbs: 48, fat: 28 },
    { meal: "Chicken supreme with wild mushroom and tarragon cream sauce, pommes purée", calories: 620, protein: 48, carbs: 44, fat: 24 },
    { meal: "Salmon en croûte with spinach and cream cheese filling, lemon dill sauce", calories: 640, protein: 48, carbs: 44, fat: 28 },
    { meal: "Slow-roasted pork belly with apple and cider jus, roasted roots and mustard greens", calories: 680, protein: 50, carbs: 44, fat: 32 },
    { meal: "Roasted celeriac with truffle oil, hazelnut crumb and lentil ragu", calories: 560, protein: 20, carbs: 68, fat: 20 },
    { meal: "Charred cauliflower steak with romesco, beluga lentils and herb oil", calories: 520, protein: 22, carbs: 62, fat: 18 },
    { meal: "Wild mushroom and chestnut bourguignon with pommes purée and roasted roots", calories: 580, protein: 16, carbs: 78, fat: 18 },
  ],
  snack: [
    { meal: "Parma ham with marinated artichoke hearts and olives", calories: 220, protein: 16, carbs: 10, fat: 14 },
    { meal: "Smoked mackerel pâté with dark rye crispbreads and cucumber", calories: 260, protein: 20, carbs: 16, fat: 14 },
    { meal: "Crostini with ricotta, honey and toasted walnuts", calories: 280, protein: 12, carbs: 26, fat: 16 },
    { meal: "Burrata with slow-roasted cherry tomatoes, basil and aged balsamic", calories: 280, protein: 14, carbs: 12, fat: 20 },
    { meal: "Manchego cheese with quince paste, Marcona almonds and Serrano ham", calories: 300, protein: 14, carbs: 18, fat: 20 },
    { meal: "Smoked salmon blinis with crème fraîche and capers", calories: 260, protein: 18, carbs: 18, fat: 12 },
    { meal: "Brie with honey, walnuts and sliced pear on crispbreads", calories: 300, protein: 12, carbs: 24, fat: 18 },
    { meal: "Warm rosemary and chilli marinated olives with sourdough", calories: 240, protein: 4, carbs: 28, fat: 12 },
    { meal: "Chilled watermelon with fresh mint, lime zest and hemp seeds", calories: 180, protein: 4, carbs: 36, fat: 4 },
    { meal: "Roasted white asparagus with lemon oil and capers on pumpernickel", calories: 220, protein: 6, carbs: 28, fat: 10 },
  ],
};

type MealEntry = { meal: string; calories: number; protein: number; carbs: number; fat: number };
type MealDb = typeof MEAL_DATABASE;

// ── Dietary filtering ────────────────────────────────────────────────────────

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  gluten: ['toast', 'bread', 'pasta', 'spaghetti', 'noodle', 'tortilla', 'bagel', 'muffin', 'cracker', 'sourdough', 'rye', 'bulgur', 'couscous', 'crouton', 'flatbread', 'crepe', 'pancake', 'brioche', 'crostini', 'crispbread', 'wrap', 'pita', 'blini', 'linguine', 'polenta'],
  dairy: ['cheese', 'butter', 'cream', 'milk', 'yogurt', 'yoghurt', 'ricotta', 'feta', 'mozzarella', 'parmesan', 'brie', 'gruyere', 'gruyère', 'mascarpone', 'hollandaise', 'creme fraiche', 'crème fraîche', 'burrata', 'manchego'],
  eggs: ['egg', 'omelette', 'frittata', 'shakshuka', 'huevos', 'benedict', 'french toast'],
  nuts: ['almond', 'walnut', 'hazelnut', 'pistachio', 'pecan', 'cashew', 'pine nut', 'nut butter', 'marcona'],
  peanuts: ['peanut'],
  shellfish: ['prawn', 'shrimp', 'lobster', 'crab', 'scallop', 'mussel', 'clam', 'oyster'],
  fish: ['salmon', 'tuna', 'cod', 'haddock', 'sea bass', 'trout', 'mackerel', 'anchovy', 'sardine', 'tilapia', 'halibut', 'sole', 'smoked fish', 'white fish'],
  soy: ['soy', 'edamame', 'tofu', 'miso', 'tempeh'],
};

const MEAT_KEYWORDS = ['chicken', 'beef', 'lamb', 'pork', 'turkey', 'duck', 'veal', 'venison', 'steak', 'mince', 'chorizo', 'bacon', 'ham', 'prosciutto', 'pancetta', 'salami', 'liver', 'rib', 'bresaola', 'serrano', 'parma'];
const PORK_KEYWORDS = ['pork', 'bacon', 'ham', 'pancetta', 'prosciutto', 'chorizo', 'salami', 'serrano', 'parma'];

function filterMealPool(pool: MealEntry[], excludeKeywords: string[]): MealEntry[] {
  if (!excludeKeywords.length) return pool;
  const filtered = pool.filter(m =>
    !excludeKeywords.some(kw => m.meal.toLowerCase().includes(kw.toLowerCase()))
  );
  return filtered.length > 0 ? filtered : pool; // safety: never return an empty pool
}

function filterMealDbByPreferences(mealDb: MealDb, preferences: UserPreferences | null): MealDb {
  if (!preferences) return mealDb;

  const excludeKeywords: string[] = [];

  switch (preferences.diet) {
    case 'vegetarian':
      excludeKeywords.push(...MEAT_KEYWORDS, ...ALLERGEN_KEYWORDS.shellfish, ...ALLERGEN_KEYWORDS.fish);
      break;
    case 'vegan':
      excludeKeywords.push(...MEAT_KEYWORDS, ...ALLERGEN_KEYWORDS.shellfish, ...ALLERGEN_KEYWORDS.fish, ...ALLERGEN_KEYWORDS.dairy, ...ALLERGEN_KEYWORDS.eggs);
      break;
    case 'pescatarian':
      excludeKeywords.push(...MEAT_KEYWORDS);
      break;
    case 'halal':
      excludeKeywords.push(...PORK_KEYWORDS);
      break;
    case 'kosher':
      excludeKeywords.push(...PORK_KEYWORDS, ...ALLERGEN_KEYWORDS.shellfish);
      break;
  }

  for (const allergy of (preferences.allergies ?? [])) {
    const kws = ALLERGEN_KEYWORDS[allergy];
    if (kws) excludeKeywords.push(...kws);
  }

  if (!excludeKeywords.length) return mealDb;

  return {
    breakfast: filterMealPool(mealDb.breakfast, excludeKeywords),
    lunch:     filterMealPool(mealDb.lunch,     excludeKeywords),
    dinner:    filterMealPool(mealDb.dinner,    excludeKeywords),
    snack:     filterMealPool(mealDb.snack,     excludeKeywords),
  };
}

// Scale a meal's portions to exactly hit a calorie target, preserving macro ratios
function scaleMeal(meal: MealEntry, targetCalories: number): MealEntry {
  const scale = targetCalories / meal.calories;
  return {
    meal: meal.meal,
    calories: Math.round(targetCalories),
    protein: Math.round(meal.protein * scale),
    carbs: Math.round(meal.carbs * scale),
    fat: Math.round(meal.fat * scale),
  };
}

// Score a meal's macro ratio distance from targets (lower is better)
function macroScore(m: MealEntry, tProtein: number, tCarbs: number, tFat: number): number {
  const pPct = (m.protein * 4) / m.calories;
  const cPct = (m.carbs   * 4) / m.calories;
  const fPct = (m.fat     * 9) / m.calories;
  return Math.abs(pPct - tProtein) + Math.abs(cPct - tCarbs) + Math.abs(fPct - tFat);
}

// Rank all meals by macro fit, then randomly pick from the best third (for variety)
function pickBestMeal(
  pool: MealEntry[],
  tProtein: number,
  tCarbs: number,
  tFat: number,
): MealEntry {
  const ranked = [...pool].sort((a, b) => macroScore(a, tProtein, tCarbs, tFat) - macroScore(b, tProtein, tCarbs, tFat));
  // Pick randomly from the top third (min 2 options) to keep variety while staying macro-accurate
  const topCount = Math.max(2, Math.ceil(ranked.length / 3));
  const topCandidates = ranked.slice(0, topCount);
  return topCandidates[Math.floor(Math.random() * topCandidates.length)];
}

function buildDayPlan(
  dailyCalories: number,
  proteinGoal: number,
  carbsGoal: number,
  fatGoal: number,
  db: MealDb,
  lunchOverride?: MealEntry,
) {
  // Calorie targets per slot
  const bfTarget     = Math.round(dailyCalories * 0.25);
  const lunchTarget  = Math.round(dailyCalories * 0.30);
  const dinnerTarget = Math.round(dailyCalories * 0.35);
  const snackBudget  = dailyCalories - bfTarget - lunchTarget - dinnerTarget; // ~10%

  // Target macro ratios (as fractions of calories)
  const totalMacroCals = proteinGoal * 4 + carbsGoal * 4 + fatGoal * 9;
  const tProtein = (proteinGoal * 4) / totalMacroCals;
  const tCarbs   = (carbsGoal   * 4) / totalMacroCals;
  const tFat     = (fatGoal     * 9) / totalMacroCals;

  const breakfastBase = pickBestMeal(db.breakfast, tProtein, tCarbs, tFat);
  const lunchBase     = lunchOverride ?? pickBestMeal(db.lunch, tProtein, tCarbs, tFat);
  const dinnerBase    = pickBestMeal(db.dinner, tProtein, tCarbs, tFat);

  const breakfast = scaleMeal(breakfastBase, bfTarget);
  const lunch     = scaleMeal(lunchBase, lunchTarget);
  const dinner    = scaleMeal(dinnerBase, dinnerTarget);

  // Fill snack budget with 1–2 scaled snacks
  const snacksList: MealEntry[] = [];
  let snackRemaining = snackBudget;

  if (snackBudget >= 150) {
    const numSnacks = snackBudget >= 350 ? 2 : 1;
    const snackTargetEach = Math.round(snackBudget / numSnacks);

    for (let i = 0; i < numSnacks; i++) {
      const snackBase = pickBestMeal(db.snack, tProtein, tCarbs, tFat);
      snacksList.push(scaleMeal(snackBase, snackTargetEach));
      snackRemaining -= snackTargetEach;
    }
  }

  // Exact totals from scaled meals
  const allMeals = [breakfast, lunch, dinner, ...snacksList];
  const dayTotalCalories = allMeals.reduce((s, m) => s + m.calories, 0);
  const dayTotalProtein  = allMeals.reduce((s, m) => s + m.protein,  0);
  const dayTotalCarbs    = allMeals.reduce((s, m) => s + m.carbs,    0);
  const dayTotalFat      = allMeals.reduce((s, m) => s + m.fat,      0);

  return {
    breakfast: [breakfast],
    lunch: [lunch],
    dinner: [dinner],
    snacks: snacksList,
    dayTotalCalories,
    dayTotalProtein,
    dayTotalCarbs,
    dayTotalFat,
  };
}

function generateDayPlan(dailyCalories: number, proteinGoal: number, carbsGoal: number, fatGoal: number, db: MealDb) {
  return buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db);
}

function generateMealPlan(dailyCalories: number, proteinGoal: number, carbsGoal: number, fatGoal: number, isWeekly: boolean, db: MealDb) {
  const lunchTarget = Math.round(dailyCalories * 0.30);

  // Target macro ratios — used when scaling the lunch override
  const totalMacroCals = proteinGoal * 4 + carbsGoal * 4 + fatGoal * 9;
  const tProtein = (proteinGoal * 4) / totalMacroCals;
  const tCarbs   = (carbsGoal   * 4) / totalMacroCals;
  const tFat     = (fatGoal     * 9) / totalMacroCals;

  if (isWeekly) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
    const weekPlan: any = {};
    let weekTotalCalories = 0;
    let weekTotalProtein = 0;
    let weekTotalCarbs = 0;
    let weekTotalFat = 0;

    // Stores the raw (unscaled) dinner base so the next day can scale it to lunchTarget
    let previousDinnerBase: MealEntry | undefined = undefined;

    const dinnerTarget = Math.round(dailyCalories * 0.35);

    days.forEach((day, index) => {
      let dayPlan: ReturnType<typeof buildDayPlan>;

      if (index === 0) {
        // Monday: pick one dinner base, use it for BOTH lunch (at lunchTarget) and dinner (at dinnerTarget)
        const mondayDinnerBase = pickBestMeal(db.dinner, tProtein, tCarbs, tFat);
        const mondayLunch  = scaleMeal(mondayDinnerBase, lunchTarget);
        const mondayDinner = scaleMeal(mondayDinnerBase, dinnerTarget);

        // Build day with the lunch override; then replace dinner with the same base
        const dayPlanBase = buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, mondayLunch);
        const allMeals = [dayPlanBase.breakfast[0], mondayLunch, mondayDinner, ...dayPlanBase.snacks];
        dayPlan = {
          breakfast:       dayPlanBase.breakfast,
          lunch:           [mondayLunch],
          dinner:          [mondayDinner],
          snacks:          dayPlanBase.snacks,
          dayTotalCalories: allMeals.reduce((s, m) => s + m.calories, 0),
          dayTotalProtein:  allMeals.reduce((s, m) => s + m.protein,  0),
          dayTotalCarbs:    allMeals.reduce((s, m) => s + m.carbs,    0),
          dayTotalFat:      allMeals.reduce((s, m) => s + m.fat,      0),
        };
        previousDinnerBase = mondayDinnerBase; // raw base so Tuesday scales it to lunchTarget
      } else {
        // Tue–Sun: scale the raw dinner base from the previous day to lunchTarget
        const lunchOverride = scaleMeal(previousDinnerBase!, lunchTarget);
        dayPlan = buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, lunchOverride);
        // Store raw (unscaled) dinner base for the next day
        const dinnerBase = db.dinner.find(m => m.meal === dayPlan.dinner[0].meal) ?? dayPlan.dinner[0];
        previousDinnerBase = dinnerBase;
      }

      weekPlan[day] = dayPlan;
      weekTotalCalories += dayPlan.dayTotalCalories;
      weekTotalProtein  += dayPlan.dayTotalProtein;
      weekTotalCarbs    += dayPlan.dayTotalCarbs;
      weekTotalFat      += dayPlan.dayTotalFat;
    });

    return {
      planType: 'weekly' as const,
      ...weekPlan,
      weekTotalCalories,
      weekTotalProtein,
      weekTotalCarbs,
      weekTotalFat,
    };
  } else {
    const dayPlan = generateDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db);
    return {
      planType: 'daily' as const,
      ...dayPlan,
    };
  }
}

function calculateMacros(weight: number, height: number, age: number, gender: string, activityLevel: string, goal: string = 'maintain') {
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  if (gender === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }

  let activityMultiplier = 1.2;
  switch (activityLevel) {
    case 'sedentary': activityMultiplier = 1.2; break;
    case 'light': activityMultiplier = 1.375; break;
    case 'moderate': activityMultiplier = 1.55; break;
    case 'active': activityMultiplier = 1.725; break;
    case 'very_active': activityMultiplier = 1.9; break;
  }

  let dailyCalories = Math.round(bmr * activityMultiplier);

  switch (goal) {
    case 'fat_loss':
      dailyCalories = Math.round(dailyCalories - 500);
      break;
    case 'tone':
      dailyCalories = Math.round(dailyCalories - 250);
      break;
    case 'maintain':
      break;
    case 'muscle':
      dailyCalories = Math.round(dailyCalories + 300);
      break;
    case 'bulk':
      dailyCalories = Math.round(dailyCalories + 600);
      break;
    case 'lose':
      dailyCalories = Math.round(dailyCalories - 500);
      break;
    case 'gain':
      dailyCalories = Math.round(dailyCalories + 500);
      break;
    default:
      break;
  }

  const weeklyCalories = dailyCalories * 7;
  const proteinGoal = Math.round((dailyCalories * 0.3) / 4);
  const carbsGoal = Math.round((dailyCalories * 0.4) / 4);
  const fatGoal = Math.round((dailyCalories * 0.3) / 9);

  return { dailyCalories, weeklyCalories, proteinGoal, carbsGoal, fatGoal };
}

// ── Passport OAuth setup ────────────────────────────────────────────────────

function setupPassportStrategies() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appleClientId = process.env.APPLE_CLIENT_ID;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  const appleKeyId = process.env.APPLE_KEY_ID;
  const applePrivateKey = process.env.APPLE_PRIVATE_KEY;

  if (googleClientId && googleClientSecret) {
    const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
    passport.use(new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: "/api/auth/google/callback",
        scope: ["profile", "email"],
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: Function) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName || profile.emails?.[0]?.value || "Google User";
          if (!email) return done(new Error("No email returned from Google"));
          const user = await storage.findOrCreateOAuthUser({
            email,
            name,
            provider: "google",
            providerId: profile.id,
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ));
  }

  if (appleClientId && appleTeamId && appleKeyId && applePrivateKey) {
    const AppleStrategy = require("passport-apple");
    passport.use(new AppleStrategy(
      {
        clientID: appleClientId,
        teamID: appleTeamId,
        keyID: appleKeyId,
        privateKeyString: applePrivateKey.replace(/\\n/g, "\n"),
        callbackURL: "/api/auth/apple/callback",
        scope: ["name", "email"],
        passReqToCallback: false,
      },
      async (_accessToken: string, _refreshToken: string, idToken: any, profile: any, done: Function) => {
        try {
          const email = idToken?.email || profile?.email;
          const firstName = profile?.name?.firstName || "";
          const lastName = profile?.name?.lastName || "";
          const name = [firstName, lastName].filter(Boolean).join(" ") || email || "Apple User";
          const sub = idToken?.sub || profile?.id;
          if (!email || !sub) return done(new Error("Insufficient data from Apple"));
          const user = await storage.findOrCreateOAuthUser({
            email,
            name,
            provider: "apple",
            providerId: sub,
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ));
  }

  // Passport serialize/deserialize (session: false on callbacks, but needed for init)
  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });
}

setupPassportStrategies();

export { passport };

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Auth routes ────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await storage.createUser({ email: input.email, name: input.name, passwordHash });
      req.session.userId = user.id;
      const { passwordHash: _, ...publicUser } = user;
      res.status(201).json(publicUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(input.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (!user.passwordHash) {
        const providerName = user.provider ? user.provider.charAt(0).toUpperCase() + user.provider.slice(1) : "social";
        return res.status(401).json({ message: `This account uses ${providerName} sign-in. Please use the "${providerName}" button to log in.` });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.session.userId = user.id;
      const { passwordHash: _, ...publicUser } = user;
      res.status(200).json(publicUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.status(200).json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    const { passwordHash: _, ...publicUser } = user;
    res.status(200).json(publicUser);
  });

  // ── OAuth provider availability ───────────────────────────────────────────

  app.get("/api/auth/providers", (_req, res) => {
    res.json({
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      apple: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY),
    });
  });

  // ── Google OAuth ──────────────────────────────────────────────────────────

  app.get("/api/auth/google", (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ message: "Google sign-in is not configured" });
    }
    passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
  });

  app.get("/api/auth/google/callback",
    (req, res, next) => {
      passport.authenticate("google", { session: false, failureRedirect: "/auth?error=google_failed" })(req, res, next);
    },
    (req: Request, res: Response) => {
      const user = req.user as any;
      if (!user) return res.redirect("/auth?error=google_failed");
      req.session.userId = user.id;
      req.session.save(() => res.redirect("/dashboard"));
    }
  );

  // ── Apple OAuth ───────────────────────────────────────────────────────────

  app.get("/api/auth/apple", (req, res, next) => {
    if (!process.env.APPLE_CLIENT_ID) {
      return res.status(503).json({ message: "Apple sign-in is not configured" });
    }
    passport.authenticate("apple", { session: false })(req, res, next);
  });

  app.post("/api/auth/apple/callback",
    (req, res, next) => {
      passport.authenticate("apple", { session: false, failureRedirect: "/auth?error=apple_failed" })(req, res, next);
    },
    (req: Request, res: Response) => {
      const user = req.user as any;
      if (!user) return res.redirect("/auth?error=apple_failed");
      req.session.userId = user.id;
      req.session.save(() => res.redirect("/dashboard"));
    }
  );

  // ── Calculation routes ────────────────────────────────────────────────────

  app.post(api.calculations.create.path, async (req, res) => {
    try {
      const bodySchema = api.calculations.create.input.extend({
        weight: z.coerce.string(),
        height: z.coerce.string(),
        age: z.coerce.number().optional().default(30),
      });
      const input = bodySchema.parse(req.body);

      const weightNum = parseFloat(input.weight);
      const heightNum = parseFloat(input.height);
      const ageNum = input.age || 30;

      const macros = calculateMacros(weightNum, heightNum, ageNum, input.gender || 'male', input.activityLevel || 'moderate', input.goal || 'maintain');

      const calcData = {
        weight: input.weight,
        height: input.height,
        age: ageNum,
        gender: input.gender || 'male',
        activityLevel: input.activityLevel || 'moderate',
        goal: input.goal || 'maintain',
        targetType: input.targetType,
        targetAmount: input.targetAmount && input.targetAmount !== '' ? input.targetAmount : null,
        userId: req.session.userId,
        ...macros
      };

      const calculation = await storage.createCalculation(calcData);
      res.status(201).json(calculation);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.calculations.list.path, async (req, res) => {
    const calcs = await storage.getCalculations(req.session.userId);
    res.status(200).json(calcs);
  });

  // ── Meal plan routes ──────────────────────────────────────────────────────

  // ── User preferences routes ───────────────────────────────────────────────

  app.get("/api/user/preferences", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUserById(req.session.userId);
    res.json((user?.preferences as UserPreferences | null) ?? { diet: null, allergies: [] });
  });

  app.put("/api/user/preferences", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const prefs = userPreferencesSchema.parse(req.body);
    await storage.updateUserPreferences(req.session.userId, prefs);
    res.json(prefs);
  });

  app.post(api.mealPlans.generate.path, async (req, res) => {
    try {
      const input = mealPlanSchema.parse(req.body);
      let baseDb = input.mealStyle === 'michelin' ? MICHELIN_MEAL_DATABASE : input.mealStyle === 'gourmet' ? GOURMET_MEAL_DATABASE : MEAL_DATABASE;

      // Apply user preferences filtering if logged in
      if (req.session.userId) {
        const user = await storage.getUserById(req.session.userId);
        const prefs = (user?.preferences as UserPreferences | null) ?? null;
        baseDb = filterMealDbByPreferences(baseDb, prefs) as typeof baseDb;
      }

      const mealPlan = generateMealPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, input.planType === 'weekly', baseDb);

      // If user is logged in, auto-save the plan
      let savedId: number | undefined;
      if (req.session.userId) {
        const saved = await storage.saveMealPlan({
          userId: req.session.userId,
          calculationId: input.calculationId ?? undefined,
          planType: input.planType,
          mealStyle: input.mealStyle ?? 'simple',
          planData: mealPlan as any,
          name: `${input.planType === 'weekly' ? 'Weekly' : 'Daily'} Plan`,
        });
        savedId = saved.id;
      }

      res.status(201).json({ ...mealPlan, savedId });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // ── Saved meal plans ──────────────────────────────────────────────────────

  app.get("/api/saved-meal-plans", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const plans = await storage.getSavedMealPlans(req.session.userId);
    res.status(200).json(plans);
  });

  app.patch("/api/saved-meal-plans/:id/name", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const id = parseInt(req.params.id);
    const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);
    const updated = await storage.updateMealPlanName(id, req.session.userId, name);
    if (!updated) return res.status(404).json({ message: "Plan not found" });
    res.status(200).json(updated);
  });

  app.delete("/api/saved-meal-plans/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const id = parseInt(req.params.id);
    await storage.deleteMealPlan(id, req.session.userId);
    res.status(204).send();
  });

  // ── Weight tracking ───────────────────────────────────────────────────────

  app.get("/api/weight-entries", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const entries = await storage.getWeightEntries(req.session.userId);
    res.status(200).json(entries);
  });

  app.post("/api/weight-entries", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const body = z.object({
        weight: z.string().min(1),
        recordedAt: z.string().optional(),
      }).parse(req.body);
      const entry = await storage.createWeightEntry({
        userId: req.session.userId,
        weight: body.weight,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
      });
      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/weight-entries/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const id = parseInt(req.params.id);
    await storage.deleteWeightEntry(id, req.session.userId);
    res.status(204).send();
  });

  return httpServer;
}
