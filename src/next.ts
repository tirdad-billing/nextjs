/**
 * @flexprice/billing/next — Next.js App Router Adapter
 *
 * Auto-mounts billing routes under basePath (default: /api/billing).
 * Integration is a single catch-all route handler.
 */

// NextRequest is compatible with the standard Request interface.
// We use Request to avoid the hard dependency on next/server at compile time.
type NextRequest = Request & { nextUrl?: URL };
import { createBillingInstance } from "./index.js";
import type {
  FlexpriceBillingConfig,
  BillingActor,
} from "./types.js";
import { BillingCoreError } from "./errors.js";
import { matchRoute } from "./router.js";

export type { BillingInstance } from "./index.js";

/**
 * Create a FlexpriceBilling instance with Next.js-specific route handling.
 * Returns both the billing instance and the route handler.
 */
export function FlexpriceBilling(config: FlexpriceBillingConfig) {
  const billing = createBillingInstance(config);
  const logger = config.observability?.logger ?? console;

  /**
   * Next.js App Router catch-all route handler.
   *
   * Mount as `app/api/billing/[...billing]/route.ts`:
   * ```ts
   * export const { GET, POST } = billing.handlers;
   * ```
   */
  async function handler(req: NextRequest): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method;
    const route = matchRoute(method, url.pathname, config.routes);

    if (!route) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    try {
      // Resolve the actor for authenticated routes (all except webhook)
      let actor: BillingActor | null = null;
      if (route.key !== "webhook") {
        actor = await config.auth.resolveActor(req);
        if (!actor) {
          throw new BillingCoreError("UNAUTHENTICATED", "Authentication required");
        }
      }

      switch (route.key) {
        case "plans":
          return handlePlans(req);

        case "checkout":
          return handleCheckout(req, actor!);

        case "portal":
          return handlePortal(actor!);

        case "webhook":
          return handleWebhookRoute(req);

        case "subscriptions":
          return handleSubscriptions(actor!);

        case "entitlements":
          return handleEntitlements(req, actor!);

        case "entitlements.check":
          return handleEntitlementCheck(req, actor!);

        case "usage":
          return handleUsage(req, actor!);

        case "usage.summary":
          return handleUsageSummary(actor!);

        default:
          return Response.json({ error: "Not found" }, { status: 404 });
      }
    } catch (err) {
      if (err instanceof BillingCoreError) {
        logger.error(`[billing] ${err.code}: ${err.message}`);
        return Response.json(
          { error: err.message, code: err.code },
          { status: err.statusCode },
        );
      }
      logger.error(`[billing] Unexpected error: ${err}`);
      return Response.json(
        { error: "Internal billing error" },
        { status: 500 },
      );
    }
  }

  // ── Route Handlers ──────────────────────────────────────────

  async function handlePlans(req: NextRequest): Promise<Response> {
    const url = new URL(req.url);
    const currency = url.searchParams.get("currency") ?? undefined;
    const lookupKey = url.searchParams.get("lookupKey") ?? undefined;

    const plans = await billing.getPlans({ currency, lookupKey });
    return Response.json({ plans });
  }

  async function handleCheckout(
    req: NextRequest,
    actor: BillingActor,
  ): Promise<Response> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await req.json()) as Record<string, any>;
    const { planId, couponCode, currency, idempotencyKey } = body;

    if (!planId) {
      return Response.json({ error: "planId is required" }, { status: 400 });
    }

    const result = await billing.checkout(actor, {
      planId,
      couponCode,
      currency,
      idempotencyKey,
    });

    return Response.json(result);
  }

  async function handlePortal(actor: BillingActor): Promise<Response> {
    // Resolve customer to get their Flexprice ID for the portal
    const customer = await billing.resolveCustomer(actor);

    // Portal URL pattern — Flexprice's existing customer portal
    // The URL construction depends on Flexprice's portal endpoint
    const portalUrl = `${config.config.apiUrl}/portal/customer/${customer.id}`;

    return Response.json({ url: portalUrl, customerId: customer.id });
  }

  async function handleWebhookRoute(req: NextRequest): Promise<Response> {
    const body = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value: string, key: string) => {
      headers[key] = value;
    });

    const result = await billing.handleWebhook(body, headers);
    return new Response(result.body, {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  async function handleSubscriptions(actor: BillingActor): Promise<Response> {
    const customer = await billing.resolveCustomer(actor);

    const subs = await billing.sdk.subscriptions.querySubscription({
      customerId: customer.id,
    });

    return Response.json({ subscriptions: subs });
  }

  async function handleEntitlements(
    _req: NextRequest,
    actor: BillingActor,
  ): Promise<Response> {
    const entitlements = await billing.getEntitlements(actor.externalId);
    return Response.json({ entitlements });
  }

  async function handleEntitlementCheck(
    req: NextRequest,
    actor: BillingActor,
  ): Promise<Response> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await req.json()) as Record<string, any>;
    const { lookupKey } = body;

    if (!lookupKey) {
      return Response.json(
        { error: "lookupKey is required" },
        { status: 400 },
      );
    }

    const result = await billing.checkFeature(actor.externalId, lookupKey);
    return Response.json(result);
  }

  async function handleUsage(
    req: NextRequest,
    actor: BillingActor,
  ): Promise<Response> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await req.json()) as Record<string, any>;
    const { eventName, quantity, idempotencyKey, properties, timestamp } = body;

    if (!eventName || !idempotencyKey) {
      return Response.json(
        { error: "eventName and idempotencyKey are required" },
        { status: 400 },
      );
    }

    await billing.trackUsage({
      externalId: actor.externalId,
      eventName,
      quantity: quantity ?? 1,
      idempotencyKey,
      properties,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    });

    return Response.json({ status: "ok" });
  }

  async function handleUsageSummary(actor: BillingActor): Promise<Response> {
    const summary = await billing.getUsageSummary(actor.externalId);
    return Response.json({ usage: summary });
  }

  // ── Middleware Helpers ──────────────────────────────────────

  /**
   * Protect a Next.js API route with an entitlement check.
   *
   * ```ts
   * export const GET = billing.requireFeature("advanced_reports", async (req) => {
   *   return Response.json({ data: "..." });
   * });
   * ```
   */
  function requireFeature(
    lookupKey: string,
    routeHandler: (
      req: NextRequest,
      ctx: { actor: BillingActor; customerId: string },
    ) => Response | Promise<Response>,
  ) {
    return async (req: NextRequest): Promise<Response> => {
      const actor = await config.auth.resolveActor(req);
      if (!actor) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const allowed = await billing.hasAccess(actor.externalId, lookupKey);
      if (!allowed) {
        return Response.json(
          {
            error: "Forbidden",
            code: "ENTITLEMENT_DENIED",
            feature: lookupKey,
          },
          { status: 403 },
        );
      }

      const customer = await billing.resolveCustomer(actor);
      return routeHandler(req, {
        actor,
        customerId: customer.id,
      });
    };
  }

  /**
   * Wrap a Next.js API route with automatic usage tracking.
   *
   * ```ts
   * export const GET = billing.trackUsageMiddleware("api_call", async (req) => {
   *   return Response.json({ data: "..." });
   * });
   * ```
   */
  function trackUsageMiddleware(
    eventName: string,
    routeHandler: (req: NextRequest) => Response | Promise<Response>,
  ) {
    return async (req: NextRequest): Promise<Response> => {
      const actor = await config.auth.resolveActor(req);
      if (!actor) {
        return routeHandler(req); // Proceed without tracking if no actor
      }

      const response = await routeHandler(req);

      // Only track on successful responses
      if (response.ok) {
        const idempotencyKey = `${actor.externalId}:${eventName}:${Date.now()}`;
        try {
          await billing.trackUsage({
            externalId: actor.externalId,
            eventName,
            quantity: 1,
            idempotencyKey,
          });
        } catch (err) {
          logger.error(`[billing] Usage tracking failed: ${err}`);
          // Don't fail the response — usage is best-effort
        }
      }

      return response;
    };
  }

  return {
    ...billing,
    /** Route handler for Next.js App Router catch-all */
    handlers: {
      GET: handler,
      POST: handler,
    },
    /** Entitlement-gated route middleware */
    requireFeature,
    /** Automatic usage tracking middleware */
    trackUsageMiddleware,
  };
}

// Re-export everything from index for convenience
export { createBillingInstance, BillingCoreError, FlexpriceClientError, formatPrice } from "./index.js";
export type * from "./types.js";
