'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { isFillable, useOffers } from '@/lib/data'
import { eth, num, timeLeft } from '@/lib/format'
import { KindBadge } from './ui'

/** Floating glass card with a live offer: tilts toward the cursor, countdown ticks every second. */
export function HeroCard() {
  const offers = useOffers()
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [now, setNow] = useState(() => Date.now() / 1000)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1000)
    return () => clearInterval(t)
  }, [])

  const live = (offers.data ?? []).filter((o) => isFillable(o, now)).sort((a, b) => b.premium - a.premium)
  const o = live[0]

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: -py * 10, y: px * 12 })
  }

  return (
    <div className="float relative" style={{ perspective: 1200 }}>
      <div className="pointer-events-none absolute -inset-8 rounded-[32px] bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-accent)_28%,transparent),transparent)] blur-2xl" />
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        className="card glow relative w-full max-w-sm p-6 transition-transform duration-200 ease-out"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <div className="flex items-center justify-between">
          <div className="label">// live offer</div>
          <span className="flex items-center gap-2 font-mono text-xs text-accent">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-accent" /></span>
            on-chain
          </span>
        </div>
        {o ? (
          <>
            <div className="mt-5 flex items-center gap-3">
              <KindBadge kind={o.kind} />
              <span className="font-mono text-2xl font-semibold">{num(o.amount, 4)} {o.symbol}</span>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="label">Strike</dt><dd className="mt-1 font-mono tabular">{eth(o.strike)}</dd></div>
              <div><dt className="label">Premium</dt><dd className="mt-1 font-mono tabular text-accent">{eth(o.premium)}</dd></div>
              <div><dt className="label">Expires in</dt><dd className="mt-1 font-mono tabular">{timeLeft(o.expiry, now)}</dd></div>
              <div><dt className="label">Fill by</dt><dd className="mt-1 font-mono tabular">{timeLeft(o.offerDeadline, now)}</dd></div>
            </dl>
            <div className="mt-5 h-px w-full bg-line" />
            <Link href="/market" className="btn btn-accent mt-5 w-full">Buy for {eth(o.premium)} →</Link>
          </>
        ) : (
          <div className="mt-6 py-10 text-center text-sm text-muted">{offers.isLoading ? 'Reading the chain…' : 'No open offers right now.'}</div>
        )}
      </div>
    </div>
  )
}
