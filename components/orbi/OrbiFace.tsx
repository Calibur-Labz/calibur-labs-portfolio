'use client'

import type { RefObject } from 'react'
import {
  ORBI_ART,
  ORBI_COLORS,
  ORBI_THEME_COLORS,
  type OrbiExpression,
  type OrbiRegionTheme,
} from './orbiConfig'

/**
 * ORBI's face — everything that lives inside the visor, and where most of the
 * personality actually comes from.
 *
 * Two channels, deliberately separate:
 *
 *  - **Expression** is React's. Poses are declarative and CSS transitions do
 *    the interpolation, so an expression can change at any time without
 *    touching a timeline. Under `prefers-reduced-motion` the global reset in
 *    `globals.css` collapses these transitions: expressions snap, but still read.
 *
 *  - **Gaze** is GSAP's. `gazeRef` hands the pupil group to `orbiGaze`, which
 *    drives its transform imperatively. Cursor tracking therefore costs no
 *    renders at all. Nothing here may set `transform` on that group.
 */

/** Normalized −1…1 on each axis; scaled by `ORBI_ART.gazeMax*`. */
export interface OrbiGaze {
  x: number
  y: number
}

export const ORBI_GAZE_CENTER: OrbiGaze = { x: 0, y: 0 }

type EyePose = {
  scaleX: number
  scaleY: number
  dx: number
  dy: number
  opacity: number
  /** Degrees. Only the off-balance faces use it. */
  rotate?: number
}

const OPEN: EyePose = { scaleX: 1, scaleY: 1, dx: 0, dy: 0, opacity: 1 }

