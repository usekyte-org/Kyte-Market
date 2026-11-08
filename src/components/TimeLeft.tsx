'use client'

import { useEffect, useState } from 'react'
import { timeLeft } from '@/lib/format'

/** Renders after mount so server and client never disagree about "now". */
export function TimeLeft({ at }: { at: number }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now() / 1000)
    const t = setInterval(() => setNow(Date.now() / 1000), 30_000)
    return () => clearInterval(t)
  }, [])
  if (now === null) return <span className="text-faint">…</span>
  return <span className="tabular">{timeLeft(at, now)}</span>
}
