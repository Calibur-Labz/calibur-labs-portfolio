/**
 * Ask ORBI — the contract.
 *
 * Shared by the browser and the route handler, and deliberately the only thing
 * they share. It carries no key, no prompt and no knowledge: just the shapes,
 * the limits, and the two validators that both sides run.
 *
 * The action is an **enum and nothing else**. The model never names a
 * selector, a URL, a function or an element — it picks one of six words, and
 * both ends check that word against this list before anything happens. A word
 * that is not on the list is not an error, it is `NO_ACTION`: the answer still
 * shows, and no button appears.
 */

/** Every destination ORBI may offer. Anything else is `NO_ACTION`. */
export const ORBI_ACTIONS = [
  'SHOW_SERVICES',
  'SHOW_PROJECTS',
  'SHOW_TESTIMONIALS',
  'SHOW_ABOUT',
  'SHOW_CONTACT',
  'NO_ACTION',
] as const

export type OrbiAskAction = (typeof ORBI_ACTIONS)[number]

/**
 * Action → the guide-mode destination that already exists.
 *
 * Phase 12 owns navigation; this is only a lookup. The ids are the same ones
 * `ORBI_GUIDE_ITEMS` targets, so an action can never point somewhere the menu
 * could not already take you.
 */
export const ORBI_ACTION_TARGETS: Record<
  Exclude<OrbiAskAction, 'NO_ACTION'>,
  string
> = {
  SHOW_SERVICES: 'services',
  SHOW_PROJECTS: 'work',
  SHOW_TESTIMONIALS: 'testimonials',
  SHOW_ABOUT: 'about',
  SHOW_CONTACT: 'contact',
}

/** What the button under an answer says. */
export const ORBI_ACTION_LABELS: Record<
  Exclude<OrbiAskAction, 'NO_ACTION'>,
  string
> = {
  SHOW_SERVICES: 'View Services',
  SHOW_PROJECTS: 'See Our Work',
  SHOW_TESTIMONIALS: 'Read Client Stories',
  SHOW_ABOUT: 'About Calibur',
  SHOW_CONTACT: 'Let’s Talk',
}

/**
 * The four questions offered before anyone has typed.
 *
 * Not shortcuts: pressing one sends exactly this text through exactly the path
 * a typed question takes — same validation, same rate limit, same provider,
 * same enum. There is no second code path to keep in step, which is the only
 * reason they are safe to add.
 *
 * The wording is chosen to cover the four things a visitor actually wants from
 * a portfolio: what you do, what you have done, how you build, and how to
 * start. Every one of them matches an intent in the scripted provider too, so
 * they work with no key configured.
 */
export const ORBI_ASK_STARTERS = [
  'What services do you offer?',
  'Show me your work',
  'What technologies do you use?',
  'I want to start a project',
] as const

/**
 * Anything at all → a known action.
 *
 * Never throws and never trusts its input: this runs on the model's output on
 * the server, and again on the server's output in the browser. Both callers
 * treat "I do not recognise this" as "do nothing", which is why the return
 * type has no failure case.
 */
export function normaliseAction(value: unknown): OrbiAskAction {
  if (typeof value !== 'string') return 'NO_ACTION'
  const upper = value.trim().toUpperCase()
  return (ORBI_ACTIONS as readonly string[]).includes(upper)
    ? (upper as OrbiAskAction)
    : 'NO_ACTION'
}

export const ORBI_ASK = {
  endpoint: '/api/orbi/chat',
  /**
   * Longest question accepted. Anything longer is refused by the route with a
   * 400 rather than truncated — silently answering a different question than
   * the one someone typed is worse than saying no.
   */
  maxInput: 800,
  /** How many turns of history travel with a question. */
  maxHistory: 10,
  /** ...and the hard cap on what the route will accept, before validation. */
  maxMessages: 24,
  /** Client-side abort. Sits under the route's own ceiling. */
  clientTimeoutMs: 30000,
  /** Server-side ceiling on the provider call. */
  serverTimeoutMs: 25000,
  /* ── Rate limiting ── */
  windowMs: 60000,
  maxPerWindow: 8,
  /** Two identical questions back to back are a double-click, not a question. */
  duplicateWindowMs: 1500,
  /**
   * How many turns stay on screen. Independent of `maxHistory`, which is what
   * the server is *told*: this only stops a long session growing a panel
   * taller than the phone it is on. Older turns scroll out of existence rather
   * than being remembered anywhere.
   */
  maxVisible: 12,
} as const

export interface OrbiAskTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface OrbiAskReply {
  message: string
  action: OrbiAskAction
}

/** Everything the panel is allowed to say when something goes wrong. */
export const ORBI_ASK_MESSAGES = {
  title: 'Ask ORBI',
  placeholder: 'What would you like to know?',
  send: 'Send',
  thinking: 'Thinking…',
  intro:
    'Ask me about xCalibur Labz — our services, our work, how we build, or how to get in touch.',
  /**
   * One line for every failure there is. A visitor does not need to know
   * whether it was a timeout, a 500 or a missing key, and the site behind ORBI
   * still works either way.
   */
  error:
    'I’m having a little trouble answering right now. You can still explore the site with me.',
  /** The one way out of a failed answer: the guide, which needs no provider. */
  explore: 'Explore with ORBI',
  rateLimited: 'That’s a lot of questions at once — give me a moment.',
  tooLong: 'That’s a bit long for me. Could you shorten it?',
  /**
   * No provider is configured at all. Distinct from `error` on purpose: this
   * is not a wobble that might pass, it is a feature that is not switched on,
   * and saying so plainly beats implying a retry will help.
   */
  unavailable: 'Ask ORBI is temporarily unavailable.',
  close: 'Close',
} as const

/** Validate one turn coming off the wire. */
export function isAskTurn(value: unknown): value is OrbiAskTurn {
  if (typeof value !== 'object' || value === null) return false
  const turn = value as Record<string, unknown>
  return (
    (turn.role === 'user' || turn.role === 'assistant') &&
    typeof turn.content === 'string' &&
    turn.content.length > 0
  )
}
