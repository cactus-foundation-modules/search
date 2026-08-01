'use client'

import { useState } from 'react'
import type { SearchHit } from '@/modules/search/lib/types'
import { ResultRow, ProductCardLite, type HitDisplayOptions } from './ResultCard'

// Appends further result pages under the server-rendered list. Only offered
// for the standard card style - the designed shop-card template can only be
// stamped server-side, so that mode uses numbered pagination instead.
export default function LoadMoreButton({ query, sources, perPage, startOffset, total, layout, display, snippetLength, label }: {
  query: string
  sources: string[]
  perPage: number
  startOffset: number
  total: number
  layout: 'list' | 'grid' | 'compact'
  display: HitDisplayOptions
  snippetLength: 'short' | 'medium' | 'long'
  label: string
}) {
  const [extra, setExtra] = useState<SearchHit[]>([])
  const [offset, setOffset] = useState(startOffset)
  const [loading, setLoading] = useState(false)

  if (offset >= total && extra.length === 0) return null
  const done = offset >= total

  const loadMore = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(perPage),
        offset: String(offset),
        highlight: display.highlight ? 'yes' : 'no',
        snippet: snippetLength,
      })
      if (sources.length) params.set('sources', sources.join(','))
      const res = await fetch(`/api/m/search/public/query?${params.toString()}`)
      if (res.ok) {
        const data = (await res.json()) as { hits?: SearchHit[] }
        setExtra((prev) => [...prev, ...(data.hits ?? [])])
        setOffset((prev) => prev + perPage)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {extra.length > 0 && (
        layout === 'grid' ? (
          <div className="srch-grid" style={{ marginTop: '1rem' }}>
            {extra.map((hit) => (
              hit.source === 'shop-product'
                ? <ProductCardLite key={`${hit.source}:${hit.entityId}`} hit={hit} />
                : <ResultRow key={`${hit.source}:${hit.entityId}`} hit={hit} opts={display} />
            ))}
          </div>
        ) : (
          <div className={`srch-list${layout === 'compact' ? ' srch-list-compact' : ''}`} style={{ marginTop: '.25rem' }}>
            {extra.map((hit) => (
              <ResultRow key={`${hit.source}:${hit.entityId}`} hit={hit} opts={display} />
            ))}
          </div>
        )
      )}
      {!done && (
        <button type="button" className="srch-loadmore" onClick={loadMore} disabled={loading}>
          {loading ? '…' : label}
        </button>
      )}
    </>
  )
}
