# Architecture Research: SkillForge

## System Overview

```
                         SkillForge - Single Next.js Application
 ============================================================================

  BROWSER (Client)                    NEXT.JS SERVER (API Routes)
 +---------------------------+       +----------------------------------+
 |                           |       |                                  |
 |  Record Screen            |       |  /api/upload          POST      |
 |  (MediaRecorder API)      | ----> |    - Save video to /tmp          |
 |                           |       |    - Return { jobId }            |
 |                           |       |                                  |
 |  Processing Screen        |       |  /api/process/[jobId] GET (SSE) |
 |  (EventSource client)     | <---- |    - ffmpeg frame extraction     |
 |                           |       |    - vibe CLI vision analysis    |
 |                           |       |    - vibe CLI skill synthesis    |
 |                           |       |    - Stream progress events      |
 |                           |       |                                  |
 |  Edit Screen              |       |  /api/skill/[jobId]   GET/PUT   |
 |  (CodeMirror + ReactFlow) |       |    - Return/update markdown      |
 |                           |       |    - Parse markdown <-> JSON     |
 |                           |       |                                  |
 |  Replay Screen            |       |  /api/replay/[jobId]  POST(SSE) |
 |  (EventSource client)     | <---- |    - vibe CLI executes skill     |
 |                           |       |    - Stream step-by-step status  |
 +---------------------------+       +----------------------------------+
                                              |
                                              | shells out to
                                              v
                                     +------------------+
                                     |  Mistral vibe    |
                                     |  CLI binary      |
                                     |  (vision, synth, |
                                     |   replay)        |
                                     +------------------+
```

There is **no separate backend server**. Next.js API routes handle everything. The vibe CLI is invoked as a child process from API route handlers, similar to how one might call `claude -p "prompt"` from a Node.js `child_process.spawn()`.

---

## Data Flow

The pipeline has 6 stages. Each stage has a clear input/output contract.

```
Stage 1: UPLOAD
  Input:  Video file (mp4/webm) from browser MediaRecorder or file upload
  Output: jobId + video saved to /tmp/jobs/{jobId}/video.webm
  Owner:  Person 1

Stage 2: FRAME EXTRACTION
  Input:  /tmp/jobs/{jobId}/video.webm
  Output: /tmp/jobs/{jobId}/frames/frame-001.png, frame-002.png, ...
  Method: ffmpeg via child_process (extract at 2fps, then deduplicate by pixel diff)
  SSE:    { event: "frames", data: { total: 12, thumbnails: [...] } }
  Owner:  Person 1

Stage 3: VISION ANALYSIS (parallel)
  Input:  Frame PNG files
  Output: /tmp/jobs/{jobId}/descriptions.json (array of { index, description })
  Method: Fan-out N concurrent `vibe` CLI calls, each with a frame image
          vibe -p "Analyze this screenshot..." --image frame-003.png
  SSE:    { event: "analysis", data: { completed: 3, total: 12, latest: "..." } }
  Owner:  Person 1

Stage 4: SKILL SYNTHESIS
  Input:  descriptions.json (ordered frame descriptions)
  Output: /tmp/jobs/{jobId}/skill.md (the generated skill markdown)
  Method: Single `vibe` CLI call with all descriptions as context
          vibe -p "Generate a skill markdown from these frame descriptions..."
  SSE:    { event: "synthesis", data: { status: "generating" } }
          { event: "complete", data: { markdown: "# Skill: ..." } }
  Owner:  Person 2

Stage 5: PARSE + EDIT
  Input:  skill.md (markdown text)
  Output: skill.json (structured JSON for React Flow visualization)
  Method: TypeScript parser (regex-based, runs in API route or client-side)
  Sync:   Edits in markdown re-parse to JSON; edits in flow re-serialize to markdown
  Owner:  Person 2 (parser), Person 3 (UI)

Stage 6: REPLAY
  Input:  skill.json or skill.md
  Output: SSE stream of step execution status + screenshots
  Method: vibe CLI executes each step against a browser
          vibe -p "Execute this skill step by step..." --skill skill.md
  SSE:    { event: "step", data: { stepId: 3, status: "running" } }
          { event: "step", data: { stepId: 3, status: "done", screenshot: "..." } }
  Owner:  Person 2
```

### Job State on Disk

All job state lives in `/tmp/jobs/{jobId}/`:

```
/tmp/jobs/{jobId}/
  video.webm              # uploaded video
  frames/
    frame-001.png         # extracted keyframes
    frame-002.png
    ...
  descriptions.json       # vision analysis results
  skill.md                # generated/edited skill markdown
  skill.json              # parsed JSON (cached, regenerated on edit)
  replay/
    step-001.png          # replay screenshots
    step-002.png
    ...
  status.json             # { stage: "analysis", progress: 0.5, ... }
```

