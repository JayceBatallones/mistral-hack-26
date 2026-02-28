'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, Mic, MicOff, Paperclip, Send, Square, Video, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const BAR_COUNT = 28

export function ChatInput({
  onSend,
  onStop,
  isRunning,
  sessionId,
  onVideoUploaded,
  attachedVideo,
  onClearVideo,
}: {
  onSend: (prompt: string) => void
  onStop: () => void
  isRunning: boolean
  sessionId: string
  onVideoUploaded: (path: string, name: string) => void
  attachedVideo: { path: string; name: string } | null
  onClearVideo: () => void
}) {
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0.05))

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [text])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || isRunning) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Waveform animation ────────────────────────────────────────────────────

  const animateWaveform = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    const step = Math.floor(dataArrayRef.current.length / BAR_COUNT)
    const newBars = Array.from({ length: BAR_COUNT }, (_, i) => {
      const raw = dataArrayRef.current![i * step] / 255
      return Math.max(0.05, raw)
    })
    setBars(newBars)
    animFrameRef.current = requestAnimationFrame(animateWaveform)
  }, [])

  const stopWaveform = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = null
    setBars(Array(BAR_COUNT).fill(0.05))
  }

  // ── Recording controls ────────────────────────────────────────────────────

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
      animateWaveform()

      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start(250) // flush chunks every 250 ms — ensures data before onstop
      setIsRecording(true)
      setIsMuted(false)
    } catch {
      // mic denied or not supported
    }
  }

  const cancelRecording = () => {
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    stopWaveform()
    chunksRef.current = []
    setIsRecording(false)
    setIsMuted(false)
  }

  const confirmRecording = async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close()
      stopWaveform()
      setIsRecording(false)
      setIsMuted(false)
      setTranscribeError(null)

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      if (blob.size < 1000) {
        // Too short — nothing meaningful recorded
        return
      }

      setTranscribing(true)
      try {
        const fd = new FormData()
        fd.append('audio', blob, 'recording.webm')
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.text) {
          setText(prev => prev ? prev + ' ' + data.text : data.text)
          setTimeout(() => textareaRef.current?.focus(), 50)
        } else if (data.error) {
          console.error('[voice] transcription error:', data.error)
          setTranscribeError(data.error)
        }
      } catch (e) {
        console.error('[voice] fetch failed:', e)
        setTranscribeError('Transcription failed — check console')
      } finally {
        setTranscribing(false)
      }
    }
    recorder.stop()
  }

  const toggleMute = () => {
    const track = streamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsMuted(!track.enabled)
    if (!track.enabled) {
      stopWaveform()
    } else {
      animateWaveform()
    }
  }

  // ── Video upload ──────────────────────────────────────────────────────────

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('video/')) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('session_id', sessionId)
      const res = await fetch('/api/chat/uploads', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.path) onVideoUploaded(data.path, data.name)
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const onDragOver = (e: React.DragEvent) => e.preventDefault()

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="input-glow rounded-xl border border-border bg-card transition-all"
      >
        {/* Video attachment pill */}
        {attachedVideo && (
          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-md px-2 py-1 text-xs text-primary font-mono">
              <Video className="w-3 h-3" />
              <span className="max-w-[200px] truncate">{attachedVideo.name}</span>
              <button onClick={onClearVideo} className="ml-1 text-primary/60 hover:text-primary">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Waveform — shown while recording */}
        {isRecording && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center justify-center gap-[3px] h-10">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-[3px] rounded-full transition-all duration-75',
                    isMuted ? 'bg-muted-foreground/40' : 'bg-primary'
                  )}
                  style={{ height: `${h * 100}%`, opacity: isMuted ? 0.4 : 0.5 + h * 0.5 }}
                />
              ))}
            </div>
            <p className="text-center text-[11px] text-muted-foreground mt-1.5">
              {isMuted ? 'Muted' : 'Listening…'}
            </p>
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2 px-3 py-2.5">
          {/* Attachment */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
            title="Attach video"
          >
            {uploading
              ? <span className="block w-4 h-4 border-2 border-muted-foreground border-t-primary rounded-full animate-spin" />
              : <Paperclip className="w-4 h-4" />
            }
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mov,.mp4,.webm,.avi"
            onChange={onFileChange}
            className="hidden"
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              transcribing
                ? 'Transcribing…'
                : attachedVideo
                  ? 'use /video-frame-reader on this and create SKILL.md'
                  : isRecording
                    ? 'Or type here…'
                    : 'Type a prompt, or drag a video here…'
            }
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed py-0.5"
          />

          {/* Right-side buttons */}

          {/* Mic area: recording controls · or · mic icon · or · spinner */}
          {isRecording ? (
            <>
              <button
                onClick={toggleMute}
                className={cn(
                  'shrink-0 p-1.5 rounded-lg transition-colors',
                  isMuted
                    ? 'text-destructive bg-destructive/10 hover:bg-destructive/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={cancelRecording}
                className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Cancel recording"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={confirmRecording}
                className="shrink-0 p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                title="Done — transcribe"
              >
                <Check className="w-4 h-4" />
              </button>
            </>
          ) : transcribing ? (
            <div className="shrink-0 p-1.5">
              <span className="block w-4 h-4 border-2 border-muted-foreground border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <button
              onClick={startRecording}
              className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Voice input"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

          {/* Send / Stop — always visible */}
          {isRunning ? (
            <button
              onClick={onStop}
              className="shrink-0 p-2 rounded-lg bg-destructive/20 border border-destructive/30 text-destructive-foreground hover:bg-destructive/30 transition-colors"
              title="Stop"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!text.trim() || isRecording}
              className="shrink-0 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {transcribeError ? (
        <p className="text-center text-destructive text-[10px] mt-2">{transcribeError}</p>
      ) : (
        <p className="text-center text-muted-foreground/50 text-[10px] mt-2">
          Enter to send · Shift+Enter for newline · Drag video to attach · Mic for voice
        </p>
      )}
    </div>
  )
}
