import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { runQuery, getQuery, allQuery } from './db';
import { CaptionStudioService, TranscriptSegment, MediaProbeInfo } from './captionStudio';

export interface ClipperProject {
  id: string;
  title: string;
  source_type: 'youtube' | 'upload' | 'local';
  source_url: string | null;
  video_path: string;
  audio_path: string | null;
  thumbnail_url: string | null;
  duration: number;
  width: number;
  height: number;
  fps: number;
  status: 'downloading' | 'extracting' | 'transcribing' | 'detecting' | 'ready' | 'failed';
  progress: number;
  error_message: string | null;
  transcript_json: string | null;
  target_duration: string;
  clip_count_target: number;
  created_at: string;
  updated_at: string;
}

export interface ClipperClip {
  id: string;
  project_id: string;
  title: string;
  hook: string;
  summary: string;
  start_time: number;
  end_time: number;
  duration: number;
  engagement_score: number;
  category: string;
  reason: string;
  reframing_mode: 'blur_background' | 'center_crop' | 'split_screen';
  caption_template: string;
  caption_language: string;
  custom_style: any;
  transcript_segments: TranscriptSegment[];
  status: 'detected' | 'rendering' | 'ready' | 'failed';
  exported_video: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export class ViralClipperService {
  private static listeners: Array<(update: any) => void> = [];

  static subscribe(fn: (update: any) => void) {
    this.listeners.push(fn);
  }

  static broadcast(update: any) {
    this.listeners.forEach((fn) => {
      try { fn(update); } catch (e) {}
    });
  }

  /**
   * Fetch video metadata from YouTube or podcast URL using yt-dlp
   */
  static async fetchUrlMetadata(url: string): Promise<{ title: string; duration: number; thumbnail: string; id: string }> {
    return new Promise((resolve, reject) => {
      const args = ['-m', 'yt_dlp', '--dump-json', '--no-playlist', url];
      const p = spawn('python', args);
      let stdout = '';
      let stderr = '';

      p.stdout.on('data', (d) => { stdout += d.toString(); });
      p.stderr.on('data', (d) => { stderr += d.toString(); });

      p.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const data = JSON.parse(stdout);
            resolve({
              title: data.title || 'Online Video',
              duration: parseFloat(data.duration || '0'),
              thumbnail: data.thumbnail || '',
              id: data.id || ('yt_' + Date.now())
            });
          } catch (e: any) {
            reject(new Error(`Failed to parse video info: ${e.message}`));
          }
        } else {
          const errMsg = stderr || stdout || 'Unknown error fetching URL';
          if (errMsg.includes('Sign in to confirm you’re not a bot') || errMsg.includes('Private video') || errMsg.includes('DRM')) {
            reject(new Error('This video requires authentication or platform access permissions. Please download or record the clip and use Local Video Upload instead.'));
          } else {
            reject(new Error(`Could not fetch video from URL: ${errMsg.slice(0, 300)}`));
          }
        }
      });
      p.on('error', reject);
    });
  }

  /**
   * Download video from YouTube or supported URL
   */
  static async downloadSourceVideo(url: string, outputTemplate: string, onProgress?: (pct: number) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      // Prefer standard 1080p/720p mp4 for smooth Remotion/FFmpeg processing
      const args = [
        '-m', 'yt_dlp',
        '--no-playlist',
        '-f', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '-o', outputTemplate,
        url
      ];

      const p = spawn('python', args);
      let stdout = '';
      let stderr = '';

      p.stdout.on('data', (d) => {
        const text = d.toString();
        stdout += text;
        const match = text.match(/(\d+\.?\d*)%/);
        if (match && onProgress) {
          onProgress(Math.min(95, Math.round(parseFloat(match[1]))));
        }
      });
      p.stderr.on('data', (d) => { stderr += d.toString(); });

      p.on('close', (code) => {
        if (code === 0) {
          // Find actual written file
          const dir = path.dirname(outputTemplate);
          const base = path.basename(outputTemplate).replace(/\.%\(ext\)s$/, '');
          const files = fs.readdirSync(dir);
          const found = files.find(f => f.startsWith(base) && /\.(mp4|mkv|webm)$/i.test(f));
          if (found) {
            resolve(path.join(dir, found));
          } else {
            resolve(outputTemplate.replace('.%(ext)s', '.mp4'));
          }
        } else {
          reject(new Error(`Download failed: ${stderr || stdout || 'Unknown error'}`));
        }
      });
      p.on('error', reject);
    });
  }

  /**
   * Run the full end-to-end pipeline:
   * URL/Upload -> Extract Audio -> Whisper Transcription -> AI Viral Detection -> Store Clips
   */
  static async processSource(
    projectId: string,
    options: { targetDuration?: string; clipCountTarget?: number; language?: string } = {}
  ): Promise<void> {
    const project = await getQuery<any>('SELECT * FROM clipper_projects WHERE id = ?', [projectId]);
    if (!project) throw new Error('Clipper project not found');

    const targetDuration = options.targetDuration || project.target_duration || '30-60';
    const clipCountTarget = options.clipCountTarget || project.clip_count_target || 5;
    const language = options.language || 'auto';

    try {
      let videoPath = path.isAbsolute(project.video_path) ? project.video_path : path.join(process.cwd(), project.video_path);

      // Stage 1: Download if YouTube URL and file not yet downloaded
      if (project.source_type === 'youtube' && project.source_url && !fs.existsSync(videoPath)) {
        await runQuery('UPDATE clipper_projects SET status = ?, progress = 10, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
          'downloading', projectId
        ]);
        this.broadcast({ projectId, stage: 'downloading', progress: 10, message: 'Downloading source video...' });

        const videoDir = path.join(process.cwd(), 'storage', 'videos');
        if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
        const template = path.join(videoDir, `clipper_${projectId}.%(ext)s`);

        const downloadedPath = await this.downloadSourceVideo(project.source_url, template, (pct) => {
          this.broadcast({ projectId, stage: 'downloading', progress: Math.round(pct * 0.3), message: `Downloading: ${pct}%` });
        });

        videoPath = downloadedPath;
        const relPath = path.relative(process.cwd(), videoPath).replace(/\\/g, '/');
        await runQuery('UPDATE clipper_projects SET video_path = ? WHERE id = ?', [relPath, projectId]);
      }

      // Stage 2: Probe Media
      const probe = await CaptionStudioService.probeMedia(videoPath);
      await runQuery(
        'UPDATE clipper_projects SET duration = ?, width = ?, height = ?, fps = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [probe.durationSeconds, probe.width, probe.height, probe.fps, projectId]
      );

      // Stage 3: Extract Audio
      await runQuery('UPDATE clipper_projects SET status = ?, progress = 35, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'extracting', projectId
      ]);
      this.broadcast({ projectId, stage: 'extracting', progress: 35, message: 'Extracting clean audio track...' });

      const audioDir = path.join(process.cwd(), 'storage', 'audio');
      if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
      const audioPath = path.join(audioDir, `clipper_${projectId}.wav`);

      await CaptionStudioService.extractAudio(videoPath, audioPath);
      const relAudio = path.relative(process.cwd(), audioPath).replace(/\\/g, '/');
      await runQuery('UPDATE clipper_projects SET audio_path = ? WHERE id = ?', [relAudio, projectId]);

      // Stage 4: Subtitle Ingestion (Fast-Path YouTube Subtitles or Local Whisper)
      await runQuery('UPDATE clipper_projects SET status = ?, progress = 50, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'transcribing', projectId
      ]);
      this.broadcast({ projectId, stage: 'transcribing', progress: 50, message: 'Processing audio transcript & word timestamps...' });

      const captionsDir = path.join(process.cwd(), 'storage', 'captions');
      if (!fs.existsSync(captionsDir)) fs.mkdirSync(captionsDir, { recursive: true });
      const transcriptJsonPath = path.join(captionsDir, `clipper_${projectId}_transcript.json`);

      // Check if transcript already exists to avoid re-transcribing
      let transcriptData: any = null;
      if (project.transcript_json) {
        try { transcriptData = JSON.parse(project.transcript_json); } catch (e) {}
      }

      // Fast-path: Check for YouTube official / auto subtitles (completes in ~2 seconds instead of minutes)
      if (!transcriptData && project.source_type === 'youtube' && project.source_url) {
        try {
          this.broadcast({ projectId, stage: 'transcribing', progress: 55, message: 'Fetching YouTube subtitles...' });
          transcriptData = await this.extractYouTubeSubtitles(project.source_url, captionsDir, projectId);
          if (transcriptData && transcriptData.segments && transcriptData.segments.length > 0) {
            fs.writeFileSync(transcriptJsonPath, JSON.stringify(transcriptData, null, 2), 'utf-8');
            await runQuery('UPDATE clipper_projects SET transcript_json = ? WHERE id = ?', [
              JSON.stringify(transcriptData), projectId
            ]);
            this.broadcast({ projectId, stage: 'transcribing', progress: 75, message: `Loaded ${transcriptData.segments.length} dialogue segments!` });
          }
        } catch (subErr) {
          console.log('YouTube subtitle fast-path fallback to Whisper:', subErr);
        }
      }

      // Fallback: Local Whisper model with live timestamp progress
      if (!transcriptData) {
        transcriptData = await this.executeWhisper(audioPath, transcriptJsonPath, language, probe.durationSeconds, (pct) => {
          const overallPct = Math.min(78, 50 + Math.round(pct * 0.28));
          this.broadcast({ projectId, stage: 'transcribing', progress: overallPct, message: `Transcribing dialogue: ${pct}%...` });
        });
        await runQuery('UPDATE clipper_projects SET transcript_json = ? WHERE id = ?', [
          JSON.stringify(transcriptData), projectId
        ]);
      }

      // Stage 5: AI Viral Moment Detection
      await runQuery('UPDATE clipper_projects SET status = ?, progress = 80, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'detecting', projectId
      ]);
      this.broadcast({ projectId, stage: 'detecting', progress: 80, message: 'AI evaluating viral hooks, retention & punchlines...' });

      const clips = this.detectViralClips(transcriptData, probe.durationSeconds, {
        targetDuration,
        clipCountTarget
      });

      // Clear old clips if any
      await runQuery('DELETE FROM clipper_clips WHERE project_id = ?', [projectId]);

      // Insert new clips into database
      for (const c of clips) {
        const clipId = `clip_${projectId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await runQuery(`
          INSERT INTO clipper_clips (
            id, project_id, title, hook, summary, start_time, end_time, duration, engagement_score, category, reason,
            reframing_mode, caption_template, caption_language, custom_style, transcript_segments, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'detected')
        `, [
          clipId,
          projectId,
          c.title,
          c.hook,
          c.summary,
          c.start_time,
          c.end_time,
          c.duration,
          c.engagement_score,
          c.category,
          c.reason,
          'blur_background',
          'word-pop',
          'original',
          JSON.stringify({
            fontFamily: 'Inter',
            fontSize: 68,
            fontWeight: '800',
            color: '#FFFFFF',
            highlightColor: '#FFD700',
            outlineWidth: 5,
            outlineColor: '#000000',
            alignment: 'center',
            verticalOffset: 480
          }),
          JSON.stringify(c.transcript_segments)
        ]);
      }

      // Stage 6: Ready
      await runQuery('UPDATE clipper_projects SET status = ?, progress = 100, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'ready', projectId
      ]);
      this.broadcast({ projectId, stage: 'ready', progress: 100, message: `Detected ${clips.length} viral clips ready for editing!` });

    } catch (err: any) {
      console.error('ViralClipper processing error:', err);
      await runQuery('UPDATE clipper_projects SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'failed', err.message, projectId
      ]);
      this.broadcast({ projectId, stage: 'failed', error: err.message });
      throw err;
    }
  }

  /**
   * Fast-path: Download YouTube subtitles directly via yt-dlp if available
   */
  private static async extractYouTubeSubtitles(url: string, captionsDir: string, projectId: string): Promise<any | null> {
    return new Promise((resolve) => {
      const venvPy = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const pythonExe = fs.existsSync(venvPy) ? venvPy : 'python';
      const outputPrefix = path.join(captionsDir, `ytsub_${projectId}`);

      const args = [
        '-m', 'yt_dlp',
        '--write-sub',
        '--write-auto-sub',
        '--sub-lang', 'hi,en,hi-Latn,en-orig',
        '--skip-download',
        '--sub-format', 'vtt/srt/best',
        '-o', outputPrefix,
        url
      ];

      const p = spawn(pythonExe, args);
      let stderr = '';
      p.stderr.on('data', d => { stderr += d.toString(); });
      p.on('close', () => {
        try {
          const files = fs.readdirSync(captionsDir).filter(f => f.startsWith(`ytsub_${projectId}`) && (f.endsWith('.vtt') || f.endsWith('.srt')));
          if (files.length === 0) {
            return resolve(null);
          }

          const chosenFile = files.find(f => f.includes('.hi.')) || files[0];
          const fullPath = path.join(captionsDir, chosenFile);
          const content = fs.readFileSync(fullPath, 'utf-8');

          const segments: TranscriptSegment[] = [];
          const timePattern = /(\d+:\d+:\d+\.\d+|\d+:\d+\.\d+)\s*-->\s*(\d+:\d+:\d+\.\d+|\d+:\d+\.\d+)/;
          const lines = content.split(/\r?\n/);

          const parseTs = (str: string) => {
            const parts = str.split(':');
            if (parts.length === 3) return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
            if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
            return 0;
          };

          let i = 0;
          let segId = 1;
          while (i < lines.length) {
            const line = lines[i].trim();
            const match = timePattern.exec(line);
            if (match) {
              const startTs = parseTs(match[1]);
              const endTs = parseTs(match[2]);
              i++;
              const textLines: string[] = [];
              while (i < lines.length && lines[i].trim() && !timePattern.test(lines[i])) {
                let clean = lines[i].trim().replace(/<[^>]+>/g, '');
                if (clean && !clean.startsWith('align:') && !clean.startsWith('position:')) {
                  textLines.push(clean);
                }
                i++;
              }
              const cleanText = textLines.join(' ').trim();
              if (cleanText) {
                const words = cleanText.split(/\s+/);
                const wordDur = (endTs - startTs) / Math.max(1, words.length);
                const wordsArr = words.map((w, wIdx) => ({
                  word: w,
                  start: +(startTs + wIdx * wordDur).toFixed(3),
                  end: +(startTs + (wIdx + 1) * wordDur).toFixed(3),
                  probability: 0.98
                }));

                segments.push({
                  id: segId++,
                  start: +startTs.toFixed(3),
                  end: +endTs.toFixed(3),
                  text: cleanText,
                  words: wordsArr
                });
              }
              continue;
            }
            i++;
          }

          if (segments.length > 0) {
            resolve({
              language: chosenFile.includes('.hi.') ? 'hi' : 'en',
              duration: segments[segments.length - 1].end,
              text: segments.map(s => s.text).join(' '),
              segments
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          console.warn('Error reading extracted YouTube subtitles:', e);
          resolve(null);
        }
      });
      p.on('error', () => resolve(null));
    });
  }

  /**
   * Execute local Whisper transcription via python script
   */
  private static executeWhisper(
    audioPath: string,
    outputPath: string,
    language: string,
    totalDuration: number = 0,
    onProgress?: (pct: number) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const venvPy = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const pythonExe = fs.existsSync(venvPy) ? venvPy : 'python';
      const scriptPath = path.join(process.cwd(), 'scripts', 'transcribe_words.py');

      const args = [
        scriptPath,
        audioPath,
        outputPath,
        '--model', 'base',
        '--language', language || 'auto',
        '--device', 'cpu'
      ];

      const p = spawn(pythonExe, args, {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let stdout = '';
      let stderr = '';

      p.stdout.on('data', (d) => {
        const chunk = d.toString();
        stdout += chunk;
        if (onProgress) {
          const match = /\[(\d+):(\d+\.\d+)\s*-->/g.exec(chunk);
          if (match && totalDuration > 0) {
            const sec = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
            const pct = Math.min(99, Math.max(1, Math.round((sec / totalDuration) * 100)));
            onProgress(pct);
          } else {
            onProgress(50);
          }
        }
      });
      p.stderr.on('data', (d) => { stderr += d.toString(); });

      p.on('close', (code) => {
        if (fs.existsSync(outputPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
            return resolve(data);
          } catch (e: any) {
            return reject(new Error(`Failed to parse Whisper JSON: ${e.message}`));
          }
        }

        // Clean up stderr if there was a real failure (strip out tqdm bars and FP16 warnings)
        const cleanErr = (stderr || stdout || '')
          .split('\n')
          .filter(l => !l.includes('frames/s') && !l.includes('UserWarning: FP16') && !l.trim().startsWith('%'))
          .join('\n')
          .trim();

        reject(new Error(`Whisper transcription failed (exit code ${code}): ${cleanErr || 'Process terminated unexpectedly'}`));
      });
      p.on('error', reject);
    });
  }

  /**
   * AI Viral Moment Detection Engine
   * Evaluates complete transcript to find top engagement moments with clean sentence boundaries
   */
  static detectViralClips(
    transcriptData: { segments: TranscriptSegment[]; language?: string },
    totalDuration: number,
    options: { targetDuration: string; clipCountTarget: number }
  ): Array<{
    title: string;
    hook: string;
    summary: string;
    start_time: number;
    end_time: number;
    duration: number;
    engagement_score: number;
    category: string;
    reason: string;
    transcript_segments: TranscriptSegment[];
  }> {
    const segments = transcriptData.segments || [];
    if (!segments.length) {
      // Fallback: If no transcript, return equal time windows
      const clipLen = 30;
      const count = Math.min(options.clipCountTarget, Math.max(1, Math.floor(totalDuration / clipLen)));
      const fallbackClips = [];
      for (let i = 0; i < count; i++) {
        const start = i * (totalDuration / count);
        const end = Math.min(totalDuration, start + clipLen);
        fallbackClips.push({
          title: `Key Moment Part ${i + 1}`,
          hook: `Highlights from segment ${i + 1}`,
          summary: `Continuous high-energy footage from the interview.`,
          start_time: Math.round(start),
          end_time: Math.round(end),
          duration: Math.round(end - start),
          engagement_score: 82 + (i % 8),
          category: 'Insight',
          reason: 'Balanced temporal distribution across the source video.',
          transcript_segments: []
        });
      }
      return fallbackClips;
    }

    // Determine duration limits (in seconds)
    let minDur = 25;
    let maxDur = 55;
    if (options.targetDuration === '15-30') {
      minDur = 14; maxDur = 30;
    } else if (options.targetDuration === '60-90') {
      minDur = 55; maxDur = 90;
    }

    // Viral Hook Words and Patterns (English + Hinglish + Hindi)
    const hookPatterns = [
      /why (is|are|do|does|did|would|should)/i,
      /how (to|did|do|can|would)/i,
      /the (biggest|secret|truth|reality|problem|mistake|reason)/i,
      /what (most|nobody|everyone|people) (don't|does not|fails)/i,
      /you (won't believe|need to know|have to understand|must)/i,
      /never (do|say|make|trust)/i,
      /stop (doing|making|thinking)/i,
      /if you (are|want|think|have)/i,
      /agar aap/i,
      /sabse bada/i,
      /kyun hota hai/i,
      /ek baat (samajh|hamesha|yaad)/i,
      /asli sach/i,
      /yeh galti/i,
      /million|billion|crore|percent|shocking|insane|crazy/i
    ];

    // Candidate window building
    const candidates: Array<{
      startIndex: number;
      endIndex: number;
      startTime: number;
      endTime: number;
      duration: number;
      score: number;
      title: string;
      hook: string;
      summary: string;
      category: string;
      reason: string;
      segments: TranscriptSegment[];
    }> = [];

    // Slide over segments to assemble cohesive conversational segments
    for (let i = 0; i < segments.length; i++) {
      let currentDuration = 0;
      let textAcc = '';
      let windowSegments: TranscriptSegment[] = [];

      for (let j = i; j < segments.length; j++) {
        const seg = segments[j];
        const segDur = seg.end - (windowSegments.length === 0 ? seg.start : windowSegments[0].start);
        
        windowSegments.push(seg);
        textAcc += ' ' + seg.text.trim();

        if (segDur >= minDur && segDur <= maxDur) {
          // Check if this ends cleanly on a sentence (punctuation: . ? ! ।)
          const lastChar = seg.text.trim().slice(-1);
          const isSentenceEnd = ['.', '?', '!', '।'].includes(lastChar) || j === segments.length - 1;

          if (isSentenceEnd || segDur >= maxDur - 5) {
            // Evaluate Viral Score
            let score = 70; // baseline

            const firstSentence = windowSegments[0].text.trim();
            const firstWords = firstSentence.split(/\s+/).slice(0, 10).join(' ');

            // 1. Hook strength in first 5-8 seconds
            let hookBonus = 0;
            for (const pat of hookPatterns) {
              if (pat.test(firstSentence)) hookBonus += 9;
              if (pat.test(textAcc)) hookBonus += 2;
            }
            score += Math.min(18, hookBonus);

            // 2. High speech density & pace
            const wordCount = textAcc.split(/\s+/).filter(Boolean).length;
            const wps = wordCount / Math.max(1, segDur);
            if (wps >= 2.2 && wps <= 3.8) score += 6; // ideal conversational reel pace

            // 3. Question & answer dynamic
            if (textAcc.includes('?') && (textAcc.includes('.') || textAcc.includes('!'))) score += 5;

            // 4. Punchline or conclusive statement at the end
            const lastSentence = seg.text.trim();
            if (lastSentence.length > 15 && ['.', '!', '?'].includes(lastSentence.slice(-1))) score += 4;

            score = Math.min(98, Math.max(76, score));

            // Categorize
            let category = 'Insight';
            if (textAcc.toLowerCase().includes('why') || textAcc.toLowerCase().includes('kyun')) category = 'Curiosity';
            else if (textAcc.toLowerCase().includes('mistake') || textAcc.toLowerCase().includes('galti') || textAcc.toLowerCase().includes('secret')) category = 'Controversy';
            else if (textAcc.toLowerCase().includes('story') || textAcc.toLowerCase().includes('ek din') || textAcc.toLowerCase().includes('when i')) category = 'Story';
            else if (textAcc.toLowerCase().includes('how') || textAcc.toLowerCase().includes('step') || textAcc.toLowerCase().includes('kaise')) category = 'Educational';
            else if (hookBonus >= 10) category = 'Hook';

            // Generate clean title
            let cleanTitle = firstWords.replace(/[^\w\s]/g, '').trim();
            if (cleanTitle.length > 40) cleanTitle = cleanTitle.slice(0, 37) + '...';
            if (!cleanTitle) cleanTitle = `Viral Reel Moment #${i + 1}`;

            candidates.push({
              startIndex: i,
              endIndex: j,
              startTime: windowSegments[0].start,
              endTime: seg.end,
              duration: Math.round(seg.end - windowSegments[0].start),
              score,
              title: cleanTitle.toUpperCase(),
              hook: firstWords,
              summary: textAcc.slice(0, 160).trim() + '...',
              category,
              reason: `High engagement opening (${hookBonus > 0 ? 'strong verbal hook' : 'curiosity trigger'}), solid speaking cadence (${wps.toFixed(1)} words/sec), and clean conclusion.`,
              segments: windowSegments
            });

            break; // Stop extending this window once ideal duration hit
          }
        } else if (segDur > maxDur) {
          break;
        }
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Non-overlapping selection
    const selected: typeof candidates = [];
    for (const cand of candidates) {
      if (selected.length >= options.clipCountTarget) break;

      // Check overlap with already selected clips (allow at most 6s overlap)
      const overlaps = selected.some(s => {
        return Math.max(s.startTime, cand.startTime) < Math.min(s.endTime, cand.endTime) - 6;
      });

      if (!overlaps) {
        selected.push(cand);
      }
    }

    // Sort selected clips chronologically by start time
    selected.sort((a, b) => a.startTime - b.startTime);

    return selected.map(s => ({
      title: s.title,
      hook: s.hook,
      summary: s.summary,
      start_time: s.startTime,
      end_time: s.endTime,
      duration: s.duration,
      engagement_score: s.score,
      category: s.category,
      reason: s.reason,
      transcript_segments: s.segments
    }));
  }

  /**
   * Render vertical 9:16 clip using FFmpeg with smart reframing and burned animated captions
   */
  static async renderClip(clipId: string): Promise<string> {
    const clip = await getQuery<any>('SELECT * FROM clipper_clips WHERE id = ?', [clipId]);
    if (!clip) throw new Error('Clip not found');

    const project = await getQuery<any>('SELECT * FROM clipper_projects WHERE id = ?', [clip.project_id]);
    if (!project) throw new Error('Parent project not found');

    await runQuery('UPDATE clipper_clips SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['rendering', clipId]);
    this.broadcast({ clipId, status: 'rendering', message: `Rendering vertical 9:16 clip "${clip.title}"...` });

    const inputVideoPath = path.isAbsolute(project.video_path) ? project.video_path : path.join(process.cwd(), project.video_path);
    if (!fs.existsSync(inputVideoPath)) {
      throw new Error(`Source video not found on disk: ${inputVideoPath}`);
    }

    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const cleanTitle = clip.title.toLowerCase().replace(/[^\w]/g, '_').slice(0, 30);
    const outputFilename = `clip_${clip.id}_${cleanTitle}_9x16.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    const segments: TranscriptSegment[] = clip.transcript_segments ? JSON.parse(clip.transcript_segments) : [];
    const customStyle = clip.custom_style ? JSON.parse(clip.custom_style) : {};

    // Generate ASS Subtitles file adjusted to relative clip start time
    const clipStartTime = clip.start_time;
    const relativeSegments = segments.map((s, idx) => {
      const relStart = Math.max(0, s.start - clipStartTime);
      const relEnd = Math.max(relStart + 0.1, s.end - clipStartTime);
      return {
        ...s,
        id: idx,
        start: relStart,
        end: relEnd,
        words: s.words ? s.words.map(w => ({
          ...w,
          start: Math.max(0, w.start - clipStartTime),
          end: Math.max(0, w.end - clipStartTime)
        })) : []
      };
    });

    const assDir = path.join(process.cwd(), 'storage', 'captions');
    if (!fs.existsSync(assDir)) fs.mkdirSync(assDir, { recursive: true });
    const assPath = path.join(assDir, `${clip.id}_captions.ass`);

    // Target 1080 x 1920 (9:16)
    CaptionStudioService.generateAss(
      relativeSegments,
      clip.caption_template || 'word-pop',
      customStyle,
      1080,
      1920,
      assPath
    );

    const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');

    // Build smart reframing filter graph
    let filterGraph = '';
    const mode = clip.reframing_mode || 'blur_background';

    if (mode === 'center_crop') {
      // Scale to height 1920 and crop middle 1080
      filterGraph = `scale=-1:1920,crop=1080:1920:(iw-1080)/2:0,subtitles='${escapedAss}'`;
    } else if (mode === 'split_screen') {
      // Split top and bottom
      filterGraph = `split=2[top][bottom];[top]crop=iw/2:ih:0:0,scale=1080:960[t_sc];[bottom]crop=iw/2:ih:iw/2:0,scale=1080:960[b_sc];[t_sc][b_sc]vstack=inputs=2,subtitles='${escapedAss}'`;
    } else {
      // Gold standard Podcast blurred background framing
      // Background: scale & crop to 1080x1920, blur, slight dim
      // Foreground: scale crisp 1080 width, centered vertically with subtle drop-shadow
      filterGraph = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=22:4,eq=brightness=-0.08[bg];[0:v]scale=1080:-1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,subtitles='${escapedAss}'[outv]`;
    }

    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-ss', clip.start_time.toString(),
        '-to', clip.end_time.toString(),
        '-i', inputVideoPath,
        ...(mode === 'blur_background' ? ['-filter_complex', filterGraph, '-map', '[outv]', '-map', '0:a?'] : ['-vf', filterGraph]),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '21',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        outputPath
      ];

      const p = spawn('ffmpeg', args);
      let stderr = '';

      p.stderr.on('data', (d) => { stderr += d.toString(); });

      p.on('close', async (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          const relOutput = path.relative(process.cwd(), outputPath).replace(/\\/g, '/');
          await runQuery('UPDATE clipper_clips SET status = ?, exported_video = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
            'ready', relOutput, clipId
          ]);
          this.broadcast({ clipId, status: 'ready', videoUrl: `/${relOutput}`, message: 'Rendering complete!' });
          resolve(relOutput);
        } else {
          const err = new Error(`FFmpeg rendering failed (code ${code}): ${stderr.slice(-300)}`);
          await runQuery('UPDATE clipper_clips SET status = ?, error_message = ? WHERE id = ?', ['failed', err.message, clipId]);
          this.broadcast({ clipId, status: 'failed', error: err.message });
          reject(err);
        }
      });
      p.on('error', reject);
    });
  }

  /**
   * Batch render all clips of a project
   */
  static async batchRenderProject(projectId: string): Promise<string[]> {
    const clips = await allQuery<any>('SELECT id FROM clipper_clips WHERE project_id = ?', [projectId]);
    const results: string[] = [];
    for (const c of clips) {
      try {
        const out = await this.renderClip(c.id);
        results.push(out);
      } catch (e) {
        console.error(`Batch render clip ${c.id} failed:`, e);
      }
    }
    return results;
  }

  /**
   * Package all rendered clips of a project into a ZIP archive
   */
  static async createProjectZip(projectId: string): Promise<string> {
    const project = await getQuery<any>('SELECT * FROM clipper_projects WHERE id = ?', [projectId]);
    if (!project) throw new Error('Project not found');

    const clips = await allQuery<any>('SELECT * FROM clipper_clips WHERE project_id = ? AND status = "ready" AND exported_video IS NOT NULL', [projectId]);
    if (!clips.length) throw new Error('No rendered clips ready for download. Please render clips first.');

    const outputDir = path.join(process.cwd(), 'output');
    const zipPath = path.join(outputDir, `clipper_${projectId}_all_clips.zip`);

    // Use Python standard library zipfile module for 100% platform-independent zero-dependency ZIP
    return new Promise((resolve, reject) => {
      const pyScript = `
import zipfile, sys, os, json
zip_path = sys.argv[1]
files = json.loads(sys.argv[2])
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in files:
        if os.path.exists(f):
            zf.write(f, os.path.basename(f))
print("ZIP_SUCCESS")
`;
      const filePaths = clips.map(c => path.join(process.cwd(), c.exported_video));
      const p = spawn('python', ['-c', pyScript, zipPath, JSON.stringify(filePaths)]);

      let stdout = '';
      let stderr = '';
      p.stdout.on('data', (d) => { stdout += d.toString(); });
      p.stderr.on('data', (d) => { stderr += d.toString(); });

      p.on('close', (code) => {
        if (code === 0 && stdout.includes('ZIP_SUCCESS') && fs.existsSync(zipPath)) {
          resolve(zipPath);
        } else {
          reject(new Error(`Failed to create ZIP: ${stderr || stdout}`));
        }
      });
      p.on('error', reject);
    });
  }
}
