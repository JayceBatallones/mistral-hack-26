/**
 * Claude Code subprocess spawner.
 * Architecture based on Manimate's local/runtime.ts + local/chat.ts patterns.
 */
import { spawn, ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import type { SSEEvent } from './types'

interface ProcEntry {
  proc: ChildProcess
  id: string // tag to avoid race on cancel+restart
  canceled: boolean
}

// Survive Next.js hot reload
declare global {
  // eslint-disable-next-line no-var
  var __sf_procs: Map<string, ProcEntry> | undefined
}

const activeProcesses: Map<string, ProcEntry> =
  globalThis.__sf_procs ?? (globalThis.__sf_procs = new Map())

// Env keys to strip — same as Manimate's buildLocalClaudeEnv()
const ENV_KEYS_TO_REMOVE = [
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'ANTHROPIC_API_KEY', // let claude use its own auth
  'ANTHROPIC_BASE_URL',
]

function buildClaudeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const key of ENV_KEYS_TO_REMOVE) delete env[key]
  return env
}

// ─── NDJSON helpers (ported from Manimate's ndjson-parser.ts) ──────────────

interface ParseResult {
  lines: Record<string, unknown>[]
  remainder: string
}

function parseNDJSONChunk(buffer: string, chunk: string): ParseResult {
  const combined = buffer + chunk
  const lastNewline = combined.lastIndexOf('\n')
  if (lastNewline === -1) return { lines: [], remainder: combined }

  const complete = combined.slice(0, lastNewline)
  const remainder = combined.slice(lastNewline + 1)
  const lines: Record<string, unknown>[] = []

  for (const line of complete.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const obj = JSON.parse(trimmed)
      if (obj && typeof obj === 'object') lines.push(obj as Record<string, unknown>)
    } catch {
      // Skip invalid JSON lines
    }
  }

  return { lines, remainder }
}

// Extract content blocks from message envelope
function getMessageBlocks(obj: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!obj.message || typeof obj.message !== 'object') return []
  const message = obj.message as Record<string, unknown>
  const content = message.content
  if (!Array.isArray(content)) return []
  return content.filter((item): item is Record<string, unknown> =>
    Boolean(item) && typeof item === 'object'
  )
}

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item) {
          return typeof (item as { text?: unknown }).text === 'string'
            ? (item as { text: string }).text
            : ''
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  try { return JSON.stringify(content) } catch { return '' }
}

// ─── Main spawn function ─────────────────────────────────────────────────────

