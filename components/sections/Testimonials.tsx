"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import { fadeUp, stagger } from "@/lib/motion";
import { testimonials, type Testimonial } from "@/lib/data";
import SectionLabel from "@/components/ui/SectionLabel";
import GradientText from "@/components/ui/GradientText";

/** Quotes run to different lengths; every card shows this many lines, then "…". */
const QUOTE_LINES = 5;

/**
 * The rail's breakpoints, widest-first, resolved here rather than through
 * slick's own `responsive` option: that option registers a matchMedia
 * *change* listener and never reads the initial match, so a page opened
 * straight at phone width rendered the three-up desktop rail until something
 * resized it — three unreadable slivers on every real phone.
 */
const RAIL_DESKTOP = { slidesToShow: 3, centerMode: true };
const RAIL_BREAKPOINTS = [
  { query: "(max-width: 720px)", slidesToShow: 1, centerMode: false },
  { query: "(max-width: 1100px)", slidesToShow: 2, centerMode: true },
];

function useRailLayout() {
  /* Matches the server render; corrected on mount, before the section is
     anywhere near the viewport. */
  const [layout, setLayout] = useState(RAIL_DESKTOP);

  useEffect(() => {
    const mqls = RAIL_BREAKPOINTS.map((b) => window.matchMedia(b.query));

    const apply = () => {
      const hit = mqls.findIndex((m) => m.matches);
      const next = hit === -1 ? RAIL_DESKTOP : RAIL_BREAKPOINTS[hit];
      setLayout((prev) =>
        prev.slidesToShow === next.slidesToShow &&
        prev.centerMode === next.centerMode
          ? prev
          : { slidesToShow: next.slidesToShow, centerMode: next.centerMode },
      );
    };

    apply();
    mqls.forEach((m) => m.addEventListener("change", apply));
    return () => mqls.forEach((m) => m.removeEventListener("change", apply));
  }, []);

  return layout;
}

/**
 * The pointer position is written to CSS custom properties on the card, which
 * the light reads. Keeping it out of React state means moving the mouse never
 * re-renders the slider.
 */
