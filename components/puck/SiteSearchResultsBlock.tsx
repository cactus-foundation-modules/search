import { searchCss } from '../public/search-css'
import { SOURCE_FIELD_MAP, type SiteSearchBlockProps } from './SiteSearchBlock'
import type { SearchSourceKey } from '@/modules/search/lib/types'

// Editor half only. The database-backed render is in ./SiteSearchResultsBlock.rsc.
// Never imports prisma - see SiteSearchBlock.tsx.

// Cached probe shared shape with the search box (separate cache: this one also
// carries the shop-cards provider flag).
let _probeCache: { data: ProbeResult; expires: number } | null = null
type ProbeResult = { sources: Array<{ key: string; label: string }>; shopCardProvider: boolean }
async function fetchProbe(): Promise<ProbeResult> {
  const now = Date.now()
  if (_probeCache && now < _probeCache.expires) return _probeCache.data
  try {
    const res = await fetch('/api/m/search/public/sources')
    if (!res.ok) return _probeCache?.data ?? { sources: [], shopCardProvider: false }
    const data = (await res.json()) as { sources?: Array<{ key: string; label: string }>; shopCardProvider?: boolean }
    _probeCache = { data: { sources: data.sources ?? [], shopCardProvider: data.shopCardProvider === true }, expires: now + 60_000 }
    return _probeCache.data
  } catch {
    return _probeCache?.data ?? { sources: [], shopCardProvider: false }
  }
}

export type SiteSearchResultsBlockProps = {
  // Content types
  searchPages?: string
  searchProducts?: string
  searchCategories?: string
  searchCollections?: string
  searchArticles?: string
  searchDirectory?: string
  searchForum?: string
  searchMembers?: string
  // Layout
  layout?: string
  columns?: string
  perPage?: number
  paginationStyle?: string
  groupBySource?: string
  filterTabs?: string
  sortControl?: string
  // Result cards
  productCardStyle?: string
  showThumbnails?: string
  thumbnailShape?: string
  showExcerpts?: string
  snippetLength?: string
  highlightMatches?: string
  showTypeBadges?: string
  showPrices?: string
  showDates?: string
  showAuthors?: string
  showUrls?: string
  // Headings & empty state
  headingTemplate?: string
  countTemplate?: string
  emptyTitle?: string
  emptyBody?: string
  // Audience. NB: keep this key as `audience`, never `visibility` - core owns a
  // responsive-visibility field of that exact name on every block and strips it
  // from render props, which would silently disable this gate.
  audience?: string
  // Injected by the /search page (inject-search-context.ts), never fields
  searchQuery?: string
  searchPageNum?: number
  searchSort?: string
  searchSourcesParam?: string
}

export function resultsSourcesFromProps(props: SiteSearchResultsBlockProps): SearchSourceKey[] {
  const asBoxProps = props as SiteSearchBlockProps
  const chosen = SOURCE_FIELD_MAP.filter((m) => asBoxProps[m.field] !== 'no').map((m) => m.key)
  return chosen.length === SOURCE_FIELD_MAP.length ? [] : chosen
}

const yesNo = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

