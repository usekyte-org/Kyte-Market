import { createConfig as createPrivyConfig } from '@privy-io/wagmi'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { chain } from './chains'
import { PRIVY_APP_ID } from './config'

// With Privy, the wallet connectors come from Privy's picker (browser-detected wallets only, see Providers).
// Without an app id, fall back to the plain injected connector so the site still works.
export const wagmiConfig = PRIVY_APP_ID
  ? createPrivyConfig({ chains: [chain], transports: { [chain.id]: http() }, ssr: true })
  : createConfig({ chains: [chain], connectors: [injected()], transports: { [chain.id]: http() }, ssr: true })

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
