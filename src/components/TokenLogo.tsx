'use client'

import { useState } from 'react'
import { contracts } from '@/lib/chains'
import rh from '@/lib/rh-mainnet-tokens.json'

// Crypto icons from the mainnet token snapshot (by address), plus a few listed tokens it has no icon for.
const BY_ADDRESS = new Map(rh.tokens.filter((t) => t.icon).map((t) => [t.address.toLowerCase(), t.icon as string]))
const BY_SYMBOL: Record<string, string> = {
  APE: 'https://assets.coingecko.com/coins/images/24383/small/apecoin.jpg',
  PENDLE: 'https://assets.coingecko.com/coins/images/15069/small/Pendle_Logo_Normal-03.png',
  SUSHI: 'https://assets.coingecko.com/coins/images/12271/small/512x512_Logo_no_chop.png',
}
const STOCK = /Robinhood Token/i

/** Logo URL for a listed token: crypto icon, else the company logo for a Robinhood Stock Token, else none. */
export function logoUrl(t: { symbol: string; name?: string; address?: string }): string | undefined {
  // The protocol token, whatever it is called on chain: the Kyte mark (so a new $KYTE shows its logo on day one).
  if (t.address && contracts.kyteToken && t.address.toLowerCase() === contracts.kyteToken.toLowerCase()) return '/brand/kyte-mark.png'
  const known = (t.address && BY_ADDRESS.get(t.address.toLowerCase())) || BY_SYMBOL[t.symbol]
  if (known) return known
  // Only Robinhood Stock Tokens are looked up by ticker: a crypto symbol (LIT, TI…) can collide with a real ticker.
  if (t.name && STOCK.test(t.name)) return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(t.symbol)}.png`
}

/** Round token logo; falls back to the ticker's first letters when there is no logo or it fails to load. */
export function TokenLogo({ symbol, name, address, size = 20, className = '' }: { symbol: string; name?: string; address?: string; size?: number; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null)
  const src = logoUrl({ symbol, name, address })
  const box = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`
  if (!src || broken === src)
    return (
      <span className={`${box} border border-white/10 bg-white/[0.04] font-mono text-ink`} style={{ width: size, height: size, fontSize: Math.max(7, size * 0.34) }} aria-hidden>
        {symbol.slice(0, 3)}
      </span>
    )
  return (
    // White backing: company logos are drawn for light backgrounds.
    <span className={`${box} bg-white`} style={{ width: size, height: size }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={size} height={size} loading="lazy" className="size-full object-contain" onError={() => setBroken(src)} />
    </span>
  )
}
