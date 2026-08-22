'use client'

import { useSyncExternalStore } from 'react'
import {
  ORBI_DEBUG,
  ORBI_DEV_PARAMS,
  ORBI_MEDIA,
  ORBI_PLACEMENT,
  ORBI_EASTER_SPECS,
  type OrbiBreakpoint,
  type OrbiCinematicType,
  type OrbiEasterEgg,
  type OrbiPlacement,
} from './orbiConfig'
import { ORBI_GUIDE_ITEMS } from './orbiGuideConfig'

/**
 * Media-query state without hydration warnings.
 *
 * `useSyncExternalStore` lets us hand React a deterministic server snapshot
 * (desktop / motion allowed) and swap to the real match on the client. ORBI is
 * invisible until its entrance timeline runs — which starts after mount — so
 * the one-frame correction is never seen.
 */
function subscribe(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }
}

function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    () => serverValue,
  )
}

/** `true` when the visitor has asked their OS to reduce motion. */
export function useReducedMotion(): boolean {
  return useMediaQuery(ORBI_MEDIA.reducedMotion)
}

/**
 * A real cursor, not a finger. This — not the breakpoint — is what decides
 * whether ORBI tracks the pointer, since a small laptop still has a mouse and
 * a large tablet does not.
 */
export function useFinePointer(): boolean {
  return useMediaQuery(ORBI_MEDIA.finePointer)
}

export function useOrbiBreakpoint(): OrbiBreakpoint {
  const isMobile = useMediaQuery(ORBI_MEDIA.mobile)
  const isTablet = useMediaQuery(ORBI_MEDIA.tablet)
  if (isMobile) return 'mobile'
  if (isTablet) return 'tablet'
  return 'desktop'
}

/** Size + offsets for the current viewport. */
export function useOrbiPlacement(): OrbiPlacement {
  return ORBI_PLACEMENT[useOrbiBreakpoint()]
}

/** Nothing to subscribe to — the query string cannot change within a page view. */
const noSubscribe = () => () => {}

/**
 * Whether the development HUD should render.
 *
 * `NODE_ENV` is inlined by Next, so in a production build this collapses to
 * `false` and `OrbiDebug` is dropped from the bundle entirely. In development,
 * flip `ORBI_DEBUG` in `orbiConfig.ts` or just append `?orbi-debug` to the URL.
 *
 * Read through `useSyncExternalStore` so the server snapshot (`false`) and the
 * client's first render agree — no hydration warning.
 */
export function useOrbiDebugEnabled(): boolean {
  const fromQuery = useDevParam(ORBI_DEV_PARAMS.debug)
  return isDev() && (ORBI_DEBUG || fromQuery !== null)
}

/**
 * `?orbi-freeze=1` — hold ORBI completely still while leaving him rendered.
 *
 * Continuous flight makes Playwright's element screenshots time out waiting
 * for a stable box, which is correct behaviour on its side and unhelpful on
 * ours. This exists so a visual test can get a deterministic frame. Dev only.
 */
export function useOrbiFrozen(): boolean {
  const frozen = useDevParam(ORBI_DEV_PARAMS.freeze)
  return isDev() && frozen !== null
}

/**
 * `?orbi-cinematic=precision` — run a cinematic on load so it can be tuned
 * without scrolling to it and waiting out the cooldown. Dev only.
 */
export function useOrbiCinematicRequest(): OrbiCinematicType | null {
  const value = useDevParam(ORBI_DEV_PARAMS.cinematic)
  if (!isDev()) return null
  return value === 'hero' || value === 'precision' || value === 'projects'
    ? value
    : null
}

/**
 * `?orbi-easter=dizzyClick` — run one hidden reaction on demand, because
 * waiting for a 40-second cooldown to tune 400ms of animation is no way to
 * work. Dev only.
 */
export function useOrbiEasterRequest(): OrbiEasterEgg | null {
  const value = useDevParam(ORBI_DEV_PARAMS.easter)
  if (!isDev() || !value) return null
  return value in ORBI_EASTER_SPECS ? (value as OrbiEasterEgg) : null
}

/**
 * `?orbi-audio-debug=1` — sound-test buttons in the HUD, so each cue can be
 * heard on demand while tuning it. Dev only.
 */
export function useOrbiAudioDebug(): boolean {
  const value = useDevParam(ORBI_DEV_PARAMS.audio)
  return isDev() && value !== null
}

/**
 * `?orbi-sleep=deep` — send ORBI straight to the bottom of the inactivity
 * state machine, so the sleeping pose can be looked at without sitting still
 * for 75 seconds. Dev only.
 */
export function useOrbiSleepRequest(): boolean {
  const value = useDevParam(ORBI_DEV_PARAMS.sleep)
  return isDev() && value === 'deep'
}

/**
 * `?orbi-guide=1` — the guide destination buttons in the HUD.
 * `?orbi-guide=work` — ...and run that guided trip once ORBI has settled, so a
 * destination's arrival can be watched without five clicks each time. Dev only.
 */
export function useOrbiGuideRequest(): { tools: boolean; target: string | null } {
  const value = useDevParam(ORBI_DEV_PARAMS.guide)
  if (!isDev() || value === null) return { tools: false, target: null }
  const known = ORBI_GUIDE_ITEMS.some((item) => item.id === value)
  return { tools: true, target: known ? value : null }
}

/** Inlined by Next, so every dev switch above vanishes from a production build. */
const isDev = () => process.env.NODE_ENV !== 'production'

/** Read once per page view — the query string cannot change under us. */
function useDevParam(name: string): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  )
}
