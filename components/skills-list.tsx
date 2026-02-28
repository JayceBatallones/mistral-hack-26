"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Session } from "@/lib/types"
import Link from "next/link"

export function SkillsListContainer() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then((data: Session[]) => {
        setSessions(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-muted-foreground text-sm">Loading sessions…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Workflows Library
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Generated skill definitions for your AI agents. Click on a skill to
          view its workflow.
        </p>
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No sessions yet. Upload a video to get started.</p>
        </div>
      )}

      <div className="grid gap-3">
        {sessions.map((session) => {
          const hasSkill = session.has_skill_md
          const skillTitle = session.skill_title
          const StatusIcon = hasSkill ? CheckCircle2 : Clock
          const statusLabel = hasSkill ? 'Completed' : 'In Progress'

          const href = `/skills/${session.id}`

          return (
            <Link
              key={session.id}
              href={href}
              className={cn(
                "group flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all",
                "cursor-pointer hover:border-primary/30 hover:bg-secondary/30"
              )}
            >
              {/* Status icon */}
              <div
                className={cn(
                  "mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border",
                  hasSkill
                    ? "border-node-verify/20 bg-node-verify/10"
                    : "border-border bg-secondary"
                )}
              >
                <StatusIcon
                  className={cn(
                    "h-5 w-5",
                    hasSkill ? "text-node-verify" : "text-muted-foreground"
                  )}
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {skillTitle || `Session ${session.id.slice(0, 8)}…`}
                  </h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {statusLabel} · {session.id.slice(0, 12)}…
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
