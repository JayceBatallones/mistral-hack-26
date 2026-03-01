# Ditto

Record once. AI watches. Runs forever.

Mimi, Ditto’s analysis companion, watches your recording, copies the workflow, and writes a replayable `SKILL.md` while Claude validates it. Then say "replay the workflow" and Claude drives Chrome to execute it.

## Prerequisites

- Node.js 22+
- Claude Code CLI (`claude`) authenticated with an active subscription
- `ffmpeg` (for keyframe extraction)
- Python 3 + Pillow + numpy (for the video-frame-reader skill)
- Chrome with remote debugging enabled (for browser-tools replay)

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Usage

1. **Record** — attach a `.mov`/`.mp4` screen recording via the paperclip or drag-drop
2. **Analyze** — type `use /video-frame-reader on this and create SKILL.md`
3. **Review** — SKILL.md appears live in the right panel as Claude writes it
4. **Replay** — type `replay the workflow` and Claude uses browser-tools to drive Chrome

## Data Layout

Default workspace root: `<project-root>/workspaces/`

```
workspaces/
  <session-id>/
    session.json     # session metadata
    messages.json    # chat history (restored on reload)
    SKILL.md         # generated skill file
```

Override with `DITTO_WORKSPACES_DIR` in `.env.local`:

```bash
DITTO_WORKSPACES_DIR=/path/to/your/workspaces
```

## Notes

- Sessions and chat history survive page reloads and server restarts
- Each session has its own isolated `SKILL.md` — never written to the project root
- Stop button uses SIGTERM → 300ms → SIGKILL to reliably cancel running Claude processes

## Meet Mimi

- Mimi is the mimic — she sees what you do, copies the steps, and keeps everything in sync with SKILL.md.
- The `Ditto` brand centers on this character and the idea that once Mimi learns a workflow, she can replay it anytime.
