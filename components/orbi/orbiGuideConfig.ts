/**
 * ORBI — guide mode.
 *
 * Phase 12. The one thing on this page ORBI does *because he was asked to*:
 * a small menu of places on the site, and a guided trip to whichever one the
 * visitor picks.
 *
 * Everything here is configuration. The destinations are the site's real
 * section ids — the same anchors the navigation already links to — because a
 * second list of "where things are" would be a second thing to keep true.
 *
 * No AI, no chat, no text input, no memory. Guide mode is five buttons and a
 * scroll; the personality at the far end is the section behaviour that was
 * already there.
 */

import type { OrbiBreakpoint } from './orbiConfig'

/* ── Destinations ──────────────────────────────────────────────────────── */

export interface OrbiGuideItem {
  /** Stable identity for keys, telemetry and the dev switch. */
  id: string
  /**
   * What the visitor reads, and the only thing here they ever see. Labels are
   * free to differ from the section they lead to — "Client Stories" is warmer
   * than "Testimonials" and "Let's Talk" is friendlier than "Contact" — but
   * nothing else renames on their account: the DOM ids, the components, the
   * cinematic identifiers and the section map all stay exactly as they were.
   */
  label: string
  /**
   * The DOM `id` of the section it leads to. These are the *actual* ids the
   * page uses (`components/sections/*`), which do not read like the labels:
   * the projects grid lives under `work`, and the client quotes under
   * `testimonials` inside a section headed "Kind Words".
   */
  target: string
}

/**
 * Five places, and deliberately not a copy of the navigation: this is what
 * ORBI would offer to show someone, in the order it makes sense to see them —
 * what we build, what we have built, who says so, who we are, and how to start.
 *
 * `precision` ("How We Work") is not on the list. Its section keeps its own
 * ORBI behaviour and its own Phase 7 cinematic on ordinary scrolling; it is
 * simply not somewhere ORBI offers to take you.
 */
export const ORBI_GUIDE_ITEMS: readonly OrbiGuideItem[] = [
  { id: 'services', label: 'Our Services', target: 'services' },
  { id: 'projects', label: 'Our Work', target: 'work' },
  { id: 'testimonials', label: 'Client Stories', target: 'testimonials' },
  { id: 'about', label: 'About Calibur', target: 'about' },
  { id: 'contact', label: 'Let’s Talk', target: 'contact' },
] as const

/* ── Lifecycle ─────────────────────────────────────────────────────────── */

/**
 * Deliberately small. `opening` and `arriving` exist because each is a beat
 * ORBI performs rather than an instant — everything else is either the menu
 * being up, the page being on its way, or neither.
 */
export type OrbiGuidePhase =
  | 'closed'
  | 'opening'
  | 'choosing'
  | 'navigating'
  | 'arriving'

/** Where the panel opens relative to ORBI. `sheet` is the small-screen fallback. */
export type OrbiGuidePlacement =
  | 'above-right'
  | 'above-left'
  | 'left'
  | 'right'
  | 'sheet'

/** The four floating placements, in the order `orbiDocks` scores them. */
export type OrbiGuideSide = Exclude<OrbiGuidePlacement, 'sheet'>

/**
 * Which side the panel prefers, per dock. Above and inward first — ORBI docks
 * in a corner, so the open space is up and toward the middle of the page.
 */
export const ORBI_GUIDE_SIDES: Record<string, readonly OrbiGuideSide[]> = {
  'bottom-right': ['above-right', 'above-left', 'left', 'right'],
  'bottom-left': ['above-left', 'above-right', 'right', 'left'],
  'mid-right': ['left', 'above-right', 'above-left', 'right'],
  'mid-left': ['right', 'above-left', 'above-right', 'left'],
}

/* ── Copy ──────────────────────────────────────────────────────────────── */

export const ORBI_GUIDE_MESSAGES = {
  /** Above the list. A question, not a prompt to type into. */
  title: 'What can I show you?',
  close: 'Close',
  /** The control, and the panel, for anyone listening rather than looking. */
  controlLabel: 'Open ORBI’s website guide',
  controlLabelOpen: 'Close ORBI’s website guide',
  panelLabel: 'ORBI website guide',
  /**
   * What each option is called to a screen reader. The visible label is the
   * destination, so the accessible name only has to say what pressing it does
   * — and it is built from that same label, so the two can never drift.
   */
  destinationLabel: (label: string) => `Go to ${label}`,
  /**
   * One short line per guided trip, walked in order so two trips in a row are
   * never the same words. Never more than one bubble: the destination's own
   * section message is the one that matters, and guide mode clears this before
   * it arrives.
   */
  /** The one row that starts a conversation rather than a trip. */
  ask: 'Ask ORBI',
  askLabel: 'Ask ORBI a question',
  acknowledgements: ['Let’s go 👀', 'This way.', 'Right here.'] as const,
} as const

