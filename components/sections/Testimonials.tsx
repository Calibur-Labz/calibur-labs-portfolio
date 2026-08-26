"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, stagger } from "@/lib/motion";
import { testimonials, type Testimonial } from "@/lib/data";
import SectionLabel from "@/components/ui/SectionLabel";
import GradientText from "@/components/ui/GradientText";

function StarRating({ rating = 5 }: { rating?: number }) {
  return (
    <div style={{ display: "flex", gap: "3px" }} aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={i < rating ? "#00B7FF" : "rgba(255,255,255,0.14)"}
          aria-hidden="true"
        >
          <path d="M12 2l2.9 6.26 6.9.6-5.2 4.52 1.56 6.74L12 16.9l-6.16 3.72 1.56-6.74L2.2 8.86l6.9-.6L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function QuoteGlyph() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M9.5 5C6.5 5 4 7.6 4 10.9c0 3 2.1 5.1 4.8 5.1.3 0 .6 0 .8-.1-.6 1.5-2 2.7-3.9 3.3l.8 1.8c3.6-1.1 6.2-4.4 6.2-9C12.5 7.6 11.3 5 9.5 5zm9 0C15.5 5 13 7.6 13 10.9c0 3 2.1 5.1 4.8 5.1.3 0 .6 0 .8-.1-.6 1.5-2 2.7-3.9 3.3l.8 1.8c3.6-1.1 6.2-4.4 6.2-9C21.5 7.6 20.3 5 18.5 5z"
        fill="url(#quoteGrad)"
      />
      <defs>
        <linearGradient id="quoteGrad" x1="4" y1="5" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00B7FF" />
          <stop offset="1" stopColor="#7FDBFF" stopOpacity="0.5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function FeedbackCard({
  t,
  isFeatured,
}: {
  t: Testimonial;
  isFeatured: boolean;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: hover
          ? "linear-gradient(145deg, rgba(0,183,255,0.10) 0%, rgba(255,255,255,0.04) 100%)"
          : "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        border: hover
          ? "1px solid rgba(0,183,255,0.45)"
          : isFeatured
          ? "1px solid rgba(255,255,255,0.28)"
          : "1px solid rgba(255,255,255,0.12)",
        borderRadius: "24px",
        padding: "34px",
        overflow: "hidden",
        minHeight: "300px",
        display: "flex",
        flexDirection: "column",
        boxShadow: hover
          ? "0 24px 60px -20px rgba(0,183,255,0.35), inset 0 1px 0 rgba(255,255,255,0.08)"
          : "0 12px 40px -24px rgba(0,0,0,0.6)",
        transition:
          "box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease",
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "8%",
          width: "84%",
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, rgba(0,183,255,0.7), rgba(255,255,255,0.4), transparent)",
          opacity: hover ? 1 : 0.6,
          transition: "opacity 0.35s ease",
        }}
      />

      {/* Corner glow */}
      <div
        style={{
          position: "absolute",
          top: "-70px",
          right: "-70px",
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,183,255,0.16) 0%, transparent 70%)",
          opacity: hover ? 1 : 0.5,
          transition: "opacity 0.35s ease",
          pointerEvents: "none",
        }}
      />

      {/* Top row: quote glyph + stars */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <QuoteGlyph />
        <StarRating rating={t.rating} />
      </div>

      {/* Quote text */}
      <p
        style={{
          fontSize: "15px",
          color: "#B4C4D6",
          lineHeight: 1.7,
          fontFamily: "var(--font-poppins), system-ui, sans-serif",
          margin: "0 0 26px",
          flexGrow: 1,
          display: "-webkit-box",
          WebkitLineClamp: 8,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {t.quote}
      </p>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          background:
            "linear-gradient(90deg, rgba(0,183,255,0.5), rgba(255,255,255,0.05), transparent)",
          marginBottom: "22px",
        }}
      />

      {/* Author row */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <Avatar src={t.avatar} name={t.author} />
        <div>
          <p
            style={{
              fontFamily: "var(--font-syne), system-ui, sans-serif",
              fontWeight: 700,
              fontSize: "15px",
              color: "#E9F1F8",
              margin: "0 0 3px",
            }}
          >
            {t.author}
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "#6E8399",
              margin: 0,
              fontFamily: "var(--font-poppins), system-ui, sans-serif",
            }}
          >
            {t.title}, {t.company}
          </p>
        </div>
      </div>
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

function Avatar({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = getInitials(name);

  if (!src || failed) {
    return (
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          flexShrink: 0,
          background: "rgba(0,183,255,0.12)",
          border: "1px solid rgba(0,183,255,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          fontWeight: 700,
          color: "#E9F1F8",
          fontFamily: "var(--font-syne), system-ui, sans-serif",
          letterSpacing: "0.02em",
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      style={{
        width: "56px",
        height: "56px",
        borderRadius: "50%",
        flexShrink: 0,
        overflow: "hidden",
        border: "1px solid rgba(0,183,255,0.25)",
        position: "relative",
      }}
    >
      <Image
        src={src}
        alt={name}
        fill
        style={{ objectFit: "cover" }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function Testimonials() {
  const [page, setPage] = useState(0);
  const [cols, setCols] = useState(2);

  useEffect(() => {
    const update = () => setCols(window.innerWidth >= 640 ? 2 : 1);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const totalPages = Math.ceil(testimonials.length / cols);

  useEffect(() => {
    const timer = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, 5000);
    return () => clearInterval(timer);
  }, [totalPages]);

  const prev = () => setPage((p) => (p - 1 + totalPages) % totalPages);
  const next = () => setPage((p) => (p + 1) % totalPages);

  const pageItems = testimonials.slice(page * cols, page * cols + cols);

  return (
    <section
      id="testimonials"
      style={{ position: "relative", zIndex: 10, padding: "60px 24px" }}
    >
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        {/* ── Header ── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          style={{ textAlign: "center", marginBottom: "64px" }}
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
                fontSize: "clamp(28px, 3.5vw, 44px)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
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

        {/* ── Cards grid ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${page}-${cols}`}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: "20px",
              marginBottom: "36px",
            }}
          >
            {pageItems.map((t, idx) => (
              <FeedbackCard key={idx} t={t} isFeatured={idx === 0} />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* ── Controls ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
          }}
        >
          <button
            onClick={prev}
            aria-label="Previous testimonials"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.12)",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              color: "#E9F1F8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background =
                "linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background =
                "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)";
            }}
          >
            ←
          </button>

          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Go to page ${i + 1}`}
                style={{
                  width: i === page ? "24px" : "8px",
                  height: "8px",
                  borderRadius: "999px",
                  border: "none",
                  background: i === page ? "#00B7FF" : "rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>

          <button
            onClick={next}
            aria-label="Next testimonials"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.12)",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              color: "#E9F1F8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background =
                "linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background =
                "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)";
            }}
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}
