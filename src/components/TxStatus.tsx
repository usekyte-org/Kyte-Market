'use client'

import { Check, X } from '@phosphor-icons/react'
import { explorerTx } from '@/lib/chains'
import type { TxState } from '@/lib/tx'

const LABEL: Record<string, string> = {
  simulating: 'Checking…',
  signing: 'Confirm in your wallet',
  pending: 'Waiting for confirmation…',
  success: 'Confirmed',
  error: 'Failed',
}

/** Bottom-right transaction card. Pass the state from `useTx()`. */
export function TxStatus({ state, onClose }: { state: TxState; onClose: () => void }) {
  if (state.status === 'idle') return null
  const url = 'hash' in state && state.hash ? explorerTx(state.hash) : undefined
  const tone = state.status === 'error' ? 'border-danger/40' : state.status === 'success' ? 'border-accent/50' : 'border-line-strong'
  return (
    <div className={`card fixed bottom-5 right-5 z-50 w-80 border p-4 shadow-xl ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label">{state.label}</div>
          <div className="mt-1 flex items-center gap-2 font-mono text-sm">
            {(state.status === 'simulating' || state.status === 'signing' || state.status === 'pending') && (
              <span className="inline-block size-2 animate-pulse rounded-full bg-accent" />
            )}
            {state.status === 'success' && <Check size={14} weight="bold" className="text-accent" />}
            {state.status === 'error' && <X size={14} weight="bold" className="text-danger" />}
            {LABEL[state.status]}
          </div>
          {state.status === 'error' && <p className="mt-2 text-xs text-danger">{state.message}</p>}
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-accent hover:underline">View transaction ↗</a>
          )}
        </div>
        <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close"><X size={16} /></button>
      </div>
    </div>
  )
}
