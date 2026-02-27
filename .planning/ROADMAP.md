# Roadmap: SkillForge

## Overview

Three engineers work in parallel on their respective components (video pipeline, skill engine, frontend UI) while maintaining clean API contracts through integration tests. After individual components are functional, integration phase wires them together end-to-end, and the final phase focuses on demo polish and live execution. The full loop from demo record → skill generation → edit → replay must work live on stage.

## Phases

- [ ] **Phase 1: Video Pipeline** - Capture video, extract frames, stream analysis to frontend
- [ ] **Phase 2: Skill Engine** - Synthesize frames into markdown, parse bidirectionally, enable replay
- [ ] **Phase 3: Frontend UI** - Build 4-screen flow with live SSE updates and interactive editing
- [ ] **Phase 4: Integration** - Wire all three components together with clean API contracts
- [ ] **Phase 5: Demo Polish** - End-to-end testing, demo preparation, live stage execution

## Phase Details

### Phase 1: Video Pipeline

**Goal**: User can upload a video file, the system intelligently extracts keyframes, analyzes each frame via Mistral vision API in parallel, and streams analysis results back to the frontend in real-time.

**Depends on**: Nothing (first phase)

**Requirements**: VID-01, VID-02, VID-03, VID-04, VID-05, INT-01

**Success Criteria** (what must be TRUE):
  1. User can upload an mp4 or webm file via the Next.js API endpoint
  2. System detects UI changes and extracts keyframes at intelligent boundaries (not every frame)
  3. Each keyframe is sent to Mistral vibe CLI vision API and returns descriptive text
  4. Frame analysis results stream back to frontend via SSE as they complete
  5. Frontend displays real-time progress ("Extracting frames...", "Analyzing frame 3/12...")

**Plans**: TBD

Plans:
- [ ] 01-01: Video upload API endpoint + ffmpeg frame extraction
- [ ] 01-02: Mistral vibe vision integration (parallel batch analysis)
- [ ] 01-03: SSE streaming pipeline for progress and frame results

### Phase 2: Skill Engine

**Goal**: Frame descriptions are synthesized into a well-formed skill markdown document, markdown parses to JSON for visualization, JSON converts back to markdown, and users can trigger replay with step-by-step progress streamed back.

**Depends on**: Phase 1 (frame data available)

**Requirements**: SKL-01, SKL-02, SKL-03, SKL-04, SKL-05, SKL-06

**Success Criteria** (what must be TRUE):
  1. Mistral vibe CLI synthesizes frame descriptions into markdown with Context, Steps, and Notes sections
  2. Markdown parser converts skill markdown to JSON structure without loss of information
  3. JSON-to-markdown converter recreates identical markdown from JSON (bidirectional round-trip)
  4. Skill markdown follows the defined format: structured Context, numbered Steps, actionable Notes
  5. User can trigger replay and vibe CLI executes each step sequentially
  6. Replay progress streams back via SSE showing current step and completion status

**Plans**: TBD

Plans:
- [ ] 02-01: Skill markdown synthesis via vibe CLI
- [ ] 02-02: Markdown ↔ JSON bidirectional parser
- [ ] 02-03: Replay execution engine with SSE streaming

### Phase 3: Frontend UI

**Goal**: Build the four-screen user journey with live SSE-driven updates, split-pane markdown/visual editor with bidirectional sync, and step-by-step replay visualization.

**Depends on**: Phase 1 (receives frame analysis), Phase 2 (consumes markdown/JSON structure)

**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08

**Success Criteria** (what must be TRUE):
  1. Upload screen displays drag-and-drop zone and file picker for video selection
  2. Processing screen shows animated progress with live SSE updates ("Extracting frames...", frame counts)
  3. Edit screen displays split-pane: markdown editor on left, visual flow diagram on right
  4. Markdown editor has syntax highlighting and users can edit skill steps directly
  5. Visual flow diagram renders from JSON using React Flow and updates as user edits
  6. Bidirectional sync: editing markdown updates the diagram in real-time, editing the diagram updates markdown
  7. Replay screen shows step-by-step progress indicator with current step highlighted
  8. Replay button triggers agent execution and user sees progress in real-time

**Plans**: TBD

Plans:
- [ ] 03-01: Upload and Processing screens with SSE integration
- [ ] 03-02: Edit screen with markdown editor and React Flow diagram
- [ ] 03-03: Bidirectional sync logic + Replay screen

### Phase 4: Integration

**Goal**: Wire all three components together with clean API contracts, ensure SSE streaming works end-to-end, and validate that the full loop (upload → analyze → edit → replay) executes without cross-component friction.

**Depends on**: Phase 1 (Video), Phase 2 (Skill Engine), Phase 3 (Frontend)

**Requirements**: INT-01, INT-02, INT-03

**Success Criteria** (what must be TRUE):
  1. All three builders have clean API contracts defined and documented (who calls what, what format)
  2. Frontend API calls to backend all receive properly formatted responses
  3. SSE streaming from all endpoints (frame analysis, skill synthesis, replay) reaches frontend without interruption
  4. Full end-to-end flow works: upload video → get frames → synthesize skill → display in editor → replay
  5. draw.io diagrams generated for architecture and data flow (for docs/demo)

**Plans**: TBD

Plans:
- [ ] 04-01: API contract definition and validation
- [ ] 04-02: End-to-end integration testing
- [ ] 04-03: Architecture and flow diagram generation

### Phase 5: Demo Polish

**Goal**: Prepare for live stage demo with thorough end-to-end testing on realistic workflow, ensure reliability, handle demo-specific edge cases, and rehearse the full user journey.

**Depends on**: Phase 4 (all components integrated)

**Requirements**: (no new requirements—consolidates phases 1-4)

**Success Criteria** (what must be TRUE):
  1. Full end-to-end demo scenario works reliably (record simple form-filling workflow, generate skill, edit, replay)
  2. All error messages are user-friendly and guide recovery without crashing
  3. SSE reconnection handles brief network hiccups gracefully
  4. Demo UI is polished: no layout shifts, no console errors, smooth transitions
  5. User can explain the demo flow and replicable steps are documented for rehearsal

**Plans**: TBD

Plans:
- [ ] 05-01: End-to-end demo testing with realistic workflow
- [ ] 05-02: Error handling, edge cases, and recovery
- [ ] 05-03: UI polish and demo rehearsal script

## Progress

**Execution Order:**
Phases 1, 2, 3 execute in parallel. Phase 4 executes after all three. Phase 5 executes last.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Video Pipeline | 0/3 | Not started | - |
| 2. Skill Engine | 0/3 | Not started | - |
| 3. Frontend UI | 0/3 | Not started | - |
| 4. Integration | 0/3 | Not started | - |
| 5. Demo Polish | 0/3 | Not started | - |

---
*Roadmap created: 2026-02-28*
*Depth: quick (3-5 phases, 1-3 plans each)*
*Team: 3 parallel builders*
