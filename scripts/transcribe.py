#!/usr/bin/env python3
"""
Transcribe audio to SRT subtitles using Whisper.
Usage: python transcribe.py <input_audio_file> <output_srt_file> [model] [language]
"""

import sys
import argparse
from pathlib import Path

def format_time(seconds: float) -> str:
    """Convert seconds to SRT time format (HH:MM:SS,mmm)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def generate_srt(segments, output_file: str):
    """Write segments to SRT file."""
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        for i, segment in enumerate(segments, 1):
            start = format_time(segment["start"])
            end = format_time(segment["end"])
            text = segment["text"].strip()

            f.write(f"{i}\n")
            f.write(f"{start} --> {end}\n")
            f.write(f"{text}\n\n")

    print(f"SRT saved to: {output_file}")


def transcribe_audio(
    audio_file: str,
    output_file: str,
    model_name: str = "base",
    language: str = None,
    task: str = "transcribe"
):
    """Transcribe audio file using Whisper."""

    try:
        import whisper
    except ImportError:
        print("Error: Whisper not installed. Run: pip install openai-whisper")
        sys.exit(1)

    audio_path = Path(audio_file)
    if not audio_path.exists():
        print(f"Error: Audio file not found: {audio_file}")
        sys.exit(1)

    print(f"Loading Whisper model: {model_name}")
    try:
        model = whisper.load_model(model_name)
    except Exception as e:
        print(f"Error loading model: {e}")
        sys.exit(1)

    print(f"Transcribing: {audio_file}")
    print(f"  Model: {model_name}")
    print(f"  Language: {language or 'auto-detect'}")
    print(f"  Task: {task}")

    try:
        result = model.transcribe(
            str(audio_path),
            language=language,
            task=task,
            verbose=False
        )

        segments = result.get("segments", [])
        if not segments:
            print("Warning: No segments found in transcription")
            # Fallback: create single segment from full text
            segments = [{
                "start": 0,
                "end": result.get("duration", 10),
                "text": result.get("text", "")
            }]

        print(f"Generated {len(segments)} subtitle segments")
        generate_srt(segments, output_file)

        # Also save raw text
        text_file = Path(output_file).with_suffix(".txt")
        text_file.write_text(result.get("text", ""), encoding="utf-8")
        print(f"Raw text saved to: {text_file}")

    except Exception as e:
        print(f"Error during transcription: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe audio to SRT subtitles using Whisper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python transcribe.py narration.wav subtitles.srt
  python transcribe.py narration.wav subtitles.srt --model small --language en
  python transcribe.py narration.wav subtitles.srt --model large-v3 --task translate
        """
    )

    parser.add_argument("input", help="Input audio file (WAV, MP3, etc.)")
    parser.add_argument("output", help="Output SRT file")
    parser.add_argument("--model", "-m", default="base",
                        choices=["tiny", "tiny.en", "base", "base.en", "small", "small.en",
                                 "medium", "medium.en", "large", "large-v1", "large-v2",
                                 "large-v3", "large-v3-turbo", "turbo"],
                        help="Whisper model (default: base)")
    parser.add_argument("--language", "-l", help="Language code (e.g., en, hi, es). Auto-detect if not specified.")
    parser.add_argument("--task", choices=["transcribe", "translate"], default="transcribe",
                        help="Task: transcribe (same language) or translate (to English)")

    args = parser.parse_args()

    transcribe_audio(args.input, args.output, args.model, args.language, args.task)


if __name__ == "__main__":
    main()