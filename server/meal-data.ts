import type { UserPreferences } from "@shared/schema";
import { ALLERGEN_KEYWORDS, MEAT_KEYWORDS, PORK_KEYWORDS, FOOD_CATEGORY_KEYWORDS, CYCLE_PHASE_KEYWORDS, VITALITY_BOOST_KEYWORDS, VITALITY_RATIONALE } from "./constants";

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
    { meal: "Whole wheat pancakes with blueberries and maple syrup", calories: 390, protein: 14, carbs: 58, fat: 10, microScore: 3 },
    { meal: "Turkey sausage with scrambled eggs and wholemeal toast", calories: 410, protein: 34, carbs: 26, fat: 18, microScore: 3 },
    { meal: "Avocado and black bean breakfast wrap", calories: 380, protein: 16, carbs: 44, fat: 14, microScore: 4 },
    { meal: "Baked oatmeal with walnuts and cinnamon", calories: 350, protein: 12, carbs: 48, fat: 12, microScore: 3 },
    { meal: "Veggie breakfast burrito with peppers and salsa", calories: 370, protein: 18, carbs: 42, fat: 12, microScore: 4 },
    { meal: "Poached eggs on rye with avocado and tomato", calories: 390, protein: 22, carbs: 30, fat: 18, microScore: 5 },
    { meal: "Buckwheat porridge with banana and almond butter", calories: 360, protein: 14, carbs: 50, fat: 12, microScore: 4 },
    { meal: "Ham and cheese omelette with mixed greens", calories: 400, protein: 34, carbs: 8, fat: 24, microScore: 3 },
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
    { meal: "Grilled shrimp with couscous and roasted vegetables", calories: 470, protein: 38, carbs: 48, fat: 12, microScore: 4 },
    { meal: "Turkey and spinach wrap with hummus and cucumber", calories: 430, protein: 36, carbs: 38, fat: 14, microScore: 4 },
    { meal: "Baked cod with brown rice and steamed broccoli", calories: 450, protein: 40, carbs: 46, fat: 10, microScore: 5 },
    { meal: "Veggie burger on wholemeal bun with side salad", calories: 460, protein: 22, carbs: 52, fat: 14, microScore: 3 },
    { meal: "Pork tenderloin with quinoa and roasted peppers", calories: 500, protein: 42, carbs: 44, fat: 14, microScore: 4 },
    { meal: "Edamame and brown rice bowl with sesame ginger dressing", calories: 440, protein: 20, carbs: 56, fat: 12, microScore: 5 },
    { meal: "Chicken and vegetable soup with crusty bread", calories: 420, protein: 34, carbs: 42, fat: 10, microScore: 4 },
    { meal: "Egg salad on wholemeal bread with mixed greens", calories: 430, protein: 24, carbs: 36, fat: 18, microScore: 3 },
    { meal: "Grilled tofu with sweet potato and kale salad", calories: 440, protein: 22, carbs: 54, fat: 14, microScore: 5 },
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
    { meal: "Grilled cod with roasted potatoes and green beans", calories: 520, protein: 44, carbs: 48, fat: 12, microScore: 5 },
    { meal: "Chicken and broccoli stir-fry with brown rice", calories: 560, protein: 44, carbs: 56, fat: 12, microScore: 4 },
    { meal: "Beef and mushroom stew with crusty bread", calories: 600, protein: 46, carbs: 52, fat: 18, microScore: 3 },
    { meal: "Baked tilapia with couscous and roasted courgette", calories: 500, protein: 42, carbs: 50, fat: 10, microScore: 4 },
    { meal: "Black bean and sweet potato enchiladas with salad", calories: 540, protein: 22, carbs: 72, fat: 14, microScore: 4 },
    { meal: "Grilled turkey breast with mashed sweet potato and asparagus", calories: 540, protein: 46, carbs: 48, fat: 10, microScore: 4 },
    { meal: "Shrimp and vegetable pasta with marinara sauce", calories: 560, protein: 38, carbs: 64, fat: 12, microScore: 4 },
    { meal: "Stuffed bell peppers with rice, beans and vegetables", calories: 520, protein: 20, carbs: 70, fat: 12, microScore: 5 },
  ],
  snack: [
    { meal: "Protein bar", calories: 231, protein: 15, carbs: 24, fat: 8, microScore: 2 },
    { meal: "Apple", calories: 78, protein: 0, carbs: 21, fat: 0, microScore: 3 },
    { meal: "Greek yogurt", calories: 153, protein: 15, carbs: 8, fat: 6, microScore: 4 },
    { meal: "Granola", calories: 203, protein: 4, carbs: 27, fat: 8, microScore: 2 },
    { meal: "Trail mix", calories: 192, protein: 5, carbs: 18, fat: 11, microScore: 3 },
    { meal: "Banana", calories: 107, protein: 1, carbs: 27, fat: 0, microScore: 3 },
    { meal: "Cottage cheese", calories: 118, protein: 13, carbs: 4, fat: 5, microScore: 4 },
    { meal: "Mixed berries", calories: 86, protein: 1, carbs: 20, fat: 0, microScore: 5 },
    { meal: "Peanut butter (2 tbsp)", calories: 194, protein: 8, carbs: 5, fat: 16, microScore: 2 },
    { meal: "Wholemeal toast (2 slices)", calories: 137, protein: 6, carbs: 24, fat: 2, microScore: 2 },
    { meal: "Whole grain crackers", calories: 131, protein: 3, carbs: 22, fat: 4, microScore: 2 },
    { meal: "Hard-boiled eggs (2)", calories: 186, protein: 15, carbs: 0, fat: 14, microScore: 4 },
    { meal: "Almonds (handful)", calories: 91, protein: 3, carbs: 1, fat: 8, microScore: 4 },
    { meal: "Canned tuna", calories: 114, protein: 26, carbs: 0, fat: 1, microScore: 4 },
    { meal: "Rice cakes (4)", calories: 139, protein: 3, carbs: 29, fat: 1, microScore: 2 },
    { meal: "Edamame", calories: 121, protein: 12, carbs: 9, fat: 5, microScore: 5 },
    { meal: "Avocado (half)", calories: 128, protein: 2, carbs: 1, fat: 13, microScore: 4 },
    { meal: "Roasted chickpeas", calories: 114, protein: 4, carbs: 16, fat: 3, microScore: 4 },
    { meal: "Baby carrots", calories: 62, protein: 1, carbs: 14, fat: 0, microScore: 4 },
    { meal: "Hummus", calories: 111, protein: 4, carbs: 9, fat: 7, microScore: 3 },
    { meal: "String cheese", calories: 78, protein: 7, carbs: 1, fat: 5, microScore: 3 },
    { meal: "Dark chocolate (2 squares)", calories: 107, protein: 1, carbs: 11, fat: 7, microScore: 2 },
    { meal: "Beef jerky", calories: 89, protein: 10, carbs: 3, fat: 2, microScore: 3 },
  ],
};

