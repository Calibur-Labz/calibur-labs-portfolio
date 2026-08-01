import type { Metadata } from 'next'
import { syne, poppins } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Calibur Labz',
  description: "Let's discuss your project and create software that drives real business results.",
  openGraph: {
    title: 'Calibur Labz',
    description: "Let's discuss your project and create software that drives real business results.",
    images: [{ url: '/images/og-image.png', width: 1200, height: 630 }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
