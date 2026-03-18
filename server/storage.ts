import { calculations, users, savedMealPlans, weightEntries, foodLogEntries, passwordResetTokens, customFoods, hydrationLogs, feedbackEntries, inviteCodes, cycleSymptoms, cyclePeriodLogs, aiInsightsCache, communityMeals, userSavedFoods, userMeals, mealTemplates, featureGates, creditTransactions, tierPricing, creditPacks, vitalitySymptoms, canonicalFoods, userFoodBookmarks, mealIngredients, communityMealIngredients, recipeIngredients, nutritionistProfiles, nutritionistClients, nutritionistInvitations, nutritionistNotes, nutritionistPlans, planAnnotations, planTemplates, practiceAccounts, practiceMembers, nutritionistMessages, clientTargetOverrides, type InsertCalculation, type Calculation, type InsertUser, type User, type SavedMealPlan, type InsertSavedMealPlan, type WeightEntry, type UserPreferences, type FoodLogEntry, type InsertFoodLogEntry, type CustomFood, type InsertCustomFood, type HydrationLog, type InsertHydrationLog, type FeedbackEntry, type InviteCode, type CycleSymptom, type CyclePeriodLog, type AiInsightsCache, type CommunityMeal, type UserSavedFood, type UserMeal, type InsertUserMeal, type MealTemplate, type FeatureGate, type CreditTransaction, type TierPricing, type CreditPack, type VitalitySymptom, type CanonicalFood, type InsertCanonicalFood, type UserFoodBookmark, type MealIngredient, type CommunityMealIngredient, type RecipeIngredient, type NutritionistProfile, type InsertNutritionistProfile, type NutritionistClient, type InsertNutritionistClient, type NutritionistInvitation, type NutritionistNote, type NutritionistPlan, type InsertNutritionistPlan, type PlanAnnotation, type InsertPlanAnnotation, type PlanTemplate, type InsertPlanTemplate, type PracticeAccount, type InsertPracticeAccount, type PracticeMember, type NutritionistMessage, type ClientTargetOverride, type InsertClientTargetOverride } from "@shared/schema";
import { db } from "./db";
import { desc, eq, and, gte, lte, lt, ilike, sql, or } from "drizzle-orm";
import type { IngredientResult } from "./lib/ingredient-parser";
import { isKnownZeroCalorieFood } from "./lib/ingredient-parser";

export interface IStorage {
  // Auth
  createUser(user: InsertUser & { provider?: string; providerId?: string }): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  findOrCreateOAuthUser(opts: { email: string; name: string; provider: string; providerId: string }): Promise<User>;
  updateUserPassword(userId: number, passwordHash: string): Promise<void>;
  updateUserProfile(userId: number, updates: { name?: string; email?: string }): Promise<User>;

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
  updateFoodLogEntry(id: number, userId: number, updates: Partial<Pick<FoodLogEntry, 'mealName' | 'calories' | 'protein' | 'carbs' | 'fat' | 'fibre' | 'sugar' | 'saturatedFat' | 'mealSlot'>>): Promise<FoodLogEntry | undefined>;

