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
        transform: `translate(${pose.dx}px, ${pose.dy}px) scale(${pose.scaleX}, ${pose.scaleY})`,
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
  gazeRef,
}: {
  expression: OrbiExpression
  /** Eyes are dark until the entrance timeline switches them on. */
  awake: boolean
  /** Lifts the eye glow — the excited beat on the work section. */
  bright?: boolean
  /** Deep inactivity: the lids come all the way down. */
  dozing?: boolean
  /** Handed to `orbiGaze`, which owns this group's transform. */
  gazeRef?: RefObject<SVGGElement | null>
}) {
  const posed = eyePoses(expression)
  const left = dozing ? DOZE_POSE : posed[0]
  const right = dozing ? DOZE_POSE : posed[1]

  const isHappy = expression === 'happy' && !dozing
  const isSurprised = expression === 'surprised'
  const isSleepy = expression === 'sleepy' || dozing
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
            : dozing
              ? 'brightness(0.62)'
              : 'brightness(1)',
          transition: GAZE_FILTER_TRANSITION,
        }}
      >
        {/* Pupils */}
        <g transform={`translate(${eyeLeft.x} ${eyeLeft.y})`}>
          <Eye pose={left} dozing={dozing} />
        </g>
        <g transform={`translate(${eyeRight.x} ${eyeRight.y})`}>
          <Eye pose={right} dozing={dozing} />
        </g>

        {/* Happy arcs. The pupils clear out fast and the arcs arrive just
            behind them, so the two never read as a double image. */}
        <g
          style={{
            opacity: isHappy ? 1 : 0,
            transition: isHappy
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

      {/* Cheek tint — only when happy. */}
      <g style={{ opacity: isHappy ? 0.4 : 0, transition: 'opacity 220ms ease' }}>
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
          style={{ opacity: isSleepy ? 0.28 : 0, transition: 'opacity 300ms ease' }}
        />
      </g>
    </g>
  )
}
