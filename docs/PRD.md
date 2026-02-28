# PRD: Video → Skill → Agent (via Claude Code)

**Product Name:** Mimic (working title)
**Date:** February 28, 2026
**Team Size:** 3 engineers (hackathon)
**Timeframe:** 1-day build

---

## 1. Problem Statement

Teaching an AI agent to perform a task currently requires manually writing code. Users should be able to **record a workflow once and have AI generate a replayable skill — to run via computer use**.

The missing piece is a UI that makes the Claude Code output visible and the generated SKILL.md readable, without touching the terminal.

---

## 2. Product Vision

A split-panel web UI — modelled on [Manimate](https://manimate.app/) — where:

- The **left panel** is a live view of a Claude Code conversation. The user attaches a video and types a prompt. Claude Code uses the `/video-frame-reader` skill to analyze it and write a `SKILL.md` file. All output streams in real-time.
- The **right panel** shows the generated `SKILL.md` content, updating as Claude Code writes it.
- The user corrects or refines the skill by typing follow-up prompts — Claude Code edits `SKILL.md` accordingly.
- To replay, the user types `"replay the workflow"` — Claude Code reads `SKILL.md` and uses the `browser-tools` skill to execute it in Chrome.

**Runtime:** Claude Code (primary). Mistral Vibe is a potential future swap — keep the architecture runtime-agnostic where possible.

---

## 3. The Core User Prompt

Everything starts with attaching a video and typing a prompt — exactly like attaching an image in Manimate:

```
[📎 Screen Recording 2026-02-27 at 1.27.08 pm.mov]

use /video-frame-reader on this recording and create SKILL.md for the workflow
```

From this, Claude Code:
1. Invokes `/video-frame-reader` — extracts keyframes, analyzes each with vision
2. Synthesizes a `SKILL.md` describing the workflow in natural language
3. Streams all output to the left panel via SSE

The UI surfaces this without requiring the terminal.

---

## 4. User Flow

```
┌─────────────────────┐    ┌─────────────────────────────────┐    ┌──────────────────┐
│  1. ATTACH + PROMPT  │ ──▶│  2. CLAUDE CODE PROCESSES        │ ──▶│  3. REVIEW       │
│                      │    │     (left panel streams SSE)     │    │                  │
│  Drag-drop video     │    │                                  │    │  Right panel     │
│  into prompt box     │    │  /video-frame-reader → frames    │    │  shows SKILL.md  │
│  + type prompt       │    │  vision analysis → descriptions  │    │  as it's written │
│                      │    │  synthesis → SKILL.md written    │    │                  │
└─────────────────────┘    └─────────────────────────────────┘    └──────────────────┘
                                                                           │
                                                          ┌────────────────▼──────────────┐
                                                          │  4. REFINE + REPLAY (prompt)   │
                                                          │                                │
                                                          │  "step 3 should scroll first"  │
                                                          │  → Claude edits SKILL.md       │
                                                          │                                │
                                                          │  "replay the workflow"         │
                                                          │  → Claude uses browser-tools   │
                                                          │    to execute SKILL.md in      │
                                                          │    Chrome (CDP)                │
                                                          └────────────────────────────────┘
```

### Step-by-step:

1. **User drags a video** into the prompt input (or uses the file picker / paste) — same UX as image attachment in Manimate
2. **User types a prompt** and hits Send
3. **Left panel streams** — Claude Code's tool calls, frame analysis, and SKILL.md being written appear in real-time
4. **Right panel updates** — SKILL.md content renders as Claude writes it
5. **User reads SKILL.md** in the right panel and types corrections in the prompt box
6. **Claude edits SKILL.md** — right panel updates
7. **User types `"replay the workflow"`** — Claude reads SKILL.md and drives `browser-tools` (CDP) to execute it in Chrome; output streams in the left panel

---

## 5. Core Architecture

### 5.1 System Components

```
┌──────────────────────────────────────────────────────────────────┐
│                          WEB UI (Next.js)                         │
│                                                                    │
│  ┌──────────────────────────┐   ┌──────────────────────────────┐  │
│  │   LEFT PANEL              │   │   RIGHT PANEL                 │  │
│  │   (ChatMessages)          │   │   (PreviewPanel)              │  │
│  │                           │   │                              │  │
│  │  • User messages          │   │  SKILL.md content            │  │
│  │  • Tool call pills        │   │  (markdown rendered,         │  │
│  │    (collapsible)          │   │   updates as Claude          │  │
│  │  • Frame analysis logs    │   │   writes the file)           │  │
│  │  • SKILL.md streaming     │   │                              │  │
│  │  • Claude text replies    │   │                              │  │
│  │                           │   │                              │  │
│  └──────────────────────────┘   └──────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [📎] Attach video  |  Type a prompt...              [Send]  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │ SSE (text/event-stream)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  BACKEND (Next.js API routes)                      │
│                                                                    │
│  /api/chat          → spawn Claude Code process, stream output     │
│  /api/chat/uploads  → save attached video to session workspace     │
│  /api/sessions      → create / list sessions (UUID-keyed)         │
│  /api/files         → read SKILL.md for right panel               │
│  /api/cancel        → cancel active Claude run                     │
└──────────────────────────────────────────────────────────────────┘
                              │ subprocess
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Claude Code CLI                                │
│                                                                    │
│   Skills available:                                                │
│   • /video-frame-reader  (yusuke-claude-code plugin)              │
│   • browser-tools        (pi-skills, CDP on :9222)                │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Skills Used

#### `/video-frame-reader`
Source: `https://github.com/Yusuke710/yusuke-claude-code/tree/main/plugins/video-frame-reader`

- Takes a video file path as input
- Extracts keyframes (de-duped, optimized for token efficiency)
- Analyzes each frame with vision (Claude's built-in image understanding)
- Returns structured frame descriptions
- Claude uses these to synthesize `SKILL.md`

#### `browser-tools`
Source: `https://github.com/badlogic/pi-skills/tree/main/browser-tools`

- Chrome DevTools Protocol (CDP) on `:9222`
- Scripts: `browser-nav.js`, `browser-eval.js`, `browser-screenshot.js`, `browser-pick.js`
- Invoked by Claude when the user asks it to replay the workflow
- No Playwright — CDP directly via Node.js scripts

### 5.3 SKILL.md Format

The output of the pipeline. **No rigid schema required** — the format is flexible, natural-language markdown. The only constraint: it must be readable by a coding agent so Claude can re-execute the workflow. Claude interprets intent, not syntax.

Convention: the file is always named `SKILL.md` (uppercase), consistent with the pi-skills ecosystem.

**Example (not a prescribed schema):**

```markdown
# Skill: [descriptive name]

## Context
- Video: Screen Recording 2026-02-27 at 1.27.08 pm.mov
- URL: [detected from recording]
- Purpose: [inferred from workflow]

## Steps

1. Navigate to `https://example.com`
2. Click the "Sign Up" button
3. Type `user@example.com` into the email field
4. Click "Submit"
5. Verify the success message appears

## Notes
- [observations from frame analysis, timing, edge cases]
```

### 5.4 Data Flow

```
User attaches video + types prompt
    │
    ▼
Video uploaded to session workspace (/api/chat/uploads)
    │
    ▼
Claude Code receives prompt (with video file path)
    │
    ├──▶ /video-frame-reader skill
    │         ├── extract keyframes from video
    │         ├── analyze frames with vision (parallel)
    │         └── return frame descriptions
    │
    ├──▶ Synthesize SKILL.md
    │         ├── merge descriptions → natural language steps
    │         └── write SKILL.md to session workspace
    │
    └──▶ SSE stream → left panel
              (tool calls, frame logs, SKILL.md content chunk by chunk)

Right panel polls /api/files for SKILL.md content and renders it

On "replay the workflow" prompt:
    Claude Code reads SKILL.md
    → invokes browser-tools scripts (nav, eval, screenshot)
    → streams step logs to left panel via SSE
```

---

## 6. API Endpoints

Modelled on Manimate's API structure:

| Method | Endpoint | Description | Input | Output |
|--------|----------|-------------|-------|--------|
| POST | `/api/chat` | Send prompt to Claude Code, stream output | `{ session_id, prompt, video_path? }` | SSE stream |
| POST | `/api/chat/uploads` | Upload attached video to session workspace | FormData (video file) | `{ path, name, size }` |
| POST | `/api/cancel` | Cancel active Claude run | `{ session_id }` | `{ ok }` |
| GET | `/api/sessions` | List all sessions | — | `[{ id, created_at, ... }]` |
| POST | `/api/sessions` | Create new session | — | `{ id }` |
| GET | `/api/sessions/[id]` | Get session details | — | session object |
| GET | `/api/files` | Read a file from session workspace | `?session_id=&path=` | file content |

---

## 7. UI Specification

### 7.1 Layout — Modelled on [Manimate](https://manimate.app/)

Manimate's architecture (explored locally at `./Manimate`):
- **Left panel** (`ChatMessages.tsx`) — chat timeline: user messages, collapsible tool-call pills, assistant text, auto-scrolls to bottom
- **Right panel** (`PreviewPanel.tsx`) — tabbed artifact view: shows Plan/Code/Preview, updates when the agent writes files
- **Prompt input** (`ChatInput.tsx`) — text + image attachment (drag-drop, file picker, paste)
- **Sessions** — UUID in URL query param (`?session=<uuid>`), per-tab isolation, listed in sidebar
- **SSE** — `TransformStream` backend + `ReadableStream`/`TextDecoder` frontend, NDJSON events

We follow the same pattern directly:

```
┌───────────────────────────────────────────────────────────┐
│  Mimic                  [Sessions ▾]   [New Session]  │
├──────────────────────────┬────────────────────────────────┤
│                          │                                 │
│   LEFT: CHAT TIMELINE    │   RIGHT: SKILL.md               │
│                          │                                 │
│   ▶ video-frame-reader   │   # Skill: Sign Up Flow        │
│     extracting 14 frames │                                 │
│   ▶ vision analysis      │   ## Context                   │
│     frame 3/14...        │   - URL: https://...           │
│   ✓ SKILL.md written     │                                 │
│                          │   ## Steps                     │
│   Claude: I've generated │   1. Navigate to ...           │
│   the skill. Want me to  │   2. Click Sign Up             │
│   replay it?             │   3. Type email@...            │
│                          │   4. Click Submit              │
│                          │   5. Verify success            │
│                          │                                 │
├──────────────────────────┴────────────────────────────────┤
│  [📎]  replay the workflow                        [Send]   │
└───────────────────────────────────────────────────────────┘
```

### 7.2 Left Panel: Chat Timeline

Directly follows Manimate's `ChatMessages.tsx` pattern:

- **User messages** — text + video attachment thumbnail
- **Tool call pills** — collapsible blocks per tool invocation (e.g. "▶ video-frame-reader: 14 frames extracted"), with expandable input/output
- **Assistant text** — Claude's replies rendered as markdown
- **Auto-scroll** — follows new content, pauses if user scrolls up
- **Status indicators** — spinner (running), checkmark (done), error badge (failed)

### 7.3 Right Panel: SKILL.md Viewer

Follows Manimate's `PreviewPanel.tsx` pattern, simplified to one artifact:

- Displays the content of `SKILL.md` from the session workspace
- Updates when Claude writes or edits the file (same mechanism as Manimate's plan/code tabs — frontend fetches `/api/files` on `tool_use` Write/Edit events for `SKILL.md`)
- Renders as syntax-highlighted markdown
- **Visualization format is TBD** — for MVP just show the raw markdown; diagram rendering (draw.io, mermaid, etc.) is a stretch goal decided later

### 7.4 Prompt Input

Follows Manimate's `ChatInput.tsx` pattern:

- Text area + **📎 attach button** for video files (also drag-drop and paste)
- Video uploaded to session workspace on send → file path injected into prompt context
- Supported formats: `.mp4`, `.mov`, `.webm` (video equivalents of Manimate's image support)
- Send on Enter (Shift+Enter for newline)

### 7.5 Sessions

Follows Manimate's session model exactly:

- Each session has a UUID, stored in URL as `?session=<uuid>`
- Per-session workspace directory on disk: `workspaces/<session_id>/`
- `SKILL.md` and uploaded video live in the session workspace
- Sessions listed in a sidebar, switchable per tab
- Draft prompt persisted in `localStorage` keyed by session ID

### 7.6 Prompt Examples

```
💡 Try:
  [attach video] "use /video-frame-reader on this and create SKILL.md"
  "step 3 is wrong — the user clicked Login not Sign Up"
  "add a wait after step 4"
  "replay the workflow"
```

---

## 8. SSE Event Schema

Follows Manimate's NDJSON-over-SSE pattern (`src/lib/types.ts`):

**Backend:** `TransformStream` → writes `data: <json>\n\n` per event
**Frontend:** `ReadableStream` + `TextDecoder` → splits on `\n`, parses `data:` lines

```typescript
// Core event types (subset of Manimate's SSEEvent)
type SSEEvent =
  | { type: "system_init"; message: string; session_id: string }
  | { type: "assistant_text"; message: string }
  | { type: "tool_use"; tool_name: string; tool_input: Record<string, unknown> }
  | { type: "tool_result"; tool_name: string; result: string; is_error: boolean }
  | { type: "skill_written"; path: string }   // triggers right panel to fetch SKILL.md
  | { type: "complete"; message: string }
  | { type: "error"; message: string }
```

The `skill_written` event fires when Claude writes or edits `SKILL.md` — the frontend fetches `/api/files?session_id=&path=SKILL.md` and refreshes the right panel.

---

## 9. Hackathon Work Split

### Person 1: Backend — SSE Server + Claude Code Integration

**Scope:**
- Next.js API routes: `/api/chat` (SSE), `/api/chat/uploads`, `/api/sessions`, `/api/files`, `/api/cancel`
- Spawn Claude Code as subprocess, pipe stdout to SSE stream (NDJSON → SSE events)
- Per-session workspace directory: create on session init, store uploaded video + SKILL.md
- Ensure `video-frame-reader` and `browser-tools` skills are available to Claude Code

**Tech:** Next.js API routes, Node.js `child_process`, `TransformStream`, SQLite (sessions)

### Person 2: Skills Validation

**Scope:**
- Verify `/video-frame-reader` works end-to-end with a sample recording
- Verify `browser-tools` (CDP) can execute a simple SKILL.md when Claude asks it to
- Document any setup steps (Chrome flags, skill config) needed for demo day

**Tech:** Existing skills only — no new code unless a bug needs patching

### Person 3: Frontend UI

**Scope:**
- Port/adapt Manimate's `ChatMessages.tsx`, `PreviewPanel.tsx`, `ChatInput.tsx`, `SplitPanel.tsx`
- Left panel: SSE client, tool pill rendering, auto-scroll
- Right panel: fetch and render SKILL.md markdown on `skill_written` events
- Prompt input: text + video file attachment (drag-drop, picker, paste)
- Session management: UUID in URL, session sidebar

**Tech:** Next.js, React, TypeScript, Tailwind, react-markdown — same stack as Manimate

---

## 10. Integration Timeline

| Time  | Milestone |
|-------|-----------|
| 0:00  | Align on PRD, SSE event schema, workspace path conventions |
| 0:15  | Everyone starts in parallel |
| 1:30  | P1: SSE server spawning Claude Code, events streaming to terminal |
| 1:30  | P2: video-frame-reader tested on sample video, SKILL.md produced |
| 1:30  | P3: UI shell with left/right panels, mock SSE data flowing |
| 2:30  | P1: video upload + full pipeline: prompt → SKILL.md written → SSE streamed |
| 2:30  | P2: browser-tools replaying a hand-written SKILL.md in Chrome |
| 3:00  | **Integration**: wire backend → frontend, SKILL.md appearing in right panel |
| 3:30  | End-to-end demo: attach video → SKILL.md generated → "replay" works |
| 4:00+ | Polish: tool pills, error states, demo prep |

---

## 11. Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude Code subprocess hard to wrap for SSE | Streaming broken | Pipe stdout line-by-line; Claude Code outputs NDJSON — same pattern Manimate uses |
| `video-frame-reader` slow on long recording | Demo feels slow | Use 30–60s recording for demo; skill already de-dupes frames |
| `browser-tools` CDP can't resolve natural-language steps | Replay fails | Use `browser-pick.js` to pre-validate selectors; keep demo workflow simple |
| SKILL.md not detected by right panel | Panel stays empty | Fire `skill_written` SSE event explicitly when Claude's Write tool targets `SKILL.md` |
| Session workspace collision | Files overwritten | Each session gets `workspaces/<uuid>/` — no shared paths |

---

## 12. Demo Script (Hackathon Presentation)

1. **Open the app** — clean two-panel UI, empty session
2. **Drag the recording** into the prompt box, type: `"use /video-frame-reader on this and create SKILL.md"`
3. **Left panel streams** — tool pills show frame extraction, vision analysis running
4. **Right panel fills in** — SKILL.md appears step by step as Claude writes it
5. **Type a correction** — `"step 3 is wrong, the user scrolled before clicking"` — Claude edits SKILL.md, right panel updates
6. **Type `"replay the workflow"`** — left panel shows Claude invoking browser-tools, Chrome executes the steps live
7. **Mic drop** — "You showed it once. The AI watched it. Now it runs forever."

---

## 13. Success Criteria (Hackathon)

- [ ] User can attach a video and get `SKILL.md` generated via Claude Code + `/video-frame-reader`
- [ ] Left panel streams Claude Code output in real-time (tool pills, assistant text)
- [ ] Right panel shows `SKILL.md` content, updating as Claude writes it
- [ ] User can type a correction in the prompt and Claude updates `SKILL.md`
- [ ] `"replay the workflow"` prompt causes Claude to use `browser-tools` to execute the skill in Chrome
- [ ] Full flow works end-to-end in a live demo without touching the terminal
