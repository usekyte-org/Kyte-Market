'use client'

// Building blocks from the Kyte brand site (Updraft folder: components/site.tsx), ported to Next + Phosphor.
import { ArrowUpRight } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { getLenis } from '@/components/fx/SmoothScroll'

export const X_URL = 'https://x.com/useKyte'
export const EASE = [0.16, 1, 0.3, 1] as const

/** Smooth scroll to a section through Lenis (one eased glide, no fight with the smooth scroller). */
export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const l = getLenis()
  if (l) l.scrollTo(el, { offset: -88, duration: 1.4 })
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 88, behavior: 'smooth' })
}

export function XLogo({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/** `glass`: 48px tall frosted pill with a hairline gradient ring, sized to sit next to a PillButton (footer). */
export function XButton({ size = 'md', label = 'Follow @useKyte', variant = 'grad' }: { size?: 'sm' | 'md' | 'lg'; label?: string; variant?: 'grad' | 'ghost' | 'glass' }) {
  const pad = size === 'sm' ? '!py-2 !px-4 text-[13px]' : size === 'lg' ? '!py-4 !px-7 text-[15px]' : ''
  const look = variant === 'grad' ? 'btn-x' : variant === 'glass' ? 'btn-glass' : 'btn-ghost'
  return (
    <a href={X_URL} target="_blank" rel="noopener noreferrer" className={`btn ${look} ${pad}`}>
      <XLogo className={size === 'lg' ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
      <span>{label}</span>
      <ArrowUpRight size={16} className="opacity-70" />
    </a>
  )
}

export function Reveal({ children, delay = 0, className = '', y = 22 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

export function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <Reveal className="max-w-3xl">
      <div className="eyebrow flex items-center gap-3"><span className="grad-bg h-px w-8" />{eyebrow}</div>
      <h2 className="font-display mt-5 text-[34px] font-medium leading-[1.05] md:text-[52px]">{title}</h2>
      {sub && <p className="mt-5 text-[17px] leading-relaxed text-ink/60">{sub}</p>}
    </Reveal>
  )
}

/** Full-bleed wrapper: the landing breaks out of the layout's max-w-6xl main column. */
export function Bleed({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`relative left-1/2 w-screen -translate-x-1/2 ${className}`}>{children}</section>
}

/** Centered 1240px column used by every landing section. */
export function Wrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-5 md:px-8 ${className}`}>{children}</div>
}
