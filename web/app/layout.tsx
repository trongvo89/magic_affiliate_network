import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Magic Affiliate Network',
  description: 'Mobile App Affiliate Network',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