This keeps it simple: no database, no Redis. Each API route reads/writes files. The `status.json` file is the coordination point between the SSE poller and the processing pipeline.

---

## Project Structure

Designed so Person 1, 2, and 3 each own distinct directories and files. Merge conflicts should be rare.

```
skillforge/
  package.json
  tsconfig.json
  next.config.ts
  tailwind.config.ts

  src/
    app/
      layout.tsx                    # Person 3 - root layout
      page.tsx                      # Person 3 - redirects to /record
      record/
        page.tsx                    # Person 3 - Record screen
      process/
        [jobId]/
          page.tsx                  # Person 3 - Processing screen
      edit/
        [jobId]/
          page.tsx                  # Person 3 - Edit screen
      replay/
        [jobId]/
          page.tsx                  # Person 3 - Replay screen

      api/
        upload/
          route.ts                  # Person 1 - video upload endpoint
        process/
          [jobId]/
            route.ts                # Person 1 - SSE: frame extraction + vision analysis
        skill/
          [jobId]/
            route.ts                # Person 2 - GET/PUT skill markdown + JSON
        replay/
          [jobId]/
            route.ts                # Person 2 - POST SSE: replay execution
        parse/
          route.ts                  # Person 2 - POST: markdown <-> JSON conversion

    lib/
      person1/
        frame-extractor.ts          # Person 1 - ffmpeg child_process wrapper
        vision-analyzer.ts          # Person 1 - vibe CLI vision calls (parallel)
        video-utils.ts              # Person 1 - video file handling utilities
      person2/
        skill-synthesizer.ts        # Person 2 - vibe CLI synthesis call
        markdown-parser.ts          # Person 2 - markdown <-> JSON parser
        replay-engine.ts            # Person 2 - vibe CLI replay execution
      shared/
        types.ts                    # ALL - shared TypeScript interfaces
        vibe-cli.ts                 # ALL - generic vibe CLI spawner utility
        sse-utils.ts                # ALL - SSE response helpers
        job-store.ts                # ALL - read/write job files from /tmp

    components/
      record/
        RecordButton.tsx            # Person 3
        VideoUpload.tsx             # Person 3
      process/
        ProgressStream.tsx          # Person 3
        FrameThumbnails.tsx         # Person 3
      edit/
        MarkdownEditor.tsx          # Person 3 - CodeMirror wrapper
        FlowDiagram.tsx             # Person 3 - React Flow wrapper
        SplitPane.tsx               # Person 3 - resizable split layout
      replay/
        ReplayControls.tsx          # Person 3
        StepProgress.tsx            # Person 3
      ui/
        Button.tsx                  # Person 3
        Layout.tsx                  # Person 3

    hooks/
      useSSE.ts                     # Person 3 - EventSource hook
      useSkill.ts                   # Person 3 - fetch/update skill data
```

### Key Principle: Ownership by Directory

| Directory | Owner | Others touch it? |
|-----------|-------|-----------------|
| `src/lib/person1/` | Person 1 | No |
| `src/lib/person2/` | Person 2 | No |
| `src/lib/shared/` | Anyone (but coordinate) | Yes - add types here |
| `src/app/api/upload/`, `src/app/api/process/` | Person 1 | No |
| `src/app/api/skill/`, `src/app/api/replay/`, `src/app/api/parse/` | Person 2 | No |
| `src/app/record/`, `src/app/process/`, etc. | Person 3 | No |
| `src/components/` | Person 3 | No |
| `src/hooks/` | Person 3 | No |

The **only shared file** that all three touch is `src/lib/shared/types.ts`. Define this upfront and freeze it.

---

## Integration Boundaries

There are exactly **3 integration seams** where the builders connect. Each seam is defined by a TypeScript interface and an API contract.

### Seam 1: Person 1 -> Person 2 (Frame Descriptions -> Skill Synthesis)

Person 1 produces frame descriptions. Person 2 consumes them to synthesize a skill.

```typescript
// src/lib/shared/types.ts

/** Output of Person 1's vision analysis pipeline */
interface FrameDescription {
  index: number;
  timestamp: number;          // seconds into video
  imagePath: string;          // path to frame PNG
  description: string;        // vibe CLI's analysis of this frame
}

/** The full output Person 1 writes to descriptions.json */
interface VisionAnalysisResult {
  jobId: string;
  videoFile: string;
  totalFrames: number;
  descriptions: FrameDescription[];
}
```

