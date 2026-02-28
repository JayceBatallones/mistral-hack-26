import { createSession, listSessions, hasSkillMd, getSkillTitle } from '@/lib/sessions'

export const runtime = 'nodejs'

export async function GET() {
  const sessions = listSessions()
  const enriched = sessions.map((s) => ({
    ...s,
    has_skill_md: hasSkillMd(s.id),
    skill_title: getSkillTitle(s.id),
  }))
  return Response.json(enriched)
}

export async function POST() {
  const session = createSession()
  return Response.json(session)
}
