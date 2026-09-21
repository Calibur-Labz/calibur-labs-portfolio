import Link from 'next/link'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'
import type { Service } from '@/lib/data'

/**
 * A single service page's body.
 *
 * Deliberately a Server Component with no animation: this is the content a
 * crawler reads and the reason the page can rank, so it belongs in the initial
 * HTML rather than appearing after hydration. The homepage sections animate
 * because they are the first thing a visitor sees; a service page is something
 * someone arrived at from a search result, and it should simply be there.
 *
 * Styling follows the rest of the site — inline styles against the same tokens
 * declared in `app/globals.css`, not Tailwind classes.
 */

const BAND = '#0A0F16'
const PANEL = '#0C121C'
const HAIRLINE = '#17222F'
const HEADING = '#E9F1F8'
const BODY = '#93A6BC'
const MUTED = '#6E8399'
const ACCENT = '#00B7FF'

const shell: React.CSSProperties = {
  maxWidth: '900px',
  margin: '0 auto',
  padding: '0 24px',
}

export default function ServiceDetail({ service }: { service: Service }) {
  return (
    <>
      {/* Hero */}
      <section style={{ background: '#05070C', padding: '150px 0 70px' }}>
        <div style={shell}>
          {/* A visible trail back up the hierarchy, matching the BreadcrumbList
              in the page's structured data. */}
          <nav
            aria-label="Breadcrumb"
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              marginBottom: '26px',
              fontSize: '14px',
              color: MUTED,
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            }}
          >
            <Link href="/" style={{ color: MUTED, textDecoration: 'none' }}>
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/services" style={{ color: MUTED, textDecoration: 'none' }}>
              Services
            </Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: BODY }}>{service.title}</span>
          </nav>

          <SectionLabel>{service.title}</SectionLabel>

          <GradientText
            as="h1"
            style={{
              display: 'block',
              fontSize: 'clamp(30px, 5vw, 52px)',
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              margin: '0 0 26px',
              textWrap: 'balance',
            }}
          >
            {service.h1}
          </GradientText>

          <p
            style={{
              fontSize: '18px',
              lineHeight: 1.78,
              color: BODY,
              margin: 0,
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            }}
          >
            {service.intro}
          </p>

          <div style={{ marginTop: '36px' }}>
            <Link
              href="/#contact"
              className="btn-shimmer btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '14px 30px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              }}
            >
              Talk to us about {service.title.toLowerCase()}
            </Link>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section style={{ background: BAND, padding: '70px 0' }}>
        <div style={shell}>
          <SectionLabel>What you get</SectionLabel>
          <h2
            style={{
              fontSize: 'clamp(24px, 3vw, 34px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: HEADING,
              margin: '0 0 30px',
              fontFamily: 'var(--font-syne), system-ui, sans-serif',
            }}
          >
            What the work includes
          </h2>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '14px' }}>
            {service.whatYouGet.map((item) => (
              <li
                key={item}
                style={{
                  display: 'flex',
                  gap: '14px',
                  padding: '18px 20px',
                  borderRadius: '14px',
                  background: PANEL,
                  border: `1px solid ${HAIRLINE}`,
                  color: BODY,
                  fontSize: '16px',
                  lineHeight: 1.7,
                  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                }}
              >
                <span aria-hidden="true" style={{ color: ACCENT, flexShrink: 0 }}>
                  —
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Process */}
      <section style={{ background: '#05070C', padding: '70px 0' }}>
        <div style={shell}>
          <SectionLabel>How it runs</SectionLabel>
          <h2
            style={{
              fontSize: 'clamp(24px, 3vw, 34px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: HEADING,
              margin: '0 0 30px',
              fontFamily: 'var(--font-syne), system-ui, sans-serif',
            }}
          >
            From first call to live
          </h2>

          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '20px' }}>
            {service.process.map((phase, index) => (
              <li key={phase.step} style={{ display: 'flex', gap: '18px' }}>
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: PANEL,
                    border: `1px solid ${HAIRLINE}`,
                    color: ACCENT,
                    fontWeight: 700,
                    fontSize: '15px',
                  }}
                >
                  {index + 1}
                </span>
                <div>
                  <h3
                    style={{
                      margin: '7px 0 6px',
                      fontSize: '17px',
                      fontWeight: 700,
                      color: HEADING,
                      fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                    }}
                  >
                    {phase.step}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: BODY,
                      fontSize: '16px',
                      lineHeight: 1.72,
                      fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                    }}
                  >
                    {phase.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ — the same array that generates the FAQPage schema, so what Google
          shows as a rich result is exactly what a visitor reads. */}
      <section style={{ background: BAND, padding: '70px 0 90px' }}>
        <div style={shell}>
          <SectionLabel>Before you ask</SectionLabel>
          <h2
            style={{
              fontSize: 'clamp(24px, 3vw, 34px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: HEADING,
              margin: '0 0 30px',
              fontFamily: 'var(--font-syne), system-ui, sans-serif',
            }}
          >
            Common questions
          </h2>

          <div style={{ display: 'grid', gap: '14px' }}>
            {service.faq.map((entry) => (
              <div
                key={entry.q}
                style={{
                  padding: '22px 24px',
                  borderRadius: '14px',
                  background: PANEL,
                  border: `1px solid ${HAIRLINE}`,
                }}
              >
                <h3
                  style={{
                    margin: '0 0 10px',
                    fontSize: '17px',
                    fontWeight: 700,
                    color: HEADING,
                    fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                  }}
                >
                  {entry.q}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: BODY,
                    fontSize: '16px',
                    lineHeight: 1.72,
                    fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                  }}
                >
                  {entry.a}
                </p>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: '46px',
              padding: '34px',
              borderRadius: '18px',
              background: PANEL,
              border: `1px solid ${HAIRLINE}`,
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                margin: '0 0 12px',
                fontSize: 'clamp(21px, 2.6vw, 28px)',
                fontWeight: 800,
                color: HEADING,
                fontFamily: 'var(--font-syne), system-ui, sans-serif',
              }}
            >
              Ready to build something great?
            </h2>
            <p
              style={{
                margin: '0 0 24px',
                color: BODY,
                fontSize: '16px',
                lineHeight: 1.7,
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              }}
            >
              Tell us what you are trying to do. We will tell you what it takes.
            </p>
            <Link
              href="/#contact"
              className="btn-shimmer btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '14px 30px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              }}
            >
              Start a project
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
