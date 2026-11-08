'use client'

// Every write goes simulate → sign → wait, and reports one of a few states the UI can show.
import { useCallback, useState } from 'react'
import { BaseError, type Abi, type Address, type ContractFunctionArgs, type ContractFunctionName } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { chain, contracts, isDevnet } from './chains'
import { useRefresh } from './data'
import { ABIS } from './generated/abis'

export type TxState =
  | { status: 'idle' }
  | { status: 'simulating' | 'signing' | 'pending'; hash?: `0x${string}`; label: string }
  | { status: 'success'; hash: `0x${string}`; label: string }
  | { status: 'error'; message: string; label: string }

type Call<A extends Abi> = {
  label: string
  address: Address
  abi: A
  functionName: ContractFunctionName<A, 'nonpayable' | 'payable'>
  args?: ContractFunctionArgs<A, 'nonpayable' | 'payable', ContractFunctionName<A, 'nonpayable' | 'payable'>>
  value?: bigint
}

export function useTx() {
  const { address } = useAccount()
  const client = usePublicClient()
  const { data: wallet } = useWalletClient()
  const refresh = useRefresh()
  const [state, setState] = useState<TxState>({ status: 'idle' })

  /** Runs each step in order; stops at the first failure. */
  const run = useCallback(
    async (steps: Call<Abi>[]): Promise<boolean> => {
      if (!client || !wallet || !address) {
        setState({ status: 'error', message: 'Connect a wallet first.', label: steps[0]?.label ?? '' })
        return false
      }
      for (const step of steps) {
        try {
          setState({ status: 'simulating', label: step.label })
          const { request } = await client.simulateContract({
            account: address,
            chain,
            address: step.address,
            abi: step.abi,
            functionName: step.functionName,
            args: step.args,
            value: step.value,
          })
          setState({ status: 'signing', label: step.label })
          const hash = await wallet.writeContract(request)
          setState({ status: 'pending', hash, label: step.label })
          const receipt = await client.waitForTransactionReceipt({ hash })
          if (receipt.status !== 'success') throw new Error('Transaction reverted')
          setState({ status: 'success', hash, label: step.label })
        } catch (e) {
          setState({ status: 'error', message: errorMessage(e), label: step.label })
          refresh()
          return false
        }
      }
      refresh()
      return true
    },
    [client, wallet, address, refresh],
  )

  const reset = useCallback(() => setState({ status: 'idle' }), [])
  return { state, run, reset, busy: state.status === 'simulating' || state.status === 'signing' || state.status === 'pending' }
}

/** Approval step only if the current allowance is too small. */
export async function approvalIfNeeded(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  owner: Address,
  token: Address,
  spender: Address,
  amount: bigint,
  label = 'Approve',
): Promise<Call<Abi>[]> {
  const allowance = await client.readContract({ address: token, abi: ABIS.ERC20, functionName: 'allowance', args: [owner, spender] })
  if (allowance >= amount) return []
  return [{ label, address: token, abi: ABIS.ERC20 as Abi, functionName: 'approve', args: [spender, amount] }]
}

export const c = contracts

function errorMessage(e: unknown): string {
  if (e instanceof BaseError) {
    // Custom errors from our contracts surface as "Error: AssetNotEnabled()" etc.
    const m = e.shortMessage.match(/reverted with the following reason:\s*(.+)/) ?? e.shortMessage.match(/Error:\s*([A-Za-z]+)\(/)
    const name = m?.[1]?.trim()
    return name ? friendly(name) : e.shortMessage
  }
  return e instanceof Error ? e.message : String(e)
}

const FRIENDLY: Record<string, string> = {
  AssetNotEnabled: 'This token is not listed.',
  PutsNotEnabled: 'Puts are not enabled for this token.',
  PremiumTooLow: 'Premium is below the minimum (0.0005 ETH).',
  StrikeTooLow: 'Strike is below the minimum for this token.',
  BadDuration: 'Expiry must be between 1 hour and 90 days away.',
  BadDeadline: 'The fill deadline must be in the future and no later than expiry.',
  CapExceeded: 'This token has reached its cap.',
  FeeOnTransfer: 'This token takes a fee on transfer and can’t be used.',
  OfferExpired: 'This offer can no longer be filled.',
  OptionExpired: 'This option has expired.',
  NotExpired: 'Not expired yet.',
  NotHolder: 'You don’t hold this option.',
  NotSeller: 'Only the seller can do that.',
  SelfTrade: 'You can’t buy your own offer.',
  PremiumAboveMax: 'The premium changed; try again.',
  MarketPaused: 'The market is paused for new positions.',
  InsufficientValue: 'Not enough ETH sent.',
  BelowMinClaim: 'Nothing to claim yet, or below the minimum claim.',
  InsufficientStake: 'You don’t have that much staked.',
  WrongStatus: 'This position is not in the right state for that.',
  StakeLocked: 'Newly activated stake is locked until the end of this epoch. Pending stake can be withdrawn any time.',
  NotKeeper: 'Only the keeper can run buybacks.',
  SlippageTooHigh: 'Price moved too far from the oracle price; try again later.',
}
const friendly = (name: string) => FRIENDLY[name] ?? name

/** Devnet-only: top up the connected wallet with ETH, WETH, $KYTE and every listed token. */
export async function devnetFaucet(address: Address): Promise<Call<Abi>[]> {
  if (!isDevnet) return []
  await fetch(chain.rpcUrls.default.http[0], {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'anvil_setBalance', params: [address, '0x' + (100n * 10n ** 18n).toString(16)] }),
  })
  const steps: Call<Abi>[] = []
  const mint = (label: string, token: Address, amount: bigint) =>
    steps.push({ label, address: token, abi: ABIS.ERC20 as Abi, functionName: 'mint', args: [address, amount] })
  mint('Mint WETH', c.weth!, 50n * 10n ** 18n)
  if (c.kyteToken) mint('Mint $KYTE', c.kyteToken, 10_000_000n * 10n ** 18n)
  mint('Mint ZEPH', c.tokens!.ZEPH, 5_000_000n * 10n ** 18n)
  mint('Mint GALE', c.tokens!.GALE, 50_000n * 10n ** 18n)
  mint('Mint NIMB', c.tokens!.NIMB, 500_000n * 10n ** 6n)
  return steps
}
