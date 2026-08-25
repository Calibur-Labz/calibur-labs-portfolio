'use client'

/**
 * Our Products — the homepage overview.
 *
 * Introduces ORBI and sends people to `/orbi` for the detail, the options and
 * the prices. Nothing is priced here beyond the entry point, because the
 * homepage's job is to say the product exists, not to sell a tier.
 *
 * Deliberately inert as far as ORBI is concerned: no `data-orbi-*` attributes
 * and no entry in `ORBI_SECTION_BEHAVIORS`, so the companion scrolls past his
 * own overview without reacting to it.
 */

import Link from 'next/link'
import OrbiShowcase from '@/components/sections/OrbiShowcase'
import { motion } from 'framer-motion'
import { fadeUp, slideInLeft, stagger, staggerFast } from '@/lib/motion'
import { orbiHighlights } from '@/lib/data'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'

const ACCENT = '#00B7FF'
const MUTED = '#6E8399'
const POPPINS = 'var(--font-poppins), system-ui, sans-serif'
const SYNE = 'var(--font-syne), system-ui, sans-serif'

/**
 * Paint text in the blue ramp. Used exactly once — on the one word of the
 * section heading — so the blue still reads as emphasis. Everything else that
 * is not body copy takes `topicText`, and the colour survives as structure:
 * the ticks and the wash behind the product shot.
 */
const blueText = {
  background: 'linear-gradient(135deg, #00B7FF 0%, #5EE9FF 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
} as const

/** The site's heading treatment — the ramp `GradientText` uses everywhere. */
const topicText = {
  background: 'linear-gradient(135deg, #E9F1F8 0%, #93A6BC 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
} as const

function Tick() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: '4px' }}
    >
      <path
        d="M2.5 7.5L5.5 10.5L11.5 3.5"
        stroke={ACCENT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Products() {
  return (
    <section
      id="products"
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '60px 24px',
        overflow: 'hidden',
      }}
    >
      {/* A single blue wash behind the product shot, so the section reads as
          ORBI's own colour without tinting any of the copy. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '18%',
          left: '-10%',
          width: '620px',
          height: '620px',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          style={{ marginBottom: '48px' }}
        >
          <motion.div variants={fadeUp}>
            <SectionLabel>Our Products</SectionLabel>
          </motion.div>
          <motion.div variants={fadeUp}>
            <GradientText
              as="h2"
              style={{
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                maxWidth: '680px',
              }}
            >
              Software We <span style={blueText}>Own</span> and License
            </GradientText>
          </motion.div>
          <motion.p
            variants={fadeUp}
            style={{
              color: MUTED,
              fontSize: '16px',
              lineHeight: 1.7,
              marginTop: '16px',
              maxWidth: '480px',
              fontFamily: POPPINS,
            }}
          >
            Built in the lab, proven on this page, ready for yours.
          </motion.p>
        </motion.div>

        {/* ── ORBI overview ──────────────────────────────────────────── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="product-overview"
          style={{
            display: 'grid',
            gridTemplateColumns: '0.9fr 1.1fr',
            gap: '48px',
            alignItems: 'center',
          }}
        >
          {/* The product, demonstrating itself. */}
          <motion.div variants={slideInLeft}>
            <OrbiShowcase />
          </motion.div>

          {/* Copy */}
          <div>
            <motion.h3
              variants={fadeUp}
              style={{
                fontSize: 'clamp(24px, 2.6vw, 30px)',
                fontWeight: 800,
                margin: '0 0 12px',
                fontFamily: SYNE,
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
                ...topicText,
              }}
            >
              ORBI — a site companion with a personality
            </motion.h3>

            <motion.p
              variants={fadeUp}
              style={{
                fontSize: '15px',
                color: MUTED,
                lineHeight: 1.7,
                margin: '0 0 22px',
                fontFamily: POPPINS,
              }}
            >
              Most chat widgets are a button that opens a box. ORBI is a
              character who lives on the page — scroll-aware, cursor-aware, and
              able to answer questions about your business.
            </motion.p>

            <motion.ul
              variants={staggerFast}
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 26px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {orbiHighlights.map((highlight) => (
                <motion.li
                  key={highlight}
                  variants={fadeUp}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    fontSize: '14px',
                    color: MUTED,
                    lineHeight: 1.55,
                    fontFamily: POPPINS,
                  }}
                >
                  <Tick />
                  <span>{highlight}</span>
                </motion.li>
              ))}
            </motion.ul>

            <motion.div variants={fadeUp} style={{ marginTop: '4px' }}>
              <Link
                href="/orbi"
                className="btn-shimmer btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '13px 26px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: POPPINS,
                  textDecoration: 'none',
                }}
              >
                Explore ORBI
                <span aria-hidden="true">→</span>
              </Link>
            </motion.div>

          </div>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .product-overview {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
        }
      `}</style>
    </section>
  )
}
