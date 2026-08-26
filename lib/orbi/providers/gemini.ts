import {
  normaliseAction,
  normaliseEmotion,
  normaliseOutcome,
  ORBI_ACTIONS,
  ORBI_ASK_EMOTIONS,
  ORBI_ASK_OUTCOMES,
  ORBI_ASK,
  type OrbiAskReply,
  type OrbiAskTurn,
} from '../../../components/orbi/orbiAsk'
import { ORBI_SYSTEM_PROMPT } from '../orbiKnowledge'
import type { OrbiProvider } from './types'

/**
 * The Gemini provider.
 *
 * One more implementation behind `OrbiProvider` — the route, the contract, the
 * panel and the action enum are untouched, and nothing downstream can tell
 * that Gemini answered rather than Claude or the script.
 *
 * Two deliberate shapes here:
 *
 *  - **The SDK is imported dynamically, inside `ask`.** `ready()` only reads an
 *    env var, so a project running in mock mode never loads `@google/genai` at
 *    all — no cost to keyless local development, which is the point of the
 *    mock existing.
 *  - **The same system prompt as every other provider.** ORBI's personality,
 *    scope and refusals live in `orbiKnowledge.ts`; there is no Gemini-flavoured
 *    ORBI, and no second copy of the company facts to drift.
 *
 * There is also a small capacity fallback: a Flash model that reports itself
 * busy (503 / UNAVAILABLE) is stepped over in favour of the next one in the
 * chain. That is the *only* condition that earns a second attempt — see
 * `isGeminiCapacityError`.
 */

/** Not `NEXT_PUBLIC_` — this must never be inlined into a client bundle. */
const API_KEY = process.env.GEMINI_API_KEY

export const GEMINI_CONFIG = {
  /**
   * Flash tier, not Pro. The workload is a handful of short answers grounded in
   * a reference that already fits in the prompt — the things Pro is better at
   * are things this never does, and latency is what a visitor actually feels.
   *
   * `gemini-3.7-flash` is the current stable Flash model and supports the
   * structured output this provider depends on.
   *
   * Overridable so a newer model — or a Flash-Lite variant, once one has been
   * live-tested against `responseSchema` — can be dropped in without a code
   * change or a deploy of this file.
   */
  model: process.env.ORBI_GEMINI_MODEL?.trim() || 'gemini-3.7-flash',
  /**
   * Where to go when the preferred model has no capacity.
   *
   * Not a retry policy — the same model twice is pointless when the answer was
   * "this model is busy". This is a *different* model, tried once, and only
   * for that one reason. Everything else fails on the first attempt.
   */
  fallbackModels: ['gemini-3.6-flash', 'gemini-3.5-flash'],
  /** Hard ceiling on models tried per request, however the chain is built. */
  maxAttempts: 3,
  /**
   * The most any single model may have.
   *
   * Phase 27. The chain used to share one deadline with the whole request, so
   * a model that sat on a connection for the full budget before finally
   * answering 503 took the fallback down with it — the abort fired first, and
   * an abort is (correctly) not something another model can fix. The result
   * was a fallback chain that could not fall back in the one situation it was
   * built for.
   *
   * Each attempt now gets a slice of what is left rather than all of it. The
   * visitor's total wait is unchanged: the route's timeout is still the only
   * ceiling, and this only decides how that ceiling is divided.
   */
  attemptMaxMs: 18000,
  /**
   * Below this, do not start another model at all.
   *
   * A three-second window is not a fair attempt — it is a near-certain second
   * timeout that spends the rest of the visitor's patience to tell them the
   * same thing. Better to stop and answer with what we already know.
   */
  attemptMinMs: 4000,
  /**
   * Enough for the three short paragraphs the instructions allow, plus the
   * JSON envelope. ORBI is a portfolio companion, not an essay writer.
   */
  maxOutputTokens: 800,
  /** Low. These are factual company questions; answers should not wander. */
  temperature: 0.3,
} as const

/**
 * The reply shape, as Gemini's schema dialect.
 *
 * `action` is an enum in the schema, so the model is constrained to the six
 * words rather than asked nicely for them. That is a convenience, not a
 * guarantee — `parseGeminiReply` re-checks it, the route re-checks it, and the
 * browser re-checks it again.
 */
export const REPLY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    message: { type: 'STRING' },
    action: { type: 'STRING', enum: [...ORBI_ACTIONS] },
    outcome: { type: 'STRING', enum: [...ORBI_ASK_OUTCOMES] },
    emotion: { type: 'STRING', enum: [...ORBI_ASK_EMOTIONS] },
  },
  required: ['message', 'action', 'outcome', 'emotion'],
  propertyOrdering: ['message', 'action', 'outcome', 'emotion'],
} as const

