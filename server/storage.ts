import { calculations, type InsertCalculation, type Calculation } from "@shared/schema";
import { db } from "./db";
import { desc } from "drizzle-orm";

export interface IStorage {
  createCalculation(calc: InsertCalculation & { dailyCalories: number, weeklyCalories: number, proteinGoal: number, carbsGoal: number, fatGoal: number }): Promise<Calculation>;
  getCalculations(): Promise<Calculation[]>;
}

export class DatabaseStorage implements IStorage {
  async createCalculation(calc: InsertCalculation & { dailyCalories: number, weeklyCalories: number, proteinGoal: number, carbsGoal: number, fatGoal: number }): Promise<Calculation> {
    const [calculation] = await db.insert(calculations).values(calc).returning();
    return calculation;
  }

  async getCalculations(): Promise<Calculation[]> {
    return await db.select().from(calculations).orderBy(desc(calculations.createdAt));
  }
}

export const storage = new DatabaseStorage();
