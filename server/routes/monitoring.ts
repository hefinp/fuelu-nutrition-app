import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";

const router = Router();

function requireAuth(req: Request, res: Response): number | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return userId;
}

function getDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getDateStr(d);
}

router.get("/api/nutritionist/monitoring/dashboard", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clients = await storage.getNutritionistClients(userId);

  const today = getDateStr(new Date());
  const sevenDaysAgo = daysAgo(7);
  const threeDaysAgo = daysAgo(3);

  const clientSummaries = await Promise.all(clients.map(async (c) => {
    const logs = await storage.getFoodLogEntriesRange(c.clientId, sevenDaysAgo, today);

    const logsByDate: Record<string, typeof logs> = {};
    for (const entry of logs) {
      if (!logsByDate[entry.date]) logsByDate[entry.date] = [];
      logsByDate[entry.date].push(entry);
    }

    const daysLogged = Object.keys(logsByDate).length;
    const lastLogDate = logs.length > 0 ? logs[logs.length - 1].date : null;

    const daysInactive = lastLogDate
      ? Math.floor((new Date(today).getTime() - new Date(lastLogDate).getTime()) / 86400000)
      : 7;

    const calcs = await storage.getCalculations(c.clientId);
    const latestCalc = calcs.length > 0 ? calcs[0] : null;

    let adherenceScore: number | null = null;
    let avgCalories: number | null = null;
    let targetCalories: number | null = null;

    if (latestCalc && daysLogged > 0) {
      targetCalories = latestCalc.dailyCalories;
      const totalCalories = logs.reduce((sum, l) => sum + l.calories, 0);
      avgCalories = Math.round(totalCalories / daysLogged);

      const variance = Math.abs(avgCalories - targetCalories) / targetCalories;
      adherenceScore = Math.max(0, Math.round((1 - variance) * 100));
    }

    const alerts: string[] = [];
    if (daysInactive >= 3 && c.status === "active") {
      alerts.push(`inactive_${daysInactive}d`);
    }
    if (adherenceScore !== null && adherenceScore < 70) {
      alerts.push("off_target");
    }
    if (daysLogged >= 7) {
      alerts.push("milestone_7d_streak");
    }

    const weightEntries = await storage.getWeightEntries(c.clientId);
    const recentWeight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1] : null;

    return {
      id: c.id,
      clientId: c.clientId,
      nutritionistId: c.nutritionistId,
      status: c.status,
      goalSummary: c.goalSummary,
      lastActivityAt: c.lastActivityAt,
      client: c.client,
      monitoring: {
        daysLogged,
        daysInactive,
        lastLogDate,
        adherenceScore,
        avgCalories,
        targetCalories,
        alerts,
        recentWeight: recentWeight ? parseFloat(String(recentWeight.weight)) : null,
      },
    };
  }));

  const sorted = clientSummaries.sort((a, b) => {
    const scoreA = (b.monitoring.alerts.length * 100) - (a.monitoring.adherenceScore ?? 0);
    const scoreB = (a.monitoring.alerts.length * 100) - (b.monitoring.adherenceScore ?? 0);
    return scoreA - scoreB;
  });

  res.json(sorted);
});

router.get("/api/nutritionist/monitoring/clients/:clientId/adherence", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const days = parseInt(String(req.query.days ?? "14"));
  const fromDate = daysAgo(days - 1);
  const today = getDateStr(new Date());

  const logs = await storage.getFoodLogEntriesRange(clientId, fromDate, today);
  const calcs = await storage.getCalculations(clientId);
  const latestCalc = calcs.length > 0 ? calcs[0] : null;

  const logsByDate: Record<string, typeof logs> = {};
  for (const entry of logs) {
    if (!logsByDate[entry.date]) logsByDate[entry.date] = [];
    logsByDate[entry.date].push(entry);
  }

  const dailyBreakdown: Array<{
    date: string;
    logged: boolean;
    actual: { calories: number; protein: number; carbs: number; fat: number };
    target: { calories: number; protein: number; carbs: number; fat: number } | null;
    adherencePct: number | null;
  }> = [];

  const current = new Date(fromDate);
  const end = new Date(today);
  while (current <= end) {
    const dateStr = getDateStr(current);
    const dayLogs = logsByDate[dateStr] ?? [];
    const actual = {
      calories: dayLogs.reduce((s, l) => s + l.calories, 0),
      protein: dayLogs.reduce((s, l) => s + l.protein, 0),
      carbs: dayLogs.reduce((s, l) => s + l.carbs, 0),
      fat: dayLogs.reduce((s, l) => s + l.fat, 0),
    };

    let target = null;
    let adherencePct = null;
    if (latestCalc) {
      target = {
        calories: latestCalc.dailyCalories,
        protein: latestCalc.proteinGoal,
        carbs: latestCalc.carbsGoal,
        fat: latestCalc.fatGoal,
      };
      if (dayLogs.length > 0) {
        const variance = Math.abs(actual.calories - target.calories) / target.calories;
        adherencePct = Math.max(0, Math.round((1 - variance) * 100));
      }
    }

    dailyBreakdown.push({
      date: dateStr,
      logged: dayLogs.length > 0,
      actual,
      target,
      adherencePct,
    });

    current.setDate(current.getDate() + 1);
  }

  const weightEntries = await storage.getWeightEntries(clientId);
  const recentWeights = weightEntries.slice(-days).map(w => ({
    date: getDateStr(new Date(w.recordedAt ?? new Date())),
    weight: parseFloat(String(w.weight)),
  }));

  res.json({
    clientId,
    fromDate,
    toDate: today,
    dailyBreakdown,
    weightTrend: recentWeights,
    targets: latestCalc
      ? {
          calories: latestCalc.dailyCalories,
          protein: latestCalc.proteinGoal,
          carbs: latestCalc.carbsGoal,
          fat: latestCalc.fatGoal,
        }
      : null,
  });
});

