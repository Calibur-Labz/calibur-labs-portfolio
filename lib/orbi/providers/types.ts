import type { OrbiAskReply, OrbiAskTurn } from '../../../components/orbi/orbiAsk'

/**
 * What every Ask ORBI provider is.
 *
 * Three members, and deliberately no more: a name for the operator, a question
 * of whether it can answer right now, and one call that returns the contract.
 * A provider never sees a `Request`, never touches headers, never decides
 * whether it is allowed to run and never validates its own output — the route
 * owns all of that, and normalising the action happens on the way out of here
 * *and* again in the route, so a provider cannot widen the action surface by
 * being careless.
 *
 * Adding Gemini or OpenAI later means one new file implementing this and one
 * line in the registry. Nothing above the boundary — not the route, not the
 * panel, not the contract — mentions a vendor.
 */
export interface OrbiProvider {
  /** Operator-facing. Appears in the dev HUD and the server log, nowhere else. */
  readonly name: string
  /**
   * Can this provider answer *right now*? A provider that needs a key returns
   * false without one; the mock is always ready.
   */
  ready(): boolean
  /**
   * Answer one question. Throws on any failure — the route turns every one of
   * them into the same single sentence.
   */
  ask(turns: OrbiAskTurn[], signal?: AbortSignal): Promise<OrbiAskReply>
}
