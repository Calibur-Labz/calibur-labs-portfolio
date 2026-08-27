'use client'

import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'

export default function BuildWithPrecision() {
  return (
    <section
      id="precision"
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '60px 24px',
        background: '#0A0F16',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div
        style={{ maxWidth: '1200px', margin: '0 auto' }}
        className="precision-wrapper"
      >
        <div className="precision-grid">
          {/* Left — text */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp}>
              <SectionLabel>How We Work</SectionLabel>
            </motion.div>
            <motion.div variants={fadeUp}>
              <GradientText
                as="h2"
                style={{
                  fontSize: 'clamp(28px, 4vw, 46px)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                  marginTop: '20px',
                  // 94% ~= 1 / 1.06 — the scaleX widens the painted box
                  // past its layout box and off the right of the viewport.
                  maxWidth: '94%',
                  transform: 'scale(1.06, 1.25)',
                  transformOrigin: 'top left',
                  marginBottom: '0.55em',
                }}
              >
                Built{' '}
                <span
                  style={{
                    background: 'linear-gradient(135deg, #00B7FF 0%, #5EE9FF 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  with
                </span>{' '}
                Precision.
              </GradientText>
            </motion.div>
            <motion.p
              variants={fadeUp}
              style={{
                color: '#6E8399',
                fontSize: '17px',
                lineHeight: 1.8,
                marginTop: '24px',
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                maxWidth: '480px',
              }}
            >
              Inspired by the strength and clarity of the legendary blade, xCalibur
              Labz focuses on delivering clean, scalable, and reliable IT systems.
            </motion.p>
          </motion.div>

          {/* Right — animated blade-diamond graphic */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            data-orbi-cinematic="precision"
            style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {/* Ambient cyan glow behind the diamond */}
            <motion.div
              animate={{ opacity: [0.4, 0.75, 0.4], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity }}
              style={{
                position: 'absolute',
                width: '62%',
                aspectRatio: '1',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(0,183,255,0.22) 0%, transparent 70%)',
                filter: 'blur(8px)',
                pointerEvents: 'none',
              }}
            />

            <svg
              viewBox="0 0 400 360"
              style={{ width: '100%', maxWidth: '420px', position: 'relative' }}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Outer frame — slow clockwise drift */}
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 70, ease: 'linear', repeat: Infinity }}
                style={{ transformOrigin: '50% 50%', transformBox: 'fill-box' }}
              >
                <polygon
                  points="200,10 390,180 200,350 10,180"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
                <polygon
                  points="200,55 345,180 200,305 55,180"
                  fill="none"
                  stroke="rgba(0,183,255,0.14)"
                  strokeWidth="1"
                />
              </motion.g>

              {/* Inner frame — counter-rotates, cyan trace pulses */}
              <motion.g
                animate={{ rotate: -360 }}
                transition={{ duration: 52, ease: 'linear', repeat: Infinity }}
                style={{ transformOrigin: '50% 50%', transformBox: 'fill-box' }}
              >
                <motion.polygon
                  points="200,95 305,180 200,265 95,180"
                  fill="none"
                  stroke="#00B7FF"
                  strokeWidth="1.5"
                  animate={{ opacity: [0.35, 0.9, 0.35] }}
                  transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
                />
              </motion.g>

              {/* Glowing core — breathing cyan diamond */}
              <motion.polygon
                points="200,150 235,180 200,210 165,180"
                fill="url(#coreGrad)"
                animate={{ opacity: [0.55, 1, 0.55], scale: [0.88, 1.06, 0.88] }}
                transition={{ duration: 3.4, ease: 'easeInOut', repeat: Infinity }}
                style={{ transformOrigin: '50% 50%', transformBox: 'fill-box' }}
              />
              <defs>
                <radialGradient id="coreGrad" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#5EE9FF" />
                  <stop offset="100%" stopColor="#00B7FF" stopOpacity="0.15" />
                </radialGradient>
              </defs>
            </svg>
          </motion.div>
        </div>
      </div>

      <style>{`
        .precision-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: center;
          gap: 80px;
        }
        @media (max-width: 768px) {
          .precision-grid {
            grid-template-columns: 1fr;
            gap: 48px;
          }
          .precision-grid > div:last-child {
            display: none;
          }
        }
      `}</style>
    </section>
  )
}
