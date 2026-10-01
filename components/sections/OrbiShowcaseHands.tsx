'use client'

import type { ReactNode } from 'react'
import { ORBI_THEME_COLORS, ORBI_VIEWBOX } from '@/components/orbi/orbiConfig'

/**
 * ORBI's arms, posed — a prototype, in the /orbi showcase only.
 *
 * The arms are drawn exactly as `OrbiRobot` draws them — the same pill, the
 * same round hand, the same `#orbi-limb` gradient and rim — so his design does
 * not change. What changes is how they move. The companion can only swing an
 * arm about its shoulder; here each arm can also shift, so a mood becomes a
 * gesture: a wave, a hand to the chin, both arms thrown up, a hug.
 *
 * Laid over the robot in his own viewBox, inside the element that leans and
 * lifts him, so the arms move with his body. The robot's own arms are hidden
 * while this layer is on (see `OrbiShowcase`). At rest the two are pixel for
 * pixel the same: the arms sit beside the shell, clear of it, so drawing them
 * in front changes nothing until they move.
 *
 * What makes it read as a person rather than a rig:
 *  - Poses ease in with a little overshoot, then settle.
 *  - The leading arm moves first; the other follows a beat later.
 *  - Each arm sways on its own slow clock, so the two are never mirrored.
 *  - The body leans toward the gesture, and squashes or stretches with it.
 *
 * Nothing here is used by the live companion or the customer embed yet.
 */

export type HandAccent = 'hi' | 'dots' | 'question' | 'lines' | 'sparkle' | 'hearts' | 'burst' | null

/** An arm: shifted from its shoulder by (x, y), then rotated about it. */
type Arm = { x: number; y: number; r: number }

export interface HandPose {
  left: Arm
  right: Arm
  /** Which arm moves first. The other follows `FOLLOW_MS` later. */
  lead?: 'left' | 'right'
  /** The right arm waves from the shoulder once it is up. */
  wave?: boolean
  /** A heart held in the hug. */
  heart?: boolean
  accent?: HandAccent
  /** Body squash (<1) or stretch (>1), vertical. Applied by the showcase. */
  squash?: number
  /** Extra lean toward the gesture, degrees. Applied by the showcase. */
  tilt?: number
  /** Head turn toward the gesture, degrees about the vertical axis (3D look). */
  turn?: number
}

/** Where each arm hangs from, in viewBox units — `ORBI_ART.armPivot*`. */
const SHOULDER = { left: { x: 26.5, y: 78 }, right: { x: 143.5, y: 78 } }

const still: Arm = { x: 0, y: 0, r: 0 }
const REST: HandPose = { left: still, right: still }

/**
 * One pose per showcase reaction. Rotation is about the shoulder, in degrees:
 * negative swings the right arm out and up, positive swings the left arm out
 * and up. An arm pointing straight up is ∓180.
 */
