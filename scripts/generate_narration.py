#!/usr/bin/env python3
"""
Generate narration audio from text file using Kokoro TTS.
Usage: python generate_narration.py <input_text_file> <output_wav_file> [voice] [speed] [lang_code]
"""

import sys
import argparse
import torch
import soundfile as sf
from pathlib import Path

# Add the virtual environment's site-packages to path if needed
# This script should be run from within the .venv-tts environment

def generate_narration(
    text_file: str,
    output_file: str,
    voice: str = "af_heart",
    speed: float = 1.0,
    lang_code: str = "a",
    repo_id: str = "hexgrad/Kokoro-82M"
):
    """Generate narration WAV file from text."""

    # Import inside function to catch import errors
    try:
        from kokoro import KPipeline
    except ImportError as e:
        print(f"Error: Kokoro not installed. Run: pip install kokoro==0.9.4 soundfile torch misaki[en]")
        print(f"Import error: {e}")
        sys.exit(1)

    # Read input text
    text_path = Path(text_file)
    if not text_path.exists():
        print(f"Error: Input file not found: {text_file}")
        sys.exit(1)

    text = text_path.read_text(encoding="utf-8").strip()
    if not text:
        print("Error: Input text is empty")
        sys.exit(1)

    print(f"Generating narration...")
    print(f"  Text: {text[:100]}{'...' if len(text) > 100 else ''}")
    print(f"  Voice: {voice}")
    print(f"  Speed: {speed}")
    print(f"  Language: {lang_code}")
    print(f"  Output: {output_file}")

    # Initialize pipeline
    try:
        pipeline = KPipeline(lang_code=lang_code, repo_id=repo_id)
    except Exception as e:
        print(f"Error initializing pipeline: {e}")
        sys.exit(1)

    # Generate audio
    try:
        audio_chunks = []
        for graphemes, phonemes, audio in pipeline(text, voice=voice, speed=speed):
            if audio is not None:
                audio_chunks.append(audio)
                print(f"  Generated chunk: {len(audio)} samples")

        if not audio_chunks:
            print("Error: No audio generated")
            sys.exit(1)

        # Concatenate all chunks
        full_audio = torch.cat(audio_chunks, dim=0)

        # Save as WAV (Kokoro uses 24kHz sample rate)
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(output_path), full_audio.numpy(), 24000)

        duration = len(full_audio) / 24000
        print(f"Success! Generated {duration:.2f}s of audio ({len(full_audio)} samples)")
        print(f"Saved to: {output_file}")

    except Exception as e:
        print(f"Error generating audio: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def list_voices(lang_code: str = "a", repo_id: str = "hexgrad/Kokoro-82M"):
    """List available voices for a language."""
    try:
        from kokoro import KPipeline
        pipeline = KPipeline(lang_code=lang_code, repo_id=repo_id)
        # Try to access internal voices dict
        voices = []
        for attr in dir(pipeline):
            if not attr.startswith("_"):
                try:
                    val = getattr(pipeline, attr)
                    if hasattr(val, "keys"):
                        voices = list(val.keys())
                        break
                except:
                    pass
        print(f"Available voices for lang '{lang_code}':")
        for v in voices:
            print(f"  {v}")
    except Exception as e:
        print(f"Error listing voices: {e}")


def test_voice(voice: str, lang_code: str = "a", repo_id: str = "hexgrad/Kokoro-82M"):
    """Test a voice with a short phrase."""
    try:
        from kokoro import KPipeline
        import soundfile as sf
        pipeline = KPipeline(lang_code=lang_code, repo_id=repo_id)

        test_text = "This is a test of the voice."
        for graphemes, phonemes, audio in pipeline(test_text, voice=voice, speed=1.0):
            if audio is not None:
                sf.write(f"test_{voice}.wav", audio.numpy(), 24000)
                print(f"Voice '{voice}' test saved to test_{voice}.wav")
                break
    except Exception as e:
        print(f"Error testing voice {voice}: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate narration audio using Kokoro TTS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate_narration.py script.txt narration.wav
  python generate_narration.py script.txt narration.wav --voice am_echo --speed 1.1
  python generate_narration.py script.txt narration.wav --lang h --voice hf_alpha
  python generate_narration.py --list-voices
  python generate_narration.py --test-voice af_heart
        """
    )

    parser.add_argument("input", nargs="?", help="Input text file")
    parser.add_argument("output", nargs="?", help="Output WAV file")
    parser.add_argument("--voice", "-v", default="af_heart", help="Voice to use (default: af_heart)")
    parser.add_argument("--speed", "-s", type=float, default=1.0, help="Speech speed (default: 1.0)")
    parser.add_argument("--lang", "-l", default="a", help="Language code (default: a for English)")
    parser.add_argument("--repo", default="hexgrad/Kokoro-82M", help="Model repo ID")
    parser.add_argument("--list-voices", action="store_true", help="List available voices for language")
    parser.add_argument("--test-voice", help="Test a specific voice")

    args = parser.parse_args()

    if args.list_voices:
        list_voices(args.lang, args.repo)
        return

    if args.test_voice:
        test_voice(args.test_voice, args.lang, args.repo)
        return

    if not args.input or not args.output:
        parser.print_help()
        sys.exit(1)

    generate_narration(args.input, args.output, args.voice, args.speed, args.lang, args.repo)


if __name__ == "__main__":
    main()