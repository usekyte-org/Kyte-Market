'use client'

import { ArrowUpRight, Check, Coins, Copy, Fire, SealCheck, Users, Vault } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { CountUp } from '@/components/CountUp'
import { Item, Stagger } from '@/components/motion/primitives'
import { Segmented } from '@/components/ui'
import { chain, contracts, explorerAddress, explorerTx } from '@/lib/chains'
import { BRAND, SPLIT } from '@/lib/config'
import { useHealth, useProof, type Burn, type Split } from '@/lib/data'
import { compact, date, eth, num, shortAddr } from '@/lib/format'

const EASE = [0.22, 1, 0.36, 1] as const
const BUCKETS = [
  { key: 'stakers', label: `${BRAND.token} stakers`, rule: SPLIT.stakersBps, color: 'var(--color-accent)', Icon: Users, note: 'Paid in WETH to everyone staking' },
  { key: 'buyback', label: 'Buy & burn', rule: SPLIT.buybackBps, color: 'var(--color-accent-2)', Icon: Fire, note: `Swapped to ${BRAND.token} on Uniswap v4 and burned` },
  { key: 'ops', label: 'Operations', rule: SPLIT.opsBps, color: '#8a8a8a', Icon: Vault, note: 'To the ops Safe (multisig)' },
] as const

type Entry = { kind: 'split'; at: number; tx: string; s: Split } | { kind: 'burn'; at: number; tx: string; b: Burn }