export const HAND_POSES: Record<string, HandPose> = {
  normal: REST,
  track: REST,
  hello: {
    turn: -14,
    left: { x: 0, y: 0, r: 8 },
    right: { x: 0, y: 0, r: -140 },
    lead: 'right',
    wave: true,
    accent: 'hi',
    tilt: 5,
  },
  thinking: {
    turn: 10,
    left: { x: 0, y: 0, r: -6 },
    // Folded up to the chin, resting at the corner of his face.
    right: { x: -6, y: 18, r: 58 },
    lead: 'right',
    accent: 'dots',
  },
  curious: {
    turn: -12,
    left: { x: 0, y: 0, r: 0 },
    // One hand up, the way someone raises it to ask.
    right: { x: 0, y: 0, r: -118 },
    lead: 'right',
    accent: 'question',
  },
  happy: {
    left: { x: 0, y: 0, r: 34 },
    right: { x: 0, y: 0, r: -34 },
    lead: 'left',
    accent: 'lines',
    squash: 0.97,
  },
  surprised: {
    left: { x: 0, y: 0, r: 78 },
    right: { x: 0, y: 0, r: -78 },
    accent: 'burst',
  },
  shy: {
    turn: 12,
    // Arms drawn in and down, in front of him.
    left: { x: 8, y: 12, r: -42 },
    right: { x: -8, y: 12, r: 42 },
    lead: 'left',
  },
  wink: {
    turn: -10,
    left: { x: 0, y: 0, r: 0 },
    right: { x: 0, y: 0, r: -150 },
    lead: 'right',
    accent: 'sparkle',
    tilt: 4,
  },
  excited: {
    left: { x: 0, y: 0, r: 152 },
    right: { x: 0, y: 0, r: -152 },
    accent: 'burst',
    squash: 1.03,
  },
  unsure: {
    turn: -10,
    left: { x: 0, y: 0, r: 0 },
    // A hand at the side of his head.
    right: { x: -4, y: -4, r: -165 },
    lead: 'right',
  },
  concerned: {
    // Hands brought together in front, held close.
    left: { x: 16, y: 16, r: -58 },
    right: { x: -16, y: 16, r: 58 },
    squash: 0.98,
  },
  sleepy: {
    left: { x: 0, y: 3, r: -8 },
    right: { x: 0, y: 3, r: 8 },
    squash: 0.98,
  },
  deepSleep: {
    left: { x: 8, y: 10, r: -32 },
    right: { x: -8, y: 10, r: 32 },
    squash: 0.97,
  },
  dizzy: {
    turn: 8,
    left: { x: 0, y: 0, r: 46 },
    right: { x: 0, y: 0, r: -70 },
  },
  thanks: {
    // A hug around the heart.
    left: { x: 24, y: 18, r: -62 },
    right: { x: -24, y: 18, r: 62 },
    heart: true,
    accent: 'hearts',
    squash: 0.98,
  },
}

export function handPoseFor(id: string): HandPose {
  return HAND_POSES[id] ?? REST
}

/** How long the second arm waits. Small, but it is what makes it human. */
const FOLLOW_MS = 90
/** Back-out: arrives a touch past the pose, then settles into it. */
const SETTLE = 'cubic-bezier(0.34, 1.45, 0.64, 1)'

/** The reference's glow, for the strokes and hearts. */
const GLOW = '#4FC3FF'
/** A plump heart, 20 × 17, centred on its middle. */
const HEART =
  'M0 7 C -2 5 -10 0 -10 -4.5 C -10 -8.2 -7.2 -10 -4.8 -10 C -2.6 -10 -0.9 -8.7 0 -7 ' +
  'C 0.9 -8.7 2.6 -10 4.8 -10 C 7.2 -10 10 -8.2 10 -4.5 C 10 0 2 5 0 7 Z'

/**
 * The heart, in 3D: lit from the top left, deepening to the bottom right, with
 * two glassy highlights and a halo of its own light behind it. `halo` is off
 * for the small floating ones — at that size it only muddies them.
 */
function Heart3D({ halo = true }: { halo?: boolean }) {
  return (
    <>
      {halo && <path className="orbi-heart-halo" d={HEART} fill={GLOW} filter="url(#orbi-heart-glow)" />}
      <path d={HEART} fill="url(#orbi-heart-fill)" />
      <ellipse cx={-4.4} cy={-5.6} rx={2.8} ry={1.6} transform="rotate(-32 -4.4 -5.6)" fill="#FFFFFF" opacity={0.8} />
      <ellipse cx={4.2} cy={-6.4} rx={1.2} ry={0.7} transform="rotate(20 4.2 -6.4)" fill="#FFFFFF" opacity={0.45} />
    </>
  )
}

/**
 * One arm exactly as `OrbiRobot` draws it — the rect at 20…33 × 74…98 and the
 * hand at y 98 — moved so the shoulder sits at the origin.
 */
