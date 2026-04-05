/**
 * @tirdad/billing — Route Matching Engine
 *
 * Framework-agnostic route matcher that maps incoming requests
 * to billing handlers based on RouteKey configuration.
 */

import type { RouteKey, RouteConfig } from "./types.js";

export interface RouteMatch {
  key: RouteKey;
  method: "GET" | "POST";
  handler: string; // handler identifier
}

/** Route definitions: key → method + relative path */
const ROUTE_DEFINITIONS: Array<{
  key: RouteKey;
  method: "GET" | "POST";
  path: string;
}> = [
  { key: "plans", method: "GET", path: "/plans" },
  { key: "checkout", method: "POST", path: "/checkout" },
  { key: "portal", method: "POST", path: "/portal" },
  { key: "webhook", method: "POST", path: "/webhook" },
  { key: "subscriptions", method: "GET", path: "/subscriptions" },
  { key: "entitlements", method: "GET", path: "/entitlements" },
  { key: "entitlements.check", method: "POST", path: "/entitlements/check" },
  { key: "usage", method: "POST", path: "/usage" },
  { key: "usage.summary", method: "GET", path: "/usage/summary" },
  { key: "invoices", method: "GET", path: "/invoices" },
  { key: "coupons.validate", method: "POST", path: "/coupons/validate" },
];

/**
 * Match an incoming request to a billing route.
 *
 * @param method - HTTP method
 * @param pathname - Full request pathname (e.g. "/api/billing/plans")
 * @param routeConfig - Route configuration from TirdadBilling
 * @returns The matched route, or null if no match
 */
export function matchRoute(
  method: string,
  pathname: string,
  routeConfig?: RouteConfig,
): RouteMatch | null {
  const basePath = routeConfig?.basePath ?? "/api/billing";
  const disabled = new Set(routeConfig?.disable ?? []);

  // Strip base path to get the relative path
  if (!pathname.startsWith(basePath)) return null;
  const relativePath = pathname.slice(basePath.length) || "/";

  // Find matching route
  for (const route of ROUTE_DEFINITIONS) {
    if (disabled.has(route.key)) continue;
    if (route.method !== method.toUpperCase()) continue;
    if (route.path === relativePath) {
      return {
        key: route.key,
        method: route.method,
        handler: route.key,
      };
    }
  }

  return null;
}

/**
 * Get all active route definitions (excluding disabled ones).
 */
export function getActiveRoutes(
  routeConfig?: RouteConfig,
): Array<{ key: RouteKey; method: string; fullPath: string }> {
  const basePath = routeConfig?.basePath ?? "/api/billing";
  const disabled = new Set(routeConfig?.disable ?? []);

  return ROUTE_DEFINITIONS.filter((r) => !disabled.has(r.key)).map((r) => ({
    key: r.key,
    method: r.method,
    fullPath: `${basePath}${r.path}`,
  }));
}
