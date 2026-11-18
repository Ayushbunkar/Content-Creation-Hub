import subprocess
import os
import json

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
edge_cli = os.path.join(root_dir, ".venv-tts", "Scripts", "edge-tts.exe")
out_dir = os.path.join(root_dir, "public", "audio")

scenes_data = [
    {
        "sceneNumber": 1,
        "timeRange": "0–10s",
        "narration": "Modern bridges decay after 50 years, but 2,000-year-old Roman piers are literally getting stronger today. Here is the astonishing scientific truth behind how it works.",
        "file": "narration_roman_concrete_s1.wav",
        "metricNumber": "2,000+ YEARS",
        "metricLabel": "OPUS CAEMENTICIUM",
        "heroIcon": "🏛️",
        "documentHeadline": "OFFICIAL ARCHEOLOGICAL & CHEMICAL AUDIT: OPUS CAEMENTICIUM",
        "documentSnippet": "Modern bridges decay after 50 years, but 2,000-year-old Roman piers are literally getting stronger today."
    },
    {
        "sceneNumber": 2,
        "timeRange": "10–20s",
        "narration": "Roman marine concrete combined volcanic pozzolana ash with quicklime and seawater. When seawater percolates through over centuries, lime clasts dissolve.",
        "file": "narration_roman_concrete_s2.wav",
        "metricNumber": "100% SELF-HEALING",
        "metricLabel": "LIME CLAST REACTION",
        "heroIcon": "🧪",
        "documentHeadline": "EMPIRICAL TOBERMORITE CRYSTALLINE HEALING MECHANISM",
        "documentSnippet": "Roman marine concrete combined volcanic pozzolana ash with quicklime and seawater."
    },
    {
        "sceneNumber": 3,
        "timeRange": "20–30s",
        "narration": "This verified mechanism demonstrates published research in Science Advances. Hot-mixing of quicklime creates lime clasts that dynamically seal fractures into rock-solid stone.",
        "file": "narration_roman_concrete_s3.wav",
        "metricNumber": "TOBERMORITE TITAN",
        "metricLabel": "PERPETUAL DURABILITY",
        "heroIcon": "🗿",
        "documentHeadline": "2,000-YEAR COMPRESSIVE STRENGTH vs MODERN RETENTION",
        "documentSnippet": "Published in Science Advances (MIT, Harvard, and D'Ambrosio labs, 2023): hot-mixing of quicklime creates lime clasts that seal fractures."
    }
]

for s in scenes_data:
    mp3_path = os.path.join(out_dir, s["file"].replace(".wav", ".mp3"))
    wav_path = os.path.join(out_dir, s["file"])
    
    cmd = [edge_cli, "--text", s["narration"], "--voice", "en-US-ChristopherNeural", "--write-media", mp3_path]
    subprocess.run(cmd, check=True)
    
    subprocess.run(["ffmpeg", "-y", "-i", mp3_path, "-ar", "24000", wav_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(mp3_path):
        os.remove(mp3_path)
    print(f"Generated Roman Concrete Scene {s['sceneNumber']} audio: {wav_path}")

full_text = " ".join([s["narration"] for s in scenes_data])
full_mp3 = os.path.join(out_dir, "narration_roman_concrete_full.mp3")
full_wav = os.path.join(out_dir, "narration_roman_concrete_full.wav")
subprocess.run([edge_cli, "--text", full_text, "--voice", "en-US-ChristopherNeural", "--write-media", full_mp3], check=True)
subprocess.run(["ffmpeg", "-y", "-i", full_mp3, "-ar", "24000", full_wav], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if os.path.exists(full_mp3):
    os.remove(full_mp3)

props = {
    "title": "Why Roman Concrete Gets Stronger Over 2,000 Years While Ours Cracks",
    "verifiedConcept": "Roman marine concrete combines volcanic pozzolana ash with quicklime and seawater, dissolving lime clasts to crystallize aluminous tobermorite and phillipsite, self-healing microcracks into rock-solid stone.",
    "duration": 30,
    "aspectRatio": "9:16",
    "scenes": [
        {
            "sceneNumber": s["sceneNumber"],
            "timeRange": s["timeRange"],
            "narration": s["narration"],
            "narrationSrc": f"/audio/{s['file']}",
            "videoPrompt": "Paper Roman architecture with quicklime clasts and mineral crystals.",
            "paperElements": ["Cream cardstock background", "Colosseum cutout", "Quicklime mineral loupe", "Tobermorite crystal needles"],
            "metricNumber": s["metricNumber"],
            "metricLabel": s["metricLabel"],
            "heroIcon": s["heroIcon"],
            "documentHeadline": s["documentHeadline"],
            "documentSnippet": s["documentSnippet"]
        }
        for s in scenes_data
    ],
    "sources": ["Science Advances (MIT, Harvard, 2023)", "USGS Pozzolan Mineral Reports"],
    "narrationSrc": "/audio/narration_roman_concrete_full.wav",
    "musicSrc": "/audio/bgm/ambient_documentary.wav",
    "sfxEnabled": True
}

props_path = os.path.join(root_dir, "public", "props_roman_concrete.json")
with open(props_path, "w", encoding="utf-8") as f:
    json.dump(props, f, indent=2)

print(f"Generated Props: {props_path}")
