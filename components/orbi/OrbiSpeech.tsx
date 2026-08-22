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
 * Always mounted, never unmounted — it just animates between hidden and shown,
 * so a fade-out is never cut short by React removing the node.
 *
 * It is hidden from assistive technology on purpose: see the comment on the
 * panel itself. The form, not ORBI, announces what actually happened.
 *
 * The last message stays in the DOM while the bubble fades out, so text never
 * disappears a frame before the panel does.
 *
 * Where it opens is decided by `orbiDocks.chooseBubblePlacement` and handed
 * down as `placement` / `align`: above by default, flipping to ORBI's side
 * when above would leave the viewport or cover something registered. Flipping
 * the bubble is always preferred to moving ORBI for the bubble's sake.
 *
 * Two ways the text can change. Normally a new message *pops* — the panel
 * scales in, because it is a new thing to say. During a run of related lines
 * (the post-success sequence) it *crossfades* instead: the panel never leaves,
 * only the words swap, which is what keeps three messages in a row from
 * reading as three separate interruptions.
 */
export default function OrbiSpeech({
  message,
  messageId,
  placement,
  side = 'above',
  align = 'right',
  theme = 'dark',
  /** `soft` swaps the words in place; `pop` brings the whole panel in. */
  transition = 'pop',
  /** Floor under the panel width, so a run of lines does not jump about. */
  minWidth,
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
  transition?: 'pop' | 'soft'
  minWidth?: number
  reducedMotion: boolean
}) {
  const bubbleRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [text, setText] = useState(message ?? '')

  // Latch the copy: keep showing it through the exit animation. A soft swap is
  // the exception — it holds the old words until they have faded, so the
  // exchange is never a flash.
  if (message && message !== text && transition !== 'soft') setText(message)

  useEffect(() => {
    if (bubbleRef.current) {
      gsap.set(bubbleRef.current, { autoAlpha: 0, y: 10, scale: 0.94 })
    }
  }, [])

  /**
   * Soft swap: fade the words out, exchange them, fade them back. The panel
   * itself is untouched, so it neither collapses nor re-pops between lines.
   *
   * Only ever used for a *continuation* — the first line of a run still pops,
   * so this never has to deal with a hidden panel.
   */
  useEffect(() => {
    const el = bubbleRef.current
    const words = textRef.current
    if (!el || !words) return
    if (transition !== 'soft' || !message || message === text) return

    const out = reducedMotion ? 0.08 : 0.16
    const back = reducedMotion ? 0.08 : 0.24

    const tween = gsap.to(words, {
      autoAlpha: 0,
      duration: out,
      ease: 'power1.in',
      onComplete: () => {
        setText(message)
        gsap.to(words, { autoAlpha: 1, duration: back, ease: 'power2.out' })
      },
    })
    return () => {
      tween.kill()
    }
  }, [message, text, transition, reducedMotion])

  useEffect(() => {
    const el = bubbleRef.current
    if (!el) return
    // A soft run owns its own transition; the panel must not re-pop under it.
    if (transition === 'soft' && message) {
      gsap.to(el, { autoAlpha: 1, y: 0, scale: 1, duration: 0.2, overwrite: 'auto' })
      return
    }

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
  }, [message, messageId, transition, reducedMotion])

  return (
    <div
      ref={bubbleRef}
      /*
       * Deliberately not a live region.
       *
       * Everything ORBI says is an echo: the contact form announces its own
       * validation and its own result through `role="status"`, sections are
       * reachable in the document, and nothing exists only in this bubble. A
       * screen reader that also read ORBI would hear "Message sent!", "We'll
       * check your message", "Thank you!" *on top of* the form's own
       * announcement — three interruptions carrying nothing new. ORBI stays a
       * labelled button anyone can find and press; his mood stays visual.
       */
      aria-hidden="true"
      style={{
        position: 'absolute',
        ...anchorFor(side, align),
        maxWidth: `${placement.speechMaxWidth}px`,
        minWidth: minWidth ? `${minWidth}px` : undefined,
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
      <span ref={textRef} style={{ display: 'block' }}>
        {text}
      </span>
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
