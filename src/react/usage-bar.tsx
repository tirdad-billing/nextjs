/**
 * @tirdad/billing/react — UsageBar component
 *
 * Visual progress bar showing feature usage against limits.
 * Renders inline SVG — no CSS framework required.
 */
"use client";

import { useHasFeature } from "./use-entitlements.js";

export interface UsageBarProps {
  /** The feature lookup key (e.g. "api_calls"). */
  feature: string;
  /** Current usage count. If not provided, will read from entitlement. */
  used?: number;
  /** Maximum allowed. If not provided, will read from entitlement. */
  limit?: number;
  /** Height of the bar in pixels. Default: 8 */
  height?: number;
  /** Width of the bar. Default: "100%" */
  width?: string | number;
  /** Color when under 80% usage. Default: "#3b82f6" (blue) */
  color?: string;
  /** Color when between 80-95%. Default: "#f59e0b" (amber) */
  warningColor?: string;
  /** Color when over 95%. Default: "#ef4444" (red) */
  dangerColor?: string;
  /** Background color. Default: "#e5e7eb" (gray-200) */
  backgroundColor?: string;
  /** Show a label (e.g. "75 / 100 API calls"). Default: false */
  showLabel?: boolean;
  /** Custom label format. Receives (used, limit). Default: "{used} / {limit}" */
  labelFormat?: (used: number, limit: number) => string;
}

/**
 * Usage bar that visualizes feature consumption.
 *
 * ```tsx
 * <UsageBar feature="api_calls" showLabel />
 * <UsageBar feature="storage_gb" used={7.5} limit={10} />
 * ```
 */
export function UsageBar({
  feature,
  used: usedProp,
  limit: limitProp,
  height = 8,
  width = "100%",
  color = "#3b82f6",
  warningColor = "#f59e0b",
  dangerColor = "#ef4444",
  backgroundColor = "#e5e7eb",
  showLabel = false,
  labelFormat,
}: UsageBarProps) {
  const { entitlement, isLoading } = useHasFeature(feature);

  const used =
    usedProp ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((entitlement as any)?.usage ?? (entitlement as any)?.currentUsage ?? 0);
  const limit =
    limitProp ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((entitlement as any)?.limit ?? (entitlement as any)?.allowedUsage ?? 100);

  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  const barColor =
    percentage >= 95 ? dangerColor : percentage >= 80 ? warningColor : color;

  const label = labelFormat
    ? labelFormat(used, limit)
    : `${used} / ${limit}`;

  if (isLoading) {
    return (
      <div style={{ width, opacity: 0.5 }}>
        <div
          style={{
            width: "100%",
            height,
            borderRadius: height / 2,
            backgroundColor,
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ width }}>
      <div
        style={{
          width: "100%",
          height,
          borderRadius: height / 2,
          backgroundColor,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            borderRadius: height / 2,
            backgroundColor: barColor,
            transition: "width 0.3s ease, background-color 0.3s ease",
          }}
        />
      </div>
      {showLabel && (
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            marginTop: 4,
            textAlign: "right",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
