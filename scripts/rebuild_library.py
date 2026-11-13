#!/usr/bin/env python3
"""
Rebuild public/videos/library with photorealistic, cinematic 1080p documentary footage loops.
Uses model=flux + Unsplash/Wikimedia high-res fallbacks.
Completely replaces any synthetic test patterns/color bars.
"""

import os
import sys
import time
import urllib.request
import urllib.parse
import subprocess
from pathlib import Path

LIBRARY_CLIPS = [
    {
        "name": "ocean_naval.mp4",
        "prompt": "naval fleet aircraft carrier and guided missile destroyers navigating turbulent ocean waters, National Geographic style, dramatic sky, photorealistic 8k",
        "fallback_url": "https://images.unsplash.com/photo-1509299349698-dd22323b5963?w=1920&q=85"
    },
    {
        "name": "datacenter_tech.mp4",
        "prompt": "futuristic artificial intelligence datacenter, glowing blue server racks, fiber optic cabling, high tech silicon compute clusters, photorealistic 8k",
        "fallback_url": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=85"
    },
    {
        "name": "satellite_globe.mp4",
        "prompt": "ultra realistic orbital satellite view of planet Earth at dusk with glowing city lights, atmospheric glow, geopolitical landmasses, National Geographic 8k space",
        "fallback_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=85"
    },
    {
        "name": "finance_trade.mp4",
        "prompt": "massive crude oil supertanker sailing through strategic international strait at golden hour, commercial shipping, global petroleum trade, 8k cinematic",
        "fallback_url": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1920&q=85"
    },
    {
        "name": "military_surveillance.mp4",
        "prompt": "tactical reconnaissance drone surveillance view over strategic maritime coastline, military command telemetry, night vision thermal imaging overlay, 8k high detail",
        "fallback_url": "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=1920&q=85"
    }
]

def generate_clip(item, out_dir):
    out_path = out_dir / item["name"]
    temp_jpg = out_dir / f"{item['name']}.temp.jpg"

    print(f"[*] Generating photorealistic {item['name']}...")
    encoded = urllib.parse.quote(item["prompt"])
    url = f"https://image.pollinations.ai/prompt/{encoded}?model=flux&width=1920&height=1080&nologo=true"

    downloaded = False
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=16) as r, open(temp_jpg, "wb") as f:
            f.write(r.read())
        if temp_jpg.exists() and temp_jpg.stat().st_size > 15000:
            downloaded = True
    except Exception as e:
        print(f"[!] Pollinations flux error for {item['name']}: {e}")

    # Fallback to high-resolution Unsplash photo
    if not downloaded and item.get("fallback_url"):
        try:
            print(f"[*] Using high-res curated fallback for {item['name']}...")
            req = urllib.request.Request(item["fallback_url"], headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=12) as r, open(temp_jpg, "wb") as f:
                f.write(r.read())
            if temp_jpg.exists() and temp_jpg.stat().st_size > 15000:
                downloaded = True
        except Exception as e2:
            print(f"[!] Fallback download failed: {e2}")

    if not downloaded:
        print(f"[!] Could not get visual for {item['name']}")
        return False

    # FFmpeg: 1080p, Lanczos, sharpening, cinematic color grade, and smooth 30fps Ken Burns camera motion
    vf = (
        "crop=in_w*0.93:in_h*0.93:in_w*0.035:in_h*0.035,"
        "scale=1920:1080:flags=lanczos,"
        "unsharp=5:5:0.8:5:5:0.4,"
        "eq=contrast=1.15:brightness=-0.02:saturation=1.12,"
        "zoompan=z='min(zoom+0.0015,1.15)':d=300:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30"
    )

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1",
        "-i", str(temp_jpg),
        "-t", "10",
        "-vf", vf,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-g", "30",
        "-movflags", "+faststart",
        "-crf", "19",
        str(out_path)
    ]

    res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    temp_jpg.unlink(missing_ok=True)

    if res.returncode == 0 and out_path.exists() and out_path.stat().st_size > 50000:
        print(f"[+] Successfully rebuilt {item['name']} ({out_path.stat().st_size // 1024} KB)")
        return True
    else:
        print(f"[!] FFmpeg error on {item['name']}: {res.stderr[:200]}")
        return False

if __name__ == "__main__":
    out_dir = Path("public/videos/library")
    out_dir.mkdir(parents=True, exist_ok=True)
    for item in LIBRARY_CLIPS:
        generate_clip(item, out_dir)
        time.sleep(1)
    print("[ALL DONE] Library clips rebuilt with real cinematic visuals!")
