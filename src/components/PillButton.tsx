'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Pill CTA in the Optivio style: label on the left, a dark circle with a dotted arrow on the right.
 * Hover: the label rolls up and its duplicate rolls in from below (with a slight skew), the arrow slides
 * out of the circle to the top right while a second one slides in from the bottom left.
 * `premium`: the brand gradient with a glossy top light, a soft glow and a white disc (footer).
 * The disc holds a glyph instead of an arrow: `chart`, a mini price line like the Market chart with its area and
 * live endpoint, which redraws on hover (trading CTAs). `none` drops the disc: a plain pill, label only (connect).
 */
export function PillButton({ href, children, tone = 'accent', size = 'md', glyph = 'chart', className = '', onClick, disabled }: { href?: string; children: ReactNode; tone?: 'accent' | 'light' | 'dark' | 'premium'; size?: 'md' | 'sm'; glyph?: 'chart' | 'none'; className?: string; onClick?: () => void; disabled?: boolean }) {
  const cls = `pill pill-${tone} ${size === 'sm' ? 'pill-sm' : ''} ${glyph === 'none' ? 'pill-plain' : ''} ${className}`
  const inner = (
    <>
      <span className="pill-label">
        <span className="pill-text">{children}</span>
        <span className="pill-text pill-text-2" aria-hidden>{children}</span>
      </span>
      {glyph !== 'none' && (
        <span className="pill-circle" aria-hidden>
          <Spark />
        </span>
      )}
    </>
  )
  if (href) return <Link href={href} className={cls} onClick={onClick}>{inner}</Link>
  return <button type="button" className={cls} onClick={onClick} disabled={disabled}>{inner}</button>
}

/** Mini market chart, always live: the price line flows through, the area breathes with it and the last price pings. */
function Spark() {
  return (
    <svg viewBox="0 0 20 14" width="18" height="13" className="pill-spark" aria-hidden>
      <defs>
        <linearGradient id="spark-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="pill-spark-area" d="M1 11 C4 10.5 5 7.5 7.5 7.5 S11 9.5 13 7 S16.5 2.5 19 2.2 V13 H1 Z" fill="url(#spark-area)" />
      <path className="pill-spark-line" d="M1 11 C4 10.5 5 7.5 7.5 7.5 S11 9.5 13 7 S16.5 2.5 19 2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="pill-spark-ping" cx="19" cy="2.2" r="1.6" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle className="pill-spark-dot" cx="19" cy="2.2" r="1.6" fill="currentColor" />
    </svg>
  )
}

/** Circular icon button (socials in the footer): icon rolls up and its duplicate rolls in on hover. */
export function CircleButton({ href, label, children, className = '' }: { href: string; label: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={`circle-btn ${className}`}>
      <span className="circle-icon">{children}</span>
      <span className="circle-icon circle-icon-2" aria-hidden>{children}</span>
    </a>
  )
}
