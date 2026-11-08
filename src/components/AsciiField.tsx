'use client'

import { useEffect, useRef } from 'react'

const GLYPHS = ' ·:-=+*#%@'

/**
 * Animated ASCII "wind" field in accent blue, drawn on a canvas. Cheap: ~2–3k glyphs per frame at 20 fps.
 * Honors prefers-reduced-motion (draws a single frame).
 */
export function AsciiField({ className = '', density = 14, speed = 1 }: { className?: string; density?: number; speed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const css = getComputedStyle(document.documentElement)
    const accent = css.getPropertyValue('--color-accent').trim() || '#4dfca9'
    const accent2 = css.getPropertyValue('--color-accent-2').trim() || '#05edfa'
    let raf = 0
    let last = 0
    const cell = density
    let cols = 0
    let rows = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `${cell - 2}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textBaseline = 'top'
      cols = Math.ceil(width / cell)
      rows = Math.ceil(height / cell)
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const s = (t / 1000) * speed
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v =
            Math.sin(x * 0.18 + s * 0.9) * Math.cos(y * 0.22 - s * 0.6) +
            Math.sin((x + y) * 0.07 + s * 0.4) * 0.8 +
            Math.cos(x * 0.05 - y * 0.11 + s * 0.3) * 0.6
          const n = (v + 2.4) / 4.8 // 0..1
          const i = Math.min(GLYPHS.length - 1, Math.max(0, Math.floor(n * GLYPHS.length)))
          if (i === 0) continue
          ctx.globalAlpha = 0.08 + n * 0.6
          // mint where the field is dense, cyan where it thins out: the two aurora colors
          ctx.fillStyle = n > 0.62 ? accent : accent2
          ctx.fillText(GLYPHS[i], x * cell, y * cell)
        }
      }
      ctx.globalAlpha = 1
    }

    const frame = (t: number) => {
      if (t - last > 50) {
        draw(t)
        last = t
      }
      raf = requestAnimationFrame(frame)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    if (reduce) draw(0)
    else raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [density, speed])

  return <canvas ref={ref} aria-hidden className={`pointer-events-none ${className}`} />
}