/**
 * Our turns → Gemini's `contents`.
 *
 * Gemini calls the assistant `model`; our contract calls it `assistant`. Only
 * the two roles the route already validated can arrive here, and anything else
 * is dropped rather than mapped — a role this does not recognise has no
 * business becoming one Gemini does.
 *
 * Visitor text goes in `parts`, never into the system instruction, so the
 * boundary between what ORBI was told and what a visitor typed survives.
 */
export function toGeminiContents(
  turns: OrbiAskTurn[],
): Array<{ role: string; parts: Array<{ text: string }> }> {
  return turns
    .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
    .map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    }))
}

/**
 * Gemini's text → our contract.
 *
 * Everything is treated as untrusted, because the schema is the provider's
 * promise rather than ours: a truncated response, a safety block, a stray
 * markdown fence or an action outside the enum all end here, and all of them
 * either throw (nothing useful to show) or degrade to `NO_ACTION` (an answer
 * with no button).
 */
export function parseGeminiReply(raw: string | undefined): OrbiAskReply {
  if (!raw || !raw.trim()) throw new Error('empty reply')

  // A model told to emit JSON occasionally wraps it in a fence anyway.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('reply was not JSON')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('reply was not an object')
  }

  const { message, action, outcome, emotion } = parsed as {
    message?: unknown
    action?: unknown
    outcome?: unknown
    emotion?: unknown
  }
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) throw new Error('reply had no message')
  if (text.length > ORBI_ASK.maxInput * 4) throw new Error('reply was too long')

  return {
    message: text,
    action: normaliseAction(action),
    outcome: normaliseOutcome(outcome),
    // The schema constrains this to seven words; the normaliser assumes it
    // did not. Structured output is a convenience, never the guarantee.
    emotion: normaliseEmotion(emotion),
  }
}

/**
 * Anything that might carry a credential, on its way to a log.
 *
 * The SDK does not put the key in error messages, but a provider error is the
 * one string this file hands to `console.error`, and a key in a log is a key
 * in a log however it got there.
 *
 * Two passes, because pattern-matching a key format is a losing game: Google
 * issues at least `AIza…` and `AQ.…` keys, and Phase 22 found a live key in
 * the second format that the original `AIza`-only pattern walked straight
 * past.
 */
export function redactGemini(text: string, key: string | undefined = API_KEY): string {
  // The configured key first: an exact match cannot go out of date.
  const safe = key && key.length >= 8 ? text.split(key).join('[redacted]') : text
  // ...then the known prefixes, as a net for any *other* key in the string.
  return safe
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]')
    .replace(/AQ\.[0-9A-Za-z_.-]{10,}/g, '[redacted]')
}

/**
 * The models to try, in order.
 *
 * Preferred first, then the fallbacks, de-duplicated so pointing
 * `ORBI_GEMINI_MODEL` at one of the fallbacks does not queue it twice, and
 * capped at `maxAttempts`. Pure and exported so the ordering can be checked
 * without a network.
 */
export function geminiModelChain(
  preferred: string = GEMINI_CONFIG.model,
): string[] {
  const chain: string[] = []
  for (const model of [preferred, ...GEMINI_CONFIG.fallbackModels]) {
    const name = model.trim()
    if (!name || chain.includes(name)) continue
    chain.push(name)
    if (chain.length >= GEMINI_CONFIG.maxAttempts) break
  }
  return chain
}

/** An abort is the route giving up, never a reason to try another model. */
export function isAbortError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { name?: unknown; message?: unknown }
  if (e.name === 'AbortError') return true
  return typeof e.message === 'string' && /abort/i.test(e.message)
}

/**
 * Is this "the model is busy", or is it "the request was wrong"?
 *
 * Only the first earns another model. A bad key, a rejected schema, an
 * exhausted quota or a safety block would fail identically on every model in
 * the chain, so trying two more would turn one clear failure into three slow
 * ones — and burn the route's timeout doing it.
 *
 * Read from the SDK's numeric `status` and from the JSON body Google embeds in
 * the message, because the live error carries the useful part in the latter.
 */
