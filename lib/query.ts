import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { getInstalledManifests } from '@/lib/modules/live-status'
import { modulePublicExtensionPointComponents as moduleExtensionPointComponents } from '@/lib/modules/extension-points.public'
import { getSearchSettings } from './settings'
import { listAvailableSources } from './indexer'
import { splitPrefix, looseTerms } from './query-terms'
import type { SearchHit, SearchSourceKey } from './types'
import { isSearchSourceKey } from './types'

export type SnippetLength = 'short' | 'medium' | 'long'

export type SearchQueryOptions = {
  q: string
  // Empty = every enabled source. Values are intersected with the enabled +
  // available set, so a stale block config can never resurface a disabled source.
  sources?: SearchSourceKey[]
  // True when the requester has a session (admin or member) - widens results
  // to tier 'members' documents (members-only boards, members-only profiles).
  includeMembersTier: boolean
  limit: number
  offset: number
  sort?: 'relevance' | 'newest'
  highlight?: boolean
  snippetLength?: SnippetLength
}

export type SearchQueryResult = {
  hits: SearchHit[]
  total: number
  // The sources actually searched after enablement/availability/shop-gate filtering.
  sources: SearchSourceKey[]
  // True when nothing matched every word and these hits come from the relaxed
  // any-word retry. Callers logging analytics must treat it as a nil result:
  // the owner's "searches that found nothing" report is the point of the log,
  // and near misses would otherwise quietly stop appearing in it.
  relaxed: boolean
}

const HEADLINE_OPTIONS: Record<SnippetLength, string> = {
  short: 'MaxWords=12, MinWords=5, StartSel=«, StopSel=», ShortWord=2',
  medium: 'MaxWords=28, MinWords=12, StartSel=«, StopSel=», ShortWord=2',
  long: 'MaxWords=48, MinWords=20, StartSel=«, StopSel=», ShortWord=2',
}

// The one tsquery expression, reused in WHERE, rank and headline. Parameters
// are duplicated per use site - Prisma re-binds them each time.
//
// The prefix term is ANDed onto the rest, never ORed. ORing it made the last
// word of every query stand alone: searching a full product name matched every
// document containing "desk", 200-odd of them, and ts_rank_cd then floated the
// bodies that repeat the word above the product actually named in the query.
function tsQuery(language: string, q: string): Prisma.Sql {
  const { head, prefix } = splitPrefix(q)
  if (!prefix) return Prisma.sql`websearch_to_tsquery(${language}::regconfig, ${q})`
  // A one-word query has no head; websearch_to_tsquery('') only emits a notice.
  if (!head) return Prisma.sql`to_tsquery(${language}::regconfig, ${prefix + ':*'})`
  return Prisma.sql`(websearch_to_tsquery(${language}::regconfig, ${head}) && to_tsquery(${language}::regconfig, ${prefix + ':*'}))`
}

// When the shop is CLOSED its content vanishes from results at query time
// (mirrors modules/shop/lib/robots.ts + sitemap.ts). Read with raw SQL and a
// guard: shop may not be installed, in which case the table does not exist.
async function shopGateClosed(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ status: string | null }>>`
      SELECT "config"->>'shopStatus' AS status FROM "shp_settings" WHERE "id" = 'singleton' LIMIT 1
    `
    return rows[0]?.status === 'CLOSED'
  } catch {
    return false
  }
}

async function shopCurrencySymbol(): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<Array<{ symbol: string | null }>>`
      SELECT "config"->>'currencySymbol' AS symbol FROM "shp_settings" WHERE "id" = 'singleton' LIMIT 1
    `
    return rows[0]?.symbol || '£'
  } catch {
    return '£'
  }
}

// A companion module (shop-variations) that prices some products itself,
// answering shop's `shop.product-card-prices` extension point with the cheapest
// a shopper could pay. Mirrors modules/shop/lib/card-price.ts, but resolved
// through the core registry directly: importing shop's lib would break builds
// without shop.
type CardFromPrice = { price: string; varies: boolean }
type CardPriceProvider = { fromPrices: (productIds: string[]) => Promise<Record<string, CardFromPrice>> }

const CARD_PRICE_POINT = 'shop.product-card-prices'

// Shop's `shop.product-listability` point, resolved the same way and for the
// same reason: a shop can be set to hide sold-out products from its listings,
// and a search box that turns up what every category page refuses to would make
// a liar of the setting. Shop answers for whoever is asking, so signed-in staff
// still find them while shoppers do not.
type ListabilityProvider = { hiddenProductIds: (productIds: string[]) => Promise<string[]> }

