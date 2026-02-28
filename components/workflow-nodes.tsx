"use client"

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type PointerEvent as RPointer,
} from "react"
import {
  Globe,
  MousePointerClick,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  CircleCheck,
  RotateCcw,
  Eye,
  FileCode,
  Play as PlayIcon,
  Square,
  Download,
  XCircle,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { WorkflowStep, StepStatus } from "@/lib/types"
import { MarkdownViewer } from "@/components/markdown-viewer"

/* ── icon / color lookups ── */
const typeIcon: Record<WorkflowStep["type"], typeof Globe> = {
  navigate: Globe, action: MousePointerClick, wait: Clock, verify: CheckCircle2, error: AlertTriangle,
}
const typeColor: Record<WorkflowStep["type"], { bg: string; border: string; text: string; iconBg: string }> = {
  navigate: { bg: "bg-node-navigate/10", border: "border-node-navigate/30", text: "text-node-navigate", iconBg: "bg-node-navigate/20" },
  action:   { bg: "bg-node-action/10",   border: "border-node-action/30",   text: "text-node-action",   iconBg: "bg-node-action/20" },
  wait:     { bg: "bg-node-wait/10",     border: "border-node-wait/30",     text: "text-node-wait",     iconBg: "bg-node-wait/20" },
  verify:   { bg: "bg-node-verify/10",   border: "border-node-verify/30",   text: "text-node-verify",   iconBg: "bg-node-verify/20" },
  error:    { bg: "bg-node-error/10",    border: "border-node-error/30",    text: "text-node-error",    iconBg: "bg-node-error/20" },
}
function getIcon(s: WorkflowStep) { return typeIcon[s.type] ?? Globe }

/* ── known brand logos ── */
const BRAND_LOGOS: Record<string, string> = {
  Notion: "/logos/notion.svg",
}

const BRAND_DOMAINS: Record<string, string> = {
  Stripe: "stripe.com",
  Google: "google.com",
  GitHub: "github.com",
  Slack: "slack.com",
  Discord: "discord.com",
  Twitter: "x.com",
  LinkedIn: "linkedin.com",
  Figma: "figma.com",
  Vercel: "vercel.com",
  Netflix: "netflix.com",
  Spotify: "spotify.com",
  Reddit: "reddit.com",
  YouTube: "youtube.com",
  Amazon: "amazon.com",
  Facebook: "facebook.com",
  Instagram: "instagram.com",
  Trello: "trello.com",
  Jira: "atlassian.com",
  Asana: "asana.com",
  Dropbox: "dropbox.com",
  Zoom: "zoom.us",
  Salesforce: "salesforce.com",
  HubSpot: "hubspot.com",
  Shopify: "shopify.com",
  Twilio: "twilio.com",
  Airtable: "airtable.com",
  Monday: "monday.com",
  Notion: "notion.so",
}

/* Build a regex that matches any known brand name (case-insensitive word boundary) */
const BRAND_NAMES = Object.keys(BRAND_DOMAINS)
const BRAND_RE = new RegExp(`(${BRAND_NAMES.join("|")})`, "g")

function getBrandLogoUrl(name: string): string {
  if (BRAND_LOGOS[name]) return BRAND_LOGOS[name]
  const domain = BRAND_DOMAINS[name]
  if (domain) return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  return ""
}

function InlineLogo({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={src}
      alt={alt}
      className="inline-block h-4 w-4 shrink-0 rounded-sm align-text-bottom"
      style={{ objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  )
}

/** Render step title with inline brand logos before each brand mention */
function TitleWithLogos({ title }: { title: string }) {
  const parts = title.split(BRAND_RE)
  if (parts.length === 1) return <>{title}</>
  return (
    <>
      {parts.map((part, i) => {
        const logoUrl = getBrandLogoUrl(part)
        if (logoUrl) {
          return (
            <span key={i} className="inline-flex items-center gap-0.5">
              <InlineLogo src={logoUrl} alt={part} />
              {part}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

/* ── types ── */
type Edge = { fromId: string; toId: string; stepIdx: number }
type Pt = { x: number; y: number }
interface PathData { d: string; active: boolean; completed: boolean; key: string }

/* ── build flat edge list from steps ── */
function buildEdges(steps: WorkflowStep[]): Edge[] {
  const edges: Edge[] = []
  for (let i = 0; i < steps.length; i++) {
    const cur = steps[i]
    const next = steps[i + 1]
    if (i === 0) {
      const ids = cur.branches?.length ? cur.branches.map(b => b.id) : [cur.id]
      ids.forEach(id => edges.push({ fromId: "__start__", toId: id, stepIdx: -1 }))
    }
    if (next) {
      const fromIds = cur.branches?.length ? cur.branches.map(b => b.id) : [cur.id]
      const toIds = next.branches?.length ? next.branches.map(b => b.id) : [next.id]
      fromIds.forEach(fid => toIds.forEach(tid => edges.push({ fromId: fid, toId: tid, stepIdx: i })))
    }
    if (i === steps.length - 1) {
      const ids = cur.branches?.length ? cur.branches.map(b => b.id) : [cur.id]
      ids.forEach(id => edges.push({ fromId: id, toId: "__end__", stepIdx: i }))
    }
  }
  return edges
}

/* ── measure anchors relative to a container ── */
function getAnchors(el: HTMLElement, container: HTMLElement): { bottom: Pt; top: Pt } {
  const er = el.getBoundingClientRect()
  const cr = container.getBoundingClientRect()
  const x = er.left - cr.left + er.width / 2
  return {
    bottom: { x, y: er.top - cr.top + er.height },
    top: { x, y: er.top - cr.top },
  }
}

/* ── smooth bezier path ── */
function buildPath(from: Pt, to: Pt): string {
  const dy = to.y - from.y
  const cp = Math.max(Math.abs(dy) * 0.45, 30)
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + cp}, ${to.x} ${to.y - cp}, ${to.x} ${to.y}`
}

/* ── drag state per node ── */
interface DragInfo { offX: number; offY: number }

/* ── main export ── */
interface WorkflowNodesProps { steps: WorkflowStep[]; activeStepIndex: number; markdown?: string; onRun?: () => void; isRunning?: boolean; onStop?: () => void; stepStatuses?: Record<number, 'success' | 'error'>; isFullscreen?: boolean; onToggleFullscreen?: () => void }

export function WorkflowNodes({ steps, activeStepIndex, markdown, onRun, isRunning, onStop, stepStatuses = {}, isFullscreen, onToggleFullscreen }: WorkflowNodesProps) {
  const [viewMode, setViewMode] = useState<"preview" | "markdown">("preview")
  const contentRef = useRef<HTMLDivElement>(null)
  const nodeElsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const [paths, setPaths] = useState<PathData[]>([])
  const edges = useMemo(() => buildEdges(steps), [steps])
  const rafRef = useRef(0)

  const [dragOffsets, setDragOffsets] = useState<Record<string, DragInfo>>({})
  const dragOffsetsRef = useRef(dragOffsets)
  dragOffsetsRef.current = dragOffsets

  const recompute = useCallback(() => {
    const content = contentRef.current
    if (!content) return
    const newPaths: PathData[] = []
    for (const edge of edges) {
      const fromEl = nodeElsRef.current[edge.fromId]
      const toEl = nodeElsRef.current[edge.toId]
      if (!fromEl || !toEl) continue
      const fromA = getAnchors(fromEl, content)
      const toA = getAnchors(toEl, content)
      const d = buildPath(fromA.bottom, toA.top)
      const active = edge.stepIdx >= 0 && edge.stepIdx === activeStepIndex
      const completed = edge.stepIdx >= 0 && edge.stepIdx < activeStepIndex
      newPaths.push({ d, active, completed, key: `${edge.fromId}-${edge.toId}` })
    }
    newPaths.forEach(p => {
      if (p.key.startsWith("__start__")) {
        if (activeStepIndex >= 0) p.completed = true
        if (activeStepIndex === 0) p.active = true
      }
    })
    setPaths(newPaths)
  }, [activeStepIndex, edges])

  const scheduleRecompute = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(recompute)
  }, [recompute])

  useEffect(() => {
    const t1 = setTimeout(recompute, 0)
    const t2 = setTimeout(recompute, 100)
    const t3 = setTimeout(recompute, 300)
    const ro = new ResizeObserver(recompute)
    if (contentRef.current) ro.observe(contentRef.current)
    window.addEventListener("resize", recompute)
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
      ro.disconnect()
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", recompute)
    }
  }, [recompute])

  useEffect(() => { recompute() }, [activeStepIndex, recompute])

  // Recompute after new steps render (DOM nodes need to exist first)
  useEffect(() => {
    if (steps.length === 0) return
    const t = setTimeout(recompute, 50)
    return () => clearTimeout(t)
  }, [steps, recompute])

  const setNodeRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    nodeElsRef.current[id] = el
  }, [])

  const handleDrag = useCallback((nodeId: string, dx: number, dy: number) => {
    const el = nodeElsRef.current[nodeId]
    if (!el) return
    const prev = dragOffsetsRef.current[nodeId] ?? { offX: 0, offY: 0 }
    const newOff = { offX: prev.offX + dx, offY: prev.offY + dy }
    dragOffsetsRef.current = { ...dragOffsetsRef.current, [nodeId]: newOff }
    el.style.transform = `translate(${newOff.offX}px, ${newOff.offY}px)`
    scheduleRecompute()
  }, [scheduleRecompute])

  const handleReset = useCallback(() => {
    Object.entries(nodeElsRef.current).forEach(([, el]) => {
      if (el) el.style.transform = ""
    })
    setDragOffsets({})
    dragOffsetsRef.current = {}
    requestAnimationFrame(recompute)
  }, [recompute])

  const displayActive = activeStepIndex < 0 ? 0 : Math.min(activeStepIndex + 1, steps.length)

  if (steps.length === 0 && !markdown) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-3 text-center px-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-35"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(42, 40, 37, 0.35) 1.2px, transparent 1.2px)",
            backgroundSize: "18px 18px",
            backgroundPosition: "0 0",
          }}
          aria-hidden="true"
        />
        <div className="grid grid-cols-10 gap-2 mb-1">
          {Array.from({ length: 50 }).map((_, i) => {
            const cols = 10
            const rows = 5
            const col = i % cols
            const row = Math.floor(i / cols)
            const t = (col / (cols - 1) + (1 - row / (rows - 1))) / 2
            const opacity = 0.2 + 0.8 * t
            return (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-[var(--color-ink-light)]"
                style={{ opacity }}
              />
            )
          })}
        </div>
        <p className="text-muted-foreground text-sm">Workflow steps will appear here</p>
        <p className="text-muted-foreground/60 text-xs">
          Generated as Claude analyzes your recording
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="relative flex items-center border-b border-border bg-background px-4 h-10 shrink-0">
        {/* left – title */}
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <h2 className="text-xs font-medium text-foreground">Workflow Steps</h2>
        </div>

        {/* centre – view toggle */}
        {markdown && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center rounded-lg border border-border bg-secondary/50 p-0.5">
            <button
              onClick={() => setViewMode("preview")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "preview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
            <button
              onClick={() => setViewMode("markdown")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "markdown"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileCode className="h-3 w-3" />
              Markdown
            </button>
          </div>
        )}

        {/* right – action buttons */}
        <div className="ml-auto flex items-center gap-3">
          {viewMode === "preview" && steps.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{displayActive} / {steps.length}</span>
              {isRunning && onStop ? (
                <button
                  onClick={onStop}
                  className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                >
                  <Square className="h-3 w-3" />
                  Stop
                </button>
              ) : onRun && (
                <button
                  onClick={onRun}
                  className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  <PlayIcon className="h-3 w-3" />
                  Run
                </button>
              )}
            </>
          )}

          {viewMode === "markdown" && markdown && (
            <button
              onClick={() => {
                const blob = new Blob([markdown], { type: "text/markdown" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "SKILL.md"
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Download className="h-3 w-3" />
              Download
            </button>
          )}
        </div>
      </div>

      {/* Markdown view */}
      {viewMode === "markdown" && markdown && (
        <div className="flex-1 overflow-auto">
          <MarkdownViewer content={markdown} />
        </div>
      )}

      {/* scrollable canvas */}
      <div className={cn("relative flex-1 overflow-auto dot-grid-bg", viewMode === "markdown" && "hidden")}>
        {/* Floating action buttons — sticky so they stay visible while scrolling */}
        {viewMode === "preview" && steps.length > 0 && (
          <div className="sticky top-3 z-10 flex justify-end gap-1.5 px-3 pointer-events-none" style={{ marginBottom: "-2rem" }}>
            <button
              onClick={handleReset}
              className="pointer-events-auto flex items-center justify-center rounded-lg border border-border bg-background/80 backdrop-blur-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shadow-sm"
              title="Reset positions"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="pointer-events-auto flex items-center justify-center rounded-lg border border-border bg-background/80 backdrop-blur-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shadow-sm"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        )}
        <div ref={contentRef} className="relative min-h-full">
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" style={{ zIndex: 2 }}>
            {paths.map(p => (
              <g key={p.key}>
                {p.active && (
                  <path d={p.d} fill="none" strokeWidth={6} strokeLinecap="round"
                    className="stroke-primary/15" strokeDasharray="3 6" />
                )}
                <path d={p.d} fill="none" strokeWidth={2} strokeLinecap="round"
                  className={cn(
                    "transition-colors duration-300",
                    p.active ? "stroke-primary" : p.completed ? "stroke-primary/40" : "stroke-muted-foreground/25",
                  )}
                  strokeDasharray="3 6"
                />
                {p.active && (
                  <circle r="3" className="fill-primary">
                    <animateMotion dur="1.5s" repeatCount="indefinite" path={p.d} />
                  </circle>
                )}
              </g>
            ))}
          </svg>

          <div className="relative flex flex-col items-center gap-12 px-6 py-10" style={{ zIndex: 3 }}>
            {/* Start pill */}
            <div ref={setNodeRef("__start__")} data-node-id="__start__"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
              <Play className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">Start</span>
            </div>

            {steps.map((step, idx) => {
              const isActive = idx === activeStepIndex
              const isCompleted = idx < activeStepIndex
              const dimmed = activeStepIndex >= 0 && !isActive && !isCompleted
              const status = stepStatuses[idx]

              if (step.branches && step.branches.length > 0) {
                return (
                  <div key={step.id} className="flex items-start justify-center gap-6">
                    {step.branches.map(b => (
                      <DraggableCard key={b.id} step={b} isActive={isActive} isCompleted={isCompleted}
                        dimmed={dimmed} compact setRef={setNodeRef(b.id)} onDrag={(dx, dy) => handleDrag(b.id, dx, dy)} status={status} />
                    ))}
                  </div>
                )
              }

              return (
                <DraggableCard key={step.id} step={step} isActive={isActive} isCompleted={isCompleted}
                  dimmed={dimmed} setRef={setNodeRef(step.id)} onDrag={(dx, dy) => handleDrag(step.id, dx, dy)} status={status} />
              )
            })}

            {/* End pill */}
            <div ref={setNodeRef("__end__")} data-node-id="__end__"
              className="inline-flex items-center gap-1.5 rounded-full border border-node-verify/30 bg-node-verify/10 px-4 py-1.5">
              <CircleCheck className="h-3.5 w-3.5 text-node-verify" />
              <span className="text-xs font-semibold text-node-verify">End</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Draggable card ── */
function DraggableCard({
  step, isActive, isCompleted, dimmed, compact, setRef, onDrag, status,
}: {
  step: WorkflowStep; isActive: boolean; isCompleted: boolean; dimmed?: boolean; compact?: boolean
  setRef: (el: HTMLDivElement | null) => void; onDrag: (dx: number, dy: number) => void
  status?: 'success' | 'error'
}) {
  const c = typeColor[step.type]
  const I = getIcon(step)
  const lastPos = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)

  const down = useCallback((e: RPointer<HTMLDivElement>) => {
    e.preventDefault()
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const move = useCallback((e: RPointer<HTMLDivElement>) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    onDrag(dx, dy)
  }, [onDrag])

  const up = useCallback(() => { dragging.current = false }, [])

  // Icon box: status icon > type icon
  const iconSize = compact ? "h-4 w-4" : "h-[18px] w-[18px]"
  let iconElement: React.ReactNode
  if (status === 'success') {
    iconElement = <CheckCircle2 className={cn(iconSize, "text-node-verify")} />
  } else if (status === 'error') {
    iconElement = <XCircle className={cn(iconSize, "text-node-error")} />
  } else {
    iconElement = <I className={iconSize} />
  }

  // Card border/bg colors based on status
  const cardClass = status === 'success'
    ? "border-node-verify/30 bg-node-verify/5"
    : status === 'error'
    ? "border-node-error/30 bg-node-error/5"
    : isActive ? `${c.border} ${c.bg} shadow-lg shadow-primary/5`
    : isCompleted ? "border-primary/15 bg-primary/5"
    : "border-border bg-card"

  // Icon box colors based on status
  const iconBoxClass = status === 'success'
    ? "border-node-verify/20 bg-node-verify/10 text-node-verify"
    : status === 'error'
    ? "border-node-error/20 bg-node-error/10 text-node-error"
    : isActive ? `${c.iconBg} ${c.border} ${c.text}`
    : isCompleted ? "border-primary/20 bg-primary/10 text-primary"
    : "border-border bg-secondary text-muted-foreground"

  return (
    <div
      ref={setRef}
      data-node-id={step.id}
      className={cn(
        "inline-flex touch-none select-none items-center gap-3 rounded-2xl border transition-all duration-200",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        cardClass,
        "cursor-grab active:cursor-grabbing",
        dimmed && "opacity-35",
      )}
      style={{ willChange: "transform" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
    >
      <div className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border",
        compact ? "h-9 w-9" : "h-10 w-10",
        iconBoxClass,
      )}>
        {iconElement}
      </div>
      <span className={cn(
        "inline-flex items-center gap-1 font-medium leading-tight whitespace-nowrap",
        compact ? "text-xs" : "text-sm",
        isActive ? "text-foreground" : isCompleted ? "text-foreground/80" : "text-muted-foreground",
      )}>
        <TitleWithLogos title={step.title} />
      </span>
      {isActive && !status && (
        <span className="relative ml-1 flex h-2 w-2 shrink-0">
          <span className={cn("absolute inline-flex h-2 w-2 animate-ping rounded-full opacity-75", c.iconBg)} />
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", c.iconBg)} />
        </span>
      )}
    </div>
  )
}
