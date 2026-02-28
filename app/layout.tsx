import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { ViewModeProvider } from '@/lib/view-mode-context'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'SkillForge',
  description: 'Record once. AI watches. Runs forever.',
}

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ViewModeProvider>
            {children}
          </ViewModeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
