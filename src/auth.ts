/**
 * @tirdad/billing — Auth Bridge & Customer Resolver
 *
 * Maps application users (BillingActor) to Tirdad customers.
 * Uses a lookup-first, create-on-miss pattern that tolerates races via a
 * 409-conflict re-fetch fallback (see resolveCustomer for the exact ordering).
 */

import type { Tirdad } from "@tirdad-ai/sdk";
import type { BillingActor, MinimalLogger } from "./types.js";
import { BillingCoreError } from "./errors.js";

/** Resolved Tirdad customer with the fields we need. */
export interface ResolvedCustomer {
  id: string;
  externalId: string;
  email: string;
  name: string;
}

/**
 * Resolve a BillingActor to a Tirdad customer.
 *
 * Strategy: lookup-first, create-on-miss, with a 409 re-fetch fallback.
 * 1. Look up the customer by externalId.
 * 2. On 404 (or a transient lookup failure), attempt to create it.
 * 3. If creation returns 409 Conflict (a parallel request created it first),
 *    re-fetch by externalId and return that.
 * 4. If creation returns a 5xx, attempt a lookup fallback before giving up.
 *
 * This tolerates the create/create race — both callers 404, both attempt to
 * create, one wins and the loser recovers the winner's record via the 409 path.
 */
export async function resolveCustomer(
  sdk: Tirdad,
  actor: BillingActor,
  logger?: MinimalLogger,
): Promise<ResolvedCustomer> {
  // First, try to find the customer by external ID
  try {
    logger?.info(
      `[billing] Looking up customer by externalId=${actor.externalId}`,
    );
    const existing = await sdk.customers.getCustomerByExternalId(
      actor.externalId,
    );

    if (existing) {
      logger?.info(
        `[billing] Found existing customer id=${mapCustomerResponse(existing).id}`,
      );
      return mapCustomerResponse(existing);
    }
  } catch (err: unknown) {
    // 404 = customer doesn't exist yet, proceed to create
    if (!isNotFoundError(err)) {
      logger?.info(
        `[billing] Lookup failed with non-404 error, will try create. Error: ${extractErrorInfo(err)}`,
      );
      // Don't throw here — fall through to create attempt
      // The lookup failure might be transient, and create might still work
    } else {
      logger?.info(
        `[billing] Customer not found (404), will create new customer`,
      );
    }
  }

  // Customer doesn't exist — create it
  try {
    logger?.info(
      `[billing] Creating customer: externalId=${actor.externalId}, email=${actor.email}`,
    );
    const created = await sdk.customers.createCustomer({
      externalId: actor.externalId,
      email: actor.email ?? "",
      name: actor.name ?? "",
      ...(actor.metadata ? { metadata: actor.metadata } : {}),
    });

    logger?.info(
      `[billing] Created Tirdad customer for externalId=${actor.externalId}`,
    );

    return mapCustomerResponse(created);
  } catch (err: unknown) {
    // 409 = race condition, another request created it first
    if (isConflictError(err)) {
      logger?.info(
        `[billing] 409 on create, fetching existing customer for externalId=${actor.externalId}`,
      );

      try {
        const existing = await sdk.customers.getCustomerByExternalId(
          actor.externalId,
        );
        return mapCustomerResponse(existing);
      } catch (fetchErr: unknown) {
        throw new BillingCoreError(
          "CUSTOMER_NOT_FOUND",
          `Customer with externalId "${actor.externalId}" not found after 409 conflict`,
          { cause: fetchErr },
        );
      }
    }

    // 500 = server error — could be transient, try lookup as fallback
    if (isServerError(err)) {
      logger?.info(
        `[billing] 500 on create, attempting lookup fallback. Error: ${extractErrorInfo(err)}`,
      );

      try {
        const existing = await sdk.customers.getCustomerByExternalId(
          actor.externalId,
        );
        if (existing) {
          logger?.info(
            `[billing] Found existing customer on 500 fallback`,
          );
          return mapCustomerResponse(existing);
        }
      } catch {
        // Ignore fallback lookup failure
      }
    }

    throw new BillingCoreError(
      "CUSTOMER_CREATION_FAILED",
      `Failed to create Tirdad customer for externalId "${actor.externalId}": ${extractErrorInfo(err)}`,
      { cause: err },
    );
  }
}

/**
 * Map SDK customer response to our minimal ResolvedCustomer shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCustomerResponse(response: any): ResolvedCustomer {
  return {
    id: response.id ?? response.customer_id ?? "",
    externalId: response.externalId ?? response.external_id ?? "",
    email: response.email ?? "",
    name: response.name ?? "",
  };
}

/** Extract readable error info from any error shape. */
function extractErrorInfo(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as Record<string, unknown>;
  const parts: string[] = [];
  if (e.statusCode) parts.push(`status=${e.statusCode}`);
  if (e.body) parts.push(`body=${typeof e.body === "string" ? e.body : JSON.stringify(e.body)}`);
  if (e.message) parts.push(`message=${e.message}`);
  return parts.join(", ") || String(err);
}

/** Check if an error is a 404 Not Found. */
function isNotFoundError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (e.statusCode === 404 || e.status === 404) return true;
    if (typeof e.message === "string" && e.message.includes("404")) return true;
    if (typeof e.message === "string" && e.message.includes("not found")) return true;
  }
  return false;
}

/** Check if an error is a 409 Conflict. */
function isConflictError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (e.statusCode === 409 || e.status === 409) return true;
    if (typeof e.message === "string" && e.message.includes("409")) return true;
    if (typeof e.message === "string" && e.message.includes("already exists")) return true;
  }
  return false;
}

/** Check if an error is a 500 server error. */
function isServerError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.statusCode === "number" && e.statusCode >= 500) return true;
    if (typeof e.status === "number" && e.status >= 500) return true;
    if (typeof e.message === "string" && e.message.includes("Status 500")) return true;
  }
  return false;
}

