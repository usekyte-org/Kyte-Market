'use client'

import { useEffect, useRef, useState } from 'react'
import { explorerTx } from '@/lib/chains'
import { useActivity, type Activity } from '@/lib/data'

const DOT: Record<string, string> = { call: 'bg-call', put: 'bg-put', fee: 'bg-warn', burn: 'bg-accent-2', stake: 'bg-ink' }

function ago(at: number, now: number) {
  const s = Math.max(0, Math.floor(now - at))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** Live on-chain events. New rows slide in; times tick every second. */
export function ActivityFeed({ limit = 8 }: { limit?: number }) {
  const feed = useActivity(limit)
  const [now, setNow] = useState(() => Date.now() / 1000)
  const seen = useRef<Set<string>>(new Set())
  const [fresh, setFresh] = useState<Set<string>>(new Set())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const items = feed.data ?? []
    if (seen.current.size === 0) {
      items.forEach((e) => seen.current.add(e.key))
      return
    }
    const added = items.filter((e) => !seen.current.has(e.key)).map((e) => e.key)
    if (added.length) {
      added.forEach((k) => seen.current.add(k))
      setFresh(new Set(added))
      const t = setTimeout(() => setFresh(new Set()), 2500)
      return () => clearTimeout(t)
    }
  }, [feed.data])

  const items: Activity[] = feed.data ?? []
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="label">// live activity</div>
        <span className="flex items-center gap-2 font-mono text-xs text-accent">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-accent" /></span>
          live
        </span>
      </div>
      <ul className="divide-y divide-line/70">
        {items.map((e) => {
          const url = explorerTx(e.tx)
          return (
            <li key={e.key} className={`flex items-center gap-3 px-5 py-3 text-sm ${fresh.has(e.key) ? 'slide-in bg-accent-soft' : ''}`}>
              <span className={`size-1.5 shrink-0 rounded-full ${DOT[e.kind] ?? 'bg-faint'}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-ink">{e.text}</div>
                {e.sub && <div className="truncate text-xs text-faint">{e.sub}</div>}
              </div>
              <span className="shrink-0 font-mono text-xs text-faint">{ago(e.at, now)}</span>
              {url && <a href={url} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-xs text-accent hover:underline">tx ↗</a>}
            </li>
          )
        })}
        {items.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted">{feed.isLoading ? 'Loading…' : 'No activity yet.'}</li>}
      </ul>
    </div>
  )
}
