import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import type { Session, ChatMessage } from './types'

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
  _persistMeta(session)
  return session
}

export function getSession(id: string): Session | undefined {
  if (sessions.has(id)) return sessions.get(id)
  // Try to recover from disk after a server restart
  const workspaceDir = path.join(WORKSPACES_DIR, id)
  return recoverSession(workspaceDir) ?? undefined
}

export function listSessions(): Session[] {
  // Scan workspace dirs so sessions survive server restarts
  try {
    const dirs = fs.readdirSync(WORKSPACES_DIR, { withFileTypes: true })
    for (const d of dirs) {
      if (d.isDirectory() && !sessions.has(d.name)) {
        recoverSession(path.join(WORKSPACES_DIR, d.name))
      }
    }
  } catch { /* workspaces dir may not exist yet */ }

  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function updateSession(id: string, updates: Partial<Session>): void {
  const session = sessions.get(id)
  if (!session) return
  const updated = { ...session, ...updates }
  sessions.set(id, updated)
  _persistMeta(updated)
}

// ── Message persistence ──────────────────────────────────────────────────────

export function saveMessages(id: string, messages: ChatMessage[]): void {
  const session = sessions.get(id)
  if (!session) return
  const msgPath = path.join(session.workspace, 'messages.json')
  fs.writeFileSync(msgPath, JSON.stringify(messages))
}

export function loadMessages(id: string): ChatMessage[] {
  const session = sessions.get(id)
  if (!session) return []
  const msgPath = path.join(session.workspace, 'messages.json')
  try {
    const data = JSON.parse(fs.readFileSync(msgPath, 'utf-8'))
    if (Array.isArray(data)) return data as ChatMessage[]
  } catch { /* no messages file yet */ }
  return []
}

// ── Session recovery from disk ───────────────────────────────────────────────
// Reconstructs an in-memory session from a workspace directory that survived
// a server restart.

export function recoverSession(workspaceDir: string): Session | null {
  const id = path.basename(workspaceDir)
  if (sessions.has(id)) return sessions.get(id)!
  const metaPath = path.join(workspaceDir, 'session.json')
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as Session
    sessions.set(id, meta)
    return meta
  } catch {
    return null
  }
}

// Persist session metadata so it survives server restarts.
function _persistMeta(session: Session): void {
  const metaPath = path.join(session.workspace, 'session.json')
  fs.writeFileSync(metaPath, JSON.stringify(session))
}
