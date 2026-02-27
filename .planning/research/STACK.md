# Stack Research: SkillForge

> Researched 2026-02-28. Note: The PRD references Python/FastAPI, but the architecture decision is **TypeScript everywhere** with Next.js API routes and Mistral vibe CLI. This document reflects that decision.

---

## Mistral Vibe CLI

### What It Is

Mistral's `vibe` CLI is Mistral's answer to Anthropic's `claude` CLI. It is a command-line coding agent that can be invoked from the terminal to perform AI-powered tasks. Similar to how `claude -p "prompt"` works in pipe mode, `vibe` can be invoked non-interactively for programmatic use.

### Installation

```bash
# Install via npm (preferred for TypeScript projects)
npm install -g @mistralai/vibe

# Or via pip
pip install mistral-vibe
```

Ensure the `MISTRAL_API_KEY` environment variable is set.

### How to Shell Out from Node.js API Routes

The core pattern is to use `child_process.spawn` to launch the vibe CLI and stream its stdout back to the client. This is the recommended approach since the project avoids a separate backend server.

```typescript
import { spawn } from "child_process";

export async function runVibe(prompt: string): Promise<ReadableStream> {
  const proc = spawn("vibe", ["-p", prompt], {
    env: { ...process.env, MISTRAL_API_KEY: process.env.MISTRAL_API_KEY },
    stdio: ["pipe", "pipe", "pipe"],
  });

  return new ReadableStream({
    start(controller) {
      proc.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(new TextEncoder().encode(chunk.toString()));
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        // Log errors but don't kill the stream
        console.error("[vibe stderr]", chunk.toString());
      });
      proc.on("close", () => {
        controller.close();
      });
      proc.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      proc.kill("SIGTERM");
    },
  });
}
```

### Streaming Output

The vibe CLI writes to stdout as it works. By using `spawn` (not `exec`), you get a streaming interface. Each `data` event on `proc.stdout` can be forwarded to the client as an SSE event. This is critical for the "Processing" screen where users see real-time progress.

### Passing Images / Multimodal Input

For vision tasks (analyzing video frames), you can either:
1. **Pass base64 images inline** in the prompt if the CLI supports it
2. **Use file paths** -- e.g., `vibe -p "Analyze this screenshot" --image /tmp/frame_001.png`
3. **Fall back to the Mistral HTTP API** directly using `fetch` from Node.js if the CLI does not support image input in pipe mode

**Recommendation for hackathon:** For the frame analysis fan-out (many parallel vision calls), use the **Mistral HTTP API directly** via `fetch` rather than spawning N CLI processes. Use the CLI for the synthesis/generation step where streaming output to the user matters most.

```typescript
// Direct API call for vision (parallel frame analysis)
async function analyzeFrame(imageBase64: string, index: number) {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-large-latest", // or pixtral for vision
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${imageBase64}` },
            },
            { type: "text", text: FRAME_ANALYSIS_PROMPT },
          ],
        },
      ],
    }),
  });
  return res.json();
}

