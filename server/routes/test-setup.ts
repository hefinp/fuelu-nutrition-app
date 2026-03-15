import { Router } from "express";
import { db } from "../db";
import { inviteCodes } from "@shared/schema";

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
}

export default router;
