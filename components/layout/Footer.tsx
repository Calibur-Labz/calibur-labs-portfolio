'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MailIcon, PhoneIcon, MapPinIcon } from '@/components/ui/icons'
import { services } from '@/lib/data'

const LINKEDIN_URL = 'https://www.linkedin.com/company/calibur-labs'

const navLinks = [
  { label: 'Services', href: '/#services' },
  { label: 'Work', href: '/#work' },
  { label: 'ORBI', href: '/orbi' },
  { label: 'About', href: '/#about' },
  { label: 'Contact', href: '/#contact' },
]

/*
 * Derived from the service list rather than written out, so a service added to
 * `lib/data.ts` appears here automatically. These all used to point at
 * `/#services` — five links to the same anchor, which gave crawlers no route to
 * anything and gave a visitor no more than scrolling would.
 */
const serviceLinks = services.map((service) => ({
  label: service.title,
  href: `/services/${service.slug}`,
}))

const socialLinks = [
  {
    label: 'LinkedIn',
    href: LINKEDIN_URL,
    path: 'M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.24 8h4.52v14H.24V8zm7.5 0h4.33v1.92h.06c.6-1.14 2.07-2.34 4.26-2.34 4.56 0 5.4 3 5.4 6.9V22h-4.52v-6.6c0-1.57-.03-3.6-2.19-3.6-2.2 0-2.53 1.72-2.53 3.49V22H7.74V8z',
  },
  /* Hidden until the accounts exist — both still point at '#'.
  {
    label: 'GitHub',
    href: '#',
    path: 'M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.4 1.24-3.24-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.24 1.92 1.24 3.24 0 4.63-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.56 22.3 24 17.8 24 12.5 24 5.87 18.63.5 12 .5z',
  },
  {
    label: 'Twitter/X',
    href: '#',
    path: 'M18.9 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.153h7.594l5.243 6.932 6.063-6.932zm-1.29 19.5h2.039L6.486 3.24H4.298l13.312 17.414z',
  },
  */
]

export default function Footer() {
  return (
    <footer
      style={{
        position: 'relative',
        zIndex: 10,
        background: '#0A0F16',
        padding: '0 24px',
        overflow: 'hidden',
      }}
    >
      {/* Top gradient hairline — the trace */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, rgba(0,183,255,0.5), transparent)',
        }}
      />
      {/* Ambient corner glow */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '700px',
          height: '260px',
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(0,183,255,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', maxWidth: '1200px', margin: '0 auto', paddingTop: '72px' }}>
        <div className="footer-grid">
          {/* Brand */}
          <div style={{ maxWidth: '300px' }}>
            <Link
              href="/"
              style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', marginBottom: '18px' }}
            >
              <Image src="/images/logoN.png" alt="xCalibur Labz" width={140} height={70} style={{ height: '70px', width: 'auto' }} />
            </Link>
            <p
              style={{
                color: '#93A6BC',
                fontSize: '14px',
                lineHeight: 1.7,
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                margin: '0 0 22px',
              }}
            >
              Software that drives real business results built with precision, shipped with care.
            </p>

            {/* Founder — forged in the Excalibur tradition */}
            {/* <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 14px',
                marginBottom: '22px',
                borderRadius: '10px',
                border: '1px solid rgba(0,183,255,0.18)',
                background: 'rgba(0,183,255,0.04)',
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              }}
            >
              <span aria-hidden="true" style={{ color: '#5EE9FF', fontSize: '15px', lineHeight: 1 }}>⚔</span>
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                <span
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#6E8399',
                    fontWeight: 600,
                  }}
                >
                  Forged by
                </span>
                <span style={{ fontSize: '13px', color: '#E9F1F8', fontWeight: 600 }}>
                  Buddhima Vilochana <span style={{ color: '#00B7FF', fontWeight: 500 }}>· Founder</span>
                </span>
              </span>
            </div> */}

            <div style={{ display: 'flex', gap: '10px' }}>
              {socialLinks.map((s) => {
                const external = s.href.startsWith('http')
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className="social-btn"
                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d={s.path} />
                    </svg>
                  </a>
                )
              })}
            </div>
          </div>

          {/* Company */}
          <div>
            <p className="footer-heading">Company</p>
            {navLinks.map((l) => (
              <Link key={l.href + l.label} href={l.href} className="footer-link footer-row">
                {l.label}
              </Link>
            ))}
          </div>

          {/* Services */}
          <div>
            <p className="footer-heading">Services</p>
            {serviceLinks.map((l) => (
              <Link key={l.label} href={l.href} className="footer-link footer-row">
                {l.label}
              </Link>
            ))}
          </div>

          {/* Contact */}
          <div>
            <p className="footer-heading">Get in touch</p>

            <a href="mailto:caliburlabz@gmail.com" className="contact-row">
              <span className="contact-ico"><MailIcon size={16} /></span>
              caliburlabz@gmail.com
            </a>
            <a href="tel:+94765831021" className="contact-row">
              <span className="contact-ico"><PhoneIcon size={16} /></span>
              +94 76 58 31021
            </a>
            <div className="contact-row" style={{ cursor: 'default' }}>
              <span className="contact-ico"><MapPinIcon size={16} /></span>
              Colombo, Sri Lanka
            </div>

            <Link
              href="/#contact"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '18px',
                color: '#00B7FF',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              }}
            >
              Start a project →
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            marginTop: '56px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '22px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <p style={{ color: '#6E8399', fontSize: '13px', fontFamily: 'var(--font-poppins), system-ui, sans-serif', margin: 0 }}>
            © {new Date().getFullYear()} xCalibur Labz. All rights reserved.
          </p>
          <p style={{ color: '#6E8399', fontSize: '13px', fontFamily: 'var(--font-poppins), system-ui, sans-serif', margin: 0 }}>
            Design and Development by xCalibur Labz Pvt Ltd.
          </p>
        </div>
      </div>

      <style>{`
        .footer-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr 1fr 1.2fr;
          gap: 48px;
          padding-bottom: 8px;
        }
        .footer-heading {
          color: #E9F1F8;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 0 0 18px;
          font-family: var(--font-poppins), system-ui, sans-serif;
        }
        .footer-row {
          display: block;
          font-size: 14px;
          line-height: 1;
          padding: 8px 0;
          font-family: var(--font-poppins), system-ui, sans-serif;
        }
        .contact-row {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          line-height: 1;
          padding: 9px 0;
          color: var(--muted);
          text-decoration: none;
          font-family: var(--font-poppins), system-ui, sans-serif;
          transition: color 0.2s ease;
        }
        a.contact-row:hover {
          color: #E9F1F8;
        }
        .contact-ico {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          flex-shrink: 0;
          color: #E9F1F8;
          transition: color 0.2s ease;
        }
        a.contact-row:hover .contact-ico {
          color: #5EE9FF;
        }
        @media (max-width: 900px) {
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 40px; }
        }
        @media (max-width: 520px) {
          .footer-grid { grid-template-columns: 1fr; gap: 32px; }
        }
      `}</style>
    </footer>
  )
}
