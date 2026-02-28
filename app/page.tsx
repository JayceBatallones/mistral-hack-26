'use client'

import { Navbar } from '@/components/navbar'
import { UploadHero } from '@/components/upload-hero'

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)]">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40">
        <svg className="absolute left-[6%] top-[12%] h-64 w-64 text-[var(--color-accent-sand)]" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill="currentColor" d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.3,-46.3C90.8,-33.5,96.8,-18.1,95.6,-3.4C94.4,11.3,86,25.3,77.1,38.9C68.2,52.5,58.8,65.7,46.2,74.5C33.6,83.3,17.8,87.7,2.1,84.2C-13.6,80.7,-29.2,69.3,-42.9,59.3C-56.6,49.3,-68.4,40.7,-76.7,28.8C-85,16.9,-89.8,1.7,-88.4,-12.8C-87,-27.3,-79.4,-41.1,-68.6,-51.7C-57.8,-62.3,-43.8,-69.7,-29.9,-75.4C-16,-81.1,-2.2,-85.1,11.8,-83.4C25.8,-81.7,30.6,-83.6,44.7,-76.4Z" transform="translate(100 100) scale(1.1)" />
        </svg>
        <svg className="absolute bottom-[8%] right-[6%] h-96 w-96 text-[var(--color-accent-sage)] opacity-50" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill="currentColor" d="M51.5,-67.5C65.9,-56.3,76.3,-40.1,81.5,-22.4C86.7,-4.7,86.7,14.5,79.1,30.9C71.5,47.3,56.3,60.9,39.6,68.9C22.9,76.9,4.7,79.3,-12.4,75.4C-29.5,71.5,-45.5,61.3,-58.4,47.7C-71.3,34.1,-81.1,17.1,-82.9,-1.1C-84.7,-19.3,-78.5,-38.6,-66.1,-51.7C-53.7,-64.8,-35.1,-71.7,-17.7,-73.4C-0.3,-75.1,15.9,-71.6,37.1,-78.7C58.3,-85.8,37.1,-78.7,51.5,-67.5Z" transform="translate(100 100) scale(0.9)" />
        </svg>
      </div>

      <div className="relative z-10">
        <Navbar />
        <UploadHero />
      </div>
    </div>
  )
}
