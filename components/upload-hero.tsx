"use client"

import { useCallback, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function UploadHero() {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileSelected = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) return
    setIsUploading(true)

    try {
      // Create a new session
      const sessionRes = await fetch('/api/sessions', { method: 'POST' })
      const session = await sessionRes.json()

      // Upload the video
      const fd = new FormData()
      fd.append('file', file)
      fd.append('session_id', session.id)
      const uploadRes = await fetch('/api/chat/uploads', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()

      if (uploadData.path) {
        router.push(`/skills/${session.id}?video_path=${encodeURIComponent(uploadData.path)}&video_name=${encodeURIComponent(uploadData.name)}&auto_start=true`)
      }
    } catch {
      setIsUploading(false)
    }
  }, [router])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0])
      }
    },
    [handleFileSelected]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelected(e.target.files[0])
      }
    },
    [handleFileSelected]
  )

  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6 pb-24"
      style={{ backgroundImage: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, color-mix(in srgb, var(--color-stone) 50%, transparent) 100%)' }}
    >
      {/* Greeting section */}
      <div className="mb-12 text-center">
        <h1 className="mb-5 text-balance text-4xl font-medium tracking-tight text-[var(--color-ink)] md:text-5xl lg:text-6xl font-serif leading-tight">
          Teach Ditto
          <br />
          <span className="italic text-[var(--color-ink-light)]">to mimic your workflow</span>
        </h1>
        <p className="mx-auto max-w-lg text-pretty text-lg leading-relaxed text-[var(--color-ink-light)]">
          Just record your screen and upload. No code needed.
        </p>
      </div>

      {/* Upload zone */}
      <div
        className={cn(
          "group relative w-full max-w-2xl cursor-pointer p-12 text-center transition-all duration-300",
          "hand-drawn-border",
          isUploading && "pointer-events-none opacity-60",
        )}
        style={isDragging ? { boxShadow: 'var(--shadow-sketch-hover), 0 0 28px -4px var(--color-accent-sand)' } : undefined}
        onDrag={handleDrag}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDragIn}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload video file"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            inputRef.current?.click()
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
          aria-hidden="true"
        />

        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300",
              isUploading
                ? "bg-[var(--color-ink)] text-white"
                : isDragging
                  ? "bg-[var(--color-ink)] text-white"
                  : "bg-[var(--color-stone)] text-[var(--color-ink-light)] group-hover:bg-[var(--color-accent-sand)]/40 group-hover:text-[var(--color-ink)]"
            )}
          >
            {isUploading ? (
              <span className="block w-7 h-7 border-3 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Upload className="h-7 w-7" />
            )}
          </div>

          <div>
            <p className="text-lg font-semibold text-[var(--color-ink)]">
              {isUploading ? "Uploading..." : isDragging ? "Drop your video here" : "Drop a video to get started"}
            </p>
            <p className="mt-1 text-sm text-[var(--color-ink-light)]">
              or click to browse {'  '}
              <span className="text-[var(--color-ink-light)]/60">
                MP4, MOV, WebM up to 500MB
              </span>
            </p>
          </div>

          {!isUploading && (
            <div className="mt-2 flex items-center gap-2 text-sm text-[var(--color-accent-coral)] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span>Upload and generate skill</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
