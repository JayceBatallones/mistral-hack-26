# SkillForge

## What This Is

A hackathon tool where users record a screen demo of any workflow, and the system generates an editable skill in markdown that an agent can replay on demand. Users show a workflow once; the agent replicates it forever. Built in 1 day by a 3-person team.

## Core Value

A user can record a screen workflow and get back an editable, replayable skill document — the full loop from demo to automation must work end-to-end in a live presentation.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can record screen or upload a video file
- [ ] System extracts keyframes from video (intelligent UI-change detection)
- [ ] Mistral vibe CLI analyzes each frame in parallel (vision API)
- [ ] Frame descriptions are synthesized into a skill markdown document
- [ ] Skill is displayed as editable markdown with visual flow diagram (split-pane)
- [ ] Edits in markdown sync to visual flow and vice versa
- [ ] Markdown parses to/from JSON for visualization
- [ ] User can trigger replay — vibe CLI executes the skill
- [ ] SSE streaming for processing progress and replay status
- [ ] 4-screen UI flow: Record → Process → Edit → Replay

### Out of Scope

- Skill library / persistence across sessions — hackathon demo only
- Parameterization / variables in skills — future scope
- Branching / conditional logic — future scope
- Scheduled execution — future scope
- User auth / accounts — unnecessary for demo
- Mobile support — desktop demo only

## Context

- **Hackathon**: 1-day build, 3 engineers working in parallel
- **Mistral vibe CLI**: The core engine — similar to `claude -p` for Claude Code. Handles vision analysis, skill synthesis, and replay execution. No separate backend server needed.
- **Architecture**: Next.js app with API routes that shell out to `vibe` CLI. SSE streams results back to the browser. Everything is TypeScript.
- **Demo target**: Record a simple form-filling workflow, generate the skill, edit it, replay it live on stage.
- **PRD exists**: `docs/PRD.md` has full detail on skill format, action types, JSON schema, and UI wireframes.

## Constraints

- **Timeline**: 1-day hackathon — ship a working demo, not production code
- **Tech stack**: TypeScript, Next.js, React, Mistral vibe CLI — no Python, no separate backend
- **Mistral vibe**: All AI calls go through vibe CLI (vision analysis, synthesis, replay) — no direct API client code
- **Integration**: 3 people building in parallel, must integrate cleanly with minimal coordination

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript everywhere (no Python) | Single language across team, Next.js handles server needs | — Pending |
| Mistral vibe CLI instead of direct API | Simplifies AI integration, handles streaming natively | — Pending |
| No separate backend server | Next.js API routes + vibe CLI covers all server needs | — Pending |
| Markdown as source of truth for skills | Human-readable, LLM-friendly, easy to edit, git-friendly | — Pending |

---
*Last updated: 2026-02-28 after initialization*
