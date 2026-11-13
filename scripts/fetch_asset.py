#!/usr/bin/env python3
"""
Intelligent Multimedia Asset Harvester for Cinematic Documentaries
1. Searches Wikimedia Commons for authentic, high-res public domain photographs of people, places, and events
2. Falls back to Pollinations AI Flux / Unsplash for cinematic photorealistic imagery
3. Saves high-res imagery to cache for Remotion sub-pixel Ken Burns rendering
Usage: python fetch_asset.py "<query>" "<output_image_path>" [--duration 4] [--aspect-ratio "16:9"]
"""

import sys
import os
import argparse
import urllib.request
import urllib.parse
import json
from pathlib import Path

USER_AGENT = "LocalAIStudio/2.0 (documentary-production@local.ai; educational documentary research)"

KEYWORD_FALLBACKS = {
    "naval": "https://images.unsplash.com/photo-1509299349698-dd22323b5963?w=1920&q=85",
    "strait": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1920&q=85",
    "oil": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1920&q=85",
    "tanker": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1920&q=85",
    "tech": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=85",
    "ai": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=85",
    "chip": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=85",
    "nvidia": "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=1920&q=85",
    "market": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1920&q=85",
    "finance": "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1920&q=85",
    "archive": "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=1920&q=85",
    "history": "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=1920&q=85",
    "war": "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=1920&q=85",
    "satellite": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=85",
}

def clean_query_text(text: str) -> str:
    stopwords = {
        'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'of', 'to', 'for', 'with', 'as', 'by',
        'that', 'this', 'from', 'or', 'are', 'was', 'were', 'it', 'its', 'be', 'been', 'has', 'have',
        'into', 'across', 'under', 'yet', 'more', 'than', 'over', 'barely', 'single', 'total', 'some'
    }
    words = [w.strip('.,;:"!?') for w in text.split() if w.lower() not in stopwords and len(w) > 2]
    return " ".join(words[:5])

def fetch_wikimedia_image(query: str, target_file: Path) -> bool:
    """Search Wikimedia Commons for authentic public domain / CC photographs"""
    try:
        api_url = (
            "https://commons.wikimedia.org/w/api.php?action=query&generator=search"
            f"&gsrnamespace=6&gsrsearch={urllib.parse.quote(query)}"
            "&gsrlimit=3&prop=imageinfo&iiprop=url|mime&format=json"
        )
        req = urllib.request.Request(api_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            pages = data.get('query', {}).get('pages', {})
            for page in pages.values():
                info = page.get('imageinfo', [{}])[0]
                img_url = info.get('url')
                mime = info.get('mime', '')
                if img_url and ('image/jpeg' in mime or 'image/png' in mime or 'image/webp' in mime):
                    # Download image
                    img_req = urllib.request.Request(img_url, headers={"User-Agent": USER_AGENT})
                    with urllib.request.urlopen(img_req, timeout=10) as img_resp, open(str(target_file), 'wb') as f:
                        f.write(img_resp.read())
                    if target_file.exists() and target_file.stat().st_size > 15000:
                        return True
    except Exception as e:
        print(f"[WARN] Wikimedia search note: {e}", file=sys.stderr)
    return False

def fetch_pollinations_image(query: str, target_file: Path, width: int = 1920, height: int = 1080) -> bool:
    """Generate or download cinematic photorealistic image via Pollinations Flux"""
    try:
        prompt = f"cinematic 8k documentary photograph of {query}, dramatic lighting, National Geographic style, highly detailed, photorealism"
        encoded = urllib.parse.quote(prompt)
        ai_url = f"https://image.pollinations.ai/prompt/{encoded}?model=flux&width={width}&height={height}&nologo=true"
        req = urllib.request.Request(ai_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=12) as resp, open(str(target_file), 'wb') as f:
            f.write(resp.read())
        if target_file.exists() and target_file.stat().st_size > 15000:
            return True
    except Exception as e:
        print(f"[WARN] AI image generation note: {e}", file=sys.stderr)
    return False

def fetch_unsplash_fallback(query: str, target_file: Path) -> bool:
    """High-res Curated Unsplash photo fallback"""
    ql = query.lower()
    selected = "https://images.unsplash.com/photo-1509299349698-dd22323b5963?w=1920&q=85"
    for k, v in KEYWORD_FALLBACKS.items():
        if k in ql:
            selected = v
            break
    try:
        req = urllib.request.Request(selected, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=8) as resp, open(str(target_file), 'wb') as f:
            f.write(resp.read())
        if target_file.exists() and target_file.stat().st_size > 15000:
            return True
    except Exception as e:
        print(f"[WARN] Unsplash fallback note: {e}", file=sys.stderr)
    return False

def main():
    parser = argparse.ArgumentParser(description="Fetch documentary visuals")
    parser.add_argument("query", help="Visual search query")
    parser.add_argument("output", help="Output file path (.jpg)")
    parser.add_argument("--duration", type=float, default=4.0)
    parser.add_argument("--aspect-ratio", default="16:9")
    args = parser.parse_args()

    out_path = Path(args.output)
    # Ensure directory exists
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Force .jpg extension if .mp4 was passed
    if out_path.suffix.lower() == '.mp4':
        out_path = out_path.with_suffix('.jpg')

    is_9x16 = args.aspect_ratio == "9:16"
    target_w = 1080 if is_9x16 else 1920
    target_h = 1920 if is_9x16 else 1080

    clean_q = clean_query_text(args.query) or "cinematic investigation"

    # 1. Search authentic Wikimedia Commons photos (best for named figures, places, history)
    if fetch_wikimedia_image(clean_q, out_path):
        print(f"[SUCCESS] Downloaded authentic Wikimedia photograph for '{clean_q}' -> {out_path}")
        sys.exit(0)

    # 2. AI Flux Cinematic 8K Photorealistic Image
    if fetch_pollinations_image(clean_q, out_path, target_w, target_h):
        print(f"[SUCCESS] Generated Flux 8K documentary photograph for '{clean_q}' -> {out_path}")
        sys.exit(0)

    # 3. Curated Unsplash 1080p Fallback
    if fetch_unsplash_fallback(clean_q, out_path):
        print(f"[SUCCESS] Fetched curated Unsplash visual for '{clean_q}' -> {out_path}")
        sys.exit(0)

    print(f"[ERROR] Could not fetch visual for '{clean_q}'", file=sys.stderr)
    sys.exit(1)

if __name__ == "__main__":
    main()
