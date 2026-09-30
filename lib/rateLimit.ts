/**
 * A fixed-window rate limiter, one per purpose.
 *
 * In-memory and per process, like the ORBI chat limiter: this app runs as a
 * single PM2 process, so one map is one source of truth. It limits how fast a
 * caller can try things; it is never where anything is *stored*.
 */

export interface RateVerdict {
  allowed: boolean
  /** Seconds until the caller may try again. Only meaningful when refused. */
  retryAfter: number
}

export interface RateLimiter {
  check: (key: string, now?: number) => RateVerdict
  reset: () => void
}

/** Above this many tracked callers, start again rather than grow forever. */
const MAX_TRACKED = 5000

export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return {
    check(key, now = Date.now()) {
      if (hits.size > MAX_TRACKED) hits.clear()
      const entry = hits.get(key)
      if (!entry || now >= entry.resetAt) {
        hits.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, retryAfter: 0 }
      }
      entry.count += 1
      if (entry.count > max) {
        return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
      }
      return { allowed: true, retryAfter: 0 }
    },
    reset() {
      hits.clear()
    },
  }
}
