'use client'

import { ArrowSquareOut, Check, Copy, Wallet } from '@phosphor-icons/react'
import { useState } from 'react'
import { useWalletClient } from 'wagmi'
import { explorerNft, marketsFor } from '@/lib/chains'

/**
 * Wallets do not index NFTs on Robinhood Chain yet, so a bought option is owned but invisible until it is imported.
 * One click asks the wallet to track it (EIP-747 `wallet_watchAsset`, ERC-721: MetaMask and most injected wallets).
 * Wallets without that support get the contract address and token id to paste into "Import NFT", plus the
 * explorer page that renders the option's on-chain art.
 */
export function AddToWallet({ id }: { id: bigint }) {
  const { data: wallet } = useWalletClient()
  const nft = marketsFor(id).optionNft
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'manual'>('idle')
  const [copied, setCopied] = useState<'address' | 'id' | null>(null)
  const url = explorerNft(nft, id)

  const add = async () => {
    if (!wallet) return setState('manual')
    setState('busy')
    try {
      // viem types wallet_watchAsset as ERC20 only; ERC721 is part of EIP-747 and what MetaMask implements.
      const ok = await (wallet.request as (a: { method: string; params: unknown }) => Promise<boolean>)({
        method: 'wallet_watchAsset',
        params: { type: 'ERC721', options: { address: nft, tokenId: id.toString() } },
      })
      setState(ok ? 'added' : 'manual')
    } catch {
      setState('manual')
    }
  }
  const copy = async (what: 'address' | 'id', text: string) => {
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(what)
    setTimeout(() => setCopied(null), 1400)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-ghost btn-sm" disabled={state === 'busy'} onClick={add}>
        {state === 'added' ? <><Check size={14} className="text-accent" />In wallet</> : <><Wallet size={14} />{state === 'busy' ? 'Check your wallet…' : 'Add to wallet'}</>}
      </button>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="See the option NFT on the explorer">
          <ArrowSquareOut size={14} />NFT
        </a>
      )}
      {state === 'manual' && (
        <div className="basis-full text-xs text-muted">
          Your wallet could not add it by itself. In its NFTs tab choose “Import NFT” and paste{' '}
          <button type="button" className="inline-flex items-center gap-1 font-mono text-ink hover:underline" onClick={() => copy('address', nft)}>
            {copied === 'address' ? <Check size={11} className="text-accent" /> : <Copy size={11} />}contract {nft.slice(0, 6)}…{nft.slice(-4)}
          </button>{' '}and{' '}
          <button type="button" className="inline-flex items-center gap-1 font-mono text-ink hover:underline" onClick={() => copy('id', id.toString())}>
            {copied === 'id' ? <Check size={11} className="text-accent" /> : <Copy size={11} />}token id
          </button>.
        </div>
      )}
    </div>
  )
}
