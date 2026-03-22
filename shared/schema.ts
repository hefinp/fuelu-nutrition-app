import { pgTable, serial, integer, numeric, real, timestamp, text, jsonb, boolean, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tierEnum = ["free", "simple", "advanced", "payg"] as const;
export type Tier = typeof tierEnum[number];

export const nutritionistTierEnum = ["starter", "professional", "practice"] as const;
export type NutritionistTier = typeof nutritionistTierEnum[number];

export const nutritionistTierLimits: Record<NutritionistTier, number> = {
  starter: 15,
  professional: 40,
  practice: 999,
};

export const clientStatusEnum = ["onboarding", "active", "paused"] as const;
export type ClientStatus = typeof clientStatusEnum[number];

export const pipelineStageEnum = ["inquiry", "onboarding", "active", "maintenance", "alumni"] as const;
export type PipelineStage = typeof pipelineStageEnum[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  username: text("username").unique(),
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
  trialStartDate: timestamp("trial_start_date"),
  trialStatus: text("trial_status").notNull().default("none"),
  trialStepDownSeen: boolean("trial_step_down_seen").notNull().default(false),
  trialExpiredSeen: boolean("trial_expired_seen").notNull().default(false),
  isManagedClient: boolean("is_managed_client").notNull().default(false),
  managedByNutritionistId: integer("managed_by_nutritionist_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens");

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true,
  passwordHash: true,
}).extend({
  passwordHash: z.string().optional(),
  provider: z.string().optional(),
  providerId: z.string().optional(),
  username: usernameSchema.optional(),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: usernameSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
  inviteCode: z.string().optional(),
  nutritionistInviteToken: z.string().optional(),
  agreedToTerms: z.literal(true, { errorMap: () => ({ message: "You must agree to the Terms of Service and Privacy Policy" }) }),
  confirmedAge: z.literal(true, { errorMap: () => ({ message: "You must confirm you meet the minimum age requirement" }) }),
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
  fastingEnabled: z.boolean().optional(),
  fastingProtocol: z.enum(["16:8", "18:6", "20:4", "5:2", "omad"]).optional(),
  eatingWindowStart: z.number().int().min(0).max(23).optional(),
  eatingWindowEnd: z.number().int().min(0).max(23).optional(),
  fastingDays: z.array(z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])).optional(),
  country: z.string().optional(),
  stravaActivityLevelEnabled: z.boolean().optional(),
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
  ingredientsJson: jsonb("ingredients_json"),
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
  source: text("source"),
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

export const canonicalFoods = pgTable("canonical_foods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  canonicalName: text("canonical_name").notNull(),
  calories100g: integer("calories_100g").notNull(),
  protein100g: real("protein_100g").notNull(),
  carbs100g: real("carbs_100g").notNull(),
  fat100g: real("fat_100g").notNull(),
  fibre100g: real("fibre_100g"),
  sodium100g: real("sodium_100g"),
  sugar100g: real("sugar_100g"),
  saturatedFat100g: real("saturated_fat_100g"),
  servingGrams: integer("serving_grams").notNull().default(100),
  barcode: text("barcode"),
  fdcId: text("fdc_id"),
  source: text("source").notNull().default("user_manual"),
  sourceQuality: integer("source_quality").notNull().default(40),
  region: text("region"),
  brand: text("brand"),
  category: text("category"),
  imageUrl: text("image_url"),
  sourceUrl: text("source_url"),
  cookTime: text("cook_time"),
  ingredientsList: jsonb("ingredients_list"),
  verifiedAt: timestamp("verified_at"),
  contributedByUserId: integer("contributed_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCanonicalFoodSchema = createInsertSchema(canonicalFoods).omit({
  id: true,
  createdAt: true,
});

export type InsertCanonicalFood = z.infer<typeof insertCanonicalFoodSchema>;
export type CanonicalFood = typeof canonicalFoods.$inferSelect;

