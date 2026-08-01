import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { INSTALLED_MODULE_WHERE } from '@/lib/modules/live-status'
import { moduleExtensionPointComponents } from '@/lib/modules/extension-points'
import { getSearchSettings } from './settings'
import { listAvailableSources } from './indexer'
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
}

const HEADLINE_OPTIONS: Record<SnippetLength, string> = {
  short: 'MaxWords=12, MinWords=5, StartSel=«, StopSel=», ShortWord=2',
  medium: 'MaxWords=28, MinWords=12, StartSel=«, StopSel=», ShortWord=2',
  long: 'MaxWords=48, MinWords=20, StartSel=«, StopSel=», ShortWord=2',
}

// Last token, stripped to safe characters, for prefix matching ("gre" matches
// "green" while typing). to_tsquery throws on syntax errors, so only a purely
// alphanumeric token is ever passed to it.
function prefixToken(q: string): string | null {
  const last = q.trim().split(/\s+/).pop() ?? ''
  const clean = last.replace(/[^a-zA-Z0-9]/g, '')
  return clean.length >= 2 ? clean : null
}

// The one tsquery expression, reused in WHERE, rank and headline. Parameters
// are duplicated per use site - Prisma re-binds them each time.
function tsQuery(language: string, q: string): Prisma.Sql {
  const token = prefixToken(q)
  return token
    ? Prisma.sql`(websearch_to_tsquery(${language}::regconfig, ${q}) || to_tsquery(${language}::regconfig, ${token + ':*'}))`
    : Prisma.sql`websearch_to_tsquery(${language}::regconfig, ${q})`
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

async function resolveFromPrices(productIds: string[]): Promise<Map<string, CardFromPrice>> {
  const out = new Map<string, CardFromPrice>()
  if (productIds.length === 0) return out
  const providers = (moduleExtensionPointComponents[CARD_PRICE_POINT] ?? {}) as Record<string, CardPriceProvider>
  if (Object.keys(providers).length === 0) return out

  const modules = await prisma.module.findMany({
    where: { ...INSTALLED_MODULE_WHERE },
    select: { manifest: true },
  })
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
    const [rows, symbol, fromPrices] = await Promise.all([
      prisma.$queryRaw<Array<{ id: string; price: string; sale_price: string | null }>>`
        SELECT "id", "price"::text AS price, "sale_price"::text AS sale_price
        FROM "shp_products"
        WHERE "id" = ANY(${productIds}) AND "status" = 'ACTIVE' AND "catalogue_hidden" = false
      `,
      shopCurrencySymbol(),
      resolveFromPrices(productIds),
    ])
    const byId = new Map(rows.map((r) => [r.id, r]))
    const out: SearchHit[] = []
    for (const hit of hits) {
      if (hit.source !== 'shop-product') {
        out.push(hit)
        continue
      }
      const row = byId.get(hit.entityId)
      if (!row) continue
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
  if (!q) return { hits: [], total: 0, sources: [] }

  const sources = await resolveSearchableSources(opts.sources)
  if (sources.length === 0) return { hits: [], total: 0, sources: [] }

  const settings = await getSearchSettings()
  const lang = settings.language
  const weightsJson = JSON.stringify(settings.weights)
  const tq = () => tsQuery(lang, q)
  const tierSql = opts.includeMembersTier
    ? Prisma.sql`d."tier" IN ('public', 'members')`
    : Prisma.sql`d."tier" = 'public'`
  const sourcesSql = Prisma.sql`d."source" IN (${Prisma.join(sources)})`
  const limit = Math.max(1, Math.min(50, opts.limit))
  const offset = Math.max(0, opts.offset)
  const snippetLength = opts.snippetLength ?? 'medium'

  const rankSql = Prisma.sql`
    (ts_rank_cd(d."search_vector", ${tq()})
      * COALESCE((${weightsJson}::jsonb->>d."source")::numeric, 1))::float8
  `
  const headlineSql = opts.highlight
    ? Prisma.sql`ts_headline(${lang}::regconfig, left(d."body", 30000), ${tq()}, ${HEADLINE_OPTIONS[snippetLength]})`
    : Prisma.sql`NULL::text`
  const orderSql = opts.sort === 'newest'
    ? Prisma.sql`d."source_updated_at" DESC NULLS LAST, rank DESC`
    : Prisma.sql`rank DESC, d."source_updated_at" DESC NULLS LAST`

  let rows: Array<Record<string, unknown>>
  let countRows: Array<{ total: bigint }>
  try {
    ;[rows, countRows] = await Promise.all([
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT d."source", d."entity_id", d."title", d."url", d."image_url", d."excerpt",
               d."extra", d."source_updated_at",
               ${rankSql} AS rank,
               ${headlineSql} AS snippet
        FROM "srch_documents" d
        WHERE ${sourcesSql} AND ${tierSql} AND d."search_vector" @@ ${tq()}
        ORDER BY ${orderSql}
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*) AS total FROM "srch_documents" d
        WHERE ${sourcesSql} AND ${tierSql} AND d."search_vector" @@ ${tq()}
      `,
    ])
  } catch {
    // A malformed tsquery must never 500 a public page - no results instead.
    return { hits: [], total: 0, sources }
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
  }
}
