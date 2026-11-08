'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAccount, usePublicClient } from 'wagmi'
import { AddToWallet } from '@/components/AddToWallet'
import { TimeLeft } from '@/components/TimeLeft'
import { TxStatus } from '@/components/TxStatus'
import { KindBadge, Note, PageHeader, Segmented } from '@/components/ui'
import { contracts, marketsFor } from '@/lib/chains'
import { useBalances, useLive, usePositions, type Offer } from '@/lib/data'
import { eth, num } from '@/lib/format'
import { ABIS } from '@/lib/generated/abis'
import { approvalIfNeeded, useTx } from '@/lib/tx'

type Tab = 'holding' | 'selling' | 'history'

export default function PositionsPage() {
  const { address, isConnected } = useAccount()
  const client = usePublicClient()
  const live = useLive()
  const [tab, setTab] = useState<Tab>('holding')
  const pos = usePositions()
  // /positions?exercise=<id> (from the agent): show the holding tab with that position highlighted
  const params = useSearchParams()
  const cancelId = params.get('cancel')
  const focusId = params.get('exercise') ?? cancelId
  useEffect(() => { if (focusId) setTab(cancelId ? 'selling' : 'holding') }, [focusId, cancelId])
  useEffect(() => { if (focusId) document.getElementById(`pos-${focusId}`)?.scrollIntoView({ block: 'center' }) }, [focusId, pos.holding.length, pos.selling.length])
  const balances = useBalances()
  const tx = useTx()
  const rows = tab === 'holding' ? pos.holding : tab === 'selling' ? pos.selling : pos.history
  const now = Date.now() / 1000

  // Positions settle in the market set that holds them (v1, v2, v3): marketsFor reads the id's version tag.
  const market = (o: Offer) => (o.kind === 'call' ? { address: marketsFor(o.id).callMarket, abi: ABIS.CallMarket } : { address: marketsFor(o.id).putMarket, abi: ABIS.PutMarket })

  const exercise = async (o: Offer) => {
    if (o.kind === 'call') {
      await tx.run([{ label: `Exercise: pay ${eth(o.strike)} for ${num(o.amount, 4)} ${o.symbol}`, address: marketsFor(o.id).router, abi: ABIS.Router, functionName: 'exerciseWithETH', args: [o.id], value: o.strikeRaw }])
    } else if (client && address) {
      await tx.run([
        ...(await approvalIfNeeded(client, address, o.token, marketsFor(o.id).putMarket, o.amountRaw, `Approve ${o.symbol}`)),
        { label: `Exercise: deliver ${num(o.amount, 4)} ${o.symbol} for ${eth(o.strike)}`, address: marketsFor(o.id).putMarket, abi: ABIS.PutMarket, functionName: 'exercisePut', args: [o.id] },
      ])
    }
  }
  const cancel = (o: Offer) => tx.run([{ label: 'Cancel offer and reclaim collateral', ...market(o), functionName: 'cancelUnfilled', args: [o.id] }])
  const expire = (o: Offer) => tx.run([{ label: 'Expire and reclaim collateral', ...market(o), functionName: 'expire', args: [o.id] }])
  const unwrap = async () => {
    // Withdraw the exact on-chain balance in wei: rounding the displayed float can ask for more than the wallet
    // holds, and WETH then reverts with "burn amount exceeds balance".
    if (!client || !address) return
    const wei = await client.readContract({ address: contracts.weth!, abi: ABIS.ERC20, functionName: 'balanceOf', args: [address] })
    if (wei === 0n) return
    return tx.run([{ label: `Unwrap ${eth(balances.data?.weth ?? 0)} WETH to ETH`, address: contracts.weth!, abi: ABIS.WETH, functionName: 'withdraw', args: [wei] }])
  }

  return (
    <>
      <PageHeader title="Positions" sub="Options you hold and offers you've written. A bought option is an NFT in your wallet; wallets don't list Robinhood Chain NFTs on their own yet, so use “Add to wallet” to see it there.">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'holding', label: `Holding (${pos.holding.length})` }, { value: 'selling', label: `Selling (${pos.selling.length})` }, { value: 'history', label: 'History' }]} />
      </PageHeader>

      {!isConnected ? (
        <div className="card p-16 text-center text-muted">Connect a wallet to see your positions.</div>
      ) : (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex flex-wrap gap-8">
              <div><div className="label">ETH</div><div className="mt-1 font-mono text-xl font-semibold tabular">{eth(balances.data?.eth ?? 0)}</div></div>
              <div><div className="label">WETH (payouts)</div><div className="mt-1 font-mono text-xl font-semibold tabular">{eth(balances.data?.weth ?? 0)}</div></div>
            </div>
            <button className="btn btn-ghost" disabled={!live || tx.busy || !(balances.data?.weth ?? 0)} onClick={unwrap}>Unwrap WETH → ETH</button>
          </div>

          <div className="card divide-y divide-line">
            {rows.map((o) => {
              const expired = o.expiry <= now
              const stale = o.status === 'open' && o.offerDeadline < now
              let action: { label: string; primary?: boolean; run?: () => unknown } | null = null
              if (tab === 'holding') action = expired ? { label: 'Expired' } : { label: 'Exercise', primary: true, run: () => exercise(o) }
              else if (o.status === 'open') action = { label: stale ? 'Reclaim' : 'Cancel', primary: stale, run: () => cancel(o) }
              else if (o.status === 'filled' && expired) action = { label: 'Expire & reclaim', primary: true, run: () => expire(o) }
              const status =
                o.status === 'open' ? (stale ? 'Not filled: reclaim your collateral' : 'Waiting for a buyer')
                : o.status === 'filled' ? (tab === 'holding' ? 'You hold this option' : 'Sold: collateral locked')
                : o.status
              return (
                <div key={o.id.toString()} id={`pos-${o.id}`} className={`flex flex-wrap items-center gap-4 p-5 ${focusId === o.id.toString() ? 'bg-accent-soft ring-1 ring-accent/40' : ''}`}>
                  <KindBadge kind={o.kind} />
                  <div className="min-w-40 flex-1">
                    <div className="font-mono font-medium">{num(o.amount, 4)} {o.symbol} @ {eth(o.strike)}</div>
                    <div className={`text-xs ${stale ? 'text-warn' : 'text-faint'}`}>{status}</div>
                  </div>
                  <div className="w-28 text-sm"><div className="label">Premium</div><div className="tabular font-mono">{eth(o.premium)}</div></div>
                  <div className="w-24 text-sm"><div className="label">Expires</div><TimeLeft at={o.expiry} /></div>
                  {action && (
                    <button className={`btn btn-sm ${action.primary ? 'btn-primary' : 'btn-ghost'}`} disabled={!live || tx.busy || !action.run} onClick={action.run}>
                      {action.label}
                    </button>
                  )}
                  {tab === 'holding' && live && <div className="basis-full"><AddToWallet id={o.id} /></div>}
                </div>
              )
            })}
            {rows.length === 0 && (
              <div className="p-16 text-center text-muted">{pos.isLoading ? 'Loading…' : tab === 'holding' ? 'You don’t hold any options.' : tab === 'selling' ? 'You have no open offers.' : 'Nothing settled yet.'}</div>
            )}
          </div>

          <Note tone="warn">Exercising close to expiry is risky: if your transaction lands after expiry it fails, and the collateral goes back to the seller.</Note>
        </div>
      )}
      <TxStatus state={tx.state} onClose={tx.reset} />
    </>
  )
}
