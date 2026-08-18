'use client'

import type { RefObject } from 'react'
import OrbiFace, { type OrbiGaze } from './OrbiFace'
import {
  ORBI_COLORS,
  ORBI_VIEWBOX,
  type OrbiExpression,
} from './orbiConfig'

/**
 * ORBI's body — a single inline SVG so it stays razor-sharp at every
 * breakpoint and never needs a raster asset.
 *
 * Presentation only. The hooks the motion layer needs are `armRef` and
 * `leftArmRef` — the groups that the wave and point timelines rotate about
 * their shoulders.
 *
 * The viewBox is wider than the robot on purpose: the right-hand reserve is
 * where the raised arm swings, so a wave never clips.
 */
export default function OrbiRobot({
  expression,
  awake,
  gaze,
  bright,
  armRef,
  leftArmRef,
}: {
  expression: OrbiExpression
  awake: boolean
  gaze?: OrbiGaze
  bright?: boolean
  /** Waves, and points to ORBI's right. */
  armRef: RefObject<SVGGElement | null>
  /** Points to ORBI's left. */
  leftArmRef: RefObject<SVGGElement | null>
}) {
  return (
    <svg
      viewBox={`0 0 ${ORBI_VIEWBOX.width} ${ORBI_VIEWBOX.height}`}
      width="100%"
      height="100%"
      // Decorative — ORBI's meaning is carried by the speech bubble, which is
      // a live region.
      aria-hidden="true"
      focusable="false"
      // `auto` here means SVG hit-testing applies: only the painted robot
      // is clickable, never the transparent box around it.
      style={{ overflow: 'visible', display: 'block', pointerEvents: 'auto' }}
    >
      <defs>
        <linearGradient id="orbi-shell" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor={ORBI_COLORS.shellTop} />
          <stop offset="100%" stopColor={ORBI_COLORS.shellBottom} />
        </linearGradient>
        <linearGradient id="orbi-limb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16202E" />
          <stop offset="100%" stopColor="#0A0F16" />
        </linearGradient>
        <linearGradient id="orbi-crest" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id="orbi-sheen" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.09)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id="orbi-pad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={ORBI_COLORS.accent} stopOpacity="0.42" />
          <stop offset="100%" stopColor={ORBI_COLORS.accent} stopOpacity="0" />
        </radialGradient>
        <filter id="orbi-bloom" x="-140%" y="-140%" width="380%" height="380%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Hover pad — the cyan pool ORBI floats over. */}
      <ellipse cx={85} cy={134} rx={38} ry={9} fill="url(#orbi-pad)" />

      {/* Antenna */}
      <path
        d="M 85 32 L 85 18"
        stroke="#2A3A4F"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle
        cx={85}
        cy={13}
        r={4.6}
        fill={ORBI_COLORS.accent}
        filter="url(#orbi-bloom)"
      />

      {/* Arms sit behind the shell so the shoulder joint is never visible. */}
      <g ref={leftArmRef}>
        <rect x={20} y={74} width={13} height={24} rx={6.5} fill="url(#orbi-limb)" />
        <circle cx={26.5} cy={98} r={7} fill="url(#orbi-limb)" stroke={ORBI_COLORS.rim} strokeWidth={1} />
      </g>
      <g ref={armRef}>
        <rect x={137} y={74} width={13} height={24} rx={6.5} fill="url(#orbi-limb)" />
        <circle cx={143.5} cy={98} r={7} fill="url(#orbi-limb)" stroke={ORBI_COLORS.rim} strokeWidth={1} />
      </g>

      {/* Shell */}
      <rect
        x={33}
        y={28}
        width={104}
        height={90}
        rx={34}
        fill="url(#orbi-shell)"
        stroke={ORBI_COLORS.rim}
        strokeWidth={1.4}
      />
      <rect x={33} y={28} width={104} height={90} rx={34} fill="url(#orbi-sheen)" />
      {/* Crest highlight along the top edge. */}
      <path
        d="M 56 33.5 Q 85 26.5 114 33.5"
        stroke="url(#orbi-crest)"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />

      {/* Visor */}
      <rect
        x={46}
        y={46}
        width={78}
        height={54}
        rx={27}
        fill={ORBI_COLORS.visor}
        stroke={ORBI_COLORS.rimStrong}
        strokeWidth={1.2}
      />

      <OrbiFace expression={expression} awake={awake} gaze={gaze} bright={bright} />

      {/* Core light on the chest — a quiet "powered on" tell. */}
      <ellipse
        cx={85}
        cy={110}
        rx={11}
        ry={2.6}
        fill={ORBI_COLORS.accent}
        opacity={awake ? 0.5 : 0.14}
        filter="url(#orbi-bloom)"
        style={{ transition: 'opacity 500ms ease' }}
      />
    </svg>
  )
}