router.get("/api/nutritionist/monitoring/alerts", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clients = await storage.getNutritionistClients(userId);
  const today = getDateStr(new Date());
  const sevenDaysAgo = daysAgo(7);

  const alerts: Array<{
    clientId: number;
    clientName: string;
    type: string;
    severity: "high" | "medium" | "low";
    message: string;
    date: string;
  }> = [];

  for (const c of clients) {
    if (c.status !== "active") continue;

    const logs = await storage.getFoodLogEntriesRange(c.clientId, sevenDaysAgo, today);
    const logDatesSet = new Set(logs.map(l => l.date));
    const logDates = Array.from(logDatesSet);
    const lastLogDate = logDates.length > 0 ? logDates[logDates.length - 1] : null;

    const daysInactive = lastLogDate
      ? Math.floor((new Date(today).getTime() - new Date(lastLogDate).getTime()) / 86400000)
      : 7;

    if (daysInactive >= 5) {
      alerts.push({
        clientId: c.clientId,
        clientName: c.client.name,
        type: "inactive",
        severity: "high",
        message: `${c.client.name} has not logged for ${daysInactive} days`,
        date: today,
      });
    } else if (daysInactive >= 3) {
      alerts.push({
        clientId: c.clientId,
        clientName: c.client.name,
        type: "inactive",
        severity: "medium",
        message: `${c.client.name} has not logged for ${daysInactive} days`,
        date: today,
      });
    }

    const calcs = await storage.getCalculations(c.clientId);
    const latestCalc = calcs.length > 0 ? calcs[0] : null;
    if (latestCalc && logDates.length >= 3) {
      const totalCalories = logs.reduce((s, l) => s + l.calories, 0);
      const avgCalories = totalCalories / logDates.length;
      const targetCalories = latestCalc.dailyCalories;
      const variance = (avgCalories - targetCalories) / targetCalories;

      if (variance > 0.25) {
        alerts.push({
          clientId: c.clientId,
          clientName: c.client.name,
          type: "over_fueling",
          severity: "medium",
          message: `${c.client.name} is averaging ${Math.round(avgCalories)} kcal/day vs target of ${targetCalories} kcal (${Math.round(variance * 100)}% over)`,
          date: today,
        });
      } else if (variance < -0.25) {
        alerts.push({
          clientId: c.clientId,
          clientName: c.client.name,
          type: "under_fueling",
          severity: "medium",
          message: `${c.client.name} is averaging ${Math.round(avgCalories)} kcal/day vs target of ${targetCalories} kcal (${Math.round(Math.abs(variance) * 100)}% under)`,
          date: today,
        });
      }

      const missedDays = logDates.filter(d => {
        const dayLogs = logs.filter(l => l.date === d);
        const dayCalories = dayLogs.reduce((s, l) => s + l.calories, 0);
        return dayCalories < targetCalories * 0.6;
      });

      if (missedDays.length >= 4) {
        alerts.push({
          clientId: c.clientId,
          clientName: c.client.name,
          type: "missed_targets",
          severity: "medium",
          message: `${c.client.name} has missed calorie targets on ${missedDays.length} of the last ${logDates.length} days`,
          date: today,
        });
      }
    }

    if (logDates.length >= 7) {
      alerts.push({
        clientId: c.clientId,
        clientName: c.client.name,
        type: "milestone",
        severity: "low",
        message: `${c.client.name} has logged every day this week — great streak!`,
        date: today,
      });
    }
  }

  const sortOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => sortOrder[a.severity] - sortOrder[b.severity]);

  res.json(alerts);
});

export default router;
