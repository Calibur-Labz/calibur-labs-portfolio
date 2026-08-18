'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ORBI_COLORS, ORBI_EASE, ORBI_TIMING, type OrbiPlacement } from './orbiConfig'

/**
 * ORBI's speech bubble.
 *
 * Always mounted, never unmounted — it just animates between hidden and shown.
 * That keeps the `aria-live` region stable for screen readers and means a
 * fade-out is never cut short by React removing the node.
 *
 * The last message stays in the DOM while the bubble fades out, so text never
 * disappears a frame before the panel does.
 */
export default function OrbiSpeech({
  message,
  messageId,
  placement,
  reducedMotion,
}: {
  message: string | null
  /** Bumped per message so repeating the same text re-pops the bubble. */
  messageId: number
  placement: OrbiPlacement
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
        bottom: 'calc(100% + 4px)',
        right: '8px',
        maxWidth: `${placement.speechMaxWidth}px`,
        width: 'max-content',
        padding: placement.speechPadding,
        borderRadius: '16px',
        background: ORBI_COLORS.speechBg,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${ORBI_COLORS.speechBorder}`,
        boxShadow:
          '0 18px 40px rgba(0,0,0,0.45), 0 0 22px rgba(0,183,255,0.14), inset 0 1px 0 rgba(255,255,255,0.06)',
        color: ORBI_COLORS.speechText,
        fontFamily: 'var(--font-poppins), system-ui, sans-serif',
        fontSize: `${placement.speechFontSize}px`,
        fontWeight: 500,
        lineHeight: 1.45,
        letterSpacing: '0.01em',
        textAlign: 'left',
        transformOrigin: 'bottom right',
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
          bottom: '-6px',
          right: '26px',
          width: '11px',
          height: '11px',
          background: ORBI_COLORS.speechBg,
          borderRight: `1px solid ${ORBI_COLORS.speechBorder}`,
          borderBottom: `1px solid ${ORBI_COLORS.speechBorder}`,
          transform: 'rotate(45deg)',
          borderBottomRightRadius: '3px',
        }}
      />
    </div>
  )
}
