#!/usr/bin/env python3
"""
Fetch copyright-free documentary visuals, crop watermarks, sharpen, scale, and render Ken Burns 30fps MP4.
Usage: python fetch_asset.py "<query>" "<output_mp4_path>" [--duration 4] [--aspect-ratio "16:9"]
"""

import sys
import os
import argparse
import urllib.request
import urllib.parse
import subprocess
from pathlib import Path

KEYWORD_FALLBACKS = {
    "naval": "https://images.unsplash.com/photo-1509299349698-dd22323b5963?w=1920&q=85",
    "strait": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1920&q=85",
    "oil": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1920&q=85",
    "tanker": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1920&q=85",
    "tech": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=85",
    "ai": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=85",
    "chip": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=85",
    "bubble": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=85",
    "market": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1920&q=85",
    "stock": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1920&q=85",
    "loss": "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1920&q=85",
    "finance": "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1920&q=85",
    "archive": "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=1920&q=85",
    "history": "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=1920&q=85",
    "war": "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=1920&q=85",
    "satellite": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=85",
    "space": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=85"
}

def get_fallback_url(query: str) -> str:
    ql = query.lower()
    for k, v in KEYWORD_FALLBACKS.items():
        if k in ql:
            return v
    return "https://images.unsplash.com/photo-1509299349698-dd22323b5963?w=1920&q=85"

def fetch_and_enhance(query: str, output_path: str, duration: float = 4.0, aspect_ratio: str = "16:9"):
    is_9x16 = aspect_ratio == "9:16"
    target_w = 1080 if is_9x16 else 1920
    target_h = 1920 if is_9x16 else 1080
    frames = max(60, int(duration * 30))

    clean_q = " ".join([w for w in query.replace(",", " ").split() if len(w) > 2][:6])
    if not clean_q:
        clean_q = "geopolitics naval documentary"

    temp_jpg = Path(output_path).with_suffix(".temp.jpg")
    temp_jpg.parent.mkdir(parents=True, exist_ok=True)

    downloaded = False

    # 1. Primary: Pollinations flux (photorealistic, high-res)
    prompt = f"cinematic 8k documentary photograph of {clean_q}, dramatic lighting, National Geographic style, highly detailed, photorealism"
    encoded_prompt = urllib.parse.quote(prompt)
    ai_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?model=flux&width={target_w}&height={target_h}&nologo=true"

    try:
        req = urllib.request.Request(ai_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=12) as response, open(str(temp_jpg), "wb") as out_file:
            out_file.write(response.read())
        if temp_jpg.exists() and temp_jpg.stat().st_size > 10000:
            downloaded = True
    except Exception as e:
        print(f"[WARN] Online AI download error: {e}", file=sys.stderr)

    # 2. Secondary: High-res Curated Unsplash photo fallback
    if not downloaded:
        fb_url = get_fallback_url(clean_q)
        try:
            req = urllib.request.Request(fb_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=10) as response, open(str(temp_jpg), "wb") as out_file:
                out_file.write(response.read())
            if temp_jpg.exists() and temp_jpg.stat().st_size > 10000:
                downloaded = True
        except Exception as e2:
            print(f"[WARN] Fallback download error: {e2}", file=sys.stderr)

    if not downloaded:
        print("[INFO] Fallback to local media required.", file=sys.stderr)
        sys.exit(1)

    # 3. FFmpeg Watermark Crop + Lanczos Scaling + Unsharp Sharpening + Color Grade + Ken Burns Motion
    vf_filter = (
        f"crop=in_w*0.93:in_h*0.93:in_w*0.035:in_h*0.035,"
        f"scale={target_w}:{target_h}:flags=lanczos,"
        f"unsharp=5:5:0.8:5:5:0.4,"
        f"eq=contrast=1.15:brightness=-0.02:saturation=1.12,"
        f"zoompan=z='min(zoom+0.0018,1.15)':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={target_w}x{target_h}:fps=30"
    )

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1",
        "-i", str(temp_jpg),
        "-t", str(duration),
        "-vf", vf_filter,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-g", "30",
        "-movflags", "+faststart",
        "-crf", "19",
        str(output_path)
    ]

    try:
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        try:
            temp_jpg.unlink(missing_ok=True)
        except Exception:
            pass
        if res.returncode == 0 and os.path.exists(output_path):
            print(f"[SUCCESS] Enhanced copyright-free video saved: {output_path}")
            sys.exit(0)
        else:
            print(f"[ERROR] FFmpeg failed: {res.stderr[:200]}", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Subprocess error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch and enhance copyright-free visual asset")
    parser.add_argument("query", help="Visual search query")
    parser.add_argument("output", help="Output MP4 path")
    parser.add_argument("--duration", type=float, default=4.0, help="Shot duration in seconds")
    parser.add_argument("--aspect-ratio", default="16:9", help="16:9 or 9:16")

    args = parser.parse_args()
    fetch_and_enhance(args.query, args.output, args.duration, args.aspect_ratio)
