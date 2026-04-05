/**
 * @flexprice/billing/express — Express Adapter
 *
 * Mounts billing routes on an Express router.
 *
 * Usage:
 * ```ts
 * import express from "express";
 * import { FlexpriceBillingExpress } from "@flexprice/billing/express";
 *
 * const app = express();
 * app.use("/api/billing", FlexpriceBillingExpress({ config, auth }));
 * ```
 */

import {
  createBillingInstance,
  type BillingInstance,
} from "../index.js";
import type { FlexpriceBillingConfig, BillingActor } from "../types.js";
import { BillingCoreError } from "../errors.js";

/**
 * Minimal Express-compatible types so we don't require express as a dependency.
 */
interface ExpressRequest {
  method: string;
  path: string;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

interface ExpressResponse {
  status(code: number): ExpressResponse;
  json(body: unknown): void;
  send(body: string): void;
  setHeader(name: string, value: string): void;
}

type ExpressNextFunction = (err?: unknown) => void;

type ExpressRouter = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction,
) => void;

export interface FlexpriceBillingExpressOptions extends FlexpriceBillingConfig {}

/**
 * Create an Express router that mounts all billing routes.
 *
 * ```ts
 * app.use("/api/billing", FlexpriceBillingExpress(config));
 * ```
 */
export function FlexpriceBillingExpress(
  config: FlexpriceBillingExpressOptions,
): ExpressRouter {
  const billing: BillingInstance = createBillingInstance(config);

  return async function billingRouter(
    req: ExpressRequest,
    res: ExpressResponse,
    next: ExpressNextFunction,
  ) {
    const path = req.path.replace(/\/$/, "") || "/";

    try {
      // ── GET routes ────────────────────
      if (req.method === "GET") {
        switch (path) {
          case "/plans": {
            const currency = asString(req.query.currency);
            const plans = await billing.getPlans(
              currency ? { currency } : undefined,
            );
            return res.json({ plans });
          }

          case "/subscriptions": {
            const actor = await resolveActor(config, req);
            const subs = await billing.getSubscriptions(actor.externalId);
            return res.json({ subscriptions: subs });
          }

          case "/entitlements": {
            const actor = await resolveActor(config, req);
            const ents = await billing.getEntitlements(actor.externalId);
            return res.json(ents);
          }

          case "/usage/summary": {
            const actor = await resolveActor(config, req);
            const summary = await billing.getUsageSummary(actor.externalId);
            return res.json(summary);
          }

          default:
            return next();
        }
      }

      // ── POST routes ───────────────────
      if (req.method === "POST") {
        switch (path) {
          case "/checkout": {
            const actor = await resolveActor(config, req);
            const body = req.body as { planId: string; couponCode?: string; currency?: string };
            const result = await billing.checkout(actor, body);
            return res.json(result);
          }

          case "/portal": {
            const actor = await resolveActor(config, req);
            const customer = await billing.resolveCustomer(actor);
            // Portal session — pass through to SDK
            return res.json({ customerId: customer.id });
          }

          case "/webhook": {
            const rawBody =
              typeof req.body === "string"
                ? req.body
                : JSON.stringify(req.body);

            const headers: Record<string, string> = {};
            for (const [k, v] of Object.entries(req.headers)) {
              if (typeof v === "string") headers[k] = v;
            }

            const result = await billing.handleWebhook(rawBody, headers);
            return res.status(result.status).send(result.body);
          }

          case "/entitlements/check": {
            const actor = await resolveActor(config, req);
            const { lookupKey } = req.body as { lookupKey: string };
            const check = await billing.checkFeature(
              actor.externalId,
              lookupKey,
            );
            return res.json(check);
          }

          case "/usage": {
            const actor = await resolveActor(config, req);
            const usageBody = req.body as {
              eventName: string;
              quantity?: number;
              idempotencyKey: string;
              properties?: Record<string, string>;
            };
            await billing.trackUsage({
              externalId: actor.externalId,
              eventName: usageBody.eventName,
              quantity: usageBody.quantity ?? 1,
              idempotencyKey: usageBody.idempotencyKey,
              properties: usageBody.properties,
            });
            return res.json({ status: "ok" });
          }

          default:
            return next();
        }
      }

      // Anything else falls through
      next();
    } catch (err) {
      if (err instanceof BillingCoreError) {
        return res.status(err.statusCode).json({
          error: err.message,
          code: err.code,
        });
      }
      next(err);
    }
  };
}

// ── Helpers ────────────────────────────────────────

async function resolveActor(
  config: FlexpriceBillingConfig,
  req: ExpressRequest,
): Promise<BillingActor> {
  // Express req is not a standard Request, but we adapt for the auth bridge
  const actor = await config.auth.resolveActor(req as unknown as Request);
  if (!actor) {
    throw new BillingCoreError(
      "UNAUTHENTICATED",
      "Authentication required for this billing operation",
    );
  }
  return actor;
}

function asString(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0];
  return val;
}