// Fan-out: analyze all frames in parallel
const results = await Promise.all(
  frames.map((frame, i) => analyzeFrame(frame, i))
);
```

### Vision Model

Use **Pixtral** (Mistral's vision model) for frame analysis. Model name: `pixtral-large-latest` or `mistral-large-latest` (which includes vision capabilities as of recent versions).

---

## Useful MCPs

Model Context Protocol (MCP) servers provide tool interfaces that AI agents can use. Here are MCPs relevant to SkillForge:

### 1. Playwright MCP (High Priority)

- **Package:** `@anthropic/mcp-server-playwright` or `@playwright/mcp`
- **What it does:** Provides browser automation tools (navigate, click, type, screenshot) via MCP
- **Relevance:** This is directly what the replay engine needs. Instead of writing custom Playwright code, the agent can use Playwright MCP tools
- **Integration:** Run as a sidecar process, connect via stdio

```bash
npx @playwright/mcp@latest
```

### 2. Filesystem MCP

- **Package:** `@anthropic/mcp-server-filesystem`
- **What it does:** Provides read/write access to the local filesystem via MCP
- **Relevance:** Saving/loading skill markdown files, managing extracted frames
- **Integration:** Already commonly bundled with Claude/Mistral agents

### 3. draw.io / Diagrams MCP

- **Status:** There is no widely-adopted official "draw.io MCP server" as of early 2026
- **Alternatives:**
  - **Mermaid rendering** -- Generate Mermaid diagram syntax from the skill JSON and render client-side. This is far simpler than integrating draw.io
  - **React Flow** (already chosen) -- Better fit for interactive editing; no MCP needed since it is a React component
  - **Excalidraw MCP** -- Some community MCP servers wrap Excalidraw for diagram generation, but React Flow is a better choice for the structured step-by-step flow visualization

**Recommendation:** Skip draw.io MCP. React Flow handles the visual flow diagram natively in the frontend. If you want exportable diagrams, generate Mermaid syntax from the skill JSON.

### 4. Fetch / HTTP MCP

- **Package:** `@anthropic/mcp-server-fetch`
- **What it does:** Allows the agent to make HTTP requests
- **Relevance:** Useful if the replay agent needs to interact with APIs rather than just browser UI

### 5. Browser Tools MCP (Community)

- **Package:** `@nicepkg/browser-tools-mcp` or similar community packages
- **What it does:** Provides screenshot, DOM inspection, console access
- **Relevance:** Could augment the replay engine with richer browser introspection

### MCP Integration Pattern (from Next.js)

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["@playwright/mcp@latest"],
});

const client = new Client({ name: "skillforge", version: "1.0.0" });
await client.connect(transport);

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: "browser_navigate",
  arguments: { url: "https://example.com" },
});
```

---

## Useful Skills / Tools

### Mistral Agents API

Mistral offers an Agents API that can be configured with tools and instructions. For the hackathon, you could create a Mistral agent pre-configured with:
- Browser control tools (via Playwright MCP)
- The skill replay prompt as system instructions

### @mistralai/mistralai (TypeScript SDK)

Official Mistral TypeScript SDK for direct API calls (alternative to CLI for vision calls):

```bash
npm install @mistralai/mistralai
```

```typescript
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const response = await client.chat.complete({
  model: "pixtral-large-latest",
  messages: [
    {
      role: "user",
      content: [
        { type: "image_url", imageUrl: `data:image/png;base64,${b64}` },
        { type: "text", text: "Describe this screenshot..." },
      ],
    },
  ],
});
```

### Playwright (Node.js)

```bash
npm install playwright
```

Use for the replay engine. Playwright runs headful browsers and can be controlled programmatically from Next.js API routes (long-running server-side process).

### MediaRecorder API (Browser-Native)

No library needed for screen recording. The browser's `navigator.mediaDevices.getDisplayMedia()` + `MediaRecorder` API handles capture natively. Output is webm.

---

## Recommended Libraries

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `next` | ^15.2 | Framework (frontend + API routes) | App Router with Route Handlers for SSE |
| `react` | ^19.0 | UI framework | Ships with Next 15 |
| `typescript` | ^5.7 | Type safety everywhere | Strict mode recommended |
| `@xyflow/react` | ^12.4 | Visual flow diagram editor | Formerly "reactflow"; renamed to @xyflow/react |
| `codemirror` | ^6.0 (meta) | Markdown editor | Install `codemirror` + `@codemirror/lang-markdown` + `@codemirror/theme-one-dark` |
| `@codemirror/lang-markdown` | ^6.3 | Markdown language support for CM6 | Syntax highlighting + structure |
| `@codemirror/view` | ^6.36 | CM6 editor view | Core editor component |
| `@codemirror/state` | ^6.5 | CM6 state management | Document model |
| `fluent-ffmpeg` | ^2.1.3 | FFmpeg wrapper for Node.js | Frame extraction, keyframe detection |
| `@types/fluent-ffmpeg` | ^2.1 | TypeScript types for fluent-ffmpeg | Dev dependency |
| `sharp` | ^0.33 | Image processing (resize, compare) | Pixel diff for keyframe detection; native module, very fast |
| `playwright` | ^1.50 | Browser automation for replay | Headful browser control |
| `@mistralai/mistralai` | ^1.5 | Mistral TypeScript SDK | Direct API calls for vision + synthesis |
| `@modelcontextprotocol/sdk` | ^1.7 | MCP client SDK | Connect to MCP servers (Playwright, filesystem) |
| `unified` / `remark-parse` | ^11.0 / ^11.0 | Markdown AST parsing | Parse skill markdown into structured AST |
| `remark-stringify` | ^11.0 | Markdown AST to string | Reconstruct markdown after edits |
| `zod` | ^3.24 | Schema validation | Validate skill JSON structure |
| `uuid` | ^11.0 | Job ID generation | For upload/processing job tracking |

