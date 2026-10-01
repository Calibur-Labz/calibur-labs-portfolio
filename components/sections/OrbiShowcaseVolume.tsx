'use client'

import { ORBI_VIEWBOX } from '@/components/orbi/orbiConfig'

/**
 * A 3D look for ORBI — a prototype, in the /orbi showcase only.
 *
 * The robot is flat SVG. This layer sits over him in his own viewBox and adds
 * what makes a drawn shape read as a solid object: light falling from the top
 * left and fading to a shaded bottom-right, and a glossy highlight. No new
 * outlines or borders: the shading is masked to the shell with the visor cut
 * out, so it never washes over his face or changes his silhouette.
 *
 * The highlight does not turn with him. When he turns his head (`turn`), the
 * gloss slides the other way across the shell, the way a reflection stays put
 * while an object rotates under it — the single strongest cue that he is round.
 *
 * Nothing here is used by the live companion or the customer embed yet.
 */

/** The shell and visor exactly as `OrbiRobot` draws them. */
const SHELL = { x: 33, y: 28, width: 104, height: 90, rx: 34 }
const VISOR = { x: 46, y: 46, width: 78, height: 54, rx: 27 }

export default function OrbiShowcaseVolume({
  theme,
  turn = 0,
}: {
  theme: 'dark' | 'light'
  /** Head turn in degrees; the highlight slides against it. */
  turn?: number
}) {
  const light = theme === 'light'
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${ORBI_VIEWBOX.width} ${ORBI_VIEWBOX.height}`}
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      <defs>
        {/* The body, minus the screen: everything the shading may touch. */}
        <mask id="orbi-vol-body" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="152">
          <rect {...SHELL} fill="#fff" />
          <rect x={VISOR.x - 1.5} y={VISOR.y - 1.5} width={VISOR.width + 3} height={VISOR.height + 3} rx={VISOR.rx + 1.5} fill="#000" />
        </mask>
        {/* Key light from the top left. */}
        <radialGradient id="orbi-vol-key" cx="0.3" cy="0.16" r="0.85">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={light ? 0.55 : 0.2} />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        {/* The side turned away from it. */}
        <radialGradient id="orbi-vol-shade" cx="0.78" cy="0.95" r="0.8">
          <stop offset="0" stopColor={light ? '#5E7391' : '#000000'} stopOpacity={light ? 0.35 : 0.6} />
          <stop offset="0.65" stopColor={light ? '#5E7391' : '#000000'} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="orbi-vol-gloss" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={light ? 0.9 : 0.42} />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        <filter id="orbi-vol-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      {/* Volume: key light and falloff, on the body only. */}
      <g mask="url(#orbi-vol-body)">
        <rect {...SHELL} fill="url(#orbi-vol-key)" />
        <rect {...SHELL} fill="url(#orbi-vol-shade)" />
        {/* Gloss — slides against the turn, so it reads as a reflection. */}
        {/* Slide on the group, tilt on the shape: a CSS transform on the
            ellipse itself would replace its `rotate` attribute. */}
        <g style={{ transform: `translateX(${-turn * 0.45}px)`, transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
          <ellipse
            cx={62}
            cy={39}
            rx={17}
            ry={6.5}
            transform="rotate(-18 62 39)"
            fill="url(#orbi-vol-gloss)"
            filter="url(#orbi-vol-soft)"
          />
        </g>
      </g>
    </svg>
  )
}
