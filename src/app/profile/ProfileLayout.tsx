import { Metadata } from 'next'

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <section>{children}</section>
}