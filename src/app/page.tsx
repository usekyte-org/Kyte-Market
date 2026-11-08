'use client'

// Landing page in the Kyte brand-site design (Updraft folder: artifacts/updraft/src/pages/home.tsx),
// adapted to the live app. The live product frame (ProductFrame) is kept exactly as it was.
import { ArrowDown, ArrowRight, ArrowSquareOut, ArrowUpRight, Check, Copy, Minus, Plus } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { Bleed, EASE as ease, Reveal, SectionHead, Wrap, XButton, scrollToId } from '@/components/landing/kit'
import { Tilt } from '@/components/motion/primitives'
import { FlowStory } from '@/components/FlowStory'
import { ProductFrame } from '@/components/ProductFrame'
import { TradeTable, isTrade } from '@/components/TradeHistory'
import { chain, contracts, explorerAddress, isDevnet, legacyMarkets } from '@/lib/chains'
import { useActivity } from '@/lib/data'
import { BRAND } from '@/lib/config'

const AuroraCanvas = dynamic(() => import('@/components/fx/AuroraCanvas').then((m) => m.AuroraCanvas), { ssr: false })

const KYTE_ADDRESS = contracts.kyteToken ?? '0x072d88c2f31f568c0f4b8f613692eb489541ed45'

/** The $KYTE contract in the hero: copy on click, explorer link beside it. */
function ContractChip() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(KYTE_ADDRESS) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  const url = explorerAddress(KYTE_ADDRESS)
  return (
    <div className="inline-flex items-center gap-1 rounded-full border pl-3 pr-1 text-[12px] backdrop-blur-sm" style={{ borderColor: 'rgba(160,255,220,.2)', background: 'rgba(2,10,8,.45)' }}>
      <span className="grad-text font-mono font-medium">{BRAND.token}</span>
      <span className="mx-1.5 h-3 w-px bg-ink/20" aria-hidden />
      <button type="button" onClick={copy} title="Copy contract address" className="mono inline-flex items-center gap-1.5 py-1.5 text-ink/80 transition-colors hover:text-ink">
        <span className="hidden sm:inline">{KYTE_ADDRESS}</span>
        <span className="sm:hidden">{KYTE_ADDRESS.slice(0, 8)}…{KYTE_ADDRESS.slice(-6)}</span>
        {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} className="opacity-70" />}
      </button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="View contract on explorer" className="grid size-7 place-items-center rounded-full text-ink/60 transition-colors hover:bg-white/[0.08] hover:text-ink">
          <ArrowSquareOut size={13} />
        </a>
      )}
    </div>
  )
}

