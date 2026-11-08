'use client'
import { ArrowUpRight, Check, Copy } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { PillButton } from '@/components/PillButton'
import { TokenLogo } from '@/components/TokenLogo'
import { Note, PageHeader, Segmented } from '@/components/ui'
import { INDEXER_URL } from '@/lib/data'
import { compact, num, shortAddr } from '@/lib/format'

type Tab = 'graduated' | 'listed'
type PonsToken = {
  symbol: string; name: string; logo: string | null; logoFallback?: string | null; description: string | null
  pairIsWeth: boolean; legacy: boolean; launchedAt: number; pairedEth: number | null; thresholdEth: number | null; progress: number | null
  graduated: boolean; graduatedAt: number | null
  priceUsd: number | null; priceEth: number | null; mcapUsd: number | null; change24h: number | null; liquidityUsd: number | null; volume24hUsd: number | null
  kyte: 'listed' | 'disabled' | 'scheduled' | 'unlisted'; ponsUrl: string
  address: string; deployer: string; pool: string; launchTx: string; supply: number | null
  socials: Array<{ type: string; url: string }>
  links: { pons: string; deployerOnPons: string; dexscreener: string; token: string; pool: string; deployer: string; launchTx: string }
}
type Resp = { tokens: PonsToken[]; counts: { launched: number; graduated: number } }

