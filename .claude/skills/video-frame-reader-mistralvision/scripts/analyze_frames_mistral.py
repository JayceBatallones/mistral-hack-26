#!/usr/bin/env python3
"""Analyze video frames with Mistral vision in consecutive batches of 4, all in parallel."""

import argparse
import base64
import json
import mimetypes
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

DEFAULT_MODEL = "mistral-large-latest"
BATCH_SIZE = 4
DEFAULT_PROMPT = (
    "Describe what is happening across these consecutive video frames. "
    "Focus on motion/changes, UI actions, and notable events."
)


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


def is_url_or_data(value: str) -> bool:
    return value.startswith(("http://", "https://", "data:"))


def to_image_url(frame: str) -> str:
    if is_url_or_data(frame):
        return frame

    path = Path(frame)
    if not path.exists():
        raise FileNotFoundError(f"Frame not found: {frame}")

    mime, _ = mimetypes.guess_type(path.name)
    if not mime:
        mime = "image/jpeg"

    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def chunk_frames(frames: list[str], size: int = BATCH_SIZE) -> list[list[str]]:
    return [frames[i:i + size] for i in range(0, len(frames), size)]


def extract_text(response) -> str:
    choices = getattr(response, "choices", None)
    if choices is None and isinstance(response, dict):
        choices = response.get("choices", [])
    if not choices:
        return ""

    message = getattr(choices[0], "message", None)
    if message is None and isinstance(choices[0], dict):
        message = choices[0].get("message", {})

    content = getattr(message, "content", None)
    if content is None and isinstance(message, dict):
        content = message.get("content")

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            text = getattr(item, "text", None)
            if text is None and isinstance(item, dict):
                if item.get("type") == "text":
                    text = item.get("text")
            if text:
                parts.append(text)
        return "\n".join(parts).strip()

    return ""


def analyze_batch(client, model: str, prompt: str, frames: list[str], retries: int = 4) -> str:
    content = [{"type": "text", "text": prompt}]
    for frame in frames:
        content.append({"type": "image_url", "image_url": to_image_url(frame)})

    delay = 5.0
    for attempt in range(retries + 1):
        try:
            response = client.chat.complete(
                model=model,
                messages=[{"role": "user", "content": content}],
                temperature=0,
            )
            return extract_text(response)
        except Exception as exc:
            is_rate_limit = ("429" in str(exc) or "rate_limit" in str(exc).lower()) \
                            and "ConnectError" not in type(exc).__name__ \
                            and "ConnectError" not in str(exc)
            if is_rate_limit and attempt < retries:
                print(f"[rate limit] waiting {delay:.0f}s before retry {attempt + 1}/{retries}...", file=sys.stderr)
                time.sleep(delay)
                delay *= 2
            else:
                raise


def render_text(results: list[dict]) -> str:
    lines: list[str] = []
    for item in results:
        lines.append(f"Batch {item['batch_index']}")
        lines.append("Frames:")
        for frame in item["frames"]:
            lines.append(f"- {frame}")
        lines.append("Description:")
        lines.append(item["description"])
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze frames with Mistral vision API in consecutive groups of 4"
    )
    parser.add_argument("frames", nargs="+", help="Frame image paths or image URLs")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Mistral model (default: {DEFAULT_MODEL})")
    parser.add_argument("--prompt", default=DEFAULT_PROMPT, help="Prompt sent with each 4-frame batch")
    parser.add_argument("--format", choices=["json", "text"], default="json", help="Output format")
    parser.add_argument("--output", help="Optional output file path; defaults to stdout")
    parser.add_argument("--env", default=".env", help="Path to .env file for MISTRAL_API_KEY")
    parser.add_argument("--api-key", help="Mistral API key (overrides MISTRAL_API_KEY env var)")
    parser.add_argument("--workers", type=int, default=0,
                        help="Max parallel API calls (default: number of batches, i.e. all at once)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.env:
        load_env_file(Path(args.env))

    api_key = args.api_key or os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        raise SystemExit("MISTRAL_API_KEY is not set. Pass --api-key or provide it in env/.env")

    try:
        from mistralai import Mistral
    except ImportError:
        raise SystemExit("Missing dependency: mistralai. Install with: pip install mistralai")

    client = Mistral(api_key=api_key)

    batches = chunk_frames(args.frames, BATCH_SIZE)
    max_workers = args.workers if args.workers > 0 else len(batches)

    # Fire all batch API calls in parallel
    futures = {}
    results: list[dict] = [None] * len(batches)  # type: ignore[list-item]
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        for idx, batch in enumerate(batches):
            future = pool.submit(analyze_batch, client, args.model, args.prompt, batch)
            futures[future] = (idx, batch)

        for future in as_completed(futures):
            idx, batch = futures[future]
            description = future.result()
            results[idx] = {
                "batch_index": idx + 1,
                "frames": batch,
                "description": description,
            }

    if args.format == "json":
        output = json.dumps(
            {
                "model": args.model,
                "batch_size": BATCH_SIZE,
                "results": results,
            },
            ensure_ascii=False,
            indent=2,
        )
    else:
        output = render_text(results)

    if args.output:
        Path(args.output).write_text(output, encoding="utf-8")
    else:
        sys.stdout.write(output + ("" if output.endswith("\n") else "\n"))


if __name__ == "__main__":
    main()
