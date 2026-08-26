'use client'

import { useEffect } from 'react'

/**
 * Re-applies the URL hash once the homepage has mounted.
 *
 * Every anchor on the site is a homepage section, so arriving at one from
 * another route — /orbi's "Get started" and "Start a conversation" both point
 * at /#contact — is a route change and a scroll in the same step. The router
 * performs that scroll as soon as the new segment commits, which is before
 * this page's sections have laid out, so the jump lands short or not at all
 * and the visitor is left at the top wondering what the button did.
 *
 * Re-running it after mount fixes that. The retry loop covers content that is
 * still settling: it gives up after ~30 frames rather than spinning, and stops
 * the moment the target exists.
 *
 * Nothing happens without a hash, so a plain visit to `/` is untouched, and
 * same-page anchor clicks still go through the browser's own handling.
 */
export default function HashScroll() {
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return

    let frame = 0
    let tries = 0

    const jump = () => {
      // `getElementById`, not `querySelector` — a hash is arbitrary text from
      // the address bar and would throw as a selector.
      const target = document.getElementById(id)
      if (target) {
        // `instant`, not `smooth`: this is an arrival, not a nudge down the
        // page someone is already reading. Honours the `scroll-padding-top`
        // in globals.css, so the fixed navbar does not cover the heading.
        target.scrollIntoView({ behavior: 'instant', block: 'start' })
        return
      }
      if (tries++ < 30) frame = requestAnimationFrame(jump)
    }

    frame = requestAnimationFrame(jump)
    return () => cancelAnimationFrame(frame)
  }, [])

  return null
}
