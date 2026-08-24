'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { gsap } from 'gsap'
import {
  ORBI_COLORS,
  type OrbiBreakpoint,
  type OrbiPlacement,
  type OrbiRegionTheme,
} from './orbiConfig'
import {
  ORBI_GUIDE,
  ORBI_GUIDE_MESSAGES,
  type OrbiGuideItem,
  type OrbiGuidePlacement,
} from './orbiGuideConfig'

/**
 * The guide panel.
 *
 * Presentation only: it knows the items, where it opens and whether it is up.
 * Every decision — which placement is safe, what happens when something is
 * picked, when to close — belongs to `useOrbiGuideMode` and `OrbiGuide`.
 *
 * It is deliberately **not** a chatbot. Five real buttons, a question at the
 * top, and no text input anywhere: there is nothing here to type into, so
 * nobody has to discover that typing does nothing.
 *
 * It is also small on purpose. A large card floating over the page would read
 * as a dialog the site had opened; this reads as something ORBI is holding
 * out — which is why it is anchored to his box, borrows the speech bubble's
 * surface, and points back at him with the same tail.
 *
 * Semantics: a labelled `role="dialog"` containing ordinary buttons. Not
 * `aria-modal` — it never traps focus, because it is a convenience the visitor
 * can tab straight past, not something blocking the page.
 */
