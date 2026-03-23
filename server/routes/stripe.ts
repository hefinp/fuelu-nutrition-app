import { Router } from "express";
import type { Request, Response } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { storage } from "../storage";
import { getUserTierStatus, getTierRank } from "../tier";
import { tierEnum } from "@shared/schema";
import { getAppUrl } from "../lib/app-url";

const router = Router();

const processedEventIds = new Set<string>();
const MAX_PROCESSED_EVENTS = 1000;

function markEventProcessed(eventId: string): boolean {
  if (processedEventIds.has(eventId)) return false;
  if (processedEventIds.size >= MAX_PROCESSED_EVENTS) {
    const first = processedEventIds.values().next().value;
    if (first) processedEventIds.delete(first);
  }
  processedEventIds.add(eventId);
  return true;
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

router.get("/api/tier/status", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const user = await storage.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: "User not found" });
  const status = await getUserTierStatus(user);
  res.json(status);
});

router.get("/api/tier/pricing", async (_req, res) => {
  const pricing = await storage.getTierPricing();
  const activePricing = pricing.filter(p => p.active && p.tier !== "payg");
  res.json({ tiers: activePricing, creditPacks: [] });
});

router.post("/api/stripe/create-checkout", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ message: "Stripe is not configured" });

  const user = await storage.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: "User not found" });

  const checkoutSchema = z.object({
    tier: z.enum(["simple", "advanced"]).optional(),
    billing: z.enum(["monthly", "annual"]).optional(),
    creditPackId: z.number().int().positive().optional(),
  });

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
  const { tier, billing, creditPackId } = parsed.data;

  try {
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      await storage.updateUserTier(user.id, { stripeCustomerId: customerId });
    }

    const appUrl = getAppUrl();

    if (creditPackId) {
      return res.status(410).json({ message: "Credit packs are no longer available." });
    }

    if (!tier || !billing) {
      return res.status(400).json({ message: "tier and billing are required" });
    }

    const tierPricing = await storage.getTierPricingByTier(tier);
    if (!tierPricing || !tierPricing.active) {
      return res.status(400).json({ message: "Invalid tier" });
    }

    let monthlyPriceId = tierPricing.stripePriceIdMonthly;
    let annualPriceId = tierPricing.stripePriceIdAnnual;

    if (!monthlyPriceId || !annualPriceId) {
      const productName = `FuelU ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;
      let productId: string | undefined;
      const products = await stripe.products.search({ query: `name:'${productName}'` });
      if (products.data.length > 0) {
        productId = products.data[0].id;
      } else {
        const product = await stripe.products.create({ name: productName });
        productId = product.id;
      }
      if (!monthlyPriceId) {
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: tierPricing.monthlyPriceUsd,
          currency: "nzd",
          recurring: { interval: "month" },
        });
        monthlyPriceId = price.id;
      }
      if (!annualPriceId) {
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: tierPricing.annualPriceUsd,
          currency: "nzd",
          recurring: { interval: "year" },
        });
        annualPriceId = price.id;
      }
      await storage.upsertTierPricing({
        tier: tierPricing.tier,
        monthlyPriceUsd: tierPricing.monthlyPriceUsd,
        annualPriceUsd: tierPricing.annualPriceUsd,
        stripePriceIdMonthly: monthlyPriceId,
        stripePriceIdAnnual: annualPriceId,
        active: tierPricing.active ?? true,
        features: (tierPricing.features as unknown[]) ?? [],
        displayOrder: tierPricing.displayOrder ?? 0,
      });
      console.log(`[stripe] Auto-created Stripe prices for tier: ${tier}`);
    }

    const priceId = billing === "annual" ? annualPriceId : monthlyPriceId;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?success=subscription&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?cancelled=true`,
      metadata: { userId: String(user.id), type: "subscription", tier },
      subscription_data: { metadata: { userId: String(user.id), tier } },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("[stripe] Checkout error:", err.message);
    res.status(500).json({ message: "Failed to create checkout session" });
  }
});

router.post("/api/stripe/confirm-subscription", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ message: "Stripe is not configured" });

  const { sessionId } = z.object({ sessionId: z.string() }).parse(req.body);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const userId = parseInt(session.metadata?.userId || "0");
    if (userId !== req.session.userId) {
      return res.status(403).json({ message: "Session does not belong to this user" });
    }

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const tier = session.metadata?.tier || "simple";
    const subscription = (typeof session.subscription === "object" && session.subscription !== null)
      ? session.subscription as Stripe.Subscription
      : null;
    const periodEnd = subscription ? (subscription as any).current_period_end : null;

    await storage.updateUserTier(userId, {
      tier,
      stripeSubscriptionId: subscription?.id ?? null,
      tierExpiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
      paymentFailedAt: null,
      pendingTier: null,
    });

    console.log(`[stripe] Subscription confirmed for user ${userId}: tier=${tier}`);
    res.json({ tier, message: `Upgraded to ${tier}` });
  } catch (err: any) {
    console.error("[stripe] Confirm subscription error:", err.message);
    res.status(500).json({ message: "Failed to confirm subscription" });
  }
});

