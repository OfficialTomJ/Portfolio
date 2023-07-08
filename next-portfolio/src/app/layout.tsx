import './globals.css'
import { Jost } from 'next/font/google'
import Footer from '../Sections/PortfolioFooter'

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
      <body className={jost.className}>{children}</body>
      <Footer></Footer>
    </html>
  )
}
