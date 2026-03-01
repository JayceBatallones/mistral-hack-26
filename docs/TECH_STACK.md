# Tech Stack: Ditto follows Manimate exactly

This project is built on the same stack as Manimate (`./Manimate`). Read Manimate's source as the reference implementation. When in doubt, copy the pattern — don't invent a new one.

---

## 1. Package versions (copy from Manimate's `package.json`)

```json
{
  "dependencies": {
    "next": "16.1.5",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.5",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.0.18"
  }
}
```

No extra dependencies unless absolutely necessary. The goal is to stay in sync with Manimate so components can be ported with minimal friction.

---

## 2. Framework: Next.js 16 App Router

- All routes live under `src/app/`
- API routes are Next.js Route Handlers (`src/app/api/**/route.ts`)
- `"use client"` on components that need browser APIs (state, events, SSE reading)
- Server components for everything else

**Manimate reference:** `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/api/`

---

## 3. Language: TypeScript (strict mode)

`tsconfig.json` — copy verbatim from Manimate:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  }
}
```

Use `@/` alias for all internal imports. Never use relative `../../` imports.

---

## 4. Styling: Tailwind CSS v4

Tailwind v4 has no config file. All configuration is done in CSS via `@theme`:

```css
/* src/app/globals.css */
@import "tailwindcss";

:root {
  /* Semantic color tokens — copy from Manimate */
  --bg-main:          #f8f8f7;
  --bg-card:          #fafafa;
  --bg-sidebar:       #ebebeb;
  --bg-hover:         #f0f0ef;
  --bg-active:        #e8e8e6;

  --text-primary:     #34322d;
  --text-secondary:   #5e5e5b;
  --text-tertiary:    #858481;
  --text-placeholder: #acacaa;

  --border-main:      rgba(0,0,0,0.06);
  --border-input:     rgba(0,0,0,0.12);

  --accent:           #40E0D0;
  --accent-hover:     #33b3a6;
  --accent-muted:     rgba(64,224,208,0.15);

  --green:  #16a34a;
  --yellow: #d97706;
  --red:    #dc2626;
  --blue:   #0081f2;

  --font: -apple-system, "system-ui", "Segoe UI Variable Display", "Segoe UI",
          Helvetica, "Apple Color Emoji", Arial, sans-serif;
}

@theme inline {
  --color-background: var(--bg-main);
  --color-foreground: var(--text-primary);
}
```

Use CSS variables for all colors (`var(--text-primary)`) — never hardcode hex values in component files. Tailwind utility classes are used for layout, spacing, and sizing only.

---

## 5. SSE Streaming

### Backend — `TransformStream` + NDJSON

Claude Code CLI outputs NDJSON (one JSON object per line) to stdout. The backend reads stdout, parses it with `parseNDJSONChunk`, and re-emits as SSE.

**Manimate reference:** `src/lib/ndjson-parser.ts`, `src/lib/local/chat.ts`

```typescript
// src/lib/ndjson-parser.ts — copy verbatim from Manimate
export function parseNDJSONChunk(buffer: string, chunk: string): ParseResult {
  const combined = buffer + chunk;
  const lastNewlineIndex = combined.lastIndexOf('\n');
  if (lastNewlineIndex === -1) return { lines: [], remainder: combined };
  // ... parse complete lines, carry remainder
}
```

```typescript
// src/app/api/chat/route.ts
export async function POST(request: NextRequest): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: SSEEvent) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  // Spawn Claude Code, pipe stdout → sendEvent
  // ...

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

### Frontend — `ReadableStream` + `TextDecoder`

**Manimate reference:** `src/app/page.tsx` lines ~1044–1178

```typescript
const response = await fetch("/api/chat", { method: "POST", body: ... });
const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const event: SSEEvent = JSON.parse(line.slice(5).trimStart());
    // dispatch to UI state
  }
}
```

No SSE libraries. No `EventSource`. Raw `fetch` + `ReadableStream` only — exactly as Manimate does it.

---

## 6. SSE Event Types

Adapt Manimate's `SSEEvent` type (`src/lib/types.ts`) for this project's events. Keep the same shape — just swap Manimate-specific fields for Ditto ones:

