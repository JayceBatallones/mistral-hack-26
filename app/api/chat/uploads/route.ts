import { getSession, updateSession } from '@/lib/sessions'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const sessionId = formData.get('session_id') as string | null

  if (!file || !sessionId) {
    return Response.json({ error: 'file and session_id required' }, { status: 400 })
  }

  const session = getSession(sessionId)
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const sanitizedName = path.basename(file.name).replace(/[^a-zA-Z0-9._\- ]/g, '_')
  const filePath = path.join(session.workspace, sanitizedName)

  fs.writeFileSync(filePath, buffer)

  // Persist video info so the session can restore it on revisit
  updateSession(sessionId, { video_path: filePath, video_name: sanitizedName })

  return Response.json({
    path: filePath,
    name: sanitizedName,
    size: file.size,
  })
}
