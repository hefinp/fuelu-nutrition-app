import { calculations, users, savedMealPlans, weightEntries, foodLogEntries, passwordResetTokens, customFoods, userRecipes, hydrationLogs, feedbackEntries, inviteCodes, cycleSymptoms, cyclePeriodLogs, aiInsightsCache, favouriteMeals, communityMeals, userSavedFoods, type InsertCalculation, type Calculation, type InsertUser, type User, type SavedMealPlan, type InsertSavedMealPlan, type WeightEntry, type UserPreferences, type FoodLogEntry, type InsertFoodLogEntry, type CustomFood, type InsertCustomFood, type UserRecipe, type InsertUserRecipe, type HydrationLog, type InsertHydrationLog, type FeedbackEntry, type InviteCode, type CycleSymptom, type CyclePeriodLog, type AiInsightsCache, type FavouriteMeal, type CommunityMeal, type UserSavedFood } from "@shared/schema";
import { db } from "./db";
import { desc, eq, and, gte, lte, ilike, sql } from "drizzle-orm";

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
  searchCustomFoodsByName(query: string): Promise<CustomFood[]>;
  customFoodExistsByName(name: string): Promise<boolean>;
  createCustomFood(food: InsertCustomFood): Promise<CustomFood>;
  getCustomFoods(): Promise<CustomFood[]>;
  deleteCustomFood(id: number, userId: number): Promise<void>;
  updateCustomFoodBarcode(id: number, barcode: string): Promise<void>;

  // User recipes
  getUserRecipes(userId: number): Promise<UserRecipe[]>;
  createUserRecipe(recipe: InsertUserRecipe & { userId: number }): Promise<UserRecipe>;
  updateUserRecipe(id: number, userId: number, updates: { name?: string; caloriesPerServing?: number; proteinPerServing?: number; carbsPerServing?: number; fatPerServing?: number; mealSlot?: string; instructions?: string | null; ingredients?: string | null; ingredientsJson?: unknown }): Promise<UserRecipe | undefined>;
  deleteUserRecipe(id: number, userId: number): Promise<void>;

  // Hydration
  getHydrationLogs(userId: number, date: string): Promise<HydrationLog[]>;
  createHydrationLog(entry: InsertHydrationLog & { userId: number }): Promise<HydrationLog>;
  deleteHydrationLog(id: number, userId: number): Promise<void>;

  // Feedback
  insertFeedback(entry: { userId: number; category: string; message: string }): Promise<FeedbackEntry>;

  // Invite codes
  getInviteCode(code: string): Promise<InviteCode | undefined>;
  markInviteCodeUsed(code: string, email: string): Promise<void>;
  listInviteCodes(): Promise<InviteCode[]>;

  // Cycle symptoms
  getCycleSymptoms(userId: number, from: string, to: string): Promise<CycleSymptom[]>;
  upsertCycleSymptom(entry: { userId: number; date: string; energy?: string | null; bloating?: string | null; cravings?: string | null; mood?: string | null; appetite?: string | null }): Promise<CycleSymptom>;

  // Cycle period logs
  getCyclePeriodLogs(userId: number): Promise<CyclePeriodLog[]>;
  createCyclePeriodLog(entry: { userId: number; periodStartDate: string; periodEndDate?: string | null; computedCycleLength?: number | null; notes?: string | null }): Promise<CyclePeriodLog>;
  updateCyclePeriodLog(id: number, userId: number, updates: { periodEndDate?: string | null; notes?: string | null }): Promise<CyclePeriodLog | undefined>;
  deleteCyclePeriodLog(id: number, userId: number): Promise<void>;
  deleteAllCycleData(userId: number): Promise<void>;

  // AI insights cache
  getAiInsightsCache(userId: number, cacheKey: string): Promise<AiInsightsCache | undefined>;
  upsertAiInsightsCache(userId: number, cacheKey: string, narrativeJson: object, expiresAt: Date): Promise<void>;

  // Favourite meals
  getFavouriteMeals(userId: number): Promise<FavouriteMeal[]>;
  addFavouriteMeal(entry: { userId: number; mealName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot?: string | null; ingredients?: string | null; ingredientsJson?: unknown; instructions?: string | null }): Promise<FavouriteMeal>;
  updateFavouriteMeal(id: number, userId: number, updates: { mealName?: string; calories?: number; protein?: number; carbs?: number; fat?: number; mealSlot?: string | null; ingredients?: string | null; ingredientsJson?: unknown; instructions?: string | null }): Promise<FavouriteMeal | undefined>;
  removeFavouriteMeal(id: number, userId: number): Promise<void>;

  // User saved foods
  getUserSavedFoods(userId: number): Promise<UserSavedFood[]>;
  addUserSavedFood(entry: { userId: number; name: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number; servingGrams?: number; source?: string }): Promise<UserSavedFood>;
  updateUserSavedFood(id: number, userId: number, updates: { name?: string; calories100g?: number; protein100g?: number; carbs100g?: number; fat100g?: number; servingGrams?: number }): Promise<UserSavedFood | undefined>;
  removeUserSavedFood(id: number, userId: number): Promise<void>;

  // Community meals
  getCommunityMeals(filters?: { slot?: string; style?: string }): Promise<CommunityMeal[]>;
  getCommunityMealsByUser(userId: number): Promise<CommunityMeal[]>;
  getCommunityMealById(id: number): Promise<CommunityMeal | undefined>;
  createCommunityMeal(data: { sourceRecipeId?: number | null; sourceUserId?: number | null; name: string; slot: string; style: string; caloriesPerServing: number; proteinPerServing: number; carbsPerServing: number; fatPerServing: number; microScore?: number; source?: string }): Promise<CommunityMeal>;
  deactivateCommunityMeal(id: number, userId: number): Promise<void>;
  incrementCommunityMealFavourite(id: number): Promise<void>;
  getCommunityMealBalance(): Promise<{ style: string; slot: string; total: number; userContributed: number; aiGenerated: number }[]>;
  getCommunityMealByRecipeId(recipeId: number): Promise<CommunityMeal | undefined>;
  updateCommunityMealIngredients(id: number, ingredients: string[], instructions: string): Promise<CommunityMeal>;
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

    const initialPrefs: UserPreferences = { diet: null, allergies: [], excludedFoods: [], preferredFoods: [], micronutrientOptimize: false, onboardingComplete: false };
    const [created] = await db.insert(users).values({ email, name, provider, providerId, preferences: initialPrefs }).returning();
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

  async confirmFoodLogEntry(id: number, userId: number): Promise<FoodLogEntry | undefined> {
    const [updated] = await db.update(foodLogEntries)
      .set({ confirmed: true })
      .where(and(eq(foodLogEntries.id, id), eq(foodLogEntries.userId, userId)))
      .returning();
    return updated;
  }

  async bulkCreateFoodLogEntries(entries: Array<InsertFoodLogEntry & { userId: number }>): Promise<FoodLogEntry[]> {
    if (entries.length === 0) return [];
    return await db.insert(foodLogEntries).values(entries).returning();
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

  async searchCustomFoodsByName(query: string): Promise<CustomFood[]> {
    return await db.select().from(customFoods)
      .where(ilike(customFoods.name, `%${query}%`))
      .orderBy(desc(customFoods.createdAt))
      .limit(10);
  }

  async customFoodExistsByName(name: string): Promise<boolean> {
    const [row] = await db.select({ id: customFoods.id }).from(customFoods)
      .where(ilike(customFoods.name, name))
      .limit(1);
    return !!row;
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

  async updateCustomFoodBarcode(id: number, barcode: string): Promise<void> {
    await db.update(customFoods).set({ barcode }).where(eq(customFoods.id, id));
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

  async updateUserRecipe(id: number, userId: number, updates: { name?: string; caloriesPerServing?: number; proteinPerServing?: number; carbsPerServing?: number; fatPerServing?: number; mealSlot?: string; instructions?: string | null; ingredients?: string | null; ingredientsJson?: unknown }): Promise<UserRecipe | undefined> {
    const [updated] = await db.update(userRecipes)
      .set(updates)
      .where(and(eq(userRecipes.id, id), eq(userRecipes.userId, userId)))
      .returning();
    return updated;
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

  async insertFeedback(entry: { userId: number; category: string; message: string }): Promise<FeedbackEntry> {
    const [created] = await db.insert(feedbackEntries).values(entry).returning();
    return created;
  }

  async getInviteCode(code: string): Promise<InviteCode | undefined> {
    const [record] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code));
    return record;
  }

  async markInviteCodeUsed(code: string, email: string): Promise<void> {
    await db.update(inviteCodes)
      .set({ usedAt: new Date(), usedByEmail: email })
      .where(eq(inviteCodes.code, code));
  }

  async listInviteCodes(): Promise<InviteCode[]> {
    return await db.select().from(inviteCodes).orderBy(inviteCodes.code);
  }

  async getCycleSymptoms(userId: number, from: string, to: string): Promise<CycleSymptom[]> {
    return await db.select().from(cycleSymptoms)
      .where(and(eq(cycleSymptoms.userId, userId), gte(cycleSymptoms.date, from), lte(cycleSymptoms.date, to)))
      .orderBy(desc(cycleSymptoms.date));
  }

  async upsertCycleSymptom(entry: { userId: number; date: string; energy?: string | null; bloating?: string | null; cravings?: string | null; mood?: string | null; appetite?: string | null }): Promise<CycleSymptom> {
    const [existing] = await db.select().from(cycleSymptoms)
      .where(and(eq(cycleSymptoms.userId, entry.userId), eq(cycleSymptoms.date, entry.date)));
    if (existing) {
      const [updated] = await db.update(cycleSymptoms)
        .set({ energy: entry.energy, bloating: entry.bloating, cravings: entry.cravings, mood: entry.mood, appetite: entry.appetite })
        .where(eq(cycleSymptoms.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(cycleSymptoms).values(entry).returning();
    return created;
  }

  async getCyclePeriodLogs(userId: number): Promise<CyclePeriodLog[]> {
    return await db.select().from(cyclePeriodLogs)
      .where(eq(cyclePeriodLogs.userId, userId))
      .orderBy(desc(cyclePeriodLogs.periodStartDate));
  }

  async createCyclePeriodLog(entry: { userId: number; periodStartDate: string; periodEndDate?: string | null; computedCycleLength?: number | null; notes?: string | null }): Promise<CyclePeriodLog> {
    const [created] = await db.insert(cyclePeriodLogs).values(entry).returning();
    return created;
  }

  async updateCyclePeriodLog(id: number, userId: number, updates: { periodEndDate?: string | null; notes?: string | null }): Promise<CyclePeriodLog | undefined> {
    const [updated] = await db.update(cyclePeriodLogs)
      .set(updates)
      .where(and(eq(cyclePeriodLogs.id, id), eq(cyclePeriodLogs.userId, userId)))
      .returning();
    return updated;
  }

  async deleteCyclePeriodLog(id: number, userId: number): Promise<void> {
    await db.delete(cyclePeriodLogs)
      .where(and(eq(cyclePeriodLogs.id, id), eq(cyclePeriodLogs.userId, userId)));
  }

  async deleteAllCycleData(userId: number): Promise<void> {
    await db.delete(cyclePeriodLogs).where(eq(cyclePeriodLogs.userId, userId));
    await db.delete(cycleSymptoms).where(eq(cycleSymptoms.userId, userId));
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user?.preferences) {
      const prefs = user.preferences as Record<string, unknown>;
      delete prefs.lastPeriodDate;
      delete prefs.cycleLength;
      delete prefs.periodLength;
      await db.update(users).set({ preferences: prefs }).where(eq(users.id, userId));
    }
  }

  async getAiInsightsCache(userId: number, cacheKey: string): Promise<AiInsightsCache | undefined> {
    const [record] = await db.select().from(aiInsightsCache)
      .where(and(eq(aiInsightsCache.userId, userId), eq(aiInsightsCache.cacheKey, cacheKey)));
    return record;
  }

  async upsertAiInsightsCache(userId: number, cacheKey: string, narrativeJson: object, expiresAt: Date): Promise<void> {
    await db.insert(aiInsightsCache)
      .values({ userId, cacheKey, narrativeJson, expiresAt })
      .onConflictDoUpdate({
        target: [aiInsightsCache.userId, aiInsightsCache.cacheKey],
        set: { narrativeJson, expiresAt, createdAt: new Date() },
      });
  }

  async getFavouriteMeals(userId: number): Promise<FavouriteMeal[]> {
    return await db.select().from(favouriteMeals)
      .where(eq(favouriteMeals.userId, userId))
      .orderBy(desc(favouriteMeals.createdAt));
  }

  async addFavouriteMeal(entry: { userId: number; mealName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot?: string | null; ingredients?: string | null; ingredientsJson?: unknown; instructions?: string | null }): Promise<FavouriteMeal> {
    const [created] = await db.insert(favouriteMeals).values(entry).returning();
    return created;
  }

  async updateFavouriteMeal(id: number, userId: number, updates: { mealName?: string; calories?: number; protein?: number; carbs?: number; fat?: number; mealSlot?: string | null; ingredients?: string | null; ingredientsJson?: unknown; instructions?: string | null }): Promise<FavouriteMeal | undefined> {
    const [updated] = await db.update(favouriteMeals)
      .set(updates)
      .where(and(eq(favouriteMeals.id, id), eq(favouriteMeals.userId, userId)))
      .returning();
    return updated;
  }

  async removeFavouriteMeal(id: number, userId: number): Promise<void> {
    await db.delete(favouriteMeals)
      .where(and(eq(favouriteMeals.id, id), eq(favouriteMeals.userId, userId)));
  }

  async getUserSavedFoods(userId: number): Promise<UserSavedFood[]> {
    return await db.select().from(userSavedFoods)
      .where(eq(userSavedFoods.userId, userId))
      .orderBy(desc(userSavedFoods.createdAt));
  }

  async addUserSavedFood(entry: { userId: number; name: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number; servingGrams?: number; source?: string }): Promise<UserSavedFood> {
    const [created] = await db.insert(userSavedFoods).values({
      ...entry,
      servingGrams: entry.servingGrams ?? 100,
      source: entry.source ?? null,
    }).returning();
    return created;
  }

  async updateUserSavedFood(id: number, userId: number, updates: { name?: string; calories100g?: number; protein100g?: number; carbs100g?: number; fat100g?: number; servingGrams?: number }): Promise<UserSavedFood | undefined> {
    const setObj: Record<string, unknown> = {};
    if (updates.name !== undefined) setObj.name = updates.name;
    if (updates.calories100g !== undefined) setObj.calories100g = updates.calories100g;
    if (updates.protein100g !== undefined) setObj.protein100g = String(updates.protein100g);
    if (updates.carbs100g !== undefined) setObj.carbs100g = String(updates.carbs100g);
    if (updates.fat100g !== undefined) setObj.fat100g = String(updates.fat100g);
    if (updates.servingGrams !== undefined) setObj.servingGrams = updates.servingGrams;
    const [updated] = await db.update(userSavedFoods)
      .set(setObj)
      .where(and(eq(userSavedFoods.id, id), eq(userSavedFoods.userId, userId)))
      .returning();
    return updated;
  }

  async removeUserSavedFood(id: number, userId: number): Promise<void> {
    await db.delete(userSavedFoods)
      .where(and(eq(userSavedFoods.id, id), eq(userSavedFoods.userId, userId)));
  }

  async getCommunityMeals(filters?: { slot?: string; style?: string }): Promise<CommunityMeal[]> {
    let query = db.select().from(communityMeals).where(eq(communityMeals.active, true));
    if (filters?.slot) {
      query = db.select().from(communityMeals).where(and(eq(communityMeals.active, true), eq(communityMeals.slot, filters.slot)));
    }
    if (filters?.slot && filters?.style) {
      query = db.select().from(communityMeals).where(and(eq(communityMeals.active, true), eq(communityMeals.slot, filters.slot), eq(communityMeals.style, filters.style)));
    }
    if (!filters?.slot && filters?.style) {
      query = db.select().from(communityMeals).where(and(eq(communityMeals.active, true), eq(communityMeals.style, filters.style)));
    }
    return await query.orderBy(desc(communityMeals.favouriteCount));
  }

  async getCommunityMealsByUser(userId: number): Promise<CommunityMeal[]> {
    return await db.select().from(communityMeals)
      .where(eq(communityMeals.sourceUserId, userId))
      .orderBy(desc(communityMeals.createdAt));
  }

  async getCommunityMealById(id: number): Promise<CommunityMeal | undefined> {
    const [row] = await db.select().from(communityMeals).where(eq(communityMeals.id, id));
    return row;
  }

  async getCommunityMealByRecipeId(recipeId: number): Promise<CommunityMeal | undefined> {
    const [row] = await db.select().from(communityMeals)
      .where(and(eq(communityMeals.sourceRecipeId, recipeId), eq(communityMeals.active, true)));
    return row;
  }

  async createCommunityMeal(data: { sourceRecipeId?: number | null; sourceUserId?: number | null; name: string; slot: string; style: string; caloriesPerServing: number; proteinPerServing: number; carbsPerServing: number; fatPerServing: number; microScore?: number; source?: string }): Promise<CommunityMeal> {
    const [created] = await db.insert(communityMeals).values({
      sourceRecipeId: data.sourceRecipeId ?? null,
      sourceUserId: data.sourceUserId ?? null,
      name: data.name,
      slot: data.slot,
      style: data.style,
      caloriesPerServing: data.caloriesPerServing,
      proteinPerServing: data.proteinPerServing,
      carbsPerServing: data.carbsPerServing,
      fatPerServing: data.fatPerServing,
      microScore: data.microScore ?? 3,
      source: data.source ?? "user",
    }).returning();
    return created;
  }

  async deactivateCommunityMeal(id: number, userId: number): Promise<void> {
    await db.update(communityMeals)
      .set({ active: false })
      .where(and(eq(communityMeals.id, id), eq(communityMeals.sourceUserId, userId)));
  }

  async incrementCommunityMealFavourite(id: number): Promise<void> {
    await db.update(communityMeals)
      .set({ favouriteCount: sql`${communityMeals.favouriteCount} + 1` })
      .where(eq(communityMeals.id, id));
  }

  async updateCommunityMealIngredients(id: number, ingredients: string[], instructions: string): Promise<CommunityMeal> {
    const [updated] = await db.update(communityMeals)
      .set({ ingredients, instructions })
      .where(eq(communityMeals.id, id))
      .returning();
    return updated;
  }

  async getCommunityMealBalance(): Promise<{ style: string; slot: string; total: number; userContributed: number; aiGenerated: number }[]> {
    const styles = ["simple", "gourmet", "michelin"];
    const slots = ["breakfast", "lunch", "dinner", "snack"];
    const result: { style: string; slot: string; total: number; userContributed: number; aiGenerated: number }[] = [];
    for (const style of styles) {
      for (const slot of slots) {
        const rows = await db.select().from(communityMeals)
          .where(and(eq(communityMeals.active, true), eq(communityMeals.style, style), eq(communityMeals.slot, slot)));
        const total = rows.length;
        const aiGenerated = rows.filter(r => r.source === "ai_generated").length;
        result.push({ style, slot, total, userContributed: total - aiGenerated, aiGenerated });
      }
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