```typescript
// src/lib/types.ts
export interface SSEEvent {
  type:
    | "system_init"
    | "assistant_text"
    | "tool_use"
    | "tool_result"
    | "skill_written"   // replaces "complete" with video_url — fires when SKILL.md written/updated
    | "complete"
    | "error";
  message: string;
  session_id?: string;
  claude_session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: string;
  is_error?: boolean;
  model?: string;
  tools?: string[];
}

export interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: SSEEvent["type"];
  message: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  isError?: boolean;
  turnId?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  attachments?: VideoAttachment[];  // replaces ImageAttachment
}

export interface VideoAttachment {
  id: string;
  path: string;    // local filesystem path in session workspace
  name: string;
  size: number;
  type: string;    // MIME type (video/mp4, video/quicktime, etc.)
}
```

---

## 7. Process Spawning: Claude Code CLI

**Manimate reference:** `src/lib/local/runtime.ts`

Claude Code is launched as a child process. Its stdout is NDJSON — each line is a JSON event.

```typescript
// src/lib/local/runtime.ts — adapt from Manimate
import { spawn } from "node:child_process";

export function spawnClaudeProcess(opts: {
  prompt: string;
  sessionWorkspace: string;
  claudeSessionId?: string;
}): ChildProcessWithoutNullStreams {
  const args = [
    "--output-format", "stream-json",
    "--print",
    opts.prompt,
  ];
  if (opts.claudeSessionId) {
    args.push("--resume", opts.claudeSessionId);
  }

  return spawn("claude", args, {
    cwd: opts.sessionWorkspace,   // Claude Code runs in the session workspace
    env: {
      ...process.env,
      // do not pass through API keys if not needed
    },
  });
}
```

Key point: `cwd` is the **session workspace directory** — this is where Claude Code writes `SKILL.md` and where skills are resolved from.

---

## 8. Session Management

**Manimate reference:** `src/app/page.tsx`, `src/app/api/sessions/`, `src/lib/local/db.ts`

Sessions use:
- **UUID** generated with `crypto.randomUUID()`
- **URL query param** `?session=<uuid>` for per-tab isolation
- **SQLite** (Node.js built-in `node:sqlite` — no external ORM) for persistence
- **Per-session workspace directory** on disk: `workspaces/<session_id>/`

```typescript
// Session row (simplified from Manimate's LocalSession)
export interface LocalSession {
  id: string;                    // UUID
  claude_session_id: string | null;  // for --resume continuity
  skill_content: string | null;  // latest SKILL.md content (cached)
  created_at: string;
  updated_at: string;
}
```

```typescript
// Workspace layout per session
workspaces/
  <session_id>/
    SKILL.md              ← written by Claude Code
    uploads/
      luma_login_test.mov ← user-attached video
    luma_login_test_keyframes/
      key_0001.jpg ...    ← extracted by video-frame-reader
```

Session switching via `router.push(`/?session=${id}`)` — same as Manimate.

---

## 9. Database: Node.js built-in SQLite

**Manimate reference:** `src/lib/local/db.ts`

Uses `node:sqlite` (built into Node.js 22+) — no `better-sqlite3`, no `prisma`.

```typescript
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    claude_session_id TEXT,
    skill_content TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);
```

Synchronous API only (`DatabaseSync`) — no async DB calls. Keeps the code simple.

---

## 10. Components: port from Manimate directly

These components transfer almost unchanged. Adapt props and remove Manimate-specific fields:

| Manimate component | Ditto use | Changes |
|-------------------|----------------|---------|
| `SplitPanel.tsx` | Split layout (left chat / right SKILL.md) | **Copy verbatim** — no changes needed |
| `ChatInput.tsx` | Prompt input + video attachment | Change `accept="image/*"` → `accept="video/*,.mov,.mp4,.webm"`. Remove image grid preview, add video filename chip |
| `ChatMessages.tsx` | Left panel: activity stream | Remove image lightbox. Keep tool pills, assistant text, auto-scroll |
| `PreviewPanel.tsx` | Right panel: SKILL.md viewer | Replace Plan/Code/Video tabs with single SKILL.md markdown view. Use `react-markdown` |
| `SessionsSidebar.tsx` | Session switcher | **Copy verbatim** — only session title display changes |