function trackPointer(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

/** Two periods of the same curve, so a -50% shift loops seamlessly. */
const WAVE_PATH =
  "M0,62 C100,32 200,32 300,62 C400,92 500,92 600,62 C700,32 800,32 900,62 " +
  "C1000,92 1100,92 1200,62 V120 H0 Z";

function Wave() {
  /* Every card carries its own gradient, so the ids have to be unique. */
  const uid = useId().replace(/:/g, "");

  return (
    <span className="tst-wave" aria-hidden="true">
      {[0, 1].map((i) => (
        <svg key={i} viewBox="0 0 1200 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`${uid}-w${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00B7FF" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#00B7FF" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={WAVE_PATH} fill={`url(#${uid}-w${i})`} />
        </svg>
      ))}
    </span>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarRating({ rating = 5 }: { rating?: number }) {
  return (
    <div className="tst-stars" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill={i < rating ? "#00B7FF" : "rgba(255,255,255,0.12)"}
          aria-hidden="true"
        >
          <path d="M12 2l2.9 6.26 6.9.6-5.2 4.52 1.56 6.74L12 16.9l-6.16 3.72 1.56-6.74L2.2 8.86l6.9-.6L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Falls back to initials, which several avatar paths in the data need. */
function Avatar({ src, name, size }: { src?: string; name: string; size: number }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className="tst-avatar tst-avatar-fallback"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <div className="tst-avatar" style={{ width: size, height: size }}>
      <Image
        src={src}
        alt={name}
        fill
        sizes={`${size}px`}
        style={{ objectFit: "cover" }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function SlideCard({ t }: { t: Testimonial }) {
  return (
    <div className="tst-slide">
      <article className="tst-card" onMouseMove={trackPointer}>
        <span className="tst-light" aria-hidden="true" />
        <Wave />

        <div className="tst-card-inner">
        <header className="tst-card-head">
          <span className="tst-quote-chip" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.5 5C6.5 5 4 7.6 4 10.9c0 3 2.1 5.1 4.8 5.1.3 0 .6 0 .8-.1-.6 1.5-2 2.7-3.9 3.3l.8 1.8c3.6-1.1 6.2-4.4 6.2-9C12.5 7.6 11.3 5 9.5 5zm9 0C15.5 5 13 7.6 13 10.9c0 3 2.1 5.1 4.8 5.1.3 0 .6 0 .8-.1-.6 1.5-2 2.7-3.9 3.3l.8 1.8c3.6-1.1 6.2-4.4 6.2-9C21.5 7.6 20.3 5 18.5 5z" />
            </svg>
          </span>
          <StarRating rating={t.rating} />
        </header>

        <blockquote className="tst-quote">{t.quote}</blockquote>

        <footer className="tst-card-foot">
          <Avatar src={t.avatar} name={t.author} size={54} />
          <div className="tst-meta">
            <p className="tst-name">{t.author}</p>
            <p className="tst-role">
              {t.title}, {t.company}
            </p>
          </div>
        </footer>
        </div>
      </article>
    </div>
  );
}

export default function Testimonials() {
  const sliderRef = useRef<Slider>(null);
  const { slidesToShow, centerMode } = useRailLayout();

  /*
   * A rail needs more cards than it shows, or slick fills the gap with clones.
   * With a single real testimonial it was rendering thirteen copies of the same
   * quote sliding past each other — which reads as padding, and undoes the
   * point of having removed the duplicate entries from `lib/data.ts`.
   *
   * Below the rail's capacity we show the cards as they are: no cloning, no
   * autoplay, no dots to page through a single item. Add a fourth testimonial
   * and the rail comes back on its own.
   */
  const isRail = testimonials.length > slidesToShow;

  return (
    <section id="testimonials" className="tst-section">
      <style>{`
        .tst-section { position: relative; z-index: 10; padding: 60px 0 70px; }
        .tst-wrap { position: relative; max-width: 1200px; margin: 0 auto; padding: 0 24px; }

        /* ── Rail ───────────────────────────────────────────────────────
           Only slick.css is imported, never slick-theme.css: its arrows and
           dots are icon-font glyphs needing the .woff served with them, and
           every control here is drawn locally. */
        .tst-slider { margin: 0 -10px; }
        /* A little breathing room so no edge sits flush against the clip. */
        .tst-slider .slick-list { padding: 8px 0 12px; margin: -8px 0 -12px; }
        .tst-slider .slick-track { display: flex; align-items: stretch; }
        .tst-slider .slick-slide { height: auto; }
        .tst-slider .slick-slide > div { height: 100%; }
        /* The centred card is the one being read; its neighbours sit back
           behind a small blur so the eye lands in the middle of the rail. */
        .tst-slide {
          height: 100%;
          padding: 0 10px;
          filter: blur(1.1px);
          opacity: 0.66;
          /* The neighbours shrink rather than the centre growing: scaling the
             centred card past the track's bounds put its top and bottom edges
             under slick's overflow: hidden, and the border vanished there. */
          transform: scale(0.93);
          transition: filter 0.5s ease, opacity 0.5s ease,
                      transform 0.5s cubic-bezier(0.16,1,0.3,1);
        }
        .tst-slider .slick-center .tst-slide {
          filter: none;
          opacity: 1;
          transform: scale(1);
        }

        /* Off-rail, nothing is centred, so the dimming above would apply to
           every card with nothing ever clearing it — a single testimonial
           would sit there permanently blurred at two-thirds opacity. */
        .tst-slider-static .tst-slide {
          filter: none;
          opacity: 1;
          transform: scale(1);
        }
        /* One card should read as a card, not stretch across the full rail. */
        .tst-slider-static .slick-track {
          display: flex;
          justify-content: center;
        }
        .tst-slider-static .tst-slide {
          max-width: 520px;
          margin: 0 auto;
        }

        /* ── Card ─────────────────────────────────────────────────────
           A flat, opaque surface: no backdrop blur, no bloom. Depth comes
           from a hairline border and one soft shadow, so the cards stay
           crisp over whatever sits behind the section. */
        .tst-card {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 26px;
          border-radius: 18px;
          background: linear-gradient(180deg, #0E141F 0%, #0A0F17 100%);
          border: 1px solid #1B2635;
          box-shadow: 0 1px 0 rgba(255,255,255,0.03) inset;
          /* No lift on hover — the card stays put and the light moves instead. */
          transition: border-color 0.35s ease;
        }
        .tst-card:hover { border-color: rgba(0,183,255,0.38); }
        .tst-card-inner {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        /* ── Hover: light + waves ─────────────────────────────────────
           A faint light follows the cursor — enough to feel the surface
           respond, well short of a colour change — over waves drifting up
           from the foot of the card. */
        .tst-light {
          position: absolute;
          inset: 0;
          z-index: 0;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.45s ease;
          background:
            radial-gradient(320px circle at var(--mx, 50%) var(--my, 50%),
              rgba(0,183,255,0.075) 0%, rgba(0,183,255,0.025) 40%, transparent 72%);
        }
        .tst-card:hover .tst-light { opacity: 1; }

        .tst-wave {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1;
          height: 86px;
          overflow: hidden;
          pointer-events: none;
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1);
        }
        .tst-card:hover .tst-wave { opacity: 1; transform: translateY(0); }
        .tst-wave svg {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 200%;
          height: 100%;
        }
        .tst-wave svg:first-child {
          opacity: 0.55;
          animation: tstWaveDrift 9s linear infinite;
        }
        .tst-wave svg:last-child {
          opacity: 0.3;
          height: 74%;
          animation: tstWaveDrift 6s linear infinite reverse;
        }
        /* One period is half the doubled path, so -50% is a seamless loop. */
        @keyframes tstWaveDrift {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        .tst-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }
        .tst-quote-chip {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,183,255,0.10);
          border: 1px solid rgba(0,183,255,0.22);
          color: #00B7FF;
        }
        .tst-stars { display: flex; gap: 2px; }

        /* Fixed height for every quote: ${QUOTE_LINES} lines, then an ellipsis. */
        .tst-quote {
          margin: 0 0 24px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 14px;
          line-height: 1.7;
          letter-spacing: -0.003em;
          color: #A9BCD0;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: ${QUOTE_LINES};
          line-clamp: ${QUOTE_LINES};
          overflow: hidden;
          min-height: calc(${QUOTE_LINES} * 1.7em);
        }

        .tst-card-foot {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: auto;
          padding-top: 22px;
          border-top: 1px solid #17222F;
        }
        /* The name is never abbreviated — it wraps rather than being clipped. */
        .tst-meta { flex: 1 1 auto; min-width: 0; }
        .tst-name {
          font-family: var(--font-syne), system-ui, sans-serif;
          font-weight: 700;
          font-size: 15.5px;
          line-height: 1.3;
          letter-spacing: -0.012em;
          color: #E9F1F8;
          margin: 0 0 3px;
          overflow-wrap: anywhere;
        }
        /* Designation and company read as one phrase in one tone — no second
           colour, no weight change, just a comma between them. */
        .tst-role {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 12.5px;
          font-weight: 400;
          line-height: 1.5;
          color: #8FA5BC;
          margin: 0;
          overflow-wrap: anywhere;
        }

        /* ── Avatar ── Rounded square rather than a circle. */
        .tst-avatar {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          flex-shrink: 0;
          background: #121A26;
          border: 1px solid #22304200;
        }
        .tst-avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,183,255,0.10);
          border: 1px solid rgba(0,183,255,0.20);
          font-family: var(--font-syne), system-ui, sans-serif;
          font-weight: 700;
          color: #9FD9F5;
        }

        /* ── Controls ─────────────────────────────────────────────────
           react-slick clones whatever appendDots returns and overwrites its
           className with slick-dots, so the row is styled through that class;
           only the inner list carries a class of ours. */
        .tst-slider .slick-dots {
          position: static;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          width: auto;
          margin: 34px 0 0;
          padding: 0;
          list-style: none;
        }
        .tst-dots {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .tst-dots li { width: auto; height: auto; margin: 0; }
        .tst-dots button {
          display: block;
          width: 14px;
          height: 3px;
          padding: 0;
          border: none;
          border-radius: 2px;
          background: #24344A;
          font-size: 0;
          line-height: 0;
          cursor: pointer;
          transition: width 0.3s ease, background 0.3s ease;
        }
        .tst-dots li.slick-active button { width: 30px; background: #00B7FF; }
        .tst-arrow {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border-radius: 11px;
          border: 1px solid #1F2C3D;
          background: #0C121C;
          color: #93A6BC;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.25s ease, border-color 0.25s ease, background 0.25s ease;
        }
        .tst-arrow:hover {
          color: #E9F1F8;
          border-color: rgba(0,183,255,0.45);
          background: #101827;
        }
        .tst-arrow:focus-visible,
        .tst-dots button:focus-visible {
          outline: 2px solid var(--focus-ring, rgba(94,233,255,0.45));
          outline-offset: 3px;
        }

        /* One card per view below this width, and centerMode is off there,
           so nothing is tagged as centred — the blur has to come off too. */
        @media (max-width: 720px) {
          .tst-slide { filter: none; opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tst-card, .tst-slide, .tst-arrow, .tst-dots button,
          .tst-light, .tst-wave { transition: none; }
          .tst-wave svg { animation: none; }
        }
      `}</style>

      <div className="tst-wrap">
        {/* ── Header ── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          style={{ textAlign: "center", marginBottom: "48px" }}
        >
          <motion.div
            variants={fadeUp}
            style={{ display: "flex", justifyContent: "center" }}
          >
            <SectionLabel>Kind Words</SectionLabel>
          </motion.div>
          <motion.div variants={fadeUp}>
            <GradientText
              as="h2"
              style={{
                fontSize: "clamp(26px, 3.2vw, 40px)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
                transform: "scale(1.06, 1.25)",
                transformOrigin: "top center",
                marginBottom: "0.3em",
              }}
            >
              What Our Clients Say
            </GradientText>
          </motion.div>
          <motion.p
            variants={fadeUp}
            style={{
              color: "#6E8399",
              fontSize: "16px",
              lineHeight: 1.8,
              marginTop: "16px",
              fontFamily: "var(--font-poppins), system-ui, sans-serif",
            }}
          >
            Don&apos;t take our word for it — hear from the people we&apos;ve
            built for.
          </motion.p>
        </motion.div>

        {/* ── Slider ── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={fadeUp}
        >
          <Slider
            ref={sliderRef}
            className={`tst-slider${isRail ? '' : ' tst-slider-static'}`}
            dots={isRail}
            arrows={false}
            infinite={isRail}
            speed={500}
            cssEase="cubic-bezier(0.16, 1, 0.3, 1)"
            slidesToShow={isRail ? slidesToShow : testimonials.length}
            slidesToScroll={1}
            /* centerMode is what tags the middle card, which the blur reads.
               Off when there is nothing to centre against. */
            centerMode={isRail && centerMode}
            centerPadding="0px"
            autoplay={isRail}
            autoplaySpeed={3200}
            pauseOnHover
            swipeToSlide={isRail}
            /* The dots are lifted out and set between the arrows so the whole
               control row reads as one unit. */
            appendDots={(dots) => (
              <div>
                <button
                  type="button"
                  className="tst-arrow"
                  onClick={() => sliderRef.current?.slickPrev()}
                  aria-label="Previous testimonial"
                >
                  <Chevron dir="left" />
                </button>
                <ul className="tst-dots">{dots}</ul>
                <button
                  type="button"
                  className="tst-arrow"
                  onClick={() => sliderRef.current?.slickNext()}
                  aria-label="Next testimonial"
                >
                  <Chevron dir="right" />
                </button>
              </div>
            )}
            customPaging={(i) => (
              <button type="button" aria-label={`Go to testimonial ${i + 1}`} />
            )}
          >
            {testimonials.map((t) => (
              <SlideCard key={t.author} t={t} />
            ))}
          </Slider>
        </motion.div>
      </div>
    </section>
  );
}