**Contract:** Person 1 writes `/tmp/jobs/{jobId}/descriptions.json` matching `VisionAnalysisResult`. Person 2 reads it. They never call each other's code directly -- the filesystem is the integration point.

### Seam 2: Person 2 -> Person 3 (API Responses -> UI)

Person 3's frontend calls Person 1 and Person 2's API routes. The response shapes must be agreed upon.

```typescript
// src/lib/shared/types.ts

/** SSE event types emitted during processing (Person 1 + Person 2) */
type ProcessingEvent =
  | { event: 'frames';    data: { total: number; thumbnails: string[] } }
  | { event: 'analysis';  data: { completed: number; total: number; latest: string } }
  | { event: 'synthesis'; data: { status: 'started' | 'streaming'; partial?: string } }
  | { event: 'complete';  data: { markdown: string } }
  | { event: 'error';     data: { message: string } };

/** Skill data returned by GET /api/skill/[jobId] */
interface SkillResponse {
  jobId: string;
  markdown: string;
  json: SkillJSON;
  frames: { index: number; thumbnail: string; description: string }[];
}

/** Skill JSON structure (used by React Flow and replay) */
interface SkillJSON {
  skillName: string;
  context: {
    url?: string;
    browser?: string;
    purpose?: string;
  };
  steps: SkillStep[];
}

interface SkillStep {
  id: number;
  action: 'navigate' | 'click' | 'type' | 'wait' | 'verify' | 'scroll' | 'select' | 'hover' | 'keypress';
  target?: string;
  value?: string;
  description: string;
  rawMarkdown: string;
}

/** SSE events during replay */
type ReplayEvent =
  | { event: 'step';     data: { stepId: number; status: 'running' | 'done' | 'failed'; screenshot?: string } }
  | { event: 'complete'; data: { success: boolean } }
  | { event: 'error';    data: { message: string; stepId?: number } };
```

### Seam 3: Person 3 -> Person 1 (Upload -> Processing Trigger)

```typescript
// Upload: Person 3 calls Person 1's endpoint
// POST /api/upload  (multipart/form-data with video file)
// Response: { jobId: string }

// Then Person 3 opens an EventSource to:
// GET /api/process/{jobId}
// Which streams ProcessingEvent objects
```

### Integration Contract Summary

```
Person 1 EXPOSES:
  POST /api/upload         -> { jobId: string }
  GET  /api/process/[jobId] -> SSE stream (ProcessingEvent)
  Writes: descriptions.json to disk

Person 2 EXPOSES:
  GET  /api/skill/[jobId]  -> SkillResponse
  PUT  /api/skill/[jobId]  -> { json: SkillJSON } (after markdown update)
  POST /api/replay/[jobId] -> SSE stream (ReplayEvent)
  POST /api/parse          -> { markdown: string } | { json: SkillJSON }
  Reads: descriptions.json from disk

Person 3 CONSUMES:
  All of the above endpoints
  Never writes backend logic
```

---

## API Route Patterns

### SSE Streaming from Next.js App Router

Next.js App Router route handlers support streaming via the Web Streams API. Here is the exact pattern to use for SSE.

**The SSE helper (shared utility):**

```typescript
// src/lib/shared/sse-utils.ts

import { NextRequest } from 'next/server';

/**
 * Creates an SSE response from an async generator.
 * Use this in any route handler that needs to stream events.
 */
export function sseResponse(
  generator: () => AsyncGenerator<{ event: string; data: unknown }>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const { event, data } of generator()) {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        }
      } catch (err) {
        const errorPayload = `event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`;
        controller.enqueue(encoder.encode(errorPayload));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',        // Prevents nginx buffering
    },
  });
}
```

**Using it in a route handler (Person 1 example):**

```typescript
// src/app/api/process/[jobId]/route.ts

import { sseResponse } from '@/lib/shared/sse-utils';
import { extractFrames } from '@/lib/person1/frame-extractor';
import { analyzeFrames } from '@/lib/person1/vision-analyzer';

export const dynamic = 'force-dynamic';   // Disable caching for SSE
export const maxDuration = 300;           // Allow long-running (5 min)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  return sseResponse(async function* () {
    // Stage 1: Extract frames
    const frames = await extractFrames(jobId);
    yield {
      event: 'frames',
      data: { total: frames.length, thumbnails: frames.map(f => f.thumbnail) },
    };

    // Stage 2: Analyze frames with vibe CLI (parallel)
    for await (const progress of analyzeFrames(jobId, frames)) {
      yield {
        event: 'analysis',
        data: progress,
      };
    }

    // Stage 3: Synthesis (Person 2's code, but triggered here)
    // ... or Person 2 exposes a function that Person 1 calls
    yield { event: 'complete', data: { markdown: '...' } };
  });
}
```

