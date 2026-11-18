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

    # Prefer ultra-fast CTranslate2 engine (faster-whisper) with int8 quantization
    use_faster = False
    try:
        from faster_whisper import WhisperModel
        use_faster = True
    except Exception as imp_err:
        use_faster = False

    segments_out = []
    detected_lang = args.language or "en"
    duration = 0.0
    full_text = ""

    if use_faster:
        print(f"Loading faster-whisper CTranslate2 model '{args.model}' (compute_type=int8)...")
        sys.stdout.flush()
        cpu_cores = min(8, os.cpu_count() or 4)
        model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=cpu_cores)

        print(f"Transcribing '{input_path.name}' with accelerated CTranslate2 engine...")
        sys.stdout.flush()

        lang_arg = args.language if (args.language and args.language.lower() != "auto") else None
        segments_gen, info = model.transcribe(
            str(input_path),
            language=lang_arg,
            word_timestamps=True,
            beam_size=1,
            condition_on_previous_text=False
        )

        detected_lang = info.language or "en"
        duration = round(info.duration, 3)

        text_parts = []
        for s_idx, seg in enumerate(segments_gen):
            words_out = []
            if hasattr(seg, "words") and seg.words:
                for w in seg.words:
                    words_out.append({
                        "word": w.word.strip(),
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(w.probability, 3)
                    })
            else:
                raw_words = seg.text.strip().split()
                w_dur = (seg.end - seg.start) / max(1, len(raw_words))
                for wIdx, rw in enumerate(raw_words):
                    words_out.append({
                        "word": rw,
                        "start": round(seg.start + wIdx * w_dur, 3),
                        "end": round(seg.start + (wIdx + 1) * w_dur, 3),
                        "probability": 0.95
                    })

            clean_seg_text = seg.text.strip()
            text_parts.append(clean_seg_text)
            segments_out.append({
                "id": s_idx + 1,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": clean_seg_text,
                "words": words_out
            })

            # Output formatted line for real-time progress parsing
            s_min = int(seg.start // 60)
            s_sec = seg.start % 60
            e_min = int(seg.end // 60)
            e_sec = seg.end % 60
            print(f"[{s_min:02d}:{s_sec:05.2f} --> {e_min:02d}:{e_sec:05.2f}] {clean_seg_text}")
            sys.stdout.flush()

        full_text = " ".join(text_parts).strip()
        print(f"Accelerated transcription complete! Detected language: {detected_lang}")

    else:
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
        duration = round(result.get("duration", 0.0), 3)
        full_text = result.get("text", "").strip()

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

    if not duration and segments_out:
        duration = segments_out[-1]["end"]

    structured_data = {
        "language": detected_lang,
        "duration": duration,
        "text": full_text,
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
