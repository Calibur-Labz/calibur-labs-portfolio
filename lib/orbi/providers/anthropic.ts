import Anthropic from '@anthropic-ai/sdk'
import {
  normaliseAction,
  ORBI_ACTIONS,
  ORBI_ASK,
  type OrbiAskReply,
  type OrbiAskTurn,
} from '../../../components/orbi/orbiAsk'
import { ORBI_SYSTEM_PROMPT } from '../orbiKnowledge'
import type { OrbiProvider } from './types'

/**
 * The Claude provider.
 *
 * One of the implementations behind `OrbiProvider`, and the only file in the
 * project that names a vendor. The route asks the registry for *a* provider
 * and calls `ask`; whether that reached a model or a lookup table is not
 * something anything downstream can tell.
 */

/** Not `NEXT_PUBLIC_` — this must never be inlined into a client bundle. */
const API_KEY = process.env.ANTHROPIC_API_KEY

/**
 * The shape the answer must arrive in.
 *
 * Structured output rather than "please reply with JSON": the action comes
 * back constrained to the enum by the API itself, so the validation on either
 * side of it is a second lock rather than the only one.
 */
const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    action: { type: 'string', enum: [...ORBI_ACTIONS] },
  },
  required: ['message', 'action'],
  additionalProperties: false,
} as const

class NotConfigured extends Error {}

function configured(): boolean {
  return typeof API_KEY === 'string' && API_KEY.length > 0
}

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!configured()) throw new NotConfigured('ANTHROPIC_API_KEY is not set')
  // Built once per server process, never per request.
  client ??= new Anthropic({ apiKey: API_KEY })
  return client
}

/**
 * `max_tokens` is small on purpose — the instructions ask for at most three
 * short paragraphs, and a portfolio companion that can produce an essay will
 * eventually produce one. Effort is `low` for the same reason: these are
 * lookups against a short reference, and latency is what the visitor feels.
 *
 * Throws on every failure. The route turns all of them into one sentence.
 */
async function ask(
  turns: OrbiAskTurn[],
  signal?: AbortSignal,
): Promise<OrbiAskReply> {
  const response = await getClient().messages.parse(
    {
      model: 'claude-opus-5',
      max_tokens: 1024,
      system: ORBI_SYSTEM_PROMPT,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: REPLY_SCHEMA },
      },
      messages: turns.map((turn) => ({ role: turn.role, content: turn.content })),
    },
    { signal, timeout: ORBI_ASK.serverTimeoutMs },
  )

  // A refusal, a truncation or a schema miss all land here as "no parsed
  // object". There is nothing useful to show, so it is a failure like any
  // other and the route says the one sentence.
  const parsed = response.parsed_output as
    | { message?: unknown; action?: unknown }
    | null

  const message = typeof parsed?.message === 'string' ? parsed.message.trim() : ''
  if (!message) throw new Error('empty reply')

  return { message, action: normaliseAction(parsed?.action) }
}

export const anthropicProvider: OrbiProvider = {
  name: 'anthropic',
  ready: configured,
  ask,
}
