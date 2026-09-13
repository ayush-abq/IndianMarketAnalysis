import { sleep } from "@/lib/utils";

export class RateLimiter {
  private last = 0;

  constructor(private readonly minIntervalMs: number) {}

  async wait() {
    const elapsed = Date.now() - this.last;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }
    this.last = Date.now();
  }
}

export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: { retries: number; label: string },
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === opts.retries) break;
      const wait = Math.min(30_000, 1000 * 2 ** attempt);
      await sleep(wait);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`${opts.label} failed after retries`);
}
