# Requirements: SkillForge

**Defined:** 2026-02-28
**Core Value:** User records a screen workflow and gets back an editable, replayable skill document

## v1 Requirements

### Video Processing (Person 1 — Backend)

- [ ] **VID-01**: User can upload a video file (mp4/webm) via the UI
- [ ] **VID-02**: System extracts keyframes using intelligent UI-change detection (ffmpeg)
- [ ] **VID-03**: Each keyframe is sent to Mistral vision via `vibe` CLI in parallel
- [ ] **VID-04**: Frame analysis results stream back to frontend via SSE
- [ ] **VID-05**: Processing progress displayed in real-time ("Extracting frames...", "Analyzing frame 3/12...")

### Skill Engine (Person 2 — Backend)

- [ ] **SKL-01**: Frame descriptions are synthesized into skill markdown via `vibe` CLI
- [ ] **SKL-02**: Markdown parses to JSON (for visual flow diagram)
- [ ] **SKL-03**: JSON converts back to markdown (bidirectional)
- [ ] **SKL-04**: Skill markdown follows the defined format (Context, Steps, Notes)
- [ ] **SKL-05**: User can trigger replay — `vibe` CLI executes the skill
- [ ] **SKL-06**: Replay status streams back via SSE (step-by-step progress)

### Frontend (Person 3 — Frontend)

- [ ] **UI-01**: Upload screen — drag-and-drop or file picker for video upload
- [ ] **UI-02**: Processing screen — animated progress with SSE-driven status updates
- [ ] **UI-03**: Edit screen — split-pane: markdown editor (left) + visual flow diagram (right)
- [ ] **UI-04**: Markdown editor with syntax highlighting (CodeMirror)
- [ ] **UI-05**: Visual flow diagram rendered from JSON (React Flow)
- [ ] **UI-06**: Bidirectional sync — edits in markdown update flow, edits in flow update markdown
- [ ] **UI-07**: Replay screen — step-by-step progress indicator, current step highlighted
- [ ] **UI-08**: Replay button triggers agent execution

### Integration

- [ ] **INT-01**: Next.js API routes shell out to `vibe "prompt"` and stream output via SSE
- [ ] **INT-02**: draw.io MCP used for generating architecture/flow diagrams in docs
- [ ] **INT-03**: All three builders can work in parallel with clean API contracts

## v2 Requirements

### Enhancements

- **ENH-01**: Live screen recording via MediaRecorder API (skip file upload)
- **ENH-02**: Skill library — save and browse past skills
- **ENH-03**: Parameterization — turn hardcoded values into `{{variables}}`
- **ENH-04**: Branching logic — conditional steps

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live screen recording | MediaRecorder complexity — upload is sufficient for demo |
| User auth / accounts | Unnecessary for hackathon demo |
| Skill persistence / database | In-memory or file-based is fine for demo |
| Mobile support | Desktop demo only |
| Error recovery / retry | Polish — not needed for controlled demo |
| Multi-page workflows | Keep demo simple — single page workflow |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VID-01 | Phase 1 | Pending |
| VID-02 | Phase 1 | Pending |
| VID-03 | Phase 1 | Pending |
| VID-04 | Phase 1 | Pending |
| VID-05 | Phase 1 | Pending |
| SKL-01 | Phase 2 | Pending |
| SKL-02 | Phase 2 | Pending |
| SKL-03 | Phase 2 | Pending |
| SKL-04 | Phase 2 | Pending |
| SKL-05 | Phase 2 | Pending |
| SKL-06 | Phase 2 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 3 | Pending |
| UI-07 | Phase 3 | Pending |
| UI-08 | Phase 3 | Pending |
| INT-01 | Phase 1 | Pending |
| INT-02 | Phase 4 | Pending |
| INT-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after roadmap creation*
