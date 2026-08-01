'use client'

import { MotionConfig } from 'framer-motion'

/**
 * App-wide motion settings. `reducedMotion="user"` makes every Framer
 * animation automatically fall back to a snap (no transform/opacity travel)
 * for visitors who set "reduce motion" in their OS — a premium a11y default.
 * Children are passed through untouched, so sections stay server-rendered.
 */
export default function MotionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
