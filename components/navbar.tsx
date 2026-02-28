"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

export function Navbar() {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <nav className="mx-auto grid h-14 max-w-7xl grid-cols-3 items-center px-6">
        {/* Left: Logo + nav links */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5 text-primary-foreground"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              SkillForge
            </span>
          </Link>

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-1">
            <Link
              href="/"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mounted && pathname === "/"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Upload
            </Link>
            <Link
              href="/skills"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mounted && (pathname === "/skills" || pathname.startsWith("/skills/"))
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Skills
            </Link>
          </div>
        </div>

        <div />

        {/* Right: Theme toggle */}
        <div className="flex items-center justify-end">
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Toggle theme"
          >
            {mounted ? (
              resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            ) : (
              <div className="h-4 w-4" />
            )}
          </button>
        </div>
      </nav>
    </header>
  )
}
