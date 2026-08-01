import { searchCss } from '../public/search-css'
import type { SearchSourceKey } from '@/modules/search/lib/types'

// Editor half only. The live render (with the client search island) is in
// ./SiteSearchBlock.rsc. This file reaches the Puck editor's client bundle
// through the generated module-components registry, so it must never import
// prisma or any server-only API.

// Cached fetch so resolveFields doesn't refetch on every panel keystroke.
let _sourcesCache: { data: Array<{ key: string; label: string }>; expires: number } | null = null
async function fetchAvailableSources(): Promise<Array<{ key: string; label: string }>> {
  const now = Date.now()
  if (_sourcesCache && now < _sourcesCache.expires) return _sourcesCache.data
  try {
    const res = await fetch('/api/m/search/public/sources')
    if (!res.ok) return _sourcesCache?.data ?? []
    const data = (await res.json()) as { sources?: Array<{ key: string; label: string }> }
    _sourcesCache = { data: data.sources ?? [], expires: now + 60_000 }
    return _sourcesCache.data
  } catch {
    return _sourcesCache?.data ?? []
  }
}

export type SiteSearchBlockProps = {
  // Behaviour
  mode?: string
  minChars?: number
  debounce?: string
  maxResults?: number
  groupResults?: string
  hotkey?: string
  autoFocus?: string
  resultsPath?: string
  // Content types
  searchPages?: string
  searchProducts?: string
  searchCategories?: string
  searchCollections?: string
  searchArticles?: string
  searchDirectory?: string
  searchForum?: string
  searchMembers?: string
  // Appearance
  presentation?: string
  placeholder?: string
  buttonLabel?: string
  ariaLabel?: string
  showIcon?: string
  size?: string
  cornerStyle?: string
  fieldStyle?: string
  accent?: string
  widthMode?: string
  widthPx?: number
  align?: string
  // Dropdown results
  dropdownWidth?: string
  productDisplay?: string
  dropdownColumns?: string
  showThumbnails?: string
  showExcerpts?: string
  showTypeBadges?: string
  showPrices?: string
  highlightMatches?: string
  viewAllLabel?: string
  emptyText?: string
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

// Field name -> index source key, in sidebar order.
export const SOURCE_FIELD_MAP: ReadonlyArray<{ field: keyof SiteSearchBlockProps & string; key: SearchSourceKey; label: string }> = [
  { field: 'searchPages', key: 'page', label: 'Search pages' },
  { field: 'searchProducts', key: 'shop-product', label: 'Search products' },
  { field: 'searchCategories', key: 'shop-category', label: 'Search shop categories' },
  { field: 'searchCollections', key: 'shop-collection', label: 'Search shop collections' },
  { field: 'searchArticles', key: 'gazette-post', label: 'Search articles' },
  { field: 'searchDirectory', key: 'directory-entry', label: 'Search directory' },
  { field: 'searchForum', key: 'boards-thread', label: 'Search forum' },
  { field: 'searchMembers', key: 'member', label: 'Search members' },
]

// The explicit source list a block's toggles produce. Every toggle on = empty
// list, meaning "all enabled sources" - so a source added later joins
// automatically instead of being silently excluded by stored props.
export function sourcesFromProps(props: SiteSearchBlockProps): SearchSourceKey[] {
  const chosen = SOURCE_FIELD_MAP.filter((m) => props[m.field] !== 'no').map((m) => m.key)
  return chosen.length === SOURCE_FIELD_MAP.length ? [] : chosen
}

const yesNo = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

export function SiteSearchBlock(props: SiteSearchBlockProps) {
  const size = props.size ?? 'medium'
  const showGhostDropdown = (props.mode ?? 'page') !== 'page'
  const boxClasses = [
    'srch-box',
    `srch-size-${size}`,
    `srch-corner-${props.cornerStyle ?? 'rounded'}`,
    `srch-style-${props.fieldStyle ?? 'outlined'}`,
    `srch-accent-${props.accent ?? 'primary'}`,
    props.widthMode === 'fixed' ? `srch-align-${props.align ?? 'left'}` : '',
  ].filter(Boolean).join(' ')
  const boxStyle: React.CSSProperties = props.widthMode === 'fixed'
    ? { width: props.widthPx ?? 320, maxWidth: '100%' }
    : { width: '100%' }

  return (
    <div className={boxClasses} style={boxStyle}>
      <style dangerouslySetInnerHTML={{ __html: searchCss() }} />
      {props.presentation === 'iconButton' ? (
        <span className="srch-iconbtn" aria-hidden="true">
          <svg className="srch-iconsvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        </span>
      ) : (
        <div className="srch-input-wrap" aria-hidden="true">
          {props.showIcon !== 'no' && (
            <svg className="srch-iconsvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          )}
          <span className="srch-input" style={{ color: 'var(--color-text-muted)' }}>{props.placeholder || 'Search…'}</span>
          {props.presentation === 'fieldWithButton' && (
            <span className="srch-btn">{props.buttonLabel || 'Search'}</span>
          )}
        </div>
      )}
      {showGhostDropdown && props.presentation !== 'iconButton' && (
        <div style={{ marginTop: 6, border: '1px solid var(--color-border)', borderRadius: 10, padding: '.375rem', opacity: 0.6, pointerEvents: 'none' }}>
          {props.productDisplay === 'cards' ? (
            <div className="srch-cardgrid" style={{ ['--srch-cols' as string]: String(parseInt(props.dropdownColumns ?? '3', 10) || 3) } as React.CSSProperties}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="srch-card">
                  <span className="srch-card-img" style={{ display: 'block' }} />
                  <span className="srch-card-body" style={{ display: 'block' }}>
                    <span style={{ display: 'block', height: 12, width: '80%', background: 'var(--color-border)', borderRadius: 4 }} />
                    <span style={{ display: 'block', height: 10, width: '40%', background: 'var(--color-border)', borderRadius: 4, marginTop: 6 }} />
                  </span>
                </span>
              ))}
            </div>
          ) : (
            [0, 1].map((i) => (
              <span key={i} className="srch-row" style={{ display: 'grid' }}>
                {props.showThumbnails !== 'no' ? <span className="srch-row-thumb" /> : <span />}
                <span className="srch-row-main">
                  <span style={{ display: 'block', height: 12, width: '60%', background: 'var(--color-border)', borderRadius: 4 }} />
                  {props.showExcerpts !== 'no' && (
                    <span style={{ display: 'block', height: 10, width: '90%', background: 'var(--color-border)', borderRadius: 4, marginTop: 6 }} />
                  )}
                </span>
              </span>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export const siteSearchPuckComponent = {
  label: 'Search Box',
  fields: {
    // Behaviour
    mode: {
      type: 'select' as const, label: 'Results appear',
      options: [
        { value: 'page', label: 'On the results page' },
        { value: 'inline', label: 'In a dropdown while typing' },
        { value: 'overlay', label: 'In a full overlay while typing' },
      ],
    },
    minChars: { type: 'number' as const, label: 'Minimum characters before searching', min: 1, max: 10 },
    debounce: {
      type: 'select' as const, label: 'Typing pause before searching',
      options: [
        { value: '150', label: 'Short (150ms)' },
        { value: '250', label: 'Medium (250ms)' },
        { value: '400', label: 'Long (400ms)' },
      ],
    },
    maxResults: { type: 'number' as const, label: 'Results in the dropdown', min: 1, max: 20 },
    groupResults: { type: 'select' as const, label: 'Group results by content type', options: yesNo },
    hotkey: {
      type: 'select' as const, label: 'Keyboard shortcut to focus',
      options: [
        { value: 'none', label: 'None' },
        { value: 'slash', label: '/ (forward slash)' },
        { value: 'modk', label: 'Ctrl/Cmd + K' },
      ],
    },
    autoFocus: { type: 'select' as const, label: 'Focus on page load', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    resultsPath: { type: 'text' as const, label: 'Results page path' },
    // Content types (narrowed to installed modules by resolveFields)
    ...Object.fromEntries(SOURCE_FIELD_MAP.map((m) => [m.field, { type: 'select' as const, label: m.label, options: yesNo }])),
    // Appearance
    presentation: {
      type: 'select' as const, label: 'Presentation',
      options: [
        { value: 'field', label: 'Search field' },
        { value: 'fieldWithButton', label: 'Field with button' },
        { value: 'iconButton', label: 'Icon button (opens overlay)' },
      ],
    },
    placeholder: { type: 'text' as const, label: 'Placeholder text' },
    buttonLabel: { type: 'text' as const, label: 'Button label' },
    ariaLabel: { type: 'text' as const, label: 'Screen-reader label' },
    showIcon: { type: 'select' as const, label: 'Show magnifier icon', options: yesNo },
    size: {
      type: 'select' as const, label: 'Size',
      options: [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' },
      ],
    },
    cornerStyle: {
      type: 'select' as const, label: 'Corners',
      options: [
        { value: 'square', label: 'Square' },
        { value: 'rounded', label: 'Rounded' },
        { value: 'pill', label: 'Pill' },
      ],
    },
    fieldStyle: {
      type: 'select' as const, label: 'Field style',
      options: [
        { value: 'outlined', label: 'Outlined' },
        { value: 'filled', label: 'Filled' },
        { value: 'minimal', label: 'Minimal (underline)' },
      ],
    },
    accent: {
      type: 'select' as const, label: 'Accent colour',
      options: [
        { value: 'primary', label: 'Primary' },
        { value: 'link', label: 'Link colour' },
        { value: 'neutral', label: 'Neutral' },
      ],
    },
    widthMode: {
      type: 'select' as const, label: 'Width',
      options: [
        { value: 'full', label: 'Full width' },
        { value: 'fixed', label: 'Fixed width' },
      ],
    },
    widthPx: { type: 'number' as const, label: 'Width (px)', min: 120, max: 1200 },
    align: {
      type: 'select' as const, label: 'Alignment',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'centre', label: 'Centre' },
        { value: 'right', label: 'Right' },
      ],
    },
    // Dropdown results
    dropdownWidth: {
      type: 'select' as const, label: 'Dropdown width',
      options: [
        { value: 'field', label: 'Match the field' },
        { value: 'container', label: 'Wide panel' },
        { value: 'viewport', label: 'Full viewport width' },
      ],
    },
    productDisplay: {
      type: 'select' as const, label: 'Products shown as',
      options: [
        { value: 'rows', label: 'Rows (like other results)' },
        { value: 'cards', label: 'Product cards' },
      ],
    },
    dropdownColumns: {
      type: 'select' as const, label: 'Card columns',
      options: [
        { value: '2', label: '2' },
        { value: '3', label: '3' },
        { value: '4', label: '4' },
      ],
    },
    showThumbnails: { type: 'select' as const, label: 'Show thumbnails', options: yesNo },
    showExcerpts: { type: 'select' as const, label: 'Show excerpts', options: yesNo },
    showTypeBadges: { type: 'select' as const, label: 'Show content-type badges', options: yesNo },
    showPrices: { type: 'select' as const, label: 'Show product prices', options: yesNo },
    highlightMatches: { type: 'select' as const, label: 'Highlight matched words', options: yesNo },
    viewAllLabel: { type: 'text' as const, label: '"View all" label ({query} = search term)' },
    emptyText: { type: 'text' as const, label: 'No-results text' },
    // Audience. See the note on SiteSearchBlockProps: the key must stay
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
    mode: 'page',
    minChars: 2,
    debounce: '250',
    maxResults: 8,
    groupResults: 'yes',
    hotkey: 'none',
    autoFocus: 'no',
    resultsPath: '/search',
    searchPages: 'yes',
    searchProducts: 'yes',
    searchCategories: 'yes',
    searchCollections: 'yes',
    searchArticles: 'yes',
    searchDirectory: 'yes',
    searchForum: 'yes',
    searchMembers: 'yes',
    presentation: 'field',
    placeholder: 'Search…',
    buttonLabel: 'Search',
    ariaLabel: 'Search this site',
    showIcon: 'yes',
    size: 'medium',
    cornerStyle: 'rounded',
    fieldStyle: 'outlined',
    accent: 'primary',
    widthMode: 'full',
    widthPx: 320,
    align: 'left',
    dropdownWidth: 'field',
    productDisplay: 'rows',
    dropdownColumns: '3',
    showThumbnails: 'yes',
    showExcerpts: 'yes',
    showTypeBadges: 'yes',
    showPrices: 'yes',
    highlightMatches: 'yes',
    viewAllLabel: 'See all results for "{query}"',
    emptyText: 'No results. Try a different word or two.',
    audience: 'everyone',
  },
  async resolveFields(data: { props: SiteSearchBlockProps }, { fields }: { fields: Record<string, unknown> }) {
    const next = { ...fields }
    const props = data.props ?? {}
    const available = await fetchAvailableSources()
    const availableKeys = new Set(available.map((s) => s.key))

    // Only offer toggles for sources this install actually has.
    for (const m of SOURCE_FIELD_MAP) {
      if (available.length > 0 && !availableKeys.has(m.key)) delete next[m.field]
    }
    const shopPresent = available.length === 0 || availableKeys.has('shop-product')

    const mode = props.mode ?? 'page'
    if (mode === 'page') {
      delete next.minChars
      delete next.debounce
      delete next.maxResults
      delete next.groupResults
      delete next.dropdownWidth
      delete next.productDisplay
      delete next.dropdownColumns
      delete next.showThumbnails
      delete next.showExcerpts
      delete next.showTypeBadges
      delete next.showPrices
      delete next.highlightMatches
      delete next.viewAllLabel
      delete next.emptyText
    } else {
      if (!shopPresent || props.searchProducts === 'no') {
        delete next.productDisplay
        delete next.dropdownColumns
        delete next.showPrices
      } else if ((props.productDisplay ?? 'rows') !== 'cards') {
        delete next.dropdownColumns
      }
    }

    const presentation = props.presentation ?? 'field'
    if (presentation !== 'fieldWithButton') delete next.buttonLabel
    if (presentation === 'iconButton') {
      delete next.placeholder
      delete next.showIcon
      delete next.widthMode
      delete next.widthPx
      delete next.align
      delete next.autoFocus
    } else if ((props.widthMode ?? 'full') !== 'fixed') {
      delete next.widthPx
      delete next.align
    }

    return next
  },
  render: SiteSearchBlock,
}
