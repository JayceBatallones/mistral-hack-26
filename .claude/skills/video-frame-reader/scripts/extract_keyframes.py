#!/usr/bin/env python3
"""
Extract keyframes from video files.
Removes duplicate frames and saves compressed images.
"""

import argparse
import json
import math
import multiprocessing as mp
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image


def calculate_similarity(img1_path: str, img2_path: str) -> float:
    """Calculate similarity between two images (0-1, where 1 is identical)."""
    img1 = Image.open(img1_path).convert('L')
    img2 = Image.open(img2_path).convert('L')

    size = (200, 400)
    img1 = img1.resize(size, Image.Resampling.LANCZOS)
    img2 = img2.resize(size, Image.Resampling.LANCZOS)

    arr1 = np.array(img1, dtype=np.float32)
    arr2 = np.array(img2, dtype=np.float32)

    arr1_norm = arr1 - arr1.mean()
    arr2_norm = arr2 - arr2.mean()

    numerator = np.sum(arr1_norm * arr2_norm)
    denominator = np.sqrt(np.sum(arr1_norm**2) * np.sum(arr2_norm**2))

    if denominator == 0:
        return 1.0

    return max(0, numerator / denominator)


def compress_and_save(src_path: Path, dest_path: Path, quality: int, scale: float) -> Path:
    """Compress and save image."""
    img = Image.open(src_path)

    if scale != 1.0:
        new_size = (int(img.width * scale), int(img.height * scale))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    dest_jpg = dest_path.with_suffix('.jpg')
    img.save(dest_jpg, 'JPEG', quality=quality, optimize=True)

    return dest_jpg


def _compress_worker(args):
    src_path, dest_path, quality, scale = args
    return compress_and_save(Path(src_path), Path(dest_path), quality, scale)


def extract_frames_with_ffmpeg(video_path: str, output_dir: Path) -> bool:
    """Extract all frames from video using ffmpeg."""
    output_pattern = output_dir / "frame_%04d.png"

    cmd = [
        "ffmpeg", "-i", video_path,
        "-vsync", "0",
        str(output_pattern),
        "-y", "-hide_banner", "-loglevel", "error"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


def get_video_info(video_path: str) -> dict:
    """Get video information."""
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", video_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return {}

    return json.loads(result.stdout)


def _parse_float(value: str) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def estimate_total_frames(video_info: dict) -> int:
    streams = video_info.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), {})

    nb_frames = video_stream.get("nb_frames")
    if nb_frames is not None:
        try:
            return int(nb_frames)
        except Exception:
            pass

    duration = _parse_float(video_stream.get("duration", "0"))
    if duration <= 0:
        duration = _parse_float(video_info.get("format", {}).get("duration", "0"))

    fps_text = video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate") or "0/1"
    try:
        num, den = fps_text.split("/")
        fps = float(num) / float(den) if float(den) != 0 else 0.0
    except Exception:
        fps = 0.0

    if duration > 0 and fps > 0:
        return int(duration * fps)

    return 0


def _jpeg_quality_to_qv(quality: int) -> int:
    # Map 1-100 JPEG quality to ffmpeg's qscale range (2-31, lower is better).
    quality = max(1, min(100, quality))
    qv = int(round((101 - quality) / 4))
    return max(2, min(31, qv))


