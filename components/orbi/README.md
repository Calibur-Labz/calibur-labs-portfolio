# ORBI

The website companion.

**Phase 1** — the visual companion and animation architecture.
**Phase 2** — scroll awareness and section-driven reactions.
**Phase 3** — personality, micro-interactions, environmental reactions.
**Phase 3.1** — flight, and a focus indicator that suits a round robot.
**Phase 5** — environmental awareness: docking, safe zones, themes.
**Phase 6** — contact form companion.
**Phase 7** — cinematic movement.

`ORBI_PRIORITY.cinematic` is no longer reserved; Phase 7 uses it.

There is no Phase 4 in this codebase; Phase 7 took over the `cinematic`
priority slot that was reserved for it.

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
| `useOrbiEnvironment.ts` | What the page looks like: regions, docks, modal, theme, bubble placement. Decides only. |
| `orbiDocks.ts` | Dock geometry and scoring. Pure functions — no DOM, no React, no GSAP. |
| `useOrbiForm.ts` | The contact form's lifecycle: focus, validity, submission. Never its contents. |
| `useOrbiCinematic.ts` | Leaving the dock: destination geometry, travel, cancellation. |
| `useOrbiEasterEggs.ts` | The hidden reactions: detection, eligibility, cooldowns, discovery state. |
| `orbiEasterDetect.ts` | The arithmetic behind them. Pure, allocation-free, unit-tested. |
| `orbiEasterDetect.test.mts` | Those unit tests. `node --test` — see the header for how to run them. |
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

## Environment

ORBI keeps off things that matter. Pages opt in by attribute and never import
anything:

```html
<button data-orbi-avoid="high" data-orbi-label="checkout">Pay</button>
<div data-orbi-modal>…</div>          <!-- or a native <dialog open> -->
<article data-orbi-project="Premo">…</article>
<section data-orbi-theme="light">…</section>
<div data-orbi-form>…</div>
<div data-orbi-expanded="true">…</div>
```

### Docks

`bottom-right` (default) · `bottom-left` · `mid-right` · `mid-left`

ORBI's box is CSS-anchored bottom-right past the safe-area insets, so the
default dock costs no transform at all. Other docks are a delta from that
anchor, applied on the same layer as the footer perch — summed into one tween,
so the layer keeps a single writer.

### How the dock is chosen

Scores rank candidates; they do **not** decide whether to move. That is
explicit and binary:

```
blocked here            → take the best-scoring usable dock
free, and not at home   → go home
otherwise               → stay
```

`blocked` means weighted *overlap* only. Sitting near something registered adds
a `crowd` term that breaks ties between usable docks but can never make one
unusable — otherwise ORBI would flee anything he merely sits beside.

Score = `collision + crowd + edge + travel×0.08 + (home ? 0 : 0.6)`.
No randomness anywhere: the same visible layout always yields the same dock.

### Thresholds

| | value | meaning |
| --- | --- | --- |
| `collisionThreshold` | 12% of ORBI's area | below this, a clipped corner is ignored |
| `highCollisionThreshold` | 2% | for `data-orbi-avoid="high"` |
| `highWeight` / `modalWeight` | 3.2 / 4 | how much those count for |
| `proximityRadius` | 26px | how close counts as crowded |
| `urgentOverlap` | 30% | bypasses the dock hold |
| `minHoldMs` | 4s | hysteresis; no bouncing between docks |

A blocked move that the hold defers books its own re-check, so ORBI is never
stranded waiting for an event that will not come.

### Re-evaluation

Debounced (180ms) and event-driven — never per frame. Resize, orientation,
scroll-stop, a registered element entering or leaving the viewport
(IntersectionObserver), an attribute change (`MutationObserver` with an
`attributeFilter`), a subtree that actually contains a registered element, and
`refreshEnvironment()`. All reads happen together inside one `requestAnimationFrame`.

### Speech bubble

Placement is chosen against the same regions: `above` (left- or right-aligned)
by default, flipping to ORBI's `left`/`right` when above would leave the
viewport or cover something registered. Flipping the bubble is always preferred
to moving ORBI for the bubble's sake.

### Theme

