# Ditto

**Show Ditto once. Ditto copies you forever.**

Ditto is built for non-technical professionals who need to automate computer workflows without writing a single line of code. Record yourself doing a task exactly as you normally would. Ditto watches, understands, and turns it into an autonomous agent that runs the same workflow — with the same precision — on any schedule you set.

---

## How it works

### 1. Record your workflow
Screen-record yourself doing anything: filling out a form, pulling a report, copying data between apps, booking a meeting. No special setup. Just do your job as you normally would and save the recording.

### 2. Ditto watches and understands
Drop the recording into Ditto. It splits the video into intelligent keyframes and launches **parallel vision agents powered by Mistral** to analyze each frame. The agents figure out what's on screen, what you clicked, what you typed, and what happened as a result.

### 3. Review a human-readable workflow
Ditto stitches everything into a clean, step-by-step `SKILL.md` — a plain-English description of your workflow. Read it, edit it, approve it. No code, no config files, no jargon.

### 4. One click to run it forever
Hit replay. Ditto drives a real browser through every step with the same precision you showed it. Set a schedule, hand it to a teammate, or trigger it on demand. They're running the same process by the afternoon.

---

## The technology

| Layer | What it does |
|---|---|
| **Video analysis** | `ffmpeg` extracts keyframes; a Python vision pipeline deduplicates and optimizes them |
| **Mistral vision agents** | Parallel agents analyze each keyframe to identify UI state, user actions, and intent |
| **Workflow synthesis** | Claude stitches agent output into a structured, human-readable `SKILL.md` |
| **Browser automation** | Claude Code's browser-tools drive Chrome via Chrome DevTools Protocol for autonomous replay |

---

## Prerequisites

- Node.js 22+
- Claude Code CLI (`claude`) authenticated with an active subscription
- `ffmpeg` (keyframe extraction)
- Python 3 + Pillow + numpy (vision pipeline)
- Chrome with remote debugging enabled (workflow replay)

---

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## Usage

1. **Record** — make a `.mov` or `.mp4` screen recording of your workflow
2. **Upload** — drag it into Ditto or use the paperclip attachment
3. **Analyze** — type `use /video-frame-reader on this and create SKILL.md`
4. **Review** — the generated workflow appears live in the right panel; read, edit, approve
5. **Replay** — type `replay the workflow` and Ditto drives Chrome through every step autonomously

---

## Data layout

Each session gets its own isolated workspace:

```
workspaces/
  <session-id>/
    session.json     # session metadata
    messages.json    # chat history (restored on reload)
    SKILL.md         # generated workflow
```

Sessions and chat history survive page reloads and server restarts. `SKILL.md` is always scoped to the session — never written to the project root.

Override the workspace root with `DITTO_WORKSPACES_DIR` in `.env.local`:

```bash
DITTO_WORKSPACES_DIR=/path/to/your/workspaces
```

---

## Meet Mimi

Mimi is Ditto's analysis companion. She watches your recording, copies every move, and keeps the workflow in sync with `SKILL.md`. Once she's learned a workflow, she can replay it anytime — for you, for your team, forever.