### Dev Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `@types/node` | ^22 | Node.js types |
| `@types/react` | ^19 | React types |
| `eslint` | ^9 | Linting |
| `tailwindcss` | ^4.0 | Utility CSS (ships with Next 15 setup) |

---

## SSE Streaming from Next.js

### Best Approach: Route Handlers with ReadableStream (App Router)

Next.js App Router Route Handlers support returning a `ReadableStream` with the correct headers for SSE. This is the cleanest approach -- no extra libraries needed.

```typescript
// app/api/status/[jobId]/route.ts
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const jobId = params.jobId;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: object) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      // Example: stream processing progress
      send("progress", { step: "extracting_frames", message: "Extracting key frames..." });

      // ... do work, send more events ...

      send("complete", { markdown: "# Skill: ...", json: { steps: [] } });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

### Client-Side Consumption

```typescript
// Use native EventSource or fetch with ReadableStream
const eventSource = new EventSource(`/api/status/${jobId}`);

eventSource.addEventListener("progress", (e) => {
  const data = JSON.parse(e.data);
  setProgress(data);
});

eventSource.addEventListener("complete", (e) => {
  const data = JSON.parse(e.data);
  setSkill(data);
  eventSource.close();
});

eventSource.onerror = () => {
  eventSource.close();
};
```

### Key Considerations

1. **Vercel / serverless timeout:** Next.js API routes on Vercel have a 10-second timeout (free tier) or 60s (Pro). For hackathon local dev, this is not an issue. If deploying, consider Vercel's `maxDuration` config or use `next start` on a server.
2. **No need for Socket.io or ws:** SSE is simpler and sufficient for unidirectional server-to-client streaming.
3. **Request cancellation:** When the client disconnects, the `ReadableStream.cancel()` callback fires -- use this to kill any spawned CLI processes.
4. **Alternative for long-running jobs:** Store job state in memory (Map) or a simple file, poll with SSE reconnection. SSE auto-reconnects by default.

---

## Video Frame Extraction (Node.js)

### Approach: fluent-ffmpeg + sharp

Use `fluent-ffmpeg` to invoke the system `ffmpeg` binary for frame extraction, and `sharp` for image comparison (keyframe detection).

### Step 1: Extract Frames at Fixed Interval

```typescript
import ffmpeg from "fluent-ffmpeg";
import path from "path";

function extractFrames(
  videoPath: string,
  outputDir: string,
  fps: number = 2
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const frames: string[] = [];

    ffmpeg(videoPath)
      .outputOptions([`-vf fps=${fps}`, "-frame_pts 1"])
      .output(path.join(outputDir, "frame_%04d.png"))
      .on("end", () => {
        // Glob the output dir for frame files
        resolve(frames);
      })
      .on("error", reject)
      .run();
  });
}
```

### Step 2: Keyframe Detection with sharp (Pixel Diff)

```typescript
import sharp from "sharp";

async function computeDiff(imgA: string, imgB: string): Promise<number> {
  const [a, b] = await Promise.all([
    sharp(imgA).raw().toBuffer({ resolveWithObject: true }),
    sharp(imgB).resize({ width: 320 }).raw().toBuffer({ resolveWithObject: true }),
  ]);

  // Resize both to same dimensions first
  const bufA = (await sharp(imgA).resize({ width: 320 }).raw().toBuffer());
  const bufB = (await sharp(imgB).resize({ width: 320 }).raw().toBuffer());

  let diff = 0;
  const len = Math.min(bufA.length, bufB.length);
  for (let i = 0; i < len; i++) {
    diff += Math.abs(bufA[i] - bufB[i]);
  }
  return diff / len; // Average per-pixel difference
}

async function selectKeyframes(
  framePaths: string[],
  threshold: number = 15 // Tune this: higher = fewer keyframes
): Promise<string[]> {
  const keyframes: string[] = [framePaths[0]];

  for (let i = 1; i < framePaths.length; i++) {
    const diff = await computeDiff(keyframes[keyframes.length - 1], framePaths[i]);
    if (diff > threshold) {
      keyframes.push(framePaths[i]);
    }
  }

  return keyframes;
}
```

### Step 3: Convert Frames to Base64 for Mistral Vision

```typescript
import { readFile } from "fs/promises";

