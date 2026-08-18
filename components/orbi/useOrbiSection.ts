'use client'

import { useEffect } from 'react'
import { useOrbi } from './OrbiContext'
import type { OrbiSectionBehavior } from './orbiConfig'

/**
 * Register a section's ORBI behaviour from a client component.
 *
 * Most of the site does not need this — the static map in `orbiSections.ts`
 * covers every section that already has a DOM id, and keeps ORBI logic out of
 * the section components entirely. Reach for this only when a section's
 * reaction depends on something known at runtime.
 *
 *   useOrbiSection({ id: 'pricing', expression: 'happy', animation: 'look-left' })
 *
 * The element with a matching `id` must be in the DOM; ORBI attaches its
 * ScrollTrigger to it. Outside `<OrbiGuide>` this is an inert no-op.
 */
export function useOrbiSection(behavior: OrbiSectionBehavior | null) {
  const { registerSection } = useOrbi()

  // Serialized so an inline object literal does not re-register every render.
  const key = behavior ? JSON.stringify(behavior) : null

  useEffect(() => {
    if (!key) return
    return registerSection(JSON.parse(key) as OrbiSectionBehavior)
  }, [key, registerSection])
}
