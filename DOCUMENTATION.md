# Geopolitical Documentary Video Production System

A complete, local, free video-production system for long-form geopolitical documentary videos built with Remotion, Kokoro TTS, and Whisper.

## 🎯 System Overview

This system provides:
- **Audio**: Multi-track audio (narration, music, SFX) with volume automation, fade in/out, looping
- **TTS**: Local voice generation using Kokoro (supports English, Hindi, and other languages)
- **Subtitles**: Automatic SRT generation from audio using Whisper + animated subtitle components
- **Visuals**: Animated maps, flags, arrows, timelines, location markers, character illustrations
- **Rendering**: Local MP4 export with synchronized audio/video

---

## 📁 Project Structure

```
E:\Ai content creation\
├── public/
│   ├── audio/
│   │   ├── narration.wav          # Generated narration
│   │   ├── background-music.wav   # Background music (add your own)
│   │   └── sound-effects/         # SFX files
│   ├── images/
│   │   ├── maps/                  # Map SVGs/images
│   │   ├── flags/                 # Flag assets
│   │   └── illustrations/         # Custom illustrations
│   └── videos/                    # Video assets
├── src/
│   ├── audio/
│   │   ├── AudioTrack.tsx         # Multi-track audio components
│   │   └── useAudioTrack.ts       # Audio control hooks
│   ├── subtitles/
│   │   ├── SubtitleParser.ts      # SRT parser
│   │   └── AnimatedSubtitles.tsx  # Animated subtitle components
│   ├── visuals/
│   │   ├── DocumentaryVisuals.tsx # Maps, arrows, timelines, labels
│   │   ├── Flag.tsx               # Flag components (50+ countries)
│   │   └── CharacterIllustration.tsx # Procedural characters
│   ├── compositions/
│   │   └── AudioTest.tsx          # 30-second test composition
│   ├── Root.tsx                   # Composition registry
│   └── index.ts                   # Entry point
├── scripts/
│   ├── generate_narration.py      # TTS script
│   ├── transcribe.py              # Whisper transcription
│   └── render_video.py            # Render script
├── .venv-tts/                     # Isolated Python env for TTS
├── package.json
└── remotion.config.ts
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Node dependencies (already done)
npm install

# Python TTS environment (already created)
cd E:\Ai content creation
.venv-tts\Scripts\Activate.ps1
pip install kokoro==0.9.4 soundfile torch misaki[en]
```

### 2. Generate Narration

```bash
# Activate TTS environment
.venv-tts\Scripts\Activate.ps1

# Create narration script
echo "India's geopolitical journey spans from ancient civilizations to modern global power." > scripts/narration.txt

# Generate audio (English)
python scripts/generate_narration.py scripts/narration.txt public/audio/narration.wav --voice af_heart

# Generate audio (Hindi)
python scripts/generate_narration.py scripts/narration_hi.txt public/audio/narration_hi.wav --lang h --voice hf_alpha
```

### 3. Generate Subtitles

```bash
# Transcribe narration to SRT
python scripts/transcribe.py public/audio/narration.wav public/subtitles.srt --model base --language en
```

### 4. Add Background Music

Place a background music file at:
```
public/audio/background-music.wav
```
Recommended: Royalty-free ambient/documentary music, ~30+ seconds, loops well.

### 5. Preview in Remotion Studio

```bash
npm run dev
# Opens http://localhost:3000
```

### 6. Render Video

```bash
# Basic render
python scripts/render_video.py AudioTest output/video.mp4

# High quality render
python scripts/render_video.py AudioTest output/video.mp4 --crf 18 --preset slow

# Preview single frame
python scripts/render_video.py AudioTest output/frame.png --still --frame 150
```

---

## 🎙️ Audio System

### AudioTrack Component

```tsx
import { AudioTrack, AudioTrackGroup } from "./audio/AudioTrack";

<AudioTrackGroup
  narration={{
    src: "/audio/narration.wav",
    volume: 1.0,
    startFrom: 90,        // Start at frame 90 (3 seconds)
    fadeIn: 15,           // 0.5s fade in
    fadeOut: 15,          // 0.5s fade out
    premountFor: 30,      // Preload 1 second
  }}
  music={{
    src: "/audio/background-music.wav",
    volume: 0.15,         // 15% volume (ducked under narration)
    loop: true,
    fadeIn: 30,
    fadeOut: 30,
  }}
  soundEffects={[
    { src: "/audio/sound-effects/whoosh.wav", volume: 0.5, startFrom: 120 },
  ]}
/>
```

