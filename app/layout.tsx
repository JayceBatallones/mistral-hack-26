import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { ViewModeProvider } from '@/lib/view-mode-context'
import './globals.css'

const _fraunces = Fraunces({ subsets: ["latin"], variable: '--font-serif' })
const _inter = Inter({ subsets: ["latin"], variable: '--font-sans' })
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Ditto',
  description: 'Ditto studies your recording, copies each move, and Claude replays the resulting WORKFLOW.md.',
}

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${_inter.variable} ${_fraunces.variable} ${_geistMono.variable}`}>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <ViewModeProvider>
            {children}
          </ViewModeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
