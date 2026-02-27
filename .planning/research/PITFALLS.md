# Pitfalls Research: SkillForge

> Screen-demo-to-skill-markdown tool. 1-day hackathon, 3 engineers.
> Stack: Next.js, TypeScript, Mistral vibe CLI.

---

## Hackathon-Specific Risks

| Risk | Impact | Prevention |
|------|--------|------------|
| **Scope creep on "edit" UX** | Spending 4+ hours on a markdown editor instead of the core record-to-skill pipeline | Timebox the editor to 1 hour max. Use a plain `<textarea>` with monospace font. Fancy editing is a post-hackathon concern. |
| **Integration mismatch between 3 engineers** | Engineer A's video output format doesn't match Engineer B's LLM prompt input. Discovered at hour 8. | Define the data contract (JSON schema for extracted frames, skill markdown format) in the first 30 minutes. Write it down, commit it. |
| **"Works on my machine" at demo time** | Environment variables missing, different Node versions, CORS issues on deployed version | Deploy to a shared environment (Vercel preview) by hour 2. Demo from the deployed URL, never localhost. |
| **No working demo at all** | Tried to build the full pipeline end-to-end, nothing works completely | Build a "golden path" first: hardcode a sample video, hardcode sample frames, get LLM output working. Then connect real pieces. |
| **Git merge conflicts** | 3 people editing the same files, painful merges waste 30-60 minutes | Assign clear file ownership. Use separate directories: `/app/record`, `/app/process`, `/app/replay`. Merge to main frequently. |
| **Burnout / decision paralysis** | Debating architecture choices for 2 hours eats 25% of the day | Pick one person as "tie-breaker." Any decision made in under 2 minutes is better than the perfect decision made in 30. |

## Technical Risks

| Risk | Impact | Prevention |
|------|--------|------------|
| **Vercel request body limit: 4.5 MB** | Video uploads will fail silently or return 413. A 10-second screen recording at decent quality is easily 5-20 MB. | Do NOT upload video through Next.js API routes. Options: (1) process video entirely client-side and send only extracted frames, (2) upload directly to a blob store (Vercel Blob, S3 presigned URL), (3) run locally with `next dev` where there is no limit. |
| **Vercel function timeout: 10s (Hobby, no fluid compute) or 300s (with fluid compute)** | LLM calls that take 15-30 seconds will time out on Hobby plan without fluid compute, returning 504. | Enable fluid compute (default on new projects), or use SSE streaming so the connection stays alive. Set `export const maxDuration = 300` on LLM-calling routes. |
| **MediaRecorder codec fragmentation** | `video/webm` works in Chrome/Edge but NOT Safari. `video/mp4` support in MediaRecorder is inconsistent. Safari uses different codecs entirely. | Always call `MediaRecorder.isTypeSupported()` and fall back. For hackathon: target Chrome only and document it. Don't waste time on cross-browser. |
| **`getDisplayMedia()` permission UX** | Browser shows a system-level picker dialog. Users must select the right tab/window. No way to pre-select. In some browsers, audio capture requires extra flags. | Add clear instructions in the UI ("Select the tab you want to record"). Don't rely on audio. Test the recording flow early. |
| **Frame extraction from video is non-trivial** | You need to decode video frames to send screenshots to the vision API. In-browser: need to draw to `<canvas>` via `<video>` element. Server-side: need ffmpeg. Both are slow and error-prone. | Client-side approach: capture periodic screenshots using `canvas.drawImage(video, ...)` during recording, or use `ImageCapture` API. Avoid server-side ffmpeg unless already familiar with it. |
| **Mistral vision API accuracy on UI screenshots** | LLM may misread button text, confuse similar UI elements, hallucinate element names, or miss small icons. Dense UIs with many similar buttons are especially problematic. | Send high-resolution screenshots (at least 1280px wide). Add explicit prompts: "List every clickable element with its exact text." Validate output against known UI. Don't trust coordinates from vision models. |
| **Mistral API rate limits** | Free tier and lower-paid tiers have requests-per-minute limits. Sending 20+ frames from a single recording could exhaust limits quickly. Expect 429 errors. | Batch frames: send fewer, higher-quality keyframes rather than every frame. Add exponential backoff retry logic. Check your tier's RPM limit before the hackathon. |
| **Mistral API latency** | Vision model calls can take 5-30 seconds per image. Processing 10 frames sequentially = 50-300 seconds total. | Process frames in parallel (within rate limits). Or better: select only 3-5 keyframes that represent distinct steps, not every frame. |
| **SSE connection drops** | Browser `EventSource` auto-reconnects but loses context. Proxies/CDNs may buffer or terminate SSE streams. Vercel's edge may close idle connections. | Use `fetch()` with `ReadableStream` instead of `EventSource` for more control. Send periodic heartbeat events. Handle reconnection with sequence IDs. |
| **Video blob memory pressure** | Large video blobs in browser memory (50-200 MB for a 2-minute recording) can crash tabs on lower-end machines. | Limit recording duration (30-60 seconds max for hackathon). Stream chunks to disk/IndexedDB rather than accumulating in memory. |

