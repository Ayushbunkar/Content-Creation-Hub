# LOCAL AI VIDEO STUDIO — Production Guide

A complete guide to producing professional, long-form (8–20+ minute) AI documentaries and educational explainers using **Local AI Video Studio** on Windows 11.

---

## 1. System Architecture Overview

Local AI Video Studio operates locally with zero cloud dependencies and zero API costs:

```
┌──────────────────────────────────────────────────────────┐
│             Local AI Video Studio Web UI                 │
│         (http://127.0.0.1:3000 / Modern SPA)            │
└────────────┬─────────────────────────────┬───────────────┘
             │ WebSocket & REST            │ Props & Preview
             ▼                             ▼
┌───────────────────────────┐ ┌────────────────────────────┐
│      Express Backend      │ │       Remotion 4.0         │
│   (server/pipeline.ts)    │ │ (Documentary Engine / SVG) │
└────────────┬──────────────┘ └────────────┬───────────────┘
             │ Spawns isolated tools       │
 ┌───────────┼───────────┬─────────────┐   │
 ▼           ▼           ▼             ▼   ▼
Kokoro TTS Whisper Base  FFmpeg    SQLite DB (studio.db)
(.venv-tts) (.venv-tts)  (Local)   (storage/database/)
```

---

## 2. Supported Categories and Default Styling

The studio includes built-in defaults for 8 content categories:

| Category | Default Visual Language | Narration & Tone | Key Visual Elements |
|---|---|---|---|
| **Geopolitics & Map Animation** | Warm cartographic sepia & dark navy | Authoritative, measured, objective | Animated SVG world & regional maps, trade route arrows, territory borders |
| **Finance & Economics** | High-contrast emerald & dark slate | Crisp, analytical, data-driven | Multi-series line charts, stat comparison cards, currency counters |
| **Curiosity & Explainers** | Vibrant slate & deep blue | Inquisitive, engaging, fast-paced | Split diagrams, schematic callouts, dynamic typography |
| **True Crime & Mystery** | Low-key noir, crimson & charcoal | Suspenseful, grave, investigative | Incident timelines, evidence pins, redacted document overlays |
| **Curated Viral Topics** | Modern dark mode with cyan accents | Energetic, direct, hook-heavy | Dynamic kinetic text, pop-in stats, high-retention lower thirds |
| **Guided Meditation** | Minimalist organic, sage green & soft earth | Calm, resonant, spacious pauses | Slow ambient breathing pulses, soft gradients, Zen circles |
| **Psychology & Behaviour** | Editorial charcoal & warm cream | Empathetic, observational, clinical | Stick figures, thought bubbles, spectrum sliders, cognitive loops |
| **AI & Deep Tech** | Cybernetic indigo & neon cyan | Tech-literate, forward-looking | Flowcharts, neural network nodes, code window overlays |

---

## 3. Producing Long-Form Documentaries (8–20 Minutes)

### A. Words-to-Time Rule of Thumb
- **Kokoro TTS Speed**: ~135–150 words per minute at 1.0x speed.
- **8-minute video**: ~1,100–1,200 words across 15–20 scenes.
- **12-minute video**: ~1,600–1,800 words across 25–30 scenes.
- **20-minute video**: ~2,700–3,000 words across 40–50 scenes.

### B. Scene Duration Planning
Each scene should ideally run between **15 to 45 seconds** to maintain audience engagement without visual fatigue:
- **Hook & Intro** (0:00–0:45): 2 scenes, rapid map zooms and provocative thesis statement.
- **Context & History** (0:45–3:30): 4–6 scenes with historical timelines and geographical boundary movements.
- **Strategic Core / Conflict** (3:30–7:00): 6–8 scenes showing naval routes, military chokepoints, or economic charts.
- **Future Outlook & Synthesis** (7:00–End): 2–3 scenes with summarized key conclusions and viewer question.

---

