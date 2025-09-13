import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payload Notifications Plugin Demo',
  description: 'Demo environment for the @xtr-dev/payload-notifications plugin',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}