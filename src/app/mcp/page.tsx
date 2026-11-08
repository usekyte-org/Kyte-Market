import { notFound } from 'next/navigation'
import { McpPage } from '@/components/mcp/McpPage'
import { MCP_ENABLED } from '@/lib/config'

/** Unpublished in production (NEXT_PUBLIC_MCP_ENABLED=false) until the connector launches; local dev keeps it. */
export default function Page() {
  if (!MCP_ENABLED) notFound()
  return <McpPage />
}
