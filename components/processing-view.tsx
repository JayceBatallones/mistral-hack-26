'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { ChatPanel } from '@/components/chat-panel'
import { ChatInput } from '@/components/chat-input'
import { SessionSidebar } from '@/components/session-sidebar'
import { WorkflowNodes } from '@/components/workflow-nodes'
import { useViewMode } from '@/lib/view-mode-context'
import { parseSkillMd } from '@/lib/parse-skill-md'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { MessageSquareOff } from 'lucide-react'
import type { ChatMessage, Session, SSEEvent, WorkflowStep } from '@/lib/types'

function mkMsg(partial: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
  return { id: uuidv4(), timestamp: Date.now(), ...partial }
}

interface ProcessingViewProps {
  sessionId?: string
}

export function ProcessingView({ sessionId: propSessionId }: ProcessingViewProps = {}) {
  const searchParams = useSearchParams()
  const initialSessionId = propSessionId || searchParams.get('session') || ''
  const initialVideoPath = searchParams.get('video_path') ?? ''
  const initialVideoName = searchParams.get('video_name') ?? ''
  const autoStart = searchParams.get('auto_start') === 'true'
  const pathname = usePathname()
  const router = useRouter()
  const isSkillsRoute = pathname.startsWith('/skills/')

  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>(initialSessionId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [skillContent, setSkillContent] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [attachedVideo, setAttachedVideo] = useState<{ path: string; name: string } | null>(null)
  const videoInitializedRef = useRef(false)
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([])
  const [activeStepIndex, setActiveStepIndex] = useState(-1)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [workflowFullscreen, setWorkflowFullscreen] = useState(false)
  const [stepStatuses, setStepStatuses] = useState<Record<number, 'success' | 'error'>>({})
  const activeStepIndexRef = useRef(-1)

  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const streamGenRef = useRef(0)
  const messagesRef = useRef<ChatMessage[]>([])
  const autoStartedRef = useRef(false)
  const handleSSEEventRef = useRef<(event: SSEEvent, sessionId: string) => void>(() => {})
  const pendingSkillWriteIds = useRef<Set<string>>(new Set())

  const { setHasMarkdown } = useViewMode()

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { activeStepIndexRef.current = activeStepIndex }, [activeStepIndex])

  // Sync attachedVideo from URL params — useSearchParams inside Suspense may
  // return empty on the first render, so useState initializer is unreliable.
  useEffect(() => {
    if (!videoInitializedRef.current && initialVideoPath) {
      videoInitializedRef.current = true
      setAttachedVideo({ path: initialVideoPath, name: initialVideoName })
    }
  }, [initialVideoPath, initialVideoName])

  // Update workflow steps when skill content changes
  useEffect(() => {
    if (skillContent) {
      const steps = parseSkillMd(skillContent)
      setWorkflowSteps(steps)
      setHasMarkdown(true)
    }
  }, [skillContent, setHasMarkdown])

  // ── Session init & sync when propSessionId changes (e.g. navigating between /skills/abc and /skills/def)
  const prevPropSessionId = useRef(propSessionId)
  useEffect(() => {
    fetchSessions()
    if (initialSessionId) {
      loadSessionMessages(initialSessionId)
      fetchSkillMd(initialSessionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (propSessionId && propSessionId !== prevPropSessionId.current) {
      prevPropSessionId.current = propSessionId
      setActiveSessionId(propSessionId)
      setMessages([])
      setSkillContent(null)
      setWorkflowSteps([])
      setActiveStepIndex(-1)
      setStepStatuses({})
      setAttachedVideo(null)
      autoStartedRef.current = false
      loadSessionMessages(propSessionId)
      fetchSkillMd(propSessionId)
      fetchSessions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propSessionId])

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
    // Restore video attachment from session metadata
    if (data.video_path && data.video_name) {
      setAttachedVideo({ path: data.video_path, name: data.video_name })
    }
  }

  const createNewSession = async () => {
    if (isRunning) return undefined
    const res = await fetch('/api/sessions', { method: 'POST' })
    const session: Session = await res.json()
    const allRes = await fetch('/api/sessions')
    const allData: Session[] = await allRes.json()
    setSessions(allData)
    setActiveSessionId(session.id)
    setMessages([])
    setSkillContent(null)
    setAttachedVideo(null)
    setWorkflowSteps([])
    setActiveStepIndex(-1)
    setStepStatuses({})
    setHasMarkdown(false)
    if (isSkillsRoute) {
      router.push(`/skills/${session.id}`)
    } else {
      const url = new URL(window.location.href)
      url.searchParams.set('session', session.id)
      url.searchParams.delete('video_path')
      url.searchParams.delete('video_name')
      window.history.pushState({}, '', url)
    }
    return session.id
  }

  const switchSession = async (id: string) => {
    if (isRunning) return
    setActiveSessionId(id)
    setMessages([])
    setSkillContent(null)
    setAttachedVideo(null)
    setWorkflowSteps([])
    setActiveStepIndex(-1)
    setStepStatuses({})
    setHasMarkdown(false)
    if (isSkillsRoute) {
      router.push(`/skills/${id}`)
    } else {
      const url = new URL(window.location.href)
      url.searchParams.set('session', id)
      url.searchParams.delete('video_path')
      url.searchParams.delete('video_name')
      window.history.pushState({}, '', url)
    }
    await loadSessionMessages(id)
    fetchSkillMd(id)
  }

  // ── Fetch SKILL.md
  const fetchSkillMd = useCallback(async (sid: string) => {
    const res = await fetch(`/api/files?session_id=${sid}&path=SKILL.md`)
    const data = await res.json()
    if (data.content) setSkillContent(data.content)
  }, [])

  // ── SSE consumption
  const consumeSSE = useCallback(async (response: Response, sessionId: string) => {
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

          handleSSEEventRef.current(event, sessionId)
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
      if (streamGenRef.current === myGen) {
        setIsRunning(false)
        readerRef.current = null
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
        break

      case 'assistant_text':
        setMessages((prev) => {
          const last = prev.at(-1)
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + event.message }]
          }
          return [...prev, mkMsg({ role: 'assistant', content: event.message })]
        })
        // Track active step from "Step N" mentions
        {
          const stepMatch = event.message.match(/[Ss]tep\s+(\d+)/)
          if (stepMatch) {
            const newIdx = parseInt(stepMatch[1]) - 1
            const prevIdx = activeStepIndexRef.current
            // Mark all previous steps as success when advancing
            if (newIdx > prevIdx) {
              setStepStatuses(prev => {
                const next = { ...prev }
                for (let i = Math.max(0, prevIdx); i < newIdx; i++) {
                  if (!next[i]) next[i] = 'success'
                }
                return next
              })
            }
            setActiveStepIndex(newIdx)
          }
        }
        break

      case 'tool_use':
        addMessage({
          role: 'tool_use',
          content: '',
          tool_name: event.tool_name,
          tool_id: event.id,
          tool_input: event.tool_input,
        })
        // Track Write/Edit calls targeting SKILL.md so we can refetch on result
        if (event.tool_name === 'Write' || event.tool_name === 'Edit') {
          const fp = String(event.tool_input?.file_path ?? event.tool_input?.path ?? '')
          if (fp.includes('SKILL.md')) {
            pendingSkillWriteIds.current.add(event.id)
          }
        }
        break

      case 'tool_result':
        addMessage({
          role: 'tool_result',
          content: event.content,
          tool_id: event.tool_use_id,
          is_error: event.is_error,
        })
        // Mark current step as error if tool_result has is_error
        if (event.is_error && activeStepIndexRef.current >= 0) {
          setStepStatuses(prev => ({ ...prev, [activeStepIndexRef.current]: 'error' }))
        }
        // Refetch SKILL.md once the write/edit has actually completed
        if (pendingSkillWriteIds.current.has(event.tool_use_id)) {
          pendingSkillWriteIds.current.delete(event.tool_use_id)
          fetchSkillMd(sessionId)
        }
        break

      case 'skill_written':
        // The file may not be on disk yet (fires on tool_use, not tool_result).
        // We still try, but the real update comes from the tool_result handler above.
        fetchSkillMd(sessionId)
        break

      case 'complete':
        // Mark the final step as success if not already error
        if (activeStepIndexRef.current >= 0) {
          setStepStatuses(prev => {
            const idx = activeStepIndexRef.current
            if (!prev[idx]) return { ...prev, [idx]: 'success' }
            return prev
          })
        }
        setIsRunning(false)
        fetchSkillMd(sessionId)
        break

      case 'error':
        addMessage({ role: 'assistant', content: `⚠ ${event.message}` })
        setIsRunning(false)
        break
    }
  }, [fetchSkillMd])

  // Keep the ref in sync so consumeSSE always calls the latest version
  handleSSEEventRef.current = handleSSEEvent

  const addMessage = (partial: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [...prev, mkMsg(partial)])
  }

  // ── Send
  const handleSend = useCallback(async (prompt: string) => {
    if (isRunning) return
    let sid = activeSessionId
    if (!sid) sid = (await createNewSession()) ?? ''
    if (!sid) return

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

  // Auto-start: send immediately when redirected from upload with a video
  useEffect(() => {
    if (!autoStart || !attachedVideo || !activeSessionId || autoStartedRef.current) return
    autoStartedRef.current = true
    // Clear auto_start from URL to prevent re-triggering on refresh
    const url = new URL(window.location.href)
    url.searchParams.delete('auto_start')
    window.history.replaceState({}, '', url)
    handleSend('Use /video-frame-reader to analyze the attached video and generate a SKILL.md')
  }, [autoStart, attachedVideo, activeSessionId, handleSend])

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

  const handleRunWorkflow = useCallback(() => {
    if (isRunning || !skillContent) return
    setActiveStepIndex(0)
    setStepStatuses({})
    handleSend('Run the workflow defined in SKILL.md using /browser-tools')
  }, [isRunning, skillContent, handleSend])

  const handleToggleFullscreen = useCallback(() => {
    setWorkflowFullscreen(prev => {
      if (!prev) {
        setSidebarOpen(false)
        setChatOpen(false)
      } else {
        setSidebarOpen(true)
        setChatOpen(true)
      }
      return !prev
    })
  }, [])

  const renderRightPanel = () => (
    <WorkflowNodes
      steps={workflowSteps}
      activeStepIndex={activeStepIndex}
      markdown={skillContent ?? undefined}
      onRun={skillContent ? handleRunWorkflow : undefined}
      isRunning={isRunning}
      onStop={handleStop}
      stepStatuses={stepStatuses}
      isFullscreen={workflowFullscreen}
      onToggleFullscreen={handleToggleFullscreen}
    />
  )

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      {sidebarOpen && (
        <SessionSidebar
          sessions={sessions}
          activeId={activeSessionId}
          onSelect={switchSession}
          onNew={createNewSession}
          onCollapse={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {chatOpen && (
          <>
            <ResizablePanel defaultSize={45} minSize={25}>
              <div className="flex flex-col h-full">
                {/* Panel header */}
                <div className="flex items-center gap-2 px-4 h-10 border-b border-border shrink-0">
                  <div className="w-2 h-2 rounded-full bg-node-verify/60" />
                  <span className="text-xs text-muted-foreground font-medium">Mimi</span>
                  {isRunning && (
                    <span className="text-xs text-primary animate-pulse">running…</span>
                  )}
                  <button
                    onClick={() => setChatOpen(false)}
                    className="ml-auto p-1 rounded hover:bg-secondary transition-colors"
                    title="Hide chat panel"
                  >
                    <MessageSquareOff className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
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
            </ResizablePanel>

            <ResizableHandle withHandle />
          </>
        )}

        <ResizablePanel defaultSize={chatOpen ? 55 : 100} minSize={25}>
          <div className="flex-1 min-h-0 h-full">
            {renderRightPanel()}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