export function spawnClaude(
  sessionId: string,
  prompt: string,
  claudeSessionId: string | undefined,
  send: (event: SSEEvent) => void,
  onDone: () => void,
  onError: (err: Error) => void
): void {
  // Kill any existing process for this session
  _killEntry(sessionId)

  const args: string[] = [
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
  ]

  if (claudeSessionId) args.push('--resume', claudeSessionId)

  // Pass prompt as -p argument (not stdin) — exact pattern from Manimate runtime.ts
  args.push('-p', prompt)

  const proc = spawn('claude', args, {
    cwd: process.cwd(),
    env: buildClaudeEnv(),
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  // Close stdin immediately — we pass the prompt via -p, not stdin
  proc.stdin.end()

  const procId = randomUUID()
  const entry: ProcEntry = { proc, id: procId, canceled: false }
  activeProcesses.set(sessionId, entry)

  let ndjsonBuffer = ''
  let capturedSessionId = ''
  let resultReceived = false

  // Sequential async chain to preserve ordering (Manimate pattern)
  let streamChain = Promise.resolve()
  const enqueue = (task: () => Promise<void>) => {
    streamChain = streamChain.then(task).catch((err) => {
      console.error('[claude] stream task error:', err)
    })
  }

  proc.stdout.on('data', (chunk: Buffer) => {
    const data = chunk.toString('utf-8')
    enqueue(async () => {
      const parsed = parseNDJSONChunk(ndjsonBuffer, data)
      ndjsonBuffer = parsed.remainder

      for (const obj of parsed.lines) {
        // Capture session_id from any event that has it (Manimate pattern)
        if (typeof obj.session_id === 'string' && obj.session_id) {
          capturedSessionId = obj.session_id
          // Fire system_init once when we first get the session id
          if (obj.type === 'system' || obj.type === 'system_init') {
            send({ type: 'system_init', message: 'Claude Code started', session_id: capturedSessionId })
          }
        }

        // Final result
        if (obj.type === 'result') {
          resultReceived = true
          const cost = typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : undefined
          send({ type: 'complete', message: String(obj.result ?? 'Done'), cost })
          continue
        }

        // Process message content blocks (Manimate's getMessageBlocks pattern)
        const blocks = getMessageBlocks(obj)
        const msgType = typeof obj.type === 'string' ? obj.type : ''

        for (const block of blocks) {
          // Assistant text
          if (msgType === 'assistant' && block.type === 'text' && typeof block.text === 'string') {
            send({ type: 'assistant_text', message: block.text })
          }

          // Tool use
          if (msgType === 'assistant' && block.type === 'tool_use') {
            const toolName = typeof block.name === 'string' ? block.name : 'Tool'
            const toolInput = (block.input && typeof block.input === 'object')
              ? block.input as Record<string, unknown>
              : {}
            const toolId = typeof block.id === 'string' ? block.id : randomUUID()

            send({ type: 'tool_use', id: toolId, tool_name: toolName, tool_input: toolInput })

            // Detect SKILL.md write — fire skill_written for right panel refresh
            if (toolName === 'Write' || toolName === 'Edit') {
              const filePath = (toolInput?.file_path ?? toolInput?.path ?? '') as string
              if (typeof filePath === 'string' && filePath.includes('SKILL.md')) {
                send({ type: 'skill_written', path: filePath })
              }
            }
          }

          // Tool result — comes in a user-role message (Manimate pattern)
          if (block.type === 'tool_result') {
            const rawResult = stringifyContent((block as { content?: unknown }).content).trim()
            const isError = Boolean((block as { is_error?: unknown }).is_error)
            const toolUseId = typeof (block as { tool_use_id?: unknown }).tool_use_id === 'string'
              ? (block as { tool_use_id: string }).tool_use_id
              : ''

            send({
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: rawResult || '(no output)',
              is_error: isError,
            })

            // After a Write/Edit tool result, check if SKILL.md changed
            // (belt-and-suspenders: skill_written may have already been sent via tool_use)
          }
        }
      }
    })
  })

  proc.stderr.on('data', (chunk: Buffer) => {
    console.error('[claude stderr]', chunk.toString('utf-8').trim())
  })

  proc.once('exit', async (code, signal) => {
    // Wait for all enqueued stream tasks to finish
    await streamChain

    // Handle trailing incomplete line
    if (ndjsonBuffer.trim()) {
      try {
        const trailing = JSON.parse(ndjsonBuffer.trim()) as Record<string, unknown>
        if (typeof trailing.session_id === 'string') capturedSessionId = trailing.session_id
        if (trailing.type === 'result') {
          resultReceived = true
          send({ type: 'complete', message: String(trailing.result ?? 'Done') })
        }
      } catch { /* ignore */ }
    }

    // Only clean up map if this is still the active entry
    const current = activeProcesses.get(sessionId)
    if (current?.id === procId) activeProcesses.delete(sessionId)

    const wasCanceled = entry.canceled || signal === 'SIGTERM' || signal === 'SIGKILL'

    if (!resultReceived && !wasCanceled) {
      if (code !== 0 && code !== null) {
        send({ type: 'error', message: `Claude exited with code ${code}` })
      } else {
        send({ type: 'complete', message: 'Done' })
      }
    }

    onDone()
  })

  proc.once('error', (err) => {
    const current = activeProcesses.get(sessionId)
    if (current?.id === procId) activeProcesses.delete(sessionId)
    onError(err)
  })
}

async function _killEntry(sessionId: string): Promise<void> {
  const entry = activeProcesses.get(sessionId)
  if (!entry) return
  entry.canceled = true
  activeProcesses.delete(sessionId)

  // Manimate pattern: SIGTERM → 300ms → SIGKILL
  try { entry.proc.kill('SIGTERM') } catch { /* ignore */ }
  await new Promise((resolve) => setTimeout(resolve, 300))
  if (!entry.proc.killed) {
    try { entry.proc.kill('SIGKILL') } catch { /* ignore */ }
  }
}

export async function cancelClaude(sessionId: string): Promise<boolean> {
  const had = activeProcesses.has(sessionId)
  await _killEntry(sessionId)
  return had
}
