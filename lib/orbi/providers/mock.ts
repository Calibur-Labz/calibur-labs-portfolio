import { techStack } from '../../data'
import {
  normaliseAction,
  type OrbiAskAction,
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

/** Everything the mock is allowed to say. Nothing is generated. */
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
    // "I want to build an ecommerce website" — someone describing work, not
    // asking a question. The most valuable thing a visitor ever types.
    id: 'build',
    keys: [
      'i want to build',
      'want to build',
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

/** Which intent a question belongs to, or `null` for the fallback. */
export function matchOrbiIntent(question: string): {
  id: string
  message: string
  action: OrbiAskAction
} | null {
  const text = normalise(question)
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

    return {
      message: hit?.message ?? REPLIES.fallback,
      // Normalised here as well as in the route. The mock's actions are
      // literals today, but a provider is not trusted to police itself.
      action: normaliseAction(hit?.action),
    }
  },
}

export const ORBI_MOCK_REPLIES = REPLIES
