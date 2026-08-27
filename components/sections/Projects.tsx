'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/motion'
import { projects } from '@/lib/data'
import SectionLabel from '@/components/ui/SectionLabel'
import GradientText from '@/components/ui/GradientText'

export default function Projects() {
  return (
    <section
      id="work"
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
          style={{ marginBottom: '48px', textAlign: 'center' }}
        >
          <motion.div variants={fadeUp} style={{ display: 'flex', justifyContent: 'center' }}>
            <SectionLabel>Our Work</SectionLabel>
          </motion.div>
          <motion.div variants={fadeUp}>
            <GradientText
              as="h2"
              style={{
                fontSize: 'clamp(28px, 3.6vw, 44px)',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                transform: 'scale(1.25)',
                transformOrigin: 'top center',
                // 80% = 1 / 1.25 — see the note in WhyChooseUs. The auto
                // margins keep the narrower box centred, so `top center`
                // still scales about the column's midline.
                maxWidth: '80%',
                margin: '0 auto 0.3em',
              }}
            >
              Selected Projects
            </GradientText>
          </motion.div>
          <motion.p
            variants={fadeUp}
            style={{
              color: '#6E8399',
              fontSize: '16px',
              lineHeight: 1.8,
              marginTop: '16px',
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            }}
          >
            A selection of real work we&apos;ve shipped, built with care and delivered with precision.
          </motion.p>
        </motion.div>

        {/* Grid */}
        <motion.div
          layout
          data-orbi-cinematic="projects"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
          }}
          className="projects-grid"
        >
          <AnimatePresence mode="popLayout">
            {projects.map((project) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                whileHover="hover"
                //variants={{ hover: { y: -8 } }}
                data-orbi-project={project.title}
                style={{
                  position: 'relative',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  aspectRatio: '3/2',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  background: '#0D141D',
                }}
              >
                {/* Image with subtle zoom on hover */}
                <motion.div
                  variants={{ hover: { scale: 1.07 } }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{ position: 'absolute', inset: 0 }}
                >
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    /*
                      Without this, `fill` means "assume 100vw", so a 1440px
                      desktop downloads a ~1920px variant for a card that is
                      384px wide. The grid is 3 columns inside a 1200px cap,
                      2 below 900px and 1 below 540px — these are those
                      breakpoints, so the browser picks a variant that matches
                      what is actually on screen.
                    */
                    sizes="(max-width: 540px) 92vw, (max-width: 900px) 45vw, 400px"
                    style={{ objectFit: 'cover' }}
                  />
                </motion.div>

                {/* Cyan glow ring on hover */}
                <motion.div
                  variants={{ hover: { opacity: 1 } }}
                  initial={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '18px',
                    border: '1px solid rgba(0,183,255,0.55)',
                    boxShadow: 'inset 0 0 30px rgba(0,183,255,0.18), 0 20px 50px -20px rgba(0,183,255,0.4)',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                />

                {/* Category badge — always visible */}
                <div
                  style={{
                    position: 'absolute',
                    top: '14px',
                    left: '14px',
                    zIndex: 2,
                    padding: '5px 12px',
                    borderRadius: '99px',
                    background: 'rgba(10,15,22,0.55)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(0,183,255,0.35)',
                    color: '#5EE9FF',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                  }}
                >
                  {project.category}
                </div>

                {/* Bottom scrim + content */}
                <motion.div
                  variants={{ hover: { background: 'linear-gradient(to top, rgba(5,9,14,0.97) 0%, rgba(5,9,14,0.7) 55%, transparent 100%)' } }}
                  initial={{ background: 'linear-gradient(to top, rgba(5,9,14,0.9) 0%, rgba(5,9,14,0.25) 45%, transparent 75%)' }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '20px',
                    zIndex: 2,
                  }}
                >
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#E9F1F8', margin: '0 0 10px', fontFamily: 'var(--font-syne), system-ui, sans-serif' }}>
                    {project.title}
                  </h3>

                  {/* Tags + link reveal on hover */}
                  <motion.div
                    variants={{ hover: { opacity: 1, height: 'auto', marginTop: 0 } }}
                    initial={{ opacity: 0, height: 0, marginTop: -4 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: project.url ? '12px' : '0' }}>
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '99px',
                            background: 'rgba(0,183,255,0.10)',
                            border: '1px solid rgba(0,183,255,0.22)',
                            color: '#93A6BC',
                            fontSize: '11px',
                            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#5EE9FF',
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Project
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="7" y1="17" x2="17" y2="7" />
                          <polyline points="7 7 17 7 17 17" />
                        </svg>
                      </a>
                    )}
                  </motion.div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .projects-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 540px) {
          .projects-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
