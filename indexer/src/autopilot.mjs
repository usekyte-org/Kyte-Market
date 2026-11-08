// Kyte Autopilot, mode A (watch and prepare): rules a user signs, triggers the indexer raises when a rule's
// condition holds. Nothing here moves funds; a trigger is a prepared kyte.sh link the user reviews and signs.
// See docs/AUTOPILOT_the protocol spec.
import { createHash } from 'node:crypto'
import { getAddress, isAddress } from 'viem'

const MAX_RULES = 20
const SIGNATURE_WINDOW_S = 600
const TYPES = new Set(['list_call', 'list_put', 'buy_call', 'buy_put', 'exercise', 'cancel_unfilled'])

export const MESSAGE = (action, address, timestamp, ruleHash) => `Kyte Autopilot\n${action}\n${address}\n${timestamp}\n${ruleHash}`
export const hashRule = (rule) => createHash('sha256').update(JSON.stringify(rule)).digest('hex')

class BadRule extends Error {}
const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
function validateRule(rule) {
  if (!rule || typeof rule !== 'object') throw new BadRule('rule must be an object')
  if (!TYPES.has(rule.type)) throw new BadRule('unknown rule type')
  const p = rule.params ?? {}
  const needToken = rule.type !== 'exercise' && rule.type !== 'cancel_unfilled'
  if (needToken && !/^[A-Za-z0-9]{1,16}$/.test(rule.token ?? '')) throw new BadRule('token symbol required')
  switch (rule.type) {
    case 'list_call':
    case 'list_put':
      if (!num(p.amount, 1e-9, 1e12)) throw new BadRule('params.amount')
      if (!num(p.pct, 0, 500)) throw new BadRule('params.pct (percent above spot for calls, below for puts)')
      if (!num(p.minPremiumEth, 0.0005, 1000)) throw new BadRule('params.minPremiumEth (at least 0.0005)')
      if (!num(p.expirySec, 3600, 90 * 86400)) throw new BadRule('params.expirySec (1 hour to 90 days)')
      if (!num(p.fillWindowSec, 600, 90 * 86400)) throw new BadRule('params.fillWindowSec')
      break
    case 'buy_call':
    case 'buy_put':
      if (!num(p.maxPremiumOverStrike, 0.0001, 1)) throw new BadRule('params.maxPremiumOverStrike (fraction of strike)')
      if (!num(p.maxStrikeVsSpotPct, 0, 500)) throw new BadRule('params.maxStrikeVsSpotPct')
      if (!num(p.maxPremiumEth, 0.0005, 1000)) throw new BadRule('params.maxPremiumEth')
      if (p.minHoursToExpiry !== undefined && !num(p.minHoursToExpiry, 0, 2160)) throw new BadRule('params.minHoursToExpiry')
      break
    case 'exercise':
      if (!num(p.marginPct, 0, 500)) throw new BadRule('params.marginPct')
      if (!num(p.minHoursBeforeExpiry, 0, 2160)) throw new BadRule('params.minHoursBeforeExpiry')
      break
    case 'cancel_unfilled':
      if (!num(p.afterHours, 1, 2160)) throw new BadRule('params.afterHours')
      break
  }
  const s = rule.schedule ?? {}
  if (s.until !== undefined && !num(s.until, 0, 4e9)) throw new BadRule('schedule.until')
  if (s.maxRuns !== undefined && !num(s.maxRuns, 1, 10000)) throw new BadRule('schedule.maxRuns')
  if (s.cooldownSec !== undefined && !num(s.cooldownSec, 0, 90 * 86400)) throw new BadRule('schedule.cooldownSec')
  const l = rule.limits ?? {}
  for (const k of ['maxExposureTokens', 'maxPremiumEthPerDay', 'maxTotalRiskEth']) if (l[k] !== undefined && !num(l[k], 0, 1e12)) throw new BadRule(`limits.${k}`)
  return { type: rule.type, token: needToken ? rule.token : null, params: p, schedule: { repeat: Boolean(s.repeat), until: s.until ?? null, maxRuns: s.maxRuns ?? null, cooldownSec: s.cooldownSec ?? 0 }, limits: l, note: typeof rule.note === 'string' ? rule.note.slice(0, 140) : '' }
}

