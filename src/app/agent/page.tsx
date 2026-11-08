'use client'

import { AgentChat } from '@/components/agent/AgentChat'
import { PageHeader } from '@/components/ui'
import { BRAND } from '@/lib/config'

export default function AgentPage() {
  return (
    <>
      <PageHeader title={`Ask ${BRAND.name}`} sub="Plain-language answers about markets, offers, prices, your positions, staking and fee proof, built from live on-chain data. The agent prepares actions; you review and sign them in your wallet." />
      <div className="h-[min(72vh,760px)]"><AgentChat /></div>
      <p className="mt-4 text-xs text-faint">Non-custodial: the agent never sees keys and cannot send transactions. Every number comes from the same indexer the site uses. Conversations are not stored.</p>
    </>
  )
}
