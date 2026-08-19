# ORBI

The website companion.

**Phase 1** — the visual companion and animation architecture.
**Phase 2** — scroll awareness and section-driven reactions.
**Phase 3** — personality, micro-interactions, environmental reactions.
**Phase 3.1** — flight, and a focus indicator that suits a round robot.

Still no AI, no chat, no API calls, no backend. Every behaviour is
deterministic and derived from page state.

ORBI is meant to read as friendly, curious, calm and quietly intelligent. Most
of that comes from the eyes and from *timing* — the pauses between reactions
matter more than the reactions. When in doubt, less movement.

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
| `useOrbiInteraction.ts` | The **only** other sensor: cursor, proximity, hover, activation, inactivity, CTAs, nav, tab visibility. |
| `orbiGaze.ts` | Where the pupils point. Imperative, outside React. |
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

## Personality (Phase 3)

| Reaction | Trigger | What ORBI does |
| --- | --- | --- |
| Cursor tracking | pointer moves (fine pointers only) | pupils follow, clamped hard |
| Proximity | pointer within `proximityRadius` | eyes track more strongly |
| Hover | pointer on the painted robot | happy, a few degrees of lean |
| Hover greeting | pointer rests on ORBI ~1.5s | "Hey 👀", once per cooldown |
| Click / tap | anywhere on the robot | surprised → happy → wave → one short line |
| Curious glance | ~8–12s quiet, same section | eyes to one side, head cock, `thinking`, no bubble |
| Drowsy | ~24s quiet | `sleepy`, float slows and shortens |
| Dozing | ~45s quiet | lids all the way down |
| Wake | any activity | eyes open; a flinch only if it was properly asleep |
| CTA | hover a `data-orbi-interest` element | look toward it, attentive; optional point |
| Navigation | `data-orbi-nav` toggle opens | glance up, `thinking`, small tilt |
| Tab return | away ≥ 30s | one blink. Never the entrance again |

### Opting a CTA in

No imports, no ORBI logic in the component — one attribute, whose value is a
comma-separated token list:

```html
<a href="#work" data-orbi-interest>                        <!-- glance -->
<a href="#work" data-orbi-interest="point">                <!-- glance + point -->
<a href="#c"    data-orbi-interest="point,say:Let's talk"> <!-- and a bubble -->
```

Navigation is the same idea: put `data-orbi-nav` on the toggle and keep its
`aria-expanded` honest. ORBI watches the attribute.

## Flight

ORBI does not sit at a coordinate; he holds station. `createFlight` walks a
short table of poses in `ORBI_FLIGHT` — each a slightly different height,
offset and roll — instead of running a symmetrical up-and-down loop, so the
motion reads as a small stabiliser keeping him airborne rather than as an
animation cycling. The sequence is fixed rather than random, so it looks
organic and still animates identically on every run, which is what makes it
testable.

| | lift | drift | roll | segment |
| --- | --- | --- | --- | --- |
| Desktop hover | 1.9–8.4px | ±3.4px | ±1.1° | 2.6–3.7s |
| Desktop reposition | to 12.6px | to 4.6px | 1.4° | 1.4–1.7s |
| Mobile | to 6.0px | ±1.4px | ±0.4° | as above |
| Reduced motion | — | — | — | stationary |

Every ~12–20s of genuine idle, one segment is replaced by a **reposition** — a
firmer climb, a tip into it, a slide sideways, a settle. It asks
`canAdjustFlight()` first and stands down for a gesture, a claim, a bubble, a
hover, the footer perch, drowsiness, or a backgrounded tab; when the reason
passes it simply resumes on the next segment. Because every segment tweens to
an *absolute* pose, interruption and resumption never snap.

It all lives on the `floater` layer and writes x, y and rotation there and
nowhere else — no gesture, orientation or dock touches that layer, so flight
cannot fight anything. Nothing scales.

The loop pauses on `visibilitychange` and resumes from the same pose, so
returning to the tab is not a jump and never replays the entrance.

## Focus and hit state

ORBI is a real control: the `<svg>` carries `role="button"`, `tabindex="0"`, an
accessible name, and Enter/Space activation. What it does *not* carry is a
rectangular outline around a round robot.

- `outline: none` inline, which beats the global `:focus-visible` rule in
  `globals.css` without `!important` — and only on ORBI. The global rule is
  untouched.
- `-webkit-tap-highlight-color: transparent`, `-webkit-touch-callout: none` and
  `user-select: none`, so a tap leaves no grey flash or selection.