function ArmShape({ rim }: { rim: string }) {
  return (
    <>
      <rect x={-6.5} y={-4} width={13} height={24} rx={6.5} fill="url(#orbi-limb)" />
      <circle cx={0} cy={20} r={7} fill="url(#orbi-limb)" stroke={rim} strokeWidth={1} />
    </>
  )
}

/**
 * The bubbles wear the site's own palette rather than the reference's: a panel
 * surface with an accent hairline (the ORBI speech bubble, made solid so the
 * tail can overlap it cleanly), and "Hi!" in the accent pill the theme toggle
 * itself uses — accent fill, accent ink.
 */
const BUBBLE = {
  dark: { fill: '#0C121C', stroke: 'rgba(0, 183, 255, 0.34)', glow: 'drop-shadow(0 0 6px rgba(0, 183, 255, 0.28))', hiInk: '#04121B' },
  light: { fill: '#FFFFFF', stroke: 'rgba(14, 165, 255, 0.40)', glow: 'drop-shadow(0 4px 10px rgba(15, 23, 42, 0.12))', hiInk: '#FFFFFF' },
} as const

/**
 * A bubble body and its tail as one outlined shape: the tail is stroked first,
 * the body drawn over it, then the tail filled again without a stroke so the
 * seam where they meet disappears.
 */
function Bubble({ body, tail, theme }: { body: ReactNode; tail: string; theme: 'dark' | 'light' }) {
  const b = BUBBLE[theme]
  return (
    <g fill={b.fill} stroke={b.stroke} strokeWidth={1}>
      <path d={tail} strokeLinejoin="round" />
      {body}
      <path d={tail} stroke="none" />
    </g>
  )
}

function Accent({ kind, theme }: { kind: HandAccent; theme: 'dark' | 'light' }) {
  const c = ORBI_THEME_COLORS[theme]
  const b = BUBBLE[theme]
  const font = 'var(--font-poppins), system-ui, sans-serif'
  switch (kind) {
    case 'hi':
      return (
        <g className="orbi-hands-pop" style={{ transformOrigin: '138px 20px', filter: b.glow }}>
          <rect x={120} y={4} width={38} height={24} rx={12} fill={c.mark} />
          <path d="M 128 26 L 124 34 L 135 27 Z" fill={c.mark} />
          <text x={139} y={21} textAnchor="middle" fontSize={13} fontWeight={800} fill={b.hiInk} fontFamily={font}>
            Hi!
          </text>
        </g>
      )
    case 'dots':
      return (
        <g className="orbi-hands-pop" style={{ transformOrigin: '140px 16px', filter: b.glow }}>
          <circle cx={118} cy={36} r={2.2} fill={b.fill} stroke={b.stroke} strokeWidth={1} />
          <circle cx={123} cy={28} r={3.2} fill={b.fill} stroke={b.stroke} strokeWidth={1} />
          <rect x={124} y={4} width={34} height={20} rx={10} fill={b.fill} stroke={b.stroke} strokeWidth={1} />
          {[133, 141, 149].map((cx, i) => (
            <circle key={cx} className="orbi-hands-dot" style={{ animationDelay: `${i * 160}ms` }} cx={cx} cy={14} r={2.2} fill={c.mark} />
          ))}
        </g>
      )
    case 'question':
      return (
        <g className="orbi-hands-pop" style={{ transformOrigin: '146px 16px', filter: b.glow }}>
          <Bubble theme={theme} tail="M 138 25 L 134 32 L 143 27 Z" body={<circle cx={146} cy={16} r={12} />} />
          <text x={146} y={21.5} textAnchor="middle" fontSize={15} fontWeight={800} fill={c.mark} fontFamily={font}>
            ?
          </text>
        </g>
      )
    case 'lines':
      return (
        <g stroke={GLOW} strokeWidth={2.4} strokeLinecap="round" className="orbi-hands-pop" style={{ transformOrigin: '85px 60px' }}>
          <line x1={20} y1={58} x2={12} y2={54} />
          <line x1={22} y1={48} x2={16} y2={41} />
          <line x1={150} y1={58} x2={158} y2={54} />
          <line x1={148} y1={48} x2={154} y2={41} />
        </g>
      )
    case 'burst':
      return (
        <g stroke={GLOW} strokeWidth={2.6} strokeLinecap="round" className="orbi-hands-pop" style={{ transformOrigin: '85px 40px' }}>
          <line x1={36} y1={20} x2={28} y2={12} />
          <line x1={134} y1={20} x2={142} y2={12} />
          <line x1={24} y1={34} x2={14} y2={31} />
          <line x1={146} y1={34} x2={156} y2={31} />
        </g>
      )
    case 'sparkle':
      return (
        <g fill={GLOW}>
          <path className="orbi-hands-twinkle" style={{ transformOrigin: '152px 16px' }} d="M152 4 L154.8 13.2 L164 16 L154.8 18.8 L152 28 L149.2 18.8 L140 16 L149.2 13.2 Z" />
          <path className="orbi-hands-twinkle" style={{ transformOrigin: '165px 36px', animationDelay: '400ms' }} d="M165 30 L166.5 34.5 L171 36 L166.5 37.5 L165 42 L163.5 37.5 L159 36 L163.5 34.5 Z" />
        </g>
      )
    case 'hearts':
      return (
        <g>
          {[
            { x: 28, y: 40, s: 0.62, d: 0 },
            { x: 142, y: 26, s: 0.78, d: 700 },
            { x: 156, y: 54, s: 0.52, d: 1400 },
          ].map((h) => (
            // Placed by the group, animated inside it: a CSS transform-origin
            // on the placed element would also move its `transform` attribute.
            <g key={h.x} transform={`translate(${h.x} ${h.y}) scale(${h.s})`}>
              <g className="orbi-hands-float" style={{ animationDelay: `${h.d}ms` }}>
                <Heart3D halo={false} />
              </g>
            </g>
          ))}
        </g>
      )
    default:
      return null
  }
}

