// Relative rather than `@/` so the limiter compiles and runs under plain
// Node in the test suite, the same way every other ORBI test does.
import { ORBI_ASK } from '../../components/orbi/orbiAsk'

/**
 * A fixed window per caller, held in memory.
 *
 * Honest about what it is: one process's view of one minute. It stops a stuck
 * client, a page left open on a script, and casual curl abuse — which is the
 * whole threat model for a question box on a portfolio site. It is not a
 * distributed limiter, and on a serverless platform each instance keeps its
 * own count, so the real ceiling is `maxPerWindow × instances`.
 *
 * No timer sweeps it. Expired entries are dropped when their key is next seen,
 * and the whole map is cleared when it grows past a cap — a background
 * interval to tidy a map this size would cost more than it saves.
 */

const hits = new Map<string, { count: number; resetAt: number }>()

/** Above this many tracked callers, start again rather than grow forever. */
const MAX_TRACKED = 5000

export interface OrbiRateVerdict {
  allowed: boolean
  /** Seconds until the caller may try again. Only meaningful when refused. */
  retryAfter: number
}

export function checkOrbiRate(key: string, now = Date.now()): OrbiRateVerdict {
  if (hits.size > MAX_TRACKED) hits.clear()

  const entry = hits.get(key)
  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + ORBI_ASK.windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  entry.count += 1
  if (entry.count > ORBI_ASK.maxPerWindow) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { allowed: true, retryAfter: 0 }
}

/** Tests only — the module is a singleton by design. */
export function resetOrbiRate(): void {
  hits.clear()
}

/**
 * Who is asking.
 *
 * Behind Vercel the first `x-forwarded-for` hop is the client. This is a
 * best-effort bucket key, not identification: a shared NAT counts as one
 * caller, and that is an acceptable trade for a limiter this small.
 */
export function callerKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'unknown'
}