function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 140])
  const op = useTransform(scrollYProgress, [0, 0.9], [1, 0.15])
  return (
    <section ref={ref} className="relative left-1/2 -mt-24 flex min-h-[100dvh] w-screen -translate-x-1/2 flex-col overflow-hidden">
      <motion.div style={{ y, opacity: op }} className="grain absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/aura-smooth.jpg" alt="" aria-hidden className="hero-breathe absolute inset-0 h-full w-full object-cover object-[60%_50%] opacity-80" />
        <div aria-hidden className="hero-breathe-glow absolute inset-0" />
        <div aria-hidden className="hero-aurora absolute inset-0">
          <AuroraCanvas intensity={1.25} />
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(2,6,5,.55) 0%, rgba(2,6,5,.15) 35%, rgba(2,6,5,.6) 70%, rgba(2,6,5,.85) 100%)' }} />
      </motion.div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%]" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,.55) 45%, #000 100%)' }} />
      <Wrap className="relative flex flex-1 flex-col justify-center pb-10 pt-36 md:pt-32">
        <h1 className="hero-title text-[clamp(3.25rem,10.5vw,8.5rem)]" aria-label="Options, on Your terms.">
          {[
            [{ w: 'Options,', g: false }],
            [{ w: 'on', g: false }, { w: 'Your', g: true }, { w: 'terms.', g: true }],
          ].map((line, li) => (
            <span key={li} className="block" aria-hidden>
              {line.map(({ w, g }, wi) => (
                <span key={w} className="-mb-[.1em] mr-[.2em] inline-block overflow-hidden pb-[.1em] align-bottom last:mr-0">
                  <motion.span className={`inline-block ${g ? 'hero-grad' : ''}`} initial={reduce ? false : { y: '110%' }} animate={{ y: 0 }} transition={{ duration: 1.2, delay: 0.15 + (li * 2 + wi) * 0.09, ease }}>
                    {w}
                  </motion.span>
                </span>
              ))}
            </span>
          ))}
        </h1>
        <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.6, ease }} className="mt-8 grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-end">
          <p className="max-w-xl text-[17px] leading-relaxed text-ink/75 md:text-[19px]">
            {BRAND.name} is a non-custodial, fully collateralised options market. Sell covered calls and cash-secured puts, or buy options as transferable NFTs. No leverage, no margin, no liquidations.
          </p>
          <div className="flex flex-col items-start gap-4 md:items-end">
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              <Link href="/market" className="btn btn-x !px-7 !py-4 text-[15px]">Start trading <ArrowRight size={16} /></Link>
              <a href={BRAND.tradeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-glass !h-auto !py-4 text-[15px]">Trade {BRAND.token} <ArrowUpRight size={16} /></a>
              <button type="button" onClick={() => scrollToId('how')} className="btn btn-ghost !py-4">How it works <ArrowDown size={16} /></button>
            </div>
            <ContractChip />
          </div>
        </motion.div>
      </Wrap>
      <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1 }} className="relative">
        <Wrap className="pb-8">
          <div className="hair grid grid-cols-2 gap-y-4 border-t pt-6 md:grid-cols-4">
            {[['Collateral', '100% at creation'], ['Custody', 'Non-custodial'], ['Positions', 'Option NFTs'], ['Network', 'Robinhood Chain']].map(([k, v]) => (
              <div key={k}>
                <div className="eyebrow !text-[10px] !text-ink/40">{k}</div>
                <div className="mt-1.5 text-[14px] text-ink/85">{v}</div>
              </div>
            ))}
          </div>
        </Wrap>
      </motion.div>
    </section>
  )
}

/** The live product frame, unchanged: trending Robinhood Chain tokens and open offers from the chain. */
function LiveFrame() {
  return (
    <Bleed className="mt-24 md:mt-32">
      <Wrap>
        <SectionHead eyebrow="Live from the chain" title={<>Real tokens. <span className="grad-text">Real offers.</span></>} sub="What is trading on Robinhood Chain right now, and the options you can buy on Kyte this minute." />
        <Reveal className="mt-12"><Tilt max={2}><ProductFrame /></Tilt></Reveal>
        <Reveal className="mt-10" delay={0.1}><RecentTrades /></Reveal>
      </Wrap>
    </Bleed>
  )
}

/** The last trades on the market, so a visitor sees that options are actually being filled and settled. */
function RecentTrades() {
  const feed = useActivity(40)
  const rows = (feed.data ?? []).filter(isTrade).slice(0, 6)
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Recent trades</div>
          <p className="mt-1 text-sm text-muted">Listings, fills and settlements as they land on chain. Every row is a real transaction.</p>
        </div>
        <Link href="/trades" className="btn btn-ghost btn-sm">All trades <ArrowRight size={14} /></Link>
      </div>
      <TradeTable rows={rows} loading={feed.isPending} empty="No trades yet." compact />
    </div>
  )
}

function Notice() {
  return (
    <Bleed className="mt-24 md:mt-32">
      <Wrap>
        <Reveal>
          <div className="hair relative overflow-hidden rounded-2xl border">
            <span className="grad-bg absolute inset-y-0 left-0 w-px" />
            <div className="grid gap-8 p-7 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-12 md:p-9">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6EFF85] opacity-40" />
                  <span className="grad-bg relative inline-flex h-2.5 w-2.5 rounded-full" />
                </span>
                <span className="mono text-[12px] uppercase tracking-[.18em] text-ink/80">{isDevnet ? 'Devnet' : chain.testnet ? 'Testnet' : 'Live'}</span>
              </div>
              <div>
                <h3 className="font-display text-[20px] md:text-[22px]">You are on the official {BRAND.name} app, connected to {chain.name}.</h3>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink/60">
                  {chain.testnet
                    ? 'Everything here runs against real contracts on a test network, so you can sell, buy, exercise and stake without real money. Audits, testnet and mainnet are announced on X first.'
                    : 'Every action here is a real transaction on Robinhood Chain. Start small, read the risks, and follow X for listings and parameter changes.'}
                </p>
              </div>
              <XButton />
            </div>
          </div>
        </Reveal>
      </Wrap>
    </Bleed>
  )
}

