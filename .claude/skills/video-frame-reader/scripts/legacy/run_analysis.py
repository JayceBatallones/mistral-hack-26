#!/usr/bin/env python3
"""End-to-end runner: extract keyframes, run parallel Mistral analysis, merge results."""

import argparse
import json
import subprocess
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
EXTRACT_SCRIPT = BASE_DIR / "extract_keyframes.py"
PARALLEL_SCRIPT = BASE_DIR / "parallel_analyze.py"
MISTRAL_SCRIPT = BASE_DIR / "mistral_analyze.py"


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or result.stdout.strip())


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract frames and analyze in parallel with Mistral")
    parser.add_argument("video", help="Input video file")
    parser.add_argument("--out-dir", default=None, help="Output directory for keyframes")
    parser.add_argument("--method", default="scene", choices=["scene", "similarity"])
    parser.add_argument("--threshold", type=float, default=0.3, help="Scene/similarity threshold")
    parser.add_argument("--quality", type=int, default=30, help="JPEG quality")
    parser.add_argument("--scale", type=float, default=0.3, help="Resize scale")
    parser.add_argument("--ensure-last", action="store_true", help="Ensure last frame included (scene only)")
    parser.add_argument("--batch-size", type=int, default=6, help="Frames per analysis batch")
    parser.add_argument("--max-workers", type=int, default=4, help="Parallel analysis workers")
    parser.add_argument("--model", default="mistral-small-latest", help="Mistral model")
    parser.add_argument(
        "--prompt",
        default="Summarize the key actions, screens, and any notable issues shown in these frames.",
        help="Analysis prompt",
    )
    parser.add_argument("--env", default=".env", help="Path to .env file")
    parser.add_argument("--merged", default="analysis_merged.txt", help="Merged report path")
    args = parser.parse_args()

    video_path = Path(args.video)
    output_dir = args.out_dir or str(video_path.parent / f"{video_path.stem}_keyframes")
    output_dir_path = Path(output_dir)
    output_dir_path.mkdir(parents=True, exist_ok=True)

    extract_cmd = [
        "python3",
        str(EXTRACT_SCRIPT),
        str(video_path),
        "--method",
        args.method,
        "--threshold",
        str(args.threshold),
        "--quality",
        str(args.quality),
        "--scale",
        str(args.scale),
        "--output",
        str(output_dir_path),
    ]
    if args.method == "scene" and args.ensure_last:
        extract_cmd.append("--ensure-last")

    result = subprocess.run(extract_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or result.stdout.strip())

    data = json.loads(result.stdout)
    frames = data.get("files", [])
    if not frames:
        raise SystemExit("No frames produced")

    frames_json = output_dir_path / "frames.json"
    frames_json.write_text(json.dumps({"files": frames}, indent=2))

    command = (
        f"python3 {MISTRAL_SCRIPT} --frames {{frames}} --out {{output}} "
        f"--model {args.model} --prompt {json.dumps(args.prompt)} --env {args.env}"
    )

    parallel_cmd = [
        "python3",
        str(PARALLEL_SCRIPT),
        "--frames-json",
        str(frames_json),
        "--batch-size",
        str(args.batch_size),
        "--max-workers",
        str(args.max_workers),
        "--command",
        command,
        "--out-dir",
        str(output_dir_path / "analysis_batches"),
        "--merged",
        str(output_dir_path / args.merged),
    ]
    run(parallel_cmd)

    print(str(output_dir_path / args.merged))


if __name__ == "__main__":
    main()
