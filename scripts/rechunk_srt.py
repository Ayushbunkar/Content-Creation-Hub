import sys
import re
from pathlib import Path

def format_time(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def parse_time(timestr: str) -> float:
    m = re.match(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})", timestr.strip())
    if not m:
        return 0.0
    h, mn, s, ms = map(int, m.groups())
    return h * 3600 + mn * 60 + s + ms / 1000.0

def rechunk_srt(srt_file: str, max_words=5):
    p = Path(srt_file)
    if not p.exists():
        print(f"File not found: {srt_file}")
        return
    
    content = p.read_text(encoding="utf-8")
    blocks = re.split(r"\n\s*\n", content.strip())
    
    new_cues = []
    for b in blocks:
        lines = [ln.strip() for ln in b.split("\n") if ln.strip()]
        if len(lines) < 3:
            continue
        time_line = lines[1]
        m = re.match(r"(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})", time_line)
        if not m:
            continue
        start_sec = parse_time(m.group(1))
        end_sec = parse_time(m.group(2))
        text = " ".join(lines[2:])
        words = text.split()
        if not words:
            continue
            
        dur = max(0.5, end_sec - start_sec)
        if len(words) <= max_words:
            new_cues.append({
                "start": start_sec,
                "end": end_sec,
                "text": " ".join(words)
            })
        else:
            chunks = []
            for i in range(0, len(words), max_words):
                chunks.append(" ".join(words[i:i + max_words]))
                
            cur_start = start_sec
            total_words = len(words)
            for i, chunk in enumerate(chunks):
                chunk_w = len(chunk.split())
                chunk_dur = (chunk_w / total_words) * dur
                chunk_end = end_sec if i == len(chunks) - 1 else (cur_start + chunk_dur)
                new_cues.append({
                    "start": cur_start,
                    "end": chunk_end,
                    "text": chunk
                })
                cur_start = chunk_end
                
    output_lines = []
    for idx, cue in enumerate(new_cues, 1):
        output_lines.append(f"{idx}\n{format_time(cue['start'])} --> {format_time(cue['end'])}\n{cue['text']}\n")
        
    p.write_text("\n".join(output_lines), encoding="utf-8")
    print(f"Rechunked {srt_file}: now has {len(new_cues)} single-line cues (max {max_words} words each).")

if __name__ == "__main__":
    file_path = sys.argv[1] if len(sys.argv) > 1 else "public/subtitles_doc_1794400642997.srt"
    rechunk_srt(file_path)
