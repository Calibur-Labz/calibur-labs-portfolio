'use client'

import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'
import GlassCard from '@/components/ui/GlassCard'
import ContactForm from '@/components/sections/ContactForm'

export default function Contact() {
  return (
    <section
      id="contact"
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '60px 24px',
        background: '#0A0F16',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Centered heading block */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          style={{ textAlign: 'center', marginBottom: '48px' }}
        >
          <motion.div variants={fadeUp} style={{ display: 'flex', justifyContent: 'center' }}>
            <SectionLabel>Let&rsquo;s Talk</SectionLabel>
          </motion.div>
          <motion.div variants={fadeUp}>
            <GradientText
              as="h2"
              style={{
                fontSize: 'clamp(26px, 3.2vw, 44px)',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                // 94% ~= 1 / 1.06. The heading's scaleX widens the painted
                // box past its layout box, which spilled off the right of the
                // viewport on phones and small tablets.
                maxWidth: '94%',
                marginInline: 'auto',
                transform: 'scale(1.06, 1.25)',
                transformOrigin: 'top center',
                marginBottom: 'calc(20px + 0.55em)',
              }}
            >
              Ready to Build{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #00B7FF 0%, #5EE9FF 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Something Great?
              </span>
            </GradientText>
          </motion.div>
          <motion.p
            variants={fadeUp}
            style={{
              color: '#6E8399',
              fontSize: '16px',
              lineHeight: 1.8,
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            }}
          >
            Tell us about your project and we&apos;ll get back to you within 24 hours with a plan and a quote.
          </motion.p>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          style={{ marginBottom: '32px' }}
        >
          <GlassCard style={{ padding: '40px 36px' }}>
            <ContactForm />
          </GlassCard>
        </motion.div>
      </div>
    </section>
  )
}
