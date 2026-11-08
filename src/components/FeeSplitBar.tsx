import { BRAND, SPLIT } from '@/lib/config'
import { bps } from '@/lib/format'

const PARTS = [
  { key: 'stakers', label: `${BRAND.token} stakers`, bps: SPLIT.stakersBps, color: 'var(--color-accent)' },
  { key: 'buyback', label: 'Buy & burn', bps: SPLIT.buybackBps, color: 'var(--color-accent-2)' },
  { key: 'ops', label: 'Operations', bps: SPLIT.opsBps, color: 'var(--color-faint)' },
]

export function FeeSplitBar() {
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {PARTS.map((p) => (
          <div key={p.key} style={{ width: `${p.bps / 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {PARTS.map((p) => (
          <div key={p.key}>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              {p.label}
            </div>
            <div className="mt-1 text-xl font-semibold tabular">{bps(p.bps)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