const LISTABILITY_POINT = 'shop.product-listability'

async function resolveHiddenProductIds(productIds: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  if (productIds.length === 0) return out
  const providers = (moduleExtensionPointComponents[LISTABILITY_POINT] ?? {}) as Record<string, ListabilityProvider>
  if (Object.keys(providers).length === 0) return out

  const modules = await getInstalledManifests()
  for (const mod of modules) {
    const manifest = mod.manifest as { extensionPoints?: Array<{ point: string; id: string }> } | null
    for (const entry of manifest?.extensionPoints ?? []) {
      if (entry.point !== LISTABILITY_POINT) continue
      const provider = providers[entry.id]
      if (!provider) continue
      try {
        for (const id of await provider.hiddenProductIds(productIds)) out.add(id)
      } catch {
        // A provider that throws hides nothing rather than everything: results
        // stay as they were on a shop without the setting switched on.
      }
    }
  }
  return out
}

async function resolveFromPrices(productIds: string[]): Promise<Map<string, CardFromPrice>> {
  const out = new Map<string, CardFromPrice>()
  if (productIds.length === 0) return out
  const providers = (moduleExtensionPointComponents[CARD_PRICE_POINT] ?? {}) as Record<string, CardPriceProvider>
  if (Object.keys(providers).length === 0) return out

  const modules = await getInstalledManifests()
  for (const mod of modules) {
    const manifest = mod.manifest as { extensionPoints?: Array<{ point: string; id: string }> } | null
    for (const entry of manifest?.extensionPoints ?? []) {
      if (entry.point !== CARD_PRICE_POINT) continue
      const provider = providers[entry.id]
      if (!provider) continue
      try {
        const priced = await provider.fromPrices(productIds)
        for (const [id, price] of Object.entries(priced)) {
          if (!out.has(id)) out.set(id, price)
        }
      } catch {
        // A provider that throws must not blank results: its products just
        // show shop's own price, exactly as on the storefront grid.
      }
    }
  }
  return out
}

// Live price/visibility for product hits. The index never stores money or
// stock: prices move (sales, sheet imports) while the index sleeps. A product
// that is no longer publicly visible is dropped here even if the index lags.
async function enrichProductHits(hits: SearchHit[]): Promise<SearchHit[]> {
  const productIds = hits.filter((h) => h.source === 'shop-product').map((h) => h.entityId)
  if (productIds.length === 0) return hits
  try {
    const [rows, symbol, fromPrices, hidden] = await Promise.all([
      prisma.$queryRaw<Array<{ id: string; price: string; sale_price: string | null }>>`
        SELECT "id", "price"::text AS price, "sale_price"::text AS sale_price
        FROM "shp_products"
        WHERE "id" = ANY(${productIds}) AND "status" = 'ACTIVE' AND "catalogue_hidden" = false
      `,
      shopCurrencySymbol(),
      resolveFromPrices(productIds),
      resolveHiddenProductIds(productIds),
    ])
    const byId = new Map(rows.map((r) => [r.id, r]))
    const out: SearchHit[] = []
    for (const hit of hits) {
      if (hit.source !== 'shop-product') {
        out.push(hit)
        continue
      }
      const row = byId.get(hit.entityId)
      if (!row || hidden.has(hit.entityId)) continue
      // A product priced by a companion module (variations) shows the cheapest
      // variation - a variant parent's own price is 0 and never shown anywhere.
      // Matches the storefront card exactly (modules/shop/lib/card-template.tsx).
      const from = fromPrices.get(hit.entityId)
      out.push({
        ...hit,
        price: from
          ? { now: from.price, was: null, symbol, from: from.varies }
          : {
              now: row.sale_price ?? row.price,
              was: row.sale_price ? row.price : null,
              symbol,
            },
      })
    }
    return out
  } catch {
    // Shop table vanished mid-query (uninstall race): drop product hits.
    return hits.filter((h) => h.source !== 'shop-product')
  }
}

export async function resolveSearchableSources(requested?: SearchSourceKey[]): Promise<SearchSourceKey[]> {
  const availableList = await listAvailableSources()
  let keys = availableList.filter((s) => s.enabled).map((s) => s.key)
  if (requested?.length) keys = keys.filter((k) => requested.includes(k))
  if (keys.some((k) => k.startsWith('shop-')) && (await shopGateClosed())) {
    keys = keys.filter((k) => !k.startsWith('shop-'))
  }
  return keys
}

export function parseSourcesParam(raw: string | null | undefined): SearchSourceKey[] {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(isSearchSourceKey)
}

