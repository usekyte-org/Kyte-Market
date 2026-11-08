'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Live picture of the MCP server: Kyte in the middle, the AI apps around it, threads between them. It is not a
 * mock. Each thread performs the real MCP handshake against /api/mcp (initialize, then tools/list) and shows the
 * measured latency and tool count. Click a client to run its handshake again.
 */
type Client = { id: string; name: string; logo: string; angle: number }
const CLIENTS: Client[] = [
  { id: 'claude', name: 'Claude', logo: '/brand/clients/claude.svg', angle: -135 },
  { id: 'chatgpt', name: 'ChatGPT', logo: '/brand/clients/chatgpt.svg', angle: -45 },
  { id: 'cursor', name: 'Cursor', logo: '/brand/clients/cursor.svg', angle: 45 },
  { id: 'code', name: 'Claude Code', logo: '/brand/clients/anthropic.svg', angle: 135 },
]
type State = { status: 'idle' | 'connecting' | 'ok' | 'fail'; ms?: number; tools?: number }

const W = 520, H = 400, CX = W / 2, CY = H / 2, R = 150

function pos(angle: number) {
  const a = (angle * Math.PI) / 180
  return { x: CX + Math.cos(a) * R * 1.35, y: CY + Math.sin(a) * R * 0.78 }
}
/** Curved thread from a client to the hub, bowing a little so the four do not overlap. */
function thread(c: Client) {
  const p = pos(c.angle)
  const mx = (p.x + CX) / 2, my = (p.y + CY) / 2
  const bow = c.angle < 0 ? -28 : 28
  return { d: `M ${p.x} ${p.y} Q ${mx} ${my + bow} ${CX} ${CY}`, p }
}

async function handshake(): Promise<{ ok: boolean; ms: number; tools: number }> {
  const h = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' }
  const t0 = performance.now()
  const init = await fetch('/api/mcp', { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'kyte.sh', version: '1' } } }) }).then((r) => r.json())
  const list = await fetch('/api/mcp', { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) }).then((r) => r.json())
  return { ok: Boolean(init?.result?.serverInfo) && Array.isArray(list?.result?.tools), ms: Math.round(performance.now() - t0), tools: list?.result?.tools?.length ?? 0 }
}

export function McpConnections() {
  const [st, setSt] = useState<Record<string, State>>(() => Object.fromEntries(CLIENTS.map((c) => [c.id, { status: 'idle' }])))
  const busy = useRef(false)

  const run = async (id: string) => {
    setSt((s) => ({ ...s, [id]: { status: 'connecting' } }))
    try {
      const r = await handshake()
      setSt((s) => ({ ...s, [id]: { status: r.ok ? 'ok' : 'fail', ms: r.ms, tools: r.tools } }))
    } catch {
      setSt((s) => ({ ...s, [id]: { status: 'fail' } }))
    }
  }
  // on mount: connect the four clients one after another, so the threads light up in sequence
  useEffect(() => {
    if (busy.current) return
    busy.current = true
    ;(async () => { for (const c of CLIENTS) { await run(c.id); await new Promise((r) => setTimeout(r, 350)) } })()
  }, [])

  const online = CLIENTS.filter((c) => st[c.id].status === 'ok').length
  return (
    <div className="mcp-net relative select-none">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Kyte MCP server connected to Claude, ChatGPT, Cursor and Claude Code">
        <defs>
          <radialGradient id="mcp-hub" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#4dfca9" stopOpacity="0.35" /><stop offset="1" stopColor="#4dfca9" stopOpacity="0" /></radialGradient>
          <linearGradient id="mcp-thread" x1="0" x2="1"><stop offset="0" stopColor="#6eff85" /><stop offset="1" stopColor="#4affec" /></linearGradient>
        </defs>
        {/* hub glow */}
        <circle cx={CX} cy={CY} r="120" fill="url(#mcp-hub)" className="mcp-breathe" />
        {/* threads */}
        {CLIENTS.map((c) => {
          const { d } = thread(c)
          const s = st[c.id]
          const live = s.status === 'ok' || s.status === 'connecting'
          return (
            <g key={c.id}>
              <path d={d} fill="none" stroke="rgba(160,255,220,0.12)" strokeWidth="1.5" />
              <path d={d} fill="none" stroke={s.status === 'fail' ? '#ff6b6b' : 'url(#mcp-thread)'} strokeWidth="1.5" strokeLinecap="round" className={`mcp-thread ${live ? 'is-live' : ''}`} style={{ opacity: live ? 1 : s.status === 'fail' ? 0.8 : 0 }} />
              {/* packets: request to the hub, response back */}
              {live && (
                <>
                  <circle r="3" fill="#6eff85" className="mcp-packet">
                    <animateMotion dur={s.status === 'connecting' ? '0.9s' : '2.4s'} repeatCount="indefinite" path={d} />
                  </circle>
                  <circle r="2.2" fill="#4affec" className="mcp-packet">
                    <animateMotion dur={s.status === 'connecting' ? '0.9s' : '2.4s'} begin="0.45s" repeatCount="indefinite" path={d} keyPoints="1;0" keyTimes="0;1" calcMode="linear" />
                  </circle>
                </>
              )}
            </g>
          )
        })}
        {/* hub */}
        <g className="mcp-hub-node">
          <circle cx={CX} cy={CY} r="46" fill="#050807" stroke="rgba(160,255,220,0.35)" strokeWidth="1" />
          <circle cx={CX} cy={CY} r="46" fill="none" stroke="#4dfca9" strokeWidth="1" className="mcp-ring" />
          <image href="/brand/kyte-mark.png" x={CX - 30} y={CY - 30} width="60" height="60" clipPath="inset(0 round 14px)" />
          <text x={CX} y={CY + 68} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.7)" fontFamily="var(--font-mono)" letterSpacing="2">KYTE MCP</text>
          <text x={CX} y={CY + 84} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.4)" fontFamily="var(--font-mono)">{online}/{CLIENTS.length} connected</text>
        </g>
      </svg>
      {/* client nodes are HTML so the logos stay crisp and the buttons are real */}
      {CLIENTS.map((c) => {
        const { p } = thread(c)
        const s = st[c.id]
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => s.status !== 'connecting' && run(c.id)}
            title={`Run the MCP handshake as ${c.name}`}
            className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
            style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
          >
            <span className={`mcp-node grid size-14 place-items-center rounded-2xl border bg-[#0a0f0d] transition-all duration-500 ${s.status === 'ok' ? 'border-accent/50 shadow-[0_0_24px_-6px_rgba(77,252,169,.6)]' : s.status === 'fail' ? 'border-danger/50' : 'border-white/10'} ${s.status === 'connecting' ? 'mcp-node-connecting' : ''} group-hover:scale-105`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.logo} alt="" width={26} height={26} className="size-[26px] opacity-90" />
            </span>
            <span className="text-[11px] font-medium text-ink/85">{c.name}</span>
            <span className={`mono text-[10px] ${s.status === 'ok' ? 'text-accent' : s.status === 'fail' ? 'text-danger' : 'text-muted'}`}>
              {s.status === 'idle' ? 'standby' : s.status === 'connecting' ? 'handshake…' : s.status === 'ok' ? `${s.tools} tools · ${s.ms} ms` : 'unreachable'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
