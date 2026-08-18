'use client'

import { createContext, useContext } from 'react'
import { ORBI_INITIAL_STATE, type OrbiController } from './orbiConfig'

export const OrbiContext = createContext<OrbiController | null>(null)

/** Inert stand-in so callers never have to null-check. */
const DETACHED: OrbiController = {
  state: ORBI_INITIAL_STATE,
  activeSection: null,
  scrollDirection: null,
  setOrbiState: () => {},
  say: () => {},
  clearMessage: () => {},
  hide: () => {},
  peek: () => {},
  show: () => {},
  registerSection: () => () => {},
}

/**
 * Talk to ORBI from anywhere inside `<OrbiGuide>`.
 *
 * Phase 2 scroll triggers will use this:
 *   const { setOrbiState } = useOrbi()
 *   setOrbiState({ expression: 'happy', animation: 'wave', message: 'Check this out!' })
 *
 * Outside the provider — the maintenance screen, the admin console — it
 * returns a no-op controller so a section can call it unconditionally without
 * caring whether ORBI is on the page.
 */
export function useOrbi(): OrbiController {
  return useContext(OrbiContext) ?? DETACHED
}
