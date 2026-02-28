import { cancelClaude } from '@/lib/claude'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { session_id } = await req.json()
  const cancelled = await cancelClaude(session_id)
  return Response.json({ ok: cancelled })
}
