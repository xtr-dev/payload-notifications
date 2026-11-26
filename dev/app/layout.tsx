import type { Metadata } from 'next'

export const metadata: Metadata = {
  description: 'Demo environment for the @xtr-dev/payload-notifications plugin',
  title: 'Payload Notifications Plugin Demo',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}