const ago = (t: number | null) => {
  if (!t) return ''
  const s = Math.max(0, Date.now() / 1000 - t)
  return s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`
}
const when = (t: number | null) => (t ? new Date(t * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const ethp = (n: number | null) => (n == null || !Number.isFinite(n) || n === 0 ? '—' : n >= 0.001 ? `${num(n, 5)} ETH` : `${n.toPrecision(3)} ETH`)
function Logo({ t }: { t: PonsToken }) {
  const [stage, setStage] = useState(0) // 0 primary, 1 fallback gateway, 2 initials
  const src = stage === 0 ? t.logo : null // the fallback gateway is outside the CSP; initials after the proxy
  if (!src) return <TokenLogo symbol={t.symbol} name={t.name} address={t.address} size={40} />
  return <img src={src} alt="" width={40} height={40} loading="lazy" onError={() => setStage((s) => s + 1)} className="h-10 w-10 shrink-0 rounded-full border border-white/10 object-cover" />
}
function CopyAddr({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200) }).catch(() => {}) }} className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink" title={value}>
      {shortAddr(value)} {done ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}
const SOCIAL: Record<string, string> = { twitter: 'X', x: 'X', telegram: 'Telegram', discord: 'Discord', github: 'GitHub', website: 'Website' }
const usd = (n: number | null) => (n == null || !Number.isFinite(n) || n === 0 ? '—' : n >= 1000 ? `$${compact(n)}` : n >= 1 ? `$${num(n, 2)}` : `$${n.toPrecision(3)}`)

export function LaunchpadPage() {
  const [tab, setTab] = useState<Tab>('graduated')
  const [hours, setHours] = useState<'24' | '36' | '0'>('0')
  const q = useQuery({
    queryKey: ['pons', tab, hours],
    queryFn: async (): Promise<Resp> => { const r = await fetch(`${INDEXER_URL}/pons/tokens?status=${tab}&hours=${hours}&limit=200`, { cache: 'no-store' }); if (!r.ok) throw new Error(`indexer ${r.status}`); return r.json() },
    refetchInterval: 60_000,
    enabled: Boolean(INDEXER_URL),
  })
  const tokens = q.data?.tokens ?? []
  const counts = q.data?.counts

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <PageHeader title="Launchpad" sub="Tokens that graduated on Pons, the Robinhood Chain launchpad. A graduated token has crossed 4.2 ETH of locked liquidity. Listed ones trade on Kyte with 24-hour options only.">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'graduated', label: 'Graduated' }, { value: 'listed', label: 'On Kyte' }]} />
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {counts && <p className="text-sm text-muted">{counts.graduated} graduated of {counts.launched} launched. Data from the Pons factory on chain and DexScreener; refreshed every minute.</p>}
        {tab === 'graduated' && <Segmented value={hours} onChange={setHours} options={[{ value: '24', label: 'Last 24 hours' }, { value: '36', label: 'Last 36 hours' }, { value: '0', label: 'All' }]} />}
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : q.isError ? (
        <Note tone="warn">The indexer is not reachable right now. Try again in a minute.</Note>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted">{tab === 'listed' ? 'No Pons token is listed on Kyte yet.' : hours !== '0' ? `Nothing graduated in the last ${hours} hours.` : 'Nothing graduated yet.'}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tokens.map((t) => (
            <li key={t.address} className="card flex flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <Logo t={t} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {t.kyte === 'listed' ? <Link href={`/market?token=${encodeURIComponent(t.symbol)}`} className="truncate font-medium text-ink hover:underline" title="Open on the Kyte market">{t.name}</Link> : <span className="truncate font-medium text-ink">{t.name}</span>}
                    <span className="font-mono text-xs text-muted">{t.symbol}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {t.graduated ? <span>Graduated {ago(t.graduatedAt)}</span> : t.progress != null ? <span>{Math.round(t.progress * 100)}% to graduation</span> : <span>Launched {ago(t.launchedAt)}</span>}
                    {!t.pairIsWeth && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5">not ETH-paired</span>}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${t.kyte === 'listed' ? 'bg-accent/15 text-accent' : t.kyte === 'scheduled' ? 'bg-accent/10 text-accent' : t.kyte === 'disabled' ? 'bg-white/[0.06] text-muted' : 'border border-white/10 text-muted'}`}>
                  {t.kyte === 'listed' ? 'On Kyte' : t.kyte === 'disabled' ? 'Paused' : t.kyte === 'scheduled' ? 'Listing in 10 min' : 'Not listed'}
                </span>
              </div>

              {t.progress != null && !t.graduated && (
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-ink/70" style={{ width: `${Math.round(t.progress * 100)}%` }} /></div>
              )}

              {t.description && <p className="line-clamp-3 text-xs leading-relaxed text-muted" title={t.description}>{t.description}</p>}

              <dl className="grid grid-cols-3 gap-x-2 gap-y-3 text-xs">
                <div><dt className="text-muted">Price</dt><dd className="mt-0.5 font-mono text-ink">{usd(t.priceUsd)}</dd><dd className="font-mono text-[10px] text-muted">{ethp(t.priceEth)}</dd></div>
                <div><dt className="text-muted">Market cap</dt><dd className="mt-0.5 font-mono text-ink">{usd(t.mcapUsd)}</dd></div>
                <div><dt className="text-muted">24h</dt><dd className={`mt-0.5 font-mono ${t.change24h == null ? 'text-ink' : t.change24h >= 0 ? 'text-accent' : 'text-[#ff7a7a]'}`}>{t.change24h == null ? '—' : `${t.change24h >= 0 ? '+' : ''}${num(t.change24h, 1)}%`}</dd></div>
                <div><dt className="text-muted">Liquidity</dt><dd className="mt-0.5 font-mono text-ink">{usd(t.liquidityUsd)}</dd></div>
                <div><dt className="text-muted">Volume 24h</dt><dd className="mt-0.5 font-mono text-ink">{usd(t.volume24hUsd)}</dd></div>
                <div><dt className="text-muted">ETH in pool</dt><dd className="mt-0.5 font-mono text-ink">{t.pairedEth == null ? '—' : num(t.pairedEth, 2)}{t.thresholdEth ? <span className="text-muted"> / {num(t.thresholdEth, 1)}</span> : null}</dd></div>
                <div><dt className="text-muted">Supply</dt><dd className="mt-0.5 font-mono text-ink">{t.supply ? compact(t.supply) : '—'}</dd></div>
                <div><dt className="text-muted">Launched</dt><dd className="mt-0.5 text-ink">{when(t.launchedAt)}</dd></div>
                <div><dt className="text-muted">Graduated</dt><dd className="mt-0.5 text-ink">{t.graduated ? when(t.graduatedAt) : '—'}</dd></div>
              </dl>

              <dl className="grid gap-1.5 border-t border-white/[0.06] pt-3 text-xs">
                <div className="flex items-center justify-between gap-2"><dt className="text-muted">Token</dt><dd className="flex items-center gap-2"><CopyAddr value={t.address} /><a href={t.links.token} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" title="Explorer"><ArrowUpRight size={12} /></a></dd></div>
                <div className="flex items-center justify-between gap-2"><dt className="text-muted">Pool</dt><dd className="flex items-center gap-2"><CopyAddr value={t.pool} /><a href={t.links.pool} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" title="Explorer"><ArrowUpRight size={12} /></a></dd></div>
                <div className="flex items-center justify-between gap-2"><dt className="text-muted">Deployer</dt><dd className="flex items-center gap-2"><CopyAddr value={t.deployer} /><a href={t.links.deployerOnPons} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" title="Profile on Pons"><ArrowUpRight size={12} /></a></dd></div>
                <div className="flex items-center justify-between gap-2"><dt className="text-muted">Launch tx</dt><dd><a href={t.links.launchTx} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-muted hover:text-ink">{shortAddr(t.launchTx)} <ArrowUpRight size={12} /></a></dd></div>
              </dl>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <a href={t.links.pons} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-ink">Pons <ArrowUpRight size={11} /></a>
                <a href={t.links.dexscreener} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-ink">DexScreener <ArrowUpRight size={11} /></a>
                <a href={t.links.token} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-ink">Explorer <ArrowUpRight size={11} /></a>
                {t.socials.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-ink">{SOCIAL[s.type] ?? s.type} <ArrowUpRight size={11} /></a>)}
              </div>

              <div className="mt-auto flex items-center gap-2">
                {t.kyte === 'listed' ? (
                  <>
                    <PillButton href={`/sell?kind=call&token=${encodeURIComponent(t.symbol)}&expiry=86400`} tone="premium" size="sm">Sell a 24h call</PillButton>
                    <Link href={`/market?token=${encodeURIComponent(t.symbol)}`} className="btn btn-glass btn-glass-sm">Market</Link>
                  </>
                ) : (
                  <a href={t.links.pons} target="_blank" rel="noreferrer" className="btn btn-glass btn-glass-sm">Trade on Pons <ArrowUpRight size={12} /></a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10"><Note>Pons tokens are young and volatile. Kyte lists graduated, ETH-paired tokens after a review and only allows options that expire within 24 hours on them. Graduation is a liquidity threshold, not a quality signal. Options are risky and can expire worthless.</Note></div>
    </div>
  )
}
