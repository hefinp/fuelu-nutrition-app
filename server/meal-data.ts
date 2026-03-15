import type { UserPreferences } from "@shared/schema";
import { ALLERGEN_KEYWORDS, MEAT_KEYWORDS, PORK_KEYWORDS, FOOD_CATEGORY_KEYWORDS, CYCLE_PHASE_KEYWORDS } from "./constants";

export type MealEntry = { meal: string; calories: number; protein: number; carbs: number; fat: number; microScore: number };
export type MealDb = { breakfast: MealEntry[]; lunch: MealEntry[]; dinner: MealEntry[]; snack: MealEntry[] };

export const MEAL_DATABASE: MealDb = {
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

export const GOURMET_MEAL_DATABASE: MealDb = {
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

export const MICHELIN_MEAL_DATABASE: MealDb = {
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

export function filterMealPool(pool: MealEntry[], excludeKeywords: string[]): MealEntry[] {
  if (!excludeKeywords.length) return pool;
  const filtered = pool.filter(m =>
    !excludeKeywords.some(kw => m.meal.toLowerCase().includes(kw.toLowerCase()))
  );
  return filtered.length > 0 ? filtered : pool;
}

export function filterMealDbByPreferences(mealDb: MealDb, preferences: UserPreferences | null): MealDb {
  if (!preferences) return mealDb;

  const excludeKeywords: string[] = [];

  switch (preferences.diet) {
    case 'vegetarian':
      excludeKeywords.push(...MEAT_KEYWORDS, ...ALLERGEN_KEYWORDS.crustaceans, ...ALLERGEN_KEYWORDS.molluscs, ...ALLERGEN_KEYWORDS.fish);
      break;
    case 'vegan':
      excludeKeywords.push(...MEAT_KEYWORDS, ...ALLERGEN_KEYWORDS.crustaceans, ...ALLERGEN_KEYWORDS.molluscs, ...ALLERGEN_KEYWORDS.fish, ...ALLERGEN_KEYWORDS.milk, ...ALLERGEN_KEYWORDS.eggs);
      break;
    case 'pescatarian':
      excludeKeywords.push(...MEAT_KEYWORDS);
      break;
    case 'halal':
      excludeKeywords.push(...PORK_KEYWORDS);
      break;
    case 'kosher':
      excludeKeywords.push(...PORK_KEYWORDS, ...ALLERGEN_KEYWORDS.crustaceans, ...ALLERGEN_KEYWORDS.molluscs);
      break;
  }

  for (const allergy of (preferences.allergies ?? [])) {
    const kws = ALLERGEN_KEYWORDS[allergy];
    if (kws) excludeKeywords.push(...kws);
  }

  if (preferences.excludedFoods?.length) {
    for (const food of preferences.excludedFoods) {
      const categoryKws = FOOD_CATEGORY_KEYWORDS[food.trim().toLowerCase().replace(/\s+/g, '_')];
      if (categoryKws) {
        excludeKeywords.push(...categoryKws);
      } else {
        excludeKeywords.push(food.trim());
      }
    }
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

export function filterMealDbByRecentLog(mealDb: MealDb, recentMealNames: string[]): MealDb {
  if (!recentMealNames.length) return mealDb;
  const recent = recentMealNames.map(n => n.toLowerCase());
  const dedup = (pool: MealEntry[]): MealEntry[] => {
    const filtered = pool.filter(m => !recent.includes(m.meal.toLowerCase()));
    return filtered.length > 0 ? filtered : pool;
  };
  return {
    breakfast: dedup(mealDb.breakfast),
    lunch:     dedup(mealDb.lunch),
    dinner:    dedup(mealDb.dinner),
    snack:     dedup(mealDb.snack),
  };
}

export function scaleMeal(meal: MealEntry, targetCalories: number): MealEntry {
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

export function computeCyclePhase(lastPeriodDate: string, cycleLength: number = 28, referenceDate?: string): string | null {
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

function macroScore(m: MealEntry, tProtein: number, tCarbs: number, tFat: number): number {
  const pPct = (m.protein * 4) / m.calories;
  const cPct = (m.carbs   * 4) / m.calories;
  const fPct = (m.fat     * 9) / m.calories;
  return Math.abs(pPct - tProtein) + Math.abs(cPct - tCarbs) + Math.abs(fPct - tFat);
}

export function pickBestMeal(
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
      const hasPreferred = preferences.preferredFoods.some(kw => {
        const key = kw.trim().toLowerCase().replace(/\s+/g, '_');
        const expanded = FOOD_CATEGORY_KEYWORDS[key];
        if (expanded) {
          return expanded.some(ek => mealLower.includes(ek));
        }
        return mealLower.includes(kw.trim().toLowerCase());
      });
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

export function buildDayPlan(
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

export function generateDayPlan(dailyCalories: number, proteinGoal: number, carbsGoal: number, fatGoal: number, db: MealDb, preferences?: UserPreferences | null, cyclePhase?: string | null) {
  return buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, undefined, preferences, cyclePhase);
}

export function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function generateMealPlan(
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

export function calculateMacros(weight: number, height: number, age: number, gender: string, activityLevel: string, goal: string = 'maintain') {
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
  const fibreGoal = 30;
  const sugarGoal = Math.round((dailyCalories * 0.10) / 4);
  const saturatedFatGoal = Math.round((dailyCalories * 0.10) / 9);

  return { dailyCalories, weeklyCalories, proteinGoal, carbsGoal, fatGoal, fibreGoal, sugarGoal, saturatedFatGoal };
}
