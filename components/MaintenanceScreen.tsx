'use client'

import Image from 'next/image'
import BladeLight from '@/components/ui/BladeLight'
import GradientText from '@/components/ui/GradientText'
import { PhoneIcon } from '@/components/ui/icons'

/** Build a `tel:` href from a human-formatted number. */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/**
 * Full-screen "we're sharpening our blade" screen shown on the public homepage
 * while maintenance mode is active. Rendered instead of the site (no navbar /
 * footer) so it reads as a deliberate, self-contained holding page.
 */
export default function MaintenanceScreen({ phone }: { phone: string }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        textAlign: 'center',
        padding: '200px 24px 48px',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(1000px 600px at 50% -5%, rgba(0,183,255,0.10), transparent), var(--background)',
      }}
    >
      {/* Ambient blade glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '620px',
          maxWidth: '120vw',
          height: '620px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,183,255,0.12), transparent 65%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', maxWidth: '620px', width: '100%' }}>
        {/* Company logo — same wordmark used on the homepage */}
        <Image
          src="/images/logoo.png"
          alt="xCalibur Labz"
          width={260}
          height={130}
          priority
          style={{ height: 'clamp(84px, 14vw, 128px)', width: 'auto', margin: '0 auto 16px' }}
        />

        {/* Company name — Poppins, natural case */}
        <div
          style={{
            fontSize: 'clamp(18px, 3vw, 24px)',
            letterSpacing: '0.01em',
            color: 'var(--heading)',
            fontWeight: 600,
            marginBottom: '28px',
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
          }}
        >
          xCalibur&nbsp;Labz
        </div>

        {/* Blade sweep line */}
        <div style={{ maxWidth: '260px', margin: '0 auto 32px' }}>
          <BladeLight />
        </div>

        <GradientText
          as="h1"
          style={{
            fontSize: 'clamp(32px, 6vw, 60px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.08,
            margin: '0 0 22px',
          }}
        >
          We are sharpening
          <br />
          our{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #00B7FF 0%, #5EE9FF 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            blade
          </span>
        </GradientText>
        
        {/* Emergency contact button */}
        <a
          href={telHref(phone)}
          className="btn-shimmer btn-ghost maint-emergency"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '16px 32px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 700,
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            textDecoration: 'none',
            letterSpacing: '0.01em',
          }}
        >
          <PhoneIcon size={18} />
          Emergency contact
        </a>

        <div
          style={{
            marginTop: '16px',
            fontSize: '14px',
            color: 'var(--muted-text)',
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
          }}
        >
          <a href={telHref(phone)} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            {phone}
          </a>
        </div>
      </div>
    </main>
  )
}