export const FANCY_MEAL_DATABASE: MealDb = {
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
    { meal: "Turkish eggs with whipped yogurt, chilli butter and sourdough", calories: 430, protein: 26, carbs: 34, fat: 22, microScore: 4 },
    { meal: "Buckwheat galette with gruyère, ham and fried egg", calories: 440, protein: 30, carbs: 36, fat: 20, microScore: 3 },
    { meal: "Matcha smoothie bowl with kiwi, coconut and chia seeds", calories: 360, protein: 12, carbs: 52, fat: 12, microScore: 5 },
    { meal: "Smashed avocado on sourdough with dukkah and poached egg", calories: 410, protein: 22, carbs: 36, fat: 20, microScore: 5 },
    { meal: "Ricotta and honey toast with fresh figs and pistachios", calories: 380, protein: 16, carbs: 48, fat: 14, microScore: 3 },
    { meal: "Mushroom and gruyère frittata with dressed watercress", calories: 400, protein: 28, carbs: 14, fat: 24, microScore: 4 },
    { meal: "Spiced banana bread French toast with maple and pecans", calories: 450, protein: 14, carbs: 60, fat: 18, microScore: 2 },
    { meal: "Warm quinoa porridge with roasted plums and tahini", calories: 370, protein: 14, carbs: 54, fat: 10, microScore: 5 },
    { meal: "Scrambled tofu with turmeric, cherry tomatoes and sourdough", calories: 380, protein: 22, carbs: 40, fat: 14, microScore: 5 },
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
    { meal: "Grilled lamb kofta with tabbouleh and tzatziki", calories: 500, protein: 38, carbs: 40, fat: 18, microScore: 4 },
    { meal: "Seared duck and orange salad with wild rice and pecans", calories: 520, protein: 36, carbs: 42, fat: 20, microScore: 4 },
    { meal: "Harissa-spiced salmon with couscous and roasted courgette", calories: 510, protein: 42, carbs: 46, fat: 14, microScore: 5 },
    { meal: "Korean bibimbap with beef, pickled vegetables and gochujang", calories: 540, protein: 36, carbs: 58, fat: 14, microScore: 4 },
    { meal: "Grilled halloumi and roasted vegetable flatbread with harissa yogurt", calories: 480, protein: 24, carbs: 48, fat: 20, microScore: 3 },
    { meal: "Japanese miso soup with tofu, wakame and soba noodles", calories: 420, protein: 22, carbs: 56, fat: 10, microScore: 5 },
    { meal: "Pan-fried cod with warm lentil salad and salsa verde", calories: 470, protein: 40, carbs: 38, fat: 14, microScore: 5 },
    { meal: "Pulled chicken tacos with mango salsa and black beans", calories: 490, protein: 38, carbs: 50, fat: 12, microScore: 4 },
    { meal: "Mediterranean white bean and kale soup with garlic crostini", calories: 430, protein: 20, carbs: 54, fat: 12, microScore: 5 },
    { meal: "Tempeh and vegetable pad Thai with crushed peanuts", calories: 460, protein: 22, carbs: 58, fat: 14, microScore: 4 },
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
    { meal: "Grilled swordfish with olive tapenade, roasted peppers and orzo", calories: 580, protein: 44, carbs: 50, fat: 18, microScore: 4 },
    { meal: "Korean braised short ribs with sticky rice and pickled daikon", calories: 640, protein: 48, carbs: 54, fat: 22, microScore: 3 },
    { meal: "Pan-seared chicken thighs with romesco and charred broccolini", calories: 560, protein: 44, carbs: 40, fat: 20, microScore: 4 },
    { meal: "Prawn linguine with garlic, chilli, cherry tomatoes and basil", calories: 580, protein: 40, carbs: 62, fat: 14, microScore: 4 },
    { meal: "Harissa-roasted lamb chops with herbed couscous and mint yogurt", calories: 620, protein: 48, carbs: 50, fat: 20, microScore: 4 },
    { meal: "Teriyaki-glazed tofu with sesame greens and sticky rice", calories: 520, protein: 24, carbs: 72, fat: 12, microScore: 4 },
    { meal: "Wild mushroom and truffle risotto with shaved parmesan", calories: 560, protein: 18, carbs: 74, fat: 18, microScore: 3 },
    { meal: "Baked whole sea bream with fennel, lemon and olive oil potatoes", calories: 580, protein: 46, carbs: 46, fat: 18, microScore: 5 },
    { meal: "Stuffed portobello mushrooms with goat cheese, walnuts and lentils", calories: 540, protein: 22, carbs: 58, fat: 22, microScore: 5 },
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
    { meal: "Goat cheese and fig crostini with balsamic drizzle", calories: 250, protein: 12, carbs: 22, fat: 14, microScore: 3 },
    { meal: "Edamame hummus with crudités and seed crackers", calories: 220, protein: 12, carbs: 24, fat: 8, microScore: 5 },
    { meal: "Marinated olives with feta and sun-dried tomatoes", calories: 230, protein: 8, carbs: 10, fat: 18, microScore: 3 },
    { meal: "Spiced mango and coconut energy bites", calories: 200, protein: 6, carbs: 28, fat: 8, microScore: 3 },
    { meal: "Smoked trout pâté with oatcakes and cornichons", calories: 240, protein: 20, carbs: 16, fat: 10, microScore: 5 },
    { meal: "Grilled peach with burrata and prosciutto", calories: 260, protein: 16, carbs: 18, fat: 14, microScore: 4 },
    { meal: "Beetroot and walnut dip with wholemeal pitta", calories: 220, protein: 8, carbs: 28, fat: 10, microScore: 4 },
    { meal: "Dark chocolate bark with pistachios and dried cranberries", calories: 240, protein: 6, carbs: 24, fat: 14, microScore: 2 },
    { meal: "Roasted red pepper and white bean dip with grissini", calories: 210, protein: 10, carbs: 26, fat: 8, microScore: 4 },
    { meal: "Cucumber and avocado sushi rolls with soy dipping sauce", calories: 200, protein: 6, carbs: 30, fat: 8, microScore: 4 },
  ],
};

