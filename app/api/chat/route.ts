import { getSession, updateSession } from '@/lib/sessions'
import { spawnClaude, cancelClaude } from '@/lib/claude'
import path from 'path'
import type { SSEEvent } from '@/lib/types'

export const runtime = 'nodejs'

function buildPrompt(
  userPrompt: string,
  sessionWorkspace: string,
  videoPath?: string
): string {
  const skillMdPath = path.join(sessionWorkspace, 'SKILL.md')
  const lines: string[] = [
    '=== SkillForge Context ===',
    `Session workspace: ${sessionWorkspace}`,
    `When generating SKILL.md, write it to: ${skillMdPath}`,
  ]

  if (videoPath) {
    lines.push(`Attached video file path: ${videoPath}`)
  }

  lines.push('', '=== User Request ===', userPrompt)
  return lines.join('\n')
}

export async function POST(req: Request) {
  const body = await req.json()
  const { session_id, prompt, video_path } = body as {
    session_id: string
    prompt: string
    video_path?: string
  }

  if (!session_id || !prompt) {
    return Response.json({ error: 'session_id and prompt required' }, { status: 400 })
  }

  const session = getSession(session_id)
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })

  const fullPrompt = buildPrompt(prompt, session.workspace, video_path)
  const encoder = new TextEncoder()

  // Fix #4: proper cancel via top-level import, not dynamic require
  req.signal.addEventListener('abort', () => { void cancelClaude(session_id) })

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: SSEEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // controller already closed
        }
      }

      spawnClaude(
        session_id,
        fullPrompt,
        session.claude_session_id,
        (event) => {
          // Capture claude session id from system_init for conversation resume
          if (event.type === 'system_init') {
            updateSession(session_id, { claude_session_id: event.session_id })
          }
          send(event)
        },
        () => {
          // Fix #3: onDone just closes the stream — complete event was already sent by spawnClaude
          try { controller.close() } catch { /* noop */ }
        },
        (err) => {
          send({ type: 'error', message: err.message })
          try { controller.close() } catch { /* noop */ }
        }
      )
    },
    // Fix #4: use ReadableStream cancel for additional cleanup
    cancel() {
      void cancelClaude(session_id)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
