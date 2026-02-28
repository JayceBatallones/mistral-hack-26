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

// ─── Tool Call Pill ─────────────────────────────────────────────────────────

function ToolCallPill({ msg, result, isRunning }: { msg: ChatMessage; result?: ChatMessage; isRunning: boolean }) {
  const [open, setOpen] = useState(false)

  const statusIcon = result
    ? result.is_error
      ? <span className="text-red-400">✗</span>
      : <span className="text-emerald-400">✓</span>
    : isRunning
      ? <span className="flex gap-0.5 items-center">
          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-[pulseDot_1.5s_ease-in-out_0s_infinite]" />
          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-[pulseDot_1.5s_ease-in-out_0.3s_infinite]" />
          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-[pulseDot_1.5s_ease-in-out_0.6s_infinite]" />
        </span>
      : <span className="text-zinc-600">—</span>

  const inputStr = msg.tool_input
    ? JSON.stringify(msg.tool_input, null, 2)
    : ''

  return (
    <div className="tool-pill rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] overflow-hidden text-xs font-mono">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[#161616] transition-colors"
      >
        <IconChevron className="w-3 h-3 text-zinc-500 shrink-0" open={open} />
        <span className="text-indigo-400 font-medium shrink-0">{msg.tool_name}</span>
        <span className="text-zinc-500 truncate flex-1 text-left">
          {formatToolSummary(msg.tool_name, msg.tool_input)}
        </span>
        <span className="shrink-0">{statusIcon}</span>
      </button>

      {open && (
        <div className="border-t border-[#1a1a1a]">
          {inputStr && (
            <div className="px-3 py-2 border-b border-[#1a1a1a]">
              <div className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1">Input</div>
              <pre className="text-zinc-300 text-[11px] overflow-x-auto max-h-40 whitespace-pre-wrap break-all">{inputStr}</pre>
            </div>
          )}
          {result && (
            <div className="px-3 py-2">
              <div className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1">Output</div>
              <pre className={`text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap break-all ${result.is_error ? 'text-red-400' : 'text-zinc-300'}`}>
                {result.content || '(no output)'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatToolSummary(name?: string, input?: Record<string, unknown>): string {
  if (!input) return ''
  if (name === 'Bash') return String(input.command ?? '').slice(0, 60)
  if (name === 'Write' || name === 'Edit') return String(input.file_path ?? input.path ?? '')
  if (name === 'Read') return String(input.file_path ?? '')
  return JSON.stringify(input).slice(0, 60)
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

  // Fix #4: compute once, O(n) instead of O(n²) inside map
  const lastAssistantId = messages.findLast((m) => m.role === 'assistant')?.id

  // Group messages to associate tool_use with their tool_result
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

      {messages.map((msg) => {
        if (msg.role === 'tool_result') return null // rendered inline with tool_use

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
              {/* Fix #4: lastAssistantId computed once outside the map */}
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
