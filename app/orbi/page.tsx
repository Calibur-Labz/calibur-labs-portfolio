import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import OrbiProduct from '@/components/sections/OrbiProduct'
import MaintenanceScreen from '@/components/MaintenanceScreen'
import OrbiGuide from '@/components/orbi/OrbiGuide'
import { readSiteSettingsSafe } from '@/lib/settings'

// Same rule as the homepage: read the maintenance flag fresh on every request
// so toggling it from the admin console takes effect immediately.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ORBI — a site companion with a personality | xCalibur Labz',
  description:
    'ORBI is a character who lives on your page: scroll-aware, cursor-aware, and able to answer questions about your business. Packages from $490.',
  openGraph: {
    title: 'ORBI — a site companion with a personality',
    description:
      'Scroll-aware, cursor-aware, and able to answer questions about your business. Packages from $490.',
    images: [{ url: '/images/orbi.png', width: 1254, height: 1254 }],
  },
}

export default async function OrbiPage() {
  const { maintenance, emergencyPhone } = await readSiteSettingsSafe()

  if (maintenance) {
    return <MaintenanceScreen phone={emergencyPhone} />
  }

  return (
    <>
      <Navbar />
      <main>
        <OrbiProduct />
      </main>
      <Footer />
      {/* The product, demonstrating itself. He has no section behaviours here —
          those are keyed to the homepage's ids — so he arrives, idles and
          reacts to the cursor, which is exactly the point of the page. */}
      <OrbiGuide />
    </>
  )
}
