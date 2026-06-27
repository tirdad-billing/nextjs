/**
 * @tirdad/billing/next — Next.js App Router Adapter
 *
 * Auto-mounts billing routes under basePath (default: /api/billing).
 * Integration is a single catch-all route handler.
 */

// NextRequest is compatible with the standard Request interface.
// We use Request to avoid the hard dependency on next/server at compile time.
type NextRequest = Request & { nextUrl?: URL };
import { createBillingInstance } from "./index.js";
import type {
  TirdadBillingConfig,
  BillingActor,
} from "./types.js";
import { BillingCoreError } from "./errors.js";
import { matchRoute } from "./router.js";

export type { BillingInstance } from "./index.js";

/**
 * Create a TirdadBilling instance with Next.js-specific route handling.
 * Returns both the billing instance and the route handler.
 */
export function TirdadBilling(config: TirdadBillingConfig) {
  if (!config.auth?.resolveActor) {
    throw new Error(
      "TirdadBilling (Next.js adapter) requires config.auth.resolveActor. " +
      "If you only need the SDK without HTTP routes, use createBillingInstance() instead.",
    );
  }

  // After the guard, auth is guaranteed to be defined
  const resolvedConfig = config as TirdadBillingConfig & { auth: NonNullable<TirdadBillingConfig["auth"]> };

  const billing = createBillingInstance(resolvedConfig);
  const logger = resolvedConfig.observability?.logger ?? console;

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

    // CSRF protection (opt-in): for cookie-session apps, verify that
    // state-changing POSTs originate from the same site. The webhook route is
    // exempt — it's a server-to-server call authenticated by its Svix signature
    // and carries no Origin header.
    if (
      config.routes?.csrfProtection &&
      method === "POST" &&
      route.key !== "webhook"
    ) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      let sameOrigin = false;
      if (origin && host) {
        try {
          sameOrigin = new URL(origin).host === host;
        } catch {
          sameOrigin = false;
        }
      }
      if (!sameOrigin) {
        logger.warn(
          `[billing] CSRF check failed: origin=${origin ?? "<none>"} host=${host ?? "<none>"}`,
        );
        return Response.json(
          { error: "CSRF validation failed", code: "CSRF_FAILED" },
          { status: 403 },
        );
      }
    }

    try {
      // Resolve the actor for authenticated routes (all except webhook)
      let actor: BillingActor | null = null;
      if (route.key !== "webhook") {
        actor = await resolvedConfig.auth.resolveActor(req);
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

        case "invoices":
          return handleInvoices(req, actor!);

        case "coupons.validate":
          return handleCouponValidate(req);

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

      // Try to extract a useful error message from Tirdad SDK errors
      const errObj = err as Record<string, unknown>;
      const statusCode =
        typeof errObj?.statusCode === "number" ? errObj.statusCode : 500;
      let message = "Internal billing error";

      // Tirdad SDK errors (TirdadError) carry a 'body' field with JSON details
      if (typeof errObj?.body === "string") {
        try {
          const parsed = JSON.parse(errObj.body);
          if (parsed.message) message = parsed.message;
        } catch {
          // body wasn't JSON, use it directly if short
          if (errObj.body.length < 200) message = errObj.body;
        }
      } else if (typeof errObj?.message === "string") {
        // Fall back to the error's own message
        message = errObj.message;
      }

      return Response.json(
        { error: message, code: "BILLING_ERROR" },
        { status: statusCode },
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
    const { url, customerId } = await billing.getPortalUrl(actor);
    return Response.json({ url, customerId });
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
    const subs = await billing.getSubscriptions(actor.externalId);
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

    try {
      const result = await billing.checkFeature(actor.externalId, lookupKey);
      return Response.json(result);
    } catch (err) {
      // A missing feature is a valid "no access" answer, not an error. Return
      // 200 with isEnabled:false so the typed client receives the graceful body
      // instead of throwing on a non-2xx status.
      if (err instanceof BillingCoreError && err.code === "FEATURE_NOT_FOUND") {
        return Response.json(
          { isEnabled: false, lookupKey, error: err.message },
          { status: 200 },
        );
      }
      throw err;
    }
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

  async function handleInvoices(
    req: NextRequest,
    actor: BillingActor,
  ): Promise<Response> {
    const url = new URL(req.url);
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");

    const result = await billing.getInvoices(actor.externalId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return Response.json(result);
  }

  async function handleCouponValidate(req: NextRequest): Promise<Response> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await req.json()) as Record<string, any>;
    const { code } = body;

    if (!code) {
      return Response.json(
        { error: "code is required" },
        { status: 400 },
      );
    }

    const coupon = await billing.validateCoupon(code);
    return Response.json({ coupon, valid: coupon !== null });
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
      const actor = await resolvedConfig.auth.resolveActor(req);
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
      const actor = await resolvedConfig.auth.resolveActor(req);
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
export { createBillingInstance, BillingCoreError, TirdadClientError, formatPrice } from "./index.js";
export type * from "./types.js";
