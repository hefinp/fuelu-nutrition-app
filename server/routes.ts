import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, mealPlanSchema } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { registerSchema, loginSchema, userPreferencesSchema, insertUserRecipeSchema, type UserPreferences } from "@shared/schema";
import passport from "passport";
import { sendEmail, buildPasswordResetEmailHtml, buildMealPlanEmailHtml } from "./email";
import OpenAI from "openai";

const MEAL_DATABASE: MealDb = {
  breakfast: [
    { meal: "Scrambled eggs (3) with whole grain toast", calories: 380, protein: 28, carbs: 26, fat: 16, microScore: 3 },
    { meal: "Oatmeal with berries and almonds", calories: 340, protein: 14, carbs: 46, fat: 10, microScore: 4 },
    { meal: "Greek yogurt with granola and honey", calories: 360, protein: 22, carbs: 44, fat: 8, microScore: 3 },
    { meal: "Egg white omelette with spinach and feta", calories: 340, protein: 32, carbs: 12, fat: 16, microScore: 5 },
    { meal: "Protein smoothie with oats and almond butter", calories: 400, protein: 30, carbs: 42, fat: 12, microScore: 3 },
    { meal: "Cottage cheese with berries and flaxseed", calories: 300, protein: 26, carbs: 28, fat: 8, microScore: 4 },
    { meal: "Smoked salmon with eggs and rye toast", calories: 420, protein: 34, carbs: 24, fat: 18, microScore: 5 },
    { meal: "Chia seed pudding with coconut milk and nuts", calories: 360, protein: 14, carbs: 34, fat: 18, microScore: 4 },
    { meal: "Banana and peanut butter overnight oats", calories: 370, protein: 14, carbs: 56, fat: 10, microScore: 3 },
    { meal: "Mixed berry smoothie bowl with hemp seeds and granola", calories: 340, protein: 12, carbs: 52, fat: 10, microScore: 4 },
    { meal: "Tofu scramble with peppers, onion and spinach", calories: 320, protein: 24, carbs: 18, fat: 14, microScore: 5 },
    { meal: "Fruit and nut muesli with oat milk", calories: 350, protein: 12, carbs: 50, fat: 10, microScore: 3 },
  ],
  lunch: [
    { meal: "Grilled chicken breast with brown rice and broccoli", calories: 500, protein: 46, carbs: 44, fat: 10, microScore: 4 },
    { meal: "Turkey and avocado salad with olive oil dressing", calories: 460, protein: 36, carbs: 24, fat: 22, microScore: 4 },
    { meal: "Tuna salad with olive oil dressing", calories: 400, protein: 38, carbs: 20, fat: 16, microScore: 4 },
    { meal: "Quinoa bowl with chickpeas and vegetables", calories: 440, protein: 22, carbs: 56, fat: 12, microScore: 5 },
    { meal: "Salmon with sweet potato and asparagus", calories: 520, protein: 42, carbs: 44, fat: 18, microScore: 5 },
    { meal: "Beef and brown rice bowl with mixed vegetables", calories: 540, protein: 42, carbs: 52, fat: 14, microScore: 3 },
    { meal: "Chicken Caesar salad with whole grain croutons", calories: 460, protein: 40, carbs: 28, fat: 18, microScore: 3 },
    { meal: "Lean turkey mince bowl with quinoa and greens", calories: 480, protein: 44, carbs: 36, fat: 14, microScore: 4 },
    { meal: "Lentil and roasted vegetable bowl with tahini dressing", calories: 450, protein: 20, carbs: 58, fat: 12, microScore: 5 },
    { meal: "Black bean and roasted pepper burrito bowl with guacamole", calories: 470, protein: 18, carbs: 60, fat: 16, microScore: 4 },
    { meal: "Chickpea and sweet potato bowl with spinach and lime", calories: 440, protein: 18, carbs: 62, fat: 10, microScore: 5 },
  ],
  dinner: [
    { meal: "Baked chicken with roasted vegetables and sweet potato", calories: 580, protein: 46, carbs: 52, fat: 14, microScore: 4 },
    { meal: "Lean beef with mashed potatoes and green beans", calories: 620, protein: 48, carbs: 54, fat: 18, microScore: 3 },
    { meal: "Grilled salmon with wild rice and vegetables", calories: 560, protein: 46, carbs: 48, fat: 16, microScore: 5 },
    { meal: "Pork tenderloin with sweet potato and spinach", calories: 560, protein: 44, carbs: 52, fat: 14, microScore: 4 },
    { meal: "Turkey meatballs with wholemeal spaghetti and marinara", calories: 560, protein: 44, carbs: 58, fat: 12, microScore: 3 },
    { meal: "Chicken fajitas with brown rice and black beans", calories: 580, protein: 44, carbs: 62, fat: 12, microScore: 4 },
    { meal: "Grilled white fish with quinoa and roasted vegetables", calories: 520, protein: 46, carbs: 46, fat: 12, microScore: 5 },
    { meal: "Lean lamb stir-fry with brown rice and bok choy", calories: 600, protein: 46, carbs: 54, fat: 18, microScore: 4 },
    { meal: "Chickpea and spinach curry with basmati rice", calories: 540, protein: 22, carbs: 76, fat: 12, microScore: 5 },
    { meal: "Lentil dahl with brown rice and wilted spinach", calories: 520, protein: 24, carbs: 78, fat: 8, microScore: 5 },
    { meal: "Tofu and vegetable stir-fry with brown rice", calories: 500, protein: 26, carbs: 64, fat: 14, microScore: 4 },
    { meal: "Roasted vegetable and quinoa bowl with tahini", calories: 510, protein: 20, carbs: 68, fat: 16, microScore: 5 },
  ],
  snack: [
    { meal: "Protein bar and apple", calories: 260, protein: 22, carbs: 28, fat: 6, microScore: 2 },
    { meal: "Greek yogurt with granola", calories: 220, protein: 18, carbs: 24, fat: 6, microScore: 3 },
    { meal: "Trail mix and banana", calories: 280, protein: 10, carbs: 38, fat: 10, microScore: 3 },
    { meal: "Cottage cheese with berries", calories: 200, protein: 20, carbs: 18, fat: 4, microScore: 4 },
    { meal: "Peanut butter and whole grain crackers", calories: 260, protein: 12, carbs: 24, fat: 14, microScore: 2 },
    { meal: "Hard-boiled eggs and almonds", calories: 220, protein: 18, carbs: 6, fat: 14, microScore: 4 },
    { meal: "Tuna on rice cakes", calories: 200, protein: 22, carbs: 18, fat: 4, microScore: 4 },
    { meal: "Edamame with sea salt", calories: 200, protein: 18, carbs: 14, fat: 8, microScore: 5 },
    { meal: "Apple slices with sunflower seed butter", calories: 210, protein: 6, carbs: 30, fat: 10, microScore: 3 },
    { meal: "Rice cakes with avocado and cherry tomatoes", calories: 200, protein: 4, carbs: 26, fat: 10, microScore: 4 },
    { meal: "Roasted chickpeas with spices", calories: 220, protein: 10, carbs: 30, fat: 6, microScore: 4 },
  ],
};

