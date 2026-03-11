import { pgTable, serial, integer, numeric, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const calculations = pgTable("calculations", {
  id: serial("id").primaryKey(),
  weight: numeric("weight").notNull(), // in kg
  height: numeric("height").notNull(), // in cm
  age: integer("age").default(30),
  gender: text("gender").default('male'),
  activityLevel: text("activity_level").default('moderate'),
  goal: text("goal").default('maintain'), // lose, maintain, gain
  targetType: text("target_type").default('weekly'), // weekly or monthly
  targetAmount: numeric("target_amount"), // target weight loss/gain
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
