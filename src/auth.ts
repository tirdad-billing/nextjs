/**
 * @tirdad/billing — Auth Bridge & Customer Resolver
 *
 * Maps application users (BillingActor) to Tirdad customers.
 * Uses create-or-fetch pattern (race-safe, no TOCTOU window).
 */

import type { Flexprice } from "@flexprice/sdk";
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
 * Strategy: create-then-catch-409
 * 1. Attempt to create a customer with the actor's externalId
 * 2. If 409 Conflict (already exists), fetch by externalId
 * 3. If the customer is found, return it
 *
 * This is race-safe — even if two parallel requests both attempt creation,
 * one succeeds and the other falls back to fetch.
 */
export async function resolveCustomer(
  sdk: Flexprice,
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

