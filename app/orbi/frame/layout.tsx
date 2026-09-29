import type { Metadata } from 'next'

/**
 * The document inside the ORBI embed iframe.
 *
 * Nothing here should ever be found by a search engine: it is a robot in an
 * empty page, and it only makes sense inside someone else's website.
 */
export const metadata: Metadata = {
  title: 'ORBI',
  robots: { index: false, follow: false },
}

/**
 * The site's global stylesheet paints the page near-black and reserves a
 * scrollbar gutter. Inside an iframe on another website that is a dark
 * rectangle with ORBI pushed 10px off the corner, so this route — and only
 * this route, because it is the only thing that ever renders in this document
 * — takes both back. `color-scheme: normal` matters as much as the background:
 * when the frame's scheme differs from the host page's, browsers paint the
 * iframe opaque whatever its background says.
 */
const FRAME_STYLES = `
html, body {
  background: transparent !important;
  color-scheme: normal !important;
  overflow: hidden !important;
  scrollbar-gutter: auto !important;
}
`

export default function OrbiFrameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{FRAME_STYLES}</style>
      {children}
    </>
  )
}
