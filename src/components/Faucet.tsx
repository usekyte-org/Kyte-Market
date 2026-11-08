'use client'

import { useAccount } from 'wagmi'
import { isDevnet } from '@/lib/chains'
import { devnetFaucet, useTx } from '@/lib/tx'
import { TxStatus } from './TxStatus'

/** Devnet only: funds the connected wallet with ETH, WETH, $KYTE and the listed test tokens. */
export function Faucet() {
  const { address, isConnected } = useAccount()
  const tx = useTx()
  if (!isDevnet) return null
  return (
    <>
      <button
        className="btn btn-glass btn-glass-sm"
        disabled={!isConnected || tx.busy}
        onClick={async () => address && tx.run(await devnetFaucet(address))}
        title="Devnet only: mint test ETH, WETH, $KYTE and tokens to your wallet"
      >
        Faucet
      </button>
      <TxStatus state={tx.state} onClose={tx.reset} />
    </>
  )
}
