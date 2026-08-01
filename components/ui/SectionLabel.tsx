import { ReactNode } from 'react'

export default function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
      }}
    >
      <div style={{ width: '24px', height: '2px', background: '#00B7FF', borderRadius: '2px' }} />
      <span
        style={{
          color: '#6E8399',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-poppins), system-ui, sans-serif',
        }}
      >
        {children}
      </span>
    </div>
  )
}
