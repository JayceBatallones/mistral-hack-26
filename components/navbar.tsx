"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { MimiLogo } from "@/components/mimi-logo"

export function Navbar() {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-stone)] bg-[var(--color-paper)]/80 backdrop-blur-xl">
      <nav className="mx-auto grid h-14 max-w-7xl grid-cols-3 items-center px-6">
        {/* Left: Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-3">
            <MimiLogo className="h-10 w-10 mimi-bounce" />
            <span className="text-2xl font-semibold tracking-tight text-[var(--color-ink)] font-serif">
              Ditto
            </span>
          </Link>
        </div>

        {/* Centre: Page links */}
        <div className="flex items-center justify-center gap-1">
          <Link
            href="/"
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              mounted && pathname === "/"
                ? "bg-[var(--color-stone)] text-[var(--color-ink)]"
                : "text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
            )}
          >
            Upload
          </Link>
          <Link
            href="/skills"
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              mounted && (pathname === "/skills" || pathname.startsWith("/skills/"))
                ? "bg-[var(--color-stone)] text-[var(--color-ink)]"
                : "text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
            )}
          >
            Workflows
          </Link>
        </div>

        {/* Right: Theme toggle */}
        <div className="flex items-center justify-end">
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-ink-light)] transition-colors hover:bg-[var(--color-stone)] hover:text-[var(--color-ink)]"
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