## 4. Voiceover & Language Setup

The studio ships with isolated Kokoro TTS in `.venv-tts`:
- **English Voices**:
  - `af_heart` (Default): Warm, clear, authoritative documentary narration.
  - `am_adam`: Resonant, deep male voice ideal for military and geopolitical history.
  - `af_bella`: Expressive female tone suitable for educational explainers.
- **Hindi Voices**:
  - `hf_alpha`: Clean, natural Hindi documentary voice.
  - `hm_omega`: Confident male voice for formal analysis.

---

## 5. Caption Studio: 15 Built-in Templates

Customize subtitle presentation in the **Caption Studio** tab:
1. `minimal-white`: Clean documentary subtitles with subtle black outline.
2. `bold-keyword`: Highlights active verbs and keywords in bright amber.
3. `yellow-impact`: High-retention YouTube style with heavy drop shadow.
4. `news-lower-third`: Broadcast banner aesthetic with red topic badge.
5. `cinema-boxed`: Semi-transparent dark pill background for complex scenes.
6. `glow-neon`: Cyan neon glow for AI and technology topics.
7. `clean-condensed`: Modern editorial font styling.
8. `karaoke-reveal`: Progressive word-by-word active fill.
9. `crimson-noir`: Atmospheric dark red text for True Crime.
10. `emerald-finance`: Green keyword emphasis for market analysis.
11. `typewriter-mono`: Monospaced documentary look.
12. `vintage-cream`: Warm serif styling for historical explainers.
13. `social-reel-pop`: High-contrast center-screen pop animation for 9:16 Shorts.
14. `minimal-subtle`: Low-opacity captioning for guided meditation.
15. `duo-accent`: Alternating white and electric blue phrasing.

---

## 6. Social Media Metadata Studio

When generation completes, the system automatically writes:
- 3 SEO-optimized YouTube titles.
- Complete description with chapter timestamps (`00:00 - Introduction`).
- Categorized tags and hashtags.
- Instagram & Shorts/Reels captions.
- Pinned comment to maximize audience engagement.
- 2 high-retention hook ideas.


---

## 7. Standalone Caption Studio (Upload Any Video)

Caption Studio works independently of the AI video generation pipeline. You can import any existing video or audio from your local filesystem and produce animated captioned content without cloud dependencies.

### Supported File Formats
- **Video**: MP4, MOV, MKV, WebM, AVI.
- **Audio**: MP3, WAV, M4A, AAC, FLAC, OGG.

### Step-by-Step Workflow
1. **Upload**: Drag and drop any media file into the Caption Studio dropzone.
2. **Media Probe**: The backend runs `ffprobe` to determine duration, resolution, codecs, and container validity.
3. **Audio Extraction**: `ffmpeg` extracts a 16kHz mono WAV (`storage/audio/<id>.wav`) optimized for Whisper.
4. **Local Transcription**: OpenAI Whisper transcribes with `word_timestamps=True` on CPU.
5. **Transcript Editing**:
   - Click any sentence or word pill to seek the video player to that timestamp.
   - Edit text, split, merge, add, or delete segments.
   - Search & replace phrases across the transcript with undo/redo support.
6. **Template Selection**: Choose from 15 animated caption templates (Minimal White, Bold Keyword, Karaoke Highlight, Word Pop, Documentary Serif, News Lower Third, Typewriter, Clean Two-Line, Boxed, Outline, Highlight Bar, Minimal Center, Hinglish, Chapter, Cinematic Editorial).
7. **Custom Styling**: Tweak font family, font size, text/highlight colors, outline thickness, and vertical positioning.
8. **Export**:
   - **Burned-In Video**: Render directly to 1080p MP4 in 16:9, 9:16 (Shorts/Reels), 1:1, or 4:5.
   - **Sidecar Subtitles**: Download standalone `.srt`, `.vtt`, `.ass`, `.txt`, or `.json` without re-encoding.
