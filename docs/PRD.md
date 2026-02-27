# PRD: Video Demo → Skill → Agent Workflow

**Product Name:** SkillForge (working title)
**Date:** February 28, 2026
**Team Size:** 3 engineers (hackathon)
**Timeframe:** 1-day build

---

## 1. Problem Statement

Teaching an AI agent to perform a task currently requires manual coding of every step — writing selectors, defining actions, handling edge cases. This is slow, brittle, and inaccessible to non-developers.

**Users should be able to show a workflow once and have an agent replicate it forever.**

---

## 2. Product Vision

A tool where a user **records a screen demo** of any workflow, and the system automatically generates an **editable skill in markdown** that an **agent can replay** on demand. The user is always in control — they can read, edit, and refine the skill before the agent runs it.

---

## 3. User Flow

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│  1. RECORD   │ ──▶ │  2. PROCESS  │ ──▶ │  3. EDIT     │ ──▶ │  4. REPLAY  │
│  Screen demo │     │  Video→Skill │     │  Markdown +  │     │  Agent runs │
│              │     │  (loading)   │     │  Visual flow │     │  the skill  │
└─────────────┘     └──────────────┘     └──────────────┘     └─────────────┘
```

### Step-by-step:

1. **User presses Record** — screen recording begins (browser-based or CLI tool)
2. **User performs the workflow** — e.g. filling out a form, navigating between pages, clicking buttons
3. **User presses Stop** — recording ends, video is sent to backend
4. **Processing begins** — CLI tool launches, loading state with progress ("Extracting frames...", "Analyzing actions...", "Generating skill...")
5. **Skill is generated** — displayed as editable markdown with a side-by-side visual flow (JSON-powered node diagram)
6. **User reviews and edits** — can modify steps, reorder, add/remove actions directly in the markdown
7. **User presses Replay** — agent executes the skill step-by-step, doing exactly the same thing

---

## 4. Core Architecture

### 4.1 Pipeline Overview

```
Video (mp4/webm)
    │
    ▼
Frame Extraction (keyframe detection on UI changes)
    │
    ▼
Parallel Mistral Vision Calls (fan-out: N frames concurrently)
    │
    ▼
