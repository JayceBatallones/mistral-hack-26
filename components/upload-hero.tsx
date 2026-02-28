"use client"

import { useCallback, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, Film, ArrowRight } from "lucide-react"
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
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6">
      {/* Greeting section */}
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5">
          <Film className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">
            Video to Skills Pipeline
          </span>
        </div>
        <h1 className="mb-4 text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
          Teach your agents
          <br />
          <span className="text-primary">new skills</span>
        </h1>
        <p className="mx-auto max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Upload a video walkthrough and SkillForge will generate a structured
          SKILL.md that your AI agents can call. No code required.
        </p>
      </div>

      {/* Upload zone */}
      <div
        className={cn(
          "group relative w-full max-w-2xl cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all duration-300",
          isUploading && "pointer-events-none opacity-60",
          isDragging
            ? "border-primary bg-primary/5 shadow-[0_0_30px_-5px] shadow-primary/20"
            : "border-border bg-card hover:border-primary/50 hover:bg-secondary/50"
        )}
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
                ? "bg-primary text-primary-foreground"
                : isDragging
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
            )}
          >
            {isUploading ? (
              <span className="block w-7 h-7 border-3 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Upload className="h-7 w-7" />
            )}
          </div>

          <div>
            <p className="text-lg font-semibold text-foreground">
              {isUploading ? "Uploading..." : isDragging ? "Drop your video here" : "Drop a video to get started"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or click to browse {'  '}
              <span className="text-muted-foreground/60">
                MP4, MOV, WebM up to 500MB
              </span>
            </p>
          </div>

          {!isUploading && (
            <div className="mt-2 flex items-center gap-2 text-sm text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span>Upload and generate skill</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>

      {/* Quick hints */}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {["Login flows", "Form filling", "API testing", "Navigation paths"].map(
          (hint) => (
            <span
              key={hint}
              className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground"
            >
              {hint}
            </span>
          )
        )}
      </div>
    </div>
  )
}
