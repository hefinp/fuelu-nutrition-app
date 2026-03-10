import { z } from 'zod';
import { insertCalculationSchema, calculations } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  internal: z.object({ message: z.string() }),
};

export const mealPlanSchema = z.object({
  dailyCalories: z.number(),
  weeklyCalories: z.number(),
  proteinGoal: z.number(),
  carbsGoal: z.number(),
  fatGoal: z.number(),
  planType: z.enum(['daily', 'weekly']),
});

export const mealSchema = z.object({
  meal: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

export const mealPlanResponseSchema = z.object({
  planType: z.enum(['daily', 'weekly']),
  totalCalories: z.number(),
  totalProtein: z.number(),
  totalCarbs: z.number(),
  totalFat: z.number(),
  meals: z.array(mealSchema),
});

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
