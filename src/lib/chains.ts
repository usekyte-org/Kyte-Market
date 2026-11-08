import { defineChain, type Address, type Chain } from 'viem'
import { robinhood, robinhoodTestnet } from 'viem/chains'
import deployments from './generated/deployments.json'

// Official endpoints from https://docs.robinhood.com/chain/connecting.
const OFFICIAL_RPC: Record<number, string> = {
  4663: 'https://rpc.mainnet.chain.robinhood.com',
  46630: 'https://rpc.testnet.chain.robinhood.com',
}

/** Local anvil devnet (`contracts/script/DeployDevnet.s.sol`). Port 8547: 8545 is used by another project. */
export const kyteDevnet = defineChain({
  id: 31337,
  name: 'Kyte Devnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8547'] } },
  testnet: true,
})

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 4663)

function withRpc(base: Chain): Chain {
  const rpc = process.env.NEXT_PUBLIC_RPC_URL || OFFICIAL_RPC[base.id] || base.rpcUrls.default.http[0]
  return { ...base, rpcUrls: { default: { http: [rpc] } } }
}

export const chain: Chain = withRpc(CHAIN_ID === 4663 ? robinhood : CHAIN_ID === 31337 ? kyteDevnet : robinhoodTestnet)
export const isDevnet = chain.id === 31337

export function explorerTx(hash: string): string | undefined {
  const url = chain.blockExplorers?.default.url
  return url ? `${url}/tx/${hash}` : undefined
}

export function explorerAddress(address: string): string | undefined {
  const url = chain.blockExplorers?.default.url
  return url ? `${url}/address/${address}` : undefined
}

/** Blockscout page of one NFT: the option's on-chain art, traits and owner. */
export function explorerNft(nft: string, id: bigint): string | undefined {
  const url = chain.blockExplorers?.default.url
  return url ? `${url}/token/${nft}/instance/${id.toString()}` : undefined
}

export type ProtocolContracts = {
  weth?: Address
  callMarket?: Address
  putMarket?: Address
  optionNft?: Address
  assetRegistry?: Address
  feeVault?: Address
  stakingPool?: Address
  buybackBurner?: Address
  router?: Address
  kyteToken?: Address
  opsSafe?: Address
  uniswapV4PoolManager?: Address
  uniswapV4SwapRouter?: Address
  kyteHook?: Address
  swapAdapter?: Address
  /** Governance: the timelock lists and re-enables; the guardian Safe pauses and disables instantly. */
  timelock?: Address
  guardian?: Address
  tokens?: Record<string, Address>
  /** Block the protocol was deployed at; chain log reads start here. */
  deployBlock?: number
  /** Markets v2: registry with room for every Robinhood Stock Token, plus new NFT, markets and router. */
  v2?: MarketSection
  /** Markets v3: new NFT (readable on-chain art), markets and router; reuses the v2 registry. */
  v3?: MarketSection
}
type MarketSection = Pick<ProtocolContracts, 'assetRegistry' | 'optionNft' | 'callMarket' | 'putMarket' | 'router'> & { fromBlock?: number }

export type MarketSet = Required<Pick<ProtocolContracts, 'assetRegistry' | 'optionNft' | 'callMarket' | 'putMarket' | 'router'>>

// External addresses verified for Robinhood Chain (the deployment notes). Our own contracts come from
// contracts/deployments/<chainId>.json via `node scripts/sync-contracts.mjs`.
const EXTERNAL: Record<number, ProtocolContracts> = {
  4663: { weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' },
  46630: {},
  31337: {},
}

const deployed = (deployments as Record<string, ProtocolContracts>)[String(CHAIN_ID)] ?? {}
const pickMarkets = (c: ProtocolContracts) =>
  ({ assetRegistry: c.assetRegistry!, optionNft: c.optionNft!, callMarket: c.callMarket!, putMarket: c.putMarket!, router: c.router! }) as MarketSet
/** Every market set on this chain, oldest first. `minTag`: position ids carry `tag << 248`, v1 tags 1/2, v2 3/4, v3 5/6. */
const VERSIONS: { version: number; minTag: bigint; set: ProtocolContracts }[] = [
  { version: 1, minTag: 1n, set: deployed },
  ...(deployed.v2?.callMarket ? [{ version: 2, minTag: 3n, set: { ...deployed, ...deployed.v2 } }] : []),
  ...(deployed.v3?.callMarket ? [{ version: 3, minTag: 5n, set: { ...deployed, ...deployed.v2, ...deployed.v3 } }] : []),
]
/** Older market sets: they still settle (buy, exercise, cancel, expire) every position they hold. Newest first. */
export const settlingMarkets: { version: number; markets: MarketSet }[] = VERSIONS.slice(0, -1)
  .reverse()
  .map((v) => ({ version: v.version, markets: pickMarkets(v.set) }))
/** v1 markets once a newer set is live (null before that). */
export const legacyMarkets: MarketSet | null = VERSIONS.length > 1 ? pickMarkets(deployed) : null
/** Version of the current markets (1, 2 or 3). */
export const marketsVersion = VERSIONS[VERSIONS.length - 1].version
/** `contracts.callMarket` etc. are the current (newest) markets: new offers and listings go there. */
export const contracts: ProtocolContracts = { ...EXTERNAL[CHAIN_ID], ...VERSIONS[VERSIONS.length - 1].set }
/** The market set a position lives in, from its id's version tag (`id >> 248`). */
export function marketsFor(id: bigint): MarketSet {
  const tag = id >> 248n
  for (let i = VERSIONS.length - 1; i > 0; i--) if (tag >= VERSIONS[i].minTag) return pickMarkets(VERSIONS[i].set)
  return pickMarkets(VERSIONS[0].set)
}
export const contractsLive = Boolean(contracts.callMarket && contracts.putMarket && contracts.weth)
export const DEPLOY_BLOCK = BigInt(contracts.deployBlock ?? 0)

/** Listed tokens known to the site: symbol → address. */
export const TOKENS: Record<string, Address> = contracts.tokens ?? {}
