import { orbiAddOns, orbiPackages, techStack } from '../../data'
import {
  normaliseAction,
  type OrbiAskAction,
  type OrbiAskOutcome,
  type OrbiAskReply,
  type OrbiAskTurn,
} from '../../../components/orbi/orbiAsk'
import type { OrbiProvider } from './types'

/**
 * Ask ORBI, without an AI.
 *
 * A scripted assistant: it reads the last question, matches it against a short
 * table of intents, and answers from a fixed script. That is the whole trick —
 * there is no model, no network call and no key, so the entire feature can be
 * built, demonstrated and regression-tested with nothing configured.
 *
 * Three properties make it useful rather than a stub:
 *
 *  - **Deterministic.** The same question always produces the same answer and
 *    the same delay, so a browser test can assert on it.
 *  - **Honest.** It never claims to be more than it is. Anything outside the
 *    table gets the same "here is what I can actually help with" line rather
 *    than a guess, which is exactly what the real provider is instructed to do
 *    with an out-of-scope question.
 *  - **Identical on the wire.** It returns the same `{ message, action }` as
 *    the real one, through the same normalisation, through the same route,
 *    through the same client validation. Nothing downstream can tell which
 *    provider answered — which is what makes swapping one in later safe.
 */

const usd = (amount: number) => `$${amount.toLocaleString('en-US')}`
/** Lowest setup fee wins; ties keep document order. */
const cheapest = () => orbiPackages.reduce((a, b) => (a.setupUsd <= b.setupUsd ? a : b))
/** The tier the page promotes, falling back to the dearest if none is flagged. */
const popular = () =>
  orbiPackages.find((p) => p.popular) ??
  orbiPackages.reduce((a, b) => (a.setupUsd >= b.setupUsd ? a : b))

/**
 * Everything the mock is allowed to say. The prose is fixed; every figure and
 * every product name is read from `lib/data.ts`.
 */
const REPLIES = {
  services:
    'We build modern web experiences, custom software, e-commerce solutions, and digital products.',
  projects: 'Sure. I can show you some of our work.',
  testimonials:
    'Take a look at what our clients have shared about working with us.',
  about:
    'xCalibur Labz is a software and digital development team focused on building polished, practical digital experiences.',
  contact: 'Let’s talk. I can take you to the contact section.',
  /**
   * The one answer assembled rather than written, because the stack is real
   * data and hard-coding it here would be the drift the knowledge file exists
   * to prevent.
   */
  technologies: `We work with ${formatList(techStack.map((t) => t.name))}.`,
  /**
   * The packages, and the prices, read from `orbiPackages` — the same array
   * the page renders and the same one the knowledge builder reads. A second
   * copy of the pricing table here is exactly the drift this whole approach
   * exists to prevent, so there is not one.
   */
  packages: `We license ORBI in three tiers: ${formatList(
    orbiPackages.map((p) => p.name),
  )}. They start at ${usd(cheapest().setupUsd)} one-time plus ${usd(
    cheapest().monthlyUsd,
  )} a month.`,
  pricing: `${orbiPackages
    .map((p) => `${p.name} is ${usd(p.setupUsd)} one-time plus ${usd(p.monthlyUsd)} a month`)
    .join('; ')}. Those are starting prices for a standard build — for anything custom the team can give you an accurate quote.`,
  cheapest: `${cheapest().name} is the most affordable tier, at ${usd(
    cheapest().setupUsd,
  )} one-time plus ${usd(cheapest().monthlyUsd)} a month.`,
  best: `${popular().name} is the one most people pick, at ${usd(
    popular().setupUsd,
  )} one-time plus ${usd(popular().monthlyUsd)} a month.`,
  /**
   * Anything the packages do not cover. Deliberately quotes no number at all —
   * a scripted assistant guessing at a custom price is the one failure mode
   * that costs real money.
   */
  quote:
    'That sounds like custom work, and I don’t have a price for it. Our team can give you an accurate quote — the contact form is the quickest way.',
  /**
   * Helping someone choose. Careful on purpose — "looks like the closest fit",
   * never "this is the one you need" — and it ends by handing the decision to
   * a human rather than closing it.
   */
  recommend: `It depends what you need: ${orbiPackages
    .map((p) => `${p.name} ${p.builds ? `adds to ${p.builds}` : 'covers the basics'}`)
    .join(', ')}. ${popular().name} looks like the closest fit for most business sites, but the team can confirm what suits yours.`,
  /**
   * There is no e-commerce *package* — e-commerce is a service the team builds
   * to order. Saying so is the difference between an honest answer and one
   * that invents a product.
   */
  ecommerce:
    'We build e-commerce and online stores as custom work rather than as an off-the-shelf package, so there’s no fixed price for one. The team can give you an accurate quote.',
  addOns: `On top of any tier we offer ${formatList(
    orbiAddOns.map((a) => `${a.name} at ${usd(a.priceUsd)} ${a.unit}`),
  )}.`,
  build:
    'That sounds like a good fit — e-commerce and custom builds are a lot of what we do. The quickest way to start is the contact form.',
  fallback:
    'I’m here mainly to help you explore xCalibur Labz. Ask me about our services, work, client stories, technologies, or how to get in touch.',
} as const

