import { searchCss } from '../public/search-css'
import SearchBoxClient, { type SearchBoxPublicConfig } from '../public/SearchBoxClient'
import { siteSearchPuckComponent, sourcesFromProps, type SiteSearchBlockProps } from './SiteSearchBlock'

// Server (RSC) half of the Search Box. Only the display subset of the props
// crosses to the client island - and every prop here IS display config, so the
// mapping below is a whitelist rather than a spread (Puck's injected bag with
// its functions must never reach a client component).

function toConfig(props: SiteSearchBlockProps): SearchBoxPublicConfig {
  const pick = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T =>
    (allowed as readonly string[]).includes(value ?? '') ? (value as T) : fallback
  return {
    mode: pick(props.mode, ['page', 'inline', 'overlay'] as const, 'page'),
    minChars: Math.max(1, Math.min(10, props.minChars ?? 2)),
    debounceMs: parseInt(props.debounce ?? '250', 10) || 250,
    maxResults: Math.max(1, Math.min(20, props.maxResults ?? 8)),
    groupResults: props.groupResults !== 'no',
    hotkey: pick(props.hotkey, ['none', 'slash', 'modk'] as const, 'none'),
    autoFocus: props.autoFocus === 'yes',
    resultsPath: props.resultsPath?.trim() || '/search',
    sources: sourcesFromProps(props),
    presentation: pick(props.presentation, ['field', 'iconButton', 'fieldWithButton'] as const, 'field'),
    placeholder: props.placeholder ?? 'Search…',
    buttonLabel: props.buttonLabel?.trim() || 'Search',
    ariaLabel: props.ariaLabel?.trim() || 'Search this site',
    showIcon: props.showIcon !== 'no',
    size: pick(props.size, ['small', 'medium', 'large'] as const, 'medium'),
    cornerStyle: pick(props.cornerStyle, ['square', 'rounded', 'pill'] as const, 'rounded'),
    fieldStyle: pick(props.fieldStyle, ['outlined', 'filled', 'minimal'] as const, 'outlined'),
    accent: pick(props.accent, ['primary', 'link', 'neutral'] as const, 'primary'),
    widthMode: pick(props.widthMode, ['full', 'fixed'] as const, 'full'),
    widthPx: Math.max(120, Math.min(1200, props.widthPx ?? 320)),
    align: pick(props.align, ['left', 'centre', 'right'] as const, 'left'),
    dropdownWidth: pick(props.dropdownWidth, ['field', 'container', 'viewport'] as const, 'field'),
    productDisplay: pick(props.productDisplay, ['rows', 'cards'] as const, 'rows'),
    dropdownColumns: parseInt(props.dropdownColumns ?? '3', 10) || 3,
    display: {
      showThumbnails: props.showThumbnails !== 'no',
      showExcerpts: props.showExcerpts !== 'no',
      showTypeBadges: props.showTypeBadges !== 'no',
      showPrices: props.showPrices !== 'no',
      showDates: false,
      showAuthors: false,
      showUrls: false,
      highlight: props.highlightMatches !== 'no',
    },
    viewAllLabel: props.viewAllLabel?.trim() || 'See all results for "{query}"',
    emptyText: props.emptyText?.trim() || 'No results. Try a different word or two.',
    // Injected on the /search results page so the box shows the current query.
    initialQuery: props.searchQuery ?? '',
  }
}

export function SiteSearchBlockRsc(props: SiteSearchBlockProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: searchCss() }} />
      <SearchBoxClient config={toConfig(props)} />
    </>
  )
}

export const siteSearchPuckRscComponent = {
  ...siteSearchPuckComponent,
  render: SiteSearchBlockRsc,
}
