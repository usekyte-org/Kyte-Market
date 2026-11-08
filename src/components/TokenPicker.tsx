'use client'

import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Asset } from '@/lib/data'
import { TokenLogo } from './TokenLogo'

type Group = 'Robinhood stocks' | 'Tokenized stocks' | 'Crypto'
export const groupOf = (a: Pick<Asset, 'name'>): Group =>
  /Robinhood Token/i.test(a.name) ? 'Robinhood stocks' : /Ondo Tokenized/i.test(a.name) ? 'Tokenized stocks' : 'Crypto'
const ORDER: Group[] = ['Robinhood stocks', 'Tokenized stocks', 'Crypto']
const clean = (name: string) => name.replace(/\s*[•·]\s*Robinhood Token$/i, '').replace(/\s*\(Ondo Tokenized\)$/i, '')

/**
 * Searchable token menu for a few hundred listed assets: type a ticker or company name, arrow keys + Enter to pick.
 * Grouped as Robinhood Stock Tokens, other tokenized stocks (Ondo) and crypto.
 */
export function TokenPicker({
  assets,
  value,
  onChange,
  prices = {},
  className = '',
}: {
  assets: Asset[]
  value: string
  onChange: (symbol: string) => void
  prices?: Record<string, { price: number } | undefined>
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const current = assets.find((a) => a.symbol === value)

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const hits = assets.filter((a) => !t || a.symbol.toLowerCase().includes(t) || a.name.toLowerCase().includes(t))
    // Exact / prefix ticker matches first, then by group, then alphabetically.
    const rank = (a: Asset) => (a.symbol.toLowerCase() === t ? 0 : a.symbol.toLowerCase().startsWith(t) ? 1 : 2)
    return hits.sort((a, b) => rank(a) - rank(b) || ORDER.indexOf(groupOf(a)) - ORDER.indexOf(groupOf(b)) || a.symbol.localeCompare(b.symbol))
  }, [assets, q])

  useEffect(() => {
    if (!open) return
    setHi(0)
    input.current?.focus()
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const pick = (s: string) => { onChange(s); setOpen(false); setQ('') }

  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" className="input flex w-full items-center gap-3 text-left" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        {current && <TokenLogo symbol={current.symbol} name={current.name} address={current.address} size={22} />}
        <span className="font-mono font-semibold">{current?.symbol ?? 'Select a token'}</span>
        {current && <span className="truncate text-sm text-muted">{clean(current.name)}</span>}
        <CaretDown size={14} className="ml-auto shrink-0 text-muted" />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-full min-w-[300px] overflow-hidden rounded-xl border border-line bg-[#0f0f0f] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-3">
            <MagnifyingGlass size={14} className="text-muted" />
            <input
              ref={input}
              value={q}
              onChange={(e) => { setQ(e.target.value); setHi(0) }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, list.length - 1)) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
                else if (e.key === 'Enter') { e.preventDefault(); if (list[hi]) pick(list[hi].symbol) }
                else if (e.key === 'Escape') setOpen(false)
              }}
              placeholder={`Search ${assets.length} tokens: AAPL, Nvidia, SPY…`}
              className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted"
            />
          </div>
          <ul role="listbox" className="max-h-80 overflow-y-auto py-1" data-lenis-prevent>
            {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No listed token matches “{q}”.</li>}
            {list.map((a, i) => {
              const g = groupOf(a)
              const header = !q && (i === 0 || groupOf(list[i - 1]) !== g)
              const p = prices[a.symbol]?.price ?? a.spotEth
              return (
                <li key={a.address}>
                  {header && <div className="px-4 pb-1 pt-3 font-mono text-[10px] uppercase tracking-wider text-muted">{g}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={a.symbol === value}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => pick(a.symbol)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${i === hi ? 'bg-white/5' : ''} ${a.symbol === value ? 'text-accent' : ''}`}
                  >
                    <TokenLogo symbol={a.symbol} name={a.name} address={a.address} />
                    <span className="w-24 shrink-0 font-mono font-semibold">{a.symbol}</span>
                    <span className="truncate text-muted">{clean(a.name)}</span>
                    {p ? <span className="ml-auto shrink-0 font-mono text-xs tabular text-muted">{p.toPrecision(3)} ETH</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
