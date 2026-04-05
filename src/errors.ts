/**
 * @tirdad/billing — Error Handling
 *
 * Structured error types for the Billing Core integration layer.
 * SDK-level errors (Tirdad API 4xx/5xx) pass through unchanged.
 */

/** All error codes produced by the Billing Core (not the SDK). */
export type BillingCoreErrorCode =
  | "UNAUTHENTICATED"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_CREATION_FAILED"
  | "CUSTOMER_RESOLUTION_AMBIGUOUS"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "CONFIGURATION_ERROR"
  | "FEATURE_NOT_FOUND"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "TIMEOUT";

/**
 * Structured error thrown by the Billing Core.
 *
 * SDK errors (Tirdad API failures) are passed through with their original
 * error type. This class is only for errors originated by the integration layer.
 */
export class BillingCoreError extends Error {
  public readonly code: BillingCoreErrorCode;
  public readonly statusCode: number;
  public readonly correlationId?: string;

  constructor(
    code: BillingCoreErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      correlationId?: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "BillingCoreError";
    this.code = code;
    this.statusCode = options?.statusCode ?? errorCodeToStatus(code);
    this.correlationId = options?.correlationId;
  }
}

/** Maps error codes to default HTTP status codes. */
function errorCodeToStatus(code: BillingCoreErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "CUSTOMER_NOT_FOUND":
      return 404;
    case "CUSTOMER_CREATION_FAILED":
      return 500;
    case "CUSTOMER_RESOLUTION_AMBIGUOUS":
      return 409;
    case "WEBHOOK_SIGNATURE_INVALID":
      return 400;
    case "CONFIGURATION_ERROR":
      return 500;
    case "FEATURE_NOT_FOUND":
      return 404;
    case "IDEMPOTENCY_KEY_REQUIRED":
      return 400;
    case "TIMEOUT":
      return 504;
  }
}

/**
 * Structured error for the browser-side client SDK.
 */
export class TirdadClientError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "TirdadClientError";
    this.status = status;
    this.code = code;
  }
}