export const GOURMET_MEAL_DATABASE: MealDb = {
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
    { meal: "Lobster and chive omelette with brioche soldiers and crème fraîche", calories: 480, protein: 36, carbs: 28, fat: 24, microScore: 4 },
    { meal: "Truffle-infused scrambled eggs with grilled asparagus and parmesan", calories: 440, protein: 30, carbs: 18, fat: 26, microScore: 4 },
    { meal: "Buckwheat blinis with smoked salmon, dill cream and caviar", calories: 460, protein: 32, carbs: 32, fat: 22, microScore: 5 },
    { meal: "Baked fig and blue cheese tartine with honey and thyme", calories: 420, protein: 18, carbs: 46, fat: 18, microScore: 3 },
    { meal: "Vanilla bean panna cotta parfait with seasonal compote and granola", calories: 400, protein: 14, carbs: 50, fat: 16, microScore: 3 },
    { meal: "Roasted mushroom and taleggio croissant with truffle oil", calories: 470, protein: 20, carbs: 38, fat: 26, microScore: 3 },
    { meal: "Açaí and dragon fruit bowl with toasted macadamia and bee pollen", calories: 380, protein: 10, carbs: 58, fat: 12, microScore: 5 },
    { meal: "Grilled halloumi with za'atar, roasted tomatoes and sourdough", calories: 430, protein: 24, carbs: 34, fat: 22, microScore: 4 },
    { meal: "Warm coconut and turmeric oat bowl with poached rhubarb and pistachios", calories: 390, protein: 12, carbs: 56, fat: 12, microScore: 5 },
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
    { meal: "Lobster bisque with cognac cream and gruyère toast", calories: 500, protein: 32, carbs: 36, fat: 24, microScore: 4 },
    { meal: "Confit duck salad with pomegranate, hazelnuts and sherry dressing", calories: 520, protein: 38, carbs: 26, fat: 28, microScore: 4 },
    { meal: "Pan-seared halibut with brown butter, capers and crushed new potatoes", calories: 540, protein: 46, carbs: 38, fat: 20, microScore: 5 },
    { meal: "Slow-roasted pork belly salad with apple, fennel and mustard vinaigrette", calories: 540, protein: 40, carbs: 28, fat: 28, microScore: 4 },
    { meal: "Charred octopus with chorizo, butter beans and parsley oil", calories: 500, protein: 42, carbs: 34, fat: 20, microScore: 5 },
    { meal: "Spiced cauliflower steak with tahini, pomegranate and herb quinoa", calories: 460, protein: 16, carbs: 62, fat: 16, microScore: 5 },
    { meal: "Crab and avocado tian with yuzu dressing and micro herbs", calories: 440, protein: 28, carbs: 24, fat: 26, microScore: 5 },
    { meal: "Grilled lamb cutlets with pea and mint risotto and salsa verde", calories: 560, protein: 46, carbs: 42, fat: 22, microScore: 4 },
    { meal: "Wild mushroom and truffle arancini with saffron aioli and rocket", calories: 480, protein: 16, carbs: 58, fat: 20, microScore: 3 },
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
    { meal: "Grilled lobster tail with garlic herb butter, pommes Anna and wilted spinach", calories: 640, protein: 52, carbs: 38, fat: 26, microScore: 4 },
    { meal: "Venison loin with blackberry jus, celeriac purée and roasted parsnips", calories: 660, protein: 54, carbs: 42, fat: 28, microScore: 4 },
    { meal: "Pan-seared halibut with champagne beurre blanc, samphire and crushed potatoes", calories: 580, protein: 48, carbs: 40, fat: 20, microScore: 5 },
    { meal: "Osso buco with saffron risotto, gremolata and roasted tomatoes", calories: 680, protein: 50, carbs: 56, fat: 24, microScore: 4 },
    { meal: "Crispy-skinned barramundi with fennel, blood orange and olive salad", calories: 560, protein: 46, carbs: 36, fat: 22, microScore: 5 },
    { meal: "Herb-crusted rack of lamb with ratatouille and fondant potato", calories: 660, protein: 50, carbs: 44, fat: 30, microScore: 4 },
    { meal: "Beetroot and goat cheese Wellington with walnut crust and port reduction", calories: 580, protein: 22, carbs: 62, fat: 24, microScore: 4 },
    { meal: "Truffle and wild mushroom tasting with celery root purée and madeira jus", calories: 540, protein: 18, carbs: 66, fat: 20, microScore: 5 },
    { meal: "Stuffed courgette flowers with ricotta, pine nuts and romesco sauce", calories: 520, protein: 20, carbs: 56, fat: 22, microScore: 5 },
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
    { meal: "Beef carpaccio with truffle oil, rocket and parmesan shavings", calories: 240, protein: 22, carbs: 6, fat: 16, microScore: 4 },
    { meal: "Seared scallop with pea purée and crispy prosciutto", calories: 220, protein: 18, carbs: 14, fat: 10, microScore: 5 },
    { meal: "Foie gras mousse on brioche toast with fig compote", calories: 300, protein: 12, carbs: 22, fat: 20, microScore: 2 },
    { meal: "Tuna tataki with ponzu, pickled ginger and sesame", calories: 200, protein: 24, carbs: 10, fat: 8, microScore: 5 },
    { meal: "Grilled king prawns with garlic herb butter and lemon", calories: 220, protein: 22, carbs: 4, fat: 14, microScore: 4 },
    { meal: "Truffle and parmesan arancini with saffron aioli", calories: 280, protein: 10, carbs: 32, fat: 14, microScore: 2 },
    { meal: "Beetroot tartare with horseradish cream and micro herbs", calories: 180, protein: 4, carbs: 24, fat: 8, microScore: 5 },
    { meal: "Goat cheese and caramelised onion tartlet with dressed leaves", calories: 260, protein: 10, carbs: 20, fat: 16, microScore: 3 },
    { meal: "Marinated white anchovies with cherry peppers and sourdough", calories: 200, protein: 16, carbs: 18, fat: 8, microScore: 5 },
    { meal: "Coconut and passion fruit verrine with mango gel and toasted coconut", calories: 240, protein: 4, carbs: 34, fat: 10, microScore: 3 },
  ],
};