Frame Descriptions (what's on screen, what changed, what action)
    │
    ▼
Mistral Synthesis Call (merge all frame descriptions → skill)
    │
    ▼
Skill Markdown (human-readable, editable)
    │
    ▼
JSON Conversion (for UI visualization / node diagram)
    │
    ▼
Agent Replay Engine (Playwright browser automation)
```

### 4.2 Skill Format: Markdown-First

The skill is stored and edited as **markdown**. This is the source of truth.

```markdown
# Skill: Sign Up Form Validation

## Context
- URL: https://app.example.com/signup
- Browser: Chrome
- Purpose: Complete the sign-up form and verify validation works

## Steps

1. **Navigate** to `https://app.example.com/signup`
2. **Click** on the "Email" input field
3. **Type** `test@example.com` into the email field
4. **Click** on the "Password" input field
5. **Type** `SecurePass123!` into the password field
6. **Click** the "Create Account" button
7. **Wait** for page to load (max 5s)
8. **Verify** success message: "Account created successfully"

## Notes
- Step 6 triggers client-side validation before submission
- If validation fails, error messages appear inline
```

**Why markdown:**
- Readable by humans and LLMs
- Easy to edit in any text editor
- Mistral generates natural text far more reliably than structured JSON
- Version-controllable (git-friendly)
- Low friction for users to modify

### 4.3 JSON Visualization Schema

The markdown is parsed into JSON for the visual flow editor:

```json
{
  "skill_name": "Sign Up Form Validation",
  "context": {
    "url": "https://app.example.com/signup",
    "browser": "Chrome"
  },
  "steps": [
    {
      "id": 1,
      "action": "navigate",
      "target": "https://app.example.com/signup",
      "raw_markdown": "**Navigate** to `https://app.example.com/signup`"
    },
    {
      "id": 2,
      "action": "click",
      "target": "Email input field",
      "raw_markdown": "**Click** on the \"Email\" input field"
    },
    {
      "id": 3,
      "action": "type",
      "target": "email field",
      "value": "test@example.com",
      "raw_markdown": "**Type** `test@example.com` into the email field"
    },
    {
      "id": 4,
      "action": "click",
      "target": "Password input field",
      "raw_markdown": "**Click** on the \"Password\" input field"
    },
    {
      "id": 5,
      "action": "type",
      "target": "password field",
      "value": "SecurePass123!",
      "raw_markdown": "**Type** `SecurePass123!` into the password field"
    },
    {
      "id": 6,
      "action": "click",
      "target": "Create Account button",
      "raw_markdown": "**Click** the \"Create Account\" button"
    },
    {
      "id": 7,
      "action": "wait",
      "condition": "page load",
      "timeout_ms": 5000,
      "raw_markdown": "**Wait** for page to load (max 5s)"
    },
    {
      "id": 8,
      "action": "verify",
      "expected": "Account created successfully",
      "raw_markdown": "**Verify** success message: \"Account created successfully\""
    }
  ]
}
```

### 4.4 Action Types

| Action       | Description                          | Parameters                     |
|------------- |--------------------------------------|-------------------------------|
| `navigate`   | Go to a URL                          | `target` (URL)                |
| `click`      | Click an element                     | `target` (description/selector)|
| `type`       | Enter text into a field              | `target`, `value`             |
| `wait`       | Wait for a condition                 | `condition`, `timeout_ms`     |
| `verify`     | Assert something is true on page     | `expected` (text/condition)   |
| `scroll`     | Scroll the page                      | `direction`, `amount`         |
| `select`     | Choose from a dropdown               | `target`, `value`             |
| `hover`      | Hover over an element                | `target`                      |
| `keypress`   | Press a keyboard key                 | `key` (e.g. "Enter", "Tab")  |

---

## 5. Technical Implementation

### 5.1 Video Processing & Frame Extraction

**Input:** Screen recording (mp4/webm)
**Output:** Ordered list of keyframes with timestamps

- Use `ffmpeg` or OpenCV for frame extraction
- **Intelligent sampling**: detect significant UI changes between frames (pixel diff / structural similarity) rather than fixed-interval extraction
- Target: 10-30 keyframes for a typical 1-2 minute demo
- Each frame saved as PNG with timestamp metadata

```python
# Pseudocode
frames = extract_all_frames(video, fps=2)  # 2fps baseline
keyframes = []
for i, frame in enumerate(frames):
    if i == 0 or structural_diff(frame, keyframes[-1]) > THRESHOLD:
        keyframes.append(frame)
```

### 5.2 Parallel Mistral Vision Analysis

**Input:** Keyframes
**Output:** Per-frame action descriptions

- Fan-out: send all keyframes to Mistral vision API concurrently (async)
- Each call asks: "What is shown on this screen? What UI element is being interacted with? What action is the user performing?"
- Use `asyncio.gather()` or equivalent for parallel execution
- Stream partial results back to frontend as they complete

```python
# Pseudocode
async def analyze_frame(frame, index):
    response = await mistral.chat(
        model="mistral-large-latest",
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "data": frame},
                {"type": "text", "text": FRAME_ANALYSIS_PROMPT}
            ]
        }]
    )
    return {"index": index, "description": response.text}

# Fan-out all frames in parallel
results = await asyncio.gather(*[
    analyze_frame(frame, i) for i, frame in enumerate(keyframes)
])
```

**Frame Analysis Prompt:**
```
You are analyzing a screenshot from a screen recording of a user performing a task.

Describe:
1. What application/website is shown
2. What UI element is the user interacting with (if any)
3. What action is being performed (click, type, scroll, navigate, etc.)
4. Any text being entered or displayed
5. What changed compared to what you'd expect from the previous step

Be specific about element locations and identifiers (button text, field labels, URLs).
```

### 5.3 Skill Synthesis (Markdown Generation)

**Input:** Ordered frame descriptions
**Output:** Skill markdown document (streamed)

Single Mistral call that takes all frame descriptions and produces the skill:

```python
synthesis_prompt = f"""
You are generating a replayable skill document from a series of screen recording frames.

Frame descriptions (in order):
{formatted_frame_descriptions}

Generate a skill in this exact markdown format:

# Skill: [descriptive name]

## Context
- URL: [starting URL]
- Browser: [browser if visible]
- Purpose: [what this workflow accomplishes]

## Steps

1. **[Action]** [description with specific targets and values]
2. **[Action]** [description]
...

## Notes
- [any important observations about timing, validation, edge cases]

Rules:
- Each step must start with a bold action word: Navigate, Click, Type, Wait, Verify, Scroll, Select, Hover, Keypress
- Include exact text/values in backticks
- Include specific element descriptions (use label text, placeholder text, or visual description)
- Merge redundant frames (e.g. multiple frames of typing = one Type step)
- Keep steps atomic — one action per step
"""
```

### 5.4 Markdown ↔ JSON Parser

Bidirectional conversion so edits in either view stay synced:

**Markdown → JSON:**
- Parse numbered list items
- Extract bold action word as `action`
- Extract backtick content as `value` or `target`
- Extract quoted strings as element descriptions

**JSON → Markdown:**
- Reconstruct numbered list from step objects
- Preserve formatting conventions

```python
import re

