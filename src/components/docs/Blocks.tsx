import { Info, Warning, Lightning } from '@phosphor-icons/react/dist/ssr'
import type { ReactNode } from 'react'

/** Section heading with an anchor link that appears on hover, like Vercel's docs. */
export function H2({ id, children, eyebrow }: { id: string; children: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-5 scroll-mt-28" id={id}>
      {eyebrow && <div className="label mb-2">{eyebrow}</div>}
      <h2 className="group flex items-center gap-2 text-2xl font-medium tracking-tight text-ink">
        {children}
        <a href={`#${id}`} aria-label="Link to this section" className="text-faint opacity-0 transition-opacity group-hover:opacity-100">#</a>
      </h2>
    </div>
  )
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-8 text-base font-medium text-ink">{children}</h3>
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-7 text-muted [&_code]:rounded [&_code]:border [&_code]:border-line [&_code]:bg-bg-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-ink [&_strong]:font-medium [&_strong]:text-ink">{children}</p>
}

const TONES = {
  info: { ring: 'border-line bg-card', icon: <Info size={16} className="text-accent-2" />, title: 'text-ink' },
  warn: { ring: 'border-warn/30 bg-warn/[0.04]', icon: <Warning size={16} className="text-warn" />, title: 'text-warn' },
  tip: { ring: 'border-accent/30 bg-accent/[0.04]', icon: <Lightning size={16} className="text-accent" />, title: 'text-accent' },
}

/** Callout box: Good to know / Warning / Tip. */
export function Callout({ tone = 'info', title, children }: { tone?: keyof typeof TONES; title: string; children: ReactNode }) {
  const t = TONES[tone]
  return (
    <div className={`my-6 flex gap-3 rounded-xl border px-4 py-3.5 ${t.ring}`}>
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="min-w-0">
        <div className={`text-sm font-medium ${t.title}`}>{title}</div>
        <div className="mt-1 text-sm leading-6 text-muted [&_code]:rounded [&_code]:bg-bg-2 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-ink [&_strong]:text-ink">{children}</div>
      </div>
    </div>
  )
}

/** Numbered flow, one step per row. */
export function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="my-6 space-y-0 border-l border-line">
      {items.map((s, i) => (
        <li key={s.title} className="relative pb-7 pl-8 last:pb-0">
          <span className="absolute -left-[13px] top-0 flex size-6 items-center justify-center rounded-full border border-line bg-bg font-mono text-[11px] text-muted">{i + 1}</span>
          <div className="text-sm font-medium text-ink">{s.title}</div>
          <div className="mt-1 text-sm leading-6 text-muted [&_code]:rounded [&_code]:bg-bg-2 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-ink [&_strong]:text-ink">{s.body}</div>
        </li>
      ))}
    </ol>
  )
}

/** Key / value table with a hairline grid. */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-bg-2">
          <tr>{head.map((h) => <th key={h} className="label px-4 py-2.5 font-normal normal-case tracking-normal first:pl-4">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => <td key={j} className={`px-4 py-3 ${j === 0 ? 'whitespace-nowrap font-medium text-ink' : 'text-muted'} [&_code]:rounded [&_code]:bg-bg-2 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-ink`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Small feature card, used in 2–3 column grids. */
export function Tile({ title, children, badge }: { title: string; children: ReactNode; badge?: string }) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-ink">{title}</div>
        {badge && <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted">{badge}</span>}
      </div>
      <div className="mt-2 text-sm leading-6 text-muted [&_code]:rounded [&_code]:bg-bg-2 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-ink [&_strong]:text-ink">{children}</div>
    </div>
  )
}

/** Big number with a label, for the fee split. */
export function Figure({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="font-mono text-3xl tracking-tight text-ink">{value}</div>
      <div className="mt-1 text-sm font-medium text-ink">{label}</div>
      {sub && <div className="mt-1 text-[13px] leading-5 text-muted">{sub}</div>}
    </div>
  )
}
