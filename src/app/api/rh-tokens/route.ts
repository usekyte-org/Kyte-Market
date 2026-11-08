import { NextResponse } from 'next/server'
import { createPublicClient, fallback, formatUnits, http, parseAbiItem, type Address } from 'viem'

/**
 * Real tokens on Robinhood Chain mainnet, ranked by Uniswap v4 swap activity in the last ~hour, read straight
 * from the official RPC (no explorer key needed). Cached in memory for 5 minutes.
 */

const RPCS = ['https://rpc.mainnet.chain.robinhood.com', 'https://rpc.ordofi.network'] // official first, viem's listed fallback second
const POOL_MANAGER: Address = '0x8366a39CC670B4001A1121B8F6A443A643e40951'
const BASES: Record<string, { symbol: string; decimals: number }> = {
  '0x5fc5360d0400a0fd4f2af552add042d716f1d168': { symbol: 'USDG', decimals: 6 },
  '0x0bd7d308f8e1639fab988df18a8011f41eacad73': { symbol: 'WETH', decimals: 18 },
  '0x0000000000000000000000000000000000000000': { symbol: 'ETH', decimals: 18 },
}
const SWAP = parseAbiItem('event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)')
const INIT = parseAbiItem('event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)')
const ERC20 = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const

const SWAP_WINDOW = 36_000n // ~1 hour at 100 ms blocks
const CHUNK = 4_000n // ~1 swap per block now; the RPC refuses any query that matches over 10,000 logs
const MIN_SPLIT = 250n
const INIT_CHUNK = 1_000_000n
const INIT_MAX_CHUNKS = 8
const TTL_MS = 5 * 60_000
const COLD_WAIT_MS = 20_000

export type RhToken = { symbol: string; name: string; address: Address; pair: string; price: number | null; swaps: number; volumeBase: number }
type Payload = { updatedAt: number; fromBlock: string; toBlock: string; windowBlocks: number; tokens: RhToken[]; source: string }

let cache: { at: number; data: Payload } | null = null
const poolKeys = new Map<string, { c0: Address; c1: Address }>()
const meta = new Map<string, { symbol: string; name: string; decimals: number }>()

export const dynamic = 'force-dynamic'

let inflight: Promise<Response> | null = null

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) return NextResponse.json(cache.data)
  // One refresh at a time: a burst of requests on a cold cache must not fan out into a burst of RPC scans.
  if (!inflight) inflight = refresh().finally(() => { inflight = null })
  // Stale-while-revalidate: the RPC scan takes ~30 s, so once anything is cached, answer with it right away and
  // let the refresh finish in the background. Only the very first request after a boot waits.
  if (cache) return NextResponse.json(cache.data)
  // Cold cache: wait a bounded time. A slow RPC can stretch the scan to many minutes; past the deadline answer
  // "warming up" (the scan keeps running and fills the cache) so the page never hangs on this request.
  const timedOut = Symbol('timeout')
  const first = await Promise.race([inflight, new Promise<typeof timedOut>((r) => setTimeout(() => r(timedOut), COLD_WAIT_MS))])
  if (first === timedOut) return NextResponse.json({ error: 'warming up', tokens: [] }, { status: 503, headers: { 'retry-after': '30' } })
  return first.clone()
}

