import subprocess
import os
import whisper

video_path = "output/paper_explainer_masterpiece_verified.mp4"
extracted_wav = "output/temp_verified_audio.wav"

if not os.path.exists(video_path):
    print(f"Error: {video_path} does not exist.")
    exit(1)

# Extract audio
cmd = ["ffmpeg", "-y", "-i", video_path, "-vn", "-c:a", "pcm_s16le", extracted_wav]
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

model = whisper.load_model("base")

intervals = [
    ("Scene 1 (0s - 10s)", 0, 10),
    ("Scene 2 (10s - 20s)", 10, 10),
    ("Scene 3 (20s - 30s)", 20, 10),
]

for name, start, duration in intervals:
    chunk_wav = f"output/temp_chunk_{start}_{start+duration}.wav"
    subprocess.run(["ffmpeg", "-y", "-ss", str(start), "-t", str(duration), "-i", extracted_wav, "-c", "copy", chunk_wav], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    result = model.transcribe(chunk_wav)
    text = result["text"].strip()
    print(f"[{name}] Transcribed Audio: \"{text}\"")
    if os.path.exists(chunk_wav):
        os.remove(chunk_wav)

if os.path.exists(extracted_wav):
    os.remove(extracted_wav)
print("AUDIO_VERIFICATION_COMPLETE_SUCCESS")
