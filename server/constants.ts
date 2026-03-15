import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait 15 minutes before trying again." },
  skipSuccessfulRequests: true,
});

export const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  gluten: ['toast', 'bread', 'pasta', 'spaghetti', 'noodle', 'tortilla', 'bagel', 'muffin', 'cracker', 'sourdough', 'rye', 'bulgur', 'couscous', 'crouton', 'flatbread', 'crepe', 'pancake', 'brioche', 'crostini', 'crispbread', 'wrap', 'pita', 'blini', 'linguine', 'polenta', 'oat', 'oats', 'oatmeal', 'granola', 'muesli', 'barley', 'spelt', 'wheat', 'pumpernickel', 'porridge'],
  crustaceans: ['prawn', 'shrimp', 'lobster', 'crab', 'crayfish', 'langoustine'],
  eggs: ['egg', 'omelette', 'frittata', 'shakshuka', 'huevos', 'benedict', 'french toast', 'quiche', 'mayo', 'mayonnaise', 'meringue', 'custard', 'hollandaise'],
  fish: ['salmon', 'tuna', 'cod', 'haddock', 'sea bass', 'trout', 'mackerel', 'anchovy', 'sardine', 'tilapia', 'halibut', 'sole', 'smoked fish', 'white fish'],
  peanuts: ['peanut', 'satay', 'groundnut'],
  soy: ['soy', 'edamame', 'tofu', 'miso', 'tempeh'],
  milk: ['cheese', 'butter', 'cream', 'milk', 'yogurt', 'yoghurt', 'ricotta', 'feta', 'mozzarella', 'parmesan', 'brie', 'gruyere', 'gruyère', 'mascarpone', 'hollandaise', 'creme fraiche', 'crème fraîche', 'burrata', 'manchego', 'ghee', 'whey', 'kefir', 'labneh', 'gelato', 'quark'],
  nuts: ['almond', 'walnut', 'hazelnut', 'pistachio', 'pecan', 'cashew', 'pine nut', 'nut butter', 'marcona', 'praline', 'marzipan', 'nougat', 'pesto', 'romesco', 'chestnut'],
  celery: ['celery', 'celeriac'],
  mustard: ['mustard'],
  sesame: ['sesame', 'tahini', 'hummus', 'halva', 'gomashio'],
  sulphites: ['sulphite', 'sulfite', 'dried fruit', 'wine vinegar'],
  lupin: ['lupin'],
  molluscs: ['scallop', 'mussel', 'clam', 'oyster', 'squid', 'calamari', 'octopus', 'snail'],
};

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