def parse_skill_markdown(md: str) -> dict:
    steps = []
    for match in re.finditer(
        r'(\d+)\.\s+\*\*(\w+)\*\*\s+(.*)', md
    ):
        step = {
            "id": int(match.group(1)),
            "action": match.group(2).lower(),
            "raw_markdown": match.group(0),
            "description": match.group(3)
        }
        # Extract backtick values
        backticks = re.findall(r'`([^`]+)`', step["description"])
        if backticks:
            step["value"] = backticks[0]
        steps.append(step)
    return {"steps": steps}
```

### 5.5 Agent Replay Engine

**Input:** Skill JSON (parsed from markdown)
**Output:** Executed workflow in browser

Uses Playwright to replay each step:

```python
from playwright.async_api import async_playwright

async def replay_skill(skill_json: dict):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        for step in skill_json["steps"]:
            action = step["action"]

            if action == "navigate":
                await page.goto(step["value"])

            elif action == "click":
                # Use Mistral to resolve description → selector at runtime
                element = await find_element(page, step["description"])
                await element.click()

            elif action == "type":
                element = await find_element(page, step["description"])
                await element.fill(step["value"])

            elif action == "wait":
                await page.wait_for_timeout(step.get("timeout_ms", 3000))

            elif action == "verify":
                content = await page.content()
                assert step["expected"] in content

            # Screenshot after each step for debugging
            await page.screenshot(path=f"step_{step['id']}.png")
```

**Element Resolution:** The agent uses Mistral vision at runtime to match the natural-language element description to an actual DOM element — screenshot the page, ask Mistral to identify the element, extract coordinates or generate a selector.

---

## 6. API Endpoints

| Method | Endpoint               | Description                              | Input                  | Output                          |
|--------|------------------------|------------------------------------------|------------------------|---------------------------------|
| POST   | `/api/upload-video`    | Upload screen recording                  | Video file (mp4/webm)  | `{ job_id }`                    |
| GET    | `/api/status/{job_id}` | SSE stream of processing progress        | —                      | Stream: progress events         |
| GET    | `/api/skill/{job_id}`  | Get generated skill markdown             | —                      | `{ markdown, json, frames[] }`  |
| PUT    | `/api/skill/{job_id}`  | Update skill (user edits)                | `{ markdown }`         | `{ json }` (re-parsed)          |
| POST   | `/api/replay/{job_id}` | Trigger agent replay                     | `{ skill_json }`       | SSE stream: step-by-step status |

---

## 7. UI Specification

### 7.1 Screen 1: Record

- Large centered **Record** button (red circle)
- "Record your workflow" heading
- Option to upload existing video file
- Minimal UI — get out of the way

### 7.2 Screen 2: Processing

- Animated loading state ("vibe" — the CLI-launching feel)
- Progress indicators streamed from backend:
  - "Extracting key frames... (12 found)"
  - "Analyzing frame 3/12..."
  - "Generating skill..."
- Thumbnail strip of extracted keyframes appearing as they're processed

### 7.3 Screen 3: Edit (Main View)

**Split-pane layout:**

```
┌─────────────────────────┬─────────────────────────┐
│                         │                         │
│   MARKDOWN EDITOR       │   VISUAL FLOW           │
│                         │                         │
│   # Skill: Form Valid   │   ┌──────────┐          │
│                         │   │ Navigate │          │
│   ## Steps              │   └────┬─────┘          │
│                         │        │                │
│   1. **Navigate** to    │   ┌────▼─────┐          │
│      `https://...`      │   │  Click   │          │
│   2. **Click** on the   │   └────┬─────┘          │
│      email field        │        │                │
│   3. **Type** `test@..  │   ┌────▼─────┐          │
│                         │   │   Type   │          │
│                         │   └────┬─────┘          │
│                         │        │                │
│                         │        ▼                │
│                         │       ...               │
│                         │                         │
├─────────────────────────┴─────────────────────────┤
│                                                   │
│   [ ▶ Replay ]                    [ Save Skill ]  │
│                                                   │
└───────────────────────────────────────────────────┘
```

- **Left pane:** Full markdown editor (syntax highlighted, directly editable)
- **Right pane:** Node/flow diagram generated from JSON (visual representation of steps with arrows)
- **Synced:** Edits in markdown instantly update the flow diagram and vice versa
- **Replay button:** Triggers the agent to execute
- **Save button:** Persists the skill for future use

### 7.4 Screen 4: Replay

- Browser window showing the agent executing steps in real-time
- Step-by-step progress indicator (highlights current step in the flow)
- Pause/Stop controls
- Screenshot capture at each step for audit trail

---

## 8. Hackathon Work Split

### Person 1: Video → Frames → Descriptions (Backend Pipeline)

