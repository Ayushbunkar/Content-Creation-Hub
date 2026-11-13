#!/usr/bin/env python3
"""
Render Remotion video with proper audio/video sync.
Usage: python render_video.py [composition_id] [output_path] [options]
"""

import subprocess
import sys
import argparse
from pathlib import Path

def render_video(
    composition: str = "AudioTest",
    output: str = "output/video.mp4",
    entry_point: str = "src/index.ts",
    config: str = "remotion.config.ts",
    concurrency: int = None,
    crf: int = 20,
    preset: str = "medium",
    audio_bitrate: str = "192k",
    overwrite: bool = True,
    quiet: bool = False,
):
    """Render video using Remotion CLI."""

    # Build command
    cmd = [
        "npx", "remotion", "render",
        entry_point,
        composition,
        output,
        f"--config={config}",
        f"--crf={crf}",
        f"--preset={preset}",
        f"--audio-bitrate={audio_bitrate}",
    ]

    if concurrency:
        cmd.append(f"--concurrency={concurrency}")

    if overwrite:
        cmd.append("--overwrite")

    if quiet:
        cmd.append("--quiet")

    print(f"Rendering {composition} to {output}")
    print(f"Command: {' '.join(cmd)}")

    # Run render
    try:
        result = subprocess.run(cmd, check=True, capture_output=not quiet, text=True)
        if not quiet:
            print(result.stdout)
        print(f"✓ Render complete: {output}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Render failed with exit code {e.returncode}")
        if e.stdout:
            print("STDOUT:", e.stdout)
        if e.stderr:
            print("STDERR:", e.stderr)
        return False
    except FileNotFoundError:
        print("Error: npx not found. Make sure Node.js is installed and in PATH.")
        return False


def render_still(
    composition: str = "AudioTest",
    output: str = "output/frame.png",
    frame: int = 0,
    entry_point: str = "src/index.ts",
    config: str = "remotion.config.ts",
):
    """Render a single frame for preview."""

    cmd = [
        "npx", "remotion", "still",
        entry_point,
        composition,
        output,
        f"--frame={frame}",
        f"--config={config}",
    ]

    print(f"Rendering frame {frame} of {composition} to {output}")

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"✓ Still render complete: {output}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Still render failed: {e.stderr}")
        return False


def preview_composition(
    composition: str = "AudioTest",
    entry_point: str = "src/index.ts",
    config: str = "remotion.config.ts",
    port: int = 3000,
):
    """Start Remotion Studio for preview."""

    cmd = [
        "npx", "remotion", "studio",
        entry_point,
        f"--port={port}",
        f"--config={config}",
    ]

    print(f"Starting Remotion Studio on port {port}...")
    print(f"Open http://localhost:{port} to preview")

    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\nStudio stopped.")
    except subprocess.CalledProcessError as e:
        print(f"Studio failed: {e.stderr}")


def main():
    parser = argparse.ArgumentParser(
        description="Render Remotion documentary videos",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python render_video.py                          # Render default AudioTest
  python render_video.py AudioTest output.mp4     # Specify composition and output
  python render_video.py --crf 18 --preset slow   # Higher quality
  python render_video.py --still --frame 150      # Render single frame
  python render_video.py --preview                # Open Remotion Studio
        """
    )

    parser.add_argument("composition", nargs="?", default="AudioTest", help="Composition ID to render")
    parser.add_argument("output", nargs="?", default="output/video.mp4", help="Output file path")
    parser.add_argument("--entry", default="src/index.ts", help="Entry point file")
    parser.add_argument("--config", default="remotion.config.ts", help="Remotion config file")
    parser.add_argument("--concurrency", type=int, help="Number of concurrent frames (default: auto)")
    parser.add_argument("--crf", type=int, default=20, help="CRF quality (lower = better, default: 20)")
    parser.add_argument("--preset", default="medium", choices=["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"], help="Encoder preset")
    parser.add_argument("--audio-bitrate", default="192k", help="Audio bitrate")
    parser.add_argument("--no-overwrite", action="store_true", help="Don't overwrite existing files")
    parser.add_argument("--quiet", action="store_true", help="Suppress output")
    parser.add_argument("--still", action="store_true", help="Render single frame instead of video")
    parser.add_argument("--frame", type=int, default=0, help="Frame number for still render")
    parser.add_argument("--preview", action="store_true", help="Open Remotion Studio preview")

    args = parser.parse_args()

    # Ensure output directory exists
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)

    if args.preview:
        preview_composition(args.composition, args.entry, args.config)
        return

    if args.still:
        still_output = args.output.replace(".mp4", f"_frame{args.frame}.png")
        success = render_still(args.composition, still_output, args.frame, args.entry, args.config)
    else:
        success = render_video(
            args.composition,
            args.output,
            args.entry,
            args.config,
            args.concurrency,
            args.crf,
            args.preset,
            args.audio_bitrate,
            not args.no_overwrite,
            args.quiet,
        )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()