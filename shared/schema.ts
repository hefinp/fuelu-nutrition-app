import { pgTable, serial, integer, numeric, timestamp, text, jsonb } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFoodLogEntrySchema = createInsertSchema(foodLogEntries).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertFoodLogEntry = z.infer<typeof insertFoodLogEntrySchema>;
export type FoodLogEntry = typeof foodLogEntries.$inferSelect;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});
