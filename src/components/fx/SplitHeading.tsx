'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createElement, useRef, type ElementType } from 'react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Split-text reveal: each word slides up out of a clipped line as the heading scrolls into view.
 * Plain text in the DOM for accessibility; the animation only transforms spans.
 */
export function SplitHeading({ text, as = 'h2', className = '', delay = 0 }: { text: string; as?: ElementType; className?: string; delay?: number }) {
  const ref = useRef<HTMLElement>(null)
  useGSAP(
    () => {
      const words = ref.current?.querySelectorAll('.sw')
      if (!words?.length) return
      gsap.fromTo(
        words,
        { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger: 0.035, delay, scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true } },
      )
    },
    { scope: ref },
  )
  return createElement(
    as,
    { ref, className: `${className}`, 'aria-label': text },
    text.split(' ').map((w, i) => (
      <span key={i} className="inline-block overflow-hidden align-bottom" aria-hidden>
        <span className="sw inline-block will-change-transform">{w}&nbsp;</span>
      </span>
    )),
  )
}