const GOURMET_MEAL_DATABASE: MealDb = {
  breakfast: [
    { meal: "Shakshuka with poached eggs and crusty sourdough", calories: 420, protein: 28, carbs: 38, fat: 18, microScore: 4 },
    { meal: "Avocado toast with poached eggs and everything bagel seasoning", calories: 400, protein: 24, carbs: 34, fat: 20, microScore: 4 },
    { meal: "Smoked salmon bagel with cream cheese, capers and dill", calories: 440, protein: 32, carbs: 36, fat: 18, microScore: 5 },
    { meal: "Bircher muesli with apple, toasted hazelnuts and pomegranate", calories: 380, protein: 16, carbs: 54, fat: 12, microScore: 5 },
    { meal: "Savory crepes with goat cheese, spinach and sun-dried tomatoes", calories: 420, protein: 26, carbs: 36, fat: 18, microScore: 4 },
    { meal: "Eggs Benedict with Canadian bacon and light hollandaise", calories: 460, protein: 32, carbs: 32, fat: 22, microScore: 3 },
    { meal: "Coconut overnight oats with mango, lime and toasted coconut", calories: 380, protein: 14, carbs: 56, fat: 12, microScore: 3 },
    { meal: "Huevos rancheros with black beans and pico de gallo", calories: 440, protein: 28, carbs: 44, fat: 16, microScore: 4 },
    { meal: "Acai smoothie bowl with mixed berries, banana and coconut flakes", calories: 370, protein: 10, carbs: 60, fat: 10, microScore: 5 },
    { meal: "Roasted tomato and lentil shakshuka with charred flatbread", calories: 400, protein: 20, carbs: 52, fat: 12, microScore: 5 },
    { meal: "Sweet potato and black bean breakfast hash with avocado", calories: 390, protein: 14, carbs: 56, fat: 14, microScore: 5 },
  ],
  lunch: [
    { meal: "Chicken shawarma bowl with hummus, tabbouleh and flatbread", calories: 540, protein: 44, carbs: 52, fat: 14, microScore: 4 },
    { meal: "Pan-seared tuna nicoise with green beans and soft-boiled egg", calories: 480, protein: 42, carbs: 28, fat: 22, microScore: 5 },
    { meal: "Thai beef salad with glass noodles, mint and chilli-lime dressing", calories: 460, protein: 36, carbs: 38, fat: 16, microScore: 4 },
    { meal: "Mediterranean stuffed peppers with couscous and feta", calories: 440, protein: 22, carbs: 54, fat: 14, microScore: 4 },
    { meal: "Prawn and avocado salad with lime, chilli and mixed grains", calories: 460, protein: 36, carbs: 38, fat: 16, microScore: 4 },
    { meal: "Chicken souvlaki wrap with tzatziki and roasted vegetables", calories: 500, protein: 42, carbs: 44, fat: 14, microScore: 3 },
    { meal: "Spiced chickpea and spinach curry with basmati rice", calories: 480, protein: 22, carbs: 64, fat: 12, microScore: 5 },
    { meal: "Roasted red pepper and lentil soup with sourdough", calories: 420, protein: 20, carbs: 58, fat: 10, microScore: 5 },
    { meal: "Moroccan roasted vegetable and chickpea bowl with chermoula", calories: 460, protein: 18, carbs: 64, fat: 14, microScore: 5 },
    { meal: "Vietnamese-style tofu and glass noodle salad with lime dressing", calories: 420, protein: 20, carbs: 54, fat: 12, microScore: 4 },
  ],
  dinner: [
    { meal: "Herb-crusted salmon with lemon risotto and asparagus", calories: 600, protein: 46, carbs: 56, fat: 18, microScore: 5 },
    { meal: "Moroccan lamb tagine with apricots, couscous and harissa", calories: 620, protein: 46, carbs: 60, fat: 18, microScore: 4 },
    { meal: "Thai green chicken curry with jasmine rice and bok choy", calories: 580, protein: 44, carbs: 58, fat: 16, microScore: 4 },
    { meal: "Seared duck breast with sweet potato puree and cherry jus", calories: 600, protein: 44, carbs: 52, fat: 20, microScore: 3 },
    { meal: "Pan-seared sea bass with chorizo, white beans and gremolata", calories: 560, protein: 46, carbs: 42, fat: 20, microScore: 4 },
    { meal: "Miso-glazed cod with edamame fried rice and pickled ginger", calories: 560, protein: 46, carbs: 52, fat: 14, microScore: 5 },
    { meal: "Chicken piccata with capers, lemon butter sauce and linguine", calories: 580, protein: 46, carbs: 54, fat: 16, microScore: 3 },
    { meal: "Beef tenderloin with dauphinoise potato and green peppercorn sauce", calories: 640, protein: 48, carbs: 48, fat: 24, microScore: 2 },
    { meal: "Moroccan vegetable tagine with couscous, preserved lemon and harissa", calories: 540, protein: 16, carbs: 80, fat: 14, microScore: 5 },
    { meal: "Butternut squash and chickpea coconut curry with jasmine rice", calories: 560, protein: 18, carbs: 82, fat: 16, microScore: 5 },
    { meal: "Roasted aubergine with pomegranate, walnut sauce and lentil rice", calories: 520, protein: 18, carbs: 72, fat: 16, microScore: 5 },
  ],
  snack: [
    { meal: "Baba ganoush with toasted pita and cucumber", calories: 240, protein: 8, carbs: 30, fat: 10, microScore: 3 },
    { meal: "Whipped ricotta with honey, walnuts and pomegranate", calories: 260, protein: 14, carbs: 24, fat: 14, microScore: 4 },
    { meal: "Smoked salmon and cream cheese on rye crispbreads", calories: 220, protein: 18, carbs: 16, fat: 10, microScore: 5 },
    { meal: "Roasted spiced chickpeas with tahini dip", calories: 240, protein: 12, carbs: 28, fat: 10, microScore: 4 },
    { meal: "Caprese skewers with fresh mozzarella and basil pesto", calories: 240, protein: 14, carbs: 8, fat: 18, microScore: 3 },
    { meal: "Prosciutto-wrapped melon with rocket", calories: 200, protein: 14, carbs: 20, fat: 6, microScore: 3 },
    { meal: "Nut butter energy balls with oats, dates and dark chocolate", calories: 280, protein: 10, carbs: 34, fat: 12, microScore: 3 },
    { meal: "Tuna tartare on cucumber rounds with sesame and soy", calories: 200, protein: 22, carbs: 10, fat: 8, microScore: 5 },
    { meal: "Sliced avocado with lime, chilli flakes and sesame rice cakes", calories: 220, protein: 4, carbs: 24, fat: 14, microScore: 4 },
    { meal: "Spiced roasted chickpeas with pomegranate molasses", calories: 230, protein: 10, carbs: 32, fat: 6, microScore: 4 },
  ],
};

const MICHELIN_MEAL_DATABASE: MealDb = {
  breakfast: [
    { meal: "Croque Madame with Gruyère, smoked ham and fried egg", calories: 480, protein: 32, carbs: 30, fat: 24, microScore: 3 },
    { meal: "Slow scrambled eggs with crème fraîche, chives and smoked trout on rye", calories: 420, protein: 34, carbs: 24, fat: 20, microScore: 5 },
    { meal: "Ricotta pancakes with blueberry compote and lemon curd", calories: 460, protein: 20, carbs: 56, fat: 16, microScore: 3 },
    { meal: "Brioche French toast with mascarpone, caramelised banana and maple syrup", calories: 500, protein: 18, carbs: 58, fat: 22, microScore: 2 },
    { meal: "Baked eggs in tomato and chorizo sauce with crusty sourdough", calories: 460, protein: 28, carbs: 38, fat: 20, microScore: 4 },
    { meal: "Poached eggs with wilted spinach, lemon hollandaise and smoked salmon", calories: 440, protein: 32, carbs: 20, fat: 26, microScore: 5 },
    { meal: "Smoked salmon and cream cheese omelette with chives and sourdough", calories: 480, protein: 36, carbs: 24, fat: 26, microScore: 5 },
    { meal: "Warm spiced oats with poached pear, cardamom cream and toasted pistachios", calories: 420, protein: 14, carbs: 52, fat: 16, microScore: 4 },
    { meal: "Coconut and passion fruit chia pudding with mango compote and lime", calories: 400, protein: 12, carbs: 54, fat: 14, microScore: 4 },
    { meal: "Warm spiced oat porridge with caramelised apple, date syrup and toasted seeds", calories: 390, protein: 10, carbs: 62, fat: 10, microScore: 4 },
    { meal: "Roasted cherry tomato and avocado bruschetta with microgreens and hemp oil", calories: 380, protein: 10, carbs: 50, fat: 16, microScore: 5 },
  ],
  lunch: [
    { meal: "Pan-seared salmon with asparagus, lemon caper butter and new potatoes", calories: 540, protein: 44, carbs: 36, fat: 24, microScore: 5 },
    { meal: "Seared sea bass fillet with chorizo, butter beans and wilted spinach", calories: 520, protein: 46, carbs: 34, fat: 20, microScore: 5 },
    { meal: "Seared scallops with pea purée, crispy pancetta and lemon butter", calories: 480, protein: 40, carbs: 32, fat: 20, microScore: 4 },
    { meal: "Grilled ribeye steak salad with blue cheese, walnuts and bitter leaves", calories: 540, protein: 44, carbs: 16, fat: 34, microScore: 3 },
    { meal: "Crispy duck leg with Puy lentil salad, mustard dressing and watercress", calories: 560, protein: 46, carbs: 32, fat: 24, microScore: 5 },
    { meal: "Roasted red pepper and goat cheese tart with dressed rocket salad", calories: 480, protein: 20, carbs: 44, fat: 24, microScore: 4 },
    { meal: "Warm chicken liver salad with crispy bacon, baby spinach and balsamic", calories: 460, protein: 38, carbs: 24, fat: 22, microScore: 5 },
    { meal: "Seared tuna steak with mango salsa, wild rice and lime crème fraîche", calories: 520, protein: 46, carbs: 44, fat: 12, microScore: 5 },
    { meal: "Heritage tomato salad with white bean puree, basil oil and crispy capers", calories: 440, protein: 18, carbs: 56, fat: 16, microScore: 5 },
    { meal: "Roasted beetroot and Puy lentil salad with orange dressing and walnuts", calories: 460, protein: 18, carbs: 60, fat: 16, microScore: 5 },
    { meal: "Miso-glazed aubergine with black sesame rice and pickled cucumber", calories: 480, protein: 14, carbs: 70, fat: 14, microScore: 4 },
  ],
  dinner: [
    { meal: "Ribeye steak with truffle butter, dauphinoise potatoes and tenderstem broccoli", calories: 680, protein: 52, carbs: 40, fat: 34, microScore: 3 },
    { meal: "Duck breast with cherry and port sauce, potato gratin and wilted greens", calories: 640, protein: 46, carbs: 44, fat: 28, microScore: 4 },
    { meal: "Rack of lamb with herb crust, roasted garlic mash and red wine jus", calories: 660, protein: 52, carbs: 40, fat: 30, microScore: 3 },
    { meal: "Pan-roasted sea bass with saffron mussels, new potatoes and parsley oil", calories: 580, protein: 52, carbs: 42, fat: 18, microScore: 5 },
    { meal: "Slow-braised beef short ribs with creamy polenta, gremolata and roasted roots", calories: 700, protein: 54, carbs: 48, fat: 28, microScore: 4 },
    { meal: "Chicken supreme with wild mushroom and tarragon cream sauce, pommes purée", calories: 620, protein: 48, carbs: 44, fat: 24, microScore: 3 },
    { meal: "Salmon en croûte with spinach and cream cheese filling, lemon dill sauce", calories: 640, protein: 48, carbs: 44, fat: 28, microScore: 4 },
    { meal: "Slow-roasted pork belly with apple and cider jus, roasted roots and mustard greens", calories: 680, protein: 50, carbs: 44, fat: 32, microScore: 4 },
    { meal: "Roasted celeriac with truffle oil, hazelnut crumb and lentil ragu", calories: 560, protein: 20, carbs: 68, fat: 20, microScore: 5 },
    { meal: "Charred cauliflower steak with romesco, beluga lentils and herb oil", calories: 520, protein: 22, carbs: 62, fat: 18, microScore: 5 },
    { meal: "Wild mushroom and chestnut bourguignon with pommes purée and roasted roots", calories: 580, protein: 16, carbs: 78, fat: 18, microScore: 4 },
  ],
  snack: [
    { meal: "Parma ham with marinated artichoke hearts and olives", calories: 220, protein: 16, carbs: 10, fat: 14, microScore: 3 },
    { meal: "Smoked mackerel pâté with dark rye crispbreads and cucumber", calories: 260, protein: 20, carbs: 16, fat: 14, microScore: 5 },
    { meal: "Crostini with ricotta, honey and toasted walnuts", calories: 280, protein: 12, carbs: 26, fat: 16, microScore: 3 },
    { meal: "Burrata with slow-roasted cherry tomatoes, basil and aged balsamic", calories: 280, protein: 14, carbs: 12, fat: 20, microScore: 4 },
    { meal: "Manchego cheese with quince paste, Marcona almonds and Serrano ham", calories: 300, protein: 14, carbs: 18, fat: 20, microScore: 3 },
    { meal: "Smoked salmon blinis with crème fraîche and capers", calories: 260, protein: 18, carbs: 18, fat: 12, microScore: 5 },
    { meal: "Brie with honey, walnuts and sliced pear on crispbreads", calories: 300, protein: 12, carbs: 24, fat: 18, microScore: 3 },
    { meal: "Warm rosemary and chilli marinated olives with sourdough", calories: 240, protein: 4, carbs: 28, fat: 12, microScore: 3 },
    { meal: "Chilled watermelon with fresh mint, lime zest and hemp seeds", calories: 180, protein: 4, carbs: 36, fat: 4, microScore: 4 },
    { meal: "Roasted white asparagus with lemon oil and capers on pumpernickel", calories: 220, protein: 6, carbs: 28, fat: 10, microScore: 4 },
  ],
};

