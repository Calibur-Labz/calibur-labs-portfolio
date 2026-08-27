'use client'

import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'

const reasons = [
  {
    number: '01',
    title: 'Expert Team',
    description: 'Engineers who have studied the craft deeply and are driven by the challenge of building things that last.',
  },
  {
    number: '02',
    title: 'Agile Process',
    description: 'We work in short cycles, ship often, and adapt fast. You see real progress every week — not just reports.',
  },
  {
    number: '03',
    title: 'Cutting Edge Tech',
    description: 'We stay current with modern stacks, tools, and patterns so your product is built for today and tomorrow.',
  },
  {
    number: '04',
    title: 'Transparent Process',
    description: 'No black boxes. You always know what we are building, why, and what comes next.',
  },
  {
    number: '05',
    title: 'Scalable Solutions',
    description: 'We architect for growth from the start — so your software can handle whatever comes next.',
  },
  {
    number: '06',
    title: 'Ongoing Support',
    description: 'We don\'t disappear after launch. We stay to ensure your product runs, grows, and improves.',
  },
]

export default function WhyChooseUs() {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '60px 24px',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          style={{ marginBottom: '64px' }}
        >
          <motion.div variants={fadeUp}>
            <SectionLabel>Why xCalibur Labz</SectionLabel>
          </motion.div>
          <motion.div variants={fadeUp}>
            <GradientText
              as="h2"
              style={{
                fontSize: 'clamp(28px, 4vw, 44px)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                transform: 'scale(1.25)',
                transformOrigin: 'top left',
                marginBottom: '0.3em',
                // 80% = 1 / 1.25. The scale is uniform, so the painted box is
                // 25% wider than the layout box; at full width that spilled
                // past the viewport on a phone and gave the whole page a
                // horizontal scrollbar.
                maxWidth: 'min(640px, 80%)',
              }}
            >
              Why Choose Us
            </GradientText>
          </motion.div>
        </motion.div>

        {/* Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
          }}
          className="why-grid"
        >
          {reasons.map((r) => (
            <motion.div
              key={r.number}
              variants={fadeUp}
              style={{
                padding: '36px 32px',
                borderRadius: '16px',
                background: '#0C121C',
                border: '1px solid rgba(255,255,255,0.04)',
                transition: 'border-color 0.3s, background 0.3s',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'rgba(0,183,255,0.45)'
                el.style.background = '#121A26'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'rgba(255,255,255,0.04)'
                el.style.background = '#0C121C'
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  fontFamily: 'var(--font-syne), system-ui, sans-serif',
                  fontWeight: 800,
                  fontSize: '12px',
                  color: '#E9F1F8',
                  letterSpacing: '0.2em',
                  marginBottom: '20px',
                  background: 'rgba(0,183,255,0.12)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                }}
              >
                {r.number}
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-syne), system-ui, sans-serif',
                  fontWeight: 700,
                  fontSize: '19px',
                  color: '#E9F1F8',
                  margin: '0 0 12px',
                  letterSpacing: '-0.01em',
                }}
              >
                {r.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                  fontSize: '14px',
                  color: '#6E8399',
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {r.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .why-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 540px) {
          .why-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
