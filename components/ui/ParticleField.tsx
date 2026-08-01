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

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let waveY = -260

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const COUNT = 90
    const MAX_DIST = 130
    const WAVE_SPEED = 0.26

    const particles: Particle[] = []
    for (let i = 0; i < COUNT; i++) {
      const depth = Math.random()
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * (0.1 + depth * 0.2),
        vy: (Math.random() - 0.5) * (0.1 + depth * 0.2),
        baseSize: 0.5 + depth * 1.9,
        baseOpacity: 0.14 + depth * 0.44,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.28 + Math.random() * 0.75,
        depth,
      })
    }

    let time = 0

    const render = () => {
      time += 0.012
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Advance wave
      waveY += WAVE_SPEED
      if (waveY > canvas.height + 260) waveY = -260
      const waveRadius = 200

      // Update particle positions (wrap-around edges for seamless flow)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -4) p.x = canvas.width + 4
        else if (p.x > canvas.width + 4) p.x = -4
        if (p.y < -4) p.y = canvas.height + 4
        else if (p.y > canvas.height + 4) p.y = -4
      }

      // Connection lines — drawn before particles so they sit underneath
      ctx.lineWidth = 0.5
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist2 = dx * dx + dy * dy

          if (dist2 < MAX_DIST * MAX_DIST) {
            const dist = Math.sqrt(dist2)
            const alpha = (1 - dist / MAX_DIST) * 0.18
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(0, 183, 255, ${alpha.toFixed(3)})`
            ctx.stroke()
          }
        }
      }

      // Particles with radial glow
      for (const p of particles) {
        const pulse = Math.sin(time * p.pulseSpeed + p.phase)
        const size = p.baseSize + pulse * 0.48

        // Sinusoidal wave band influence — gives the wave organic curvature
        const waveAtX = waveY + Math.sin(p.x * 0.007 + time * 0.35) * 48
        const distToWave = Math.abs(p.y - waveAtX)
        const waveBoost = distToWave < waveRadius
          ? (1 - distToWave / waveRadius) * 0.3
          : 0

        const opacity = Math.min(0.94, p.baseOpacity + pulse * 0.1 + waveBoost)
        const glowR = Math.max(size * 3.8, 3)

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR)
        grad.addColorStop(0,    `rgba(94, 233, 255, ${opacity.toFixed(3)})`)
        grad.addColorStop(0.42, `rgba(0,  183, 255, ${(opacity * 0.34).toFixed(3)})`)
        grad.addColorStop(1,    'rgba(0, 183, 255, 0)')

        ctx.beginPath()
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }

      // Soft wave-band overlay — very faint full-width gradient stripe
      const bandTop = waveY - waveRadius
      const bandH = waveRadius * 2
      if (bandTop < canvas.height && bandTop + bandH > 0) {
        const wg = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH)
        wg.addColorStop(0,   'rgba(0, 183, 255, 0)')
        wg.addColorStop(0.5, 'rgba(0, 183, 255, 0.013)')
        wg.addColorStop(1,   'rgba(0, 183, 255, 0)')
        ctx.fillStyle = wg
        ctx.fillRect(0, Math.max(0, bandTop), canvas.width, Math.min(canvas.height, bandH))
      }

      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  )
}