export default function ProofPage() {
  const proof = useProof()
  const health = useHealth()
  const splits = useMemo(() => proof.data?.splits ?? [], [proof.data])
  const burns = useMemo(() => proof.data?.burns ?? [], [proof.data])
  const totals = useMemo(() => {
    const t = { stakers: 0, buyback: 0, ops: 0 }
    for (const s of splits) { t.stakers += s.stakers; t.buyback += s.buyback; t.ops += s.ops }
    return { ...t, all: t.stakers + t.buyback + t.ops, wethBurned: burns.reduce((a, b) => a + b.wethIn, 0) }
  }, [splits, burns])
  const burned = proof.data?.totalBurned ?? 0
  // isPending, not isLoading: the server never fetches, so isLoading would differ between server and client HTML.
  const loading = proof.isPending

  return (
    <div className="pb-10">
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden pb-10 pt-14">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[46rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl" style={{ background: 'radial-gradient(closest-side, var(--color-accent), transparent)' }} />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/[0.06] px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-accent">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
            </span>
            Verified on-chain{health.data?.lastBlock ? ` · block ${health.data.lastBlock.toLocaleString('en-US')}` : ''}
          </div>
          <h1 className="hero-heading mt-5 max-w-3xl text-4xl leading-[1.05] tracking-tight md:text-6xl">Every fee. Every burn. On the record.</h1>
          <p className="mt-4 max-w-2xl text-muted">
            This page is built only from <code className="font-mono text-ink">FeesSplit</code> and <code className="font-mono text-ink">Burned</code> events.
            No spreadsheet, no team wallet, nothing typed in by hand. Click any row to see the transaction yourself.
          </p>
        </motion.div>

        <Stagger className="relative mt-10 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
          <Item>
            <div className="card relative h-full overflow-hidden p-6">
              <div className="label flex items-center gap-2"><Coins size={14} /> Fees distributed</div>
              <div className="mt-3 font-mono text-4xl tracking-tight md:text-5xl">
                {loading ? <Skeleton w="10rem" h="3rem" /> : <CountUp value={totals.all} format={(n) => eth(n, 4)} />}
              </div>
              <div className="mt-2 text-sm text-faint">across {splits.length} epoch{splits.length === 1 ? '' : 's'}, split by the FeeVault contract</div>
              <div className="mt-5 flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                {BUCKETS.map((b) => (
                  <motion.div key={b.key} initial={{ width: 0 }} animate={{ width: `${totals.all ? (totals[b.key] / totals.all) * 100 : b.rule / 100}%` }} transition={{ duration: 1.1, ease: EASE }} style={{ background: b.color }} />
                ))}
              </div>
            </div>
          </Item>
          <Item>
            <div className="card h-full p-6">
              <div className="label flex items-center gap-2"><Fire size={14} /> {BRAND.token} burned</div>
              <div className="mt-3 font-mono text-3xl tracking-tight">{loading ? <Skeleton w="7rem" h="2.25rem" /> : <CountUp value={burned} format={(n) => compact(n)} />}</div>
              <div className="mt-2 text-sm text-faint">{eth(totals.wethBurned, 4)} spent in {burns.length} buyback{burns.length === 1 ? '' : 's'}</div>
            </div>
          </Item>
          <Item>
            <div className="card h-full p-6">
              <div className="label flex items-center gap-2"><Users size={14} /> Paid to stakers</div>
              <div className="mt-3 font-mono text-3xl tracking-tight">{loading ? <Skeleton w="7rem" h="2.25rem" /> : <CountUp value={totals.stakers} format={(n) => eth(n, 4)} />}</div>
              <div className="mt-2 text-sm text-faint">claimable in WETH from the StakingPool</div>
            </div>
          </Item>
        </Stagger>
      </section>

      {/* ---------------------------------------------------------------- where fees go */}
      <section className="mt-4">
        <SectionTitle kicker="Where fees go" title="The rule, and what actually happened" />
        <Stagger className="grid gap-3 md:grid-cols-3">
          {BUCKETS.map((b) => {
            const actual = totals.all ? (totals[b.key] / totals.all) * 10_000 : 0
            return (
              <Item key={b.key}>
                <div className="card group relative h-full overflow-hidden p-6 transition-colors hover:border-line-strong">
                  <div aria-hidden className="absolute inset-x-0 top-0 h-px opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${b.color}, transparent)` }} />
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${b.color} 14%, transparent)`, color: b.color }}><b.Icon size={18} weight="fill" /></span>
                    <span className="font-mono text-xs text-faint">rule {b.rule / 100}%</span>
                  </div>
                  <div className="mt-5 text-sm text-muted">{b.label}</div>
                  <div className="mt-1 font-mono text-2xl">{loading ? <Skeleton w="6rem" h="2rem" /> : <CountUp value={totals[b.key]} format={(n) => eth(n, 4)} />}</div>
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div className="h-full rounded-full" initial={{ width: 0 }} whileInView={{ width: `${(totals.all ? actual : b.rule) / 100}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }} style={{ background: b.color }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-faint">
                    <span>{b.note}</span>
                    {totals.all > 0 && <span className="text-muted">{(actual / 100).toFixed(1)}%</span>}
                  </div>
                </div>
              </Item>
            )
          })}
        </Stagger>
      </section>

      {/* ---------------------------------------------------------------- burn curve */}
      <section className="mt-14">
        <SectionTitle kicker="Supply" title={`${BRAND.token} burned over time`} />
        <div className="card p-6">
          <BurnCurve burns={burns} loading={loading} />
        </div>
      </section>

      {/* ---------------------------------------------------------------- ledger */}
      <section className="mt-14">
        <Ledger splits={splits} burns={burns} loading={loading} />
      </section>

      {/* ---------------------------------------------------------------- verify */}
      <section className="mt-14">
        <SectionTitle kicker="Don't trust, verify" title="Check it against the chain yourself" />
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="card divide-y divide-line">
            {([['FeeVault', contracts.feeVault, 'Receives every fee, splits once per epoch'], ['BuybackBurner', contracts.buybackBurner, 'Swaps its share and burns it'], ['StakingPool', contracts.stakingPool, 'Holds the stakers’ WETH'], [`${BRAND.token} token`, contracts.kyteToken, 'The burned supply']] as const).map(([name, addr, what]) => (
              <div key={name} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm">{name}</div>
                  <div className="truncate text-xs text-faint">{what}</div>
                </div>
                {addr ? <AddressPill address={addr} /> : <span className="font-mono text-xs text-faint">not deployed</span>}
              </div>
            ))}
          </div>
          <div className="card flex flex-col p-6">
            <div className="label">With Foundry&apos;s cast</div>
            <p className="mt-2 text-sm text-muted">Every split this page shows, straight from the node. No indexer, no website in between.</p>
            <CopyBlock text={`cast logs --rpc-url ${chain.rpcUrls.default.http[0]} \\\n  --address ${contracts.feeVault ?? '<FeeVault>'} \\\n  "FeesSplit(uint64 indexed,uint256,uint256,uint256)"`} />
            <CopyBlock text={`cast logs --rpc-url ${chain.rpcUrls.default.http[0]} \\\n  --address ${contracts.buybackBurner ?? '<BuybackBurner>'} \\\n  "Burned(uint256,uint256)"`} />
          </div>
        </div>
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ pieces

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-5">
      <div className="font-mono text-[11px] uppercase tracking-wider text-accent">{kicker}</div>
      <h2 className="mt-1 text-2xl tracking-tight md:text-3xl">{title}</h2>
    </div>
  )
}

