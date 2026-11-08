'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef } from 'react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Hero scrolltelling: the copy drifts up and fades as you scroll, while the product frame starts tilted back
 * and scaled down, then flattens and settles into place (scrubbed to the scrollbar).
 */
export function HeroScroll({ copy, frame }: { copy: React.ReactNode; frame: React.ReactNode }) {
  const section = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.set(frameRef.current, { rotateX: 14, scale: 0.9, y: 60, transformPerspective: 1400, transformOrigin: '50% 0%' })
      gsap.to(frameRef.current, {
        rotateX: 0, scale: 1, y: 0, ease: 'none',
        scrollTrigger: { trigger: frameRef.current, start: 'top 90%', end: 'top 35%', scrub: 0.6 },
      })
      gsap.to(copyRef.current, {
        y: -60, opacity: 0.25, ease: 'none',
        scrollTrigger: { trigger: section.current, start: 'top top', end: 'bottom 40%', scrub: 0.6 },
      })
    },
    { scope: section },
  )

  return (
    <div ref={section}>
      <div ref={copyRef} className="will-change-transform">{copy}</div>
      <div ref={frameRef} className="mt-14 will-change-transform md:mt-16">{frame}</div>
    </div>
  )
}
