'use client'

import { useMemo, useState } from 'react'
import { TradeTable, TRADE_EVENTS, LABEL, isTrade, type TradeEvent } from '@/components/TradeHistory'
import { PageHeader, Segmented, Stat } from '@/components/ui'
import { chain } from '@/lib/chains'
import { useActivity, useHealth } from '@/lib/data'
import { eth } from '@/lib/format'

type Filter = 'all' | TradeEvent
const LIMIT = 500

/**
 * Every trade on the market so far: listings, fills, exercises, expiries and cancellations across all tokens,
 * newest first, with totals at the top. Filter by event or token. Each row links to its transaction.
 */
export default function TradesPage() {
  const feed = useActivity(LIMIT)
  const health = useHealth()
  const [filter, setFilter] = useState<Filter>('all')
  const [symbol, setSymbol] = useState('')
  const trades = useMemo(() => (feed.data ?? []).filter(isTrade), [feed.data])
  const symbols = useMemo(() => [...new Set(trades.map((t) => t.symbol).filter((s): s is string => !!s))].sort(), [trades])
  const rows = useMemo(() => trades.filter((t) => (filter === 'all' || t.name === filter) && (!symbol || t.symbol === symbol)), [trades, filter, symbol])
  const totals = useMemo(() => {
    const filled = trades.filter((t) => t.name === 'OptionBought')
    const exercised = trades.filter((t) => t.name === 'Exercised')
    return {
      listed: trades.filter((t) => t.name === 'OfferCreated').length,
      filled: filled.length,
      exercised: exercised.length,
      premium: filled.reduce((a, t) => a + (t.premium ?? 0), 0),
      settled: exercised.reduce((a, t) => a + (t.strike ?? 0), 0),
    }
  }, [trades])
  const loading = feed.isPending

  return (
    <div className="pb-10">
      <PageHeader title="Trades" sub={`Every option listed, filled, exercised, expired or cancelled on ${chain.name}, newest first. Nothing here is off-chain: open any row on the explorer.`}>
        <span className="font-mono text-xs text-faint">{health.data && health.data.lastBlock > 0 ? `synced to block ${health.data.lastBlock.toLocaleString('en-US')}` : ''}</span>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Options filled" value={loading ? '…' : String(totals.filled)} hint={`${totals.listed} listed`} />
        <Stat label="Premium paid" value={loading ? '…' : eth(totals.premium)} hint="by buyers, to sellers" />
        <Stat label="Exercised" value={loading ? '…' : String(totals.exercised)} hint={`${eth(totals.settled)} settled`} />
        <Stat label="Markets traded" value={loading ? '…' : String(symbols.length)} hint="tokens with at least one trade" />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, ...TRADE_EVENTS.map((e) => ({ value: e, label: LABEL[e] }))]} />
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setSymbol('')} className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${!symbol ? 'border-ink/30 bg-ink/[0.08] text-ink' : 'border-line text-muted hover:text-ink'}`}>All tokens</button>
          {symbols.map((s) => (
            <button key={s} type="button" onClick={() => setSymbol(symbol === s ? '' : s)} className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${symbol === s ? 'border-ink/30 bg-ink/[0.08] text-ink' : 'border-line text-muted hover:text-ink'}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <TradeTable rows={rows} loading={loading} empty={symbol || filter !== 'all' ? 'No trades match this filter.' : 'No trades yet. The first fill will show up here within seconds.'} />
      </div>
      {trades.length >= LIMIT && <p className="mt-3 text-xs text-faint">Showing the latest {LIMIT} events. Older ones are on the explorer.</p>}
    </div>
  )
}
