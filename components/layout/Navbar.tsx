'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion'

const links = [
  { label: 'Services', href: '#services' },
  { label: 'Work', href: '#work' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', (val) => {
    setScrolled(val > 40)
  })

  return (
    <motion.header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        padding: scrolled ? '12px 20px' : '22px 20px',
        transition: 'padding 0.35s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Floating glass capsule */}
      <nav
        style={{
          width: '100%',
          maxWidth: '1120px',
          height: '72px',
          paddingLeft: '22px',
          paddingRight: scrolled ? '12px' : '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: '18px',
          background: scrolled ? 'rgba(10,15,22,0.72)' : 'rgba(10,15,22,0.30)',
          backdropFilter: 'blur(16px) saturate(150%)',
          WebkitBackdropFilter: 'blur(16px) saturate(150%)',
          border: `1px solid ${scrolled ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)'}`,
          boxShadow: scrolled
            ? '0 12px 40px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)'
            : 'inset 0 1px 0 rgba(255,255,255,0.04)',
          transition:
            'background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease, padding 0.35s ease',
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image
            src="/images/logoo.png"
            alt="xCalibur Labz"
            width={140}
            height={70}
            priority
            style={{ height: '90px', width: 'auto' }}
          />
        </Link>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }} className="hidden-mobile">
          <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link"
                style={{
                  fontSize: '15px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <Link
            href="#contact"
            className="btn-shimmer btn-ghost"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '11px 24px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              textDecoration: 'none',
            }}
          >
            Start a Project
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="show-mobile"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
          aria-label="Toggle menu"
        >
          <span style={{ display: 'block', width: '22px', height: '2px', background: '#E9F1F8', borderRadius: '2px', transition: 'transform 0.2s', transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
          <span style={{ display: 'block', width: '22px', height: '2px', background: '#E9F1F8', borderRadius: '2px', opacity: menuOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
          <span style={{ display: 'block', width: '22px', height: '2px', background: '#E9F1F8', borderRadius: '2px', transition: 'transform 0.2s', transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
        </button>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="show-mobile"
            style={{
              position: 'absolute',
              top: '100%',
              left: '20px',
              right: '20px',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '18px',
              background: 'rgba(10,15,22,0.9)',
              backdropFilter: 'blur(20px) saturate(150%)',
              WebkitBackdropFilter: 'blur(20px) saturate(150%)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 20px 50px -12px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    color: '#93A6BC',
                    fontSize: '16px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                    textDecoration: 'none',
                    padding: '12px 12px',
                    borderRadius: '10px',
                  }}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="#contact"
                onClick={() => setMenuOpen(false)}
                className="btn-shimmer btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: '10px',
                  padding: '14px 30px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                  textDecoration: 'none',
                }}
              >
                Start a Project
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (min-width: 768px) {
          .hidden-mobile { display: flex !important; }
          .show-mobile { display: none !important; }
        }
        @media (max-width: 767px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
      `}</style>
    </motion.header>
  )
}
