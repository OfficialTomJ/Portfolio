import { Metadata } from 'next'

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <section>{children}</section>
}