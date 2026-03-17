import { Router } from "express";
import { db } from "../db";
import { inviteCodes, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";

const router = Router();

if (process.env.NODE_ENV !== "production") {
  router.post("/api/test/setup-invite", async (req, res) => {
    const suffix = String(req.body.suffix || Date.now());
    const code = `E2E${suffix.slice(-8).toUpperCase()}`;
    try {
      await db.insert(inviteCodes).values({ code }).onConflictDoNothing();
      res.json({ code });
    } catch {
      res.json({ code });
    }
  });

  router.post("/api/test/set-beta", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email required" });
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });
    const updated = await storage.updateUserTier(user.id, { betaUser: true });
    res.json({ id: updated.id, email: updated.email, betaUser: updated.betaUser, tier: updated.tier });
  });

  router.post("/api/test/set-free-tier", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email required" });
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });
    await db.update(users).set({ tier: "free", betaUser: false, betaTierLocked: false, tierExpiresAt: null }).where(eq(users.id, user.id));
    res.json({ id: user.id, email: user.email, tier: "free", betaUser: false });
  });
}

export default router;
