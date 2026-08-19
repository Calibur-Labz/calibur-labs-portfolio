/**
 * ORBI — section awareness.
 *
 * Sections declare what ORBI should do when they take the middle of the
 * viewport, and nothing else. Page sections stay free of ORBI logic: the map
 * below is keyed by the DOM `id` those sections already have, and `OrbiGuide`
 * builds one ScrollTrigger per entry.
 *
 * Client components can also register at runtime with `useOrbiSection`, which
 * is the same shape.
 */

import {
  type OrbiAnimation,
  type OrbiBreakpoint,
  type OrbiSectionBehavior,
} from './orbiConfig'

export type { OrbiSectionBehavior }

/**
 * The site's sections. Ids match the anchors the nav already links to
 * (`components/sections/*`); anything not listed here simply gets no reaction.
 */
export const ORBI_SECTION_BEHAVIORS: OrbiSectionBehavior[] = [
  {
    // Reading the copy on the left — curious, quiet, no bubble.
    id: 'about',
    expression: 'thinking',
    animation: 'look-left',
    expressionDuration: 3200,
  },
  {
    // Draws attention to the service cards, then keeps facing them.
    id: 'services',
    expression: 'happy',
    animation: 'point-left',
    restAnimation: 'look-left',
    wideGesture: true,
    message: 'Check these out 👀',
    messageDuration: 2000,
    expressionDuration: 2600,
  },
  {
    // Curious, quiet, no bubble. On desktop the cinematic takes over and ORBI
    // goes to inspect the diagram; this is what happens when it cannot — a
    // phone, or reduced motion — so the *reaction* survives either way.
    id: 'precision',
    expression: 'thinking',
    animation: 'look-left',
    expressionDuration: 2600,
  },
  {
    // Short burst of delight. No bubble — the work speaks for itself.
    id: 'work',
    expression: 'happy',
    animation: 'excited',
    expressionDuration: 2200,
  },
  {
    // The strongest beat on the page.
    id: 'contact',
    expression: 'happy',
    animation: 'wave',
    message: "Let's build something!",
    messageDuration: 2800,
    expressionDuration: 3200,
  },
]

export interface OrbiResolveContext {
  breakpoint: OrbiBreakpoint
  reducedMotion: boolean
}

/**
 * Pick the animation this visitor actually gets.
 *
 * Mobile and reduced-motion visitors keep the section awareness and the
 * expression, but trade travel-heavy gestures for the calm stand-in — a held
 * orientation rather than a swinging arm or a hop.
 */
export function resolveSectionAnimation(
  behavior: OrbiSectionBehavior,
  { breakpoint, reducedMotion }: OrbiResolveContext,
): OrbiAnimation | undefined {
  const animation = behavior.animation
  if (!animation) return undefined

  const quiet = behavior.quietAnimation ?? behavior.restAnimation ?? 'idle'

  // No bounce, no swing, no arm travel when motion is reduced.
  if (reducedMotion) {
    if (animation === 'excited' || animation === 'surprised') return quiet
    if (behavior.wideGesture) return quiet
    return animation
  }

  // Mobile stays deliberately quieter: big pointing gestures are dropped.
  if (breakpoint === 'mobile' && behavior.wideGesture) return quiet

  return animation
}

/** Total time a behaviour owns ORBI's body, for the priority claim. */
export function sectionClaimMs(
  behavior: OrbiSectionBehavior,
  fallbackMessageMs: number,
): number {
  const message = behavior.message
    ? (behavior.messageDuration ?? fallbackMessageMs)
    : 0
  return Math.max(1200, message, behavior.expressionDuration ?? 0)
}
