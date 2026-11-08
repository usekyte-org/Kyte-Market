import { DEMO } from '@/lib/config'
import { chain } from '@/lib/chains'

export function DemoBanner() {
  if (!DEMO) return null
  return (
    <div className="border-b border-warn/30 bg-warn/10 px-5 py-2 text-center text-xs text-warn">
      Demo data. Contracts aren&apos;t deployed yet, so nothing here is real and no transaction is sent. Network: {chain.name}.
    </div>
  )
}
