import { Router, raw } from "express";
import { PLAN_LIMITS } from "@faceguard/shared";
import { db } from "../db";
import { config } from "../config";
import { requireAuth, AuthedRequest } from "../auth";
import { getStripe, billingConfig } from "../services/stripeClient";

export const billingRouter = Router();

billingRouter.get("/plans", (_req, res) => {
  res.json({
    free: { ...PLAN_LIMITS.free, priceMonthly: 0 },
    pro: { ...PLAN_LIMITS.pro, priceMonthly: 9.99, currency: "EUR" },
    billingEnabled: !!config.stripeSecretKey,
  });
});

/** Create a Stripe Checkout session for the Pro subscription. */
billingRouter.post("/checkout", requireAuth, async (req: AuthedRequest, res) => {
  const stripe = getStripe();
  if (!stripe || !billingConfig.pricePro) {
    return res.status(501).json({
      error: "Payments not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_PRO.",
      code: "BILLING_NOT_CONFIGURED",
    });
  }
  const user: any = db.prepare(`SELECT id, email, stripe_customer_id FROM users WHERE id=?`).get(req.userId);
  if (!user) return res.status(404).json({ error: "Not found" });

  try {
    // Reuse or create a Stripe customer, keyed to our user id.
    let customerId = user.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      db.prepare(`UPDATE users SET stripe_customer_id=? WHERE id=?`).run(customerId, user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: billingConfig.pricePro, quantity: 1 }],
      success_url: billingConfig.successUrl,
      cancel_url: billingConfig.cancelUrl,
      client_reference_id: user.id,
      metadata: { userId: user.id },
    });
    res.json({ url: session.url });
  } catch (e: any) {
    res.status(502).json({ error: e.message || "Stripe error" });
  }
});

/** Manage existing subscription via the Stripe billing portal. */
billingRouter.post("/portal", requireAuth, async (req: AuthedRequest, res) => {
  const stripe = getStripe();
  const user: any = db.prepare(`SELECT stripe_customer_id FROM users WHERE id=?`).get(req.userId);
  if (!stripe || !user?.stripe_customer_id) {
    return res.status(400).json({ error: "No active billing customer." });
  }
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: billingConfig.cancelUrl,
  });
  res.json({ url: portal.url });
});

/**
 * Stripe webhook. MUST receive the raw body for signature verification, so this
 * route mounts its own raw parser ahead of the global JSON parser (see index.ts).
 */
billingRouter.post("/webhook", raw({ type: "application/json" }), (req, res) => {
  const stripe = getStripe();
  if (!stripe || !billingConfig.webhookSecret) {
    return res.status(501).json({ error: "Webhook not configured" });
  }
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"] as string,
      billingConfig.webhookSecret
    );
  } catch (err: any) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  const setPlanByCustomer = (customerId: string, plan: "free" | "pro") => {
    db.prepare(`UPDATE users SET plan=? WHERE stripe_customer_id=?`).run(plan, customerId);
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const userId = s.metadata?.userId || s.client_reference_id;
      if (userId) db.prepare(`UPDATE users SET plan='pro' WHERE id=?`).run(userId);
      else if (s.customer) setPlanByCustomer(s.customer, "pro");
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const active = ["active", "trialing", "past_due"].includes(sub.status);
      setPlanByCustomer(sub.customer, active ? "pro" : "free");
      break;
    }
    case "customer.subscription.deleted": {
      setPlanByCustomer(event.data.object.customer, "free");
      break;
    }
  }
  res.json({ received: true });
});

// Dev-only helper to exercise Pro features without a live Stripe account.
billingRouter.post("/dev/upgrade", requireAuth, (req: AuthedRequest, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Disabled in production" });
  }
  db.prepare(`UPDATE users SET plan='pro' WHERE id=?`).run(req.userId);
  res.json({ ok: true, plan: "pro" });
});
