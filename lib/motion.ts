import type { Variants } from 'framer-motion'

/**
 * Premium easing curves.
 * EASE_OUT  — expo-out: fast start, long silky settle (feels expensive).
 * EASE_SOFT — gentle overshoot-free ease for scale/reveal.
 */
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]
const EASE_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: EASE_OUT },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.9, ease: EASE_OUT },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: EASE_SOFT },
  },
}

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -40, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.85, ease: EASE_OUT },
  },
}

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.85, ease: EASE_OUT },
  },
}

/** Orchestrators — a short lead-in delay before children makes the cascade feel intentional. */
export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.06 } },
}

export const staggerFast: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}
