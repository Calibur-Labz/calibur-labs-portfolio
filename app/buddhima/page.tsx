import { redirect } from 'next/navigation'
import { getSession } from '@/lib/require-auth'
import Dashboard from './Dashboard'

// Always render per-request so the session is checked fresh.
export const dynamic = 'force-dynamic'

export default async function BuddhimaPage() {
  const session = await getSession()
  // Defence in depth: proxy.ts already guards this route, but we re-check here.
  if (!session) {
    redirect('/buddhima/login')
  }

  return <Dashboard adminEmail={session.email} />
}
