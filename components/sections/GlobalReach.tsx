"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fadeUp, stagger } from "@/lib/motion";
import SectionLabel from "@/components/ui/SectionLabel";
import GradientText from "@/components/ui/GradientText";
import {
  LAND_PATH,
  MAP_HEIGHT,
  MAP_WIDTH,
  REGION_FRAME,
  WORLD_FRAME,
  frameViewBox,
  project,
  projectInFrame,
  type MapFrame,
} from "@/lib/worldMap";

/**
 * Where the clients are.
 *
 * Two countries, so the map is the point rather than the data: it exists to
 * show that the work crosses an ocean, not to plot a hundred dots. Everything
 * claimed is verifiable — the two countries named, and the time zones those
 * places actually keep. No client counts, no revenue, no logos we were never
 * given.
 */

type Market = {
  key: string;
  country: string;
  /** Named in the marker's accessible label, not drawn on the map. */
  region: string;
  /** Country centroid — a marker for the country, not a claim about a city. */
  lat: number;
  lon: number;
  /**
   * Which side of the marker its label sits on — per frame, because a side
   * that sits over open water on the world map can hang off the edge of the
   * panel once the map zooms in. Chosen to clear both the coastline and the
   * other marker's label.
   */
  labelAt: { world: LabelSide; region: LabelSide };
};

type LabelSide = "above" | "below" | "right";

const MARKETS: Market[] = [
  {
    key: "lk",
    country: "Sri Lanka",
    region: "South Asia",
    lat: 7.87,
    lon: 80.77,
    labelAt: { world: "above", region: "above" },
  },
  {
    key: "au",
    country: "Australia",
    region: "Oceania",
    lat: -25.27,
    lon: 133.78,
    labelAt: { world: "right", region: "below" },
  },
];

/**
 * Meridians every 30°, parallels every 20°, as one path. Drawn in grid units
 * and clipped by the viewport, so it survives any frame.
 */
const GRATICULE = (() => {
  const d: string[] = [];
  for (let lon = -180; lon <= 180; lon += 30) {
    d.push(`M${project(0, lon).x.toFixed(1)} 0V${MAP_HEIGHT}`);
  }
  for (let lat = -80; lat <= 80; lat += 20) {
    d.push(`M0 ${project(lat, 0).y.toFixed(1)}H${MAP_WIDTH}`);
  }
  return d.join("");
})();

/**
 * A bowed line between two markers. The control point is pushed off the chord
 * perpendicularly, and of the two perpendiculars we take the one that arcs
 * north — a route that bows down into the empty Southern Ocean reads as a
 * mistake, while one over the islands reads as a flight path.
 */
function arcBetween(a: Market, b: Market, lift = 0.3) {
  const p = project(a.lat, a.lon);
  const q = project(b.lat, b.lon);
  const cx = (p.x + q.x) / 2 - (q.y - p.y) * lift;
  const cy = (p.y + q.y) / 2 + (q.x - p.x) * lift;
  const flipped = { x: (p.x + q.x) - cx, y: (p.y + q.y) - cy };
  const c = cy < flipped.y ? { x: cx, y: cy } : flipped;
  return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}Q${c.x.toFixed(1)} ${c.y.toFixed(
    1,
  )} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
}

const ARC = arcBetween(MARKETS[0], MARKETS[1]);

/**
 * Which slice of the world to draw.
 *
 * Resolved through matchMedia rather than a CSS breakpoint because the frame
 * is also the `viewBox` and the container's aspect ratio, neither of which a
 * media query can set on its own. Like the testimonial rail, the initial match
 * is read on mount — `matchMedia`'s change event never fires for a page that
 * opens at phone width, which would otherwise leave two markers a few pixels
 * apart on exactly the screens that can least afford it.
 */
function useMapFrame() {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 760px)");
    const apply = () => setZoomed(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  const frame: MapFrame = zoomed ? REGION_FRAME : WORLD_FRAME;
  return { frame, zoomed };
}

