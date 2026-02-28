"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface MarkdownViewerProps {
  content: string
  className?: string
}

/* Lightweight markdown-to-JSX renderer -- no external deps */
export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const blocks = useMemo(() => parseMarkdown(content), [content])

  return (
    <div className={cn("prose-custom flex flex-col gap-4 p-6", className)}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  )
}

/* ── types ── */
type MdBlock =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "ul"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }

/* ── parser ── */
function parseMarkdown(md: string): MdBlock[] {
  const lines = md.split("\n")
  const blocks: MdBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === "") { i++; continue }

    if (line.trim().startsWith("```")) {
      const lang = line.trim().replace(/^```/, "").trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ type: "code", lang, code: codeLines.join("\n") })
      i++
      continue
    }

    if (line.includes("|") && i + 1 < lines.length && lines[i + 1]?.includes("---")) {
      const headers = line.split("|").map(s => s.trim()).filter(Boolean)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(lines[i].split("|").map(s => s.trim()).filter(Boolean))
        i++
      }
      blocks.push({ type: "table", headers, rows })
      continue
    }

    if (line.startsWith("### ")) { blocks.push({ type: "h3", text: line.slice(4) }); i++; continue }
    if (line.startsWith("## ")) { blocks.push({ type: "h2", text: line.slice(3) }); i++; continue }
    if (line.startsWith("# ")) { blocks.push({ type: "h1", text: line.slice(2) }); i++; continue }

    if (line.trim().startsWith("- ")) {
      const items: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2))
        i++
      }
      blocks.push({ type: "ul", items })
      continue
    }

    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && !lines[i].trim().startsWith("```") && !lines[i].trim().startsWith("- ") && !lines[i].includes("|")) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join(" ") })
    }
  }

  return blocks
}

/* ── inline formatting ── */
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return <code key={i} className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-primary">{p.slice(1, -1)}</code>
        }
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

/* ── block renderer ── */
function Block({ block }: { block: MdBlock }) {
  switch (block.type) {
    case "h1":
      return <h1 className="text-xl font-bold text-foreground tracking-tight">{block.text}</h1>
    case "h2":
      return <h2 className="mt-2 text-base font-semibold text-foreground border-b border-border pb-2">{block.text}</h2>
    case "h3":
      return <h3 className="text-sm font-semibold text-foreground">{block.text}</h3>
    case "paragraph":
      return <p className="text-sm leading-relaxed text-muted-foreground"><InlineText text={block.text} /></p>
    case "code":
      return (
        <div className="overflow-hidden rounded-lg border border-border">
          {block.lang && (
            <div className="border-b border-border bg-secondary/50 px-3 py-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{block.lang}</span>
            </div>
          )}
          <pre className="overflow-x-auto bg-secondary/30 p-3">
            <code className="text-xs font-mono text-foreground/80 leading-relaxed">{block.code}</code>
          </pre>
        </div>
      )
    case "ul":
      return (
        <ul className="flex flex-col gap-1.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      )
    case "table":
      return (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {block.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium text-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-muted-foreground"><InlineText text={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}
