import { NextResponse, type NextRequest } from 'next/server'

/**
 * Same-origin gateway to the indexer, for hosts where the indexer is a private service (a private service on the host's internal network). Set NEXT_PUBLIC_INDEXER_URL=/api/indexer and INDEXER_INTERNAL_URL (or
 * INDEXER_INTERNAL_HOSTPORT) on the web service. Read-only: GET only, known routes only, no cookies forwarded.
 */
const ALLOWED = /^(health|assets|offers|activity|prices|candles|markers|expirable|proof|stats|positions\/0x[0-9a-fA-F]{40}|stake\/0x[0-9a-fA-F]{40}|offers\/\d{1,80}|autopilot\/(rules|triggers)\/0x[0-9a-fA-F]{40}|pons\/tokens)$/
// Autopilot writes: signed by the wallet, verified by the indexer. Bodies are small JSON.
const ALLOWED_WRITE = /^autopilot\/(rules|rules\/\d{1,12}|rules\/pause|rules\/resume|triggers\/\d{1,12}\/seen)$/

function upstream(): string | null {
  const url = process.env.INDEXER_INTERNAL_URL
  if (url) return url.replace(/\/$/, '')
  const hp = process.env.INDEXER_INTERNAL_HOSTPORT
  return hp ? `http://${hp}` : null
}

export const dynamic = 'force-dynamic'

async function forward(req: NextRequest, params: Promise<{ path: string[] }>, method: 'GET' | 'POST' | 'DELETE') {
  const base = upstream()
  if (!base) return NextResponse.json({ error: 'indexer not configured' }, { status: 503 })
  const sub = (await params).path.join('/')
  if (!(method === 'GET' ? ALLOWED : ALLOWED_WRITE).test(sub)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (sub.startsWith('autopilot/') && process.env.NEXT_PUBLIC_AUTOPILOT_ENABLED === 'false') return NextResponse.json({ error: 'not found' }, { status: 404 })
  const qs = req.nextUrl.search.length <= 512 ? req.nextUrl.search : ''
  const body = method === 'GET' ? undefined : (await req.text()).slice(0, 16 * 1024)
  try {
    const r = await fetch(`${base}/${sub}${qs}`, { method, body, cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: { 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '', ...(body ? { 'content-type': 'application/json' } : {}) } })
    const text = await r.text()
    return new NextResponse(text, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'indexer unavailable' }, { status: 502 })
  }
}
export const GET = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => forward(req, ctx.params, 'GET')
export const POST = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => forward(req, ctx.params, 'POST')
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => forward(req, ctx.params, 'DELETE')