/* ── Timing ────────────────────────────────────────────────────────────── */

export const ORBI_GUIDE = {
  /* ── Opening ── */
  /**
   * ORBI reacts first, then the panel appears under him. The whole opening —
   * gesture, panel, settled — lands inside ~330ms, which is the point: this is
   * a control responding, not a cinematic.
   */
  openBeatMs: 140,
  /** ...plus a beat when he had to wake up for it, so the menu never
      appears over a robot that still looks asleep. */
  wakeDelayMs: 260,
  /** Long enough for the opening beat; released the moment the menu is up. */
  openClaimMs: 900,

  /* ── The panel ── */
  panelEnterMs: 190,
  panelExitMs: 140,

  /* ── Travelling ── */
  /** The "prepares to travel" beat between choosing and the page moving. */
  travelDelayMs: 220,
  /** No arrival before this, so the acknowledgement is readable even when the
      destination was already on screen. */
  minTravelMs: 700,
  /** Scroll considered finished once this long passes without a scroll event. */
  settleMs: 150,
  /** Hard ceiling. A smooth scroll that never settles still lands somewhere. */
  navTimeoutMs: 2600,
  /** Outlasts the whole trip; the hook releases it long before this lapses. */
  navClaimMs: 4200,
  /** Arriving → closed. The section beat owns ORBI from here. */
  arriveHoldMs: 260,
  /** How long the acknowledgement stays up if nothing clears it sooner. */
  ackHoldMs: 1600,
  /**
   * Wheel travel that counts as the visitor taking the page back. A trackpad
   * resting under a palm produces a few pixels; this is a deliberate push.
   */
  cancelScrollDelta: 40,

  /* ── The control ── */
  control: {
    /** Painted diameter. The hit area is padded out to `touchSize`. */
    size: 34,
    mobileSize: 40,
    touchSize: 44,
    /** Gap between the guide control and the sound control below it. */
    stackGap: 2,
    /** Resting opacity, matched to the sound control. */
    restOpacity: 0.34,
    /** Three slow pulses, once, so the control is noticed without nagging. */
    pulseAfterMs: 6000,
    pulseCycleMs: 2200,
    pulseCount: 3,
  },

  /* ── Panel geometry ── */
  panel: {
    /** Gap from ORBI's box, matching the speech bubble's. */
    gap: 10,
    /** Clearance from the edges of the usable viewport. */
    margin: 12,
    /** A panel covering a registered control by more than this is unusable. */
    unsafeOverlap: 0.06,
    radius: 16,
    padding: 10,
    /** Widest the small-screen sheet is allowed to get. */
    sheetMaxWidth: 340,
    /** Below this there is no point in a sheet; it takes the full height. */
    sheetMinHeight: 148,
  },

  /** Everything that changes with the viewport, in one table. */
  metrics: {
    desktop: { width: 216, item: 38, gap: 2, title: 26, font: 14 },
    tablet: { width: 208, item: 40, gap: 2, title: 26, font: 13.5 },
    mobile: { width: 200, item: 44, gap: 2, title: 24, font: 13 },
  },
} as const

export type OrbiGuideMetrics = (typeof ORBI_GUIDE.metrics)[OrbiBreakpoint]

/**
 * The panel's box, from the table above rather than from the DOM.
 *
 * Placement has to be decided *before* the panel exists, and measuring a node
 * that has not been rendered yet is not a thing — so the size is derived, the
 * same way the speech bubble's is.
 *
 * It has to match `OrbiGuideMenu` to the pixel, because this is the number
 * that decides whether the panel fits above ORBI: derive it short and the menu
 * gets placed off the top of a small screen. The terms below are the markup,
 * in order — border, padding, the question, the list, the gap and hairline
 * above the close row, the close row itself, padding, border.
 */
export function guidePanelSize(
  breakpoint: OrbiBreakpoint,
  itemCount: number = ORBI_GUIDE_ITEMS.length,
): { width: number; height: number } {
  const m = ORBI_GUIDE.metrics[breakpoint]
  const pad = ORBI_GUIDE.panel.padding
  const list = itemCount * m.item + Math.max(0, itemCount - 1) * m.gap
  return {
    width: m.width,
    height: 2 + pad * 2 + m.title + list + pad + 1 + m.item,
  }
}
