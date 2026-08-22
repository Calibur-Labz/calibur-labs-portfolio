'use client'

import { useEffect, useState } from 'react'
import { ORBI_COLORS, ORBI_SLEEP } from './orbiConfig'

/**
 * The two sleep animations, carried by ORBI himself.
 *
 * They used to live in `globals.css`, and that turned out to be a real
 * fragility rather than a tidy one: ORBI is a drop-in component, so an
 * animation of his that depends on the *application's* stylesheet is an
 * invisible coupling — and a stale or missing stylesheet makes him look
 * broken in a way nothing reports. Keyframes cannot be expressed in inline
 * styles, so they travel with him instead, in one static tag.
 *
 * `prefers-reduced-motion` still disables them: the global reset in
 * `globals.css` collapses every animation on the page, wherever it was
 * declared, which leaves the mouth simply present and the Z simply still.
 */
const SLEEP_KEYFRAMES = `
/*
 * The snore: a small oval opening and relaxing, never closing all the way.
 *
 * Both axes move, but not equally — a mouth opens taller than it does wider,
 * and scaling only the height reads as a shape being stretched rather than a
 * mouth opening. It bottoms out at 0.66 of the drawn height rather than at
 * nothing: an oval that collapses to a line flickers at this size, and a robot
 * whose mouth vanishes twice a cycle looks broken rather than asleep.
 *
 * Timed to fall roughly with the Z's without being locked to them — it opens
 * around a third of the way in, holds, and has relaxed by the time a Z is
 * drifting away. Two independent cycles that drift past each other read as
 * organic; two synchronised ones read as a mechanism, and syncing them would
 * cost a timer neither of them currently needs.
 */
@keyframes orbi-snore {
  0%, 100% { transform: scale(0.96, 0.66); opacity: 0.72; }
  34% { transform: scale(1.12, 1.30); opacity: 0.94; }
  52% { transform: scale(1.08, 1.18); opacity: 0.9; }
  80% { transform: scale(0.96, 0.66); opacity: 0.72; }
}
.orbi-snore { animation: orbi-snore 3.6s ease-in-out infinite; }

@keyframes orbi-sleep-z {
  0% { opacity: 0; transform: translate(0, 0) scale(0.7); }
  12% { opacity: 0.92; }
  40% { opacity: 0.78; }
  60%, 100% {
    opacity: 0;
    transform: translate(var(--orbi-z-drift, 6px), var(--orbi-z-rise, -20px)) scale(1.05);
  }
}
.orbi-sleep-z {
  animation-name: orbi-sleep-z;
  animation-timing-function: cubic-bezier(0.33, 0.7, 0.4, 1);
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}
`

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

  const rise = quiet ? ORBI_SLEEP.riseMobile : ORBI_SLEEP.riseDesktop
  const drift = (quiet ? ORBI_SLEEP.driftMobile : ORBI_SLEEP.driftDesktop) *
    (side === 'left' ? -1 : 1)
  // One glyph on a phone, and one when motion is reduced — where it does not
  // float, so a second would just be clutter. Two is the maximum anywhere, and
  // the stagger means only ever one of them is in the air.
  const glyphs =
    quiet || reducedMotion
      ? [ORBI_SLEEP.glyphSmall]
      : [ORBI_SLEEP.glyphSmall, ORBI_SLEEP.glyphLarge]
  const gap = quiet ? ORBI_SLEEP.particleGapMobileMs : ORBI_SLEEP.particleGapMs

  // The keyframes stay mounted; only the glyphs come and go.
  if (!active && !lingering) return <style>{SLEEP_KEYFRAMES}</style>

  return (
    <>
    <style>{SLEEP_KEYFRAMES}</style>
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
            animationDuration: `${(ORBI_SLEEP.particleDurationMs + gap) / 1000}s`,
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
    </>
  )
}
