'use client'

import { Navbar } from '@/components/navbar'
import { SkillsListContainer } from '@/components/skills-list'

export default function SkillsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <SkillsListContainer />
    </div>
  )
}