export function SiteSearchResultsBlock(props: SiteSearchResultsBlockProps) {
  const layout = props.layout ?? 'list'
  const ghost = (key: number) => (
    <span key={key} className="srch-row" style={{ display: 'grid', opacity: 0.6 }}>
      {props.showThumbnails !== 'no' ? <span className="srch-row-thumb" /> : <span />}
      <span className="srch-row-main">
        <span style={{ display: 'block', height: 13, width: '55%', background: 'var(--color-border)', borderRadius: 4 }} />
        {props.showExcerpts !== 'no' && (
          <span style={{ display: 'block', height: 10, width: '92%', background: 'var(--color-border)', borderRadius: 4, marginTop: 6 }} />
        )}
      </span>
    </span>
  )
  const ghostCard = (key: number) => (
    <span key={key} className="srch-card" style={{ opacity: 0.6 }}>
      <span className="srch-card-img" style={{ display: 'block' }} />
      <span className="srch-card-body" style={{ display: 'block' }}>
        <span style={{ display: 'block', height: 12, width: '75%', background: 'var(--color-border)', borderRadius: 4 }} />
      </span>
    </span>
  )
  return (
    <div className={`srch-results srch-thumb-${props.thumbnailShape ?? 'landscape'}`}>
      <style dangerouslySetInnerHTML={{ __html: searchCss() }} />
      {(props.headingTemplate ?? 'Results for "{query}"') !== '' && (
        <h2 className="srch-res-heading">{(props.headingTemplate ?? 'Results for "{query}"').replace('{query}', 'example')}</h2>
      )}
      {(props.countTemplate ?? '{count} results') !== '' && (
        <p className="srch-res-count">{(props.countTemplate ?? '{count} results').replace('{count}', '12')}</p>
      )}
      {props.filterTabs !== 'no' && (
        <div className="srch-tabs" style={{ pointerEvents: 'none' }}>
          <span className="srch-tab srch-tab-active">All</span>
          <span className="srch-tab">Products</span>
          <span className="srch-tab">Articles</span>
        </div>
      )}
      {layout === 'grid' ? (
        <div className="srch-grid" style={{ ['--srch-cols' as string]: props.columns ?? '3', pointerEvents: 'none' } as React.CSSProperties}>
          {[0, 1, 2].map(ghostCard)}
        </div>
      ) : (
        <div className={`srch-list${layout === 'compact' ? ' srch-list-compact' : ''}`} style={{ pointerEvents: 'none' }}>
          {[0, 1, 2].map(ghost)}
        </div>
      )}
    </div>
  )
}

