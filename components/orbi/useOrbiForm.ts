'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  ORBI_FORM,
  ORBI_SELECTORS,
  type OrbiFormStatus,
} from './orbiConfig'
import { rectFrom, type OrbiRect } from './orbiDocks'

/**
 * ORBI — the contact form companion.
 *
 * ## Privacy
 *
 * This module never reads what anyone types. It does not touch `.value`, does
 * not construct `FormData`, and does not walk `form.elements`. The only things
 * it looks at are:
 *
 *   - which element has focus, and its `data-orbi-field` name
 *   - `aria-invalid` on a control (set by the form once it has validated)
 *   - `data-orbi-form-state` on the form
 *   - `getBoundingClientRect()` for gaze and docking
 *
 * All of those are UI state the form publishes about itself. Field *names*
 * travel into ORBI's state; field *contents* never do, and nothing here is
 * logged. The form owns its own data path entirely — ORBI only watches the
 * lifecycle.
 *
 * ## Shape
 *
 * Like the other controllers, this one only reports. `OrbiGuide` decides what
 * ORBI does about it. It is kept out of `useOrbiInteraction` because form
 * lifecycle is a different concern on a different clock, and out of
 * `useOrbiEnvironment` because that answers "what does the page look like",
 * not "what is the visitor doing in it".
 */

export interface OrbiFormSnapshot {
  /** A registered form is on screen. */
  present: boolean
  /** The visitor has engaged with it and ORBI should stay attentive. */
  companion: boolean
  /** The form's box, or `null` when it is off screen. */
  rect: OrbiRect | null
  /** `data-orbi-field` of the focused control. Never its contents. */
  field: string | null
  /** Normalized direction from ORBI toward whatever it should be watching. */
  gaze: { x: number; y: number } | null
  status: OrbiFormStatus
  /** First control the form has flagged with `aria-invalid`. */
  invalidField: string | null
  /** Monotonic id, so a re-render cannot replay a success. */
  submissionId: number
  /** Debug only. Never a value. */
  lastEvent: string
}

const EMPTY: OrbiFormSnapshot = {
  present: false,
  companion: false,
  rect: null,
  field: null,
  gaze: null,
  status: 'idle',
  invalidField: null,
  submissionId: 0,
  lastEvent: '—',
}

export interface OrbiFormOptions {
  /** Held off until the entrance sequence has finished. */
  enabled: boolean
  /** ORBI's box, to work out which way to look. */
  rootRef: RefObject<HTMLElement | null>
}

export interface OrbiFormApi extends OrbiFormSnapshot {
  /** Drop out of companion mode — used once a result has been shown. */
  release: () => void
}

