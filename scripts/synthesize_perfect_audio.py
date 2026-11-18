import subprocess
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(script_dir)
edge_cli = os.path.join(root_dir, ".venv-tts", "Scripts", "edge-tts.exe")

scenes = [
    {
        "file": "narration_paper_perfect_s1.wav",
        "text": "If you put away just ten rupees every morning, the math does something unbelievable over 30 years. Here is the astonishing scientific truth behind how it works.",
        "voice": "en-US-ChristopherNeural"
    },
    {
        "file": "narration_paper_perfect_s2.wav",
        "text": "Saving ten rupees daily equals 3,650 rupees per year, amounting to strictly 1,09,500 rupees in total principal over 30 years.",
        "voice": "en-US-ChristopherNeural"
    },
    {
        "file": "narration_paper_perfect_s3.wav",
        "text": "This verified mechanism demonstrates the compound interest formula: A equals P times one plus r over n, to the power of n t. Reinvested compounding turns that pocket change into over twelve lakh eighty thousand rupees.",
        "voice": "en-US-ChristopherNeural"
    }
]

out_dir = os.path.join(root_dir, "public", "audio")

for s in scenes:
    mp3_path = os.path.join(out_dir, s["file"].replace(".wav", ".mp3"))
    wav_path = os.path.join(out_dir, s["file"])
    
    cmd = [edge_cli, "--text", s["text"], "--voice", s["voice"], "--write-media", mp3_path]
    subprocess.run(cmd, check=True)
    
    # Convert to standard 24kHz wav for Remotion
    ffmpeg_cmd = ["ffmpeg", "-y", "-i", mp3_path, "-ar", "24000", wav_path]
    subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(mp3_path):
        os.remove(mp3_path)
    print(f"Generated clean audio: {wav_path}")

# Also generate full 30s track
full_text = " ".join([s["text"] for s in scenes])
full_mp3 = os.path.join(out_dir, "narration_paper_perfect_full.mp3")
full_wav = os.path.join(out_dir, "narration_paper_perfect_full.wav")
subprocess.run([edge_cli, "--text", full_text, "--voice", "en-US-ChristopherNeural", "--write-media", full_mp3], check=True)
subprocess.run(["ffmpeg", "-y", "-i", full_mp3, "-ar", "24000", full_wav], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if os.path.exists(full_mp3):
    os.remove(full_mp3)
print(f"Generated full audio: {full_wav}")