async function refresh(): Promise<Response> {
  try {
    // The public RPC rate-limits bursts: pace every log query and back off on 429.
    const client = createPublicClient({ transport: fallback(RPCS.map((u) => http(u, { timeout: 10_000, retryCount: 2, retryDelay: 1_500 })), { rank: false }) })
    const paced = async <T,>(fn: () => Promise<T>): Promise<T> => { await new Promise((r) => setTimeout(r, 350)); return fn() }
    // A busy range can still go over the RPC's 10,000-log cap (and the fallback RPC then turns that into a plain
    // fetch failure), so on any error split the range in half and retry, down to MIN_SPLIT blocks.
    const logsIn = async <E extends typeof SWAP | typeof INIT>(event: E, fromBlock: bigint, toBlock: bigint): Promise<Awaited<ReturnType<typeof client.getLogs<E>>>> => {
      try {
        return await paced(() => client.getLogs({ address: POOL_MANAGER, event, fromBlock, toBlock }))
      } catch (e) {
        if (toBlock - fromBlock < MIN_SPLIT) throw e
        const mid = fromBlock + (toBlock - fromBlock) / 2n
        return [...(await logsIn(event, fromBlock, mid)), ...(await logsIn(event, mid + 1n, toBlock))] as Awaited<ReturnType<typeof client.getLogs<E>>>
      }
    }
    const latest = await client.getBlockNumber()
    const from = latest - SWAP_WINDOW

    // 1. swaps in the window, per pool
    const perPool = new Map<string, { swaps: number; last: bigint; lastBlock: bigint; vol0: bigint; vol1: bigint }>()
    for (let a = from; a <= latest; a += CHUNK) {
      const b = a + CHUNK - 1n > latest ? latest : a + CHUNK - 1n
      const logs = await logsIn(SWAP, a, b)
      for (const l of logs) {
        const id = String(l.args.id)
        const p = perPool.get(id) ?? { swaps: 0, last: 0n, lastBlock: 0n, vol0: 0n, vol1: 0n }
        p.swaps++
        p.vol0 += abs(l.args.amount0!)
        p.vol1 += abs(l.args.amount1!)
        if (l.blockNumber >= p.lastBlock) { p.lastBlock = l.blockNumber; p.last = l.args.sqrtPriceX96! }
        perPool.set(id, p)
      }
    }
    const top = [...perPool.entries()].sort((x, y) => y[1].swaps - x[1].swaps).slice(0, 60)

    // 2. resolve pool keys (currency pair) from Initialize events, scanning back in chunks
    const unresolved = new Set(top.map(([id]) => id).filter((id) => !poolKeys.has(id)))
    for (let i = 0; i < INIT_MAX_CHUNKS && unresolved.size; i++) {
      const b = latest - INIT_CHUNK * BigInt(i)
      const a = b - INIT_CHUNK + 1n > 0n ? b - INIT_CHUNK + 1n : 0n
      const logs = await logsIn(INIT, a, b)
      for (const l of logs) {
        const id = String(l.args.id)
        if (unresolved.has(id)) { poolKeys.set(id, { c0: l.args.currency0!, c1: l.args.currency1! }); unresolved.delete(id) }
      }
      if (a === 0n) break
    }

    // 3. token metadata + price vs the base currency
    const tokens: RhToken[] = []
    const seen = new Set<string>()
    for (const [id, p] of top) {
      const key = poolKeys.get(id)
      if (!key) continue
      const c0 = key.c0.toLowerCase(), c1 = key.c1.toLowerCase()
      const base0 = BASES[c0], base1 = BASES[c1]
      if (!base0 && !base1) continue // only pairs against a known base, so the price means something
      if (base0 && base1) continue
      const tokenAddr = (base0 ? key.c1 : key.c0) as Address
      const tokenIs0 = !base0
      const base = (base0 ?? base1)!
      if (seen.has(tokenAddr.toLowerCase())) continue
      // copycat launches reuse names; keep the most active one per symbol + name
      let m = meta.get(tokenAddr.toLowerCase())
      if (!m) {
        try {
          const [symbol, name, decimals] = await Promise.all([
            client.readContract({ address: tokenAddr, abi: ERC20, functionName: 'symbol' }),
            client.readContract({ address: tokenAddr, abi: ERC20, functionName: 'name' }),
            client.readContract({ address: tokenAddr, abi: ERC20, functionName: 'decimals' }),
          ])
          m = { symbol: clean(symbol, 12), name: clean(name, 40), decimals }
          meta.set(tokenAddr.toLowerCase(), m)
        } catch { continue }
      }
      const sqrt = Number(p.last) / 2 ** 96
      const raw = sqrt * sqrt // raw1 per raw0
      const price = p.last === 0n ? null : (tokenIs0 ? raw : 1 / raw) * 10 ** m.decimals / 10 ** base.decimals
      const volumeBase = Number(formatUnits(tokenIs0 ? p.vol1 : p.vol0, base.decimals))
      const nameKey = `${m.symbol}|${m.name}`.toLowerCase()
      if (seen.has(nameKey)) continue
      seen.add(tokenAddr.toLowerCase())
      seen.add(nameKey)
      tokens.push({ symbol: m.symbol, name: m.name, address: tokenAddr, pair: base.symbol, price, swaps: p.swaps, volumeBase })
      if (tokens.length >= 12) break
    }

    const data: Payload = {
      updatedAt: Date.now(), fromBlock: String(from), toBlock: String(latest), windowBlocks: Number(SWAP_WINDOW), tokens,
      source: 'Robinhood Chain mainnet (chain 4663), Uniswap v4 PoolManager swaps via the public RPC',
    }
    cache = { at: Date.now(), data }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[rh-tokens]', (e as Error).message)
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ error: 'upstream unavailable', tokens: [] }, { status: 502 })
  }
}

const abs = (x: bigint) => (x < 0n ? -x : x)
const clean = (s: string, max: number) => s.replace(/[^\x20-\x7E]/g, '').trim().slice(0, max) || 'TOKEN'
