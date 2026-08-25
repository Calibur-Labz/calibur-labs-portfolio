'use client'

/**
 * The live ORBI showcase — what replaced the product photograph.
 *
 * A screenshot of a companion is the one thing that cannot show what he is:
 * the whole product is how he *reacts*. So this renders the real `OrbiRobot`
 * — the same inline SVG the companion himself is drawn from — cycles it
 * through his actual expressions, and lets the visitor's cursor move his eyes.
 *
 * Presentation only, and completely separate from the ORBI runtime: it renders
 * the robot component directly and never touches `OrbiGuide`, the arbiter, the
 * gaze controller or any of the hooks. Nothing here can affect the companion
 * running in the corner of the same page.
 */

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'
import {
  ORBI_EMOTION,
  OrbiRobot,
  OrbiSleepParticles,
  useReducedMotion,
  type OrbiExpression,
} from '@/components/orbi'

const ACCENT = '#00B7FF'
const MUTED = '#6E8399'
const POPPINS = 'var(--font-poppins), system-ui, sans-serif'
const SYNE = 'var(--font-syne), system-ui, sans-serif'

const topicText = {
  background: 'linear-gradient(135deg, #E9F1F8 0%, #93A6BC 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
} as const

type Reaction = {
  id: string
  expression: OrbiExpression
  label: string
  wave?: boolean
  bright?: boolean
  dozing?: boolean
  /**
   * Properly asleep, not merely drowsy. This is the flag the snoring mouth
   * hangs off in `OrbiFace` — `dozing` alone shuts the eyes but leaves no
   * mouth at all — and it is the state the Z's belong to.
   */
  asleep?: boolean
  /** Overrides `HOLD_MS` for reactions that need longer to play out. */
  holdMs?: number
  /**
   * Where the eyes go for this beat, normalized −1…1 — the same numbers the
   * companion's own gaze controller takes. A reaction that sets this owns the
   * eyes for its whole hold, exactly as an `interaction` gaze outranks the
   * cursor in the real thing.
   */
  gaze?: { x: number; y: number }
  /** Degrees of body lean. Dropped entirely under reduced motion. */
  tilt?: number
  /** The second line under the caption. */
  sub: string
  /** Vertical lift, px. Positive rises. Dropped under reduced motion. */
  lift?: number
  /** Both arms out — the difference between pleased and delighted. */
  armsOut?: boolean
  /** The stabiliser catching up, after being poked once too often. */
  wobble?: boolean
  /** A small flinch away, then back. */
  recoil?: boolean
}

/**
 * The rotation. Each one is a real behaviour from the product, named the way
 * a visitor would describe it rather than the way the code does.
 */
