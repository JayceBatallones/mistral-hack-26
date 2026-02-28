import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import type { Session } from './types'

// Survive Next.js hot reload in development
declare global {
  // eslint-disable-next-line no-var
  var __sf_sessions: Map<string, Session> | undefined
}

const sessions: Map<string, Session> =
  globalThis.__sf_sessions ?? (globalThis.__sf_sessions = new Map())

const WORKSPACES_DIR = path.join(process.cwd(), 'workspaces')

export function createSession(): Session {
  const id = randomUUID()
  const workspace = path.join(WORKSPACES_DIR, id)
  fs.mkdirSync(workspace, { recursive: true })

  const session: Session = {
    id,
    created_at: new Date().toISOString(),
    workspace,
  }

  sessions.set(id, session)
  return session
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id)
}

export function listSessions(): Session[] {
  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function updateSession(id: string, updates: Partial<Session>): void {
  const session = sessions.get(id)
  if (session) sessions.set(id, { ...session, ...updates })
}