export function isGeminiCapacityError(error: unknown): boolean {
  if (isAbortError(error)) return false
  if (typeof error !== 'object' || error === null) return false

  const e = error as { status?: unknown; message?: unknown }

  // `ApiError.status` — the HTTP code, when the SDK surfaces one.
  if (e.status === 503) return true
  if (typeof e.status === 'number' && e.status !== 503) return false

  const message = typeof e.message === 'string' ? e.message : ''
  if (!message) return false

  // Phase 27. Quota is not capacity, and it is checked first because the two
  // are worded almost identically: a quota refusal also ends with "please try
  // again later", which the loose text match at the bottom of this function
  // would otherwise read as an overloaded model. Trying a different model on
  // an exhausted quota burns the remaining budget to be refused twice.
  if (/RESOURCE_EXHAUSTED|quota|rate limit|\b429\b/i.test(message)) return false
  // Nor are the request's own faults. Same reasoning: a different model gets
  // the same bad request and gives the same answer.
  if (/PERMISSION_DENIED|UNAUTHENTICATED|INVALID_ARGUMENT|\b40[0-3]\b/i.test(message)) {
    return false
  }

  // Google embeds `{"error":{"code":503,"status":"UNAVAILABLE",...}}`.
  try {
    const parsed = JSON.parse(message) as {
      error?: { code?: unknown; status?: unknown }
    }
    const inner = parsed?.error
    if (inner) {
      if (inner.code === 503) return true
      if (typeof inner.code === 'number') return false
      return inner.status === 'UNAVAILABLE'
    }
  } catch {
    // Not JSON — fall through to the text checks below.
  }

  if (/\b503\b/.test(message)) return true
  if (/UNAVAILABLE/.test(message)) return true
  return /currently experiencing high demand|overloaded|try again later/i.test(
    message,
  )
}

/**
 * The per-attempt deadline, as its own error type.
 *
 * It has to be told apart from the caller's abort: the caller giving up means
 * stop, but *this* model running out of its slice means try the next one. They
 * are both aborts at the transport level, which is exactly why the distinction
 * lives here rather than being inferred from a message.
 */
class GeminiAttemptTimeout extends Error {
  constructor(model: string) {
    super(`attempt budget exhausted: ${model}`)
    this.name = 'GeminiAttemptTimeout'
  }
}

/**
 * One signal that fires when either the caller aborts or the slice runs out.
 *
 * Linked by hand rather than with `AbortSignal.any`, which is recent enough
 * that not every runtime this might be deployed to has it. The listener and
 * the timer are both cleaned up on the way out, whichever of them won.
 */
function attemptSignal(
  outer: AbortSignal | undefined,
  budgetMs: number,
): { signal: AbortSignal; timedOut: () => boolean; done: () => void } {
  const controller = new AbortController()
  let expired = false

  const timer = setTimeout(() => {
    expired = true
    controller.abort()
  }, budgetMs)

  const onOuterAbort = () => controller.abort()
  if (outer) {
    if (outer.aborted) controller.abort()
    else outer.addEventListener('abort', onOuterAbort, { once: true })
  }

  return {
    signal: controller.signal,
    timedOut: () => expired,
    done: () => {
      clearTimeout(timer)
      outer?.removeEventListener('abort', onOuterAbort)
    },
  }
}

/**
 * How long the next model gets: what is left, capped.
 *
 * The cap is the whole mechanism. It is *not* an even split between the models
 * still to try, and that was the first thing measured production traffic
 * disproved: real successful answers from the preferred model came back in
 * 4.4s, 15.0s, 16.4s and 21.5s, so dividing a 25s budget three ways would have
 * given the primary 8.3s and killed most of the answers it was going to
 * deliver. A fallback that fires on healthy traffic is worse than no fallback.
 *
 * So the preferred model gets a genuine attempt — up to the cap — and the cap
 * exists only to guarantee that *something* is left for one more model. With
 * an 18s cap inside a 25s request, a model that hangs and then fails still
 * leaves 7s, which is a real attempt at Flash latency rather than a token one.
 *
 * `null` means the remainder is too small to be an attempt at all: starting a
 * three-second call spends the rest of the visitor's patience to be told the
 * same thing twice.
 */
export function attemptBudget(
  remainingMs: number,
  _modelsLeft: number,
  max: number = GEMINI_CONFIG.attemptMaxMs,
  min: number = GEMINI_CONFIG.attemptMinMs,
): number | null {
  if (remainingMs < min) return null
  return Math.min(max, remainingMs)
}

/**
 * Walk the chain until one model answers.
 *
 * Takes the per-model call as an argument rather than making it, so the
 * attempt count, the stop conditions and the logging can all be tested with a
 * fake and no key. No timer and no backoff: the route's abort is the only
 * clock, and a busy model is answered by asking a different one immediately.
 */
