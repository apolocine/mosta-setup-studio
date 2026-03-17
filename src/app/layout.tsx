// Author: Dr Hamid MADANI drmdh@msn.com
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MostaSetup Studio',
  description: 'Visual editor for setup.json — generate declarative setup manifests for @mostajs/setup',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
