/**
 * @flexprice/billing — Webhook Deduplication Store
 *
 * In-memory implementation with TTL for single-instance servers.
 * For serverless/multi-instance, provide a custom DedupStore (Redis, DynamoDB).
 */

import type { DedupStore } from "./types.js";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * In-memory dedup store backed by a Map with TTL-based cleanup.
 * Sufficient for single-instance, long-lived servers.
 */
export class InMemoryDedupStore implements DedupStore {
  private readonly store = new Map<string, number>();
  private readonly ttlMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
    this.startCleanup();
  }

  async has(messageId: string): Promise<boolean> {
    const expiresAt = this.store.get(messageId);
    if (expiresAt === undefined) return false;

    if (Date.now() > expiresAt) {
      this.store.delete(messageId);
      return false;
    }

    return true;
  }

  async set(messageId: string): Promise<void> {
    this.store.set(messageId, Date.now() + this.ttlMs);
  }

  /** Stop the cleanup timer (for graceful shutdown in tests). */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** Current number of entries (for testing). */
  get size(): number {
    return this.store.size;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, expiresAt] of this.store) {
        if (now > expiresAt) {
          this.store.delete(key);
        }
      }
    }, CLEANUP_INTERVAL_MS);

    // Don't prevent Node.js from exiting
    if (this.cleanupTimer && "unref" in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }
}
