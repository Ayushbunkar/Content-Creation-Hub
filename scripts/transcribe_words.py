#!/usr/bin/env python3
"""
transcribe_words.py - Local Word-Level & Sentence-Level Audio/Video Transcription
Supports:
- CTranslate2 faster-whisper with word-level timestamps
- Standard Whisper fallback
- Multilingual translation (task="translate") for Hindi/Hinglish -> English
- High-fidelity Romanized Hinglish transliteration (Devanagari -> Latin English script)
Outputs structured JSON, SRT, VTT, and ASS.
"""

import sys
import os
import json
import argparse
import unicodedata
import re
from pathlib import Path

# --- DEVANAGARI TO HINGLISH (ROMAN SCRIPT) TRANSLITERATOR ---

DV_VOWELS = {
    0x0905: 'a', 0x0906: 'aa', 0x0907: 'i', 0x0908: 'ee', 0x0909: 'u', 0x090A: 'oo',
    0x090B: 'ri', 0x090F: 'e', 0x0910: 'ai', 0x0913: 'o', 0x0914: 'au',
}
DV_MATRAS = {
    0x093E: 'a', 0x093F: 'i', 0x0940: 'i', 0x0941: 'u', 0x0942: 'u',
    0x0943: 'ri', 0x0947: 'e', 0x0948: 'ai', 0x094B: 'o', 0x094C: 'au',
    0x0902: 'n', 0x0901: 'n', 0x0903: 'h',
}
DV_CONSONANTS = {
    0x0915: 'k', 0x0916: 'kh', 0x0917: 'g', 0x0918: 'gh', 0x0919: 'ng',
    0x091A: 'ch', 0x091B: 'chh', 0x091C: 'j', 0x091D: 'jh', 0x091E: 'ny',
    0x091F: 't', 0x0920: 'th', 0x0921: 'd', 0x0922: 'dh', 0x0923: 'n',
    0x0924: 't', 0x0925: 'th', 0x0926: 'd', 0x0927: 'dh', 0x0928: 'n',
    0x092A: 'p', 0x092B: 'ph', 0x092C: 'b', 0x092D: 'bh', 0x092E: 'm',
    0x092F: 'y', 0x0930: 'r', 0x0932: 'l', 0x0933: 'l', 0x0935: 'v',
    0x0936: 'sh', 0x0937: 'sh', 0x0938: 's', 0x0939: 'h',
    0x0958: 'q', 0x0959: 'kh', 0x095A: 'g', 0x095B: 'z', 0x095C: 'd', 0x095D: 'dh', 0x095E: 'f',
}
HALANT = 0x094D
NUKTA = 0x093C

COMMON_HINGLISH_WORDS = {
    'है': 'hai', 'हैं': 'hain', 'हो': 'ho', 'हूँ': 'hoon', 'था': 'tha', 'थी': 'thi', 'थे': 'the',
    'क्या': 'kya', 'कहा': 'kaha', 'कहाँ': 'kahan', 'क्यों': 'kyun', 'कैसे': 'kaise', 'कौन': 'kaun',
    'यह': 'yeh', 'वह': 'woh', 'ये': 'ye', 'वो': 'woh', 'इस': 'is', 'उस': 'us', 'इन': 'in', 'उन': 'un',
    'मैं': 'main', 'हम': 'hum', 'तुम': 'tum', 'आप': 'aap', 'मेरा': 'mera', 'मेरी': 'meri', 'मेरे': 'mere',
    'भाई': 'bhai', 'भैया': 'bhaiya', 'गाड़ी': 'gaadi', 'कार': 'car', 'देख': 'dekh', 'देखो': 'dekho',
    'सकते': 'sakte', 'सकता': 'sakta', 'सकती': 'sakti', 'लेने': 'lene', 'जा': 'ja', 'रहा': 'raha',
    'रही': 'rahi', 'रहे': 'rahe', 'बहुत': 'bahut', 'अच्छा': 'achha', 'अच्छी': 'achhi', 'नमस्ते': 'namaste',
    'दोस्तो': 'dosto', 'दोस्तों': 'doston', 'आज': 'aaj', 'कल': 'kal', 'वीडियो': 'video', 'लाइक': 'like',
    'करो': 'karo', 'करना': 'karna', 'कर': 'kar', 'गया': 'gaya', 'गयी': 'gayi', 'गए': 'gaye',
    'तो': 'toh', 'भी': 'bhi', 'नहीं': 'nahi', 'ना': 'na', 'हाँ': 'haan', 'बात': 'baat', 'लोग': 'log',
    'कुछ': 'kuch', 'सब': 'sab', 'सबको': 'sabko', 'अपने': 'apne', 'अपना': 'apna', 'अपनी': 'apni',
    'खेल': 'khel', 'खेला': 'khela', 'मजा': 'maza', 'आया': 'aaya', 'आएगा': 'aayega', 'रुको': 'ruko',
    'एक': 'ek', 'दो': 'do', 'तीन': 'teen', 'चार': 'char', 'पाँच': 'paanch', 'दस': 'das'
}