/**
 * Wire the autopilot into the indexer: tables, routes, the evaluator.
 * deps: { db, all, client, routes, offerOut, site, log }
 *   all(sql, ...params) -> rows; client: viem public client (verifyMessage); routes['/prices'] gives the price map.
 */
export function installAutopilot({ db, all, client, routes, offerOut, site, ponsLimit, log = console.log }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS autopilot_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT, type TEXT, token TEXT,
      rule TEXT, status TEXT, runs INTEGER DEFAULT 0, created_at INTEGER, last_check INTEGER, last_trigger INTEGER);
    CREATE INDEX IF NOT EXISTS autopilot_rules_addr ON autopilot_rules(address, status);
    CREATE TABLE IF NOT EXISTS autopilot_triggers (id INTEGER PRIMARY KEY AUTOINCREMENT, rule_id INTEGER, address TEXT, target TEXT,
      at INTEGER, label TEXT, preview TEXT, link TEXT, seen INTEGER DEFAULT 0, UNIQUE(rule_id, target));
    CREATE INDEX IF NOT EXISTS autopilot_triggers_addr ON autopilot_triggers(address, at DESC);
  `)
  const ins = db.prepare('INSERT INTO autopilot_rules(address, type, token, rule, status, created_at) VALUES(?,?,?,?,?,?)')
  const setStatus = db.prepare('UPDATE autopilot_rules SET status = ? WHERE id = ? AND address = ?')
  const touch = db.prepare('UPDATE autopilot_rules SET last_check = ? WHERE id = ?')
  const fired = db.prepare('UPDATE autopilot_rules SET runs = runs + 1, last_trigger = ? WHERE id = ?')
  const insTrig = db.prepare('INSERT OR IGNORE INTO autopilot_triggers(rule_id, address, target, at, label, preview, link) VALUES(?,?,?,?,?,?,?)')
  const seen = db.prepare('UPDATE autopilot_triggers SET seen = 1 WHERE id = ? AND address = ?')

  const ruleOut = (r) => ({ id: r.id, address: r.address, type: r.type, token: r.token, ...JSON.parse(r.rule), status: r.status, runs: r.runs, createdAt: r.created_at, lastCheck: r.last_check, lastTrigger: r.last_trigger })
  const trigOut = (t) => ({ id: t.id, ruleId: t.rule_id, target: t.target, at: t.at, label: t.label, preview: t.preview, link: t.link, seen: Boolean(t.seen) })

  async function verify(action, address, timestamp, ruleHash, signature) {
    if (!isAddress(address)) throw new BadRule('bad address')
    if (!Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > SIGNATURE_WINDOW_S) throw new BadRule('signature expired; sign again')
    if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130,}$/.test(signature)) throw new BadRule('bad signature')
    const ok = await client.verifyMessage({ address: getAddress(address), message: MESSAGE(action, getAddress(address), timestamp, ruleHash), signature }).catch(() => false)
    if (!ok) throw new BadRule('signature does not match the address')
    return getAddress(address)
  }

  // ---- routes (GET read, POST/DELETE signed)
  const api = {
    async listRules(address) {
      return all('SELECT * FROM autopilot_rules WHERE address = ? AND status != ? ORDER BY id DESC', getAddress(address), 'deleted').map(ruleOut)
    },
    async listTriggers(address, limit = 50) {
      return all('SELECT * FROM autopilot_triggers WHERE address = ? ORDER BY at DESC LIMIT ?', getAddress(address), limit).map(trigOut)
    },
    async createRule(body) {
      const rule = validateRule(body.rule)
      const addr = await verify('create', body.address, body.timestamp, hashRule(body.rule), body.signature)
      const n = all('SELECT COUNT(*) AS n FROM autopilot_rules WHERE address = ? AND status = ?', addr, 'active')[0].n
      if (n >= MAX_RULES) throw new BadRule(`at most ${MAX_RULES} active rules per address`)
      const r = ins.run(addr, rule.type, rule.token, JSON.stringify(rule), 'active', Math.floor(Date.now() / 1000))
      log(`[autopilot] rule ${r.lastInsertRowid} ${rule.type} ${rule.token ?? ''} for ${addr}`)
      return ruleOut(all('SELECT * FROM autopilot_rules WHERE id = ?', r.lastInsertRowid)[0])
    },
    async setRuleStatus(body, status) {
      const addr = await verify(status, body.address, body.timestamp, String(body.id), body.signature)
      setStatus.run(status, Number(body.id), addr)
      return { ok: true }
    },
    async markSeen(id, address) {
      seen.run(Number(id), getAddress(address))
      return { ok: true }
    },
  }

  // ---- evaluator: one pass over active rules
  const hoursLeft = (ts, now) => (ts - now) / 3600
  const fmt = (n, d = 6) => Number(n.toFixed(d))
  function sellLink(kind, token, amount, strike, premium, expiry, deadline) {
    const qs = new URLSearchParams({ kind, token, amount: String(amount), strike: String(strike), premium: String(premium), expiry: String(expiry), deadline: String(deadline) })
    return `${site}/sell?${qs}`
  }
  async function evaluate() {
    const now = Math.floor(Date.now() / 1000)
    const rules = all('SELECT * FROM autopilot_rules WHERE status = ?', 'active')
    if (rules.length === 0) return 0
    const prices = await routes['/prices']()
    const assets = all('SELECT * FROM assets WHERE enabled = 1')
    const bySym = Object.fromEntries(assets.map((a) => [a.symbol.toLowerCase(), a]))
    let fired_ = 0
    for (const r of rules) {
      touch.run(now, r.id)
      const rule = JSON.parse(r.rule)
      const s = rule.schedule
      if ((s.until && now > s.until) || (s.maxRuns && r.runs >= s.maxRuns)) { setStatus.run('expired', r.id, r.address); continue }
      if (s.cooldownSec && r.last_trigger && now - r.last_trigger < s.cooldownSec) continue
      const emit = (target, label, preview, link) => {
        const res = insTrig.run(r.id, r.address, target, now, label, preview, link)
        if (res.changes > 0) { fired.run(now, r.id); fired_ += 1; log(`[autopilot] trigger rule ${r.id}: ${label}`) }
      }
      const p = rule.params
      const asset = rule.token ? bySym[rule.token.toLowerCase()] : null
      const spot = rule.token ? prices[rule.token]?.price ?? prices[asset?.symbol]?.price : undefined
      if (rule.type === 'list_call' || rule.type === 'list_put') {
        if (!asset || !spot) continue
        if (rule.type === 'list_put' && !asset.puts_enabled) continue
        const kind = rule.type === 'list_call' ? 'call' : 'put'
        const open = all('SELECT id FROM offers WHERE seller = ? AND symbol = ? AND kind = ? AND status = ?', r.address, asset.symbol, kind, 'open')
        if (open.length > 0) continue
        if (!s.repeat && r.runs > 0) { setStatus.run('expired', r.id, r.address); continue }
        const strike = kind === 'call' ? spot * (1 + p.pct / 100) : spot * (1 - p.pct / 100)
        const minStrike = Number(asset.min_strike) / 1e18
        const strikePer = Math.max(strike, minStrike)
        const premium = p.minPremiumEth
        const maxDur = ponsLimit?.(asset.address) ?? 90 * 86400 // 24 h on Pons tokens
        const expirySec = Math.min(p.expirySec, maxDur)
        // the target changes every time a previous offer settles, so a new listing can trigger again
        const target = `list:${open.length}:${r.runs}`
        emit(target, `List a ${kind} on ${p.amount} ${asset.symbol}`, `Spot is ${fmt(spot, 8)} ETH. Strike ${fmt(strikePer, 8)} ETH per token (${p.pct}% ${kind === 'call' ? 'above' : 'below'} spot${strikePer > strike ? ', raised to the token minimum' : ''}), premium ${premium} ETH, expires in ${expirySec >= 86400 ? Math.round(expirySec / 86400) + ' day' + (Math.round(expirySec / 86400) === 1 ? '' : 's') : Math.round(expirySec / 3600) + ' h'}${expirySec < p.expirySec ? ' (capped at 24 h: launchpad token)' : ''}.`, sellLink(kind, asset.symbol, p.amount, fmt(strikePer, 10), premium, expirySec, Math.min(p.fillWindowSec, expirySec)))
      } else if (rule.type === 'buy_call' || rule.type === 'buy_put') {
        if (!asset || !spot) continue
        const kind = rule.type === 'buy_call' ? 'call' : 'put'
        const offers = all('SELECT * FROM offers WHERE symbol = ? AND kind = ? AND status = ? AND deadline > ?', asset.symbol, kind, 'open', now).map(offerOut).filter((o) => o.fillable && o.seller.toLowerCase() !== r.address.toLowerCase())
        for (const o of offers) {
          const strikePer = o.strike / o.amount
          const vsSpot = Math.abs(strikePer / spot - 1) * 100
          const hrs = hoursLeft(o.expiry, now)
          if (o.premium / o.strike > p.maxPremiumOverStrike || vsSpot > p.maxStrikeVsSpotPct || o.premium > p.maxPremiumEth || (p.minHoursToExpiry && hrs < p.minHoursToExpiry)) continue
          emit(`buy:${o.id}`, `Buy ${kind} on ${o.amount} ${asset.symbol} for ${fmt(o.premium)} ETH`, `Strike ${fmt(strikePer, 8)} ETH per token (${fmt(strikePer / spot * 100 - 100, 1)}% vs spot), premium ${fmt(o.premium)} ETH (${fmt(o.premium / o.strike * 100, 2)}% of strike), expires in ${fmt(hrs, 1)} h. Matches your buy rule.`, `${site}/market?buy=${o.id}`)
        }
      } else if (rule.type === 'exercise') {
        const held = all('SELECT * FROM offers WHERE holder = ? AND status = ?', r.address, 'filled').map(offerOut)
        for (const o of held) {
          const sp = prices[o.symbol]?.price
          if (!sp) continue
          const strikePer = o.strike / o.amount
          const hrs = hoursLeft(o.expiry, now)
          if (hrs < p.minHoursBeforeExpiry || (p.maxHoursBeforeExpiry && hrs > p.maxHoursBeforeExpiry)) continue
          const itm = o.kind === 'call' ? sp >= strikePer * (1 + p.marginPct / 100) : sp <= strikePer * (1 - p.marginPct / 100)
          if (!itm) continue
          emit(`exercise:${o.id}`, `Exercise your ${o.kind} on ${o.amount} ${o.symbol}`, `Spot ${fmt(sp, 8)} ETH vs strike ${fmt(strikePer, 8)} per token: in the money by ${fmt(Math.abs(sp / strikePer - 1) * 100, 1)}%, ${fmt(hrs, 1)} h to expiry. ${o.kind === 'call' ? `Pay ${fmt(o.strike)} ETH, receive ${o.amount} ${o.symbol}.` : `Deliver ${o.amount} ${o.symbol}, receive ${fmt(o.strike)} ETH.`}`, `${site}/positions?exercise=${o.id}`)
        }
      } else if (rule.type === 'cancel_unfilled') {
        const open = all('SELECT * FROM offers WHERE seller = ? AND status = ?', r.address, 'open').map(offerOut)
        for (const o of open) {
          if (now - o.createdAt < p.afterHours * 3600) continue
          emit(`cancel:${o.id}`, `Cancel your unfilled ${o.kind} on ${o.amount} ${o.symbol}`, `Listed ${fmt((now - o.createdAt) / 3600, 1)} h ago and still unfilled. Cancelling reclaims the collateral; no fee.`, `${site}/positions?cancel=${o.id}`)
        }
      }
    }
    return fired_
  }

  return { api, evaluate, BadRule, ruleOut, trigOut }
}
