'use client'

import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * A blocking modal overlay.
 *
 * ## Why this is not a `<dialog>`
 *
 * The native element would hand us a focus trap, Escape, the top layer and an
 * inert background for free, and every one of those is hand-rolled below. It
 * is still the wrong choice *here*, because ORBI watches for modals:
 * `ORBI_SELECTORS.modal` (`components/orbi/orbiConfig.ts`) matches
 * `[data-orbi-modal], dialog[open]`, and `OrbiGuide` responds by cancelling
 * what he is doing and going calm until it closes.
 *
 * That is right for most overlays and wrong for the one this was built for —
 * the contact form on the ORBI page, where ORBI reacting to the fields is the
 * product demonstrating itself. An open `<dialog>` would silently switch him
 * off at the exact moment he is meant to be selling.
 *
 * So: no `<dialog>`, no `showModal()`, and no `data-orbi-modal` on anything
 * here. If you reach for the native element to simplify this file, the demo
 * stops working and nothing fails loudly enough to tell you.
 *
 * ## The rest
 *
 * Portalled to `document.body` because every `<section>` on the site sets
 * `position: relative; z-index: 10`, which opens a stacking context a nested
 * overlay could never escape — it would render beneath the navbar.
 *
 * `zIndex: 200` clears ORBI's layer (90), his Ask panel (95) and the fixed
 * navbar (100), and stays under the dev-only debug HUD (9999).
 */

/** Everything focusable, in DOM order — the trap walks this list. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean
  onClose: () => void
  /** id of the heading that names this dialog. */
  labelledBy: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  /** Where focus was before we opened, so closing can hand it back. */
  const returnRef = useRef<HTMLElement | null>(null)

  /* Escape closes, wherever focus happens to be.
   *
   * `stopPropagation` is load-bearing rather than tidy: ORBI's guide mode
   * listens for Escape on `window` to cancel a tour, so without it one press
   * would close this and abandon his tour in the same beat. */
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  /* Focus in on open, back out on close. */
  useEffect(() => {
    if (!open) return
    returnRef.current = document.activeElement as HTMLElement | null
    // A frame's grace so the panel is mounted and measured first.
    const frame = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    })
    return () => {
      cancelAnimationFrame(frame)
      returnRef.current?.focus()
    }
  }, [open])

  /* Hold the page still underneath.
   *
   * `overflow: hidden` on the root rather than `position: fixed` on the body:
   * the latter would jump the scroll position and fights the
   * `scroll-padding-top` that anchor navigation depends on. */
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
    }
  }, [open])

  /** Tab and Shift+Tab wrap inside the panel instead of escaping to the page. */
  const trapFocus = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  // No portal target during the server render.
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          // Backdrop only — a click that started inside the panel bubbles up
          // here, so compare against the backdrop itself before closing.
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'rgba(3, 6, 11, 0.72)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            overflowY: 'auto',
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            onKeyDown={trapFocus}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '100%',
              maxWidth: '620px',
              // Never taller than the viewport; the body scrolls, not the page.
              maxHeight: 'calc(100dvh - 48px)',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              position: 'relative',
              borderRadius: '20px',
              background: '#0C121C',
              border: '1px solid rgba(255,255,255,0.08)',
              borderTop: '1px solid rgba(255,255,255,0.14)',
              boxShadow:
                '0 30px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,183,255,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
