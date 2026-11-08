'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BuyDialog } from '@/components/BuyDialog'
import { TimeLeft } from '@/components/TimeLeft'
import { TokenChart, type PriceLine } from '@/components/TokenChart'
import { TokenLogo } from '@/components/TokenLogo'
import { TokenPicker } from '@/components/TokenPicker'
import { TradeHistory } from '@/components/TradeHistory'
import { KindBadge, Note, PageHeader, Segmented } from '@/components/ui'
import { isFillable, useAssets, useOffers, usePrices, type Kind, type Offer } from '@/lib/data'
import { eth, num, shortAddr } from '@/lib/format'

type SortKey = 'expiry' | 'premium' | 'yield'
const INTERVALS = [{ label: '1m', sec: '60' }, { label: '5m', sec: '300' }, { label: '15m', sec: '900' }, { label: '1h', sec: '3600' }]

export default function MarketPage() {
  const [kind, setKind] = useState<'all' | Kind>('all')
  const [symbol, setSymbol] = useState('')
  const [interval, setInterval] = useState('900')
  const [sort, setSort] = useState<SortKey>('expiry')
  const [buying, setBuying] = useState<Offer | null>(null)
  const offers = useOffers()
  const assets = useAssets()
  const prices = usePrices()
  // /market?buy=<offer id> (from the agent's prepare_buy link): open that offer's dialog and select its token
  const params = useSearchParams()
  const [opened, setOpened] = useState<string | null>(null)
  // /market?token=SYM (from the Launchpad page): select that market
  const tokenParam = params.get('token')
  useEffect(() => { if (tokenParam) setSymbol(tokenParam.toUpperCase()) }, [tokenParam])
  useEffect(() => {
    const id = params.get('buy')
    if (!id || opened === id || !offers.data) return
    const o = offers.data.find((x) => x.id.toString() === id)
    if (o) { setSymbol(o.symbol); if (isFillable(o)) setBuying(o) }
    setOpened(id)
  }, [params, offers.data, opened])

  // Only tokens the AssetRegistry has enabled: one the guardian disables leaves the market on its own.
  const enabled = useMemo(() => (assets.data ?? []).filter((a) => a.enabled), [assets.data])
  const symbols = enabled.map((a) => a.symbol)
  // Tokens with something to buy right now, busiest first: quick tabs beside the search, and the default token.
  const active = useMemo(() => {
    const n = new Map<string, number>()
    for (const o of offers.data ?? []) if (isFillable(o)) n.set(o.symbol, (n.get(o.symbol) ?? 0) + 1)
    return [...n.entries()].filter(([s]) => symbols.includes(s)).sort((a, b) => b[1] - a[1]).map(([s]) => s)
  }, [offers.data, symbols])
  useEffect(() => {
    if (symbols.length && !symbols.includes(symbol)) setSymbol(active[0] ?? ['NVDA', 'AAPL', 'TSLA'].find((s) => symbols.includes(s)) ?? symbols[0])
  }, [symbol, symbols, active])
  const asset = (assets.data ?? []).find((a) => a.symbol === symbol)
  const quote = prices.data?.[symbol]

  const rows = useMemo(() => {
    const list = (offers.data ?? []).filter((o) => isFillable(o) && !o.overLimit && (kind === 'all' || o.kind === kind) && (!symbol || o.symbol === symbol))
    return list.sort((a, b) => {
      if (sort === 'premium') return b.premium - a.premium
      if (sort === 'yield') return b.premium / b.strike - a.premium / a.strike
      return a.expiry - b.expiry
    })
  }, [offers.data, kind, symbol, sort])

  // Every open strike for this token is a line on the chart: calls in mint, puts in cyan.
  const lines = useMemo<PriceLine[]>(
    () => rows.slice(0, 12).map((o) => ({ price: o.strike / o.amount, title: `${o.kind} ${eth(o.premium, 3)}`, color: o.kind === 'call' ? '#4dfca9' : '#05edfa' })),
    [rows],
  )

  return (
    <>
      <PageHeader title="Market" sub="Live price from Uniswap v4 and Robinhood market quotes, every option trade on the chart, and the offers you can buy now." />
      {assets.isSuccess && (assets.data?.length ?? 0) === 0 && (
        <div className="mb-6">
          <Note tone="warn">No tokens are listed in the asset registry yet. Tokens are listed through the 10 minute timelock and show up here once listed.</Note>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <TokenPicker assets={enabled} value={symbol} onChange={setSymbol} prices={prices.data} className="w-full sm:w-72" />
          {active.length > 0 && (
            <Segmented value={active.slice(0, 6).includes(symbol) ? symbol : ''} onChange={setSymbol} options={active.slice(0, 6).map((s) => ({ value: s, label: s }))} />
          )}
          <div className="flex items-baseline gap-3 font-mono text-sm">
            <span className="text-xl text-ink tabular">{quote ? `${quote.price.toPrecision(4)} ETH` : asset?.spotEth ? `${asset.spotEth.toPrecision(4)} ETH` : '…'}</span>
            {quote && <span className={quote.change1h >= 0 ? 'text-accent' : 'text-danger'}>{quote.change1h >= 0 ? '+' : ''}{(quote.change1h * 100).toFixed(2)}% 1h</span>}
            {quote && <span className="text-[10px] uppercase tracking-wider text-muted">{quote.source === 'robinhood' ? 'Robinhood quote' : quote.source === 'dexscreener' ? 'DEX price' : 'Uniswap v4'}</span>}
          </div>
          <div className="ml-auto"><Segmented value={interval} onChange={setInterval} options={INTERVALS.map((i) => ({ value: i.sec, label: i.label }))} /></div>
        </div>
        {symbol && <TokenChart symbol={symbol} interval={Number(interval)} lines={lines} height={340} className="px-2 pt-2" />}
      </div>

      <div className="mb-4 mt-8 flex flex-wrap items-center gap-3">
        <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'call', label: 'Calls' }, { value: 'put', label: 'Puts' }]} />
        <select className="input h-10 w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="expiry">Soonest expiry</option>
          <option value="premium">Highest premium</option>
          <option value="yield">Premium / strike</option>
        </select>
        <span className="ml-auto font-mono text-xs text-faint">{offers.isLoading ? 'loading…' : `${rows.length} open ${symbol} offers`}</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {['Type', 'Token', 'Amount', 'Strike / token', 'vs spot', 'Premium', 'Expires', 'Fill by', 'Seller', ''].map((h) => (
                <th key={h} className="label px-4 py-3 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const strikePer = o.strike / o.amount
              const spot = quote?.price ?? asset?.spotEth ?? 0
              const vs = spot > 0 ? (strikePer / spot - 1) * 100 : null
              return (
                <tr key={o.id.toString()} className="border-b border-line/60 last:border-0 hover:bg-card-2">
                  <td className="px-4 py-4"><KindBadge kind={o.kind} /></td>
                  <td className="px-4 py-4 font-mono font-medium">
                    <span className="inline-flex items-center gap-2"><TokenLogo symbol={o.symbol} name={asset?.name} address={o.token} size={18} />{o.symbol}</span>
                  </td>
                  <td className="px-4 py-4 tabular">{num(o.amount, 4)}</td>
                  <td className="px-4 py-4 font-mono tabular">{strikePer.toPrecision(3)} ETH</td>
                  <td className={`px-4 py-4 font-mono tabular ${vs === null ? 'text-faint' : vs >= 0 ? 'text-accent' : 'text-danger'}`}>{vs === null ? '–' : `${vs >= 0 ? '+' : ''}${vs.toFixed(0)}%`}</td>
                  <td className="px-4 py-4 font-mono tabular font-medium">{eth(o.premium)}</td>
                  <td className="px-4 py-4"><TimeLeft at={o.expiry} /></td>
                  <td className="px-4 py-4 text-muted"><TimeLeft at={o.offerDeadline} /></td>
                  <td className="px-4 py-4 font-mono text-xs text-muted">{shortAddr(o.seller)}</td>
                  <td className="px-4 py-4 text-right"><button className="btn btn-accent btn-sm" onClick={() => setBuying(o)}>Buy</button></td>
                </tr>
              )
            })}
            {rows.length === 0 && !offers.isLoading && (
              <tr><td colSpan={10} className="px-4 py-16 text-center text-muted">No open {symbol} offers. Be the first to <a href="/sell" className="text-accent hover:underline">sell one</a>.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <TradeHistory symbol={symbol} />

      {buying && <BuyDialog offer={buying} onClose={() => setBuying(null)} />}
    </>
  )
}
