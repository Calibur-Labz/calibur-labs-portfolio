import { ReactNode } from 'react'

type GlassCardProps = {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export default function GlassCard({ children, className = '', style }: GlassCardProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 30px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        borderRadius: '20px',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          width: '60%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(0,183,255,0.45), transparent)',
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  )
}
