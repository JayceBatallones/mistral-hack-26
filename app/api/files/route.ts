import { getSession } from '@/lib/sessions'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('session_id')
  const filePath = url.searchParams.get('path') ?? 'SKILL.md'

  if (!sessionId) return Response.json({ error: 'session_id required' }, { status: 400 })

  const session = getSession(sessionId)
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })

  // Security: only allow files within the session workspace
  const fullPath = path.join(session.workspace, filePath)
  const normalizedWorkspace = path.normalize(session.workspace)
  const normalizedFull = path.normalize(fullPath)

  if (!normalizedFull.startsWith(normalizedWorkspace)) {
    return Response.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8')
    return Response.json({ content, path: filePath })
  } catch {
    return Response.json({ content: null, path: filePath })
  }
}
