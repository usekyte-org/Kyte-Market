'use client'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

gsap.registerPlugin(ScrollTrigger)

let instance: Lenis | null = null
/** The live Lenis instance (null before mount, with reduced motion, or on the server), for programmatic scrolls. */
export function getLenis() {
  return instance
}

/**
 * Lenis smooth scrolling driven by GSAP's ticker, kept in sync with ScrollTrigger and reset on every route change.
 * Tuned for a heavy, buttery glide: a low lerp so wheel steps melt into one motion, and eased anchor scrolls.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenis = useRef<Lenis | null>(null)
  const path = usePathname()

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const l = new Lenis({
      lerp: 0.075,
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      anchors: { offset: -88, duration: 1.4 },
      autoRaf: false,
    })
    l.on('scroll', ScrollTrigger.update)
    const tick = (t: number) => l.raf(t * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    lenis.current = l
    instance = l
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __lenis?: Lenis }).__lenis = l
    return () => {
      gsap.ticker.remove(tick)
      l.destroy()
      lenis.current = null
      instance = null
    }
  }, [])

  // A new page starts at the top: Next resets the window, Lenis must forget the previous page's target too.
  useEffect(() => {
    if (window.location.hash) return
    lenis.current?.scrollTo(0, { immediate: true, force: true })
    window.scrollTo(0, 0)
    ScrollTrigger.refresh()
  }, [path])

  return <>{children}</>
}
