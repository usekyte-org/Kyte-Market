'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { parseEther } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { TimeLeft } from '@/components/TimeLeft'
import { TxStatus } from '@/components/TxStatus'
import { WalletHoldings } from '@/components/WalletHoldings'
import { Note, PageHeader, Segmented, Stat } from '@/components/ui'
import { contracts } from '@/lib/chains'
import { BRAND, SPLIT } from '@/lib/config'
import { useBalances, useLive, useStake, useStats } from '@/lib/data'
import { bps, compact, eth, num } from '@/lib/format'
import { ABIS } from '@/lib/generated/abis'
import { approvalIfNeeded, useTx } from '@/lib/tx'

export default function StakePage() {
  const { address, isConnected } = useAccount()
  const client = usePublicClient()
  const live = useLive()
  const tx = useTx()
  const stake = useStake()
  const stats = useStats()
  const balances = useBalances()
  const [mode, setMode] = useState<'stake' | 'unstake'>('stake')
  const [amount, setAmount] = useState('')
  // /stake?action=stake|unstake|claim&amount= (from the agent's prepare_stake link)
  const params = useSearchParams()
  useEffect(() => {
    const a = params.get('action')
    if (a === 'stake' || a === 'unstake') setMode(a)
    const v = Number(params.get('amount')); if (Number.isFinite(v) && v > 0) setAmount(String(v))
    if (a === 'claim') document.getElementById('claim')?.scrollIntoView({ block: 'center' })
  }, [params])

  const s = stake.data
  const max = mode === 'stake' ? (balances.data?.kyte ?? 0) : (s?.myActive ?? 0) + (s?.myPending ?? 0)
  const amt = Number(amount) || 0
  const myShare = s && s.totalStaked > 0 ? s.myActive / s.totalStaked : 0
  const canClaim = Boolean(s && s.claimable > 0 && s.claimable >= s.minClaim)
  const pool = contracts.stakingPool!

  const submit = async () => {
    if (!client || !address) return
    // The input and the Max button carry a rounded number; the pool pulls exact wei. Clamp to the exact on-chain
    // balance (or stake) so "Max" never asks for a few wei more than the wallet holds (ERC20InsufficientBalance).
    const exactMax =
      mode === 'stake'
        ? await client.readContract({ address: contracts.kyteToken!, abi: ABIS.ERC20, functionName: 'balanceOf', args: [address] })
        : await client.readContract({ address: pool, abi: ABIS.StakingPool, functionName: 'balancesOf', args: [address] }).then(([a, p]) => a + p)
    let raw = parseEther(amount)
    if (raw > exactMax) raw = exactMax
    if (raw <= 0n) return
    const ok =
      mode === 'stake'
        ? await tx.run([
            ...(await approvalIfNeeded(client, address, contracts.kyteToken!, pool, raw, `Approve ${BRAND.token}`)),
            { label: `Stake ${num(amt, 4)} ${BRAND.token}`, address: pool, abi: ABIS.StakingPool, functionName: 'stake', args: [raw] },
          ])
        : await tx.run([{ label: `Unstake ${num(amt, 4)} ${BRAND.token}`, address: pool, abi: ABIS.StakingPool, functionName: 'unstake', args: [raw] }])
    if (ok) setAmount('')
  }
  const claim = () => tx.run([{ label: `Claim ${eth(s?.claimable ?? 0, 6)}`, address: pool, abi: ABIS.StakingPool, functionName: 'claim' }])

  return (
    <>
      <PageHeader title={`Stake ${BRAND.token}`} sub={`Stakers earn ${bps(SPLIT.stakersBps)} of every protocol fee, paid in WETH. New stake starts earning at the next epoch.`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total staked" value={compact(s?.totalStaked ?? 0)} hint={stats.data?.stakers ? `${stats.data.stakers.toLocaleString('en-US')} ${stats.data.stakers === 1 ? 'staker' : 'stakers'}` : undefined} />
        <Stat label="Last epoch to stakers" value={eth(s?.lastEpochRewards ?? 0, 4)} />
        <Stat label="Epoch" value={s ? `#${s.epoch}` : '…'} />
        <div className="card p-5"><div className="label">Next epoch in</div><div className="mt-2 font-mono text-2xl font-semibold">{s ? <TimeLeft at={s.epochEndsAt} /> : '…'}</div></div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card space-y-5 p-6 lg:col-span-3">
          <Segmented value={mode} onChange={(m) => { setMode(m); setAmount('') }} options={[{ value: 'stake', label: 'Stake' }, { value: 'unstake', label: 'Unstake' }]} />
          <div>
            <div className="mb-2 flex justify-between">
              <span className="label">Amount</span>
              <button type="button" className="font-mono text-xs text-accent" onClick={() => setAmount(String(max))}>Max {num(max, 0)}</button>
            </div>
            <input className="input h-12 text-lg" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <Note>
            {mode === 'stake'
              ? 'Your stake becomes active when the next epoch starts and earns from then on. This stops anyone from staking just before a fee split.'
              : 'Unstaking is immediate. Pending stake is removed first, then active stake. Rewards you have already earned stay claimable.'}
          </Note>
          <button className="btn btn-accent h-12 w-full" disabled={!isConnected || !live || amt <= 0 || amt > max || tx.busy} onClick={submit}>
            {!isConnected ? 'Connect a wallet' : !live ? 'Demo mode' : tx.busy ? 'Working…' : mode === 'stake' ? `Stake ${num(amt, 4)}` : `Unstake ${num(amt, 4)}`}
          </button>
        </div>

        <div className="space-y-4 lg:col-span-2">
        <div className="card p-6">
          <div className="label">Your position</div>
          <dl className="mt-4 space-y-3 text-sm">
            <Row k="Active" v={`${num(s?.myActive ?? 0, 0)} ${BRAND.token}`} />
            <Row k="Pending (next epoch)" v={`${num(s?.myPending ?? 0, 0)} ${BRAND.token}`} />
            <Row k="Share of active stake" v={`${num(myShare * 100, 3)}%`} />
            <Row k={`${BRAND.token} in wallet`} v={num(balances.data?.kyte ?? 0, 0)} />
            <div className="border-t border-line" />
            <Row k="Claimable" v={eth(s?.claimable ?? 0, 6)} strong />
          </dl>
          <button id="claim" className="btn btn-accent mt-6 w-full" disabled={!isConnected || !live || !canClaim || tx.busy} onClick={claim}>Claim WETH</button>
          {(s?.minClaim ?? 0) > 0 && <p className="mt-2 text-xs text-faint">Minimum claim {eth(s!.minClaim)}.</p>}
        </div>
        <WalletHoldings />
        </div>
      </div>
      <TxStatus state={tx.state} onClose={tx.reset} />
    </>
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
