import { notFound } from 'next/navigation'
import { AutopilotPage } from '@/components/autopilot/AutopilotPage'
import { AUTOPILOT_ENABLED } from '@/lib/config'

/** Unpublished in production (NEXT_PUBLIC_AUTOPILOT_ENABLED=false) until launch; local dev keeps it. */
export default function Page() {
  if (!AUTOPILOT_ENABLED) notFound()
  return <AutopilotPage />
}