export function filterMealPoolStrict(pool: MealEntry[], excludeKeywords: string[]): MealEntry[] {
  if (!excludeKeywords.length) return pool;
  return pool.filter(m =>
    !excludeKeywords.some(kw => m.meal.toLowerCase().includes(kw.toLowerCase()))
  );
}

export function filterMealPoolSoft(pool: MealEntry[], excludeKeywords: string[]): MealEntry[] {
  if (!excludeKeywords.length) return pool;
  const filtered = pool.filter(m =>
    !excludeKeywords.some(kw => m.meal.toLowerCase().includes(kw.toLowerCase()))
  );
  return filtered.length > 0 ? filtered : pool;
}

export function containsExcludedKeyword(name: string, excludeKeywords: string[]): boolean {
  const lower = name.toLowerCase();
  return excludeKeywords.some(kw => lower.includes(kw.toLowerCase()));
}

export function buildSafetyKeywords(preferences: UserPreferences | null): string[] {
  if (!preferences) return [];
  const keywords: string[] = [];

  switch (preferences.diet) {
    case 'vegetarian':
      keywords.push(...MEAT_KEYWORDS, ...ALLERGEN_KEYWORDS.crustaceans, ...ALLERGEN_KEYWORDS.molluscs, ...ALLERGEN_KEYWORDS.fish);
      break;
    case 'vegan':
      keywords.push(...MEAT_KEYWORDS, ...ALLERGEN_KEYWORDS.crustaceans, ...ALLERGEN_KEYWORDS.molluscs, ...ALLERGEN_KEYWORDS.fish, ...ALLERGEN_KEYWORDS.milk, ...ALLERGEN_KEYWORDS.eggs);
      break;
    case 'pescatarian':
      keywords.push(...MEAT_KEYWORDS);
      break;
    case 'halal':
      keywords.push(...PORK_KEYWORDS);
      break;
    case 'kosher':
      keywords.push(...PORK_KEYWORDS, ...ALLERGEN_KEYWORDS.crustaceans, ...ALLERGEN_KEYWORDS.molluscs);
      break;
  }

  for (const allergy of (preferences.allergies ?? [])) {
    const kws = ALLERGEN_KEYWORDS[allergy];
    if (kws) keywords.push(...kws);
  }

  return keywords;
}

