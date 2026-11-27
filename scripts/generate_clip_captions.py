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

# Import transliteration helpers
try:
    sys.path.insert(0, str(Path(__file__).parent))
    from transcribe_words import devanagari_to_hinglish, urdu_to_hinglish, to_roman_hinglish, has_devanagari, has_urdu
except Exception:
    def to_roman_hinglish(t: str) -> str: return t
    def devanagari_to_hinglish(t: str) -> str: return t
    def urdu_to_hinglish(t: str) -> str: return t
    def has_devanagari(t: str) -> bool: return False
    def has_urdu(t: str) -> bool: return False

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
    if not w:
        return ""
    # 1. Convert any Devanagari or Urdu script into clean Roman Hinglish
    w = to_roman_hinglish(w)
    # 2. Filter out non-Latin characters (strips Cyrillic, Chinese, Thai, Arabic symbols)
    w = re.sub(r'[^a-zA-Z0-9\s\'\?!,.-]', '', w).strip()
    # 3. Collapse repetitive character stutter/hallucinations (e.g. 'iviviv', 'sooooo' -> 'soo')
    w = re.sub(r'(.)\1{2,}', r'\1\1', w)
    return w

def strip_unsupported_emojis(text: str) -> str:
    """Remove color emojis that Windows FFmpeg/libass renders as blank □ boxes, keeping crisp text & punctuation."""
    if not text:
        return ""
    cleaned = re.sub(r'[\U00010000-\U0010ffff\u2600-\u27BF\uFE0F]', '', text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def format_hook_for_center(text: str, highlight_hex: str = "&H0000D7FF&", base_hex: str = "&H00FFFFFF&") -> str:
    if not text:
        return ""
    text = strip_unsupported_emojis(text).upper()
    # Remove (#rank) suffix if present
    text = re.sub(r'\s*\(\s*#\d+\s*\)\s*$', '', text).strip()
    if not text:
        return ""
    words = text.split()
    if len(words) <= 2:
        return f"{{\\c{highlight_hex}\\b1}}{text}"
    # Highlight the last 2 punchy words in gold/amber for high-CTR visual contrast
    split_idx = max(1, len(words) - 2)
    if len(words) <= 3 or len(text) <= 20:
        lead = " ".join(words[:split_idx])
        punch = " ".join(words[split_idx:])
        return f"{{\\c{base_hex}\\b1}}{lead} {{\\c{highlight_hex}\\b1}}{punch}"
    # Balanced 2-line wrap so it never overflows 1080px width
    half = (len(words) + 1) // 2
    line1_words = words[:half]
    line2_words = words[half:]
    line1 = f"{{\\c{base_hex}\\b1}}{' '.join(line1_words)}"
    line2 = f"{{\\c{highlight_hex}\\b1}}{' '.join(line2_words)}"
    return f"{line1}\\N{line2}"

def build_ass_content(
    cues,
    target_width=1080,
    target_height=1920,
    margin_v=450,
    center_hook="",
    caption_style="speed_center",
    split_divider_y=768,
    clip_duration=30.0
):
    primary_color = "&H00FFFFFF"
    highlight_color = "&H0000D7FF&"
    box_bg = "&HBB090912"
    box_border_style = 3
    box_outline = 18

    if caption_style == "yellow_black":
        primary_color = "&H0000FFFF"
        highlight_color = "&H00FFFFFF&"
    elif caption_style == "white_black":
        box_border_style = 1
        box_outline = 8

    header = f"""[Script Info]
Title: AI Stream Clipper Viral Captions
ScriptType: v4.00+
PlayResX: {target_width}
PlayResY: {target_height}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,54,&H00FFFFFF,&H0000E5FF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,6,3,2,60,60,{margin_v},1
Style: CenterHook,Arial Black,52,{primary_color},&H0000D7FF,{box_bg},&HD0000000,-1,0,0,0,100,100,1,0,{box_border_style},{box_outline},4,5,55,55,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []

    # 1. Add Styled On-Screen Hook Banner (pop-in animation + dual-tone highlight)
    if center_hook and caption_style != "bottom_standard":
        formatted_hook = format_hook_for_center(center_hook, highlight_hex=highlight_color, base_hex=primary_color)
        if formatted_hook:
            dur_str = format_ass_time(clip_duration)
            events.append(
                f"Dialogue: 2,0:00:00.00,{dur_str},CenterHook,,0,0,0,,{{\\pos(540,{split_divider_y})\\an5\\fscx88\\fscy88\\t(0,180,\\fscx100\\fscy100)}}{formatted_hook}\n"
            )

    # 2. Add Spoken Voice Word-by-Word Captions with gap-free highlight transitions
    if caption_style != "center_only":
        for cue in cues:
            words = cue.get('words', [])
            if words and len(words) > 1:
                cue_start = float(cue.get('start', 0.0))
                cue_end = float(cue.get('end', cue_start + 1.5))
                for w_idx, active_w in enumerate(words):
                    w_start = float(active_w.get('start', cue_start))
                    if w_idx == 0:
                        w_start = min(w_start, cue_start)
                    
                    # Bridge word highlight smoothly to the next word start to eliminate subtitle flickering/gaps
                    if w_idx + 1 < len(words):
                        next_start = float(words[w_idx + 1].get('start', w_start + 0.35))
                        w_end = max(w_start + 0.12, next_start)
                    else:
                        w_end = max(w_start + 0.25, float(active_w.get('end', cue_end)), cue_end)
                    
                    parts = []
                    for idx, w in enumerate(words):
                        txt = w.get('word', '').upper()
                        if idx == w_idx:
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
            '-af', 'aresample=async=1:first_pts=0,highpass=f=80,lowpass=f=7500',
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
    parser.add_argument("--center_hook", default="", help="Headline hook for center screen banner")
    parser.add_argument("--caption_style", default="speed_center", help="Caption style (speed_center, yellow_black, white_black, bottom_standard, center_only)")
    parser.add_argument("--divider_y", type=int, default=768, help="Y position of center hook banner")
    parser.add_argument("--duration", type=float, default=30.0, help="Clip duration")
    parser.add_argument("--model", default="base", help="Whisper model (tiny, base)")
    args = parser.parse_args()

    input_path = Path(args.input_media).resolve()
    ass_path = Path(args.output_ass).resolve()
    ass_path.parent.mkdir(parents=True, exist_ok=True)

    cues = []
    has_speech = False
    temp_wav = ass_path.parent / f"temp_whisper_{ass_path.stem}.wav"

    # Pre-write styled Center Hook ASS immediately so even if Whisper times out, the on-screen title is guaranteed!
    initial_hook = re.sub(r'\s*\(\s*#\d+\s*\)\s*$', '', (args.center_hook or args.hook or 'UNREAL MOMENT').strip()).strip()
    try:
        pre_ass = build_ass_content(
            [],
            target_width=1080,
            target_height=1920,
            margin_v=420,
            center_hook=initial_hook,
            caption_style=args.caption_style,
            split_divider_y=args.divider_y,
            clip_duration=args.duration
        )
        with open(ass_path, 'w', encoding='utf-8') as f:
            f.write(pre_ass)
    except Exception:
        pass

    try:
        # Pre-extract normalized 16kHz audio for maximum transcription accuracy
        has_wav = extract_audio_wav(input_path, temp_wav)
        audio_src = str(temp_wav) if has_wav else str(input_path)

        extracted_words = []
        try_faster = True
        hinglish_prompt = (
            "Gaming livestream commentary in Hinglish and English. "
            "Bhai kya kar raha hai, gaadi nikaalo, bande a gaye, clutch ho gaya, OP bhai OP, "
            "let's go guys, nice shot, dead, finish, watch out bro, carry mortal dynamo."
        )

        try:
            import torch
            from faster_whisper import WhisperModel
            import sys
            import os
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from transcribe_words import devanagari_to_hinglish, urdu_to_hinglish, to_roman_hinglish, has_devanagari, has_urdu

            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            print(f"[captionGen] Accelerated WhisperModel '{args.model}' loading on {device} ({compute_type})...", file=sys.stderr)
            fw_model = WhisperModel(args.model, device=device, compute_type=compute_type)

            # Fast language detection: read only first segment (much faster than full pass)
            # Uses language_detection_segments=1 which probes just the first ~30s
            detected_lang = 'en'
            try:
                _, info_probe = fw_model.transcribe(
                    audio_src,
                    beam_size=1,
                    language_detection_segments=1,
                    vad_filter=True,
                    language_detection_threshold=0.5
                )
                detected_lang = info_probe.language if info_probe and info_probe.language else 'en'
            except Exception:
                detected_lang = 'en'

            print(f"[captionGen] Whisper language detect (fast): {detected_lang}", file=sys.stderr)

            # Strictly allow English ('en') or Hindi ('hi') or Urdu ('ur').
            # Any other language (Arabic, Persian, Russian, Welsh) is noise misdetection -> force 'en'
            target_lang = detected_lang if detected_lang in ['en', 'hi', 'ur'] else 'en'

            # Single-pass transcription with word timestamps (no double pass!)
            segments, info = fw_model.transcribe(
                audio_src,
                language=target_lang,
                word_timestamps=True,
                beam_size=1,
                condition_on_previous_text=False,
                repetition_penalty=1.2,
                no_repeat_ngram_size=3,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=400, speech_pad_ms=200),
                initial_prompt=hinglish_prompt
            )

            prev_word = None
            repeat_count = 0
            for seg in segments:
                if seg.words:
                    for w in seg.words:
                        w_clean = clean_word(w.word)
                        if not w_clean or len(w_clean) < 1:
                            continue
                        # Suppress repetitive word loops (e.g. 'main main main', '4100 4100 4100')
                        if w_clean.lower() == (prev_word or '').lower():
                            repeat_count += 1
                            if repeat_count > 1:
                                continue
                        else:
                            repeat_count = 0
                        prev_word = w_clean
                        extracted_words.append({
                            'word': w_clean,
                            'start': round(float(w.start), 2),
                            'end': round(float(w.end), 2)
                        })
                else:
                    seg_text = seg.text.strip()
                    tokens = [clean_word(t) for t in seg_text.split() if clean_word(t)]
                    if tokens:
                        s_start = float(seg.start)
                        s_end = float(seg.end or s_start + 2.0)
                        w_step = (s_end - s_start) / len(tokens)
                        for idx, tok in enumerate(tokens):
                            if tok.lower() == (prev_word or '').lower():
                                repeat_count += 1
                                if repeat_count > 1:
                                    continue
                            else:
                                repeat_count = 0
                            prev_word = tok
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

            res = model.transcribe(
                audio_src,
                word_timestamps=True,
                no_speech_threshold=0.6,
                condition_on_previous_text=False,
                initial_prompt=hinglish_prompt,
                fp16=False
            )

            prev_word = None
            repeat_count = 0
            for seg in res.get('segments', []):
                seg_words = seg.get('words', [])
                if seg_words:
                    for w in seg_words:
                        word_clean = clean_word(w.get('word', ''))
                        if not word_clean:
                            continue
                        if word_clean.lower() == (prev_word or '').lower():
                            repeat_count += 1
                            if repeat_count > 1:
                                continue
                        else:
                            repeat_count = 0
                        prev_word = word_clean
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
                            if tok.lower() == (prev_word or '').lower():
                                repeat_count += 1
                                if repeat_count > 1:
                                    continue
                            else:
                                repeat_count = 0
                            prev_word = tok
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

    # Generate ASS with Center Hook Banner and Spoken Voice Word-Highlight
    active_hook = (args.center_hook or args.hook or '').strip()
    active_hook = re.sub(r'\s*\(\s*#\d+\s*\)\s*$', '', active_hook).strip()

    is_generic_hook = (
        not active_hook
        or "MASSIVE W" in active_hook.upper()
        or "UNREAL MOMENT" in active_hook.upper()
        or "CHAT EXPLODED" in active_hook.upper()
    )

    # Only fill in a speech-derived hook if no custom/pipeline hook was provided
    if is_generic_hook:
        spoken_text = " ".join(c.get('text', '') for c in cues).lower()
        if spoken_text:
            if any(k in spoken_text for k in ['die', 'dying', 'dead', 'kill', 'killed', 'rip', 'survive']):
                active_hook = "1 HP PE POORA SQUAD WIPE"
            elif any(k in spoken_text for k in ['calm', 'fine', 'chill', 'relax']):
                active_hook = "BRO FORGOT IT'S JUST A GAME"
            elif any(k in spoken_text for k in ['car', 'drive', 'cops', 'police', 'crash', 'driving']):
                active_hook = "POLICE CHASE GONE WRONG"
            elif any(k in spoken_text for k in ['money', 'dono', 'paid', 'dollar', 'superchat', 'rich']):
                active_hook = "CRAZY SUPERCHAT REACTION"
            elif any(k in spoken_text for k in ['no way', 'nah', 'bro what', 'wait wait']):
                active_hook = "WAIT FOR THE LAST 3 SECONDS"
            elif any(k in spoken_text for k in ['stop', 'shut up', 'mad', 'scream', 'help']):
                active_hook = "KEYBOARD TODNE WALA THA BHAI"
            elif any(k in spoken_text for k in ['win', 'won', 'lose', 'lost', 'choke']):
                active_hook = "1 SECOND ME GAME PALAT GAYA"
            else:
                active_hook = "WAIT TILL YOU SEE THIS REACTION"
        else:
            active_hook = "YE KYA HO GAYA LIVE STREAM PE?!"

    ass_text = build_ass_content(
        cues,
        target_width=1080,
        target_height=1920,
        margin_v=420,
        center_hook=active_hook,
        caption_style=args.caption_style,
        split_divider_y=args.divider_y,
        clip_duration=args.duration
    )
    with open(ass_path, 'w', encoding='utf-8') as f:
        f.write(ass_text)
    print(f"[captionGen] Wrote {len(cues)} creator speech cues (hook: '{active_hook}') to {ass_path}", file=sys.stderr)

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

