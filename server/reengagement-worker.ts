import { storage } from "./storage";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

export async function runReengagementWorker(): Promise<void> {
  console.log("[reengagement] worker started — checking every hour");
  await runInactivityScan();
  await processReengagementJobs();
  setInterval(async () => {
    try {
      await runInactivityScan();
      await processReengagementJobs();
    } catch (err) {
      console.error("[reengagement] worker error:", err);
    }
  }, CHECK_INTERVAL_MS);
}

/**
 * Scan all active nutritionist-client relationships to detect clients who
 * have been inactive for >= triggerAfterDays and auto-create jobs.
 * Uses each nutritionist's default sequence (if set); falls back to the
 * nutritionist's first sequence if no default is configured.
 * Skips clients who already have an active or paused job.
 */
async function runInactivityScan(): Promise<void> {
  const nutritionistsWithDefaults = await storage.getAllNutritionistsWithDefaultSequences();
  if (nutritionistsWithDefaults.length === 0) return;

  const today = new Date().toISOString().split("T")[0];
  const todayMs = new Date(today).getTime();

  for (const { nutritionistId, sequence } of nutritionistsWithDefaults) {
    const clients = await storage.getNutritionistClients(nutritionistId);
    const activeClients = clients.filter(c => c.status === "active");

    for (const client of activeClients) {
      try {
        const existingJob = await storage.getActiveReengagementJobByClient(nutritionistId, client.clientId);
        if (existingJob && (existingJob.status === "active" || existingJob.status === "paused")) {
          continue;
        }

        const lastLogDate = await storage.getClientLastLogDate(client.clientId);
        const lastLogMs = lastLogDate ? new Date(lastLogDate).getTime() : 0;
        const daysInactive = lastLogDate
          ? Math.floor((todayMs - lastLogMs) / 86400000)
          : 999;

        if (daysInactive >= sequence.triggerAfterDays) {
          const messages = sequence.messages as { delayDays: number; body: string }[];
          if (!messages || messages.length === 0) continue;

          const firstMsg = messages[0];
          const nextSendAt = new Date(Date.now() + firstMsg.delayDays * 24 * 60 * 60 * 1000);

          await storage.createActiveReengagementJob(nutritionistId, client.clientId, sequence.id, nextSendAt);
          console.log(`[reengagement] auto-started sequence "${sequence.name}" for client ${client.clientId} (${daysInactive} days inactive, trigger=${sequence.triggerAfterDays})`);
        }
      } catch (err) {
        console.error(`[reengagement] error scanning client ${client.clientId}:`, err);
      }
    }
  }
}

/**
 * Process all active re-engagement jobs that are due to send their next message.
 */
async function processReengagementJobs(): Promise<void> {
  const dueJobs = await storage.getDueReengagementJobs();
  if (dueJobs.length === 0) return;

  console.log(`[reengagement] processing ${dueJobs.length} due job(s)`);

  for (const job of dueJobs) {
    try {
      const messages = job.sequence.messages as { delayDays: number; body: string }[];
      const stepIndex = job.currentStep;

      if (stepIndex >= messages.length) {
        await storage.updateActiveReengagementJob(job.id, { status: "completed" });
        console.log(`[reengagement] job ${job.id} completed (all steps sent)`);
        continue;
      }

      const message = messages[stepIndex];

      const clientEmailPrefs = await storage.getEmailPreferences(job.clientId);
      if (!clientEmailPrefs.reengagement) {
        await storage.updateActiveReengagementJob(job.id, { status: "completed" });
        console.log(`[reengagement] job ${job.id} skipped — client ${job.clientId} has opted out of re-engagement emails`);
        continue;
      }

      await storage.createMessage(job.nutritionistId, job.clientId, job.nutritionistId, message.body);
      console.log(`[reengagement] sent step ${stepIndex + 1}/${messages.length} for job ${job.id} (client ${job.clientId})`);

      const nextStepIndex = stepIndex + 1;

      if (nextStepIndex >= messages.length) {
        await storage.updateActiveReengagementJob(job.id, {
          currentStep: nextStepIndex,
          status: "completed",
        });
        console.log(`[reengagement] job ${job.id} completed after final step`);
      } else {
        const nextMessage = messages[nextStepIndex];
        const nextSendAt = new Date(Date.now() + nextMessage.delayDays * 24 * 60 * 60 * 1000);
        await storage.updateActiveReengagementJob(job.id, {
          currentStep: nextStepIndex,
          nextSendAt,
          status: "active",
        });
        console.log(`[reengagement] job ${job.id} advanced to step ${nextStepIndex + 1}, next send at ${nextSendAt.toISOString()}`);
      }
    } catch (err) {
      console.error(`[reengagement] error processing job ${job.id}:`, err);
    }
  }
}