export function buildPreferenceKeywords(preferences: UserPreferences | null): string[] {
  if (!preferences) return [];
  const keywords: string[] = [];

  if (preferences.excludedFoods?.length) {
    for (const food of preferences.excludedFoods) {
      const categoryKws = FOOD_CATEGORY_KEYWORDS[food.trim().toLowerCase().replace(/\s+/g, '_')];
      if (categoryKws) {
        keywords.push(...categoryKws);
      } else {
        keywords.push(food.trim());
      }
    }
  }

  return keywords;
}

export function buildExcludeKeywords(preferences: UserPreferences | null): string[] {
  return [...buildSafetyKeywords(preferences), ...buildPreferenceKeywords(preferences)];
}

export function filterMealDbByPreferences(mealDb: MealDb, preferences: UserPreferences | null): MealDb {
  if (!preferences) return mealDb;

  const safetyKws = buildSafetyKeywords(preferences);
  const prefKws = buildPreferenceKeywords(preferences);
  const disliked = (preferences.dislikedMeals ?? []).map(m => m.toLowerCase());

  const filterSlot = (pool: MealEntry[]): MealEntry[] => {
    let filtered = safetyKws.length ? filterMealPoolStrict(pool, safetyKws) : pool;
    filtered = prefKws.length ? filterMealPoolStrict(filtered, prefKws) : filtered;
    if (disliked.length) {
      filtered = filtered.filter(m => !disliked.includes(m.meal.toLowerCase()));
    }
    return filtered;
  };

  return {
    breakfast: filterSlot(mealDb.breakfast),
    lunch:     filterSlot(mealDb.lunch),
    dinner:    filterSlot(mealDb.dinner),
    snack:     filterSlot(mealDb.snack),
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
): MealEntry | null {
  if (!pool.length) return null;
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

    if (preferences?.vitalityMeals) {
      const mealLower = m.meal.toLowerCase();
      const isVitalityMatch = VITALITY_BOOST_KEYWORDS.some(kw => mealLower.includes(kw));
      if (isVitalityMatch) score -= 0.12;
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
  fastingOverride?: FastingOverride | null,
) {
  const fasting = fastingOverride ?? null;

  const totalMacroCals = proteinGoal * 4 + carbsGoal * 4 + fatGoal * 9;
  const tProtein = (proteinGoal * 4) / totalMacroCals;
  const tCarbs   = (carbsGoal   * 4) / totalMacroCals;
  const tFat     = (fatGoal     * 9) / totalMacroCals;

  if (fasting?.lowCalDay) {
    const lunchBase = pickBestMeal(db.lunch, tProtein, tCarbs, tFat, preferences, cyclePhase);
    const lunchList = lunchBase ? [scaleMeal(lunchBase, 500)] : [];
    const dayTotalCalories = lunchList.reduce((s, m) => s + m.calories, 0);
    const dayTotalProtein  = lunchList.reduce((s, m) => s + m.protein,  0);
    const dayTotalCarbs    = lunchList.reduce((s, m) => s + m.carbs,    0);
    const dayTotalFat      = lunchList.reduce((s, m) => s + m.fat,      0);
    return {
      breakfast: [] as MealEntry[],
      lunch: lunchList,
      dinner: [] as MealEntry[],
      snacks: [] as MealEntry[],
      dayTotalCalories,
      dayTotalProtein,
      dayTotalCarbs,
      dayTotalFat,
      fastingDay: true,
    };
  }

  if (fasting?.omad) {
    const dinnerBase = pickBestMeal(db.dinner, tProtein, tCarbs, tFat, preferences, cyclePhase);
    const dinnerList = dinnerBase ? [scaleMeal(dinnerBase, dailyCalories)] : [];
    const dayTotalCalories = dinnerList.reduce((s, m) => s + m.calories, 0);
    const dayTotalProtein  = dinnerList.reduce((s, m) => s + m.protein,  0);
    const dayTotalCarbs    = dinnerList.reduce((s, m) => s + m.carbs,    0);
    const dayTotalFat      = dinnerList.reduce((s, m) => s + m.fat,      0);

    const addRationale = (meals: MealEntry[]) => {
      if (!preferences?.vitalityMeals) return meals;
      return meals.map(m => {
        const lower = m.meal.toLowerCase();
        const matched = Object.entries(VITALITY_RATIONALE).find(([kw]) => lower.includes(kw));
        return matched ? { ...m, vitalityRationale: matched[1] } : m;
      });
    };

    return {
      breakfast: [] as MealEntry[],
      lunch: [] as MealEntry[],
      dinner: addRationale(dinnerList),
      snacks: [] as MealEntry[],
      dayTotalCalories,
      dayTotalProtein,
      dayTotalCarbs,
      dayTotalFat,
    };
  }

  const skipSlots = fasting?.skipSlots ?? new Set<string>();
  const includeBreakfast = !skipSlots.has('breakfast');
  const includeLunch = !skipSlots.has('lunch');
  const includeDinner = !skipSlots.has('dinner');
  const includeSnack = !skipSlots.has('snack');

  const basePcts: Record<string, number> = { breakfast: 0.25, lunch: 0.30, dinner: 0.35, snack: 0.10 };
  const activeSlots: string[] = [];
  if (includeBreakfast) activeSlots.push('breakfast');
  if (includeLunch) activeSlots.push('lunch');
  if (includeDinner) activeSlots.push('dinner');
  if (includeSnack) activeSlots.push('snack');

  const slotPcts: Record<string, number> = {};
  for (const slot of activeSlots) {
    slotPcts[slot] = basePcts[slot];
  }

  const bfTarget     = includeBreakfast ? Math.round(dailyCalories * (slotPcts.breakfast ?? 0)) : 0;
  const lunchTarget  = includeLunch ? Math.round(dailyCalories * (slotPcts.lunch ?? 0)) : 0;
  const dinnerTarget = includeDinner ? Math.round(dailyCalories * (slotPcts.dinner ?? 0)) : 0;
  const snackBudget  = includeSnack ? Math.round(dailyCalories * basePcts.snack) : 0;

  let breakfastList: MealEntry[] = [];
  if (includeBreakfast) {
    const breakfastBase = pickBestMeal(db.breakfast, tProtein, tCarbs, tFat, preferences, cyclePhase);
    breakfastList = breakfastBase ? [scaleMeal(breakfastBase, bfTarget)] : [];
  }

  let lunchList: MealEntry[] = [];
  if (includeLunch) {
    const lunchBase = lunchOverride ?? pickBestMeal(db.lunch, tProtein, tCarbs, tFat, preferences, cyclePhase);
    lunchList = lunchBase ? [scaleMeal(lunchBase, lunchTarget)] : [];
  }

  let dinnerList: MealEntry[] = [];
  if (includeDinner) {
    const dinnerBase = pickBestMeal(db.dinner, tProtein, tCarbs, tFat, preferences, cyclePhase);
    dinnerList = dinnerBase ? [scaleMeal(dinnerBase, dinnerTarget)] : [];
  }

  const snacksList: MealEntry[] = [];
  if (includeSnack && snackBudget >= 150 && db.snack.length > 0) {
    const numSnacks = snackBudget >= 350 ? 2 : 1;
    const snackTargetEach = Math.round(snackBudget / numSnacks);

    for (let i = 0; i < numSnacks; i++) {
      const snackBase = pickBestMeal(db.snack, tProtein, tCarbs, tFat, preferences, cyclePhase);
      if (snackBase) {
        snacksList.push(scaleMeal(snackBase, snackTargetEach));
      }
    }
  }

  const allMeals = [...breakfastList, ...lunchList, ...dinnerList, ...snacksList];
  const dayTotalCalories = allMeals.reduce((s, m) => s + m.calories, 0);
  const dayTotalProtein  = allMeals.reduce((s, m) => s + m.protein,  0);
  const dayTotalCarbs    = allMeals.reduce((s, m) => s + m.carbs,    0);
  const dayTotalFat      = allMeals.reduce((s, m) => s + m.fat,      0);

  const addRationale = (meals: MealEntry[]) => {
    if (!preferences?.vitalityMeals) return meals;
    return meals.map(m => {
      const lower = m.meal.toLowerCase();
      const matched = Object.entries(VITALITY_RATIONALE).find(([kw]) => lower.includes(kw));
      return matched ? { ...m, vitalityRationale: matched[1] } : m;
    });
  };

  return {
    breakfast: addRationale(breakfastList),
    lunch: addRationale(lunchList),
    dinner: addRationale(dinnerList),
    snacks: addRationale(snacksList),
    dayTotalCalories,
    dayTotalProtein,
    dayTotalCarbs,
    dayTotalFat,
  };
}

const MEAL_SLOT_HOURS: Record<string, number> = {
  breakfast: 8,
  lunch: 12,
  dinner: 19,
  snack: 15,
};

export type FastingOverride = {
  isFastingDay: boolean;
  lowCalDay?: boolean;
  omad?: boolean;
  skipSlots: Set<string>;
};

function isHourInWindow(hour: number, windowStart: number, windowEnd: number): boolean {
  if (windowStart < windowEnd) {
    return hour >= windowStart && hour < windowEnd;
  }
  return hour >= windowStart || hour < windowEnd;
}

const VALID_FASTING_DAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

export function computeFastingOverride(
  preferences: UserPreferences | null | undefined,
  dayName?: string,
): FastingOverride | null {
  if (!preferences?.fastingEnabled || !preferences.fastingProtocol) return null;

  const protocol = preferences.fastingProtocol;

  if (protocol === '5:2') {
    const fastDays = preferences.fastingDays ?? ['monday', 'thursday'];
    if (dayName && VALID_FASTING_DAYS.has(dayName) && (fastDays as readonly string[]).includes(dayName)) {
      return { isFastingDay: true, lowCalDay: true, skipSlots: new Set(['breakfast', 'dinner', 'snack']) };
    }
    return null;
  }

  if (protocol === 'omad') {
    return { isFastingDay: true, omad: true, skipSlots: new Set(['breakfast', 'snack']) };
  }

  const windowStart = preferences.eatingWindowStart ?? 12;
  const windowEnd = preferences.eatingWindowEnd ?? 20;

  const skipSlots = new Set<string>();
  for (const [slot, hour] of Object.entries(MEAL_SLOT_HOURS)) {
    if (!isHourInWindow(hour, windowStart, windowEnd)) {
      skipSlots.add(slot);
    }
  }

  if (skipSlots.size === 0) return null;

  return { isFastingDay: true, skipSlots };
}

export function generateDayPlan(dailyCalories: number, proteinGoal: number, carbsGoal: number, fatGoal: number, db: MealDb, preferences?: UserPreferences | null, cyclePhase?: string | null, dayName?: string, excludeSlots?: string[]) {
  let fastingOverride = computeFastingOverride(preferences, dayName);
  if (excludeSlots && excludeSlots.length > 0) {
    const merged = new Set(fastingOverride?.skipSlots ?? []);
    for (const s of excludeSlots) merged.add(s);
    fastingOverride = { isFastingDay: true, ...fastingOverride, skipSlots: merged };
  }
  return buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, undefined, preferences, cyclePhase, fastingOverride);
}

const SLOT_CUTOFF_HOURS_BACKEND: Record<string, number> = {
  breakfast: 10,
  lunch: 14,
  snack: 16,
  dinner: 20,
};

export function getPastSlotsForDate(dateStr: string, now: Date): string[] {
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (dateStr < todayStr) {
    return ['breakfast', 'lunch', 'dinner', 'snack'];
  }
  if (dateStr > todayStr) {
    return [];
  }
  const currentHour = now.getHours() + now.getMinutes() / 60;
  return Object.entries(SLOT_CUTOFF_HOURS_BACKEND)
    .filter(([, cutoff]) => currentHour >= cutoff)
    .map(([slot]) => slot);
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
  dayName?: string,
  excludeSlots?: string[],
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
      let dayFasting = computeFastingOverride(preferences, day);
      if (excludeSlots && excludeSlots.length > 0) {
        const merged = new Set(dayFasting?.skipSlots ?? []);
        for (const s of excludeSlots) merged.add(s);
        dayFasting = { isFastingDay: true, ...dayFasting, skipSlots: merged };
      }
      let dayPlan: ReturnType<typeof buildDayPlan>;

      if (dayFasting) {
        dayPlan = buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, undefined, preferences, dayPhase, dayFasting);
        previousDinnerBase = undefined;
      } else if (index === 0) {
        const mondayDinnerBase = pickBestMeal(db.dinner, tProtein, tCarbs, tFat, preferences, dayPhase);
        if (mondayDinnerBase) {
          const mondayLunch  = scaleMeal(mondayDinnerBase, lunchTarget);
          const mondayDinner = scaleMeal(mondayDinnerBase, dinnerTarget);

          const dayPlanBase = buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, mondayLunch, preferences, dayPhase);
          const allMeals = [...dayPlanBase.breakfast, mondayLunch, mondayDinner, ...dayPlanBase.snacks];
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
          dayPlan = buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, undefined, preferences, dayPhase);
          previousDinnerBase = undefined;
        }
      } else {
        const lunchOverride = previousDinnerBase ? scaleMeal(previousDinnerBase, lunchTarget) : undefined;
        dayPlan = buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, lunchOverride, preferences, dayPhase, dayFasting);
        const dinnerBase = dayPlan.dinner.length > 0
          ? (db.dinner.find(m => m.meal === dayPlan.dinner[0].meal) ?? dayPlan.dinner[0])
          : undefined;
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
    let fastingOverride = computeFastingOverride(preferences, dayName);
    if (excludeSlots && excludeSlots.length > 0) {
      const merged = new Set(fastingOverride?.skipSlots ?? []);
      for (const s of excludeSlots) merged.add(s);
      fastingOverride = { isFastingDay: true, ...fastingOverride, skipSlots: merged };
    }
    const dayPlan = buildDayPlan(dailyCalories, proteinGoal, carbsGoal, fatGoal, db, undefined, preferences, cyclePhase, fastingOverride);
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
