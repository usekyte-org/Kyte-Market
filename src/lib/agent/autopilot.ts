// Autopilot rule schema shared by the Autopilot page and the agent tools. Mirrors indexer/src/autopilot.mjs.
import { z } from 'zod'

export const RULE_TYPES = ['list_call', 'list_put', 'buy_call', 'buy_put', 'exercise', 'cancel_unfilled'] as const
export type RuleType = (typeof RULE_TYPES)[number]

export const RuleSchema = z.object({
  type: z.enum(RULE_TYPES),
  token: z.string().regex(/^[A-Za-z0-9]{1,16}$/).optional().describe('Token symbol; required for list_* and buy_*'),
  params: z.object({
    amount: z.number().positive().optional().describe('list_*: tokens per offer'),
    pct: z.number().min(0).max(500).optional().describe('list_call: % above spot; list_put: % below spot'),
    minPremiumEth: z.number().min(0.0005).optional().describe('list_*: premium floor in ETH (protocol minimum 0.0005)'),
    expirySec: z.number().int().min(3600).max(90 * 86400).optional().describe('list_*: option lifetime in seconds'),
    fillWindowSec: z.number().int().min(600).max(90 * 86400).optional().describe('list_*: how long the offer stays open'),
    maxPremiumOverStrike: z.number().min(0.0001).max(1).optional().describe('buy_*: premium as a fraction of strike, e.g. 0.03'),
    maxStrikeVsSpotPct: z.number().min(0).max(500).optional().describe('buy_*: strike may differ from spot by at most this %'),
    maxPremiumEth: z.number().min(0.0005).optional().describe('buy_*: never pay more than this per option'),
    minHoursToExpiry: z.number().min(0).max(2160).optional().describe('buy_*: skip offers closer to expiry than this'),
    marginPct: z.number().min(0).max(500).optional().describe('exercise: how far in the money before triggering'),
    minHoursBeforeExpiry: z.number().min(0).max(2160).optional().describe('exercise: never trigger closer to expiry than this'),
    maxHoursBeforeExpiry: z.number().min(0).max(2160).optional().describe('exercise: only trigger inside this window'),
    afterHours: z.number().min(1).max(2160).optional().describe('cancel_unfilled: cancel offers unfilled after this many hours'),
  }),
  schedule: z.object({ repeat: z.boolean().default(false), until: z.number().int().optional(), maxRuns: z.number().int().min(1).optional(), cooldownSec: z.number().int().min(0).optional() }).default({ repeat: false }),
  limits: z.object({ maxExposureTokens: z.number().min(0).optional(), maxPremiumEthPerDay: z.number().min(0).optional(), maxTotalRiskEth: z.number().min(0).optional() }).default({}),
  note: z.string().max(140).optional().describe('One line in the user\'s words, shown on the card'),
})
export type Rule = z.infer<typeof RuleSchema>

/** Short human description of a rule, used on cards and in the agent's previews. */
export function describeRule(r: Rule): string {
  const p = r.params
  const days = (s?: number) => (s ? `${Math.round(s / 86400) || 1} day${Math.round(s / 86400) === 1 ? '' : 's'}` : '')
  switch (r.type) {
    case 'list_call': return `List a covered call on ${p.amount} ${r.token} at ${p.pct}% above spot, premium at least ${p.minPremiumEth} ETH, ${days(p.expirySec)} expiry${r.schedule.repeat ? ', again after each settlement' : ''}.`
    case 'list_put': return `List a cash-secured put on ${p.amount} ${r.token} at ${p.pct}% below spot, premium at least ${p.minPremiumEth} ETH, ${days(p.expirySec)} expiry${r.schedule.repeat ? ', again after each settlement' : ''}.`
    case 'buy_call': case 'buy_put': return `Flag ${r.type === 'buy_call' ? 'calls' : 'puts'} on ${r.token} priced under ${((p.maxPremiumOverStrike ?? 0) * 100).toFixed(1)}% of strike, strike within ${p.maxStrikeVsSpotPct}% of spot, premium up to ${p.maxPremiumEth} ETH${p.minHoursToExpiry ? `, at least ${p.minHoursToExpiry} h to expiry` : ''}.`
    case 'exercise': return `Flag any held option that is ${p.marginPct}% or more in the money, from ${p.maxHoursBeforeExpiry ?? '∞'} down to ${p.minHoursBeforeExpiry} hours before expiry.`
    case 'cancel_unfilled': return `Flag offers of mine still unfilled after ${p.afterHours} hours, to cancel and reclaim collateral.`
  }
}

/** The message a wallet signs to create, pause, resume or delete a rule; the indexer verifies the same string. */
export const signMessageFor = (action: string, address: string, timestamp: number, payloadHash: string) => `Kyte Autopilot\n${action}\n${address}\n${timestamp}\n${payloadHash}`

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Encode a rule into the Autopilot page link the agent hands out. */
export function ruleLink(site: string, rule: Rule): string {
  return `${site}/autopilot?rule=${encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(rule)))))}`
}
