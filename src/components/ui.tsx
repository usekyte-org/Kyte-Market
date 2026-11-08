'use client'

import { motion } from 'framer-motion'
import { useId } from 'react'
import type { Kind } from '@/lib/demo-data'

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pb-8 pt-12 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl tracking-tight md:text-4xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="label">{label}</div>
      <div className="mt-2 font-mono text-2xl tabular">{value}</div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </div>
  )
}

export function KindBadge({ kind }: { kind: Kind }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wider ${
        kind === 'call' ? 'bg-call/10 text-call' : 'bg-put/10 text-put'
      }`}
    >
      {kind}
    </span>
  )
}

export function Note({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        tone === 'warn' ? 'border-warn/30 bg-warn/5 text-warn' : 'border-line bg-bg-2 text-muted'
      }`}
    >
      {children}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`relative rounded-full px-3 py-1.5 text-sm transition-colors ${value === o.value ? 'text-ink' : 'text-muted hover:text-ink'}`}
        >
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-white/[0.08]" transition={{ type: 'spring', stiffness: 300, damping: 28 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
