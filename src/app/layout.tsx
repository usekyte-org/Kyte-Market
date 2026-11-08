import type { Metadata } from 'next'
import { connection } from 'next/server'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Inter_Tight, Space_Grotesk } from 'next/font/google'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { DemoBanner } from '@/components/DemoBanner'
import { Footer } from '@/components/Footer'
import { Nav } from '@/components/Nav'
import { Providers } from '@/components/Providers'
import { SmoothScroll } from '@/components/fx/SmoothScroll'
import { BRAND } from '@/lib/config'
import { description, ogImage, shortDescription, siteUrl, title } from '@/lib/seo'
import './globals.css'

// Landing page display faces (from the Kyte brand site): self-hosted by next/font, so the CSP stays 'self'.
const interTight = Inter_Tight({ subsets: ['latin'], weight: ['300', '400'], variable: '--font-hero', display: 'swap' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-display', display: 'swap' })

// Link previews (Telegram, X, Discord, iMessage...): card text and image live in src/lib/seo.ts, shared with the
// plain page src/proxy.ts serves to link-preview crawlers.
export const metadata: Metadata = {
  // Absolute base for og:image etc. Some hosts set RENDER_EXTERNAL_URL, so previews work even without NEXT_PUBLIC_SITE_URL.
  metadataBase: new URL(siteUrl()),
  title,
  description,
  openGraph: { title, description, url: '/', siteName: BRAND.name, type: 'website', images: [ogImage] },
  twitter: {
    card: 'summary_large_image',
    site: '@useKyte',
    title,
    description: shortDescription,
    images: [{ url: ogImage.url, alt: ogImage.alt }],
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Dynamic rendering, so src/proxy.ts can give every page a fresh CSP nonce.
  await connection()
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${interTight.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans">
        <a href="#content" className="skip-link">Skip to content</a>
        <Providers>
          <SmoothScroll>
            <DemoBanner />
            <Nav />
            <main id="content" className="mx-auto w-full max-w-6xl px-4 pb-8 md:px-6">{children}</main>
            <Footer />
            <AgentPanel />
          </SmoothScroll>
        </Providers>
      </body>
    </html>
  )
}