export const siteSearchResultsPuckComponent = {
  label: 'Search Results',
  fields: {
    // Content types (narrowed to installed modules by resolveFields)
    ...Object.fromEntries(SOURCE_FIELD_MAP.map((m) => [m.field, { type: 'select' as const, label: m.label, options: yesNo }])),
    // Layout
    layout: {
      type: 'select' as const, label: 'Layout',
      options: [
        { value: 'list', label: 'List' },
        { value: 'grid', label: 'Grid' },
        { value: 'compact', label: 'Compact list' },
      ],
    },
    columns: {
      type: 'select' as const, label: 'Grid columns',
      options: [
        { value: '2', label: '2' },
        { value: '3', label: '3' },
        { value: '4', label: '4' },
      ],
    },
    perPage: { type: 'number' as const, label: 'Results per page', min: 5, max: 50 },
    paginationStyle: {
      type: 'select' as const, label: 'Pagination',
      options: [
        { value: 'numbered', label: 'Numbered pages' },
        { value: 'loadMore', label: 'Load more button' },
      ],
    },
    groupBySource: { type: 'select' as const, label: 'Group by content type', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    filterTabs: { type: 'select' as const, label: 'Content-type filter tabs', options: yesNo },
    sortControl: { type: 'select' as const, label: 'Sort control (relevance/newest)', options: yesNo },
    // Result cards
    productCardStyle: {
      type: 'select' as const, label: 'Product results as',
      options: [
        { value: 'standard', label: 'Standard result cards' },
        { value: 'shopCard', label: 'Designed shop product cards' },
      ],
    },
    showThumbnails: { type: 'select' as const, label: 'Show thumbnails', options: yesNo },
    thumbnailShape: {
      type: 'select' as const, label: 'Thumbnail shape',
      options: [
        { value: 'landscape', label: 'Landscape' },
        { value: 'square', label: 'Square' },
        { value: 'circle', label: 'Circle' },
      ],
    },
    showExcerpts: { type: 'select' as const, label: 'Show excerpts', options: yesNo },
    snippetLength: {
      type: 'select' as const, label: 'Excerpt length',
      options: [
        { value: 'short', label: 'Short' },
        { value: 'medium', label: 'Medium' },
        { value: 'long', label: 'Long' },
      ],
    },
    highlightMatches: { type: 'select' as const, label: 'Highlight matched words', options: yesNo },
    showTypeBadges: { type: 'select' as const, label: 'Show content-type badges', options: yesNo },
    showPrices: { type: 'select' as const, label: 'Show product prices', options: yesNo },
    showDates: { type: 'select' as const, label: 'Show dates', options: yesNo },
    showAuthors: { type: 'select' as const, label: 'Show authors', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    showUrls: { type: 'select' as const, label: 'Show result URLs', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    // Headings & empty state
    headingTemplate: { type: 'text' as const, label: 'Heading ({query} = search term, blank hides)' },
    countTemplate: { type: 'text' as const, label: 'Count line ({count} = result count, blank hides)' },
    emptyTitle: { type: 'text' as const, label: 'No-results title' },
    emptyBody: { type: 'textarea' as const, label: 'No-results text' },
    // Audience. See the note on SiteSearchResultsBlockProps: the key must stay
    // `audience`, never `visibility`.
    audience: {
      type: 'select' as const, label: 'Who can see this',
      options: [
        { value: 'everyone', label: 'Everyone' },
        { value: 'admin', label: 'Admins only' },
      ],
    },
  },
  defaultProps: {
    searchPages: 'yes',
    searchProducts: 'yes',
    searchCategories: 'yes',
    searchCollections: 'yes',
    searchArticles: 'yes',
    searchDirectory: 'yes',
    searchForum: 'yes',
    searchMembers: 'yes',
    layout: 'list',
    columns: '3',
    perPage: 20,
    paginationStyle: 'numbered',
    groupBySource: 'no',
    filterTabs: 'yes',
    sortControl: 'yes',
    // Designed shop cards by default, matching what the search box's dropdown
    // shows for the same products. Degrades to standard rows on its own when
    // shop is absent (no search.shop-cards provider) - see the RSC half.
    productCardStyle: 'shopCard',
    showThumbnails: 'yes',
    thumbnailShape: 'landscape',
    showExcerpts: 'yes',
    snippetLength: 'medium',
    highlightMatches: 'yes',
    showTypeBadges: 'yes',
    showPrices: 'yes',
    showDates: 'yes',
    showAuthors: 'no',
    showUrls: 'no',
    headingTemplate: 'Results for "{query}"',
    countTemplate: '{count} results',
    emptyTitle: 'Nothing found',
    emptyBody: 'No matches for that. Check the spelling, or try fewer words.',
    audience: 'everyone',
  },
  async resolveFields(data: { props: SiteSearchResultsBlockProps }, { fields }: { fields: Record<string, unknown> }) {
    const next = { ...fields }
    const props = data.props ?? {}
    const probe = await fetchProbe()
    const availableKeys = new Set(probe.sources.map((s) => s.key))

    for (const m of SOURCE_FIELD_MAP) {
      if (probe.sources.length > 0 && !availableKeys.has(m.key)) delete next[m.field]
    }
    const shopPresent = probe.sources.length === 0 || availableKeys.has('shop-product')
    const productsOn = shopPresent && props.searchProducts !== 'no'

    if (!productsOn) {
      delete next.productCardStyle
      delete next.showPrices
    } else if (!probe.shopCardProvider) {
      delete next.productCardStyle
    }
    const shopCards = productsOn && probe.shopCardProvider && (props.productCardStyle ?? 'shopCard') === 'shopCard'
    // The designed shop card is stamped server-side and cannot be appended by
    // the client load-more island - numbered pagination only in that mode.
    if (shopCards) delete next.paginationStyle
    // Shop cards lay out in their own grid whatever the block's Layout says, so
    // the column count stays editable outside grid layout in that mode.
    if ((props.layout ?? 'list') !== 'grid' && !shopCards) delete next.columns
    if (props.showThumbnails === 'no') delete next.thumbnailShape
    if (props.showExcerpts === 'no') {
      delete next.snippetLength
      delete next.highlightMatches
    }
    return next
  },
  render: SiteSearchResultsBlock,
}
