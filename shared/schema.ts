import { pgTable, serial, integer, numeric, timestamp, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true,
  passwordHash: true,
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
