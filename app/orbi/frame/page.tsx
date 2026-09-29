'use client'

import { use, useCallback, useEffect, useMemo, useRef } from 'react'
import OrbiGuide, { type OrbiEmbedOptions } from '@/components/orbi/OrbiGuide'
import type { OrbiBreakpoint } from '@/components/orbi/orbiConfig'
import type { OrbiAskAction } from '@/components/orbi/orbiAsk'

/**
 * ORBI, inside the iframe `public/orbi/embed.js` puts on another website.
 *
 * The frame and the host page share exactly two messages:
 *
 *   host  → frame  { type: 'orbi:hello' }                    once, on load
 *   frame → host   { type: 'orbi:resize', mode: 'idle'|'open' }
 *
 * The host's origin is never taken from the URL. It is read off the hello,
 * where the browser — not the sender — fills in `event.origin`, and the hello
 * only counts when it comes from the window that actually framed us. Until
 * then nothing is posted at all, so a resize can never be sent to `*`.
 */

const BREAKPOINTS: readonly OrbiBreakpoint[] = ['desktop', 'tablet', 'mobile']

/**
 * The only places ORBI can send a visitor from someone else's website. Fixed
 * here, never read from a message or a query string.
 */
const DESTINATIONS: Record<Exclude<OrbiAskAction, 'NO_ACTION'>, string> = {
  SHOW_SERVICES: 'https://www.caliburlabz.com/#services',
  SHOW_PROJECTS: 'https://www.caliburlabz.com/#work',
  SHOW_TESTIMONIALS: 'https://www.caliburlabz.com/#testimonials',
  SHOW_ABOUT: 'https://www.caliburlabz.com/#about',
  SHOW_CONTACT: 'https://www.caliburlabz.com/#contact',
}

type SurfaceMode = 'idle' | 'open'

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

  const report = useCallback(() => {
    const origin = hostOriginRef.current
    if (!origin) return
    window.parent.postMessage({ type: 'orbi:resize', mode: modeRef.current }, origin)
  }, [])

  useEffect(() => {
    // Opened directly rather than framed: there is nobody to talk to.
    if (window.parent === window) return

    const onMessage = (event: MessageEvent) => {
      if (hostOriginRef.current) return
      if (event.source !== window.parent) return
      if ((event.data as { type?: unknown } | null)?.type !== 'orbi:hello') return
      // An opaque origin (a sandboxed or `file:` host) cannot be addressed.
      if (!/^https?:\/\/[^/]+$/.test(event.origin)) return
      hostOriginRef.current = event.origin
      report()
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [report])

  const embed = useMemo<OrbiEmbedOptions>(
    () => ({
      breakpoint,
      onSurfaceChange: (open) => {
        modeRef.current = open ? 'open' : 'idle'
        report()
      },
      // Called inside the visitor's own click, so the new tab is not a popup.
      onAction: (action) => {
        const url = DESTINATIONS[action]
        if (url) window.open(url, '_blank', 'noopener,noreferrer')
      },
    }),
    [breakpoint, report],
  )

  return <OrbiGuide embed={embed} />
}
