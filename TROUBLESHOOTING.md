# LOCAL AI VIDEO STUDIO — Troubleshooting & Technical Notes

This document collects solutions to common environment issues, Windows quirks, and optimization best practices.

---

## 1. Windows File Paths and Spaces

### The Issue
Paths containing spaces (such as `E:\Ai content creation`) can be parsed incorrectly when passed to command-line utilities if quotes are omitted or stripped by Windows command prompts.

### The Fix
In `server/pipeline.ts`, pass relative paths for Remotion `--props`:
```typescript
const relPropsPath = path.join('public', `props_${projectId}.json`).replace(/\\/g, '/');
// Argument: `--props=${relPropsPath}`
```
Always use forward slashes (`/`) in Remotion and URL references.

---

## 2. Headless Remotion Rendering & Static Assets

### The Issue
When rendering headlessly (`npx remotion render`), assets in the `public/` directory accessed via relative string paths (e.g. `"/audio/music.wav"`) can return `404 Not Found` if not resolved through Remotion's asset bundler.

### The Fix
Wrap all paths to files inside the `public/` directory with `staticFile`:
```typescript
import { staticFile } from 'remotion';

const audioUrl = staticFile('audio/background-music.wav');
```

---

## 3. VRAM Protection (AMD Ryzen + GTX 1650 4GB)

### Hardware Profile
- GPU: NVIDIA GTX 1650 (4 GB VRAM)
- RAM: 24 GB DDR4
- CPU: AMD Ryzen 5 3550H

### The Architecture
Rendering video in 1080p60/30 via headless Chrome can consume 1.5–2.5 GB of GPU memory. Running Kokoro TTS or Whisper on GPU simultaneously could trigger CUDA Out-Of-Memory (OOM) errors.

### The Solution
- Kokoro TTS and OpenAI Whisper run inside `.venv-tts` pinned strictly to **CPU mode**.
- Full GPU VRAM is reserved for Remotion's Chromium rendering engine and hardware-accelerated canvas compositing.
- Concurrency for Remotion render is tuned to `--concurrency=2` for optimal stability and thermal performance.

---

## 4. Subtitle Encoding & UTF-8 Standards

### The Issue
Windows PowerShell 5.1 creates UTF-16LE files by default when using `Set-Content` or `Out-File`, leading to parsing errors with standard JSON and SRT readers.

### The Fix
All pipeline file generation uses Node.js `fs.writeFileSync(..., 'utf-8')` or Python with `PYTHONIOENCODING=utf-8` to guarantee clean UTF-8 text without Byte Order Marks (BOM).