## Integration Risks

| Risk | Impact | Prevention |
|------|--------|------------|
| **Mistral vibe CLI vs. API mismatch** | vibe CLI may use different model versions, parameters, or prompt formats than the raw API. Behavior during development (CLI) differs from production (API). | Decide early: CLI for prototyping OR API for everything. Don't mix both for the same functionality. If using vibe CLI, all LLM calls go through it. |
| **Skill markdown format is underspecified** | Generated markdown varies wildly between LLM calls. Agent replay parser breaks on unexpected formats. | Define a rigid schema for skill markdown upfront (e.g., always has `## Steps`, each step has `- action:`, `- target:`, `- value:`). Use few-shot examples in the prompt. Validate output with a simple parser before displaying. |
| **Record -> Extract -> LLM -> Edit -> Replay pipeline has 5 failure points** | Any single failure breaks the entire demo. Debugging a 5-step pipeline under time pressure is brutal. | Build and test each step independently with hardcoded inputs/outputs. Have a "demo mode" with pre-baked data for each stage. |
| **Agent replay can't find elements** | Generated skill says "click the Submit button" but the actual DOM has `<button class="btn-primary">Submit</button>`. CSS selectors from screenshots are unreliable. | Don't rely on CSS selectors from the vision model. Instead, use text-based matching ("find element containing text 'Submit'"). Or use `data-testid` attributes. For the hackathon, replay can be a visual walkthrough (highlight areas) rather than actual automation. |
| **State drift between record and replay** | The app being automated may be in a different state during replay (different data, logged out, different page). | Skill markdown should include preconditions ("Start on the Dashboard page, logged in as admin"). Replay should verify preconditions before executing steps. |

## Demo Day Risks

| Risk | Impact | Prevention |
|------|--------|------------|
| **Live recording fails** | `getDisplayMedia` blocked by browser policy, microphone permissions denied, screen share picker is confusing on a projector setup | Pre-record a demo video. Have it ready as a fallback. Never rely solely on live recording for the demo. |
| **LLM API is slow or down during demo** | Mistral API has an outage or high latency right when you're presenting. 30-second spinner in front of judges. | Cache at least one complete successful API response. Build a "demo mode" toggle that uses cached responses. |
| **Demo machine is different from dev machine** | Different browser version, missing environment variables, different screen resolution breaks the recording/replay | Test on the exact demo machine 1 hour before presenting. Use a `.env.example` file. Deploy and demo from the cloud, not a local machine. |
| **Projector resolution breaks UI** | Recording was done at 1920x1080 but projector runs at 1024x768. UI layout breaks. Element positions shift. | Use responsive design or a fixed-width layout (max 1280px). Test at lower resolutions. |
| **Can't explain what it does** | The tech is impressive but the narrative is unclear. Judges don't understand the value proposition in the first 30 seconds. | Write the demo script first: "Record a task. AI generates a skill. Edit it. Replay it." Practice the 2-minute pitch at least twice. Lead with the problem, not the tech. |
| **Replay looks unimpressive** | The "replay" is just highlighting text in markdown, doesn't feel like automation | Even a simple visual replay (scrolling through steps with highlights, showing cursor movements) feels 10x more impressive than static text. Invest 1 hour in replay polish if core pipeline works. |

## Key Findings

These are the items most likely to kill this project, in priority order:

1. **The 4.5 MB Vercel payload limit will block video uploads on day one.** This is the single most likely showstopper. You cannot upload screen recordings through Next.js API routes on Vercel. Solution: process video client-side and send only extracted frames (as base64 images or URLs), or use direct-to-blob uploads, or demo from `localhost` where there is no limit.

2. **Frame extraction is the hardest unsolved technical problem.** Going from a video blob to individual screenshot frames that an LLM can analyze is non-trivial in the browser. The `<canvas>` + `<video>` approach requires seeking through the video, which is async and buggy. Alternative: skip video entirely and capture periodic screenshots during recording using `canvas.drawImage()` on a captured stream, storing them as individual images. This sidesteps the video processing problem completely.

3. **LLM vision accuracy is unreliable for precise UI automation.** Vision models frequently misread text, hallucinate UI elements, and cannot provide pixel-accurate coordinates. The generated skill markdown will contain errors. Prevention: design the skill format to be human-editable (which it is), and make the "edit" step a first-class part of the workflow rather than optional cleanup. Set expectations that the AI generates a draft, not a perfect script.

4. **Integration failures at hour 8 are the #1 hackathon killer.** Three engineers building three pieces that need to connect will discover mismatches late in the day. Prevention: define the data contracts (frame format, skill markdown schema, replay instruction format) in the first 30 minutes. Build with hardcoded data first, connect real pieces second.

5. **Demo without a fallback will fail.** Live API calls, live screen recording, and live replay are three independent failure points during a demo. Any one failing ruins the presentation. Prevention: build "demo mode" with cached/pre-baked data for every stage of the pipeline. The live version is a bonus; the pre-baked version is the safety net.