### SplitPanel — copy verbatim

```typescript
// Manimate's SplitPanel.tsx handles drag-to-resize between panels.
// Default left width 40%, min 20%, max 80%.
// No changes needed for Ditto.
<SplitPanel
  leftPanel={<ChatPanel />}
  rightPanel={<SkillPanel />}
  defaultLeftWidth={45}
/>
```

### PreviewPanel → SkillPanel

Replace Manimate's tabbed Plan/Code/Video panel with a single markdown view:

```typescript
// src/components/SkillPanel.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function SkillPanel({ content }: { content: string | null }) {
  if (!content) return <EmptyState />;
  return (
    <div className="h-full overflow-y-auto p-6 font-mono text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
```

Right panel updates when the frontend receives a `skill_written` SSE event — it fetches `/api/files?session_id=&path=SKILL.md` and re-renders.

---

## 11. File Serving: `/api/files`

**Manimate reference:** `src/app/api/files/route.ts`

Serves files from the session workspace directory by path. Used by the right panel to fetch `SKILL.md`.

```typescript
// src/app/api/files/route.ts
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const filePath = request.nextUrl.searchParams.get("path");
  const fullPath = path.join(WORKSPACES_DIR, sessionId, filePath);
  const content = await fs.readFile(fullPath, "utf-8");
  return new Response(content, { headers: { "Content-Type": "text/plain" } });
}
```

---

## 12. Video Upload: `/api/chat/uploads`

**Manimate reference:** `src/app/api/chat/uploads/route.ts` (handles `FormData` image uploads)

Same pattern, accept video instead of images:

```typescript
// src/app/api/chat/uploads/route.ts
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const sessionId = formData.get("session_id") as string;

  const uploadDir = path.join(WORKSPACES_DIR, sessionId, "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(uploadDir, file.name);
  await fs.writeFile(filePath, buffer);

  return NextResponse.json({ path: filePath, name: file.name, size: file.size });
}
```

---

## 13. Project directory layout

Mirror Manimate's `src/` structure exactly:

```
src/
  app/
    page.tsx                  ← main UI (adapts Manimate's page.tsx)
    layout.tsx                ← root layout
    globals.css               ← Tailwind v4 + CSS variables
    api/
      chat/
        route.ts              ← SSE endpoint (spawn Claude Code)
        uploads/
          route.ts            ← video file upload
      cancel/
        route.ts              ← cancel active run
      sessions/
        route.ts              ← list / create sessions
        [id]/
          route.ts            ← get session
      files/
        route.ts              ← serve files from workspace
  components/
    SplitPanel.tsx            ← copy from Manimate verbatim
    ChatInput.tsx             ← adapt from Manimate (video instead of image)
    ChatMessages.tsx          ← adapt from Manimate (remove image lightbox)
    SkillPanel.tsx            ← new (replaces PreviewPanel — shows SKILL.md)
    SessionsSidebar.tsx       ← copy from Manimate verbatim
  lib/
    types.ts                  ← SSEEvent, ActivityEvent, Message, VideoAttachment
    ndjson-parser.ts          ← copy from Manimate verbatim
    local/
      chat.ts                 ← SSE handler (adapt from Manimate)
      db.ts                   ← SQLite sessions/messages (adapt from Manimate)
      runtime.ts              ← spawn Claude Code process (adapt from Manimate)
      config.ts               ← workspace paths
```

---

## 14. What NOT to add

- No Redux, Zustand, or external state management — React `useReducer` + `useState` only (as Manimate does)
- No Prisma, Drizzle, or ORMs — `node:sqlite` only
- No WebSockets — SSE only
- No Playwright or Puppeteer in the web app — browser automation is done by Claude Code via `browser-tools` skill, not the web server
- No diagram libraries (mermaid, react-flow, draw.io) in MVP — right panel shows raw SKILL.md markdown; visualization is a stretch goal
- No additional npm packages without team agreement
