'use client'

import { useEffect, useRef } from 'react'

/**
 * Living ASCII background for the footer panel.
 *
 * - A 3D value-noise "wind" field drives which glyph each cell shows; gusts streak left to right.
 * - A giant wordmark (the element marked `data-ascii-word` inside the host) is rasterised to a per-cell mask,
 *   so the field is rendered in the accent colour where the letters are and in faint grey elsewhere.
 *   The letters "decode" out of static over ~1.4 s the first time the footer scrolls into view, then a slow
 *   light sweep keeps crossing them.
 * - The pointer pushes a ripple through the field (listens on the host, the canvas itself is inert).
 * - Glyphs are blitted from a pre-rendered atlas (drawImage, not fillText), so ~7k cells at 24 fps stay cheap.
 * - Only animates while on screen; honors prefers-reduced-motion by drawing one resolved frame.
 */

const GLYPHS = ' .·:-=+*xo#%@'
const LEVELS = 14
const RAMPS = 2 // 0 = grey (ambient), 1 = accent (wordmark)

// --- tiny 3D value noise -------------------------------------------------------------------------------
const PERM = new Uint8Array(512)
{
  let seed = 1337
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]
}
const lat = (x: number, y: number, z: number) => PERM[(PERM[(PERM[x & 255] + y) & 255] + z) & 255] / 255
const fade = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function noise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi)
  const x0 = lerp(lerp(lat(xi, yi, zi), lat(xi + 1, yi, zi), u), lerp(lat(xi, yi + 1, zi), lat(xi + 1, yi + 1, zi), u), v)
  const x1 = lerp(lerp(lat(xi, yi, zi + 1), lat(xi + 1, yi, zi + 1), u), lerp(lat(xi, yi + 1, zi + 1), lat(xi + 1, yi + 1, zi + 1), u), v)
  return lerp(x0, x1, w)
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function FooterAscii({ className = '', cell = 13, fps = 24 }: { className?: string; cell?: number; fps?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const host = canvas?.parentElement
    if (!canvas || !host) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const css = getComputedStyle(document.documentElement)
    const accent = hexToRgb(css.getPropertyValue('--color-accent').trim() || '#4dfca9')
    const accent2 = hexToRgb(css.getPropertyValue('--color-accent-2').trim() || '#05edfa')
    const grey = hexToRgb(css.getPropertyValue('--color-muted').trim() || '#9b9b9b')
    const sansFamily = getComputedStyle(document.body).fontFamily || 'ui-sans-serif, system-ui, sans-serif'

    let dpr = 1
    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let mask = new Float32Array(0) // 0..1 per cell: how much of the wordmark covers it
    let weight = new Float32Array(0) // ambient field strength per cell (calmer up top where the copy sits)
    let atlas: HTMLCanvasElement | null = null

    // pointer (host-relative, in CSS px)
    let px = -1e4, py = -1e4, tx = -1e4, ty = -1e4
    let pStrength = 0, pTarget = 0

    // reveal
    let revealStart = -1
    let visible = false
    let raf = 0
    let last = 0
    const frameMs = 1000 / fps

    const buildAtlas = () => {
      const a = document.createElement('canvas')
      a.width = GLYPHS.length * cell * dpr
      a.height = RAMPS * LEVELS * cell * dpr
      const g = a.getContext('2d')
      if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.font = `500 ${cell - 1}px ui-monospace, SFMono-Regular, Menlo, monospace`
      g.textBaseline = 'middle'
      g.textAlign = 'center'
      for (let r = 0; r < RAMPS; r++) {
        for (let l = 0; l < LEVELS; l++) {
          const t = l / (LEVELS - 1)
          let rgb: [number, number, number]
          let alpha: number
          if (r === 0) {
            rgb = grey
            alpha = 0.05 + 0.45 * t
          } else {
            // mint at the core, cyan on the fringes, flashing toward white at the very top
            const mix = Math.max(0, Math.min(1, (t - 0.35) / 0.5))
            const base: [number, number, number] = [lerp(accent2[0], accent[0], mix), lerp(accent2[1], accent[1], mix), lerp(accent2[2], accent[2], mix)]
            const white = Math.max(0, (t - 0.86) / 0.14)
            rgb = [lerp(base[0], 255, white), lerp(base[1], 255, white), lerp(base[2], 255, white)]
            alpha = 0.28 + 0.72 * t
          }
          g.fillStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`
          for (let i = 0; i < GLYPHS.length; i++) {
            if (i === 0) continue
            g.fillText(GLYPHS[i], i * cell + cell / 2, (r * LEVELS + l) * cell + cell / 2 + 0.5)
          }
        }
      }
      atlas = a
    }

    const buildMask = () => {
      mask = new Float32Array(cols * rows)
      weight = new Float32Array(cols * rows)
      for (let y = 0; y < rows; y++) {
        const fy = fade(Math.min(1, y / Math.max(1, rows - 1)))
        for (let x = 0; x < cols; x++) {
          const fx = Math.min(1, x / Math.max(1, cols - 1))
          // calm in the top-left (brand copy), lively toward the bottom and the right edge
          weight[y * cols + x] = 0.2 + 0.8 * Math.max(fy, fx * 0.45)
        }
      }
      const band = host.querySelector<HTMLElement>('[data-ascii-word]')
      const word = band?.dataset.asciiWord
      if (!band || !word) return
      const hr = host.getBoundingClientRect()
      const br = band.getBoundingClientRect()
      const bx = br.left - hr.left, by = br.top - hr.top, bw = br.width, bh = br.height
      if (bw < 10 || bh < 10) return

      const off = document.createElement('canvas')
      off.width = cols
      off.height = rows
      const g = off.getContext('2d', { willReadFrequently: true })
      if (!g) return
      // draw the word in cell units so one pixel = one cell
      g.scale(1 / cell, 1 / cell)
      g.fillStyle = '#fff'
      g.textAlign = 'center'
      g.textBaseline = 'alphabetic'
      let size = 100
      g.font = `700 ${size}px ${sansFamily}`
      try { (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '-0.05em' } catch { /* older engines */ }
      const m = g.measureText(word)
      const asc = m.actualBoundingBoxAscent || size * 0.72
      const desc = m.actualBoundingBoxDescent || size * 0.2
      size = Math.floor(Math.min((bw * 0.98) / (m.width / 100), (bh * 0.96) / ((asc + desc) / 100)))
      g.font = `700 ${size}px ${sansFamily}`
      const m2 = g.measureText(word)
      const asc2 = m2.actualBoundingBoxAscent || size * 0.72
      const desc2 = m2.actualBoundingBoxDescent || size * 0.2
      const baseline = by + bh / 2 + (asc2 - desc2) / 2
      g.fillText(word, bx + bw / 2, baseline)
      const data = g.getImageData(0, 0, cols, rows).data
      for (let i = 0; i < cols * rows; i++) mask[i] = data[i * 4 + 3] / 255
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const r = host.getBoundingClientRect()
      width = r.width
      height = r.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(width / cell)
      rows = Math.ceil(height / cell)
      buildAtlas()
      buildMask()
      if (reduce) draw(0)
    }

    const draw = (t: number) => {
      if (!atlas) return
      ctx.clearRect(0, 0, width, height)
      const s = t / 1000
      const reveal = reduce ? 1 : revealStart < 0 ? 0 : Math.min(1, (t - revealStart) / 1400)
      const rv = 1 - Math.pow(1 - reveal, 3)
      // pointer easing
      px += (tx - px) * 0.18
      py += (ty - py) * 0.18
      pStrength += (pTarget - pStrength) * 0.12
      const pr = Math.max(90, Math.min(width, height) * 0.22) // ripple radius
      const sweep = (s / 7) % 1 // one light sweep across the word every 7 s
      const aw = cell * dpr

      for (let y = 0; y < rows; y++) {
        const cy = y * cell + cell / 2
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x
          const cx = x * cell + cell / 2
          // wind: two octaves drifting right, plus horizontal gust streaks
          const n1 = noise(x * 0.085 - s * 0.55, y * 0.16, s * 0.22)
          const n2 = noise(x * 0.21 - s * 1.1, y * 0.4 + 7.3, s * 0.4 + 3.1)
          const gust = noise(x * 0.035 - s * 0.9, y * 0.55 + 19.7, s * 0.15)
          let n = n1 * 0.55 + n2 * 0.25 + Math.max(0, gust - 0.5) * 1.6
          // pointer ripple
          const dx = cx - px, dy = cy - py
          const d2 = dx * dx + dy * dy
          let pInf = 0
          if (pStrength > 0.01 && d2 < pr * pr * 4) {
            const d = Math.sqrt(d2)
            const fall = Math.exp(-(d * d) / (pr * pr)) * pStrength
            const ring = 0.5 + 0.5 * Math.sin(d * 0.07 - s * 6)
            pInf = fall * (0.3 + 0.7 * ring)
            n += pInf
          }
          const m = mask[i] * rv
          let ramp = 0
          let v: number
          if (m > 0.08) {
            // inside the wordmark: dense, accent, with a light sweep and a decode flicker while revealing
            const sx = x / cols
            const sw = Math.exp(-Math.pow((sx - sweep) * 7, 2)) * 0.35
            const flicker = reveal < 1 ? (noise(x * 0.9, y * 0.9, s * 30) - 0.5) * (1 - rv) * 1.2 : 0
            v = 0.52 + (n - 0.35) * 0.7 + sw + flicker + pInf * 0.6
            v *= 0.6 + 0.4 * Math.min(1, m * 1.6)
            ramp = 1
          } else {
            // sparse by default; gusts and the pointer ripple are what light the field up
            v = (n - 0.36) * 2.1 * weight[i]
            // letters still "leak" a faint halo while they form
            if (mask[i] > 0.08 && reveal < 1) v += (noise(x * 0.7, y * 0.7, s * 24) - 0.4) * 0.6 * (1 - rv)
          }
          if (v <= 0.04) continue
          const level = Math.min(LEVELS - 1, Math.floor(Math.min(1, v) * LEVELS))
          const gi = Math.min(GLYPHS.length - 1, Math.max(1, Math.round(Math.min(1, v) * (GLYPHS.length - 1))))
          ctx.drawImage(atlas, gi * aw, (ramp * LEVELS + level) * aw, aw, aw, x * cell, y * cell, cell, cell)
        }
      }
    }

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      if (t - last < frameMs) return
      last = t
      if (revealStart < 0) revealStart = t
      draw(t)
    }

    const start = () => {
      if (reduce || raf) return
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      tx = e.clientX - r.left
      ty = e.clientY - r.top
      pTarget = 1
    }
    const onLeave = () => { pTarget = 0 }

    resize()
    const ro = new ResizeObserver(() => resize())
    ro.observe(host)
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible) start()
        else stop()
      },
      { rootMargin: '80px' },
    )
    io.observe(host)
    // the same wordmark element may re-measure after web fonts land
    document.fonts?.ready.then(() => { buildMask(); if (reduce) draw(0) }).catch(() => {})
    host.addEventListener('pointermove', onMove, { passive: true })
    host.addEventListener('pointerleave', onLeave)

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
    }
  }, [cell, fps])

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 ${className}`} />
}
