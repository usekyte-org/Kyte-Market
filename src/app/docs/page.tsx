import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { Callout, Figure, H2, H3, P, Steps, Table, Tile } from '@/components/docs/Blocks'
import { CopyButton, DocsShell, type DocSection } from '@/components/docs/DocsShell'
import { chain, contracts, explorerAddress, marketsVersion, settlingMarkets } from '@/lib/chains'
import { BRAND, FEES, LIMITS, SPLIT } from '@/lib/config'
import { bps } from '@/lib/format'

export const metadata = { title: `Docs · ${BRAND.name}` }

const SECTIONS: DocSection[] = [
  { id: 'overview', label: 'Overview', group: 'Start here' },
  { id: 'how', label: 'How it works', group: 'Start here' },
  { id: 'sell', label: 'Selling an option', group: 'Start here' },
  { id: 'buy', label: 'Buying and exercising', group: 'Start here' },
  { id: 'fees', label: 'Fees', group: 'Protocol' },
  { id: 'split', label: 'Fee split and buyback', group: 'Protocol' },
  { id: 'v4', label: 'Uniswap v4', group: 'Protocol' },
  { id: 'rules', label: 'Rules and limits', group: 'Protocol' },
  { id: 'risks', label: 'Risks', group: 'Protocol' },
  { id: 'contracts', label: 'Contract addresses', group: 'Reference' },
  { id: 'glossary', label: 'Glossary', group: 'Reference' },
]

const CORE: [keyof typeof contracts, string, string][] = [
  ['assetRegistry', 'AssetRegistry', 'Listed tokens, caps and minimum strikes'],
  ['callMarket', 'CallMarket', 'Covered calls: offers, fills, exercise, expiry'],
  ['putMarket', 'PutMarket', 'Cash-secured puts'],
  ['optionNft', 'OptionNFT', 'Transferable position token'],
  ['router', 'Router', 'Buy and exercise with plain ETH'],
  ['feeVault', 'FeeVault', 'Collects fees, splits them once per epoch'],
  ['stakingPool', 'StakingPool', `${BRAND.token} staking and fee claims`],
  ['buybackBurner', 'BuybackBurner', `Buys ${BRAND.token} on Uniswap v4 and burns it`],
  ['kyteHook', 'KyteHook', `Uniswap v4 hook on the ${BRAND.token}/WETH pool: TWAP and swap fee`],
  ['swapAdapter', 'UniswapV4Adapter', 'Direct PoolManager swaps for the buyback'],
  ['timelock', 'Timelock', 'Governance: listings, fee changes, re-enabling'],
  ['guardian', 'Guardian', 'Emergency pause and disable, no timelock'],
]
const EXTERNAL: [keyof typeof contracts, string, string][] = [
  ['kyteToken', `${BRAND.token}`, 'Protocol token'],
  ['weth', 'WETH', 'Wrapped ETH, the quote asset'],
  ['uniswapV4PoolManager', 'Uniswap v4 PoolManager', 'Singleton the hook and adapter talk to'],
]

function Address({ addr }: { addr?: string }) {
  if (!addr) return <span className="text-faint">not deployed</span>
  const url = explorerAddress(addr)
  return (
    <span className="flex items-center gap-2">
      <code className="truncate font-mono text-[13px] text-ink">{addr}</code>
      <CopyButton text={addr} />
      {url && (
        <a href={url} target="_blank" rel="noreferrer" aria-label="Open in explorer" className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line text-muted transition-colors hover:border-line-strong hover:text-ink">
          <ArrowUpRight size={13} />
        </a>
      )}
    </span>
  )
}

