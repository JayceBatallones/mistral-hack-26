'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage, Session, SSEEvent } from '@/lib/types'

// ─── Icons (inline SVG to avoid dep) ───────────────────────────────────────

function IconPaperclip({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
    </svg>
  )
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
    </svg>
  )
}

function IconStop({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm5-2.25A.75.75 0 017.75 7h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5z" clipRule="evenodd" />
    </svg>
  )
}

function IconChevron({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg className={`${className} transition-transform duration-150 ${open ? 'rotate-90' : ''}`} viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
    </svg>
  )
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8.75 3.75a.75.75 0 00-1.5 0v3.5h-3.5a.75.75 0 000 1.5h3.5v3.5a.75.75 0 001.5 0v-3.5h3.5a.75.75 0 000-1.5h-3.5v-3.5z" />
    </svg>
  )
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
    </svg>
  )
}

function IconVideo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" />
    </svg>
  )
}

// ─── Tool-specific icons ─────────────────────────────────────────────────────

function PillIcon({ toolName }: { toolName?: string }) {
  const s = 13
  const f = 'currentColor'
  if (toolName === 'Bash') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill={f}><path fillRule="evenodd" d="M3.25 3A2.25 2.25 0 001 5.25v9.5A2.25 2.25 0 003.25 17h13.5A2.25 2.25 0 0019 14.75v-9.5A2.25 2.25 0 0016.75 3H3.25zM2.5 5.25a.75.75 0 01.75-.75h13.5a.75.75 0 01.75.75v9.5a.75.75 0 01-.75.75H3.25a.75.75 0 01-.75-.75v-9.5zM5.22 7.47a.75.75 0 011.06 0l2.25 2.25a.75.75 0 010 1.06l-2.25 2.25a.75.75 0 01-1.06-1.06L6.94 10.25 5.22 8.53a.75.75 0 010-1.06zM10 12.25a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>
  )
  if (toolName === 'Read') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill={f}><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
  )
  if (toolName === 'Write') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill={f}><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg>
  )
  if (toolName === 'Edit') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill={f}><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>
  )
  if (toolName === 'Grep' || toolName === 'Glob') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill={f}><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" /></svg>
  )
  if (toolName === 'WebFetch' || toolName === 'WebSearch') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill={f}><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-1.503.204A6.5 6.5 0 117.95 3.83L6.927 6.422A1.75 1.75 0 006.743 8.5H4.25a.75.75 0 00-.75.75v1.5c0 .414.336.75.75.75h1.374a1.75 1.75 0 011.673 1.239l.346 1.133A6.474 6.474 0 0010 16.5a6.48 6.48 0 004.763-2.084l-.36-.325A1.75 1.75 0 0113.225 12h-.94a.75.75 0 01-.748-.688l-.173-2.074a1.75 1.75 0 011.057-1.748l2.076-.876z" clipRule="evenodd" /></svg>
  )
  // default → wrench
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill={f}><path fillRule="evenodd" d="M13.488 2.513a1.75 1.75 0 00-2.55.138l-1.093 1.312a1.75 1.75 0 00-.376 1.372l.217 1.302-4.262 4.262a1.75 1.75 0 000 2.474l.707.708a1.75 1.75 0 002.474 0l4.262-4.262 1.302.217a1.75 1.75 0 001.372-.376l1.312-1.093a1.75 1.75 0 00.138-2.55l-3.503-3.503z" clipRule="evenodd" /></svg>
  )
}

// ─── Tool Call Pill ──────────────────────────────────────────────────────────
// Compact Manimate-style rounded pill — inline expandable

