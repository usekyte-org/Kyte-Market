import { notFound } from 'next/navigation'
import { LaunchpadPage } from '@/components/launchpad/LaunchpadPage'
import { LAUNCHPAD_ENABLED } from '@/lib/config'

/** Unpublished in production (NEXT_PUBLIC_LAUNCHPAD_ENABLED=false) until launch; local dev keeps it. */
export default function Page() {
  if (!LAUNCHPAD_ENABLED) notFound()
  return <LaunchpadPage />
}
