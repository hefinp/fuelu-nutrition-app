import { db } from "../db";
import { storage } from "../storage";
import { nutritionistClients, surveyTemplates, surveyDeliveries } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export async function runSurveyMilestoneJob(): Promise<void> {
  try {
    const allNutritionistProfiles = await db.query?.nutritionistProfiles?.findMany?.() ?? [];

    const nutritionistRows = await db.execute(
      sql`SELECT DISTINCT nutritionist_id FROM nutritionist_clients`
    );

    const nutritionistIds: number[] = (nutritionistRows as any).rows?.map((r: any) => r.nutritionist_id) ?? [];

    for (const nutritionistId of nutritionistIds) {
      await processNutritionistMilestones(nutritionistId);
    }

    console.log("[surveys] Milestone job complete");
  } catch (err) {
    console.error("[surveys] Milestone job error:", err);
  }
}

async function processNutritionistMilestones(nutritionistId: number): Promise<void> {
  const templates = await storage.getSurveyTemplates(nutritionistId);
  const automatedTemplates = templates.filter(t => t.active && t.triggerType !== "manual" && t.triggerDayOffset != null);

  if (automatedTemplates.length === 0) return;

  const clients = await storage.getNutritionistClients(nutritionistId);

  for (const client of clients) {
    if (!client.createdAt) continue;
    const clientCreatedAt = new Date(client.createdAt);
    const daysSinceCreated = Math.floor((Date.now() - clientCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

    for (const template of automatedTemplates) {
      const triggerDay = template.triggerDayOffset!;

      if (daysSinceCreated < triggerDay) continue;

      let shouldTrigger = false;

      if (template.triggerType === "onboarding_7d" && daysSinceCreated >= triggerDay && daysSinceCreated < triggerDay + 3) {
        shouldTrigger = true;
      } else if (template.triggerType === "active_30d" && client.status === "active" && daysSinceCreated >= triggerDay && daysSinceCreated < triggerDay + 3) {
        shouldTrigger = true;
      } else if (template.triggerType === "quarterly") {
        const quarterlyTriggerDay = Math.floor(daysSinceCreated / 90) * 90;
        if (daysSinceCreated >= quarterlyTriggerDay && daysSinceCreated < quarterlyTriggerDay + 3) {
          shouldTrigger = true;
        }
      }

      if (!shouldTrigger) continue;

      const alreadyExists = await storage.checkMilestoneSurveyExists(template.id, client.clientId);
      if (alreadyExists) continue;

      await storage.createSurveyDelivery(nutritionistId, client.clientId, template.id);
      console.log(`[surveys] Sent "${template.name}" to client ${client.clientId} (nutritionist ${nutritionistId})`);
    }
  }
}
