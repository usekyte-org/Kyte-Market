import { NextResponse, type NextRequest } from 'next/server'
import { PREVIEW_BOT, previewHtml, siteUrl } from './lib/seo'

// Strict Content Security Policy with a fresh nonce per request (node_modules/next/dist/docs/01-app/02-guides/
// content-security-policy.md). Next.js attaches the nonce to its own scripts; any injected <script> without it
// is refused by the browser. The root layout opts into dynamic rendering so every page gets a nonce.

const origin = (url?: string) => {
  try {
    return url ? new URL(url).origin : ''
  } catch {
    return ''
  }
}

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 4663)
const RPC: Record<number, string> = {
  4663: 'https://rpc.mainnet.chain.robinhood.com',
  46630: 'https://rpc.testnet.chain.robinhood.com',
  31337: 'http://127.0.0.1:8547',
}

// Only what the dapp talks to: our chain's RPC, the indexer, and Privy's wallet picker.
const CONNECT = [
  "'self'",
  origin(process.env.NEXT_PUBLIC_RPC_URL || RPC[CHAIN_ID]),
  origin(process.env.NEXT_PUBLIC_INDEXER_URL),
  'https://auth.privy.io',
  'https://*.rpc.privy.systems',
  'https://explorer-api.walletconnect.com',
  'wss://relay.walletconnect.com',
  'wss://relay.walletconnect.org',
  'wss://www.walletlink.org',
].filter(Boolean)

// Remote images the landing page uses: token logos (CoinGecko). Option NFT art is drawn inline, no remote host.
// Images can't run code, so allowing these exact hosts doesn't weaken the script policy.
// financialmodelingprep.com: company logos for the Robinhood Stock Tokens (TokenLogo).
const IMAGES = ['https://assets.coingecko.com', 'https://financialmodelingprep.com']

const FRAMES = ['https://auth.privy.io', 'https://verify.walletconnect.com', 'https://verify.walletconnect.org', 'https://challenges.cloudflare.com']

export function proxy(request: NextRequest) {
  // A link-preview crawler (Telegram, X, WhatsApp...) gets a plain page with just the card tags: the full page is
  // ~150 KB of scripts and preloads before its first <meta>, and Telegram showed no card for it at all. Only HTML
  // pages, not files such as the card image; search engines are not matched, they index the real page.
  const { pathname } = request.nextUrl
  if (request.method === 'GET' && !/\.[a-z0-9]+$/i.test(pathname) && PREVIEW_BOT.test(request.headers.get('user-agent') ?? '')) {
    const origin = siteUrl(request.nextUrl.origin)
    return new NextResponse(previewHtml(new URL(pathname, origin).href, origin), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    })
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const dev = process.env.NODE_ENV === 'development'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ''}`,
    // React/Framer/GSAP set inline style attributes; styles can't run code, scripts are what matter.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMAGES.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${CONNECT.join(' ')}${dev ? ' ws: http://localhost:* http://127.0.0.1:*' : ''}`,
    `frame-src ${FRAMES.join(' ')}`,
    `child-src ${FRAMES.join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'", // no clickjacking: the app can't be framed to trick users into signing
    ...(dev || CHAIN_ID === 31337 ? [] : ['upgrade-insecure-requests']),
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
