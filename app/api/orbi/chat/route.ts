import { NextResponse } from 'next/server'
import {
  isAskTurn,
  normaliseAction,
  normaliseEmotion,
  normaliseOutcome,
  ORBI_ASK,
  ORBI_ASK_MESSAGES,
  type OrbiAskTurn,
} from '@/components/orbi/orbiAsk'
import { resolveOrbiProvider } from '@/lib/orbi/providers'
import { callerKey, checkOrbiRate } from '@/lib/orbi/orbiRateLimit'

/**
 * Ask ORBI.
 *
 * Everything a visitor sends is untrusted, so nothing is passed through: the
 * body is parsed defensively, each turn is checked field by field, the history
 * is trimmed to a fixed window, and only then does anything reach a model.
 *
 * Every failure — bad key, provider 500, timeout, abort, malformed reply —
 * leaves by the same door with the same sentence and a 200-shaped payload the
 * panel can render. The visitor gets one honest line and a site that still
 * works; nothing about the server goes back over the wire.
 */

export const runtime = 'nodejs'
/** Never cached: same question, new conversation. */
export const dynamic = 'force-dynamic'

/** One sentence out, whatever happened. Never a stack, a status or a provider name. */
function fallback(message: string, status: number, retryAfter?: number) {
  return NextResponse.json(
    { message, action: 'NO_ACTION' as const },
    {
      status,
      headers: retryAfter ? { 'retry-after': String(retryAfter) } : undefined,
    },
  )
}

export async function POST(request: Request) {
  /* ── Who, and how often ── */
  const rate = checkOrbiRate(callerKey(request.headers))
  if (!rate.allowed) {
    return fallback(ORBI_ASK_MESSAGES.rateLimited, 429, rate.retryAfter)
  }

  /* ── What ── */
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fallback(ORBI_ASK_MESSAGES.error, 400)
  }

  const raw = (body as { messages?: unknown })?.messages
  if (!Array.isArray(raw) || raw.length === 0) {
    return fallback(ORBI_ASK_MESSAGES.error, 400)
  }
  // Checked before anything is read out of it, so a huge array costs nothing.
  if (raw.length > ORBI_ASK.maxMessages) {
    return fallback(ORBI_ASK_MESSAGES.error, 400)
  }
  if (!raw.every(isAskTurn)) {
    return fallback(ORBI_ASK_MESSAGES.error, 400)
  }

  const turns = raw as OrbiAskTurn[]

  // Refused rather than truncated: answering a shortened version of someone's
  // question is worse than telling them it was too long.
  if (turns.some((turn) => turn.content.length > ORBI_ASK.maxInput)) {
    return fallback(ORBI_ASK_MESSAGES.tooLong, 400)
  }

  // A conversation has to start with, and end on, the visitor.
  const trimmed = turns.slice(-ORBI_ASK.maxHistory)
  while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift()
  if (!trimmed.length || trimmed[trimmed.length - 1].role !== 'user') {
    return fallback(ORBI_ASK_MESSAGES.error, 400)
  }

  /* ── Ask ── */
  // Resolved per request, not per process: an operator can change the provider
  // without the route caring, and a key that arrives later is picked up.
  const provider = resolveOrbiProvider()
  if (!provider) {
    // Nothing is configured and nothing was requested. Say so plainly rather
    // than implying a retry will help — and never quietly reach for a network
    // provider nobody asked for. The site is entirely usable regardless.
    return fallback(ORBI_ASK_MESSAGES.unavailable, 503)
  }

  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), ORBI_ASK.serverTimeoutMs)

  try {
    const reply = await provider.ask(trimmed, abort.signal)
    // Normalised once more on the way out. A provider is not trusted to
    // police its own action, whichever one answered.
    return NextResponse.json({
      message: reply.message,
      action: normaliseAction(reply.action),
      outcome: normaliseOutcome(reply.outcome),
      emotion: normaliseEmotion(reply.emotion),
    })
  } catch (error) {
    // Logged for the operator with the provider that failed, never returned
    // to the browser.
    console.error(
      `[orbi/chat] ${provider.name}:`,
      error instanceof Error ? error.message : error,
    )
    return fallback(ORBI_ASK_MESSAGES.error, 502)
  } finally {
    clearTimeout(timer)
  }
}

/** Anything but POST is not a question. */
export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