export const userFoodBookmarks = pgTable("user_food_bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  canonicalFoodId: integer("canonical_food_id").notNull().references(() => canonicalFoods.id),
  servingGrams: integer("serving_grams"),
  nickname: text("nickname"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserFoodBookmarkSchema = createInsertSchema(userFoodBookmarks).omit({
  id: true,
  createdAt: true,
});

export type InsertUserFoodBookmark = z.infer<typeof insertUserFoodBookmarkSchema>;
export type UserFoodBookmark = typeof userFoodBookmarks.$inferSelect;

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
  sourcePhotos: text("source_photos").array(),
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

export const mealIngredients = pgTable("meal_ingredients", {
  id: serial("id").primaryKey(),
  userMealId: integer("user_meal_id").notNull().references(() => userMeals.id, { onDelete: "cascade" }),
  canonicalFoodId: integer("canonical_food_id").references(() => canonicalFoods.id),
  name: text("name").notNull(),
  grams: real("grams").notNull(),
  calories100g: real("calories_100g").notNull(),
  protein100g: real("protein_100g").notNull(),
  carbs100g: real("carbs_100g").notNull(),
  fat100g: real("fat_100g").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMealIngredientSchema = createInsertSchema(mealIngredients).omit({
  id: true,
  createdAt: true,
});

export type InsertMealIngredient = z.infer<typeof insertMealIngredientSchema>;
export type MealIngredient = typeof mealIngredients.$inferSelect;

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

export const communityMealIngredients = pgTable("community_meal_ingredients", {
  id: serial("id").primaryKey(),
  communityMealId: integer("community_meal_id").notNull().references(() => communityMeals.id, { onDelete: "cascade" }),
  canonicalFoodId: integer("canonical_food_id").references(() => canonicalFoods.id),
  name: text("name").notNull(),
  grams: real("grams").notNull(),
  calories100g: real("calories_100g").notNull(),
  protein100g: real("protein_100g").notNull(),
  carbs100g: real("carbs_100g").notNull(),
  fat100g: real("fat_100g").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommunityMealIngredientSchema = createInsertSchema(communityMealIngredients).omit({
  id: true,
  createdAt: true,
});

export type InsertCommunityMealIngredient = z.infer<typeof insertCommunityMealIngredientSchema>;
export type CommunityMealIngredient = typeof communityMealIngredients.$inferSelect;

export const recipeIngredients = pgTable("recipe_ingredients", {
  id: serial("id").primaryKey(),
  userRecipeId: integer("user_recipe_id").notNull().references(() => userRecipes.id, { onDelete: "cascade" }),
  canonicalFoodId: integer("canonical_food_id").references(() => canonicalFoods.id),
  name: text("name").notNull(),
  grams: real("grams").notNull(),
  calories100g: real("calories_100g").notNull(),
  protein100g: real("protein_100g").notNull(),
  carbs100g: real("carbs_100g").notNull(),
  fat100g: real("fat_100g").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients).omit({
  id: true,
  createdAt: true,
});

export type InsertRecipeIngredient = z.infer<typeof insertRecipeIngredientSchema>;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;

// ─── Nutritionist Portal ────────────────────────────────────────────────────

export const nutritionistProfiles = pgTable("nutritionist_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  tier: text("tier").notNull().default("starter"),
  bio: text("bio"),
  credentials: text("credentials"),
  specializations: text("specializations").array(),
  maxClients: integer("max_clients"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNutritionistProfileSchema = createInsertSchema(nutritionistProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
}).extend({
  tier: z.enum(nutritionistTierEnum).default("starter"),
  bio: z.preprocess((val) => (val === "" ? undefined : val), z.string().max(1000).optional()),
  credentials: z.preprocess((val) => (val === "" ? undefined : val), z.string().max(500).optional()),
  specializations: z.array(z.string()).optional(),
  maxClients: z.number().int().min(1).max(999).optional(),
});

export type InsertNutritionistProfile = z.infer<typeof insertNutritionistProfileSchema>;
export type NutritionistProfile = typeof nutritionistProfiles.$inferSelect;

export const nutritionistClients = pgTable("nutritionist_clients", {
  id: serial("id").primaryKey(),
  nutritionistId: integer("nutritionist_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  status: text("status").notNull().default("onboarding"),
  pipelineStage: text("pipeline_stage").notNull().default("onboarding"),
  goalSummary: text("goal_summary"),
  healthNotes: text("health_notes"),
  notes: text("notes"),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNutritionistClientSchema = createInsertSchema(nutritionistClients).omit({
  id: true,
  createdAt: true,
  nutritionistId: true,
}).extend({
  status: z.enum(clientStatusEnum).default("onboarding"),
  pipelineStage: z.enum(pipelineStageEnum).default("onboarding"),
  goalSummary: z.string().max(500).optional(),
  healthNotes: z.string().max(2000).optional(),
});

export type InsertNutritionistClient = z.infer<typeof insertNutritionistClientSchema>;
export type NutritionistClient = typeof nutritionistClients.$inferSelect;

export const nutritionistInvitations = pgTable("nutritionist_invitations", {
  id: serial("id").primaryKey(),
  nutritionistId: integer("nutritionist_id").notNull().references(() => users.id),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNutritionistInvitationSchema = createInsertSchema(nutritionistInvitations).omit({
  id: true,
  createdAt: true,
  nutritionistId: true,
  token: true,
  acceptedAt: true,
}).extend({
  email: z.string().email("Invalid email address"),
});

export type InsertNutritionistInvitation = z.infer<typeof insertNutritionistInvitationSchema>;
export type NutritionistInvitation = typeof nutritionistInvitations.$inferSelect;

export const nutritionistNotes = pgTable("nutritionist_notes", {
  id: serial("id").primaryKey(),
  nutritionistId: integer("nutritionist_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNutritionistNoteSchema = createInsertSchema(nutritionistNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  nutritionistId: true,
  clientId: true,
}).extend({
  note: z.string().min(1, "Note cannot be empty").max(10000),
});

export type InsertNutritionistNote = z.infer<typeof insertNutritionistNoteSchema>;
export type NutritionistNote = typeof nutritionistNotes.$inferSelect;

export const nutritionistPlanStatusEnum = ["draft", "pending_review", "approved", "delivered"] as const;
export type NutritionistPlanStatus = typeof nutritionistPlanStatusEnum[number];

export const nutritionistPlans = pgTable("nutritionist_plans", {
  id: serial("id").primaryKey(),
  nutritionistId: integer("nutritionist_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  name: text("name").notNull().default("Meal Plan"),
  planType: text("plan_type").notNull().default("weekly"),
  planData: jsonb("plan_data").notNull(),
  status: text("status").notNull().default("draft"),
  promptNote: text("prompt_note"),
  scheduledDeliverAt: timestamp("scheduled_deliver_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNutritionistPlanSchema = createInsertSchema(nutritionistPlans).omit({
  id: true,
  createdAt: true,
  deliveredAt: true,
});

export type InsertNutritionistPlan = z.infer<typeof insertNutritionistPlanSchema>;
export type NutritionistPlan = typeof nutritionistPlans.$inferSelect;

export const planAnnotations = pgTable("plan_annotations", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => nutritionistPlans.id, { onDelete: "cascade" }),
  day: text("day").notNull(),
  slot: text("slot"),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlanAnnotationSchema = createInsertSchema(planAnnotations).omit({
  id: true,
  createdAt: true,
});

export type InsertPlanAnnotation = z.infer<typeof insertPlanAnnotationSchema>;
export type PlanAnnotation = typeof planAnnotations.$inferSelect;

export const planTemplates = pgTable("plan_templates", {
  id: serial("id").primaryKey(),
  nutritionistId: integer("nutritionist_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  planType: text("plan_type").notNull().default("weekly"),
  planData: jsonb("plan_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlanTemplateSchema = createInsertSchema(planTemplates).omit({
  id: true,
  createdAt: true,
});

export type InsertPlanTemplate = z.infer<typeof insertPlanTemplateSchema>;
export type PlanTemplate = typeof planTemplates.$inferSelect;

export const clientIntakeForms = pgTable("client_intake_forms", {
  id: serial("id").primaryKey(),
  nutritionistClientId: integer("nutritionist_client_id").notNull().references(() => nutritionistClients.id, { onDelete: "cascade" }),
  nutritionistId: integer("nutritionist_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  medicalHistory: text("medical_history"),
  medications: text("medications"),
  lifestyle: text("lifestyle"),
  dietaryRestrictions: text("dietary_restrictions"),
  foodPreferences: text("food_preferences"),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientIntakeFormSchema = createInsertSchema(clientIntakeForms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  medicalHistory: z.string().max(5000).optional(),
  medications: z.string().max(3000).optional(),
  lifestyle: z.string().max(3000).optional(),
  dietaryRestrictions: z.string().max(3000).optional(),
  foodPreferences: z.string().max(3000).optional(),
  notes: z.string().max(5000).optional(),
});

export type InsertClientIntakeForm = z.infer<typeof insertClientIntakeFormSchema>;
export type ClientIntakeForm = typeof clientIntakeForms.$inferSelect;

export const goalTypeEnum = ["weight", "macro_average", "body_fat", "custom"] as const;
export type GoalType = typeof goalTypeEnum[number];

export const clientGoals = pgTable("client_goals", {
  id: serial("id").primaryKey(),
  nutritionistClientId: integer("nutritionist_client_id").notNull().references(() => nutritionistClients.id, { onDelete: "cascade" }),
  nutritionistId: integer("nutritionist_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  goalType: text("goal_type").notNull().default("custom"),
  title: text("title").notNull(),
  targetValue: numeric("target_value"),
  currentValue: numeric("current_value"),
  unit: text("unit"),
  targetDate: timestamp("target_date"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientGoalSchema = createInsertSchema(clientGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentValue: true,
}).extend({
  goalType: z.enum(goalTypeEnum).default("custom"),
  title: z.string().min(1).max(200),
  targetValue: z.string().optional(),
  unit: z.string().max(50).optional(),
  targetDate: z.string().optional(),
  status: z.enum(["active", "completed", "paused"]).default("active"),
});

export type InsertClientGoal = z.infer<typeof insertClientGoalSchema>;
export type ClientGoal = typeof clientGoals.$inferSelect;

export const practiceAccounts = pgTable("practice_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  adminUserId: integer("admin_user_id").notNull().references(() => users.id),
  maxSeats: integer("max_seats").notNull().default(5),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPracticeAccountSchema = createInsertSchema(practiceAccounts).omit({
  id: true,
  createdAt: true,
  adminUserId: true,
}).extend({
  name: z.string().min(2, "Practice name must be at least 2 characters").max(200),
  maxSeats: z.number().int().min(1).max(100).optional(),
});

export type InsertPracticeAccount = z.infer<typeof insertPracticeAccountSchema>;
export type PracticeAccount = typeof practiceAccounts.$inferSelect;

export const practiceMembers = pgTable("practice_members", {
  id: serial("id").primaryKey(),
  practiceId: integer("practice_id").notNull().references(() => practiceAccounts.id),
  nutritionistUserId: integer("nutritionist_user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPracticeMemberSchema = createInsertSchema(practiceMembers).omit({
  id: true,
  createdAt: true,
  practiceId: true,
}).extend({
  role: z.enum(["admin", "member"]).default("member"),
});

export type InsertPracticeMember = z.infer<typeof insertPracticeMemberSchema>;
export type PracticeMember = typeof practiceMembers.$inferSelect;

export const nutritionistMessages = pgTable("nutritionist_messages", {
  id: serial("id").primaryKey(),
  nutritionistId: integer("nutritionist_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNutritionistMessageSchema = createInsertSchema(nutritionistMessages).omit({
  id: true,
  createdAt: true,
  isRead: true,
}).extend({
  body: z.string().min(1, "Message cannot be empty").max(5000),
});

export type InsertNutritionistMessage = z.infer<typeof insertNutritionistMessageSchema>;
export type NutritionistMessage = typeof nutritionistMessages.$inferSelect;

export const clientTargetOverrides = pgTable("client_target_overrides", {
  id: serial("id").primaryKey(),
  nutritionistId: integer("nutritionist_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id).unique(),
  dailyCalories: integer("daily_calories"),
  proteinGoal: integer("protein_goal"),
  carbsGoal: integer("carbs_goal"),
  fatGoal: integer("fat_goal"),
  fibreGoal: integer("fibre_goal"),
  rationale: text("rationale"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientTargetOverrideSchema = createInsertSchema(clientTargetOverrides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  nutritionistId: true,
  clientId: true,
});

export type InsertClientTargetOverride = z.infer<typeof insertClientTargetOverrideSchema>;
export type ClientTargetOverride = typeof clientTargetOverrides.$inferSelect;

export const clientReports = pgTable("client_reports", {
  id: serial("id").primaryKey(),
  nutritionistId: integer("nutritionist_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  fromDate: text("from_date").notNull(),
  toDate: text("to_date").notNull(),
  clinicalSummary: text("clinical_summary"),
  reportData: jsonb("report_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientReportSchema = createInsertSchema(clientReports).omit({
  id: true,
  createdAt: true,
  nutritionistId: true,
  clientId: true,
});

export type InsertClientReport = z.infer<typeof insertClientReportSchema>;
export type ClientReport = typeof clientReports.$inferSelect;

// ─── Client Metrics (Outcome Tracking) ───────────────────────────────────────

export const metricTypeEnum = [
  "weight",
  "body_fat",
  "waist_circumference",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "blood_glucose",
  "custom",
] as const;
export type MetricType = typeof metricTypeEnum[number];

export const clientMetrics = pgTable("client_metrics", {
  id: serial("id").primaryKey(),
  nutritionistId: integer("nutritionist_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  metricType: text("metric_type").notNull(),
  customLabel: text("custom_label"),
  value: numeric("value").notNull(),
  unit: text("unit"),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientMetricSchema = createInsertSchema(clientMetrics).omit({
  id: true,
  createdAt: true,
  nutritionistId: true,
  clientId: true,
}).extend({
  metricType: z.enum(metricTypeEnum),
  customLabel: z.string().max(100).optional(),
  value: z.string().min(1),
  unit: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  recordedAt: z.string().optional(),
});

export type InsertClientMetric = z.infer<typeof insertClientMetricSchema>;
export type ClientMetric = typeof clientMetrics.$inferSelect;

// ─── Adaptive TDEE Suggestions ───────────────────────────────────────────────

export const adaptiveTdeeSuggestions = pgTable("adaptive_tdee_suggestions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  suggestedCalories: integer("suggested_calories").notNull(),
  currentCalories: integer("current_calories").notNull(),
  formulaTdee: integer("formula_tdee"),
  delta: integer("delta").notNull(),
  explanation: text("explanation").notNull(),
  confidence: text("confidence").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  actedAt: timestamp("acted_at"),
});

export const insertAdaptiveTdeeSuggestionSchema = createInsertSchema(adaptiveTdeeSuggestions).omit({
  id: true,
  createdAt: true,
  actedAt: true,
});

export type InsertAdaptiveTdeeSuggestion = z.infer<typeof insertAdaptiveTdeeSuggestionSchema>;
export type AdaptiveTdeeSuggestion = typeof adaptiveTdeeSuggestions.$inferSelect;

// ─── Strava Connections ──────────────────────────────────────────────────────

export const stravaConnections = pgTable("strava_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  athleteId: text("athlete_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStravaConnectionSchema = createInsertSchema(stravaConnections).omit({
  id: true,
  createdAt: true,
});

export type InsertStravaConnection = z.infer<typeof insertStravaConnectionSchema>;
export type StravaConnection = typeof stravaConnections.$inferSelect;

export const mealComments = pgTable("meal_comments", {
  id: serial("id").primaryKey(),
  communityMealId: integer("community_meal_id").notNull().references(() => communityMeals.id),
  userId: integer("user_id").notNull().references(() => users.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMealCommentSchema = createInsertSchema(mealComments).omit({
  id: true,
  createdAt: true,
});

export type InsertMealComment = z.infer<typeof insertMealCommentSchema>;
export type MealComment = typeof mealComments.$inferSelect;

// ─── Strava Activities ─────────────────────────────────────────────────────

export const stravaActivities = pgTable("strava_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  stravaActivityId: bigint("strava_activity_id", { mode: "number" }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  sportType: text("sport_type"),
  startDate: timestamp("start_date").notNull(),
  movingTime: integer("moving_time").notNull(),
  distance: real("distance").notNull().default(0),
  totalElevationGain: real("total_elevation_gain").default(0),
  calories: real("calories").default(0),
  averageHeartrate: real("average_heartrate"),
  maxHeartrate: real("max_heartrate"),
  averageSpeed: real("average_speed").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStravaActivitySchema = createInsertSchema(stravaActivities).omit({
  id: true,
  createdAt: true,
});

export type InsertStravaActivity = z.infer<typeof insertStravaActivitySchema>;
export type StravaActivity = typeof stravaActivities.$inferSelect;
