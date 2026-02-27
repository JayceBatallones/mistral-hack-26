# Features Research: SkillForge

## Similar Tools

The "record a demo, get automation" space sits at the intersection of three categories: traditional RPA record-and-replay, AI browser agents, and programming-by-demonstration research.

### Traditional Record-and-Replay / RPA
- **Selenium IDE** — Browser extension that records clicks and keystrokes, exports as Selenium scripts. The original record-and-replay tool. Produces brittle selector-based scripts that break when the UI changes.
- **UiPath / Automation Anywhere / Power Automate** — Enterprise RPA platforms with "record" modes that capture user actions and generate automation workflows. Heavy, require desktop agents, enterprise licensing. UiPath's "Task Capture" records workflows and generates process documentation.
- **Playwright Codegen** (`playwright codegen`) — Records browser interactions and generates Playwright test scripts. Excellent developer tool, but output is raw code, not a human-readable skill document.
- **Chrome DevTools Recorder** — Built into Chrome, records user flows and exports as Puppeteer/Playwright scripts or as JSON. Low-level, developer-focused.

### AI Browser Agents (Emerging, 2024-2026)
- **Browser Use** — Open-source Python library that lets LLMs control a browser. The agent sees the page (via accessibility tree or screenshots), decides what to do, and executes. No recording step; driven entirely by natural language instructions.
- **Skyvern** — AI-powered browser automation that uses vision models to navigate websites. Focuses on robustness: it can handle UI changes because it uses vision rather than fixed selectors. Cloud-hosted, API-driven.
- **Anthropic Computer Use** — Reference implementation for Claude controlling a full desktop via screenshots + mouse/keyboard. General-purpose computer control, not web-specific. Uses a vision-action loop.
- **MultiOn** — AI agent that browses the web on your behalf. Takes a natural language goal and executes it. No recording; purely instruction-driven.
- **Adept ACT-1 / ACT-2** — AI agent trained to use software tools. Demonstrated controlling browsers, spreadsheets, and enterprise software from natural language instructions. Research-stage.
- **Induced AI** — Browser automation platform where you describe tasks in natural language and the AI agent executes them. Offers a "workflow builder" UI.

### Programming by Demonstration (Research)
- **SUGILITE** (Carnegie Mellon) — Research system that watches users perform tasks on Android and generates reusable automation scripts. Asks clarifying questions to generalize the recording.
- **Rousillon** (UW) — Browser extension that watches a user demonstrate a web scraping task on one example, then generalizes to scrape many similar pages.
- **PUMA** — Programming by demonstration for mobile apps; records user taps and generates replayable scripts.

### Key Gap SkillForge Fills
Most traditional tools produce **code or JSON** that is opaque to non-developers. Most AI agents take **instructions** but have no "watch me do it" input. SkillForge bridges both: it takes a **visual demonstration** and produces a **human-readable, editable document** (markdown) that an agent can execute. The closest conceptual match is UiPath Task Capture (record to documentation) combined with Browser Use (AI-powered replay), but neither does both in one flow.

---

## Table Stakes (Must-Have for Demo)

These are features without which the hackathon demo will not land. If any of these fail on stage, the project does not communicate its value.

- **Screen recording or video upload** — The user must be able to provide a demo. File upload is the safer path (pre-record a clean video as backup). Browser-based MediaRecorder is a bonus but risky on stage (permissions dialogs, wrong screen captured, etc.).
- **Visible processing pipeline with progress** — After the video is submitted, the audience needs to see something happening. Silent loading for 30+ seconds kills energy. Streaming status messages ("Extracting frames... Analyzing frame 4/12... Generating skill...") are essential to keep attention and communicate that AI is working.
- **Generated skill markdown that is readable** — The output must look clean and immediately understandable. If the generated markdown is garbled, has wrong steps, or is unreadable, the demo fails. This is the core "wow" moment: the audience sees a video turn into a structured document.
- **Editable markdown** — The user must be able to change something (e.g., swap an email address, remove a step) and have it stick. This demonstrates that the skill is not a black box. Even a basic textarea with syntax highlighting is sufficient.
- **Agent replay that visibly works** — The agent must execute the skill in a browser the audience can see. Even if it is only 3-4 steps (navigate, click, type, click), the replay must work reliably. A pre-tested simple form (that you control) is critical. Do not replay against a third-party site on stage.
- **End-to-end flow without manual intervention** — The 4-screen flow (Record, Process, Edit, Replay) must connect seamlessly. No copying files between terminals, no switching windows to run scripts. One app, one flow.

---

## Differentiators (Wow Factor)

These features go beyond functional and make the demo memorable for hackathon judges.

- **Markdown as the skill format (not code, not JSON)** — This is the single strongest differentiator. Every other tool in this space produces code or opaque workflows. SkillForge produces a document a product manager could read and edit. Judges will immediately understand why this matters. Lean into it: show the markdown on screen, make it beautiful.
- **Split-pane editor with live visual flow diagram** — Showing markdown on the left and a node-based flow diagram on the right, synchronized in real time, is visually striking. It communicates "professional tool" rather than "hackathon prototype." React Flow makes this achievable in a day.
- **Edit-then-replay loop (the "edit" is the magic)** — The most compelling demo moment is: change a value in the markdown, press Replay, and watch the agent use the new value. This demonstrates that the skill is truly editable and the replay is truly dynamic. This separates SkillForge from a simple macro recorder.
- **Streaming processing with keyframe thumbnails** — Showing extracted keyframes appearing one by one during processing is visually engaging and communicates intelligence ("it found the important moments"). Much better than a spinner.
- **Natural language element targeting during replay** — If the replay engine uses Mistral vision to find elements on the page (rather than fixed CSS selectors), this is a strong differentiator worth calling out. It means the skill works even if the UI changes slightly. This is what makes it "AI-powered" rather than just a macro.
- **"You showed it once. It runs forever."** — The tagline/narrative is itself a differentiator. Frame the demo around this story and it becomes memorable. Judges remember stories, not features.

