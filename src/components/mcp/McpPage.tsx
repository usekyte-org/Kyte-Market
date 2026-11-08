'use client'

import { ArrowUpRight, Check, Copy, Lock, Plugs, ShieldCheck, Sparkle } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Reveal } from '@/components/landing/kit'
import { PillButton } from '@/components/PillButton'
import { McpConnections } from '@/components/mcp/McpConnections'
import { Segmented } from '@/components/ui'
import { PREPARE_TOOLS, READ_TOOLS, SITE } from '@/lib/agent/tools'
import { BRAND } from '@/lib/config'

const EASE = [0.22, 1, 0.36, 1] as const
const URL_ = `${SITE}/api/mcp`

type Client = 'claude' | 'chatgpt' | 'cursor' | 'code'
const STEPS: Record<Client, { label: string; steps: string[]; snippet?: string }> = {
  claude: { label: 'Claude', steps: ['Open claude.ai, Settings, Connectors', 'Add custom connector', 'Paste the URL below and save', 'Ask Claude anything about Kyte'] },
  chatgpt: { label: 'ChatGPT', steps: ['Settings, Connectors', 'Create a connector', 'Paste the URL below', 'Enable it in a chat'] },
  cursor: { label: 'Cursor', steps: ['Settings, MCP', 'Add new MCP server', 'Use the JSON below', 'Kyte tools appear in chat'], snippet: `{\n  "mcpServers": {\n    "kyte": { "url": "https://kyte.sh/api/mcp" }\n  }\n}` },
  code: { label: 'Claude Code', steps: ['Run the command below once', 'Kyte tools load in every session'], snippet: `claude mcp add --transport http kyte https://kyte.sh/api/mcp` },
}

