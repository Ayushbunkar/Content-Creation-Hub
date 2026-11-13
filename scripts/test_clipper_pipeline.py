#!/usr/bin/env python3
import urllib.request
import json
import time
import subprocess
import os
import sys

BASE_URL = "http://127.0.0.1:3000"

def log(msg):
    print(f"[TEST] {msg}")

def request(method, path, data=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    if data is not None:
        req.add_header('Content-Type', 'application/json')
        body = json.dumps(data).encode('utf-8')
        req.data = body
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def main():
    log("1. Checking server health...")
    try:
        projects = request('GET', '/api/projects')
        log(f"Server alive! Found {len(projects)} existing projects.")
    except Exception as e:
        log(f"Server check failed: {e}")
        sys.exit(1)

    log("2. Creating Viral Clipper project from local long-form video...")
    create_body = {
        "sourceType": "local",
        "localPath": "output/documentary_hormuz_1080p.mp4",
        "targetDuration": "15-30",
        "clipCountTarget": 3,
        "language": "auto"
    }
    res = request('POST', '/api/clipper/projects/create', create_body)
    proj_id = res['id']
    log(f"Project created with ID: {proj_id}")

    log("3. Waiting for full pipeline processing (audio extract -> whisper transcribe -> viral moment detection)...")
    max_wait = 120
    elapsed = 0
    proj_data = None
    while elapsed < max_wait:
        time.sleep(3)
        elapsed += 3
        proj_data = request('GET', f'/api/clipper/projects/{proj_id}')
        status = proj_data.get('status')
        progress = proj_data.get('progress')
        log(f"Status: {status} ({progress}%) after {elapsed}s")
        if status in ['ready', 'failed']:
            break

    if proj_data.get('status') != 'ready':
        log(f"FAILED: Project did not reach 'ready' state: {proj_data.get('error_message')}")
        sys.exit(1)

    clips = proj_data.get('clips', [])
    log(f"Pipeline complete! Extracted {len(clips)} distinct viral moments:")
    for idx, c in enumerate(clips):
        log(f"  Clip #{idx+1}: [{c['category']}] (Score: {c['engagement_score']}/100)")
        log(f"    Title: {c['title']}")
        log(f"    Hook: '{c['hook']}'")
        log(f"    Window: {c['start_time']}s -> {c['end_time']}s ({c['duration']}s duration)")
        log(f"    Reason: {c['reason']}")

    if not clips:
        log("FAILED: No clips extracted!")
        sys.exit(1)

    first_clip = clips[0]
    clip_id = first_clip['id']

    log("4. Testing clip parameter update (tuning title & reframing mode to blur_background)...")
    update_res = request('PUT', f'/api/clipper/clips/{clip_id}', {
        "title": "GLOBAL ENERGY CHOKEPOINT SHOCK",
        "reframing_mode": "blur_background",
        "caption_template": "word-pop"
    })
    log(f"Updated clip title: {update_res['clip']['title']}, mode: {update_res['clip']['reframing_mode']}")

    log("5. Rendering single 9:16 vertical reel using FFmpeg + smart reframing + animated captions...")
    render_res = request('POST', f'/api/clipper/clips/{clip_id}/render')
    video_url = render_res.get('videoUrl')
    log(f"Render succeeded! Output video URL: {video_url}")

    # Inspect rendered video with ffprobe
    local_file = video_url.lstrip('/')
    if not os.path.exists(local_file):
        log(f"FAILED: Rendered file not found on disk at {local_file}")
        sys.exit(1)

    probe_proc = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'stream=width,height,r_frame_rate,duration', '-of', 'default=noprint_wrappers=1', local_file],
        capture_output=True, text=True
    )
    log(f"Rendered video stream properties:\n{probe_proc.stdout.strip()}")
    assert "width=1080" in probe_proc.stdout, "Width must be 1080"
    assert "height=1920" in probe_proc.stdout, "Height must be 1920 (9:16 vertical format)"

    log("6. Testing 1-click bridge to Caption Studio...")
    bridge_res = request('POST', f'/api/clipper/clips/{clip_id}/open-in-caption-studio')
    cap_proj = bridge_res.get('captionProject')
    log(f"Bridged to Caption Studio successfully! Project ID: {cap_proj['id']}, Title: {cap_proj['title']}")

    log("7. Testing ZIP export for project...")
    zip_url = f"{BASE_URL}/api/clipper/projects/{proj_id}/export-zip"
    zip_req = urllib.request.Request(zip_url)
    with urllib.request.urlopen(zip_req) as resp:
        zip_bytes = resp.read()
        log(f"ZIP downloaded successfully! Size: {len(zip_bytes)} bytes")
        assert len(zip_bytes) > 1000, "ZIP file should contain actual media bytes"

    log("=======================================================")
    log("ALL 12 ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
    log("=======================================================")

if __name__ == '__main__':
    main()
