# ORBI

The website companion.

**Phase 1** — the visual companion and animation architecture.
**Phase 2** — scroll awareness and section-driven reactions.

Still no AI, no chat, no API calls, no backend. Every behaviour is
deterministic and derived from page state.

## Files

| File | Role |
| --- | --- |
| `OrbiGuide.tsx` | The only component the site mounts. Owns the state machine, drives the GSAP timelines, arbitrates priority, publishes the controller. |
| `OrbiRobot.tsx` | The body SVG. Presentation only; exposes `armRef` / `leftArmRef`. |
| `OrbiFace.tsx` | Everything inside the visor — expression poses and `gaze`. |
| `OrbiSpeech.tsx` | The speech bubble. Always mounted, animates between hidden and shown. |
| `orbiAnimations.ts` | Every GSAP factory. No React — retimable and testable on its own. |
| `orbiArbiter.ts` | The single priority claim. No React, no renders. |
| `orbiSections.ts` | The section → behaviour map, and how it degrades on mobile / reduced motion. |
| `useOrbiScroll.ts` | The **only** scroll system: direction, velocity, sections, footer. |
| `orbiConfig.ts` | Types, placement, timing, easing, palette, geometry, scroll tuning. |
| `OrbiContext.ts` | `useOrbi()`. |
| `useOrbiSection.ts` | Runtime section registration. |
| `useOrbiMedia.ts` | `prefers-reduced-motion`, breakpoint, debug gate. |
| `OrbiDebug.tsx` | Development HUD. Dropped from production builds. |

## Mounting

```tsx
import OrbiGuide from '@/components/orbi/OrbiGuide'

<OrbiGuide />                        // drop-in — how app/page.tsx uses it
<OrbiGuide>{pageContent}</OrbiGuide>  // + useOrbi() available to everything inside
```

Only the home page mounts ORBI, so it never shows on `/buddhima` or the
maintenance screen.

## Driving it

```tsx
const { setOrbiState, say, peek, hide, show, activeSection, scrollDirection } = useOrbi()

setOrbiState({ expression: 'happy', animation: 'point-left', message: 'Check this out!' })
say('Nice pick 👀', { holdMs: 3000, expression: 'happy' })
```

- `expression` — `normal | happy | blink | thinking | surprised`
- `animation` — resting `idle | float | peek`, sustained `look-left | look-right |
  look-up | look-down`, one-shot `wave | point-left | point-right | excited |
  surprised | settle`, plus `hide`
- One-shots resolve to a rest state on their own. `settle` returns every layer
  to neutral — the escape hatch if anything ever looks stuck.
- Messages auto-clear after `ORBI_TIMING.messageHoldMs`; ORBI drops a `happy`
  face when the bubble goes with it.

Outside `<OrbiGuide>`, `useOrbi()` returns a no-op controller.

## Section awareness

Sections declare a behaviour; they contain no ORBI logic. The default map is
`ORBI_SECTION_BEHAVIORS` in `orbiSections.ts`, keyed by the DOM `id` each
section already has:

```ts
{ id: 'services', expression: 'happy', animation: 'point-left',
  restAnimation: 'look-left', wideGesture: true,
  message: 'Check these out 👀', messageDuration: 2000 }
```

A section fires when it overlaps the middle band of the viewport
(`ORBI_SCROLL.bandTop` 60% → `bandBottom` 40%), not when it merely touches the
edge. To add one, add an entry — or, from a client component,
`useOrbiSection({ id: 'pricing', ... })`.

Ambiguity is resolved from live geometry rather than from `ScrollTrigger.isActive`:
a jump crosses several triggers in one tick and ScrollTrigger updates on its own
rAF, so reading its flags from ours reports the section ORBI just *left*.

### Current behaviours

| Section | Expression | Gesture | Bubble |
| --- | --- | --- | --- |
| `about` | thinking | look-left, held | — |
| `services` | happy | point-left → rests facing the cards | "Check these out 👀" (2s) |
| `work` | happy | excited hop, eyes brighten | — |
| `contact` | happy | wave | "Let's build something!" (2.8s) |
| footer | — | slides to the right-edge perch | — |

## Priority

One claim at a time (`orbiArbiter.ts`). A request lands only if it is at least
the level in force:

```
entrance 50 > interaction 40 > section 30 > fastScroll 20 > gaze 10 > idle 0
```

So a scroll glance never cuts a section gesture short, a fast-scroll startle
never overrides Contact's wave, and nothing at all interrupts the entrance.
The footer perch is deliberately *outside* this system — it is a layout
courtesy (never sit on the footer links), not a personality beat.

## Cooldowns

| Guard | Window | Config |
| --- | --- | --- |
| Same section re-firing | 5s | `sectionCooldownMs` |
| Same message replaying | 12s | `messageCooldownMs` |
| Fast-scroll startle | 2.6s | `fastCooldownMs` |
| Bubble overlap | one at a time | section messages skip if one is up |

A section also has to genuinely change before it can fire, so hovering on a
ScrollTrigger boundary cannot make ORBI wave repeatedly.

## Rules the implementation keeps

- **One transform per layer.** `root` (enter/hide) → `dock` (footer perch) →
  `tilt` (look orientation) → `gesture` (hop/recoil) → `floater` (idle bob) →
  arms. No two behaviours write the same property, so timelines cannot corrupt
  each other and nothing accumulates. The speech bubble sits outside `dock` so
  perching can never drag it off-screen.
- **Constant size.** Nothing scales the robot — translate and rotate only.
- **One scroll system.** `useOrbiScroll` owns every ScrollTrigger. Nothing else
  in ORBI may create one.
- **Never blocks the page.** The fixed box is `pointer-events: none`; only the
  painted robot takes hits.
- **Everything is cleaned up.** GSAP contexts, triggers, rAFs and timers are all
  torn down on unmount; deferred callbacks go through `later()` so they cancel.

## Reduced motion & mobile

| | reduced motion | mobile |
| --- | --- | --- |
| Idle float / body rotation | off | tilt off, float on |
| Pointing, excited, recoil | replaced by the quiet stand-in | pointing replaced |
| Fast-scroll startle | face only, no recoil | off entirely |
| Expressions, gaze, bubbles, section awareness, footer perch | kept | kept |

`wideGesture: true` marks a behaviour as travel-heavy; `resolveSectionAnimation`
swaps it for `quietAnimation` / `restAnimation`.

## Debug HUD

Set `ORBI_DEBUG = true` in `orbiConfig.ts`, or append `?orbi-debug` to the URL
in development. Shows section, expression, animation, scroll direction, the
priority claim, the station and the current message. Gated on
`NODE_ENV !== 'production'`, which Next inlines — it cannot ship.

## Phase 3 hooks

Add a gesture in `orbiAnimations.ts`, give it a name in the `OrbiAnimation`
union, and handle it in `OrbiGuide`'s animation effect — a switch over that
type. Add a reaction by adding a row to `ORBI_SECTION_BEHAVIORS`. Anything that
needs to interrupt should claim at `ORBI_PRIORITY.interaction` via `useOrbi()`.
