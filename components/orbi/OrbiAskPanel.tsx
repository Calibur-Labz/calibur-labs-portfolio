'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ORBI_ACTION_LABELS,
  ORBI_ASK,
  ORBI_ASK_MESSAGES,
  ORBI_ASK_STARTERS,
  type OrbiAskAction,
} from './orbiAsk'
import { ORBI_COLORS, type OrbiBreakpoint, type OrbiPlacement } from './orbiConfig'
import type { OrbiAskEntry } from './useOrbiAsk'

/**
 * The Ask ORBI panel.
 *
 * Borrows the guide panel's surface exactly — same glass, same border, same
 * radius, same type — because it is the same robot holding out a different
 * thing. What it is *not* is a support widget: no avatar, no "we typically
 * reply in", no bubble tails, no branding. A question box, an answer, and a
 * button only when there is somewhere worth going.
 *
 * On a phone it is a bottom sheet. The on-screen keyboard takes most of the
 * viewport, so the panel is measured in `svh`, the history scrolls inside
 * itself, and the input sits at the bottom where the keyboard expects it.
 *
 * Presentation only. It never calls the API, never navigates and never touches
 * ORBI — `useOrbiAsk` owns the conversation and `OrbiGuide` owns everything
 * else, which is the same division every other panel in ORBI follows.
 */
export default function OrbiAskPanel({
  open,
  entries,
  pending,
  breakpoint,
  placement,
  onSend,
  onAction,
  onExplore,
  onClose,
  reducedMotion,
}: {
  open: boolean
  entries: OrbiAskEntry[]
  pending: boolean
  breakpoint: OrbiBreakpoint
  placement: OrbiPlacement
  onSend: (question: string) => void
  onAction: (entry: OrbiAskEntry) => void
  /** Hand back to guide mode — the one thing ORBI can still do when the
      provider cannot answer. */
  onExplore: () => void
  onClose: () => void
  reducedMotion: boolean
}) {
  const [draft, setDraft] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  /** Where focus was before the panel opened, so Escape can hand it back. */
  const returnRef = useRef<HTMLElement | null>(null)

  const mobile = breakpoint === 'mobile'
  /**
   * Only the most recent turns are drawn.
   *
   * Nothing is deleted — the hook still holds the conversation — but a panel
   * anchored to a corner cannot grow forever, and on a phone the twelfth turn
   * is already off the top of the screen. Older turns simply stop being
   * rendered; they are not stored anywhere either way.
   */
  const visible = entries.slice(-ORBI_ASK.maxVisible)

  /* Focus the input on open; hand focus back on close. */
  useEffect(() => {
    if (!open) return
    returnRef.current = document.activeElement as HTMLElement | null
    const id = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => {
      window.clearTimeout(id)
      returnRef.current?.focus?.()
      returnRef.current = null
    }
  }, [open])

  /*
   * Escape closes, wherever focus happens to be.
   *
   * The panel's own `onKeyDown` only sees keys pressed inside it, and focus
   * legitimately leaves — the Send button disables itself mid-request, which
   * hands focus to the body. One listener, mounted only while the panel is
   * open and removed with it, so nothing is watching when it is shut.
   */
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /* New answers scroll into view inside the panel, never the page. */
  useEffect(() => {
    const log = logRef.current
    if (!log) return
    log.scrollTop = log.scrollHeight
  }, [entries.length, pending])

  if (!open) return null

  const submit = () => {
    const question = draft.trim()
    if (!question || pending) return
    onSend(question)
    setDraft('')
  }

  const anchored: React.CSSProperties = mobile
    ? {
        left: '12px',
        right: '12px',
        bottom: '12px',
        maxHeight: '68svh',
      }
    : {
        right: `${placement.right}px`,
        bottom: `${placement.bottom + placement.size * 0.92}px`,
        width: '340px',
        maxHeight: '60svh',
      }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ORBI_ASK_MESSAGES.title}
      data-orbi-ask-panel=""
      /*
        Deliberately NOT `data-orbi-avoid`. Registering the panel as an
        obstacle would have the environment score ORBI's own corner as blocked
        and relocate him to another one — leaving his panel behind, anchored to
        a dock he no longer occupies. The panel belongs to him; he does not
        dodge it.
      */
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
      style={{
        position: 'fixed',
        ...anchored,
        zIndex: 95,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        padding: '12px',
        borderRadius: '16px',
        background: ORBI_COLORS.guideBg,
        backdropFilter: 'blur(14px) saturate(140%)',
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        border: `1px solid ${ORBI_COLORS.speechBorder}`,
        boxShadow:
          '0 20px 44px rgba(0,0,0,0.5), 0 0 24px rgba(0,183,255,0.14), inset 0 1px 0 rgba(255,255,255,0.06)',
        color: ORBI_COLORS.speechText,
        fontFamily: 'var(--font-poppins), system-ui, sans-serif',
        pointerEvents: 'auto',
        animation: reducedMotion ? undefined : 'orbiAskIn 180ms ease-out',
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '0 2px 8px',
          flex: '0 0 auto',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: ORBI_COLORS.accent,
          }}
        >
          {ORBI_ASK_MESSAGES.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={ORBI_ASK_MESSAGES.close}
          style={{
            width: '26px',
            height: '26px',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            border: 'none',
            borderRadius: '50%',
            background: 'transparent',
            color: '#6E8399',
            cursor: 'pointer',
            fontSize: '15px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* The conversation. Scrolls inside itself, never the page. */}
      <div
        ref={logRef}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '2px',
          fontSize: '13px',
          lineHeight: 1.5,
        }}
      >
        {/*
          Before anyone has typed: what ORBI can help with, and four ways to
          find out. Outside the live region below on purpose — a screen reader
          meets these as ordinary buttons when it reaches them, rather than
          having four suggestions announced at it the moment the panel opens.
        */}
        {entries.length === 0 && !pending && (
          <>
            <p style={{ margin: 0, color: '#6E8399' }}>{ORBI_ASK_MESSAGES.intro}</p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginTop: '2px',
              }}
            >
              {ORBI_ASK_STARTERS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => onSend(question)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#93A6BC',
                    fontFamily: 'inherit',
                    fontSize: '12px',
                    fontWeight: 500,
                    lineHeight: 1.3,
                    // Wraps rather than overflowing: at 320px two of these do
                    // not fit on one line, and a panel that scrolls sideways
                    // is a broken panel.
                    maxWidth: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                  }}
                >
                  {question}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Answers only. A polite region so each one is announced once — the
            questions are already in the DOM the moment they are sent. */}
        <div
          aria-live="polite"
          aria-atomic="false"
          style={{ display: 'contents' }}
        >
        {visible.map((entry) => (
          <div key={entry.id}>
            <div
              style={{
                color: entry.role === 'user' ? '#8FA2B7' : ORBI_COLORS.speechText,
                fontWeight: entry.role === 'user' ? 500 : 400,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {/* Plain text. The model's output is never parsed as markup —
                  no markdown renderer, no dangerouslySetInnerHTML. */}
              {entry.role === 'user' ? `You: ${entry.text}` : entry.text}
            </div>

            {entry.action && (
              <CtaButton onClick={() => onAction(entry)}>
                {ORBI_ACTION_LABELS[entry.action as Exclude<OrbiAskAction, 'NO_ACTION'>]}
              </CtaButton>
            )}

            {/*
              An answer that failed still leaves ORBI able to do the one thing
              that needs no provider at all. A dead end reads as broken; an
              offer reads as a companion having an off moment.
            */}
            {entry.failed && (
              <CtaButton onClick={onExplore}>{ORBI_ASK_MESSAGES.explore}</CtaButton>
            )}
          </div>
        ))}

        {pending && <Thinking reducedMotion={reducedMotion} />}
        </div>
      </div>

      {/* Ask */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flex: '0 0 auto',
        }}
      >
        <label htmlFor="orbi-ask-input" style={SR_ONLY}>
          {ORBI_ASK_MESSAGES.placeholder}
        </label>
        <input
          id="orbi-ask-input"
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, ORBI_ASK.maxInput))}
          maxLength={ORBI_ASK.maxInput}
          placeholder={ORBI_ASK_MESSAGES.placeholder}
          autoComplete="off"
          enterKeyHint="send"
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            padding: '9px 11px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.03)',
            color: ORBI_COLORS.speechText,
            fontFamily: 'inherit',
            fontSize: '13px',
            outlineOffset: '1px',
          }}
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          style={{
            flex: '0 0 auto',
            padding: '0 14px',
            borderRadius: '10px',
            border: '1px solid rgba(0,183,255,0.34)',
            background: 'rgba(0,183,255,0.10)',
            color: ORBI_COLORS.accent,
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: 600,
            cursor: pending || !draft.trim() ? 'default' : 'pointer',
            opacity: pending || !draft.trim() ? 0.45 : 1,
            transition: 'opacity 180ms ease',
          }}
        >
          {ORBI_ASK_MESSAGES.send}
        </button>
      </form>

      {!reducedMotion && (
        <style>{`
          @keyframes orbiAskIn {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to   { opacity: 1; transform: none; }
          }
        `}</style>
      )}
    </div>
  )
}

