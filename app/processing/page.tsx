'use client'

import { Suspense } from 'react'
import { Navbar } from '@/components/navbar'
import { ProcessingView } from '@/components/processing-view'

export default function ProcessingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Suspense fallback={
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <span className="text-muted-foreground text-sm">Loading session…</span>
        </div>
      }>
        <ProcessingView />
      </Suspense>
    </div>
  )
}
