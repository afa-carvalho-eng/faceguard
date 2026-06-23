import { config } from "../config";

/**
 * Lazily construct the Stripe client so the API still boots (and the mock
 * provider still works) when Stripe isn't installed/configured. Returns null
 * when STRIPE_SECRET_KEY is absent.
 */
let cached: any | null | undefined;

export function getStripe(): any | null {
  if (cached !== undefined) return cached;
  if (!config.stripeSecretKey) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require("stripe");
    cached = new Stripe(config.stripeSecretKey, { apiVersion: "2024-06-20" });
  } catch (e) {
    console.warn("[stripe] package not installed; billing disabled");
    cached = null;
  }
  return cached;
}

export const billingConfig = {
  pricePro: process.env.STRIPE_PRICE_PRO || "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  successUrl: (process.env.WEB_ORIGIN || "http://localhost:3000") + "/dashboard?upgraded=1",
  cancelUrl: (process.env.WEB_ORIGIN || "http://localhost:3000") + "/pricing",
};