function ToolCallPill({ msg, result, isRunning }: { msg: ChatMessage; result?: ChatMessage; isRunning: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const isDone = !!result
  const isError = result?.is_error

  const summary = getToolSummary(msg.tool_name, msg.tool_input)
  const inputStr = msg.tool_input ? JSON.stringify(msg.tool_input, null, 2) : ''
  const hasExpandable = !!inputStr || !!(result?.content)

  return (
    <div>
      <button
        onClick={() => hasExpandable && setExpanded(!expanded)}
        style={{ cursor: hasExpandable ? 'pointer' : 'default', width: 'fit-content', maxWidth: '100%' }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-mono transition-colors
          ${isError ? 'border-red-900/60 bg-red-950/20 hover:bg-red-950/30' : 'border-[#1f1f1f] bg-[#0f0f0f] hover:bg-[#141414]'}`}
      >
        {/* Status / tool icon */}
        <span className="shrink-0 flex items-center justify-center" style={{ width: 13, height: 13,
          color: isError ? '#f87171' : isDone ? '#34d399' : isRunning ? '#818cf8' : '#52525b' }}>
          {isError ? (
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
          ) : isDone ? (
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
          ) : (
            <PillIcon toolName={msg.tool_name} />
          )}
        </span>

        {/* Action label — no tool name, just what it's doing */}
        <span className={`truncate ${isError ? 'text-red-400' : isDone ? 'text-zinc-400' : 'text-zinc-300'}`}
          style={{ maxWidth: 280 }}>
          {summary || msg.tool_name}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && hasExpandable && (
        <div className="mt-1 ml-4 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden text-[11px] font-mono">
          {inputStr && (
            <div className="px-3 py-2 border-b border-[#141414]">
              <div className="text-zinc-700 text-[10px] uppercase tracking-wider mb-1.5">Input</div>
              <ExpandedInput toolName={msg.tool_name} input={msg.tool_input} />
            </div>
          )}
          {result?.content && (
            <div className="px-3 py-2">
              <div className="text-zinc-700 text-[10px] uppercase tracking-wider mb-1.5">Output</div>
              <pre className={`overflow-x-auto max-h-44 whitespace-pre-wrap break-all leading-relaxed ${result.is_error ? 'text-red-400' : 'text-zinc-400'}`}>
                {result.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getToolSummary(name?: string, input?: Record<string, unknown>): string {
  if (!input) return ''
  if (name === 'Bash') {
    // Show command first line only — no "Bash" prefix
    return String(input.command ?? '').split('\n')[0].slice(0, 80)
  }
  if (name === 'Read') return `Reading ${String(input.file_path ?? '')}`
  if (name === 'Write') return `Writing ${String(input.file_path ?? input.path ?? '')}`
  if (name === 'Edit') return `Editing ${String(input.file_path ?? input.path ?? '')}`
  if (name === 'Grep') return `Searching ${String(input.pattern ?? '')}`
  if (name === 'Glob') return `Globbing ${String(input.pattern ?? '')}`
  if (name === 'WebFetch') return `Fetching ${String(input.url ?? '').slice(0, 60)}`
  if (name === 'WebSearch') return `Searching ${String(input.query ?? '').slice(0, 60)}`
  if (name === 'TodoWrite') {
    const todos = Array.isArray(input.todos) ? input.todos : []
    return todos.length > 0 ? `Planning ${todos.length} task${todos.length === 1 ? '' : 's'}` : 'Updating tasks'
  }
  return JSON.stringify(input).slice(0, 60)
}

function ExpandedInput({ toolName, input }: { toolName?: string; input?: Record<string, unknown> }) {
  if (!input) return null
  if (toolName === 'Bash' && input.command) {
    return (
      <div>
        <pre className="text-emerald-400/80 overflow-x-auto whitespace-pre-wrap break-all">$ {String(input.command)}</pre>
        {input.description ? <div className="mt-1 text-zinc-600 italic">{String(input.description)}</div> : null}
      </div>
    )
  }
  if ((toolName === 'Edit') && input.old_string && input.new_string) {
    return (
      <div>
        <div className="text-zinc-500 mb-1">{String(input.file_path ?? '')}</div>
        <pre className="overflow-x-auto max-h-32">
          <div className="text-red-400/80">- {String(input.old_string).slice(0, 120)}</div>
          <div className="text-emerald-400/80">+ {String(input.new_string).slice(0, 120)}</div>
        </pre>
      </div>
    )
  }
  return (
    <pre className="text-zinc-400 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
      {JSON.stringify(input, null, 2)}
    </pre>
  )
}

// ─── Tool Group Card ─────────────────────────────────────────────────────────
// Groups consecutive tool calls like Manimate's ActivityGroupCard

function ToolGroupCard({ pills, toolResults, isRunning }: {
  pills: ChatMessage[]
  toolResults: Map<string, ChatMessage>
  isRunning: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const rest = pills.slice(1)

  return (
    <div className="flex flex-col gap-1">
      {/* First pill + toggle */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <ToolCallPill
          msg={pills[0]}
          result={pills[0].tool_id ? toolResults.get(pills[0].tool_id) : undefined}
          isRunning={isRunning}
        />
        {rest.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {!expanded && <span>+{rest.length}</span>}
            <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      {/* Remaining pills */}
      {expanded && rest.map((msg) => (
        <ToolCallPill
          key={msg.id}
          msg={msg}
          result={msg.tool_id ? toolResults.get(msg.tool_id) : undefined}
          isRunning={isRunning}
        />
      ))}
    </div>
  )
}

// ─── Chat Panel ──────────────────────────────────────────────────────────────

function ChatPanel({
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

  // Build lookup: tool_id → tool_result message
  const toolResults = new Map<string, ChatMessage>()
  for (const m of messages) {
    if (m.role === 'tool_result' && m.tool_id) toolResults.set(m.tool_id, m)
  }

  // Group consecutive tool_use messages into clusters (Manimate-style)
  type RenderItem =
    | { kind: 'msg'; msg: ChatMessage }
    | { kind: 'group'; pills: ChatMessage[] }

  const renderItems: RenderItem[] = []
  let currentGroup: ChatMessage[] = []
  const flushGroup = () => {
    if (currentGroup.length > 0) {
      renderItems.push({ kind: 'group', pills: [...currentGroup] })
      currentGroup = []
    }
  }
  for (const msg of messages) {
    if (msg.role === 'tool_result') continue
    if (msg.role === 'tool_use') { currentGroup.push(msg); continue }
    flushGroup()
    renderItems.push({ kind: 'msg', msg })
  }
  flushGroup()

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
    >
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-20">
          <div className="text-4xl mb-2">⚡</div>
          <p className="text-zinc-400 text-sm font-medium">Attach a video and describe the workflow</p>
          <p className="text-zinc-600 text-xs max-w-xs">
            Claude will extract keyframes, analyze each one, and generate a replayable SKILL.md
          </p>
          <div className="mt-4 space-y-1.5">
            {[
              'use /video-frame-reader on this and create SKILL.md',
              'step 3 is wrong — the user clicked Login not Sign Up',
              'replay the workflow',
            ].map((ex) => (
              <div key={ex} className="text-[11px] text-zinc-600 font-mono bg-[#0f0f0f] border border-[#1f1f1f] rounded px-2 py-1">
                {ex}
              </div>
            ))}
          </div>
        </div>
      )}

      {renderItems.map((item, idx) => {
        if (item.kind === 'group') {
          return (
            <div key={`grp-${idx}`} className="animate-slide-up">
              <ToolGroupCard pills={item.pills} toolResults={toolResults} isRunning={isRunning} />
            </div>
          )
        }

        const msg = item.msg

        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex justify-end animate-slide-up">
              <div className="max-w-[85%] bg-indigo-600/20 border border-indigo-500/30 rounded-xl rounded-br-sm px-3.5 py-2.5">
                {msg.video_name && (
                  <div className="flex items-center gap-1.5 mb-2 text-indigo-300 text-xs font-mono">
                    <IconVideo className="w-3.5 h-3.5" />
                    {msg.video_name}
                  </div>
                )}
                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          )
        }

        // assistant
        return (
          <div key={msg.id} className="animate-slide-up">
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {msg.content}
              {isRunning && msg.id === lastAssistantId && (
                <span className="inline-block w-[2px] h-4 bg-indigo-400 ml-0.5 animate-[pulseDot_1s_ease-in-out_infinite] align-middle" />
              )}
            </div>
          </div>
        )
      })}

      {isRunning && messages.length > 0 && messages.at(-1)?.role !== 'assistant' && (
        <div className="flex gap-1.5 items-center text-zinc-600 text-xs animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-[pulseDot_1.5s_0s_infinite]" />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-[pulseDot_1.5s_0.3s_infinite]" />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-[pulseDot_1.5s_0.6s_infinite]" />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

// ─── Preview Panel ────────────────────────────────────────────────────────────

function PreviewPanel({ content }: { content: string | null }) {
  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-8">
        <div className="text-5xl mb-2 opacity-30">📄</div>
        <p className="text-zinc-500 text-sm">SKILL.md will appear here</p>
        <p className="text-zinc-700 text-xs">
          Generated as Claude analyzes your recording
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5">
      <div className="prose-skillforge">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  )
}

// ─── Chat Input ───────────────────────────────────────────────────────────────

function ChatInput({
  onSend,
  onStop,
  isRunning,
  sessionId,
  onVideoUploaded,
  attachedVideo,
  onClearVideo,
}: {
  onSend: (prompt: string) => void
  onStop: () => void
  isRunning: boolean
  sessionId: string
  onVideoUploaded: (path: string, name: string) => void
  attachedVideo: { path: string; name: string } | null
  onClearVideo: () => void
}) {
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [text])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || isRunning) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('video/')) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('session_id', sessionId)
      const res = await fetch('/api/chat/uploads', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.path) onVideoUploaded(data.path, data.name)
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const onDragOver = (e: React.DragEvent) => e.preventDefault()

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="input-glow rounded-xl border border-[#262626] bg-[#0f0f0f] transition-all"
      >
        {/* Attached video badge */}
        {attachedVideo && (
          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
            <div className="flex items-center gap-1.5 bg-indigo-950/60 border border-indigo-800/40 rounded-md px-2 py-1 text-xs text-indigo-300 font-mono">
              <IconVideo className="w-3 h-3" />
              <span className="max-w-[200px] truncate">{attachedVideo.name}</span>
              <button onClick={onClearVideo} className="ml-1 text-indigo-500 hover:text-indigo-300">
                <IconX className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2 px-3 py-2.5">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-[#1f1f1f] transition-colors disabled:opacity-40"
            title="Attach video"
          >
            {uploading
              ? <span className="block w-4 h-4 border-2 border-zinc-600 border-t-indigo-400 rounded-full animate-spin" />
              : <IconPaperclip className="w-4 h-4" />
            }
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mov,.mp4,.webm,.avi"
            onChange={onFileChange}
            className="hidden"
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachedVideo
              ? 'use /video-frame-reader on this and create SKILL.md'
              : 'Type a prompt, or drag a video here…'
            }
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none leading-relaxed py-0.5"
          />

          {/* Send / Stop */}
          {isRunning ? (
            <button
              onClick={onStop}
              className="shrink-0 p-2 rounded-lg bg-red-600/20 border border-red-600/30 text-red-400 hover:bg-red-600/30 transition-colors"
              title="Stop"
            >
              <IconStop className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="shrink-0 p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Send"
            >
              <IconSend className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <p className="text-center text-zinc-700 text-[10px] mt-2">
        Enter to send · Shift+Enter for newline · Drag video to attach
      </p>
    </div>
  )
}

// ─── Session Sidebar ──────────────────────────────────────────────────────────

function SessionSidebar({
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
    <div className="w-56 shrink-0 border-r border-[#1a1a1a] flex flex-col bg-[#080808]">
      <div className="px-3 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Sessions</span>
        <button
          onClick={onNew}
          className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-[#1f1f1f] transition-colors"
          title="New session"
        >
          <IconPlus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 && (
          <p className="px-3 py-4 text-xs text-zinc-700 text-center">No sessions yet</p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
              s.id === activeId
                ? 'bg-indigo-600/15 text-indigo-300 border-l-2 border-indigo-500'
                : 'text-zinc-400 hover:bg-[#0f0f0f] hover:text-zinc-200 border-l-2 border-transparent'
            }`}
          >
            <div className="font-mono truncate">{s.id.slice(0, 8)}…</div>
            <div className="text-zinc-600 text-[10px] mt-0.5">
              {new Date(s.created_at).toLocaleTimeString()}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function SkillForge() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [skillContent, setSkillContent] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [attachedVideo, setAttachedVideo] = useState<{ path: string; name: string } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [splitPos, setSplitPos] = useState(45) // left panel %
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  // Fix #1: generation counter so old stream finally-block doesn't stomp new stream state
  const streamGenRef = useRef(0)
  // Fix #3: container ref for correct divider math
  const bodyRef = useRef<HTMLDivElement>(null)
  // Always-current messages ref so callbacks can read latest messages without stale closure
  const messagesRef = useRef<ChatMessage[]>([])

  // Keep messagesRef in sync with state
  useEffect(() => { messagesRef.current = messages }, [messages])

  // ── Session init ────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('session')
    if (sid) {
      setActiveSessionId(sid)
      fetchSessions()
      loadSessionMessages(sid)
      fetchSkillMd(sid)
    } else {
      createNewSession()
    }
  }, [])

  const fetchSessions = async () => {
    const res = await fetch('/api/sessions')
    const data: Session[] = await res.json()
    setSessions(data)
  }

  const loadSessionMessages = async (sid: string) => {
    const res = await fetch(`/api/sessions/${sid}`)
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data.messages) && data.messages.length > 0) {
      setMessages(data.messages)
    }
  }

  const createNewSession = async () => {
    if (isRunning) return undefined // Fix #2: guard during active run
    const res = await fetch('/api/sessions', { method: 'POST' })
    const session: Session = await res.json()
    // Load all sessions, then prepend the new one so the sidebar is fully populated
    const allRes = await fetch('/api/sessions')
    const allData: Session[] = await allRes.json()
    setSessions(allData)
    setActiveSessionId(session.id)
    setMessages([])
    setSkillContent(null)
    setAttachedVideo(null)
    const url = new URL(window.location.href)
    url.searchParams.set('session', session.id)
    window.history.pushState({}, '', url)
    return session.id
  }

  const switchSession = async (id: string) => {
    if (isRunning) return
    setActiveSessionId(id)
    setMessages([])
    setSkillContent(null)
    setAttachedVideo(null)
    const url = new URL(window.location.href)
    url.searchParams.set('session', id)
    window.history.pushState({}, '', url)
    await loadSessionMessages(id)
    // Also restore SKILL.md if present
    fetchSkillMd(id)
  }

  // ── Fetch SKILL.md ────────────────────────────────────────────────────
  const fetchSkillMd = useCallback(async (sid: string) => {
    const res = await fetch(`/api/files?session_id=${sid}&path=SKILL.md`)
    const data = await res.json()
    if (data.content) setSkillContent(data.content)
  }, [])

  // ── SSE consumption ────────────────────────────────────────────────────
  const consumeSSE = useCallback(async (response: Response, sessionId: string) => {
    // Fix #1: claim this generation; only the owner clears state on close
    const myGen = ++streamGenRef.current
    const reader = response.body!.getReader()
    readerRef.current = reader
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event: SSEEvent
          try {
            event = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          handleSSEEvent(event, sessionId)
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        addMessage({
          role: 'assistant',
          content: `Error: ${err.message}`,
        })
      }
    } finally {
      // Only reset state if we are still the active stream
      if (streamGenRef.current === myGen) {
        setIsRunning(false)
        readerRef.current = null
        // Persist messages to server so they survive page reload
        void fetch(`/api/sessions/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messagesRef.current }),
        })
      }
    }
  }, [])

  const handleSSEEvent = useCallback((event: SSEEvent, sessionId: string) => {
    switch (event.type) {
      case 'system_init':
        // No UI update needed
        break

      case 'assistant_text':
        setMessages((prev) => {
          const last = prev.at(-1)
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + event.message }]
          }
          return [...prev, mkMsg({ role: 'assistant', content: event.message })]
        })
        break

      case 'tool_use':
        addMessage({
          role: 'tool_use',
          content: '',
          tool_name: event.tool_name,
          tool_id: event.id,
          tool_input: event.tool_input,
        })
        break

      case 'tool_result':
        addMessage({
          role: 'tool_result',
          content: event.content,
          tool_id: event.tool_use_id,
          is_error: event.is_error,
        })
        break

      case 'skill_written':
        // Fetch the latest SKILL.md
        fetchSkillMd(sessionId)
        break

      case 'complete':
        setIsRunning(false)
        // Final fetch in case SKILL.md was written near the end
        fetchSkillMd(sessionId)
        break

      case 'error':
        addMessage({ role: 'assistant', content: `⚠ ${event.message}` })
        setIsRunning(false)
        break
    }
  }, [fetchSkillMd])

  const addMessage = (partial: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [...prev, mkMsg(partial)])
  }

  // ── Send ──────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (prompt: string) => {
    if (isRunning) return
    let sid = activeSessionId
    if (!sid) sid = (await createNewSession()) ?? ''
    if (!sid) return

    // Add user message and immediately persist (survives cancel)
    const userMsg = mkMsg({ role: 'user', content: prompt, video_name: attachedVideo?.name })
    setMessages((prev) => {
      const next = [...prev, userMsg]
      messagesRef.current = next
      void fetch(`/api/sessions/${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      return next
    })

    setIsRunning(true)

    const body: Record<string, unknown> = { session_id: sid, prompt }
    if (attachedVideo) body.video_path = attachedVideo.path

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        addMessage({ role: 'assistant', content: `Error: ${err.error}` })
        setIsRunning(false)
        return
      }

      await consumeSSE(res, sid)
    } catch (err: unknown) {
      addMessage({ role: 'assistant', content: `Failed to connect: ${err instanceof Error ? err.message : 'Unknown'}` })
      setIsRunning(false)
    }
  }, [isRunning, activeSessionId, attachedVideo, consumeSSE])

  const handleStop = async () => {
    if (readerRef.current) {
      try { await readerRef.current.cancel() } catch { /* noop */ }
    }
    await fetch('/api/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: activeSessionId }),
    })
    setIsRunning(false)
  }

  // ── Draggable divider ─────────────────────────────────────────────────
  const dragging = useRef(false)

  const onDividerMouseDown = () => {
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      // Fix #3: use the body container's bounding box so sidebar offset is excluded
      const container = bodyRef.current
      const rect = container?.getBoundingClientRect()
      const containerLeft = rect?.left ?? 0
      const containerWidth = rect?.width ?? window.innerWidth
      const pct = ((e.clientX - containerLeft) / containerWidth) * 100
      setSplitPos(Math.max(25, Math.min(75, pct)))
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#080808] text-zinc-200">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 h-11 border-b border-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">S</div>
          <span className="font-semibold text-sm text-zinc-100">SkillForge</span>
        </div>
        <div className="flex-1" />
        <div className="text-xs text-zinc-600 font-mono">
          {activeSessionId ? activeSessionId.slice(0, 8) : '—'}
        </div>
        <button
          onClick={createNewSession}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 border border-[#1f1f1f] hover:border-[#2f2f2f] hover:bg-[#111] transition-colors"
        >
          <IconPlus className="w-3 h-3" />
          New session
        </button>
      </header>

      {/* Body — ref used for correct divider coordinate math */}
      <div ref={bodyRef} className="flex flex-1 min-h-0">
        {/* Sidebar */}
        {sidebarOpen && (
          <SessionSidebar
            sessions={sessions}
            activeId={activeSessionId}
            onSelect={switchSession}
            onNew={createNewSession}
          />
        )}

        {/* Left panel */}
        <div
          className="flex flex-col min-h-0 border-r border-[#1a1a1a]"
          style={{ width: `${splitPos}%` }}
        >
          {/* Panel header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1a1a1a] shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
            <span className="text-xs text-zinc-500 font-medium">Claude Code</span>
            {isRunning && (
              <span className="text-xs text-indigo-400 animate-pulse">running…</span>
            )}
          </div>

          <ChatPanel messages={messages} isRunning={isRunning} />

          <ChatInput
            onSend={handleSend}
            onStop={handleStop}
            isRunning={isRunning}
            sessionId={activeSessionId}
            onVideoUploaded={(path, name) => setAttachedVideo({ path, name })}
            attachedVideo={attachedVideo}
            onClearVideo={() => setAttachedVideo(null)}
          />
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={onDividerMouseDown}
          className="w-1 shrink-0 cursor-col-resize hover:bg-indigo-600/30 transition-colors"
        />

        {/* Right panel */}
        <div
          className="flex flex-col min-h-0 flex-1"
        >
          {/* Panel header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1a1a1a] shrink-0">
            <div className="w-2 h-2 rounded-full bg-violet-500/60" />
            <span className="text-xs text-zinc-500 font-medium">SKILL.md</span>
            {skillContent && (
              <span className="ml-auto text-[10px] text-zinc-700 font-mono">
                {skillContent.split('\n').length} lines
              </span>
            )}
          </div>

          <PreviewPanel content={skillContent} />
        </div>
      </div>
    </div>
  )
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function mkMsg(partial: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
  return { id: uuidv4(), timestamp: Date.now(), ...partial }
}
