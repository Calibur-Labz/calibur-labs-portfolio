'use client'

import { useSyncExternalStore } from 'react'
import {
  ORBI_DEBUG,
  ORBI_MEDIA,
  ORBI_PLACEMENT,
  type OrbiBreakpoint,
  type OrbiPlacement,
} from './orbiConfig'

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
  const fromQuery = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).has('orbi-debug'),
    () => false,
  )
  return process.env.NODE_ENV !== 'production' && (ORBI_DEBUG || fromQuery)
}
