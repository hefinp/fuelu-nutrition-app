import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait 15 minutes before trying again." },
  skipSuccessfulRequests: true,
});

import { ALLERGEN_KEYWORDS } from "@shared/allergen-keywords";
export { ALLERGEN_KEYWORDS };

export const MEAT_KEYWORDS = ['chicken', 'beef', 'lamb', 'pork', 'turkey', 'duck', 'veal', 'venison', 'steak', 'mince', 'chorizo', 'bacon', 'ham', 'prosciutto', 'pancetta', 'salami', 'liver', 'rib', 'bresaola', 'serrano', 'parma'];
export const PORK_KEYWORDS = ['pork', 'bacon', 'ham', 'pancetta', 'prosciutto', 'chorizo', 'salami', 'serrano', 'parma'];

export const FOOD_CATEGORY_KEYWORDS: Record<string, string[]> = {
  ...ALLERGEN_KEYWORDS,
  seafood: [...ALLERGEN_KEYWORDS.fish, ...ALLERGEN_KEYWORDS.crustaceans, ...ALLERGEN_KEYWORDS.molluscs],
  shellfish: [...ALLERGEN_KEYWORDS.crustaceans, ...ALLERGEN_KEYWORDS.molluscs],
  meat: MEAT_KEYWORDS,
  poultry: ['chicken', 'turkey', 'duck'],
  chicken: ['chicken'],
  turkey: ['turkey'],
  duck: ['duck'],
  pork: PORK_KEYWORDS,
  beef: ['beef', 'steak', 'bresaola'],
  lamb: ['lamb'],
  veal: ['veal'],
  venison: ['venison'],
  dairy: ALLERGEN_KEYWORDS.milk,
  wheat: ['bread', 'toast', 'pasta', 'spaghetti', 'noodle', 'tortilla', 'bagel', 'muffin', 'wrap', 'pita', 'flatbread', 'linguine', 'couscous'],
  red_meat: ['beef', 'lamb', 'veal', 'venison', 'steak', 'mince'],
  fried: ['fried', 'fritter', 'tempura', 'katsu', 'deep-fried'],
  fried_food: ['fried', 'fritter', 'tempura', 'katsu', 'deep-fried'],
  spicy: ['spicy', 'chilli', 'chili', 'jalapeño', 'sriracha', 'harissa', 'cayenne', 'chipotle', 'hot sauce', 'szechuan', 'jerk'],
  spicy_food: ['spicy', 'chilli', 'chili', 'jalapeño', 'sriracha', 'harissa', 'cayenne', 'chipotle', 'hot sauce', 'szechuan', 'jerk'],
  sugar: ['sugar', 'syrup', 'honey', 'caramel', 'candy', 'chocolate', 'brownie', 'cake', 'cookie', 'ice cream', 'gelato', 'sorbet', 'mousse', 'cheesecake'],
  sweets: ['sugar', 'syrup', 'honey', 'caramel', 'candy', 'chocolate', 'brownie', 'cake', 'cookie', 'ice cream', 'gelato', 'sorbet', 'mousse', 'cheesecake'],
  processed: ['bacon', 'ham', 'sausage', 'salami', 'chorizo', 'prosciutto', 'pancetta', 'hot dog', 'nugget', 'serrano', 'parma', 'bresaola'],
  processed_food: ['bacon', 'ham', 'sausage', 'salami', 'chorizo', 'prosciutto', 'pancetta', 'hot dog', 'nugget', 'serrano', 'parma', 'bresaola'],
  processed_meat: ['bacon', 'ham', 'sausage', 'salami', 'chorizo', 'prosciutto', 'pancetta', 'hot dog', 'nugget', 'serrano', 'parma', 'bresaola'],
  rice: ['rice', 'risotto', 'congee', 'pilaf', 'biryani', 'sushi'],
  coconut: ['coconut'],
  mushroom: ['mushroom', 'shiitake', 'portobello', 'chanterelle', 'truffle'],
  avocado: ['avocado', 'guacamole'],
  tomato: ['tomato', 'marinara', 'bolognese', 'salsa', 'ketchup'],
  onion: ['onion', 'shallot', 'scallion', 'leek'],
  garlic: ['garlic'],
};

export const CYCLE_PHASE_KEYWORDS: Record<string, string[]> = {
  menstrual:  ['beef', 'lentil', 'spinach', 'kale', 'bean', 'legume', 'salmon', 'broccoli', 'edamame', 'lamb', 'pumpkin seed'],
  follicular: ['egg', 'quinoa', 'yogurt', 'chicken', 'turkey', 'brown rice', 'oat', 'avocado', 'whole grain', 'kefir'],
  ovulatory:  ['salmon', 'berry', 'blueberry', 'raspberry', 'avocado', 'spinach', 'broccoli', 'asparagus', 'walnut', 'strawberry'],
  luteal:     ['turkey', 'sweet potato', 'banana', 'dark chocolate', 'cashew', 'almond', 'walnut', 'pumpkin', 'oat', 'chickpea'],
};

export const VITALITY_BOOST_KEYWORDS: string[] = [
  'egg', 'salmon', 'tuna', 'oyster', 'beef', 'lamb', 'turkey', 'chicken',
  'spinach', 'broccoli', 'kale', 'cauliflower', 'cabbage', 'brussels',
  'pumpkin seed', 'almond', 'walnut', 'brazil nut', 'cashew',
  'avocado', 'olive oil', 'coconut',
  'sweet potato', 'quinoa', 'oat', 'brown rice',
  'yogurt', 'cottage cheese',
  'garlic', 'ginger', 'turmeric',
  'berry', 'pomegranate', 'banana',
  'lentil', 'chickpea', 'bean', 'edamame',
];

export const VITALITY_RATIONALE: Record<string, string> = {
  egg: "Rich in vitamin D, cholesterol & complete protein",
  salmon: "Omega-3 fatty acids support overall wellbeing",
  tuna: "High in vitamin D & selenium",
  oyster: "Excellent source of zinc & B12",
  beef: "Iron, zinc & B12 for energy and vitality",
  lamb: "Rich in zinc & B12",
  turkey: "Lean protein with zinc & B6",
  chicken: "Quality protein with B6 & niacin",
  spinach: "Rich in magnesium & iron",
  broccoli: "Contains indole-3-carbinol, fibre & vitamin C",
  kale: "Packed with magnesium, iron & vitamin K",
  "pumpkin seed": "High in zinc & magnesium",
  almond: "Magnesium-rich with healthy fats",
  walnut: "Omega-3s & arginine support vascular health",
  "brazil nut": "Selenium-rich for thyroid function",
  avocado: "Healthy fats & potassium",
  "olive oil": "Monounsaturated fats for heart health",
  "sweet potato": "Complex carbs & vitamin A",
  quinoa: "Complete protein with zinc & magnesium",
  oat: "Beta-glucan & zinc for sustained energy",
  yogurt: "Probiotics & protein support nutrient absorption",
  garlic: "Allicin may help reduce inflammation",
  ginger: "May reduce inflammation & support digestion",
  turmeric: "Curcumin supports recovery & reduces inflammation",
  pomegranate: "Antioxidants support blood flow & recovery",
  banana: "B6 & potassium for energy",
  lentil: "Iron & zinc for sustained energy",
  chickpea: "Zinc & B6 with plant-based protein",
  edamame: "Plant protein with zinc & magnesium",
};
