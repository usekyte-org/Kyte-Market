'use client'

// One data layer for every page. Order of preference: indexer API (NEXT_PUBLIC_INDEXER_URL) → direct chain
// reads (events + view calls) → demo data (NEXT_PUBLIC_DEMO=1 or no contracts deployed).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatUnits, parseAbiItem, type Address, type PublicClient } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { DEPLOY_BLOCK, contracts, contractsLive, marketsFor, settlingMarkets } from './chains'
import { DEMO } from './config'
import * as demo from './demo-data'
import { ABIS } from './generated/abis'

export type Kind = 'call' | 'put'
export type Status = 'open' | 'filled' | 'exercised' | 'expired' | 'cancelled'
const STATUS: Status[] = ['open', 'open', 'filled', 'exercised', 'expired', 'cancelled']

export type Asset = {
  symbol: string
  name: string
  address: Address
  decimals: number
  enabled: boolean
  putsEnabled: boolean
  /** 'pons' for launchpad tokens: options on them must expire within maxDurationSec (24 h). */
  source?: 'pons' | null
  maxDurationSec?: number
  cap: bigint
  minStrike: bigint
  spotEth: number // display only (demo hint or 0 when unknown)
  vol: number
}

export type Offer = {
  id: bigint
  kind: Kind
  seller: Address
  holder?: Address
  token: Address
  symbol: string
  decimals: number
  amount: number
  amountRaw: bigint
  strike: number
  strikeRaw: bigint
  premium: number
  premiumRaw: bigint
  expiry: number
  offerDeadline: number
  status: Status
  /** 'pons' for launchpad tokens; overLimit marks an offer written past the 24 h rule (hidden from the market). */
  source?: 'pons' | null
  overLimit?: boolean
}

export type Split = { epoch: number; at: number; tx: string; stakers: number; buyback: number; ops: number }
export type Burn = { at: number; tx: string; wethIn: number; tokenOut: number }
export type StakeInfo = {
  epoch: number
  epochEndsAt: number
  totalStaked: number
  myActive: number
  myPending: number
  claimable: number
  minClaim: number
  lastEpochRewards: number
}

export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || ''
export const useLive = () => !DEMO && contractsLive
const eth = (wei: bigint) => Number(formatUnits(wei, 18))