`data-orbi-theme` regions swap presentation only — the cyan halo gives way to a
real drop shadow, a faint dark rim, and a contact shadow, and the bubble trades
its bloom for a shadow. ORBI's own colours never change. *No region in this
site currently opts in;* the site is uniformly dark, so the mechanism is in
place and unused rather than faked.

## Contact form companion

While someone is using the contact form, ORBI goes quiet and attentive. The
form opts in by attribute and imports nothing:

```html
<form data-orbi-form data-orbi-form-state="idle|submitting|success|error">
  <input data-orbi-field="name" aria-invalid="true" />
  <textarea data-orbi-field="message"></textarea>
  <button data-orbi-submit>Send</button>
  <span data-orbi-avoid="high">This field is required.</span>
</form>
```

### Privacy

**ORBI never reads what anyone types.** `useOrbiForm` does not touch `.value`,
does not construct `FormData`, and does not walk `form.elements`. It looks at
exactly four things: which element has focus and its `data-orbi-field` name,
`aria-invalid` on a control, `data-orbi-form-state` on the form, and
`getBoundingClientRect()`. Field *names* reach ORBI's state; field *contents*
never do, and nothing is logged.

The form owns its own data path entirely — ORBI observes the lifecycle, it does
not participate in it.

This is enforced by test rather than by convention: the suite patches the
`value` getter, `FormData` and `form.elements` before any script runs, drives a
full submission, and asserts that **zero** accesses originate from an ORBI
stack frame.

### Flow

```
contact enters      → existing greeting (Phase 2) may run
first focus/tab in  → companion mode
field focus         → eyes follow the field's real geometry; no bubbles
invalid             → thinking, look at the first flagged field,
                      "Check this field 👀" at most once per 20s
submit              → attentive → patient after 4s. No fake progress.
success             → the three-beat run below
error               → thinking + "Something went wrong." The form's own
                      message stays the source of truth.
```

### The success run

Only ever after the server confirms it — never on click, while submitting, or
after a validation or network failure.

| t | line | ORBI |
| --- | --- | --- |
| 0.3s | — | eyes brighten, small lift |
| 1.2s | Message sent! ✨ | wave |
| 3.3s | We'll check your message. | nod |
| 5.4s | Thank you! 💙 | happy eyes |
| 7.6s | — | settles |
| 8.7s | — | companion released |

Measured in a production build: **6.4s** of visible bubble, 7.3s from the
confirmed response to the settle. The movement de-escalates — celebrate,
acknowledge, thank — rather than firing three celebrations; the third beat is
the "gentle happy-eye animation" rather than a second wave, since a full wave
had already run at beat one.

The three lines share one `formResult` claim for the whole run, taken once and
released at the end, so nothing decorative can cut in between them. The dock
layer stays outside the arbiter, so ORBI can still move off a control mid-run.

Only the first line pops. The other two **crossfade in place** — `OrbiSpeech`
fades the words out, swaps them, fades them back, leaving the panel itself
untouched — and the panel is pinned near its own maximum width for the run, so
three different-length lines do not make the box breathe.

Each run carries a token. Deferred steps check it before doing anything, so a
second submission can never be haunted by the previous run's timers: they still
fire, they just find themselves stale.

Companion mode suppresses the curious glance, drowsiness, the flight
reposition, project-card reactions, CTA reactions and the Contact section's own
greeting — but keeps blinking, hovering, gaze, and an explicit click on ORBI.

Focus may leave the form for 1.6s (tabbing, a label, autofill) without dropping
companion mode.

### Positioning

The bubble dodges more than ORBI's body does: it scores against the registered
regions *plus* the form's own controls. A small panel resting on an input for a
few seconds is worth avoiding, but registering every field as an obstacle would
have ORBI fleeing the form altogether.

The form is a registered avoid region, so the existing dock scoring keeps ORBI
off it. On desktop a `companionWeight` term additionally prefers a dock level
with the form and clear of its horizontal span, which puts ORBI *beside* it.

On a phone the form fills the screen and every dock is equally blocked — so
`crowded` triggers the last resort and ORBI peeks out to the edge instead of
shuffling between bad corners. The same happens when the on-screen keyboard
collapses the visual viewport (`visualViewport.resize`, debounced 260ms).

## Cinematic movement

Occasionally ORBI leaves his dock and moves into the page. Rare on purpose —
roughly a tenth of what he does — because that is what makes it read as
deliberate rather than as an animation on a loop.