- Keyboard focus instead lights a soft cyan halo that follows ORBI's silhouette.
  Whether to show it is taken from `element.matches(':focus-visible')` — the
  browser's own keyboard-vs-mouse heuristic, so a click shows nothing and Tab
  shows the halo.

## Where the eyes point

`orbiGaze` owns the pupil group's transform through `gsap.quickTo`, so cursor
tracking costs **zero React renders**. Sources write to their own slot and the
highest-priority occupied slot wins:

```
gesture > interaction > scroll > cursor > neutral
```

The exception is a gesture that exists *because* there is something to look at
— a curious glance, a point at a hovered CTA. Those are led by the interaction
slot, flagged by `gazeLead`, which is set in the same state batch as the
animation so the effect can never read it a beat late.

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

All of them live in `ORBI_COOLDOWNS` — there are no cooldown numbers anywhere
else in the code.

| Guard | Window | Key |
| --- | --- | --- |
| Same section re-firing | 5s | `sectionReaction` |
| Same section message replaying | 12s | `sectionMessage` |
| Fast-scroll startle | 2.6s | `fastScroll` |
| Hover greeting | 30s | `hoverGreeting` |
| Click reaction | 1.5s | `clickMessage` |
| Curious glance | 25s | `curious` |
| Same CTA reacting | 8s | `cta` |
| Same CTA pointed at | 20s | `ctaPoint` |
| Navigation | 5s | `nav` |
| Bubble overlap | one at a time | section/CTA messages skip if one is up |

A section also has to genuinely change before it can fire, so hovering on a
ScrollTrigger boundary cannot make ORBI wave repeatedly.

## Rules the implementation keeps

- **One transform per layer.** `root` (enter/hide) → `dock` (footer perch) →
  `tilt` (look orientation) → `gesture` (hop/recoil) → `floater` (idle bob) →
  arms. No two behaviours write the same property, so timelines cannot corrupt
  each other and nothing accumulates. The speech bubble sits outside `dock` so
  perching can never drag it off-screen.
- **Constant size.** Nothing scales the robot — translate and rotate only, so
  he is never blurry and his hit area stays predictable.
- **One scroll system.** `useOrbiScroll` owns every ScrollTrigger. Nothing else
  in ORBI may create one.
- **Never blocks the page.** The fixed box is `pointer-events: none`; only the
  painted robot takes hits.
- **Everything is cleaned up.** GSAP contexts, triggers, rAFs and timers are all
  torn down on unmount; deferred callbacks go through `later()` so they cancel.
- **Pointer moves cost nothing.** No React state, no layout reads — geometry is
  cached and re-measured on resize, on docking, and on tab return. Inactivity is
  one slow interval, not timers reset on every move, and it stops while the tab
  is hidden.
- **Blinking stays out of the way.** No blink while something else owns the
  eyelids: `surprised`, `sleepy`, dozing, or a curious hold. Intervals are
  random (3.5–7s) with a rare double blink.

## Reduced motion & mobile

| | reduced motion | mobile |
| --- | --- | --- |
| Idle float / body rotation | off | tilt off, float on |
| Pointing, excited, recoil | replaced by the quiet stand-in | pointing replaced |
| Fast-scroll startle | face only, no recoil | off entirely |
| Cursor tracking, proximity, hover greeting | kept | off (no cursor) |
| Curious glance | face and eyes only, no head cock | off |
| CTA point | off | off |
| Tap / click reaction | kept | kept |
| Inactivity | face only | face only |
| Expressions, gaze, bubbles, section awareness, footer perch | kept | kept |

Idle blinking stays off under reduced motion: the global transition reset in
`globals.css` would make a blink snap shut rather than close, which reads worse
than not blinking at all.

`wideGesture: true` marks a behaviour as travel-heavy; `resolveSectionAnimation`
swaps it for `quietAnimation` / `restAnimation`.

## Debug HUD

Set `ORBI_DEBUG = true` in `orbiConfig.ts`, or append `?orbi-debug` to the URL
in development. Shows section, expression, animation, scroll direction, gaze
source, pointer proximity, inactivity state, the priority claim, the station,
the current message and the latest event.

It lives in its own lazy chunk behind `NODE_ENV !== 'production'`, which Next
inlines — in a production build it neither renders nor gets fetched.

## Phase 3 hooks

Add a gesture in `orbiAnimations.ts`, give it a name in the `OrbiAnimation`
union, and handle it in `OrbiGuide`'s animation effect — a switch over that
type. Add a reaction by adding a row to `ORBI_SECTION_BEHAVIORS`. Anything that
needs to interrupt should claim at `ORBI_PRIORITY.interaction` via `useOrbi()`.
