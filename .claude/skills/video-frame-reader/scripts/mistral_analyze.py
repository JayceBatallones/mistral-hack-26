#!/usr/bin/env python3
"""Simple Mistral vision analyzer for a batch of frames.

Reads local images, sends them to Mistral Chat Completions API, and writes
the response to a file. Designed to be called by parallel_analyze.py.
"""

import argparse
import base64
import json
import mimetypes
import os
import urllib.request
from pathlib import Path


API_URL = "https://api.mistral.ai/v1/chat/completions"
DEFAULT_MODEL = "mistral-small-latest"


def file_to_data_url(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    if not mime:
        mime = "image/jpeg"
    data = Path(path).read_bytes()
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


def build_messages(prompt: str, frames: list[str]) -> list[dict]:
    content = [{"type": "text", "text": prompt}]
    for frame in frames:
        content.append({"type": "image_url", "image_url": file_to_data_url(frame)})
    return [{"role": "user", "content": content}]


def call_mistral(api_key: str, model: str, messages: list[dict]) -> dict:
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(API_URL, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body)


def extract_text(response: dict) -> str:
    try:
        choice = response["choices"][0]["message"]["content"]
    except Exception:
        return json.dumps(response, ensure_ascii=False, indent=2)

    if isinstance(choice, str):
        return choice
    if isinstance(choice, list):
        parts = []
        for item in choice:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
        return "\n".join(p for p in parts if p)
    return json.dumps(response, ensure_ascii=False, indent=2)


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze frame batch with Mistral vision model")
    parser.add_argument("--frames", nargs="+", required=True, help="Frame image paths")
    parser.add_argument("--out", required=True, help="Output text file")
    parser.add_argument(
        "--prompt",
        default="Summarize the key actions, screens, and any notable issues shown in these frames.",
        help="Analysis prompt",
    )
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Mistral model name")
    parser.add_argument(
        "--env",
        default=".env",
        help="Path to .env file (default: .env in current working directory)",
    )
    args = parser.parse_args()

    load_env_file(Path(args.env))

    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        raise SystemExit("MISTRAL_API_KEY is not set")

    messages = build_messages(args.prompt, args.frames)
    response = call_mistral(api_key, args.model, messages)
    text = extract_text(response)

    Path(args.out).write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
