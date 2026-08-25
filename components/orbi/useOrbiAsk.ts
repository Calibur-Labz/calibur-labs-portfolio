'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  normaliseAction,
  normaliseOutcome,
  ORBI_ASK,
  ORBI_ASK_MESSAGES,
  type OrbiAskAction,
  type OrbiAskOutcome,
  type OrbiAskTurn,
} from './orbiAsk'

/**
 * Ask ORBI — the conversation, in memory, for as long as the page is open.
 *
 * Nothing is stored. Refreshing the page is the reset button, which is the
 * whole privacy story: no localStorage, no cookie, no id, nothing to clear.
 *
 * The hook owns one request at a time and refuses to start a second. It costs
 * nothing while the panel is shut — no timer, no listener, no fetch — because
 * every one of those is created inside `send` and torn down when it settles.
 */

export interface OrbiAskEntry {
  id: number
  role: 'user' | 'orbi'
  text: string
  /** Only ever set on an ORBI turn, and only ever a validated enum. */
  action?: Exclude<OrbiAskAction, 'NO_ACTION'>
  /** A failure ORBI is reporting, rather than something he said. */
  failed?: boolean
  /**
   * How well the provider judged its own answer. Drives ORBI's face — a
   * confident answer earns a brief happy beat, an unsure one earns the unsure
   * one — and is never shown to the visitor.
   */
  outcome?: OrbiAskOutcome
}

export interface OrbiAskApi {
  entries: OrbiAskEntry[]
  pending: boolean
  send: (question: string) => void
  /** Drop the action button once the visitor has used or dismissed it. */
  clearAction: (id: number) => void
  reset: () => void
  /** Debug HUD only. */
  lastAction: OrbiAskAction | null
  lastError: string | null
}

export function useOrbiAsk(): OrbiAskApi {
  const [entries, setEntries] = useState<OrbiAskEntry[]>([])
  const [pending, setPending] = useState(false)
  const [lastAction, setLastAction] = useState<OrbiAskAction | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const idRef = useRef(0)
  const pendingRef = useRef(false)
  /** The live request, so unmount can abort it. */
  const abortRef = useRef<AbortController | null>(null)
  /** What was asked last, and when — the double-click guard. */
  const lastSentRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  /** History as the server wants it, kept beside the display list. */
  const turnsRef = useRef<OrbiAskTurn[]>([])

  useEffect(
    () => () => {
      abortRef.current?.abort()
      abortRef.current = null
    },
    [],
  )

  const push = useCallback((entry: Omit<OrbiAskEntry, 'id'>) => {
    const id = ++idRef.current
    setEntries((current) => [...current, { ...entry, id }])
    return id
  }, [])

  const send = useCallback(
    (raw: string) => {
      const question = raw.trim()
      if (!question) return
      // One at a time. The button is disabled too, but Enter, a double click
      // and a stuck key all arrive here rather than there.
      if (pendingRef.current) return
      if (question.length > ORBI_ASK.maxInput) {
        push({ role: 'orbi', text: ORBI_ASK_MESSAGES.tooLong, failed: true })
        return
      }

      const now = Date.now()
      if (
        question === lastSentRef.current.text &&
        now - lastSentRef.current.at < ORBI_ASK.duplicateWindowMs
      ) {
        return
      }
      lastSentRef.current = { text: question, at: now }

      pendingRef.current = true
      setPending(true)
      setLastError(null)
      push({ role: 'user', text: question })

      const history = [...turnsRef.current, { role: 'user' as const, content: question }]
        .slice(-ORBI_ASK.maxHistory)

      const abort = new AbortController()
      abortRef.current = abort
      const timer = setTimeout(() => abort.abort(), ORBI_ASK.clientTimeoutMs)

      const settle = () => {
        clearTimeout(timer)
        if (abortRef.current === abort) abortRef.current = null
        pendingRef.current = false
        setPending(false)
      }

      fetch(ORBI_ASK.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: abort.signal,
      })
        .then(async (response) => {
          // The route answers with the same shape whatever the status, so a
          // 429 or a 502 still carries a sentence worth showing.
          const data = (await response.json().catch(() => null)) as
            | { message?: unknown; action?: unknown; outcome?: unknown }
            | null

          const text =
            typeof data?.message === 'string' && data.message.trim()
              ? data.message.trim()
              : ORBI_ASK_MESSAGES.error
          const ok = response.ok

          // Validated a second time, on this side of the wire. The server
          // already constrained it; neither end trusts the other.
          const action = ok ? normaliseAction(data?.action) : 'NO_ACTION'
          setLastAction(action)
          if (!ok) setLastError(`http ${response.status}`)

          push({
            role: 'orbi',
            text,
            failed: !ok,
            action: action === 'NO_ACTION' ? undefined : action,
            // Validated on this side of the wire too, exactly like the action.
            outcome: ok ? normaliseOutcome(data?.outcome) : undefined,
          })

          if (ok) {
            turnsRef.current = [
              ...history,
              { role: 'assistant' as const, content: text },
            ].slice(-ORBI_ASK.maxHistory)
          }
        })
        .catch((error: unknown) => {
          // An abort on unmount is not a failure anybody should be told about.
          if (abort.signal.aborted && abortRef.current !== abort) return
          setLastError(error instanceof Error ? error.name : 'error')
          push({ role: 'orbi', text: ORBI_ASK_MESSAGES.error, failed: true })
        })
        .finally(settle)
    },
    [push],
  )

  const clearAction = useCallback((id: number) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, action: undefined } : entry,
      ),
    )
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    pendingRef.current = false
    turnsRef.current = []
    lastSentRef.current = { text: '', at: 0 }
    setEntries([])
    setPending(false)
    setLastAction(null)
    setLastError(null)
  }, [])

  return { entries, pending, send, clearAction, reset, lastAction, lastError }
}
