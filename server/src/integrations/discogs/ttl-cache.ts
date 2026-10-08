// ============================================================================
// ttl-cache.ts: REMEMBERS RECENT ANSWERS FOR A WHILE
//
// "TTL" means time to live: each saved answer expires after a set time.
// Searching for the same thing twice, or opening the same release again,
// is answered from memory instead of asking Discogs again. This is faster and
// saves our 60-a-minute allowance. The oldest entries are dropped when full.
// ============================================================================

export class TtlCache<V> {
  private entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V, ttlMs: number): void {
    // A Map remembers insertion order, so the first key is always the oldest.
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }
}
