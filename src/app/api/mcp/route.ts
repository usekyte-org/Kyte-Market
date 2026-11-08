import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { ALL_TOOLS, DISCLAIMER, PREPARE_TOOLS, SITE } from '@/lib/agent/tools'

/**
 * Kyte MCP server (Streamable HTTP, stateless): the same read and prepare tools as the in-app agent, the docs pages
 * as resources, and a few starter prompts. Add https://kyte.sh/api/mcp to Claude, ChatGPT, Cursor or any MCP client.
 *
 * Read-only and prepare-only: there is no tool that can move funds, and nothing here asks for keys. Addresses are
 * passed in as parameters, so no login is needed. Each request builds a fresh server: no sessions, no state.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const DOCS = ['how-it-works', 'fees', 'staking', 'rules', 'risks', 'glossary'] as const
const docText = (name: string) => fs.readFileSync(path.join(process.cwd(), 'src/lib/agent/docs', `${name}.md`), 'utf8')

// per-client limit: 120 requests a minute, keyed by the proxy-appended forwarded address
const RATE = 120
const hits = new Map<string, number>()
setInterval(() => hits.clear(), 60_000).unref?.()
function overLimit(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',').at(-1)?.trim() || 'local'
  const n = (hits.get(ip) ?? 0) + 1
  hits.set(ip, n)
  return n > RATE
}

function build() {
  const server = new McpServer(
    { name: 'kyte', version: '1.0.0' },
    { instructions: `Kyte is a non-custodial, fully collateralised options market on Robinhood Chain. These tools read live market data (offers, prices, positions, staking, fee proof) and prepare actions as kyte.sh links the user reviews and signs in their own wallet. Nothing here can send a transaction or see a key. ${DISCLAIMER}` },
  )
  const prepare = new Set<string>(PREPARE_TOOLS.map((t) => t.name))
  for (const t of ALL_TOOLS) {
    server.registerTool(
      t.name,
      {
        title: t.name.replace(/_/g, ' '),
        description: prepare.has(t.name) ? `${t.description} Prepares only; never sends.` : t.description,
        inputSchema: t.input.shape,
        annotations: { readOnlyHint: !prepare.has(t.name), destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (args: any) => {
        const parsed = t.input.safeParse(args ?? {})
        if (!parsed.success) return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error: 'invalid input', issues: parsed.error.issues.map((i) => i.message) }) }] }
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const out = await (t.run as (i: any) => Promise<unknown>)(parsed.data)
          return { content: [{ type: 'text' as const, text: JSON.stringify(out) }] }
        } catch (e) {
          return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error: 'tool failed', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' }) }] }
        }
      },
    )
  }
  for (const d of DOCS) {
    server.registerResource(`docs-${d}`, `kyte://docs/${d}`, { title: `Kyte docs: ${d.replace(/-/g, ' ')}`, description: `Official Kyte documentation page "${d}"`, mimeType: 'text/markdown' }, async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: docText(d) }],
    }))
  }
  server.registerPrompt('find_best_offers', { title: 'Find the best open offers on a token', argsSchema: { token: z.string().describe('Token symbol, e.g. PONS') } }, ({ token }) => ({
    messages: [{ role: 'user', content: { type: 'text', text: `Use compare_offers on ${token} (calls and puts) and get_prices. Show a table of the open offers with strike per token, strike vs spot, premium, premium as a share of strike and time to expiry. Explain what the top rows mean for a buyer and for a seller. ${DISCLAIMER}` } }],
  }))
  server.registerPrompt('explain_my_positions', { title: 'Explain what an address holds and what expires soon', argsSchema: { address: z.string().describe('Wallet address, 0x…') } }, ({ address }) => ({
    messages: [{ role: 'user', content: { type: 'text', text: `Use get_positions for ${address}. List what it holds and is selling, flag anything expiring within 7 days, and for each held option call explain_offer so I understand breakeven and what exercising would mean. Link each one. ${DISCLAIMER}` } }],
  }))
  server.registerPrompt('protocol_health', { title: 'Protocol stats, fee proof and staking in one view', argsSchema: {} }, () => ({
    messages: [{ role: 'user', content: { type: 'text', text: `Use get_protocol_stats, get_proof and get_staking. Summarise volume, fees, open interest, how much $KYTE has been burned, how much is staked and what the last epoch paid stakers. Link the proof page at ${SITE}/proof.` } }],
  }))
  return server
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS', 'access-control-allow-headers': 'content-type, mcp-session-id, mcp-protocol-version, authorization', 'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version' }

async function handle(req: Request) {
  if (overLimit(req)) return new Response(JSON.stringify({ error: 'rate limited' }), { status: 429, headers: { 'content-type': 'application/json', ...CORS } })
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  const server = build()
  await server.connect(transport)
  try {
    const res = await transport.handleRequest(req)
    const headers = new Headers(res.headers)
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v)
    return new Response(res.body, { status: res.status, headers })
  } finally {
    // stateless: the server lives for this request only
    void transport.close().catch(() => {})
  }
}

// Unpublished for now: NEXT_PUBLIC_MCP_ENABLED=false (production) answers 404 on every method.
const ENABLED = process.env.NEXT_PUBLIC_MCP_ENABLED !== 'false'
const gated = (req: Request) => (ENABLED ? handle(req) : new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } }))
export const POST = gated
export const GET = gated
export const DELETE = gated
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
