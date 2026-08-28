'use client'

/**
 * The ORBI product page body.
 *
 * The homepage carries a short overview and sends people here; this is where
 * the detail, the options and the prices live. Same visual language as the
 * page sections — inline styles, the shared motion variants, the site's topic
 * ramp on headings and blue kept for structure rather than words.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import ContactForm from '@/components/sections/ContactForm'
import OrbiShowcase from '@/components/sections/OrbiShowcase'
import { motion } from 'framer-motion'
import { fadeUp, slideInLeft, stagger, staggerFast } from '@/lib/motion'
import {
  groupsForTier,
  monthlyPriceUsd,
  orbiAddOns,
  orbiFaq,
  orbiPackages,
  orbiStats,
  setupPriceUsd,
  type ProductPackage,
} from '@/lib/data'
import SectionLabel from '@/components/ui/SectionLabel'

const usd = (value: number) => `$${value.toLocaleString('en-US')}`

const ACCENT = '#00B7FF'
const TEXT = '#E9F1F8'
const MUTED = '#6E8399'
const POPPINS = 'var(--font-poppins), system-ui, sans-serif'
const SYNE = 'var(--font-syne), system-ui, sans-serif'

const BLUE = 'linear-gradient(135deg, #00B7FF 0%, #5EE9FF 100%)'

/** The site's heading treatment — the ramp `GradientText` uses everywhere. */
const topicText = {
  background: 'linear-gradient(135deg, #E9F1F8 0%, #93A6BC 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
} as const

const blueText = {
  background: BLUE,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
} as const

