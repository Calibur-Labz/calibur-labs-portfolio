'use client'

import type { RefObject } from 'react'
import { ORBI_ART, ORBI_COLORS, type OrbiExpression } from './orbiConfig'

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

const EYE_TRANSITION =
  'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease'
const DOZE_TRANSITION =
  'transform 900ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms ease'

/** The gaze group's transform belongs to GSAP — only `filter` is animated here. */
const GAZE_FILTER_TRANSITION = 'filter 320ms ease'

function Eye({ pose, dozing }: { pose: EyePose; dozing: boolean }) {
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
        transition: dozing ? DOZE_TRANSITION : EYE_TRANSITION,
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
}: {
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
  const posed = eyePoses(expression)
  const shut = asleep ? SLEEP_POSE : DOZE_POSE
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

  return (
    <g
      style={{
        opacity: awake ? 1 : 0,
        transition: 'opacity 420ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <defs>
        <linearGradient id="orbi-eye" x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0%" stopColor={ORBI_COLORS.accentSoft} />
          <stop offset="100%" stopColor={ORBI_COLORS.accent} />
        </linearGradient>
        <filter id="orbi-eye-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
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
          <Eye pose={left} dozing={dozing || asleep} />
        </g>
        <g transform={`translate(${eyeRight.x} ${eyeRight.y})`}>
          <Eye pose={right} dozing={dozing || asleep} />
        </g>

        {/* Happy arcs. The pupils clear out fast and the arcs arrive just
            behind them, so the two never read as a double image. */}
        <g
          style={{
            opacity: expression === 'happy' && !dozing && !asleep ? 1 : 0,
            transition:
              expression === 'happy'
                ? 'opacity 190ms ease 60ms'
                : 'opacity 120ms ease',
          }}
        >
          {[eyeLeft, eyeRight].map((eye) => (
            <path
              key={eye.x}
              d={`M ${eye.x - 8} ${eye.y + 3} Q ${eye.x} ${eye.y - 8} ${eye.x + 8} ${eye.y + 3}`}
              fill="none"
              stroke="url(#orbi-eye)"
              strokeWidth={3.6}
              strokeLinecap="round"
              filter="url(#orbi-eye-glow)"
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
        <g
          style={{
            opacity: isExcited ? 1 : 0,
            transition: isExcited
              ? 'opacity 180ms ease 50ms'
              : 'opacity 120ms ease',
          }}
        >
          {[eyeLeft, eyeRight].map((eye) => (
            <path
              key={eye.x}
              d={starPath(eye.x, eye.y, 11)}
              fill="url(#orbi-eye)"
              filter="url(#orbi-eye-glow)"
            />
          ))}
        </g>

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
              <path
                d={spiralPath(0, 0, 9.5)}
                fill="none"
                stroke="url(#orbi-eye)"
                strokeWidth={2}
                strokeLinecap="round"
                filter="url(#orbi-eye-glow)"
              />
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
      <g
        style={{
          opacity: blush,
          transition: 'opacity 220ms ease',
        }}
      >
        <ellipse cx={eyeLeft.x - 11} cy={eyeLeft.y + 15} rx={5.5} ry={3} fill={ORBI_COLORS.accent} />
        <ellipse cx={eyeRight.x + 11} cy={eyeRight.y + 15} rx={5.5} ry={3} fill={ORBI_COLORS.accent} />
      </g>

      {/* Mouth — fixed shapes cross-faded, so no path morphing is needed. */}
      <g fill="none" stroke={ORBI_COLORS.accentSoft} strokeLinecap="round">
        <path
          d={`M ${mouth.x - 8} ${mouth.y} Q ${mouth.x} ${mouth.y + 3.5} ${mouth.x + 8} ${mouth.y}`}
          strokeWidth={2.2}
          style={{
            opacity: mouthTaken ? 0 : 0.32,
            transition: 'opacity 200ms ease',
          }}
        />
        <path
          d={`M ${mouth.x - 9} ${mouth.y - 3} Q ${mouth.x} ${mouth.y + 7} ${mouth.x + 9} ${mouth.y - 3}`}
          strokeWidth={2.6}
          style={{ opacity: isHappy ? 0.85 : 0, transition: 'opacity 200ms ease' }}
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
          style={{ opacity: isExcited ? 0.95 : 0, transition: 'opacity 200ms ease' }}
        />
        {/* Surprised: a round, open O. */}
        <ellipse
          cx={mouth.x}
          cy={mouth.y + 1}
          rx={3.4}
          ry={4.2}
          strokeWidth={2.2}
          style={{ opacity: isSurprised ? 0.75 : 0, transition: 'opacity 200ms ease' }}
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
          style={{ opacity: isDizzy ? 0.7 : 0, transition: 'opacity 200ms ease' }}
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
          style={{ opacity: isThinking ? 0.42 : 0, transition: 'opacity 200ms ease' }}
        />
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
          style={{ opacity: isUnsure ? 0.7 : 0, transition: 'opacity 200ms ease' }}
        />
        {/*
          Curious: the resting curve, lifted at the end he is looking toward.
          A question in the shape of a mouth, without being a smile.
        */}
        <path
          d={`M ${mouth.x - 7} ${mouth.y + 1.5} Q ${mouth.x - 1} ${mouth.y + 4} ${mouth.x + 7.5} ${mouth.y - 2}`}
          strokeWidth={2.2}
          style={{ opacity: isCurious ? 0.5 : 0, transition: 'opacity 200ms ease' }}
        />
        {/*
          Shy: a small smile, narrow and pushed away from the side he is
          hiding toward. Pleased, but not willing to show it.
        */}
        <path
          d={`M ${mouth.x - 2} ${mouth.y} Q ${mouth.x + 2.5} ${mouth.y + 4.5} ${mouth.x + 7} ${mouth.y - 0.5}`}
          strokeWidth={2.4}
          style={{ opacity: isShy ? 0.7 : 0, transition: 'opacity 200ms ease' }}
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
          style={{ opacity: isConcerned ? 0.7 : 0, transition: 'opacity 200ms ease' }}
        />

        {/* Sleepy: a short flat line, softer than the resting smile. */}
        <path
          d={`M ${mouth.x - 5} ${mouth.y + 1} L ${mouth.x + 5} ${mouth.y + 1}`}
          strokeWidth={2}
          style={{
            // Once he is properly under, the flat line hands over to the
            // sleeping mouth below.
            opacity: isSleepy && !asleep ? 0.28 : 0,
            transition: 'opacity 300ms ease',
          }}
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
          fill={ORBI_COLORS.accentSoft}
          stroke="none"
          style={{
            opacity: asleep ? 0.82 : 0,
            transition: 'opacity 420ms ease',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
      </g>
    </g>
  )
}
