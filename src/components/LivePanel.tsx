'use client'

import { useEffect, useState } from 'react'
import { LIMITS } from '@/lib/config'
import { useHealth, useStake } from '@/lib/data'
import { eth } from '@/lib/format'
import { CountUp } from './CountUp'

function hms(s: number) {
  s = Math.max(0, Math.floor(s))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** Epoch progress (time to the next fee split) and the chain pulse, both ticking every second. */
export function LivePanel() {
  const stake = useStake()
  const health = useHealth()
  const [now, setNow] = useState(() => Date.now() / 1000)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1000)
    return () => clearInterval(t)
  }, [])

  // The contracts use block.timestamp. Anchor the countdown to chain time (matters on a fast-forwarded devnet).
  const chainOffset = health.data ? health.data.chainTime - health.data.fetchedAt : 0
  const chainNow = now + chainOffset
  const ends = stake.data?.epochEndsAt ?? chainNow
  const start = ends - LIMITS.epochSec
  const progress = Math.min(1, Math.max(0, (chainNow - start) / LIMITS.epochSec))
  const sinceBlock = health.data ? Math.max(0, now - health.data.fetchedAt + (health.data.fetchedAt - health.data.chainTime)) : null

  return (
    <div className="space-y-3">
      <div className="card glow p-5">
        <div className="flex items-baseline justify-between">
          <div className="label">// next fee split</div>
          <span className="font-mono text-xs text-faint">epoch #{stake.data?.epoch ?? '…'}</span>
        </div>
        <div className="mt-3 font-mono text-4xl font-semibold tabular text-ink">{hms(ends - chainNow)}</div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mt-3 flex justify-between text-xs text-faint">
          <span>last split to stakers</span>
          <span className="font-mono text-ink"><CountUp value={stake.data?.lastEpochRewards ?? 0} format={(n) => eth(n, 4)} /></span>
        </div>
      </div>

      <div className="card p-5">
        <div className="label">// chain pulse</div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="font-mono text-2xl font-semibold tabular">#{health.data?.lastBlock ?? '…'}</div>
            <div className="text-xs text-faint">latest indexed block</div>
          </div>
          <div className="text-right">
            <div className={`font-mono text-2xl font-semibold tabular ${sinceBlock !== null && sinceBlock < 15 ? 'text-accent' : ''}`}>{sinceBlock === null ? '…' : `${Math.floor(sinceBlock)}s`}</div>
            <div className="text-xs text-faint">since last block</div>
          </div>
        </div>
      </div>
    </div>
  )
}
