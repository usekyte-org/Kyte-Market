'use client'

import { X } from '@phosphor-icons/react'
import { useAccount } from 'wagmi'
import { contracts, contractsLive, marketsFor } from '@/lib/chains'
import { FEES } from '@/lib/config'
import { useLive, type Offer } from '@/lib/data'
import { date, eth, num } from '@/lib/format'
import { ABIS } from '@/lib/generated/abis'
import { useTx } from '@/lib/tx'
import { TokenChart } from './TokenChart'
import { TxStatus } from './TxStatus'
import { KindBadge, Note } from './ui'

export function BuyDialog({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const { isConnected } = useAccount()
  const live = useLive()
  const tx = useTx()
  const fee = (offer.premium * FEES.premiumBps) / 10_000
  const breakEvenPer = offer.kind === 'call' ? (offer.strike + offer.premium) / offer.amount : (offer.strike - offer.premium) / offer.amount

  const buy = async () => {
    const router = marketsFor(offer.id).router
    const ok = await tx.run([
      {
        label: `Buy ${offer.kind} for ${eth(offer.premium)}`,
        address: router,
        abi: ABIS.Router,
        functionName: offer.kind === 'call' ? 'buyWithETH' : 'buyPutWithETH',
        args: [offer.id, offer.premiumRaw],
        value: offer.premiumRaw,
      },
    ])
    if (ok) setTimeout(onClose, 1200)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KindBadge kind={offer.kind} />
            <span className="font-mono font-semibold">{num(offer.amount, 4)} {offer.symbol}</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-line">
          <TokenChart
            symbol={offer.symbol}
            interval={300}
            height={170}
            showMarkers={false}
            lines={[
              { price: offer.strike / offer.amount, title: 'strike', color: offer.kind === 'call' ? '#4dfca9' : '#05edfa' },
              { price: breakEvenPer, title: 'break even', color: '#9b9b9b' },
            ]}
          />
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <Row k="You pay now (ETH)" v={eth(offer.premium)} strong />
          <Row k="Of which protocol fee" v={eth(fee, 6)} />
          <Row k={offer.kind === 'call' ? 'To exercise you pay' : 'On exercise you receive'} v={eth(offer.strike)} />
          <Row k={offer.kind === 'call' ? 'On exercise you receive' : 'To exercise you deliver'} v={`${num(offer.amount, 4)} ${offer.symbol}`} />
          <Row k="Break-even per token" v={`${breakEvenPer.toPrecision(3)} ETH`} />
          <Row k="Expires" v={date(offer.expiry)} />
          <Row k="Fill by" v={date(offer.offerDeadline)} />
        </dl>

        <div className="mt-6 space-y-3">
          <Note tone="warn">Exercise well before expiry. A transaction that lands after expiry fails.</Note>
          <button className="btn btn-accent w-full" disabled={!isConnected || !contractsLive || !live || tx.busy} onClick={buy}>
            {!isConnected ? 'Connect a wallet to buy' : !live ? 'Demo mode' : tx.busy ? 'Working…' : `Buy for ${eth(offer.premium)}`}
          </button>
        </div>
      </div>
      <TxStatus state={tx.state} onClose={tx.reset} />
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className={`tabular font-mono ${strong ? 'font-semibold text-accent' : ''}`}>{v}</dd>
    </div>
  )
}