/**
 * The one button shape under an answer — a destination, or the way out of a
 * failure. Same affordance either way, because to a visitor they are the same
 * thing: the next useful step.
 */
function CtaButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        marginTop: '8px',
        padding: '7px 12px',
        borderRadius: '10px',
        border: '1px solid rgba(0,183,255,0.34)',
        background: 'rgba(0,183,255,0.10)',
        color: ORBI_COLORS.accent,
        fontFamily: 'inherit',
        fontSize: '12.5px',
        fontWeight: 600,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      {children}
    </button>
  )
}

/**
 * Waiting.
 *
 * Three dots that rise in turn — small enough to sit on the same line the
 * answer will replace, so nothing jumps when it arrives. Not a spinner: a
 * spinner is what a page does while it loads, and this is a robot thinking.
 *
 * The word "Thinking" is always in the DOM for assistive technology; under
 * reduced motion it is *all* there is, because a pulse conveys nothing that
 * the word does not.
 */
function Thinking({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <p style={{ margin: 0, color: '#6E8399', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span>{ORBI_ASK_MESSAGES.thinking}</span>
      {!reducedMotion && (
        <span aria-hidden="true" style={{ display: 'inline-flex', gap: '3px' }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: ORBI_COLORS.accent,
                opacity: 0.5,
                animation: `orbiAskDot 1.1s ease-in-out ${i * 0.16}s infinite`,
              }}
            />
          ))}
          <style>{`
            @keyframes orbiAskDot {
              0%, 60%, 100% { opacity: 0.28; transform: translateY(0); }
              30%           { opacity: 1;    transform: translateY(-2px); }
            }
          `}</style>
        </span>
      )}
    </p>
  )
}

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