### Volume Automation

```tsx
import { createVolumeKeyframes, createDuckingVolume } from "./audio/AudioTrack";

// Keyframe volume
const musicVolume = createVolumeKeyframes([
  { frame: 0, volume: 0.2 },
  { frame: 90, volume: 0.15 },  // Duck during narration
  { frame: 270, volume: 0.2 },  // Return to normal
]);

// Auto-ducking when narration plays
const narrationFrames = [
  { start: 90, end: 270 },
  { start: 300, end: 450 },
];
const musicVolume = createDuckingVolume(narrationFrames, 0.2, 0.08, 15);
```

---

## 🗣️ TTS System (Kokoro)

### Supported Languages & Voices

| Language | Code | Voices (examples) |
|----------|------|-------------------|
| English (US) | `a` | `af_heart`, `af_bella`, `am_echo`, `am_michael` |
| English (UK) | `b` | `bf_alice`, `bf_emma`, `bm_daniel`, `bm_george` |
| Spanish | `e` | `ef_dora`, `em_alex` |
| French | `f` | `ff_siwis`, `fm_jean` |
| Hindi | `h` | `hf_alpha`, `hm_beta` |
| Italian | `i` | `if_sara`, `im_nicola` |
| Portuguese | `p` | `pf_dora`, `pm_alex` |
| Chinese | `z` | `zf_xiaobei`, `zm_yunjian` |

### Generate Narration

```bash
# English (default)
python scripts/generate_narration.py script.txt output.wav --voice af_heart --speed 1.0

# Hindi
python scripts/generate_narration.py script_hi.txt output_hi.wav --lang h --voice hf_alpha --speed 1.0

# List voices for a language
python scripts/generate_narration.py --list-voices --lang a

# Test a voice
python scripts/generate_narration.py --test-voice af_heart
```

### Voice Selection Guide

- **Documentary narration**: `af_heart` (warm, authoritative female) or `am_echo` (clear male)
- **Character voices**: `af_bella`, `bf_alice`, `bm_george`
- **Hindi**: `hf_alpha` (female), `hm_beta` (male)

---

## 📝 Subtitle System

### Generate SRT from Audio

```bash
# Basic transcription
python scripts/transcribe.py narration.wav subtitles.srt

# With specific model (better accuracy)
python scripts/transcribe.py narration.wav subtitles.srt --model small --language en

# Translate to English
python scripts/transcribe.py narration_hi.wav subtitles_en.srt --task translate
```

### Whisper Model Comparison

| Model | Speed | Accuracy | VRAM | Best For |
|-------|-------|----------|------|----------|
| tiny | ~10x | Low | ~1GB | Quick drafts |
| base | ~5x | Good | ~1GB | **Recommended default** |
| small | ~3x | Better | ~2GB | Production |
| medium | ~2x | High | ~5GB | High quality |
| large-v3 | 1x | Best | ~10GB | Maximum accuracy |

### Animated Subtitles

```tsx
import { AnimatedSubtitles, loadSubtitles, ParsedSubtitles } from "./subtitles/AnimatedSubtitles";
import { useEffect, useState } from "react";

const [subtitles, setSubtitles] = useState<ParsedSubtitles | null>(null);

useEffect(() => {
  loadSubtitles("/subtitles.srt", fps).then(setSubtitles);
}, [fps]);

<AnimatedSubtitles
  subtitles={subtitles}
  animation="slide-up"        // fade | slide-up | typewriter | pop | highlight
  animationDuration={20}      // frames
  style={{
    fontSize: 48,
    bottom: "12%",
    maxCharsPerLine: 48,
    maxLines: 2,
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 3,
    backgroundColor: "rgba(26, 26, 46, 0.85)",
    backgroundPadding: 20,
    backgroundBorderRadius: 10,
  }}
/>
```

### Karaoke Subtitles (Word-level)

