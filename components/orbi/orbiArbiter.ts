/**
 * ORBI — interaction priority.
 *
 * One claim is in force at a time. A request lands only if it outranks (or
 * matches) the claim currently held, so the scroll glance can never cut a
 * section gesture short and nothing at all interrupts the entrance.
 *
 * Deliberately plain: no React, no state, no renders. `OrbiGuide` holds one of
 * these in a ref and consults it synchronously from GSAP callbacks and
 * ScrollTrigger handlers.
 */

import { ORBI_PRIORITY } from './orbiConfig'

export interface OrbiClaim {
  level: number
  owner: string
  /** Timestamp the claim lapses on its own, in `performance.now()` terms. */
  until: number
}

export interface OrbiArbiter {
  /** Take control for `durationMs`. Returns false if outranked. */
  claim: (level: number, owner: string, durationMs: number) => boolean
  /** Give control back early. No-op if someone else already took over. */
  release: (owner: string) => void
  /** The claim in force right now, or `null`. */
  current: () => OrbiClaim | null
  level: () => number
}

const now = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

export function createOrbiArbiter(): OrbiArbiter {
  let claim: OrbiClaim | null = null

  const current = () => {
    if (claim && now() >= claim.until) claim = null
    return claim
  }

  return {
    claim(level, owner, durationMs) {
      const held = current()
      // Equal levels are allowed to hand over — two sections in a row should
      // not deadlock each other — but anything lower is refused outright.
      if (held && held.owner !== owner && level < held.level) return false
      claim = { level, owner, until: now() + durationMs }
      return true
    },
    release(owner) {
      if (claim?.owner === owner) claim = null
    },
    current,
    level: () => current()?.level ?? ORBI_PRIORITY.idle,
  }
}
