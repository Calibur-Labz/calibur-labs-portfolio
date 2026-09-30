'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import OrbiGuide, { type OrbiEmbedOptions } from '@/components/orbi/OrbiGuide'
import type { OrbiBreakpoint } from '@/components/orbi/orbiConfig'
import {
  sanitizeEmbedSections,
  sectionForAction,
  type OrbiEmbedSection,
} from '@/components/orbi/orbiEmbedSections'

/**
 * ORBI, inside the iframe `public/orbi/embed.js` puts on another website.
 *
 * The frame and the host page share exactly four messages:
 *
 *   host  → frame  { type: 'orbi:hello', token, sections: [{ key, label }] }   once
 *   frame → host   { type: 'orbi:denied' }                  token refused; host removes the iframe
 *   frame → host   { type: 'orbi:resize', mode: 'idle' | 'open' }
 *   frame → host   { type: 'orbi:navigate', section: key }
 *
 * Nothing renders until the token checks out. `embed.js` got it from
 * `/api/orbi/authorize`, which judged the host by its browser-sent Origin
 * header; the frame has the server verify it and then requires the origin it
 * names to be exactly the origin of the window that framed it. So ORBI runs
 * only where the server authorized it, even for someone who iframes this page
 * directly or copies a customer's snippet.
 *
 * The host's origin is never taken from the URL. It is read off the hello,
 * where the browser — not the sender — fills in `event.origin`, and the hello
 * only counts when it comes from the window that actually framed us. Until
 * then nothing is posted at all, so a message can never be sent to `*`.
 *
 * The sections carry names only. Their selectors never leave the host page:
 * to go somewhere, the frame names a section and the page scrolls itself.
 */

const BREAKPOINTS: readonly OrbiBreakpoint[] = ['desktop', 'tablet', 'mobile']

type SurfaceMode = 'idle' | 'open'

type EmbedAsk = OrbiEmbedOptions['ask']

/**
 * The verify answer's Ask settings → what the panel may show. Plain text in
 * bounded amounts; anything else means no Ask ORBI.
 */
function readAsk(raw: unknown, token: string): EmbedAsk {
  if (!raw || typeof raw !== 'object') return null
  const { intro, starters } = raw as { intro?: unknown; starters?: unknown }
  if (typeof intro !== 'string' || !intro.trim()) return null
  return {
    token,
    intro: intro.trim().slice(0, 200),
    starters: Array.isArray(starters)
      ? starters.filter((q): q is string => typeof q === 'string' && q.trim() !== '').slice(0, 4).map((q) => q.trim().slice(0, 80))
      : [],
  }
}

export default function OrbiFramePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const requested = use(searchParams).bp
  const breakpoint: OrbiBreakpoint = BREAKPOINTS.includes(requested as OrbiBreakpoint)
    ? (requested as OrbiBreakpoint)
    : 'desktop'

  /** The host page's origin, once it has introduced itself. */
  const hostOriginRef = useRef<string | null>(null)
  const modeRef = useRef<SurfaceMode>('idle')
  /** Nothing is offered until the host says what it has. */
  const [sections, setSections] = useState<OrbiEmbedSection[]>([])
  const sectionsRef = useRef(sections)
  useEffect(() => {
    sectionsRef.current = sections
  })

  const post = useCallback((message: object) => {
    const origin = hostOriginRef.current
    if (!origin) return
    window.parent.postMessage(message, origin)
  }, [])

  const report = useCallback(() => {
    post({ type: 'orbi:resize', mode: modeRef.current })
  }, [post])

  /** Only after the server has vouched for this host does ORBI appear at all. */
  const [authorized, setAuthorized] = useState(false)
  /** Ask ORBI for this site, if its plan includes it. */
  const [ask, setAsk] = useState<EmbedAsk>(null)
  /** One hello is checked; the host's retries while that happens are ignored. */
  const checkingRef = useRef(false)

  useEffect(() => {
    // Opened directly rather than framed: there is nobody to talk to.
    if (window.parent === window) return

    const onMessage = (event: MessageEvent) => {
      if (checkingRef.current || hostOriginRef.current) return
      if (event.source !== window.parent) return
      const data = event.data as { type?: unknown; token?: unknown; sections?: unknown } | null
      if (data?.type !== 'orbi:hello') return
      // An opaque origin (a sandboxed or `file:` host) cannot be addressed.
      if (!/^https?:\/\/[^/]+$/.test(event.origin)) return
      if (typeof data.token !== 'string') return

      const framedBy = event.origin
      const token = data.token
      const sections = sanitizeEmbedSections(data.sections)
      checkingRef.current = true

      fetch('/api/orbi/authorize/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: data.token }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
        .then((answer: { authorized?: unknown; origin?: unknown; ask?: unknown } | null) => {
          // The token must be good *and* have been issued to the very origin
          // that framed us — a token lifted from an authorized site names the
          // wrong origin everywhere else.
          const ok = answer?.authorized === true && answer.origin === framedBy
          if (!ok) {
            window.parent.postMessage({ type: 'orbi:denied' }, framedBy)
            return
          }
          hostOriginRef.current = framedBy
          setSections(sections)
          setAsk(readAsk(answer.ask, token))
          setAuthorized(true)
          report()
        })
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [report])

  const embed = useMemo<OrbiEmbedOptions>(
    () => ({
      breakpoint,
      sections,
      ask,
      onSurfaceChange: (open) => {
        modeRef.current = open ? 'open' : 'idle'
        report()
      },
      // Only a section the host configured; anything else goes nowhere.
      onAction: (action) => {
        const key = sectionForAction(action)
        if (!key || !sectionsRef.current.some((s) => s.key === key)) return
        post({ type: 'orbi:navigate', section: key })
      },
    }),
    [breakpoint, sections, ask, report, post],
  )

  return authorized ? <OrbiGuide embed={embed} /> : null
}
