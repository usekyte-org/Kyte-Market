import { BRAND } from './config'

// Link-preview card (Telegram, X, WhatsApp, Discord, iMessage...): same card as the Kyte brand site.
// Used by the root layout's metadata and by src/proxy.ts, which serves link-preview crawlers a plain page.
export const title = `${BRAND.name} | Options, on Your terms`
export const description = 'A non-custodial, fully collateralised options market on Robinhood Chain. Covered calls, cash-secured puts, Option NFTs.'
export const shortDescription = 'A non-custodial, fully collateralised options market on Robinhood Chain.'
export const ogImage = {
  // Versioned path: Telegram keeps a negative cache per exact URL, so a card that once failed to fetch (the
  // localhost-era og:image) only shows again once the image lives at a URL it has never seen.
  url: '/og/kyte-card-v2.jpg',
  type: 'image/jpeg',
  width: 2400,
  height: 1260,
  alt: `${BRAND.name}: Options, on Your terms. A non-custodial options market on Robinhood Chain.`,
}

/** The public domain. Production builds use it unless NEXT_PUBLIC_SITE_URL says otherwise, so link previews
 * never point at the host's own name (the host's default domain) when the site is served from kyte.sh. */
export const CANONICAL_ORIGIN = 'https://kyte.sh'

/** Absolute site origin: NEXT_PUBLIC_SITE_URL when set, else kyte.sh in production, else the dev server. */
export const siteUrl = (fallbackOrigin = 'http://localhost:3010') =>
  process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === 'production' ? CANONICAL_ORIGIN : fallbackOrigin)

/**
 * Link-preview crawlers: the ones that unfurl a pasted URL into a card. Search engines (Google, Bing...) are left
 * out on purpose: they index the real page.
 */
export const PREVIEW_BOT =
  /TelegramBot|Twitterbot|facebookexternalhit|Facebot|WhatsApp|Discordbot|Slackbot|LinkedInBot|SkypeUriPreview|redditbot|Pinterestbot|Embedly|vkShare|Mastodon|Bluesky|Snapchat|Iframely|Viber/i

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/**
 * The page a link-preview crawler gets: only the tags a card needs, nothing to trip over (no scripts, preloads,
 * nonces or streamed chunks; the full site is ~150 KB of those before the first <meta>). Mirrors kyte.sh's head.
 */
export function previewHtml(pageUrl: string, origin: string): string {
  const image = new URL(ogImage.url, origin).href
  const t = esc(title), d = esc(description), sd = esc(shortDescription), alt = esc(ogImage.alt), u = esc(pageUrl), img = esc(image)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${u}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:url" content="${u}">
<meta property="og:site_name" content="${esc(BRAND.name)}">
<meta property="og:image" content="${img}">
<meta property="og:image:secure_url" content="${img}">
<meta property="og:image:type" content="${ogImage.type}">
<meta property="og:image:width" content="${ogImage.width}">
<meta property="og:image:height" content="${ogImage.height}">
<meta property="og:image:alt" content="${alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@useKyte">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${sd}">
<meta name="twitter:image" content="${img}">
<meta name="twitter:image:alt" content="${alt}">
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${u}">${u}</a></p>
</body>
</html>
`
}
