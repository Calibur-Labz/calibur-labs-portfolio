'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'
import { techStack } from '@/lib/data'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'

function MarqueeRow({ items, reverse = false }: { items: typeof techStack; reverse?: boolean }) {
  const doubled = [...items, ...items]
  return (
    <div style={{ overflow: 'hidden', width: '100%', marginBottom: '16px' }}>
      <div
        style={{
          display: 'flex',
          gap: '24px',
          animation: `${reverse ? 'marqueeReverse' : 'marquee'} 30s linear infinite`,
          width: 'max-content',
        }}
      >
        {doubled.map((tech, i) => (
          <div
            key={`${tech.name}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 24px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'rgba(0,183,255,0.45)'
              el.style.background = 'rgba(0,183,255,0.05)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'rgba(255,255,255,0.06)'
              el.style.background = 'rgba(255,255,255,0.02)'
            }}
          >
            <Image
              src={tech.icon}
              alt={tech.name}
              width={20}
              height={20}
              unoptimized
              style={{ opacity: 0.6, filter: 'brightness(0) invert(1)' }}
            />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#6E8399',
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              {tech.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TechStack() {
  const half = Math.ceil(techStack.length / 2)
  const row1 = techStack.slice(0, half)
  const row2 = techStack.slice(half)

  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '120px 0',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          style={{ marginBottom: '48px', textAlign: 'center' }}
        >
          <motion.div variants={fadeUp} style={{ display: 'flex', justifyContent: 'center' }}>
            <SectionLabel>Our Stack</SectionLabel>
          </motion.div>
          <motion.div variants={fadeUp}>
            <GradientText
              as="h2"
              style={{
                fontSize: 'clamp(28px, 3.5vw, 44px)',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
              }}
            >
              Technologies We Use
            </GradientText>
          </motion.div>
        </motion.div>
      </div>

      <MarqueeRow items={row1} />
      <MarqueeRow items={row2} reverse />
    </section>
  )
}