---

## Anti-Features (Do NOT Build)

These are features that seem valuable but will consume disproportionate time for a 1-day hackathon, introduce demo-breaking risk, or distract from the core value proposition.

- **Skill library / persistence / database** — Saving and loading skills across sessions adds backend complexity (database, file management, listing UI) for zero demo value. The demo shows one skill, end-to-end. Hardcode it in memory.
- **User authentication / accounts** — Zero value for a hackathon demo. Adds routing, session management, and UI chrome that distracts from the core flow.
- **Parameterization / variables (e.g. `{{email}}`)** — Conceptually cool but requires a variable binding UI, a parameter input form before replay, and template parsing. The "edit the markdown directly" approach achieves the same demo effect with zero additional code.
- **Branching / conditional logic in skills** — Turns a simple linear flow into a state machine. The visual flow diagram becomes a graph editor. Complexity explodes. Linear steps are sufficient for a compelling demo.
- **Error handling / retry logic in replay** — If the replay fails on stage, no amount of retry logic will save it. Instead, invest that time in making the happy path bulletproof with a controlled test form.
- **Cross-browser support** — Chromium only. Do not spend time on Firefox or Safari. Playwright defaults to Chromium; leave it there.
- **Scheduled execution / cron** — Enterprise feature, not demo feature. Adds a scheduling UI, a job runner, and persistence. Zero wow factor for judges.
- **Mobile / responsive design** — The demo is on a laptop on a projector. Build for 1280x720 or 1920x1080, nothing else.
- **Polished onboarding / empty states** — The demo starts with a click. Do not build a landing page, tutorial, or empty state. The audience sees the full flow, not the edge cases.
- **Complex video processing (scene detection, OCR, etc.)** — Diminishing returns. Simple frame extraction at 2fps with basic pixel-diff filtering is sufficient. Spending time on sophisticated computer vision takes time from the parts the audience actually sees.

---

## Recommended Demo Flow

This is the optimal sequence for a 3-5 minute hackathon presentation.

### Setup (before going on stage)
- Have the app running and loaded on the Record screen.
- Have a simple test form hosted locally (e.g., a sign-up form with email, password, and a submit button that shows a success message). You control this form, so it will not change or break.
- Have a pre-recorded video as a backup in case live recording fails.

### The Demo (3-5 minutes)

1. **Open with the problem** (15 seconds): "Teaching an AI to do a task means writing code for every click, every field, every page. What if you could just show it once?"

2. **Record** (30 seconds): Click Record, perform the workflow on the test form (navigate, fill email, fill password, click submit, see success message). Click Stop. If live recording is too risky, upload the pre-recorded video. Do not apologize for using upload; frame it as "I recorded this earlier."

3. **Processing** (20-30 seconds): Show the processing screen. Call out the streaming progress: "It's extracting key frames from the video... now Mistral is analyzing each frame in parallel... and now it's synthesizing the skill." If this is slow, narrate what is happening technically.

4. **Reveal the skill** (30 seconds): The split-pane editor appears. Pause here. Let the audience read the markdown. Say: "This is a human-readable skill document. Not code. Not JSON. Markdown that anyone can read and edit." Point out the visual flow diagram on the right.

5. **Edit** (20 seconds): Change the email address in the markdown from `test@example.com` to something memorable like `hackathon@mistral.ai`. Show the flow diagram update. Say: "I just changed the data. No code. Just editing text."

6. **Replay** (30 seconds): Click Replay. The audience watches the agent open a browser, navigate to the form, type the NEW email address, fill in the rest, and submit. Success message appears. This is the climax.

7. **Close** (10 seconds): "You showed it once. It runs forever. And you can change it anytime."

### Key Principles
- **Control every variable.** Own the test form. Pre-record a backup video. Test the full flow 10 times before presenting.
- **The edit-then-replay is the climax.** Everything builds to the moment the agent uses the edited value. If you cut anything, do not cut this.
- **Narrate the processing.** Dead air during AI calls kills momentum. Explain what is happening.
- **Keep it short.** 3 minutes of clean demo beats 5 minutes with fumbling.

---

## Key Findings

1. **Markdown is the moat.** No existing tool in this space produces human-readable, editable markdown as the skill format. Every competitor outputs code, JSON, or opaque workflow definitions. This is SkillForge's single clearest differentiator and should be the centerpiece of the demo narrative. Do not bury it.

2. **The "edit then replay" loop is what separates this from a macro recorder.** A simple record-and-replay is Selenium IDE from 2006. The ability to edit the generated skill and have the agent respect those edits is what makes this an AI-powered tool. The demo must include an edit step before replay, or it looks like every other recorder.

3. **AI browser agents (Browser Use, Skyvern, etc.) go the other direction.** They take instructions and produce actions. SkillForge takes actions (a demo) and produces instructions (a skill). This is a complementary approach, and worth calling out: "Instead of writing instructions for an agent, you show it what to do."

4. **Processing visibility is disproportionately important for a live demo.** Enterprise RPA tools hide their processing behind opaque loading screens. Showing keyframe extraction, parallel AI analysis, and skill generation as a streaming pipeline is both technically interesting and visually engaging. Invest in good SSE streaming and progress UI.

5. **The replay must be bulletproof, even if it means simplifying.** A 3-step replay that works perfectly on stage is worth more than an 8-step replay that fails on step 5. Use a controlled test form you host yourself. Pre-test on the exact machine and network you will demo on. Have the pre-recorded video fallback ready. The audience remembers whether it worked, not how many steps it had.
