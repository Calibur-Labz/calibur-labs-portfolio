'use client'

import { useEffect, useState } from 'react'
import { ORBI_COLORS, ORBI_SLEEP } from './orbiConfig'

/**
 * ORBI — the Z's.
 *
 * Two glyphs, drifting up and away from the nearest screen edge, and nothing
 * else. Deliberately *not* a particle system: there is no pool, no spawner, no
 * per-frame loop and no React state ticking. Two spans exist while ORBI is
 * asleep, each with one CSS animation and a stagger, and the browser does the
 * rest — which also means a background tab stops compositing them without
 * anyone having to remember to pause anything.
 *
 * Mounted only during deep sleep, so awake ORBI costs exactly nothing. The
 * layer lives inside the dock so the Z's follow him from dock to dock and to
 * the footer perch, but *outside* the tilt and the flight, so they hang in the
 * air rather than bobbing along with his breathing.
 *
 * Decorative in the strictest sense: `aria-hidden`, and nothing is said here
 * that is not already obvious from a robot with his eyes shut.
 */
export default function OrbiSleepParticles({
  active,
  side,
  size,
  quiet = false,
  reducedMotion = false,
}: {
  /** True while ORBI is properly asleep. Turning it off fades the Z's out. */
  active: boolean
  /** Which way to drift — always away from the nearer edge of the screen. */
  side: 'left' | 'right'
  /** ORBI's rendered width, for placing the glyphs near his visor. */
  size: number
  /** Phone: one glyph, shorter travel. */
  quiet?: boolean
  reducedMotion?: boolean
}) {
  /**
   * Kept mounted for a beat after waking so the fade can finish — a Z that
   * vanishes on the same frame the eyes open reads as a glitch. Both sides of
   * the flag are set from a timer rather than straight out of the effect, so
   * neither one cascades a render.
   */
  const [lingering, setLingering] = useState(false)

  useEffect(() => {
    if (active) {
      const id = setTimeout(() => setLingering(true), 0)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setLingering(false), ORBI_SLEEP.unmountAfterMs)
    return () => clearTimeout(id)
  }, [active])

  if (!active && !lingering) return null

  const rise = quiet ? ORBI_SLEEP.riseMobile : ORBI_SLEEP.riseDesktop
  const drift = (quiet ? ORBI_SLEEP.driftMobile : ORBI_SLEEP.driftDesktop) *
    (side === 'left' ? -1 : 1)
  // One glyph on a phone; two is already the maximum anywhere.
  const glyphs = quiet ? [ORBI_SLEEP.glyphSmall] : [ORBI_SLEEP.glyphSmall, ORBI_SLEEP.glyphLarge]

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: `${Math.round(size * (side === 'left' ? 1 - ORBI_SLEEP.originX : ORBI_SLEEP.originX))}px`,
        top: `${Math.round(size * ORBI_SLEEP.originY)}px`,
        width: 0,
        height: 0,
        pointerEvents: 'none',
        // Waking fades the whole layer at once, so both glyphs leave together.
        opacity: active ? 1 : 0,
        transition: `opacity ${ORBI_SLEEP.fadeOutMs}ms ease`,
      }}
    >
      {glyphs.map((fontSize, index) => (
        <span
          key={fontSize}
          className={reducedMotion ? undefined : 'orbi-sleep-z'}
          style={{
            position: 'absolute',
            // Each glyph carries its own travel; the keyframes only read these.
            ['--orbi-z-rise' as string]: `${-(rise + index * 4)}px`,
            ['--orbi-z-drift' as string]: `${drift * (1 + index * 0.5)}px`,
            animationDelay: `${(ORBI_SLEEP.particleDelayMs + index * ORBI_SLEEP.particleStaggerMs) / 1000}s`,
            animationDuration: `${(ORBI_SLEEP.particleDurationMs + ORBI_SLEEP.particleGapMs) / 1000}s`,
            // Far enough apart that two in the air read as two Z's rather than
            // as the word "Zz" hanging over his head.
            left: `${index * (quiet ? 7 : 13) * (side === 'left' ? -1 : 1)}px`,
            fontSize: `${quiet ? fontSize - 1 : fontSize}px`,
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            color: ORBI_COLORS.accentSoft,
            textShadow: `0 0 8px ${ORBI_COLORS.accent}55`,
            // With motion reduced the glyph simply sits there, quietly.
            opacity: reducedMotion ? ORBI_SLEEP.glyphOpacity * 0.8 : 0,
            userSelect: 'none',
          }}
        >
          {index === 0 ? 'z' : 'Z'}
        </span>
      ))}
    </div>
  )
}
