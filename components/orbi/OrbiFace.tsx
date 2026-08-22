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
      return [
        { scaleX: 1, scaleY: 0.45, dx: 2.5, dy: -1.5, opacity: 1 },
        { scaleX: 1, scaleY: 0.8, dx: 2.5, dy: -1.5, opacity: 1 },
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
    case 'dizzy':
      // Off balance, not cartoon: the lids sit at different heights, each eye
      // is tipped a few degrees the wrong way, and the pupils drift apart.
      // Still unmistakably ORBI — just not quite level.
      return [
        { scaleX: 1.06, scaleY: 0.6, dx: -2.4, dy: 1.5, opacity: 1, rotate: -13 },
        { scaleX: 0.92, scaleY: 0.92, dx: 2.6, dy: -1.2, opacity: 1, rotate: 11 },
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

  // The knowing face borrows the happy mouth — a wink with a flat mouth reads
  // as a malfunction rather than as mischief.
  const isHappy = (expression === 'happy' || expression === 'wink') && !dozing && !asleep
  const isSurprised = expression === 'surprised' || expression === 'dizzy'
  const isSleepy = expression === 'sleepy' || dozing || asleep
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
      </g>

      {/* Cheek tint — only when properly happy, never on a wink. */}
      <g
        style={{
          opacity: expression === 'happy' && !dozing && !asleep ? 0.4 : 0,
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
            opacity: isHappy || isSurprised || isSleepy ? 0 : 0.32,
            transition: 'opacity 200ms ease',
          }}
        />
        <path
          d={`M ${mouth.x - 9} ${mouth.y - 3} Q ${mouth.x} ${mouth.y + 7} ${mouth.x + 9} ${mouth.y - 3}`}
          strokeWidth={2.6}
          style={{ opacity: isHappy ? 0.85 : 0, transition: 'opacity 200ms ease' }}
        />
        <ellipse
          cx={mouth.x}
          cy={mouth.y + 1}
          rx={3.4}
          ry={4.2}
          strokeWidth={2.2}
          style={{ opacity: isSurprised ? 0.75 : 0, transition: 'opacity 200ms ease' }}
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
          Deep sleep only: a small upward curve — ᴗ — that breathes.

          The snore is a CSS animation on this one node, not a timeline and not
          a state machine: three and a half seconds of open-a-little, pause,
          close, forever, owned entirely by the stylesheet. It costs no timer,
          no render and no frame budget, and a background tab stops compositing
          it on its own. `prefers-reduced-motion` disables it through the global
          reset in `globals.css`, which leaves the mouth simply *there* — which
          is exactly what that mode should get.
        */}
        <path
          className={asleep ? 'orbi-snore' : undefined}
          d={`M ${mouth.x - 7} ${mouth.y - 1} Q ${mouth.x} ${mouth.y + 8} ${mouth.x + 7} ${mouth.y - 1}`}
          strokeWidth={2.6}
          style={{
            opacity: asleep ? 0.9 : 0,
            transition: 'opacity 420ms ease',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
      </g>
    </g>
  )
}