**Key Next.js SSE requirements:**

1. `export const dynamic = 'force-dynamic'` -- prevents Next.js from caching the route
2. Return a `new Response(readableStream)` with `Content-Type: text/event-stream`
3. Use `TextEncoder` to encode SSE-formatted strings into the stream
4. The SSE protocol requires `event: name\ndata: payload\n\n` format (double newline terminates each event)
5. `X-Accel-Buffering: no` header prevents reverse proxies from buffering the stream

**Client-side consumption (Person 3):**

```typescript
// src/hooks/useSSE.ts

import { useState, useEffect } from 'react';

export function useSSE<T>(url: string | null) {
  const [events, setEvents] = useState<T[]>([]);
  const [status, setStatus] = useState<'idle' | 'connected' | 'done' | 'error'>('idle');

  useEffect(() => {
    if (!url) return;
    const source = new EventSource(url);
    setStatus('connected');

    // Listen for named events
    const eventTypes = ['frames', 'analysis', 'synthesis', 'complete', 'step', 'error'];
    eventTypes.forEach(type => {
      source.addEventListener(type, (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setEvents(prev => [...prev, { event: type, data } as T]);
        if (type === 'complete' || type === 'error') {
          source.close();
          setStatus(type === 'error' ? 'error' : 'done');
        }
      });
    });

    source.onerror = () => {
      source.close();
      setStatus('error');
    };

    return () => source.close();
  }, [url]);

  return { events, status };
}
```

### Shelling Out to Vibe CLI

```typescript
// src/lib/shared/vibe-cli.ts

import { spawn } from 'child_process';

interface VibeCLIOptions {
  prompt: string;
  imagePath?: string;       // For vision calls
  timeout?: number;         // ms, default 60000
}

/**
 * Runs `vibe -p "prompt"` and returns stdout.
 * For streaming, use vibeStream() instead.
 */
export async function vibe(options: VibeCLIOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-p', options.prompt];
    if (options.imagePath) {
      args.push('--image', options.imagePath);
    }

    const proc = spawn('vibe', args, {
      timeout: options.timeout ?? 60_000,
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`vibe exited ${code}: ${stderr}`));
    });
  });
}

/**
 * Runs vibe CLI and yields stdout chunks as they arrive (for streaming).
 */
export async function* vibeStream(options: VibeCLIOptions): AsyncGenerator<string> {
  const args = ['-p', options.prompt];
  if (options.imagePath) {
    args.push('--image', options.imagePath);
  }

  const proc = spawn('vibe', args);

  const chunks: string[] = [];
  let resolve: (() => void) | null = null;
  let done = false;

  proc.stdout.on('data', (chunk) => {
    chunks.push(chunk.toString());
    resolve?.();
  });

  proc.on('close', () => {
    done = true;
    resolve?.();
  });

  while (!done || chunks.length > 0) {
    if (chunks.length > 0) {
      yield chunks.shift()!;
    } else {
      await new Promise<void>((r) => { resolve = r; });
    }
  }
}
```

---

## Build Order

### Phase 0: Scaffold (30 min, all together)

Everyone agrees on this, then splits up:

1. `npx create-next-app@latest skillforge --typescript --tailwind --app --src-dir`
2. Create the directory structure above
3. Write `src/lib/shared/types.ts` with all interfaces (freeze this)
4. Write `src/lib/shared/vibe-cli.ts` (the vibe CLI spawner)
5. Write `src/lib/shared/sse-utils.ts` (the SSE response helper)
6. Write `src/lib/shared/job-store.ts` (read/write job files)
7. Commit and push. Everyone pulls. Now split.

### Phase 1: Parallel Build (2-3 hours)

