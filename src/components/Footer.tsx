'use client'

// Footer in the Kyte brand-site design (Updraft folder: components/site.tsx Footer + outline-word.tsx),
// with the app's own link columns and the live indexer status.
import Link from 'next/link'
import { chain } from '@/lib/chains'
import { BRAND } from '@/lib/config'
import { useHealth } from '@/lib/data'
import { XButton, X_URL } from './landing/kit'
import { OutlineWord } from './landing/OutlineWord'
import { Logo } from './Logo'
import { PillButton } from './PillButton'

const COLS: { t: string; l: { h: string; n: string }[] }[] = [
  { t: 'Product', l: [{ h: '/market', n: 'Market' }, { h: '/sell', n: 'Sell an option' }, { h: '/positions', n: 'Positions' }, { h: '/trades', n: 'Trade history' }, { h: '/stake', n: 'Stake' }] },
  { t: 'Protocol', l: [{ h: '/proof', n: 'Proof of burns' }, { h: 'https://docs.kyte.sh/', n: 'Documentation' }, { h: '/docs#contracts', n: 'Contracts' }, { h: '/docs#risks', n: 'Risks' }] },
  { t: 'Legal', l: [{ h: '/terms', n: 'Terms of Use' }, { h: '/privacy', n: 'Privacy Policy' }, { h: X_URL, n: 'X / @useKyte' }, { h: 'mailto:contact@kyte.sh', n: 'Contact' }] },
]

/**
 * Footer link with the hover effect from the reference recording: the label brightens, rolls up into a fresh copy
 * (`link-roll`), and a hairline underline draws in from the left (`lnk`). The roll sits inside the link so the
 * underline is not clipped by the roll's hidden overflow; `.lnk:hover` drives both (see globals.css).
 */
function FootLink({ href, children }: { href: string; children: string }) {
  const cls = 'lnk inline-block text-[15px] text-ink/75 transition-colors duration-300 hover:text-ink'
  const inner = (
    <span className="link-roll">
      <span className="link-roll-text">{children}</span>
      <span className="link-roll-text link-roll-text-2" aria-hidden>{children}</span>
    </span>
  )
  if (href.startsWith('/')) return <Link href={href} className={cls}>{inner}</Link>
  return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={cls}>{inner}</a>
}

/** Robinhood Chain's mark (the feather from robinhoodchain.blockscout.com's network icon), in Robinhood green. */
function RobinhoodMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="3 0 23.25 30" aria-hidden fill="#00C805">
      <path d="M3.173 30h.662c.12 0 .24-.06.28-.16C9.112 17.12 14.549 10.82 17.96 7.047c.14-.16.08-.28-.12-.28h-6.1a.689.689 0 0 0-.561.28l-4.374 5.417c-.642.803-.802 1.545-.802 2.608v5.537c-1.425 3.993-2.328 6.701-2.99 9.15-.04.156.02.24.16.24ZM25.182.808c-.943-1.003-5.197-1.043-7.163-.28-.41.158-.802.427-.983.581-1.806 1.545-3.01 2.77-4.153 3.973-.14.14-.08.28.12.28h6.762c.622 0 .983.362.983.984v7.624c0 .2.16.26.28.08l4.073-5.317c.663-.862.863-1.123 1.044-2.327.24-1.765.1-4.474-.963-5.598Zm-8.728 20.224 2.79-4.595c.06-.12.08-.26.08-.36V8.411c0-.2-.141-.28-.282-.12C14.85 12.967 11.58 17.882 8.55 23.8c-.077.149.02.281.2.221l6.26-1.926c.706-.216 1.103-.501 1.444-1.063Z" />
    </svg>
  )
}

export function Footer() {
  const health = useHealth()
  const synced = Boolean(health.data && health.data.lastBlock > 0)
  return (
    <footer className="relative mt-32 overflow-hidden" style={{ background: 'linear-gradient(180deg, #000 0%, #010303 100%)' }}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(110,255,170,.35) 30%, rgba(74,255,236,.35) 70%, transparent)' }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56" style={{ background: 'linear-gradient(180deg, rgba(160,255,220,.035), transparent)' }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(70% 45% at 50% 100%, rgba(74,255,236,.13), transparent 70%), radial-gradient(45% 40% at 15% 100%, rgba(110,255,133,.12), transparent 70%), radial-gradient(40% 35% at 88% 100%, rgba(74,255,236,.08), transparent 70%)' }} />
      <div className="relative mx-auto max-w-[1240px] px-5 py-16 md:px-8 md:py-20">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            {/* The "Kyte" wordmark lifted out of the brand mark (public/brand/kyte-wordmark.png), no tile around it. */}
            <Link href="/" aria-label={`${BRAND.name} home`} className="inline-block">
              <Logo size={36} />
            </Link>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ink/60">
              Options, on Your terms. A non-custodial, fully collateralised options market on Robinhood Chain.
            </p>
            {/* Two calls to action at one height: the gradient pill (label and arrow roll on hover) and the glass X button. */}
            <div className="mt-8 flex flex-wrap items-center gap-3 whitespace-nowrap">
              <PillButton href="/market" tone="premium">Start trading</PillButton>
              <XButton variant="glass" />
            </div>
            <a href="mailto:contact@kyte.sh" className="lnk mono mt-6 inline-block text-[13px] text-ink/60 hover:text-ink">contact@kyte.sh</a>
          </div>
          {COLS.map((c) => (
            <div key={c.t}>
              <div className="eyebrow">{c.t}</div>
              <ul className="mt-5 space-y-3">
                {c.l.map((l) => (
                  <li key={l.h}><FootLink href={l.h}>{l.n}</FootLink></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 md:mt-20">
          <OutlineWord />
        </div>
        <div className="hair mt-10 flex flex-col gap-6 border-t pt-8 text-[13px] text-ink/45 md:flex-row md:items-start md:justify-between">
          <p className="max-w-xl leading-relaxed">Options are risky and can expire worthless. Nothing here is investment advice. Not available where prohibited. {BRAND.name} is not affiliated with or endorsed by Robinhood.</p>
          <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
            {/* Chain status: a glass pill with the indexer pulse, the last block and the network with its mark. */}
            <span className="status-pill">
              <span className={`relative flex size-2 ${synced ? '' : 'opacity-80'}`}>
                {synced && <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#6EFF85] opacity-60 motion-reduce:hidden" />}
                <span className={`relative inline-flex size-2 rounded-full ${synced ? 'bg-[#6EFF85]' : 'bg-warn'}`} style={synced ? { boxShadow: '0 0 10px rgba(110,255,133,.8)' } : undefined} />
              </span>
              <span className={synced ? 'text-ink/85' : ''}>{synced ? 'Indexer synced' : 'Connecting…'}</span>
              {synced && <><span className="sep" /><span className="tabular-nums">block #{health.data?.lastBlock.toLocaleString('en-US')}</span></>}
              <span className="sep" />
              <span className="inline-flex items-center gap-1.5 text-ink/85"><RobinhoodMark size={13} />{chain.name}</span>
            </span>
            <p className="mono text-ink/40">© {new Date().getFullYear()} {BRAND.name} · kyte.sh</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