type MealEntry = { meal: string; calories: number; protein: number; carbs: number; fat: number; microScore: number };
type MealDb = { breakfast: MealEntry[]; lunch: MealEntry[]; dinner: MealEntry[]; snack: MealEntry[] };

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

  if (preferences.excludedFoods?.length) {
    excludeKeywords.push(...preferences.excludedFoods);
  }

  const disliked = (preferences.dislikedMeals ?? []).map(m => m.toLowerCase());

  const filterWithDisliked = (pool: MealEntry[]): MealEntry[] => {
    let filtered = excludeKeywords.length ? filterMealPool(pool, excludeKeywords) : pool;
    if (disliked.length) {
      const withoutDisliked = filtered.filter(m => !disliked.includes(m.meal.toLowerCase()));
      filtered = withoutDisliked.length > 0 ? withoutDisliked : filtered;
    }
    return filtered;
  };

  return {
    breakfast: filterWithDisliked(mealDb.breakfast),
    lunch:     filterWithDisliked(mealDb.lunch),
    dinner:    filterWithDisliked(mealDb.dinner),
    snack:     filterWithDisliked(mealDb.snack),
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
    microScore: meal.microScore,
  };
}

// Cycle phase keyword lists — meals matching these get a small score boost
const CYCLE_PHASE_KEYWORDS: Record<string, string[]> = {
  menstrual:  ['beef', 'lentil', 'spinach', 'kale', 'bean', 'legume', 'salmon', 'broccoli', 'edamame', 'lamb', 'pumpkin seed'],
  follicular: ['egg', 'quinoa', 'yogurt', 'chicken', 'turkey', 'brown rice', 'oat', 'avocado', 'whole grain', 'kefir'],
  ovulatory:  ['salmon', 'berry', 'blueberry', 'raspberry', 'avocado', 'spinach', 'broccoli', 'asparagus', 'walnut', 'strawberry'],
  luteal:     ['turkey', 'sweet potato', 'banana', 'dark chocolate', 'cashew', 'almond', 'walnut', 'pumpkin', 'oat', 'chickpea'],
};

function computeCyclePhase(lastPeriodDate: string, cycleLength: number = 28, referenceDate?: string): string | null {
  const start = new Date(lastPeriodDate);
  if (isNaN(start.getTime())) return null;
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  if (isNaN(ref.getTime())) return null;
  ref.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diffMs = ref.getTime() - start.getTime();
  if (diffMs < 0) return null;
  const day = (Math.floor(diffMs / (1000 * 60 * 60 * 24)) % Math.max(cycleLength, 21)) + 1;
  if (day <= 5) return 'menstrual';
  if (day <= 13) return 'follicular';
  if (day <= 16) return 'ovulatory';
  return 'luteal';
}

// Score a meal's macro ratio distance from targets (lower is better)
function macroScore(m: MealEntry, tProtein: number, tCarbs: number, tFat: number): number {
  const pPct = (m.protein * 4) / m.calories;
  const cPct = (m.carbs   * 4) / m.calories;
  const fPct = (m.fat     * 9) / m.calories;
  return Math.abs(pPct - tProtein) + Math.abs(cPct - tCarbs) + Math.abs(fPct - tFat);
}

function pickBestMeal(
  pool: MealEntry[],
  tProtein: number,
  tCarbs: number,
  tFat: number,
  preferences?: UserPreferences | null,
  cyclePhase?: string | null,
): MealEntry {
  const phaseKeywords = cyclePhase ? (CYCLE_PHASE_KEYWORDS[cyclePhase] ?? []) : [];

  const scored = pool.map(m => {
    let score = macroScore(m, tProtein, tCarbs, tFat);

    if (preferences?.micronutrientOptimize && m.microScore) {
      score -= (m.microScore / 5) * 0.15;
    }

    if (preferences?.preferredFoods?.length) {
      const mealLower = m.meal.toLowerCase();
      const hasPreferred = preferences.preferredFoods.some(kw => mealLower.includes(kw.toLowerCase()));
      if (hasPreferred) score -= 0.2;
    }

    if (phaseKeywords.length) {
      const mealLower = m.meal.toLowerCase();
      const isPhaseMatch = phaseKeywords.some(kw => mealLower.includes(kw));
      if (isPhaseMatch) score -= 0.15;
    }

    return { meal: m, score };
  });

  scored.sort((a, b) => a.score - b.score);
  const topCount = Math.max(2, Math.ceil(scored.length / 3));
  const topCandidates = scored.slice(0, topCount);
  return topCandidates[Math.floor(Math.random() * topCandidates.length)].meal;
}

function buildDayPlan(
  dailyCalories: number,
  proteinGoal: number,
  carbsGoal: number,
  fatGoal: number,
  db: MealDb,
  lunchOverride?: MealEntry,
  preferences?: UserPreferences | null,
  cyclePhase?: string | null,
) {
  const bfTarget     = Math.round(dailyCalories * 0.25);
  const lunchTarget  = Math.round(dailyCalories * 0.30);
  const dinnerTarget = Math.round(dailyCalories * 0.35);
  const snackBudget  = dailyCalories - bfTarget - lunchTarget - dinnerTarget;

  const totalMacroCals = proteinGoal * 4 + carbsGoal * 4 + fatGoal * 9;
  const tProtein = (proteinGoal * 4) / totalMacroCals;
  const tCarbs   = (carbsGoal   * 4) / totalMacroCals;
  const tFat     = (fatGoal     * 9) / totalMacroCals;

  const breakfastBase = pickBestMeal(db.breakfast, tProtein, tCarbs, tFat, preferences, cyclePhase);
  const lunchBase     = lunchOverride ?? pickBestMeal(db.lunch, tProtein, tCarbs, tFat, preferences, cyclePhase);
  const dinnerBase    = pickBestMeal(db.dinner, tProtein, tCarbs, tFat, preferences, cyclePhase);

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
      const snackBase = pickBestMeal(db.snack, tProtein, tCarbs, tFat, preferences, cyclePhase);
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

function generateDayPlan(dailyCalories: number, proteinGoal: number, carbsGoal: number, fatGoal: number, db: MealDb, preferences?: UserPreferences | null, cyclePhase?: string | null) {
  return buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, undefined, preferences, cyclePhase);
}