function PackageCard({
  pkg,
  onGetStarted,
}: {
  pkg: ProductPackage
  onGetStarted: () => void
}) {
  const popular = Boolean(pkg.popular)
  // The list figures, kept only where the offer actually replaces them.
  const setupWas = pkg.discount?.setupUsd !== undefined ? pkg.setupUsd : undefined
  const monthlyWas =
    pkg.discount?.monthlyUsd !== undefined ? pkg.monthlyUsd : undefined

  return (
    <motion.div
      variants={fadeUp}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 28px 28px',
        borderRadius: '18px',
        background: popular ? '#101825' : '#0C121C',
        border: popular
          ? '1px solid rgba(0,183,255,0.45)'
          : '1px solid rgba(255,255,255,0.05)',
        boxShadow: popular ? '0 0 60px rgba(0,183,255,0.14)' : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(0,183,255,0.45)'
        el.style.boxShadow = '0 0 50px rgba(0,183,255,0.18)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = popular
          ? 'rgba(0,183,255,0.45)'
          : 'rgba(255,255,255,0.05)'
        el.style.boxShadow = popular ? '0 0 60px rgba(0,183,255,0.14)' : 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '18%',
          width: '64%',
          height: '1px',
          background: popular
            ? 'linear-gradient(90deg, transparent, #00B7FF, transparent)'
            : 'linear-gradient(90deg, transparent, rgba(0,183,255,0.45), transparent)',
        }}
      />

      {popular && (
        <span
          style={{
            position: 'absolute',
            top: '-11px',
            left: '28px',
            padding: '4px 14px',
            borderRadius: '99px',
            background: BLUE,
            color: '#04070C',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: POPPINS,
          }}
        >
          Most popular
        </span>
      )}

      <h3
        style={{
          fontSize: '18px',
          fontWeight: 700,
          margin: 0,
          fontFamily: SYNE,
          letterSpacing: '-0.01em',
          ...topicText,
        }}
      >
        {pkg.name}
      </h3>

      {/* The price, and the offer if one is running.

          Only a fee the discount actually names is struck through: an offer on
          the build fee leaves the retainer printed plainly, because striking a
          number that has not moved would read as a saving nobody is getting.
          The old figure is a <s>, so it is marked as no longer accurate rather
          than merely drawn with a line across it. */}
      <div style={{ margin: '18px 0 22px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '32px',
              fontWeight: 800,
              fontFamily: SYNE,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              ...topicText,
            }}
          >
            {usd(setupPriceUsd(pkg))}
          </span>
          <span style={{ fontSize: '13px', color: MUTED, fontFamily: POPPINS }}>
            one-time
          </span>
          {setupWas !== undefined && (
            <s
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: MUTED,
                fontFamily: SYNE,
                letterSpacing: '-0.02em',
                textDecorationThickness: '1px',
              }}
            >
              {usd(setupWas)}
            </s>
          )}
        </div>
        <div
          style={{
            marginTop: '6px',
            fontSize: '13px',
            color: TEXT,
            fontFamily: POPPINS,
            fontWeight: 600,
          }}
        >
          + {usd(monthlyPriceUsd(pkg))}
          <span style={{ color: MUTED, fontWeight: 500 }}> / month</span>
          {monthlyWas !== undefined && (
            <s
              style={{
                marginLeft: '8px',
                color: MUTED,
                fontWeight: 500,
                textDecorationThickness: '1px',
              }}
            >
              {usd(monthlyWas)}
            </s>
          )}
        </div>
        {pkg.discount && (
          <span
            style={{
              display: 'inline-block',
              marginTop: '12px',
              padding: '4px 11px',
              borderRadius: '99px',
              border: '1px solid rgba(0,183,255,0.35)',
              background: 'rgba(0,183,255,0.10)',
              color: '#5EE9FF',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: POPPINS,
            }}
          >
            {pkg.discount.label}
          </span>
        )}
      </div>

      <p
        style={{
          fontSize: '14px',
          color: TEXT,
          fontWeight: 500,
          lineHeight: 1.4,
          margin: '0 0 4px',
          fontFamily: POPPINS,
        }}
      >
        {pkg.summary}
      </p>

      {/* What this price buys — one line per capability, derived from the
          tier so a card can never claim something the groups do not describe.
          The individual beats live in ORBI's own knowledge base; a pricing
          card is for deciding, not for reading a specification. */}
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '20px 0 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          flexGrow: 1,
        }}
      >
        {groupsForTier(pkg.tier).map((group) => (
          <li key={group.id} style={{ display: 'flex', gap: '11px' }}>
            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: 'rgba(0,183,255,0.12)',
                border: '1px solid rgba(0,183,255,0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: ACCENT,
                flexShrink: 0,
                marginTop: '1px',
              }}
            >
              {group.icon}
            </span>
            <span>
              <span
                style={{
                  display: 'block',
                  fontSize: '15px',
                  fontWeight: 700,
                  fontFamily: SYNE,
                  letterSpacing: '-0.005em',
                  marginBottom: '3px',
                  ...topicText,
                }}
              >
                {group.title}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '14px',
                  color: MUTED,
                  lineHeight: 1.6,
                  fontFamily: POPPINS,
                }}
              >
                {group.description}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {/* Opens the contact form in place rather than sending the visitor to
          the homepage's — they are reading a tier, and the enquiry carries
          which one. The page-bottom CTA still links to /#contact. */}
      <button
        type="button"
        onClick={onGetStarted}
        className="btn-shimmer btn-primary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '24px',
          padding: '12px 22px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 600,
          fontFamily: POPPINS,
          textDecoration: 'none',
          cursor: 'pointer',
        }}
      >
        Get started
      </button>
    </motion.div>
  )
}

