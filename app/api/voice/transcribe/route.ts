import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const audio = formData.get('audio') as File

  if (!audio) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
  }

  const fd = new FormData()
  fd.append('file', audio)
  fd.append('model_id', 'scribe_v1')

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: fd,
  })

  if (!response.ok) {
    const err = await response.text()
    return NextResponse.json({ error: `ElevenLabs: ${err}` }, { status: response.status })
  }

  const data = await response.json()
  return NextResponse.json({ text: data.text ?? '' })
}
