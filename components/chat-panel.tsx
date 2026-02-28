'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronRight, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/types'

function formatToolSummary(name?: string, input?: Record<string, unknown>): string {
  if (!input) return ''
  if (name === 'Bash') return String(input.command ?? '').slice(0, 60)
  if (name === 'Write' || name === 'Edit') return String(input.file_path ?? input.path ?? '')
  if (name === 'Read') return String(input.file_path ?? '')
  return JSON.stringify(input).slice(0, 60)
}

function ToolCallPill({ msg, result, isRunning }: { msg: ChatMessage; result?: ChatMessage; isRunning: boolean }) {
  const [open, setOpen] = useState(false)

  const statusIcon = result
    ? result.is_error
      ? <span className="text-destructive-foreground">✗</span>
      : <span className="text-node-verify">✓</span>
    : isRunning
      ? <span className="flex gap-0.5 items-center">
          <span className="w-1 h-1 rounded-full bg-primary animate-[pulseDot_1.5s_ease-in-out_0s_infinite]" />
          <span className="w-1 h-1 rounded-full bg-primary animate-[pulseDot_1.5s_ease-in-out_0.3s_infinite]" />
          <span className="w-1 h-1 rounded-full bg-primary animate-[pulseDot_1.5s_ease-in-out_0.6s_infinite]" />
        </span>
      : <span className="text-muted-foreground">—</span>

  const inputStr = msg.tool_input
    ? JSON.stringify(msg.tool_input, null, 2)
    : ''

  return (
    <div className="tool-pill rounded-lg border border-border bg-card overflow-hidden text-xs font-mono">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors"
      >
        <ChevronRight className={cn("w-3 h-3 text-muted-foreground shrink-0 transition-transform duration-150", open && "rotate-90")} />
        <span className="text-primary font-medium shrink-0">{msg.tool_name}</span>
        <span className="text-muted-foreground truncate flex-1 text-left">
          {formatToolSummary(msg.tool_name, msg.tool_input)}
        </span>
        <span className="shrink-0">{statusIcon}</span>
      </button>

      {open && (
        <div className="border-t border-border">
          {inputStr && (
            <div className="px-3 py-2 border-b border-border">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Input</div>
              <pre className="text-foreground/80 text-[11px] overflow-x-auto max-h-40 whitespace-pre-wrap break-all">{inputStr}</pre>
            </div>
          )}
          {result && (
            <div className="px-3 py-2">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Output</div>
              <pre className={cn("text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap break-all", result.is_error ? 'text-destructive-foreground' : 'text-foreground/80')}>
                {result.content || '(no output)'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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

  const toolResults = new Map<string, ChatMessage>()
  for (const m of messages) {
    if (m.role === 'tool_result' && m.tool_id) toolResults.set(m.tool_id, m)
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
        if (msg.role === 'tool_result') return null

        if (msg.role === 'tool_use') {
          return (
            <div key={msg.id} className="animate-slide-up">
              <ToolCallPill msg={msg} result={msg.tool_id ? toolResults.get(msg.tool_id) : undefined} isRunning={isRunning} />
            </div>
          )
        }

        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex justify-end animate-slide-up">
              <div className="max-w-[85%] bg-primary/15 border border-primary/25 rounded-xl rounded-br-sm px-3.5 py-2.5">
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
            <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
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