Sections opt in with an attribute and contain no choreography:

```html
<div data-orbi-cinematic="hero">…</div>
<div data-orbi-cinematic="precision">…</div>
<div data-orbi-cinematic="projects">…</div>
```

### The three moments

| | travel out | dwell | travel back | total |
| --- | --- | --- | --- | --- |
| **Hero** (once per load) | rises *into* the composition | greeting | 0.9s to the dock | ~5.6s |
| **Precision** | 1.28s | 1.77s — lean, thinking, one glance either side | 1.29s | 4.5s |
| **Projects** | 0.87s | 1.71s — eyes travel the row, body still | 0.88s | 3.7s |

No speech during travel. The hero greeting is the one exception, and its bubble
travels with ORBI because the speech panel lives *inside* the travel layer.

### Destination geometry

Resolved from the target's own rect, never hardcoded. Candidate spots are
placed clear of the target by `targetGap` on each preferred side, then scored
against the same registered regions the docking system uses. A spot that
overlaps a registered control by more than `unsafeOverlap`, or that leaves the
usable viewport, is **discarded rather than penalised** — so ORBI either finds
somewhere genuinely clear or does not go. Geometry is read before travel and
once on landing, never per frame.

### The path

A quadratic Bézier through a lifted control point, computed from a proxy value
rather than a motion-path plugin, plus a few degrees of lean into the direction
of travel. Nothing scales, nothing bounces. The trip home varies deterministically
by run index across three arcs — a dip, a lift, a direct glide — so returning is
not a rewind of the outbound path.

Arrival pauses for 200ms *before* reacting. Small, and the beat falls flat
without it: arriving and reacting have to read as two events.

### Cancellation

Safety and the visitor's own business both win, and cancellation is always
preferred to pausing:

| trigger | result |
| --- | --- |
| target scrolled out of view | fly home, `target-left-view` |
| modal or nav overlay opens | fly home, `modal-open` / `nav-open` |
| contact companion activates | fly home, `form-companion` |
| ORBI clicked mid-flight | **not** cancelled — a look and a blink, no bubble |
| CTA or project card hovered mid-flight | ignored — the sequence keeps the `interaction` gaze slot, and card awareness resumes on landing |

A cancel flies home rather than snapping, and every ending — completed,
cancelled, unmounted — runs the same teardown: kill the timeline, reset the
travel layer to identity, release the claim, and `refreshEnvironment`, because
the page may have moved while ORBI was away.

### Layers

One new layer, between the anchor and the dock:

```
root → travel → [speech, dock → tilt → gesture → floater → arms]
```

Every cinematic position is an **absolute offset from the anchor**; nothing is
ever added to a current value, so repeated runs cannot drift. Verified after 15
section crossings: travel, dock, tilt, gesture and both arms all at identity.

### Responsive and reduced motion

| | hero | precision | projects |
| --- | --- | --- | --- |
| Desktop | full flight | full flight | full flight |
| Tablet | shorter flight | 0.7× travel | 0.7× travel |
| Mobile | plain entrance, no flight | gaze + expression from the dock | gaze + expression from the dock |
| Reduced motion | plain entrance, greeting kept | gaze + expression from the dock | gaze + expression from the dock |

The mobile and reduced-motion fallbacks are ordinary section behaviours, so the
*reaction* survives even when the travel does not.

## Hidden reactions

Phase 8. ORBI has a handful of things he only does if you find them. The whole
design is built around one number: **most visitors should see one or two of
these in an entire visit**, and never two in a row.

Rarity is enforced in four places at once — a cooldown per reaction, a 14s
global cooldown between any two, a hard "only one at a time", and a budget of
**two Easter-egg bubbles for the whole page view**. Everything else about them
is ordinary ORBI: `useOrbiEasterEggs` detects and decides, `OrbiGuide` performs,
and page content opts in with an attribute.

### The ten