router.post("/api/stripe/create-portal", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ message: "Stripe is not configured" });

  const user = await storage.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: "User not found" });

  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: String(user.id) },
      });
      stripeCustomerId = customer.id;
      await storage.updateUserTier(user.id, { stripeCustomerId });
    } catch (err: any) {
      console.error("[stripe] Failed to create customer:", err.message);
      return res.status(500).json({ message: "Failed to create billing account" });
    }
  }

  try {
    const appUrl = getAppUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/billing`,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    console.error("[stripe] Portal error:", err.message);
    res.status(500).json({ message: "Failed to create portal session" });
  }
});

router.post("/api/stripe/update-subscription", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ message: "Stripe is not configured" });

  const user = await storage.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: "User not found" });

  const updateSchema = z.object({
    tier: z.enum(["simple", "advanced"]),
    billing: z.enum(["monthly", "annual"]),
  });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
  const { tier, billing: billingPeriod } = parsed.data;

  if (!user.stripeSubscriptionId) {
    return res.status(400).json({ message: "No active subscription to update. Use checkout instead." });
  }

  try {
    const tierPricing = await storage.getTierPricingByTier(tier);
    if (!tierPricing || !tierPricing.active) {
      return res.status(400).json({ message: "Invalid tier" });
    }

    const priceId = billingPeriod === "annual" ? tierPricing.stripePriceIdAnnual : tierPricing.stripePriceIdMonthly;
    if (!priceId) {
      return res.status(400).json({ message: "Stripe price not configured for this tier" });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    if (!subscription || !subscription.items.data[0]) {
      return res.status(400).json({ message: "Subscription not found" });
    }

    const currentItemId = subscription.items.data[0].id;
    const currentPriceId = subscription.items.data[0].price.id;

    if (currentPriceId === priceId) {
      return res.status(400).json({ message: "You are already on this plan" });
    }

    const currentTierRank = getTierRank(user.tier);
    const newTierRank = getTierRank(tier);
    const isDowngrade = newTierRank < currentTierRank;

    if (isDowngrade) {
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: user.stripeSubscriptionId,
      });

      await stripe.subscriptionSchedules.update(schedule.id, {
        phases: [
          {
            items: [{ price: currentPriceId }],
            start_date: schedule.phases[0].start_date,
            end_date: schedule.phases[0].end_date,
          },
          {
            items: [{ price: priceId }],
          },
        ],
        metadata: { userId: String(user.id), tier },
      });

      await storage.updateUserTier(user.id, {
        pendingTier: tier,
      });

      res.json({
        message: "Plan will downgrade at the end of your current billing period.",
        tier: user.tier,
        pendingTier: tier,
      });
    } else {
      const updatedSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        items: [{ id: currentItemId, price: priceId }],
        proration_behavior: "create_prorations",
        metadata: { userId: String(user.id), tier },
      });

      await storage.updateUserTier(user.id, {
        tier,
        stripeSubscriptionId: updatedSubscription.id,
        tierExpiresAt: new Date((updatedSubscription as unknown as { current_period_end: number }).current_period_end * 1000),
        pendingTier: null,
      });

      res.json({
        message: "Plan upgraded successfully!",
        tier,
      });
    }
  } catch (err: any) {
    console.error("[stripe] Subscription update error:", err.message);
    res.status(500).json({ message: "Failed to update subscription" });
  }
});

async function scheduleDowngradeToFree(userId: number, subscriptionId: string): Promise<{ periodEnd: number }> {
  const stripe = getStripe()!;
  const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  await storage.updateUserTier(userId, { pendingTier: "free" });
  return { periodEnd: (updated as unknown as { current_period_end: number }).current_period_end };
}

router.post("/api/stripe/cancel-subscription", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ message: "Stripe is not configured" });

  const user = await storage.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: "User not found" });

  if (!user.stripeSubscriptionId) {
    return res.status(400).json({ message: "No active subscription" });
  }

  try {
    const { periodEnd } = await scheduleDowngradeToFree(user.id, user.stripeSubscriptionId);
    res.json({ message: "Subscription will cancel at end of billing period", periodEnd });
  } catch (err: any) {
    console.error("[stripe] Cancel error:", err.message);
    res.status(500).json({ message: "Failed to cancel subscription" });
  }
});

router.post("/api/stripe/downgrade-to-free", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ message: "Stripe is not configured" });

  const user = await storage.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: "User not found" });

  if (!user.stripeSubscriptionId) {
    return res.status(400).json({ message: "No active subscription" });
  }

  try {
    const { periodEnd } = await scheduleDowngradeToFree(user.id, user.stripeSubscriptionId);
    res.json({ message: "Your plan will switch to Free at the end of your billing period.", periodEnd });
  } catch (err: any) {
    console.error("[stripe] Downgrade-to-free error:", err.message);
    res.status(500).json({ message: "Failed to downgrade subscription" });
  }
});

router.post("/api/tier/activate-payg", async (_req, res) => {
  res.status(410).json({ message: "Pay As You Go is no longer available." });
});

router.get("/api/tier/credit-transactions", async (_req, res) => {
  res.status(410).json({ message: "Credit transactions are no longer available." });
});

router.post("/api/stripe/webhook", async (req: Request, res: Response) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).send("Stripe not configured");

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      return res.status(500).send("STRIPE_WEBHOOK_SECRET is required in production");
    }
    console.warn("[stripe] STRIPE_WEBHOOK_SECRET not set — accepting unverified events (dev only)");
  }

  try {
    if (webhookSecret && sig) {
      const rawBody = (req as unknown as { rawBody: Buffer }).rawBody;
      event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
    } else if (process.env.NODE_ENV !== "production") {
      event = req.body as Stripe.Event;
    } else {
      return res.status(400).send("Missing stripe-signature header");
    }
  } catch (err: any) {
    console.error("[stripe] Webhook signature verification failed:", err.message);
    return res.status(400).send("Webhook signature verification failed");
  }

  if (!markEventProcessed(event.id)) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (!user) break;

        let tier = subscription.metadata?.tier || "simple";
        const activePriceId = subscription.items?.data?.[0]?.price?.id;
        if (activePriceId) {
          const allTierPricing = await storage.getTierPricing();
          const matchedTier = allTierPricing.find(
            tp => tp.stripePriceIdMonthly === activePriceId || tp.stripePriceIdAnnual === activePriceId
          );
          if (matchedTier) tier = matchedTier.tier;
        }

        const status = subscription.status;

        if (status === "active" || status === "trialing") {
          const subAny = subscription as unknown as { current_period_end: number; cancel_at_period_end: boolean };
          const cancelAtPeriodEnd = subAny.cancel_at_period_end === true;
          await storage.updateUserTier(user.id, {
            tier,
            stripeSubscriptionId: subscription.id,
            tierExpiresAt: new Date(subAny.current_period_end * 1000),
            paymentFailedAt: null,
            pendingTier: cancelAtPeriodEnd ? "free" : null,
          });
        } else if (status === "canceled" || status === "unpaid") {
          const subAny = subscription as unknown as { current_period_end: number };
          const periodEnd = new Date(subAny.current_period_end * 1000);
          if (periodEnd > new Date()) {
            await storage.updateUserTier(user.id, { tierExpiresAt: periodEnd });
          } else {
            await storage.updateUserTier(user.id, {
              tier: "free",
              stripeSubscriptionId: null,
              tierExpiresAt: null,
              pendingTier: null,
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (!user) break;

        await storage.updateUserTier(user.id, {
          tier: "free",
          stripeSubscriptionId: null,
          tierExpiresAt: null,
          pendingTier: null,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (!user) break;

        await storage.updateUserTier(user.id, {
          tier: "free",
          stripeSubscriptionId: null,
          tierExpiresAt: null,
          paymentFailedAt: new Date(),
          pendingTier: null,
        });
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type === "credit_pack") {
          const userId = parseInt(session.metadata.userId);
          const credits = parseInt(session.metadata.credits);
          const priceUsd = parseInt(session.metadata.priceUsd || "0");
          if (!isNaN(userId) && !isNaN(credits)) {
            await storage.adjustCreditBalance(userId, credits);
            await storage.createCreditTransaction({
              userId,
              amount: credits,
              type: "purchase",
              description: `Purchased ${credits} credits`,
              costUsd: isNaN(priceUsd) ? 0 : priceUsd,
            });
          }
        }
        break;
      }
    }
  } catch (err: any) {
    console.error("[stripe] Webhook handler error:", err.message);
  }

  res.json({ received: true });
});

export default router;
