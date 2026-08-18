'use client'

import { ORBI_ART, ORBI_COLORS, type OrbiExpression } from './orbiConfig'

/**
 * ORBI's face — everything that lives inside the visor.
 *
 * Pure presentation: it maps an expression onto eye/mouth poses and lets CSS
 * transitions do the interpolation. No GSAP here, so expression changes stay
 * cheap and can fire at any time without touching a timeline. Under
 * `prefers-reduced-motion` the global reset in `globals.css` collapses these
 * transitions, so expressions snap instantly but still work.
 *
 * `gaze` is where ORBI's scroll awareness lands. Looking is done here, with
 * the pupils, rather than by swinging the body around — the body only ever
 * contributes a few degrees of shoulder (see `applyLookTilt`).
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
    case 'normal':
    default:
      return [OPEN, OPEN]
  }
}

const EYE_TRANSITION =
  'transform 190ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease'

/** Glances are slower than blinks — a drift, not a snap. */
const GAZE_TRANSITION =
  'transform 420ms cubic-bezier(0.16, 1, 0.3, 1), filter 300ms ease'

const clampGaze = (v: number) => Math.max(-1, Math.min(1, v))

function Eye({ pose }: { pose: EyePose }) {
  return (
    <g
      style={{
        transform: `translate(${pose.dx}px, ${pose.dy}px) scale(${pose.scaleX}, ${pose.scaleY})`,
        transformBox: 'fill-box',
        transformOrigin: 'center',
        opacity: pose.opacity,
        transition: EYE_TRANSITION,
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
  gaze = ORBI_GAZE_CENTER,
  bright = false,
}: {
  expression: OrbiExpression
  /** Eyes are dark until the entrance timeline switches them on. */
  awake: boolean
  /** Where ORBI is looking. Drives the pupils only. */
  gaze?: OrbiGaze
  /** Lifts the eye glow — used for the excited beat on the work section. */
  bright?: boolean
}) {
  const [left, right] = eyePoses(expression)
  const isHappy = expression === 'happy'
  const isSurprised = expression === 'surprised'
  const { eyeLeft, eyeRight, mouth } = ORBI_ART

  const gazeX = clampGaze(gaze.x) * ORBI_ART.gazeMaxX
  const gazeY = clampGaze(gaze.y) * ORBI_ART.gazeMaxY

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

      {/* Everything that follows ORBI's gaze travels together. */}
      <g
        style={{
          transform: `translate(${gazeX}px, ${gazeY}px)`,
          filter: bright ? 'brightness(1.5)' : 'brightness(1)',
          transition: GAZE_TRANSITION,
        }}
      >
        {/* Pupils */}
        <g transform={`translate(${eyeLeft.x} ${eyeLeft.y})`}>
          <Eye pose={left} />
        </g>
        <g transform={`translate(${eyeRight.x} ${eyeRight.y})`}>
          <Eye pose={right} />
        </g>

        {/* Happy arcs — cross-fade in as the pupils fade out. */}
        <g
          style={{
            opacity: isHappy ? 1 : 0,
            transition: 'opacity 170ms ease',
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
      <g
        style={{ opacity: isHappy ? 0.4 : 0, transition: 'opacity 220ms ease' }}
      >
        <ellipse cx={eyeLeft.x - 11} cy={eyeLeft.y + 15} rx={5.5} ry={3} fill={ORBI_COLORS.accent} />
        <ellipse cx={eyeRight.x + 11} cy={eyeRight.y + 15} rx={5.5} ry={3} fill={ORBI_COLORS.accent} />
      </g>

      {/* Mouth — three fixed shapes cross-faded, so no path morphing is needed. */}
      <g fill="none" stroke={ORBI_COLORS.accentSoft} strokeLinecap="round">
        <path
          d={`M ${mouth.x - 8} ${mouth.y} Q ${mouth.x} ${mouth.y + 3.5} ${mouth.x + 8} ${mouth.y}`}
          strokeWidth={2.2}
          style={{
            opacity: isHappy || isSurprised ? 0 : 0.32,
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
      </g>
    </g>
  )
}
