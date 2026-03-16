import { pgTable, serial, integer, numeric, real, timestamp, text, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tierEnum = ["free", "simple", "advanced", "payg"] as const;
export type Tier = typeof tierEnum[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  provider: text("provider"),
  providerId: text("provider_id"),
  preferences: jsonb("preferences"),
  tier: text("tier").notNull().default("free"),
  betaUser: boolean("beta_user").notNull().default(false),
  betaTierLocked: boolean("beta_tier_locked").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  tierExpiresAt: timestamp("tier_expires_at"),
  creditBalance: integer("credit_balance").notNull().default(0),
  pendingTier: text("pending_tier"),
  paymentFailedAt: timestamp("payment_failed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true,
  passwordHash: true,
}).extend({
  passwordHash: z.string().optional(),
  provider: z.string().optional(),
  providerId: z.string().optional(),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  inviteCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PublicUser = Omit<User, "passwordHash" | "stripeCustomerId" | "stripeSubscriptionId" | "paymentFailedAt">;

export const userPreferencesSchema = z.object({
  diet: z.enum(["vegetarian", "vegan", "pescatarian", "halal", "kosher"]).nullable().optional(),
  allergies: z.array(z.enum(["gluten", "crustaceans", "eggs", "fish", "peanuts", "soy", "milk", "nuts", "celery", "mustard", "sesame", "sulphites", "lupin", "molluscs"])).optional(),
  excludedFoods: z.array(z.string()).optional(),
  preferredFoods: z.array(z.string()).optional(),
  micronutrientOptimize: z.boolean().optional(),
  dislikedMeals: z.array(z.string()).optional(),
  recipeWebsitesEnabled: z.boolean().optional(),
  recipeWebsites: z.array(z.string()).optional(),
  recipeEnabledSlots: z.array(z.enum(["breakfast", "lunch", "dinner", "snack"])).optional(),
  recipeWeeklyLimit: z.number().int().min(1).max(14).optional(),
  hydrationGoalMl: z.number().int().min(500).max(6000).optional(),
  hydrationUnit: z.enum(["ml", "glasses"]).optional(),
  dashboardLayout: z.object({
    order: z.array(z.string()),
  }).optional(),
  hiddenWidgets: z.array(z.string()).optional(),
  cycleTrackingEnabled: z.boolean().optional(),
  lastPeriodDate: z.string().optional(),
  cycleLength: z.number().int().min(21).max(35).optional(),
  periodLength: z.number().int().min(2).max(8).optional(),
  onboardingComplete: z.boolean().optional(),
  includeCommunityMeals: z.boolean().optional(),
  vitalityInsightsEnabled: z.boolean().optional(),
  hormoneBoostingMeals: z.boolean().optional(),
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const calculations = pgTable("calculations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  weight: numeric("weight").notNull(),
  height: numeric("height").notNull(),
  age: integer("age").default(30),
  gender: text("gender").default('male'),
  activityLevel: text("activity_level").default('moderate'),
  goal: text("goal").default('maintain'),
  targetType: text("target_type").default('weekly'),
  targetAmount: numeric("target_amount"),
  dailyCalories: integer("daily_calories").notNull(),
  weeklyCalories: integer("weekly_calories").notNull(),
  proteinGoal: integer("protein_goal").notNull(),
  carbsGoal: integer("carbs_goal").notNull(),
  fatGoal: integer("fat_goal").notNull(),
  fibreGoal: integer("fibre_goal"),
  sugarGoal: integer("sugar_goal"),
  saturatedFatGoal: integer("saturated_fat_goal"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCalculationSchema = createInsertSchema(calculations).pick({
  weight: true,
  height: true,
  age: true,
  gender: true,
  activityLevel: true,
  goal: true,
  targetType: true,
  targetAmount: true,
});

export type InsertCalculation = z.infer<typeof insertCalculationSchema>;
export type Calculation = typeof calculations.$inferSelect;

export const savedMealPlans = pgTable("saved_meal_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  calculationId: integer("calculation_id").references(() => calculations.id),
  name: text("name").notNull().default("My Meal Plan"),
  planType: text("plan_type").notNull(),
  mealStyle: text("meal_style").default('simple'),
  planData: jsonb("plan_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSavedMealPlanSchema = createInsertSchema(savedMealPlans).omit({
  id: true,
  createdAt: true,
});

export type InsertSavedMealPlan = z.infer<typeof insertSavedMealPlanSchema>;
export type SavedMealPlan = typeof savedMealPlans.$inferSelect;

export const weightEntries = pgTable("weight_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  weight: numeric("weight").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

export const insertWeightEntrySchema = createInsertSchema(weightEntries).pick({
  weight: true,
  recordedAt: true,
}).extend({
  weight: z.string().min(1, "Weight is required"),
  recordedAt: z.string().optional(),
});

export type InsertWeightEntry = z.infer<typeof insertWeightEntrySchema>;
export type WeightEntry = typeof weightEntries.$inferSelect;

export const communityMeals = pgTable("community_meals", {
  id: serial("id").primaryKey(),
  sourceRecipeId: integer("source_recipe_id"),
  sourceUserId: integer("source_user_id").references(() => users.id),
  name: text("name").notNull(),
  slot: text("slot").notNull(),
  style: text("style").notNull().default("simple"),
  caloriesPerServing: integer("calories_per_serving").notNull(),
  proteinPerServing: integer("protein_per_serving").notNull(),
  carbsPerServing: integer("carbs_per_serving").notNull(),
  fatPerServing: integer("fat_per_serving").notNull(),
  microScore: integer("micro_score").notNull().default(3),
  favouriteCount: integer("favourite_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  source: text("source").notNull().default("user"),
  ingredients: text("ingredients").array(),
  instructions: text("instructions"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommunityMealSchema = createInsertSchema(communityMeals).omit({
  id: true,
  createdAt: true,
  favouriteCount: true,
});

export type InsertCommunityMeal = z.infer<typeof insertCommunityMealSchema>;
export type CommunityMeal = typeof communityMeals.$inferSelect;

export const foodLogEntries = pgTable("food_log_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: text("date").notNull(),
  mealName: text("meal_name").notNull(),
  calories: integer("calories").notNull(),
  protein: integer("protein").notNull(),
  carbs: integer("carbs").notNull(),
  fat: integer("fat").notNull(),
  fibre: integer("fibre"),
  sugar: integer("sugar"),
  saturatedFat: integer("saturated_fat"),
  mealSlot: text("meal_slot"),
  confirmed: boolean("confirmed").notNull().default(true),
  communityMealId: integer("community_meal_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFoodLogEntrySchema = createInsertSchema(foodLogEntries).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertFoodLogEntry = z.infer<typeof insertFoodLogEntrySchema>;
export type FoodLogEntry = typeof foodLogEntries.$inferSelect;

export const customFoods = pgTable("custom_foods", {
  id: serial("id").primaryKey(),
  barcode: text("barcode"),
  name: text("name").notNull(),
  calories100g: integer("calories_100g").notNull(),
  protein100g: numeric("protein_100g").notNull(),
  carbs100g: numeric("carbs_100g").notNull(),
  fat100g: numeric("fat_100g").notNull(),
  servingGrams: integer("serving_grams").notNull().default(100),
  contributedByUserId: integer("contributed_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomFoodSchema = createInsertSchema(customFoods).omit({
  id: true,
  createdAt: true,
});

export type InsertCustomFood = z.infer<typeof insertCustomFoodSchema>;
export type CustomFood = typeof customFoods.$inferSelect;

export const userRecipes = pgTable("user_recipes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  sourceUrl: text("source_url").notNull(),
  imageUrl: text("image_url"),
  servings: integer("servings").notNull().default(1),
  caloriesPerServing: integer("calories_per_serving").notNull(),
  proteinPerServing: integer("protein_per_serving").notNull(),
  carbsPerServing: integer("carbs_per_serving").notNull(),
  fatPerServing: integer("fat_per_serving").notNull(),
  ingredients: text("ingredients"),
  ingredientsJson: jsonb("ingredients_json"),
  instructions: text("instructions"),
  mealSlot: text("meal_slot").notNull(),
  mealStyle: text("meal_style").notNull().default("simple"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserRecipeSchema = createInsertSchema(userRecipes).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export type InsertUserRecipe = z.infer<typeof insertUserRecipeSchema>;
export type UserRecipe = typeof userRecipes.$inferSelect;

export const hydrationLogs = pgTable("hydration_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: text("date").notNull(),
  amountMl: integer("amount_ml").notNull(),
  loggedAt: timestamp("logged_at").defaultNow(),
});

export const insertHydrationLogSchema = createInsertSchema(hydrationLogs).omit({
  id: true,
  userId: true,
  loggedAt: true,
});

export type InsertHydrationLog = z.infer<typeof insertHydrationLogSchema>;
export type HydrationLog = typeof hydrationLogs.$inferSelect;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const inviteCodes = pgTable("invite_codes", {
  code: text("code").primaryKey(),
  usedAt: timestamp("used_at"),
  usedByEmail: text("used_by_email"),
});

export type InviteCode = typeof inviteCodes.$inferSelect;

export const cyclePeriodLogs = pgTable("cycle_period_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  periodStartDate: text("period_start_date").notNull(),
  periodEndDate: text("period_end_date"),
  computedCycleLength: integer("computed_cycle_length"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCyclePeriodLogSchema = createInsertSchema(cyclePeriodLogs).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertCyclePeriodLog = z.infer<typeof insertCyclePeriodLogSchema>;
export type CyclePeriodLog = typeof cyclePeriodLogs.$inferSelect;

export const cycleSymptoms = pgTable("cycle_symptoms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: text("date").notNull(),
  energy: text("energy"),
  bloating: text("bloating"),
  cravings: text("cravings"),
  mood: text("mood"),
  appetite: text("appetite"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCycleSymptomSchema = createInsertSchema(cycleSymptoms).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertCycleSymptom = z.infer<typeof insertCycleSymptomSchema>;
export type CycleSymptom = typeof cycleSymptoms.$inferSelect;

export const vitalitySymptoms = pgTable("vitality_symptoms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: text("date").notNull(),
  energy: text("energy"),
  motivation: text("motivation"),
  focus: text("focus"),
  stress: text("stress"),
  sleepQuality: text("sleep_quality"),
  libido: text("libido"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVitalitySymptomSchema = createInsertSchema(vitalitySymptoms).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertVitalitySymptom = z.infer<typeof insertVitalitySymptomSchema>;
export type VitalitySymptom = typeof vitalitySymptoms.$inferSelect;

export const aiInsightsCache = pgTable("ai_insights_cache", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  cacheKey: text("cache_key").notNull(),
  narrativeJson: jsonb("narrative_json").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AiInsightsCache = typeof aiInsightsCache.$inferSelect;

export const favouriteMeals = pgTable("favourite_meals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  mealName: text("meal_name").notNull(),
  calories: integer("calories").notNull(),
  protein: integer("protein").notNull(),
  carbs: integer("carbs").notNull(),
  fat: integer("fat").notNull(),
  mealSlot: text("meal_slot"),
  ingredients: text("ingredients"),
  ingredientsJson: jsonb("ingredients_json"),
  instructions: text("instructions"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFavouriteMealSchema = createInsertSchema(favouriteMeals).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertFavouriteMeal = z.infer<typeof insertFavouriteMealSchema>;
export type FavouriteMeal = typeof favouriteMeals.$inferSelect;

export const userSavedFoods = pgTable("user_saved_foods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  calories100g: integer("calories_100g").notNull(),
  protein100g: real("protein_100g").notNull(),
  carbs100g: real("carbs_100g").notNull(),
  fat100g: real("fat_100g").notNull(),
  servingGrams: integer("serving_grams").notNull().default(100),
  source: text("source"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSavedFoodSchema = createInsertSchema(userSavedFoods).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertUserSavedFood = z.infer<typeof insertUserSavedFoodSchema>;
export type UserSavedFood = typeof userSavedFoods.$inferSelect;

export const feedbackEntries = pgTable("feedback_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  category: text("category").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(feedbackEntries).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  category: z.enum(["bug", "feature", "general"]),
  message: z.string().min(10, "Please give us a bit more detail (min 10 characters)").max(2000),
});

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type FeedbackEntry = typeof feedbackEntries.$inferSelect;

export const userMeals = pgTable("user_meals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  source: text("source").notNull().default("manual"),
  caloriesPerServing: integer("calories_per_serving").notNull(),
  proteinPerServing: real("protein_per_serving").notNull(),
  carbsPerServing: real("carbs_per_serving").notNull(),
  fatPerServing: real("fat_per_serving").notNull(),
  servings: integer("servings").notNull().default(1),
  sourceUrl: text("source_url"),
  imageUrl: text("image_url"),
  mealSlot: text("meal_slot"),
  mealStyle: text("meal_style").notNull().default("simple"),
  ingredients: text("ingredients"),
  ingredientsJson: jsonb("ingredients_json"),
  instructions: text("instructions"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserMealSchema = createInsertSchema(userMeals).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export type InsertUserMeal = z.infer<typeof insertUserMealSchema>;
export type UserMeal = typeof userMeals.$inferSelect;

export const mealTemplates = pgTable("meal_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  userMealId: integer("user_meal_id").notNull().references(() => userMeals.id),
  mealSlot: text("meal_slot").notNull(),
  daysOfWeek: text("days_of_week").array().notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMealTemplateSchema = createInsertSchema(mealTemplates).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertMealTemplate = z.infer<typeof insertMealTemplateSchema>;
export type MealTemplate = typeof mealTemplates.$inferSelect;

export const featureGates = pgTable("feature_gates", {
  id: serial("id").primaryKey(),
  featureKey: text("feature_key").notNull().unique(),
  requiredTier: text("required_tier").notNull().default("free"),
  creditCost: integer("credit_cost").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type FeatureGate = typeof featureGates.$inferSelect;

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  featureKey: text("feature_key"),
  description: text("description"),
  costUsd: integer("cost_usd").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;

export const tierPricing = pgTable("tier_pricing", {
  id: serial("id").primaryKey(),
  tier: text("tier").notNull(),
  monthlyPriceUsd: integer("monthly_price_usd").notNull(),
  annualPriceUsd: integer("annual_price_usd").notNull(),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdAnnual: text("stripe_price_id_annual"),
  active: boolean("active").notNull().default(true),
  features: jsonb("features").notNull().default([]),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TierPricing = typeof tierPricing.$inferSelect;

export const creditPacks = pgTable("credit_packs", {
  id: serial("id").primaryKey(),
  credits: integer("credits").notNull(),
  priceUsd: integer("price_usd").notNull(),
  stripePriceId: text("stripe_price_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CreditPack = typeof creditPacks.$inferSelect;