export async function runGeminiChain(
  models: string[],
  attempt: (model: string, signal: AbortSignal) => Promise<OrbiAskReply>,
  signal?: AbortSignal,
  options: {
    budgetMs?: number
    now?: () => number
    /** Overridable so the slice arithmetic can be exercised without a 12s test. */
    attemptMaxMs?: number
    attemptMinMs?: number
  } = {},
): Promise<OrbiAskReply> {
  const now = options.now ?? (() => Date.now())
  const started = now()
  const budgetMs = options.budgetMs ?? ORBI_ASK.serverTimeoutMs
  let lastError: unknown = new Error('no model was attempted')

  for (let i = 0; i < models.length; i++) {
    // The caller gave up. Not something a different model can fix.
    if (signal?.aborted) throw new Error('aborted')
    const model = models[i]

    // Phase 27. Each model gets a share of what is left rather than all of it,
    // so a slow first model cannot spend the budget the fallback needs.
    const slice = attemptBudget(
      budgetMs - (now() - started),
      models.length - i,
      options.attemptMaxMs,
      options.attemptMinMs,
    )
    if (slice === null) {
      console.warn('[orbi/chat] gemini budget exhausted before next attempt')
      break
    }

    const attemptAbort = attemptSignal(signal, slice)
    try {
      return await attempt(model, attemptAbort.signal)
    } catch (error) {
      // A slice running out is *this model* being too slow, which is exactly
      // what the next model is for. Checked before the abort test, because at
      // the transport level the two are the same kind of failure.
      if (attemptAbort.timedOut() && !signal?.aborted) {
        lastError = new GeminiAttemptTimeout(model)
        console.warn(`[orbi/chat] gemini attempt timeout: ${model}`)
        const next = models[i + 1]
        if (next) console.warn(`[orbi/chat] gemini fallback: ${next}`)
        continue
      }

      lastError = error
      // The route gave up, or the request itself is wrong. Either way another
      // model cannot help.
      if (isAbortError(error)) throw error
      if (!isGeminiCapacityError(error)) throw error

      // Model names only — never a key, a prompt or anything a visitor typed.
      console.warn(`[orbi/chat] gemini unavailable: ${model}`)
      const next = models[i + 1]
      if (next) console.warn(`[orbi/chat] gemini fallback: ${next}`)
    } finally {
      attemptAbort.done()
    }
  }

  throw lastError
}

function configured(): boolean {
  return typeof API_KEY === 'string' && API_KEY.length > 0
}

async function ask(
  turns: OrbiAskTurn[],
  signal?: AbortSignal,
): Promise<OrbiAskReply> {
  if (!configured()) throw new Error('GEMINI_API_KEY is not set')

  // Loaded here, not at module scope: mock mode must not pay for a package it
  // will never call.
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey: API_KEY })

  // Built once, outside the loop: every attempt sends the same instruction,
  // the same schema, the same history and the same limits. Only the model name
  // differs, so a fallback answers the question that was actually asked.
  const contents = toGeminiContents(turns)
  const config = {
    // The instruction channel, kept separate from anything a visitor typed.
    systemInstruction: ORBI_SYSTEM_PROMPT,
    responseMimeType: 'application/json',
    responseSchema: REPLY_SCHEMA as never,
    temperature: GEMINI_CONFIG.temperature,
    maxOutputTokens: GEMINI_CONFIG.maxOutputTokens,
    /*
     * No `thinkingConfig`.
     *
     * Phase 19 set `thinkingBudget: 0` to keep a lookup cheap. Phase 22 tested
     * it against the live API and it is **not portable**: `gemini-3.6-flash`
     * rejects it outright with 400 INVALID_ARGUMENT — breaking the chain at
     * exactly the model it falls back *to*. `thinkingLevel: 'low'` is no
     * better; it fails on 2.5.
     *
     * Only omitting the field works on every model in the chain, so each model
     * uses its own default now. `maxOutputTokens` still caps what comes back,
     * which is where the real cost is.
     */
    /*
     * The default only. Every attempt replaces this with its own signal, which
     * aborts either when the route gives up or when that model has used its
     * slice of the budget — see `runGeminiChain`. Kept here so a future caller
     * that bypasses the chain still inherits the request's clock rather than
     * running unbounded.
     */
    abortSignal: signal,
  }

  try {
    return await runGeminiChain(
      geminiModelChain(),
      async (model, attemptSig) => {
        // The *attempt's* signal, not the request's: this is what bounds one
        // model rather than the whole chain.
        const response = await ai.models.generateContent({
          model,
          contents,
          config: { ...config, abortSignal: attemptSig },
        })
        return parseGeminiReply(response.text)
      },
      signal,
    )
  } catch (error) {
    // Auth failure, quota, 500, a safety block, a malformed body, or every
    // model in the chain being busy — all one kind of thing to everything
    // above here, and none of them reach a visitor. Re-thrown with the message
    // scrubbed so the route can log it.
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(redactGemini(detail))
  }
}

export const geminiProvider: OrbiProvider = {
  name: 'gemini',
  ready: configured,
  ask,
}
