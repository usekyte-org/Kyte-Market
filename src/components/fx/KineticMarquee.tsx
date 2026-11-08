'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Link from 'next/link'
import { useRef } from 'react'
import { isFillable, useOffers } from '@/lib/data'
import { eth, num, timeLeft } from '@/lib/format'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/** Endless strip of live offers. Scroll velocity speeds it up and flips its direction. */
export function KineticMarquee() {
  const offers = useOffers()
  const items = (offers.data ?? []).filter((o) => isFillable(o)).slice(0, 14)
  const wrap = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const el = track.current
      if (!el || items.length === 0) return
      const tween = gsap.to(el, { xPercent: -50, ease: 'none', duration: 40, repeat: -1 })
      let dir = 1
      const st = ScrollTrigger.create({
        onUpdate: (self) => {
          const v = self.getVelocity()
          const next = v < 0 ? -1 : 1
          if (next !== dir) {
            dir = next
            gsap.to(tween, { timeScale: dir, duration: 0.4, overwrite: true })
          }
          const boost = Math.min(Math.abs(v) / 250, 5)
          gsap.to(tween, { timeScale: dir * (1 + boost), duration: 0.25, overwrite: true, onComplete: () => gsap.to(tween, { timeScale: dir, duration: 1.2 }) })
        },
      })
      return () => {
        st.kill()
        tween.kill()
      }
    },
    { scope: wrap, dependencies: [items.length] },
  )

  if (items.length === 0) return null
  const row = [...items, ...items]
  return (
    <div ref={wrap} className="relative -mx-4 overflow-hidden border-y border-line py-4 md:-mx-6">
      <div ref={track} className="flex w-max gap-10 will-change-transform">
        {row.map((o, i) => (
          <Link key={`${o.id}-${i}`} href="/market" className="flex items-center gap-3 whitespace-nowrap font-mono text-sm text-muted transition-colors hover:text-ink">
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
