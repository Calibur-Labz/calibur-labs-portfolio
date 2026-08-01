'use client'

import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'

export default function BuildWithPrecision() {
  return (
    <section
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
                  fontSize: 'clamp(32px, 4.5vw, 52px)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                  marginTop: '20px',
                }}
              >
                Built with Precision.
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

          {/* Right — diamond graphic */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <svg
              viewBox="0 0 400 360"
              style={{ width: '100%', maxWidth: '420px' }}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
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
                stroke="rgba(255,255,255,0.09)"
                strokeWidth="1"
              />
              <polygon
                points="200,95 305,180 200,265 95,180"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1.5"
              />
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
