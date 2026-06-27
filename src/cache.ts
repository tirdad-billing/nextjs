/**
 * @tirdad/billing — Entitlement Cache
 *
 * In-memory LRU cache with TTL to reduce API calls on checkFeature(),
 * hasAccess(), and getEntitlements(). Reads promote entries to
 * most-recently-used; capacity eviction drops the least-recently-used entry.
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
   *
   * On a hit, the entry is promoted to most-recently-used (re-inserted at the
   * tail of the Map) so that capacity eviction is true LRU, not insertion-order
   * FIFO.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Promote to most-recently-used.
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value as T;
  }

  /**
   * Set a cached value with TTL.
   *
   * Maps preserve insertion order, so the first key is the least-recently-used
   * once get() promotes entries on access. We evict from the front at capacity.
   */
  set<T>(key: string, value: T): void {
    // If the key already exists, delete it first so re-inserting moves it to
    // the tail (most-recently-used) rather than updating in place.
    this.cache.delete(key);

    // Evict the least-recently-used entry (front of the Map) if at capacity.
    if (this.cache.size >= this.maxEntries) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) {
        this.cache.delete(lruKey);
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
