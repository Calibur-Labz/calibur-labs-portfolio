'use client'

import { ORBI_COLORS, type OrbiExpression } from './orbiConfig'

/**
 * ORBI — the three small marks that live *around* his head.
 *
 * A question mark when he does not know, sparks when he is thrilled, and stars
 * circling him when he has been spun once too often. Nothing else: the brief
 * is explicit that normal, thinking, curious, happy, shy and concerned have to
 * be readable from ORBI himself, and a companion who annotates his own face is
 * a companion nobody believes.
 *
 * Deliberately *not* a particle system, and deliberately not a new layer in the
 * DOM either — these are SVG nodes drawn inside ORBI's own viewBox, which buys
 * three things for free: they scale with him at every breakpoint, they travel
 * with every dock and tilt and flight without being told to, and they can never
 * shift layout because there is no layout to shift.
 *
 * They exist only while the emotion does. Nothing is pooled, nothing is
 * spawned, and when the expression changes React unmounts the whole group —
 * which is the entire cleanup story, and the reason a stale symbol cannot
 * outlive the feeling that drew it.
 *
 * The keyframes travel with the component rather than living in the
 * application stylesheet, for the same reason `OrbiSleepParticles` does it:
 * ORBI is a drop-in, and an animation of his that depends on the host's CSS is
 * an invisible coupling that fails silently. `prefers-reduced-motion` still
 * turns them off — the global reset collapses every animation on the page
 * wherever it was declared — which leaves each mark simply *present*. That is
 * why every one of them is drawn at rest rather than at the start of its
 * animation: the still version is the version a reduced-motion visitor sees,
 * and it still has to say what it means.
 */

const ACCENT_KEYFRAMES = `
/*
 * A spark arriving: a quick pop out to full size, then a slow settle. Three of
 * them share this with different delays, so they read as a small burst rather
 * than as three things switched on at once.
 */
@keyframes orbi-accent-spark {
  0% { opacity: 0; transform: scale(0.3) rotate(-25deg); }
  45% { opacity: 1; transform: scale(1.15) rotate(6deg); }
  100% { opacity: 0.85; transform: scale(1) rotate(0deg); }
}
.orbi-accent-spark {
  animation: orbi-accent-spark 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
  transform-box: fill-box;
  transform-origin: center;
}

/*
 * The question mark leaning in, once. It does not loop — a symbol that pulses
 * forever stops being punctuation and starts being an alarm.
 */
@keyframes orbi-accent-query {
  0% { opacity: 0; transform: translateY(4px) rotate(-12deg) scale(0.7); }
  60% { opacity: 1; transform: translateY(-1px) rotate(5deg) scale(1.06); }
  100% { opacity: 0.9; transform: translateY(0) rotate(0deg) scale(1); }
}
.orbi-accent-query {
  animation: orbi-accent-query 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
  transform-box: fill-box;
  transform-origin: center bottom;
}

/*
 * Dizzy: the stars sweep back and forth across the top of his head rather than
 * orbiting all the way round. A full orbit would carry them through his body
 * and out the other side, which reads as a bug; a sweep reads as the room
 * still moving.
 */
@keyframes orbi-accent-orbit {
  0%, 100% { transform: rotate(-16deg); }
  50% { transform: rotate(16deg); }
}
.orbi-accent-orbit {
  animation: orbi-accent-orbit 1.9s ease-in-out infinite;
  transform-origin: 85px 52px;
}
`

/** A four-point sparkle. Concave sides — a convex one reads as a diamond. */
function spark(cx: number, cy: number, r: number): string {
  const w = r * 0.3
  return (
    `M ${cx} ${cy - r} ` +
    `Q ${cx + w} ${cy - w} ${cx + r} ${cy} ` +
    `Q ${cx + w} ${cy + w} ${cx} ${cy + r} ` +
    `Q ${cx - w} ${cy + w} ${cx - r} ${cy} ` +
    `Q ${cx - w} ${cy - w} ${cx} ${cy - r} Z`
  )
}

/**
 * Where each mark sits, in ORBI's own 170 × 152 viewBox.
 *
 * Chosen against the drawing rather than by eye: the antenna stem runs up the
 * centre from y 32 to the bulb at (85, 13), the shell tops out around y 32, and
 * the right-hand third of the box is the reserve a raised arm swings through.
 * Everything here stays above the shell and clear of the bulb.
 */
const SPARKS = [
  { x: 44, y: 30, r: 5.2, delay: 0 },
  { x: 126, y: 25, r: 4.4, delay: 90 },
  { x: 110, y: 11, r: 3.2, delay: 180 },
] as const

const ORBIT_STARS = [
  { x: 52, y: 24, r: 3.6 },
  { x: 85, y: 8, r: 3 },
  { x: 118, y: 24, r: 3.6 },
] as const

export default function OrbiEmotionAccents({
  expression,
  awake,
}: {
  expression: OrbiExpression
  /** Nothing is drawn around a robot whose face has not switched on yet. */
  awake: boolean
}) {
  const showQuery = awake && expression === 'unsure'
  const showSparks = awake && expression === 'excited'
  const showOrbit = awake && expression === 'dizzy'

  // The common case, by a very long way: ORBI is wearing one of the faces that
  // needs no annotation, and this renders nothing at all.
  if (!showQuery && !showSparks && !showOrbit) return null

  return (
    <g
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
      /*
        Purely decorative, and the conversation already says all of this in
        words: the Ask panel writes "Thinking…" while a request is in flight and
        prints the answer when it lands. A screen reader announcing "ORBI is
        unsure" on top of that would be a second, worse copy of information the
        visitor already has.
      */
    >
      <style>{ACCENT_KEYFRAMES}</style>

      {showQuery && (
        <g className="orbi-accent-query">
          {/*
            Drawn as a path rather than as text, so it needs no font to be
            loaded, cannot be selected, and takes the same cyan and the same
            round caps as everything else ORBI is made of.
          */}
          <g transform="translate(129 27) scale(1.35)">
            <path
              d="M -4 -6 Q -4 -10.2 0 -10.2 Q 4.2 -10.2 4.2 -6.4 Q 4.2 -3.2 0.6 -1.6 Q 0 -1.2 0 0.9"
              fill="none"
              stroke={ORBI_COLORS.accent}
              strokeWidth={2.4}
              strokeLinecap="round"
              filter="url(#orbi-eye-glow)"
            />
            <circle cx={0} cy={4.6} r={1.5} fill={ORBI_COLORS.accent} filter="url(#orbi-eye-glow)" />
          </g>
        </g>
      )}

      {showSparks &&
        SPARKS.map((s) => (
          <path
            key={s.x}
            className="orbi-accent-spark"
            style={{ animationDelay: `${s.delay}ms` }}
            d={spark(s.x, s.y, s.r)}
            fill={ORBI_COLORS.accentSoft}
            filter="url(#orbi-eye-glow)"
          />
        ))}

      {showOrbit && (
        <g className="orbi-accent-orbit">
          {ORBIT_STARS.map((s) => (
            <path
              key={s.x}
              d={spark(s.x, s.y, s.r)}
              fill={ORBI_COLORS.accent}
              opacity={0.85}
              filter="url(#orbi-eye-glow)"
            />
          ))}
        </g>
      )}
    </g>
  )
}
