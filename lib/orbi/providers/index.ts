import { anthropicProvider } from './anthropic'
import { geminiProvider } from './gemini'
import { mockProvider } from './mock'
import type { OrbiProvider } from './types'

export type { OrbiProvider } from './types'

/**
 * Every provider ORBI knows about.
 *
 * Adding one is a file and a line. `openai` is not stubbed here on purpose —
 * an entry that throws is worse than no entry, because it turns a clear
 * "unknown provider" into a runtime failure at the worst moment.
 */
const PROVIDERS: Record<string, OrbiProvider> = {
  mock: mockProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
}

export const ORBI_PROVIDER_NAMES = Object.keys(PROVIDERS)

/**
 * Which provider answers, and whether one can.
 *
 * The rules, in order:
 *
 *  1. `ORBI_AI_PROVIDER` names one → use exactly that, or nothing. An operator
 *     who asked for a provider gets it or gets told; they never get a silent
 *     substitution — `gemini` without `GEMINI_API_KEY` says "unavailable"
 *     rather than quietly answering from the script — and naming `mock` is how
 *     you deliberately ship the scripted assistant.
 *  2. Otherwise, a configured real provider wins.
 *  3. Otherwise, in development, the mock — so the whole feature builds, runs
 *     and tests with nothing configured at all.
 *  4. Otherwise — production, nothing configured, nothing requested — `null`.
 *
 * Rule 4 is the deliberate part. Falling back to the mock in production would
 * mean a deploy that lost its key still looks healthy while quietly answering
 * from a lookup table, and nobody finds out. Failing visibly is the safer of
 * the two, and `ORBI_AI_PROVIDER=mock` is right there for anyone who wants the
 * scripted assistant on purpose.
 */
export function resolveOrbiProvider(): OrbiProvider | null {
  const requested = process.env.ORBI_AI_PROVIDER?.trim().toLowerCase()

  if (requested) {
    const provider = PROVIDERS[requested]
    return provider?.ready() ? provider : null
  }

  // Nothing requested: whichever real provider is actually configured. Order
  // is only a tie-break for the unusual case of two keys being present at
  // once; naming one in `ORBI_AI_PROVIDER` is how you decide deliberately.
  for (const provider of [anthropicProvider, geminiProvider]) {
    if (provider.ready()) return provider
  }
  if (process.env.NODE_ENV !== 'production') return mockProvider
  return null
}
