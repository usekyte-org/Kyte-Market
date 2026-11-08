import { NextResponse, type NextRequest } from 'next/server'

/**
 * Same-origin proxy for Pons token logos (ipfs:// in the token contract). Keeps the CSP img-src at 'self', caches
 * for a day at the edge and a year in the browser, and falls back across gateways. CIDs only; 2 MB cap; images only.
 */
const GATEWAYS = ['https://dbk-vercel.vercel.app/api/ipfs/content/', 'https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/']
const CID = /^[a-zA-Z0-9]{46,100}$/
const MAX = 2 * 1024 * 1024

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params
  if (!CID.test(cid)) return NextResponse.json({ error: 'bad cid' }, { status: 400 })
  for (const g of GATEWAYS) {
    try {
      const r = await fetch(`${g}${cid}`, { signal: AbortSignal.timeout(8000), headers: { accept: 'image/*' } })
      if (!r.ok) continue
      const type = r.headers.get('content-type') ?? ''
      if (!type.startsWith('image/')) continue
      const len = Number(r.headers.get('content-length') ?? 0)
      if (len > MAX) continue
      const buf = await r.arrayBuffer()
      if (buf.byteLength > MAX) continue
      return new NextResponse(buf, { status: 200, headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, s-maxage=86400, immutable', 'x-content-type-options': 'nosniff' } })
    } catch { /* next gateway */ }
  }
  return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'public, max-age=300' } })
}