export default function OrbiProduct() {
  /* The tier whose "Get started" was clicked, and whether its form is showing.
   *
   * Two pieces of state rather than one nullable: closing only flips the flag,
   * so `selected` survives the exit animation and the heading does not blank
   * out to "Get started —" on the way off screen. */
  const [selected, setSelected] = useState<ProductPackage | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Land at the top. Arriving from a scrolled homepage — or coming back
  // through the history stack — otherwise restores the old offset and the page
  // visibly jumps upward a frame later.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '160px 24px 72px',
          background: '#0A0F16',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="orbi-hero"
          style={{
            position: 'relative',
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '0.78fr 1.22fr',
            gap: '48px',
            alignItems: 'center',
          }}
        >
          <motion.div variants={slideInLeft}>
            <OrbiShowcase />
          </motion.div>

          <div>
            <motion.h1
              variants={fadeUp}
              style={{
                fontSize: 'clamp(28px, 5vw, 44px)',
                fontWeight: 800,
                fontFamily: SYNE,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                // 94% ~= 1 / 1.06. The heading's scaleX widens the painted
                // box past its layout box, which spilled off the right of the
                // viewport on phones and small tablets.
                maxWidth: 'min(640px, 94%)',
                transform: 'scale(1.06, 1.25)',
                transformOrigin: 'top left',
                margin: 0,
                marginBottom: '28px',
                ...topicText,
              }}
            >
              ORBI — a site companion
              <br />
              with a <span style={blueText}>personality</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              style={{
                fontSize: '16px',
                color: MUTED,
                lineHeight: 1.75,
                margin: '0 0 28px',
                maxWidth: '560px',
                fontFamily: POPPINS,
              }}
            >
              Most website chat widgets are a button that opens a box. ORBI is a
              character who lives on the page: he arrives, notices you, reacts
              to what you are reading, shows you around if you ask, keeps you
              company in the contact form, and falls asleep when things go
              quiet. He is scroll-aware, cursor-aware, and — at the top tier —
              able to answer questions about your business in plain language.
            </motion.p>

            {/* Hard numbers */}
            <motion.div
              variants={fadeUp}
              className="orbi-stats"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
                marginTop: '36px',
                paddingTop: '28px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {orbiStats.map((stat) => (
                <div key={stat.label}>
                  <div
                    style={{
                      fontSize: '22px',
                      fontWeight: 800,
                      fontFamily: SYNE,
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                      ...topicText,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: MUTED,
                      lineHeight: 1.4,
                      marginTop: '6px',
                      fontFamily: POPPINS,
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section
        id="pricing"
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '60px 24px',
          background: '#0A0F16',
          scrollMarginTop: '110px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            style={{ marginBottom: '44px' }}
          >
            <motion.div variants={fadeUp}>
              <SectionLabel>Pricing</SectionLabel>
            </motion.div>
            <motion.h2
              variants={fadeUp}
              style={{
                fontSize: 'clamp(28px, 5vw, 44px)',
                fontWeight: 800,
                fontFamily: SYNE,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                // 94% ~= 1 / 1.06. The heading's scaleX widens the painted
                // box past its layout box, which spilled off the right of the
                // viewport on phones and small tablets.
                maxWidth: '94%',
                transform: 'scale(1.06, 1.25)',
                transformOrigin: 'top left',
                margin: 0,
                marginBottom: '28px',
                ...topicText,
              }}
            >
              Three ways to put him to work
            </motion.h2>
            <motion.p
              variants={fadeUp}
              style={{
                color: MUTED,
                fontSize: '16px',
                lineHeight: 1.7,
                marginTop: '16px',
                maxWidth: '520px',
                fontFamily: POPPINS,
              }}
            >
              A fixed build fee plus a monthly retainer covering hosting,
              updates and support. All prices in USD, excluding local taxes.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            className="orbi-pricing"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              alignItems: 'stretch',
            }}
          >
            {orbiPackages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                onGetStarted={() => {
                  setSelected(pkg)
                  setModalOpen(true)
                }}
              />
            ))}
          </motion.div>

          {/* ── Add-ons ──────────────────────────────────────────────
              One panel, not three cards: these are footnotes to a decision
              already made above, and three separate bordered boxes competed
              with the tiers they sit under. Unlabelled on purpose — the
              prices and the units say what they are without a heading
              introducing them. */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={fadeUp}
            style={{
              marginTop: '32px',
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Three columns, divided rather than boxed */}
            <div
              className="orbi-addons"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
              }}
            >
              {orbiAddOns.map((addOn, i) => (
                <div
                  key={addOn.name}
                  className="orbi-addon"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '20px 22px',
                    borderLeft:
                      i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'rgba(0,183,255,0.12)',
                      border: '1px solid rgba(0,183,255,0.25)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      color: ACCENT,
                      flexShrink: 0,
                    }}
                  >
                    {addOn.icon}
                  </span>

                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 700,
                        fontFamily: SYNE,
                        letterSpacing: '-0.005em',
                        marginBottom: '4px',
                        ...topicText,
                      }}
                    >
                      {addOn.name}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '17px',
                          fontWeight: 800,
                          fontFamily: SYNE,
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                          ...topicText,
                        }}
                      >
                        {usd(addOn.priceUsd)}
                      </span>
                      <span
                        style={{
                          fontSize: '11.5px',
                          color: MUTED,
                          fontFamily: POPPINS,
                        }}
                      >
                        {addOn.unit}
                      </span>
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 10, padding: '60px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            style={{ marginBottom: '40px' }}
          >
            <motion.div variants={fadeUp}>
              <SectionLabel>Before You Ask</SectionLabel>
            </motion.div>
            <motion.h2
              variants={fadeUp}
              style={{
                fontSize: 'clamp(28px, 5vw, 44px)',
                fontWeight: 800,
                fontFamily: SYNE,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                // 94% ~= 1 / 1.06. The heading's scaleX widens the painted
                // box past its layout box, which spilled off the right of the
                // viewport on phones and small tablets.
                maxWidth: '94%',
                transform: 'scale(1.06, 1.25)',
                transformOrigin: 'top left',
                margin: 0,
                marginBottom: '28px',
                ...topicText,
              }}
            >
              The honest answers
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={staggerFast}
            className="orbi-faq"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px',
            }}
          >
            {orbiFaq.map((item) => (
              <motion.div
                key={item.question}
                variants={fadeUp}
                style={{
                  padding: '26px 24px',
                  borderRadius: '14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    margin: '0 0 10px',
                    fontFamily: SYNE,
                    ...topicText,
                  }}
                >
                  {item.question}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: MUTED,
                    lineHeight: 1.7,
                    margin: 0,
                    fontFamily: POPPINS,
                  }}
                >
                  {item.answer}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Closing line */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
            style={{
              marginTop: '56px',
              padding: '40px 32px',
              borderRadius: '18px',
              background: '#0C121C',
              border: '1px solid rgba(0,183,255,0.20)',
              textAlign: 'center',
            }}
          >
            <motion.h3
              variants={fadeUp}
              style={{
                fontSize: 'clamp(22px, 3.8vw, 30px)',
                fontWeight: 800,
                margin: '0 0 12px',
                fontFamily: SYNE,
                letterSpacing: '-0.025em',
                ...topicText,
              }}
            >
              He is on this page right now
            </motion.h3>
            <motion.p
              variants={fadeUp}
              style={{
                fontSize: '15px',
                color: MUTED,
                lineHeight: 1.7,
                margin: '0 auto 24px',
                maxWidth: '460px',
                fontFamily: POPPINS,
              }}
            >
              Poke him, scroll past him, or leave the tab alone for a minute and
              watch what happens. Then tell us what you want yours to do.
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link
                href="/#contact"
                className="btn-shimmer btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '14px 30px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: POPPINS,
                  textDecoration: 'none',
                }}
              >
                Start a conversation
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <style>{`
        /* Tablet — the hero stops being side-by-side and the priced cards
           stack. The FAQ is the exception: two short cards still read fine at
           this width, and one column left the page very sparse. */
        @media (max-width: 980px) {
          .orbi-hero {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
          .orbi-pricing,
          .orbi-addons {
            grid-template-columns: 1fr !important;
          }
          .orbi-addon {
            border-left: none !important;
          }
          .orbi-addon + .orbi-addon {
            border-top: 1px solid rgba(255,255,255,0.06);
          }
        }

        /* Phone. The four figures were four columns all the way down to
           420px, which gave each one ~86px on a 430px handset and broke
           every label onto two lines. Same 640px step the homepage uses. */
        @media (max-width: 640px) {
          .orbi-stats {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 24px 18px !important;
          }
          .orbi-faq {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 420px) {
          .orbi-stats {
            gap: 18px 14px !important;
          }
        }
      `}</style>

      {/* One modal for the section rather than one per card: `ContactForm`
          hardcodes its `aria-describedby` ids, so two mounted copies would
          emit duplicates. */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        labelledBy="orbi-package-form-title"
      >
        <div style={{ padding: '34px 32px 32px' }}>
          <h2
            id="orbi-package-form-title"
            style={{
              margin: '0 0 8px',
              fontSize: 'clamp(20px, 3.4vw, 26px)',
              fontWeight: 800,
              fontFamily: SYNE,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              ...topicText,
            }}
          >
            Get started — {selected?.name}
          </h2>
          <p
            style={{
              margin: '0 0 26px',
              fontSize: '14px',
              lineHeight: 1.7,
              color: MUTED,
              fontFamily: POPPINS,
            }}
          >
            Tell us where your site lives and what you want him to do. We reply
            within 24 hours.
          </p>

          <ContactForm packageName={selected?.name} />
        </div>

        {/* Last in the DOM on purpose: the focus-on-open lands on the first
            focusable, and that should be the name field, not Close. */}
        <button
          type="button"
          onClick={() => setModalOpen(false)}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.04)',
            color: TEXT,
            fontSize: '18px',
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </Modal>
    </>
  )
}