export default function DocsPage() {
  const name = BRAND.name
  return (
    <div className="pt-10">
      <div className="mb-10 border-b border-line pb-10">
        <div className="label mb-3">Documentation</div>
        <h1 className="text-4xl tracking-tight md:text-5xl">{name} Docs</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
          Everything about covered options on Robinhood Chain: how a position is created, what it costs, where the fees go, and the addresses behind it all.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ['/sell', 'Sell an option', 'Lock collateral, collect the premium up front.'],
            ['/market', 'Buy an option', 'Pick a listed stock token and a strike.'],
            ['/stake', `Stake ${BRAND.token}`, `Earn ${bps(SPLIT.stakersBps)} of protocol fees.`],
          ].map(([href, t, s]) => (
            <Link key={href} href={href} className="card card-hover group flex items-start justify-between gap-3 p-5">
              <div>
                <div className="text-sm font-medium text-ink">{t}</div>
                <div className="mt-1 text-[13px] leading-5 text-muted">{s}</div>
              </div>
              <ArrowRight size={16} className="mt-0.5 shrink-0 text-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          ))}
        </div>
      </div>

      <DocsShell sections={SECTIONS}>
        <article className="max-w-3xl space-y-16 pb-20">
          <section>
            <H2 id="overview" eyebrow="Start here">Overview</H2>
            <P>
              <strong>{name}</strong> is a non-custodial options market for the tokens on Robinhood Chain, including every Robinhood Stock Token. Every option is <strong>fully collateralised</strong> from the moment it is listed: a call locks the tokens, a put locks the ETH. There is no leverage, no margin and no liquidation, and no price oracle decides anything.
            </P>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Tile title="Physical settlement">The holder pays the strike and receives the tokens (call), or delivers the tokens and receives the strike (put). Nothing is cash-settled against a price feed.</Tile>
              <Tile title="Options are NFTs">A filled offer mints an Option NFT to the buyer. Whoever holds it at exercise time gets the payout, so positions can be transferred or sold on.</Tile>
              <Tile title="Priced in ETH">Strikes and premiums are in ETH. Payouts arrive as WETH, which you can unwrap on the Positions page.</Tile>
              <Tile title="Fees fund the token">Every fee is split between {BRAND.token} stakers, an on-chain buyback and burn, and operations. The split is verifiable on the Proof page.</Tile>
            </div>
          </section>

          <section>
            <H2 id="how">How it works</H2>
            <H3>Covered call</H3>
            <P>
              A seller locks <strong>tokens</strong> and sets three things: a strike price in ETH, an expiry, and the premium they want. A buyer pays the premium and receives the Option NFT. Until expiry, the holder can pay the strike and take the tokens. If nobody exercises, anyone can call <code>expire</code> after expiry and the tokens return to the seller, who keeps the premium either way.
            </P>
            <H3>Cash-secured put</H3>
            <P>
              The mirror image. The seller locks <strong>ETH</strong> (held as WETH) equal to the strike. The holder can deliver the tokens before expiry and receive that ETH. If the option expires unused, the ETH returns to the seller.
            </P>
            <Callout title="No oracle, no auto-exercise">
              {name} never reads a price. The holder decides whether exercising is worth it and sends the transaction. An option that is in the money but never exercised simply expires.
            </Callout>
          </section>

          <section>
            <H2 id="sell">Selling an option</H2>
            <Steps
              items={[
                { title: 'Pick the token and the side', body: <>Covered call (you hold the token) or cash-secured put (you hold ETH). Only tokens listed in the <code>AssetRegistry</code> can be used.</> },
                { title: 'Set strike, expiry and premium', body: <>Expiry must be between {LIMITS.minDurationSec / 3600} hour and {LIMITS.maxDurationSec / 86400} days away. The premium must be at least {LIMITS.minPremiumEth} ETH. The Sell page shows a Black-Scholes estimate as a starting point.</> },
                { title: 'Choose a fill deadline', body: <>How long the offer stays open for buyers. It cannot be later than expiry. If it passes unfilled, you can reclaim your collateral at any time.</> },
                { title: 'Approve and list', body: <>One approval for the token (calls) or WETH (puts), then <code>createOffer</code>. Your collateral moves into the market contract and the offer appears on the Market page.</> },
                { title: 'Get paid when it fills', body: <>The premium, minus the {bps(FEES.premiumBps)} fee, is sent to you the moment a buyer fills. From then on the position runs to exercise or expiry.</> },
              ]}
            />
            <Callout tone="tip" title="Cancelling is free">
              An unfilled offer can be cancelled at any time with <code>cancelUnfilled</code>. Only gas is paid; no fee is charged until a buyer actually fills.
            </Callout>
          </section>

          <section>
            <H2 id="buy">Buying and exercising</H2>
            <Steps
              items={[
                { title: 'Buy from the Market page', body: <>Pay the premium in ETH through the <code>Router</code>, which wraps it for you. You receive the Option NFT; the seller receives the premium.</> },
                { title: 'Hold, transfer or sell the NFT', body: <>The position belongs to whoever holds the NFT. Transfer it like any ERC-721; the new holder gets the exercise right.</> },
                { title: 'Exercise before expiry', body: <>Calls: pay the strike in ETH via <code>exerciseWithETH</code> and receive the tokens. Puts: approve the tokens and call <code>exercisePut</code> to receive the strike. A {bps(FEES.exerciseBps)} fee on the strike applies.</> },
                { title: 'Or let it expire', body: <>If you do nothing, the option expires worthless, the collateral returns to the seller and the NFT is burned.</> },
              ]}
            />
            <Callout tone="warn" title="Exercise early, not at the last block">
              Robinhood Chain has a single sequencer. A transaction that lands after the expiry timestamp fails, and the position is then expirable by anyone. Leave yourself a margin.
            </Callout>
          </section>

          <section>
            <H2 id="fees" eyebrow="Protocol">Fees</H2>
            <Table
              head={['Action', 'Fee', 'Paid by', 'When']}
              rows={[
                ['Fill an offer', <strong key="a" className="text-ink">{bps(FEES.premiumBps)} of the premium</strong>, 'Seller (deducted from the premium)', 'When a buyer fills'],
                ['Exercise', <strong key="b" className="text-ink">{bps(FEES.exerciseBps)} of the strike</strong>, 'Holder', 'When the option is exercised'],
                ['Cancel unfilled', 'Free', '—', 'Gas only'],
                ['Expire', 'Free', '—', 'Gas only; anyone can call it'],
                ['Stake, unstake, claim', 'Free', '—', 'Gas only'],
              ]}
            />
            <Callout title="Fees are frozen per position">
              The fee rates are written onto each position when it is created. A later governance change never affects an option that is already open. Hard caps in the contracts: at most 10% of the premium and 1% of the strike.
            </Callout>
          </section>

          <section>
            <H2 id="split">Fee split and buyback</H2>
            <P>The <code>FeeVault</code> gathers every fee in WETH and splits it once per epoch ({LIMITS.epochSec / 3600} hours). Each split is an on-chain <code>FeesSplit</code> event, and each buyback ends in a <code>Burned</code> event. The Proof page lists both.</P>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Figure value={bps(SPLIT.stakersBps)} label={`${BRAND.token} stakers`} sub="Claimable in WETH from the Stake page, pro rata to stake." />
              <Figure value={bps(SPLIT.buybackBps)} label="Buyback and burn" sub={`Swapped for ${BRAND.token} on Uniswap v4 and burned in the same transaction.`} />
              <Figure value={bps(SPLIT.opsBps)} label="Operations" sub="Keeper gas, infrastructure and listings, paid to the ops Safe." />
            </div>
            <P>
              <span className="mt-4 block">Stakers always receive at least 20%: the contracts refuse a split that goes below it.</span>
            </P>
          </section>

          <section>
            <H2 id="v4">Uniswap v4 inside {name}</H2>
            <P>{name} does not run its own exchange. Three parts of the protocol sit directly on Uniswap v4 on Robinhood Chain.</P>
            <div className="mt-6 grid gap-3">
              <Tile title="Buyback and burn" badge="UniswapV4Adapter">
                Every epoch, {bps(SPLIT.buybackBps)} of fees are swapped for {BRAND.token} straight on the v4 <code>PoolManager</code> and burned in the same transaction. The slippage bound is checked against the hook&apos;s TWAP, with a per-call cap on size.
              </Tile>
              <Tile title={`KyteHook on the ${BRAND.token}/WETH pool`} badge="afterSwap">
                Records a price observation after every swap and exposes a <strong>10-minute TWAP</strong> that a single block cannot move. The same hook takes <strong>0.1%</strong> of the WETH side of each swap in that pool and sends it to the <code>FeeVault</code>, where it joins the normal split. Its fee rate (max 1%) and vault can only be changed by the timelock.
              </Tile>
              <Tile title="Price feed for the charts" badge="Swap events">
                The Market and Sell charts are built from v4 <code>Swap</code> events on each listed token&apos;s WETH pool, plus Robinhood market quotes for stock tokens. Nothing is quoted from a private API.
              </Tile>
            </div>
            <Callout title="Why the hook address looks mined">
              A v4 hook&apos;s permissions are encoded in its address, so <code>KyteHook</code> is deployed at a CREATE2 address with the <code>afterInitialize</code>, <code>afterSwap</code> and <code>afterSwapReturnDelta</code> bits set.
            </Callout>
          </section>

          <section>
            <H2 id="rules">Rules and limits</H2>
            <Table
              head={['Rule', 'Value']}
              rows={[
                ['Expiry window', `${LIMITS.minDurationSec / 3600} hour to ${LIMITS.maxDurationSec / 86400} days from listing`],
                ['Fill deadline', 'Per offer; never later than expiry. After it passes, the seller can reclaim collateral.'],
                ['Minimum premium', `${LIMITS.minPremiumEth} ETH`],
                ['Minimum strike', 'Per token, set in the AssetRegistry'],
                ['Exposure cap', 'Per token and per market; new offers beyond the cap are rejected'],
                ['Open offers per seller', '200'],
                ['Eligible tokens', 'Listed tokens only. Fee-on-transfer and rebasing tokens are rejected.'],
                ['Pause', 'Blocks new offers and fills only. Cancel, exercise, expire, unstake and claim always work.'],
                ['Settlement asset', 'WETH. Unwrap to ETH from the Positions page.'],
              ]}
            />
          </section>

          <section>
            <H2 id="risks">Risks</H2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Tile title="If you sell">You give up upside above the strike (calls), or you may have to buy tokens that keep falling (puts). The premium is yours regardless.</Tile>
              <Tile title="If you buy">You can lose the whole premium if the option is never worth exercising.</Tile>
              <Tile title="Timing">Exercise needs a confirmed transaction before the expiry timestamp. Do not wait for the last minute.</Tile>
              <Tile title="Token risk">Listed tokens can be volatile, illiquid, or carry issuer controls such as blocklists and pauses.</Tile>
            </div>
            <Callout tone="warn" title="Smart contract risk">
              The contracts are tested, but any contract can have bugs. Only use funds you can afford to lose.
            </Callout>
          </section>

          <section>
            <H2 id="contracts" eyebrow="Reference">Contract addresses</H2>
            <P>All addresses are on <strong>{chain.name}</strong> (chain id {chain.id}). {settlingMarkets.length > 0 && <> The current markets are the v{marketsVersion} set; {settlingMarkets.map((m) => `v${m.version}`).reverse().join(' and ')} markets only settle the positions they already hold.</>}</P>
            <div className="my-6 overflow-hidden rounded-xl border border-line">
              <div className="border-b border-line bg-bg-2 px-4 py-2.5 text-[13px] font-medium text-ink">Protocol</div>
              <div className="divide-y divide-line">
                {CORE.map(([key, label, what]) => (
                  <div key={key} className="grid gap-2 px-4 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                    <div>
                      <div className="text-sm font-medium text-ink">{label}</div>
                      <div className="text-[12px] leading-4 text-faint">{what}</div>
                    </div>
                    <Address addr={contracts[key] as string | undefined} />
                  </div>
                ))}
              </div>
            </div>
            <div className="my-6 overflow-hidden rounded-xl border border-line">
              <div className="border-b border-line bg-bg-2 px-4 py-2.5 text-[13px] font-medium text-ink">External</div>
              <div className="divide-y divide-line">
                {EXTERNAL.map(([key, label, what]) => (
                  <div key={key} className="grid gap-2 px-4 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                    <div>
                      <div className="text-sm font-medium text-ink">{label}</div>
                      <div className="text-[12px] leading-4 text-faint">{what}</div>
                    </div>
                    <Address addr={contracts[key] as string | undefined} />
                  </div>
                ))}
              </div>
            </div>
            {settlingMarkets.map(({ version, markets }) => (
              <div key={version} className="my-6 overflow-hidden rounded-xl border border-line">
                <div className="flex items-center justify-between border-b border-line bg-bg-2 px-4 py-2.5">
                  <span className="text-[13px] font-medium text-ink">Markets v{version}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted">settling only</span>
                </div>
                <div className="divide-y divide-line">
                  {([['callMarket', 'CallMarket'], ['putMarket', 'PutMarket'], ['optionNft', 'OptionNFT'], ['assetRegistry', 'AssetRegistry'], ['router', 'Router']] as const).map(([key, label]) => (
                    <div key={key} className="grid gap-2 px-4 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                      <div className="text-sm font-medium text-ink">{label} v{version}</div>
                      <Address addr={markets[key]} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <P>
              The full list of listed tokens, with live prices, is on the <Link href="/market" className="text-accent hover:underline">Market page</Link>. Source code lives in the <code>contracts/</code> folder of the repository.
            </P>
          </section>

          <section>
            <H2 id="glossary">Glossary</H2>
            <Table
              head={['Term', 'Meaning']}
              rows={[
                ['Covered call', 'A call option backed by the actual tokens, locked in the contract.'],
                ['Cash-secured put', 'A put option backed by the strike amount in ETH, locked in the contract.'],
                ['Strike', 'The price, in ETH per token, at which the option can be exercised.'],
                ['Premium', 'What the buyer pays the seller for the option, in ETH.'],
                ['Expiry', 'The timestamp after which the option can no longer be exercised.'],
                ['Fill deadline', 'How long an unfilled offer stays open for buyers.'],
                ['Option NFT', 'The ERC-721 that represents a filled position. The holder has the exercise right.'],
                ['Epoch', `The ${LIMITS.epochSec / 3600}-hour window after which the FeeVault splits collected fees.`],
                ['Keeper', 'The bot that expires positions, triggers the epoch split and runs the buyback.'],
                ['Guardian', 'A Safe that can pause the protocol or disable a token instantly. Re-enabling needs the timelock.'],
              ]}
            />
          </section>

          <div className="flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted">Something missing? Ask on <a href="https://x.com/useKyte" target="_blank" rel="noreferrer" className="text-ink hover:underline">@useKyte</a>.</div>
            <Link href="/market" className="btn btn-primary">Open the market <ArrowRight size={16} /></Link>
          </div>
        </article>
      </DocsShell>
    </div>
  )
}
