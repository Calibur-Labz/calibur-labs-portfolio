import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Hero from '@/components/sections/Hero'
import Services from '@/components/sections/Services'
import About from '@/components/sections/About'
import BuildWithPrecision from '@/components/sections/BuildWithPrecision'
import WhyChooseUs from '@/components/sections/WhyChooseUs'
import Projects from '@/components/sections/Projects'
import Testimonials from '@/components/sections/Testimonials'
import Contact from '@/components/sections/Contact'
import MaintenanceScreen from '@/components/MaintenanceScreen'
import OrbiGuide from '@/components/orbi/OrbiGuide'
import { readSiteSettingsSafe } from '@/lib/settings'

// Read the maintenance flag fresh on every request so toggling it from the
// admin console takes effect immediately.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const { maintenance, emergencyPhone } = await readSiteSettingsSafe()

  if (maintenance) {
    return <MaintenanceScreen phone={emergencyPhone} />
  }

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Services />
        <About />
        <BuildWithPrecision />
        <WhyChooseUs />
        <Projects />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
      {/* ORBI — the site companion. Wrapping nothing today; wrap the page in
          Phase 2 if sections need `useOrbi()` to drive it from scroll. */}
      <OrbiGuide />
    </>
  )
}
