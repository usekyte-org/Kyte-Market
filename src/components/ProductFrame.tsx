'use client'

import Link from 'next/link'
import { useState } from 'react'
import { chain, isDevnet } from '@/lib/chains'
import { BRAND } from '@/lib/config'
import { LiveOffers } from './LiveOffers'
import { MainnetTokens } from './MainnetTokens'

/** The "product screenshot" under the hero: a browser frame showing the live market. */
export function ProductFrame() {
  const [tab, setTab] = useState<'mainnet' | 'devnet'>('mainnet')

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-10 -bottom-10 h-40 rounded-full hidden" />
      <div className="frame relative">
        <div className="frame-bar">
          <span className="size-2.5 rounded-full bg-white/10" /><span className="size-2.5 rounded-full bg-white/10" /><span className="size-2.5 rounded-full bg-white/10" />
          <span className="ml-3 rounded-md bg-white/[0.04] px-3 py-1 font-mono text-xs text-muted">{BRAND.wordmark}/market</span>
          <span className="ml-4 hidden items-center gap-1 rounded-full border border-white/10 p-0.5 md:inline-flex">
            {(['mainnet', 'devnet'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] transition-colors duration-300 ${tab === t ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}>
                {t === 'mainnet' ? 'Trending on Robinhood Chain' : `Open offers · ${isDevnet ? 'devnet' : chain.testnet ? 'testnet' : 'live'}`}
              </button>
            ))}
          </span>
          <span className="ml-auto flex items-center gap-2 font-mono text-xs text-accent">
            <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex size-1.5 rounded-full bg-accent" /></span>
            live
          </span>
        </div>
        <div className="overflow-x-auto">
          {tab === 'mainnet' ? <MainnetTokens /> : <LiveOffers />}
        </div>
      </div>
    </div>
  )
}
