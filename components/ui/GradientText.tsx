import { ReactNode, ElementType } from 'react'

type Props = {
  children: ReactNode
  as?: ElementType
  className?: string
  style?: React.CSSProperties
}

export default function GradientText({ children, as: Tag = 'span', className = '', style }: Props) {
  return (
    <Tag
      className={className}
      style={{
        background: 'linear-gradient(135deg, #E9F1F8 0%, #93A6BC 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        fontFamily: 'var(--font-syne), system-ui, sans-serif',
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}
