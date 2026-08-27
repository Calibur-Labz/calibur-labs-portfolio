'use client'

import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'
import { services } from '@/lib/data'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'

export default function Services() {
  return (
    <section
      id="services"
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '60px 24px',
        background: '#0A0F16',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          style={{ marginBottom: '40px' }}
        >
          <motion.div variants={fadeUp}>
            <SectionLabel>What We Build</SectionLabel>
          </motion.div>
          <motion.div variants={fadeUp}>
            <GradientText
              as="h2"
              style={{
                fontSize: 'clamp(28px, 3.6vw, 44px)',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                // 94% ~= 1 / 1.06. The heading's scaleX widens the painted
                // box past its layout box, which spilled off the right of the
                // viewport on phones and small tablets.
                maxWidth: 'min(640px, 94%)',
                transform: 'scale(1.06, 1.25)',
                transformOrigin: 'top left',
                marginBottom: '28px',
              }}
            >
              End-to-End
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #00B7FF 0%, #5EE9FF 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Digital
              </span>{' '}
              Solutions
            </GradientText>
          </motion.div>
          <motion.p
            variants={fadeUp}
            style={{
              color: '#6E8399',
              fontSize: '16px',
              lineHeight: 1.7,
              marginTop: '16px',
              maxWidth: '480px',
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            }}
          >
            From idea to deployment, we handle every layer of the stack.
          </motion.p>
        </motion.div>

        {/* Cards Grid */}
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
          className="services-grid"
        >
          {services.map((service) => (
            <motion.div
              key={service.id}
              variants={fadeUp}
              //whileHover={{ y: -6, transition: { duration: 0.2 } }}
              style={{
                position: 'relative',
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                padding: '32px',
                overflow: 'hidden',
                cursor: 'default',
                transition: 'border-color 0.3s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'rgba(0,183,255,0.45)'
                el.style.boxShadow = '0 0 20px rgba(0,183,255,0.14)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'rgba(255,255,255,0.06)'
                el.style.boxShadow = 'none'
              }}
            >
              {/* Top glow accent */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: '20%',
                width: '60%',
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(36,52,74,0.7), transparent)',
              }} />

              {/* Icon */}
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(0,183,255,0.12)',
                  border: '1px solid rgba(0,183,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  color: '#00B7FF',
                  marginBottom: '20px',
                }}
              >
                {service.icon}
              </div>

              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#E9F1F8',
                  margin: '0 0 12px',
                  fontFamily: 'var(--font-syne), system-ui, sans-serif',
                  letterSpacing: '-0.01em',
                }}
              >
                {service.title}
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: '#6E8399',
                  lineHeight: 1.7,
                  margin: 0,
                  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                }}
              >
                {service.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .services-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 540px) {
          .services-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
