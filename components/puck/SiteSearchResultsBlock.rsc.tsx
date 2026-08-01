import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { getSessionFromCookie } from '@/lib/auth/session'
import { getMemberFromCookie } from '@/lib/members/session'
import { moduleExtensionPointComponents } from '@/lib/modules/extension-points'
import { searchDocuments, parseSourcesParam, type SnippetLength } from '@/modules/search/lib/query'
import { SOURCE_LABELS, type SearchHit, type SearchSourceKey } from '@/modules/search/lib/types'
import { searchCss } from '../public/search-css'
import { ResultRow, ProductCardLite, groupHits, type HitDisplayOptions } from '../public/ResultCard'
import LoadMoreButton from '../public/LoadMoreButton'
import { siteSearchResultsPuckComponent, resultsSourcesFromProps, type SiteSearchResultsBlockProps } from './SiteSearchResultsBlock'

// Server (RSC) half of Search Results. Reads the query injected by the
// /search page (inject-search-context.ts) and hits the index directly.

type ShopCardsProvider = {
  renderProductCards?: (productIds: string[], opts?: { columns?: number }) => Promise<ReactNode | null>
}

function href(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') sp.set(key, String(value))
  }
  return `?${sp.toString()}`
}

export async function SiteSearchResultsBlockRsc(props: SiteSearchResultsBlockProps) {
  await connection()

  const q = (props.searchQuery ?? '').trim()
  const page = Math.max(1, props.searchPageNum ?? 1)
  const sort = props.searchSort === 'newest' ? 'newest' as const : 'relevance' as const
  const perPage = Math.max(5, Math.min(50, props.perPage ?? 20))
  const layout = props.layout === 'grid' ? 'grid' : props.layout === 'compact' ? 'compact' : 'list'
  const snippetLength = (['short', 'medium', 'long'].includes(props.snippetLength ?? '') ? props.snippetLength : 'medium') as SnippetLength
  const display: HitDisplayOptions = {
    showThumbnails: props.showThumbnails !== 'no',
    showExcerpts: props.showExcerpts !== 'no',
    showTypeBadges: props.showTypeBadges !== 'no',
    showPrices: props.showPrices !== 'no',
    showDates: props.showDates !== 'no',
    showAuthors: props.showAuthors === 'yes',
    showUrls: props.showUrls === 'yes',
    highlight: props.highlightMatches !== 'no',
  }

  const style = <style dangerouslySetInnerHTML={{ __html: searchCss() }} />

  if (!q) {
    return (
      <div className="srch-results">
        {style}
        <div className="srch-empty" style={{ padding: '2rem 1rem' }}>Type something in the search box to get going.</div>
      </div>
    )
  }

  // The page-level ?sources= (filter tabs, or a narrowed search box) can only
  // narrow this block's own toggles further, never widen them.
  const blockSources = resultsSourcesFromProps(props)
  const paramSources = parseSourcesParam(props.searchSourcesParam)
  const effectiveSources = paramSources.length
    ? (blockSources.length ? paramSources.filter((s) => blockSources.includes(s)) : paramSources)
    : blockSources

  // Session (admin or member) widens results to members-only content.
  const [adminUser, member] = await Promise.all([
    getSessionFromCookie().catch(() => null),
    getMemberFromCookie().catch(() => null),
  ])

  const result = await searchDocuments({
    q,
    sources: effectiveSources.length ? effectiveSources : undefined,
    includeMembersTier: Boolean(adminUser || member),
    limit: perPage,
    offset: (page - 1) * perPage,
    sort,
    highlight: display.highlight && display.showExcerpts,
    snippetLength,
  })
  const { hits, total } = result

  // Filter tabs list the sources this block is allowed to search (not just
  // those with hits - a tab that vanishes when empty cannot be un-clicked).
  const tabSources = blockSources.length ? blockSources : result.sources
  const activeTab = paramSources.length === 1 ? paramSources[0] : null

  const heading = (props.headingTemplate ?? 'Results for "{query}"').replace('{query}', q)
  const countLine = (props.countTemplate ?? '{count} results').replace('{count}', String(total))

  // Designed shop cards, stamped by the shop module through the
  // search.shop-cards extension point. Absent provider = standard cards.
  const provider = (moduleExtensionPointComponents['search.shop-cards']?.shop ?? null) as ShopCardsProvider | null
  const wantShopCards = props.productCardStyle === 'shopCard' && Boolean(provider?.renderProductCards)
  const productHits = wantShopCards ? hits.filter((h) => h.source === 'shop-product') : []
  let shopCardsNode: ReactNode = null
  if (wantShopCards && productHits.length > 0 && provider?.renderProductCards) {
    try {
      shopCardsNode = await provider.renderProductCards(
        productHits.map((h) => h.entityId),
        { columns: parseInt(props.columns ?? '3', 10) || 3 },
      )
    } catch {
      shopCardsNode = null
    }
  }
  const usingShopCards = shopCardsNode !== null && productHits.length > 0
  const listHits = usingShopCards ? hits.filter((h) => h.source !== 'shop-product') : hits

  const renderHit = (hit: SearchHit) => (
    layout === 'grid' && hit.source === 'shop-product'
      ? <ProductCardLite key={`${hit.source}:${hit.entityId}`} hit={hit} />
      : <ResultRow key={`${hit.source}:${hit.entityId}`} hit={hit} opts={display} />
  )
  const renderList = (list: SearchHit[]) => (
    layout === 'grid' ? (
      <div className="srch-grid" style={{ ['--srch-cols' as string]: props.columns ?? '3' } as React.CSSProperties}>
        {list.map(renderHit)}
      </div>
    ) : (
      <div className={`srch-list${layout === 'compact' ? ' srch-list-compact' : ''}`}>
        {list.map(renderHit)}
      </div>
    )
  )

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  // Load-more cannot append server-stamped shop cards - numbered wins there.
  const paginationStyle = props.paginationStyle === 'loadMore' && !usingShopCards ? 'loadMore' : 'numbered'
  const pageHref = (n: number) => href({
    q,
    sources: props.searchSourcesParam || undefined,
    sort: sort === 'newest' ? 'newest' : undefined,
    page: n > 1 ? n : undefined,
  })

  const pageLinks: ReactNode[] = []
  if (paginationStyle === 'numbered' && totalPages > 1) {
    const windowStart = Math.max(1, page - 3)
    const windowEnd = Math.min(totalPages, page + 3)
    if (windowStart > 1) pageLinks.push(<a key={1} className="srch-page-link" href={pageHref(1)}>1</a>, <span key="s">…</span>)
    for (let n = windowStart; n <= windowEnd; n++) {
      pageLinks.push(
        <a key={n} className={`srch-page-link${n === page ? ' srch-page-active' : ''}`} href={pageHref(n)}>{n}</a>,
      )
    }
    if (windowEnd < totalPages) pageLinks.push(<span key="e">…</span>, <a key={totalPages} className="srch-page-link" href={pageHref(totalPages)}>{totalPages}</a>)
  }

  return (
    <div className={`srch-results srch-thumb-${props.thumbnailShape ?? 'landscape'}`}>
      {style}
      {heading !== '' && <h1 className="srch-res-heading">{heading}</h1>}
      {countLine !== '' && <p className="srch-res-count">{countLine}</p>}

      {props.filterTabs !== 'no' && tabSources.length > 1 && (
        <div className="srch-tabs">
          <a className={`srch-tab${activeTab === null ? ' srch-tab-active' : ''}`} href={href({ q, sort: sort === 'newest' ? 'newest' : undefined })}>All</a>
          {tabSources.map((source) => (
            <a
              key={source}
              className={`srch-tab${activeTab === source ? ' srch-tab-active' : ''}`}
              href={href({ q, sources: source, sort: sort === 'newest' ? 'newest' : undefined })}
            >
              {SOURCE_LABELS[source]}
            </a>
          ))}
        </div>
      )}

      {props.sortControl === 'yes' && total > 1 && (
        <div className="srch-sortrow">
          <a className={sort === 'relevance' ? 'srch-sort-active' : ''} href={href({ q, sources: props.searchSourcesParam || undefined })}>Most relevant</a>
          <a className={sort === 'newest' ? 'srch-sort-active' : ''} href={href({ q, sources: props.searchSourcesParam || undefined, sort: 'newest' })}>Newest</a>
        </div>
      )}

      {hits.length === 0 ? (
        <div className="srch-empty" style={{ padding: '2rem 1rem' }}>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)' }}>{props.emptyTitle?.trim() || 'Nothing found'}</p>
          <p style={{ margin: '.375rem 0 0' }}>{props.emptyBody?.trim() || 'No matches for that. Check the spelling, or try fewer words.'}</p>
        </div>
      ) : (
        <>
          {usingShopCards && <div className="srch-section">{shopCardsNode}</div>}
          {listHits.length > 0 && (
            props.groupBySource === 'yes' ? (
              groupHits(listHits).map((group) => (
                <div key={group.source} className="srch-section">
                  <div className="srch-group-label">{SOURCE_LABELS[group.source as SearchSourceKey]}</div>
                  {renderList(group.hits)}
                </div>
              ))
            ) : renderList(listHits)
          )}
          {paginationStyle === 'numbered' && pageLinks.length > 0 && (
            <nav className="srch-pagination" aria-label="Search result pages">{pageLinks}</nav>
          )}
          {paginationStyle === 'loadMore' && (
            <LoadMoreButton
              query={q}
              sources={effectiveSources}
              perPage={perPage}
              startOffset={page * perPage}
              total={total}
              layout={layout}
              display={display}
              snippetLength={snippetLength}
              label="Load more"
            />
          )}
        </>
      )}
    </div>
  )
}

export const siteSearchResultsPuckRscComponent = {
  ...siteSearchResultsPuckComponent,
  render: SiteSearchResultsBlockRsc,
}
