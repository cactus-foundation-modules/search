import { getSessionFromCookie } from '@/lib/auth/session'
import { hasPermission } from '@/lib/permissions/check'
import SearchDashboard from '@/modules/search/components/admin/SearchDashboard'

export const metadata = { title: 'Search — Admin' }

export default async function SearchAdminPage() {
  const user = await getSessionFromCookie()
  if (!user) return null
  if (!await hasPermission(user, 'search.view')) {
    return <div className="alert alert-danger">You need the search permission to view this page.</div>
  }
  return (
    <div>
      <h1 style={{ margin: '0 0 1rem' }}>Search</h1>
      <SearchDashboard />
    </div>
  )
}