/**
 * The table, in order. First match wins, so the more specific intents — a
 * visitor describing a project they want — sit above the general ones.
 *
 * Every entry needs a real keyword hit. Nothing matches on filler like "tell
 * me" or "what is", which is what keeps an unrelated question, and an attempt
 * to talk ORBI out of his job, on the fallback line where they belong.
 */
const INTENTS: ReadonlyArray<{
  id: string
  keys: readonly string[]
  message: string
  action: OrbiAskAction
}> = [
  {
    /*
     * Custom work, and the cost of a website or an app.
     *
     * Highest priority of all, and it names no figure. The published prices
     * are for ORBI licences; the site publishes nothing for a bespoke build,
     * so any number here would be invented. This sits above every pricing
     * intent precisely so "how much does a website cost" can never be answered
     * with a package price.
     */
    id: 'quote',
    keys: [
      'custom quote', 'get a quote', 'quote for', 'a quote',
      'how much does a website', 'how much for a website', 'how much would a website',
      'website cost', 'cost of a website', 'website price', 'price of a website',
      'how much does an app', 'how much for an app', 'app cost', 'cost of an app',
      'custom price', 'custom work', 'bespoke',
    ],
    message: REPLIES.quote,
    action: 'SHOW_CONTACT',
  },
  {
    // Above `build`, whose "build an" would otherwise swallow "build an
    // online store".
    id: 'ecommerce',
    keys: ['ecommerce', 'e commerce', 'online store', 'online shop', 'shopping cart', 'webshop'],
    message: REPLIES.ecommerce,
    action: 'SHOW_CONTACT',
  },
  {
    id: 'cheapest',
    keys: ['cheapest', 'most affordable', 'lowest price', 'least expensive', 'budget option', 'entry level', 'starter package'],
    message: REPLIES.cheapest,
    action: 'NO_ACTION',
  },
  {
    id: 'recommend',
    keys: [
      'which package', 'what package should', 'which tier', 'which plan',
      'should i choose', 'recommend', 'good for a small', 'for a small business',
      'small business', 'suitable for', 'right for me', 'best for',
    ],
    message: REPLIES.recommend,
    action: 'NO_ACTION',
  },
  {
    id: 'best',
    keys: ['best package', 'best tier', 'best plan', 'most popular', 'top package', 'most complete'],
    message: REPLIES.best,
    action: 'NO_ACTION',
  },
  {
    id: 'addOns',
    keys: ['add on', 'addon', 'extra language', 'voice pack', 'custom character', 'extras'],
    message: REPLIES.addOns,
    action: 'NO_ACTION',
  },
  {
    id: 'pricing',
    keys: ['how much', 'price', 'pricing', 'cost', 'fee', 'subscription', 'per month', 'monthly'],
    message: REPLIES.pricing,
    action: 'NO_ACTION',
  },
  {
    id: 'packages',
    keys: ['package', 'product', 'tier', 'plan', 'licence', 'license'],
    message: REPLIES.packages,
    action: 'NO_ACTION',
  },
  {
    // "I want to build an ecommerce website" — someone describing work, not
    // asking a question. The most valuable thing a visitor ever types.
    id: 'build',
    keys: [
      'i want to build',
      'want to build',
      'want a website',
      'want an app',
      'need a website',
      'need an app',
      'build me',
      'build a',
      'build an',
      'hire',
      'quote',
      'get started',
      'work with you',
      'start a project',
    ],
    message: REPLIES.build,
    action: 'SHOW_CONTACT',
  },
  {
    id: 'contact',
    keys: [
      'contact',
      'get in touch',
      'reach you',
      'email',
      'phone',
      'talk to',
      'let us talk',
      'let’s talk',
      "let's talk",
      'speak to',
    ],
    message: REPLIES.contact,
    action: 'SHOW_CONTACT',
  },
  {
    id: 'technologies',
    keys: [
      'technolog',
      'tech stack',
      'stack',
      'framework',
      'language',
      'tools',
      'what do you use',
      'built with',
    ],
    message: REPLIES.technologies,
    action: 'NO_ACTION',
  },
  {
    id: 'testimonials',
    keys: [
      'client say',
      'clients say',
      'client stories',
      'testimonial',
      'review',
      'feedback',
      'reference',
      'what do clients',
    ],
    message: REPLIES.testimonials,
    action: 'SHOW_TESTIMONIALS',
  },
  {
    id: 'projects',
    keys: [
      'project',
      'your work',
      'portfolio',
      'case stud',
      'built before',
      'examples of',
      'show me your',
    ],
    message: REPLIES.projects,
    action: 'SHOW_PROJECTS',
  },
  {
    id: 'services',
    keys: [
      'service',
      'what do you do',
      'what do you provide',
      'what do you offer',
      'what can you build',
      'capabilit',
      'offer',
    ],
    message: REPLIES.services,
    action: 'SHOW_SERVICES',
  },
  {
    id: 'about',
    keys: [
      'about',
      'who are you',
      'who is',
      'your company',
      'the company',
      'xcalibur',
      'calibur',
      'the team',
      'your team',
      'founded',
    ],
    message: REPLIES.about,
    action: 'SHOW_ABOUT',
  },
]