  // Password reset tokens
  createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ id: number; userId: number; expiresAt: Date; usedAt: Date | null } | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;

  // Custom foods (legacy — kept for backward compat)
  getCustomFoodByBarcode(barcode: string): Promise<CustomFood | undefined>;
  searchCustomFoodsByName(query: string): Promise<CustomFood[]>;
  searchCustomFoodsByNameForUser(query: string, userId: number): Promise<CustomFood[]>;
  customFoodExistsByName(name: string): Promise<boolean>;
  createCustomFood(food: InsertCustomFood): Promise<CustomFood>;
  getCustomFoods(): Promise<CustomFood[]>;
  deleteCustomFood(id: number, userId: number): Promise<void>;
  updateCustomFoodBarcode(id: number, barcode: string): Promise<void>;

  // Canonical foods (shared food database)
  searchCanonicalFoods(query: string, limit?: number, regionBoost?: string | null): Promise<CanonicalFood[]>;
  getCanonicalFoodByBarcode(barcode: string): Promise<CanonicalFood | undefined>;
  getCanonicalFoodByFdcId(fdcId: string): Promise<CanonicalFood | undefined>;
  canonicalFoodExistsByName(name: string): Promise<CanonicalFood | undefined>;
  checkCanonicalFoodNames(names: string[]): Promise<Set<string>>;
  upsertCanonicalFood(food: {
    name: string;
    calories100g: number;
    protein100g: number;
    carbs100g: number;
    fat100g: number;
    fibre100g?: number | null;
    sodium100g?: number | null;
    servingGrams?: number;
    barcode?: string | null;
    fdcId?: string | null;
    source?: string;
    region?: string | null;
    contributedByUserId?: number | null;
  }): Promise<CanonicalFood>;
  getCanonicalFoodById(id: number): Promise<CanonicalFood | undefined>;
  verifyCanonicalFood(id: number): Promise<CanonicalFood | undefined>;
  unverifyCanonicalFood(id: number): Promise<CanonicalFood | undefined>;

  // User food bookmarks
  getUserFoodBookmarks(userId: number, opts?: { cursor?: string; limit?: number; search?: string }): Promise<{ items: (UserFoodBookmark & { food: CanonicalFood })[]; nextCursor: string | null }>;
  addUserFoodBookmark(entry: { userId: number; canonicalFoodId: number; servingGrams?: number; nickname?: string }): Promise<UserFoodBookmark & { food: CanonicalFood }>;
  removeUserFoodBookmark(id: number, userId: number): Promise<void>;
  updateUserFoodBookmark(id: number, userId: number, updates: { servingGrams?: number; nickname?: string }): Promise<(UserFoodBookmark & { food: CanonicalFood }) | undefined>;
  findDuplicateUserFoodBookmarks(userId: number, canonicalFoodId: number): Promise<UserFoodBookmark[]>;


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
  updateCyclePeriodLog(id: number, userId: number, updates: { periodStartDate?: string; periodEndDate?: string | null; computedCycleLength?: number | null; notes?: string | null }): Promise<CyclePeriodLog | undefined>;
  deleteCyclePeriodLog(id: number, userId: number): Promise<void>;
  deleteAllCycleData(userId: number): Promise<void>;

  // Vitality symptoms
  getVitalitySymptoms(userId: number, from: string, to: string): Promise<VitalitySymptom[]>;
  upsertVitalitySymptom(entry: { userId: number; date: string; energy?: string | null; motivation?: string | null; focus?: string | null; stress?: string | null; sleepQuality?: string | null; libido?: string | null }): Promise<VitalitySymptom>;
  deleteAllVitalityData(userId: number): Promise<void>;

  // AI insights cache
  getAiInsightsCache(userId: number, cacheKey: string): Promise<AiInsightsCache | undefined>;
  upsertAiInsightsCache(userId: number, cacheKey: string, narrativeJson: object, expiresAt: Date): Promise<void>;

  // Unified user meals
  getUserMeals(userId: number, opts?: { cursor?: string; limit?: number; search?: string; slot?: string }): Promise<{ items: UserMeal[]; nextCursor: string | null }>;
  createUserMeal(meal: InsertUserMeal & { userId: number }): Promise<UserMeal>;
  updateUserMeal(id: number, userId: number, updates: Partial<Pick<UserMeal, 'name' | 'caloriesPerServing' | 'proteinPerServing' | 'carbsPerServing' | 'fatPerServing' | 'servings' | 'sourceUrl' | 'imageUrl' | 'mealSlot' | 'mealStyle' | 'ingredients' | 'ingredientsJson' | 'instructions' | 'source' | 'sourcePhotos'>>): Promise<UserMeal | undefined>;
  deleteUserMeal(id: number, userId: number): Promise<void>;

  findDuplicateUserMeals(userId: number, name: string): Promise<UserMeal[]>;

  // Meal ingredients junction table
  getMealIngredients(userMealId: number): Promise<(MealIngredient & { canonicalFood: CanonicalFood | null })[]>;
  syncMealIngredientsFromJson(userMealId: number, ingredientsJson: { name: string; grams: number; calories100g: number; protein100g: number; carbs100g: number; fat100g: number }[]): Promise<void>;
  recomputeMealMacros(userMealId: number, userId: number): Promise<UserMeal | undefined>;
  deleteMealIngredients(userMealId: number): Promise<void>;

  // User saved foods
  getUserSavedFoods(userId: number, opts?: { cursor?: string; limit?: number; search?: string }): Promise<{ items: UserSavedFood[]; nextCursor: string | null }>;
  addUserSavedFood(entry: { userId: number; name: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number; servingGrams?: number; source?: string }): Promise<UserSavedFood>;
  updateUserSavedFood(id: number, userId: number, updates: { name?: string; calories100g?: number; protein100g?: number; carbs100g?: number; fat100g?: number; servingGrams?: number }): Promise<UserSavedFood | undefined>;
  removeUserSavedFood(id: number, userId: number): Promise<void>;
  findDuplicateUserSavedFoods(userId: number, name: string): Promise<UserSavedFood[]>;

  // Community meals
  getCommunityMeals(filters?: { slot?: string; style?: string }): Promise<CommunityMeal[]>;
  getCommunityMealsByUser(userId: number): Promise<CommunityMeal[]>;
  getCommunityMealById(id: number): Promise<CommunityMeal | undefined>;
  createCommunityMeal(data: { sourceRecipeId?: number | null; sourceUserId?: number | null; name: string; slot: string; style: string; caloriesPerServing: number; proteinPerServing: number; carbsPerServing: number; fatPerServing: number; microScore?: number; source?: string; ingredientsJson?: IngredientResult[] | null }): Promise<CommunityMeal>;
  deactivateCommunityMeal(id: number, userId: number): Promise<void>;
  incrementCommunityMealFavourite(id: number): Promise<void>;
  getCommunityMealBalance(): Promise<{ style: string; slot: string; total: number; userContributed: number; aiGenerated: number }[]>;
  getCommunityMealByRecipeId(recipeId: number): Promise<CommunityMeal | undefined>;
  updateCommunityMealIngredients(id: number, ingredients: string[], instructions: string, ingredientsJson?: IngredientResult[]): Promise<CommunityMeal>;

  // Community meal ingredients junction
  getCommunityMealIngredients(communityMealId: number): Promise<(CommunityMealIngredient & { canonicalFood: CanonicalFood | null })[]>;
  syncCommunityMealIngredientsFromJson(communityMealId: number, ingredientsJson: { name: string; grams: number; calories100g: number; protein100g: number; carbs100g: number; fat100g: number }[]): Promise<void>;
  deleteCommunityMealIngredients(communityMealId: number): Promise<void>;

  // Recipe ingredients junction
  getRecipeIngredients(userRecipeId: number): Promise<(RecipeIngredient & { canonicalFood: CanonicalFood | null })[]>;
  syncRecipeIngredientsFromJson(userRecipeId: number, ingredientsJson: { name: string; grams: number; calories100g: number; protein100g: number; carbs100g: number; fat100g: number }[]): Promise<void>;
  deleteRecipeIngredients(userRecipeId: number): Promise<void>;

  // Meal templates
  getMealTemplates(userId: number): Promise<MealTemplate[]>;
  createMealTemplate(entry: { userId: number; userMealId: number; mealSlot: string; daysOfWeek: string[] }): Promise<MealTemplate>;
  updateMealTemplate(id: number, userId: number, updates: { mealSlot?: string; daysOfWeek?: string[]; active?: boolean }): Promise<MealTemplate | undefined>;
  deleteMealTemplate(id: number, userId: number): Promise<void>;

  // Trial
  updateUserTrial(userId: number, updates: { trialStartDate?: Date; trialStatus?: string; trialStepDownSeen?: boolean; trialExpiredSeen?: boolean }): Promise<void>;

  // Tier & billing
  updateUserTier(userId: number, updates: { tier?: string; stripeCustomerId?: string | null; stripeSubscriptionId?: string | null; tierExpiresAt?: Date | null; creditBalance?: number; paymentFailedAt?: Date | null; betaUser?: boolean; betaTierLocked?: boolean; pendingTier?: string | null }): Promise<User>;
  getFeatureGates(): Promise<FeatureGate[]>;
  getFeatureGate(featureKey: string): Promise<FeatureGate | undefined>;
  upsertFeatureGate(featureKey: string, requiredTier: string, creditCost: number, description?: string): Promise<FeatureGate>;
  deleteFeatureGate(featureKey: string): Promise<void>;
  createCreditTransaction(entry: { userId: number; amount: number; type: string; featureKey?: string; description?: string; costUsd?: number }): Promise<CreditTransaction>;
  getCreditTransactions(userId: number, limit?: number): Promise<CreditTransaction[]>;
  getMonthlySpendUsd(userId: number): Promise<number>;
  adjustCreditBalance(userId: number, amount: number): Promise<number>;

  // Tier pricing
  getTierPricing(): Promise<TierPricing[]>;
  getTierPricingByTier(tier: string): Promise<TierPricing | undefined>;
  upsertTierPricing(data: { tier: string; monthlyPriceUsd: number; annualPriceUsd: number; stripePriceIdMonthly?: string; stripePriceIdAnnual?: string; active?: boolean; features?: unknown[]; displayOrder?: number }): Promise<TierPricing>;
  updateTierPricing(id: number, updates: Partial<{ monthlyPriceUsd: number; annualPriceUsd: number; stripePriceIdMonthly: string; stripePriceIdAnnual: string; active: boolean; features: unknown[]; displayOrder: number }>): Promise<TierPricing | undefined>;

  // Credit packs
  getCreditPacks(): Promise<CreditPack[]>;
  upsertCreditPack(data: { id?: number; credits: number; priceUsd: number; stripePriceId?: string; active?: boolean }): Promise<CreditPack>;
  deleteCreditPack(id: number): Promise<void>;

  // User lookup helpers
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Managed client flag
  setManagedClientFlag(userId: number, isManagedClient: boolean, managedByNutritionistId: number | null): Promise<void>;

  // Nutritionist profiles
  getNutritionistProfile(userId: number): Promise<NutritionistProfile | undefined>;
  createNutritionistProfile(userId: number, data: InsertNutritionistProfile): Promise<NutritionistProfile>;
  updateNutritionistProfile(userId: number, data: Partial<InsertNutritionistProfile>): Promise<NutritionistProfile | undefined>;

  // Nutritionist clients
  getNutritionistClients(nutritionistId: number): Promise<(NutritionistClient & { client: Pick<User, "id" | "name" | "email" | "isManagedClient" | "createdAt"> })[]>;
  getNutritionistClientCount(nutritionistId: number): Promise<number>;
  addNutritionistClient(nutritionistId: number, clientId: number, data?: { status?: string; goalSummary?: string; notes?: string }): Promise<NutritionistClient>;
  updateNutritionistClient(id: number, nutritionistId: number, updates: { status?: string; goalSummary?: string; healthNotes?: string; notes?: string; lastActivityAt?: Date }): Promise<NutritionistClient | undefined>;
  removeNutritionistClient(id: number, nutritionistId: number): Promise<void>;
  getNutritionistClientByClientId(nutritionistId: number, clientId: number): Promise<NutritionistClient | undefined>;
  getNutritionistClientByClientIdAny(clientId: number): Promise<NutritionistClient | undefined>;

  // Nutritionist invitations
  createNutritionistInvitation(nutritionistId: number, email: string, token: string, expiresAt: Date): Promise<NutritionistInvitation>;
  getNutritionistInvitationByToken(token: string): Promise<NutritionistInvitation | undefined>;
  acceptNutritionistInvitation(token: string): Promise<NutritionistInvitation | undefined>;
  getNutritionistInvitations(nutritionistId: number): Promise<NutritionistInvitation[]>;

  // Nutritionist notes
  getNutritionistNotes(nutritionistId: number, clientId: number): Promise<NutritionistNote[]>;
  createNutritionistNote(nutritionistId: number, clientId: number, note: string): Promise<NutritionistNote>;
  updateNutritionistNote(id: number, nutritionistId: number, clientId: number, note: string): Promise<NutritionistNote | undefined>;
  deleteNutritionistNote(id: number, nutritionistId: number, clientId: number): Promise<void>;

  // Nutritionist plans (plan builder & AI workflow)
  getNutritionistPlans(nutritionistId: number, clientId?: number): Promise<NutritionistPlan[]>;
  getNutritionistPlanById(id: number, nutritionistId: number): Promise<NutritionistPlan | undefined>;
  createNutritionistPlan(plan: InsertNutritionistPlan): Promise<NutritionistPlan>;
  updateNutritionistPlan(id: number, nutritionistId: number, updates: Partial<Pick<NutritionistPlan, 'name' | 'planData' | 'status' | 'promptNote' | 'scheduledDeliverAt'>>): Promise<NutritionistPlan | undefined>;
  deleteNutritionistPlan(id: number, nutritionistId: number): Promise<void>;
  deliverNutritionistPlan(id: number, nutritionistId: number): Promise<NutritionistPlan | undefined>;
  getPendingReviewPlans(nutritionistId: number): Promise<NutritionistPlan[]>;
  getClientPlanHistory(nutritionistId: number, clientId: number): Promise<NutritionistPlan[]>;
  getDeliveredPlansForClient(clientId: number): Promise<NutritionistPlan[]>;

  getPlanAnnotations(planId: number): Promise<PlanAnnotation[]>;
  upsertPlanAnnotation(entry: InsertPlanAnnotation): Promise<PlanAnnotation>;
  deletePlanAnnotation(id: number, planId: number): Promise<void>;

  getPlanTemplates(nutritionistId: number): Promise<PlanTemplate[]>;
  createPlanTemplate(template: InsertPlanTemplate): Promise<PlanTemplate>;
  updatePlanTemplate(id: number, nutritionistId: number, updates: Partial<Pick<PlanTemplate, 'name' | 'description' | 'planData'>>): Promise<PlanTemplate | undefined>;
  deletePlanTemplate(id: number, nutritionistId: number): Promise<void>;

  // Client target overrides
  getClientTargetOverrides(clientId: number): Promise<ClientTargetOverride | undefined>;
  upsertClientTargetOverrides(nutritionistId: number, clientId: number, overrides: Partial<InsertClientTargetOverride>): Promise<ClientTargetOverride>;
  clearClientTargetOverrides(nutritionistId: number, clientId: number): Promise<void>;
  getEffectiveTargets(clientId: number): Promise<{ dailyCalories: number; proteinGoal: number; carbsGoal: number; fatGoal: number; fibreGoal: number | null; hasOverrides: boolean; overriddenFields: string[] } | null>;

  // Practice accounts
  getPracticeByAdmin(adminUserId: number): Promise<PracticeAccount | undefined>;
  getPracticeById(id: number): Promise<PracticeAccount | undefined>;
  createPracticeAccount(adminUserId: number, name: string, maxSeats?: number): Promise<PracticeAccount>;
  updatePracticeAccount(id: number, updates: { name?: string; maxSeats?: number }): Promise<PracticeAccount | undefined>;
  getPracticeMembers(practiceId: number): Promise<(PracticeMember & { nutritionist: Pick<User, "id" | "name" | "email"> & { profile: NutritionistProfile | null } })[]>;
  getPracticeMemberByNutritionist(practiceId: number, nutritionistUserId: number): Promise<PracticeMember | undefined>;
  getPracticeByMember(nutritionistUserId: number): Promise<PracticeAccount | undefined>;
  addPracticeMember(practiceId: number, nutritionistUserId: number, role?: string): Promise<PracticeMember>;
  removePracticeMember(practiceId: number, nutritionistUserId: number): Promise<void>;
  updatePracticeMemberRole(practiceId: number, nutritionistUserId: number, role: string): Promise<PracticeMember | undefined>;

  // Nutritionist messages
  getMessages(nutritionistId: number, clientId: number, limit?: number, before?: number): Promise<NutritionistMessage[]>;
  createMessage(nutritionistId: number, clientId: number, senderId: number, body: string): Promise<NutritionistMessage>;
  markMessagesRead(nutritionistId: number, clientId: number, readerId: number): Promise<void>;
  getUnreadCountForNutritionist(nutritionistId: number): Promise<{ clientId: number; count: number }[]>;
  getUnreadCountForClient(clientId: number): Promise<number>;
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

  async updateUserProfile(userId: number, updates: { name?: string; email?: string }): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
    return updated;
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

  async updateFoodLogEntry(id: number, userId: number, updates: Partial<Pick<FoodLogEntry, 'mealName' | 'calories' | 'protein' | 'carbs' | 'fat' | 'fibre' | 'sugar' | 'saturatedFat' | 'mealSlot'>>): Promise<FoodLogEntry | undefined> {
    const [updated] = await db.update(foodLogEntries)
      .set(updates)
      .where(and(eq(foodLogEntries.id, id), eq(foodLogEntries.userId, userId)))
      .returning();
    return updated;
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

  async searchCustomFoodsByNameForUser(query: string, userId: number): Promise<CustomFood[]> {
    return await db.select().from(customFoods)
      .where(and(
        ilike(customFoods.name, `%${query}%`),
        eq(customFoods.contributedByUserId, userId),
      ))
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

  async searchCanonicalFoods(query: string, limit = 10, regionBoost?: string | null): Promise<CanonicalFood[]> {
    const normalized = query.toLowerCase().replace(/\s+/g, " ").trim();
    const boostRegion = regionBoost ?? null;
    return db.select().from(canonicalFoods)
      .where(ilike(canonicalFoods.canonicalName, `%${normalized}%`))
      .orderBy(
        boostRegion
          ? sql`CASE WHEN ${canonicalFoods.region} = ${boostRegion} THEN 0 WHEN ${canonicalFoods.region} IS NOT NULL THEN 1 ELSE 2 END`
          : sql`CASE WHEN ${canonicalFoods.verifiedAt} IS NOT NULL THEN 0 ELSE 1 END`,
        sql`CASE WHEN ${canonicalFoods.verifiedAt} IS NOT NULL THEN 0 ELSE 1 END`,
        desc(canonicalFoods.createdAt),
      )
      .limit(limit);
  }

  async getCanonicalFoodByBarcode(barcode: string): Promise<CanonicalFood | undefined> {
    const [row] = await db.select().from(canonicalFoods)
      .where(eq(canonicalFoods.barcode, barcode))
      .limit(1);
    return row;
  }

  async getCanonicalFoodByFdcId(fdcId: string): Promise<CanonicalFood | undefined> {
    const [row] = await db.select().from(canonicalFoods)
      .where(eq(canonicalFoods.fdcId, fdcId))
      .limit(1);
    return row;
  }

  private static readonly TRUSTED_SOURCES = ["usda_cached", "barcode_scan", "openfoodfacts", "open_food_facts", "nzfcd", "fsanz", "nz_regional", "au_regional"];

  async canonicalFoodExistsByName(name: string): Promise<CanonicalFood | undefined> {
    const canonical = name.toLowerCase().replace(/\s+/g, " ").trim();
    const rows = await db.select().from(canonicalFoods)
      .where(eq(canonicalFoods.canonicalName, canonical))
      .orderBy(
        sql`CASE WHEN ${canonicalFoods.source} IN (${sql.join(DatabaseStorage.TRUSTED_SOURCES.map(s => sql`${s}`), sql`, `)}) THEN 0 ELSE 1 END`,
        desc(canonicalFoods.verifiedAt)
      )
      .limit(1);
    if (rows.length === 0) {
      return this.findTrustedCanonicalBySubstring(canonical);
    }
    const row = rows[0];
    if (DatabaseStorage.TRUSTED_SOURCES.includes(row.source ?? "")) return row;

    const trustedFallback = await this.findTrustedCanonicalBySubstring(canonical);
    return trustedFallback ?? row;
  }

  private async findTrustedCanonicalBySubstring(canonical: string): Promise<CanonicalFood | undefined> {
    if (canonical.length < 4) return undefined;
    const rows = await db.select().from(canonicalFoods)
      .where(sql`${canonicalFoods.canonicalName} LIKE ${'% ' + canonical} AND ${canonicalFoods.source} IN (${sql.join(DatabaseStorage.TRUSTED_SOURCES.map(s => sql`${s}`), sql`, `)})`)
      .limit(10);
    if (rows.length === 0) return undefined;
    const wordCount = (s: string) => s.split(/\s+/).length;
    const scored = rows
      .filter(r => {
        const rName = (r.canonicalName ?? "").toLowerCase();
        if (!rName.endsWith(" " + canonical)) return false;
        if (wordCount(rName) > wordCount(canonical) + 2) return false;
        return true;
      })
      .sort((a, b) => {
        const aWords = wordCount((a.canonicalName ?? "").toLowerCase());
        const bWords = wordCount((b.canonicalName ?? "").toLowerCase());
        return aWords - bWords;
      });
    return scored[0];
  }

  async checkCanonicalFoodNames(names: string[]): Promise<Set<string>> {
    if (names.length === 0) return new Set();
    const canonicals = names.map(n => n.toLowerCase().replace(/\s+/g, " ").trim());
    const rows = await db.select({ canonicalName: canonicalFoods.canonicalName })
      .from(canonicalFoods)
      .where(sql`${canonicalFoods.canonicalName} = ANY(${canonicals})`);
    return new Set(rows.map(r => r.canonicalName));
  }

  async upsertCanonicalFood(food: {
    name: string;
    calories100g: number;
    protein100g: number;
    carbs100g: number;
    fat100g: number;
    fibre100g?: number | null;
    sodium100g?: number | null;
    servingGrams?: number;
    barcode?: string | null;
    fdcId?: string | null;
    source?: string;
    region?: string | null;
    contributedByUserId?: number | null;
  }): Promise<CanonicalFood> {
    // Sanity-check: log a warning and skip upsert for implausible calorie values
    let { calories100g, protein100g, carbs100g, fat100g } = food;
    const { name } = food;

    const isZeroCal = isKnownZeroCalorieFood(name);
    if (isZeroCal) {
      if (calories100g !== 0 || protein100g !== 0 || carbs100g !== 0 || fat100g !== 0) {
        console.warn(`[upsertCanonicalFood] Forcing zero values for known zero-calorie food "${name}" (had ${calories100g} kcal)`);
      }
      calories100g = 0;
      protein100g = 0;
      carbs100g = 0;
      fat100g = 0;
      food = { ...food, calories100g: 0, protein100g: 0, carbs100g: 0, fat100g: 0 };
    }

    // Nothing edible exceeds pure fat at ~900 kcal/100g
    if (calories100g > 950) {
      console.warn(`[upsertCanonicalFood] Skipping "${name}" — calories_100g=${calories100g} exceeds max plausible value (950)`);
      const fallback = await this.canonicalFoodExistsByName(name);
      if (fallback) return fallback;
      throw new Error(`Implausible calorie value (${calories100g} kcal/100g) for food "${name}" — upsert skipped`);
    }

    const macroSum = protein100g + carbs100g + fat100g;
    if (macroSum < 0.5 && calories100g > 5) {
      console.warn(
        `[upsertCanonicalFood] Skipping "${name}" — calories_100g=${calories100g} but all macros are effectively zero ` +
        `(protein=${protein100g}g, carbs=${carbs100g}g, fat=${fat100g}g). Likely hallucinated value.`
      );
      const fallback = await this.canonicalFoodExistsByName(name);
      if (fallback) return fallback;
      throw new Error(`Zero-macro food "${name}" with ${calories100g} kcal/100g is implausible — upsert skipped`);
    }

    const isLowFatLowSugar = fat100g < 10 && carbs100g < 15;
    if (isLowFatLowSugar) {
      const expectedCalories = protein100g * 4 + carbs100g * 4 + fat100g * 9;
      if (expectedCalories > 0) {
        const ratio = calories100g / expectedCalories;
        if (ratio < 0.90 || ratio > 1.10) {
          console.warn(
            `[upsertCanonicalFood] Skipping "${name}" — calories_100g=${calories100g} is wildly inconsistent with macros ` +
            `(protein=${protein100g}g, carbs=${carbs100g}g, fat=${fat100g}g → expected ~${Math.round(expectedCalories)} kcal, ratio=${ratio.toFixed(2)})`
          );
          const fallback = await this.canonicalFoodExistsByName(name);
          if (fallback) return fallback;
          throw new Error(`Macro-inconsistent calorie value for food "${name}" (got ${calories100g}, expected ~${Math.round(expectedCalories)} kcal/100g) — upsert skipped`);
        }
      }
    }

    const canonical = food.name.toLowerCase().replace(/\s+/g, " ").trim();

    if (food.fdcId) {
      const existing = await this.getCanonicalFoodByFdcId(food.fdcId);
      if (existing) {
        if (food.barcode && !existing.barcode) {
          await db.update(canonicalFoods).set({ barcode: food.barcode }).where(eq(canonicalFoods.id, existing.id));
          return { ...existing, barcode: food.barcode };
        }
        return existing;
      }
    }
    if (food.barcode) {
      const existing = await this.getCanonicalFoodByBarcode(food.barcode);
      if (existing) return existing;
    }
    const TRUSTED_SOURCES = ["usda_cached", "barcode_scan", "openfoodfacts", "open_food_facts", "nzfcd", "fsanz", "nz_regional", "au_regional"];
    const incomingIsTrusted = !!food.fdcId || (!!food.barcode && TRUSTED_SOURCES.includes(food.source ?? "")) || TRUSTED_SOURCES.includes(food.source ?? "");

    if (!food.barcode) {
      const existing = await this.canonicalFoodExistsByName(food.name);
      if (existing) {
        if (isZeroCal && (existing.calories100g !== 0 || existing.protein100g !== 0 || existing.carbs100g !== 0 || existing.fat100g !== 0)) {
          await db.update(canonicalFoods).set({
            calories100g: 0,
            protein100g: 0,
            carbs100g: 0,
            fat100g: 0,
          }).where(eq(canonicalFoods.id, existing.id));
          return { ...existing, calories100g: 0, protein100g: 0, carbs100g: 0, fat100g: 0 };
        }
        const existingIsTrusted = !!existing.fdcId || TRUSTED_SOURCES.includes(existing.source ?? "");
        if (existingIsTrusted && !incomingIsTrusted) {
          return existing;
        }
        if (!existingIsTrusted && !incomingIsTrusted) {
          return existing;
        }
        if (incomingIsTrusted && !existingIsTrusted) {
          await db.update(canonicalFoods).set({
            calories100g: food.calories100g,
            protein100g: food.protein100g,
            carbs100g: food.carbs100g,
            fat100g: food.fat100g,
            fibre100g: food.fibre100g ?? existing.fibre100g,
            sodium100g: food.sodium100g ?? existing.sodium100g,
            fdcId: food.fdcId ?? existing.fdcId,
            source: food.source ?? existing.source,
            verifiedAt: new Date(),
          }).where(eq(canonicalFoods.id, existing.id));
          return { ...existing, calories100g: food.calories100g, protein100g: food.protein100g, carbs100g: food.carbs100g, fat100g: food.fat100g, source: food.source ?? existing.source, verifiedAt: new Date() };
        }
        return existing;
      }
    }

    const trustedSource = incomingIsTrusted;
    try {
      const [created] = await db.insert(canonicalFoods).values({
        name: food.name,
        canonicalName: canonical,
        calories100g: food.calories100g,
        protein100g: food.protein100g,
        carbs100g: food.carbs100g,
        fat100g: food.fat100g,
        fibre100g: food.fibre100g ?? null,
        sodium100g: food.sodium100g ?? null,
        servingGrams: food.servingGrams ?? 100,
        barcode: food.barcode ?? null,
        fdcId: food.fdcId ?? null,
        source: food.source ?? "user_manual",
        region: food.region ?? null,
        contributedByUserId: food.contributedByUserId ?? null,
        verifiedAt: trustedSource ? new Date() : null,
      }).returning();
      return created;
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === "23505") {
        if (food.barcode) {
          const byBarcode = await this.getCanonicalFoodByBarcode(food.barcode);
          if (byBarcode) return byBarcode;
        }
        if (food.fdcId) {
          const byFdc = await this.getCanonicalFoodByFdcId(food.fdcId);
          if (byFdc) return byFdc;
        }
        const byName = await this.canonicalFoodExistsByName(food.name);
        if (byName) return byName;
      }
      throw err;
    }
  }

  async getCanonicalFoodById(id: number): Promise<CanonicalFood | undefined> {
    const [row] = await db.select().from(canonicalFoods).where(eq(canonicalFoods.id, id));
    return row;
  }

  async verifyCanonicalFood(id: number): Promise<CanonicalFood | undefined> {
    const [row] = await db.update(canonicalFoods)
      .set({ verifiedAt: new Date() })
      .where(eq(canonicalFoods.id, id))
      .returning();
    return row;
  }

  async unverifyCanonicalFood(id: number): Promise<CanonicalFood | undefined> {
    const [row] = await db.update(canonicalFoods)
      .set({ verifiedAt: null })
      .where(eq(canonicalFoods.id, id))
      .returning();
    return row;
  }

  async getUserFoodBookmarks(userId: number, opts: { cursor?: string; limit?: number; search?: string } = {}): Promise<{ items: (UserFoodBookmark & { food: CanonicalFood })[]; nextCursor: string | null }> {
    const limit = opts.limit ?? 50;
    const baseConditions = [eq(userFoodBookmarks.userId, userId)];
    if (opts.cursor) {
      baseConditions.push(lt(userFoodBookmarks.id, parseInt(opts.cursor)));
    }
    const searchCondition = opts.search
      ? or(
          ilike(canonicalFoods.name, `%${opts.search}%`),
          ilike(userFoodBookmarks.nickname, `%${opts.search}%`),
        )
      : undefined;
    const rows = await db.select({
      bookmark: userFoodBookmarks,
      food: canonicalFoods,
    }).from(userFoodBookmarks)
      .innerJoin(canonicalFoods, eq(userFoodBookmarks.canonicalFoodId, canonicalFoods.id))
      .where(and(...baseConditions, searchCondition))
      .orderBy(desc(userFoodBookmarks.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(r => ({ ...r.bookmark, food: r.food }));
    return {
      items,
      nextCursor: hasMore ? String(items[items.length - 1].id) : null,
    };
  }

  async addUserFoodBookmark(entry: { userId: number; canonicalFoodId: number; servingGrams?: number; nickname?: string }): Promise<UserFoodBookmark & { food: CanonicalFood }> {
    const [created] = await db.insert(userFoodBookmarks).values({
      userId: entry.userId,
      canonicalFoodId: entry.canonicalFoodId,
      servingGrams: entry.servingGrams ?? null,
      nickname: entry.nickname ?? null,
    }).returning();
    const food = (await this.getCanonicalFoodById(created.canonicalFoodId))!;
    return { ...created, food };
  }

  async removeUserFoodBookmark(id: number, userId: number): Promise<void> {
    await db.delete(userFoodBookmarks)
      .where(and(eq(userFoodBookmarks.id, id), eq(userFoodBookmarks.userId, userId)));
  }

  async updateUserFoodBookmark(id: number, userId: number, updates: { servingGrams?: number; nickname?: string }): Promise<(UserFoodBookmark & { food: CanonicalFood }) | undefined> {
    const [updated] = await db.update(userFoodBookmarks)
      .set(updates)
      .where(and(eq(userFoodBookmarks.id, id), eq(userFoodBookmarks.userId, userId)))
      .returning();
    if (!updated) return undefined;
    const food = (await this.getCanonicalFoodById(updated.canonicalFoodId))!;
    return { ...updated, food };
  }

  async findDuplicateUserFoodBookmarks(userId: number, canonicalFoodId: number): Promise<UserFoodBookmark[]> {
    return db.select().from(userFoodBookmarks)
      .where(and(eq(userFoodBookmarks.userId, userId), eq(userFoodBookmarks.canonicalFoodId, canonicalFoodId)))
      .limit(5);
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

  async updateCyclePeriodLog(id: number, userId: number, updates: { periodStartDate?: string; periodEndDate?: string | null; computedCycleLength?: number | null; notes?: string | null }): Promise<CyclePeriodLog | undefined> {
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

  async getVitalitySymptoms(userId: number, from: string, to: string): Promise<VitalitySymptom[]> {
    return await db.select().from(vitalitySymptoms)
      .where(and(eq(vitalitySymptoms.userId, userId), gte(vitalitySymptoms.date, from), lte(vitalitySymptoms.date, to)))
      .orderBy(desc(vitalitySymptoms.date));
  }

  async upsertVitalitySymptom(entry: { userId: number; date: string; energy?: string | null; motivation?: string | null; focus?: string | null; stress?: string | null; sleepQuality?: string | null; libido?: string | null }): Promise<VitalitySymptom> {
    const [existing] = await db.select().from(vitalitySymptoms)
      .where(and(eq(vitalitySymptoms.userId, entry.userId), eq(vitalitySymptoms.date, entry.date)));
    if (existing) {
      const [updated] = await db.update(vitalitySymptoms)
        .set({ energy: entry.energy, motivation: entry.motivation, focus: entry.focus, stress: entry.stress, sleepQuality: entry.sleepQuality, libido: entry.libido })
        .where(eq(vitalitySymptoms.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(vitalitySymptoms).values(entry).returning();
    return created;
  }

  async deleteAllVitalityData(userId: number): Promise<void> {
    await db.delete(vitalitySymptoms).where(eq(vitalitySymptoms.userId, userId));
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user?.preferences) {
      const prefs = user.preferences as Record<string, unknown>;
      delete prefs.vitalityInsightsEnabled;
      delete prefs.hormoneBoostingMeals;
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

  async getUserMeals(userId: number, opts?: { cursor?: string; limit?: number; search?: string; slot?: string }): Promise<{ items: UserMeal[]; nextCursor: string | null }> {
    const limit = opts?.limit ?? 10000;
    const fetchLimit = limit + 1;
    const conditions = [eq(userMeals.userId, userId)];
    if (opts?.search) {
      conditions.push(ilike(userMeals.name, `%${opts.search}%`));
    }
    if (opts?.slot) {
      conditions.push(eq(userMeals.mealSlot, opts.slot));
    }
    if (opts?.cursor) {
      const [ts, idStr] = opts.cursor.split("|");
      const cursorDate = new Date(ts);
      const cursorId = parseInt(idStr);
      conditions.push(
        or(
          lt(userMeals.createdAt, cursorDate),
          and(eq(userMeals.createdAt, cursorDate), lt(userMeals.id, cursorId))
        )!
      );
    }
    const rows = await db.select().from(userMeals)
      .where(and(...conditions))
      .orderBy(desc(userMeals.createdAt), desc(userMeals.id))
      .limit(fetchLimit);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? `${(last.createdAt as Date).toISOString()}|${last.id}`
      : null;
    return { items, nextCursor };
  }

  async createUserMeal(meal: InsertUserMeal & { userId: number }): Promise<UserMeal> {
    const [created] = await db.insert(userMeals).values(meal).returning();
    return created;
  }

  async updateUserMeal(id: number, userId: number, updates: Partial<Pick<UserMeal, 'name' | 'caloriesPerServing' | 'proteinPerServing' | 'carbsPerServing' | 'fatPerServing' | 'servings' | 'sourceUrl' | 'imageUrl' | 'mealSlot' | 'mealStyle' | 'ingredients' | 'ingredientsJson' | 'instructions' | 'source' | 'sourcePhotos'>>): Promise<UserMeal | undefined> {
    const [updated] = await db.update(userMeals)
      .set(updates)
      .where(and(eq(userMeals.id, id), eq(userMeals.userId, userId)))
      .returning();
    return updated;
  }

  async deleteUserMeal(id: number, userId: number): Promise<void> {
    await db.delete(mealTemplates)
      .where(and(eq(mealTemplates.userMealId, id), eq(mealTemplates.userId, userId)));
    await db.delete(userMeals)
      .where(and(eq(userMeals.id, id), eq(userMeals.userId, userId)));
  }

  async findDuplicateUserMeals(userId: number, name: string): Promise<UserMeal[]> {
    const escaped = name.trim().replace(/[%_]/g, c => `\\${c}`);
    return db.select().from(userMeals)
      .where(and(eq(userMeals.userId, userId), ilike(userMeals.name, escaped)))
      .limit(5);
  }

  async getMealIngredients(userMealId: number): Promise<(MealIngredient & { canonicalFood: CanonicalFood | null })[]> {
    const rows = await db.select({
      ingredient: mealIngredients,
      food: canonicalFoods,
    }).from(mealIngredients)
      .leftJoin(canonicalFoods, eq(mealIngredients.canonicalFoodId, canonicalFoods.id))
      .where(eq(mealIngredients.userMealId, userMealId))
      .orderBy(mealIngredients.orderIndex);
    return rows.map(r => ({ ...r.ingredient, canonicalFood: r.food ?? null }));
  }

  async syncMealIngredientsFromJson(
    userMealId: number,
    ingredientsJson: { name: string; grams: number; calories100g: number; protein100g: number; carbs100g: number; fat100g: number }[]
  ): Promise<void> {
    await db.delete(mealIngredients).where(eq(mealIngredients.userMealId, userMealId));
    if (!ingredientsJson || ingredientsJson.length === 0) return;

    for (let i = 0; i < ingredientsJson.length; i++) {
      const ing = ingredientsJson[i];
      if (!ing.name) continue;
      if (ing.calories100g < 0) continue;
      try {
        const canonicalFood = await this.upsertCanonicalFood({
          name: ing.name,
          calories100g: Math.round(ing.calories100g),
          protein100g: Math.round(ing.protein100g * 10) / 10,
          carbs100g: Math.round(ing.carbs100g * 10) / 10,
          fat100g: Math.round(ing.fat100g * 10) / 10,
          servingGrams: 100,
          source: "ingredient_parsed",
        });
        await db.insert(mealIngredients).values({
          userMealId,
          canonicalFoodId: canonicalFood.id,
          name: ing.name,
          grams: ing.grams,
          calories100g: ing.calories100g,
          protein100g: ing.protein100g,
          carbs100g: ing.carbs100g,
          fat100g: ing.fat100g,
          orderIndex: i,
        });
      } catch (err) {
        console.warn(`[syncMealIngredientsFromJson] Skipping ingredient "${ing.name}" (index ${i}) due to error:`, err);
      }
    }
  }

  async recomputeMealMacros(userMealId: number, userId: number): Promise<UserMeal | undefined> {
    // Join canonical_foods to use their CURRENT nutrition values, not the snapshot
    const rows = await db.select({
      ingredient: mealIngredients,
      food: canonicalFoods,
    }).from(mealIngredients)
      .leftJoin(canonicalFoods, eq(mealIngredients.canonicalFoodId, canonicalFoods.id))
      .where(eq(mealIngredients.userMealId, userMealId));

    if (rows.length === 0) return undefined;

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    for (const row of rows) {
      // Prefer canonical food's live values; fall back to junction snapshot
      const cal100 = row.food?.calories100g ?? row.ingredient.calories100g;
      const prot100 = row.food?.protein100g ?? row.ingredient.protein100g;
      const carbs100 = row.food?.carbs100g ?? row.ingredient.carbs100g;
      const fat100 = row.food?.fat100g ?? row.ingredient.fat100g;
      const factor = row.ingredient.grams / 100;
      totalCalories += cal100 * factor;
      totalProtein += prot100 * factor;
      totalCarbs += carbs100 * factor;
      totalFat += fat100 * factor;

      // Also refresh the junction snapshot to match canonical
      if (row.food) {
        await db.update(mealIngredients).set({
          calories100g: row.food.calories100g,
          protein100g: row.food.protein100g,
          carbs100g: row.food.carbs100g,
          fat100g: row.food.fat100g,
        }).where(eq(mealIngredients.id, row.ingredient.id));
      }
    }

    const roundedCal = Math.round(totalCalories);
    const roundedProt = Math.round(totalProtein * 10) / 10;
    const roundedCarbs = Math.round(totalCarbs * 10) / 10;
    const roundedFat = Math.round(totalFat * 10) / 10;

    const [updated] = await db.update(userMeals).set({
      caloriesPerServing: roundedCal,
      proteinPerServing: roundedProt,
      carbsPerServing: roundedCarbs,
      fatPerServing: roundedFat,
    }).where(and(eq(userMeals.id, userMealId), eq(userMeals.userId, userId))).returning();

    // Keep ingredientsJson in sync with refreshed values
    if (updated) {
      const updatedRows = await db.select({ ingredient: mealIngredients, food: canonicalFoods })
        .from(mealIngredients)
        .leftJoin(canonicalFoods, eq(mealIngredients.canonicalFoodId, canonicalFoods.id))
        .where(eq(mealIngredients.userMealId, userMealId))
        .orderBy(mealIngredients.orderIndex);

      const refreshedJson = updatedRows.map((r, i) => ({
        key: `ing-${i}`,
        name: r.ingredient.name,
        grams: r.ingredient.grams,
        calories100g: r.food?.calories100g ?? r.ingredient.calories100g,
        protein100g: r.food?.protein100g ?? r.ingredient.protein100g,
        carbs100g: r.food?.carbs100g ?? r.ingredient.carbs100g,
        fat100g: r.food?.fat100g ?? r.ingredient.fat100g,
      }));

      await db.update(userMeals).set({ ingredientsJson: refreshedJson })
        .where(eq(userMeals.id, userMealId));
    }

    return updated;
  }

  async deleteMealIngredients(userMealId: number): Promise<void> {
    await db.delete(mealIngredients).where(eq(mealIngredients.userMealId, userMealId));
  }

  async getCommunityMealIngredients(communityMealId: number): Promise<(CommunityMealIngredient & { canonicalFood: CanonicalFood | null })[]> {
    const rows = await db.select({
      ingredient: communityMealIngredients,
      food: canonicalFoods,
    }).from(communityMealIngredients)
      .leftJoin(canonicalFoods, eq(communityMealIngredients.canonicalFoodId, canonicalFoods.id))
      .where(eq(communityMealIngredients.communityMealId, communityMealId))
      .orderBy(communityMealIngredients.orderIndex);
    return rows.map(r => ({ ...r.ingredient, canonicalFood: r.food ?? null }));
  }

  async syncCommunityMealIngredientsFromJson(
    communityMealId: number,
    ingredientsJson: { name: string; grams: number; calories100g: number; protein100g: number; carbs100g: number; fat100g: number }[]
  ): Promise<void> {
    await db.delete(communityMealIngredients).where(eq(communityMealIngredients.communityMealId, communityMealId));
    if (!ingredientsJson || ingredientsJson.length === 0) return;

    for (let i = 0; i < ingredientsJson.length; i++) {
      const ing = ingredientsJson[i];
      if (!ing.name) continue;
      if (ing.calories100g < 0) continue;
      const canonicalFood = await this.upsertCanonicalFood({
        name: ing.name,
        calories100g: Math.round(ing.calories100g),
        protein100g: Math.round(ing.protein100g * 10) / 10,
        carbs100g: Math.round(ing.carbs100g * 10) / 10,
        fat100g: Math.round(ing.fat100g * 10) / 10,
        servingGrams: 100,
        source: "ingredient_parsed",
      });
      await db.insert(communityMealIngredients).values({
        communityMealId,
        canonicalFoodId: canonicalFood.id,
        name: ing.name,
        grams: ing.grams,
        calories100g: ing.calories100g,
        protein100g: ing.protein100g,
        carbs100g: ing.carbs100g,
        fat100g: ing.fat100g,
        orderIndex: i,
      });
    }
  }

  async deleteCommunityMealIngredients(communityMealId: number): Promise<void> {
    await db.delete(communityMealIngredients).where(eq(communityMealIngredients.communityMealId, communityMealId));
  }

  async getRecipeIngredients(userRecipeId: number): Promise<(RecipeIngredient & { canonicalFood: CanonicalFood | null })[]> {
    const rows = await db.select({
      ingredient: recipeIngredients,
      food: canonicalFoods,
    }).from(recipeIngredients)
      .leftJoin(canonicalFoods, eq(recipeIngredients.canonicalFoodId, canonicalFoods.id))
      .where(eq(recipeIngredients.userRecipeId, userRecipeId))
      .orderBy(recipeIngredients.orderIndex);
    return rows.map(r => ({ ...r.ingredient, canonicalFood: r.food ?? null }));
  }

  async syncRecipeIngredientsFromJson(
    userRecipeId: number,
    ingredientsJson: { name: string; grams: number; calories100g: number; protein100g: number; carbs100g: number; fat100g: number }[]
  ): Promise<void> {
    await db.delete(recipeIngredients).where(eq(recipeIngredients.userRecipeId, userRecipeId));
    if (!ingredientsJson || ingredientsJson.length === 0) return;

    for (let i = 0; i < ingredientsJson.length; i++) {
      const ing = ingredientsJson[i];
      if (!ing.name) continue;
      if (ing.calories100g < 0) continue;
      const canonicalFood = await this.upsertCanonicalFood({
        name: ing.name,
        calories100g: Math.round(ing.calories100g),
        protein100g: Math.round(ing.protein100g * 10) / 10,
        carbs100g: Math.round(ing.carbs100g * 10) / 10,
        fat100g: Math.round(ing.fat100g * 10) / 10,
        servingGrams: 100,
        source: "ingredient_parsed",
      });
      await db.insert(recipeIngredients).values({
        userRecipeId,
        canonicalFoodId: canonicalFood.id,
        name: ing.name,
        grams: ing.grams,
        calories100g: ing.calories100g,
        protein100g: ing.protein100g,
        carbs100g: ing.carbs100g,
        fat100g: ing.fat100g,
        orderIndex: i,
      });
    }
  }

  async deleteRecipeIngredients(userRecipeId: number): Promise<void> {
    await db.delete(recipeIngredients).where(eq(recipeIngredients.userRecipeId, userRecipeId));
  }

  async getUserSavedFoods(userId: number, opts?: { cursor?: string; limit?: number; search?: string }): Promise<{ items: UserSavedFood[]; nextCursor: string | null }> {
    const limit = opts?.limit ?? 10000;
    const fetchLimit = limit + 1;
    const conditions = [eq(userSavedFoods.userId, userId)];
    if (opts?.search) {
      conditions.push(ilike(userSavedFoods.name, `%${opts.search}%`));
    }
    if (opts?.cursor) {
      const [ts, idStr] = opts.cursor.split("|");
      const cursorDate = new Date(ts);
      const cursorId = parseInt(idStr);
      conditions.push(
        or(
          lt(userSavedFoods.createdAt, cursorDate),
          and(eq(userSavedFoods.createdAt, cursorDate), lt(userSavedFoods.id, cursorId))
        )!
      );
    }
    const rows = await db.select().from(userSavedFoods)
      .where(and(...conditions))
      .orderBy(desc(userSavedFoods.createdAt), desc(userSavedFoods.id))
      .limit(fetchLimit);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? `${(last.createdAt as Date).toISOString()}|${last.id}`
      : null;
    return { items, nextCursor };
  }

  async addUserSavedFood(entry: { userId: number; name: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number; servingGrams?: number; source?: string }): Promise<UserSavedFood> {
    const [created] = await db.insert(userSavedFoods).values({
      userId: entry.userId,
      name: entry.name,
      calories100g: entry.calories100g,
      protein100g: entry.protein100g,
      carbs100g: entry.carbs100g,
      fat100g: entry.fat100g,
      servingGrams: entry.servingGrams ?? 100,
      source: entry.source ?? null,
    }).returning();
    return created;
  }

  async findDuplicateUserSavedFoods(userId: number, name: string): Promise<UserSavedFood[]> {
    const escaped = name.trim().replace(/[%_]/g, c => `\\${c}`);
    return db.select().from(userSavedFoods)
      .where(and(eq(userSavedFoods.userId, userId), ilike(userSavedFoods.name, escaped)))
      .limit(5);
  }

  async updateUserSavedFood(id: number, userId: number, updates: { name?: string; calories100g?: number; protein100g?: number; carbs100g?: number; fat100g?: number; servingGrams?: number }): Promise<UserSavedFood | undefined> {
    const setObj: Record<string, unknown> = {};
    if (updates.name !== undefined) setObj.name = updates.name;
    if (updates.calories100g !== undefined) setObj.calories100g = updates.calories100g;
    if (updates.protein100g !== undefined) setObj.protein100g = updates.protein100g;
    if (updates.carbs100g !== undefined) setObj.carbs100g = updates.carbs100g;
    if (updates.fat100g !== undefined) setObj.fat100g = updates.fat100g;
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

  async createCommunityMeal(data: { sourceRecipeId?: number | null; sourceUserId?: number | null; name: string; slot: string; style: string; caloriesPerServing: number; proteinPerServing: number; carbsPerServing: number; fatPerServing: number; microScore?: number; source?: string; ingredientsJson?: IngredientResult[] | null }): Promise<CommunityMeal> {
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
      ingredientsJson: data.ingredientsJson ?? null,
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

  async updateCommunityMealIngredients(id: number, ingredients: string[], instructions: string, ingredientsJson?: IngredientResult[]): Promise<CommunityMeal> {
    const setData: Record<string, unknown> = { ingredients, instructions };
    if (ingredientsJson !== undefined) {
      setData.ingredientsJson = ingredientsJson;
    }
    const [updated] = await db.update(communityMeals)
      .set(setData)
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

  async getMealTemplates(userId: number): Promise<MealTemplate[]> {
    return db.select().from(mealTemplates)
      .where(eq(mealTemplates.userId, userId))
      .orderBy(desc(mealTemplates.createdAt));
  }

  async createMealTemplate(entry: { userId: number; userMealId: number; mealSlot: string; daysOfWeek: string[] }): Promise<MealTemplate> {
    const [created] = await db.insert(mealTemplates).values(entry).returning();
    return created;
  }

  async updateMealTemplate(id: number, userId: number, updates: { mealSlot?: string; daysOfWeek?: string[]; active?: boolean }): Promise<MealTemplate | undefined> {
    const setObj: Record<string, unknown> = {};
    if (updates.mealSlot !== undefined) setObj.mealSlot = updates.mealSlot;
    if (updates.daysOfWeek !== undefined) setObj.daysOfWeek = updates.daysOfWeek;
    if (updates.active !== undefined) setObj.active = updates.active;
    if (Object.keys(setObj).length === 0) return undefined;
    const [updated] = await db.update(mealTemplates)
      .set(setObj)
      .where(and(eq(mealTemplates.id, id), eq(mealTemplates.userId, userId)))
      .returning();
    return updated;
  }

  async deleteMealTemplate(id: number, userId: number): Promise<void> {
    await db.delete(mealTemplates)
      .where(and(eq(mealTemplates.id, id), eq(mealTemplates.userId, userId)));
  }

  async updateUserTrial(userId: number, updates: { trialStartDate?: Date; trialStatus?: string; trialStepDownSeen?: boolean; trialExpiredSeen?: boolean }): Promise<void> {
    const setObj: Record<string, unknown> = {};
    if (updates.trialStartDate !== undefined) setObj.trialStartDate = updates.trialStartDate;
    if (updates.trialStatus !== undefined) setObj.trialStatus = updates.trialStatus;
    if (updates.trialStepDownSeen !== undefined) setObj.trialStepDownSeen = updates.trialStepDownSeen;
    if (updates.trialExpiredSeen !== undefined) setObj.trialExpiredSeen = updates.trialExpiredSeen;
    await db.update(users).set(setObj).where(eq(users.id, userId));
  }

  async updateUserTier(userId: number, updates: { tier?: string; stripeCustomerId?: string | null; stripeSubscriptionId?: string | null; tierExpiresAt?: Date | null; creditBalance?: number; paymentFailedAt?: Date | null; betaUser?: boolean; betaTierLocked?: boolean; pendingTier?: string | null }): Promise<User> {
    const setObj: Record<string, unknown> = {};
    if ("tier" in updates) setObj.tier = updates.tier;
    if ("stripeCustomerId" in updates) setObj.stripeCustomerId = updates.stripeCustomerId;
    if ("stripeSubscriptionId" in updates) setObj.stripeSubscriptionId = updates.stripeSubscriptionId;
    if ("tierExpiresAt" in updates) setObj.tierExpiresAt = updates.tierExpiresAt;
    if ("creditBalance" in updates) setObj.creditBalance = updates.creditBalance;
    if ("paymentFailedAt" in updates) setObj.paymentFailedAt = updates.paymentFailedAt;
    if ("betaUser" in updates) setObj.betaUser = updates.betaUser;
    if ("betaTierLocked" in updates) setObj.betaTierLocked = updates.betaTierLocked;
    if ("pendingTier" in updates) setObj.pendingTier = updates.pendingTier;
    const [updated] = await db.update(users).set(setObj).where(eq(users.id, userId)).returning();
    return updated;
  }

  async getFeatureGates(): Promise<FeatureGate[]> {
    return db.select().from(featureGates).orderBy(featureGates.featureKey);
  }

  async getFeatureGate(featureKey: string): Promise<FeatureGate | undefined> {
    const [gate] = await db.select().from(featureGates).where(eq(featureGates.featureKey, featureKey));
    return gate;
  }

  async upsertFeatureGate(featureKey: string, requiredTier: string, creditCost: number, description?: string): Promise<FeatureGate> {
    const [gate] = await db
      .insert(featureGates)
      .values({ featureKey, requiredTier, creditCost, description })
      .onConflictDoUpdate({ target: featureGates.featureKey, set: { requiredTier, creditCost, description } })
      .returning();
    return gate;
  }

  async deleteFeatureGate(featureKey: string): Promise<void> {
    await db.delete(featureGates).where(eq(featureGates.featureKey, featureKey));
  }

  async createCreditTransaction(entry: { userId: number; amount: number; type: string; featureKey?: string; description?: string; costUsd?: number }): Promise<CreditTransaction> {
    const [tx] = await db.insert(creditTransactions).values({
      ...entry,
      costUsd: entry.costUsd ?? 0,
    }).returning();
    return tx;
  }

  async getCreditTransactions(userId: number, limit = 50): Promise<CreditTransaction[]> {
    return db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit);
  }

  async getMonthlySpendUsd(userId: number): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const rows = await db.select().from(creditTransactions)
      .where(and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.type, "usage"),
      ));
    return rows
      .filter(r => r.createdAt && new Date(r.createdAt) >= startOfMonth)
      .reduce((sum, r) => sum + r.costUsd, 0);
  }

  async adjustCreditBalance(userId: number, amount: number): Promise<number> {
    const [updated] = await db.update(users)
      .set({ creditBalance: sql`GREATEST(0, ${users.creditBalance} + ${amount})` })
      .where(eq(users.id, userId))
      .returning();
    return updated.creditBalance;
  }

  async getTierPricing(): Promise<TierPricing[]> {
    return db.select().from(tierPricing).orderBy(tierPricing.displayOrder);
  }

  async getTierPricingByTier(tier: string): Promise<TierPricing | undefined> {
    const [row] = await db.select().from(tierPricing).where(eq(tierPricing.tier, tier));
    return row;
  }

  async upsertTierPricing(data: { tier: string; monthlyPriceUsd: number; annualPriceUsd: number; stripePriceIdMonthly?: string; stripePriceIdAnnual?: string; active?: boolean; features?: unknown[]; displayOrder?: number }): Promise<TierPricing> {
    const existing = await this.getTierPricingByTier(data.tier);
    if (existing) {
      const [updated] = await db.update(tierPricing).set({
        monthlyPriceUsd: data.monthlyPriceUsd,
        annualPriceUsd: data.annualPriceUsd,
        stripePriceIdMonthly: data.stripePriceIdMonthly ?? existing.stripePriceIdMonthly,
        stripePriceIdAnnual: data.stripePriceIdAnnual ?? existing.stripePriceIdAnnual,
        active: data.active ?? existing.active,
        features: data.features ?? existing.features,
        displayOrder: data.displayOrder ?? existing.displayOrder,
      }).where(eq(tierPricing.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(tierPricing).values({
      tier: data.tier,
      monthlyPriceUsd: data.monthlyPriceUsd,
      annualPriceUsd: data.annualPriceUsd,
      stripePriceIdMonthly: data.stripePriceIdMonthly,
      stripePriceIdAnnual: data.stripePriceIdAnnual,
      active: data.active ?? true,
      features: data.features ?? [],
      displayOrder: data.displayOrder ?? 0,
    }).returning();
    return created;
  }

  async updateTierPricing(id: number, updates: Partial<{ monthlyPriceUsd: number; annualPriceUsd: number; stripePriceIdMonthly: string; stripePriceIdAnnual: string; active: boolean; features: unknown[]; displayOrder: number }>): Promise<TierPricing | undefined> {
    const setObj: Record<string, unknown> = {};
    if (updates.monthlyPriceUsd !== undefined) setObj.monthlyPriceUsd = updates.monthlyPriceUsd;
    if (updates.annualPriceUsd !== undefined) setObj.annualPriceUsd = updates.annualPriceUsd;
    if (updates.stripePriceIdMonthly !== undefined) setObj.stripePriceIdMonthly = updates.stripePriceIdMonthly;
    if (updates.stripePriceIdAnnual !== undefined) setObj.stripePriceIdAnnual = updates.stripePriceIdAnnual;
    if (updates.active !== undefined) setObj.active = updates.active;
    if (updates.features !== undefined) setObj.features = updates.features;
    if (updates.displayOrder !== undefined) setObj.displayOrder = updates.displayOrder;
    if (Object.keys(setObj).length === 0) return undefined;
    const [updated] = await db.update(tierPricing).set(setObj).where(eq(tierPricing.id, id)).returning();
    return updated;
  }

  async getCreditPacks(): Promise<CreditPack[]> {
    return db.select().from(creditPacks).orderBy(creditPacks.credits);
  }

  async upsertCreditPack(data: { id?: number; credits: number; priceUsd: number; stripePriceId?: string; active?: boolean }): Promise<CreditPack> {
    if (data.id) {
      const [updated] = await db.update(creditPacks).set({
        credits: data.credits,
        priceUsd: data.priceUsd,
        stripePriceId: data.stripePriceId,
        active: data.active ?? true,
      }).where(eq(creditPacks.id, data.id)).returning();
      return updated;
    }
    const [created] = await db.insert(creditPacks).values({
      credits: data.credits,
      priceUsd: data.priceUsd,
      stripePriceId: data.stripePriceId,
      active: data.active ?? true,
    }).returning();
    return created;
  }

  async deleteCreditPack(id: number): Promise<void> {
    await db.delete(creditPacks).where(eq(creditPacks.id, id));
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.id);
  }

  async setManagedClientFlag(userId: number, isManagedClient: boolean, managedByNutritionistId: number | null): Promise<void> {
    await db.update(users).set({ isManagedClient, managedByNutritionistId }).where(eq(users.id, userId));
  }

  async getNutritionistProfile(userId: number): Promise<NutritionistProfile | undefined> {
    const [profile] = await db.select().from(nutritionistProfiles).where(eq(nutritionistProfiles.userId, userId));
    return profile;
  }

  async createNutritionistProfile(userId: number, data: InsertNutritionistProfile): Promise<NutritionistProfile> {
    const [profile] = await db.insert(nutritionistProfiles).values({ ...data, userId }).returning();
    return profile;
  }

  async updateNutritionistProfile(userId: number, data: Partial<InsertNutritionistProfile>): Promise<NutritionistProfile | undefined> {
    const [updated] = await db.update(nutritionistProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(nutritionistProfiles.userId, userId))
      .returning();
    return updated;
  }

  async getNutritionistClients(nutritionistId: number): Promise<(NutritionistClient & { client: Pick<User, "id" | "name" | "email" | "isManagedClient" | "createdAt"> })[]> {
    const clientUsers = await db
      .select({
        nc: nutritionistClients,
        clientId: users.id,
        clientName: users.name,
        clientEmail: users.email,
        clientIsManagedClient: users.isManagedClient,
        clientCreatedAt: users.createdAt,
      })
      .from(nutritionistClients)
      .innerJoin(users, eq(nutritionistClients.clientId, users.id))
      .where(eq(nutritionistClients.nutritionistId, nutritionistId))
      .orderBy(desc(nutritionistClients.lastActivityAt));
    return clientUsers.map(row => ({
      ...row.nc,
      client: {
        id: row.clientId,
        name: row.clientName,
        email: row.clientEmail,
        isManagedClient: row.clientIsManagedClient,
        createdAt: row.clientCreatedAt,
      },
    }));
  }

  async getNutritionistClientCount(nutritionistId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nutritionistClients)
      .where(eq(nutritionistClients.nutritionistId, nutritionistId));
    return Number(result?.count ?? 0);
  }

  async addNutritionistClient(nutritionistId: number, clientId: number, data?: { status?: string; goalSummary?: string }): Promise<NutritionistClient> {
    const [client] = await db.insert(nutritionistClients).values({
      nutritionistId,
      clientId,
      status: data?.status ?? "onboarding",
      goalSummary: data?.goalSummary,
      lastActivityAt: new Date(),
    }).returning();
    return client;
  }

  async updateNutritionistClient(id: number, nutritionistId: number, updates: { status?: string; goalSummary?: string; healthNotes?: string; lastActivityAt?: Date }): Promise<NutritionistClient | undefined> {
    const [updated] = await db.update(nutritionistClients)
      .set(updates)
      .where(and(eq(nutritionistClients.id, id), eq(nutritionistClients.nutritionistId, nutritionistId)))
      .returning();
    return updated;
  }

  async removeNutritionistClient(id: number, nutritionistId: number): Promise<void> {
    await db.delete(nutritionistClients)
      .where(and(eq(nutritionistClients.id, id), eq(nutritionistClients.nutritionistId, nutritionistId)));
  }

  async getNutritionistClientByClientId(nutritionistId: number, clientId: number): Promise<NutritionistClient | undefined> {
    const [row] = await db.select().from(nutritionistClients)
      .where(and(eq(nutritionistClients.nutritionistId, nutritionistId), eq(nutritionistClients.clientId, clientId)));
    return row;
  }

  async getNutritionistClientByClientIdAny(clientId: number): Promise<NutritionistClient | undefined> {
    const [row] = await db.select().from(nutritionistClients)
      .where(eq(nutritionistClients.clientId, clientId));
    return row;
  }

  async createNutritionistInvitation(nutritionistId: number, email: string, token: string, expiresAt: Date): Promise<NutritionistInvitation> {
    const [inv] = await db.insert(nutritionistInvitations).values({ nutritionistId, email, token, expiresAt }).returning();
    return inv;
  }

  async getNutritionistInvitationByToken(token: string): Promise<NutritionistInvitation | undefined> {
    const [inv] = await db.select().from(nutritionistInvitations).where(eq(nutritionistInvitations.token, token));
    return inv;
  }

  async acceptNutritionistInvitation(token: string): Promise<NutritionistInvitation | undefined> {
    const [updated] = await db.update(nutritionistInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(nutritionistInvitations.token, token))
      .returning();
    return updated;
  }

  async getNutritionistInvitations(nutritionistId: number): Promise<NutritionistInvitation[]> {
    return db.select().from(nutritionistInvitations)
      .where(eq(nutritionistInvitations.nutritionistId, nutritionistId))
      .orderBy(desc(nutritionistInvitations.createdAt));
  }

  async getNutritionistNotes(nutritionistId: number, clientId: number): Promise<NutritionistNote[]> {
    return db.select().from(nutritionistNotes)
      .where(and(eq(nutritionistNotes.nutritionistId, nutritionistId), eq(nutritionistNotes.clientId, clientId)))
      .orderBy(desc(nutritionistNotes.createdAt));
  }

  async createNutritionistNote(nutritionistId: number, clientId: number, note: string): Promise<NutritionistNote> {
    const [created] = await db.insert(nutritionistNotes).values({ nutritionistId, clientId, note }).returning();
    return created;
  }

  async updateNutritionistNote(id: number, nutritionistId: number, clientId: number, note: string): Promise<NutritionistNote | undefined> {
    const [updated] = await db.update(nutritionistNotes)
      .set({ note, updatedAt: new Date() })
      .where(and(eq(nutritionistNotes.id, id), eq(nutritionistNotes.nutritionistId, nutritionistId), eq(nutritionistNotes.clientId, clientId)))
      .returning();
    return updated;
  }


  async deleteNutritionistNote(id: number, nutritionistId: number, clientId: number): Promise<void> {
    await db.delete(nutritionistNotes)
      .where(and(eq(nutritionistNotes.id, id), eq(nutritionistNotes.nutritionistId, nutritionistId), eq(nutritionistNotes.clientId, clientId)));
  }

  async getNutritionistPlans(nutritionistId: number, clientId?: number): Promise<NutritionistPlan[]> {
    const conditions = [eq(nutritionistPlans.nutritionistId, nutritionistId)];
    if (clientId !== undefined) conditions.push(eq(nutritionistPlans.clientId, clientId));
    return db.select().from(nutritionistPlans).where(and(...conditions)).orderBy(desc(nutritionistPlans.createdAt));
  }

  async getNutritionistPlanById(id: number, nutritionistId: number): Promise<NutritionistPlan | undefined> {
    const [plan] = await db.select().from(nutritionistPlans).where(and(eq(nutritionistPlans.id, id), eq(nutritionistPlans.nutritionistId, nutritionistId)));
    return plan;
  }

  async createNutritionistPlan(plan: InsertNutritionistPlan): Promise<NutritionistPlan> {
    const [created] = await db.insert(nutritionistPlans).values(plan).returning();
    return created;
  }

  async updateNutritionistPlan(id: number, nutritionistId: number, updates: Partial<Pick<NutritionistPlan, 'name' | 'planData' | 'status' | 'promptNote' | 'scheduledDeliverAt'>>): Promise<NutritionistPlan | undefined> {
    const [updated] = await db.update(nutritionistPlans)
      .set(updates)
      .where(and(eq(nutritionistPlans.id, id), eq(nutritionistPlans.nutritionistId, nutritionistId)))
      .returning();
    return updated;
  }

  async deleteNutritionistPlan(id: number, nutritionistId: number): Promise<void> {
    await db.delete(nutritionistPlans).where(and(eq(nutritionistPlans.id, id), eq(nutritionistPlans.nutritionistId, nutritionistId)));
  }

  async deliverNutritionistPlan(id: number, nutritionistId: number): Promise<NutritionistPlan | undefined> {
    const [updated] = await db.update(nutritionistPlans)
      .set({ status: "delivered", deliveredAt: new Date() })
      .where(and(eq(nutritionistPlans.id, id), eq(nutritionistPlans.nutritionistId, nutritionistId)))
      .returning();
    return updated;
  }

  async getPendingReviewPlans(nutritionistId: number): Promise<NutritionistPlan[]> {
    return db.select().from(nutritionistPlans)
      .where(and(eq(nutritionistPlans.nutritionistId, nutritionistId), eq(nutritionistPlans.status, "pending_review")))
      .orderBy(desc(nutritionistPlans.createdAt));
  }

  async getClientPlanHistory(nutritionistId: number, clientId: number): Promise<NutritionistPlan[]> {
    return db.select().from(nutritionistPlans)
      .where(and(eq(nutritionistPlans.nutritionistId, nutritionistId), eq(nutritionistPlans.clientId, clientId)))
      .orderBy(desc(nutritionistPlans.createdAt));
  }

  async getDeliveredPlansForClient(clientId: number): Promise<NutritionistPlan[]> {
    return db.select().from(nutritionistPlans)
      .where(and(eq(nutritionistPlans.clientId, clientId), eq(nutritionistPlans.status, "delivered")))
      .orderBy(desc(nutritionistPlans.deliveredAt));
  }

  async getPlanAnnotations(planId: number): Promise<PlanAnnotation[]> {
    return db.select().from(planAnnotations).where(eq(planAnnotations.planId, planId)).orderBy(planAnnotations.day, planAnnotations.slot);
  }

  async upsertPlanAnnotation(entry: InsertPlanAnnotation): Promise<PlanAnnotation> {
    const existing = await db.select().from(planAnnotations)
      .where(and(eq(planAnnotations.planId, entry.planId), eq(planAnnotations.day, entry.day), entry.slot ? eq(planAnnotations.slot, entry.slot) : sql`${planAnnotations.slot} IS NULL`))
      .limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(planAnnotations).set({ note: entry.note }).where(eq(planAnnotations.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(planAnnotations).values(entry).returning();
    return created;
  }

  async deletePlanAnnotation(id: number, planId: number): Promise<void> {
    await db.delete(planAnnotations).where(and(eq(planAnnotations.id, id), eq(planAnnotations.planId, planId)));
  }

  async getPlanTemplates(nutritionistId: number): Promise<PlanTemplate[]> {
    return db.select().from(planTemplates).where(eq(planTemplates.nutritionistId, nutritionistId)).orderBy(desc(planTemplates.createdAt));
  }

  async createPlanTemplate(template: InsertPlanTemplate): Promise<PlanTemplate> {
    const [created] = await db.insert(planTemplates).values(template).returning();
    return created;
  }

  async updatePlanTemplate(id: number, nutritionistId: number, updates: Partial<Pick<PlanTemplate, 'name' | 'description' | 'planData'>>): Promise<PlanTemplate | undefined> {
    const [updated] = await db.update(planTemplates)
      .set(updates)
      .where(and(eq(planTemplates.id, id), eq(planTemplates.nutritionistId, nutritionistId)))
      .returning();
    return updated;
  }

  async deletePlanTemplate(id: number, nutritionistId: number): Promise<void> {
    await db.delete(planTemplates).where(and(eq(planTemplates.id, id), eq(planTemplates.nutritionistId, nutritionistId)));
  }

  async getPracticeByAdmin(adminUserId: number): Promise<PracticeAccount | undefined> {
    const [row] = await db.select().from(practiceAccounts).where(eq(practiceAccounts.adminUserId, adminUserId));
    return row;
  }

  async getPracticeById(id: number): Promise<PracticeAccount | undefined> {
    const [row] = await db.select().from(practiceAccounts).where(eq(practiceAccounts.id, id));
    return row;
  }

  async createPracticeAccount(adminUserId: number, name: string, maxSeats = 5): Promise<PracticeAccount> {
    const [created] = await db.insert(practiceAccounts).values({ adminUserId, name, maxSeats }).returning();
    return created;
  }

  async updatePracticeAccount(id: number, updates: { name?: string; maxSeats?: number }): Promise<PracticeAccount | undefined> {
    const [updated] = await db.update(practiceAccounts).set(updates).where(eq(practiceAccounts.id, id)).returning();
    return updated;
  }

  async getPracticeMembers(practiceId: number): Promise<(PracticeMember & { nutritionist: Pick<User, "id" | "name" | "email"> & { profile: NutritionistProfile | null } })[]> {
    const rows = await db.select({
      pm: practiceMembers,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
    })
      .from(practiceMembers)
      .innerJoin(users, eq(practiceMembers.nutritionistUserId, users.id))
      .where(eq(practiceMembers.practiceId, practiceId))
      .orderBy(practiceMembers.createdAt);

    const result = [];
    for (const row of rows) {
      const profile = await this.getNutritionistProfile(row.userId);
      result.push({
        ...row.pm,
        nutritionist: {
          id: row.userId,
          name: row.userName,
          email: row.userEmail,
          profile: profile ?? null,
        },
      });
    }
    return result;
  }

  async getPracticeMemberByNutritionist(practiceId: number, nutritionistUserId: number): Promise<PracticeMember | undefined> {
    const [row] = await db.select().from(practiceMembers)
      .where(and(eq(practiceMembers.practiceId, practiceId), eq(practiceMembers.nutritionistUserId, nutritionistUserId)));
    return row;
  }

  async getPracticeByMember(nutritionistUserId: number): Promise<PracticeAccount | undefined> {
    const [row] = await db.select({
      practice: practiceAccounts,
    })
      .from(practiceMembers)
      .innerJoin(practiceAccounts, eq(practiceMembers.practiceId, practiceAccounts.id))
      .where(eq(practiceMembers.nutritionistUserId, nutritionistUserId));
    return row?.practice;
  }

  async addPracticeMember(practiceId: number, nutritionistUserId: number, role = "member"): Promise<PracticeMember> {
    const [created] = await db.insert(practiceMembers).values({ practiceId, nutritionistUserId, role }).returning();
    return created;
  }

  async removePracticeMember(practiceId: number, nutritionistUserId: number): Promise<void> {
    await db.delete(practiceMembers)
      .where(and(eq(practiceMembers.practiceId, practiceId), eq(practiceMembers.nutritionistUserId, nutritionistUserId)));
  }

  async updatePracticeMemberRole(practiceId: number, nutritionistUserId: number, role: string): Promise<PracticeMember | undefined> {
    const [updated] = await db.update(practiceMembers)
      .set({ role })
      .where(and(eq(practiceMembers.practiceId, practiceId), eq(practiceMembers.nutritionistUserId, nutritionistUserId)))
      .returning();
    return updated;
  }

  private async cleanupUntrustedWithTrustedAlternatives(): Promise<void> {
    const UNTRUSTED = ["ingredient_parsed", "ai_generated", "ai-estimated", "user_manual"];

    const untrustedRows = await db.select().from(canonicalFoods)
      .where(sql`${canonicalFoods.source} IN (${sql.join(UNTRUSTED.map(s => sql`${s}`), sql`, `)})`);

    for (const row of untrustedRows) {
      const canonical = (row.canonicalName ?? row.name).toLowerCase().replace(/\s+/g, " ").trim();
      if (canonical.length < 3) continue;
      const t = await this.findTrustedCanonicalBySubstring(canonical);
      if (!t) continue;
      const calDiff = Math.abs(row.calories100g - t.calories100g);
      if (calDiff < 30) continue;

      console.log(`[cleanup] Correcting "${row.name}" (id=${row.id}, ${row.calories100g} kcal) → using trusted "${t.name}" (${t.calories100g} kcal)`);
      await db.update(canonicalFoods).set({
        calories100g: t.calories100g,
        protein100g: t.protein100g,
        carbs100g: t.carbs100g,
        fat100g: t.fat100g,
        source: t.source,
        verifiedAt: new Date(),
      }).where(eq(canonicalFoods.id, row.id));

      const affectedMealRows = await db.select({ userMealId: mealIngredients.userMealId })
        .from(mealIngredients)
        .where(eq(mealIngredients.canonicalFoodId, row.id));
      const uniqueMealIds = [...new Set(affectedMealRows.map(r => r.userMealId))];
      for (const mealId of uniqueMealIds) {
        try {
          const meal = await db.select().from(userMeals).where(eq(userMeals.id, mealId)).limit(1);
          if (meal.length > 0) {
            await this.recomputeMealMacros(mealId, meal[0].userId);
            console.log(`[cleanup] Recomputed meal id=${mealId} after correcting "${row.name}"`);
          }
        } catch (err) {
          console.warn(`[cleanup] Failed to recompute meal id=${mealId}:`, err);
        }
      }
    }
  }

  private async fixBadTrustedEntries(): Promise<void> {
    const KNOWN_CORRECTIONS: Record<string, { calories100g: number; protein100g: number; carbs100g: number; fat100g: number }> = {
      "egg": { calories100g: 155, protein100g: 12.5, carbs100g: 0.4, fat100g: 11.5 },
    };
    for (const [name, correct] of Object.entries(KNOWN_CORRECTIONS)) {
      const canonical = name.toLowerCase().replace(/\s+/g, " ").trim();
      const rows = await db.select().from(canonicalFoods)
        .where(eq(canonicalFoods.canonicalName, canonical));
      for (const row of rows) {
        const calDiff = Math.abs(row.calories100g - correct.calories100g);
        if (calDiff < 30) continue;
        console.log(`[cleanup] Fixing trusted entry "${row.name}" (id=${row.id}, ${row.calories100g} kcal) → ${correct.calories100g} kcal`);
        await db.update(canonicalFoods).set({
          ...correct,
          verifiedAt: new Date(),
        }).where(eq(canonicalFoods.id, row.id));

        const affectedMealRows = await db.select({ userMealId: mealIngredients.userMealId })
          .from(mealIngredients)
          .where(eq(mealIngredients.canonicalFoodId, row.id));
        const uniqueMealIds = [...new Set(affectedMealRows.map(r => r.userMealId))];
        for (const mealId of uniqueMealIds) {
          try {
            const meal = await db.select().from(userMeals).where(eq(userMeals.id, mealId)).limit(1);
            if (meal.length > 0) {
              await this.recomputeMealMacros(mealId, meal[0].userId);
              console.log(`[cleanup] Recomputed meal id=${mealId} after fixing "${row.name}"`);
            }
          } catch (err) {
            console.warn(`[cleanup] Failed to recompute meal id=${mealId}:`, err);
          }
        }
      }
    }
  }

  async cleanupBadCanonicalFoods(): Promise<void> {
    await this.cleanupUntrustedWithTrustedAlternatives();
    await this.fixBadTrustedEntries();

    const ZERO_CAL_FOODS = [
      "water", "tap water", "ice", "ice water",
      "black coffee", "coffee", "espresso",
      "tea", "green tea", "black tea", "herbal tea",
      "sparkling water", "soda water", "mineral water", "club soda",
      "diet soda", "diet coke", "diet pepsi", "coke zero", "pepsi max",
      "salt", "table salt", "sea salt",
    ];
    for (const name of ZERO_CAL_FOODS) {
      const canonical = name.toLowerCase().replace(/\s+/g, " ").trim();
      const rows = await db.select().from(canonicalFoods)
        .where(eq(canonicalFoods.canonicalName, canonical))
        .limit(1);
      if (rows.length > 0) {
        const row = rows[0];
        const isTrusted = !!row.fdcId || DatabaseStorage.TRUSTED_SOURCES.includes(row.source ?? "");
        if (!isTrusted && (row.calories100g > 5 || row.protein100g > 1 || row.carbs100g > 1 || row.fat100g > 1)) {
          console.log(`[cleanupBadCanonicalFoods] Fixing "${row.name}" (id=${row.id}) — had ${row.calories100g} kcal, setting to 0`);
          await db.update(canonicalFoods).set({
            calories100g: 0,
            protein100g: 0,
            carbs100g: 0,
            fat100g: 0,
          }).where(eq(canonicalFoods.id, row.id));

          const affectedMealRows = await db.select({ userMealId: mealIngredients.userMealId })
            .from(mealIngredients)
            .where(eq(mealIngredients.canonicalFoodId, row.id));
          const uniqueMealIds = [...new Set(affectedMealRows.map(r => r.userMealId))];
          for (const mealId of uniqueMealIds) {
            try {
              const meal = await db.select().from(userMeals).where(eq(userMeals.id, mealId)).limit(1);
              if (meal.length > 0) {
                await this.recomputeMealMacros(mealId, meal[0].userId);
                console.log(`[cleanupBadCanonicalFoods] Recomputed meal id=${mealId} after fixing "${row.name}"`);
              }
            } catch (err) {
              console.warn(`[cleanupBadCanonicalFoods] Failed to recompute meal id=${mealId}:`, err);
            }
          }
        }
      }
    }
  }
  async getMessages(nutritionistId: number, clientId: number, limit = 50, before?: number): Promise<NutritionistMessage[]> {
    const conditions = [
      eq(nutritionistMessages.nutritionistId, nutritionistId),
      eq(nutritionistMessages.clientId, clientId),
    ];
    if (before) {
      conditions.push(lt(nutritionistMessages.id, before));
    }
    return db.select().from(nutritionistMessages)
      .where(and(...conditions))
      .orderBy(desc(nutritionistMessages.createdAt))
      .limit(limit);
  }

  async createMessage(nutritionistId: number, clientId: number, senderId: number, body: string): Promise<NutritionistMessage> {
    const [msg] = await db.insert(nutritionistMessages).values({
      nutritionistId,
      clientId,
      senderId,
      body,
    }).returning();
    return msg;
  }

  async markMessagesRead(nutritionistId: number, clientId: number, readerId: number): Promise<void> {
    await db.update(nutritionistMessages)
      .set({ isRead: true })
      .where(and(
        eq(nutritionistMessages.nutritionistId, nutritionistId),
        eq(nutritionistMessages.clientId, clientId),
        eq(nutritionistMessages.isRead, false),
        sql`${nutritionistMessages.senderId} != ${readerId}`
      ));
  }

  async getUnreadCountForNutritionist(nutritionistId: number): Promise<{ clientId: number; count: number }[]> {
    const rows = await db.select({
      clientId: nutritionistMessages.clientId,
      count: sql<number>`count(*)`,
    })
      .from(nutritionistMessages)
      .where(and(
        eq(nutritionistMessages.nutritionistId, nutritionistId),
        eq(nutritionistMessages.isRead, false),
        sql`${nutritionistMessages.senderId} != ${nutritionistId}`
      ))
      .groupBy(nutritionistMessages.clientId);
    return rows.map(r => ({ clientId: r.clientId, count: Number(r.count) }));
  }

  async getUnreadCountForClient(clientId: number): Promise<number> {
    const [result] = await db.select({
      count: sql<number>`count(*)`,
    })
      .from(nutritionistMessages)
      .where(and(
        eq(nutritionistMessages.clientId, clientId),
        eq(nutritionistMessages.isRead, false),
        sql`${nutritionistMessages.senderId} != ${clientId}`
      ));
    return Number(result?.count ?? 0);
  }

  async getClientTargetOverrides(clientId: number): Promise<ClientTargetOverride | undefined> {
    const [row] = await db.select().from(clientTargetOverrides).where(eq(clientTargetOverrides.clientId, clientId)).limit(1);
    return row;
  }

  async upsertClientTargetOverrides(nutritionistId: number, clientId: number, overrides: Partial<InsertClientTargetOverride>): Promise<ClientTargetOverride> {
    const existing = await this.getClientTargetOverrides(clientId);
    if (existing) {
      const [updated] = await db.update(clientTargetOverrides)
        .set({ ...overrides, nutritionistId, updatedAt: new Date() })
        .where(eq(clientTargetOverrides.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(clientTargetOverrides)
      .values({ nutritionistId, clientId, ...overrides })
      .returning();
    return created;
  }

  async clearClientTargetOverrides(_nutritionistId: number, clientId: number): Promise<void> {
    await db.delete(clientTargetOverrides)
      .where(eq(clientTargetOverrides.clientId, clientId));
  }

  async getEffectiveTargets(clientId: number): Promise<{ dailyCalories: number; proteinGoal: number; carbsGoal: number; fatGoal: number; fibreGoal: number | null; hasOverrides: boolean; overriddenFields: string[] } | null> {
    const calcs = await this.getCalculations(clientId);
    const latestCalc = calcs.length > 0 ? calcs[0] : null;
    const overrides = await this.getClientTargetOverrides(clientId);

    if (!latestCalc && !overrides) return null;

    const overriddenFields: string[] = [];
    if (overrides?.dailyCalories !== null && overrides?.dailyCalories !== undefined) overriddenFields.push("dailyCalories");
    if (overrides?.proteinGoal !== null && overrides?.proteinGoal !== undefined) overriddenFields.push("proteinGoal");
    if (overrides?.carbsGoal !== null && overrides?.carbsGoal !== undefined) overriddenFields.push("carbsGoal");
    if (overrides?.fatGoal !== null && overrides?.fatGoal !== undefined) overriddenFields.push("fatGoal");
    if (overrides?.fibreGoal !== null && overrides?.fibreGoal !== undefined) overriddenFields.push("fibreGoal");

    const dailyCalories = overrides?.dailyCalories ?? latestCalc?.dailyCalories;
    const proteinGoal = overrides?.proteinGoal ?? latestCalc?.proteinGoal;
    const carbsGoal = overrides?.carbsGoal ?? latestCalc?.carbsGoal;
    const fatGoal = overrides?.fatGoal ?? latestCalc?.fatGoal;
    const fibreGoal = overrides?.fibreGoal ?? latestCalc?.fibreGoal ?? null;

    if (dailyCalories == null || proteinGoal == null || carbsGoal == null || fatGoal == null) return null;

    return {
      dailyCalories,
      proteinGoal,
      carbsGoal,
      fatGoal,
      fibreGoal,
      hasOverrides: overriddenFields.length > 0,
      overriddenFields,
    };
  }
}

export const storage = new DatabaseStorage();
