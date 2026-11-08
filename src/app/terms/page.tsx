import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui'
import { BRAND } from '@/lib/config'

export const metadata: Metadata = { title: `Terms · ${BRAND.name}`, robots: { index: false } }

const SECTIONS: [string, string][] = [
  ['What Kyte is', `${BRAND.name} is a set of smart contracts on Robinhood Chain and a website that helps you interact with them. The contracts hold collateral and settle options. Nobody at ${BRAND.name} can access, freeze or move your funds.`],
  ['Who can use it', 'You must be legally allowed to trade options in your jurisdiction. Residents of restricted or sanctioned jurisdictions may not use the protocol. You are responsible for your own compliance and taxes.'],
  ['Risk', 'Options can expire worthless. Sellers can be assigned at the strike and buyers can lose the entire premium. Listed tokens may be volatile, illiquid or controlled by third parties. Smart contracts can contain bugs. Only use funds you can afford to lose.'],
  ['Settlement', 'Settlement is physical and enforced by the contracts. A transaction that lands after expiry fails. Exercise well before expiry. Payouts arrive as WETH.'],
  ['Fees', 'Fees are 3% of the premium when an offer fills and 0.1% of the strike on exercise. They are recorded on each position when it is created and split by the FeeVault contract.'],
  ['No advice', `Nothing on this site is investment, legal or tax advice. ${BRAND.name} does not recommend any position.`],
  ['Changes', 'Protocol settings change only through a public 10 minute timelock. These terms may be updated; the version on this page applies.'],
]

export default function TermsPage() {
  return (
    <article className="max-w-[680px]">
      <PageHeader title="Terms of use" sub="Plain language. Last updated 30 October 2026." />
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
