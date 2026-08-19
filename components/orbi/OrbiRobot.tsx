'use client'

import { useState, type RefObject } from 'react'
import OrbiFace from './OrbiFace'
import {
  ORBI_COLORS,
  ORBI_VIEWBOX,
  type OrbiExpression,
  type OrbiRegionTheme,
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
  bright,
  dozing,
  theme = 'dark',
  gazeRef,
  armRef,
  leftArmRef,
  onActivate,
  onHoverStart,
  onHoverEnd,
}: {
  expression: OrbiExpression
  awake: boolean
  bright?: boolean
  dozing?: boolean
  /**
   * The visual region ORBI is currently over. Only presentation effects
   * change — halo, shadow, rim — never the character's own colours.
   */
  theme?: OrbiRegionTheme
  /** Handed to `orbiGaze`, which drives the pupils imperatively. */
  gazeRef?: RefObject<SVGGElement | null>
  /** Waves, and points to ORBI's right. */
  armRef: RefObject<SVGGElement | null>
  /** Points to ORBI's left. */
  leftArmRef: RefObject<SVGGElement | null>
  /** Click or tap on the robot itself. */
  onActivate?: () => void
  /**
   * Pointer entered / left the *painted* robot. Taken from the SVG's own hit
   * testing rather than inferred from geometry, so it is exact and free.
   */
  onHoverStart?: () => void
  onHoverEnd?: () => void
}) {
  /**
   * Keyboard focus only. `:focus-visible` is the browser's own
   * mouse-vs-keyboard heuristic, so asking the element directly gives exactly
   * the right answer without us having to guess at input modality.
   */
  const [keyboardFocus, setKeyboardFocus] = useState(false)

  /**
   * Over a light region the cyan halo stops doing any work, so it is traded
   * for a real shadow and a faint dark rim. ORBI's own colours never change —
   * he is the same character, just lit differently.
   */
  const light = theme === 'light'
  return (
    <svg
      viewBox={`0 0 ${ORBI_VIEWBOX.width} ${ORBI_VIEWBOX.height}`}
      width="100%"
      height="100%"
      // Once ORBI is clickable it is a control, not decoration, so it keeps an
      // accessible name. Its *meaning* still travels through the speech
      // bubble, which is a live region.
      focusable="false"
      role={onActivate ? 'button' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      aria-label={onActivate ? 'ORBI, your guide' : undefined}
      onClick={onActivate}
      onFocus={(event) => setKeyboardFocus(isKeyboardFocus(event.currentTarget))}
      onBlur={() => setKeyboardFocus(false)}
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return
        onHoverStart?.()
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'touch') return
        onHoverEnd?.()
      }}
      onKeyDown={
        onActivate
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onActivate()
            }
          : undefined
      }
      style={{
        overflow: 'visible',
        display: 'block',
        filter: light
          ? 'drop-shadow(0 10px 18px rgba(6, 12, 20, 0.42)) drop-shadow(0 2px 4px rgba(6, 12, 20, 0.3))'
          : 'none',
        transition: 'filter 420ms ease',
        // `auto` here means SVG hit-testing applies: only the painted robot is
        // clickable, never the transparent box around it.
        pointerEvents: 'auto',
        cursor: onActivate ? 'pointer' : undefined,
        // Taps resolve as clicks without the 300ms wait, and a touch that turns
        // into a scroll is still a scroll — ORBI never swallows the gesture.
        touchAction: 'manipulation',
        // A rectangular outline around a round robot looks like a mistake. The
        // global `:focus-visible` rule in globals.css is overridden here only —
        // inline beats it without `!important` — and replaced with the halo
        // below, so keyboard users are never left without an indicator.
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
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
        <radialGradient id="orbi-pad-light" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#0B1420" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#0B1420" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="orbi-focus" cx="0.5" cy="0.5" r="0.5">
          <stop offset="55%" stopColor={ORBI_COLORS.accentSoft} stopOpacity="0" />
          <stop offset="82%" stopColor={ORBI_COLORS.accentSoft} stopOpacity="0.38" />
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

      {/* Keyboard focus: a halo that follows ORBI's own shape rather than a
          box drawn around his bounding rect. */}
      <ellipse
        cx={85}
        cy={72}
        rx={82}
        ry={76}
        fill="url(#orbi-focus)"
        style={{
          opacity: keyboardFocus ? 1 : 0,
          transition: 'opacity 200ms ease',
          pointerEvents: 'none',
        }}
      />

      {/* Hover pad — a cyan pool on dark, a grounded shadow on light. */}
      <ellipse
        cx={85}
        cy={134}
        rx={38}
        ry={9}
        fill="url(#orbi-pad)"
        style={{ opacity: light ? 0.35 : 1, transition: 'opacity 420ms ease' }}
      />
      <ellipse
        cx={85}
        cy={135}
        rx={31}
        ry={7}
        fill="url(#orbi-pad-light)"
        style={{ opacity: light ? 1 : 0, transition: 'opacity 420ms ease' }}
      />

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
      <rect
        x={33}
        y={28}
        width={104}
        height={90}
        rx={34}
        fill="none"
        stroke="rgba(5, 9, 15, 0.55)"
        strokeWidth={1.6}
        style={{ opacity: light ? 1 : 0, transition: 'opacity 420ms ease' }}
      />
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

      <OrbiFace
        expression={expression}
        awake={awake}
        bright={bright}
        dozing={dozing}
        gazeRef={gazeRef}
      />

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

/**
 * `Element.matches(':focus-visible')` is how the browser itself decides whether
 * focus deserves an indicator — keyboard yes, mouse no. Guarded because a
 * browser without the selector would throw on an unknown pseudo-class, and in
 * that case showing the halo is the safer failure.
 */
function isKeyboardFocus(element: Element): boolean {
  try {
    return element.matches(':focus-visible')
  } catch {
    return true
  }
}
