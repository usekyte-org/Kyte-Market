'use client'

// Everything the connected wallet holds that the app knows about, in one multicall: native ETH, WETH, the
// protocol token, every listed asset, the Robinhood Chain token snapshot, and any token the user adds by
// address (kept in localStorage). Public RPCs cap unfiltered log scans at ~30k blocks, so tokens can't be
// discovered from transfer history; that is what "Add token" is for.
import { Plus, X } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { erc20Abi, formatUnits, getAddress, isAddress, type Address } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { chain, contracts, explorerAddress } from '@/lib/chains'
import { BRAND } from '@/lib/config'
import { useAssets } from '@/lib/data'
import { compact, num } from '@/lib/format'
import snapshot from '@/lib/rh-mainnet-tokens.json'

type Known = { address: Address; symbol?: string; name?: string; decimals?: number; icon?: string; priceUsd?: number; tag?: string }
type Holding = Known & { symbol: string; decimals: number; amount: number; usd: number | null }

const STORE = 'kyte.customTokens'
const ETH_PRICE_FALLBACK = snapshot.tokens.find((t) => t.symbol === 'WETH')?.priceUsd ?? null

function useCustomTokens() {
  const [list, setList] = useState<Address[]>([])
  useEffect(() => {
    try { setList(JSON.parse(localStorage.getItem(STORE) || '[]').filter(isAddress)) } catch {}
  }, [])
  const save = (next: Address[]) => { setList(next); localStorage.setItem(STORE, JSON.stringify(next)) }
  return { list, add: (a: Address) => save([...new Set([...list, getAddress(a)])]), remove: (a: Address) => save(list.filter((x) => x.toLowerCase() !== a.toLowerCase())) }
}