/** Lower-cased, punctuation flattened, curly quotes folded to straight. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * Is this a question about the price of *custom build work*?
 *
 * The keyword table cannot answer this on its own, and Phase 22 proved it:
 * "give me your cheapest website development price" hit the `cheapest`
 * keyword and came back with the ORBI **licence** price, which is exactly the
 * confusion that costs real money. A published figure for licensing ORBI is
 * not a quote for building someone a website.
 *
 * So this runs *before* the table: something being built (a website, an app, a
 * store, a project) together with anything about money, and no mention of the
 * ORBI product line, is a custom-quote question whatever else it says.
 */
function isCustomBuildPricing(text: string, raw: string): boolean {
  const buildThing =
    /\b(website|web site|webpage|web page|site|landing page|homepage|home page|portfolio|blog|app|application|store|shop|platform|system|software|development|project|build|rebuild|redesign)\b/.test(
      text,
    )
  // Checked against the *raw* text as well: `normalise` strips punctuation, so
  // a currency symbol is long gone by the time the table sees it — and
  // "for $490?" is unmistakably a question about money.
  const money =
    /\b(price|pricing|cost|costs|quote|budget|cheap|cheapest|afford|affordable|how much|rate|fee|charge)/.test(
      text,
    ) || /\$\s?[0-9]/.test(raw)
  // A question genuinely about the ORBI tiers is not custom work, even though
  // "ORBI Core" is something we build.
  const aboutOrbiProduct =
    /\b(orbi|package|packages|tier|tiers|plan|plans|licence|license|subscription|add on|addon)\b/.test(
      text,
    )
  return buildThing && money && !aboutOrbiProduct
}

/** Which intent a question belongs to, or `null` for the fallback. */
export function matchOrbiIntent(question: string): {
  id: string
  message: string
  action: OrbiAskAction
} | null {
  const text = normalise(question)

  // Ahead of the table: never quote a licence price for a bespoke build.
  if (isCustomBuildPricing(text, question.toLowerCase())) {
    return { id: 'quote', message: REPLIES.quote, action: 'SHOW_CONTACT' }
  }
  // An apostrophe survives normalisation, so both spellings of "let's" match.
  for (const intent of INTENTS) {
    if (intent.keys.some((key) => text.includes(normalise(key)))) {
      return { id: intent.id, message: intent.message, action: intent.action }
    }
  }
  return null
}

/**
 * A short, *deterministic* pause.
 *
 * Long enough to see the thinking state and the thinking eyes, derived from
 * the question rather than from a random number so a test that asserts on
 * timing does not flake. No timer exists until a question is asked, and it is
 * cleared the moment it resolves.
 */
export function mockDelayFor(question: string, min = 400, max = 700): number {
  let hash = 0
  for (let i = 0; i < question.length; i++) {
    hash = (hash * 31 + question.charCodeAt(i)) >>> 0
  }
  return min + (hash % (max - min + 1))
}

/**
 * Which scripted answers are ORBI admitting he cannot help directly.
 *
 * `quote` and `ecommerce` both answer a real question — but the answer is
 * "the team has to price that", which is uncertainty, not knowledge. The
 * fallback line is the same thing for an off-topic question.
 */
const UNSURE_INTENTS = new Set(['quote', 'ecommerce'])

export const mockProvider: OrbiProvider = {
  name: 'mock',
  ready: () => true,
  async ask(turns: OrbiAskTurn[], signal?: AbortSignal): Promise<OrbiAskReply> {
    const question = [...turns].reverse().find((t) => t.role === 'user')?.content ?? ''
    const hit = matchOrbiIntent(question)

    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('aborted'))
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, mockDelayFor(question))
      function onAbort() {
        clearTimeout(timer)
        reject(new Error('aborted'))
      }
      signal?.addEventListener('abort', onAbort, { once: true })
    })

    // No match at all, or a match whose answer is "ask the team": both are
    // ORBI being unsure rather than informative.
    const outcome: OrbiAskOutcome =
      !hit || UNSURE_INTENTS.has(hit.id) ? 'unsure' : 'answered'

    return {
      message: hit?.message ?? REPLIES.fallback,
      // Normalised here as well as in the route. The mock's actions are
      // literals today, but a provider is not trusted to police itself.
      action: normaliseAction(hit?.action),
      outcome,
    }
  },
}

export const ORBI_MOCK_REPLIES = REPLIES
