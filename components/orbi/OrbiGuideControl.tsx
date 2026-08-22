'use client'

import { useState, type RefObject } from 'react'
import { CompassIcon } from '@/components/ui/icons'
import { ORBI_COLORS, type OrbiRegionTheme } from './orbiConfig'
import { ORBI_GUIDE, ORBI_GUIDE_MESSAGES } from './orbiGuideConfig'

/**
 * ORBI's guide control.
 *
 * The deliberate way into guide mode, and the only new button Phase 12 adds.
 * It is a sibling of the sound control in every respect — same 34px glass disc
 * inside a 44px touch target, same resting opacity, same inward side — because
 * two controls that look like one small system read as ORBI's, and two that
 * merely coexist read as clutter.
 *
 * Clicking ORBI still does what it always did. This is a separate control on
 * purpose: the click personality, the head tap and the five-click Easter egg
 * all survive precisely because guide mode never consumes an activation on the
 * robot itself.
 *
 * A compass rather than a speech bubble, because guide mode takes you
 * somewhere. Nothing here is a chat.
 */
export default function OrbiGuideControl({
  open,
  onToggle,
  revealed,
  size,
  theme = 'dark',
  dimmed = false,
  /** One quiet run of pulses, once per visit, so the control is noticed. */
  pulsing = false,
  buttonRef,
}: {
  open: boolean
  onToggle: () => void
  /** The cursor is near ORBI, or this control has focus. */
  revealed: boolean
  /** Painted diameter. The hit area is padded out to 44px regardless. */
  size: number
  theme?: OrbiRegionTheme
  /** A bubble is showing over this corner; stay out of its way. */
  dimmed?: boolean
  pulsing?: boolean
  buttonRef?: RefObject<HTMLButtonElement | null>
}) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const show = revealed || hovered || focused || open
  const opacity = dimmed && !show
    ? ORBI_GUIDE.control.restOpacity * 0.5
    : show
      ? 1
      : ORBI_GUIDE.control.restOpacity

  const light = theme === 'light'
  const active = open || hovered || focused

  return (
    <button
      ref={buttonRef}
      type="button"
      data-orbi-guide-control=""
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={
        open ? ORBI_GUIDE_MESSAGES.controlLabelOpen : ORBI_GUIDE_MESSAGES.controlLabel
      }
      title={open ? ORBI_GUIDE_MESSAGES.controlLabelOpen : ORBI_GUIDE_MESSAGES.controlLabel}
      onClick={onToggle}
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return
        setHovered(true)
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: `${ORBI_GUIDE.control.touchSize}px`,
        height: `${ORBI_GUIDE.control.touchSize}px`,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        margin: 0,
        border: 'none',
        background: 'transparent',
        pointerEvents: 'auto',
        cursor: 'pointer',
        opacity,
        transition: 'opacity 220ms ease',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      <span
        aria-hidden="true"
        className={pulsing ? 'orbi-guide-pulse' : undefined}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: light
            ? 'rgba(255, 255, 255, 0.72)'
            : 'rgba(12, 18, 28, 0.72)',
          border: `1px solid ${
            active
              ? 'rgba(0, 183, 255, 0.55)'
              : light
                ? 'rgba(10, 15, 22, 0.18)'
                : 'rgba(255, 255, 255, 0.10)'
          }`,
          boxShadow: active
            ? '0 0 0 1px rgba(0, 183, 255, 0.12), 0 6px 18px -8px rgba(0, 183, 255, 0.6)'
            : '0 6px 16px -10px rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px) saturate(140%)',
          WebkitBackdropFilter: 'blur(10px) saturate(140%)',
          color: active ? ORBI_COLORS.accent : light ? '#4A5A6C' : '#8FA2B7',
          transition:
            'color 220ms ease, border-color 220ms ease, box-shadow 220ms ease, transform 260ms ease',
          transform: open ? 'rotate(-18deg)' : 'none',
        }}
      >
        <CompassIcon size={Math.round(size * 0.52)} />
      </span>

      {/*
        The discovery pulse travels with the control rather than living in
        `globals.css`: keyframes cannot be an inline style, and an animation of
        ORBI's that depends on the application's stylesheet is an invisible
        coupling — drop him into a page without those rules and he looks broken
        with nothing reporting it (§11).

        Under `prefers-reduced-motion` the global reset disables it, which is
        the right answer: the control is still there, it simply does not ask
        for attention.
      */}
      {pulsing && (
        <style>{`
          @keyframes orbiGuidePulse {
            0%, 100% { box-shadow: 0 6px 16px -10px rgba(0,0,0,0.7), 0 0 0 0 rgba(0,183,255,0.36); }
            35%      { box-shadow: 0 6px 16px -10px rgba(0,0,0,0.7), 0 0 0 7px rgba(0,183,255,0); }
          }
          .orbi-guide-pulse {
            animation: orbiGuidePulse ${ORBI_GUIDE.control.pulseCycleMs}ms ease-out ${ORBI_GUIDE.control.pulseCount};
          }
        `}</style>
      )}
    </button>
  )
}
