'use client'

import { useState, useEffect, useRef } from 'react'
import { Paperclip, Send, Square, Video, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="input-glow rounded-xl border border-border bg-card transition-all"
      >
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

        <div className="flex items-end gap-2 px-3 py-2.5">
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

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachedVideo
              ? 'use /video-frame-reader on this and create SKILL.md'
              : 'Type a prompt, or drag a video here…'
            }
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed py-0.5"
          />

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
              disabled={!text.trim()}
              className="shrink-0 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <p className="text-center text-muted-foreground/50 text-[10px] mt-2">
        Enter to send · Shift+Enter for newline · Drag video to attach
      </p>
    </div>
  )
}
