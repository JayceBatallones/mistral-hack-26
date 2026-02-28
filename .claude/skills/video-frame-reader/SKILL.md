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

### 3b. Parallel Analyze (Mistral)

Run extraction + parallel analysis + merged report:

```bash
python3 {baseDir}/scripts/run_analysis.py "<video_path>" \
  --env /path/to/.env \
  --batch-size 6 \
  --max-workers 4 \
  --model mistral-small-latest
```

Output example (JSON):
```json
{
  "keyframe_count": 52,
  "image_size": "266x576",
  "total_tokens": 10400,
  "cost_usd_opus": 0.156,
  "cost_usd_sonnet": 0.031,
  "cost_usd_haiku": 0.0104,
  "files": ["/.../key_0001.jpg", ...]
}
```

### 4. Present Cost

After extraction, present the following to the user:

```
Keyframe extraction complete:
- Frames extracted: {keyframe_count}
- Image size: {image_size}
- Estimated tokens: {total_tokens}
- Cost estimate: Haiku ${cost_usd_haiku} / Sonnet ${cost_usd_sonnet} / Opus ${cost_usd_opus}

Proceed with frame analysis?
```

### 5. Invoke Parallel Subagents After Approval

After user approval, split the frame list into 4 sequential chunks and spawn
all 4 Task subagents **in a single message** so they run in parallel:

```
# Split files array into 4 equal chunks, then call all 4 in one message:

Task(subagent_type="general-purpose", model="haiku", description="Frames 1/4",
  prompt="""
User intent: {Intent from Step 1}

Analyze these sequential video frames in order and summarize key actions,
screens, and anything relevant to the user's intent:
{chunk 1 paths, one per line}
""")

Task(subagent_type="general-purpose", model="haiku", description="Frames 2/4",
  prompt="""
User intent: {Intent from Step 1}

Analyze these sequential video frames in order and summarize key actions,
screens, and anything relevant to the user's intent:
{chunk 2 paths, one per line}
""")

Task(subagent_type="general-purpose", model="haiku", description="Frames 3/4",
  prompt="""...""")

Task(subagent_type="general-purpose", model="haiku", description="Frames 4/4",
  prompt="""...""")
```

Once all 4 subagents return, merge their summaries into a final report.

Benefits of this approach:
- ✅ 4× faster than sequential analysis
- ✅ Each subagent has temporal context across its chunk
- ✅ User intent threaded through every subagent
- ✅ No extra scripts or API keys needed

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
