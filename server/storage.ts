import { calculations, users, savedMealPlans, weightEntries, foodLogEntries, passwordResetTokens, customFoods, userRecipes, hydrationLogs, type InsertCalculation, type Calculation, type InsertUser, type User, type SavedMealPlan, type InsertSavedMealPlan, type WeightEntry, type UserPreferences, type FoodLogEntry, type InsertFoodLogEntry, type CustomFood, type InsertCustomFood, type UserRecipe, type InsertUserRecipe, type HydrationLog, type InsertHydrationLog } from "@shared/schema";
import { db } from "./db";
import { desc, eq, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Auth
  createUser(user: InsertUser & { provider?: string; providerId?: string }): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  findOrCreateOAuthUser(opts: { email: string; name: string; provider: string; providerId: string }): Promise<User>;
  updateUserPassword(userId: number, passwordHash: string): Promise<void>;

  // Calculations
  createCalculation(calc: InsertCalculation & { userId?: number; dailyCalories: number; weeklyCalories: number; proteinGoal: number; carbsGoal: number; fatGoal: number }): Promise<Calculation>;
  getCalculations(userId?: number): Promise<Calculation[]>;

  // Weight entries
  createWeightEntry(entry: { userId: number; weight: string; recordedAt?: Date }): Promise<WeightEntry>;
  getWeightEntries(userId: number): Promise<WeightEntry[]>;
  deleteWeightEntry(id: number, userId: number): Promise<void>;

  // Preferences
  updateUserPreferences(userId: number, preferences: UserPreferences): Promise<void>;

  // Saved meal plans
  saveMealPlan(plan: InsertSavedMealPlan): Promise<SavedMealPlan>;
  getSavedMealPlans(userId: number): Promise<SavedMealPlan[]>;
  updateMealPlanName(id: number, userId: number, name: string): Promise<SavedMealPlan | undefined>;
  deleteMealPlan(id: number, userId: number): Promise<void>;
  getSavedMealPlanById(id: number, userId: number): Promise<SavedMealPlan | undefined>;

  // Food log
  getFoodLogEntries(userId: number, date: string): Promise<FoodLogEntry[]>;
  getFoodLogEntriesRange(userId: number, from: string, to: string): Promise<FoodLogEntry[]>;
  getRecentFoodEntries(userId: number, limit: number): Promise<FoodLogEntry[]>;
  createFoodLogEntry(entry: InsertFoodLogEntry & { userId: number }): Promise<FoodLogEntry>;
  deleteFoodLogEntry(id: number, userId: number): Promise<void>;

  // Password reset tokens
  createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ id: number; userId: number; expiresAt: Date; usedAt: Date | null } | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;

  // Custom foods
  getCustomFoodByBarcode(barcode: string): Promise<CustomFood | undefined>;
  createCustomFood(food: InsertCustomFood): Promise<CustomFood>;
  getCustomFoods(): Promise<CustomFood[]>;
  deleteCustomFood(id: number, userId: number): Promise<void>;

  // User recipes
  getUserRecipes(userId: number): Promise<UserRecipe[]>;
  createUserRecipe(recipe: InsertUserRecipe & { userId: number }): Promise<UserRecipe>;
  deleteUserRecipe(id: number, userId: number): Promise<void>;

  // Hydration
  getHydrationLogs(userId: number, date: string): Promise<HydrationLog[]>;
  createHydrationLog(entry: InsertHydrationLog & { userId: number }): Promise<HydrationLog>;
  deleteHydrationLog(id: number, userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createUser(user: InsertUser & { provider?: string; providerId?: string }): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async findOrCreateOAuthUser({ email, name, provider, providerId }: { email: string; name: string; provider: string; providerId: string }): Promise<User> {
    const [byProvider] = await db.select().from(users).where(
      and(eq(users.provider, provider), eq(users.providerId, providerId))
    );
    if (byProvider) return byProvider;

    const [byEmail] = await db.select().from(users).where(eq(users.email, email));
    if (byEmail) {
      const [updated] = await db.update(users)
        .set({ provider, providerId })
        .where(eq(users.id, byEmail.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(users).values({ email, name, provider, providerId }).returning();
    return created;
  }

  async updateUserPassword(userId: number, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  }

  async createCalculation(calc: InsertCalculation & { userId?: number; dailyCalories: number; weeklyCalories: number; proteinGoal: number; carbsGoal: number; fatGoal: number }): Promise<Calculation> {
    const [calculation] = await db.insert(calculations).values(calc).returning();
    return calculation;
  }

  async getCalculations(userId?: number): Promise<Calculation[]> {
    if (userId) {
      return await db.select().from(calculations).where(eq(calculations.userId, userId)).orderBy(desc(calculations.createdAt));
    }
    return await db.select().from(calculations).orderBy(desc(calculations.createdAt));
  }

  async createWeightEntry(entry: { userId: number; weight: string; recordedAt?: Date }): Promise<WeightEntry> {
    const [created] = await db.insert(weightEntries).values({
      userId: entry.userId,
      weight: entry.weight,
      recordedAt: entry.recordedAt ?? new Date(),
    }).returning();
    return created;
  }

  async getWeightEntries(userId: number): Promise<WeightEntry[]> {
    return await db.select().from(weightEntries)
      .where(eq(weightEntries.userId, userId))
      .orderBy(weightEntries.recordedAt);
  }

  async deleteWeightEntry(id: number, userId: number): Promise<void> {
    await db.delete(weightEntries)
      .where(and(eq(weightEntries.id, id), eq(weightEntries.userId, userId)));
  }

  async updateUserPreferences(userId: number, preferences: UserPreferences): Promise<void> {
    await db.update(users).set({ preferences }).where(eq(users.id, userId));
  }

  async saveMealPlan(plan: InsertSavedMealPlan): Promise<SavedMealPlan> {
    const [saved] = await db.insert(savedMealPlans).values(plan).returning();
    return saved;
  }

  async getSavedMealPlans(userId: number): Promise<SavedMealPlan[]> {
    return await db.select().from(savedMealPlans).where(eq(savedMealPlans.userId, userId)).orderBy(desc(savedMealPlans.createdAt));
  }

  async updateMealPlanName(id: number, userId: number, name: string): Promise<SavedMealPlan | undefined> {
    const [updated] = await db.update(savedMealPlans)
      .set({ name })
      .where(and(eq(savedMealPlans.id, id), eq(savedMealPlans.userId, userId)))
      .returning();
    return updated;
  }

  async deleteMealPlan(id: number, userId: number): Promise<void> {
    await db.delete(savedMealPlans)
      .where(and(eq(savedMealPlans.id, id), eq(savedMealPlans.userId, userId)));
  }

  async getSavedMealPlanById(id: number, userId: number): Promise<SavedMealPlan | undefined> {
    const [plan] = await db.select().from(savedMealPlans)
      .where(and(eq(savedMealPlans.id, id), eq(savedMealPlans.userId, userId)));
    return plan;
  }

  async getFoodLogEntries(userId: number, date: string): Promise<FoodLogEntry[]> {
    return await db.select().from(foodLogEntries)
      .where(and(eq(foodLogEntries.userId, userId), eq(foodLogEntries.date, date)))
      .orderBy(foodLogEntries.createdAt);
  }

  async getFoodLogEntriesRange(userId: number, from: string, to: string): Promise<FoodLogEntry[]> {
    return await db.select().from(foodLogEntries)
      .where(and(eq(foodLogEntries.userId, userId), gte(foodLogEntries.date, from), lte(foodLogEntries.date, to)))
      .orderBy(foodLogEntries.date, foodLogEntries.createdAt);
  }

  async getRecentFoodEntries(userId: number, limit: number): Promise<FoodLogEntry[]> {
    const rows = await db.select().from(foodLogEntries)
      .where(eq(foodLogEntries.userId, userId))
      .orderBy(desc(foodLogEntries.createdAt))
      .limit(limit * 10);
    const seen = new Set<string>();
    const unique: typeof rows = [];
    for (const r of rows) {
      if (!seen.has(r.mealName) && unique.length < limit) {
        seen.add(r.mealName);
        unique.push(r);
      }
    }
    return unique;
  }

  async createFoodLogEntry(entry: InsertFoodLogEntry & { userId: number }): Promise<FoodLogEntry> {
    const [created] = await db.insert(foodLogEntries).values(entry).returning();
    return created;
  }

  async deleteFoodLogEntry(id: number, userId: number): Promise<void> {
    await db.delete(foodLogEntries)
      .where(and(eq(foodLogEntries.id, id), eq(foodLogEntries.userId, userId)));
  }

  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
  }

  async getPasswordResetToken(token: string): Promise<{ id: number; userId: number; expiresAt: Date; usedAt: Date | null } | undefined> {
    const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    if (!row) return undefined;
    return { id: row.id, userId: row.userId, expiresAt: row.expiresAt, usedAt: row.usedAt };
  }

  async markPasswordResetTokenUsed(id: number): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }

  async getCustomFoodByBarcode(barcode: string): Promise<CustomFood | undefined> {
    const [food] = await db.select().from(customFoods).where(eq(customFoods.barcode, barcode));
    return food;
  }

  async createCustomFood(food: InsertCustomFood): Promise<CustomFood> {
    const [created] = await db.insert(customFoods).values(food).returning();
    return created;
  }

  async getCustomFoods(): Promise<CustomFood[]> {
    return await db.select().from(customFoods).orderBy(desc(customFoods.createdAt));
  }

  async deleteCustomFood(id: number, userId: number): Promise<void> {
    await db.delete(customFoods)
      .where(and(eq(customFoods.id, id), eq(customFoods.contributedByUserId, userId)));
  }

  async getUserRecipes(userId: number): Promise<UserRecipe[]> {
    return await db.select().from(userRecipes)
      .where(eq(userRecipes.userId, userId))
      .orderBy(desc(userRecipes.createdAt));
  }

  async createUserRecipe(recipe: InsertUserRecipe & { userId: number }): Promise<UserRecipe> {
    const [created] = await db.insert(userRecipes).values(recipe).returning();
    return created;
  }

  async deleteUserRecipe(id: number, userId: number): Promise<void> {
    await db.delete(userRecipes)
      .where(and(eq(userRecipes.id, id), eq(userRecipes.userId, userId)));
  }

  async getHydrationLogs(userId: number, date: string): Promise<HydrationLog[]> {
    return await db.select().from(hydrationLogs)
      .where(and(eq(hydrationLogs.userId, userId), eq(hydrationLogs.date, date)))
      .orderBy(hydrationLogs.loggedAt);
  }

  async createHydrationLog(entry: InsertHydrationLog & { userId: number }): Promise<HydrationLog> {
    const [created] = await db.insert(hydrationLogs).values(entry).returning();
    return created;
  }

  async deleteHydrationLog(id: number, userId: number): Promise<void> {
    await db.delete(hydrationLogs)
      .where(and(eq(hydrationLogs.id, id), eq(hydrationLogs.userId, userId)));
  }
}

export const storage = new DatabaseStorage();
