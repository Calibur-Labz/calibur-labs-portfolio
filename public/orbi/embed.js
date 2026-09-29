/**
 * ORBI — embed script.
 *
 *   <script src="https://www.caliburlabz.com/orbi/embed.js"
 *     data-orbi-sections='{"services":{"label":"What We Do","selector":"#services"}}'
 *     defer></script>
 *
 * Adds one transparent iframe to the bottom-right corner of the page and
 * nothing else: no global styles, no secrets. The only part of the page it
 * ever reads is the sections the site named on this tag, and only to scroll
 * to one when a visitor asks ORBI to go there. Everything
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

  /* ── The site's sections ── */

  /**
   * `data-orbi-sections`, as data: parsed, never evaluated. Keys are the five
   * destinations ORBI knows; each needs a short text label and a CSS selector
   * the browser accepts. Anything else is dropped on its own, and a broken
   * attribute simply means ORBI offers no sections. The same limits as
   * `components/orbi/orbiEmbedSections.ts`, which re-checks the labels.
   */
  var SECTION_KEYS = ['services', 'work', 'testimonials', 'about', 'contact']
  var CONTROL = new RegExp('[\\u0000-\\u001F\\u007F]', 'g')
  var HAS_CONTROL = new RegExp('[\\u0000-\\u001F\\u007F]')

  function readSections() {
    var found = {}
    var raw = script.getAttribute('data-orbi-sections')
    if (!raw) return found
    var config
    try {
      config = JSON.parse(raw)
    } catch {
      return found
    }
    if (!config || typeof config !== 'object' || Array.isArray(config)) return found
    for (var i = 0; i < SECTION_KEYS.length; i++) {
      var key = SECTION_KEYS[i]
      if (!Object.prototype.hasOwnProperty.call(config, key)) continue
      var entry = config[key]
      if (!entry || typeof entry !== 'object') continue
      if (typeof entry.label !== 'string' || typeof entry.selector !== 'string') continue
      var label = entry.label.replace(CONTROL, '').trim()
      var selector = entry.selector.trim()
      if (!label || label.length > 40) continue
      if (!selector || selector.length > 200 || HAS_CONTROL.test(selector)) continue
      try {
        document.querySelector(selector) // throws on anything that is not a selector
      } catch {
        continue
      }
      found[key] = { label: label, selector: selector }
    }
    return found
  }

  var sections = readSections()

  /** Only the names cross into the frame. The selectors stay here. */
  function sectionLabels() {
    var list = []
    for (var i = 0; i < SECTION_KEYS.length; i++) {
      var key = SECTION_KEYS[i]
      if (sections[key]) list.push({ key: key, label: sections[key].label })
    }
    return list
  }

  function navigate(key) {
    if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(sections, key)) return
    var target = null
    try {
      target = document.querySelector(sections[key].selector)
    } catch {
      return
    }
    if (!target) return
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
  }

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
    if (!data) return
    if (data.type === 'orbi:navigate') return navigate(data.section)
    if (data.type !== 'orbi:resize') return
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
    frame.contentWindow.postMessage({ type: 'orbi:hello', sections: sectionLabels() }, origin)
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
