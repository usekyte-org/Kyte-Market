'use client'
import { useEffect, useRef } from 'react'

/**
 * Interactive dot field for the agent's wallet gate: white dots only, no colour. A grid of dots that each grow, brighten and lean toward the
 * pointer by distance, so the "zoom" is continuous and travels with the mouse. The pointer is eased so the field
 * flows rather than snaps; without a pointer it breathes gently. Canvas, DPR aware, pauses off-screen.
 */
export function DotField({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const GAP = 22, RADIUS = 200
    let w = 0, h = 0, dpr = 1, raf = 0, t0 = performance.now(), visible = true
    const target = { x: -9999, y: -9999 }, cur = { x: -9999, y: -9999 }
    let hover = 0 // 0..1, eased presence of the pointer
    const fit = () => {
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2); w = r.width; h = r.height
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const draw = (now: number) => {
      raf = 0
      if (!visible) return
      const t = (now - t0) / 1000
      cur.x += (target.x - cur.x) * 0.12; cur.y += (target.y - cur.y) * 0.12
      const wantHover = target.x > -9000 ? 1 : 0
      hover += (wantHover - hover) * 0.08
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2, cy = h / 2, edge = Math.max(w, h) * 0.55
      const ox = (w % GAP) / 2, oy = (h % GAP) / 2
      for (let y = oy; y <= h; y += GAP) {
        for (let x = ox; x <= w; x += GAP) {
          // fade toward the panel edges
          const de = Math.hypot(x - cx, y - cy) / edge
          const vignette = Math.max(0, 1 - Math.pow(de, 2.2))
          if (vignette <= 0.02) continue
          // pointer proximity 0..1 with a smooth falloff
          const dx = x - cur.x, dy = y - cur.y, d = Math.hypot(dx, dy)
          const p = hover * Math.max(0, 1 - d / RADIUS)
          const k = p * p * (3 - 2 * p) // smoothstep
          // idle breathing: a slow wave crossing the field
          const wave = reduced ? 0 : 0.5 + 0.5 * Math.sin(t * 1.2 + (x + y) * 0.012)
          const r = 1 + 0.5 * wave * (1 - k) + 2.3 * k
          // dots lean slightly toward the pointer
          const pull = k * 6, px = d > 0 ? x - (dx / d) * pull : x, py = d > 0 ? y - (dy / d) * pull : y
          const a = vignette * (0.16 + 0.1 * wave + 0.75 * k)
          ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
        }
      }
      if (reduced && hover < 0.01 && wantHover === 0) return // static when idle under reduced motion
      raf = requestAnimationFrame(draw)
    }
    const kick = () => { if (!raf && visible) raf = requestAnimationFrame(draw) }
    const move = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); target.x = e.clientX - r.left; target.y = e.clientY - r.top; kick() }
    const leave = () => { target.x = -9999; target.y = -9999; kick() }
    const host = canvas.parentElement ?? canvas
    host.addEventListener('pointermove', move); host.addEventListener('pointerleave', leave)
    const ro = new ResizeObserver(() => { fit(); kick() }); ro.observe(canvas)
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; kick() }); io.observe(canvas)
    fit(); kick()
    return () => { host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', leave); ro.disconnect(); io.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [])
  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden />
}
