'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { chain } from '@/lib/chains'
import { PRIVY_APP_ID } from '@/lib/config'
import { wagmiConfig } from '@/lib/wagmi'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  if (!PRIVY_APP_ID) {
    return (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    )
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Wallets only, and only the ones installed in this browser (EIP-6963 detected). No email, no embedded wallets.
        loginMethods: ['wallet'],
        appearance: {
          walletList: ['detected_ethereum_wallets'],
          walletChainType: 'ethereum-only',
          showWalletLoginFirst: true,
          theme: 'dark',
          accentColor: '#4dfca9',
          logo: undefined,
        },
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
        defaultChain: chain,
        supportedChains: [chain],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={wagmiConfig}>{children}</PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
