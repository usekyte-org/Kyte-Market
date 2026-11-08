'use client'

import { ArrowRight, ArrowSquareOut } from '@phosphor-icons/react'
import Link from 'next/link'
import { useMemo } from 'react'
import { explorerAddress, explorerTx } from '@/lib/chains'
import { useActivity, type Activity } from '@/lib/data'
import { date, eth, num, shortAddr } from '@/lib/format'
import { TokenLogo } from './TokenLogo'

// Option-market events only: the fee split, burns and staking live on their own pages.
export const TRADE_EVENTS = ['OptionBought', 'OfferCreated', 'Exercised', 'Expired', 'OfferCancelled'] as const
export type TradeEvent = (typeof TRADE_EVENTS)[number]
export const LABEL: Record<TradeEvent, string> = { OptionBought: 'Filled', OfferCreated: 'Listed', Exercised: 'Exercised', Expired: 'Expired', OfferCancelled: 'Cancelled' }
const TONE: Record<TradeEvent, string> = {
  OfferCreated: 'bg-ink/[0.08] text-ink/80',
  OptionBought: 'bg-call/10 text-call',
  Exercised: 'bg-accent-2/10 text-accent-2',
  Expired: 'bg-warn/10 text-warn',
  OfferCancelled: 'bg-danger/10 text-danger',
}
// Who the row's address is: the buyer on a fill, the holder on an exercise, the seller otherwise.
const WHO: Record<TradeEvent, string> = { OptionBought: 'buyer', OfferCreated: 'seller', Exercised: 'holder', Expired: 'seller', OfferCancelled: 'seller' }

export const isTrade = (e: Activity): e is Activity & { name: TradeEvent } => (TRADE_EVENTS as readonly string[]).includes(e.name)

export function ago(at: number, now: number) {
  const s = Math.max(0, Math.floor(now - at))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return date(at)
}

export function EventBadge({ name }: { name: TradeEvent }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${TONE[name]}`}>{LABEL[name]}</span>
}

/**
 * The trade history table: one row per listing, fill, exercise, expiry or cancellation, newest first, with the
 * market, size, strike, premium, the wallet that acted and a link to the transaction.
 */
export function TradeTable({ rows, loading, empty, compact = false }: { rows: Activity[]; loading?: boolean; empty: string; compact?: boolean }) {
  const now = Date.now() / 1000
  const cols = compact ? ['Event', 'Market', 'Amount', 'Strike', 'Premium', 'When', 'Tx'] : ['Event', 'Market', 'Amount', 'Strike / token', 'Premium', 'Wallet', 'When', 'Transaction']
  return (
    <div className="card overflow-x-auto">
      <table className={`w-full text-sm ${compact ? 'min-w-[680px]' : 'min-w-[860px]'}`}>
        <thead>
          <tr className="border-b border-line text-left">
            {cols.map((h) => <th key={h} className="label px-4 py-3 font-normal">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.filter(isTrade).map((e) => {
            const url = explorerTx(e.tx)
            const who = e.actor ?? e.seller
            const whoUrl = who ? explorerAddress(who) : null
            const strikePer = e.strike && e.amount ? e.strike / e.amount : null
            return (
              <tr key={e.key} className="border-b border-line/60 last:border-0 transition-colors hover:bg-card-2">
                <td className="px-4 py-3.5"><EventBadge name={e.name} /></td>
                <td className="px-4 py-3.5 font-mono">
                  <span className="inline-flex items-center gap-2">
                    {e.symbol && <TokenLogo symbol={e.symbol} address={e.token} size={18} />}
                    <span className="font-medium text-ink">{e.symbol ?? '?'}</span>
                    <span className={`text-xs uppercase tracking-wider ${e.kind === 'put' ? 'text-put' : 'text-call'}`}>{e.kind}</span>
                  </span>
                </td>
                <td className="px-4 py-3.5 tabular">{e.amount != null ? num(e.amount, 4) : '–'}</td>
                <td className="px-4 py-3.5 font-mono tabular" title={e.strike != null ? `${eth(e.strike)} total` : undefined}>{strikePer != null ? `${strikePer.toPrecision(3)} ETH` : '–'}</td>
                <td className="px-4 py-3.5 font-mono tabular font-medium">{e.premium != null ? eth(e.premium) : '–'}</td>
                {!compact && (
                  <td className="px-4 py-3.5 font-mono text-xs">
                    {who ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-faint">{WHO[e.name]}</span>
                        {whoUrl ? <a href={whoUrl} target="_blank" rel="noreferrer" className="text-muted hover:text-ink hover:underline">{shortAddr(who)}</a> : <span className="text-muted">{shortAddr(who)}</span>}
                      </span>
                    ) : '–'}
                  </td>
                )}
                <td className="px-4 py-3.5 font-mono text-xs text-muted" title={date(e.at)}>{ago(e.at, now)}</td>
                <td className="px-4 py-3.5 font-mono text-xs">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-accent hover:underline">
                      {e.tx.slice(0, 8)}…{e.tx.slice(-4)}<ArrowSquareOut size={13} />
                    </a>
                  ) : (
                    <span className="text-faint">{e.tx.slice(0, 8)}…{e.tx.slice(-4)}</span>
                  )}
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} className="px-4 py-12 text-center text-muted">{loading ? 'Loading…' : empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Market page: the latest trades on the selected token, with a link to the full history. */
export function TradeHistory({ symbol }: { symbol: string }) {
  const feed = useActivity(12, symbol || undefined)
  const rows = useMemo(() => (feed.data ?? []).filter(isTrade), [feed.data])
  return (
    <section className="mt-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl tracking-tight">Recent {symbol} trades</h2>
          <p className="mt-1 text-sm text-muted">The latest listings, fills, exercises and expiries on this market, straight from the chain.</p>
        </div>
        <Link href="/trades" className="btn btn-ghost btn-sm">All trades <ArrowRight size={14} /></Link>
      </div>
      <TradeTable rows={rows} loading={feed.isPending} empty={`No ${symbol} trades yet.`} compact />
    </section>
  )
}