```tsx
import { KaraokeSubtitles, WordTiming } from "./subtitles/AnimatedSubtitles";

// Requires word-level timestamps from Whisper
const words: WordTiming[] = [
  { word: "India's", start: 0.0, end: 0.5, startFrame: 0, endFrame: 15 },
  { word: "geopolitical", start: 0.5, end: 1.2, startFrame: 15, endFrame: 36 },
  // ... from Whisper's word timestamps
];

<KaraokeSubtitles
  words={words}
  highlightColor="#FFD700"
  defaultColor="#FFFFFF"
/>
```

---

## 🗺️ Visual Components

### Animated Map

```tsx
import { AnimatedMap, MapRegion, MapMarker } from "./visuals/DocumentaryVisuals";

<AnimatedMap
  mapSvg={IndiaMapSVG}
  width={1400}
  height={800}
  regions={[
    { id: "kashmir", path: "...", name: "Kashmir", animation: "pulse", animationDelay: 30 },
    { id: "punjab", path: "...", name: "Punjab", animation: "fill", animationDelay: 60 },
  ]}
  markers={[
    { id: "delhi", x: 0.38, y: 0.25, label: "Delhi", type: "pin", color: "#e74c3c", animation: "bounce" },
    { id: "mumbai", x: 0.28, y: 0.45, label: "Mumbai", type: "dot", color: "#3498db", animation: "fade" },
  ]}
  camera={{ x: 0.5, y: 0.4, zoom: 1.2, duration: 180 }}
/>
```

### Timeline

```tsx
import { Timeline, TimelineEvent } from "./visuals/DocumentaryVisuals";

const events: TimelineEvent[] = [
  { id: "1947", date: "1947", year: 1947, title: "Independence", color: "#c0392b" },
  { id: "1950", date: "1950", year: 1950, title: "Constitution", color: "#2980b9" },
  { id: "1991", date: "1991", year: 1991, title: "Liberalization", color: "#f39c12" },
];

<Timeline
  events={events}
  yearRange={[1947, 2024]}
  orientation="horizontal"
  width={1600}
  height={300}
  animationDuration={40}
  staggerDelay={20}
/>
```

### Animated Arrows

```tsx
import { AnimatedArrow } from "./visuals/DocumentaryVisuals";

<AnimatedArrow
  from={{ x: 400, y: 300 }}
  to={{ x: 800, y: 400 }}
  color="#c0392b"
  strokeWidth={4}
  headSize={16}
  animation="draw"        // draw | flow | pulse
  animationDuration={60}
  animationDelay={30}
  label="Migration Route"
  labelPosition={0.5}
  labelOffset={-30}
/>
```

### Flags

```tsx
import { Flag, FlagIcon, WavingFlag } from "./visuals/Flag";

// Standard flag
<Flag countryCode="IN" width={200} animation="wave" animationDuration={120} />

// Small icon
<FlagIcon countryCode="US" size={32} shape="circle" />

// Waving flag (SVG distortion)
<WavingFlag countryCode="GB" width={300} segments={30} waveSpeed={0.5} />
```

**Available country codes**: IN, US, CN, RU, GB, EU, PK, BD, and 40+ more. Use `getAvailableFlags()` to list all.

### Characters

```tsx
import { SimpleCharacter, CharacterGroup } from "./visuals/CharacterIllustration";

<SimpleCharacter
  type="leader"           // person | leader | soldier | civilian | historical
  pose="speaking"         // standing | sitting | walking | speaking | gesturing | thinking
  facing="front"          // left | right | front
  skinTone="#E0AC69"
  hairColor="#1a1a1a"
  outfitColor="#1a3a5c"
  outfitStyle="formal"    // modern | historical | military | formal | casual
  animation="talk"        // idle | breathe | talk | gesture | walk
  scale={1}
/>

<CharacterGroup
  characters={[
    { props: { type: "leader", pose: "speaking" }, x: 200, y: 400 },
    { props: { type: "civilian", pose: "standing" }, x: 600, y: 450 },
  ]}
/>
```

### Location Labels

```tsx
import { LocationLabel } from "./visuals/DocumentaryVisuals";

<LocationLabel
  x={800}
  y={300}
  text="Disputed Territory"
  animation="slide"       // fade | slide | scale
  animationDelay={60}
  animationDuration={40}
  style={{
    backgroundColor: "rgba(192, 57, 43, 0.9)",
    color: "#fff",
    fontSize: 16,
  }}
/>
```

---

## 🎬 Creating a Documentary

### 1. Write Script

