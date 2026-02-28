'use client'

import { useState, useEffect, useRef } from 'react'
import { Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/types'

// ─── Inline SVG Icons (14×14) — mirrors Manimate's PillIcon ──────────────────

function ToolSvgIcon({ name, size = 14 }: { name?: string; size?: number }) {
  const f = 'currentColor'
  switch (name) {
    case 'Bash':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill={f}>
          <path fillRule="evenodd" d="M3.25 3A2.25 2.25 0 001 5.25v9.5A2.25 2.25 0 003.25 17h13.5A2.25 2.25 0 0019 14.75v-9.5A2.25 2.25 0 0016.75 3H3.25zM2.5 5.25a.75.75 0 01.75-.75h13.5a.75.75 0 01.75.75v9.5a.75.75 0 01-.75.75H3.25a.75.75 0 01-.75-.75v-9.5zM5.22 7.47a.75.75 0 011.06 0l2.25 2.25a.75.75 0 010 1.06l-2.25 2.25a.75.75 0 01-1.06-1.06L6.94 10.25 5.22 8.53a.75.75 0 010-1.06zM10 12.25a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75z" clipRule="evenodd" />
        </svg>
      )
    case 'Read':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill={f}>
          <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
          <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
        </svg>
      )
    case 'Write':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill={f}>
          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
        </svg>
      )
    case 'Edit':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill={f}>
          <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
        </svg>
      )
    case 'Grep':
    case 'Glob':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill={f}>
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
      )
    case 'TodoWrite':
    case 'TodoRead':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill={f}>
          <path d="M3 4a1.25 1.25 0 112.5 0A1.25 1.25 0 013 4zm4.5-.75h9a.75.75 0 010 1.5h-9a.75.75 0 010-1.5zM3 10a1.25 1.25 0 112.5 0A1.25 1.25 0 013 10zm4.5-.75h9a.75.75 0 010 1.5h-9a.75.75 0 010-1.5zM3 16a1.25 1.25 0 112.5 0A1.25 1.25 0 013 16zm4.5-.75h9a.75.75 0 010 1.5h-9a.75.75 0 010-1.5z" />
        </svg>
      )
    case 'Task':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill={f}>
          <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z" clipRule="evenodd" />
        </svg>
      )
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill={f}>
          <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v11.5A2.25 2.25 0 004.25 18h11.5A2.25 2.25 0 0018 15.75V4.25A2.25 2.25 0 0015.75 2H4.25zm4.03 6.28a.75.75 0 00-1.06-1.06L4.97 9.47a.75.75 0 000 1.06l2.25 2.25a.75.75 0 001.06-1.06L6.56 10l1.72-1.72zm4.5-1.06a.75.75 0 10-1.06 1.06L13.44 10l-1.72 1.72a.75.75 0 101.06 1.06l2.25-2.25a.75.75 0 000-1.06l-2.25-2.25z" clipRule="evenodd" />
        </svg>
      )
  }
}

function CheckCircleSvg({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  )
}

function ErrorCircleSvg({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  )
}

// ─── Summary helpers ──────────────────────────────────────────────────────────

function getToolSummary(name?: string, input?: Record<string, unknown>): string {
  if (!input) return name ?? ''
  if (name === 'Bash') {
    const cmd = String(input.command ?? '')
    return cmd.length > 60 ? cmd.slice(0, 60) + '…' : cmd
  }
  if (name === 'Write' || name === 'Edit') {
    const action = name === 'Write' ? 'Writing' : 'Editing'
    return `${action} ${String(input.file_path ?? input.path ?? '')}`
  }
  if (name === 'Read') return `Reading ${String(input.file_path ?? '')}`
  if (name === 'TodoWrite') {
    const todos = Array.isArray(input.todos) ? input.todos : []
    if (todos.length > 0) return `Planning ${todos.length} task${todos.length === 1 ? '' : 's'}`
    return 'Updating task plan'
  }
  if (name === 'Grep' || name === 'Glob') return `Searching ${String(input.pattern ?? input.glob ?? '')}`
  if (name === 'Task') return `Task: ${String(input.description ?? '').slice(0, 50)}`
  return JSON.stringify(input).slice(0, 60)
}

// ─── ToolCallPill — always gray tool icon, shows input on expand ─────────────

