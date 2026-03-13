import { pgTable, serial, integer, numeric, timestamp, text, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  provider: text("provider"),
  providerId: text("provider_id"),
  preferences: jsonb("preferences"),
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
export type PublicUser = Omit<User, "passwordHash">;

export const userPreferencesSchema = z.object({
  diet: z.enum(["vegetarian", "vegan", "pescatarian", "halal", "kosher"]).nullable().optional(),
  allergies: z.array(z.enum(["gluten", "dairy", "eggs", "nuts", "peanuts", "shellfish", "fish", "soy"])).optional(),
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

export const foodLogEntries = pgTable("food_log_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: text("date").notNull(),
  mealName: text("meal_name").notNull(),
  calories: integer("calories").notNull(),
  protein: integer("protein").notNull(),
  carbs: integer("carbs").notNull(),
  fat: integer("fat").notNull(),
  mealSlot: text("meal_slot"),
  confirmed: boolean("confirmed").notNull().default(true),
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

export const aiInsightsCache = pgTable("ai_insights_cache", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  cacheKey: text("cache_key").notNull(),
  narrativeJson: jsonb("narrative_json").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AiInsightsCache = typeof aiInsightsCache.$inferSelect;

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
