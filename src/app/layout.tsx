import './globals.css'
import { Jost } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'

const jost = Jost({ subsets: ['latin'] })

export const metadata = {
  title: 'Thomas Johnston',
  description: 'Personal Portfolio'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={jost.className}>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
