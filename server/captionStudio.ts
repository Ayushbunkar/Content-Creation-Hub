import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { runQuery, getQuery, allQuery } from './db';

export interface MediaProbeInfo {
  filename: string;
  sizeBytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  isVideo: boolean;
  videoCodec: string;
  audioCodec: string;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WordTimestamp[];
  speaker?: string;
  confidence?: number;
}

export interface CaptionProject {
  id: string;
  title: string;
  video_path: string;
  audio_path: string | null;
  file_info: MediaProbeInfo;
  language: string;
  model: string;
  status: 'uploaded' | 'transcribing' | 'ready' | 'exporting' | 'completed' | 'failed';
  progress: number;
  error_message: string | null;
  transcript_json: {
    language: string;
    duration: number;
    text: string;
    segments: TranscriptSegment[];
  } | null;
  caption_template: string;
  custom_style: any;
  video_settings: {
    aspect_ratio: '16:9' | '9:16' | '1:1' | '4:5';
    resolution: '4K' | '1080p' | '720p' | 'original';
    trim_start: number;
    trim_end: number;
    crop?: { x: number; y: number; width: number; height: number };
    original_volume: number;
    bgm_volume: number;
    bgm_track?: string;
  };
  exported_video: string | null;
  created_at: string;
  updated_at: string;
}

export class CaptionStudioService {
  private static listeners: Array<(jobUpdate: any) => void> = [];

  static subscribe(fn: (jobUpdate: any) => void) {
    this.listeners.push(fn);
  }

  static broadcast(update: any) {
    this.listeners.forEach((fn) => {
      try { fn(update); } catch (e) { }
    });
  }

