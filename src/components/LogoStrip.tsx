const STACK = ['Robinhood Chain', 'Uniswap v4', 'Arbitrum Orbit', 'OpenZeppelin', 'Foundry', 'viem']

/** Muted wordmarks of what the protocol is built on. */
export function LogoStrip() {
  return (
    <div className="text-center">
      <div className="label">Built on</div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {STACK.map((s) => (
          <span key={s} className="text-sm font-semibold tracking-tight text-faint transition-colors hover:text-muted">{s}</span>
        ))}
      </div>
    </div>
  )
}
