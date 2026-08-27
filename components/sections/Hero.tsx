'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/motion'
import GradientText from '@/components/ui/GradientText'

const stats = [
  { value: '2026', label: 'Founded this year' },
  { value: '2–10', label: 'UG Engineers' },
  { value: '3+', label: 'Real client projects' },
  { value: '100%', label: 'Client satisfaction' },
]

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

const heroStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.13, delayChildren: 0.38 } },
}


export default function Hero() {
  return (
    <section
      id="hero"
      style={{
        position: 'relative',
        zIndex: 10,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 24px 64px',
        overflow: 'hidden',
        background: '#05070C',
      }}
    >
      {/*
        The artwork. Decorative, so `alt` is empty and it carries no meaning
        the DOM above it does not already state.

        `loading="eager"` + `fetchPriority="high"` rather than the `priority`
        prop, which Next 16 deprecated: this paints behind the LCP headline,
        so it must not wait on a lazy-load threshold. `objectPosition` keeps
        the blade in the right-hand column at wide sizes and pulls it back
        toward centre once the layout stacks.
      */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Image
          src="/images/herobg.png"
          alt=""
          fill
          sizes="100vw"
          quality={90}
          loading="eager"
          fetchPriority="high"
          className="hero-bg-img"
          style={{ objectFit: 'cover' }}
        />
      </div>

      {/*
        Legibility scrim. The artwork is near-black on the left and very bright
        through the middle-right, which is the opposite of what a left-aligned
        headline needs — so the ramp is heaviest over the copy column, lifts
        across the blade, and closes again at the far edge so the crop has no
        hard seam.
      */}
      <div
        aria-hidden="true"
        className="hero-scrim-x"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
      />

      {/* Vertical scrim — clears the fixed navbar at the top, and settles
          the artwork again before the seam at the bottom. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(5,7,12,0.88) 0%, rgba(5,7,12,0.12) 24%, rgba(5,7,12,0.18) 58%, rgba(5,7,12,0.78) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Primary spotlight beam — the entrance sweep, softened so it reads as
          light moving across the artwork rather than a second light source. */}
      <motion.div
        aria-hidden="true"
        initial={{ y: -620, opacity: 0 }}
        animate={{
          y: [-620, -40, 960],
          opacity: [0, 0.7, 0],
        }}
        transition={{
          duration: 2.6,
          times: [0, 0.26, 1],
          ease: [0.22, 1, 0.36, 1],
          delay: 0.05,
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          marginLeft: '-540px',
          width: '1080px',
          height: '600px',
          background:
            'radial-gradient(ellipse 580px 300px at 50% 0%, rgba(215,232,255,0.14) 0%, rgba(185,212,255,0.06) 32%, rgba(155,195,255,0.02) 58%, transparent 76%)',
          pointerEvents: 'none',
          zIndex: 2,
          mixBlendMode: 'screen',
        }}
      />

      {/* Secondary soft diffusion halo */}
      <motion.div
        aria-hidden="true"
        initial={{ y: -500, opacity: 0 }}
        animate={{
          y: [-500, 80, 1100],
          opacity: [0, 0.3, 0],
        }}
        transition={{
          duration: 2.9,
          times: [0, 0.28, 1],
          ease: [0.22, 1, 0.4, 1],
          delay: 0.18,
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          marginLeft: '-620px',
          width: '1240px',
          height: '700px',
          background:
            'radial-gradient(ellipse 700px 380px at 50% 5%, rgba(180,210,255,0.06) 0%, rgba(150,190,255,0.018) 50%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 2,
          mixBlendMode: 'screen',
          filter: 'blur(8px)',
        }}
      />

      {/* Fade into the band the next section paints, so the seam disappears. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '160px',
          background: 'linear-gradient(to bottom, transparent, #0A0F16)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="hero-main">
        <motion.div
          variants={heroStagger}
          initial="hidden"
          animate="visible"
          style={{ width: '100%' }}
        >

          {/*
            ORBI parks himself beside this box to greet, roughly 175px clear
            of its right edge. That is the copy column rather than the full
            wrapper, so he still lands in open artwork now that the copy is
            centred. Where he doesn't fit, `resolveHeroSpot` returns null and
            he greets from his corner dock — the intended fallback.
          */}
          <div className="hero-copy" data-orbi-cinematic="hero">
            {/*
              The company name had nowhere to be read: the navbar carries
              only the X mark and the lede buried "xCalibur Labz" mid-
              sentence. This is the wordmark's slot — mark, name, and the
              status chip it used to sit alone in.
            */}
            <motion.div variants={fadeUp} className="hero-brandline">
              <Image
                src="/images/logoN.png"
                alt=""
                width={331}
                height={220}
                className="hero-brand-mark"
              />
              <span className="hero-brand-name">
                <span className="hero-brand-x">x</span>Calibur&nbsp;Labz
              </span>
              <span className="hero-status">
                <span className="hero-eyebrow-dot" aria-hidden="true" />
                Available for new projects
              </span>
            </motion.div>

            <motion.div variants={fadeUp}>
              <GradientText
                as="h1"
                className="hero-title"
                style={{
                  // Sized against the copy column, not picked by eye. The
                  // longest of the three lines ("Drives Results.") renders
                  // ~12em wide, so 64px needs ~767px of the 920px column.
                  // 7vw is the steepest slope that still keeps that line
                  // inside the column on a 320px phone — past it the last
                  // line wraps and the headline runs to four.
                  fontSize: 'clamp(22px, 7vw, 64px)',
                  fontWeight: 800,
                  lineHeight: 1.06,
                  letterSpacing: '-0.03em',
                  // The site's headline look is a vertical scale, which is
                  // a transform — the ink grows but the layout box does not,
                  // so it bleeds over whatever follows. Stretched harder
                  // now (1.22 -> 1.35), which means the bleed grows too:
                  // the margin is (scaleY - 1) x lines x line-height, plus
                  // the gap actually wanted. At three lines that is
                  // 0.35 x 3 x 1.06 = 1.11em of overflow, so 1.55em leaves
                  // ~0.44em of real space above the lede.
                  transform: 'scale(1.04, 1.35)',
                  transformOrigin: 'top center',
                  margin: '0 0 1.55em',
                  // Even split if a line still has to wrap on a very
                  // narrow phone, rather than one orphaned word.
                  textWrap: 'balance',
                }}
              >
                {/*
                  Three deliberate lines rather than whatever the column
                  width happens to give — `display: block` breaks in the
                  same two places at every size, and the break points make
                  a staircase (short, medium, long) instead of the ragged
                  edge a natural wrap produced.

                  The accent lands on the last line, which is the payoff.
                  It is polished steel, not the brand blue — the blade in
                  the artwork already owns the blue, and a second blue over
                  the top of it flattened both.
                */}
                <span style={{ display: 'block' }}>We Build</span>
                <span style={{ display: 'block' }}>Software That</span>
                <span
                  className="hero-title-accent"
                  style={{
                    display: 'block',
                    background:
                      'linear-gradient(120deg, #FFFFFF 0%, #F2F7FC 34%, #B9C6D6 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Drives Results.
                </span>
              </GradientText>
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="hero-lede"
              style={{
                fontSize: '17px',
                color: '#93A6BC',
                lineHeight: 1.75,
                margin: '0 auto 34px',
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                maxWidth: '560px',
              }}
            >
              xCalibur Labz is a team of engineers who turn business challenges into clean, scalable digital products. We&apos;re young, sharp, and we ship software that works.
            </motion.p>

            <motion.div variants={fadeUp} className="hero-cta">
              <a
                href="#work"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '14px 30px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                  textDecoration: 'none',
                }}
                className="btn-shimmer btn-primary"
                data-orbi-interest="point"
                data-orbi-avoid="high"
                data-orbi-label="view-work"
              >
                View Our Work
                <ArrowIcon />
              </a>
              <a
                href="#contact"
                data-orbi-interest="point"
                data-orbi-avoid="high"
                data-orbi-label="talk-to-us"
                className="btn-shimmer btn-primary btn-primary--alt"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '14px 30px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                  textDecoration: 'none',
                }}
              >
                Talk to Us
                <ArrowIcon />
              </a>
            </motion.div>

            {/* Figures under the CTAs. The value carries the display
                treatment; the label is left in the same body colour as the
                lede rather than the dim tracked micro-caps a stat row usually
                gets — they are sentences, not axis labels. */}
            <motion.div variants={fadeUp} className="hero-facts">
              {stats.map((s) => (
                <div key={s.label} className="fact">
                  <p className="fact-value">{s.value}</p>
                  <p className="fact-label">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </div>


        </motion.div>
      </div>

      <style>{`
        .hero-bg-img {
          object-position: 62% 50%;
        }
        /* Two layers: a pool under the centred copy so it stays legible over
           the bright part of the blade, and a symmetric ramp that closes the
           crop at both edges. The old single ramp was heaviest on the left
           because the copy used to live there. */
        .hero-scrim-x {
          background:
            radial-gradient(
              ellipse 820px 460px at 50% 48%,
              rgba(5,7,12,0.86) 0%,
              rgba(5,7,12,0.62) 52%,
              rgba(5,7,12,0.12) 80%,
              transparent 100%
            ),
            linear-gradient(
              90deg,
              #05070C 0%,
              rgba(5,7,12,0.72) 22%,
              rgba(5,7,12,0.44) 50%,
              rgba(5,7,12,0.44) 74%,
              rgba(5,7,12,0.78) 100%
            );
        }
        /* The copy block, centred in the section rather than stretched to
           fill it. */
        .hero-main {
          max-width: 1180px;
          width: 100%;
          position: relative;
          z-index: 3;
          flex: 0 1 auto;
          display: flex;
          align-items: center;
        }
        /* One centred column at every width. The measure is set by the
           headline (see the note on fontSize) — 920px holds the longest of
           its three lines at 56px with room to spare. */
        .hero-copy {
          max-width: 920px;
          margin: 0 auto;
          text-align: center;
        }

        /* Brand lockup — mark, wordmark, availability chip, centred as one
           group above the headline. */
        .hero-brandline {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 14px;
          margin: 0 0 30px;
        }
        .hero-brand-mark {
          width: 42px;
          height: auto;
          flex: none;
          filter: drop-shadow(0 0 14px rgba(94, 233, 255, 0.22));
        }
        .hero-brand-name {
          font-family: var(--font-syne), system-ui, sans-serif;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 0.06em;
          white-space: nowrap;
          background: linear-gradient(120deg, #FFFFFF 0%, #C4D2E1 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        /* The name is "xCalibur", not "XCalibur" — the leading x is a
           lead-in to the C, so it is set smaller than the letters after it
           and nudged down to sit on the same baseline. */
        .hero-brand-x {
          font-size: 0.7em;
          font-weight: 600;
          display: inline-block;
          transform: translateY(0.06em);
        }
        .hero-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: none;
          padding: 6px 14px 6px 11px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.035);
          backdrop-filter: blur(6px);
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.03em;
          color: #A8BACE;
          white-space: nowrap;
        }
        .hero-eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #5EE9FF;
          box-shadow: 0 0 0 3px rgba(94, 233, 255, 0.14);
          animation: heroDotPulse 2.4s ease-in-out infinite;
        }
        @keyframes heroDotPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(94, 233, 255, 0.14); }
          50%      { box-shadow: 0 0 0 6px rgba(94, 233, 255, 0.04); }
        }

        /*
          A grid of two equal tracks rather than two flex items, which sized
          themselves to their labels — "View Our Work" came out wider than
          "Talk to Us" at every width. minmax(0, 220px) lets the pair shrink
          together on a tablet instead of overflowing.
        */
        .hero-cta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 220px));
          justify-content: center;
          gap: 16px;
        }

        .hero-facts {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 20px 64px;
          margin-top: 52px;
        }
        .fact-value {
          font-family: var(--font-syne), system-ui, sans-serif;
          font-size: clamp(24px, 2.2vw, 32px);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.02em;
          margin: 0 0 8px;
          background: linear-gradient(160deg, #FFFFFF 0%, #C4D2E1 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .fact-label {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.5;
          color: #93A6BC;
          margin: 0;
        }
        @media (max-width: 480px) {
          .hero-facts { gap: 18px 34px; }
        }
        /* Phone: the lockup and the figures both go. The lockup wants a row
           it cannot get, and the figures stack into a tall column that pushes
           the CTAs off the first screen — the headline and the two buttons
           are what have to land. */
        @media (max-width: 640px) {
          .hero-brandline,
          .hero-facts { display: none; }
        }

        @media (max-width: 540px) {
          /* Below this the pair cannot both hold their label on one line, so
             they stack — still one shared track width, so still equal. */
          .hero-cta { grid-template-columns: minmax(0, 300px); }
        }

        /* Stacked: the copy centres and the artwork recentres so the blade is
           not cropped off-screen behind it. */
        @media (max-width: 900px) {
          .hero-bg-img {
            object-position: 72% 50%;
          }
          .hero-scrim-x {
            background: linear-gradient(
              180deg,
              rgba(5,7,12,0.9) 0%,
              rgba(5,7,12,0.75) 40%,
              rgba(5,7,12,0.85) 100%
            );
          }
          .hero-copy {
            width: 100%;
            min-width: 0;
          }
          .hero-brandline { gap: 12px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-eyebrow-dot { animation: none; }
        }
      `}</style>
    </section>
  )
}
