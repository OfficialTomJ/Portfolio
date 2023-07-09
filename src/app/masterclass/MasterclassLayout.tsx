import { Metadata } from 'next'

export default function MasterclassLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <section>{children}</section>
}