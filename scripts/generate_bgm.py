#!/usr/bin/env python3
"""
generate_bgm.py - Synthesizes 4 loopable mood tracks for documentary scoring
"""
import math
import struct
import wave
from pathlib import Path

def generate_track(filename, frequencies, harmonics, duration=30.0, sample_rate=48000, volume=0.15):
    out_dir = Path("public/audio/bgm")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / filename

    total_samples = int(duration * sample_rate)
    with wave.open(str(out_path), "w") as wav:
        wav.setnchannels(2)  # Stereo
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)

        for i in range(total_samples):
            t = i / sample_rate

            # Smooth 2s fade in and 2s fade out
            fade = 1.0
            if t < 2.0:
                fade = t / 2.0
            elif t > duration - 2.0:
                fade = (duration - t) / 2.0

            # Sum oscillators
            sample_left = 0.0
            sample_right = 0.0

            for f_idx, f in enumerate(frequencies):
                weight = harmonics[f_idx] if f_idx < len(harmonics) else 1.0
                # Slight stereo panning
                pan_l = 0.5 + 0.3 * math.sin(t * 0.2 + f_idx)
                pan_r = 1.0 - pan_l

                val = math.sin(2 * math.pi * f * t)
                sample_left += val * weight * pan_l
                sample_right += val * weight * pan_r

            sample_left = max(-1.0, min(1.0, sample_left * volume * fade))
            sample_right = max(-1.0, min(1.0, sample_right * volume * fade))

            int_l = int(sample_left * 32767)
            int_r = int(sample_right * 32767)
            wav.writeframes(struct.pack("<hh", int_l, int_r))

    print(f"Generated {out_path} ({duration}s)")

if __name__ == "__main__":
    # 1. Ambient Documentary (C Major warm root chords: C3, E3, G3, B3)
    generate_track("ambient_documentary.wav", [130.81, 164.81, 196.00, 246.94], [0.5, 0.3, 0.2, 0.15], volume=0.18)

    # 2. Epic Geopolitics (D minor deep military resonance: D2, A2, D3, F3)
    generate_track("epic_geopolitics.wav", [73.42, 110.00, 146.83, 174.61], [0.6, 0.4, 0.25, 0.15], volume=0.20)

    # 3. Mystery & Investigation (Suspenseful diminished chords: C#2, G2, A#2, E3)
    generate_track("mystery_investigation.wav", [69.30, 98.00, 116.54, 164.81], [0.55, 0.35, 0.25, 0.15], volume=0.18)

    # 4. Tech & Cyber (Futuristic electronic fifths: E2, B2, F#3, C#4)
    generate_track("tech_cyber.wav", [82.41, 123.47, 185.00, 277.18], [0.5, 0.35, 0.3, 0.2], volume=0.18)
