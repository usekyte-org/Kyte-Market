'use client'

import { ArrowRight, CaretDown } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { Fragment, memo, useEffect, useMemo, useState } from 'react'
import { chain, isDevnet } from '@/lib/chains'
import { FEES } from '@/lib/config'
import { isFillable, useAssets, useCandles, useOffers, usePrices, type Offer } from '@/lib/data'
import { eth, num, shortAddr, timeLeft } from '@/lib/format'
import { TokenLogo } from './TokenLogo'
import { KindBadge } from './ui'

const EASE = [0.22, 1, 0.36, 1] as const

/** Tiny 1h price line for a token, drawn from the same candles the Market chart uses. */
const Sparkline = memo(function Sparkline({ symbol }: { symbol: string }) {
  const candles = useCandles(symbol, 60)
  const pts = (candles.data ?? []).slice(-40).map((c) => c.close)
  if (pts.length < 2) return <span className="block h-7 w-24 rounded bg-white/[0.04]" />
  const min = Math.min(...pts), max = Math.max(...pts)
  const w = 96, h = 28
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * w},${h - ((p - min) / (max - min || 1)) * (h - 4) - 2}`).join(' ')
  const up = pts[pts.length - 1] >= pts[0]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="block">
      <polyline points={d} fill="none" stroke={up ? '#4dfca9' : '#ff6b6b'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
})

/** Live, premium order book for the hero: sparklines, spot distance, ticking expiries, expandable rows. */
export function LiveOffers({ limit = 6 }: { limit?: number }) {
  const offers = useOffers()
  const assets = useAssets()
  const prices = usePrices()
  const [now, setNow] = useState(() => Date.now() / 1000)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1000)
    return () => clearInterval(t)
  }, [])

  const rows = useMemo(() => (offers.data ?? []).filter((o) => isFillable(o, now)).sort((a, b) => a.expiry - b.expiry).slice(0, limit), [offers.data, now, limit])
  const spotOf = (sym: string) => prices.data?.[sym]?.price ?? assets.data?.find((a) => a.symbol === sym)?.spotEth ?? 0
  const premiumOpen = rows.reduce((a, o) => a + o.premium, 0)
  const nearest = rows[0]

  return (
    <div>
      {/* live strip */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.05] text-xs">
        {[
          ['Open offers', `${rows.length}`],
          ['Premium on offer', eth(premiumOpen, 3)],
          ['Nearest expiry', nearest ? timeLeft(nearest.expiry, now) : '–'],
        ].map(([k, v]) => (
          <div key={k} className="px-5 py-3"><div className="label">{k}</div><div className="mt-1 font-mono text-sm tabular text-ink">{v}</div></div>
        ))}
      </div>

      <table className="w-full min-w-[720px] text-xs">
        <thead>
          <tr className="text-left">
            {['Type', 'Token', 'Amount', 'Strike / token', 'vs spot', 'Premium', '1h', 'Expires', ''].map((h) => (
              <th key={h} className="label px-5 py-3 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {rows.map((o, i) => {
              const spot = spotOf(o.symbol)
              const strikePer = o.strike / o.amount
              const vs = spot > 0 ? (strikePer / spot - 1) * 100 : null
              const q = prices.data?.[o.symbol]
              const breakEven = o.kind === 'call' ? (o.strike + o.premium) / o.amount : (o.strike - o.premium) / o.amount
              const key = o.id.toString()
              const expanded = open === key
              return (
                <Fragment key={key}>
                <Row i={i}>
                  <td className="px-5 py-3"><KindBadge kind={o.kind} /></td>
                  <td className="px-5 py-3 font-medium text-ink">
                    <span className="inline-flex items-center gap-2">
                      <TokenLogo symbol={o.symbol} name={assets.data?.find((a) => a.address.toLowerCase() === o.token.toLowerCase())?.name} address={o.token} size={18} />
                      {o.symbol}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono tabular text-muted">{num(o.amount, 4)}</td>
                  <td className="px-5 py-3 font-mono tabular">{strikePer.toPrecision(3)} ETH</td>
                  <td className="px-5 py-3">
                    {vs === null ? <span className="text-faint">–</span> : (
                      <span className="inline-flex items-center gap-2">
                        <span className={`font-mono tabular ${vs >= 0 ? 'text-accent' : 'text-danger'}`}>{vs >= 0 ? '+' : ''}{vs.toFixed(0)}%</span>
                        <span className="relative h-1 w-14 overflow-hidden rounded-full bg-white/[0.06]">
                          <span className={`absolute top-0 h-full ${vs >= 0 ? 'left-1/2 bg-accent' : 'right-1/2 bg-danger'}`} style={{ width: `${Math.min(50, Math.abs(vs) / 2)}%` }} />
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono tabular text-accent">{eth(o.premium)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Sparkline symbol={o.symbol} />
                      {q && <span className={`font-mono text-[10px] ${q.change1h >= 0 ? 'text-accent' : 'text-danger'}`}>{q.change1h >= 0 ? '+' : ''}{(q.change1h * 100).toFixed(1)}%</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono tabular text-muted">{timeLeft(o.expiry, now)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : key)} className="flex size-7 items-center justify-center rounded-full border border-white/10 text-muted transition-colors hover:text-ink">
                        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.4, ease: EASE }} className="flex"><CaretDown size={12} /></motion.span>
                      </button>
                      <Link href="/market" className="btn btn-accent btn-sm">Buy</Link>
                    </div>
                  </td>
                </Row>
                <Expanded open={expanded} offer={o} spot={spot} breakEven={breakEven} />
                </Fragment>
              )
            })}
          </AnimatePresence>
          {rows.length === 0 && (
            <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-muted">{offers.isLoading ? 'Reading the chain…' : 'No open offers right now.'}</td></tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-white/[0.05] px-5 py-3 text-xs text-faint">
        <span>{isDevnet ? 'Devnet' : chain.testnet ? 'Testnet' : 'Mainnet'} order book, read live from the contracts. Spot and sparklines from Uniswap v4 swaps.</span>
        <Link href="/market" className="link inline-flex items-center gap-1 font-mono">Open the market <ArrowRight size={11} /></Link>
      </div>
    </div>
  )
}

function Row({ children, i }: { children: React.ReactNode; i: number }) {
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: i * 0.04 }}
      className="group border-t border-white/[0.05] align-middle transition-colors hover:bg-white/[0.03]"
    >
      {children}
    </motion.tr>
  )
}

/** Detail row below the offer, animated open and closed. */
function Expanded({ open, offer, spot, breakEven }: { open: boolean; offer: Offer; spot: number; breakEven: number }) {
  const fee = (offer.premium * FEES.premiumBps) / 10_000
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.tr key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="bg-white/[0.02]">
          <td colSpan={9} className="p-0">
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.45, ease: EASE }} className="overflow-hidden">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 border-t border-white/[0.05] px-5 py-4 text-xs md:grid-cols-5">
                {[
                  ['Seller', shortAddr(offer.seller)],
                  ['Collateral', offer.kind === 'call' ? `${num(offer.amount, 4)} ${offer.symbol} in escrow` : `${eth(offer.strike)} in escrow`],
                  ['Break even / token', `${breakEven.toPrecision(3)} ETH`],
                  ['Spot now', spot ? `${spot.toPrecision(3)} ETH` : '–'],
                  ['Protocol fee', `${eth(fee, 5)} (${FEES.premiumBps / 100}%)`],
                ].map(([k, v]) => (
                  <div key={k}><div className="label">{k}</div><div className="mt-1 font-mono text-ink">{v}</div></div>
                ))}
              </div>
            </motion.div>
          </td>
        </motion.tr>
      )}
    </AnimatePresence>
  )
}
