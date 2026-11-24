import "server-only";

type Entry<T> = { value: Promise<T>; expiresAt: number };

/**
 * A small in-memory TTL cache that also de-duplicates concurrent requests for
 * the same key. Failed loads are evicted so the next call retries.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > now) return hit.value;

    const value = load();
    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    this.evict();
    return value;
  }

  private evict() {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) return;
      this.entries.delete(oldest);
    }
  }
}
