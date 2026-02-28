import { Navbar } from '@/components/navbar'
import { UploadHero } from '@/components/upload-hero'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)]">
      <Navbar />
      <UploadHero />
    </div>
  )
}
