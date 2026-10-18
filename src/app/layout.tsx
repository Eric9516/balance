import type { Metadata } from 'next'
import { Geist, Geist_Mono, Source_Serif_4 } from 'next/font/google'
import { Providers } from './providers'
import { Toaster } from '@/modules/errores/components/Toast'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
// Títulos de estados contables: serif, como un balance impreso.
const serifEstados = Source_Serif_4({
  variable: '--font-serif-estados',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  title: { default: 'BalanceRT', template: '%s | BalanceRT' },
  description: 'Plataforma contable RT 54 para estudios argentinos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${serifEstados.variable} h-full antialiased`}
    >
      <body className="h-full">
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
