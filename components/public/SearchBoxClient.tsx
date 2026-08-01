'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { SearchHit } from '@/modules/search/lib/types'
import { SOURCE_LABELS, type SearchSourceKey } from '@/modules/search/lib/types'
import { ResultRow, ProductCardLite, groupHits, type HitDisplayOptions } from './ResultCard'

// The live search island. Receives only the display subset of the block's
// props (client props land verbatim in view-source); rendered by
// SiteSearchBlock.rsc, which also emits the stylesheet.

export type SearchBoxPublicConfig = {
  mode: 'page' | 'inline' | 'overlay'
  minChars: number
  debounceMs: number
  maxResults: number
  groupResults: boolean
  hotkey: 'none' | 'slash' | 'modk'
  autoFocus: boolean
  resultsPath: string
  sources: string[]
  presentation: 'field' | 'iconButton' | 'fieldWithButton'
  placeholder: string
  buttonLabel: string
  ariaLabel: string
  showIcon: boolean
  size: 'small' | 'medium' | 'large'
  cornerStyle: 'square' | 'rounded' | 'pill'
  fieldStyle: 'outlined' | 'filled' | 'minimal'
  accent: 'primary' | 'link' | 'neutral'
  widthMode: 'full' | 'fixed'
  widthPx: number
  align: 'left' | 'centre' | 'right'
  dropdownWidth: 'field' | 'container' | 'viewport'
  productDisplay: 'rows' | 'cards'
  dropdownColumns: number
  display: HitDisplayOptions
  viewAllLabel: string
  emptyText: string
  initialQuery: string
}

