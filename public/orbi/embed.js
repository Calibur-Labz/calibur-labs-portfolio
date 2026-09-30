/**
 * ORBI — embed script.
 *
 *   <script src="https://www.caliburlabz.com/orbi/embed.js"
 *     data-orbi-site="orbi_…"
 *     data-orbi-sections='{"services":{"label":"What We Do","selector":"#services"}}'
 *     defer></script>
 *
 * Once ORBI's server has confirmed this website may use the site id, adds
 * one transparent iframe to the bottom-right corner of the page and
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

  /**
   * The customer's public site id. Not a secret — it identifies the licence;
   * the server decides whether this website may use it.
   */
  var siteIdAttribute = script.getAttribute('data-orbi-site')
  var siteId = siteIdAttribute && /^orbi_[a-z0-9]{20}$/.test(siteIdAttribute) ? siteIdAttribute : null

  /* ── The site's sections ── */

  /**
   * `data-orbi-sections`, as data: parsed, never evaluated. Keys are the five
   * destinations ORBI knows, plus up to ten `custom-<slug>` ones; each needs a short text label and a CSS selector
   * the browser accepts. Anything else is dropped on its own, and a broken
   * attribute simply means ORBI offers no sections. The same limits as
   * `components/orbi/orbiEmbedSections.ts`, which re-checks the labels.
   */
  var SECTION_KEYS = ['services', 'work', 'testimonials', 'about', 'contact']
  var CUSTOM_KEY = /^custom-[a-z0-9]+(?:-[a-z0-9]+)*$/
  var CUSTOM_MAX = 10
  var order = []
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
    // Known keys first in their fixed order, then custom ones as written.
    var keys = SECTION_KEYS.slice()
    var custom = 0
    var own = Object.keys(config)
    for (var j = 0; j < own.length && custom < CUSTOM_MAX; j++) {
      if (own[j].length <= 48 && CUSTOM_KEY.test(own[j])) {
        keys.push(own[j])
        custom++
      }
    }
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]
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
      order.push(key)
    }
    return found
  }

  var sections = readSections()

  /** Only the names cross into the frame. The selectors stay here. */
  function sectionLabels() {
    var list = []
    for (var i = 0; i < order.length; i++) {
      list.push({ key: order[i], label: sections[order[i]].label })
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

  /* ── Installing ── */

  /** Only called once the server has said yes, with the proof it gave. */
  function install(token) {
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

    function stopHello() {
      if (helloTimer) {
        clearInterval(helloTimer)
        helloTimer = null
      }
    }

    window.addEventListener('message', function (event) {
      // Only the ORBI frame, and only from ORBI's origin.
      if (event.source !== frame.contentWindow) return
      if (event.origin !== origin) return
      var data = event.data
      if (!data) return
      if (data.type === 'orbi:navigate') return navigate(data.section)
      if (data.type === 'orbi:denied') {
        // The frame would not accept the token: take the iframe away again.
        introduced = true
        stopHello()
        if (frame.parentNode) frame.parentNode.removeChild(frame)
        return
      }
      if (data.type !== 'orbi:resize') return
      introduced = true
      stopHello()
      if (data.mode === 'open' || data.mode === 'idle') size(data.mode)
    })

    /**
     * The frame learns this page's origin from the hello — the browser, not us,
     * stamps it on the message — and checks it against the origin the token
     * was issued to. Repeated for a few seconds, because the frame only starts
     * listening once ORBI has hydrated, which can land after `load`.
     */
    function hello() {
      if (introduced || !frame.contentWindow) return
      frame.contentWindow.postMessage(
        { type: 'orbi:hello', token: token, sections: sectionLabels() },
        origin
      )
    }

    frame.addEventListener('load', function () {
      stopHello()
      var tries = 0
      hello()
      helloTimer = setInterval(function () {
        tries += 1
        if (introduced || tries > 40) return stopHello()
        hello()
      }, 250)
    })

    function mount() {
      document.body.appendChild(frame)
    }

    if (document.body) mount()
    else document.addEventListener('DOMContentLoaded', mount)
  }

  /* ── Authorizing ── */

  /**
   * Ask ORBI's server whether this site may run here. The server identifies
   * the page by the browser's own Origin header — nothing this script says
   * about where it is counts. Anything but an explicit yes with a token,
   * including a network error, means ORBI stays away.
   *
   * text/plain keeps this a CORS "simple request": one round trip, no
   * preflight, and no cookies either way.
   */
  if (!siteId) {
    if (window.console) console.warn('[ORBI] data-orbi-site is missing or invalid; ORBI will not load.')
    return
  }

  fetch(origin + '/api/orbi/authorize', {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: { 'content-type': 'text/plain' },
    body: JSON.stringify({ siteId: siteId }),
  })
    .then(function (response) {
      return response.ok ? response.json() : null
    })
    .then(function (answer) {
      if (
        answer &&
        answer.authorized === true &&
        typeof answer.token === 'string' &&
        answer.token.length > 0 &&
        answer.token.length < 1024
      ) {
        install(answer.token)
      } else if (window.console) {
        console.warn('[ORBI] This website is not authorized for site ' + siteId + '.')
      }
    })
    .catch(function () {
      /* Offline, blocked, or not ORBI answering: fail closed, quietly. */
    })
})()