async function api<T>(path: string): Promise<T> {
  const r = await fetch(`${INDEXER_URL}${path}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`indexer ${r.status}`)
  return r.json() as Promise<T>
}

/** Try the indexer first, then the chain. */
async function viaIndexer<T>(path: string, fallback: () => Promise<T>, map: (x: unknown) => T = (x) => x as T): Promise<T> {
  if (INDEXER_URL) {
    try {
      return map(await api(path))
    } catch (e) {
      console.warn('[data] indexer unavailable, reading chain:', (e as Error).message)
    }
  }
  return fallback()
}

/**
 * getLogs from the deploy block to now, in ranges the public RPC accepts (Robinhood Chain caps a request at
 * 10M blocks; at ~10 blocks/s that is under two weeks). Only a fallback: the indexer is the normal source.
 */
const LOG_SPAN = 9_000_000n
async function logsSinceDeploy<T>(client: PublicClient, get: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>): Promise<T[]> {
  const head = await client.getBlockNumber()
  const out: T[] = []
  for (let from = DEPLOY_BLOCK; from <= head; from += LOG_SPAN) {
    const to = from + LOG_SPAN - 1n > head ? head : from + LOG_SPAN - 1n
    out.push(...(await get(from, to)))
  }
  return out
}

const EV = {
  OfferCreated: parseAbiItem(
    'event OfferCreated(uint256 indexed id, address indexed seller, address indexed token, uint256 amount, uint256 strike, uint256 premium, uint64 expiry, uint64 offerDeadline)',
  ),
  FeesSplit: parseAbiItem('event FeesSplit(uint64 indexed epoch, uint256 stakers, uint256 buyback, uint256 ops)'),
  Burned: parseAbiItem('event Burned(uint256 wethIn, uint256 tokenOut)'),
}

// ------------------------------------------------------------------ assets

const HINTS: Record<string, { spotEth: number; vol: number }> = Object.fromEntries(
  demo.ASSETS.map((a) => [a.symbol, { spotEth: a.spotEth, vol: a.vol }]),
)
// Tokenized stocks and ETFs move far less than small-cap crypto: price their options with equity-like volatility.
const STOCK = /Robinhood Token|Ondo Tokenized/i
const hint = (symbol: string, name = '') => HINTS[symbol] ?? { spotEth: 0, vol: STOCK.test(name) ? 0.45 : 1.2 }
// Ondo Tokenized stocks (…on) are off the site: the Robinhood Stock Tokens replace them. Marked disabled rather than
// dropped, so pickers hide them (they list enabled assets only) while old positions still find their token.
const HIDDEN = /Ondo Tokenized/i

type ApiAsset = { address: Address; symbol: string; name: string; decimals: number; enabled: boolean; putsEnabled: boolean; cap: string; minStrike: string; source?: 'pons' | null; maxDurationSec?: number }

async function assetsFromChain(client: PublicClient): Promise<Asset[]> {
  const registry = contracts.assetRegistry!
  const count = Number(await client.readContract({ address: registry, abi: ABIS.AssetRegistry, functionName: 'assetCount' }))
  const addrs = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      client.readContract({ address: registry, abi: ABIS.AssetRegistry, functionName: 'listedTokens', args: [BigInt(i)] }),
    ),
  )
  return Promise.all(
    addrs.map(async (address) => {
      const [a, symbol, name] = await Promise.all([
        client.readContract({ address: registry, abi: ABIS.AssetRegistry, functionName: 'getAsset', args: [address] }),
        client.readContract({ address, abi: ABIS.ERC20, functionName: 'symbol' }),
        client.readContract({ address, abi: ABIS.ERC20, functionName: 'name' }),
      ])
      return { symbol, name, address, decimals: a.decimals, enabled: a.enabled, putsEnabled: a.enabled && a.putsEnabled, cap: a.cap, minStrike: a.minStrike, ...hint(symbol, name) }
    }),
  )
}

export function useAssets() {
  const client = usePublicClient()
  const live = useLive()
  return useQuery({
    queryKey: ['assets', live],
    queryFn: async (): Promise<Asset[]> => {
      if (!live || !client) return demo.ASSETS.map((a) => ({ ...a, enabled: true, cap: 0n, minStrike: 0n }))
      const list = await viaIndexer('/assets', () => assetsFromChain(client), (x) =>
        (x as ApiAsset[]).map((a) => ({ ...a, cap: BigInt(a.cap), minStrike: BigInt(a.minStrike), ...hint(a.symbol, a.name) })),
      )
      if (INDEXER_URL) {
        try {
          const prices = await api<Record<string, { price: number }>>('/prices')
          for (const a of list) if (prices[a.symbol]?.price) a.spotEth = prices[a.symbol].price
        } catch {}
      }
      for (const a of list) if (HIDDEN.test(a.name)) a.enabled = a.putsEnabled = false
      return list
    },
    staleTime: 10_000,
    refetchInterval: 20_000,
  })
}

// ------------------------------------------------------------------ offers

type ApiOffer = {
  id: string; kind: Kind; seller: Address; holder: Address | null; token: Address; symbol: string; decimals: number
  amount: number; amountRaw: string; strike: number; strikeRaw: string; premium: number; premiumRaw: string
  expiry: number; offerDeadline: number; status: Status; source?: 'pons' | null; overLimit?: boolean
}

function demoOffers(): Offer[] {
  return demo.OFFERS.map((o) => {
    const a = demo.asset(o.symbol)
    return {
      id: BigInt(o.id), kind: o.kind, seller: o.seller, holder: o.buyer, token: a.address, symbol: o.symbol, decimals: a.decimals,
      amount: o.amount, amountRaw: BigInt(Math.round(o.amount)) * 10n ** BigInt(a.decimals),
      strike: o.strike, strikeRaw: BigInt(Math.round(o.strike * 1e18)),
      premium: o.premium, premiumRaw: BigInt(Math.round(o.premium * 1e18)),
      expiry: o.expiry, offerDeadline: o.offerDeadline, status: o.status,
    }
  })
}

async function offersFromChain(client: PublicClient, assets: Asset[]): Promise<Offer[]> {
  const markets = [
    { address: contracts.callMarket!, kind: 'call' as Kind, abi: ABIS.CallMarket },
    { address: contracts.putMarket!, kind: 'put' as Kind, abi: ABIS.PutMarket },
    // Older market sets (v1, v2) still hold positions that settle there.
    ...settlingMarkets.flatMap(({ markets }) => [
      { address: markets.callMarket, kind: 'call' as Kind, abi: ABIS.CallMarket },
      { address: markets.putMarket, kind: 'put' as Kind, abi: ABIS.PutMarket },
    ]),
  ]
  const byToken = new Map(assets.map((a) => [a.address.toLowerCase(), a]))
  const out: Offer[] = []
  for (const m of markets) {
    const logs = await logsSinceDeploy(client, (fromBlock, toBlock) => client.getLogs({ address: m.address, event: EV.OfferCreated, fromBlock, toBlock }))
    const positions = await Promise.all(
      logs.map((l) => client.readContract({ address: m.address, abi: m.abi, functionName: 'getPosition', args: [l.args.id!] })),
    )
    for (let i = 0; i < logs.length; i++) {
      const id = logs[i].args.id!
      const p = positions[i]
      const a = byToken.get(p.token.toLowerCase())
      const status = STATUS[p.status]
      let holder: Address | undefined
      if (status === 'filled') {
        try {
          holder = await client.readContract({ address: marketsFor(id).optionNft, abi: ABIS.OptionNFT, functionName: 'ownerOf', args: [id] })
        } catch {}
      }
      out.push({
        id, kind: m.kind, seller: p.seller, holder, token: p.token, symbol: a?.symbol ?? '?', decimals: a?.decimals ?? 18,
        amount: Number(formatUnits(p.amount, a?.decimals ?? 18)), amountRaw: p.amount,
        strike: eth(p.strike), strikeRaw: p.strike, premium: eth(p.premium), premiumRaw: p.premium,
        expiry: Number(p.expiry), offerDeadline: Number(p.offerDeadline), status,
      })
    }
  }
  return out
}

/** Every position, any status. Pages filter. */
export function useOffers() {
  const client = usePublicClient()
  const live = useLive()
  const assets = useAssets()
  return useQuery({
    queryKey: ['offers', live, assets.data?.length ?? 0],
    enabled: !live || Boolean(assets.data),
    queryFn: async (): Promise<Offer[]> => {
      if (!live || !client) return demoOffers()
      return viaIndexer('/offers?status=all', () => offersFromChain(client, assets.data ?? []), (x) =>
        (x as ApiOffer[]).map((o) => ({
          ...o, id: BigInt(o.id), holder: o.holder ?? undefined,
          amountRaw: BigInt(o.amountRaw), strikeRaw: BigInt(o.strikeRaw), premiumRaw: BigInt(o.premiumRaw),
        })),
      )
    },
    refetchInterval: live ? 6_000 : false,
  })
}

export function isFillable(o: Offer, now = Date.now() / 1000) {
  return o.status === 'open' && now <= o.offerDeadline
}

/** Options the connected wallet holds, and offers it wrote. */
export function usePositions() {
  const { address } = useAccount()
  const live = useLive()
  const offers = useOffers()
  const me = (live ? address : demo.DEMO_WALLET)?.toLowerCase()
  const list = offers.data ?? []
  return {
    ...offers,
    holding: list.filter((o) => o.status === 'filled' && o.holder?.toLowerCase() === me),
    selling: list.filter((o) => o.seller.toLowerCase() === me && (o.status === 'open' || o.status === 'filled')),
    history: list.filter((o) => (o.seller.toLowerCase() === me || o.holder?.toLowerCase() === me) && ['exercised', 'expired', 'cancelled'].includes(o.status)),
  }
}

// ------------------------------------------------------------------ wallet balances

export function useBalances() {
  const client = usePublicClient()
  const { address } = useAccount()
  const live = useLive()
  return useQuery({
    queryKey: ['balances', address, live],
    enabled: Boolean(address),
    queryFn: async () => {
      if (!live || !client || !address) return { eth: 0, weth: 0.0734, kyte: demo.STAKE.walletBalance, tokens: {} as Record<string, number> }
      const [ethWei, wethWei, kyteWei] = await Promise.all([
        client.getBalance({ address }),
        client.readContract({ address: contracts.weth!, abi: ABIS.ERC20, functionName: 'balanceOf', args: [address] }),
        contracts.kyteToken
          ? client.readContract({ address: contracts.kyteToken, abi: ABIS.ERC20, functionName: 'balanceOf', args: [address] })
          : Promise.resolve(0n),
      ])
      const tokens: Record<string, number> = {}
      await Promise.all(
        Object.entries(contracts.tokens ?? {}).map(async ([sym, addr]) => {
          const [bal, dec] = await Promise.all([
            client.readContract({ address: addr, abi: ABIS.ERC20, functionName: 'balanceOf', args: [address] }),
            client.readContract({ address: addr, abi: ABIS.ERC20, functionName: 'decimals' }),
          ])
          tokens[sym] = Number(formatUnits(bal, dec))
        }),
      )
      return { eth: eth(ethWei), weth: eth(wethWei), kyte: eth(kyteWei), tokens }
    },
    refetchInterval: live ? 6_000 : false,
  })
}

/** Balance of any one token (the sell form's selected asset, which may not be in `contracts.tokens`). */
export function useTokenBalance(token?: Address, decimals = 18) {
  const client = usePublicClient()
  const { address } = useAccount()
  const live = useLive()
  return useQuery({
    queryKey: ['tokenBalance', token, address, live],
    enabled: Boolean(live && client && address && token),
    queryFn: async () => Number(formatUnits(await client!.readContract({ address: token!, abi: ABIS.ERC20, functionName: 'balanceOf', args: [address!] }), decimals)),
    refetchInterval: 8_000,
  })
}

// ------------------------------------------------------------------ staking

async function stakeFromChain(client: PublicClient, address?: Address): Promise<StakeInfo> {
  const pool = contracts.stakingPool!
  const r = (fn: 'currentEpoch' | 'epochEndsAt' | 'activeSupply' | 'pendingSupply' | 'minClaim') =>
    client.readContract({ address: pool, abi: ABIS.StakingPool, functionName: fn })
  const [epoch, ends, active, pending, minClaim] = await Promise.all([r('currentEpoch'), r('epochEndsAt'), r('activeSupply'), r('pendingSupply'), r('minClaim')])
  const splits = await logsSinceDeploy(client, (fromBlock, toBlock) => client.getLogs({ address: contracts.feeVault!, event: EV.FeesSplit, fromBlock, toBlock }))
  let mine = { myActive: 0, myPending: 0, claimable: 0 }
  if (address) {
    const [[a, p], c] = await Promise.all([
      client.readContract({ address: pool, abi: ABIS.StakingPool, functionName: 'balancesOf', args: [address] }),
      client.readContract({ address: pool, abi: ABIS.StakingPool, functionName: 'pendingRewards', args: [address] }),
    ])
    mine = { myActive: eth(a), myPending: eth(p), claimable: eth(c) }
  }
  return { epoch: Number(epoch), epochEndsAt: Number(ends), totalStaked: eth(active + pending), minClaim: eth(minClaim), lastEpochRewards: eth(splits.at(-1)?.args.stakers ?? 0n), ...mine }
}

export function useStake() {
  const client = usePublicClient()
  const { address } = useAccount()
  const live = useLive()
  return useQuery({
    queryKey: ['stake', address, live],
    queryFn: async (): Promise<StakeInfo> => {
      if (!live || !client) {
        return {
          epoch: demo.STAKE.epoch, epochEndsAt: demo.STAKE.epochEndsAt, totalStaked: demo.STATS.stakedTokens,
          myActive: demo.STAKE.myActive, myPending: demo.STAKE.myPending, claimable: demo.STAKE.myClaimableEth,
          minClaim: demo.STAKE.minClaimEth, lastEpochRewards: demo.SPLITS[0].stakers,
        }
      }
      const who = address ?? '0x0000000000000000000000000000000000000000'
      return viaIndexer(`/stake/${who}`, () => stakeFromChain(client, address))
    },
    refetchInterval: live ? 6_000 : false,
  })
}

// ------------------------------------------------------------------ proof + stats

type Proof = { splits: Split[]; burns: Burn[]; totalBurned: number }

async function proofFromChain(client: PublicClient): Promise<Proof> {
  const [splitLogs, burnLogs] = await Promise.all([
    logsSinceDeploy(client, (fromBlock, toBlock) => client.getLogs({ address: contracts.feeVault!, event: EV.FeesSplit, fromBlock, toBlock })),
    contracts.buybackBurner ? logsSinceDeploy(client, (fromBlock, toBlock) => client.getLogs({ address: contracts.buybackBurner!, event: EV.Burned, fromBlock, toBlock })) : Promise.resolve([]),
  ])
  const times = new Map<bigint, number>()
  const at = async (bn: bigint) => {
    if (!times.has(bn)) times.set(bn, Number((await client.getBlock({ blockNumber: bn })).timestamp))
    return times.get(bn)!
  }
  const splits = await Promise.all(splitLogs.map(async (l) => ({ epoch: Number(l.args.epoch), at: await at(l.blockNumber), tx: l.transactionHash, stakers: eth(l.args.stakers!), buyback: eth(l.args.buyback!), ops: eth(l.args.ops!) })))
  const burns = await Promise.all(burnLogs.map(async (l) => ({ at: await at(l.blockNumber), tx: l.transactionHash, wethIn: eth(l.args.wethIn!), tokenOut: eth(l.args.tokenOut!) })))
  return { splits: splits.reverse(), burns: burns.reverse(), totalBurned: burns.reduce((a, b) => a + b.tokenOut, 0) }
}

export function useProof() {
  const client = usePublicClient()
  const live = useLive()
  return useQuery({
    queryKey: ['proof', live],
    queryFn: async (): Promise<Proof> => {
      if (!live || !client) return { splits: demo.SPLITS, burns: demo.BURNS, totalBurned: demo.BURNS.reduce((a, b) => a + b.tokenOut, 0) }
      return viaIndexer('/proof', () => proofFromChain(client), (x) => {
        const p = x as { splits: Split[]; burns: Burn[]; totals: { burned: number } }
        return { splits: p.splits, burns: p.burns, totalBurned: p.totals.burned }
      })
    },
    refetchInterval: live ? 10_000 : false,
  })
}

export type Stats = { volumeEth: number; feesEth: number; openInterestEth: number; burnedTokens: number; stakedTokens: number; stakers: number; activeOffers: number }

export function useStats() {
  const live = useLive()
  const offers = useOffers()
  const proof = useProof()
  const stake = useStake()
  return useQuery({
    queryKey: ['stats', live, offers.data?.length, proof.data?.splits.length, stake.data?.totalStaked],
    queryFn: async (): Promise<Stats> => {
      if (!live) return demo.STATS
      const compute = async (): Promise<Stats> => {
        const list = offers.data ?? []
        const settled = list.filter((o) => ['filled', 'exercised', 'expired'].includes(o.status))
        return {
          volumeEth: settled.reduce((a, o) => a + o.premium, 0) + list.filter((o) => o.status === 'exercised').reduce((a, o) => a + o.strike, 0),
          feesEth: (proof.data?.splits ?? []).reduce((a, s) => a + s.stakers + s.buyback + s.ops, 0),
          openInterestEth: list.filter((o) => o.status === 'filled').reduce((a, o) => a + o.strike, 0),
          burnedTokens: proof.data?.totalBurned ?? 0,
          stakedTokens: stake.data?.totalStaked ?? 0,
          stakers: 0,
          activeOffers: list.filter((o) => isFillable(o)).length,
        }
      }
      return viaIndexer('/stats', compute)
    },
    refetchInterval: live ? 10_000 : false,
  })
}

// ------------------------------------------------------------------ live feed + chain pulse (indexer only)

export type Activity = {
  key: string; name: string; at: number; tx: string; kind: string; text: string; sub: string
  // Option events carry the offer behind them (fee, burn and stake events do not).
  id?: string; symbol?: string; token?: string; amount?: number; strike?: number; premium?: number
  seller?: string; holder?: string | null; expiry?: number; actor?: string
}

/** Chain events, newest first. `symbol` keeps only that market's option events (filtered by the indexer). */
export function useActivity(limit = 30, symbol?: string) {
  const live = useLive()
  return useQuery({
    queryKey: ['activity', live, limit, symbol ?? ''],
    queryFn: async (): Promise<Activity[]> => {
      if (!live) {
        const now = Math.floor(Date.now() / 1000)
        return demo.OFFERS.filter((o) => !symbol || o.symbol === symbol).slice(0, limit).map((o, i) => ({
          key: `demo-${o.id}`, name: 'OfferCreated', at: now - i * 137, tx: '0x' + String(o.id).padStart(64, '0'), kind: o.kind,
          text: `New ${o.kind}: ${o.amount.toLocaleString('en-US')} ${o.symbol} @ ${o.strike} ETH`, sub: `premium ${o.premium} ETH`,
          id: String(o.id), symbol: o.symbol, amount: o.amount, strike: o.strike, premium: o.premium, seller: o.seller, actor: o.seller,
        }))
      }
      if (!INDEXER_URL) return []
      return api<Activity[]>(`/activity?limit=${limit}${symbol ? `&token=${encodeURIComponent(symbol)}` : ''}`)
    },
    refetchInterval: live ? 6_000 : false,
  })
}

export function useHealth() {
  const client = usePublicClient()
  const live = useLive()
  return useQuery({
    queryKey: ['health', live],
    queryFn: async (): Promise<{ lastBlock: number; chainTime: number; fetchedAt: number }> => {
      const fetchedAt = Date.now() / 1000
      if (!live) return { lastBlock: 0, chainTime: fetchedAt, fetchedAt }
      if (INDEXER_URL) {
        try {
          const h = await api<{ lastBlock: number; chainTime: number }>('/health')
          return { lastBlock: h.lastBlock, chainTime: h.chainTime, fetchedAt }
        } catch {}
      }
      const b = await client!.getBlock()
      return { lastBlock: Number(b.number), chainTime: Number(b.timestamp), fetchedAt }
    },
    refetchInterval: live ? 10_000 : false,
  })
}

// ------------------------------------------------------------------ price feed (Uniswap v4 swaps via the indexer)

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number }
export type Marker = { time: number; name: 'OfferCreated' | 'OptionBought' | 'Exercised' | 'Expired' | 'OfferCancelled'; kind: Kind; tx: string; strikePerToken: number }
export type Quote = { price: number; at: number; change1h: number; source?: 'uniswap-v4' | 'robinhood' | 'dexscreener' }

export function useCandles(symbol: string, interval = 60) {
  const live = useLive()
  return useQuery({
    queryKey: ['candles', live, symbol, interval],
    queryFn: async (): Promise<Candle[]> => {
      if (!live || !INDEXER_URL) return []
      return api<Candle[]>(`/candles?token=${encodeURIComponent(symbol)}&interval=${interval}&limit=500`)
    },
    refetchInterval: live ? 10_000 : false,
    placeholderData: (prev) => prev,
  })
}

export function useMarkers(symbol: string) {
  const live = useLive()
  return useQuery({
    queryKey: ['markers', live, symbol],
    queryFn: async (): Promise<Marker[]> => (!live || !INDEXER_URL ? [] : api<Marker[]>(`/markers?token=${encodeURIComponent(symbol)}`)),
    refetchInterval: live ? 8_000 : false,
  })
}

export function usePrices() {
  const live = useLive()
  return useQuery({
    queryKey: ['prices', live],
    queryFn: async (): Promise<Record<string, Quote>> => (!live || !INDEXER_URL ? {} : api<Record<string, Quote>>('/prices')),
    refetchInterval: live ? 10_000 : false,
  })
}

/** Call after a confirmed transaction so every page refreshes. */
export function useRefresh() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}
