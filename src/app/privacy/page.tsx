import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui'
import { BRAND } from '@/lib/config'

export const metadata: Metadata = { title: `Privacy · ${BRAND.name}`, robots: { index: false } }

const SECTIONS: [string, string][] = [
  ['What we collect', 'The website does not use accounts, cookies for tracking, or analytics. When you connect a wallet, your public address is used in your browser to read your positions. It is not stored by us.'],
  ['Wallet connection', 'The wallet picker is provided by Privy. Only wallets already installed in your browser are shown. Privy processes your public address under its own privacy policy.'],
  ['On chain data', 'Every transaction you send is public on Robinhood Chain and is indexed by our indexer to show the order book, proof of fee splits and burns. This data is public by nature and cannot be deleted.'],
  ['Third parties', 'The site talks to a Robinhood Chain RPC endpoint and to our indexer. No advertising networks are loaded.'],
  ['Contact', `Questions about this policy can be sent to the ${BRAND.name} team through the links in the footer.`],
]

export default function PrivacyPage() {
  return (
    <article className="max-w-[680px]">
      <PageHeader title="Privacy" sub="What the site does with your data. Last updated 30 October 2026." />
      <div className="space-y-8 text-base leading-relaxed text-muted">
        {SECTIONS.map(([h, b]) => (
          <section key={h}>
            <h2 className="text-xl text-ink">{h}</h2>
            <p className="mt-2 text-pretty">{b}</p>
          </section>
        ))}
      </div>
    </article>
  )
}
