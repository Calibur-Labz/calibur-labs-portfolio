import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Buddhima Console',
  // Keep the admin area out of search engines.
  robots: { index: false, follow: false },
}

export default function BuddhimaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
