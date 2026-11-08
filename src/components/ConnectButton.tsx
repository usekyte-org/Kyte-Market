'use client'

import { useConnectWallet, useWallets } from '@privy-io/react-auth'
import { useSetActiveWallet } from '@privy-io/wagmi'
import { ArrowSquareOut, Check, Copy, SignOut } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAccount, useConnect, useConnectors, useDisconnect, useReconnect, useSwitchChain } from 'wagmi'
import { chain, explorerAddress } from '@/lib/chains'
import { PRIVY_APP_ID } from '@/lib/config'
import { shortAddr } from '@/lib/format'
import { PillButton } from './PillButton'

// Privy's connect-only flow (no login) remembers the wallet in its own store, but it never makes that wallet
// wagmi's account again after a full page load: that only happened in connectWallet's onSuccess, which does
// not run on reload. We remember the chosen address here and re-activate it once Privy lists the wallet again.
const SAVED_WALLET = 'kyte:wallet'

export function ConnectButton() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <PillButton tone="light" size="sm" glyph="none" disabled>Connect wallet</PillButton>
  return PRIVY_APP_ID ? <PrivyConnect /> : <InjectedConnect />
}

/** Privy's wallet picker, limited to wallets installed in this browser. The chosen wallet becomes wagmi's account. */
function PrivyConnect() {
  const router = useRouter()
  const path = usePathname()
  const { address, chainId, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { wallets, ready } = useWallets()
  const { setActiveWallet } = useSetActiveWallet()
  const [target, setTarget] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      if (wallet.type !== 'ethereum') return setError('Please use an Ethereum wallet.')
      const addr = wallet.address.toLowerCase()
      localStorage.setItem(SAVED_WALLET, addr)
      setTarget(addr)
    },
    onError: (e) => {
      const m = String(e)
      if (m !== 'exited_link_flow' && m !== 'user_exited_link_flow') setError(m)
    },
  })
  // Once Privy lists the connected wallet, make it the active wagmi account.
  useEffect(() => {
    if (!target) return
    const w = wallets.find((x) => x.address.toLowerCase() === target)
    if (!w) return
    setTarget(null)
    setActiveWallet(w)
      .then(() => { if (path === '/') router.push('/market') })
      .catch((e) => setError(String(e)))
  }, [target, wallets, setActiveWallet, path, router])
  // After a reload: Privy has silently re-detected the wallet (eth_accounts, no prompt) but wagmi has no account.
  // Re-activate the wallet we saved, once per address, so the session survives navigation and refreshes.
  // Once Privy has registered the wallet's wagmi connector, bring the connection back through wagmi's
  // reconnect, which only reads eth_accounts and never prompts. Privy's setActiveWallet is not used here:
  // when it decides the connector is not ready it starts a fresh connect, and MetaMask then asks for
  // permissions again on every page load. Retried briefly because Privy may still be setting up.
  const connectors = useConnectors()
  const { reconnectAsync } = useReconnect()
  const [restored, setRestored] = useState<string | null>(null)
  const [tries, setTries] = useState(0)
  useEffect(() => {
    if (!ready || isConnected || target || tries > 20) return
    const saved = localStorage.getItem(SAVED_WALLET)
    if (!saved || saved === restored) return
    const w = wallets.find((x) => x.address.toLowerCase() === saved)
    if (!w) return
    const connector = connectors.find((c) => c.id === w.meta.id)
    if (!connector) return
    let cancelled = false
    reconnectAsync({ connectors: [connector] })
      .then((connections) => {
        if (cancelled) return
        if (connections.some((c) => c.accounts.some((a) => a.toLowerCase() === saved))) setRestored(saved)
        else setTimeout(() => !cancelled && setTries((n) => n + 1), 500)
      })
      .catch(() => { if (!cancelled) setTimeout(() => !cancelled && setTries((n) => n + 1), 500) })
    return () => { cancelled = true }
  }, [ready, wallets, connectors, isConnected, target, restored, tries, reconnectAsync])

  const forget = () => {
    localStorage.removeItem(SAVED_WALLET)
    setRestored(null)
    disconnect()
  }

  if (!isConnected || !address) {
    return (
      <div className="flex items-center gap-2">
        {error && <span className="hidden max-w-48 truncate text-xs text-danger md:inline" title={error}>{error}</span>}
        <PillButton tone="light" size="sm" glyph="none" onClick={() => { setError(null); connectWallet() }}>Connect wallet</PillButton>
      </div>
    )
  }
  if (chainId !== chain.id) {
    return (
      <button className="btn btn-sm border border-warn/50 text-warn" onClick={() => switchChain({ chainId: chain.id })}>
        Switch to {chain.name}
      </button>
    )
  }
  return <WalletMenu address={address} onDisconnect={forget} />
}

/**
 * Connected state: a glass pill with the address. Click opens a small menu: copy the address, open it on the
 * explorer, disconnect. Closes on outside click and Escape.
 */
function WalletMenu({ address, onDisconnect }: { address: string; onDisconnect: () => void }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  const copy = async () => {
    try { await navigator.clipboard.writeText(address) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  const url = explorerAddress(address)
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn btn-glass btn-glass-sm font-mono" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {shortAddr(address)}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="wallet-menu absolute right-0 top-[calc(100%+10px)] z-30 w-72 origin-top-right rounded-2xl p-1.5"
          >
            <div className="px-3 pb-2 pt-2">
              <div className="whitespace-nowrap text-[10px] uppercase tracking-[0.16em] text-muted">Connected · {chain.name}</div>
              <div className="mt-1 truncate font-mono text-xs text-ink/80">{address}</div>
            </div>
            <div className="mx-1 mb-1 h-px" style={{ background: 'rgba(160,255,220,0.1)' }} />
            <button type="button" role="menuitem" className="wallet-menu-item" onClick={copy}>
              {copied ? <Check size={15} className="text-accent" /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy address'}
            </button>
            {url && (
              <a role="menuitem" className="wallet-menu-item" href={url} target="_blank" rel="noreferrer">
                <ArrowSquareOut size={15} />View on explorer
              </a>
            )}
            <button type="button" role="menuitem" className="wallet-menu-item danger" onClick={() => { setOpen(false); onDisconnect() }}>
              <SignOut size={15} />Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Fallback without Privy: the browser's injected provider. */
function InjectedConnect() {
  const { address, chainId, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  if (!isConnected || !address) {
    const injected = connectors[0]
    return (
      <PillButton tone="light" size="sm" glyph="none" disabled={!injected || isPending} onClick={() => injected && connect({ connector: injected, chainId: chain.id })}>
        {isPending ? 'Connecting…' : 'Connect wallet'}
      </PillButton>
    )
  }
  if (chainId !== chain.id) {
    return <button className="btn btn-sm border border-warn/50 text-warn" onClick={() => switchChain({ chainId: chain.id })}>Switch to {chain.name}</button>
  }
  return <WalletMenu address={address} onDisconnect={() => disconnect()} />
}