async function frameToBase64(framePath: string): Promise<string> {
  // Resize to reasonable size for API (reduce tokens/cost)
  const resized = await sharp(framePath)
    .resize({ width: 1280, withoutEnlargement: true })
    .png()
    .toBuffer();
  return resized.toString("base64");
}
```

### Why Not Python?

- `fluent-ffmpeg` is mature and well-typed
- `sharp` (libvips bindings) is faster than Python Pillow for image operations
- Keeps the entire stack in TypeScript -- no polyglot deployment issues
- ffmpeg does the heavy lifting regardless of language; the wrapper is thin

### System Requirement

ffmpeg must be installed on the system:
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

---

## Key Findings

### 1. Use Mistral SDK for Vision, CLI for Streaming Synthesis

Do not spawn N vibe CLI processes for parallel frame analysis. Use `@mistralai/mistralai` TypeScript SDK (or raw `fetch`) for the fan-out vision calls -- they run in parallel via `Promise.all`. Reserve the vibe CLI for the single synthesis step where you want to stream the generated skill markdown to the user in real-time.

### 2. Playwright MCP is the Replay Engine

Rather than hand-coding a Playwright replay engine with a switch statement for each action type, use the `@playwright/mcp` server. The agent (driven by vibe CLI or Mistral SDK) can call Playwright MCP tools directly. This means the replay engine is just: "Read the skill markdown, then execute it step by step using browser tools." The MCP handles the browser automation plumbing.

### 3. Next.js Route Handlers + ReadableStream = Native SSE

No additional libraries are needed for SSE. Next.js App Router route handlers natively support streaming responses. Return a `ReadableStream` with `text/event-stream` content type. This covers both the processing progress stream and the replay status stream.

### 4. fluent-ffmpeg + sharp Replaces OpenCV

The PRD mentions OpenCV for frame extraction, but in a TypeScript-only stack, `fluent-ffmpeg` (frame extraction) + `sharp` (pixel diff for keyframe detection) is the equivalent. Both are mature, fast, and have good TypeScript types. No Python or OpenCV needed.

### 5. Skip draw.io MCP -- React Flow is Sufficient

React Flow (`@xyflow/react`) handles the visual step flow natively as a React component with drag-and-drop, custom nodes, and edge routing. There is no need for a separate diagram generation service or MCP. The skill JSON maps directly to React Flow nodes and edges.

---

## Architecture Summary

```
Browser (React + Next.js)
  |
  |-- MediaRecorder API (screen capture -> webm)
  |-- EventSource (SSE client for progress/replay)
  |-- CodeMirror 6 (markdown editor)
  |-- React Flow (visual step diagram)
  |
  v
Next.js API Routes (serverless functions)
  |
  |-- POST /api/upload-video
  |     |-- fluent-ffmpeg (frame extraction)
  |     |-- sharp (keyframe detection via pixel diff)
  |     |-- Mistral SDK (parallel vision calls on frames)
  |     |-- vibe CLI spawn (skill synthesis, streamed)
  |
  |-- GET /api/status/[jobId]  (SSE stream)
  |-- GET /api/skill/[jobId]   (markdown + JSON)
  |-- PUT /api/skill/[jobId]   (update markdown, re-parse)
  |
  |-- POST /api/replay/[jobId] (SSE stream)
  |     |-- Playwright MCP (browser automation)
  |     |-- OR: vibe CLI + Playwright MCP tools
  |
  v
External Services
  |-- Mistral API (pixtral-large-latest for vision, mistral-large-latest for synthesis)
  |-- ffmpeg (system binary)
```

---

## Quick Start Commands

```bash
# Initialize project
npx create-next-app@latest skillforge --typescript --tailwind --app --src-dir

# Install core dependencies
cd skillforge
npm install @xyflow/react codemirror @codemirror/lang-markdown @codemirror/view @codemirror/state @codemirror/theme-one-dark
npm install fluent-ffmpeg sharp
npm install playwright @mistralai/mistralai
npm install @modelcontextprotocol/sdk
npm install unified remark-parse remark-stringify zod uuid

# Install types
npm install -D @types/fluent-ffmpeg @types/uuid

# Install Playwright browsers
npx playwright install chromium

# Install ffmpeg (if not present)
sudo apt install ffmpeg  # Linux
brew install ffmpeg       # macOS
```
