import { z } from 'zod';
import { insertCalculationSchema, calculations } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  internal: z.object({ message: z.string() }),
};

export const mealSchema = z.object({
  meal: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

export const dayMealPlanSchema = z.object({
  breakfast: z.array(mealSchema),
  lunch: z.array(mealSchema),
  dinner: z.array(mealSchema),
  snacks: z.array(mealSchema),
  dayTotalCalories: z.number(),
  dayTotalProtein: z.number(),
  dayTotalCarbs: z.number(),
  dayTotalFat: z.number(),
});

export const weeklyMealPlanSchema = z.object({
  monday: dayMealPlanSchema,
  tuesday: dayMealPlanSchema,
  wednesday: dayMealPlanSchema,
  thursday: dayMealPlanSchema,
  friday: dayMealPlanSchema,
  saturday: dayMealPlanSchema,
  sunday: dayMealPlanSchema,
  weekTotalCalories: z.number(),
  weekTotalProtein: z.number(),
  weekTotalCarbs: z.number(),
  weekTotalFat: z.number(),
});

export const mealPlanSchema = z.object({
  dailyCalories: z.number(),
  weeklyCalories: z.number(),
  proteinGoal: z.number(),
  carbsGoal: z.number(),
  fatGoal: z.number(),
  planType: z.enum(['daily', 'weekly']),
  mealStyle: z.enum(['simple', 'gourmet', 'michelin']).optional().default('simple'),
  calculationId: z.number().optional(),
  targetDates: z.array(z.string()).optional(),
  weekStartDate: z.string().optional(),
  clientToday: z.string().optional(),
  excludeSlots: z.array(z.enum(['breakfast', 'lunch', 'dinner', 'snack'])).optional(),
});

export const mealPlanResponseSchema = z.union([
  z.object({
    planType: z.literal('daily'),
    breakfast: z.array(mealSchema),
    lunch: z.array(mealSchema),
    dinner: z.array(mealSchema),
    snacks: z.array(mealSchema),
    dayTotalCalories: z.number(),
    dayTotalProtein: z.number(),
    dayTotalCarbs: z.number(),
    dayTotalFat: z.number(),
  }),
  z.object({
    planType: z.literal('weekly'),
    monday: dayMealPlanSchema,
    tuesday: dayMealPlanSchema,
    wednesday: dayMealPlanSchema,
    thursday: dayMealPlanSchema,
    friday: dayMealPlanSchema,
    saturday: dayMealPlanSchema,
    sunday: dayMealPlanSchema,
    weekTotalCalories: z.number(),
    weekTotalProtein: z.number(),
    weekTotalCarbs: z.number(),
    weekTotalFat: z.number(),
  }),
]);

export const api = {
  calculations: {
    create: {
      method: 'POST' as const,
      path: '/api/calculations' as const,
      input: insertCalculationSchema,
      responses: {
        201: z.custom<typeof calculations.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/calculations' as const,
      responses: {
        200: z.array(z.custom<typeof calculations.$inferSelect>()),
      },
    },
  },
  mealPlans: {
    generate: {
      method: 'POST' as const,
      path: '/api/meal-plans' as const,
      input: mealPlanSchema,
      responses: {
        201: mealPlanResponseSchema,
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
