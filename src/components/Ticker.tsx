'use client'

import Link from 'next/link'
import { isFillable, useOffers } from '@/lib/data'
import { eth, num, timeLeft } from '@/lib/format'

/** Continuously scrolling strip of the open offers. Pauses on hover. */
export function Ticker() {
  const offers = useOffers()
  const items = (offers.data ?? []).filter((o) => isFillable(o)).sort((a, b) => a.expiry - b.expiry).slice(0, 16)
  if (items.length === 0) return null
  const row = [...items, ...items]
  return (
    <div className="group relative -mx-5 overflow-hidden border-y border-line bg-bg-2/60 py-3 backdrop-blur">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 hidden" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 hidden" />
      <div className="marquee flex w-max gap-8 group-hover:[animation-play-state:paused]">
        {row.map((o, i) => (
          <Link key={`${o.id}-${i}`} href="/market" className="flex items-center gap-3 whitespace-nowrap font-mono text-xs text-muted hover:text-ink">
            <span className={`size-1.5 rounded-full ${o.kind === 'call' ? 'bg-call' : 'bg-put'}`} />
            <span className={o.kind === 'call' ? 'text-call' : 'text-put'}>{o.kind.toUpperCase()}</span>
            <span className="text-ink">{num(o.amount, 4)} {o.symbol}</span>
            <span>@ {(o.strike / o.amount).toPrecision(3)} ETH</span>
            <span className="text-ink">{eth(o.premium)}</span>
            <span className="text-faint">{timeLeft(o.expiry)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
