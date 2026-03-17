import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { storage } from "../storage";
import { insertFeedbackSchema, inviteCodes as inviteCodesTable } from "@shared/schema";
import { db } from "../db";
import { sendEmail, buildFeedbackEmailHtml } from "../email";
import { checkAndRefillCommunityMealBalance, BUCKET_FLOOR } from "./community";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

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
      sendEmail({ to: developerEmail, subject: `[FuelU Beta] ${input.category === "bug" ? "Bug Report" : input.category === "feature" ? "Feature Request" : "Feedback"} from ${user.name}`, html }).catch(() => {});
    }
    res.status(201).json({ message: "Thank you for your feedback!" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

router.get("/api/admin/community-meal-balance", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const balance = await storage.getCommunityMealBalance();
    const gaps = balance.filter(b => b.total < BUCKET_FLOOR);
    res.json({ buckets: balance, gapsFound: gaps.length, mealsGenerated: 0 });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch balance" });
  }
});

router.post("/api/admin/community-meal-balance/refill", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const result = await checkAndRefillCommunityMealBalance(true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to refill balance" });
  }
});

// Admin tier pricing management
router.get("/api/admin/tier-pricing", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const pricing = await storage.getTierPricing();
  res.json(pricing);
});

const tierPricingSchema = z.object({
  tier: z.enum(["simple", "advanced"]),
  monthlyPriceUsd: z.number().int().min(0),
  annualPriceUsd: z.number().int().min(0),
  stripePriceIdMonthly: z.string().optional(),
  stripePriceIdAnnual: z.string().optional(),
  active: z.boolean().optional(),
  features: z.array(z.string()).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

router.post("/api/admin/tier-pricing", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const parsed = tierPricingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const { tier, monthlyPriceUsd, annualPriceUsd, active, features, displayOrder } = parsed.data;
    let { stripePriceIdMonthly, stripePriceIdAnnual } = parsed.data;

    const existing = await storage.getTierPricingByTier(tier);
    const stripe = getStripe();
    const priceChanged = existing && (existing.monthlyPriceUsd !== monthlyPriceUsd || existing.annualPriceUsd !== annualPriceUsd);
    const effectiveMonthlyId = stripePriceIdMonthly ?? existing?.stripePriceIdMonthly;
    const effectiveAnnualId = stripePriceIdAnnual ?? existing?.stripePriceIdAnnual;
    const missingPriceIds = !effectiveMonthlyId || !effectiveAnnualId;

    if (stripe && (priceChanged || missingPriceIds)) {
      const productName = `FuelU ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;

      if (priceChanged && existing) {
        if (existing.stripePriceIdMonthly) {
          try { await stripe.prices.update(existing.stripePriceIdMonthly, { active: false }); } catch {}
        }
        if (existing.stripePriceIdAnnual) {
          try { await stripe.prices.update(existing.stripePriceIdAnnual, { active: false }); } catch {}
        }
      }

      let productId: string | undefined;
      const products = await stripe.products.search({ query: `name:'${productName}'` });
      if (products.data.length > 0) {
        productId = products.data[0].id;
      } else {
        const product = await stripe.products.create({ name: productName });
        productId = product.id;
      }

      if (!effectiveMonthlyId || priceChanged) {
        const newMonthly = await stripe.prices.create({
          product: productId,
          unit_amount: monthlyPriceUsd,
          currency: "usd",
          recurring: { interval: "month" },
        });
        stripePriceIdMonthly = newMonthly.id;
      }

      if (!effectiveAnnualId || priceChanged) {
        const newAnnual = await stripe.prices.create({
          product: productId,
          unit_amount: annualPriceUsd,
          currency: "usd",
          recurring: { interval: "year" },
        });
        stripePriceIdAnnual = newAnnual.id;
      }
    }

    const result = await storage.upsertTierPricing({
      tier, monthlyPriceUsd, annualPriceUsd,
      stripePriceIdMonthly, stripePriceIdAnnual,
      active, features, displayOrder,
    });
    res.json(result);
  } catch (err: any) {
    console.error("[admin] Tier pricing update error:", err.message);
    res.status(500).json({ message: "Failed to update tier pricing" });
  }
});

const tierPricingPatchSchema = z.object({
  monthlyPriceUsd: z.number().int().min(0).optional(),
  annualPriceUsd: z.number().int().min(0).optional(),
  stripePriceIdMonthly: z.string().optional(),
  stripePriceIdAnnual: z.string().optional(),
  active: z.boolean().optional(),
  features: z.array(z.string()).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

router.patch("/api/admin/tier-pricing/:id", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const id = parseInt(req.params.id);
    const parsed = tierPricingPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const result = await storage.updateTierPricing(id, parsed.data);
    if (!result) return res.status(404).json({ message: "Not found" });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to update" });
  }
});

// Feature gates management
router.get("/api/admin/feature-gates", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const gates = await storage.getFeatureGates();
  res.json(gates);
});

const featureGateSchema = z.object({
  featureKey: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores"),
  requiredTier: z.enum(["free", "simple", "advanced"]),
  creditCost: z.number().int().min(0).default(0),
  description: z.string().max(500).optional(),
});

router.post("/api/admin/feature-gates", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const parsed = featureGateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
  const { featureKey, requiredTier, creditCost, description } = parsed.data;
  const gate = await storage.upsertFeatureGate(featureKey, requiredTier, creditCost, description);
  res.json(gate);
});

router.delete("/api/admin/feature-gates/:key", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  await storage.deleteFeatureGate(req.params.key);
  res.json({ ok: true });
});

// Credit packs management
router.get("/api/admin/credit-packs", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const packs = await storage.getCreditPacks();
  res.json(packs);
});

const creditPackSchema = z.object({
  id: z.number().int().positive().optional(),
  credits: z.number().int().positive(),
  priceUsd: z.number().int().min(0),
  stripePriceId: z.string().optional(),
  active: z.boolean().optional(),
});

router.post("/api/admin/credit-packs", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const parsed = creditPackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
  const { id, credits, priceUsd, stripePriceId, active } = parsed.data;
  const pack = await storage.upsertCreditPack({ id, credits, priceUsd, stripePriceId, active });
  res.json(pack);
});

router.delete("/api/admin/credit-packs/:id", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  await storage.deleteCreditPack(parseInt(req.params.id));
  res.json({ ok: true });
});

// Beta user tier override
const userTierSchema = z.object({
  userId: z.number().int().positive(),
  tier: z.enum(["free", "simple", "advanced"]).optional(),
  betaUser: z.boolean().optional(),
  betaTierLocked: z.boolean().optional(),
});

router.post("/api/admin/user-tier", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const parsed = userTierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
  const { userId, tier, betaUser, betaTierLocked } = parsed.data;

  const existingUser = await storage.getUserById(userId);
  if (!existingUser) return res.status(404).json({ message: "User not found" });

  const updates: { tier?: string; betaUser?: boolean; betaTierLocked?: boolean } = {};
  if (tier !== undefined) {
    updates.tier = tier;
    if (existingUser.betaUser && betaTierLocked === undefined) {
      updates.betaTierLocked = true;
    }
  }
  if (betaUser !== undefined) updates.betaUser = betaUser;
  if (betaTierLocked !== undefined) updates.betaTierLocked = betaTierLocked;

  const user = await storage.updateUserTier(userId, updates);
  res.json({ id: user.id, email: user.email, tier: user.tier, betaUser: user.betaUser, betaTierLocked: user.betaTierLocked });
});

// Get all users with tier info (for invite code tier management)
router.get("/api/admin/users", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const allUsers = await storage.getAllUsers();
  const result = allUsers.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    tier: u.tier,
    betaUser: u.betaUser,
    betaTierLocked: u.betaTierLocked,
    creditBalance: u.creditBalance,
    createdAt: u.createdAt,
  }));
  res.json(result);
});

async function requireAdminOrAdvancedBeta(req: Request, res: Response): Promise<boolean> {
  if (!req.session.userId) { res.status(401).json({ message: "Not authenticated" }); return false; }
  const user = await storage.getUserById(req.session.userId);
  if (!user) { res.status(403).json({ message: "Forbidden" }); return false; }
  if (ADMIN_EMAILS.includes(user.email)) return true;
  if (user.tier === "advanced" && user.betaUser) return true;
  res.status(403).json({ message: "Forbidden" });
  return false;
}

router.post("/api/admin/canonical-foods/:id/verify", async (req, res) => {
  if (!await requireAdminOrAdvancedBeta(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const food = await storage.verifyCanonicalFood(id);
  if (!food) return res.status(404).json({ message: "Not found" });
  res.json(food);
});

router.post("/api/admin/canonical-foods/:id/unverify", async (req, res) => {
  if (!await requireAdminOrAdvancedBeta(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const food = await storage.unverifyCanonicalFood(id);
  if (!food) return res.status(404).json({ message: "Not found" });
  res.json(food);
});

router.post("/api/admin/sync-stripe-prices", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ message: "Stripe is not configured" });
  try {
    const allTiers = await storage.getTierPricing();
    const missing = allTiers.filter(t => t.active && (!t.stripePriceIdMonthly || !t.stripePriceIdAnnual));
    if (missing.length === 0) {
      return res.json({ message: "All tiers already have Stripe prices configured", synced: [] });
    }
    const synced: string[] = [];
    for (const tp of missing) {
      const productName = `FuelU ${tp.tier.charAt(0).toUpperCase() + tp.tier.slice(1)}`;
      let productId: string | undefined;
      const products = await stripe.products.search({ query: `name:'${productName}'` });
      if (products.data.length > 0) {
        productId = products.data[0].id;
      } else {
        const product = await stripe.products.create({ name: productName });
        productId = product.id;
      }
      let monthlyPriceId = tp.stripePriceIdMonthly;
      let annualPriceId = tp.stripePriceIdAnnual;
      if (!monthlyPriceId) {
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: tp.monthlyPriceUsd,
          currency: "usd",
          recurring: { interval: "month" },
        });
        monthlyPriceId = price.id;
      }
      if (!annualPriceId) {
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: tp.annualPriceUsd,
          currency: "usd",
          recurring: { interval: "year" },
        });
        annualPriceId = price.id;
      }
      await storage.upsertTierPricing({
        tier: tp.tier,
        monthlyPriceUsd: tp.monthlyPriceUsd,
        annualPriceUsd: tp.annualPriceUsd,
        stripePriceIdMonthly: monthlyPriceId,
        stripePriceIdAnnual: annualPriceId,
        active: tp.active ?? true,
        features: (tp.features as unknown[]) ?? [],
        displayOrder: tp.displayOrder ?? 0,
      });
      synced.push(tp.tier);
      console.log(`[admin] Stripe prices synced for tier: ${tp.tier}`);
    }
    res.json({ message: `Synced Stripe prices for: ${synced.join(", ")}`, synced });
  } catch (err: any) {
    console.error("[admin] Stripe sync error:", err.message);
    res.status(500).json({ message: `Stripe sync failed: ${err.message}` });
  }
});

setTimeout(() => {
  checkAndRefillCommunityMealBalance(true).then(r => {
    if (r.mealsGenerated > 0) {
      console.log(`[community-meals] Startup gap-fill: generated ${r.mealsGenerated} meals`);
    }
  }).catch(() => {});
}, 5000);

export default router;