| | how you find it | what he does | says |
| --- | --- | --- | --- |
| **dizzyClick** | five clicks inside 3s | startled → wobble → dizzy → recovers | "Whoa 😵" once |
| **headTap** | tap his head rather than his body | eyes up → blink → pleased | "Hehe 👀" once |
| **cursorChase** | whip the cursor about near him | startled, half a wobble | — |
| **cursorCircle** | draw a full circle around him | eyes go round → dizzy → recovers | — |
| **selfAware** | rest the cursor on him for 4.5s | looks himself over, then back at you | — |
| **logoNod** | rest the cursor on the Calibur mark | looks at it, small proud nod | — |
| **deepWake** | come back after he has fallen asleep | startle → blink, blink → finds you | "Oh! You're back 👀" once |
| **footerSecret** | stay at the bottom of the page ~6.5s | leans in, looks around, waves | "You made it! 👋" once |
| **edgePeek** | nothing — it finds you, once, late in a visit | slips behind the edge, eyes back first | — |
| **rareIdle** | nothing — a wink, a narrowed eye, a look around | one small beat, three flavours in rotation | — |

Plus one that is not a sequence at all: perched at the footer, a cursor coming
at ORBI makes him **shrink back a little** (~19px), and he comes out again more
slowly once it leaves. Desktop only, and never a chase.

### Detection

Three fixed-size detectors in `orbiEasterDetect.ts`, all pure and all unit
tested. No pointer history is kept, nothing is allocated per sample, and no
React state is written on a pointer move — the telemetry in the HUD is
published only while the HUD is open.

The circle is an **angular accumulator**, not gesture recognition: the angle to
the cursor, summed, with four things policing it — the pointer has to stay in a
radius band around ORBI, each step has to be small enough to be a real stroke,
the direction has to stay consistent, and the whole lap has to happen inside
3.2s. Crossing back and forth over ORBI therefore scores nothing: each crossing
reverses the direction and abandons the attempt. Verified both ways in the
tests and in the browser.

### When they cannot run

`canRunEaster` in the guide is the single gate, and it is mostly refusals: not
before the entrance has settled, not while frozen, not in companion mode, not
during any part of a submission, not during a cinematic, not with a modal or
the menu open, not while the environment is relocating him, not while he is
dozing — and not while he is holding a claim above `easterEgg`.

Two of them are held to different rules, because the visitor is *touching ORBI*
when they fire: `dizzyClick` and `headTap` may interrupt his own click line, and
they inherit the `click` claim rather than being refused by it. That is the one
place a hidden reaction takes over from something above it, and it is a
handover, not a race — the click that triggered it is the same gesture.

Anything already running is cancelled by a modal, the menu, a cinematic
starting, or the visitor touching the contact form. Cancellation restores the
face, the eyes, the lean and the dock, and only ever the ones that reaction set.

### The head

`OrbiRobot` paints a hit region over the top of the shell and the visor
(`data-orbi-part="head"`). It is deliberately *not* a control — no role, no tab
stop, `aria-hidden` — because the robot itself is already the button and keeps
its keyboard activation. The region only redirects a pointer that was going to
hit ORBI anyway, and `stopPropagation` is what guarantees one tap never fires
both reactions. When the head beat is on cooldown the tap falls through to the
ordinary click reaction, so he is never unresponsive to being touched.

### Sleep

Phase 3's `idle → sleepy → dozing` gains a fourth stage at 75s: **asleep**. Lids
shut rather than nearly shut, the glow down to 45%, and flight drops to the
`asleep` variant — a sixth of the amplitude, nearly three times slower, sunk a
few px. It is one more branch on the interval that was already running: no new
timer and no new listener.

Waking from *that* is its own sequence rather than the ordinary flinch, and it
is the only reaction that may run while he is under.

### Desktop, mobile, reduced motion

| | desktop | mobile | reduced motion |
| --- | --- | --- | --- |
| dizzyClick | full | wobble at 45% | face only, no wobble |
| headTap | full | full | face only |
| cursorChase / cursorCircle / selfAware / logoNod | full | **off** (no cursor) | face only |
| deepWake | full | full | face only |
| footerSecret | full | full, smaller lean | face + wave, no lean |
| edgePeek | full | **off** | **off** |
| rareIdle | full | full | full (it is only a face) |
| edge play | full | **off** | **off** |

Nothing in Phase 8 is disabled wholesale under reduced motion: the wobble
becomes a pause of the same length, the leans are skipped, and every reaction
still reads through the face — which is where ORBI's personality lives anyway.

## Development switches

Dev only — all four gated on `NODE_ENV`, which Next inlines:

| | |
| --- | --- |
| `?orbi-debug` | the HUD |
| `?orbi-cinematic=precision` | run one on load, for visual tuning |
| `?orbi-easter=dizzyClick` | run one hidden reaction on demand, likewise |
| `?orbi-freeze=1` | hold ORBI perfectly still |

Freeze exists because continuous flight makes Playwright's element screenshots
time out waiting for a stable box — correct on its side, unhelpful on ours.
With it on, `elementHandle.screenshot()` succeeds.

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
gesture > interaction > form > scroll > cursor > neutral
```

`form` sits above scroll and cursor deliberately: while a field has focus,
nothing pulls ORBI's eyes off it.

The exception is a gesture that exists *because* there is something to look at
— a curious glance, a point at a hovered CTA. Those are led by the interaction
slot, flagged by `gazeLead`, which is set in the same state batch as the
animation so the effect can never read it a beat late.

## Priority

One claim at a time (`orbiArbiter.ts`). A request lands only if it is at least
the level in force:

```
entrance 70 > interaction 60 > formResult 58 > formSubmitting 55
  > cinematic 50 > safety 45 > easterEgg 40 > environment 35
  > formFocus 32 > section 30 > fastScroll 20 > ambient 15
  > gaze 10 > idle 0
```

A hidden reaction outranks a section beat — finding something deserves to
finish — and yields to safety, the cinematic, the form and anything the visitor
explicitly asked for.

A cinematic outranks section behaviour, fast scroll, gaze and idle. It sits
*above* `safety` numerically, so modal and nav interruption is handled by the
controller cancelling itself rather than by the arbiter — which is what the
"prefer cancellation over pausing" rule wants anyway.

So a scroll glance never cuts a section gesture short, a fast-scroll startle
never overrides Contact's wave, and nothing at all interrupts the entrance.

**Position is outside this system entirely.** The footer perch and the
environmental dock both move ORBI's box regardless of who holds the claim,
because not sitting on a control is a safety concern rather than a personality
one. Only the *reaction* to relocating — the glance and the attentive face — is
arbitrated, at `environment` (a dock change) or `safety` (a modal).

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

Phase 8's live in `ORBI_EASTER_EGGS`, for the same reason:

| Guard | Window | Key |
| --- | --- | --- |
| Repeated clicking | 5 clicks / 3s, then 40s | `repeatedClickCount` · `repeatedClickWindow` · `repeatedClickCooldown` |
| Cursor chase | 10s | `cursorChaseCooldown` |
| Cursor circle | 30s | `cursorCircleCooldown` |
| Head-tap line | 45s, and once per visit | `headTapBubbleCooldown` |
| Deep sleep | 75s of quiet | `deepSleepDelay` |
| Deep-wake line | 120s, and once per visit | `deepWakeBubbleCooldown` |
| Footer secret | 6.5s at the bottom, once per visit | `footerSecretDelay` |
| Self-aware | 60s | `selfAwareCooldown` |
| Rare idle | 47–88s, walked in order | `rareIdleGaps` |
| Edge peek | not before 120s, once per visit | `edgePeekDelay` |
| Between *any* two | 14s | `globalCooldown` |
| Easter-egg bubbles | 2 per page view, ever | `maxBubbles` |

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
| Collision avoidance / docking | **kept** — usability wins | kept, quicker and flatter |
| Form companion | kept; no celebratory lift | kept; peeks aside instead of sitting beside |
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

Environment rows show the dock, every candidate's score, the active blocker and
its overlap percentage, the theme, bubble placement, modal state, whether ORBI
is crowded out, how many regions are registered, and the last decision.

Form rows show companion mode, whether a form is in view, the focused field's
*identifier*, the invalid field, the submission status and id, the gaze target
and the form's box. **Never a field value** — the HUD has no access to one.

It lives in its own lazy chunk behind `NODE_ENV !== 'production'`, which Next
inlines — in a production build it neither renders nor gets fetched.

## Phase 3 hooks

Add a gesture in `orbiAnimations.ts`, give it a name in the `OrbiAnimation`
union, and handle it in `OrbiGuide`'s animation effect — a switch over that
type. Add a reaction by adding a row to `ORBI_SECTION_BEHAVIORS`. Anything that
needs to interrupt should claim at `ORBI_PRIORITY.interaction` via `useOrbi()`.
