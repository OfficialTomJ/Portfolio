import { Metadata } from 'next'

export default function OneLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <section>{children}</section>
}