function ToolCallPill({ msg, isDone }: { msg: ChatMessage; isDone: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const summary = getToolSummary(msg.tool_name, msg.tool_input)
  const hasExpandable = !!msg.tool_input && Object.keys(msg.tool_input).length > 0
  const inputStr = msg.tool_input ? JSON.stringify(msg.tool_input, null, 2) : ''

  return (
    <div>
      <button
        onClick={() => hasExpandable && setExpanded(!expanded)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5',
          'bg-card border border-border rounded-full',
          'text-[13px] text-muted-foreground font-mono',
          'max-w-full text-left',
          hasExpandable ? 'cursor-pointer hover:bg-secondary/40 transition-colors' : 'cursor-default',
          !isDone && 'opacity-60',
        )}
      >
        {/* Icon is dimmer while pending, full opacity once result is in */}
        <span className="shrink-0 flex items-center justify-center w-[14px] h-[14px] text-muted-foreground/50">
          <ToolSvgIcon name={msg.tool_name} />
        </span>
        <span className="truncate">{summary}</span>
      </button>

      {expanded && inputStr && (
        <div className="mt-1" style={{ marginLeft: 22 }}>
          <pre
            className="text-[11px] rounded-md overflow-x-auto max-h-48 whitespace-pre-wrap break-all p-2"
            style={{ background: '#1f2937', color: '#d4d4d4', fontFamily: 'monospace' }}
          >
            {inputStr}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── ToolResultRow — result preview pill with green check ─────────────────────

function stripLineNumbers(line: string): string {
  return line.replace(/^\s*\d+→/, '').trim()
}

// ─── ToolResultRow — green check pill for tool_result, mirrors Manimate ───────

function ToolResultRow({ msg }: { msg: ChatMessage }) {
  const [expanded, setExpanded] = useState(false)
  const isError = msg.is_error ?? false
  const content = msg.content ?? ''

  // Find the first non-empty line after stripping read-tool line-number prefixes
  const lines = content.split('\n').map(stripLineNumbers).filter((l) => l.length > 0)
  const firstLine = lines[0] ?? ''
  const preview = firstLine.slice(0, 80) + (firstLine.length > 80 ? '…' : '')
  // Expandable if multi-line OR first line was truncated
  const hasExpandable = lines.length > 1 || firstLine.length > 80

  // Don't render noisy/trivial results
  if (firstLine.length < 8) return null

  return (
    <div>
      <button
        onClick={() => hasExpandable && setExpanded(!expanded)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5',
          'bg-card border border-border rounded-full',
          'text-[13px] text-muted-foreground font-mono',
          'max-w-full text-left',
          hasExpandable ? 'cursor-pointer hover:bg-secondary/40 transition-colors' : 'cursor-default',
          isError && 'text-node-error',
        )}
      >
        <span
          className={cn(
            'shrink-0 flex items-center justify-center w-[14px] h-[14px]',
            isError && 'text-node-error',
          )}
          style={isError ? undefined : { color: '#16a34a' }}
        >
          {isError ? <ErrorCircleSvg /> : <CheckCircleSvg />}
        </span>
        <span className="truncate">{preview}</span>
      </button>

      {expanded && (
        <div className="mt-1" style={{ marginLeft: 22 }}>
          <pre
            className="text-[11px] rounded-md overflow-x-auto max-h-48 whitespace-pre-wrap break-all p-2"
            style={{
              background: '#1f2937',
              color: isError ? '#fca5a5' : '#d4d4d4',
              fontFamily: 'monospace',
            }}
          >
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Main ChatPanel ───────────────────────────────────────────────────────────

export function ChatPanel({
  messages,
  isRunning,
}: {
  messages: ChatMessage[]
  isRunning: boolean
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [userScrolled, setUserScrolled] = useState(false)

  useEffect(() => {
    if (!userScrolled) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, userScrolled])

  const onScroll = () => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setUserScrolled(!atBottom)
  }

  const lastAssistantId = messages.findLast((m) => m.role === 'assistant')?.id

  // Track which tool_use ids have a result (for pending vs done opacity)
  const completedToolIds = new Set<string>()
  for (const m of messages) {
    if (m.role === 'tool_result' && m.tool_id) completedToolIds.add(m.tool_id)
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
    >
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-20">
          <div className="text-4xl mb-2">⚡</div>
          <p className="text-muted-foreground text-sm font-medium">Attach a video and describe the workflow</p>
          <p className="text-muted-foreground/60 text-xs max-w-xs">
            Claude will extract keyframes, analyze each one, and generate a replayable SKILL.md
          </p>
          <div className="mt-4 space-y-1.5">
            {[
              'use /video-frame-reader on this and create SKILL.md',
              'step 3 is wrong — the user clicked Login not Sign Up',
              'replay the workflow',
            ].map((ex) => (
              <div key={ex} className="text-[11px] text-muted-foreground font-mono bg-card border border-border rounded px-2 py-1">
                {ex}
              </div>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg) => {
        if (msg.role === 'tool_result') {
          return (
            <div key={msg.id} className="animate-slide-up">
              <ToolResultRow msg={msg} />
            </div>
          )
        }

        if (msg.role === 'tool_use') {
          const isDone = !!msg.tool_id && completedToolIds.has(msg.tool_id)
          return (
            <div key={msg.id} className="animate-slide-up">
              <ToolCallPill msg={msg} isDone={isDone} />
            </div>
          )
        }

        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex justify-end animate-slide-up">
              <div className="max-w-[85%] bg-[var(--color-accent-sand)]/10 border border-[var(--color-accent-sand)]/25 rounded-xl rounded-br-sm px-3.5 py-2.5">
                {msg.video_name && (
                  <div className="flex items-center gap-1.5 mb-2 text-primary text-xs font-mono">
                    <Video className="w-3.5 h-3.5" />
                    {msg.video_name}
                  </div>
                )}
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          )
        }

        // assistant
        return (
          <div key={msg.id} className="animate-slide-up">
            <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap border-l-2 border-[var(--color-accent-sage)]/40 pl-3">
              {msg.content}
              {isRunning && msg.id === lastAssistantId && (
                <span className="inline-block w-[2px] h-4 bg-primary ml-0.5 animate-[pulseDot_1s_ease-in-out_infinite] align-middle" />
              )}
            </div>
          </div>
        )
      })}

      {isRunning && messages.length > 0 && messages.at(-1)?.role !== 'assistant' && (
        <div className="flex gap-1.5 items-center text-muted-foreground text-xs animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulseDot_1.5s_0s_infinite]" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulseDot_1.5s_0.3s_infinite]" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulseDot_1.5s_0.6s_infinite]" />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
