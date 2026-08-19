/**
 * ORBI — where the eyes are pointed.
 *
 * The pupils are the busiest thing about ORBI: they follow the cursor, glance
 * with the scroll, turn toward a CTA, and hold a section's orientation. Driving
 * that through React would mean a render per mouse move, so this owns the gaze
 * group's transform directly via `gsap.quickTo` — retargeting is a couple of
 * numbers, and GSAP does the interpolation on its own ticker.
 *
 * Several things want to point the eyes at once, so each writes to its own
 * slot and the highest-priority occupied slot wins:
 *
 *   gesture > interaction > scroll > cursor > neutral
 *
 * A section gesture therefore parks the eyes where it wants them and the cursor
 * cannot pull them away; when the gesture clears its slot, the eyes fall back
 * to whatever is still set, all the way down to centre.
 */

import { gsap } from 'gsap'
import {
  ORBI_ART,
  ORBI_GAZE_PRIORITY,
  ORBI_INTERACTION,
  type OrbiGazeSource,
} from './orbiConfig'

export interface OrbiGazeTarget {
  /** Normalized −1…1. Scaled by `ORBI_ART.gazeMax*` and clamped. */
  x: number
  y: number
}

export interface OrbiGazeController {
  /** Point the eyes for one source. Cheap enough to call on every mouse move. */
  set: (source: OrbiGazeSource, x: number, y: number) => void
  /** Give up this source's claim; the eyes fall back to the next one down. */
  clear: (source: OrbiGazeSource) => void
  /** Which source is currently winning, for the debug HUD. */
  source: () => OrbiGazeSource | 'neutral'
  kill: () => void
}

const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v)

export function createGazeController(
  element: SVGGElement,
  options: { reducedMotion: boolean },
): OrbiGazeController {
  const targets = new Map<OrbiGazeSource, OrbiGazeTarget>()
  let winner: OrbiGazeSource | 'neutral' = 'neutral'

  // Reduced motion still gets eye movement — it is the one channel that stays
  // fully expressive — just without the long, drifting settle.
  const duration = options.reducedMotion ? 0.18 : ORBI_INTERACTION.gazeDuration
  const config = { duration, ease: ORBI_INTERACTION.gazeEase }

  const toX = gsap.quickTo(element, 'x', config)
  const toY = gsap.quickTo(element, 'y', config)

  const apply = () => {
    let picked: OrbiGazeSource | null = null
    for (const source of ORBI_GAZE_PRIORITY) {
      if (targets.has(source)) {
        picked = source
        break
      }
    }
    winner = picked ?? 'neutral'

    const target = picked ? targets.get(picked)! : { x: 0, y: 0 }
    toX(clamp(target.x) * ORBI_ART.gazeMaxX)
    toY(clamp(target.y) * ORBI_ART.gazeMaxY)
  }

  return {
    set(source, x, y) {
      const current = targets.get(source)
      if (current && current.x === x && current.y === y) return
      targets.set(source, { x, y })
      apply()
    },
    clear(source) {
      if (!targets.delete(source)) return
      apply()
    },
    source: () => winner,
    kill() {
      targets.clear()
      gsap.killTweensOf(element)
      gsap.set(element, { x: 0, y: 0 })
    },
  }
}