/** Left and right can differ — a lopsided squint is what sells "thinking". */
function eyePoses(expression: OrbiExpression): [EyePose, EyePose] {
  switch (expression) {
    case 'blink':
      return [
        { ...OPEN, scaleY: 0.07 },
        { ...OPEN, scaleY: 0.07 },
      ]
    case 'happy':
      // The curved arcs take over; the pupils fade out beneath them.
      return [
        { ...OPEN, opacity: 0 },
        { ...OPEN, opacity: 0 },
      ]
    case 'thinking':
      // Up and aside, lopsided. Pushed further up than it used to be so that
      // `unsure` — which is also lopsided, but level — cannot be mistaken for
      // it at the size ORBI actually renders.
      return [
        { scaleX: 1, scaleY: 0.42, dx: 2.6, dy: -2.4, opacity: 1 },
        { scaleX: 1, scaleY: 0.82, dx: 2.6, dy: -2.4, opacity: 1 },
      ]
    case 'unsure':
      // The opposite lopsidedness to `thinking`: one eye pinched almost shut,
      // the *other* opened wider than normal, and both level rather than
      // raised. Nobody reads this as concentration — it reads as hedging, and
      // the wavering mouth under it says the same thing again.
      return [
        { scaleX: 0.9, scaleY: 0.38, dx: 3, dy: 0.8, opacity: 1 },
        { scaleX: 1.16, scaleY: 1.16, dx: 3, dy: -0.6, opacity: 1 },
      ]
    case 'curious':
      // Both eyes hard over toward whatever caught his attention, opened a
      // little wider, and sitting at slightly different heights — the small
      // asymmetry is what turns "looking" into "interested".
      return [
        { scaleX: 1.06, scaleY: 1.14, dx: 3.4, dy: -1.4, opacity: 1 },
        { scaleX: 0.96, scaleY: 1, dx: 3.4, dy: 0.7, opacity: 1 },
      ]
    case 'excited':
      // The stars take the eyes over completely, the same way the happy arcs
      // do — two shapes in one socket reads as a double image.
      return [
        { ...OPEN, opacity: 0 },
        { ...OPEN, opacity: 0 },
      ]
    case 'shy':
      // Down and away, and markedly uneven: the near lid comes most of the way
      // over while the far eye stays open. `concerned` lowers both lids evenly
      // and looks straight ahead, which is what keeps the two apart.
      return [
        { scaleX: 1, scaleY: 0.3, dx: -3.6, dy: 2.8, opacity: 1 },
        { scaleX: 0.96, scaleY: 0.78, dx: -3.6, dy: 2.4, opacity: 1 },
      ]
    case 'surprised':
      return [
        { scaleX: 1.22, scaleY: 1.22, dx: 0, dy: -1, opacity: 1 },
        { scaleX: 1.22, scaleY: 1.22, dx: 0, dy: -1, opacity: 1 },
      ]
    case 'sleepy':
      // Lids down and the whole eye sitting lower — heavy, not squinting.
      // The shape change has to survive an 88px-wide robot, so it is a big
      // squash rather than a subtle one.
      return [
        { scaleX: 1, scaleY: 0.34, dx: 0, dy: 2.2, opacity: 1 },
        { scaleX: 1, scaleY: 0.34, dx: 0, dy: 2.2, opacity: 1 },
      ]
    case 'concerned':
      // Lids a little down and the eyes sitting slightly low — enough to read
      // as troubled next to `normal`, nowhere near the heavy squash `sleepy`
      // uses. The turned-down mouth below does the rest.
      return [
        { scaleX: 1, scaleY: 0.72, dx: 0, dy: 1.2, opacity: 1 },
        { scaleX: 1, scaleY: 0.72, dx: 0, dy: 1.2, opacity: 1 },
      ]
    case 'dizzy':
      // The spirals do the talking now, so the pupils get out of their way —
      // otherwise a spiral drawn over a filled ellipse is just a smudge. What
      // stays is the drift apart, which is what stops the two spirals reading
      // as a symmetrical pattern.
      return [
        { scaleX: 1, scaleY: 1, dx: -2.2, dy: 1.2, opacity: 0, rotate: -13 },
        { scaleX: 1, scaleY: 1, dx: 2.4, dy: -1, opacity: 0, rotate: 11 },
      ]
    case 'wink':
      // One lid down. ORBI's only knowing face, and the rarest of them.
      return [
        { ...OPEN, scaleY: 0.07 },
        { scaleX: 1.04, scaleY: 0.86, dx: 0, dy: -0.6, opacity: 1 },
      ]
    case 'normal':
    default:
      return [OPEN, OPEN]
  }
}

/**
 * The `soft` face style: rounder, more open, more like a character than a
 * display. Only the faces that differ are listed; the rest keep `eyePoses`.
 * Thinking and curious get big, level, round eyes — the looking is done by
 * where the eyes sit, not by squinting — and the faces that draw their own
 * eyes (excited `> <`, the wink, sleep arcs) clear the pupils out of the way.
 */
function softEyePoses(expression: OrbiExpression): [EyePose, EyePose] | null {
  switch (expression) {
    case 'thinking':
      return [
        { scaleX: 1.04, scaleY: 1.04, dx: 3, dy: -3.2, opacity: 1 },
        { scaleX: 1.1, scaleY: 1.1, dx: 3, dy: -3.2, opacity: 1 },
      ]
    case 'curious':
      return [
        { scaleX: 1.16, scaleY: 1.16, dx: 0, dy: -0.4, opacity: 1 },
        { scaleX: 1.16, scaleY: 1.16, dx: 0, dy: -0.4, opacity: 1 },
      ]
    case 'excited':
      return [
        { ...OPEN, opacity: 0 },
        { ...OPEN, opacity: 0 },
      ]
    case 'wink':
      return [
        { ...OPEN, opacity: 0 },
        { scaleX: 1.08, scaleY: 1.08, dx: 0, dy: -0.4, opacity: 1 },
      ]
    default:
      return null
  }
}

