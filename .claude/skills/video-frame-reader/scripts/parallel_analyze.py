#!/usr/bin/env python3
"""Parallel batch runner for frame analysis commands.

This script does not assume any specific LLM provider. You supply a command
template that will be executed per batch. It will run batches concurrently
and merge results into a single report file.
"""

import argparse
import json
import os
import shlex
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


def load_frames(args) -> list[str]:
    if args.frames_json:
        data = json.loads(Path(args.frames_json).read_text())
        return list(data.get("files", []))
    if args.frames:
        return args.frames
    raise ValueError("Provide --frames-json or --frames")


def chunk_list(items: list[str], size: int) -> list[list[str]]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def run_batch(command_template: str, batch: list[str], batch_index: int, out_dir: Path) -> Path:
    out_path = out_dir / f"batch_{batch_index:03d}.txt"
    frames_arg = " ".join(shlex.quote(p) for p in batch)
    cmd = command_template.format(
        frames=frames_arg,
        batch_index=batch_index,
        output=shlex.quote(str(out_path)),
    )

    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"Batch {batch_index} failed: {result.stderr.strip() or result.stdout.strip()}"
        )

    if not out_path.exists():
        out_path.write_text(result.stdout)

    return out_path


def merge_outputs(output_files: list[Path], merged_path: Path) -> None:
    with merged_path.open("w", encoding="utf-8") as f:
        for path in output_files:
            f.write(f"## {path.name}\n")
            f.write(path.read_text(encoding="utf-8"))
            if not path.read_text().endswith("\n"):
                f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run analysis command in parallel batches")
    parser.add_argument("--frames-json", help="JSON file from extract_keyframes.py")
    parser.add_argument("--frames", nargs="+", help="Frame paths")
    parser.add_argument("--batch-size", type=int, default=6, help="Frames per batch")
    parser.add_argument("--max-workers", type=int, default=os.cpu_count() or 4)
    parser.add_argument(
        "--command",
        required=True,
        help=(
            "Command template. Available placeholders: {frames}, {batch_index}, {output}. "
            "If the command doesn't write to {output}, stdout will be captured."
        ),
    )
    parser.add_argument(
        "--out-dir",
        default="analysis_batches",
        help="Directory to store batch outputs",
    )
    parser.add_argument(
        "--merged",
        default="analysis_merged.txt",
        help="Merged output file",
    )

    args = parser.parse_args()

    frames = load_frames(args)
    if not frames:
        raise SystemExit("No frames provided")

    batches = chunk_list(frames, max(1, args.batch_size))
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    output_files: list[Path] = []
    with ThreadPoolExecutor(max_workers=max(1, args.max_workers)) as executor:
        futures = [
            executor.submit(run_batch, args.command, batch, i + 1, out_dir)
            for i, batch in enumerate(batches)
        ]
        for fut in as_completed(futures):
            output_files.append(fut.result())

    output_files.sort()
    merged_path = Path(args.merged)
    merge_outputs(output_files, merged_path)
    print(str(merged_path))


if __name__ == "__main__":
    main()
