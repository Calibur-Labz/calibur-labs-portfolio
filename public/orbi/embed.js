/**
 * ORBI — embed script (demo).
 *
 *   <script src="https://www.caliburlabz.com/orbi/embed.js" defer></script>
 *
 * Adds one transparent iframe to the bottom-right corner of the page and
 * nothing else: no global styles, no reads of the page, no secrets. Everything
 * ORBI does happens inside the iframe, on ORBI's own origin, which is also
 * where his questions go.
 *
 * The iframe is only ever as big as what ORBI is showing: a small corner for
 * the robot and his speech bubble, grown while the Ask panel or guide menu is
 * open. An iframe cannot pass clicks through its transparent parts, so this is
 * what keeps the rest of the page clickable.
 */
;(function () {
  'use strict'

  var script = document.currentScript
  if (!script || !script.src) return

  var origin
  try {
    origin = new URL(script.src).origin
  } catch {
    return
  }

  // Loaded twice, installed once.
  if (window.__orbiEmbed) return
  window.__orbiEmbed = true

  /** Same thresholds as ORBI's own `ORBI_MEDIA`. */
  function breakpoint() {
    if (window.matchMedia('(max-width: 640px)').matches) return 'mobile'
    if (window.matchMedia('(max-width: 1024px)').matches) return 'tablet'
    return 'desktop'
  }

  /**
   * Idle holds the robot, the sound control beside him and the bubble above;
   * open holds the Ask panel (340px wide, up to 60% of the frame's height) or
   * the full-width sheet on a phone. `min()` keeps both inside small windows.
   */
  var SIZES = {
    desktop: { idle: ['300px', '320px'], open: ['400px', '640px'] },
    tablet: { idle: ['270px', '290px'], open: ['380px', '600px'] },
    mobile: { idle: ['210px', '240px'], open: ['100vw', '560px'] },
  }

  var bp = breakpoint()
  var frame = document.createElement('iframe')
  var mode = null

  function size(next) {
    if (next === mode) return
    mode = next
    var box = SIZES[bp][next]
    frame.style.width = 'min(' + box[0] + ', 100vw)'
    frame.style.height = 'min(' + box[1] + ', 100vh)'
    // Where supported, the dynamic unit tracks a phone's collapsing toolbar.
    frame.style.height = 'min(' + box[1] + ', 100dvh)'
  }

  frame.src = origin + '/orbi/frame?bp=' + bp
  frame.title = 'ORBI assistant'
  frame.setAttribute('allowtransparency', 'true')
  frame.setAttribute('allow', 'autoplay')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.border = '0'
  frame.style.margin = '0'
  frame.style.padding = '0'
  frame.style.background = 'transparent'
  frame.style.colorScheme = 'normal'
  frame.style.zIndex = '2147483000'
  frame.style.maxWidth = '100vw'
  size('idle')

  /* ── Talking to the frame ── */

  var introduced = false
  var helloTimer = null

  window.addEventListener('message', function (event) {
    // Only the ORBI frame, and only from ORBI's origin.
    if (event.source !== frame.contentWindow) return
    if (event.origin !== origin) return
    var data = event.data
    if (!data || data.type !== 'orbi:resize') return
    introduced = true
    if (helloTimer) {
      clearInterval(helloTimer)
      helloTimer = null
    }
    if (data.mode === 'open' || data.mode === 'idle') size(data.mode)
  })

  /**
   * The frame learns this page's origin from the hello — the browser, not us,
   * stamps it on the message. Repeated for a few seconds, because the frame
   * only starts listening once ORBI has hydrated, which can land after `load`.
   */
  function hello() {
    if (introduced || !frame.contentWindow) return
    frame.contentWindow.postMessage({ type: 'orbi:hello' }, origin)
  }

  frame.addEventListener('load', function () {
    if (helloTimer) clearInterval(helloTimer)
    var tries = 0
    hello()
    helloTimer = setInterval(function () {
      tries += 1
      if (introduced || tries > 40) {
        clearInterval(helloTimer)
        helloTimer = null
        return
      }
      hello()
    }, 250)
  })

  function mount() {
    document.body.appendChild(frame)
  }

  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()