function SearchIcon() {
  return (
    <svg className="srch-iconsvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function resultsHref(config: SearchBoxPublicConfig, q: string): string {
  const params = new URLSearchParams({ q })
  if (config.sources.length) params.set('sources', config.sources.join(','))
  return `${config.resultsPath || '/search'}?${params.toString()}`
}

export default function SearchBoxClient({ config }: { config: SearchBoxPublicConfig }) {
  const [q, setQ] = useState(config.initialQuery)
  const [open, setOpen] = useState(false)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [total, setTotal] = useState(0)
  const [searched, setSearched] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const seqRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const baseId = useId().replace(/[^a-zA-Z0-9-]/g, '')
  const listboxId = `srch-list-${baseId}`

  const live = config.mode !== 'page'
  // iconButton and overlay mode both put the real input inside the overlay
  // panel; the in-flow element is only a trigger.
  const usesOverlay = config.presentation === 'iconButton' || config.mode === 'overlay'
  // A field trigger has a place on the page, so its overlay input must open
  // exactly over it (anchored to the trigger's rect) rather than in a centred
  // panel. The icon button keeps the centred panel: a tiny button is no anchor.
  const anchored = config.mode === 'overlay' && config.presentation !== 'iconButton'
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  const openOverlay = useCallback(() => {
    if (anchored && boxRef.current) {
      const r = boxRef.current.getBoundingClientRect()
      setAnchorRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    setOverlayOpen(true)
  }, [anchored])

  const runSearch = useCallback((term: string) => {
    const seq = ++seqRef.current
    const params = new URLSearchParams({
      q: term,
      limit: String(config.maxResults),
      highlight: config.display.highlight ? 'yes' : 'no',
      snippet: 'short',
    })
    if (config.sources.length) params.set('sources', config.sources.join(','))
    fetch(`/api/m/search/public/query?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { hits: [], total: 0 }))
      .then((data: { hits?: SearchHit[]; total?: number }) => {
        if (seq !== seqRef.current) return
        setHits(data.hits ?? [])
        setTotal(data.total ?? 0)
        setSearched(true)
        setActiveIndex(-1)
        setOpen(true)
      })
      .catch(() => {
        if (seq !== seqRef.current) return
        setHits([])
        setTotal(0)
        setSearched(true)
      })
  }, [config.maxResults, config.display.highlight, config.sources])

  const onChange = (value: string) => {
    setQ(value)
    if (!live && !usesOverlay) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = value.trim()
    if (term.length < config.minChars) {
      seqRef.current++
      setHits([])
      setSearched(false)
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => runSearch(term), config.debounceMs)
  }

  // Close the inline dropdown on outside click.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Focus the real input when the overlay opens.
  useEffect(() => {
    if (overlayOpen) inputRef.current?.focus()
  }, [overlayOpen])

  // Full-viewport dropdown: CSS alone cannot span the viewport from an
  // absolutely-positioned child (left:50%/-50vw only works when the box sits
  // dead-centre of the page - in a header it doesn't). Measure the box's
  // viewport offset and pull the dropdown back by exactly that much.
  const viewportDd = config.mode === 'inline' && config.dropdownWidth === 'viewport'
  const [viewportInset, setViewportInset] = useState<number | null>(null)
  useEffect(() => {
    if (!open || !viewportDd) return
    const sync = () => {
      const r = boxRef.current?.getBoundingClientRect()
      if (r) setViewportInset(r.left)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [open, viewportDd])

  // Keep the anchored input glued to the trigger: the page behind the overlay
  // can still scroll (and the window resize), which would strand a one-shot
  // rect measurement where the trigger used to be.
  useEffect(() => {
    if (!overlayOpen || !anchored) return
    const sync = () => {
      const r = boxRef.current?.getBoundingClientRect()
      if (r) setAnchorRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [overlayOpen, anchored])

  // Focus hotkey.
  useEffect(() => {
    if (config.hotkey === 'none') return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const slash = config.hotkey === 'slash' && e.key === '/' && !typing && !e.metaKey && !e.ctrlKey
      const modk = config.hotkey === 'modk' && e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)
      if (!slash && !modk) return
      e.preventDefault()
      if (usesOverlay) openOverlay()
      else inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [config.hotkey, usesOverlay, openOverlay])

  const goToResults = useCallback(() => {
    const term = q.trim()
    if (!term) return
    window.location.href = resultsHref(config, term)
  }, [q, config])

  const showsResults = live || usesOverlay

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setOverlayOpen(false)
      return
    }
    const listVisible = showsResults && (open || overlayOpen) && hits.length > 0
    if (!listVisible) {
      if (e.key === 'Enter') {
        e.preventDefault()
        goToResults()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(hits.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(-1, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const active = activeIndex >= 0 ? hits[activeIndex] : null
      if (active) window.location.href = active.url
      else goToResults()
    }
  }

  const appearanceClasses = [
    `srch-size-${config.size}`,
    `srch-corner-${config.cornerStyle}`,
    `srch-style-${config.fieldStyle}`,
    `srch-accent-${config.accent}`,
  ].join(' ')
  const boxClasses = [
    'srch-box',
    appearanceClasses,
    config.widthMode === 'fixed' ? `srch-align-${config.align}` : '',
  ].filter(Boolean).join(' ')
  const boxStyle: React.CSSProperties = config.widthMode === 'fixed'
    ? { width: config.widthPx, maxWidth: '100%' }
    : { width: '100%' }

  const optionId = useCallback((i: number) => `${listboxId}-opt-${i}`, [listboxId])

  const resultsBody = useMemo(() => {
    if (!searched) return null
    if (hits.length === 0) {
      return <div className="srch-empty">{config.emptyText}</div>
    }
    const productHits = config.productDisplay === 'cards' ? hits.filter((h) => h.source === 'shop-product') : []
    const rowHits = config.productDisplay === 'cards' ? hits.filter((h) => h.source !== 'shop-product') : hits
    const indexOfHit = new Map(hits.map((h, i) => [h, i]))
    const rows = (list: SearchHit[]) => list.map((hit) => (
      <ResultRow
        key={`${hit.source}:${hit.entityId}`}
        hit={hit}
        opts={config.display}
        active={indexOfHit.get(hit) === activeIndex}
        id={optionId(indexOfHit.get(hit) ?? 0)}
      />
    ))
    return (
      <>
        {productHits.length > 0 && (
          <div className="srch-cardgrid" style={{ ['--srch-cols' as string]: String(config.dropdownColumns) } as React.CSSProperties}>
            {productHits.map((hit) => (
              <ProductCardLite
                key={`${hit.source}:${hit.entityId}`}
                hit={hit}
                active={indexOfHit.get(hit) === activeIndex}
                id={optionId(indexOfHit.get(hit) ?? 0)}
              />
            ))}
          </div>
        )}
        {rowHits.length > 0 && (
          config.groupResults ? (
            groupHits(rowHits).map((group) => (
              <div key={group.source}>
                <div className="srch-group-label">{SOURCE_LABELS[group.source as SearchSourceKey]}</div>
                {rows(group.hits)}
              </div>
            ))
          ) : rows(rowHits)
        )}
        {total > hits.length && (
          <a className="srch-viewall" href={resultsHref(config, q.trim())}>
            {config.viewAllLabel.replace('{query}', q.trim())}
          </a>
        )}
      </>
    )
  }, [searched, hits, total, activeIndex, q, config, optionId])

  const inputEl = (
    <div className="srch-input-wrap">
      {config.showIcon && <SearchIcon />}
      <input
        ref={inputRef}
        className="srch-input"
        type="search"
        name="q"
        role="combobox"
        aria-label={config.ariaLabel}
        aria-expanded={showsResults && (open || overlayOpen)}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-autocomplete="list"
        placeholder={config.placeholder}
        value={q}
        autoFocus={config.autoFocus && !usesOverlay}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (live && !usesOverlay && searched && hits.length > 0) setOpen(true) }}
      />
      {config.presentation === 'fieldWithButton' && (
        <button type="button" className="srch-btn" onClick={goToResults}>{config.buttonLabel}</button>
      )}
    </div>
  )

  const overlay = overlayOpen && (
    <div className="srch-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOverlayOpen(false) }}>
      {anchored && anchorRect ? (
        // The live input sits exactly where the trigger is, so opening the
        // overlay looks like clicking into the box, not a box teleporting.
        <div
          className={`srch-overlay-anchor ${appearanceClasses}`}
          style={{ top: anchorRect.top, left: anchorRect.left, width: anchorRect.width }}
        >
          {inputEl}
          {searched && (
            <div
              className="srch-overlay-dd"
              role="listbox"
              id={listboxId}
              style={{ maxHeight: `calc(100vh - ${anchorRect.top + anchorRect.height}px - 24px)` }}
            >
              <div className="srch-dd-inner">{resultsBody}</div>
            </div>
          )}
        </div>
      ) : (
        <div className={`srch-overlay-panel ${appearanceClasses}`}>
          <div className="srch-overlay-head">{inputEl}</div>
          <div className="srch-overlay-results" role="listbox" id={listboxId}>
            {searched && <div className="srch-dd-inner">{resultsBody}</div>}
          </div>
        </div>
      )}
    </div>
  )

  if (config.presentation === 'iconButton') {
    return (
      <div className={boxClasses} ref={boxRef}>
        <button
          type="button"
          className="srch-iconbtn"
          aria-label={config.ariaLabel}
          onClick={() => setOverlayOpen(true)}
        >
          <SearchIcon />
        </button>
        {overlay}
      </div>
    )
  }

  if (config.mode === 'overlay') {
    // In-flow trigger only; the live input lives in the overlay panel.
    return (
      <div className={boxClasses} style={boxStyle} ref={boxRef}>
        <button
          type="button"
          className="srch-input-wrap"
          style={{ width: '100%', cursor: 'text', textAlign: 'left' }}
          aria-label={config.ariaLabel}
          onClick={openOverlay}
        >
          {config.showIcon && <SearchIcon />}
          <span className="srch-input" style={{ color: 'var(--color-text-muted)' }}>{q.trim() || config.placeholder}</span>
        </button>
        {overlay}
      </div>
    )
  }

  // 'page' mode is a plain GET form (works without JavaScript - the input is
  // name="q"); 'inline' adds the live dropdown on top of the same markup.
  return (
    <div className={boxClasses} style={boxStyle} ref={boxRef}>
      <form
        action={config.resultsPath || '/search'}
        method="get"
        onSubmit={(e) => { e.preventDefault(); goToResults() }}
      >
        {config.sources.length > 0 && <input type="hidden" name="sources" value={config.sources.join(',')} />}
        {inputEl}
      </form>
      {config.mode === 'inline' && open && (
        <div
          className={`srch-dd${config.dropdownWidth === 'viewport' ? ' srch-dd-viewport' : config.dropdownWidth === 'container' ? ' srch-dd-wide' : ''}`}
          id={listboxId}
          role="listbox"
          style={viewportDd && viewportInset != null ? { left: -viewportInset, marginLeft: 0, width: '100vw' } : undefined}
        >
          <div className="srch-dd-inner">{resultsBody}</div>
        </div>
      )}
    </div>
  )
}
