import {
  monthlyPriceUsd,
  orbiAddOns,
  orbiPackages,
  setupPriceUsd,
  techStack,
} from '../../data'
import {
  normaliseAction,
  normaliseEmotion,
  type OrbiAskAction,
  type OrbiAskEmotion,
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
/**
 * Lowest setup fee wins; ties keep document order. Ranked on what a visitor
 * actually pays, so a tier running an offer is compared at its offer price
 * rather than at a list price nobody is being charged.
 */
const cheapest = () =>
  orbiPackages.reduce((a, b) => (setupPriceUsd(a) <= setupPriceUsd(b) ? a : b))
/** The tier the page promotes, falling back to the dearest if none is flagged. */
const popular = () =>
  orbiPackages.find((p) => p.popular) ??
  orbiPackages.reduce((a, b) => (setupPriceUsd(a) >= setupPriceUsd(b) ? a : b))

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
  )}. They start at ${usd(setupPriceUsd(cheapest()))} one-time plus ${usd(
    monthlyPriceUsd(cheapest()),
  )} a month.`,
  pricing: `${orbiPackages
    .map(
      (p) =>
        `${p.name} is ${usd(setupPriceUsd(p))} one-time plus ${usd(monthlyPriceUsd(p))} a month` +
        (p.discount ? ` (${p.discount.label})` : ''),
    )
    .join('; ')}. Those are starting prices for a standard build — for anything custom the team can give you an accurate quote.`,
  cheapest: `${cheapest().name} is the most affordable tier, at ${usd(
    setupPriceUsd(cheapest()),
  )} one-time plus ${usd(monthlyPriceUsd(cheapest()))} a month.`,
  best: `${popular().name} is the one most people pick, at ${usd(
    setupPriceUsd(popular()),
  )} one-time plus ${usd(monthlyPriceUsd(popular()))} a month.`,
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
  /**
   * Phase 25. Three lines that exist so the *social* half of a conversation
   * lands somewhere better than the fallback: a greeting, a compliment and a
   * thank-you are all things a visitor says, and answering them with "ask me
   * about our services" reads as a robot that was not listening.
   */
  greeting:
    'Hey — I’m ORBI. Ask me about our services, our work, the technologies we use, or how to reach the team.',
  compliment:
    'Thank you, that’s kind. I’ll pass it on to the team. Anything you’d like to see while you’re here?',
  thanks: 'Any time. Ask me anything else while you’re looking around.',
  /**
   * Something is wrong, or something did not land. Calm and useful: ORBI
   * neither argues nor apologises twice, and the one thing he can actually do
   * is put the visitor in front of the people who can fix it.
   */
  negative:
    'Sorry about that — thanks for telling me. I can’t fix it myself, but the team would want to know, and the contact form reaches them directly.',
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
      'build my',
      'want you to build',
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
  /*
   * Phase 25 — the social tail of the table.
   *
   * Deliberately *last*. Every one of these matches on words that also turn up
   * inside real questions ("I love your pricing", "this package is confusing"),
   * and a visitor asking about pricing while being nice about it wants the
   * pricing answer. Sitting below every business intent means these can only
   * ever catch what nothing else wanted — which is exactly when they are right.
   */
  {
    id: 'greeting',
    keys: ['hi orbi', 'hey orbi', 'hello', 'hiya', 'good morning', 'good afternoon', 'good evening', 'how are you'],
    message: REPLIES.greeting,
    action: 'NO_ACTION',
  },
  {
    id: 'thanks',
    keys: ['thank you', 'thanks', 'cheers', 'appreciate it', 'much appreciated'],
    message: REPLIES.thanks,
    action: 'NO_ACTION',
  },
  {
    id: 'negative',
    keys: [
      'broken', 'is a bug', 'has a bug', 'a bug', 'glitch', 'crashed', 'crashes',
      'not working', 'doesnt work', "doesn't work", 'does not work', 'dont work',
      "don't work", 'not work', 'dont like', "don't like", 'do not like',
      'confusing', 'confused', 'frustrating', 'annoying', 'terrible', 'awful', 'useless',
      'dont understand', "don't understand", 'do not understand',
    ],
    message: REPLIES.negative,
    action: 'SHOW_CONTACT',
  },
  {
    id: 'compliment',
    keys: [
      'cool robot', 'cute', 'adorable', 'love this', 'love your', 'love it',
      'like orbi', 'like this', 'nice website', 'nice site', 'nice work',
      'amazing', 'awesome', 'so cool', 'really cool', 'very cool', 'impressive',
      'beautiful', 'well done', 'great job', 'looks great', 'looks good',
    ],
    message: REPLIES.compliment,
    action: 'NO_ACTION',
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
  // "hi" is two letters, and the table matches on substrings — as a key it
  // would fire inside "which", "this" and "hire". Whole-message equality is
  // the only safe way to catch a bare greeting, so it is checked rather than
  // listed. A greeting cannot be anything else, so its position is harmless.
  if (BARE_GREETINGS.has(text)) {
    return { id: 'greeting', message: REPLIES.greeting, action: 'NO_ACTION' }
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
const UNSURE_INTENTS = new Set(['quote'])

/**
 * Greetings short enough that they can only be matched whole.
 *
 * `text` here has already been through `normalise`, so punctuation is gone and
 * "Hi!" and "  hi  " both arrive as "hi".
 */
const BARE_GREETINGS = new Set(['hi', 'hey', 'hello', 'yo', 'hiya', 'sup', 'howdy', 'hi there', 'hey there'])

/**
 * Phase 25 — what each intent *feels* like.
 *
 * A lookup, not an inference: every entry is a fixed word chosen here, so the
 * mock demonstrates the emotion system without pretending to understand
 * anything. Anything absent is `normal`, which is most of the table on
 * purpose — a companion who reacts to "what technologies do you use?" is
 * exhausting, and the brief is explicit that normal is the resting state.
 */
const INTENT_EMOTION: Readonly<Record<string, OrbiAskEmotion>> = {
  greeting: 'happy',
  compliment: 'happy',
  thanks: 'happy',
  negative: 'concerned',
  // Someone describing work they want is the most valuable thing a visitor
  // ever types, and the one place enthusiasm is the honest reaction.
  build: 'excited',
  ecommerce: 'excited',
  quote: 'excited',
  // Helping someone choose is genuinely uncertain — the reply says so in
  // words ("it depends what you need"), and the face should agree.
  recommend: 'unsure',
}

/**
 * The visitor's tone, where it should outrank the topic.
 *
 * Two narrow cases, both of which the table cannot reach on its own because a
 * business intent matches first: "I don't understand your packages" is the
 * packages answer said to someone who is struggling, and "I love your work"
 * is the projects answer said to someone being kind. The topic decides what
 * ORBI *says*; this decides how he says it.
 *
 * Kept to two word lists on purpose. It is not sentiment analysis and must
 * not grow into it — anything subtler than this belongs to the real provider,
 * which reads the sentence rather than scanning it.
 */
const STRUGGLING = [
  'dont understand', "don't understand", 'do not understand', 'confusing', 'confused',
  'broken', 'not working', 'doesnt work', "doesn't work", 'does not work',
  'dont work', "don't work", 'glitch', 'crashed', 'frustrating', 'annoying',
  'dont like', "don't like", 'do not like', 'terrible', 'awful', 'useless',
] as const

const KIND = [
  'love this', 'love your', 'love it', 'love the', 'amazing', 'awesome',
  'impressive', 'beautiful', 'well done', 'great job', 'looks great',
  'so cool', 'really cool', 'very cool', 'cool robot', 'nice work',
  'thank you', 'thanks',
] as const

/**
 * Which feeling a question earns. Deterministic, and never derived from the
 * answer — only from what the visitor typed and which intent it landed on.
 */
export function mockEmotionFor(question: string, intentId: string | null): OrbiAskEmotion {
  const text = normalise(question)
  // Struggling wins over kind: "I love this but it's broken" is a bug report.
  if (STRUGGLING.some((key) => text.includes(key))) return 'concerned'
  if (KIND.some((key) => text.includes(key))) return 'happy'
  // Nothing recognised at all — ORBI is about to say so, and should look it.
  if (!intentId) return 'unsure'
  return INTENT_EMOTION[intentId] ?? 'normal'
}

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
      // Same rule for the emotion: a literal from a table, put through the
      // same gate an untrusted model's answer goes through.
      emotion: normaliseEmotion(mockEmotionFor(question, hit?.id ?? null)),
    }
  },
}

export const ORBI_MOCK_REPLIES = REPLIES