export async function searchDocuments(opts: SearchQueryOptions): Promise<SearchQueryResult> {
  const q = opts.q.trim()
  if (!q) return { hits: [], total: 0, sources: [], relaxed: false }

  const sources = await resolveSearchableSources(opts.sources)
  if (sources.length === 0) return { hits: [], total: 0, sources: [], relaxed: false }

  const settings = await getSearchSettings()
  const lang = settings.language
  const weightsJson = JSON.stringify(settings.weights)
  const tierSql = opts.includeMembersTier
    ? Prisma.sql`d."tier" IN ('public', 'members')`
    : Prisma.sql`d."tier" = 'public'`
  const sourcesSql = Prisma.sql`d."source" IN (${Prisma.join(sources)})`
  const limit = Math.max(1, Math.min(50, opts.limit))
  const offset = Math.max(0, opts.offset)
  const snippetLength = opts.snippetLength ?? 'medium'

  // Someone typing a product's name wants that product, not the best-ranked
  // document that happens to mention it. ts_rank_cd alone cannot deliver that:
  // it rewards repetition, so a long body beats a short exact title. The tiers
  // are far enough apart that a title match always outranks a body match.
  const titleBoostSql = Prisma.sql`
    CASE
      WHEN lower(d."title") = lower(${q}) THEN 1000
      WHEN left(lower(d."title"), length(${q})) = lower(${q}) THEN 100
      WHEN position(lower(${q}) IN lower(d."title")) > 0 THEN 10
      ELSE 0
    END
  `
  const orderSql = opts.sort === 'newest'
    ? Prisma.sql`d."source_updated_at" DESC NULLS LAST, rank DESC`
    : Prisma.sql`rank DESC, d."source_updated_at" DESC NULLS LAST`

  // makeTq is a factory, not a value: each use site needs its own parameter
  // bindings.
  const run = async (makeTq: () => Prisma.Sql) => {
    const rankSql = Prisma.sql`
      (ts_rank_cd(d."search_vector", ${makeTq()})
        * COALESCE((${weightsJson}::jsonb->>d."source")::numeric, 1)
        + ${titleBoostSql})::float8
    `
    const headlineSql = opts.highlight
      ? Prisma.sql`ts_headline(${lang}::regconfig, left(d."body", 30000), ${makeTq()}, ${HEADLINE_OPTIONS[snippetLength]})`
      : Prisma.sql`NULL::text`
    return Promise.all([
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT d."source", d."entity_id", d."title", d."url", d."image_url", d."excerpt",
               d."extra", d."source_updated_at",
               ${rankSql} AS rank,
               ${headlineSql} AS snippet
        FROM "srch_documents" d
        WHERE ${sourcesSql} AND ${tierSql} AND d."search_vector" @@ ${makeTq()}
        ORDER BY ${orderSql}
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*) AS total FROM "srch_documents" d
        WHERE ${sourcesSql} AND ${tierSql} AND d."search_vector" @@ ${makeTq()}
      `,
    ])
  }

  let rows: Array<Record<string, unknown>>
  let countRows: Array<{ total: bigint }>
  let relaxed = false
  try {
    ;[rows, countRows] = await run(() => tsQuery(lang, q))
    // Every term required found nothing - retry on any term before giving up.
    if (Number(countRows[0]?.total ?? 0) === 0) {
      const loose = looseTerms(q)
      if (loose) {
        const [looseRows, looseCount] = await run(
          () => Prisma.sql`to_tsquery(${lang}::regconfig, ${loose})`,
        )
        if (Number(looseCount[0]?.total ?? 0) > 0) {
          ;[rows, countRows, relaxed] = [looseRows, looseCount, true]
        }
      }
    }
  } catch {
    // A malformed tsquery must never 500 a public page - no results instead.
    return { hits: [], total: 0, sources, relaxed: false }
  }

  const hits: SearchHit[] = rows.map((r) => ({
    source: r.source as SearchSourceKey,
    entityId: r.entity_id as string,
    title: r.title as string,
    url: r.url as string,
    imageUrl: (r.image_url as string | null) ?? null,
    excerpt: (r.excerpt as string | null) ?? null,
    snippet: (r.snippet as string | null) ?? null,
    extra: (r.extra as Record<string, unknown> | null) ?? null,
    date: r.source_updated_at ? (r.source_updated_at as Date).toISOString() : null,
    price: null,
    rank: Number(r.rank ?? 0),
  }))

  return {
    hits: await enrichProductHits(hits),
    total: Number(countRows[0]?.total ?? 0),
    sources,
    relaxed,
  }
}