export function WalletHoldings({ title = 'Your wallet' }: { title?: string }) {
  const { address, isConnected } = useAccount()
  const client = usePublicClient()
  const assets = useAssets()
  const custom = useCustomTokens()
  const [showZero, setShowZero] = useState(false)
  const [adding, setAdding] = useState('')
  const [addErr, setAddErr] = useState('')

  // Every token the app knows about, de-duplicated by address. Later entries only fill gaps.
  const known = useMemo(() => {
    const byAddr = new Map<string, Known>()
    const put = (k: Known) => {
      const key = k.address.toLowerCase()
      byAddr.set(key, { ...k, ...byAddr.get(key) })
    }
    if (contracts.weth) put({ address: contracts.weth, symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, tag: 'base' })
    if (contracts.kyteToken) put({ address: contracts.kyteToken, tag: `${BRAND.token} (staking)` })
    for (const a of assets.data ?? []) put({ address: a.address, symbol: a.symbol, name: a.name, decimals: a.decimals, tag: 'listed' })
    if (chain.id === 4663) for (const t of snapshot.tokens) put({ address: t.address as Address, symbol: t.symbol, name: t.name, decimals: t.decimals, icon: t.icon, priceUsd: t.priceUsd })
    for (const t of Object.entries(contracts.tokens ?? {})) put({ address: t[1], symbol: t[0], tag: 'listed' })
    for (const a of custom.list) put({ address: a, tag: 'added' })
    return [...byAddr.values()]
  }, [assets.data, custom.list])

  const holdings = useQuery({
    queryKey: ['wallet-holdings', chain.id, address, known.map((k) => k.address).join()],
    enabled: Boolean(client && address),
    refetchInterval: 15_000,
    queryFn: async (): Promise<{ eth: number; tokens: Holding[] }> => {
      const owner = address!
      // balanceOf for everything, metadata only where unknown; one multicall round trip.
      const calls = known.flatMap((k) => [
        { address: k.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] } as const,
        ...(k.symbol ? [] : [{ address: k.address, abi: erc20Abi, functionName: 'symbol' } as const]),
        ...(k.decimals !== undefined ? [] : [{ address: k.address, abi: erc20Abi, functionName: 'decimals' } as const]),
      ])
      const [ethWei, results] = await Promise.all([client!.getBalance({ address: owner }), client!.multicall({ contracts: calls, allowFailure: true })])
      let i = 0
      const tokens: Holding[] = []
      for (const k of known) {
        const bal = results[i++]
        const sym = k.symbol ? undefined : results[i++]
        const dec = k.decimals !== undefined ? undefined : results[i++]
        if (bal.status !== 'success') continue
        const symbol = k.symbol ?? (sym?.status === 'success' ? String(sym.result).slice(0, 16) : '???')
        const decimals = k.decimals ?? (dec?.status === 'success' ? Number(dec.result) : 18)
        const amount = Number(formatUnits(bal.result as bigint, decimals))
        const price = k.priceUsd ?? (symbol === 'WETH' ? ETH_PRICE_FALLBACK : null)
        tokens.push({ ...k, symbol, decimals, amount, usd: price != null ? amount * price : null })
      }
      tokens.sort((x, y) => (y.usd ?? -1) - (x.usd ?? -1) || y.amount - x.amount)
      return { eth: Number(formatUnits(ethWei, 18)), tokens }
    },
  })

  const addToken = async () => {
    setAddErr('')
    const a = adding.trim()
    if (!isAddress(a)) return setAddErr('Not a valid address.')
    try {
      await client!.readContract({ address: a, abi: erc20Abi, functionName: 'decimals' })
      custom.add(a)
      setAdding('')
    } catch {
      setAddErr(`No ERC-20 token at that address on ${chain.name}.`)
    }
  }

  if (!isConnected) {
    return (
      <div className="card p-6">
        <div className="label">{title}</div>
        <p className="mt-3 text-sm text-muted">Connect a wallet to see every token it holds.</p>
      </div>
    )
  }

  const data = holdings.data
  const rows = (data?.tokens ?? []).filter((t) => showZero || t.amount > 0)
  const hidden = (data?.tokens ?? []).filter((t) => t.amount === 0).length
  const ethUsd = data && ETH_PRICE_FALLBACK != null ? data.eth * ETH_PRICE_FALLBACK : null
  const total = (ethUsd ?? 0) + (data?.tokens ?? []).reduce((s, t) => s + (t.usd ?? 0), 0)

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <div className="label">{title}</div>
          {data && total > 0 && <div className="mt-1 font-mono text-lg">${total.toLocaleString('en-US', { maximumFractionDigits: 2 })}<span className="ml-2 text-xs text-faint">known prices</span></div>}
        </div>
        {hidden > 0 && (
          <button type="button" onClick={() => setShowZero((v) => !v)} className="font-mono text-xs text-muted hover:text-ink">
            {showZero ? 'Hide empty' : `Show ${hidden} empty`}
          </button>
        )}
      </div>

      {holdings.isLoading && <div className="space-y-px">{Array.from({ length: 3 }, (_, i) => <div key={i} className="shimmer h-12" />)}</div>}
      {holdings.isError && <p className="px-5 py-4 text-sm text-warn">Couldn&apos;t read balances right now. Retrying…</p>}

      {data && (
        <ul className="max-h-[420px] divide-y divide-line/60 overflow-y-auto" data-lenis-prevent>
          <Row symbol="ETH" name={`Native ether on ${chain.name}`} amount={data.eth} usd={ethUsd} tag="gas" />
          {rows.map((t) => (
            <Row
              key={t.address}
              symbol={t.symbol}
              name={t.name}
              icon={t.icon}
              amount={t.amount}
              usd={t.usd}
              tag={t.tag}
              href={explorerAddress(t.address)}
              onRemove={t.tag === 'added' ? () => custom.remove(t.address) : undefined}
            />
          ))}
          {rows.length === 0 && <li className="px-5 py-4 text-sm text-muted">No token balances among the {data.tokens.length} tokens checked.</li>}
        </ul>
      )}

      <form className="flex gap-2 border-t border-line px-5 py-3" onSubmit={(e) => { e.preventDefault(); void addToken() }}>
        <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a token by address (0x…)" className="min-w-0 flex-1 rounded-full border border-line bg-bg/60 px-3 py-1.5 font-mono text-xs outline-none focus:border-line-strong" spellCheck={false} />
        <button type="submit" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"><Plus size={12} />Add</button>
      </form>
      {addErr && <p className="px-5 pb-3 text-xs text-warn">{addErr}</p>}
    </div>
  )
}

function Row({ symbol, name, icon, amount, usd, tag, href, onRemove }: { symbol: string; name?: string; icon?: string; amount: number; usd: number | null; tag?: string; href?: string; onRemove?: () => void }) {
  const [broken, setBroken] = useState(false)
  return (
    <li className="group flex items-center gap-3 px-5 py-3">
      {icon && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" width={28} height={28} className="size-7 shrink-0 rounded-full bg-white/[0.04]" onError={() => setBroken(true)} />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-mono text-[10px]">{symbol.slice(0, 3)}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          {href ? <a href={href} target="_blank" rel="noreferrer" className="hover:text-accent">{symbol}</a> : symbol}
          {tag && <span className="rounded-full border border-line px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-faint">{tag}</span>}
        </div>
        {name && <div className="truncate text-xs text-faint">{name}</div>}
      </div>
      <div className="text-right">
        <div className="font-mono text-sm tabular">{amount >= 1e6 ? compact(amount) : num(amount, amount < 1 ? 6 : 4)}</div>
        {usd != null && <div className="font-mono text-xs text-faint">${usd.toLocaleString('en-US', { maximumFractionDigits: usd < 1 ? 4 : 2 })}</div>}
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${symbol}`} className="text-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"><X size={12} /></button>
      )}
    </li>
  )
}
