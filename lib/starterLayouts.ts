// Starter layout templates for the searchResults layout type, collected by
// scripts/generate-module-layout-types.mjs (core) via this module's
// cactus.module.json layoutTypes.types[].starterImport/starterExport.
// PURE DATA - imported into the browser; nothing but object literals here.

const block = (type: string, id: string, props: Record<string, unknown> = {}) => ({ type, props: { id, ...props } })

export function searchResultsStarters() {
  return [
    {
      id: 'starter-search-results-standard',
      name: 'Standard',
      description: 'A search box with the full results list underneath.',
      data: {
        content: [
          block('SiteSearch', 'search-box-1', {
            mode: 'page',
            presentation: 'fieldWithButton',
            placeholder: 'Search…',
            buttonLabel: 'Search',
            size: 'large',
            widthMode: 'full',
          }),
          // productCardStyle spelled out so the sidebar shows the pick that is
          // in force rather than an empty select; shop-absent installs fall
          // back to standard rows on their own.
          block('SiteSearchResults', 'search-results-1', { productCardStyle: 'shopCard' }),
        ],
        root: { props: {} },
        zones: {},
      },
    },
  ]
}