const REACTIONS: Reaction[] = [
  {
    id: 'normal',
    expression: 'normal',
    label: 'Just hanging out',
    sub: 'ORBI stays quietly by your side',
    holdMs: 2200,
  },
  {
    id: 'hello',
    expression: 'happy',
    label: 'Says hello, once',
    sub: 'He introduces himself, then gets out of the way',
    wave: true,
    bright: true,
    holdMs: 2900,
  },
  {
    id: 'thinking',
    expression: 'thinking',
    label: 'Thinking it through',
    sub: 'Looks thoughtful while finding an answer',
    // Up and slightly aside — where people look when they are considering
    // something rather than reading it.
    gaze: ORBI_EMOTION.thinking.gaze,
    tilt: ORBI_EMOTION.thinking.tilt,
  },
  {
    id: 'curious',
    expression: 'curious',
    label: 'Curious about what you found',
    sub: 'Leans in at whatever catches your attention',
    // Gaze and lean the *same* way: leaning toward what he is looking at is
    // what separates curious from shy, which does the opposite. The face now
    // carries it too — wider eyes at different heights, and a mouth lifted at
    // the end he is looking toward.
    gaze: { x: -0.9, y: 0.12 },
    tilt: -ORBI_EMOTION.curiousLean * 1.6,
  },
  {
    id: 'happy',
    expression: 'happy',
    label: 'Happy when things go well',
    sub: 'A little happiness goes a long way',
    // Deliberately no `bright` and only a whisper of lift. Everything that
    // makes Excited loud is absent here, which is the only way the two read
    // as different feelings rather than two takes on one.
    lift: 3,
  },
  {
    id: 'track',
    expression: 'normal',
    label: 'Follows your cursor',
    sub: 'Move your cursor across him',
    holdMs: 2600,
  },
  {
    id: 'surprised',
    expression: 'surprised',
    label: 'Sometimes you catch him by surprise',
    sub: 'Unexpected clicks get a reaction',
    // The face already carries this: `surprised` widens both eyes 1.22× and
    // swaps in the round mouth. The flinch is the body's share.
    recoil: true,
    holdMs: 2900,
  },
  {
    id: 'shy',
    expression: 'shy',
    label: 'Goes a little bashful',
    sub: 'Especially when you make a fuss',
    gaze: ORBI_EMOTION.shy.gaze,
    tilt: ORBI_EMOTION.shy.tilt,
  },
  {
    id: 'wink',
    expression: 'wink',
    label: 'Hides a few secrets',
    sub: 'There are things to find if you go looking',
    holdMs: 2400,
  },
  {
    id: 'excited',
    expression: 'excited',
    label: 'Gets excited about great work',
    sub: 'Some things deserve extra enthusiasm',
    // Louder than Happy on every axis the robot has: star eyes, a wider
    // smile, sparks around his head, arms out, and four times the rise. It
    // used to be the happy face with the volume up, which is precisely the
    // thing the brief says is not good enough.
    bright: true,
    armsOut: true,
    lift: 12,
    holdMs: 2900,
  },
  {
    id: 'unsure',
    expression: 'unsure',
    label: 'Tilts his head when he is not sure',
    sub: 'Even ORBI has to think twice sometimes',
    // No longer the thinking face pointed sideways. One eye pinched, the
    // other opened wide, a wavering mouth, and a question mark beside his
    // head — Thinking considers, and this hesitates, and now they look it.
    gaze: ORBI_EMOTION.unsure.gaze,
    tilt: ORBI_EMOTION.unsure.tilt * 1.8,
  },
  {
    id: 'concerned',
    expression: 'concerned',
    label: 'Even ORBI has worried moments',
    sub: 'But he keeps things calm',
    gaze: ORBI_EMOTION.concerned.gaze,
    tilt: ORBI_EMOTION.concerned.tilt,
    // Settles *down* rather than lifting — the one beat that does.
    lift: -5,
  },
  {
    id: 'sleepy',
    expression: 'sleepy',
    label: 'Needs a little rest sometimes',
    sub: 'Things are getting quiet',
    // Heavy lids and nothing more. No `dozing`, so the eyes are still open
    // and there is no sleeping mouth — this is the beat *before* sleep.
    tilt: 2,
    lift: -3,
  },
  {
    id: 'deepSleep',
    expression: 'sleepy',
    label: 'And sometimes a little more rest',
    sub: 'Yes, ORBI actually falls asleep',
    dozing: true,
    asleep: true,
    // The Z's are on the companion's own schedule: the first is held back
    // 1.5s so the order reads (eyes close, *then* a Z), and a full float is
    // 2.6s. At the standard hold this beat would end before a Z finished
    // rising, so it gets long enough to show one properly.
    holdMs: 7000,
  },
  {
    id: 'dizzy',
    expression: 'dizzy',
    label: 'Maybe don’t poke him too much',
    sub: 'Too much attention can make him dizzy',
    // The face is the companion's own: `dizzy` sets the lids at different
    // heights. The wobble is the stabiliser catching up, as it does after
    // the fifth poke.
    wobble: true,
    holdMs: 3000,
  },
]

/** How long a reaction is held by default. Long enough to read the caption. */
const HOLD_MS = 2800

/** Pupil travel, in viewBox units. Matches the companion's own feel. */
const GAZE_X = 5
const GAZE_Y = 3.5

