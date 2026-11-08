'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import { ConnectButton } from '@/components/ConnectButton'
import { PillButton } from '@/components/PillButton'
import { Note, PageHeader } from '@/components/ui'
import { INDEXER_URL } from '@/lib/data'
import { RULE_TYPES, RuleSchema, describeRule, sha256Hex, signMessageFor, type Rule } from '@/lib/agent/autopilot'

type RuleRow = Rule & { id: number; status: string; runs: number; createdAt: number; lastTrigger: number | null }
type Trigger = { id: number; ruleId: number; target: string; at: number; label: string; preview: string; link: string; seen: boolean }

const api = (p: string) => `${INDEXER_URL}/autopilot/${p}`
const DEFAULTS: Record<Rule['type'], Rule> = {
  list_call: { type: 'list_call', token: 'PONS', params: { amount: 100, pct: 20, minPremiumEth: 0.001, expirySec: 7 * 86400, fillWindowSec: 2 * 86400 }, schedule: { repeat: true }, limits: {} },
  list_put: { type: 'list_put', token: 'PONS', params: { amount: 100, pct: 15, minPremiumEth: 0.001, expirySec: 7 * 86400, fillWindowSec: 2 * 86400 }, schedule: { repeat: true }, limits: {} },
  buy_call: { type: 'buy_call', token: 'PONS', params: { maxPremiumOverStrike: 0.03, maxStrikeVsSpotPct: 10, maxPremiumEth: 0.01, minHoursToExpiry: 24 }, schedule: { repeat: true }, limits: {} },
  buy_put: { type: 'buy_put', token: 'PONS', params: { maxPremiumOverStrike: 0.03, maxStrikeVsSpotPct: 10, maxPremiumEth: 0.01, minHoursToExpiry: 24 }, schedule: { repeat: true }, limits: {} },
  exercise: { type: 'exercise', params: { marginPct: 2, minHoursBeforeExpiry: 2, maxHoursBeforeExpiry: 48 }, schedule: { repeat: true }, limits: {} },
  cancel_unfilled: { type: 'cancel_unfilled', params: { afterHours: 48 }, schedule: { repeat: true }, limits: {} },
}
const LABELS: Record<Rule['type'], string> = { list_call: 'Sell covered calls', list_put: 'Sell cash-secured puts', buy_call: 'Buy calls', buy_put: 'Buy puts', exercise: 'Exercise in the money', cancel_unfilled: 'Cancel stale offers' }
type ParamKey = keyof Rule['params']
const FIELDS: Record<Rule['type'], Array<[ParamKey, string, string]>> = {
  list_call: [['amount', 'Tokens per offer', ''], ['pct', 'Strike above spot', '%'], ['minPremiumEth', 'Premium floor', 'ETH'], ['expirySec', 'Expiry', 'seconds'], ['fillWindowSec', 'Fill window', 'seconds']],
  list_put: [['amount', 'Tokens per offer', ''], ['pct', 'Strike below spot', '%'], ['minPremiumEth', 'Premium floor', 'ETH'], ['expirySec', 'Expiry', 'seconds'], ['fillWindowSec', 'Fill window', 'seconds']],
  buy_call: [['maxPremiumOverStrike', 'Max premium ÷ strike', ''], ['maxStrikeVsSpotPct', 'Strike within', '% of spot'], ['maxPremiumEth', 'Max premium', 'ETH'], ['minHoursToExpiry', 'Min time to expiry', 'h']],
  buy_put: [['maxPremiumOverStrike', 'Max premium ÷ strike', ''], ['maxStrikeVsSpotPct', 'Strike within', '% of spot'], ['maxPremiumEth', 'Max premium', 'ETH'], ['minHoursToExpiry', 'Min time to expiry', 'h']],
  exercise: [['marginPct', 'In the money by', '%'], ['minHoursBeforeExpiry', 'Not later than', 'h before expiry'], ['maxHoursBeforeExpiry', 'Not earlier than', 'h before expiry']],
  cancel_unfilled: [['afterHours', 'Unfilled for', 'h']],
}
const ago = (t: number) => { const s = Math.max(0, Date.now() / 1000 - t); return s < 90 ? 'just now' : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 172800 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago` }
const field = 'mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-line-strong)]'

function decodeRuleParam(v: string | null): Rule | null {
  if (!v) return null
  try { const r = RuleSchema.safeParse(JSON.parse(decodeURIComponent(escape(atob(v))))); return r.success ? r.data : null } catch { return null }
}

function Autopilot() {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const sp = useSearchParams()
  const prefilled = useMemo(() => decodeRuleParam(sp.get('rule')), [sp])
  const [draft, setDraft] = useState<Rule>(prefilled ?? DEFAULTS.list_call)
  const [open, setOpen] = useState(Boolean(prefilled))
  const [rules, setRules] = useState<RuleRow[]>([])
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!address) return
    try {
      const [r, t] = await Promise.all([fetch(api(`rules/${address}`)).then((x) => x.json()), fetch(api(`triggers/${address}`)).then((x) => x.json())])
      if (Array.isArray(r)) setRules(r)
      if (Array.isArray(t)) setTriggers(t)
    } catch { /* indexer unreachable: keep what we have */ }
  }, [address])
  useEffect(() => { void load(); const id = setInterval(() => void load(), 30_000); return () => clearInterval(id) }, [load])

  async function signed(action: string, payloadHash: string) {
    if (!address) throw new Error('connect a wallet')
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signMessageAsync({ message: signMessageFor(action, address, timestamp, payloadHash) })
    return { address, timestamp, signature }
  }
  async function call(label: string, fn: () => Promise<Response>) {
    setBusy(label); setErr(null)
    try { const r = await fn(); const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'failed'); await load(); return true }
    catch (e) { setErr((e as Error).message.replace(/^User rejected.*/i, 'Signature cancelled.')); return false } finally { setBusy(null) }
  }
  const create = async () => {
    const parsed = RuleSchema.safeParse(draft)
    if (!parsed.success) { setErr(parsed.error.issues[0]?.message ?? 'check the fields'); return }
    const rule = parsed.data
    const ok = await call('create', async () => fetch(api('rules'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rule, ...(await signed('create', await sha256Hex(JSON.stringify(rule)))) }) }))
    if (ok) setOpen(false)
  }
  const setStatus = (r: RuleRow, action: 'pause' | 'resume' | 'deleted') => call(`${action}:${r.id}`, async () => {
    const auth = await signed(action, String(r.id))
    return action === 'deleted'
      ? fetch(api(`rules/${r.id}`), { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify(auth) })
      : fetch(api(`rules/${action}`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id, ...auth }) })
  })
  const seen = (t: Trigger) => { if (!t.seen && address) void fetch(api(`triggers/${t.id}/seen`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) }) }
  const setParam = (k: ParamKey, v: string) => setDraft((d) => ({ ...d, params: { ...d.params, [k]: v === '' ? undefined : Number(v) } }))
  const unseen = triggers.filter((t) => !t.seen).length

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      <PageHeader title="Autopilot" sub="Rules you sign once. Kyte watches the market around the clock and, when a rule's condition holds, prepares the exact transaction for you to review and sign. Nothing moves without your signature." />
      {!address ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-8 text-center">
          <p className="text-lg font-medium">Connect a wallet to set up rules</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Rules are tied to your address and signed with it.</p>
          <div className="mt-5 flex justify-center"><ConnectButton /></div>
        </div>
      ) : (
        <>
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">Waiting for you</h2>
              {unseen > 0 && <span className="text-xs text-[var(--color-muted)]">{unseen} new</span>}
            </div>
            {triggers.length === 0 ? <p className="mt-3 text-sm text-[var(--color-muted)]">Nothing yet. Triggers appear here within a minute of a rule's condition holding.</p> : (
              <ul className="mt-3 grid gap-3">
                {triggers.map((t) => (
                  <li key={t.id} className={`rounded-xl border p-4 ${t.seen ? 'border-[var(--color-line)] bg-[var(--color-card)]' : 'border-[var(--color-line-strong)] bg-[var(--color-card-2)]'}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{t.label}</p>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">{t.preview}</p>
                        <p className="mt-1 text-xs text-[var(--color-muted)] opacity-70">{ago(t.at)} · rule #{t.ruleId}</p>
                      </div>
                      <PillButton href={t.link} tone="premium" size="sm" onClick={() => seen(t)} className="shrink-0">Review and sign</PillButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-12">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">Your rules</h2>
              <button type="button" className="btn btn-glass btn-glass-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : 'New rule'}</button>
            </div>
            {open && (
              <div className="mt-4 rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-card)] p-5">
                <div className="flex flex-wrap gap-2">
                  {RULE_TYPES.map((t) => <button key={t} onClick={() => setDraft(DEFAULTS[t])} className={`rounded-full px-3 py-1 text-sm transition ${draft.type === t ? 'bg-[var(--color-ink)] text-[var(--color-bg)]' : 'bg-[var(--color-card-2)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}>{LABELS[t]}</button>)}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {draft.type !== 'exercise' && draft.type !== 'cancel_unfilled' && (
                    <label className="text-xs text-[var(--color-muted)]">Token<input value={draft.token ?? ''} onChange={(e) => setDraft((d) => ({ ...d, token: e.target.value.toUpperCase() }))} className={field} /></label>
                  )}
                  {FIELDS[draft.type].map(([k, label, unit]) => (
                    <label key={k} className="text-xs text-[var(--color-muted)]">{label}{unit ? ` (${unit})` : ''}<input type="number" step="any" value={draft.params[k] ?? ''} onChange={(e) => setParam(k, e.target.value)} className={field} /></label>
                  ))}
                  <label className="text-xs text-[var(--color-muted)]">Note<input value={draft.note ?? ''} maxLength={140} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} placeholder="In your words" className={field} /></label>
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.schedule.repeat} onChange={(e) => setDraft((d) => ({ ...d, schedule: { ...d.schedule, repeat: e.target.checked } }))} /> Keep running after each trigger</label>
                <p className="mt-4 text-sm">{describeRule(draft)}</p>
                {err && <p className="mt-3 text-sm text-[var(--color-down,#f87171)]">{err}</p>}
                <div className="mt-4 flex items-center gap-4">
                  <PillButton tone="premium" size="sm" onClick={create} disabled={busy !== null} className={busy !== null ? 'opacity-60' : ''}>{busy === 'create' ? 'Sign in your wallet…' : 'Sign and activate'}</PillButton>
                  <span className="text-xs text-[var(--color-muted)]">A signed message, not a transaction: free, and it only proves the rule is yours.</span>
                </div>
              </div>
            )}
            {rules.length === 0 && !open ? <p className="mt-3 text-sm text-[var(--color-muted)]">No rules yet. Ask the agent to design one, or add one here.</p> : (
              <ul className="mt-4 grid gap-3">
                {rules.map((r) => (
                  <li key={r.id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{LABELS[r.type]}{r.token ? ` · ${r.token}` : ''} <span className="ml-2 rounded-full bg-[var(--color-card-2)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">{r.status}</span></p>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">{describeRule(r)}</p>
                        {r.note && <p className="mt-1 text-sm italic text-[var(--color-muted)]">“{r.note}”</p>}
                        <p className="mt-1 text-xs text-[var(--color-muted)] opacity-70">{r.runs} trigger{r.runs === 1 ? '' : 's'}{r.lastTrigger ? `, last ${ago(r.lastTrigger)}` : ''}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {r.status === 'active' && <button type="button" disabled={busy !== null} onClick={() => setStatus(r, 'pause')} className="btn btn-glass btn-glass-sm">Pause</button>}
                        {r.status === 'paused' && <button type="button" disabled={busy !== null} onClick={() => setStatus(r, 'resume')} className="btn btn-glass btn-glass-sm">Resume</button>}
                        <button disabled={busy !== null} onClick={() => setStatus(r, 'deleted')} className="px-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">Delete</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="mt-12"><Note>Autopilot never holds funds or keys. Every action is a normal Kyte transaction you sign yourself. Conditions use the indexer's live prices; check the numbers on the page before signing. Options are risky and can expire worthless. Information, not financial advice.</Note></div>
        </>
      )}
    </div>
  )
}
export function AutopilotPage() { return <Suspense><Autopilot /></Suspense> }
