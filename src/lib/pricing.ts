// Black-Scholes premium hint. Display only: settlement never reads a price (spec §0).

// erf via Abramowitz & Stegun 7.1.26 (max error 1.5e-7).
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  return sign * (1 - poly * Math.exp(-ax * ax))
}

function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

export type BsInput = {
  spot: number // price of one token, in ETH
  strike: number // strike per token, in ETH
  years: number
  vol: number // annualized, e.g. 1.5 = 150%
  kind: 'call' | 'put'
}

/** Premium per token, in ETH. Rate is 0: these are short-dated crypto options. */
export function blackScholes({ spot, strike, years, vol, kind }: BsInput): number {
  if (spot <= 0 || strike <= 0 || years <= 0 || vol <= 0) return 0
  const sd = vol * Math.sqrt(years)
  const d1 = (Math.log(spot / strike) + (sd * sd) / 2) / sd
  const d2 = d1 - sd
  return kind === 'call'
    ? spot * normCdf(d1) - strike * normCdf(d2)
    : strike * normCdf(-d2) - spot * normCdf(-d1)
}
