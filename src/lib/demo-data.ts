// Simulated data so every page can be built before the contracts and indexer exist.
// Shapes mirror the indexer tables in the indexer notes; swap the imports, keep the components.

export type Kind = 'call' | 'put'
export type Status = 'open' | 'filled' | 'exercised' | 'expired' | 'cancelled'

export type Asset = {
  symbol: string
  name: string
  address: `0x${string}`
  decimals: number
  spotEth: number // price of 1 token in ETH (display only)
  vol: number // annualized realized vol
  putsEnabled: boolean
}

export type Offer = {
  id: number
  kind: Kind
  seller: `0x${string}`
  buyer?: `0x${string}`
  symbol: string
  amount: number // tokens
  strike: number // total ETH to exercise the whole lot
  premium: number // total ETH to fill
  expiry: number // unix sec
  offerDeadline: number
  status: Status
}

export type Split = { epoch: number; at: number; tx: string; stakers: number; buyback: number; ops: number }
export type Burn = { at: number; tx: string; wethIn: number; tokenOut: number }

const HOUR = 3600
const DAY = 24 * HOUR
// Anchor to the hour so server and client renders agree.
export const DEMO_NOW = Math.floor(Date.now() / 1000 / HOUR) * HOUR

export const ASSETS: Asset[] = [
  { symbol: 'ZEPH', name: 'Zephyr', address: '0x1000000000000000000000000000000000000001', decimals: 18, spotEth: 0.000042, vol: 1.6, putsEnabled: true },
  { symbol: 'GALE', name: 'Gale', address: '0x1000000000000000000000000000000000000002', decimals: 18, spotEth: 0.0013, vol: 1.1, putsEnabled: true },
  { symbol: 'BREZ', name: 'Breeze', address: '0x1000000000000000000000000000000000000003', decimals: 18, spotEth: 0.0000071, vol: 2.2, putsEnabled: false },
  { symbol: 'NIMB', name: 'Nimbus', address: '0x1000000000000000000000000000000000000004', decimals: 6, spotEth: 0.00031, vol: 1.3, putsEnabled: true },
]

const W = (n: number) => `0x${n.toString(16).padStart(4, '0')}${'ab'.repeat(18)}` as `0x${string}`

export const DEMO_WALLET = W(7)

function o(
  id: number, kind: Kind, seller: number, symbol: string, amount: number, strikeMult: number,
  premiumPct: number, expiresIn: number, status: Status = 'open', buyer?: number,
): Offer {
  const a = ASSETS.find((x) => x.symbol === symbol)!
  const strike = amount * a.spotEth * strikeMult
  const expiry = DEMO_NOW + expiresIn
  return {
    id, kind, seller: W(seller), buyer: buyer === undefined ? undefined : W(buyer), symbol, amount,
    strike: round(strike), premium: round(Math.max(0.0005, strike * premiumPct)),
    expiry, offerDeadline: Math.min(expiry, DEMO_NOW + Math.min(expiresIn, 2 * DAY)), status,
  }
}

function round(n: number) {
  return Number(n.toPrecision(4))
}

export const OFFERS: Offer[] = [
  o(1, 'call', 1, 'ZEPH', 200_000, 1.25, 0.06, 3 * DAY),
  o(2, 'call', 2, 'GALE', 2_000, 1.1, 0.08, 7 * DAY),
  o(3, 'put', 3, 'GALE', 1_500, 0.85, 0.07, 5 * DAY),
  o(4, 'call', 4, 'BREZ', 1_200_000, 1.5, 0.05, 1 * DAY),
  o(5, 'call', 5, 'NIMB', 12_000, 1.2, 0.04, 14 * DAY),
  o(6, 'put', 1, 'ZEPH', 150_000, 0.8, 0.05, 2 * DAY),
  o(7, 'call', 6, 'GALE', 800, 1.35, 0.03, 30 * DAY),
  o(8, 'put', 2, 'NIMB', 6_000, 0.9, 0.06, 10 * DAY),
  o(9, 'call', 3, 'ZEPH', 100_000, 2, 0.02, 12 * HOUR),
  // the demo wallet's own positions
  o(20, 'call', 7, 'GALE', 1_000, 1.2, 0.05, 6 * DAY),
  o(21, 'call', 2, 'ZEPH', 120_000, 1.15, 0.06, 4 * DAY, 'filled', 7),
  o(22, 'put', 5, 'NIMB', 5_000, 0.9, 0.05, 9 * DAY, 'filled', 7),
  o(23, 'call', 7, 'BREZ', 800_000, 1.4, 0.05, 2 * DAY, 'filled', 4),
  o(24, 'call', 7, 'ZEPH', 60_000, 1.3, 0.05, -1 * DAY, 'open'),
]

export const SPLITS: Split[] = Array.from({ length: 8 }, (_, i) => {
  const total = [0.84, 1.12, 0.67, 1.48, 0.93, 1.31, 0.58, 1.05][i]
  return {
    epoch: 120 - i,
    at: DEMO_NOW - i * DAY - 2 * HOUR,
    tx: `0x${(0xa11ce + i).toString(16).padStart(64, '0')}`,
    stakers: round(total * 0.3),
    buyback: round(total * 0.2),
    ops: round(total * 0.5),
  }
})

export const BURNS: Burn[] = SPLITS.flatMap((s, i) => [
  { at: s.at + 3 * HOUR, tx: `0x${(0xb0b0 + i * 2).toString(16).padStart(64, '0')}`, wethIn: round(s.buyback / 2), tokenOut: Math.round(s.buyback * 1_900_000) },
  { at: s.at + 9 * HOUR, tx: `0x${(0xb0b1 + i * 2).toString(16).padStart(64, '0')}`, wethIn: round(s.buyback / 2), tokenOut: Math.round(s.buyback * 1_850_000) },
])

export const STATS = {
  volumeEth: 412.6,
  feesEth: 13.94,
  openInterestEth: 96.3,
  burnedTokens: BURNS.reduce((a, b) => a + b.tokenOut, 0),
  stakedTokens: 182_400_000,
  stakers: 1_284,
  activeOffers: OFFERS.filter((x) => x.status === 'open' && x.offerDeadline > DEMO_NOW).length,
}

export const STAKE = {
  epoch: 121,
  epochEndsAt: Math.ceil(DEMO_NOW / DAY) * DAY,
  myActive: 2_500_000,
  myPending: 500_000,
  myClaimableEth: 0.0182,
  walletBalance: 7_250_000,
  minClaimEth: 0.001,
}

export function asset(symbol: string): Asset {
  return ASSETS.find((a) => a.symbol === symbol)!
}

export function isFillable(x: Offer, now = DEMO_NOW): boolean {
  return x.status === 'open' && now <= x.offerDeadline
}