export function useOrbiForm({
  enabled,
  rootRef,
}: OrbiFormOptions): OrbiFormApi {
  const [snapshot, setSnapshot] = useState<OrbiFormSnapshot>(EMPTY)

  const formRef = useRef<HTMLElement | null>(null)
  const fieldRef = useRef<HTMLElement | null>(null)
  const companionRef = useRef(false)
  const statusRef = useRef<OrbiFormStatus>('idle')
  const submissionRef = useRef(0)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frameRef = useRef(0)

  /* ── Measurement ─────────────────────────────────────────────────────── */

  /** Direction from ORBI's centre to an element's centre. Geometry only. */
  const directionTo = useCallback(
    (element: Element | null) => {
      const root = rootRef.current
      if (!element || !root) return null
      const from = root.getBoundingClientRect()
      const to = element.getBoundingClientRect()
      const dx = to.left + to.width / 2 - (from.left + from.width / 2)
      const dy = to.top + to.height / 2 - (from.top + from.height / 2)
      const length = Math.hypot(dx, dy) || 1
      return { x: dx / length, y: dy / length }
    },
    [rootRef],
  )

  const publish = useCallback(
    (event: string) => {
      const form = formRef.current
      const onScreen =
        !!form &&
        form.isConnected &&
        (() => {
          const r = form.getBoundingClientRect()
          return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight
        })()

      const invalid = form?.querySelector<HTMLElement>(
        '[data-orbi-field][aria-invalid="true"]',
      )

      // What ORBI watches, in order: the field being filled in, then the first
      // thing the form has flagged, then the form itself.
      const target = fieldRef.current ?? invalid ?? (onScreen ? form : null)

      setSnapshot({
        present: onScreen,
        companion: companionRef.current,
        rect: onScreen && form ? rectFrom(form.getBoundingClientRect()) : null,
        // The submit control has no `data-orbi-field`, but naming it keeps the
        // HUD honest about what ORBI is watching.
        field:
          fieldRef.current?.getAttribute('data-orbi-field') ??
          (fieldRef.current?.matches(ORBI_SELECTORS.submit) ? 'submit' : null),
        gaze: directionTo(target),
        status: statusRef.current,
        invalidField: invalid?.getAttribute('data-orbi-field') ?? null,
        submissionId: submissionRef.current,
        lastEvent: event,
      })
    },
    [directionTo],
  )

  /** Batched into a frame; layout is never read from an event handler. */
  const schedule = useCallback(
    (event: string, delay: number = ORBI_FORM.geometryDebounceMs) => {
      if (measureTimerRef.current) clearTimeout(measureTimerRef.current)
      measureTimerRef.current = setTimeout(() => {
        measureTimerRef.current = null
        cancelAnimationFrame(frameRef.current)
        frameRef.current = requestAnimationFrame(() => publish(event))
      }, delay)
    },
    [publish],
  )

  const scheduleRef = useRef(schedule)
  useEffect(() => {
    scheduleRef.current = schedule
  })

  const release = useCallback(() => {
    companionRef.current = false
    fieldRef.current = null
    scheduleRef.current('release', 0)
  }, [])

  /* ── Watching ────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled) return

    const ping = (event: string, delay?: number) =>
      scheduleRef.current(event, delay)

    const findForm = () =>
      document.querySelector<HTMLElement>(ORBI_SELECTORS.form)

    formRef.current = findForm()
    statusRef.current =
      (formRef.current?.getAttribute('data-orbi-form-state') as OrbiFormStatus) ??
      'idle'
    ping('mount', 0)

    const clearLeave = () => {
      if (!leaveTimerRef.current) return
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }

    /* Focus, not input. ORBI learns that a field is active — never what is in
       it — and autofill changes nothing about that. */
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const form = target.closest<HTMLElement>(ORBI_SELECTORS.form)
      if (!form) return

      clearLeave()
      formRef.current = form
      companionRef.current = true

      const field = target.closest<HTMLElement>(ORBI_SELECTORS.field)
      const submit = target.closest<HTMLElement>(ORBI_SELECTORS.submit)
      fieldRef.current = field ?? submit ?? null
      ping(field ? `focus:${field.getAttribute('data-orbi-field')}` : 'focus:form', 0)
    }

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget
      const form = formRef.current
      if (next instanceof Element && form?.contains(next)) return

      // A short grace period: tabbing between controls, clicking a label, or
      // the autofill dropdown taking focus should not end companion mode.
      clearLeave()
      leaveTimerRef.current = setTimeout(() => {
        leaveTimerRef.current = null
        const active = document.activeElement
        if (active instanceof Element && form?.contains(active)) return
        fieldRef.current = null
        if (statusRef.current === 'idle') companionRef.current = false
        ping('blur', 0)
      }, ORBI_FORM.leaveGraceMs)

      fieldRef.current = null
      ping('field-blur', 0)
    }

    /* Pointer interest in the submit button, without stealing focus. */
    const onPointerOver = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const submit = target.closest<HTMLElement>(ORBI_SELECTORS.submit)
      if (!submit || fieldRef.current) return
      if (!companionRef.current) return
      fieldRef.current = submit
      ping('submit-hover', 0)
    }

    const onPointerOut = (event: PointerEvent) => {
      if (!fieldRef.current) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest(ORBI_SELECTORS.submit)) return
      const next = (event as PointerEvent).relatedTarget
      if (next instanceof Node && fieldRef.current.contains(next)) return
      if (document.activeElement === fieldRef.current) return
      fieldRef.current = null
      ping('submit-leave', 0)
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('pointerover', onPointerOver, { passive: true })
    document.addEventListener('pointerout', onPointerOut, { passive: true })

    /* Lifecycle and validation, by attribute. Nothing observes typing. */
    const attributes = new MutationObserver((records) => {
      let statusChanged = false
      let validityChanged = false

      for (const record of records) {
        if (record.attributeName === 'data-orbi-form-state') statusChanged = true
        if (record.attributeName === 'aria-invalid') validityChanged = true
      }

      if (statusChanged) {
        const form = formRef.current
        const next =
          (form?.getAttribute('data-orbi-form-state') as OrbiFormStatus) ?? 'idle'
        if (next !== statusRef.current) {
          // One id per submission, so a re-render cannot replay a celebration.
          // React can batch `submitting` away entirely on a fast response, so
          // a result arriving straight from idle opens a new cycle too.
          const startsCycle =
            next === 'submitting' ||
            (statusRef.current !== 'submitting' && next !== 'idle')
          if (startsCycle) submissionRef.current += 1
          statusRef.current = next
          if (next !== 'idle') companionRef.current = true
          ping(`status:${next}`, 0)
          return
        }
      }
      if (validityChanged) ping('validity', 0)
    })

    // Watching the document rather than a form instance, so a form that mounts
    // later is picked up without a second observer.
    attributes.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-orbi-form-state', 'aria-invalid'],
    })

    // A form appearing or leaving.
    const structure = new MutationObserver(() => {
      const found = findForm()
      if (found === formRef.current) return
      formRef.current = found
      ping('form-changed')
    })
    structure.observe(document.body, { subtree: true, childList: true })

    /* Geometry follows the page, not the keystrokes. */
    const onScroll = () => ping('scroll')
    const onResize = () => ping('resize')
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })

    const observer = new ResizeObserver(() => ping('form-resize'))
    if (formRef.current) observer.observe(formRef.current)

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      attributes.disconnect()
      structure.disconnect()
      observer.disconnect()
      clearLeave()
      if (measureTimerRef.current) clearTimeout(measureTimerRef.current)
      cancelAnimationFrame(frameRef.current)
    }
  }, [enabled])

  return { ...snapshot, release }
}
