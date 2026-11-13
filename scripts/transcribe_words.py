#!/usr/bin/env python3
"""
transcribe_words.py - Local Word-Level & Sentence-Level Audio/Video Transcription
Uses OpenAI Whisper with word_timestamps=True.
Outputs structured JSON, SRT, and VTT.
"""

import sys
import os
import json
import argparse
from pathlib import Path

def format_time_srt(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def format_time_vtt(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

def format_time_ass(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int(round((seconds - int(seconds)) * 100))
    if centis >= 100:
        centis = 99
    return f"{hours:d}:{minutes:02d}:{secs:02d}.{centis:02d}"

def main():
    parser = argparse.ArgumentParser(description="Word-level Whisper Transcription")
    parser.add_argument("input_media", help="Path to input audio or video file")
    parser.add_argument("output_json", help="Path to output JSON file")
    parser.add_argument("--model", default="base", help="Whisper model (tiny, base, small, medium)")
    parser.add_argument("--language", default=None, help="Spoken language code (e.g. en, hi) or None for auto")
    parser.add_argument("--device", default="cpu", help="Compute device (cpu, cuda)")
    args = parser.parse_args()

    input_path = Path(args.input_media).resolve()
    output_path = Path(args.output_json).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"Error: Input file does not exist: {input_path}", file=sys.stderr)
        sys.exit(1)

    import whisper

    print(f"Loading Whisper model '{args.model}' on {args.device}...")
    model = whisper.load_model(args.model, device=args.device)

    print(f"Transcribing '{input_path.name}' (language={args.language or 'auto'}, word_timestamps=True)...")
    sys.stdout.flush()
    transcribe_options = {
        "word_timestamps": True,
        "verbose": True
    }
    if args.language and args.language.lower() != "auto":
        transcribe_options["language"] = args.language

    result = model.transcribe(str(input_path), **transcribe_options)

    detected_lang = result.get("language", "en")
    print(f"Transcription complete! Detected language: {detected_lang}")

    segments_out = []
    for s_idx, seg in enumerate(result.get("segments", [])):
        words_out = []
        for w in seg.get("words", []):
            words_out.append({
                "word": w.get("word", "").strip(),
                "start": round(w.get("start", 0.0), 3),
                "end": round(w.get("end", 0.0), 3),
                "probability": round(w.get("probability", 1.0), 3)
            })

        segments_out.append({
            "id": s_idx + 1,
            "start": round(seg.get("start", 0.0), 3),
            "end": round(seg.get("end", 0.0), 3),
            "text": seg.get("text", "").strip(),
            "words": words_out
        })

    structured_data = {
        "language": detected_lang,
        "duration": round(result.get("duration", segments_out[-1]["end"] if segments_out else 0.0), 3),
        "text": result.get("text", "").strip(),
        "segments": segments_out
    }

    # Write JSON
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(structured_data, f, indent=2, ensure_ascii=False)
    print(f"[OK] JSON transcript saved to {output_path}")

    # Write SRT
    srt_path = output_path.with_suffix(".srt")
    with open(srt_path, "w", encoding="utf-8") as f:
        for seg in segments_out:
            f.write(f"{seg['id']}\n")
            f.write(f"{format_time_srt(seg['start'])} --> {format_time_srt(seg['end'])}\n")
            f.write(f"{seg['text']}\n\n")
    print(f"[OK] SRT subtitles saved to {srt_path}")

    # Write VTT
    vtt_path = output_path.with_suffix(".vtt")
    with open(vtt_path, "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        for seg in segments_out:
            f.write(f"{seg['id']}\n")
            f.write(f"{format_time_vtt(seg['start'])} --> {format_time_vtt(seg['end'])}\n")
            f.write(f"{seg['text']}\n\n")
    print(f"[OK] VTT subtitles saved to {vtt_path}")

    # Write ASS
    ass_path = output_path.with_suffix(".ass")
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write("[Script Info]\nTitle: Local AI Video Studio Captions\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n")
        f.write("[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n")
        f.write("Style: Default,Inter,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,40,40,60,1\n\n")
        f.write("[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
        for seg in segments_out:
            start_str = format_time_ass(seg['start'])
            end_str = format_time_ass(seg['end'])
            # Escaping special characters for ASS
            clean_text = seg['text'].replace("{", "").replace("}", "")
            f.write(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{clean_text}\n")
    print(f"[OK] ASS subtitles saved to {ass_path}")

    # Write TXT
    txt_path = output_path.with_suffix(".txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(structured_data["text"] + "\n")
    print(f"[OK] TXT transcript saved to {txt_path}")

if __name__ == "__main__":
    main()
