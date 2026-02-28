import { createSession, listSessions, getSession } from '@/lib/sessions'

export const runtime = 'nodejs'

export async function GET() {
  const sessions = listSessions()
  return Response.json(sessions)
}

export async function POST() {
  const session = createSession()
  return Response.json(session)
}
