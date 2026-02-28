# Setup & Workflow Generation Guide

This document captures how to install the required skills and how the system turns a screen recording into a `SKILL.md` workflow file. It maps directly to what the UI shows: **left panel = this process live**, **right panel = the generated `SKILL.md`**.

---

## 1. Install Skills (Project-Level)

Skills live in `.claude/skills/` inside the project. Nothing is installed globally.

### browser-tools

Provides CDP-based browser automation (navigate, click, eval, screenshot) via Chrome on `:9222`.

```bash
# Clone or copy pi-skills into the project root
# Source: https://github.com/badlogic/pi-skills/tree/main/browser-tools

# Create the symlink in .claude/skills/
cd .claude/skills
ln -s ../../pi-skills/browser-tools browser-tools

# Install Node.js dependencies
cd ../../pi-skills/browser-tools
npm install
```

**Verify:**
```bash
ls .claude/skills/browser-tools   # should list browser-nav.js, browser-eval.js, etc.
```

### video-frame-reader

Extracts keyframes from a video and analyzes them with Claude's vision. Requires `ffmpeg` and Python 3.

```bash
# Source: https://github.com/Yusuke710/yusuke-claude-code/tree/main/plugins/video-frame-reader

# Create skill directory and copy the extraction script
mkdir -p .claude/skills/video-frame-reader/scripts
cp <plugin-cache>/scripts/extract_keyframes.py .claude/skills/video-frame-reader/scripts/

# Copy SKILL.md (already present after running these steps once)
# It lives at: .claude/skills/video-frame-reader/SKILL.md

# Create Python venv and install dependencies (first time only)
cd .claude/skills/video-frame-reader/scripts
python3 -m venv venv
source venv/bin/activate
pip install Pillow numpy --quiet
```

**Verify:**
```bash
ls .claude/skills/video-frame-reader/
# scripts/   SKILL.md

ls .claude/skills/video-frame-reader/scripts/
# extract_keyframes.py   venv/
```

**Requires `ffmpeg` on PATH:**
```bash
brew install ffmpeg   # macOS
```

---

## 2. Generate a SKILL.md from a Screen Recording

This is the core workflow. Given a `.mov` / `.mp4` screen recording, it produces a human-readable `SKILL.md` that a coding agent can replay.

### Step 1 — Extract keyframes

```bash
source .claude/skills/video-frame-reader/scripts/venv/bin/activate
python3 .claude/skills/video-frame-reader/scripts/extract_keyframes.py "<path-to-video>"
```

The script outputs JSON with frame count, token estimate, and file paths:

```json
{
  "keyframe_count": 32,
  "image_size": "576x324",
  "total_tokens": 7744,
  "cost_usd_sonnet": 0.023,
  "cost_usd_haiku": 0.0077,
  "files": ["luma_login_test_keyframes/key_0001.jpg", "..."]
}
```

> For `luma_login_test.mov`: 1,069 total frames → **32 keyframes** (97% reduction)

### Step 2 — Analyze frames with vision

A subagent reads all keyframe images and produces a chronological description of the workflow — what's on screen, what action was performed, what UI elements are involved.

**Prompt used for luma_login_test.mov:**
```
Analyze the workflow being performed in this screen recording so we can write
a SKILL.md that a coding agent can replay step-by-step using browser automation.

For each frame describe:
1. What is shown (URL, page state, visible UI elements)
2. What action was just performed or is about to be performed
3. Any text typed, buttons clicked, or navigation events
```

### Step 3 — Synthesize SKILL.md

The frame descriptions are merged into a `SKILL.md` file — natural language steps, specific enough for a browser agent to act on (button text, input selectors, headings to verify).

---

## 3. Example: luma_login_test.mov → SKILL.md

**Video:** `luma_login_test.mov`
**Frames:** 32 keyframes from a Luma login via Google OAuth session

**What the analysis found:**
| Frame range | What happened |
|-------------|---------------|
| 0001 | Luma login page — email input + "Continue with Email" button |
| 0002–0003 | Email typed: `ashk.0704@gmail.com`, autocomplete dismissed |
| 0004–0006 | Optional "Guest Passcode" modal appeared and was dismissed |
| 0007–0008 | "Continue with Email" clicked, page loading |
| 0009–0023 | Google "Choose an account" page — account `yusuke0704@gmail.com` selected |
| 0024 | Luma confirmation dialog: "You're signing back in to Luma" → "Confirm" clicked |
| 0025–0028 | "Linking Google Account" loading screen |
| 0029–0032 | Luma Events page loading (skeleton → partial → fully loaded) |

**Output:** `SKILL.md` at project root — 12 steps covering navigation, email entry, OAuth redirect, account selection, confirmation, and load verification.

---

## 4. Replay the Workflow

Once `SKILL.md` exists, ask Claude Code in the prompt:

```
replay the workflow
```

Claude Code reads `SKILL.md` and uses `browser-tools` to execute each step in Chrome:

```bash
# Start Chrome with remote debugging (required before replay)
node .claude/skills/browser-tools/browser-start.js

# Claude Code then drives:
node .claude/skills/browser-tools/browser-nav.js https://lu.ma
node .claude/skills/browser-tools/browser-eval.js '<js to interact>'
node .claude/skills/browser-tools/browser-screenshot.js   # to verify state
```

No manual coding needed — Claude Code reads the natural-language steps and translates them into browser actions.

---

## 5. Project Skill Layout (final state)

```
.claude/
└── skills/
    ├── browser-tools -> ../../pi-skills/browser-tools   (symlink)
    └── video-frame-reader/
        ├── SKILL.md
        └── scripts/
            ├── extract_keyframes.py
            └── venv/

pi-skills/
└── browser-tools/
    ├── browser-nav.js
    ├── browser-eval.js
    ├── browser-screenshot.js
    ├── browser-pick.js
    ├── browser-start.js
    ├── browser-content.js
    ├── browser-cookies.js
    ├── node_modules/
    └── package.json

SKILL.md                  ← generated workflow (shown in right panel)
luma_login_test.mov       ← source recording
luma_login_test_keyframes/
    key_0001.jpg ... key_0032.jpg
```