def extract_keyframes_scene(
    video_path: str,
    output_dir: str,
    scene_threshold: float = 0.3,
    quality: int = 30,
    scale: float = 0.3,
    ensure_last: bool = True,
) -> dict:
    """Fast keyframe extraction using ffmpeg scene detection."""
    video_path = Path(video_path)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    output_pattern = output_path / "key_%04d.jpg"
    select_expr = f"select='eq(n,0)+gt(scene,{scene_threshold})'"
    if scale != 1.0:
        select_expr += f",scale=iw*{scale}:ih*{scale}"

    cmd = [
        "ffmpeg", "-i", str(video_path),
        "-vf", select_expr,
        "-vsync", "vfr",
        "-q:v", str(_jpeg_quality_to_qv(quality)),
        str(output_pattern),
        "-y", "-hide_banner", "-loglevel", "error"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return {"error": "Failed to extract keyframes with ffmpeg scene detection"}

    saved_files = sorted(output_path.glob("key_*.jpg"))
    if not saved_files:
        return {"error": "No keyframes extracted"}

    # Optionally ensure last frame is included (cheap single-frame decode).
    if ensure_last:
        last_path = output_path / "_last_frame.jpg"
        last_cmd = [
            "ffmpeg", "-sseof", "-0.001", "-i", str(video_path),
            "-frames:v", "1",
            "-q:v", str(_jpeg_quality_to_qv(quality)),
            str(last_path),
            "-y", "-hide_banner", "-loglevel", "error"
        ]
        last_result = subprocess.run(last_cmd, capture_output=True, text=True)
        if last_result.returncode == 0 and last_path.exists():
            # Avoid duplicates by checking similarity with last extracted frame.
            similarity = calculate_similarity(str(saved_files[-1]), str(last_path))
            if similarity < 0.98:
                new_index = len(saved_files) + 1
                final_last = output_path / f"key_{new_index:04d}.jpg"
                last_path.replace(final_last)
                saved_files.append(final_last)
            else:
                last_path.unlink(missing_ok=True)

    video_info = get_video_info(str(video_path))
    total_frames = estimate_total_frames(video_info)

    sample_img = Image.open(saved_files[0])
    img_width, img_height = sample_img.width, sample_img.height

    total_size = sum(p.stat().st_size for p in saved_files) / 1024

    pixels_per_image = img_width * img_height
    tokens_per_image = int(pixels_per_image / 1_000_000 * 1300)
    total_tokens = tokens_per_image * len(saved_files)

    cost_opus = total_tokens * 15 / 1_000_000
    cost_sonnet = total_tokens * 3 / 1_000_000
    cost_haiku = total_tokens * 1 / 1_000_000

    return {
        "video_path": str(video_path),
        "output_dir": str(output_path),
        "total_frames": total_frames,
        "keyframe_count": len(saved_files),
        "reduction_rate": round((1 - len(saved_files) / total_frames) * 100, 1) if total_frames else None,
        "image_size": f"{img_width}x{img_height}",
        "total_size_kb": round(total_size, 1),
        "total_size_mb": round(total_size / 1024, 2),
        "tokens_per_image": tokens_per_image,
        "total_tokens": total_tokens,
        "cost_usd_opus": round(cost_opus, 3),
        "cost_usd_sonnet": round(cost_sonnet, 3),
        "cost_usd_haiku": round(cost_haiku, 4),
        "files": [str(p) for p in saved_files],
        "settings": {
            "method": "scene",
            "scene_threshold": scene_threshold,
            "quality": quality,
            "scale": scale,
            "ensure_last": ensure_last,
        },
    }


def extract_keyframes(
    video_path: str,
    output_dir: str,
    similarity_threshold: float = 0.85,
    quality: int = 30,
    scale: float = 0.3,
    workers: int = 0
) -> dict:
    """
    Extract keyframes from video.

    Returns:
        dict: Extraction result information
    """
    video_path = Path(video_path)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Extract all frames to temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Extract frames with ffmpeg
        if not extract_frames_with_ffmpeg(str(video_path), temp_path):
            return {"error": "Failed to extract frames with ffmpeg"}

        frames = sorted(temp_path.glob("frame_*.png"))

        if not frames:
            return {"error": "No frames found"}

        total_frames = len(frames)

        # Extract keyframes
        keyframes = [frames[0]]
        last_keyframe = frames[0]

        for frame in frames[1:]:
            similarity = calculate_similarity(str(last_keyframe), str(frame))
            if similarity < similarity_threshold:
                keyframes.append(frame)
                last_keyframe = frame

        if keyframes[-1] != frames[-1]:
            keyframes.append(frames[-1])

        # Compress and save
        saved_files = []
        total_size = 0

        jobs = []
        for i, frame in enumerate(keyframes, start=1):
            dest = output_path / f"key_{i:04d}.jpg"
            jobs.append((str(frame), str(dest), quality, scale))

        if workers is None or workers <= 1:
            results = [_compress_worker(j) for j in jobs]
        else:
            with mp.Pool(processes=workers) as pool:
                results = pool.map(_compress_worker, jobs)

        for saved_path in results:
            size_kb = saved_path.stat().st_size / 1024
            total_size += size_kb
            saved_files.append(str(saved_path))

        # Get image dimensions
        sample_img = Image.open(saved_files[0])
        img_width, img_height = sample_img.width, sample_img.height

        # Token calculation (1000x1000 = 1,000,000px -> 1300 tokens)
        pixels_per_image = img_width * img_height
        tokens_per_image = int(pixels_per_image / 1_000_000 * 1300)
        total_tokens = tokens_per_image * len(keyframes)

        # Cost calculation (input token price: $/1M tokens)
        cost_opus = total_tokens * 15 / 1_000_000
        cost_sonnet = total_tokens * 3 / 1_000_000
        cost_haiku = total_tokens * 1 / 1_000_000

        return {
            "video_path": str(video_path),
            "output_dir": str(output_path),
            "total_frames": total_frames,
            "keyframe_count": len(keyframes),
            "reduction_rate": round((1 - len(keyframes) / total_frames) * 100, 1),
            "image_size": f"{img_width}x{img_height}",
            "total_size_kb": round(total_size, 1),
            "total_size_mb": round(total_size / 1024, 2),
            "tokens_per_image": tokens_per_image,
            "total_tokens": total_tokens,
            "cost_usd_opus": round(cost_opus, 3),
            "cost_usd_sonnet": round(cost_sonnet, 3),
            "cost_usd_haiku": round(cost_haiku, 4),
            "files": saved_files,
            "settings": {
                "similarity_threshold": similarity_threshold,
                "quality": quality,
                "scale": scale
            }
        }


def main():
    parser = argparse.ArgumentParser(description="Extract keyframes from video")
    parser.add_argument("video", help="Input video file")
    parser.add_argument("-o", "--output", default=None, help="Output directory")
    parser.add_argument(
        "-t", "--threshold",
        type=float,
        default=0.3,
        help="Similarity threshold for scene detection (default: 0.3)"
    )
    parser.add_argument("-q", "--quality", type=int, default=30, help="JPEG quality (default: 30)")
    parser.add_argument("-s", "--scale", type=float, default=0.3, help="Resize scale (default: 0.3)")
    parser.add_argument(
        "-m", "--method",
        choices=["scene", "similarity"],
        default="scene",
        help="Keyframe extraction method (default: scene)"
    )
    parser.add_argument(
        "-w", "--workers",
        type=int,
        default=max(1, (mp.cpu_count() or 2) - 1),
        help="Worker processes for compression (similarity method only)"
    )
    parser.add_argument(
        "--ensure-last",
        action="store_true",
        help="Ensure last frame is included (scene method only)"
    )

    args = parser.parse_args()

    # Default output directory
    if args.output is None:
        video_path = Path(args.video)
        args.output = str(video_path.parent / f"{video_path.stem}_keyframes")

    if args.method == "scene":
        result = extract_keyframes_scene(
            video_path=args.video,
            output_dir=args.output,
            scene_threshold=args.threshold,
            quality=args.quality,
            scale=args.scale,
            ensure_last=args.ensure_last,
        )
    else:
        result = extract_keyframes(
            video_path=args.video,
            output_dir=args.output,
            similarity_threshold=args.threshold,
            quality=args.quality,
            scale=args.scale,
            workers=args.workers,
        )

    # JSON output
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
