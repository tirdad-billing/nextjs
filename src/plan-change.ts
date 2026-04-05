/**
 * @tirdad/billing — Plan Change Module
 *
 * Proration preview and plan change execution helpers.
 */

import type { Flexprice } from "@flexprice/sdk";

/** Preview of what a plan change will cost. */
export interface PlanChangePreview {
  changeType: string;
  currentPlanId: string | null;
  currentPlanName: string | null;
  targetPlanId: string | null;
  targetPlanName: string | null;
  effectiveDate: string | null;
  subscriptionId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prorationDetails: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nextInvoicePreview: any;
  warnings: string[];
}

/**
 * Preview a plan change (upgrade/downgrade) before executing.
 * Shows proration details and the next invoice preview.
 */
export async function previewPlanChange(
  sdk: Flexprice,
  subscriptionId: string,
  targetPlanId: string,
  options?: {
    billingCadence?: string;
    billingPeriod?: string;
    prorationBehavior?: string;
  },
): Promise<PlanChangePreview> {
  const response = await sdk.subscriptions.previewSubscriptionChange(
    subscriptionId,
    {
      targetPlanId,
      billingCadence: (options?.billingCadence as "RECURRING") ?? "RECURRING",
      billingPeriod: (options?.billingPeriod as "MONTHLY") ?? "MONTHLY",
      billingCycle: "anniversary",
      prorationBehavior:
        (options?.prorationBehavior as "create_prorations") ??
        "create_prorations",
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = response as any;

  return {
    changeType: raw.changeType ?? raw.change_type ?? "unknown",
    currentPlanId: raw.currentPlan?.id ?? raw.current_plan?.id ?? null,
    currentPlanName: raw.currentPlan?.name ?? raw.current_plan?.name ?? null,
    targetPlanId: raw.targetPlan?.id ?? raw.target_plan?.id ?? null,
    targetPlanName: raw.targetPlan?.name ?? raw.target_plan?.name ?? null,
    effectiveDate: raw.effectiveDate ?? raw.effective_date ?? null,
    subscriptionId: raw.subscriptionId ?? raw.subscription_id ?? null,
    prorationDetails: raw.prorationDetails ?? raw.proration_details ?? null,
    nextInvoicePreview:
      raw.nextInvoicePreview ?? raw.next_invoice_preview ?? null,
    warnings: raw.warnings ?? [],
  };
}

/**
 * Execute a plan change (upgrade/downgrade).
 * Use previewPlanChange() first to show the user what will happen.
 */
export async function changePlan(
  sdk: Flexprice,
  subscriptionId: string,
  targetPlanId: string,
  options?: {
    billingCadence?: string;
    billingPeriod?: string;
    prorationBehavior?: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  return sdk.subscriptions.executeSubscriptionChange(subscriptionId, {
    targetPlanId,
    billingCadence: (options?.billingCadence as "RECURRING") ?? "RECURRING",
    billingPeriod: (options?.billingPeriod as "MONTHLY") ?? "MONTHLY",
    billingCycle: "anniversary",
    prorationBehavior:
      (options?.prorationBehavior as "create_prorations") ??
      "create_prorations",
  });
}
