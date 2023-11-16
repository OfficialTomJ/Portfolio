import { Metadata } from 'next'

export default function LinksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <section>{children}</section>
}