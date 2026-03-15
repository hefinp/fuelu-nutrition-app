import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertFeedbackSchema, inviteCodes as inviteCodesTable } from "@shared/schema";
import { db } from "../db";
import { sendEmail, buildFeedbackEmailHtml } from "../email";

const router = Router();

const ADMIN_EMAILS = ["hefin.price@gmail.com"];

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!req.session.userId) { res.status(401).json({ message: "Not authenticated" }); return false; }
  const user = await storage.getUserById(req.session.userId);
  if (!user || !ADMIN_EMAILS.includes(user.email)) { res.status(403).json({ message: "Forbidden" }); return false; }
  return true;
}

router.get("/api/admin/invite-codes", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const codes = await storage.listInviteCodes();
  res.json(codes);
});

router.post("/api/admin/invite-codes", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const raw: string = req.body.codes ?? "";
  const toAdd = raw.split(/[\n,]+/).map((c: string) => c.trim().toUpperCase()).filter(Boolean);
  if (!toAdd.length) return res.status(400).json({ message: "No codes provided." });
  const inserted: string[] = [];
  const skipped: string[] = [];
  for (const code of toAdd) {
    const existing = await storage.getInviteCode(code);
    if (existing) { skipped.push(code); continue; }
    await db.insert(inviteCodesTable).values({ code });
    inserted.push(code);
  }
  res.json({ inserted, skipped });
});

router.post("/api/feedback", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const input = insertFeedbackSchema.parse(req.body);
    const entry = await storage.insertFeedback({ userId: req.session.userId, ...input });
    const user = await storage.getUserById(req.session.userId);
    const developerEmail = process.env.FEEDBACK_EMAIL;
    if (developerEmail && user) {
      const html = buildFeedbackEmailHtml({
        userName: user.name,
        userEmail: user.email,
        category: input.category,
        message: input.message,
        submittedAt: new Date(entry.createdAt ?? Date.now()).toUTCString(),
      });
      sendEmail({ to: developerEmail, subject: `[Fuelr Beta] ${input.category === "bug" ? "Bug Report" : input.category === "feature" ? "Feature Request" : "Feedback"} from ${user.name}`, html }).catch(() => {});
    }
    res.status(201).json({ message: "Thank you for your feedback!" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

export default router;