def has_devanagari(text: str) -> bool:
    if not text:
        return False
    return any('\u0900' <= ch <= '\u097f' for ch in text)

def devanagari_to_hinglish(text: str) -> str:
    """Converts Devanagari Hindi text to clean conversational Roman Hinglish."""
    if not text or not has_devanagari(text):
        return text

    text = unicodedata.normalize('NFC', text)
    words = text.split()
    out = []

    for w in words:
        p_m = re.match(r'^[^a-zA-Z0-9\u0900-\u097F]+', w)
        p = p_m.group(0) if p_m else ''
        s_m = re.search(r'[^a-zA-Z0-9\u0900-\u097F]+$', w)
        s = s_m.group(0) if s_m else ''
        core = w[len(p):len(w)-len(s)] if (p or s) else w

        if core in COMMON_HINGLISH_WORDS:
            out.append(p + COMMON_HINGLISH_WORDS[core] + s)
            continue

        res = []
        i = 0
        n = len(core)
        while i < n:
            code = ord(core[i])
            if code in DV_CONSONANTS:
                con = DV_CONSONANTS[code]
                if i + 1 < n and ord(core[i+1]) == NUKTA:
                    if code == 0x0921: con = 'd'
                    elif code == 0x0922: con = 'dh'
                    elif code == 0x091C: con = 'z'
                    elif code == 0x092B: con = 'f'
                    i += 1
                if i + 1 < n:
                    nxt = ord(core[i+1])
                    if nxt == HALANT:
                        res.append(con)
                        i += 2
                        continue
                    elif nxt in DV_MATRAS:
                        res.append(con + DV_MATRAS[nxt])
                        i += 2
                        continue
                    elif nxt in DV_CONSONANTS or nxt in DV_VOWELS:
                        res.append(con + 'a')
                        i += 1
                        continue
                    else:
                        res.append(con)
                        i += 1
                        continue
                else:
                    res.append(con)
                    i += 1
            elif code in DV_VOWELS:
                res.append(DV_VOWELS[code])
                i += 1
            elif code in DV_MATRAS:
                res.append(DV_MATRAS[code])
                i += 1
            elif code == HALANT or code == NUKTA:
                i += 1
            else:
                res.append(core[i])
                i += 1
        out.append(p + ''.join(res) + s)

    return ' '.join(out)


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
    parser = argparse.ArgumentParser(description="Word-level Whisper Transcription & Translation")
    parser.add_argument("input_media", help="Path to input audio or video file")
    parser.add_argument("output_json", help="Path to output JSON file")
    parser.add_argument("--model", default="base", help="Whisper model (tiny, base, small, medium)")
    parser.add_argument("--language", default=None, help="Spoken language code (e.g. en, hi, hinglish, en_translate) or auto")
    parser.add_argument("--task", default="transcribe", choices=["transcribe", "translate"], help="Whisper task: transcribe or translate to English")
    parser.add_argument("--hinglish", action="store_true", help="Transliterate Hindi output to clean Roman Hinglish")
    parser.add_argument("--device", default="cpu", help="Compute device (cpu, cuda)")
    args = parser.parse_args()

    input_path = Path(args.input_media).resolve()
    output_path = Path(args.output_json).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"Error: Input file does not exist: {input_path}", file=sys.stderr)
        sys.exit(1)

    # Determine effective language, task, and Hinglish mode
    req_lang = (args.language or "auto").lower()
    task = args.task
    hinglish_mode = args.hinglish

    if req_lang == "hinglish":
        whisper_lang = "hi"
        hinglish_mode = True
        task = "transcribe"
    elif req_lang == "en_translate":
        whisper_lang = None  # Auto-detect language (e.g. Hindi) and translate to English
        task = "translate"
    elif req_lang in ("hi", "hindi"):
        whisper_lang = "hi"
    elif req_lang in ("en", "english"):
        whisper_lang = "en"
    elif req_lang == "auto":
        whisper_lang = None
    else:
        whisper_lang = req_lang

    # Prefer ultra-fast CTranslate2 engine (faster-whisper) with int8 quantization
    use_faster = False
    try:
        from faster_whisper import WhisperModel
        use_faster = True
    except Exception as imp_err:
        use_faster = False

    segments_out = []
    detected_lang = whisper_lang or "auto"
    duration = 0.0
    full_text = ""

    initial_prompt = None
    if hinglish_mode or whisper_lang == "hi":
        initial_prompt = "Aap sabhi ka swagat hai dosto, aaj hum baat karenge. Ye ek Hinglish video hai jisme Hindi aur English boli gayi hai."

    if use_faster:
        print(f"Loading faster-whisper CTranslate2 model '{args.model}' (compute_type=int8)...")
        sys.stdout.flush()
        cpu_cores = min(8, os.cpu_count() or 4)
        model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=cpu_cores)

        print(f"Transcribing '{input_path.name}' with accelerated CTranslate2 engine (task={task}, lang={whisper_lang or 'auto'})...")
        sys.stdout.flush()

        transcribe_kwargs = {
            "word_timestamps": True,
            "beam_size": 1,
            "condition_on_previous_text": False,
            "task": task
        }
        if whisper_lang:
            transcribe_kwargs["language"] = whisper_lang
        if initial_prompt:
            transcribe_kwargs["initial_prompt"] = initial_prompt

        segments_gen, info = model.transcribe(str(input_path), **transcribe_kwargs)

        detected_lang = info.language or (whisper_lang or "en")
        duration = round(info.duration, 3)

        # If detected language is Hindi and task was transcribe, check if hinglish was requested or auto-preferred
        auto_hinglish = hinglish_mode or (req_lang == "auto" and detected_lang == "hi")

        text_parts = []
        for s_idx, seg in enumerate(segments_gen):
            words_out = []
            if hasattr(seg, "words") and seg.words:
                for w in seg.words:
                    word_str = w.word.strip()
                    if auto_hinglish and has_devanagari(word_str):
                        word_str = devanagari_to_hinglish(word_str)
                    words_out.append({
                        "word": word_str,
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(w.probability, 3)
                    })
            else:
                raw_words = seg.text.strip().split()
                w_dur = (seg.end - seg.start) / max(1, len(raw_words))
                for wIdx, rw in enumerate(raw_words):
                    word_str = rw
                    if auto_hinglish and has_devanagari(word_str):
                        word_str = devanagari_to_hinglish(word_str)
                    words_out.append({
                        "word": word_str,
                        "start": round(seg.start + wIdx * w_dur, 3),
                        "end": round(seg.start + (wIdx + 1) * w_dur, 3),
                        "probability": 0.95
                    })

            clean_seg_text = seg.text.strip()
            if auto_hinglish and has_devanagari(clean_seg_text):
                clean_seg_text = devanagari_to_hinglish(clean_seg_text)

            text_parts.append(clean_seg_text)
            segments_out.append({
                "id": s_idx + 1,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": clean_seg_text,
                "words": words_out
            })

            s_min = int(seg.start // 60)
            s_sec = seg.start % 60
            e_min = int(seg.end // 60)
            e_sec = seg.end % 60
            print(f"[{s_min:02d}:{s_sec:05.2f} --> {e_min:02d}:{e_sec:05.2f}] {clean_seg_text}")
            sys.stdout.flush()

        full_text = " ".join(text_parts).strip()
        print(f"Accelerated transcription complete! Detected language: {detected_lang} (task={task})")

    else:
        import whisper
        print(f"Loading Whisper model '{args.model}' on {args.device}...")
        model = whisper.load_model(args.model, device=args.device)

        print(f"Transcribing '{input_path.name}' (language={whisper_lang or 'auto'}, task={task}, word_timestamps=True)...")
        sys.stdout.flush()
        transcribe_options = {
            "word_timestamps": True,
            "verbose": True,
            "task": task
        }
        if whisper_lang and whisper_lang != "auto":
            transcribe_options["language"] = whisper_lang
        if initial_prompt:
            transcribe_options["initial_prompt"] = initial_prompt

        result = model.transcribe(str(input_path), **transcribe_options)
        detected_lang = result.get("language", whisper_lang or "en")
        duration = round(result.get("duration", 0.0), 3)
        auto_hinglish = hinglish_mode or (req_lang == "auto" and detected_lang == "hi")

        for s_idx, seg in enumerate(result.get("segments", [])):
            words_out = []
            for w in seg.get("words", []):
                word_str = w.get("word", "").strip()
                if auto_hinglish and has_devanagari(word_str):
                    word_str = devanagari_to_hinglish(word_str)
                words_out.append({
                    "word": word_str,
                    "start": round(w.get("start", 0.0), 3),
                    "end": round(w.get("end", 0.0), 3),
                    "probability": round(w.get("probability", 1.0), 3)
                })

            clean_seg_text = seg.get("text", "").strip()
            if auto_hinglish and has_devanagari(clean_seg_text):
                clean_seg_text = devanagari_to_hinglish(clean_seg_text)

            segments_out.append({
                "id": s_idx + 1,
                "start": round(seg.get("start", 0.0), 3),
                "end": round(seg.get("end", 0.0), 3),
                "text": clean_seg_text,
                "words": words_out
            })

        full_text = " ".join([s["text"] for s in segments_out]).strip()

    if not duration and segments_out:
        duration = segments_out[-1]["end"]

    final_lang = "hinglish" if hinglish_mode else detected_lang
    if task == "translate":
        final_lang = "en"

    structured_data = {
        "language": final_lang,
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
