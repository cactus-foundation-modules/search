import { NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session'
import { hasPermission } from '@/lib/permissions/check'
import { errorResponse } from '@/lib/utils'
import { getIndexStatus } from '@/modules/search/lib/indexer'

export async function GET() {
  const user = await getSessionFromCookie()
  if (!user) return errorResponse('Not authenticated', 401)
  if (!await hasPermission(user, 'search.view')) return errorResponse('Forbidden', 403)

  return NextResponse.json(await getIndexStatus())
}
