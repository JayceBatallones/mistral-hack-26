---
name: video-frame-reader
description: |
  A skill that extracts keyframes from video files and analyzes their content.
  Automatically removes duplicate frames and optimizes image quality to reduce token consumption.

  Use when:
  - User provides a video file (.mp4, .mov, .avi, etc.)
  - User requests "watch this video", "analyze this video", "what's in this video"
  - Checking screen recordings or screencasts
  - Keyframe extraction is needed from video
---

# Video Frame Reader

Extract keyframes from video, present token cost, then analyze.

## Requirements

- ffmpeg (for frame extraction)
- Python 3 + Pillow + numpy

**Windows:** ffmpeg must be available in a conda environment named `media tools`.
**Linux/Mac:** ffmpeg must be on PATH; Python deps via venv.

## Workflow

### 1. Capture User Intent

Clearly understand why the user wants the video analyzed:
- Example: "The screen transition behavior looks wrong"
- Example: "I want to check the response after button click"
- Example: "Help me identify performance issues"

This intent becomes important context for the analysis.

### 2. Setup (First Time Only)

Detect the platform and run the appropriate setup:

**Windows — conda `media tools` env:**
```bash
conda install -n "media tools" pillow numpy --quiet -y
```

**Linux/Mac — venv:**
```bash
cd {baseDir}/scripts
python3 -m venv venv
source venv/bin/activate
pip install Pillow numpy --quiet
```

### 3. Extract Keyframes

**Windows (conda):**
```bash
conda run -n "media tools" python "{baseDir}/scripts/extract_keyframes.py" "<video_path>" --method scene --ensure-last
```

**Linux/Mac (venv):**
```bash
source {baseDir}/scripts/venv/bin/activate
# Fast default (scene detection) with optional last-frame inclusion
python3 {baseDir}/scripts/extract_keyframes.py "<video_path>" --method scene --ensure-last
```

### 4. Analyze Frames with Mistral Vision (Parallel)

After user approval, run `analyze_frames_mistral.py` with all frame paths.
The script batches every 4 consecutive frames into one Mistral API call and
fires **all batches in parallel** (e.g. 40 frames → 10 simultaneous API calls).

**Setup (first time only):**
```bash
# Linux/Mac
source {baseDir}/scripts/venv/bin/activate
pip install mistralai --quiet

# Windows (conda)
conda install -n "media tools" mistralai --quiet -y
```

**Run analysis:**

```bash
# Linux/Mac
source {baseDir}/scripts/venv/bin/activate
python3 {baseDir}/scripts/analyze_frames_mistral.py \
  frame_001.jpg frame_002.jpg ... frame_040.jpg \
  --prompt "User intent: {Intent from Step 1}. Describe what is happening across these consecutive video frames." \
  --format json \
  --output analysis.json
```

```bash
# Windows (conda)
conda run -n "media tools" python "{baseDir}/scripts/analyze_frames_mistral.py" ^
  frame_001.jpg frame_002.jpg ... frame_040.jpg ^
  --prompt "User intent: {Intent from Step 1}. Describe what is happening across these consecutive video frames." ^
  --format json ^
  --output analysis.json
```

Key options:
- `--model` — default `mistral-large-latest` (Mistral Large 3); use `pixtral-large-latest` or `pixtral-12b-2409` for vision-only alternatives
- `--workers N` — cap parallel calls (default: all batches at once)
- `--format json|text` — JSON for structured pickup, text for readability
- `MISTRAL_API_KEY` — read from env or `--api-key` flag

The script reads the JSON output and you merge the `results[].description` fields
into a final chronological report.

Benefits of this approach:
- All batches fire simultaneously — 40 frames analyzed as fast as 4
- `mistral-large-latest` sees exactly 4 consecutive frames per call for temporal context
- Pure Python + `mistralai` SDK, no Claude subagents needed
- Results arrive in original frame order regardless of completion order

> **Tip:** Pass `--env /path/to/.env.local` if your project stores `MISTRAL_API_KEY` in `.env.local` instead of `.env`.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `-m, --method` | scene | Extraction method: `scene` (fast) or `similarity` (slow) |
| `-t, --threshold` | 0.3 | Scene threshold for `scene` method (lower = more frames kept) |
| `-q, --quality` | 30 | JPEG quality (1-100) |
| `-s, --scale` | 0.3 | Resize scale |
| `-o, --output` | `<video_name>_keyframes/` | Output directory |
| `-w, --workers` | CPU-1 | Parallel compression workers (`similarity` method only) |
| `--ensure-last` | off | Include last frame (`scene` method only) |

### Token Reduction Example

**Windows (conda):**
```bash
# More aggressive reduction
conda run -n "media tools" python "{baseDir}/scripts/extract_keyframes.py" video.mp4 --method scene -t 0.2 -q 20 -s 0.2 --ensure-last

# Similarity method
conda run -n "media tools" python "{baseDir}/scripts/extract_keyframes.py" video.mp4 --method similarity -t 0.85 -q 30 -s 0.3 -w 6
```

**Linux/Mac (venv):**
```bash
# More aggressive reduction (lower threshold, quality, and size)
python3 {baseDir}/scripts/extract_keyframes.py video.mp4 --method scene -t 0.2 -q 20 -s 0.2 --ensure-last

# Similarity method (slower, more precise)
python3 {baseDir}/scripts/extract_keyframes.py video.mp4 --method similarity -t 0.85 -q 30 -s 0.3 -w 6
```
