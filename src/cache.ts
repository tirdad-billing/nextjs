/**
 * @flexprice/billing — Entitlement Cache
 *
 * In-memory LRU-ish cache with TTL to reduce API calls on
 * checkFeature() and hasAccess().
 */

export interface EntitlementCacheConfig {
  /** Time-to-live in milliseconds. Default: 60_000 (1 min). */
  ttlMs?: number;
  /** Maximum number of entries. Default: 500. */
  maxEntries?: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class EntitlementCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(config?: EntitlementCacheConfig) {
    this.ttlMs = config?.ttlMs ?? 60_000;
    this.maxEntries = config?.maxEntries ?? 500;
  }

  /**
   * Get a cached value, or null if expired/missing.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set a cached value with TTL.
   */
  set<T>(key: string, value: T): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      // Delete the first (oldest) entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Invalidate a specific key.
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries for a given customer (by prefix match).
   */
  invalidateCustomer(customerId: string): void {
    const prefix = `${customerId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Current cache size.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Build a standard cache key.
   */
  static key(customerId: string, featureKey: string): string {
    return `${customerId}:${featureKey}`;
  }

  static allEntitlementsKey(customerId: string): string {
    return `${customerId}:__all__`;
  }
}