export default function OrbiGuideMenu({
  open,
  items,
  placement,
  box,
  breakpoint,
  placementMetrics,
  theme = 'dark',
  reducedMotion,
  onSelect,
  onAsk,
  onClose,
  controlRef,
}: {
  open: boolean
  items: readonly OrbiGuideItem[]
  placement: OrbiGuidePlacement
  /**
   * Where to sit, as offsets from ORBI's box — decided in `orbiDocks` against
   * the registered regions, and handed down whole. The panel does no geometry
   * of its own; there is one place that knows where it goes.
   */
  box: { left: number; top: number; width: number; height: number } | null
  breakpoint: OrbiBreakpoint
  placementMetrics: OrbiPlacement
  theme?: OrbiRegionTheme
  reducedMotion: boolean
  onSelect: (item: OrbiGuideItem) => void
  /** Hand over to Ask ORBI. Omitted entirely if the panel is unavailable. */
  onAsk?: () => void
  onClose: () => void
  /** Focus goes back here when the panel closes. */
  controlRef: RefObject<HTMLButtonElement | null>
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  /**
   * Kept mounted through the exit tween, then dropped again — so the panel is
   * not in the document at all while guide mode is closed (§32), and a fade
   * out is never cut short by React removing the node first.
   *
   * Adjusted during render rather than in an effect: this is state derived
   * from a prop, and React re-runs the render immediately without painting the
   * intermediate result. The speech bubble latches its copy the same way.
   */
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  /* ── Enter / exit ────────────────────────────────────────────────────── */

  useEffect(() => {
    const el = panelRef.current
    if (!el) return

    if (open) {
      const tween = reducedMotion
        ? gsap.fromTo(
            el,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: ORBI_GUIDE.panelEnterMs / 1000, overwrite: 'auto' },
          )
        : gsap.fromTo(
            el,
            { autoAlpha: 0, y: 8, scale: 0.96 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: ORBI_GUIDE.panelEnterMs / 1000,
              ease: 'back.out(1.4)',
              overwrite: 'auto',
            },
          )
      return () => {
        tween.kill()
      }
    }

    const tween = gsap.to(el, {
      autoAlpha: 0,
      y: reducedMotion ? 0 : 6,
      scale: reducedMotion ? 1 : 0.97,
      duration: ORBI_GUIDE.panelExitMs / 1000,
      ease: 'power2.in',
      overwrite: 'auto',
      onComplete: () => setMounted(false),
    })
    return () => {
      tween.kill()
    }
  }, [open, mounted, reducedMotion])

  /* ── Focus ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!open) return
    // Opening a menu puts you in it. Deferred a tick so the panel is laid out
    // and the browser does not scroll the page to reach it.
    const id = requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLButtonElement>('button')?.focus({
        preventScroll: true,
      })
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (open) return
    const panel = panelRef.current
    // Only take focus back if it was ours to begin with — a visitor who has
    // already tabbed on somewhere else must not be yanked backwards.
    if (!panel || !panel.contains(document.activeElement)) return
    controlRef.current?.focus({ preventScroll: true })
  }, [open, controlRef])

  if (!mounted || !box) return null

  const m = ORBI_GUIDE.metrics[breakpoint]
  const isSheet = placement === 'sheet'

  /* ── Where it sits ───────────────────────────────────────────────────── */
  // Plain pixel offsets, never a percentage translate: GSAP owns this
  // element's transform for the entrance, and a second writer would fight it.

  const anchor: React.CSSProperties = {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    // Only the sheet is ever given a height; everywhere else the panel is as
    // tall as its contents, which is what `guidePanelSize` predicts.
    ...(isSheet ? { height: `${box.height}px` } : null),
  }

  const origin = isSheet
    ? 'bottom center'
    : placement === 'left'
      ? 'right center'
      : placement === 'right'
        ? 'left center'
        : placement === 'above-left'
          ? 'bottom left'
          : 'bottom right'

  /** Arrow keys walk the list; Enter and Space are the buttons' own. */
  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    )
    if (!buttons.length) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'ArrowDown'
        ? (index + 1 + buttons.length) % buttons.length
        : (index - 1 + buttons.length) % buttons.length
    event.preventDefault()
    buttons[next]?.focus({ preventScroll: true })
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ORBI_GUIDE_MESSAGES.panelLabel}
      data-orbi-guide-panel=""
      style={{
        position: 'absolute',
        ...anchor,
        display: 'flex',
        flexDirection: 'column',
        padding: `${ORBI_GUIDE.panel.padding}px`,
        borderRadius: `${ORBI_GUIDE.panel.radius}px`,
        background: ORBI_COLORS.guideBg,
        backdropFilter: 'blur(14px) saturate(140%)',
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        border: `1px solid ${ORBI_COLORS.speechBorder}`,
        boxShadow:
          theme === 'light'
            ? '0 18px 38px rgba(6,12,20,0.36), 0 2px 6px rgba(6,12,20,0.3), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 20px 44px rgba(0,0,0,0.5), 0 0 24px rgba(0,183,255,0.14), inset 0 1px 0 rgba(255,255,255,0.06)',
        color: ORBI_COLORS.speechText,
        fontFamily: 'var(--font-poppins), system-ui, sans-serif',
        transformOrigin: origin,
        pointerEvents: 'auto',
        /*
         * Above the travel layer, and therefore above the speech bubble.
         *
         * ORBI's controls deliberately sit *under* a bubble placed on their
         * side and dim out of its way — they are his, and what he is saying
         * matters more. A menu the visitor is reading is the other way round:
         * an ambient line arriving while it is open must not be painted over
         * five things somebody is choosing between.
         */
        zIndex: 2,
        // Hidden until GSAP takes over — no flash on first paint.
        opacity: 0,
        visibility: 'hidden',
      }}
    >
      <div
        style={{
          height: `${m.title}px`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          fontSize: `${Math.round(m.font * 0.86)}px`,
          fontWeight: 500,
          letterSpacing: '0.02em',
          color: '#6E8399',
          whiteSpace: 'nowrap',
        }}
      >
        {ORBI_GUIDE_MESSAGES.title}
      </div>

      <div
        ref={listRef}
        onKeyDown={onListKeyDown}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${m.gap}px`,
          // The sheet is allowed to be shorter than its content; nothing else
          // ever is, so this costs a scrollbar on precisely one layout.
          overflowY: isSheet ? 'auto' : 'visible',
          minHeight: 0,
          flex: isSheet ? '1 1 auto' : '0 0 auto',
        }}
      >
        {items.map((item) => (
          <MenuButton
            key={item.id}
            height={m.item}
            font={m.font}
            // "Go to Our Work" rather than "Our Work": the visible label names
            // the place, and the accessible name says what pressing it does.
            label={ORBI_GUIDE_MESSAGES.destinationLabel(item.label)}
            onClick={() => onSelect(item)}
          >
            {item.label}
          </MenuButton>
        ))}
      </div>

      <div
        style={{
          marginTop: `${ORBI_GUIDE.panel.padding}px`,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flex: '0 0 auto',
        }}
      >
        {/*
          Ask ORBI lives here rather than among the destinations, and rather
          than on a third circular control beside him.

          Below the divider because it is a different kind of thing: the five
          rows above take you somewhere on the page, this one starts a
          conversation. Putting it in the list would have made it look like a
          sixth section; putting it on its own button beside the guide and the
          sound controls would have made ORBI's chrome outgrow ORBI (§1).
        */}
        {onAsk && (
          <MenuButton
            height={m.item}
            font={m.font}
            label={ORBI_GUIDE_MESSAGES.askLabel}
            onClick={onAsk}
          >
            {ORBI_GUIDE_MESSAGES.ask}
          </MenuButton>
        )}
        <MenuButton height={m.item} font={m.font * 0.92} muted onClick={onClose}>
          {ORBI_GUIDE_MESSAGES.close}
        </MenuButton>
      </div>

      {/* The tail points back at ORBI — the same one the speech bubble uses, so
          the panel reads as his rather than as the page's. */}
      {!isSheet && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: '11px',
            height: '11px',
            background: ORBI_COLORS.guideBg,
            borderRight: `1px solid ${ORBI_COLORS.speechBorder}`,
            borderBottom: `1px solid ${ORBI_COLORS.speechBorder}`,
            borderBottomRightRadius: '3px',
            ...tailFor(placement, placementMetrics),
          }}
        />
      )}
    </div>
  )
}

/**
 * One row. A real `<button>` — never a div with a click handler — so keyboard
 * activation, focus and the accessibility tree are the browser's problem and
 * not ours.
 */
function MenuButton({
  children,
  height,
  font,
  label,
  muted = false,
  onClick,
}: {
  children: React.ReactNode
  height: number
  font: number
  /** Accessible name, when it should say more than the visible text does. */
  label?: string
  muted?: boolean
  onClick: () => void
}) {
  const [hot, setHot] = useState(false)

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return
        setHot(true)
      }}
      onPointerLeave={() => setHot(false)}
      onFocus={() => setHot(true)}
      onBlur={() => setHot(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        width: '100%',
        height: `${height}px`,
        padding: '0 8px 0 10px',
        borderRadius: '10px',
        border: '1px solid transparent',
        background: hot ? 'rgba(0,183,255,0.10)' : 'transparent',
        borderColor: hot ? 'rgba(0,183,255,0.24)' : 'transparent',
        color: hot ? '#E9F1F8' : muted ? '#6E8399' : '#93A6BC',
        fontFamily: 'inherit',
        fontSize: `${font}px`,
        fontWeight: muted ? 500 : 600,
        letterSpacing: '0.01em',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background 180ms ease, color 180ms ease, border-color 180ms ease',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {children}
      </span>
      {!muted && (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            flex: '0 0 auto',
            opacity: hot ? 1 : 0.35,
            transform: hot ? 'translateX(2px)' : 'none',
            transition: 'opacity 180ms ease, transform 180ms ease',
          }}
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      )}
    </button>
  )
}

/**
 * The tail always points back at ORBI. Offsets are measured from the panel's
 * corner toward the middle of his box, so it lands on him rather than beside
 * him at every size.
 */
function tailFor(
  placement: OrbiGuidePlacement,
  metrics: OrbiPlacement,
): React.CSSProperties {
  const inset = Math.max(18, Math.round(metrics.size / 2) - 6)

  if (placement === 'left') {
    return { right: '-6px', top: '50%', transform: 'translateY(-50%) rotate(-45deg)' }
  }
  if (placement === 'right') {
    return { left: '-6px', top: '50%', transform: 'translateY(-50%) rotate(135deg)' }
  }
  return placement === 'above-left'
    ? { bottom: '-6px', left: `${inset}px`, transform: 'rotate(45deg)' }
    : { bottom: '-6px', right: `${inset}px`, transform: 'rotate(45deg)' }
}
