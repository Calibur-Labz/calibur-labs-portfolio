'use client'

import { useState } from 'react'
import { SoundOffIcon, SoundOnIcon } from '@/components/ui/icons'
import {
  ORBI_AUDIO_TOGGLE,
  ORBI_COLORS,
  type OrbiRegionTheme,
} from './orbiConfig'

/**
 * ORBI's sound control.
 *
 * Deliberately the smallest piece of UI on the page: a 34px glass disc beside
 * ORBI that sits at a third opacity until the cursor comes near him, and never
 * turns into a settings panel. There are two states and no volume slider —
 * anything more would be a bigger interface than the feature deserves.
 *
 * The visible disc is smaller than the control: the button itself is a full
 * 44px touch target with the disc painted inside it, so a thumb has something
 * to hit without a 44px circle sitting next to ORBI.
 *
 * Accessibility is the reason this is a real `<button>` with `aria-pressed`
 * rather than something cleverer: the state is "sound on / sound off", a screen
 * reader should hear exactly that, and nothing ORBI says is ever *only* audible
 * — every cue has a face or an animation carrying the same meaning.
 */
export default function OrbiSoundToggle({
  enabled,
  onToggle,
  revealed,
  size,
  theme = 'dark',
  dimmed = false,
}: {
  enabled: boolean
  /** Runs inside the click, which is what unlocks audio in Safari and on iOS. */
  onToggle: () => void
  /** The cursor is near ORBI, or this control has focus. */
  revealed: boolean
  /** Painted diameter. The hit area is padded out to 44px regardless. */
  size: number
  theme?: OrbiRegionTheme
  /** A bubble is showing over this corner; stay out of its way. */
  dimmed?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const show = revealed || hovered || focused
  const opacity = dimmed && !show
    ? ORBI_AUDIO_TOGGLE.restOpacity * 0.5
    : show
      ? 1
      : ORBI_AUDIO_TOGGLE.restOpacity

  const light = theme === 'light'
  const Icon = enabled ? SoundOnIcon : SoundOffIcon

  return (
    <button
      type="button"
      data-orbi-audio-toggle=""
      aria-pressed={enabled}
      aria-label={enabled ? 'Disable ORBI sounds' : 'Enable ORBI sounds'}
      title={enabled ? 'Disable ORBI sounds' : 'Enable ORBI sounds'}
      onClick={onToggle}
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return
        setHovered(true)
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        // The control is the full touch target; the disc below is the picture.
        width: `${ORBI_AUDIO_TOGGLE.touchSize}px`,
        height: `${ORBI_AUDIO_TOGGLE.touchSize}px`,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        margin: 0,
        border: 'none',
        background: 'transparent',
        pointerEvents: 'auto',
        cursor: 'pointer',
        /*
         * The focus ring has to be the shape of the thing it is pointing at.
         *
         * The button is a 44px square so a thumb has something to hit, but the
         * only part anyone can see is the disc painted inside it — so the
         * global `:focus-visible` outline was drawing a hard square around a
         * round control. Rounding the box and pulling the offset in lands the
         * ring exactly on the disc's edge instead. Same treatment `.orbi-robot`
         * already gets in `globals.css`, for the same reason.
         */
        borderRadius: '50%',
        outlineOffset: '-5px',
        opacity,
        transition: 'opacity 220ms ease',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      <span
        aria-hidden="true"
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
            enabled
              ? 'rgba(0, 183, 255, 0.42)'
              : light
                ? 'rgba(10, 15, 22, 0.18)'
                : 'rgba(255, 255, 255, 0.10)'
          }`,
          boxShadow: enabled
            ? `0 0 0 1px rgba(0, 183, 255, 0.10), 0 6px 18px -8px rgba(0, 183, 255, 0.55)`
            : '0 6px 16px -10px rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px) saturate(140%)',
          WebkitBackdropFilter: 'blur(10px) saturate(140%)',
          color: enabled
            ? ORBI_COLORS.accent
            : light
              ? '#4A5A6C'
              : '#8FA2B7',
          transition:
            'color 220ms ease, border-color 220ms ease, box-shadow 220ms ease, background 320ms ease',
        }}
      >
        <Icon size={Math.round(size * 0.5)} />
      </span>
    </button>
  )
}