export default function OrbiShowcase() {
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)

  /**
   * The robot's rendered width in px. `OrbiSleepParticles` places its glyphs
   * as a fraction of it, and here the robot is sized in percentages, so it has
   * to be measured rather than known.
   */
  const [robotSize, setRobotSize] = useState(0)
  const sleepLayerRef = useRef<HTMLDivElement>(null)

  const armRef = useRef<SVGGElement>(null)
  const leftArmRef = useRef<SVGGElement>(null)
  const gazeRef = useRef<SVGGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const reaction = REACTIONS[index]

  /**
   * Cycle the reactions. One timer, re-armed per reaction rather than a fixed
   * interval, so a beat that needs longer — the doze, waiting on its Z's — can
   * simply ask for it. Clicking a dot restarts the hold, which is what someone
   * who just jumped to a reaction expects.
   */
  useEffect(() => {
    const id = setTimeout(
      () => setIndex((current) => (current + 1) % REACTIONS.length),
      REACTIONS[index].holdMs ?? HOLD_MS,
    )
    return () => clearTimeout(id)
  }, [index])

  /**
   * The arm pivots at its shoulder, in viewBox coordinates. Set once on the
   * element the robot handed back, because the wave is a CSS animation here
   * rather than the companion's GSAP timeline.
   */
  useEffect(() => {
    const arm = armRef.current
    if (arm) {
      arm.style.transformBox = 'view-box'
      arm.style.transformOrigin = '143.5px 78px'
    }
    // The left shoulder too, so the excited beat can raise both. The wave
    // only ever used the right one, which is why this was not needed before.
    const left = leftArmRef.current
    if (left) {
      left.style.transformBox = 'view-box'
      left.style.transformOrigin = '26.5px 78px'
    }
  }, [])

  /**
   * Arms out, for the one beat that needs them.
   *
   * Written as inline transforms rather than a CSS class because the wave
   * already owns an animation on the right arm — a class would have the two
   * fighting over the same property on the same element.
   */
  useEffect(() => {
    const out = reaction.armsOut && !reducedMotion
    for (const [ref, angle] of [
      [armRef, -46],
      [leftArmRef, 46],
    ] as const) {
      const el = ref.current
      if (!el) continue
      el.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)'
      el.style.transform = out ? `rotate(${angle}deg)` : 'rotate(0deg)'
    }
  }, [index, reaction.armsOut, reducedMotion])

  useEffect(() => {
    const layer = sleepLayerRef.current
    if (!layer) return
    const observer = new ResizeObserver(([entry]) =>
      setRobotSize(entry.contentRect.width),
    )
    observer.observe(layer)
    return () => observer.disconnect()
  }, [])

  /**
   * Point the eyes where this beat wants them — or hand them back to centre.
   *
   * Runs on every reaction change, so a beat that carries its own gaze shows
   * it immediately rather than waiting for a pointer that may never arrive.
   * The transition is what makes it read as a look rather than a jump; the
   * pointer path below sets the same property with no transition, which is
   * what keeps cursor tracking feeling instant.
   */
  useEffect(() => {
    const gaze = gazeRef.current
    if (!gaze) return
    const to = reaction.gaze
    gaze.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)'
    gaze.style.transform = to
      ? `translate(${to.x * GAZE_X}px, ${to.y * GAZE_Y}px)`
      : 'translate(0px, 0px)'
  }, [index, reaction.gaze])

  /** Eyes follow the pointer across the stage, and re-centre when it leaves. */
  const trackPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const gaze = gazeRef.current
    const stage = stageRef.current
    if (!gaze || !stage || event.pointerType === 'touch') return
    // A beat that owns the eyes keeps them. Same order as the companion's own
    // gaze controller, where an `interaction` target outranks the cursor —
    // otherwise the one mouse-move would undo the beat being demonstrated.
    if (reaction.gaze) return
    gaze.style.transition = 'none'

    const box = stage.getBoundingClientRect()
    const dx = (event.clientX - (box.left + box.width / 2)) / (box.width / 2)
    const dy = (event.clientY - (box.top + box.height / 2)) / (box.height / 2)
    const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v)

    gaze.style.transform = `translate(${clamp(dx) * GAZE_X}px, ${clamp(dy) * GAZE_Y}px)`
  }

  const releasePointer = () => {
    const gaze = gazeRef.current
    if (!gaze || reaction.gaze) return
    gaze.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)'
    gaze.style.transform = 'translate(0px, 0px)'
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={stagger}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {/* Stage */}
      <motion.div
        variants={fadeUp}
        ref={stageRef}
        onPointerMove={trackPointer}
        onPointerLeave={releasePointer}
        className="orbi-stage"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          aspectRatio: '1 / 1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // The depth the flat SVG is posed inside.
          perspective: '900px',
        }}
      >
        {/* The robot, tilted and bobbing on its own axis. */}
        <div
          className={reducedMotion ? undefined : 'orbi-float'}
          style={{
            position: 'relative',
            width: '84%',
            transformStyle: 'preserve-3d',
          }}
        >
          <div className={reaction.wave && !reducedMotion ? 'orbi-waving' : undefined}>
            {/*
              The lean gets its own element on purpose. `.orbi-float` owns the
              transform above it and the wave animates an arm below it, so a
              rotation written anywhere else would be overwritten by one of
              them. Dropped to zero under reduced motion — the eyes and the
              face carry the beat there, exactly as they do in the product.
            */}
            <div
              className={
                reducedMotion
                  ? undefined
                  : reaction.wobble
                    ? 'orbi-wobble'
                    : reaction.recoil
                      ? 'orbi-recoil'
                      : undefined
              }
              style={{
                // Lean and lift on one element and one property, so nothing
                // ever has two owners. A beat that wobbles or recoils hands
                // the property to its keyframes instead.
                transform:
                  reducedMotion || reaction.wobble || reaction.recoil
                    ? undefined
                    : `translateY(${-(reaction.lift ?? 0)}px) rotate(${reaction.tilt ?? 0}deg)`,
                transformOrigin: '50% 85%',
                transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
            <OrbiRobot
              expression={reaction.expression}
              awake
              bright={reaction.bright}
              dozing={reaction.dozing}
              asleep={reaction.asleep}
              gazeRef={gazeRef}
              armRef={armRef}
              leftArmRef={leftArmRef}
            />
            </div>
          </div>
        </div>

        {/*
          The Z's, while he is dozing.
          
          The companion's own `OrbiSleepParticles`, unchanged — same glyphs,
          same drift, same keyframes. It positions itself from its parent's
          top-left, so the parent is an overlay sized to exactly the robot's
          box: 84% of a square stage, at the SVG's own 170:152 ratio, which
          makes it 75.1% tall and centres it 12.4% down. Deliberately
          *outside* the float, so the Z's hang in the air rather than bobbing
          along with him.
        */}
        <div
          ref={sleepLayerRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '8%',
            top: '12.4%',
            width: '84%',
            aspectRatio: '170 / 152',
            pointerEvents: 'none',
          }}
        >
          <OrbiSleepParticles
            active={reaction.asleep === true}
            side="right"
            size={robotSize}
            reducedMotion={reducedMotion}
          />
        </div>

        {/* Ground shadow, so he reads as hovering rather than pasted on. */}
        <div
          aria-hidden="true"
          className={reducedMotion ? undefined : 'orbi-groundshadow'}
          style={{
            position: 'absolute',
            bottom: '8%',
            width: '44%',
            height: '14px',
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse, rgba(0,183,255,0.34) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
      </motion.div>

      {/* Caption */}
      <motion.div
        variants={fadeUp}
        style={{ textAlign: 'center', marginTop: '4px', minHeight: '52px' }}
      >
        <div
          // Announced as one changing region rather than six separate lines.
          aria-live="polite"
          style={{
            fontSize: '15px',
            fontWeight: 700,
            fontFamily: SYNE,
            letterSpacing: '-0.01em',
            ...topicText,
          }}
        >
          {reaction.label}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: MUTED,
            fontFamily: POPPINS,
            marginTop: '6px',
          }}
        >
          {reaction.sub}
        </div>
      </motion.div>

      {/* Which reaction is showing */}
      <motion.div
        variants={fadeUp}
        style={{ display: 'flex', gap: '7px', marginTop: '16px' }}
      >
        {REACTIONS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={item.label}
            aria-current={i === index}
            style={{
              width: i === index ? '22px' : '7px',
              height: '7px',
              padding: 0,
              borderRadius: '99px',
              border: 'none',
              cursor: 'pointer',
              background: i === index ? ACCENT : 'rgba(255,255,255,0.16)',
              transition: 'width 0.35s ease, background 0.35s ease',
            }}
          />
        ))}
      </motion.div>

      <style>{`
        .orbi-float {
          animation: orbiShowcaseFloat 6.5s ease-in-out infinite;
        }
        @keyframes orbiShowcaseFloat {
          0%, 100% { transform: translateY(0) rotateY(-7deg) rotateX(2deg); }
          50%      { transform: translateY(-14px) rotateY(7deg) rotateX(-2deg); }
        }
        .orbi-groundshadow {
          animation: orbiShowcaseShadow 6.5s ease-in-out infinite;
        }
        @keyframes orbiShowcaseShadow {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50%      { transform: scale(0.82); opacity: 0.5; }
        }
        /* The wave, on the arm group the robot handed back. */
        .orbi-waving g[style*="view-box"] {
          animation: orbiShowcaseWave 1.15s ease-in-out 2;
        }
        @keyframes orbiShowcaseWave {
          0%   { transform: rotate(0deg); }
          20%  { transform: rotate(-125deg); }
          40%  { transform: rotate(-142deg); }
          60%  { transform: rotate(-118deg); }
          80%  { transform: rotate(-135deg); }
          100% { transform: rotate(0deg); }
        }
        /* Poked once too often: tip, over-correct, correct again, centre —
           the same shape as the companion's own stabiliser wobble. */
        .orbi-wobble {
          animation: orbiShowcaseWobble 1.5s ease-in-out infinite;
          transform-origin: 50% 85%;
        }
        @keyframes orbiShowcaseWobble {
          0%, 100% { transform: rotate(0deg); }
          22%      { transform: rotate(-7deg); }
          48%      { transform: rotate(5deg); }
          74%      { transform: rotate(-2.5deg); }
        }
        /* A flinch back and an elastic return, once per beat. */
        .orbi-recoil {
          animation: orbiShowcaseRecoil 1.1s cubic-bezier(0.22, 1, 0.36, 1) 1;
          transform-origin: 50% 85%;
        }
        @keyframes orbiShowcaseRecoil {
          0%   { transform: translateY(0) rotate(0deg); }
          14%  { transform: translateY(7px) rotate(5deg); }
          46%  { transform: translateY(-2px) rotate(-1.5deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .orbi-float,
          .orbi-groundshadow,
          .orbi-wobble,
          .orbi-recoil,
          .orbi-waving g[style*="view-box"] {
            animation: none !important;
          }
        }
      `}</style>
    </motion.div>
  )
}