export default function OrbiShowcaseHands({
  poseId,
  theme,
  reducedMotion,
}: {
  poseId: string
  theme: 'dark' | 'light'
  reducedMotion: boolean
}) {
  const pose = handPoseFor(poseId)
  const c = ORBI_THEME_COLORS[theme]
  const lead = pose.lead ?? 'right'

  const arm = (side: 'left' | 'right') => {
    const a = pose[side]
    const shoulder = SHOULDER[side]
    const delay = reducedMotion || side === lead ? 0 : FOLLOW_MS
    return (
      <g transform={`translate(${shoulder.x} ${shoulder.y})`}>
        <g
          style={{
            transform: `translate(${a.x}px, ${a.y}px) rotate(${a.r}deg)`,
            transition: reducedMotion ? 'none' : `transform 600ms ${SETTLE} ${delay}ms`,
          }}
        >
          {/* Its own slow sway, on a different clock per arm. */}
          <g className={side === 'left' ? 'orbi-hands-idle-a' : 'orbi-hands-idle-b'}>
            <g className={pose.wave && side === 'right' ? 'orbi-hands-wave' : undefined}>
              <ArmShape rim={c.rim} />
            </g>
          </g>
        </g>
      </g>
    )
  }

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${ORBI_VIEWBOX.width} ${ORBI_VIEWBOX.height}`}
      width="100%"
      height="100%"
      className={reducedMotion ? 'orbi-hands-still' : undefined}
      style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      <defs>
        <radialGradient id="orbi-heart-fill" cx="0.36" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#DDF5FF" />
          <stop offset="0.3" stopColor="#7AD6FF" />
          <stop offset="0.72" stopColor="#2F9BFF" />
          <stop offset="1" stopColor="#1360C4" />
        </radialGradient>
        <filter id="orbi-heart-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>
      {arm('left')}
      {arm('right')}
      {/* Held in the hug, so it sits in front of the arms. It beats — a big
          thump and a small one — and rocks slowly, as a solid thing turning in
          the light rather than a flat shape pulsing. */}
      {pose.heart && (
        <g transform="translate(85 110) scale(1.6)">
          <g className="orbi-heart-rock">
            <g className="orbi-hands-beat">
              <Heart3D />
            </g>
          </g>
        </g>
      )}
      {/* Keyed on the pose, so each accent pops in fresh with its reaction. */}
      <g key={poseId}>
        <Accent kind={pose.accent ?? null} theme={theme} />
      </g>

      <style>{`
        /* Reduced motion: every pose and symbol still shows, nothing moves. */
        .orbi-hands-still * { animation: none !important; }
        /* About the shoulder — the origin of each arm's group. */
        .orbi-hands-idle-a { transform-origin: 0px 0px; animation: orbiArmSway 3.1s ease-in-out infinite; }
        .orbi-hands-idle-b { transform-origin: 0px 0px; animation: orbiArmSway 3.7s ease-in-out -1.2s infinite; }
        @keyframes orbiArmSway {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(3deg); }
        }
        .orbi-hands-wave { transform-origin: 0px 0px; animation: orbiArmWave 0.8s ease-in-out 3 150ms; }
        @keyframes orbiArmWave {
          0%, 100% { transform: rotate(0deg); }
          30%      { transform: rotate(-16deg); }
          70%      { transform: rotate(12deg); }
        }
        .orbi-hands-pop { animation: orbiHandsPop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) 180ms both; }
        @keyframes orbiHandsPop {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .orbi-hands-dot { animation: orbiHandsDot 1.1s ease-in-out infinite; }
        @keyframes orbiHandsDot {
          0%, 100% { opacity: 0.35; }
          40%      { opacity: 1; }
        }
        .orbi-hands-twinkle { animation: orbiHandsTwinkle 1.4s ease-in-out infinite; }
        @keyframes orbiHandsTwinkle {
          0%, 100% { transform: scale(0.6) rotate(0deg); opacity: 0.6; }
          50%      { transform: scale(1.1) rotate(20deg); opacity: 1; }
        }
        /* Floating hearts: grow in, drift up with a sway, fade. */
        .orbi-hands-float { transform-box: fill-box; transform-origin: center; animation: orbiHandsFloat 2.8s ease-out infinite both; }
        @keyframes orbiHandsFloat {
          0%   { opacity: 0; transform: translate(0px, 8px) scale(0.5) rotate(-12deg); }
          25%  { opacity: 1; transform: translate(2px, 0px) scale(1) rotate(-4deg); }
          60%  { transform: translate(-3px, -9px) scale(1) rotate(8deg); }
          100% { opacity: 0; transform: translate(3px, -20px) scale(0.9) rotate(-6deg); }
        }
        /* The held heart: lub-dub, with its glow swelling on each beat. */
        .orbi-hands-beat { transform-box: fill-box; transform-origin: center; animation: orbiHandsBeat 1.2s ease-in-out infinite; }
        @keyframes orbiHandsBeat {
          0%, 100% { transform: scale(1); }
          14%      { transform: scale(1.16); }
          28%      { transform: scale(0.98); }
          42%      { transform: scale(1.09); }
          60%      { transform: scale(1); }
        }
        .orbi-heart-halo { animation: orbiHeartHalo 1.2s ease-in-out infinite; }
        @keyframes orbiHeartHalo {
          0%, 60%, 100% { opacity: 0.35; }
          14%           { opacity: 0.85; }
          42%           { opacity: 0.6; }
        }
        /* A slow turn: narrowing sideways as it rotates reads as depth. */
        .orbi-heart-rock { transform-box: fill-box; transform-origin: center; animation: orbiHeartRock 3.4s ease-in-out infinite; }
        @keyframes orbiHeartRock {
          0%, 100% { transform: rotate(-5deg) scaleX(1); }
          50%      { transform: rotate(5deg) scaleX(0.86); }
        }
      `}</style>
    </svg>
  )
}
