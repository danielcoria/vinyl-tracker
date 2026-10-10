// ============================================================================
// failure-limiter.ts: SLOWS DOWN PASSWORD GUESSING
//
// Remembers wrong passwords per "key" (an address, or an address + username).
// After 10 wrong tries within 15 minutes, that key has to wait until the oldest
// try is 15 minutes old. Used by the site password lock and by logging in.
// ============================================================================

const MAX_FAILURES = 10;
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export class FailureLimiter {
  private failures = new Map<string, number[]>();

  /** The clock. Tests pass a fake one to skip the 15-minute wait. */
  constructor(private readonly now: () => number = Date.now) {}

  private recent(key: string): number[] {
    const now = this.now();
    return (this.failures.get(key) ?? []).filter((time) => now - time < FAILURE_WINDOW_MS);
  }

  /** True when this key has had too many wrong tries lately. */
  isBlocked(key: string): boolean {
    return this.recent(key).length >= MAX_FAILURES;
  }

  recordFailure(key: string): void {
    const recent = this.recent(key);
    recent.push(this.now());
    this.failures.set(key, recent);
    this.forgetOld();
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
  }

  /** Keeps the list from growing forever. */
  private forgetOld() {
    if (this.failures.size < 1000) return;
    for (const key of this.failures.keys()) {
      if (this.recent(key).length === 0) this.failures.delete(key);
    }
  }
}
