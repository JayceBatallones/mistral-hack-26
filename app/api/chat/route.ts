import { getSession, updateSession } from '@/lib/sessions'
import { spawnClaude, cancelClaude } from '@/lib/claude'
import fs from 'fs'
import path from 'path'
import type { SSEEvent } from '@/lib/types'

export const runtime = 'nodejs'

function buildPrompt(
  userPrompt: string,
  sessionWorkspace: string,
  videoPath?: string
): string {
  const skillMdPath = path.join(sessionWorkspace, 'WORKFLOW.md')
  const lines: string[] = [
    '=== Ditto Context ===',
    `Session workspace: ${sessionWorkspace}`,
    `IMPORTANT: When writing WORKFLOW.md use the exact path: ${skillMdPath}`,
    `Do NOT write WORKFLOW.md to the project root or any other location.`,
    `IMPORTANT: When replaying a workflow with browser-tools, always use the --new flag for the first navigation (e.g. browser-nav.js <url> --new). Never reuse the current tab for the initial navigation.`,
    '',
    '=== WORKFLOW.md Format ===',
    'When generating WORKFLOW.md, use EXACTLY this format:',
    '',
    '# <Skill Title>',
    '',
    '## Description',
    '<1-2 sentence description of what the skill does>',
    '',
    '## Steps',
    '',
    '### 1. <Step title>',
    '- **Tool:** `<tool-name>`',
    '- **Action:** <What to do>',
    '- **Expected:** <What should happen>',
    '',
    '### 2. <Step title>',
    '- **Tool:** `<tool-name>`',
    '- **Action:** <What to do>',
    '- **Expected:** <What should happen>',
    '',
    '(continue for each step)',
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

          // Ensure WORKFLOW.md always lands in the session workspace, even if
          // Claude wrote it somewhere else (e.g. the project root).
          if (event.type === 'skill_written') {
            const dest = path.join(session.workspace, 'WORKFLOW.md')
            const src = event.path
            if (path.resolve(src) !== path.resolve(dest)) {
              try {
                fs.copyFileSync(src, dest)
              } catch { /* source may not exist yet; Claude may write it later */ }
            }
            // Rewrite path so the client fetches from the session workspace
            send({ ...event, path: dest })
            return
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
