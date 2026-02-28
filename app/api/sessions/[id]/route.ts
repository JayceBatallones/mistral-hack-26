import { getSession, loadMessages, saveMessages } from '@/lib/sessions'
import type { ChatMessage } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = getSession(id)
  if (!session) return Response.json({ error: 'Not found' }, { status: 404 })
  const messages = loadMessages(id)
  return Response.json({ ...session, messages })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = getSession(id)
  if (!session) return Response.json({ error: 'Not found' }, { status: 404 })
  const { messages } = await req.json() as { messages: ChatMessage[] }
  if (!Array.isArray(messages)) return Response.json({ error: 'messages must be array' }, { status: 400 })
  saveMessages(id, messages)
  return Response.json({ ok: true })
}