function Skeleton({ w, h }: { w: string; h: string }) {
  return <span className="shimmer inline-block rounded-md align-middle" style={{ width: w, height: h }} />
}

/** Cumulative burned supply as a step-area curve. Plain SVG: no chart library needed for one line. */
function BurnCurve({ burns, loading }: { burns: Burn[]; loading: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const pts = useMemo(() => {
    const asc = [...burns].sort((a, b) => a.at - b.at)
    let sum = 0
    return asc.map((b) => ({ at: b.at, total: (sum += b.tokenOut), b }))
  }, [burns])
  if (loading) return <div className="shimmer h-52 rounded-lg" />
  if (pts.length === 0) return <div className="flex h-52 items-center justify-center text-sm text-muted">No burn yet. The first buyback draws the curve.</div>

  const W = 1000, H = 220, P = 8
  const t0 = pts[0].at, t1 = pts.at(-1)!.at === t0 ? t0 + 1 : pts.at(-1)!.at
  const max = pts.at(-1)!.total || 1
  const x = (t: number) => P + ((t - t0) / (t1 - t0)) * (W - 2 * P)
  const y = (v: number) => H - P - (v / max) * (H - 2 * P)
  let d = `M ${x(t0)} ${y(0)}`
  for (const p of pts) d += ` H ${x(p.at)} V ${y(p.total)}`
  d += ` H ${W - P}`
  const area = `${d} V ${H - P} H ${P} Z`
  const h = hover != null ? pts[hover] : pts.at(-1)!

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="font-mono text-2xl">{num(h.total, 0)} <span className="text-base text-muted">{BRAND.token}</span></div>
          <div className="font-mono text-xs text-faint">{hover != null ? `after the burn on ${date(h.at)}` : 'burned to date'}</div>
        </div>
        <a href={explorerTx(h.b.tx)} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:underline">{explorerTx(h.b.tx) ? 'view tx ↗' : `${h.b.tx.slice(0, 10)}…`}</a>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="burnfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent-2)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-accent-2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={P} x2={W - P} y1={y(max * g)} y2={y(max * g)} stroke="#1f1f1f" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <motion.path d={area} fill="url(#burnfill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
        <motion.path d={d} fill="none" stroke="var(--color-accent-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: EASE }} />
        {pts.map((p, i) => (
          <g key={p.b.tx + i} onMouseEnter={() => setHover(i)}>
            <rect x={x(p.at) - 12} y={0} width={24} height={H} fill="transparent" />
            <circle cx={x(p.at)} cy={y(p.total)} r={hover === i ? 5 : 3} fill={hover === i ? 'var(--color-accent-2)' : '#000'} stroke="var(--color-accent-2)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-faint"><span>{date(t0)}</span><span>{date(pts.at(-1)!.at)}</span></div>
    </div>
  )
}

function Ledger({ splits, burns, loading }: { splits: Split[]; burns: Burn[]; loading: boolean }) {
  const [filter, setFilter] = useState<'all' | 'split' | 'burn'>('all')
  const [limit, setLimit] = useState(12)
  const entries = useMemo<Entry[]>(() => {
    const all: Entry[] = [
      ...splits.map((s) => ({ kind: 'split' as const, at: s.at, tx: s.tx, s })),
      ...burns.map((b) => ({ kind: 'burn' as const, at: b.at, tx: b.tx, b })),
    ]
    return all.filter((e) => filter === 'all' || e.kind === filter).sort((a, b) => b.at - a.at)
  }, [splits, burns, filter])

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-accent">Ledger</div>
          <h2 className="mt-1 text-2xl tracking-tight md:text-3xl">Every event, newest first</h2>
        </div>
        <Segmented value={filter} onChange={(v) => { setFilter(v); setLimit(12) }} options={[{ value: 'all', label: `All ${splits.length + burns.length}` }, { value: 'split', label: `Splits ${splits.length}` }, { value: 'burn', label: `Burns ${burns.length}` }]} />
      </div>
      <div className="card overflow-hidden">
        {loading && <div className="space-y-px">{Array.from({ length: 4 }, (_, i) => <div key={i} className="shimmer h-16" />)}</div>}
        {!loading && entries.length === 0 && <div className="px-6 py-14 text-center text-sm text-muted">Nothing yet. The keeper splits fees once per epoch as soon as the first fee arrives.</div>}
        <ul>
          <AnimatePresence initial={false}>
            {entries.slice(0, limit).map((e) => (
              <motion.li key={`${e.kind}-${e.tx}`} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="border-b border-line/70 last:border-0">
                <a href={explorerTx(e.tx)} target="_blank" rel="noreferrer" className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.025] md:grid-cols-[auto_1.2fr_2fr_auto]">
                  <span className={`flex size-9 items-center justify-center rounded-full ${e.kind === 'burn' ? 'bg-accent-2/10 text-accent-2' : 'bg-accent/10 text-accent'}`}>
                    {e.kind === 'burn' ? <Fire size={16} weight="fill" /> : <Coins size={16} weight="fill" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm">{e.kind === 'burn' ? `${num(e.b.tokenOut, 0)} ${BRAND.token} burned` : `Epoch #${e.s.epoch} split`}</div>
                    <div className="font-mono text-[11px] text-faint">{date(e.at)}</div>
                  </div>
                  <div className="hidden min-w-0 md:block">
                    {e.kind === 'split' ? (
                      <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs">
                        <span><span className="text-accent">●</span> {eth(e.s.stakers, 4)}</span>
                        <span><span className="text-accent-2">●</span> {eth(e.s.buyback, 4)}</span>
                        <span><span className="text-faint">●</span> {eth(e.s.ops, 4)}</span>
                      </div>
                    ) : (
                      <div className="font-mono text-xs text-muted">{eth(e.b.wethIn, 4)} in · {num(e.b.tokenOut / Math.max(e.b.wethIn, 1e-18), 0)} {BRAND.token}/ETH via Uniswap v4</div>
                    )}
                  </div>
                  <span className="flex items-center gap-1 font-mono text-xs text-faint transition-colors group-hover:text-accent">
                    <span className="hidden sm:inline">{e.tx.slice(0, 8)}…</span>
                    <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </a>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {entries.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + 24)} className="w-full border-t border-line py-3 font-mono text-xs text-muted transition-colors hover:bg-white/[0.025] hover:text-ink">
            Show more ({entries.length - limit} left)
          </button>
        )}
      </div>
    </>
  )
}

function AddressPill({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const url = explorerAddress(address)
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-white/[0.02] py-1 pl-3 pr-1 font-mono text-xs">
      {url ? <a href={url} target="_blank" rel="noreferrer" className="hover:text-accent">{shortAddr(address)}</a> : shortAddr(address)}
      <button type="button" aria-label="Copy address" onClick={() => { navigator.clipboard?.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1200) }} className="flex size-6 items-center justify-center rounded-full text-faint hover:bg-white/[0.06] hover:text-ink">
        {copied ? <Check size={12} className="text-accent" /> : <Copy size={12} />}
      </button>
    </span>
  )
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative mt-4 rounded-xl border border-line bg-black/60">
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-[11px] leading-relaxed text-muted">{text}</pre>
      <button type="button" aria-label="Copy command" onClick={() => { navigator.clipboard?.writeText(text.replace(/\\\n\s*/g, '')); setCopied(true); setTimeout(() => setCopied(false), 1200) }} className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-faint hover:bg-white/[0.06] hover:text-ink">
        {copied ? <SealCheck size={14} className="text-accent" /> : <Copy size={14} />}
      </button>
    </div>
  )
}
