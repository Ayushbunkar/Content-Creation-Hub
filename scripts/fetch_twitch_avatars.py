import os
import sys
import json
import urllib.request
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
}

dest_dir = os.path.join(os.getcwd(), 'public', 'streamers')
os.makedirs(dest_dir, exist_ok=True)

twitch_streamers = [
    ("kai_cenat", "https://www.twitch.tv/kaicenat"),
    ("xqc", "https://www.twitch.tv/xqc"),
    ("jynxzi", "https://www.twitch.tv/jynxzi"),
    ("caseoh", "https://www.twitch.tv/caseoh_"),
    ("tarik", "https://www.twitch.tv/tarik"),
    ("asmongold", "https://www.youtube.com/@AsmongoldTV/about"),
    ("asmongold_alt", "https://www.youtube.com/@zackrawrr")
]

for sid, url in twitch_streamers:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            og_match = re.search(r'<meta\s+property=[\"\']og:image[\"\']\s+content=[\"\']([^\"\']+)[\"\']', html)
            if not og_match:
                og_match = re.search(r'content=[\"\']([^\"\']+)[\"\']\s+property=[\"\']og:image[\"\']', html)
            if not og_match:
                og_match = re.search(r'\"avatar\":\{\"thumbnails\":\[\{\"url\":\"(https://yt3[^\"]+)\"', html)

            if og_match:
                img_url = og_match.group(1)
                print(f"[{sid}] Found real avatar URL: {img_url}")
                img_req = urllib.request.Request(img_url, headers=headers)
                with urllib.request.urlopen(img_req, timeout=8) as img_resp:
                    img_bytes = img_resp.read()
                    target_name = sid.replace('_alt', '')
                    target_path = os.path.join(dest_dir, f"{target_name}.jpg")
                    with open(target_path, 'wb') as f:
                        f.write(img_bytes)
                    print(f"[{target_name}] Successfully saved {len(img_bytes)} bytes -> /streamers/{target_name}.jpg")
            else:
                print(f"[{sid}] og:image not found in HTML")
    except Exception as e:
        print(f"[{sid}] Error: {e}")
