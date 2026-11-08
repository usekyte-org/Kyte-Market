'use client'

import { useEffect, useRef } from 'react'

/**
 * Tagline reveal: every word starts muted and turns to full ink as it crosses a trigger line near the
 * middle of the viewport, in reading order. One IntersectionObserver for all words, no scroll listener.
 */
export function WordReveal({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const words = ref.current?.querySelectorAll<HTMLSpanElement>('[data-word]')
    if (!words?.length) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const el = e.target as HTMLSpanElement
          const i = Number(el.dataset.word)
          el.style.transitionDelay = reduce ? '0ms' : `${(i % 12) * 35}ms`
          el.classList.add('is-on')
          io.unobserve(el)
        }
      },
      { rootMargin: '0px 0px -42% 0px', threshold: 0 },
    )
    words.forEach((w) => io.observe(w))
    return () => io.disconnect()
  }, [])
  return (
    <p ref={ref} className={`text-balance ${className}`}>
      {text.split(' ').map((w, i) => (
        <span key={i} data-word={i} className="word">
          {w}{' '}
        </span>
      ))}
    </p>
  )
}
