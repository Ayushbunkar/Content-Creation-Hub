#!/usr/bin/env python3
"""
generate_clip_captions.py
Generates high-retention 3-4 word viral captions positioned at the 3/4 mark (75% height)
for vertical 9:16 reels using local Whisper.
Outputs ASS subtitles with word highlight and JSON transcript.
"""

import sys
import os
import json
import argparse
import math
import re
import subprocess
from pathlib import Path

def format_ass_time(sec: float) -> str:
    sec = max(0.0, sec)
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    cs = int(round((sec - int(sec)) * 100))
    if cs >= 100:
        cs = 99
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def clean_word(w: str) -> str:
    # Allow alphanumeric, Hindi unicode (\u0900-\u097F), punctuation
    return re.sub(r'[^\w\s\u0900-\u097F\'!\?-]', '', w).strip()

def build_ass_content(cues, target_width=1080, target_height=1920, margin_v=450):
    header = f"""[Script Info]
Title: AI Stream Clipper 3/4 Spoken Voice Captions
ScriptType: v4.00+
PlayResX: {target_width}
PlayResY: {target_height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,56,&H00FFFFFF,&H0000E5FF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,6,3,2,60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for cue in cues:
        words = cue.get('words', [])
        if words and len(words) > 1:
            # Word-by-word progressive highlight within the 3-4 word spoken cue
            for w_idx, active_w in enumerate(words):
                w_start = max(cue['start'], active_w.get('start', cue['start']))
                w_end = min(cue['end'], active_w.get('end', cue['end']))
                if w_end <= w_start:
                    w_end = w_start + 0.35
                
                parts = []
                for idx, w in enumerate(words):
                    txt = w.get('word', '').upper()
                    if idx == w_idx:
                        # Highlighted active spoken word in bright yellow
                        parts.append(f"{{\\c&H0000E5FF&\\b1}}{txt}{{\\c&H00FFFFFF&\\b1}}")
                    else:
                        parts.append(txt)
                
                line_text = " ".join(parts)
                events.append(f"Dialogue: 0,{format_ass_time(w_start)},{format_ass_time(w_end)},Default,,0,0,0,,{line_text}\n")
        else:
            txt = cue.get('text', '').strip().upper()
            if txt:
                s_time = format_ass_time(cue['start'])
                e_time = format_ass_time(cue['end'])
                events.append(f"Dialogue: 0,{s_time},{e_time},Default,,0,0,0,,{{\\c&H0000E5FF&}}{txt}{{\\c&H00FFFFFF&}}\n")
            
    return header + "".join(events)

def extract_audio_wav(media_path: Path, temp_wav: Path) -> bool:
    try:
        cmd = [
            'ffmpeg', '-y',
            '-i', str(media_path),
            '-vn',
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,highpass=f=80,lowpass=f=7500',
            '-ar', '16000',
            '-ac', '1',
            '-f', 'wav',
            str(temp_wav)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        return res.returncode == 0 and temp_wav.exists() and temp_wav.stat().st_size > 500
    except Exception as e:
        print(f"[captionGen] audio extraction note: {e}", file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description="Generate 3-4 word viral captions of creator voice at 3/4 position")
    parser.add_argument("input_media", help="Input video or audio file")
    parser.add_argument("output_ass", help="Output .ass subtitle file")
    parser.add_argument("--output_json", default=None, help="Optional output JSON transcript file")
    parser.add_argument("--streamer", default="Creator", help="Streamer name")
    parser.add_argument("--hook", default="", help="Headline hook")
    parser.add_argument("--duration", type=float, default=30.0, help="Clip duration")
    parser.add_argument("--model", default="base", help="Whisper model (tiny, base)")
    args = parser.parse_args()

    input_path = Path(args.input_media).resolve()
    ass_path = Path(args.output_ass).resolve()
    ass_path.parent.mkdir(parents=True, exist_ok=True)

    cues = []
    has_speech = False
    temp_wav = ass_path.parent / f"temp_whisper_{ass_path.stem}.wav"

    try:
        # Pre-extract normalized 16kHz audio for maximum transcription accuracy
        has_wav = extract_audio_wav(input_path, temp_wav)
        audio_src = str(temp_wav) if has_wav else str(input_path)

        extracted_words = []
        try_faster = True
        try:
            import torch
            from faster_whisper import WhisperModel
            import sys
            import os
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from transcribe_words import devanagari_to_hinglish, has_devanagari

            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            print(f"[captionGen] Accelerated WhisperModel '{args.model}' loading on {device} ({compute_type})...", file=sys.stderr)
            fw_model = WhisperModel(args.model, device=device, compute_type=compute_type)

            segments, info = fw_model.transcribe(
                audio_src,
                word_timestamps=True,
                initial_prompt="Namaste doston! Bhai ye dekho, kya scene hai, let's go carry mortal dynamo gaming stream."
            )
            for seg in segments:
                if seg.words:
                    for w in seg.words:
                        w_clean = clean_word(w.word)
                        if has_devanagari(w_clean):
                            w_clean = devanagari_to_hinglish(w_clean)
                        if w_clean:
                            extracted_words.append({
                                'word': w_clean,
                                'start': round(float(w.start), 2),
                                'end': round(float(w.end), 2)
                            })
                else:
                    seg_text = seg.text.strip()
                    if has_devanagari(seg_text):
                        seg_text = devanagari_to_hinglish(seg_text)
                    tokens = [clean_word(t) for t in seg_text.split() if clean_word(t)]
                    if tokens:
                        s_start = float(seg.start)
                        s_end = float(seg.end or s_start + 2.0)
                        w_step = (s_end - s_start) / len(tokens)
                        for idx, tok in enumerate(tokens):
                            extracted_words.append({
                                'word': tok,
                                'start': round(s_start + idx * w_step, 2),
                                'end': round(s_start + (idx + 1) * w_step, 2)
                            })
        except Exception as fw_err:
            print(f"[captionGen] faster_whisper notice ({fw_err}), falling back to standard Whisper...", file=sys.stderr)
            import whisper
            print(f"[captionGen] Running Whisper '{args.model}' word_timestamps=True on audio track...", file=sys.stderr)
            model = whisper.load_model(args.model)
            
            # Transcribe with auto language detection (handles Hindi, Hinglish, English seamlessly)
            res = model.transcribe(
                audio_src,
                word_timestamps=True,
                no_speech_threshold=0.65,
                logprob_threshold=-1.0,
                condition_on_previous_text=False,
                fp16=False
            )
            
            for seg in res.get('segments', []):
                seg_words = seg.get('words', [])
                if seg_words:
                    for w in seg_words:
                        word_clean = clean_word(w.get('word', ''))
                        if word_clean:
                            extracted_words.append({
                                'word': word_clean,
                                'start': round(float(w.get('start', 0.0)), 2),
                                'end': round(float(w.get('end', 0.0)), 2)
                            })
                else:
                    seg_text = seg.get('text', '').strip()
                    tokens = [clean_word(t) for t in seg_text.split() if clean_word(t)]
                    if tokens:
                        s_start = float(seg.get('start', 0.0))
                        s_end = float(seg.get('end', s_start + 2.0))
                        w_step = (s_end - s_start) / len(tokens)
                        for idx, tok in enumerate(tokens):
                            extracted_words.append({
                                'word': tok,
                                'start': round(s_start + idx * w_step, 2),
                                'end': round(s_start + (idx + 1) * w_step, 2)
                            })
                    
        if len(extracted_words) > 0:
            has_speech = True
            print(f"[captionGen] Extracted {len(extracted_words)} creator speech words: {' '.join(w['word'] for w in extracted_words[:12])}...", file=sys.stderr)
            
            # Group into 3 to 4 words per cue for viral punchy pacing
            i = 0
            while i < len(extracted_words):
                remaining = len(extracted_words) - i
                if remaining <= 4:
                    chunk_size = remaining
                elif remaining % 3 == 0:
                    chunk_size = 3
                elif remaining % 4 == 0:
                    chunk_size = 4
                else:
                    chunk_size = 3

                chunk = extracted_words[i:i + chunk_size]
                if not chunk:
                    break
                
                c_start = chunk[0]['start']
                c_end = chunk[-1]['end']
                if c_end <= c_start:
                    c_end = c_start + 0.8
                    
                cues.append({
                    'start': c_start,
                    'end': c_end,
                    'text': " ".join(w['word'] for w in chunk),
                    'words': chunk
                })
                i += chunk_size
        else:
            print("[captionGen] Streamer audio was quiet or background only.", file=sys.stderr)
    except Exception as e:
        print(f"[captionGen] Whisper transcription note: {e}", file=sys.stderr)
    finally:
        if temp_wav.exists():
            try:
                temp_wav.unlink()
            except Exception:
                pass

    # If no speech was found at all in the audio track, do NOT inject fake chat slogans!
    # Instead, leave cues clean so we don't display unwanted spam like 'CHAT GOING CRAZY'
    if not cues:
        print("[captionGen] No speech detected in segment; leaving captions clean without chat fallback.", file=sys.stderr)

    # Generate ASS with MarginV=450 (3/4th screen position)
    ass_text = build_ass_content(cues, target_width=1080, target_height=1920, margin_v=450)
    with open(ass_path, 'w', encoding='utf-8') as f:
        f.write(ass_text)
    print(f"[captionGen] Wrote {len(cues)} creator speech cues to {ass_path}", file=sys.stderr)

    if args.output_json:
        json_path = Path(args.output_json).resolve()
        json_path.parent.mkdir(parents=True, exist_ok=True)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump({
                'has_speech': has_speech,
                'cues_count': len(cues),
                'cues': cues
            }, f, indent=2)

    print(json.dumps({'success': True, 'cues_count': len(cues), 'has_speech': has_speech}))

if __name__ == '__main__':
    main()