  /**
   * Probe media using ffprobe to validate signature and streams
   */
  static async probeMedia(filePath: string): Promise<MediaProbeInfo> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ];

      const p = spawn('ffprobe', args);
      let stdout = '';
      let stderr = '';

      p.stdout.on('data', (d) => { stdout += d.toString(); });
      p.stderr.on('data', (d) => { stderr += d.toString(); });

      p.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Media validation failed: file is corrupted or not a supported video/audio format`));
        }

        try {
          const data = JSON.parse(stdout);
          const format = data.format || {};
          const streams = data.streams || [];

          if (!streams.length) {
            return reject(new Error('Invalid media: No media streams detected'));
          }

          const videoStream = streams.find((s: any) => s.codec_type === 'video');
          const audioStream = streams.find((s: any) => s.codec_type === 'audio');

          let fps = 30;
          if (videoStream?.r_frame_rate) {
            const parts = videoStream.r_frame_rate.split('/');
            if (parts.length === 2 && parseFloat(parts[1]) > 0) {
              fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
            }
          }

          const info: MediaProbeInfo = {
            filename: path.basename(filePath),
            sizeBytes: parseInt(format.size || '0', 10),
            durationSeconds: parseFloat(format.duration || videoStream?.duration || audioStream?.duration || '0'),
            width: videoStream?.width || 1920,
            height: videoStream?.height || 1080,
            fps: fps || 30,
            hasAudio: !!audioStream,
            isVideo: !!videoStream,
            videoCodec: videoStream?.codec_name || 'none',
            audioCodec: audioStream?.codec_name || 'none'
          };

          resolve(info);
        } catch (err: any) {
          reject(new Error(`Failed to parse media probe: ${err.message}`));
        }
      });

      p.on('error', reject);
    });
  }

  /**
   * Extract audio to 16kHz WAV mono using FFmpeg
   */
  static async extractAudio(mediaPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i', mediaPath,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        outputPath
      ];

      const p = spawn('ffmpeg', args);
      p.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg audio extraction failed with exit code ${code}`));
      });
      p.on('error', reject);
    });
  }

  /**
   * Run Whisper transcription with word timestamps
   */
  static async transcribeMedia(projectId: string, language = 'auto', modelName = 'tiny'): Promise<void> {
    const project = await getQuery<any>('SELECT * FROM caption_projects WHERE id = ?', [projectId]);
    if (!project) throw new Error('Caption project not found');

    const audioPath = path.join(process.cwd(), project.audio_path);
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found at ${audioPath}`);
    }

    await runQuery('UPDATE caption_projects SET status = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      'transcribing', 15, projectId
    ]);
    this.broadcast({ projectId, status: 'transcribing', progress: 15 });

    const jsonOutputPath = path.join(process.cwd(), 'storage', 'captions', `${projectId}_transcript.json`);
    const pythonExe = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
    const scriptPath = path.join(process.cwd(), 'scripts', 'transcribe_words.py');

    return new Promise((resolve, reject) => {
      const args = [
        scriptPath,
        audioPath,
        jsonOutputPath,
        '--model', modelName || 'tiny',
        '--language', language || 'auto',
        '--device', 'cpu'
      ];

      const p = spawn(pythonExe, args, {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let stdout = '';
      let stderr = '';
      p.stdout.on('data', (d) => {
        stdout += d.toString();
        this.broadcast({ projectId, status: 'transcribing', progress: 65, log: d.toString() });
      });
      p.stderr.on('data', (d) => { stderr += d.toString(); });

      p.on('close', async (code) => {
        if (code === 0 && fs.existsSync(jsonOutputPath)) {
          try {
            const transcriptRaw = fs.readFileSync(jsonOutputPath, 'utf-8');
            const transcriptData = JSON.parse(transcriptRaw);

            await runQuery(
              `UPDATE caption_projects SET 
                status = 'ready', 
                progress = 100, 
                transcript_json = ?, 
                language = ?, 
                model = ?,
                updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?`,
              [JSON.stringify(transcriptData), transcriptData.language || language, modelName, projectId]
            );

            this.broadcast({ projectId, status: 'ready', progress: 100 });
            resolve();
          } catch (e: any) {
            await runQuery('UPDATE caption_projects SET status = ?, error_message = ? WHERE id = ?', ['failed', e.message, projectId]);
            reject(e);
          }
        } else {
          const err = new Error(`Whisper transcription failed with exit code ${code}: ${stderr || stdout}`);
          await runQuery('UPDATE caption_projects SET status = ?, error_message = ? WHERE id = ?', ['failed', err.message, projectId]);
          reject(err);
        }
      });

      p.on('error', (err) => {
        runQuery('UPDATE caption_projects SET status = ?, error_message = ? WHERE id = ?', ['failed', err.message, projectId]);
        reject(err);
      });
    });
  }

  /**
   * Generate ASS subtitles file matching template and custom styles with full DPI/resolution scaling
   */
  static generateAss(
    segments: TranscriptSegment[],
    template: string,
    customStyle: any,
    targetWidth: number,
    targetHeight: number,
    outputPath: string
  ): void {
    // Dynamic scale factor for typography: baseline is 1080p (1920 landscape, 1080 portrait)
    const baseWidth = targetWidth < targetHeight ? 1080 : 1920;
    const scaleFactor = Math.max(0.5, targetWidth / baseWidth);

    const baseFontSize = customStyle?.fontSize && customStyle.fontSize !== 54 ? customStyle.fontSize : (targetWidth < targetHeight ? 68 : 44);
    const baseOutlineWidth = customStyle?.outlineWidth !== undefined ? customStyle.outlineWidth : (
      ['outline-caption', 'gaming-captions', 'mrbeast-bold', 'hormozi-bold'].includes(template) ? 6 : (targetWidth < targetHeight ? 5 : 3)
    );
    const baseShadowWidth = customStyle?.shadow !== undefined ? customStyle.shadow : (targetWidth < targetHeight ? 3 : 2);

    // Vertical positioning / safe zones:
    // 'bottom': 480px from bottom (9:16 portrait standard)
    // 'center': targetHeight / 2 (or 960px)
    // 'top': targetHeight - 240px (or 1600px)
    // 'lower-third': 320px
    let baseVerticalMargin = 480;
    if (customStyle?.position === 'top') {
      baseVerticalMargin = targetWidth < targetHeight ? 1620 : 920;
    } else if (customStyle?.position === 'center') {
      baseVerticalMargin = targetWidth < targetHeight ? 960 : 500;
    } else if (customStyle?.position === 'lower-third') {
      baseVerticalMargin = targetWidth < targetHeight ? 320 : 160;
    } else if (customStyle?.verticalOffset !== undefined && customStyle.verticalOffset !== 240 && customStyle.verticalOffset !== 750) {
      baseVerticalMargin = customStyle.verticalOffset;
    } else if (targetWidth >= targetHeight) {
      baseVerticalMargin = 80;
    }

    // Default typography mappings per preset
    const defaultFonts: Record<string, string> = {
      'minimal-montserrat': 'Montserrat',
      'yellow-karaoke': 'Montserrat',
      'mrbeast-bold': 'Montserrat',
      'hormozi-bold': 'Montserrat',
      'podcast-pro': 'Poppins',
      'netflix-doc': 'Inter',
      'viral-word-pop': 'Inter',
      'typewriter': 'Courier New',
      'modern-kinetic': 'Montserrat',
      'clean-subtitle': 'Inter',
      'yellow-box-highlight': 'Montserrat',
      'premium-editorial': 'Playfair Display',
      'gaming-captions': 'Oswald',
      'neon-captions': 'Inter',
      'cinematic-two-line': 'Inter',
      'minimal-light': 'Montserrat',
      'dynamic-bounce': 'Montserrat',
      'news-broadcast': 'Inter',
      'documentary-highlight': 'Playfair Display',
      'gradient-accent': 'Poppins',
      'centered-impact': 'Montserrat',
      'split-captions': 'Inter',
      'social-minimal': 'Inter',
      'editorial-bold': 'Montserrat',
      'documentary-serif': 'Playfair Display',
      'magazine-paper': 'Georgia',
      'hinglish-caption': 'Noto Sans Devanagari'
    };

    const defaultColors: Record<string, { primary: string; accent: string }> = {
      'minimal-montserrat': { primary: '#FFFFFF', accent: '#FFD700' },
      'yellow-karaoke': { primary: '#FFFFFF', accent: '#FFD700' },
      'mrbeast-bold': { primary: '#FFFFFF', accent: '#FFDE00' },
      'hormozi-bold': { primary: '#FFFFFF', accent: '#FFE600' },
      'podcast-pro': { primary: '#FFFFFF', accent: '#FFD700' },
      'netflix-doc': { primary: '#F0F0F0', accent: '#E50914' },
      'viral-word-pop': { primary: '#FFFFFF', accent: '#FFD700' },
      'typewriter': { primary: '#00FF66', accent: '#FFFFFF' },
      'modern-kinetic': { primary: '#FFFFFF', accent: '#FF3B30' },
      'clean-subtitle': { primary: '#FFFFFF', accent: '#CCCCCC' },
      'yellow-box-highlight': { primary: '#FFFFFF', accent: '#FFD700' },
      'premium-editorial': { primary: '#F5E6C8', accent: '#D4AF37' },
      'gaming-captions': { primary: '#00F5FF', accent: '#FF0077' },
      'neon-captions': { primary: '#00F5FF', accent: '#FF00AA' },
      'cinematic-two-line': { primary: '#FFFFFF', accent: '#FFD700' },
      'minimal-light': { primary: '#FFFFFF', accent: '#FFD700' },
      'dynamic-bounce': { primary: '#FFFFFF', accent: '#FFD700' },
      'news-broadcast': { primary: '#FFFFFF', accent: '#FF0000' },
      'documentary-highlight': { primary: '#FFFFFF', accent: '#FFD700' },
      'gradient-accent': { primary: '#FFFFFF', accent: '#00F5FF' },
      'centered-impact': { primary: '#FFFFFF', accent: '#FFDE00' },
      'split-captions': { primary: '#FFFFFF', accent: '#FFD700' },
      'social-minimal': { primary: '#FFFFFF', accent: '#FFD700' },
      'editorial-bold': { primary: '#FFFFFF', accent: '#FFD700' },
      'karaoke-highlight': { primary: '#FFD700', accent: '#FF6B35' },
      'neon-glow': { primary: '#00F5FF', accent: '#FF00AA' },
      'fire-word': { primary: '#FF6B00', accent: '#FF0000' },
      'magazine-paper': { primary: '#1A1A1A', accent: '#CC0000' }
    };

    const chosenFont = customStyle?.fontFamily || defaultFonts[template] || 'Inter';
    const chosenColors = defaultColors[template] || { primary: '#FFFFFF', accent: '#FFD700' };

    const s = {
      fontFamily: chosenFont,
      fontSize: Math.round(baseFontSize * scaleFactor),
      fontWeight: customStyle?.fontWeight || (
        ['minimal-light'].includes(template) ? '400' :
        ['bold-keyword','outline-caption','neon-glow','fire-word','word-pop','mrbeast-bold','hormozi-bold','gaming-captions','editorial-bold','centered-impact'].includes(template) ? '900' : '700'
      ),
      primaryColor: customStyle?.color || chosenColors.primary,
      accentColor: customStyle?.highlightColor || chosenColors.accent,
      outlineColor: customStyle?.outlineColor || (template === 'magazine-paper' ? '#F5F0E8' : '#000000'),
      outlineWidth: Math.max(1, Math.round(baseOutlineWidth * scaleFactor)),
      shadowWidth: Math.max(0, Math.round(baseShadowWidth * scaleFactor)),
      alignment: customStyle?.alignment === 'left' ? 1 : customStyle?.alignment === 'right' ? 3 : 2,
      verticalMargin: Math.round(baseVerticalMargin * scaleFactor),
      letterSpacing: customStyle?.letterSpacing !== undefined ? customStyle.letterSpacing : (
        ['cinematic-editorial', 'netflix-doc'].includes(template) ? 3 : 0
      )
    };

    // Helper to convert hex #RRGGBB to ASS &H00BBGGRR
    const hexToAssColor = (hex: string, alpha = '00') => {
      const clean = hex.replace('#', '');
      const r = clean.substring(0, 2) || 'FF';
      const g = clean.substring(2, 4) || 'FF';
      const b = clean.substring(4, 6) || 'FF';
      return `&H${alpha}${b}${g}${r}&`;
    };

    const assPrimary = hexToAssColor(s.primaryColor, '00');
    const assSecondary = hexToAssColor(s.accentColor, '00');
    const assOutline = hexToAssColor(s.outlineColor, '00');

    // Box background formatting for boxed/news/netflix/yellow-box styles
    const isBoxedStyle = [
      'boxed-caption', 'news-lower-third', 'news-broadcast', 'cinematic-subtitle',
      'netflix-doc', 'magazine-paper', 'yellow-box-highlight'
    ].includes(template);

    const assBack = isBoxedStyle
      ? (template === 'magazine-paper' ? '&HF0E8F5F0&' : template === 'yellow-box-highlight' ? '&H0000D7FF&' : '&HCC000000&')
      : (['neon-glow', 'neon-captions', 'outline-caption', 'fire-word'].includes(template) ? '&H00000000&' : '&H80000000&');

    const borderStyleNum = isBoxedStyle ? 4 : 1;
    const safeMarginX = targetWidth < targetHeight ? 110 : 60;

    let assContent = `[Script Info]
Title: AI Viral Clipper Advanced Subtitles
ScriptType: v4.00+
PlayResX: ${targetWidth}
PlayResY: ${targetHeight}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${s.fontFamily},${s.fontSize},${assPrimary},${assSecondary},${assOutline},${assBack},1,0,0,0,100,100,${s.letterSpacing},0,${borderStyleNum},${s.outlineWidth},${s.shadowWidth},${s.alignment},${safeMarginX},${safeMarginX},${s.verticalMargin},1
Style: Accent,${s.fontFamily},${s.fontSize},${assSecondary},${assPrimary},${assOutline},${assBack},1,0,0,0,100,100,${s.letterSpacing},0,${borderStyleNum},${s.outlineWidth},${s.shadowWidth},${s.alignment},${safeMarginX},${safeMarginX},${s.verticalMargin},1
Style: HookTitle,${s.fontFamily},${Math.round(44 * scaleFactor)},&H00FFFFFF,&H000000FF,&H00000000,&HCC000000,1,0,0,0,100,100,0,0,4,3,2,8,${safeMarginX},${safeMarginX},${Math.round(140 * scaleFactor)},1
Style: Watermark,${s.fontFamily},${Math.round(24 * scaleFactor)},&H40FFFFFF,&H00000000,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1,0,9,50,50,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // 0. Optional Hook Title Card (First 3.5s)
    if (customStyle?.hookTitle && customStyle?.showHookTitle !== false) {
      const hookDur = Math.min(5.0, Math.max(2.0, parseFloat(customStyle.hookDuration || '3.5')));
      const hookEndSec = hookDur;
      const s = Math.floor(hookEndSec);
      const cs = Math.floor((hookEndSec - s) * 100);
      const hookEndStr = `0:00:0${s}.${cs.toString().padStart(2, '0')}`;
      assContent += `Dialogue: 2,0:00:00.00,${hookEndStr},HookTitle,,0,0,0,,{\\b1\\c&H0000E5FF&}🔥 ${customStyle.hookTitle.toUpperCase()}\\N\n`;
    }

    // 0b. Optional Watermark Attribution
    if (customStyle?.watermarkText) {
      assContent += `Dialogue: 1,0:00:00.00,9:59:59.00,Watermark,,0,0,0,,${customStyle.watermarkText}\n`;
    }

    // Deduplicate segments that have identical text or overlap within same time
    const cleanSegments: TranscriptSegment[] = [];
    for (const seg of segments) {
      const prev = cleanSegments[cleanSegments.length - 1];
      if (prev) {
        if (prev.text.trim() === seg.text.trim()) continue;
        if (prev.text.includes(seg.text.trim()) && Math.abs(prev.start - seg.start) < 1.2) continue;
      }
      cleanSegments.push(seg);
    }

    const highlightMode = customStyle?.highlightMode || (
      ['yellow-karaoke', 'karaoke-highlight', 'word-pop', 'viral-word-pop', 'fire-word', 'dynamic-bounce'].includes(template)
        ? 'word-by-word'
        : ['clean-subtitle', 'netflix-doc'].includes(template)
        ? 'no-highlighting'
        : 'keyword-emphasis'
    );

    for (const seg of cleanSegments) {
      const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        const cs = Math.floor(Math.round((sec - Math.floor(sec)) * 100));
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
      };

      const startStr = formatTime(seg.start);
      const endStr = formatTime(seg.end);

      let textFormatted = seg.text.trim();

      // Apply Highlighting Modes
      if (highlightMode === 'no-highlighting') {
        // Plain clean text
        textFormatted = `{\\b1}${textFormatted}`;
      } else if (highlightMode === 'word-by-word' && seg.words && seg.words.length > 0) {
        // Karaoke word-by-word progressive reveal
        let kText = '';
        for (const w of seg.words) {
          const durCs = Math.max(1, Math.round((w.end - w.start) * 100));
          if (template === 'viral-word-pop' || template === 'dynamic-bounce') {
            kText += `{\\kf${durCs}\\t(0,${Math.min(durCs * 5, 120)},\\fscx112\\fscy112)\\t(${Math.min(durCs * 5, 120)},${durCs * 10},\\fscx100\\fscy100)}${w.word} `;
          } else {
            kText += `{\\kf${durCs}}${w.word} `;
          }
        }
        textFormatted = `{\\b1}${kText.trim()}`;
      } else if (highlightMode === 'phrase-by-phrase' && seg.words && seg.words.length > 3) {
        // Highlight in 3-4 word phrase chunks
        const chunks: string[] = [];
        const words = seg.words;
        for (let i = 0; i < words.length; i += 3) {
          const chunkWords = words.slice(i, i + 3);
          const chunkDurCs = Math.max(1, Math.round((chunkWords[chunkWords.length - 1].end - chunkWords[0].start) * 100));
          chunks.push(`{\\kf${chunkDurCs}}${chunkWords.map(w => w.word).join(' ')}`);
        }
        textFormatted = `{\\b1}${chunks.join(' ')}`;
      } else if (highlightMode === 'entire-sentence') {
        textFormatted = `{\\c${assSecondary}\\b1}${textFormatted}`;
      } else {
        // 'keyword-emphasis' mode: highlight 1-2 impactful words in accent color
        const words = textFormatted.split(/\s+/);
        if (words.length > 2) {
          // Find longest or most impactful word to highlight
          let bestIdx = 1;
          let maxLen = 0;
          words.forEach((w, idx) => {
            const cleanW = w.replace(/[^\w]/g, '');
            if (cleanW.length > maxLen) {
              maxLen = cleanW.length;
              bestIdx = idx;
            }
          });
          words[bestIdx] = `{\\c${assSecondary}\\b1}${words[bestIdx]}{\\c${assPrimary}\\b0}`;
          textFormatted = words.join(' ');
        }
      }

      // Template-specific signature treatments
      if (template === 'news-lower-third' || template === 'news-broadcast') {
        textFormatted = `{\\an2\\b1\\c&H0000FF&}[BREAKING] {\\c${assPrimary}\\b1}${textFormatted}`;
      } else if (template === 'typewriter') {
        textFormatted = `{\\fnCourier New\\b1}${textFormatted}_`;
      } else if (template === 'neon-glow' || template === 'neon-captions') {
        textFormatted = `{\\blur7\\b1\\c${assPrimary}}${textFormatted}{\\blur0}`;
      } else if (template === 'hinglish-caption') {
        textFormatted = `{\\fnNoto Sans Devanagari\\fs${Math.round(s.fontSize * 1.08)}}${textFormatted}`;
      } else if (template === 'chapter-caption') {
        textFormatted = `{\\fs${Math.round(s.fontSize * 1.35)}\\c${assSecondary}\\b1}CHAPTER\\N{\\fs${s.fontSize}\\c${assPrimary}\\b0}${textFormatted}`;
      } else if (template === 'cinematic-two-line' || template === 'split-captions') {
        textFormatted = `{\\an2\\q2}${textFormatted}`;
      } else if (template === 'centered-impact') {
        textFormatted = `{\\an5\\fs${Math.round(s.fontSize * 1.15)}\\b1}${textFormatted}`;
      } else if (template === 'yellow-box-highlight') {
        textFormatted = `{\\c&H000000&\\3c&H00D7FF&\\b1}${textFormatted}`;
      }

      // Balance long lines (> 32 characters or > 6 words) into 2 lines for 9:16 safe framing if not already split
      if (targetWidth < targetHeight && !textFormatted.includes('\\N') && !textFormatted.includes('\\kf')) {
        const rawWords = textFormatted.split(' ');
        if (rawWords.length >= 7 || textFormatted.length > 34) {
          const mid = Math.ceil(rawWords.length / 2);
          textFormatted = rawWords.slice(0, mid).join(' ') + '\\N' + rawWords.slice(mid).join(' ');
        }
      }

      // Escape line breaks for ASS
      const safeText = textFormatted.replace(/\r?\n/g, '\\N');
      assContent += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${safeText}\n`;
    }

    fs.writeFileSync(outputPath, assContent, 'utf-8');
  }

  /**
   * Split long transcript segments into punchy short cards (e.g. 5-7 words) for modern shorts/reels
   */
  static async autoSplitSegments(projectId: string, maxWordsPerSegment = 6): Promise<any> {
    const project = await getQuery<any>('SELECT * FROM caption_projects WHERE id = ?', [projectId]);
    if (!project || !project.transcript_json) throw new Error('Transcript not found');

    const transcript = JSON.parse(project.transcript_json);
    const newSegments: TranscriptSegment[] = [];
    let nextId = 1;

    for (const seg of transcript.segments) {
      if (!seg.words || seg.words.length <= maxWordsPerSegment) {
        newSegments.push({ ...seg, id: nextId++ });
        continue;
      }

      for (let i = 0; i < seg.words.length; i += maxWordsPerSegment) {
        const slice = seg.words.slice(i, i + maxWordsPerSegment);
        const chunkStart = slice[0].start;
        const chunkEnd = slice[slice.length - 1].end;
        const chunkText = slice.map((w: any) => w.word).join(' ').trim();

        newSegments.push({
          id: nextId++,
          start: chunkStart,
          end: chunkEnd,
          text: chunkText,
          words: slice,
          speaker: seg.speaker,
          confidence: seg.confidence
        });
      }
    }

    transcript.segments = newSegments;
    await runQuery('UPDATE caption_projects SET transcript_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      JSON.stringify(transcript), projectId
    ]);
    return transcript;
  }

  /**
   * Export final captioned video in 1080p or 4K with NVENC hardware acceleration and optional BGM
   */
  static async exportVideo(projectId: string, options: any): Promise<string> {
    const project = await getQuery<any>('SELECT * FROM caption_projects WHERE id = ?', [projectId]);
    if (!project) throw new Error('Project not found');

    const transcript = project.transcript_json ? JSON.parse(project.transcript_json) : null;
    const segments: TranscriptSegment[] = transcript?.segments || [];
    const videoSettings = project.video_settings ? JSON.parse(project.video_settings) : {};

    const aspectRatio = options.aspect_ratio || videoSettings.aspect_ratio || '16:9';
    const resolution = options.resolution || videoSettings.resolution || '1080p';
    const burnCaptions = options.burn_captions !== false;

    // Calculate dimensions based on aspect ratio and resolution
    let targetWidth = 1920;
    let targetHeight = 1080;

    if (resolution === '4K') {
      if (aspectRatio === '9:16') {
        targetWidth = 2160;
        targetHeight = 3840;
      } else if (aspectRatio === '1:1') {
        targetWidth = 2160;
        targetHeight = 2160;
      } else if (aspectRatio === '4:5') {
        targetWidth = 2160;
        targetHeight = 2700;
      } else { // 16:9
        targetWidth = 3840;
        targetHeight = 2160;
      }
    } else if (resolution === '720p') {
      if (aspectRatio === '9:16') {
        targetWidth = 720;
        targetHeight = 1280;
      } else if (aspectRatio === '1:1') {
        targetWidth = 720;
        targetHeight = 720;
      } else if (aspectRatio === '4:5') {
        targetWidth = 720;
        targetHeight = 900;
      } else { // 16:9
        targetWidth = 1280;
        targetHeight = 720;
      }
    } else { // 1080p (default)
      if (aspectRatio === '9:16') {
        targetWidth = 1080;
        targetHeight = 1920;
      } else if (aspectRatio === '1:1') {
        targetWidth = 1080;
        targetHeight = 1080;
      } else if (aspectRatio === '4:5') {
        targetWidth = 1080;
        targetHeight = 1350;
      } else { // 16:9
        targetWidth = 1920;
        targetHeight = 1080;
      }
    }

    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputFilename = `caption_${projectId}_${resolution}_${aspectRatio.replace(':', 'x')}_${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    await runQuery('UPDATE caption_projects SET status = ?, progress = 10 WHERE id = ?', ['exporting', projectId]);
    this.broadcast({ projectId, status: 'exporting', progress: 10 });

    const inputVideoPath = path.join(process.cwd(), project.video_path);
    const customStyle = project.custom_style ? JSON.parse(project.custom_style) : {};

    // Generate resolution-scaled ASS file
    const tempAssPath = path.join(process.cwd(), 'storage', 'captions', `${projectId}_render_${Date.now()}.ass`);
    this.generateAss(segments, project.caption_template, customStyle, targetWidth, targetHeight, tempAssPath);

    // Audio mixing configuration
    const bgmTrack = options.bgm_track || videoSettings.bgm_track;
    const bgmVol = options.bgm_volume !== undefined ? parseFloat(options.bgm_volume) : (videoSettings.bgm_volume !== undefined ? parseFloat(videoSettings.bgm_volume) : 0.15);
    const origVol = options.original_volume !== undefined ? parseFloat(options.original_volume) : (videoSettings.original_volume !== undefined ? parseFloat(videoSettings.original_volume) : 1.0);

    let hasBgm = false;
    let bgmFilePath = '';
    if (bgmTrack && bgmTrack !== 'none') {
      const candidate = path.join(process.cwd(), 'public', 'audio', 'bgm', `${bgmTrack}.wav`);
      if (fs.existsSync(candidate)) {
        hasBgm = true;
        bgmFilePath = candidate;
      }
    }

    // Build FFmpeg video filters with Lanczos scaling and subtle sharpening
    const filterParts: string[] = [
      `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease:flags=lanczos`,
      `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`,
      `unsharp=5:5:0.4:5:5:0.0`
    ];

    if (burnCaptions && fs.existsSync(tempAssPath)) {
      const escapedAss = tempAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      filterParts.push(`subtitles='${escapedAss}'`);
    }

    const vfString = filterParts.join(',');

    // Execute render with NVENC first, fall back to libx264 if needed
    const executeFfmpeg = (useNvenc: boolean): Promise<void> => {
      return new Promise((resolve, reject) => {
        const args: string[] = ['-y'];

        // Trim start
        if (videoSettings.trim_start && videoSettings.trim_start > 0) {
          args.push('-ss', videoSettings.trim_start.toString());
        }

        // Input 0: Video
        args.push('-i', inputVideoPath);

        // Input 1: Optional looped BGM
        if (hasBgm) {
          args.push('-stream_loop', '-1', '-i', bgmFilePath);
        }

        // Trim end
        if (videoSettings.trim_end && videoSettings.trim_end > 0) {
          args.push('-to', videoSettings.trim_end.toString());
        }

        // Filter graph
        if (hasBgm) {
          args.push(
            '-filter_complex',
            `[0:v]${vfString}[vout];[0:a]volume=${origVol}[a0];[1:a]volume=${bgmVol}[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
            '-map', '[vout]',
            '-map', '[aout]'
          );
        } else {
          args.push('-vf', vfString);
        }

        // Video codec selection: High-bitrate studio quality
        if (useNvenc) {
          args.push('-c:v', 'h264_nvenc', '-preset', 'p6', '-cq', '16', '-b:v', '12M', '-pix_fmt', 'yuv420p');
        } else {
          args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-tune', 'film', '-pix_fmt', 'yuv420p');
        }

        // Audio codec & container optimization
        args.push('-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', outputPath);

        const p = spawn('ffmpeg', args);
        let stderr = '';

        p.stderr.on('data', (d) => {
          stderr += d.toString();
          this.broadcast({ projectId, status: 'exporting', progress: 50 });
        });

        p.on('close', (code) => {
          if (code === 0 && fs.existsSync(outputPath)) {
            resolve();
          } else {
            reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-300)}`));
          }
        });

        p.on('error', reject);
      });
    };

    try {
      try {
        await executeFfmpeg(true); // Attempt NVENC hardware acceleration
      } catch (nvencErr: any) {
        console.warn(`NVENC acceleration failed, falling back to CPU libx264:`, nvencErr.message);
        await executeFfmpeg(false); // Fallback to CPU libx264
      }

      try { fs.unlinkSync(tempAssPath); } catch (e) { }

      const relOutput = path.join('output', outputFilename);
      await runQuery(
        'UPDATE caption_projects SET status = ?, progress = 100, exported_video = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['completed', relOutput, projectId]
      );
      this.broadcast({ projectId, status: 'completed', progress: 100, videoUrl: `/${relOutput.replace(/\\/g, '/')}` });
      return relOutput;
    } catch (err: any) {
      try { fs.unlinkSync(tempAssPath); } catch (e) { }
      await runQuery('UPDATE caption_projects SET status = ?, error_message = ? WHERE id = ?', ['failed', err.message, projectId]);
      throw err;
    }
  }
}
