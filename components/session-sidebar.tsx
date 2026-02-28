'use client'

import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Session } from '@/lib/types'

export function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
}: {
  sessions: Session[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
}) {
  return (
    <div className="w-56 shrink-0 border-r border-border flex flex-col bg-sidebar">
      <div className="px-3 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sessions</span>
        <button
          onClick={onNew}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="New session"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground/50 text-center">No sessions yet</p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              'w-full text-left px-3 py-2 text-xs transition-colors border-l-2',
              s.id === activeId
                ? 'bg-primary/10 text-primary border-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground border-transparent'
            )}
          >
            <div className="font-mono truncate">{s.id.slice(0, 8)}…</div>
            <div className="text-muted-foreground/60 text-[10px] mt-0.5">
              {new Date(s.created_at).toLocaleTimeString()}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
