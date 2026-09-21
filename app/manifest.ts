import type { MetadataRoute } from 'next'

/**
 * The web app manifest.
 *
 * Not here to make the site installable — it is a marketing site, not an app.
 * It exists so Android Chrome, the iOS "Add to Home Screen" sheet and the
 * browser UI have a name, a colour and an icon to use instead of guessing from
 * the URL. `theme_color` matches `--color-void` in `app/globals.css`, so the
 * browser chrome blends into the page rather than framing it in white.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'xCalibur Labz — Custom Software & Web Development',
    short_name: 'xCalibur Labz',
    description:
      'xCalibur Labz builds custom software, web apps and e-commerce platforms for growing businesses.',
    start_url: '/',
    display: 'standalone',
    background_color: '#05070C',
    theme_color: '#05070C',
    icons: [
      { src: '/icon', sizes: '32x32', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
