'use client'

import { ArrowUpRight } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { RhToken } from '@/app/api/rh-tokens/route'
import snapshot from '@/lib/rh-mainnet-tokens.json'
import { compact, num } from '@/lib/format'

type Live = { updatedAt: number; fromBlock: string; toBlock: string; tokens: RhToken[]; source: string; error?: string }
type Snap = (typeof snapshot.tokens)[number]

/** Live swap activity from the RPC route (ranked by last-hour swaps). Cached 5 minutes server side. */
function useLiveSwaps() {
  return useQuery({
    queryKey: ['rh-tokens'],
    queryFn: async () => {
      const r = await fetch('/api/rh-tokens')
      // 503 = the route's first RPC scan is still running ("warming up"): fail so the retry below checks back.
      if (!r.ok) throw new Error(`rh-tokens ${r.status}`)
      return (await r.json()) as Live
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 20,
    retryDelay: 30_000,
  })
}

const usd = (n: number) => (n >= 1 ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `$${n.toPrecision(3)}`)

function TokenIcon({ t }: { t: Snap }) {
  const [broken, setBroken] = useState(false)
  if (broken || !t.icon) return <span className="flex size-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-mono text-[10px] text-ink">{t.symbol.slice(0, 3)}</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={t.icon} alt="" width={28} height={28} className="size-7 rounded-full bg-white/[0.04]" onError={() => setBroken(true)} />
}

/**
 * Real assets on Robinhood Chain mainnet: a dated snapshot from the chain's Blockscout explorer (names,
 * verified addresses, holders, price, volume) merged with live last-hour swap counts from the public RPC.
 */
export function MainnetTokens() {
  const live = useLiveSwaps()
  const liveByAddr = new Map((live.data?.tokens ?? []).map((t) => [t.address.toLowerCase(), t]))
  const rows = snapshot.tokens
  return (
    <div>
      <table className="w-full min-w-[720px] text-xs">
        <thead>
          <tr className="text-left">
            {['Token', 'Category', 'Price', 'Holders', 'Volume · 24h', 'Swaps · 1h', ''].map((h) => (
              <th key={h} className="label px-5 py-3 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const l = liveByAddr.get(t.address.toLowerCase())
            return (
              <tr key={t.address} className="border-t border-white/[0.05] transition-colors hover:bg-white/[0.03]">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <TokenIcon t={t} />
                    <div><div className="font-medium text-ink">{t.symbol}</div><div className="text-faint">{t.name}</div></div>
                  </div>
                </td>
                <td className="px-5 py-3"><span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">{t.category}</span></td>
                <td className="px-5 py-3 font-mono tabular text-accent">{usd(t.priceUsd)}</td>
                <td className="px-5 py-3 font-mono tabular">{num(t.holders, 0)}</td>
                <td className="px-5 py-3 font-mono tabular text-muted">${compact(t.volume24hUsd)}</td>
                <td className="px-5 py-3 font-mono tabular">{l ? <span className="text-ink">{num(l.swaps, 0)}</span> : <span className="text-faint">{live.isLoading ? '…' : '–'}</span>}</td>
                <td className="px-5 py-3 text-right">
                  <a href={`${snapshot.explorer.replace('/tokens', '')}/token/${t.address}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-ink">
                    {t.address.slice(0, 6)}…{t.address.slice(-4)} <ArrowUpRight size={11} />
                  </a>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] px-5 py-3 text-xs text-faint">
        <span>
          Real assets on <span className="text-muted">Robinhood Chain mainnet</span>. Names, addresses, holders, prices and volume from the chain explorer ({snapshot.snapshotAt} snapshot);
          swaps counted live from Uniswap v4 via the public RPC. Kyte lists tokens through its timelock; testnet and devnet trade test tokens.
        </span>
        <a href={snapshot.explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-muted hover:text-ink">all tokens <ArrowUpRight size={11} /></a>
      </div>
    </div>
  )
}
