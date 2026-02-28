"use client"

import { useState, useEffect, useCallback } from "react"
import { WorkflowNodes } from "@/components/workflow-nodes"
import { ChatPanel } from "@/components/chat-panel"
import { parseSkillMd } from "@/lib/parse-skill-md"
import { useViewMode } from "@/lib/view-mode-context"
import {
  CheckCircle2,
  ArrowLeft,
  Play,
  RotateCcw,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { ChatMessage, WorkflowStep } from "@/lib/types"
import Link from "next/link"

interface SkillDetailContainerProps {
  sessionId: string
}

export function SkillDetailContainer({ sessionId }: SkillDetailContainerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [skillContent, setSkillContent] = useState<string | null>(null)
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([])
  const [skillTitle, setSkillTitle] = useState<string>('')
  const [activeStepIndex, setActiveStepIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [loading, setLoading] = useState(true)

  const { setHasMarkdown } = useViewMode()

  // Load session data
  useEffect(() => {
    const load = async () => {
      try {
        const [msgRes, fileRes] = await Promise.all([
          fetch(`/api/sessions/${sessionId}`),
          fetch(`/api/files?session_id=${sessionId}&path=SKILL.md`),
        ])

        if (msgRes.ok) {
          const data = await msgRes.json()
          if (Array.isArray(data.messages)) {
            setMessages(data.messages)
          }
        }

        const fileData = await fileRes.json()
        if (fileData.content) {
          setSkillContent(fileData.content)
          const steps = parseSkillMd(fileData.content)
          setWorkflowSteps(steps)
          setHasMarkdown(true)
          // Extract title
          const titleMatch = fileData.content.match(/^#\s+(.+)/m)
          if (titleMatch) setSkillTitle(titleMatch[1].trim())
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId, setHasMarkdown])

  // Build log-to-step map
  const logToStepMap = useCallback(() => {
    const map: number[] = []
    let currentStep = 0
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.role === 'assistant') {
        const match = msg.content.match(/[Ss]tep\s+(\d+)/)
        if (match) {
          currentStep = parseInt(match[1]) - 1
        }
      }
      map.push(Math.min(currentStep, workflowSteps.length - 1))
    }
    return map
  }, [messages, workflowSteps.length])

  // Playback animation
  useEffect(() => {
    if (!isPlaying || messages.length === 0) return

    const stepMap = logToStepMap()
    let logIndex = isComplete ? 0 : 0 // Always start from beginning for replay
    const totalLogs = messages.length

    // Reset for replay
    if (isComplete) {
      setIsComplete(false)
    }

    const interval = setInterval(() => {
      if (logIndex < totalLogs) {
        logIndex++
        setActiveStepIndex(stepMap[logIndex - 1] ?? 0)
      } else {
        setIsComplete(true)
        setActiveStepIndex(workflowSteps.length)
        setIsPlaying(false)
        clearInterval(interval)
      }
    }, 150)

    return () => clearInterval(interval)
  }, [isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlay = () => {
    if (isComplete) {
      setActiveStepIndex(-1)
      setIsComplete(false)
    }
    setHasStarted(true)
    setIsPlaying(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <span className="text-muted-foreground text-sm">Loading skill…</span>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Detail header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/skills">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-node-verify" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">
                {skillTitle || `Session ${sessionId.slice(0, 8)}…`}
              </h1>
              <p className="text-xs text-muted-foreground">
                {workflowSteps.length} steps · {messages.length} messages
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasStarted && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{
                    width: `${isComplete ? 100 : ((activeStepIndex + 1) / workflowSteps.length) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {isComplete
                  ? "100%"
                  : `${Math.round(((activeStepIndex + 1) / workflowSteps.length) * 100)}%`}
              </span>
            </div>
          )}

          <Button
            size="sm"
            onClick={handlePlay}
            disabled={isPlaying || workflowSteps.length === 0}
            className="gap-1.5 text-xs"
          >
            {isComplete ? (
              <>
                <RotateCcw className="h-3 w-3" />
                Replay
              </>
            ) : isPlaying ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Running
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                {hasStarted ? "Resume" : "Run Trace"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main content - 2 column layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
              <div className="w-2 h-2 rounded-full bg-node-verify/60" />
              <span className="text-xs text-muted-foreground font-medium">Chat History</span>
            </div>
            <ChatPanel messages={messages} isRunning={false} />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={30}>
          <WorkflowNodes
            steps={workflowSteps}
            activeStepIndex={hasStarted ? activeStepIndex : -1}
            markdown={skillContent ?? undefined}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
