'use client'

import { motion } from 'framer-motion'
import type { ComponentType } from 'react'
import { fadeUp, stagger } from '@/lib/motion'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'
import GlassCard from '@/components/ui/GlassCard'
import { MailIcon, PhoneIcon, ClockIcon } from '@/components/ui/icons'

type Detail = {
  Icon: ComponentType<{ size?: number }>
  label: string
  value: string
  href?: string
}

const contactDetails: Detail[] = [
  { Icon: MailIcon, label: 'Email', value: 'caliburlabz@gmail.com', href: 'mailto:caliburlabz@gmail.com' },
  { Icon: PhoneIcon, label: 'Phone', value: '+94 76 58 31021', href: 'tel:+94765831021' },
  { Icon: ClockIcon, label: 'Response', value: 'Within 24 hours' },
]

function ContactPill({ d }: { d: Detail }) {
  const Wrapper = d.href ? motion.a : motion.div

  return (
    <Wrapper
      {...(d.href ? { href: d.href } : {})}
      variants={fadeUp}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '16px 22px',
        borderRadius: '14px',
        textDecoration: 'none',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        cursor: d.href ? 'pointer' : 'default',
      }}
    >
      {/* Icon */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#5EE9FF',
        }}
      >
        <d.Icon size={20} />
      </span>
      <div>
        <p
          style={{
            fontSize: '11px',
            color: '#6E8399',
            margin: '0 0 3px',
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}
        >
          {d.label}
        </p>
        <p
          style={{
            fontSize: '14px',
            color: '#E9F1F8',
            margin: 0,
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
          }}
        >
          {d.value}
        </p>
      </div>
    </Wrapper>
  )
}

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
                fontSize: 'clamp(28px, 3.5vw, 48px)',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                marginBottom: '20px',
              }}
            >
              Ready to Build Something Great?
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

        {/* Contact detail pills */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '48px',
          }}
        >
          {contactDetails.map((d) => (
            <ContactPill key={d.label} d={d} />
          ))}
        </motion.div>

        {/* CTA card */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
        >
          <GlassCard style={{ padding: '48px 40px', textAlign: 'center' }}>
            <p style={{
              color: '#6E8399',
              fontSize: '15px',
              lineHeight: 1.8,
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              marginBottom: '32px',
            }}>
              Drop us an email and we&apos;ll get back to you within 24 hours with a plan and a quote.
            </p>
            <motion.a
              href="mailto:caliburlabz@gmail.com"
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.97 }}
              className="btn-shimmer btn-ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 36px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                textDecoration: 'none',
                letterSpacing: '0.01em',
              }}
            >
              caliburlabz@gmail.com →
            </motion.a>
          </GlassCard>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
