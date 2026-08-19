'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import {
  ORBI_COLORS,
  ORBI_EASE,
  ORBI_TIMING,
  type OrbiBubblePlacement,
  type OrbiPlacement,
  type OrbiRegionTheme,
} from './orbiConfig'

/**
 * ORBI's speech bubble.
 *
 * Always mounted, never unmounted — it just animates between hidden and shown.
 * That keeps the `aria-live` region stable for screen readers and means a
 * fade-out is never cut short by React removing the node.
 *
 * The last message stays in the DOM while the bubble fades out, so text never
 * disappears a frame before the panel does.
 *
 * Where it opens is decided by `orbiDocks.chooseBubblePlacement` and handed
 * down as `placement` / `align`: above by default, flipping to ORBI's side
 * when above would leave the viewport or cover something registered. Flipping
 * the bubble is always preferred to moving ORBI for the bubble's sake.
 */
export default function OrbiSpeech({
  message,
  messageId,
  placement,
  side = 'above',
  align = 'right',
  theme = 'dark',
  reducedMotion,
}: {
  message: string | null
  /** Bumped per message so repeating the same text re-pops the bubble. */
  messageId: number
  placement: OrbiPlacement
  /** Which way the bubble opens, chosen against the registered regions. */
  side?: OrbiBubblePlacement
  /** Which edge it aligns to when it sits above ORBI. */
  align?: 'left' | 'right'
  theme?: OrbiRegionTheme
  reducedMotion: boolean
}) {
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState(message ?? '')

  // Latch the copy: keep showing it through the exit animation.
  if (message && message !== text) setText(message)

  useEffect(() => {
    if (bubbleRef.current) {
      gsap.set(bubbleRef.current, { autoAlpha: 0, y: 10, scale: 0.94 })
    }
  }, [])

  useEffect(() => {
    const el = bubbleRef.current
    if (!el) return

    if (reducedMotion) {
      gsap.to(el, {
        autoAlpha: message ? 1 : 0,
        y: 0,
        scale: 1,
        duration: 0.25,
        overwrite: 'auto',
      })
      return
    }

    if (message) {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 10, scale: 0.94 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: ORBI_TIMING.speechIn,
          ease: 'back.out(1.6)',
          overwrite: 'auto',
        },
      )
    } else {
      gsap.to(el, {
        autoAlpha: 0,
        y: 8,
        scale: 0.96,
        duration: ORBI_TIMING.speechOut,
        ease: ORBI_EASE.inOut,
        overwrite: 'auto',
      })
    }
  }, [message, messageId, reducedMotion])

  return (
    <div
      ref={bubbleRef}
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        ...anchorFor(side, align),
        maxWidth: `${placement.speechMaxWidth}px`,
        width: 'max-content',
        padding: placement.speechPadding,
        borderRadius: '16px',
        background: ORBI_COLORS.speechBg,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${ORBI_COLORS.speechBorder}`,
        // Over a light region the cyan bloom disappears; a real shadow keeps
        // the panel separated from the page instead.
        boxShadow:
          theme === 'light'
            ? '0 16px 34px rgba(6,12,20,0.34), 0 2px 6px rgba(6,12,20,0.28), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 18px 40px rgba(0,0,0,0.45), 0 0 22px rgba(0,183,255,0.14), inset 0 1px 0 rgba(255,255,255,0.06)',
        transition: 'box-shadow 420ms ease',
        color: ORBI_COLORS.speechText,
        fontFamily: 'var(--font-poppins), system-ui, sans-serif',
        fontSize: `${placement.speechFontSize}px`,
        fontWeight: 500,
        lineHeight: 1.45,
        letterSpacing: '0.01em',
        textAlign: 'left',
        transformOrigin: originFor(side, align),
        pointerEvents: 'none',
        // Hidden until GSAP takes over — no flash on first paint.
        opacity: 0,
        visibility: 'hidden',
      }}
    >
      {text}
      {/* Tail — a rotated square borrowing two of the panel's borders. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '11px',
          height: '11px',
          background: ORBI_COLORS.speechBg,
          borderRight: `1px solid ${ORBI_COLORS.speechBorder}`,
          borderBottom: `1px solid ${ORBI_COLORS.speechBorder}`,
          borderBottomRightRadius: '3px',
          ...tailFor(side, align),
        }}
      />
    </div>
  )
}

/* ── Placement geometry ────────────────────────────────────────────────── */
// ORBI's container is the positioning context, so every placement is expressed
// relative to his own box.

function anchorFor(
  side: OrbiBubblePlacement,
  align: 'left' | 'right',
): React.CSSProperties {
  if (side === 'left') return { right: 'calc(100% + 10px)', top: '18%' }
  if (side === 'right') return { left: 'calc(100% + 10px)', top: '18%' }
  return align === 'left'
    ? { bottom: 'calc(100% + 4px)', left: '8px' }
    : { bottom: 'calc(100% + 4px)', right: '8px' }
}

function originFor(side: OrbiBubblePlacement, align: 'left' | 'right') {
  if (side === 'left') return 'right center'
  if (side === 'right') return 'left center'
  return align === 'left' ? 'bottom left' : 'bottom right'
}

/** The tail always points back at ORBI. */
function tailFor(
  side: OrbiBubblePlacement,
  align: 'left' | 'right',
): React.CSSProperties {
  if (side === 'left') {
    return { right: '-6px', top: '50%', transform: 'translateY(-50%) rotate(-45deg)' }
  }
  if (side === 'right') {
    return { left: '-6px', top: '50%', transform: 'translateY(-50%) rotate(135deg)' }
  }
  return align === 'left'
    ? { bottom: '-6px', left: '26px', transform: 'rotate(45deg)' }
    : { bottom: '-6px', right: '26px', transform: 'rotate(45deg)' }
}
