'use client'

import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/motion'
import GlowBadge from '@/components/ui/GlowBadge'
import GradientText from '@/components/ui/GradientText'
import BladeLight from '@/components/ui/BladeLight'

const stats = [
  { value: '3+', label: 'Project Delivered' },
  { value: '2026', label: 'Year Founded' },
  { value: '10+', label: 'UG Engineers' },
  { value: '100%', label: 'Client Satisfaction' },
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 24px',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Persistent ambient glow — stays after spotlight exits */}
      <div
        style={{
          position: 'absolute',
          top: '-8%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '1100px',
          height: '520px',
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(155,195,255,0.042) 0%, rgba(130,175,255,0.015) 45%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Primary spotlight beam */}
      <motion.div
        initial={{ y: -620, opacity: 0 }}
        animate={{
          y: [-620, -40, 960],
          opacity: [0, 0.9, 0],
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
            'radial-gradient(ellipse 580px 300px at 50% 0%, rgba(215,232,255,0.17) 0%, rgba(185,212,255,0.08) 32%, rgba(155,195,255,0.025) 58%, transparent 76%)',
          pointerEvents: 'none',
          zIndex: 2,
          mixBlendMode: 'screen',
        }}
      />

      {/* Secondary soft diffusion halo */}
      <motion.div
        initial={{ y: -500, opacity: 0 }}
        animate={{
          y: [-500, 80, 1100],
          opacity: [0, 0.38, 0],
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
            'radial-gradient(ellipse 700px 380px at 50% 5%, rgba(180,210,255,0.07) 0%, rgba(150,190,255,0.02) 50%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 2,
          mixBlendMode: 'screen',
          filter: 'blur(8px)',
        }}
      />

      {/* Content */}
      <div style={{ maxWidth: '800px', width: '100%', position: 'relative', zIndex: 3 }}>
        <motion.div variants={heroStagger} initial="hidden" animate="visible">

          <motion.div variants={fadeUp} style={{ marginTop: '16px', marginBottom: '28px', display: 'flex', justifyContent: 'center' }}>
            <GlowBadge>Sri Lankan Startup · Est. 2026</GlowBadge>
          </motion.div>

          <motion.div variants={fadeUp}>
            <GradientText
              as="h1"
              style={{
                fontSize: 'clamp(40px, 6vw, 72px)',
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                margin: '0 0 24px',
              }}
            >
              We Build Software That Drives Results.
            </GradientText>
          </motion.div>

          <motion.p
            variants={fadeUp}
            style={{
              fontSize: '18px',
              color: '#6E8399',
              lineHeight: 1.7,
              margin: '0 auto 40px',
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              maxWidth: '560px',
            }}
          >
            xCalibur Labz is a team of engineers who turn business challenges into clean, scalable digital products. We&apos;re young, sharp, and we ship software that works.
          </motion.p>

          <motion.div
            variants={fadeUp}
            style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '56px' }}
          >
            <a
              href="#work"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                minWidth: '200px',
                padding: '13px 30px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 600,
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                textDecoration: 'none',
              }}
              className="btn-shimmer btn-primary"
              data-orbi-interest="point"
            >
              View Our Work
              <ArrowIcon />
            </a>
            <a
              href="#contact"
              data-orbi-interest="point"
              className="btn-shimmer btn-primary btn-primary--alt"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                minWidth: '200px',
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

          {/* Stats */}
          <motion.div variants={fadeUp}>
            <BladeLight style={{ marginBottom: '40px' }} />
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}
              className="stats-grid"
            >
              {stats.map((s) => (
                <div key={s.label}>
                  <p
                    style={{
                      fontSize: 'clamp(24px, 3vw, 36px)',
                      fontWeight: 800,
                      color: '#E9F1F8',
                      margin: '0 0 4px',
                      fontFamily: 'var(--font-syne), system-ui, sans-serif',
                    }}
                  >
                    {s.value}
                  </p>
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#6E8399',
                      margin: 0,
                      fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                      fontWeight: 500,
                    }}
                  >
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

        </motion.div>
      </div>

      <style>{`
        @media (max-width: 540px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </section>
  )
}