function Intro() {
  const roles = [
    { k: 'Call seller', d: 'Locks ERC-20 tokens, sets a strike in ETH, an expiry and a premium.', g: 'Earns the premium. If exercised, receives the strike. Otherwise the tokens come back.' },
    { k: 'Put seller', d: 'Locks the full strike in WETH, chooses the token, expiry and premium.', g: 'Earns the premium. If exercised, receives the tokens. Otherwise the WETH comes back.' },
    { k: 'Buyer', d: 'Pays the premium and receives an Option NFT (ERC-721).', g: 'The right to exercise any time before expiry. The NFT can be held, transferred or sold.' },
  ]
  return (
    <Bleed className="mt-32 md:mt-44">
      <Wrap>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.25fr]">
          <SectionHead eyebrow={`What ${BRAND.name} is`} title={<>Options where every position is <span className="grad-text">paid for up front.</span></>} sub={`${BRAND.name} is a peer-to-peer options market on Robinhood Chain, an Ethereum L2. Sellers lock the full collateral when they create an offer. Buyers pay a premium for the right to exercise. Nothing is borrowed, so nothing can be liquidated.`} />
          <div className="hair border-t">
            {roles.map((r, i) => (
              <Reveal key={r.k} delay={i * 0.06}>
                <div className="hair grid gap-3 border-b py-7 md:grid-cols-[150px_1fr]">
                  <div className="flex items-baseline gap-3">
                    <span className="mono text-[12px] text-ink/35">0{i + 1}</span>
                    <span className="font-display text-[20px]">{r.k}</span>
                  </div>
                  <div>
                    <p className="text-[15px] leading-relaxed text-ink/85">{r.d}</p>
                    <p className="mt-2 text-[14px] leading-relaxed text-ink/50">{r.g}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Wrap>
    </Bleed>
  )
}

/** The four steps, told by the scroll-driven white sheet: every coin moves between parties as you scroll. */
function How() {
  return (
    <Bleed id="how" className="mt-32 md:mt-44">
      <Wrap>
        <SectionHead eyebrow="How it works" title="Four steps. One direction." sub="Lock, fill, exercise or expire, then the fee split. Scroll and watch the collateral, the premium, the Option NFT and the fees move between seller, escrow, buyer and the fee vault, using a live offer from the chain." />
        <div className="mt-12"><FlowStory /></div>
        <Lifecycle />
      </Wrap>
    </Bleed>
  )
}

function Lifecycle() {
  const Node = ({ label, tone = 'base' }: { label: string; tone?: 'base' | 'hi' | 'end' }) => (
    <span className={`mono inline-flex items-center rounded-full border px-4 py-2 text-[12px] tracking-widest ${tone === 'hi' ? 'border-[#6EFF85]/50 text-[#6EFF85]' : tone === 'end' ? 'hair text-ink/85' : 'hair text-ink/70'}`}>{label}</span>
  )
  const Edge = ({ t }: { t: string }) => (
    <span className="flex flex-col items-center px-2 md:flex-1">
      <span className="mono text-[10px] uppercase tracking-widest text-ink/40">{t}</span>
      <span className="mt-1.5 hidden h-px w-full bg-gradient-to-r from-[#6EFF85]/10 via-[#6EFF85]/50 to-[#4AFFEC]/10 md:block" />
      <ArrowDown size={14} className="mt-1 text-ink/30 md:hidden" />
    </span>
  )
  return (
    <Reveal>
      <div className="hair mt-16 rounded-2xl border p-6 md:p-10">
        <div className="eyebrow">Option lifecycle</div>
        <div className="mt-8 flex flex-col items-center gap-3 md:flex-row md:gap-0">
          <Node label="OPEN" />
          <Edge t="buy" />
          <Node label="FILLED" tone="hi" />
          <Edge t="settle" />
          <div className="flex flex-col items-center gap-2.5">
            <Node label="EXERCISED" tone="end" />
            <span className="mono text-[10px] text-ink/35">or</span>
            <Node label="EXPIRED" tone="end" />
          </div>
        </div>
        <p className="hair mt-8 border-t pt-6 text-[14px] leading-relaxed text-ink/55">
          An <span className="mono text-ink/80">OPEN</span> offer can be moved to <span className="mono text-ink/80">CANCELLED</span> by its seller at any time before it is filled. <span className="mono text-ink/80">EXERCISED</span> requires the current time to be before expiry; <span className="mono text-ink/80">EXPIRED</span> requires it to be at or after expiry. The windows never overlap.
        </p>
      </div>
    </Reveal>
  )
}

function Example() {
  const rows = [
    { when: 'Day 0', who: 'Alice creates', what: 'Locks 100,000 ZEPH. Strike 5 ETH, premium 0.2 ETH, expiry 7 days.', flows: [['Alice', 'to escrow', '100,000 ZEPH']] },
    { when: 'Day 0', who: 'Bob buys', what: 'Bob pays the 0.2 ETH premium and receives the Option NFT.', flows: [['Alice', 'receives', '0.194 ETH'], ['Fee vault', '3%', '0.006 ETH']] },
    { when: 'Day 5', who: 'Bob exercises', what: 'Bob pays the 5 ETH strike and receives the underlying tokens.', flows: [['Alice', 'receives', '4.995 ETH'], ['Fee vault', '0.1%', '0.005 ETH'], ['Bob', 'receives', '100,000 ZEPH']] },
  ]
  return (
    <Bleed className="mt-32 md:mt-44">
      <Wrap>
        <SectionHead eyebrow="Worked example" title="A covered call, end to end." sub="ZEPH is an example token used for illustration only." />
        <div className="hair mt-12 overflow-hidden rounded-2xl border">
          {rows.map((r, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <div className={`grid gap-5 p-6 md:grid-cols-[120px_1fr_1fr] md:p-8 ${i ? 'hair border-t' : ''}`}>
                <div>
                  <div className="mono text-[12px] text-[#6EFF85]">{r.when}</div>
                  <div className="font-display mt-1 text-[19px]">{r.who}</div>
                </div>
                <p className="text-[15px] leading-relaxed text-ink/70">{r.what}</p>
                <div className="space-y-2">
                  {r.flows.map(([a, b, c]) => (
                    <div key={a + c} className="hair flex items-baseline justify-between gap-4 border-b border-dashed pb-2 text-[14px] last:border-0">
                      <span className="text-ink/60">{a} <span className="text-ink/35">{b}</span></span>
                      <span className="mono text-ink">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
          <div className="hair border-t p-6 text-[14px] leading-relaxed text-ink/60 md:p-8" style={{ background: 'rgba(110,255,170,.025)' }}>
            <span className="text-ink">If Bob does not exercise:</span> after day 7, anyone can call <span className="mono text-[#8fffe0]">expire</span> and Alice gets her 100,000 ZEPH back. She keeps the premium either way.
          </div>
        </div>
      </Wrap>
    </Bleed>
  )
}

function Features() {
  const f = [
    ['Fully collateralised', 'Every option is 100% backed at creation. There is no leverage, no margin and no liquidation engine to fail.'],
    ['Non-custodial', 'Collateral sits in the market contract and can only go to its seller or the option holder. No admin function can move it.'],
    ['Options as NFTs', 'Each filled option is an ERC-721 with on-chain metadata. Hold it, transfer it or sell it; the holder exercises.'],
    ['Exit is always open', 'A pause can stop new offers and buys. It never blocks cancel, exercise or expire.'],
    ['Fees locked per position', 'Fees are snapshotted when a position is created. Later changes never touch open positions.'],
    ['Seller-set pricing', 'Premiums are chosen by sellers and accepted by buyers. No oracle sits between you and the price you agreed to.'],
  ]
  return (
    <Bleed className="mt-32 md:mt-44">
      <Wrap>
        <SectionHead eyebrow="Features" title={<>Built for traders who <span className="grad-text">read the contract.</span></>} />
        <div className="hair mt-14 grid gap-px overflow-hidden rounded-2xl border bg-[rgba(160,255,220,.09)] sm:grid-cols-2 lg:grid-cols-3">
          {f.map(([t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 0.06} className="h-full">
              <div className="group h-full bg-bg p-7 transition-colors duration-500 hover:bg-[#060a09] md:p-9">
                <span className="mono text-[12px] text-ink/35 transition-colors group-hover:text-[#6EFF85]">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="font-display mt-8 text-[22px]">{t}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink/60">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Wrap>
    </Bleed>
  )
}

function Fees() {
  const split = [
    { p: 30, t: 'Stakers', d: `Paid in WETH to ${BRAND.token} stakers, once per epoch.` },
    { p: 20, t: 'Buy-and-burn', d: `Swapped for ${BRAND.token} on Uniswap v4 and burned, on-chain.` },
    { p: 50, t: 'Operations', d: 'Sent to the operations multisig.' },
  ]
  return (
    <Bleed id="fees" className="mt-32 md:mt-44">
      <Wrap>
        <SectionHead eyebrow="Fees" title="Two fees. Split by the contract." sub="No other protocol fees exist. Network gas is separate." />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {[['3%', 'of the premium', 'Charged when an option is bought.'], ['0.1%', 'of the strike', 'Charged when an option is exercised.']].map(([n, u, d], i) => (
            <Reveal key={n} delay={i * 0.08}>
              <div className="panel rounded-2xl p-8 md:p-10">
                <div className="font-display text-[72px] leading-none md:text-[96px]"><span className="grad-text">{n}</span></div>
                <div className="mt-4 text-[17px]">{u}</div>
                <div className="mt-1 text-[14px] text-ink/55">{d}</div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="hair mt-6 rounded-2xl border p-7 md:p-10">
            <div className="eyebrow">Fee split, enforced on-chain</div>
            <div className="mt-6 flex h-3 w-full gap-1 overflow-hidden rounded-full">
              {split.map((s, i) => (
                <motion.span key={s.t} style={{ width: `${s.p}%`, opacity: 1 - i * 0.28 }} className="grad-bg h-full origin-left" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, delay: 0.15 * i, ease }} />
              ))}
            </div>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {split.map((s) => (
                <div key={s.t}>
                  <div className="font-display text-[34px]">{s.p}%</div>
                  <div className="mt-1 text-[15px]">{s.t}</div>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink/50">{s.d}</p>
                </div>
              ))}
            </div>
            <div className="hair mt-10 grid gap-3 border-t pt-7 text-[14px] sm:grid-cols-3">
              {[['Premium fee ceiling', 'never above 10%'], ['Exercise fee ceiling', 'never above 1%'], ['Stakers share floor', 'never below 20%']].map(([a, b]) => (
                <div key={a} className="hair flex items-center justify-between gap-3 rounded-lg border px-4 py-3 sm:block">
                  <div className="text-ink/50">{a}</div>
                  <div className="mono text-ink sm:mt-1">{b}</div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[13px] leading-relaxed text-ink/45">Ceilings are hard-coded in the contracts. Fees are fixed per position at creation. Every split and burn is listed on the <Link href="/proof" className="lnk text-ink/70 hover:text-ink">Proof page</Link>.</p>
          </div>
        </Reveal>
      </Wrap>
    </Bleed>
  )
}

function Security() {
  const pts = [
    'No admin function can move user funds. No sweep, rescue or emergency-withdraw function exists.',
    'Contracts are not upgradeable.',
    'Settings change only through a 10-minute timelock run by a multisig, within hard-coded ceilings.',
    'A guardian can only pause new offers and buys or disable a token. It cannot unpause, enable or touch funds.',
    'Pause never blocks cancel, exercise or expire.',
    'Buybacks must clear a 10-minute TWAP floor checked on-chain, so even a stolen keeper key cannot sell cheap.',
    'New stake is locked for its first earning epoch, so nobody can snipe a fee split and leave.',
  ]
  return (
    <Bleed className="mt-32 md:mt-44">
      <Wrap>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <SectionHead eyebrow="Security design" title={<>Users can <span className="grad-text">always exit.</span></>} sub={`${BRAND.name} is designed so that the people who run it have as little power over your funds as possible. The constraints are in the code, not in a promise.`} />
            <Reveal delay={0.1}>
              <Link href="/docs#risks" className="btn btn-ghost mt-8">Read the rules and risks <ArrowRight size={16} /></Link>
            </Reveal>
          </div>
          <ol className="hair border-t">
            {pts.map((p, i) => (
              <Reveal key={i} delay={i * 0.04}>
                <li className="hair flex gap-5 border-b py-5">
                  <span className="mono pt-0.5 text-[12px] text-[#6EFF85]">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[16px] leading-relaxed text-ink/80">{p}</span>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </Wrap>
    </Bleed>
  )
}

function Params() {
  const p = [['Expiry range', '1 hour to 90 days'], ['Minimum premium', '0.0005 ETH'], ['Listed tokens', legacyMarkets ? 'Up to 300, incl. every Robinhood Stock Token' : 'Up to 25'], ['Per-token limits', 'Exposure cap and minimum strike'], ['Strike currency', 'ETH (WETH in contracts)'], ['Payouts', 'WETH, with unwrap to ETH'], ['Network', 'Robinhood Chain (Ethereum L2)'], ['Contracts', 'Solidity 0.8.28, OpenZeppelin 5']]
  return (
    <Bleed className="mt-32 md:mt-44">
      <Wrap>
        <SectionHead eyebrow="Parameters" title="The rules, in one place." />
        <Reveal>
          <dl className="hair mt-12 grid border-t sm:grid-cols-2">
            {p.map(([k, v], i) => (
              <div key={k} className={`hair flex items-baseline justify-between gap-6 border-b py-5 ${i % 2 === 0 ? 'sm:pr-8' : 'sm:border-l sm:pl-8'}`}>
                <dt className="text-[14px] text-ink/50">{k}</dt>
                <dd className="mono text-right text-[14px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Wrap>
    </Bleed>
  )
}

function Roadmap() {
  const r = [
    { s: 'Done', done: true, t: 'Core contracts', d: 'Asset registry, Option NFT, call and put markets, fee vault, staking pool, buyback-and-burn, router and a Uniswap v4 hook. 111 automated tests (unit, fuzz, invariant and real v4 swaps) pass.' },
    { s: 'Done', done: true, t: 'Indexer, keeper and app', d: 'An indexer for on-chain events, a keeper for expiries, fee splits and buybacks, and this app wired to every contract action.' },
    ...(chain.id === 4663
      ? [
          { s: 'Done', done: true, t: 'Mainnet', d: 'Contracts deployed on Robinhood Chain mainnet, owned by a 10 minute timelock and multisigs. Launching with 3 tokens and low caps.' },
          { s: 'Next', done: false, t: 'Audits and bug bounty', d: 'Independent audits and a public bug bounty. Start small and read the risks first.' },
        ]
      : [
          { s: 'Next', done: false, t: 'Testnet', d: 'Deployment to Robinhood Chain testnet and a public beta.' },
          { s: 'Before mainnet', done: false, t: 'Audits and a careful launch', d: 'Independent audits, a public bug bounty, then mainnet with 3 tokens and low caps.' },
        ]),
  ]
  return (
    <Bleed className="mt-32 md:mt-44">
      <Wrap>
        <SectionHead eyebrow="Status and roadmap" title="Honest about where we are." sub="We do not promise dates. Launch announcements are made on X first." />
        <div className="relative mt-14">
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-[#6EFF85] via-[#4AFFEC]/30 to-transparent md:left-[calc(160px+7px)]" />
          {r.map((x, i) => (
            <Reveal key={x.t} delay={i * 0.05}>
              <div className="relative grid gap-2 pb-10 pl-9 md:grid-cols-[160px_1fr] md:pl-0">
                <div className="mono pt-0.5 text-[12px] uppercase tracking-widest text-ink/45 md:pr-10 md:text-right">{x.s}</div>
                <span className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 md:left-[160px] ${x.done ? 'border-[#6EFF85] bg-[#6EFF85]' : 'border-[#4AFFEC]/50 bg-bg'}`} />
                <div className="md:pl-10">
                  <h3 className="font-display text-[22px]">{x.t}</h3>
                  <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink/60">{x.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Wrap>
    </Bleed>
  )
}

function Faq() {
  const q = [
    [`Is ${BRAND.name} live?`, isDevnet || chain.testnet ? `${BRAND.name} runs on ${chain.name} today, with real contracts and test assets. Mainnet follows audits and is announced on @useKyte on X.` : `Yes. ${BRAND.name} runs on Robinhood Chain mainnet. Start small and read the risks first.`],
    ['Can I lose more than I put in?', 'No. There is no leverage and no margin. A buyer can lose the full premium. A seller can give up upside (calls) or be assigned tokens worth less than the strike (puts), but no position can be liquidated or go below zero.'],
    ['Who can touch my collateral?', 'Only you, as seller, or the holder of the option you sold, according to the rules of the contract. No admin, guardian or multisig can move it.'],
    [`What is ${BRAND.token} for?`, `Stakers receive 30% of all protocol fees in WETH, once per epoch. New stake starts earning from the next epoch and is locked through it. 20% of fees buy ${BRAND.token} on Uniswap v4 and burn it.`],
    [`Is ${BRAND.name} affiliated with Robinhood?`, `No. ${BRAND.name} is built on Robinhood Chain, an Ethereum L2. The name is used only to identify the network. ${BRAND.name} is not affiliated with or endorsed by Robinhood.`],
    ['How do I report a vulnerability?', 'Email contact@kyte.sh or send a direct message to @useKyte on X. Please do not disclose publicly until we have responded.'],
    ['Which wallets work?', 'Any Ethereum wallet installed in your browser. The picker only shows wallets it detects, so there is nothing to configure.'],
  ]
  const [open, setOpen] = useState<number | null>(0)
  return (
    <Bleed className="mt-32 md:mt-44">
      <Wrap>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
          <SectionHead eyebrow="Questions" title="Plain answers." />
          <div className="hair border-t">
            {q.map(([a, b], i) => {
              const on = open === i
              return (
                <div key={a} className="hair border-b">
                  {/* Question: label brightens and nudges right on hover; the plus spins into a minus in a ring that fills with the accent. */}
                  <button type="button" onClick={() => setOpen(on ? null : i)} className="group flex w-full items-center justify-between gap-6 py-6 text-left" aria-expanded={on}>
                    <span className={`font-display text-[18px] transition-[color,transform] duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-1 md:text-[20px] ${on ? 'text-ink' : 'text-ink/80 group-hover:text-ink'}`}>{a}</span>
                    <motion.span
                      animate={{ rotate: on ? 180 : 0, backgroundColor: on ? 'rgba(110,255,170,0.12)' : 'rgba(110,255,170,0)', borderColor: on ? 'rgba(160,255,220,0.35)' : 'rgba(160,255,220,0.09)' }}
                      transition={{ duration: 0.6, ease }}
                      className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors group-hover:border-[rgba(160,255,220,.3)]"
                    >
                      <motion.span animate={{ opacity: on ? 0 : 1, scale: on ? 0.5 : 1 }} transition={{ duration: 0.35, ease }} className="absolute inset-0 grid place-items-center"><Plus size={14} /></motion.span>
                      <motion.span animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.5 }} transition={{ duration: 0.35, ease }} className="absolute inset-0 grid place-items-center text-accent"><Minus size={14} /></motion.span>
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.div
                        key="a"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.6, ease }, opacity: { duration: 0.45, ease, delay: 0.08 } } }}
                        exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.45, ease }, opacity: { duration: 0.25, ease } } }}
                        className="overflow-hidden"
                      >
                        <motion.p initial={{ y: 10 }} animate={{ y: 0 }} exit={{ y: 6 }} transition={{ duration: 0.6, ease }} className="max-w-2xl pb-6 text-[15px] leading-relaxed text-ink/60">{b}</motion.p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      </Wrap>
    </Bleed>
  )
}

function FinalCta() {
  return (
    <Bleed className="mt-32 md:mt-44">
      <Wrap>
        <Reveal>
          <div className="grain hair relative overflow-hidden rounded-3xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/aura-smooth.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-70" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(2,6,5,.92) 0%, rgba(2,6,5,.55) 60%, rgba(2,6,5,.2) 100%)' }} />
            <div className="relative px-7 py-16 md:px-14 md:py-24">
              <div className="eyebrow !text-ink/70">Start with one offer</div>
              <h2 className="font-display mt-5 max-w-2xl text-[40px] font-medium leading-[1] md:text-[68px]">Earn premium. Keep control.</h2>
              <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-ink/75">Lock a token, set your terms, and collect the premium when it fills. An unfilled offer can be cancelled any time. Listings and launches are announced on X first.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/market" className="btn btn-x !px-7 !py-4 text-[15px]">Start trading <ArrowRight size={16} /></Link>
                <XButton size="lg" variant="ghost" />
              </div>
            </div>
          </div>
        </Reveal>
      </Wrap>
    </Bleed>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <LiveFrame />
      <Notice />
      <Intro />
      <How />
      <Example />
      <Features />
      <Fees />
      <Security />
      <Params />
      <Roadmap />
      <Faq />
      <FinalCta />
    </>
  )
}
