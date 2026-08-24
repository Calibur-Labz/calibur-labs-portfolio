'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ORBI_SCROLL } from './orbiConfig'

export type OrbiScrollDirection = 'up' | 'down' | null

export interface OrbiScrollHandlers {
  /** A registered section has taken the middle of the viewport. */
  onSection: (id: string) => void
  /** The footer came into view (`true`) or was scrolled back away from. */
  onFooter: (inFooter: boolean) => void
  /** Direction changed, or scrolling stopped (`null`). */
  onDirection: (direction: OrbiScrollDirection) => void
  /** The viewport is moving unusually fast. Throttling is the caller's job. */
  onFastScroll: (velocity: number) => void
  /**
   * How far down the document the visitor is, 0 at the top and 1 at the
   * bottom. Read straight off the master trigger that was already measuring
   * direction and velocity, so page progress costs no listener of its own.
   *
   * Fires on the scroll tick, so it must not touch React state.
   */
  onProgress: (progress: number) => void
}

export interface OrbiScrollOptions {
  /** Ids to watch, in document order. Rebuilds the triggers when it changes. */
  sectionIds: string[]
  /** Held off until the entrance sequence has finished. */
  enabled: boolean
  /** Mobile and reduced-motion visitors skip the startled reaction. */
  fastScrollEnabled: boolean
  handlers: OrbiScrollHandlers
}

/**
 * ORBI's *only* scroll system.
 *
 * One GSAP context owns everything: a master trigger spanning the document for
 * direction and velocity, one trigger per registered section, and one for the
 * footer. Nothing else in ORBI is allowed to create a ScrollTrigger, so there
 * is no chance of two systems fighting over the robot.
 *
 * Handlers are read through a ref, so passing fresh closures never rebuilds
 * the triggers — only `sectionIds` / `enabled` do.
 */
export function useOrbiScroll({
  sectionIds,
  enabled,
  fastScrollEnabled,
  handlers,
}: OrbiScrollOptions) {
  const handlersRef = useRef(handlers)
  const fastEnabledRef = useRef(fastScrollEnabled)

  useEffect(() => {
    handlersRef.current = handlers
    fastEnabledRef.current = fastScrollEnabled
  })

  // Joined so a re-render with an equal list does not tear the triggers down.
  const sectionKey = sectionIds.join('|')

  useEffect(() => {
    if (!enabled) return
    gsap.registerPlugin(ScrollTrigger)

    let stopTimer: ReturnType<typeof setTimeout> | null = null
    let lastDirection: OrbiScrollDirection = null
    let sectionFrame = 0
    const sectionTriggers: Array<{
      id: string
      el: Element
      trigger: ScrollTrigger
    }> = []

    /**
     * A crossing only *schedules* a check; the next frame works out which
     * section actually owns the middle of the viewport and announces that one.
     *
     * Two reasons it works this way. A jump — a hash link, a restored scroll
     * position, a fast flick — crosses several triggers in one tick, and the
     * order they report in is not the order they appear on the page. And the
     * answer is measured from live geometry rather than read off
     * `trigger.isActive`, because ScrollTrigger updates on its own rAF tick:
     * reading its flags from ours returns whatever was true one event ago, and
     * ORBI would react to the section it just left.
     */
    const resolveSection = () => {
      if (sectionFrame) return
      sectionFrame = requestAnimationFrame(() => {
        sectionFrame = 0
        const viewport = window.innerHeight
        const middle = viewport / 2
        let best: { id: string; distance: number } | null = null

        for (const entry of sectionTriggers) {
          const rect = entry.el.getBoundingClientRect()
          const inBand =
            rect.top <= viewport * ORBI_SCROLL.bandTop &&
            rect.bottom >= viewport * ORBI_SCROLL.bandBottom
          if (!inBand) continue

          const distance = Math.abs(rect.top + rect.height / 2 - middle)
          if (!best || distance < best.distance) {
            best = { id: entry.id, distance }
          }
        }

        if (best) handlersRef.current.onSection(best.id)
      })
    }

    const emitDirection = (direction: OrbiScrollDirection) => {
      if (direction === lastDirection) return
      lastDirection = direction
      handlersRef.current.onDirection(direction)
    }

    let master: ScrollTrigger | null = null

    const ctx = gsap.context(() => {
      // Master: direction, stop detection, velocity — and, since it already
      // spans the whole document, progress.
      master = ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          handlersRef.current.onProgress(self.progress)
          emitDirection(self.direction === 1 ? 'down' : 'up')

          if (stopTimer) clearTimeout(stopTimer)
          stopTimer = setTimeout(() => {
            emitDirection(null)
            // Belt and braces: the last trigger crossing can happen before the
            // scroll finishes, so confirm the section once the page is still.
            resolveSection()
          }, ORBI_SCROLL.glanceSettleMs)

          if (!fastEnabledRef.current) return
          const velocity = Math.abs(self.getVelocity())
          if (velocity > ORBI_SCROLL.fastVelocity) {
            handlersRef.current.onFastScroll(velocity)
          }
        },
      })

      // One per section. `start`/`end` bracket the middle band of the
      // viewport, so a section merely touching the bottom edge is ignored.
      for (const id of sectionKey ? sectionKey.split('|') : []) {
        const el = document.getElementById(id)
        if (!el) continue
        sectionTriggers.push({
          id,
          el,
          trigger: ScrollTrigger.create({
            trigger: el,
            start: `top ${ORBI_SCROLL.bandTop * 100}%`,
            end: `bottom ${ORBI_SCROLL.bandBottom * 100}%`,
            onEnter: resolveSection,
            onEnterBack: resolveSection,
          }),
        })
      }

      const footer = document.querySelector(ORBI_SCROLL.footerSelector)
      if (footer) {
        ScrollTrigger.create({
          trigger: footer,
          start: ORBI_SCROLL.footerStart,
          onEnter: () => handlersRef.current.onFooter(true),
          onLeaveBack: () => handlersRef.current.onFooter(false),
        })
      }
    })

    const refresh = requestAnimationFrame(() => {
      // Fonts and images settle after hydration; re-measure once they have.
      ScrollTrigger.refresh()

      // ScrollTrigger only fires on a *crossing*, so a visitor who was already
      // deep in the page (a #hash link, a restored scroll position, or someone
      // who scrolled during the entrance) would otherwise get no reaction at
      // all until they left the section and came back.
      resolveSection()
      // Same reasoning for progress: `onUpdate` has not run yet, so a restored
      // scroll position would show an empty ring until the visitor moved.
      if (master) handlersRef.current.onProgress(master.progress)
    })

    return () => {
      cancelAnimationFrame(refresh)
      if (sectionFrame) cancelAnimationFrame(sectionFrame)
      if (stopTimer) clearTimeout(stopTimer)
      ctx.revert()
    }
  }, [enabled, sectionKey])
}