Create `scripts/episode1.txt`:
```
India's geopolitical journey spans millennia. From the Indus Valley Civilization
to the modern republic, this land has been a crossroads of empires, trade, and ideas.
```

### 2. Generate Assets

```bash
# Narration
python scripts/generate_narration.py scripts/episode1.txt public/audio/ep1_narration.wav

# Subtitles
python scripts/transcribe.py public/audio/ep1_narration.wav public/ep1_subtitles.srt

# Create composition (see src/compositions/AudioTest.tsx as template)
```

### 3. Build Composition

Create `src/compositions/Episode1.tsx` following the `AudioTest.tsx` pattern:
- Define scenes with frame ranges
- Add map animations synchronized with narration
- Insert timeline events at correct timestamps
- Add location labels for geographic references

### 4. Register in Root.tsx

```tsx
import { Episode1 } from "./compositions/Episode1";

<Composition
  id="Episode1"
  component={Episode1}
  durationInFrames={14400}  // 8 minutes at 30fps
  fps={30}
  width={1920}
  height={1080}
  defaultProps={{
    narrationSrc: "/audio/ep1_narration.wav",
    subtitlesSrc: "/ep1_subtitles.srt",
  }}
/>
```

### 5. Render

```bash
python scripts/render_video.py Episode1 output/episode1.mp4 --crf 18 --preset slow
```

---

## ⚙️ Configuration

### Remotion Config (remotion.config.ts)

```typescript
import { Config } from "@remotion/cli/config";

Config.setRspack(true);           // Faster bundling
Config.setVideoImageFormat("jpeg"); // Smaller output
Config.setOverwriteOutput(true);  // Auto-overwrite
```

### Video Settings

| Setting | Value | Notes |
|---------|-------|-------|
| Resolution | 1920×1080 | Full HD |
| Frame Rate | 30 FPS | Standard |
| Codec | H.264 (libx264) | Universal compatibility |
| CRF | 18-23 | 18=high quality, 23=smaller |
| Preset | medium/slow | Slower = better compression |
| Audio | AAC 192kbps | High quality |

---

## 🔧 Troubleshooting

### Audio/Video Sync Issues

1. **Check frame rate**: Ensure composition FPS matches render FPS (30)
2. **Preload audio**: Use `premountFor={fps}` on AudioTrack
3. **Trim silence**: Remove leading silence from narration files

### TTS Issues

1. **Model download fails**: Set `HF_TOKEN` env var for higher rate limits
2. **Voice not found**: Use exact voice names from `list_voices`
3. **Hindi not working**: Ensure `lang_code='h'` and valid Hindi voice

### Whisper Issues

1. **Out of memory**: Use smaller model (`base` or `small`)
2. **Wrong language**: Specify `--language en` explicitly
3. **Poor accuracy**: Try `medium` or `large-v3` model

### Render Failures

1. **Out of memory**: Reduce `--concurrency` (try 2 or 4)
2. **Missing FFmpeg**: Install FFmpeg and ensure in PATH
3. **Permission denied**: Run terminal as administrator on Windows

---

## 📚 Extending the System

### Add Custom Map

1. Create SVG map in `public/images/maps/`
2. Import in composition:
```tsx
import CustomMap from "../../public/images/maps/custom.svg";
<AnimatedMap mapSvg={<CustomMap />} ... />
```

### Add Custom Flag

```tsx
import { registerFlag, FlagDefinition } from "./visuals/Flag";

const customFlag: FlagDefinition = {
  aspectRatio: 3/2,
  render: (w, h) => (
    // Your SVG elements
  ),
};
registerFlag("XX", customFlag);
```

### Add Sound Effects

Place `.wav` files in `public/audio/sound-effects/` and reference in composition.

---

## 📄 License & Credits

- **Remotion**: MIT License (company license required for commercial use >$200k/yr)
- **Kokoro**: Apache 2.0 (hexgrad/Kokoro-82M)
- **Whisper**: MIT License (OpenAI)
- **Flags**: Public domain / custom implementations

---

## 🎓 Next Steps

1. **Test the 30-second AudioTest composition** - verify all systems work
2. **Create your first 2-minute segment** - practice scene timing
3. **Build episode template** - reusable structure for series
4. **Add more visual assets** - maps, illustrations, archive footage
5. **Optimize render pipeline** - parallel rendering, caching

---

*System built for local, free, long-form geopolitical documentary production.*