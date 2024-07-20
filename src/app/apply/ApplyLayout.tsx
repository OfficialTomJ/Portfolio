import { Metadata } from 'next'

export default function ApplyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <section>{children}</section>
}