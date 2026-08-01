import { prisma } from '@/lib/db/prisma'
import { upsertAlert, clearAlert } from '@/lib/notifications/alerts'

const DEDUPE_KEY = 'search:index-empty'

// Admin bell notification for the one state search cannot dig itself out of:
// an empty index (fresh install, nothing indexed yet). Clicking it lands on
// the Search dashboard, which auto-starts the first build when the index is
// empty - so the notification IS the one-click fix. Cleared the moment the
// index holds anything. Kept to a single rolling notification by dedupeKey
// (same pattern as core-update / contact-form:messages).
export async function syncIndexAlert(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM "srch_documents"
    `
    const empty = Number(rows[0]?.count ?? 0) === 0
    if (empty) {
      await upsertAlert({
        type: 'message',
        dedupeKey: DEDUPE_KEY,
        title: 'Search index needs building - open Search and it starts itself',
        link: '/m/search/index',
      })
    } else {
      await clearAlert(DEDUPE_KEY)
    }
  } catch {
    // Never let bookkeeping break search or a cron run.
  }
}
