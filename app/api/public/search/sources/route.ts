import { NextResponse } from 'next/server'
import { moduleExtensionPointComponents } from '@/lib/modules/extension-points'
import { listAvailableSources } from '@/modules/search/lib/indexer'

// Probe used by the Puck blocks' resolveFields to narrow their sidebars to the
// sources this install actually has, and to offer the designed-shop-card
// option only when shop has registered its search.shop-cards provider.
// Reveals nothing beyond which modules are installed - the same fact the
// public pages themselves reveal.
export async function GET() {
  const sources = await listAvailableSources()
  const shopCardProvider = Boolean(
    (moduleExtensionPointComponents['search.shop-cards']?.shop as { renderProductCards?: unknown } | undefined)?.renderProductCards,
  )
  return NextResponse.json({
    sources: sources.filter((s) => s.enabled).map((s) => ({ key: s.key, label: s.label })),
    shopCardProvider,
  })
}
