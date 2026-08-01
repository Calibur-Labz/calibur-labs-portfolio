'use client'

import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'

const highlights = [
  { value: '2026', label: 'Founded this year' },
  { value: '2–10', label: 'UG Engineers' },
  { value: '1', label: 'Real client project' },
]

export default function About() {
  return (
    <section
      id="about"
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '60px 24px',
      }}
    >
      <div style={{ maxWidth: '860px', margin: '0 auto', textAlign: 'center' }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <motion.div variants={fadeUp}>
            <SectionLabel>Who We Are</SectionLabel>
          </motion.div>

          <motion.div variants={fadeUp}>
            <GradientText
              as="h2"
              style={{
                fontSize: 'clamp(32px, 4.5vw, 48px)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                marginBottom: '28px',
                textAlign: 'center',
              }}
            >
              A Team Built to Solve Hard Problems.
            </GradientText>
          </motion.div>

          <motion.p
            variants={fadeUp}
            style={{
              color: '#93A6BC',
              fontSize: '16px',
              lineHeight: 1.8,
              marginBottom: '16px',
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              textAlign: 'center',
            }}
          >
            xCalibur Labz is a startup founded in 2026 by a group of undergraduate engineers who believe great software starts with a deep understanding of the business behind it. We are young, hungry, and we care about every line of code.
          </motion.p>

          {/* Highlights */}
          <motion.div
            variants={fadeUp}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
            className="highlights-grid"
          >
            {highlights.map((h, i) => (
              <div
                key={h.label}
                style={{
                  padding: '32px 24px',
                  background: '#0C121C',
                  textAlign: 'center',
                  borderRight: i < highlights.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                }}
              >
                <p style={{
                  fontFamily: 'var(--font-syne), system-ui, sans-serif',
                  fontWeight: 800,
                  fontSize: 'clamp(28px, 3vw, 40px)',
                  color: '#E9F1F8',
                  margin: '0 0 6px',
                  letterSpacing: '-0.02em',
                }}>
                  {h.value}
                </p>
                <p style={{
                  fontSize: '13px',
                  color: '#6E8399',
                  margin: 0,
                  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                  fontWeight: 500,
                }}>
                  {h.label}
                </p>
              </div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} style={{ marginTop: '40px' }}>
            <a
              href="#contact"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '13px 30px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                textDecoration: 'none',
              }}
              className="btn-shimmer btn-ghost"
            >
              Work With Us →
            </a>
          </motion.div>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .highlights-grid {
            grid-template-columns: 1fr !important;
          }
          .highlights-grid > div {
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.07);
          }
          .highlights-grid > div:last-child {
            border-bottom: none;
          }
        }
      `}</style>
    </section>
  )
}