**Scope:**
- Video upload endpoint (`/api/upload-video`)
- Frame extraction with keyframe detection (ffmpeg + OpenCV)
- Parallel Mistral vision API calls for frame analysis
- SSE streaming of progress to frontend
- Frame analysis prompt engineering

**Deliverables:**
- `POST /api/upload-video` → returns `job_id`
- `GET /api/status/{job_id}` → SSE stream with frame descriptions
- Extracted frames stored with metadata

**Tech:** Python, FastAPI, ffmpeg, OpenCV, Mistral API, asyncio

### Person 2: Skill Engine + Replay (Core Logic)

**Scope:**
- Mistral synthesis prompt: frame descriptions → skill markdown
- Markdown ↔ JSON bidirectional parser
- Skill CRUD endpoints (`GET/PUT /api/skill/{job_id}`)
- Agent replay engine with Playwright
- Replay streaming endpoint (`POST /api/replay/{job_id}`)

**Deliverables:**
- Skill generation from frame descriptions
- Parser that converts markdown ↔ JSON reliably
- Working replay engine for core action types (navigate, click, type, wait, verify)
- Replay SSE stream with step status

**Tech:** Python, FastAPI, Playwright, Mistral API, regex parser

### Person 3: Frontend & UI

**Scope:**
- Record screen (MediaRecorder API / file upload)
- Processing loading screen with SSE progress
- Split-pane editor: markdown editor + visual flow diagram
- Bidirectional sync between markdown and flow views
- Replay controls and step-by-step visualization

**Deliverables:**
- Full 4-screen UI flow (Record → Process → Edit → Replay)
- Markdown editor with syntax highlighting
- Flow diagram component (React Flow or similar)
- SSE client for streaming progress and replay status

**Tech:** React/Next.js, React Flow, CodeMirror (markdown editor), SSE client

---

## 9. Integration Timeline

| Time    | Milestone                                                    |
|---------|--------------------------------------------------------------|
| 0:00    | Align on this PRD, skill schema, API contracts               |
| 0:15    | Everyone starts building in parallel                         |
| 1:30    | Person 1: frame extraction working, Mistral calls returning  |
| 1:30    | Person 2: parser working on sample markdown, Playwright PoC  |
| 1:30    | Person 3: UI shell with all 4 screens, mock data flowing     |
| 2:30    | Person 1: full pipeline end-to-end (video → frame descs)     |
| 2:30    | Person 2: skill generation + replay working on mock data     |
| 3:00    | **Integration point**: wire Person 1 output → Person 2 input |
| 3:30    | **Integration point**: wire backend → Person 3 frontend      |
| 4:00    | End-to-end demo working                                      |
| 4:00+   | Polish, edge cases, demo prep                                |

---

## 10. Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mistral vision inaccurate on complex UIs | Steps are wrong/incomplete | Editable markdown lets user fix; pick a simple demo for hackathon |
| Parallel API calls hit rate limits | Processing is slow | Batch in groups of 5, add retry logic with backoff |
| Element resolution fails during replay | Agent can't find buttons/fields | Fallback: screenshot + Mistral vision at runtime to locate elements |
| Markdown parser breaks on edge cases | JSON out of sync | Keep parser simple, validate with test cases, use `raw_markdown` fallback |
| Screen recording API limitations | Can't capture certain content | Offer file upload as alternative to browser recording |

---

## 11. Demo Script (Hackathon Presentation)

1. **Open the app** — show the clean record screen
2. **Record a workflow** — fill out a simple sign-up form (30 seconds)
3. **Stop recording** — show the processing animation with real progress
4. **Show generated skill** — markdown appears with correct steps
5. **Edit a step** — change the email address in the markdown, show flow updates
6. **Press Replay** — watch the agent fill out the form automatically with the edited values
7. **Mic drop** — "You showed it once. It runs forever."

---

## 12. Future Scope (Post-Hackathon)

- **Skill library**: save and share skills across teams
- **Parameterization**: turn hardcoded values into variables (e.g. email becomes `{{user_email}}`)
- **Branching logic**: conditional steps (if validation fails → do X)
- **Multi-page workflows**: complex flows across multiple applications
- **Scheduled execution**: run skills on a cron schedule
- **Error recovery**: automatic retry and fallback strategies
- **Skill composition**: chain multiple skills into larger workflows
- **Natural language editing**: "change step 3 to use a different email" via chat

---

## 13. Success Criteria (Hackathon)

- [ ] User can record a screen demo and upload it
- [ ] System extracts frames and generates a skill markdown in < 60 seconds
- [ ] Skill is displayed as editable markdown with a visual flow diagram
- [ ] User can edit steps in the markdown
- [ ] Agent can replay at least a simple form-filling workflow end-to-end
- [ ] The whole flow works in a live demo without manual intervention
