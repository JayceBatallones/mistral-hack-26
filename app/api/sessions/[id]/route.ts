import { getSession } from '@/lib/sessions'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = getSession(id)
  if (!session) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(session)
}
