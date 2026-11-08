'use client'

// Bento 2.0 tiles. Every tile is an isolated, memoized client component with a perpetual micro-interaction,
// so the parent layout never re-renders on their account (taste-skill §9).
import { ArrowRight, Fire, Lightning, Scales, Stack } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { memo, useEffect, useState } from 'react'
import { BRAND, LIMITS, SPLIT } from '@/lib/config'
import { isFillable, useActivity, useHealth, useOffers, useStake } from '@/lib/data'
import { bps, eth, num, timeLeft } from '@/lib/format'
import { SPRING, SPRING_SNAPPY, SpotlightCard } from '../motion/primitives'

export function Tile({ title, caption, children, className = '' }: { title: string; caption: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <SpotlightCard className="min-w-0 flex-1 p-6 md:p-8">{children}</SpotlightCard>
      {/* labels sit outside and below the surface, gallery-style */}
      <div className="px-1 pt-4">
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="mt-1 text-sm text-muted">{caption}</div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ 1. the intelligent list (live events)
export const ActivityTile = memo(function ActivityTile() {
  const feed = useActivity(6)
  const items = feed.data ?? []
  return (
    <div className="h-full">
      <div className="flex items-center justify-between">
        <span className="label">Live activity</span>
        <Breathing label="indexing" />
      </div>
      <ul className="mt-4 space-y-1.5">
        <AnimatePresence initial={false}>
          {items.map((e) => (
            <motion.li
              key={e.key}
              layout
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={SPRING}
              className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
            >
              <span className={`size-1.5 shrink-0 rounded-full ${e.kind === 'put' ? 'bg-accent-2' : e.kind === 'burn' ? 'bg-warn' : 'bg-accent'}`} />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{e.text}</span>
            </motion.li>
          ))}
        </AnimatePresence>
        {items.length === 0 && [0, 1, 2, 3].map((i) => <li key={i} className="shimmer h-9 rounded-lg" />)}
      </ul>
    </div>
  )
})

// ------------------------------------------------------------------ 2. the command input (typewriter)
const PROMPTS = ['sell call · 200,000 ZEPH @ 10 ETH · 7d · premium 0.3', 'buy put · 1,500 GALE @ 1.7 ETH', 'exercise #3 · pay 3 ETH · receive 100,000 ZEPH', 'stake 1,000,000 KYTE']

export const CommandTile = memo(function CommandTile() {
  const [i, setI] = useState(0)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'typing' | 'processing' | 'done'>('typing')
  useEffect(() => {
    const target = PROMPTS[i]
    let t: ReturnType<typeof setTimeout>
    if (phase === 'typing') {
      if (text.length < target.length) t = setTimeout(() => setText(target.slice(0, text.length + 1)), 28 + Math.random() * 40)
      else t = setTimeout(() => setPhase('processing'), 500)
    } else if (phase === 'processing') t = setTimeout(() => setPhase('done'), 1100)
    else t = setTimeout(() => { setText(''); setI((i + 1) % PROMPTS.length); setPhase('typing') }, 1600)
    return () => clearTimeout(t)
  }, [text, phase, i])
  return (
    <div className="flex h-full flex-col justify-between">
      <span className="label">One transaction</span>
      <div>
        <div className="mt-4 flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-bg/60 px-3 font-mono text-xs">
          <Lightning size={14} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate text-ink">{text}<span className="caret" /></span>
        </div>
        <div className="mt-3 h-5 font-mono text-xs">
          <AnimatePresence mode="wait">
            {phase === 'processing' && <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="shimmer-text text-muted">simulating · signing · confirming</motion.div>}
            {phase === 'done' && <motion.div key="d" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING_SNAPPY} className="text-accent">confirmed on-chain</motion.div>}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
})

// ------------------------------------------------------------------ 3. live status (epoch) with overshoot badge
export const EpochTile = memo(function EpochTile() {
  const stake = useStake()
  const health = useHealth()
  const [now, setNow] = useState(() => Date.now() / 1000)
  const [badge, setBadge] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1000)
    const b = setInterval(() => { setBadge(true); setTimeout(() => setBadge(false), 3000) }, 7000)
    return () => { clearInterval(t); clearInterval(b) }
  }, [])
  const offset = health.data ? health.data.chainTime - health.data.fetchedAt : 0
  const ends = stake.data?.epochEndsAt ?? now
  const left = Math.max(0, ends - (now + offset))
  const progress = 1 - left / LIMITS.epochSec
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = Math.floor(left % 60)
  return (
    <div className="relative flex h-full flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="label">Next fee split</span>
        <Breathing label="live" />
      </div>
      <div>
        <div className="font-mono text-3xl leading-none tabular text-ink">{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</div>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className="h-full bg-accent" style={{ transformOrigin: 'left' }} animate={{ scaleX: Math.max(0.01, progress) }} transition={{ type: 'tween', ease: 'linear', duration: 1 }} />
        </div>
        <div className="mt-3 flex justify-between text-xs text-faint"><span>epoch #{stake.data?.epoch ?? '…'}</span><span className="font-mono text-ink">{eth(stake.data?.lastEpochRewards ?? 0, 4)} last</span></div>
      </div>
      <AnimatePresence>
        {badge && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14 }}
            className="absolute right-0 top-8 rounded-full border border-accent/40 bg-bg px-2.5 py-1 font-mono text-xs text-accent"
          >
            {bps(SPLIT.stakersBps)} to stakers
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

// ------------------------------------------------------------------ 4. wide data stream (seamless carousel)
export const StreamTile = memo(function StreamTile() {
  const offers = useOffers()
  const items = (offers.data ?? []).filter((o) => isFillable(o)).slice(0, 12)
  const row = items.length ? [...items, ...items] : []
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between"><span className="label">Open offers</span><Link href="/market" className="link inline-flex items-center gap-1 text-xs">Market <ArrowRight size={12} /></Link></div>
      <div className="relative mt-5 w-full min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        {row.length > 0 ? (
          <motion.div className="flex w-max gap-3" animate={{ x: ['0%', '-50%'] }} transition={{ repeat: Infinity, ease: 'linear', duration: Math.max(20, row.length * 3) }}>
            {row.map((o, i) => (
              <div key={`${o.id}-${i}`} className="w-52 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-xs uppercase tracking-wider ${o.kind === 'call' ? 'text-accent' : 'text-accent-2'}`}>{o.kind}</span>
                  <span className="font-mono text-xs text-faint">{timeLeft(o.expiry)}</span>
                </div>
                <div className="mt-2 text-sm font-medium">{num(o.amount, 4)} {o.symbol}</div>
                <div className="mt-1 flex justify-between font-mono text-xs text-muted"><span>strike {eth(o.strike, 3)}</span><span className="text-ink">{eth(o.premium)}</span></div>
              </div>
            ))}
          </motion.div>
        ) : (
          <div className="flex gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-24 w-52 rounded-xl" />)}</div>
        )}
      </div>
    </div>
  )
})

// ------------------------------------------------------------------ 5. fee split with animated bars
export const FeesTile = memo(function FeesTile() {
  const rows = [
    { icon: Stack, label: `${BRAND.token} stakers`, v: SPLIT.stakersBps },
    { icon: Fire, label: 'Buy & burn on Uniswap v4', v: SPLIT.buybackBps },
    { icon: Scales, label: 'Operations', v: SPLIT.opsBps },
  ]
  return (
    <div className="flex h-full flex-col">
      <span className="label">Where every fee goes</span>
      <div className="mt-5 space-y-4">
        {rows.map((r, i) => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-ink"><r.icon size={14} className="text-muted" />{r.label}</span>
              <span className="font-mono tabular text-muted">{bps(r.v)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-accent"
                style={{ transformOrigin: 'left' }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: r.v / 10_000 }}
                viewport={{ once: true }}
                transition={{ ...SPRING, delay: i * 0.12 }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-auto pt-5 text-xs text-faint">Enforced by FeeVault. Changing it takes a 10 minute timelock and can never drop stakers below 20%.</p>
    </div>
  )
})

function Breathing({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 font-mono text-xs text-accent">
      <motion.span className="size-1.5 rounded-full bg-accent" animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }} />
      {label}
    </span>
  )
}