function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function generateMealPlan(
  dailyCalories: number, proteinGoal: number, carbsGoal: number, fatGoal: number,
  isWeekly: boolean, db: MealDb, preferences?: UserPreferences | null,
  cyclePhase?: string | null,
  perDayPhases?: Record<string, string | null>,
) {
  const lunchTarget = Math.round(dailyCalories * 0.30);

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

    let previousDinnerBase: MealEntry | undefined = undefined;
    const dinnerTarget = Math.round(dailyCalories * 0.35);

    days.forEach((day, index) => {
      const dayPhase = perDayPhases?.[day] ?? cyclePhase ?? null;
      let dayPlan: ReturnType<typeof buildDayPlan>;

      if (index === 0) {
        const mondayDinnerBase = pickBestMeal(db.dinner, tProtein, tCarbs, tFat, preferences, dayPhase);
        const mondayLunch  = scaleMeal(mondayDinnerBase, lunchTarget);
        const mondayDinner = scaleMeal(mondayDinnerBase, dinnerTarget);

        const dayPlanBase = buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, mondayLunch, preferences, dayPhase);
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
        previousDinnerBase = mondayDinnerBase;
      } else {
        const lunchOverride = scaleMeal(previousDinnerBase!, lunchTarget);
        dayPlan = buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, lunchOverride, preferences, dayPhase);
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
      cyclePhaseByDay: perDayPhases ?? null,
    };
  } else {
    const dayPlan = generateDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, preferences, cyclePhase);
    return {
      planType: 'daily' as const,
      ...dayPlan,
      cyclePhase: cyclePhase ?? null,
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

  app.get("/api/auth/invite-required", (_req, res) => {
    res.json({ required: !!process.env.INVITE_CODES });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);

      const inviteCodes = process.env.INVITE_CODES;
      if (inviteCodes) {
        const validCodes = inviteCodes.split(",").map(c => c.trim().toLowerCase()).filter(Boolean);
        const submitted = (input.inviteCode ?? "").trim().toLowerCase();
        if (!submitted || !validCodes.includes(submitted)) {
          return res.status(400).json({ message: "Invalid invite code" });
        }
      }

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
    if (process.env.INVITE_CODES) {
      return res.status(403).json({ message: "OAuth registration is disabled during beta. Please use an invite code to register." });
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
    if (process.env.INVITE_CODES) {
      return res.status(403).json({ message: "OAuth registration is disabled during beta. Please use an invite code to register." });
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
    res.json((user?.preferences as UserPreferences | null) ?? { diet: null, allergies: [], excludedFoods: [], preferredFoods: [], micronutrientOptimize: false });
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
      let baseDb: MealDb = input.mealStyle === 'michelin' ? MICHELIN_MEAL_DATABASE : input.mealStyle === 'gourmet' ? GOURMET_MEAL_DATABASE : MEAL_DATABASE;

      let prefs: UserPreferences | null = null;
      if (req.session.userId) {
        const user = await storage.getUserById(req.session.userId);
        prefs = (user?.preferences as UserPreferences | null) ?? null;
        baseDb = filterMealDbByPreferences(baseDb, prefs);

        if (prefs?.recipeWebsitesEnabled) {
          const userRecipesList = await storage.getUserRecipes(req.session.userId);
          const style = input.mealStyle ?? 'simple';
          const limit = (prefs as any).recipeWeeklyLimit ?? 5;
          const enabledSlots: string[] = (prefs as any).recipeEnabledSlots ?? ["breakfast", "lunch", "dinner", "snack"];
          const eligible = userRecipesList.filter(r =>
            r.caloriesPerServing > 0 && r.proteinPerServing > 0 && r.carbsPerServing > 0 && r.fatPerServing > 0 &&
            r.mealStyle === style &&
            enabledSlots.includes(r.mealSlot)
          );
          const capped = [...eligible].sort(() => Math.random() - 0.5).slice(0, limit);
          for (const r of capped) {
            baseDb[r.mealSlot as keyof MealDb].push({
              meal: r.name,
              calories: r.caloriesPerServing,
              protein: r.proteinPerServing,
              carbs: r.carbsPerServing,
              fat: r.fatPerServing,
              microScore: 3,
            });
          }
        }
      }

      const hasCycle = !!(prefs?.cycleTrackingEnabled && prefs?.lastPeriodDate);

      if (input.planType === 'weekly') {
        let perDayPhases: Record<string, string | null> | undefined = undefined;
        if (hasCycle && input.weekStartDate) {
          const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
          perDayPhases = {};
          dayNames.forEach((dayName, i) => {
            const dateStr = addDaysToDate(input.weekStartDate!, i);
            perDayPhases![dayName] = computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, dateStr);
          });
        }
        const fallbackPhase = hasCycle ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28) : null;
        const mealPlan = generateMealPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, true, baseDb, prefs, fallbackPhase, perDayPhases);
        if (input.weekStartDate) (mealPlan as any).weekStartDate = input.weekStartDate;
        res.status(201).json(mealPlan);
      } else if (input.targetDates && input.targetDates.length > 1) {
        const plans: Record<string, any> = {};
        const cyclePhaseByDate: Record<string, string | null> = {};
        for (const dateStr of input.targetDates) {
          const phase = hasCycle ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, dateStr) : null;
          cyclePhaseByDate[dateStr] = phase;
          const dayPlan = generateDayPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, baseDb, prefs, phase);
          plans[dateStr] = { ...dayPlan, cyclePhase: phase };
        }
        res.status(201).json({ planType: 'multi-daily', days: plans, targetDates: input.targetDates, cyclePhaseByDate });
      } else {
        const targetDate = input.targetDates?.[0];
        const cyclePhase = hasCycle
          ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, targetDate)
          : null;
        const mealPlan = generateMealPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, false, baseDb, prefs, cyclePhase);
        if (targetDate) (mealPlan as any).targetDate = targetDate;
        res.status(201).json(mealPlan);
      }
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

  // ── Replace a single meal slot ─────────────────────────────────────────────

  const replaceMealSchema = z.object({
    slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    mealStyle: z.enum(['simple', 'gourmet', 'michelin']).optional().default('simple'),
    dailyCalories: z.number(),
    proteinGoal: z.number(),
    carbsGoal: z.number(),
    fatGoal: z.number(),
    currentMealName: z.string().optional(),
  });

  app.post("/api/meal-plans/replace-meal", async (req, res) => {
    try {
      const input = replaceMealSchema.parse(req.body);
      let baseDb: MealDb = input.mealStyle === 'michelin' ? MICHELIN_MEAL_DATABASE : input.mealStyle === 'gourmet' ? GOURMET_MEAL_DATABASE : MEAL_DATABASE;

      let prefs: UserPreferences | null = null;
      if (req.session.userId) {
        const user = await storage.getUserById(req.session.userId);
        prefs = (user?.preferences as UserPreferences | null) ?? null;
        baseDb = filterMealDbByPreferences(baseDb, prefs);

        if (prefs?.recipeWebsitesEnabled) {
          const userRecipesList = await storage.getUserRecipes(req.session.userId);
          const style = input.mealStyle ?? 'simple';
          const limit = (prefs as any).recipeWeeklyLimit ?? 5;
          const enabledSlots: string[] = (prefs as any).recipeEnabledSlots ?? ["breakfast", "lunch", "dinner", "snack"];
          const eligible = userRecipesList.filter(r =>
            r.caloriesPerServing > 0 && r.proteinPerServing > 0 && r.carbsPerServing > 0 && r.fatPerServing > 0 &&
            r.mealStyle === style &&
            enabledSlots.includes(r.mealSlot)
          );
          const capped = [...eligible].sort(() => Math.random() - 0.5).slice(0, limit);
          for (const r of capped) {
            baseDb[r.mealSlot as keyof MealDb].push({
              meal: r.name,
              calories: r.caloriesPerServing,
              protein: r.proteinPerServing,
              carbs: r.carbsPerServing,
              fat: r.fatPerServing,
              microScore: 3,
            });
          }
        }
      }

      const pool = baseDb[input.slot === 'snack' ? 'snack' : input.slot];
      const filtered = input.currentMealName
        ? pool.filter(m => m.meal !== input.currentMealName)
        : pool;
      const candidates = filtered.length > 0 ? filtered : pool;

      const totalMacroCals = input.proteinGoal * 4 + input.carbsGoal * 4 + input.fatGoal * 9;
      const tProtein = (input.proteinGoal * 4) / totalMacroCals;
      const tCarbs = (input.carbsGoal * 4) / totalMacroCals;
      const tFat = (input.fatGoal * 9) / totalMacroCals;

      const replCyclePhase = (prefs?.cycleTrackingEnabled && prefs?.lastPeriodDate)
        ? computeCyclePhase(prefs.lastPeriodDate, prefs.cycleLength ?? 28)
        : null;
      const picked = pickBestMeal(candidates, tProtein, tCarbs, tFat, prefs, replCyclePhase);

      const slotCalMap: Record<string, number> = {
        breakfast: 0.25,
        lunch: 0.30,
        dinner: 0.35,
        snack: 0.10,
      };
      const targetCals = Math.round(input.dailyCalories * slotCalMap[input.slot]);
      const scaled = scaleMeal(picked, targetCals);

      res.status(200).json(scaled);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // ── Saved meal plans ──────────────────────────────────────────────────────

  app.post("/api/saved-meal-plans", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const body = z.object({
        planData: z.any(),
        planType: z.enum(['daily', 'weekly']),
        mealStyle: z.enum(['simple', 'gourmet', 'michelin']).optional().default('simple'),
        calculationId: z.number().optional(),
        name: z.string().min(1).max(100).optional().default('My Plan'),
      }).parse(req.body);

      const saved = await storage.saveMealPlan({
        userId: req.session.userId,
        calculationId: body.calculationId,
        planType: body.planType,
        mealStyle: body.mealStyle,
        planData: body.planData,
        name: body.name,
      });

      try {
        const foodLogRows: Array<{ userId: number; date: string; mealName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot: string; confirmed: boolean }> = [];
        const planData = body.planData as any;

        const extractMeals = (dayData: any, dateStr: string) => {
          const slots = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
          for (const slot of slots) {
            const meals = dayData?.[slot];
            if (!Array.isArray(meals)) continue;
            for (const m of meals) {
              if (m?.meal && typeof m.calories === 'number') {
                foodLogRows.push({
                  userId: req.session.userId!,
                  date: dateStr,
                  mealName: m.meal,
                  calories: Math.round(m.calories),
                  protein: Math.round(m.protein ?? 0),
                  carbs: Math.round(m.carbs ?? 0),
                  fat: Math.round(m.fat ?? 0),
                  mealSlot: slot === 'snacks' ? 'snack' : slot,
                  confirmed: false,
                });
              }
            }
          }
        };

        if (planData.planType === 'multi-daily' && planData.days) {
          for (const dateStr of Object.keys(planData.days)) {
            extractMeals(planData.days[dateStr], dateStr);
          }
        } else if (body.planType === 'daily') {
          const targetDate = planData.targetDate || new Date().toISOString().split('T')[0];
          extractMeals(planData, targetDate);
        } else {
          const weekStart = planData.weekStartDate || new Date().toISOString().split('T')[0];
          const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          dayNames.forEach((dayName, i) => {
            if (planData[dayName]) {
              extractMeals(planData[dayName], addDaysToDate(weekStart, i));
            }
          });
        }

        if (foodLogRows.length > 0) {
          await storage.bulkCreateFoodLogEntries(foodLogRows);
        }
      } catch (logErr) {
        console.error('Failed to pre-populate food log from saved plan:', logErr);
      }

      res.status(201).json(saved);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

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

  app.post("/api/saved-meal-plans/:id/schedule", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const planId = parseInt(req.params.id);
      const body = z.object({
        targetDate: z.string().optional(),
        weekStartDate: z.string().optional(),
        force: z.boolean().optional().default(false),
        allowDuplicate: z.boolean().optional().default(false),
      }).parse(req.body);

      const plan = await storage.getSavedMealPlanById(planId, req.session.userId);
      if (!plan) return res.status(404).json({ message: "Plan not found" });

      const planData = plan.planData as any;

      const user = await storage.getUserById(req.session.userId);
      const prefs = (user?.preferences as UserPreferences | null) ?? null;
      const hasCycle = !!(prefs?.cycleTrackingEnabled && prefs?.lastPeriodDate && user?.gender === 'female');

      if (hasCycle && !body.force) {
        if (plan.planType === 'daily' && body.targetDate) {
          const storedPhase = planData?.cyclePhase || null;
          const targetPhase = computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, body.targetDate);
          if (storedPhase && targetPhase && storedPhase !== targetPhase) {
            return res.status(200).json({ mismatch: true, storedPhase, targetPhase });
          }
        } else if (plan.planType === 'weekly' && body.weekStartDate) {
          const storedPhases = planData?.perDayPhases || planData?.cyclePhaseByDay || {};
          const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
          let hasMismatch = false;
          let firstStoredPhase: string | null = null;
          let firstTargetPhase: string | null = null;
          dayNames.forEach((dayName, i) => {
            const storedP = storedPhases[dayName] || null;
            const targetP = computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, addDaysToDate(body.weekStartDate!, i));
            if (storedP && targetP && storedP !== targetP) {
              hasMismatch = true;
              if (!firstStoredPhase) { firstStoredPhase = storedP; firstTargetPhase = targetP; }
            }
          });
          if (hasMismatch) {
            return res.status(200).json({ mismatch: true, storedPhase: firstStoredPhase, targetPhase: firstTargetPhase });
          }
        }
      }

      const foodLogRows: Array<{ userId: number; date: string; mealName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot: string; confirmed: boolean }> = [];

      const extractMeals = (dayData: any, dateStr: string) => {
        const slots = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
        for (const slot of slots) {
          const meals = dayData?.[slot];
          if (!Array.isArray(meals)) continue;
          for (const m of meals) {
            if (m?.meal && typeof m.calories === 'number') {
              foodLogRows.push({
                userId: req.session.userId!,
                date: dateStr,
                mealName: m.meal,
                calories: Math.round(m.calories),
                protein: Math.round(m.protein ?? 0),
                carbs: Math.round(m.carbs ?? 0),
                fat: Math.round(m.fat ?? 0),
                mealSlot: slot === 'snacks' ? 'snack' : slot,
                confirmed: false,
              });
            }
          }
        }
      };

      if (plan.planType === 'daily') {
        const targetDate = body.targetDate || new Date().toISOString().split('T')[0];
        extractMeals(planData, targetDate);
      } else {
        const weekStart = body.weekStartDate || new Date().toISOString().split('T')[0];
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        dayNames.forEach((dayName, i) => {
          if (planData[dayName]) {
            extractMeals(planData[dayName], addDaysToDate(weekStart, i));
          }
        });
      }

      if (foodLogRows.length > 0 && !body.allowDuplicate) {
        const datesToCheck = [...new Set(foodLogRows.map(r => r.date))];
        const mealsByDate = new Map<string, Set<string>>();
        for (const row of foodLogRows) {
          if (!mealsByDate.has(row.date)) mealsByDate.set(row.date, new Set());
          mealsByDate.get(row.date)!.add(row.mealName.toLowerCase());
        }
        let duplicateCount = 0;
        for (const dateStr of datesToCheck) {
          const existing = await storage.getFoodLogEntries(req.session.userId, dateStr);
          const plannedNames = mealsByDate.get(dateStr);
          if (!plannedNames) continue;
          for (const entry of existing) {
            if (!entry.confirmed && plannedNames.has(entry.mealName.toLowerCase())) {
              duplicateCount++;
            }
          }
        }
        if (duplicateCount > 0) {
          return res.status(200).json({ duplicate: true, duplicateCount });
        }
      }

      if (foodLogRows.length > 0) {
        await storage.bulkCreateFoodLogEntries(foodLogRows);
      }

      const dateLabel = plan.planType === 'weekly' && body.weekStartDate
        ? `${body.weekStartDate} week`
        : (body.targetDate || 'today');

      res.status(200).json({ scheduled: true, entryCount: foodLogRows.length, dateLabel });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/saved-meal-plans/:id/generate-optimised", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const planId = parseInt(req.params.id);
      const body = z.object({
        targetDate: z.string().optional(),
        weekStartDate: z.string().optional(),
      }).parse(req.body);

      const plan = await storage.getSavedMealPlanById(planId, req.session.userId);
      if (!plan) return res.status(404).json({ message: "Plan not found" });

      const planData = plan.planData as any;

      const user = await storage.getUserById(req.session.userId);
      const prefs = (user?.preferences as UserPreferences | null) ?? null;
      const hasCycle = !!(prefs?.cycleTrackingEnabled && prefs?.lastPeriodDate && user?.gender === 'female');

      const dailyCal = plan.planType === 'weekly'
        ? Math.round((planData.weekTotalCalories || 2000) / 7)
        : (planData.dayTotalCalories || 2000);
      const dailyProt = plan.planType === 'weekly'
        ? Math.round((planData.weekTotalProtein || 150) / 7)
        : (planData.dayTotalProtein || 150);
      const dailyCarbs = plan.planType === 'weekly'
        ? Math.round((planData.weekTotalCarbs || 250) / 7)
        : (planData.dayTotalCarbs || 250);
      const dailyFat = plan.planType === 'weekly'
        ? Math.round((planData.weekTotalFat || 65) / 7)
        : (planData.dayTotalFat || 65);

      let baseDb: MealDb = plan.mealStyle === 'michelin' ? MICHELIN_MEAL_DATABASE : plan.mealStyle === 'gourmet' ? GOURMET_MEAL_DATABASE : MEAL_DATABASE;
      baseDb = filterMealDbByPreferences(baseDb, prefs);

      let newPlanData: any;

      if (plan.planType === 'weekly') {
        const ws = body.weekStartDate || new Date().toISOString().split('T')[0];
        let perDayPhases: Record<string, string | null> | undefined = undefined;
        if (hasCycle) {
          const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
          perDayPhases = {};
          dayNames.forEach((dayName, i) => {
            perDayPhases![dayName] = computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, addDaysToDate(ws, i));
          });
        }
        const fallbackPhase = hasCycle ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28) : null;
        newPlanData = generateMealPlan(dailyCal, dailyProt, dailyCarbs, dailyFat, true, baseDb, prefs, fallbackPhase, perDayPhases);
        newPlanData.weekStartDate = ws;
        if (perDayPhases) newPlanData.perDayPhases = perDayPhases;
      } else {
        const td = body.targetDate || new Date().toISOString().split('T')[0];
        const cyclePhase = hasCycle ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, td) : null;
        newPlanData = generateMealPlan(dailyCal, dailyProt, dailyCarbs, dailyFat, false, baseDb, prefs, cyclePhase);
        newPlanData.targetDate = td;
        if (cyclePhase) newPlanData.cyclePhase = cyclePhase;
      }

      const foodLogRows: Array<{ userId: number; date: string; mealName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot: string; confirmed: boolean }> = [];
      const extractMeals = (dayData: any, dateStr: string) => {
        const slots = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
        for (const slot of slots) {
          const meals = dayData?.[slot];
          if (!Array.isArray(meals)) continue;
          for (const m of meals) {
            if (m?.meal && typeof m.calories === 'number') {
              foodLogRows.push({
                userId: req.session.userId!,
                date: dateStr,
                mealName: m.meal,
                calories: Math.round(m.calories),
                protein: Math.round(m.protein ?? 0),
                carbs: Math.round(m.carbs ?? 0),
                fat: Math.round(m.fat ?? 0),
                mealSlot: slot === 'snacks' ? 'snack' : slot,
                confirmed: false,
              });
            }
          }
        }
      };

      if (plan.planType === 'daily') {
        extractMeals(newPlanData, body.targetDate || new Date().toISOString().split('T')[0]);
      } else {
        const ws = body.weekStartDate || new Date().toISOString().split('T')[0];
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        dayNames.forEach((dayName, i) => {
          if (newPlanData[dayName]) extractMeals(newPlanData[dayName], addDaysToDate(ws, i));
        });
      }

      if (foodLogRows.length > 0) {
        await storage.bulkCreateFoodLogEntries(foodLogRows);
      }

      res.status(200).json({ scheduled: true, entryCount: foodLogRows.length });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
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

  // ── Hydration tracking ────────────────────────────────────────────────────

  app.get("/api/hydration", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const date = z.string().min(1).parse(req.query.date as string);
    const logs = await storage.getHydrationLogs(req.session.userId, date);
    const totalMl = logs.reduce((sum, l) => sum + l.amountMl, 0);
    res.json({ logs, totalMl });
  });

  app.post("/api/hydration", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const body = z.object({
        date: z.string().min(1),
        amountMl: z.number().int().min(1).max(5000),
      }).parse(req.body);
      const log = await storage.createHydrationLog({ ...body, userId: req.session.userId });
      res.status(201).json(log);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete("/api/hydration/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    await storage.deleteHydrationLog(id, req.session.userId);
    res.status(204).send();
  });

  // ── Password reset ────────────────────────────────────────────────────────

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If that email is registered you will receive a reset link." });
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await storage.createPasswordResetToken(user.id, token, expiresAt);
      const appUrl = process.env.APP_URL || `http://localhost:5000`;
      const resetUrl = `${appUrl}/reset-password?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: "Reset your NutriSync password",
        html: buildPasswordResetEmailHtml(resetUrl, user.name),
      });
      res.json({ message: "If that email is registered you will receive a reset link." });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = z.object({ token: z.string(), password: z.string().min(6) }).parse(req.body);
      const row = await storage.getPasswordResetToken(token);
      if (!row) return res.status(400).json({ message: "Invalid or expired reset link." });
      if (row.usedAt) return res.status(400).json({ message: "This reset link has already been used." });
      if (row.expiresAt < new Date()) return res.status(400).json({ message: "This reset link has expired. Please request a new one." });
      const passwordHash = await bcrypt.hash(password, 12);
      await storage.updateUserPassword(row.userId, passwordHash);
      await storage.markPasswordResetTokenUsed(row.id);
      res.json({ message: "Password updated successfully." });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // ── Disliked meals ────────────────────────────────────────────────────────

  app.post("/api/preferences/disliked-meals", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const { mealName } = z.object({ mealName: z.string().min(1) }).parse(req.body);
    const user = await storage.getUserById(req.session.userId);
    const prefs = (user?.preferences as UserPreferences | null) ?? {};
    const existing = prefs.dislikedMeals ?? [];
    if (!existing.map(m => m.toLowerCase()).includes(mealName.toLowerCase())) {
      const updated: UserPreferences = { ...prefs, dislikedMeals: [...existing, mealName] };
      await storage.updateUserPreferences(req.session.userId, updated);
    }
    res.json({ message: "Meal disliked." });
  });

  app.delete("/api/preferences/disliked-meals/:mealName", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const mealName = decodeURIComponent(req.params.mealName);
    const user = await storage.getUserById(req.session.userId);
    const prefs = (user?.preferences as UserPreferences | null) ?? {};
    const updated: UserPreferences = {
      ...prefs,
      dislikedMeals: (prefs.dislikedMeals ?? []).filter(m => m.toLowerCase() !== mealName.toLowerCase()),
    };
    await storage.updateUserPreferences(req.session.userId, updated);
    res.json({ message: "Dislike removed." });
  });

  // ── Food search (Open Food Facts proxy) ──────────────────────────────────

  app.get("/api/food-search", async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    if (!q || q.length < 2) return res.json([]);
    try {
      // 1. Community library first (prioritised over USDA)
      const communityHits = await storage.searchCustomFoodsByName(q);
      const communityResults = communityHits.map(c => ({
        id: `community-${c.id}`,
        name: c.name,
        calories100g: c.calories100g,
        protein100g: parseFloat(String(c.protein100g)),
        carbs100g: parseFloat(String(c.carbs100g)),
        fat100g: parseFloat(String(c.fat100g)),
        servingSize: `${c.servingGrams}g`,
        servingGrams: c.servingGrams,
        source: "community",
      }));

      // 2. USDA fallback
      const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=25&api_key=${apiKey}`;
      const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
      let usdaResults: any[] = [];
      if (upstream.ok) {
        const data = await upstream.json() as any;
        const foods = (data.foods ?? []) as any[];
        const getNutrient = (nutrients: any[], id: number) =>
          nutrients.find((n: any) => n.nutrientId === id)?.value ?? 0;
        const getEnergy = (n: any[]) =>
          getNutrient(n, 1008) || getNutrient(n, 2047) || getNutrient(n, 2048);
        const communityNames = new Set(communityResults.map(r => r.name.toLowerCase()));
        usdaResults = foods
          .filter((f: any) => f.description && getEnergy(f.foodNutrients ?? []) > 0)
          .slice(0, 10)
          .map((f: any) => {
            const n = f.foodNutrients ?? [];
            const servingGrams = (f.servingSizeUnit === "g" || f.servingSizeUnit === "G")
              ? Math.round(parseFloat(f.servingSize) || 100)
              : 100;
            return {
              id: String(f.fdcId),
              name: f.description.charAt(0).toUpperCase() + f.description.slice(1).toLowerCase(),
              calories100g: Math.round(getEnergy(n)),
              protein100g: Math.round(getNutrient(n, 1003) * 10) / 10,
              carbs100g: Math.round(getNutrient(n, 1005) * 10) / 10,
              fat100g: Math.round(getNutrient(n, 1004) * 10) / 10,
              servingSize: servingGrams > 0 ? `${servingGrams}g` : "100g",
              servingGrams: servingGrams || 100,
            };
          })
          .filter((f: any) => !communityNames.has(f.name.toLowerCase()));
      }

      res.json([...communityResults, ...usdaResults].slice(0, 15));
    } catch {
      res.json([]);
    }
  });

  // ── Barcode lookup ────────────────────────────────────────────────────────

  // ── Label scan availability ───────────────────────────────────────────────

  app.get("/api/food-log/label-scan-available", (req, res) => {
    const available = !!process.env.OPENAI_API_KEY;
    res.json({ available });
  });

  // ── Photo label scan via GPT-4o Vision ────────────────────────────────────

  app.post("/api/food-log/extract-label", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const { imageBase64 } = req.body as { imageBase64?: string };
    if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Vision service unavailable" });

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const systemPrompt = `You are a nutrition label reader. Extract nutritional data from the provided food label image.
Return ONLY a JSON object with these exact fields (per 100g):
{
  "name": "<product name>",
  "calories100g": <number>,
  "protein100g": <number>,
  "carbs100g": <number>,
  "fat100g": <number>,
  "fibre100g": <number or null>,
  "sugar100g": <number or null>,
  "sodium100g": <number or null>,
  "saturatedFat100g": <number or null>,
  "servingGrams": <typical serving size in grams, default 100>,
  "sourceType": "label"
}
If you cannot confidently read the values from the label, estimate them based on food type and return sourceType "estimated".
Respond ONLY with the JSON — no markdown, no explanation.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } },
            ],
          },
        ],
        max_tokens: 512,
      });

      const text = response.choices[0]?.message?.content?.trim() ?? "";
      let extracted: any;
      try {
        const match = text.match(/\{[\s\S]*\}/);
        extracted = JSON.parse(match ? match[0] : text);
      } catch {
        return res.status(422).json({ error: "Could not parse nutrition data from image" });
      }

      const result = {
        id: `label-${Date.now()}`,
        name: String(extracted.name ?? "Scanned Food"),
        calories100g: Number(extracted.calories100g) || 0,
        protein100g: Number(extracted.protein100g) || 0,
        carbs100g: Number(extracted.carbs100g) || 0,
        fat100g: Number(extracted.fat100g) || 0,
        fibre100g: extracted.fibre100g != null ? Number(extracted.fibre100g) : undefined,
        sugar100g: extracted.sugar100g != null ? Number(extracted.sugar100g) : undefined,
        sodium100g: extracted.sodium100g != null ? Number(extracted.sodium100g) : undefined,
        saturatedFat100g: extracted.saturatedFat100g != null ? Number(extracted.saturatedFat100g) : undefined,
        servingGrams: Math.max(1, Number(extracted.servingGrams) || 100),
        servingSize: `${Math.max(1, Number(extracted.servingGrams) || 100)}g`,
        sourceType: (extracted.sourceType === "label" ? "label" : "estimated") as "label" | "estimated",
      };

      // Auto-save to community DB (dedup by name, skip if already exists)
      if (result.calories100g > 0) {
        const exists = await storage.customFoodExistsByName(result.name);
        if (!exists) {
          storage.createCustomFood({
            barcode: null,
            name: result.name,
            calories100g: result.calories100g,
            protein100g: result.protein100g,
            carbs100g: result.carbs100g,
            fat100g: result.fat100g,
            servingGrams: result.servingGrams,
            contributedByUserId: (req.user as any)?.id ?? null,
          }).catch(() => {});
        }
      }

      res.json(result);
    } catch (err: any) {
      console.error("Label scan error:", err?.message);
      res.status(500).json({ error: "Label scan failed" });
    }
  });

  // ── AI Food Recognition ──────────────────────────────────────────────────

  app.post("/api/food-log/recognize-food", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const { imageBase64, description } = req.body as { imageBase64?: string; description?: string };
    if (!imageBase64 && !description) return res.status(400).json({ error: "imageBase64 or description required" });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI service unavailable" });

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const systemPrompt = `You are a food identification and nutrition estimation expert.
${imageBase64 ? "Identify the food shown in the image." : `Identify the food described as: "${description}".`}
Return ONLY a JSON object with these exact fields (values per 100g):
{
  "name": "<concise food name>",
  "calories100g": <number>,
  "protein100g": <number>,
  "carbs100g": <number>,
  "fat100g": <number>,
  "fibre100g": <number or null>,
  "sugar100g": <number or null>,
  "sodium100g": <number or null>,
  "saturatedFat100g": <number or null>,
  "servingGrams": <estimated typical serving size in grams>,
  "sourceType": "estimated"
}
Be as accurate as possible. Use standard USDA-style nutritional values.
Respond ONLY with the JSON — no markdown, no explanation.`;

      const content: any[] = [{ type: "text", text: systemPrompt }];
      if (imageBase64) {
        content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content }],
        max_tokens: 512,
      });

      const text = response.choices[0]?.message?.content?.trim() ?? "";
      let extracted: any;
      try {
        const match = text.match(/\{[\s\S]*\}/);
        extracted = JSON.parse(match ? match[0] : text);
      } catch {
        return res.status(422).json({ error: "Could not identify food" });
      }

      const result = {
        id: `ai-${Date.now()}`,
        name: String(extracted.name ?? "Identified Food"),
        calories100g: Number(extracted.calories100g) || 0,
        protein100g: Number(extracted.protein100g) || 0,
        carbs100g: Number(extracted.carbs100g) || 0,
        fat100g: Number(extracted.fat100g) || 0,
        fibre100g: extracted.fibre100g != null ? Number(extracted.fibre100g) : undefined,
        sugar100g: extracted.sugar100g != null ? Number(extracted.sugar100g) : undefined,
        sodium100g: extracted.sodium100g != null ? Number(extracted.sodium100g) : undefined,
        saturatedFat100g: extracted.saturatedFat100g != null ? Number(extracted.saturatedFat100g) : undefined,
        servingGrams: Math.max(1, Number(extracted.servingGrams) || 100),
        servingSize: `${Math.max(1, Number(extracted.servingGrams) || 100)}g`,
        sourceType: "estimated" as const,
        source: "ai",
      };

      if (result.calories100g > 0) {
        const exists = await storage.customFoodExistsByName(result.name);
        if (!exists) {
          storage.createCustomFood({
            barcode: null,
            name: result.name,
            calories100g: result.calories100g,
            protein100g: result.protein100g,
            carbs100g: result.carbs100g,
            fat100g: result.fat100g,
            servingGrams: result.servingGrams,
            contributedByUserId: (req.user as any)?.id ?? null,
          }).catch(() => {});
        }
      }

      res.json(result);
    } catch (err: any) {
      console.error("Food recognition error:", err?.message);
      res.status(500).json({ error: "Food recognition failed" });
    }
  });

  app.get("/api/barcode/:barcode", async (req, res) => {
    const barcode = req.params.barcode;

    // 1. Check app's community database first
    const custom = await storage.getCustomFoodByBarcode(barcode);
    if (custom) {
      return res.json({
        id: `custom-${custom.id}`,
        name: custom.name,
        calories100g: custom.calories100g,
        protein100g: parseFloat(String(custom.protein100g)),
        carbs100g: parseFloat(String(custom.carbs100g)),
        fat100g: parseFloat(String(custom.fat100g)),
        servingSize: `${custom.servingGrams}g`,
        servingGrams: custom.servingGrams,
        source: "community",
      });
    }

    // Helper: silently cache a found product to community DB (dedup by name)
    const cacheToDb = (food: {
      name: string; calories100g: number; protein100g: number;
      carbs100g: number; fat100g: number; servingGrams: number;
    }) => {
      storage.customFoodExistsByName(food.name).then(exists => {
        if (!exists) {
          return storage.createCustomFood({
            barcode,
            name: food.name,
            calories100g: food.calories100g,
            protein100g: food.protein100g,
            carbs100g: food.carbs100g,
            fat100g: food.fat100g,
            servingGrams: food.servingGrams,
            contributedByUserId: null,
          });
        }
      }).catch(() => {});
    };

    // 2. Try Open Food Facts
    try {
      const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
      const offRes = await fetch(offUrl, { signal: AbortSignal.timeout(7000) });
      if (offRes.ok) {
        const offData = await offRes.json() as any;
        if (offData.status === 1 && offData.product) {
          const p = offData.product;
          const n = p.nutriments || {};
          const kcal100g = n["energy-kcal_100g"] ?? (n["energy_100g"] ? Math.round(n["energy_100g"] / 4.184) : 0);
          const name = (p.product_name_en || p.product_name || "").trim();
          if (kcal100g > 0 && name) {
            const servingGrams = Math.round(parseFloat(p.serving_quantity) || 100);
            const result = {
              id: `off-${barcode}`,
              name: name.charAt(0).toUpperCase() + name.slice(1),
              calories100g: Math.round(kcal100g),
              protein100g: Math.round((n.proteins_100g || 0) * 10) / 10,
              carbs100g: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
              fat100g: Math.round((n.fat_100g || 0) * 10) / 10,
              fibre100g: Math.round((n["fiber_100g"] ?? n["fibre_100g"] ?? 0) * 10) / 10,
              sodium100g: Math.round((n["sodium_100g"] || 0) * 1000) / 10,
              sugar100g: Math.round((n["sugars_100g"] ?? n["carbohydrates-sugars_100g"] ?? 0) * 10) / 10,
              saturatedFat100g: Math.round((n["saturated-fat_100g"] || 0) * 10) / 10,
              servingSize: p.serving_size || `${servingGrams}g`,
              servingGrams: servingGrams || 100,
              source: "open_food_facts",
            };
            cacheToDb(result);
            return res.json(result);
          }
        }
      }
    } catch {}

    // 3. Try USDA (barcode as UPC search)
    try {
      const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&pageSize=10&dataType=Branded&api_key=${apiKey}`;
      const upstream = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (upstream.ok) {
        const data = await upstream.json() as any;
        const foods = (data.foods ?? []) as any[];
        const match = foods.find((f: any) => f.gtinUpc === barcode);
        if (match) {
          const n = match.foodNutrients ?? [];
          const getNutrient = (id: number) => n.find((x: any) => x.nutrientId === id)?.value ?? 0;
          const getEnergy = () => getNutrient(1008) || getNutrient(2047) || getNutrient(2048);
          const calories100g = Math.round(getEnergy());
          if (calories100g > 0) {
            const servingGrams = (match.servingSizeUnit === "g" || match.servingSizeUnit === "G")
              ? Math.round(parseFloat(match.servingSize) || 100) : 100;
            const result = {
              id: String(match.fdcId),
              name: match.description.charAt(0).toUpperCase() + match.description.slice(1).toLowerCase(),
              calories100g,
              protein100g: Math.round(getNutrient(1003) * 10) / 10,
              carbs100g: Math.round(getNutrient(1005) * 10) / 10,
              fat100g: Math.round(getNutrient(1004) * 10) / 10,
              fibre100g: Math.round(getNutrient(1079) * 10) / 10,
              sodium100g: Math.round(getNutrient(1093) / 10) / 10,
              sugar100g: Math.round(getNutrient(2000) * 10) / 10,
              saturatedFat100g: Math.round(getNutrient(1258) * 10) / 10,
              servingSize: servingGrams > 0 ? `${servingGrams}g` : "100g",
              servingGrams: servingGrams || 100,
              source: "usda",
            };
            cacheToDb(result);
            return res.json(result);
          }
        }
      }
    } catch {}

    return res.status(404).json({ message: "Product not found" });
  });

  // ── Custom foods ──────────────────────────────────────────────────────────

  app.get("/api/custom-foods", async (req, res) => {
    const foods = await storage.getCustomFoods();
    res.json(foods);
  });

  app.post("/api/custom-foods", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const body = z.object({
        barcode: z.string().min(1),
        name: z.string().min(1),
        calories100g: z.number().int().min(0),
        protein100g: z.number().min(0),
        carbs100g: z.number().min(0),
        fat100g: z.number().min(0),
        servingGrams: z.number().int().min(1).default(100),
      }).parse(req.body);
      const existing = await storage.getCustomFoodByBarcode(body.barcode);
      if (existing) return res.status(200).json(existing);
      const food = await storage.createCustomFood({ ...body, contributedByUserId: req.session.userId });
      res.status(201).json(food);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete("/api/custom-foods/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const id = parseInt(req.params.id);
    await storage.deleteCustomFood(id, req.session.userId);
    res.json({ message: "Deleted" });
  });

  // ── User recipes ──────────────────────────────────────────────────────────

  function parseNutrientValue(raw: string | number | undefined): number | null {
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'number') return Math.round(raw);
    const match = String(raw).match(/[\d.]+/);
    return match ? Math.round(parseFloat(match[0])) : null;
  }

  app.post("/api/recipes/import", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const { url } = z.object({ url: z.string().url() }).parse(req.body);

    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NutriSync/1.0; +https://nutrisync.app)",
          "Accept": "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return res.status(400).json({ message: `Could not fetch that page (HTTP ${response.status})` });
      html = await response.text();
    } catch (e: any) {
      return res.status(400).json({ message: `Could not reach that URL: ${e?.message ?? 'timeout'}` });
    }

    const ldJsonBlocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    let recipe: any = null;

    for (const block of ldJsonBlocks) {
      try {
        let parsed = JSON.parse(block[1].trim());
        if (Array.isArray(parsed)) {
          parsed = parsed.find((p: any) => p["@type"] === "Recipe" || (Array.isArray(p["@type"]) && p["@type"].includes("Recipe")));
        } else if (parsed["@graph"]) {
          parsed = parsed["@graph"].find((p: any) => p["@type"] === "Recipe" || (Array.isArray(p["@type"]) && p["@type"].includes("Recipe")));
        }
        if (parsed && (parsed["@type"] === "Recipe" || (Array.isArray(parsed["@type"]) && parsed["@type"].includes("Recipe")))) {
          recipe = parsed;
          break;
        }
      } catch { continue; }
    }

    if (!recipe) return res.status(422).json({ message: "No recipe data found on that page. The site may not support structured recipe data." });

    const name: string = recipe.name ?? "Untitled Recipe";
    const imageUrl: string | null = Array.isArray(recipe.image)
      ? (typeof recipe.image[0] === 'string' ? recipe.image[0] : recipe.image[0]?.url ?? null)
      : (typeof recipe.image === 'string' ? recipe.image : recipe.image?.url ?? null);

    const ingredients: string[] = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [];
    const servingsRaw = recipe.recipeYield;
    const servings = typeof servingsRaw === 'number' ? servingsRaw
      : typeof servingsRaw === 'string' ? (parseInt(servingsRaw.match(/\d+/)?.[0] ?? '1') || 1)
      : Array.isArray(servingsRaw) ? (parseInt(String(servingsRaw[0]).match(/\d+/)?.[0] ?? '1') || 1)
      : 1;

    const nutrition = recipe.nutrition ?? null;
    const calories = nutrition ? parseNutrientValue(nutrition.calories) : null;
    const protein = nutrition ? parseNutrientValue(nutrition.proteinContent) : null;
    const carbs = nutrition ? parseNutrientValue(nutrition.carbohydrateContent) : null;
    const fat = nutrition ? parseNutrientValue(nutrition.fatContent) : null;

    // Detect suggested meal slot from Schema.org recipeCategory
    const categoryRaw = recipe.recipeCategory;
    const categories: string[] = Array.isArray(categoryRaw)
      ? categoryRaw.map((c: any) => String(c).toLowerCase())
      : typeof categoryRaw === 'string' ? [categoryRaw.toLowerCase()] : [];
    const SLOT_MAP: Array<[string[], string]> = [
      [["breakfast", "brunch", "morning"], "breakfast"],
      [["lunch", "midday"], "lunch"],
      [["snack", "appetizer", "starter", "side", "dessert"], "snack"],
      [["dinner", "main", "supper", "entree", "entrée", "evening"], "dinner"],
    ];
    let suggestedSlot: string | null = null;
    outer: for (const cat of categories) {
      for (const [keywords, slot] of SLOT_MAP) {
        if (keywords.some(k => cat.includes(k))) { suggestedSlot = slot; break outer; }
      }
    }

    res.json({
      name,
      imageUrl,
      ingredients,
      servings,
      sourceUrl: url,
      calories,
      protein,
      carbs,
      fat,
      hasNutrition: calories !== null,
      suggestedSlot,
    });
  });

  app.get("/api/recipes", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const recipes = await storage.getUserRecipes(req.session.userId);
    res.json(recipes);
  });

  app.post("/api/recipes", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const body = insertUserRecipeSchema.parse(req.body);
    const recipe = await storage.createUserRecipe({ ...body, userId: req.session.userId });
    res.status(201).json(recipe);
  });

  app.delete("/api/recipes/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const id = parseInt(req.params.id);
    await storage.deleteUserRecipe(id, req.session.userId);
    res.json({ message: "Deleted" });
  });

  // ── Food log ──────────────────────────────────────────────────────────────

  app.get("/api/food-log/recent", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const entries = await storage.getRecentFoodEntries(req.session.userId, 5);
    res.json(entries);
  });

  app.get("/api/food-log", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const { date, from, to } = req.query as { date?: string; from?: string; to?: string };
    if (from && to) {
      const entries = await storage.getFoodLogEntriesRange(req.session.userId, from, to);
      return res.json(entries);
    }
    const singleDate = date || new Date().toISOString().slice(0, 10);
    const entries = await storage.getFoodLogEntries(req.session.userId, singleDate);
    res.json(entries);
  });

  app.post("/api/food-log", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const body = z.object({
        date: z.string(),
        mealName: z.string().min(1),
        calories: z.number().int().min(0),
        protein: z.number().int().min(0),
        carbs: z.number().int().min(0),
        fat: z.number().int().min(0),
        mealSlot: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
      }).parse(req.body);
      const entry = await storage.createFoodLogEntry({ ...body, userId: req.session.userId });
      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/food-log/:id/confirm", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const id = parseInt(req.params.id);
    const updated = await storage.confirmFoodLogEntry(id, req.session.userId);
    if (!updated) return res.status(404).json({ message: "Entry not found" });
    res.json(updated);
  });

  app.delete("/api/food-log/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const id = parseInt(req.params.id);
    await storage.deleteFoodLogEntry(id, req.session.userId);
    res.status(204).send();
  });

  // ── Email meal plan ───────────────────────────────────────────────────────

  app.post("/api/saved-meal-plans/:id/email", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const planId = parseInt(req.params.id);
    const plan = await storage.getSavedMealPlanById(planId, req.session.userId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    let shoppingList: Record<string, Array<{ item: string; quantity: string }>> | undefined;
    if (req.body?.shoppingList && typeof req.body.shoppingList === 'object') {
      const raw = req.body.shoppingList as Record<string, unknown>;
      const validated: Record<string, Array<{ item: string; quantity: string }>> = {};
      for (const [cat, items] of Object.entries(raw)) {
        if (!Array.isArray(items)) continue;
        validated[String(cat).slice(0, 50)] = items
          .filter((i: any) => i && typeof i.item === 'string' && typeof i.quantity === 'string')
          .map((i: any) => ({ item: String(i.item).slice(0, 200), quantity: String(i.quantity).slice(0, 50) }));
      }
      if (Object.keys(validated).length > 0) shoppingList = validated;
    }
    const html = buildMealPlanEmailHtml(plan.name, user.name, plan.planData as any, plan.planType, shoppingList);
    await sendEmail({ to: user.email, subject: `Your NutriSync plan: ${plan.name}`, html });
    res.json({ message: "Plan sent to your email." });
  });

  return httpServer;
}