export default function GlobalReach() {
  /* Hover is transient, selection sticks — and on a touch screen, where there
     is no hover at all, tapping is the only way to light a marker up. */
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const active = hovered ?? selected;

  const { frame, zoomed } = useMapFrame();
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;

  return (
    <section id="reach" className="gr-section">
      <style>{`
        .gr-section {
          position: relative;
          z-index: 10;
          padding: 60px 24px;
        }
        .gr-wrap { max-width: 1200px; margin: 0 auto; }

        /* ── Header ── */
        .gr-head { max-width: 680px; margin-bottom: 40px; }
        .gr-lede {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 16px;
          line-height: 1.8;
          color: #6E8399;
          margin: 16px 0 0;
        }

        /* ── The panel: a framed slice of the world ── */
        .gr-panel {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          background: #0A0F17;
          border: 1px solid #17222F;
        }

        .gr-map {
          position: relative;
          /* Set from the frame, so the SVG fills the box exactly and the
             markers — which are HTML, positioned in percentages — land on the
             coordinates they were projected to. */
        }
        .gr-map svg { display: block; width: 100%; height: 100%; }

        /* A cold wash under the map, brightest where the two markers are. */
        .gr-map::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(60% 70% at 78% 62%, rgba(0,183,255,0.10), transparent 70%),
            radial-gradient(50% 60% at 50% 0%, rgba(0,183,255,0.05), transparent 70%);
        }

        .gr-graticule {
          fill: none;
          stroke: rgba(110,131,153,0.10);
          stroke-width: 1;
        }
        .gr-land {
          fill: #101A27;
          stroke: #223349;
          stroke-width: 1;
        }
        .gr-land-dots { fill: url(#${id("dots")}); }

        /* ── The route ─────────────────────────────────────────────────
           A steady hairline with a second, dashed copy flowing along it, so
           the connection reads as traffic rather than decoration. */
        .gr-arc {
          fill: none;
          stroke: url(#${id("arc")});
          stroke-width: 1.4;
          stroke-linecap: round;
          opacity: 0.7;
        }
        .gr-arc-flow {
          fill: none;
          stroke: #5EE9FF;
          stroke-width: 1.4;
          stroke-linecap: round;
          stroke-dasharray: 3 11;
          opacity: 0.75;
          animation: grFlow 1.4s linear infinite;
        }
        @keyframes grFlow {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -14; }
        }
        .gr-arc-spark { fill: #BDF1FF; }

        /* ── Markers ──────────────────────────────────────────────────
           HTML rather than SVG: the marker keeps one size in CSS pixels no
           matter which frame is drawn behind it, and the label is real text
           that wraps and inherits the page's type. */
        .gr-pin {
          position: absolute;
          width: 26px;
          height: 26px;
          margin: -13px 0 0 -13px;
          padding: 0;
          border: 0;
          background: none;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1);
        }
        .gr-pin-core {
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          background: #5EE9FF;
          box-shadow:
            0 0 0 3px rgba(0,183,255,0.18),
            0 0 14px 2px rgba(0,183,255,0.55);
          transition: box-shadow 0.35s ease;
        }
        .gr-pin-halo {
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          border: 1px solid rgba(94,233,255,0.7);
          opacity: 0;
          animation: grPing 3s cubic-bezier(0.16,1,0.3,1) infinite;
        }
        .gr-pin-halo:nth-of-type(2) { animation-delay: 1.5s; }
        @keyframes grPing {
          0%   { transform: scale(1);   opacity: 0.85; }
          70%  { transform: scale(3.6); opacity: 0; }
          100% { transform: scale(3.6); opacity: 0; }
        }

        .gr-pin-label {
          position: absolute;
          display: block;
          white-space: nowrap;
          font-family: var(--font-syne), system-ui, sans-serif;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: -0.01em;
          color: #CFE4F4;
          background: rgba(8,13,20,0.82);
          border: 1px solid rgba(0,183,255,0.22);
          border-radius: 999px;
          padding: 5px 11px;
          backdrop-filter: blur(6px);
          transition: color 0.3s ease, border-color 0.3s ease, background 0.3s ease;
        }
        .gr-pin-label[data-at="above"] {
          bottom: 100%;
          left: 50%;
          transform: translate(-50%, -4px);
        }
        .gr-pin-label[data-at="below"] {
          top: 100%;
          left: 50%;
          transform: translate(-50%, 4px);
        }
        .gr-pin-label[data-at="right"] {
          left: 100%;
          top: 50%;
          transform: translate(2px, -50%);
        }

        /* One marker lit means the others step back — the contrast is what
           carries the answer to "which one is Australia?". */
        .gr-panel[data-focus="on"] .gr-pin[data-active="false"] { opacity: 0.4; }
        .gr-pin[data-active="true"] { transform: scale(1.12); }
        .gr-pin[data-active="true"] .gr-pin-core {
          box-shadow:
            0 0 0 4px rgba(0,183,255,0.22),
            0 0 22px 5px rgba(0,183,255,0.7);
        }
        .gr-pin[data-active="true"] .gr-pin-label {
          color: #FFFFFF;
          border-color: rgba(94,233,255,0.55);
          background: rgba(4,18,27,0.92);
        }
        .gr-pin:focus-visible { outline: none; }
        .gr-pin:focus-visible .gr-pin-label {
          outline: 2px solid var(--focus-ring);
          outline-offset: 2px;
        }

        /* Legend, top-left of the map. */
        .gr-legend {
          position: absolute;
          bottom: 16px;
          left: 16px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7E97AE;
          background: rgba(8,13,20,0.6);
          border-radius: 999px;
          padding: 6px 12px;
          pointer-events: none;
        }
        .gr-legend i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #5EE9FF;
          box-shadow: 0 0 8px 2px rgba(0,183,255,0.6);
        }

        @media (max-width: 760px) {
          .gr-section { padding: 48px 20px; }
          .gr-pin-label { font-size: 11px; padding: 4px 9px; }
        }
      `}</style>

      <div className="gr-wrap">
        {/* ── Header ── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="gr-head"
        >
          <motion.div variants={fadeUp}>
            <SectionLabel>Global Reach</SectionLabel>
          </motion.div>
          <motion.div variants={fadeUp}>
            <GradientText
              as="h2"
              style={{
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                display: "block",
              }}
            >
              Clients Across Borders
            </GradientText>
          </motion.div>
          <motion.p variants={fadeUp} className="gr-lede">
            We deliver projects across several countries, and more clients
            abroad trust us with the work. The same engineers from the first
            call through to launch, wherever the product lives.
          </motion.p>
        </motion.div>

        {/* ── Panel ── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={fadeUp}
          className="gr-panel"
          data-focus={active ? "on" : "off"}
        >
          <div
            className="gr-map"
            style={{ aspectRatio: `${frame.w} / ${frame.h}` }}
          >
            <svg
              viewBox={frameViewBox(frame)}
              role="img"
              aria-label="World map marking xCalibur Labz client countries: Sri Lanka and Australia"
            >
              <defs>
                {/* The land is a dot screen rather than a solid fill — it reads
                    as data at any size and keeps the coastline from competing
                    with the markers. */}
                <pattern
                  id={id("dots")}
                  width="5"
                  height="5"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r="0.8" fill="rgba(0,183,255,0.20)" />
                </pattern>
                <linearGradient id={id("arc")} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#00B7FF" stopOpacity="0.15" />
                  <stop offset="50%" stopColor="#5EE9FF" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#00B7FF" stopOpacity="0.15" />
                </linearGradient>
                <radialGradient id={id("spot")}>
                  <stop offset="0%" stopColor="#00B7FF" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00B7FF" stopOpacity="0" />
                </radialGradient>
              </defs>

              <path className="gr-graticule" d={GRATICULE} vectorEffect="non-scaling-stroke" />
              <path className="gr-land" d={LAND_PATH} vectorEffect="non-scaling-stroke" />
              <path className="gr-land-dots" d={LAND_PATH} />

              {/* A glow under each marker, so the eye finds them before it
                  reads a single label. */}
              {MARKETS.map((m) => {
                const { x, y } = project(m.lat, m.lon);
                return (
                  <circle
                    key={m.key}
                    cx={x}
                    cy={y}
                    r="34"
                    fill={`url(#${id("spot")})`}
                  />
                );
              })}

              <path className="gr-arc" d={ARC} />
              <path className="gr-arc-flow" d={ARC} />
              {/* SMIL, not CSS, because nothing in CSS moves an element along a
                  path in every browser we support — so it is gated on the
                  motion preference by hand. */}
              {!reduce && (
                <circle className="gr-arc-spark" r="1.9">
                  <animateMotion
                    dur="4.5s"
                    repeatCount="indefinite"
                    path={ARC}
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1"
                  />
                </circle>
              )}
            </svg>

            {MARKETS.map((m) => {
              const pos = projectInFrame(m.lat, m.lon, frame);
              return (
                <button
                  key={m.key}
                  type="button"
                  className="gr-pin"
                  style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                  data-active={active === m.key}
                  aria-pressed={selected === m.key}
                  aria-label={`${m.country} — ${m.region}`}
                  onMouseEnter={() => setHovered(m.key)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(m.key)}
                  onBlur={() => setHovered(null)}
                  onClick={() =>
                    setSelected((prev) => (prev === m.key ? null : m.key))
                  }
                >
                  {!reduce && (
                    <>
                      <span className="gr-pin-halo" aria-hidden="true" />
                      <span className="gr-pin-halo" aria-hidden="true" />
                    </>
                  )}
                  <span className="gr-pin-core" aria-hidden="true" />
                  <span
                    className="gr-pin-label"
                    data-at={zoomed ? m.labelAt.region : m.labelAt.world}
                    aria-hidden="true"
                  >
                    {m.country}
                  </span>
                </button>
              );
            })}

            <span className="gr-legend">
              <i aria-hidden="true" />
              Client countries
            </span>
          </div>

        </motion.div>
      </div>
    </section>
  );
}
