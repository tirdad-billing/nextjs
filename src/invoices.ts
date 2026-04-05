/**
 * @tirdad/billing — Invoices Module
 *
 * Invoice listing and retrieval helpers.
 */

import type { Flexprice } from "@flexprice/sdk";

/** Simplified invoice shape for the billing layer. */
export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  status: string;
  paymentStatus: string;
  dueDate: string | null;
  pdfUrl: string | null;
  billingPeriod: string | null;
  createdAt: string | null;
  finalizedAt: string | null;
}

/**
 * Get all invoices for a customer.
 */
export async function getInvoices(
  sdk: Flexprice,
  customerId: string,
  options?: { limit?: number; offset?: number },
): Promise<{ invoices: BillingInvoice[]; total: number }> {
  const response = await sdk.invoices.queryInvoice({
    customerId,
    limit: options?.limit ?? 25,
    offset: options?.offset ?? 0,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = response as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = raw?.items ?? raw?.invoices ?? [];
  const total: number = raw?.pagination?.total ?? raw?.total ?? items.length;

  return {
    invoices: items.map(mapInvoice),
    total,
  };
}

/**
 * Get a single invoice by ID.
 */
export async function getInvoice(
  sdk: Flexprice,
  invoiceId: string,
): Promise<BillingInvoice | null> {
  try {
    const raw = await sdk.invoices.getInvoice(invoiceId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return mapInvoice(raw as any);
  } catch {
    return null;
  }
}

/**
 * Get the PDF download URL for an invoice.
 */
export async function getInvoicePdfUrl(
  sdk: Flexprice,
  invoiceId: string,
): Promise<string | null> {
  try {
    const raw = await sdk.invoices.getInvoice(invoiceId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (raw as any).invoicePdfUrl ?? (raw as any).invoice_pdf_url ?? null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoice(raw: any): BillingInvoice {
  return {
    id: raw.id ?? "",
    invoiceNumber: raw.invoiceNumber ?? raw.invoice_number ?? "",
    customerId: raw.customerId ?? raw.customer_id ?? "",
    amountDue: parseFloat(raw.amountDue ?? raw.amount_due ?? "0"),
    amountPaid: parseFloat(raw.amountPaid ?? raw.amount_paid ?? "0"),
    amountRemaining: parseFloat(
      raw.amountRemaining ?? raw.amount_remaining ?? "0",
    ),
    currency: raw.currency ?? "USD",
    status: raw.invoiceStatus ?? raw.invoice_status ?? raw.status ?? "unknown",
    paymentStatus:
      raw.paymentStatus ?? raw.payment_status ?? "unknown",
    dueDate: raw.dueDate ?? raw.due_date ?? null,
    pdfUrl: raw.invoicePdfUrl ?? raw.invoice_pdf_url ?? null,
    billingPeriod: raw.billingPeriod ?? raw.billing_period ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    finalizedAt: raw.finalizedAt ?? raw.finalized_at ?? null,
  };
}
