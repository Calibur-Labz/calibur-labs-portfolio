import { ReactNode } from 'react'

export default function GlowBadge({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(0,183,255,0.12)',
        border: '1px solid rgba(0,183,255,0.25)',
        borderRadius: '99px',
        padding: '8px 20px',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#00B7FF',
          flexShrink: 0,
          animation: 'pulseGlow 2s infinite ease-in-out',
        }}
      />
      <span
        style={{
          color: '#E9F1F8',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-poppins), system-ui, sans-serif',
        }}
      >
        {children}
      </span>
    </div>
  )
}