```
Person 1 (Backend - Video Pipeline)        Person 2 (Backend - Skill Engine)       Person 3 (Frontend - UI)
---------------------------------          --------------------------------        -------------------------
1. POST /api/upload route                  1. markdown-parser.ts                   1. App layout + navigation
   - Accept video, save to /tmp               - Parse sample markdown to JSON         - 4 routes with page shells
   - Return jobId                             - Parse JSON back to markdown            - Shared header/nav
                                              - Unit test with PRD examples
2. frame-extractor.ts                                                              2. Record screen (page 1)
   - ffmpeg child_process                  2. skill-synthesizer.ts                     - MediaRecorder API
   - Extract frames at 2fps                   - Build synthesis prompt                 - File upload fallback
   - Pixel-diff dedup                         - Call vibe CLI with descriptions        - Upload to /api/upload
                                              - Test with mock descriptions
3. vision-analyzer.ts                                                              3. Processing screen (page 2)
   - Fan-out vibe CLI calls                3. GET/PUT /api/skill/[jobId]               - useSSE hook
   - Promise.allSettled for parallel          - Read skill.md from disk                - Progress bars
   - Write descriptions.json                  - Parse to JSON on GET                   - Frame thumbnails appearing
                                              - Accept markdown PUT, re-parse
4. GET /api/process/[jobId] SSE route                                              4. Edit screen (page 3)
   - Wire extraction + analysis            4. replay-engine.ts                         - CodeMirror editor (left)
   - Stream progress events                   - vibe CLI step execution                - React Flow diagram (right)
                                              - Screenshot capture per step             - Bidirectional sync
                                                                                       - Replay button
                                           5. POST /api/replay/[jobId] SSE route
                                              - Stream step status                  5. Replay screen (page 4)
                                                                                       - Step progress display
                                                                                       - Screenshot stream
                                                                                       - Stop/pause controls
```

### Phase 2: Integration (1 hour)

```
Integration 1: Person 1 output -> Person 2 input
  - Person 1 runs pipeline on a real video
  - Person 2 reads the descriptions.json
  - Verify skill synthesis works end-to-end
  - Fix any format mismatches in descriptions

Integration 2: Backend -> Frontend
  - Person 3 points UI at real API routes (remove mocks)
  - Test SSE streaming in browser
  - Fix any CORS / serialization issues

Integration 3: End-to-end
  - Record -> Process -> Edit -> Replay
  - Fix timing, error handling, edge cases
```

### Phase 3: Polish (remaining time)

- Loading states and error messages
- Demo script rehearsal
- Pick the simplest possible demo workflow (form fill)

### Dependency Graph

```
                  shared/types.ts (FIRST)
                  shared/vibe-cli.ts (FIRST)
                  shared/sse-utils.ts (FIRST)
                         |
          +--------------+--------------+
          |              |              |
     Person 1       Person 2       Person 3
     (no deps       (no deps       (no deps
      on 2/3)        on 1/3)        on 1/2)
          |              |              |
          |    descriptions.json        |
          +-------->-----+              |
                         |              |
                    API routes          |
                         +-------->-----+
                                        |
                                   End-to-end
```

The critical insight: **Person 2 does NOT need Person 1's real output to start.** Person 2 should create a mock `descriptions.json` from the PRD examples and build against that. Similarly, Person 3 should hardcode mock API responses and build the full UI before wiring to real backends.

---

## Key Findings

### 1. The filesystem IS the database

For a hackathon, skip databases entirely. Use `/tmp/jobs/{jobId}/` as the data store. Each API route reads/writes plain files. The `status.json` file coordinates between the processing pipeline and SSE polling. This eliminates an entire class of setup/debugging time.

### 2. SSE in Next.js App Router works via ReadableStream, not legacy res.write()

The App Router uses the standard Web `Response` API. You return `new Response(readableStream, { headers: { 'Content-Type': 'text/event-stream' } })`. There is no `res.write()` or `res.flush()` like in the Pages Router. The `async generator -> ReadableStream` pattern shown above is the cleanest approach. You MUST set `export const dynamic = 'force-dynamic'` to prevent Next.js from trying to cache the SSE route.

### 3. Parallel development requires agreeing on types.ts FIRST, then not touching it

The single most important file is `src/lib/shared/types.ts`. All three builders import from it. Define every interface, every SSE event type, and every API response shape before splitting up. Then treat it as frozen. If someone needs to change it, they announce it in chat. This one file prevents 90% of integration bugs.

### 4. Vibe CLI calls should use child_process.spawn, not exec

`spawn` streams stdout in chunks (needed for SSE streaming of vibe output). `exec` buffers the entire output and returns it all at once. Use `spawn` everywhere so you can stream partial results to the frontend as vibe generates them. The `vibeStream()` async generator pattern wraps this cleanly.

### 5. Mock data enables true parallel development

Person 3 should never be blocked on Person 1 or 2. Create these mock files on day zero:

- `src/lib/shared/mock-descriptions.json` -- sample vision analysis output
- `src/lib/shared/mock-skill.md` -- sample generated skill (use the PRD example)
- `src/lib/shared/mock-skill.json` -- the parsed JSON version

Person 3 builds the entire UI against mocks. Person 2 builds synthesis + parsing against mock descriptions. Person 1 builds the pipeline independently. At integration time, swap mocks for real API calls -- if the types match, it just works.