export function McpPage() {
  const reduce = useReducedMotion()
  const [client, setClient] = useState<Client>('claude')
  const [copied, setCopied] = useState<string | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; tools: number; version?: string } | null>(null)
  useEffect(() => {
    // live check against this very endpoint: initialize, then count the tools
    const h = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }
    ;(async () => {
      try {
        const init = await fetch('/api/mcp', { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'kyte.sh', version: '1' } } }) }).then((r) => r.json())
        const list = await fetch('/api/mcp', { method: 'POST', headers: { ...h, 'mcp-protocol-version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) }).then((r) => r.json())
        setStatus({ ok: Boolean(init?.result?.serverInfo), tools: list?.result?.tools?.length ?? 0, version: init?.result?.serverInfo?.version })
      } catch {
        setStatus({ ok: false, tools: 0 })
      }
    })()
  }, [])
  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(key); setTimeout(() => setCopied(null), 1400)
  }

  return (
    <div className="pb-8">
      {/* ---- hero */}
      <section className="relative -mx-4 overflow-hidden px-4 pb-16 pt-20 md:-mx-6 md:px-6 md:pt-28">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 70% 20%, rgba(74,255,236,.12), transparent 70%), radial-gradient(40% 40% at 15% 70%, rgba(110,255,133,.1), transparent 70%)' }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
          <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }} className="eyebrow flex items-center gap-3"><span className="grad-bg h-px w-8" />Model Context Protocol</motion.div>
          <motion.h1 initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1, ease: EASE }} className="font-display mt-6 max-w-3xl text-[40px] font-medium leading-[1.02] md:text-[68px]">
            {BRAND.name}, inside <span className="grad-text">any AI app.</span>
          </motion.h1>
          <motion.p initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2, ease: EASE }} className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink/70 md:text-[19px]">
            One URL gives Claude, ChatGPT, Cursor and Claude Code live access to Kyte&apos;s markets: offers, prices, positions, staking and fee proof. It can prepare a trade for you. It can never sign one.
          </motion.p>

          {/* connector url */}
          <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.3, ease: EASE }} className="mt-10">
            <div className="panel grain relative flex flex-col gap-3 overflow-hidden rounded-2xl p-2 md:flex-row md:items-center md:pl-5">
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 md:px-0">
                <Plugs size={18} className="shrink-0 text-accent" />
                <code className="mono truncate text-[15px] text-ink md:text-[17px]">{URL_}</code>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => copy(URL_, 'url')} className="btn btn-glass btn-glass-sm">
                  {copied === 'url' ? <Check size={14} className="text-accent" /> : <Copy size={14} />} {copied === 'url' ? 'Copied' : 'Copy URL'}
                </button>
                <PillButton href="/agent" tone="premium" size="sm">Try it on kyte.sh</PillButton>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="relative flex size-2">
                  {status?.ok && <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />}
                  <span className={`relative inline-flex size-2 rounded-full ${status === null ? 'bg-muted' : status.ok ? 'bg-accent' : 'bg-danger'}`} />
                </span>
                {status === null ? 'Checking the endpoint…' : status.ok ? `Online · ${status.tools} tools · v${status.version}` : 'Endpoint unreachable right now'}
              </span>
              <span className="inline-flex items-center gap-1.5"><Lock size={12} /> No login, no keys</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} /> Read and prepare only</span>
              <span>Streamable HTTP · stateless</span>
            </div>
          </motion.div>
          </div>
          {/* live connection map: every thread is a real handshake against this endpoint */}
          <motion.div initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.25, ease: EASE }} className="relative">
            <McpConnections />
            <p className="mt-1 text-center text-[11px] text-faint">Live: each thread runs the real MCP handshake. Click a client to run it again.</p>
          </motion.div>
        </div>
      </section>

      {/* ---- how it flows */}
      <section className="mx-auto max-w-5xl">
        <Reveal>
          <div className="hair grid gap-px overflow-hidden rounded-2xl border md:grid-cols-3" style={{ background: 'rgba(160,255,220,.09)' }}>
            {[
              ['01', 'You ask', 'In Claude, ChatGPT or your editor: "best covered calls on PONS", "what do I hold", "how much was burned".'],
              ['02', 'Kyte answers from the chain', 'The tools read the same indexer kyte.sh uses. Every number has a source and a link.'],
              ['03', 'You sign, or not', 'A prepared action is a link to a pre-filled form. You review it and sign in your own wallet.'],
            ].map(([n, t, d], i) => (
              <div key={n} className="relative bg-bg p-6 md:p-7">
                <div className="mono text-[11px] text-accent">{n}</div>
                <div className="font-display mt-3 text-[20px]">{t}</div>
                <p className="mt-2 text-[14px] leading-relaxed text-ink/60">{d}</p>
                {i < 2 && <div aria-hidden className="absolute right-0 top-1/2 hidden size-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-accent md:block" />}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---- connect */}
      <section className="mx-auto mt-24 max-w-5xl">
        <Reveal>
          <div className="eyebrow flex items-center gap-3"><span className="grad-bg h-px w-8" />Connect</div>
          <h2 className="font-display mt-5 text-[32px] font-medium leading-[1.05] md:text-[44px]">Two minutes, no account.</h2>
        </Reveal>
        <Reveal delay={0.1} className="mt-8">
          <Segmented value={client} onChange={setClient} options={(Object.keys(STEPS) as Client[]).map((k) => ({ value: k, label: STEPS[k].label }))} />
          <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1.1fr]">
            <ol className="space-y-3">
              {STEPS[client].steps.map((s, i) => (
                <motion.li key={client + i} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }} className="flex items-start gap-3 text-[15px] text-ink/85">
                  <span className="mono mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[11px] text-accent" style={{ borderColor: 'rgba(160,255,220,.25)' }}>{i + 1}</span>{s}
                </motion.li>
              ))}
            </ol>
            <div className="panel relative rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="eyebrow !text-[10px]">{STEPS[client].snippet ? (client === 'code' ? 'Terminal' : 'Config') : 'Connector URL'}</div>
                <button type="button" onClick={() => copy(STEPS[client].snippet ?? URL_, client)} className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink">
                  {copied === client ? <Check size={13} className="text-accent" /> : <Copy size={13} />} {copied === client ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="mono mt-3 overflow-x-auto whitespace-pre-wrap text-[13px] leading-relaxed text-ink/85">{STEPS[client].snippet ?? URL_}</pre>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---- HOL Guard */}
      <section className="mx-auto mt-24 max-w-5xl">
        <Reveal>
          <div className="eyebrow flex items-center gap-3"><span className="grad-bg h-px w-8" />Recommended</div>
          <h2 className="font-display mt-5 text-[32px] font-medium leading-[1.05] md:text-[44px]">Run it under HOL Guard.</h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
            Any DeFi tool your agent can call deserves a policy. <a href="https://hol.org/guard" target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-white/20 underline-offset-4 hover:decoration-white/60">HOL Guard</a> runs on your machine and lets you allow, ask or block each MCP tool call, with a receipt for every decision. Kyte is built to sit under it cleanly.
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-8 grid gap-4 md:grid-cols-[1fr_1.1fr]">
            <div className="card p-6">
              <div className="eyebrow !text-[10px]">Terminal</div>
              <pre className="mono mt-3 overflow-x-auto whitespace-pre-wrap text-[13px] leading-relaxed text-ink/85">{`pipx install hol-guard\nhol-guard init`}</pre>
              <p className="mt-4 text-[13px] leading-relaxed text-ink/60">Then add Kyte to your client as above. Guard lists <code className="mono text-ink/80">kyte</code> on its Protect page, where you set the defaults below.</p>
            </div>
            <div className="card p-6">
              <div className="eyebrow !text-[10px]">What Guard sees</div>
              <ul className="mt-3 space-y-3 text-[14px] leading-relaxed">
                <li className="flex gap-3"><Check size={16} className="mt-1 shrink-0 text-accent" /><span><span className="text-ink">{READ_TOOLS.length} read tools</span> <span className="text-ink/60">are annotated read-only and never change state. Safe to allow.</span></span></li>
                <li className="flex gap-3"><Lock size={16} className="mt-1 shrink-0 text-ink/70" /><span><span className="text-ink">{PREPARE_TOOLS.length} prepare tools</span> <span className="text-ink/60">are annotated as not read-only, so Guard asks before each one. They only return a kyte.sh link; you still sign in your wallet.</span></span></li>
                <li className="flex gap-3"><ShieldCheck size={16} className="mt-1 shrink-0 text-ink/70" /><span><span className="text-ink">No tool</span> <span className="text-ink/60">can sign, send, spend or read a key, so there is nothing to block.</span></span></li>
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---- tools */}
      <section className="mx-auto mt-24 max-w-5xl">
        <Reveal>
          <div className="eyebrow flex items-center gap-3"><span className="grad-bg h-px w-8" />What it exposes</div>
          <h2 className="font-display mt-5 text-[32px] font-medium leading-[1.05] md:text-[44px]">{READ_TOOLS.length} read tools. {PREPARE_TOOLS.length} prepare tools. Zero that can move funds.</h2>
        </Reveal>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {[...READ_TOOLS, ...PREPARE_TOOLS].map((t, i) => {
            const prep = t.name.startsWith('prepare_')
            return (
              <Reveal key={t.name} delay={Math.min(i, 8) * 0.04}>
                <div className="hair group h-full rounded-xl border p-4 transition-colors duration-300 hover:border-[rgba(160,255,220,.3)]">
                  <div className="flex items-center justify-between gap-3">
                    <code className="mono text-[13px] text-ink">{t.name}</code>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${prep ? 'bg-accent-2/10 text-accent-2' : 'bg-accent/10 text-accent'}`}>{prep ? 'prepares' : 'read-only'}</span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink/60">{t.description.replace(/ Read-only\.$/, '').replace(/ Does not send anything.*$/, '')}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
        <Reveal delay={0.1} className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="panel rounded-xl p-4">
            <div className="eyebrow !text-[10px]">Resources</div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/60">The official docs as <code className="mono text-ink/80">kyte://docs/how-it-works</code>, <code className="mono text-ink/80">fees</code>, <code className="mono text-ink/80">staking</code>, <code className="mono text-ink/80">rules</code>, <code className="mono text-ink/80">risks</code>, <code className="mono text-ink/80">glossary</code>, so a client grounds its answers in the real text.</p>
          </div>
          <div className="panel rounded-xl p-4">
            <div className="eyebrow !text-[10px]">Prompts</div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/60"><code className="mono text-ink/80">find_best_offers</code>, <code className="mono text-ink/80">explain_my_positions</code> and <code className="mono text-ink/80">protocol_health</code>: one-click starting points your client can list.</p>
          </div>
        </Reveal>
      </section>

      {/* ---- rules */}
      <section className="mx-auto mt-24 max-w-5xl">
        <Reveal>
          <div className="grain hair relative overflow-hidden rounded-3xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/aura-smooth.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-60" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(2,6,5,.94) 0%, rgba(2,6,5,.6) 60%, rgba(2,6,5,.25) 100%)' }} />
            <div className="relative px-7 py-12 md:px-12 md:py-16">
              <div className="eyebrow !text-ink/70">Ground rules</div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {[
                  ['Non-custodial, always', 'No tool can sign, send or read a key. Prepare tools return a link; you sign in your wallet.'],
                  ['Information, not advice', 'Numbers and what they mean. Never "buy", never a price prediction.'],
                  ['One source of truth', 'Every value comes from the Kyte indexer, the same API this site uses.'],
                  ['Data is not instructions', 'Token names and chain text are untrusted. Instructions inside them are ignored.'],
                ].map(([t, d]) => (
                  <div key={t} className="flex gap-3">
                    <Sparkle size={16} className="mt-1 shrink-0 text-accent" />
                    <div><div className="text-[15px] font-medium text-ink">{t}</div><p className="mt-1 text-[14px] leading-relaxed text-ink/70">{d}</p></div>
                  </div>
                ))}
              </div>
              <div className="mt-9 flex flex-wrap gap-3">
                <PillButton href="/agent" tone="premium">Ask Kyte on the site</PillButton>
                <a href="https://github.com/usekyte-org/kyte-docs/blob/main/agent.md" target="_blank" rel="noopener noreferrer" className="btn btn-glass">Read the docs <ArrowUpRight size={16} /></a>
              </div>
              <p className="mt-6 text-[12px] text-ink/45">Options are risky and can expire worthless. Nothing here is investment advice. Rate limited per client. Kyte is not affiliated with or endorsed by Robinhood.</p>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