/**
 * A four-point sparkle, centred on an eye.
 *
 * Drawn rather than scaled from a font so it inherits the eye gradient and the
 * eye glow, which is what keeps it looking like ORBI's own eye lighting up
 * rather than like a sticker placed over his face. The concave sides are the
 * whole trick: a convex four-pointed shape reads as a diamond.
 */
function starPath(cx: number, cy: number, r: number): string {
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
 * Two and a bit turns of a spiral, centred on an eye.
 *
 * Sampled as a polyline rather than approximated with arcs — at this size the
 * difference is invisible and the maths is one loop instead of six control
 * points. This is the one eye treatment that is unmistakable at 88px across,
 * which is the whole reason dizzy uses it.
 */
function spiralPath(cx: number, cy: number, r: number): string {
  const turns = 2.35
  const steps = 34
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = t * turns * Math.PI * 2
    const radius = t * r
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `
  }
  return d.trim()
}

/**
 * Slow, heavy, and clearly not a blink — a blink snaps shut in 130ms, this
 * takes most of a second.
 */
const DOZE_POSE: EyePose = { scaleX: 1, scaleY: 0.05, dx: 0, dy: 3, opacity: 1 }

/** Deeply asleep: shut, not nearly shut, and sitting lower still. */
const SLEEP_POSE: EyePose = { scaleX: 0.94, scaleY: 0.02, dx: 0, dy: 4, opacity: 1 }

/**
 * A little overshoot is what makes a pose change feel alive rather than
 * tweened: the eye lands, goes a touch past, and settles.
 */
const SPRING = 'cubic-bezier(0.34, 1.3, 0.64, 1)'

const eyeTransition = (delayMs: number) =>
  `transform 240ms ${SPRING} ${delayMs}ms, opacity 140ms ease ${delayMs}ms`
/**
 * Closing stays quick and never overshoots. A spring on the way down would
 * carry `scaleY` through zero and flip the eye inside out for a frame.
 */
const CLOSE_TRANSITION =
  'transform 110ms cubic-bezier(0.4, 0, 1, 1), opacity 120ms ease'
const DOZE_TRANSITION =
  'transform 900ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms ease'

/** The gaze group's transform belongs to GSAP — only `filter` is animated here. */
const GAZE_FILTER_TRANSITION = 'filter 320ms ease'

/**
 * How every drawn feature (mouths, arcs, stars, `> <`, blush) comes and goes:
 * the outgoing shape shrinks away fast, and the incoming one springs up from
 * its own centre just behind it. That overlap reads as the mouth changing
 * shape rather than as two drawings swapping.
 */
function pop(
  on: boolean,
  opacity: number,
  { delayMs = 0, from = 'scale(0.6, 0.35)' }: { delayMs?: number; from?: string } = {},
) {
  return {
    opacity: on ? opacity : 0,
    transform: on ? 'scale(1)' : from,
    transformBox: 'fill-box' as const,
    transformOrigin: 'center',
    transition: on
      ? `opacity 140ms ease ${delayMs}ms, transform 260ms ${SPRING} ${delayMs}ms`
      : 'opacity 120ms ease, transform 180ms cubic-bezier(0.4, 0, 1, 1)',
  }
}

const FACE_KEYFRAMES = `
@keyframes orbi-spiral-spin { to { transform: rotate(360deg); } }
.orbi-spiral-spin { animation: orbi-spiral-spin 1.5s linear infinite; }

@keyframes orbi-star-twinkle {
  0%, 100% { transform: rotate(-8deg); }
  50% { transform: rotate(8deg); }
}
.orbi-star-twinkle { animation: orbi-star-twinkle 1.3s ease-in-out infinite; }
`

const CENTRED = { transformBox: 'fill-box', transformOrigin: 'center' } as const

function Eye({
  pose,
  dozing,
  delayMs = 0,
}: {
  pose: EyePose
  dozing: boolean
  /** A few ms of lag on one eye stops the pair moving like a single part. */
  delayMs?: number
}) {
  const closing = pose.scaleY < 0.15
  return (
    <g
      style={{
        transform:
          `translate(${pose.dx}px, ${pose.dy}px)` +
          (pose.rotate ? ` rotate(${pose.rotate}deg)` : '') +
          ` scale(${pose.scaleX}, ${pose.scaleY})`,
        transformBox: 'fill-box',
        transformOrigin: 'center',
        opacity: pose.opacity,
        transition: dozing ? DOZE_TRANSITION : closing ? CLOSE_TRANSITION : eyeTransition(delayMs),
      }}
    >
      <ellipse
        cx={0}
        cy={0}
        rx={ORBI_ART.eyeRx}
        ry={ORBI_ART.eyeRy}
        fill="url(#orbi-eye)"
        filter="url(#orbi-eye-glow)"
      />
      {/* Specular catchlight — the single detail that makes the eye read as glass. */}
      <ellipse cx={-2.4} cy={-3.6} rx={2} ry={2.6} fill="#FFFFFF" opacity={0.8} />
    </g>
  )
}

export default function OrbiFace({
  expression,
  awake,
  bright = false,
  dozing = false,
  asleep = false,
  gazeRef,
  theme = 'dark',
  faceStyle = 'classic',
}: {
  /** Light: a pale face screen with deeper blue eyes and mouth. */
  theme?: OrbiRegionTheme
  /**
   * `soft`: rounder, more character-like faces — `> <` when excited, big
   * round eyes when thinking or curious, a `>` wink, closed arcs asleep.
   * `classic` (the default) is every face exactly as it has always been.
   */
  faceStyle?: 'classic' | 'soft'
  expression: OrbiExpression
  /** Eyes are dark until the entrance timeline switches them on. */
  awake: boolean
  /** Lifts the eye glow — the excited beat on the work section. */
  bright?: boolean
  /** Deep inactivity: the lids come all the way down. */
  dozing?: boolean
  /** Longer still: properly asleep, shut, and dimmer than dozing. */
  asleep?: boolean
  /** Handed to `orbiGaze`, which owns this group's transform. */
  gazeRef?: RefObject<SVGGElement | null>
}) {
  const soft = faceStyle === 'soft'
  const posed = (soft && softEyePoses(expression)) || eyePoses(expression)
  // Soft sleep draws its own closed arcs, so the pupils fade rather than squash.
  const shut = soft ? { ...(asleep ? SLEEP_POSE : DOZE_POSE), opacity: 0 } : asleep ? SLEEP_POSE : DOZE_POSE
  const left = dozing || asleep ? shut : posed[0]
  const right = dozing || asleep ? shut : posed[1]

  // Nothing below may fire while ORBI is under; `awake` is a separate concern
  // from `dozing`, and every face has to yield to the sleeping one.
  const up = !dozing && !asleep
  // The knowing face borrows the happy mouth — a wink with a flat mouth reads
  // as a malfunction rather than as mischief.
  const isHappy = (expression === 'happy' || expression === 'wink') && up
  const isExcited = expression === 'excited' && up
  const isSurprised = expression === 'surprised' && up
  const isDizzy = expression === 'dizzy' && up
  const isSleepy = expression === 'sleepy' || dozing || asleep
  const isConcerned = expression === 'concerned' && up
  const isUnsure = expression === 'unsure' && up
  const isThinking = expression === 'thinking' && up
  const isCurious = expression === 'curious' && up
  const isShy = expression === 'shy' && up
  // Whether the resting mouth stays out of the way. Every face that draws its
  // own mouth is listed once, here, so adding another cannot leave two mouths
  // on screen at the same time.
  const mouthTaken =
    isHappy || isExcited || isSurprised || isDizzy || isSleepy ||
    isConcerned || isUnsure || isThinking || isCurious || isShy
  // Blush: pleased, thrilled, or caught being pleased. Strongest when shy,
  // which is the one where the blush *is* the emotion.
  const blush = isShy ? 0.62 : isExcited ? 0.5 : expression === 'happy' && up ? 0.4 : 0
  const { eyeLeft, eyeRight, mouth } = ORBI_ART
  const c = ORBI_THEME_COLORS[theme]

  const dozy = dozing || asleep

  return (
    <g
      style={{
        opacity: awake ? 1 : 0,
        transition: 'opacity 420ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{FACE_KEYFRAMES}</style>
      <defs>
        <linearGradient id="orbi-eye" x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0%" stopColor={c.eyeTop} />
          {c.eyeMid && <stop offset="45%" stopColor={c.eyeMid} />}
          <stop offset="100%" stopColor={c.eyeBottom} />
        </linearGradient>
        {/* Light: a soft two-layer glow tinted with `glow`. Dark: the original
            blur of the eye's own colour. Same id, so every user follows. */}
        {c.glow ? (
          <filter id="orbi-eye-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="near" />
            <feFlood floodColor={c.glow} floodOpacity="0.35" />
            <feComposite in2="near" operator="in" result="nearGlow" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="5.6" result="far" />
            <feFlood floodColor={c.glow} floodOpacity="0.18" />
            <feComposite in2="far" operator="in" result="farGlow" />
            <feMerge>
              <feMergeNode in="farGlow" />
              <feMergeNode in="nearGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ) : (
          <filter id="orbi-eye-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Everything that follows ORBI's gaze travels together. GSAP owns the
          transform on this node — do not set one here. */}
      <g
        ref={gazeRef}
        style={{
          // Dimmed while dozing, lifted on the excited beat.
          filter: bright
            ? 'brightness(1.5)'
            : asleep
              ? 'brightness(0.45)'
              : dozing
                ? 'brightness(0.62)'
                : 'brightness(1)',
          transition: GAZE_FILTER_TRANSITION,
        }}
      >
        {/* Pupils */}
        <g transform={`translate(${eyeLeft.x} ${eyeLeft.y})`}>
          <Eye pose={left} dozing={dozy} />
        </g>
        <g transform={`translate(${eyeRight.x} ${eyeRight.y})`}>
          <Eye pose={right} dozing={dozy} delayMs={dozy ? 0 : 15} />
        </g>

        {/* Happy arcs. The pupils clear out fast and the arcs arrive just
            behind them, so the two never read as a double image. */}
        <g>
          {[eyeLeft, eyeRight].map((eye, i) => (
            <path
              key={eye.x}
              d={`M ${eye.x - 8} ${eye.y + 3} Q ${eye.x} ${eye.y - 8} ${eye.x + 8} ${eye.y + 3}`}
              fill="none"
              stroke="url(#orbi-eye)"
              strokeWidth={3.6}
              strokeLinecap="round"
              filter="url(#orbi-eye-glow)"
              style={pop(expression === 'happy' && up, 1, { delayMs: 20 + i * 15, from: 'scale(0.8, 0.2)' })}
            />
          ))}
        </g>

        {/*
          Excited: star eyes.

          The one treatment that makes excited unmistakably *more* than happy
          without asking the body to shout. Filled with the same eye gradient
          and carrying the same glow, so it reads as ORBI's eyes catching
          light rather than as decoration laid on top of them.
        */}
        <g>
          {[eyeLeft, eyeRight].map((eye, i) => (
            <g
              key={eye.x}
              style={pop(isExcited && !soft, 1, { delayMs: 20 + i * 15, from: 'scale(0.2) rotate(-90deg)' })}
            >
              <path
                className={isExcited && !soft ? 'orbi-star-twinkle' : undefined}
                d={starPath(eye.x, eye.y, 11)}
                fill="url(#orbi-eye)"
                filter="url(#orbi-eye-glow)"
                style={{ ...CENTRED, animationDelay: `${i * -0.45}s` }}
              />
            </g>
          ))}
        </g>

        {soft && (
          <>
            {/* Soft excited: eyes squeezed shut with delight — `>  <`. */}
            <g
              fill="none"
              stroke="url(#orbi-eye)"
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#orbi-eye-glow)"
            >
              <path
                d={`M ${eyeLeft.x - 6} ${eyeLeft.y - 6.5} L ${eyeLeft.x + 5} ${eyeLeft.y} L ${eyeLeft.x - 6} ${eyeLeft.y + 6.5}`}
                style={pop(isExcited, 1, { delayMs: 20, from: 'scale(0.3, 1.2)' })}
              />
              <path
                d={`M ${eyeRight.x + 6} ${eyeRight.y - 6.5} L ${eyeRight.x - 5} ${eyeRight.y} L ${eyeRight.x + 6} ${eyeRight.y + 6.5}`}
                style={pop(isExcited, 1, { delayMs: 35, from: 'scale(0.3, 1.2)' })}
              />
            </g>
            {/* Soft wink: the closed eye as a `>`. */}
            <path
              d={`M ${eyeLeft.x - 5.5} ${eyeLeft.y - 5.5} L ${eyeLeft.x + 4.5} ${eyeLeft.y} L ${eyeLeft.x - 5.5} ${eyeLeft.y + 5.5}`}
              fill="none"
              stroke="url(#orbi-eye)"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#orbi-eye-glow)"
              style={pop(expression === 'wink' && up, 1, { from: 'scale(0.3, 1.2)' })}
            />
            {/* Soft sleep: closed, contented arcs — the eyes of someone dreaming. */}
            <g
              fill="none"
              stroke="url(#orbi-eye)"
              strokeWidth={2.8}
              strokeLinecap="round"
              filter="url(#orbi-eye-glow)"
              style={{ opacity: dozing || asleep ? 0.9 : 0, transition: 'opacity 600ms ease' }}
            >
              {[eyeLeft, eyeRight].map((eye) => (
                <path key={eye.x} d={`M ${eye.x - 7.5} ${eye.y + 1} Q ${eye.x} ${eye.y + 7} ${eye.x + 7.5} ${eye.y + 1}`} />
              ))}
            </g>
          </>
        )}

        {/*
          Dizzy: spirals where the pupils were.

          Stroked, not filled, because a filled spiral is a disc. The two turn
          in opposite directions — a matched pair reads as a pattern, and a
          mismatched pair reads as a robot that cannot focus.
        */}
        <g
          style={{
            opacity: isDizzy ? 0.95 : 0,
            transition: isDizzy
              ? 'opacity 180ms ease 50ms'
              : 'opacity 120ms ease',
          }}
        >
          {[
            { eye: eyeLeft, flip: 1 },
            { eye: eyeRight, flip: -1 },
          ].map(({ eye, flip }) => (
            <g key={eye.x} transform={`translate(${eye.x} ${eye.y}) scale(${flip} 1)`}>
              <g className={isDizzy ? 'orbi-spiral-spin' : undefined} style={CENTRED}>
                {/* Invisible, but it centres the box the spin turns about. */}
                <circle r={9.6} fill="none" />
                <path
                  d={spiralPath(0, 0, 9.5)}
                  fill="none"
                  stroke="url(#orbi-eye)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  filter="url(#orbi-eye-glow)"
                />
              </g>
            </g>
          ))}
        </g>
      </g>

      {/*
        Cheek tint. Never on a wink — a wink is knowing, not flustered.

        Shared by the three faces that need colour in them: pleased, thrilled,
        and caught. Strongest on `shy`, where the blush is not a garnish on the
        emotion but most of what the emotion *is*.
      */}
      <g style={pop(blush > 0, blush, { delayMs: 40, from: 'scale(0.5)' })}>
        <ellipse cx={eyeLeft.x - 11} cy={eyeLeft.y + 15} rx={5.5} ry={3} fill={ORBI_COLORS.accent} />
        <ellipse cx={eyeRight.x + 11} cy={eyeRight.y + 15} rx={5.5} ry={3} fill={ORBI_COLORS.accent} />
      </g>

      {/* Mouth — fixed shapes cross-faded, so no path morphing is needed. */}
      <g fill="none" stroke={c.mouth} strokeLinecap="round">
        <path
          d={`M ${mouth.x - 8} ${mouth.y} Q ${mouth.x} ${mouth.y + 3.5} ${mouth.x + 8} ${mouth.y}`}
          strokeWidth={2.2}
          style={pop(!mouthTaken, 0.32)}
        />
        <path
          d={`M ${mouth.x - 9} ${mouth.y - 3} Q ${mouth.x} ${mouth.y + 7} ${mouth.x + 9} ${mouth.y - 3}`}
          strokeWidth={2.6}
          style={pop(isHappy, 0.85)}
        />
        {/*
          Excited: the happy smile, wider and deeper.

          Same shape language on purpose — excited is *more* of the same
          feeling, not a different one — but big enough that the two are never
          in doubt when they play a second apart.
        */}
        <path
          d={`M ${mouth.x - 11} ${mouth.y - 4} Q ${mouth.x} ${mouth.y + 11} ${mouth.x + 11} ${mouth.y - 4}`}
          strokeWidth={3}
          style={pop(isExcited, 0.95)}
        />
        {/* Surprised: a round, open O. */}
        <ellipse
          cx={mouth.x}
          cy={mouth.y + 1}
          rx={3.4}
          ry={4.2}
          strokeWidth={2.2}
          style={pop(isSurprised, 0.75)}
        />
        {/*
          Dizzy: a small open mouth pulled off centre.

          Not the surprised O — the two used to share it, and sharing a mouth
          is exactly how "startled" and "spun round five times" ended up
          looking alike. Narrower, lower, and off to one side.
        */}
        <ellipse
          cx={mouth.x + 2.2}
          cy={mouth.y + 2}
          rx={2.6}
          ry={3.4}
          strokeWidth={2}
          style={pop(isDizzy, 0.7)}
        />
        {/*
          Thinking: a short line, off centre and slightly tipped.

          The smallest mouth ORBI has. Concentration is not an expression you
          make with your mouth, so this only has to be *not* the resting curve
          — enough that thinking never looks like normal with the eyes moved.
        */}
        <path
          d={`M ${mouth.x - 6.5} ${mouth.y + 1.6} L ${mouth.x + 2.5} ${mouth.y - 0.4}`}
          strokeWidth={2.2}
          style={pop(isThinking && !soft, 0.42)}
        />
        {/* Soft thinking and curious: a small, puzzled frown, set a little aside. */}
        {soft && (
          <path
            d={`M ${mouth.x - 3} ${mouth.y + 2} Q ${mouth.x + 1} ${mouth.y - 2.2} ${mouth.x + 5} ${mouth.y + 2}`}
            strokeWidth={2.4}
            style={pop(isThinking || isCurious, 0.75)}
          />
        )}
        {/* Soft sleep: a small, content smile instead of the open mouth. */}
        {soft && (
          <path
            d={`M ${mouth.x - 4} ${mouth.y} Q ${mouth.x} ${mouth.y + 3.2} ${mouth.x + 4} ${mouth.y}`}
            strokeWidth={2.2}
            style={pop(dozing || asleep, 0.6)}
          />
        )}
        {/*
          Unsure: a wavering line.

          One shallow rise and one shallow fall — the shape a mouth makes when
          the answer is "well…". Deliberately nothing like `concerned`'s smooth
          frown: that one is sorry, this one is hedging, and the pair have to
          be told apart at a glance.
        */}
        <path
          d={
            `M ${mouth.x - 8} ${mouth.y + 1} ` +
            `Q ${mouth.x - 4} ${mouth.y - 3} ${mouth.x} ${mouth.y + 0.6} ` +
            `Q ${mouth.x + 4} ${mouth.y + 4} ${mouth.x + 8} ${mouth.y}`
          }
          strokeWidth={2.2}
          style={pop(isUnsure, 0.7)}
        />
        {/*
          Curious: the resting curve, lifted at the end he is looking toward.
          A question in the shape of a mouth, without being a smile.
        */}
        <path
          d={`M ${mouth.x - 7} ${mouth.y + 1.5} Q ${mouth.x - 1} ${mouth.y + 4} ${mouth.x + 7.5} ${mouth.y - 2}`}
          strokeWidth={2.2}
          style={pop(isCurious && !soft, 0.5)}
        />
        {/*
          Shy: a small smile, narrow and pushed away from the side he is
          hiding toward. Pleased, but not willing to show it.
        */}
        <path
          d={`M ${mouth.x - 2} ${mouth.y} Q ${mouth.x + 2.5} ${mouth.y + 4.5} ${mouth.x + 7} ${mouth.y - 0.5}`}
          strokeWidth={2.4}
          style={pop(isShy, 0.7)}
        />
        {/*
          Concerned: the resting curve turned over.

          Deliberately the *same* path as the neutral mouth with the control
          point flipped — same width, same weight, same position — so it reads
          as ORBI's own mouth doing something different rather than as a second
          mouth appearing. Shallower than the happy curve is deep, because a
          frown that matches a smile's amplitude reads as misery.
        */}
        <path
          d={`M ${mouth.x - 8} ${mouth.y + 1.5} Q ${mouth.x} ${mouth.y - 2.5} ${mouth.x + 8} ${mouth.y + 1.5}`}
          strokeWidth={2.2}
          style={pop(isConcerned, 0.7)}
        />

        {/* Sleepy: a short flat line, softer than the resting smile. */}
        <path
          d={`M ${mouth.x - 5} ${mouth.y + 1} L ${mouth.x + 5} ${mouth.y + 1}`}
          strokeWidth={2}
          // Once he is properly under, the flat line hands over to the
          // sleeping mouth below.
          style={pop(isSleepy && !asleep && !(soft && dozing), 0.28, { from: 'scale(0.5, 1)' })}
        />

        {/*
          Deep sleep only: a small oval, slightly open, that breathes.

          It used to be an upward curve — ᴗ — and that was simply wrong. Paired
          with two shut eyes a curve does not read as a sleeping robot, it
          reads as a *smiling* one: the same shape the happy face uses, only
          smaller. A mouth left a little open says asleep on its own, and says
          it instantly.

          Filled rather than stroked, which is what makes it survive being this
          small: an outline three pixels tall is a smudge, and a non-uniform
          scale would thicken that outline vertically as it breathes. The eyes
          are filled shapes too, so this stays inside the face's own vocabulary
          — and it is dimmer than they are, because a mouth that outshines the
          eyes stops being a mouth.

          The snore is a CSS animation on this one node, not a timeline and not
          a state machine: three and a half seconds of open-a-little, hold,
          relax, forever, owned entirely by the stylesheet. It costs no timer,
          no render and no frame budget, and a background tab stops compositing
          it on its own. `prefers-reduced-motion` disables it through the global
          reset in `globals.css`, which leaves the oval simply *there* — which
          is why the drawn size is the middle of the breath rather than either
          end of it: the still version still has to look like an open mouth.
        */}
        <ellipse
          className={asleep ? 'orbi-snore' : undefined}
          cx={mouth.x}
          cy={mouth.y + 1}
          rx={ORBI_ART.sleepMouthRx}
          ry={ORBI_ART.sleepMouthRy}
          fill={c.mouth}
          stroke="none"
          style={{
            opacity: asleep && !soft ? 0.82 : 0,
            transition: 'opacity 420ms ease',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
      </g>
    </g>
  )
}
