// ============================================================================
// rate-limiter.ts: STAYS UNDER DISCOGS' LIMIT OF 60 REQUESTS A MINUTE
//
// Remembers when each recent request was made. If the limit has been reached
// in the last minute, it says "no" instead of letting the request go out, so
// Discogs never has to block us.
// ============================================================================

export class RateLimiter {
  private times: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    /** The clock. Tests pass a fake one so they don't have to wait a real minute. */
    private readonly now: () => number = Date.now,
  ) {}

  /** Counts a request and returns true, or returns false if the limit is reached. */
  tryAcquire(): boolean {
    const now = this.now();
    this.times = this.times.filter((time) => now - time < this.windowMs);
    if (this.times.length >= this.limit) return false;
    this.times.push(now);
    return true;
  }
}
