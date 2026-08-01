export default function BladeLight({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height: '1px',
        width: '100%',
        background: 'rgba(36,52,74,0.5)',
        overflow: 'hidden',
        borderRadius: '2px',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          height: '100%',
          width: '150px',
          background:
            'linear-gradient(90deg, transparent, rgba(94,233,255,0.6), rgba(0,183,255,0.9), transparent)',
          boxShadow: '0 0 12px rgba(0,183,255,0.5)',
          animation: 'bladeSweep 3s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        }}
      />
    </div>
  )
}
