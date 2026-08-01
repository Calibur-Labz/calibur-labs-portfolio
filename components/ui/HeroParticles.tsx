'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  baseSize: number
  baseOpacity: number
  phase: number
  pulseSpeed: number
  depth: number
}

export default function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let waveY = -220

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // ── tunables ────────────────────────────────────────────────────────────
    const COUNT     = 72
    const MAX_DIST  = 128
    const WAVE_SPD  = 0.2

    // Cyan trace palette
    const CR = 0, CG = 183, CB = 255   // particle / line color
    // ────────────────────────────────────────────────────────────────────────

    const particles: Particle[] = []
    for (let i = 0; i < COUNT; i++) {
      const depth = Math.random()
      particles.push({
        x:           Math.random() * canvas.width,
        y:           Math.random() * canvas.height,
        vx:          (Math.random() - 0.5) * (0.06 + depth * 0.16),
        vy:          (Math.random() - 0.5) * (0.06 + depth * 0.16),
        baseSize:    0.4 + depth * 1.75,
        baseOpacity: 0.09 + depth * 0.36,
        phase:       Math.random() * Math.PI * 2,
        pulseSpeed:  0.22 + Math.random() * 0.68,
        depth,
      })
    }

    let time = 0

    const render = () => {
      time += 0.011
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // ── wave ────────────────────────────────────────────────────────────
      waveY += WAVE_SPD
      if (waveY > canvas.height + 240) waveY = -240
      const waveR = 200

      // ── move ────────────────────────────────────────────────────────────
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -4)               p.x = canvas.width  + 4
        else if (p.x > canvas.width  + 4) p.x = -4
        if (p.y < -4)               p.y = canvas.height + 4
        else if (p.y > canvas.height + 4) p.y = -4
      }

      // ── connection lines ─────────────────────────────────────────────────
      ctx.lineWidth = 0.4
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const dist2 = dx * dx + dy * dy
          if (dist2 >= MAX_DIST * MAX_DIST) continue

          const dist  = Math.sqrt(dist2)
          const alpha = (1 - dist / MAX_DIST) * 0.17
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(${CR},${CG},${CB},${alpha.toFixed(3)})`
          ctx.stroke()
        }
      }

      // ── particles ────────────────────────────────────────────────────────
      for (const p of particles) {
        const pulse    = Math.sin(time * p.pulseSpeed + p.phase)
        const size     = p.baseSize + pulse * 0.44

        // organic wave band (sine-bent horizontal sweep)
        const waveAtX  = waveY + Math.sin(p.x * 0.0065 + time * 0.32) * 52
        const dWave    = Math.abs(p.y - waveAtX)
        const waveBst  = dWave < waveR ? (1 - dWave / waveR) * 0.28 : 0

        const opacity  = Math.min(0.93, p.baseOpacity + pulse * 0.09 + waveBst)
        const glowR    = Math.max(size * 4, 2.8)

        // outer soft halo
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR * 1.6)
        halo.addColorStop(0,   `rgba(${CR},${CG},${CB},${(opacity * 0.18).toFixed(3)})`)
        halo.addColorStop(1,   `rgba(${CR},${CG},${CB},0)`)
        ctx.beginPath()
        ctx.arc(p.x, p.y, glowR * 1.6, 0, Math.PI * 2)
        ctx.fillStyle = halo
        ctx.fill()

        // inner bright core
        const core = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR)
        core.addColorStop(0,    `rgba(${CR},${CG},${CB},${opacity.toFixed(3)})`)
        core.addColorStop(0.38, `rgba(${CR},${CG},${CB},${(opacity * 0.32).toFixed(3)})`)
        core.addColorStop(1,    `rgba(${CR},${CG},${CB},0)`)
        ctx.beginPath()
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2)
        ctx.fillStyle = core
        ctx.fill()
      }

      // ── wave-band overlay ────────────────────────────────────────────────
      const bTop = waveY - waveR
      const bH   = waveR * 2
      if (bTop < canvas.height && bTop + bH > 0) {
        const wg = ctx.createLinearGradient(0, bTop, 0, bTop + bH)
        wg.addColorStop(0,   `rgba(${CR},${CG},${CB},0)`)
        wg.addColorStop(0.5, `rgba(${CR},${CG},${CB},0.011)`)
        wg.addColorStop(1,   `rgba(${CR},${CG},${CB},0)`)
        ctx.fillStyle = wg
        ctx.fillRect(0, Math.max(0, bTop), canvas.width, Math.min(canvas.height, bH))
      }

      animId = requestAnimationFrame(render)
    }

    render()
    return () => { cancelAnimationFrame(animId); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'absolute',
        inset:         0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
        zIndex:        1,
      }}
    />
  )
}
