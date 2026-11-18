import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { runQuery, getQuery, allQuery } from './db';
import { CaptionStudioService, TranscriptSegment, MediaProbeInfo } from './captionStudio';
import { CopyrightLicenseManager } from './copyrightService';
import { AudioPoliceService } from './audioPolice';
import { romanizeSegments, romanizeText } from './hinglishRomanizer';
import { injectViralEmojisIntoSegments, injectViralEmojisIntoText } from './viralEmojiInjector';

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
  aspect_ratio?: '9:16' | '16:9' | '1:1';
  virality_metrics?: {
    hook_score: number;
    curiosity_gap: number;
    emotional_engagement: number;
    shareability: number;
    relatability: number;
    info_density: number;
    retention_prediction: number;
    ending_impact: number;
    confidence_level: 'High' | 'Very High';
  };
  broll_config?: any;
  audio_settings?: any;
  retention_optimizations?: any;
  platform_metadata?: any;
  thumbnail_concepts?: any;
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

  private static runningProcesses = new Map<string, any[]>();

  static registerProcess(projectId: string, proc: any) {
    if (!projectId || !proc) return;
    const list = this.runningProcesses.get(projectId) || [];
    list.push(proc);
    this.runningProcesses.set(projectId, list);
    const clean = () => {
      const cur = (this.runningProcesses.get(projectId) || []).filter(p => p !== proc);
      if (cur.length) this.runningProcesses.set(projectId, cur);
      else this.runningProcesses.delete(projectId);
    };
    proc.on('close', clean);
    proc.on('error', clean);
  }

  static async cancelProject(projectId: string): Promise<boolean> {
    const list = this.runningProcesses.get(projectId) || [];
    for (const p of list) {
      try { p.kill('SIGTERM'); } catch (e) {}
      try { p.kill('SIGKILL'); } catch (e) {}
    }
    this.runningProcesses.delete(projectId);
    await runQuery("UPDATE clipper_projects SET status = 'cancelled', progress = 0, error_message = 'Pipeline paused / cancelled by user', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [projectId]);
    this.broadcast({ projectId, stage: 'cancelled', progress: 0, message: 'Pipeline paused / cancelled by user' });
    return true;
  }

  /**
   * Fetch video metadata from YouTube, podcast, or online URL using yt-dlp
   */
  static async fetchUrlMetadata(url: string): Promise<{ title: string; duration: number; thumbnail: string; id: string }> {
    // 1. Proactive detection for DRM-protected streaming services (Netflix, Prime, Hotstar, Disney+)
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('netflix.com') || lowerUrl.includes('primevideo.com') || lowerUrl.includes('hotstar.com') || lowerUrl.includes('disneyplus.com') || lowerUrl.includes('hbomax.com')) {
      throw new Error(
        'Protected Streaming Platform Detected: Netflix, Prime Video, and subscription services use Widevine DRM encryption and session authentication. Direct URL scraping is blocked by the platform. Please record or download the video clip and use the "📁 Local Video Upload" tab above to process it with 100% full quality!'
      );
    }

    return new Promise((resolve, reject) => {
      const venvPy = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const pythonExe = fs.existsSync(venvPy) ? venvPy : 'python';
      const nodeRuntime = process.execPath ? `node:${process.execPath}` : 'node';
      const args = ['-m', 'yt_dlp', '--js-runtimes', nodeRuntime, '--dump-json', '--no-playlist', url];
      const p = spawn(pythonExe, args);
      let stdout = '';
      let stderr = '';

      p.stdout.on('data', (d) => { stdout += d.toString(); });
      p.stderr.on('data', (d) => { stderr += d.toString(); });

      p.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            // Robust parsing: extract valid JSON object even if yt-dlp outputs multiple lines, trailing logs, or multiple JSON objects
            let data: any = null;
            const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            for (const line of lines) {
              if (line.startsWith('{')) {
                try {
                  const candidate = JSON.parse(line);
                  if (candidate && typeof candidate === 'object') {
                    if (candidate.title || candidate.id || candidate.url) {
                      data = candidate;
                      break;
                    }
                  }
                } catch {}
              }
            }

            if (!data) {
              // Try parsing entire stdout
              try {
                data = JSON.parse(stdout.trim());
              } catch {
                // If stdout contains multiple JSON objects separated by newlines (e.g. at line 2 col 1),
                // extract the first complete balanced JSON block
                const firstBrace = stdout.indexOf('{');
                if (firstBrace !== -1) {
                  let depth = 0;
                  let inString = false;
                  let escape = false;
                  let endIdx = -1;
                  for (let i = firstBrace; i < stdout.length; i++) {
                    const c = stdout[i];
                    if (escape) { escape = false; continue; }
                    if (c === '\\') { escape = true; continue; }
                    if (c === '"') { inString = !inString; continue; }
                    if (!inString) {
                      if (c === '{') depth++;
                      else if (c === '}') {
                        depth--;
                        if (depth === 0) {
                          endIdx = i;
                          break;
                        }
                      }
                    }
                  }
                  if (endIdx !== -1) {
                    data = JSON.parse(stdout.slice(firstBrace, endIdx + 1));
                  }
                }
              }
            }

            if (!data) {
              throw new Error('No valid JSON metadata found in video stream output');
            }

            resolve({
              title: data.title || data.fulltitle || 'Online Video',
              duration: parseFloat(data.duration || '0'),
              thumbnail: data.thumbnail || (data.thumbnails && data.thumbnails.length ? data.thumbnails[0].url : ''),
              id: data.id || ('yt_' + Date.now())
            });
          } catch (e: any) {
            reject(new Error(`Failed to parse video info: ${e.message}`));
          }
        } else {
          const errMsg = stderr || stdout || 'Unknown error fetching URL';
          if (errMsg.includes('Sign in to confirm you’re not a bot') || errMsg.includes('Private video') || errMsg.includes('DRM') || errMsg.includes('login') || errMsg.includes('netflix')) {
            reject(new Error('This video requires authentication or platform access permissions. Please download or record the clip and use the "📁 Local Video Upload" tab instead.'));
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
  static async downloadSourceVideo(url: string, outputTemplate: string, onProgress?: (pct: number) => void, projectId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const nodeRuntime = process.execPath ? `node:${process.execPath}` : 'node';
      // Prefer standard 1080p/720p mp4 for smooth Remotion/FFmpeg processing
      const args = [
        '-m', 'yt_dlp',
        '--js-runtimes', nodeRuntime,
        '--no-playlist',
        '-f', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '-o', outputTemplate,
        url
      ];

      const venvPy = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const pythonExe = fs.existsSync(venvPy) ? venvPy : 'python';
      const p = spawn(pythonExe, args);
      if (projectId) this.registerProcess(projectId, p);
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
        // Find actual written file
        const dir = path.dirname(outputTemplate);
        const base = path.basename(outputTemplate).replace(/\.%\(ext\)s$/, '');
        const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
        const found = files.find(f => f.startsWith(base) && /\.(mp4|mkv|webm)$/i.test(f));

        if (found) {
          return resolve(path.join(dir, found));
        }

        if (code === 0) {
          resolve(outputTemplate.replace('.%(ext)s', '.mp4'));
        } else {
          const cleanErr = (stderr || stdout || '')
            .split('\n')
            .filter(l => !l.trim().startsWith('WARNING:') && !l.trim().startsWith('[youtube]') && l.trim().length > 0)
            .join('\n')
            .trim();
          reject(new Error(`Download failed: ${cleanErr || 'Video download exited unexpectedly. Please retry or upload a clip directly.'}`));
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

      // Register source footage in persistent Copyright & Licensing Registry
      try {
        await CopyrightLicenseManager.registerAsset({
          assetId: `clipper_src_${projectId}`,
          projectId,
          assetType: 'video',
          sourcePlatform: project.source_type === 'youtube' ? 'youtube' : 'user_upload',
          originalUrl: project.source_url || project.video_path,
          downloadUrl: project.video_path,
          creatorName: project.title || 'Original Video Creator',
          creatorProfileUrl: project.source_url || '',
          licenseType: project.source_type === 'youtube' ? 'Standard YouTube License / Fair Use Editorial' : 'User Certified License',
          commercialUse: project.source_type !== 'youtube',
          attributionRequired: project.source_type === 'youtube',
          attributionText: `Original footage: "${project.title}" (${project.source_url || 'User Provided'})`,
          usageRestrictions: project.source_type === 'youtube' ? 'Fair Use excerpt for commentary, criticism, or news reporting.' : 'Authorized by user for video clipping.'
        });
      } catch (e: any) {
        console.warn('[ViralClipper] Asset registry note:', e?.message);
      }

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
        }, projectId);

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

      // Scan extracted audio with Audio Copyright Police
      try {
        await AudioPoliceService.registerAudio({
          assetId: `clipper_audio_${projectId}`,
          projectId,
          audioType: 'extracted',
          filePath: audioPath,
          sourcePlatform: project.source_type === 'youtube' ? 'youtube_extract' : 'user_upload',
          sourceUrl: project.source_url,
          creatorArtist: project.title || 'Original Video Audio',
          audioTitle: `Extracted Audio: ${project.title || projectId}`,
          licenseType: project.source_type === 'youtube' ? 'Standard YouTube / Third-Party Extracted' : 'User Provided Media',
          commercialUseAllowed: project.source_type !== 'youtube',
          attributionRequired: project.source_type === 'youtube',
          verifiedLicense: false
        });
      } catch (audErr: any) {
        console.warn('[ViralClipper] Audio police scan note:', audErr?.message);
      }

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
          this.broadcast({ projectId, stage: 'transcribing', progress: 55, message: `Fetching YouTube subtitles (${language || 'en'})...` });
          transcriptData = await this.extractYouTubeSubtitles(project.source_url, captionsDir, projectId, language || 'en');
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
        }, projectId);
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
            reframing_mode, caption_template, caption_language, custom_style, transcript_segments, status,
            virality_metrics, platform_metadata, thumbnail_concepts, broll_config, retention_optimizations
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'detected', ?, ?, ?, ?, ?)
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
          JSON.stringify(c.transcript_segments),
          JSON.stringify(c.virality_metrics || null),
          JSON.stringify(c.platform_metadata || null),
          JSON.stringify(c.thumbnail_concepts || null),
          JSON.stringify(c.broll_config || null),
          JSON.stringify(c.retention_optimizations || null)
        ]);
      }

      // Stage 6: Ready
      await runQuery('UPDATE clipper_projects SET status = ?, progress = 100, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'ready', projectId
      ]);
      this.broadcast({ projectId, stage: 'ready', progress: 100, message: `Detected ${clips.length} viral clips ready for editing!` });

    } catch (err: any) {
      console.error('ViralClipper processing error:', err);
      try {
        const cur = await getQuery<any>('SELECT status FROM clipper_projects WHERE id = ?', [projectId]);
        if (cur?.status === 'cancelled') {
          return;
        }
      } catch (checkErr) {}
      await runQuery('UPDATE clipper_projects SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'failed', err.message, projectId
      ]);
      this.broadcast({ projectId, stage: 'failed', error: err.message });
      throw err;
    }
  }

  /**
   * Helper: Parse VTT/SRT text content into structured segments with word-level timings
   */
  public static parseVttContent(content: string, timeFilter?: { start: number; end: number }): TranscriptSegment[] {
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
          let clean = lines[i].trim().replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
          if (clean && !clean.startsWith('align:') && !clean.startsWith('position:') && !clean.startsWith('line:')) {
            textLines.push(clean);
          }
          i++;
        }
        let cleanText = textLines.join(' ').trim();
        cleanText = cleanText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

        const isTitleCard = line.includes('line:0%') || line.includes('line:10%');
        if (cleanText && !isTitleCard) {
          // If timeFilter is specified, check boundary overlap
          if (timeFilter) {
            if (endTs <= timeFilter.start || startTs >= timeFilter.end) {
              continue;
            }
          }

          // Deduplicate identical or near-identical cues from YouTube VTT
          const lastSeg = segments[segments.length - 1];
          if (lastSeg && (
            (lastSeg.text.trim() === cleanText.trim()) ||
            (lastSeg.text.includes(cleanText) && Math.abs(lastSeg.start - startTs) < 1.0)
          )) {
            continue;
          }

          const words = cleanText.split(/\s+/).filter(Boolean);
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
    return segments;
  }

  /**
   * Retrieve segments for a specific language from disk if available
   */
  public static getProjectLanguageSegments(projectId: string, language: string, timeFilter?: { start: number; end: number }): TranscriptSegment[] | null {
    const captionsDir = path.join(process.cwd(), 'storage', 'captions');
    if (!fs.existsSync(captionsDir)) return null;

    const files = fs.readdirSync(captionsDir).filter(f => f.startsWith(`ytsub_${projectId}`) && (f.endsWith('.vtt') || f.endsWith('.srt')));
    if (files.length === 0) return null;

    let chosenFile: string | undefined;
    if (language === 'en') {
      chosenFile = files.find(f => f.includes('.en-orig.') || f.includes('.en.') || f.includes('.en-US.') || f.includes('.en-GB.')) ||
                   files.find(f => !f.includes('.hi.')) ||
                   files[0];
    } else if (language === 'hi') {
      chosenFile = files.find(f => f.includes('.hi.')) || files[0];
    } else {
      chosenFile = files.find(f => f.includes('.en-orig.') || f.includes('.en.')) || files[0];
    }

    if (!chosenFile) return null;
    const fullPath = path.join(captionsDir, chosenFile);
    if (!fs.existsSync(fullPath)) return null;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const segs = this.parseVttContent(content, timeFilter);
    return segs.length > 0 ? segs : null;
  }

  /**
   * Translate segments to English or target language using Python translator bridge
   */
  public static async translateSegments(segments: TranscriptSegment[], targetLang: 'en' | 'hi' = 'en'): Promise<TranscriptSegment[]> {
    if (!segments || segments.length === 0) return [];
    return new Promise((resolve) => {
      const venvPy = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const pythonExe = fs.existsSync(venvPy) ? venvPy : 'python';

      const script = `
import urllib.request, urllib.parse, json, sys

data = json.loads(sys.stdin.read())
target_lang = sys.argv[1] if len(sys.argv) > 1 else 'en'

def translate_text(t):
    if not t or not t.strip():
        return t
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={target_lang}&dt=t&q=" + urllib.parse.quote(t)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            return ''.join([part[0] for part in res[0] if part[0]])
    except Exception:
        return t

results = []
for seg in data:
    txt = seg.get('text', '')
    translated = translate_text(txt)
    words = translated.split()
    start_ts = seg.get('start', 0)
    end_ts = seg.get('end', 0)
    word_dur = (end_ts - start_ts) / max(1, len(words))
    words_arr = []
    for idx, w in enumerate(words):
        words_arr.append({
            'word': w,
            'start': round(start_ts + idx * word_dur, 3),
            'end': round(start_ts + (idx + 1) * word_dur, 3),
            'probability': 0.98
        })
    results.append({
        'id': seg.get('id', 0),
        'start': start_ts,
        'end': end_ts,
        'text': translated,
        'words': words_arr
    })

print(json.dumps(results))
`;
      const p = spawn(pythonExe, ['-c', script, targetLang], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      let stdout = '';
      p.stdout.on('data', d => { stdout += d.toString(); });
      p.stdin.write(JSON.stringify(segments));
      p.stdin.end();
      p.on('close', code => {
        try {
          if (code === 0 && stdout.trim()) {
            resolve(JSON.parse(stdout));
          } else {
            resolve(segments);
          }
        } catch {
          resolve(segments);
        }
      });
      p.on('error', () => resolve(segments));
    });
  }

  /**
   * Switch or translate a clip's language to English or Hindi
   */
  public static async setClipLanguage(clipId: string, language: 'en' | 'hi' | 'hinglish'): Promise<any> {
    const clip = await getQuery<any>('SELECT * FROM clipper_clips WHERE id = ?', [clipId]);
    if (!clip) throw new Error('Clip not found');

    let segments: TranscriptSegment[] = [];

    // 1. Try finding native subtitle track for project
    if (language === 'en' || language === 'hi') {
      const nativeSegs = this.getProjectLanguageSegments(clip.project_id, language, { start: clip.start_time, end: clip.end_time });
      if (nativeSegs && nativeSegs.length > 0) {
        segments = nativeSegs;
      }
    }

    // 2. If native not found, translate existing segments
    if (segments.length === 0 && clip.transcript_segments) {
      try {
        const rawSegs = JSON.parse(clip.transcript_segments);
        segments = await this.translateSegments(rawSegs, language === 'hi' ? 'hi' : 'en');
      } catch (e) {
        console.warn('Translation error in setClipLanguage:', e);
      }
    }

    if (segments.length === 0 && clip.transcript_segments) {
      segments = JSON.parse(clip.transcript_segments);
    }

    // New hook/summary
    const newHook = segments.length > 0 ? segments[0].text : clip.hook;
    const fontMap: Record<string, string> = {
      en: 'Montserrat',
      hi: 'Noto Sans Devanagari',
      hinglish: 'Poppins',
      auto: 'Montserrat'
    };
    const currentCustomStyle = clip.custom_style ? JSON.parse(clip.custom_style) : {};
    currentCustomStyle.fontFamily = fontMap[language] || 'Montserrat';

    await runQuery(`
      UPDATE clipper_clips SET
        caption_language = ?,
        hook = ?,
        transcript_segments = ?,
        custom_style = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      language,
      newHook,
      JSON.stringify(segments),
      JSON.stringify(currentCustomStyle),
      clipId
    ]);

    const updated = await getQuery<any>('SELECT * FROM clipper_clips WHERE id = ?', [clipId]);
    return {
      ...updated,
      transcript_segments: JSON.parse(updated.transcript_segments || '[]'),
      custom_style: JSON.parse(updated.custom_style || '{}'),
      virality_metrics: JSON.parse(updated.virality_metrics || '{}')
    };
  }

  /**
   * Re-align or refine a clip's captions with Whisper word timestamps for 100% exact audio sync
   */
  public static async alignClipWithWhisper(clipId: string): Promise<any> {
    const clip = await getQuery<any>('SELECT * FROM clipper_clips WHERE id = ?', [clipId]);
    if (!clip) throw new Error('Clip not found');
    const project = await getQuery<any>('SELECT * FROM clipper_projects WHERE id = ?', [clip.project_id]);
    if (!project) throw new Error('Parent project not found');

    const videoPath = path.isAbsolute(project.video_path)
      ? project.video_path
      : path.join(process.cwd(), project.video_path);

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Source video not found at ${videoPath}`);
    }

    const duration = Math.max(1, clip.end_time - clip.start_time);
    const audioDir = path.join(process.cwd(), 'storage', 'audio');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
    const sliceAudioPath = path.join(audioDir, `slice_${clipId}.wav`);
    const captionsDir = path.join(process.cwd(), 'storage', 'captions');
    if (!fs.existsSync(captionsDir)) fs.mkdirSync(captionsDir, { recursive: true });
    const sliceJsonPath = path.join(captionsDir, `slice_${clipId}_transcript.json`);

    // 1. Extract audio slice using FFmpeg
    await new Promise<void>((resolve, reject) => {
      const p = spawn('ffmpeg', [
        '-y',
        '-ss', clip.start_time.toString(),
        '-i', videoPath,
        '-t', duration.toString(),
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        sliceAudioPath
      ]);
      p.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg audio slice failed with code ${code}`)));
      p.on('error', reject);
    });

    // 2. Transcribe audio slice using Whisper with word_timestamps
    const transcript = await this.executeWhisper(
      sliceAudioPath,
      sliceJsonPath,
      clip.caption_language || project.language || 'auto',
      duration
    );

    // 3. Offset slice segments back to absolute project timestamps
    const rawSegments = transcript.segments || [];
    const absoluteSegments: TranscriptSegment[] = rawSegments.map((s: any, idx: number) => ({
      id: idx + 1,
      start: +(clip.start_time + s.start).toFixed(3),
      end: +(clip.start_time + s.end).toFixed(3),
      text: s.text.trim(),
      words: (s.words || []).map((w: any) => ({
        word: w.word.trim(),
        start: +(clip.start_time + w.start).toFixed(3),
        end: +(clip.start_time + w.end).toFixed(3),
        probability: w.probability || 0.98
      }))
    }));

    // Update clip in DB
    const newHook = absoluteSegments.length > 0 ? absoluteSegments[0].text : clip.hook;
    await runQuery(`
      UPDATE clipper_clips SET
        hook = ?,
        transcript_segments = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      newHook,
      JSON.stringify(absoluteSegments),
      clipId
    ]);

    // Cleanup slice audio file
    try { if (fs.existsSync(sliceAudioPath)) fs.unlinkSync(sliceAudioPath); } catch {}

    const updated = await getQuery<any>('SELECT * FROM clipper_clips WHERE id = ?', [clipId]);
    return {
      ...updated,
      transcript_segments: JSON.parse(updated.transcript_segments || '[]'),
      custom_style: JSON.parse(updated.custom_style || '{}'),
      virality_metrics: JSON.parse(updated.virality_metrics || '{}')
    };
  }

  /**
   * Fast-path: Download YouTube subtitles directly via yt-dlp if available
   */
  private static async extractYouTubeSubtitles(
    url: string,
    captionsDir: string,
    projectId: string,
    requestedLanguage: string = 'en'
  ): Promise<any | null> {
    return new Promise((resolve) => {
      const venvPy = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const pythonExe = fs.existsSync(venvPy) ? venvPy : 'python';
      const outputPrefix = path.join(captionsDir, `ytsub_${projectId}`);

      const nodeRuntime = process.execPath ? `node:${process.execPath}` : 'node';
      const subLangs = requestedLanguage === 'hi'
        ? 'hi,hi-orig,en,en-orig,hi-Latn,all'
        : 'en,en-orig,en-US,en-GB,hi,hi-orig,hi-Latn,all';

      const args = [
        '-m', 'yt_dlp',
        '--js-runtimes', nodeRuntime,
        '--write-sub',
        '--write-auto-sub',
        '--sub-lang', subLangs,
        '--skip-download',
        '--sub-format', 'vtt/srt/best',
        '-o', outputPrefix,
        url
      ];

      const p = spawn(pythonExe, args);
      if (projectId) this.registerProcess(projectId, p);
      let stderr = '';
      p.stderr.on('data', d => { stderr += d.toString(); });
      p.on('close', () => {
        try {
          const files = fs.readdirSync(captionsDir).filter(f => f.startsWith(`ytsub_${projectId}`) && (f.endsWith('.vtt') || f.endsWith('.srt')));
          if (files.length === 0) {
            return resolve(null);
          }

          let chosenFile: string | undefined;
          if (requestedLanguage === 'hi') {
            chosenFile = files.find(f => f.includes('.hi-orig.') || f.includes('.hi.')) || files[0];
          } else if (requestedLanguage === 'en') {
            chosenFile = files.find(f => f.includes('.en-orig.') || f.includes('.en.') || f.includes('.en-US.') || f.includes('.en-GB.')) ||
                         files.find(f => f.includes('.hi-orig.') || f.includes('.hi.')) ||
                         files[0];
          } else {
            chosenFile = files.find(f => f.includes('.en-orig.') || f.includes('.en.') || f.includes('.hi.')) || files[0];
          }

          const fullPath = path.join(captionsDir, chosenFile);
          const content = fs.readFileSync(fullPath, 'utf-8');
          const segments = this.parseVttContent(content);

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
    onProgress?: (pct: number) => void,
    projectId?: string
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
      if (projectId) this.registerProcess(projectId, p);

      let stdout = '';
      let stderr = '';
      let lastReportedPct = 10;

      p.stdout.on('data', (d) => {
        const chunk = d.toString();
        stdout += chunk;
        if (onProgress && totalDuration > 0) {
          const re = /\[(\d+):(\d+\.?\d*)\s*-->/g;
          let m: RegExpExecArray | null;
          let maxSec = 0;
          while ((m = re.exec(chunk)) !== null) {
            const sec = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
            if (sec > maxSec) maxSec = sec;
          }
          if (maxSec > 0) {
            const pct = Math.min(99, Math.max(lastReportedPct, Math.round((maxSec / totalDuration) * 100)));
            lastReportedPct = pct;
            onProgress(pct);
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
    virality_metrics?: any;
    platform_metadata?: any;
    thumbnail_concepts?: any;
    broll_config?: any;
    retention_optimizations?: any;
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
      viralityMetrics?: any;
      platformMetadata?: any;
      thumbnailConcepts?: any;
      brollConfig?: any;
      retentionOptimizations?: any;
    }> = [];

    // Slide over segments to assemble cohesive conversational segments
    for (let i = 0; i < segments.length; i++) {
      let currentDuration = 0;
      let textAcc = '';
      let windowSegments: TranscriptSegment[] = [];
      const firstSentence = segments[i]?.text.trim() || '';
      const firstWords = firstSentence.split(/\s+/).slice(0, 8).join(' ');

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
            // Evaluate Virality Scoring Engine (8-Parameter Weighted Model)
            // 1. Opening hook strength (20%)
            let hookScore = 65;
            for (const pat of hookPatterns) {
              if (pat.test(firstSentence)) hookScore += 18;
              if (pat.test(textAcc)) hookScore += 5;
            }
            hookScore = Math.min(98, Math.max(62, hookScore));

            // 2. Curiosity gap (15%)
            let curiosityGap = 70;
            if (textAcc.includes('?') || firstSentence.toLowerCase().includes('why') || firstSentence.toLowerCase().includes('secret')) curiosityGap += 22;
            else if (textAcc.toLowerCase().includes('how') || textAcc.toLowerCase().includes('what')) curiosityGap += 14;
            curiosityGap = Math.min(96, Math.max(65, curiosityGap));

            // 3. Emotional engagement (15%)
            let emotionalEngagement = 68;
            if (textAcc.match(/crazy|insane|shocking|unbelievable|love|hate|scared|danger|fear|ruined|won|lost|hero/i)) emotionalEngagement += 20;
            if (textAcc.includes('!')) emotionalEngagement += 8;
            emotionalEngagement = Math.min(97, Math.max(64, emotionalEngagement));

            // 4. Shareability (15%)
            let shareability = 66;
            if (textAcc.match(/everyone|people|you|friend|world|society|mistake|lesson|rule/i)) shareability += 20;
            shareability = Math.min(95, Math.max(60, shareability));

            // 5. Audience relatability (10%)
            let audienceRelatability = 72;
            if (textAcc.match(/money|job|life|family|daily|time|work|sleep|food|day/i)) audienceRelatability += 18;
            audienceRelatability = Math.min(96, Math.max(68, audienceRelatability));

            // 6. Information/value density (10%)
            const wordCount = textAcc.split(/\s+/).filter(Boolean).length;
            const wps = wordCount / Math.max(1, segDur);
            let informationDensity = 70;
            if (wps >= 2.2 && wps <= 3.8) informationDensity += 20;
            else if (wps > 3.8) informationDensity += 12;
            informationDensity = Math.min(98, Math.max(65, informationDensity));

            // 7. Storytelling and retention (10%)
            let storytellingRetention = 68;
            if (textAcc.match(/when|then|after|first|suddenly|happened|said|told|story|ek din/i)) storytellingRetention += 22;
            storytellingRetention = Math.min(96, Math.max(66, storytellingRetention));

            // 8. Ending impact (5%)
            const lastSentence = seg.text.trim();
            let endingImpact = 65;
            if (lastSentence.length > 15 && ['.', '!', '?'].includes(lastSentence.slice(-1))) endingImpact += 25;
            endingImpact = Math.min(95, Math.max(60, endingImpact));

            // Weighted Composite Score
            const compositeScore = Math.round(
              hookScore * 0.20 +
              curiosityGap * 0.15 +
              emotionalEngagement * 0.15 +
              shareability * 0.15 +
              audienceRelatability * 0.10 +
              informationDensity * 0.10 +
              storytellingRetention * 0.10 +
              endingImpact * 0.05
            );

            const confidenceLevel = compositeScore >= 84 ? 'Very High' : 'High';

            // Categorize
            let category = 'Insight';
            if (curiosityGap >= 85 || textAcc.toLowerCase().includes('why')) category = 'Curiosity';
            else if (emotionalEngagement >= 85 || textAcc.toLowerCase().includes('mistake') || textAcc.toLowerCase().includes('secret')) category = 'Controversy';
            else if (storytellingRetention >= 85 || textAcc.toLowerCase().includes('story')) category = 'Story';
            else if (informationDensity >= 85 || textAcc.toLowerCase().includes('how')) category = 'Educational';
            else if (hookScore >= 88) category = 'Hook';

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
              score: compositeScore,
              title: cleanTitle.toUpperCase(),
              hook: firstWords,
              summary: textAcc.slice(0, 160).trim() + '...',
              category,
              reason: `Strong hook (${hookScore}%), high curiosity gap (${curiosityGap}%), speaking pace ${wps.toFixed(1)} wps, and punchy ending.`,
              segments: windowSegments,
              viralityMetrics: {
                hook_score: hookScore,
                curiosity_gap: curiosityGap,
                emotional_engagement: emotionalEngagement,
                shareability,
                relatability: audienceRelatability,
                info_density: informationDensity,
                retention_prediction: storytellingRetention,
                ending_impact: endingImpact,
                confidence_level: confidenceLevel
              },
              platformMetadata: {
                youtube_shorts: {
                  title: `${cleanTitle.slice(0, 50)} #Shorts`,
                  description: `Full insight on ${category} from the interview.\n\n#Shorts #Viral #Podcast #Trending`,
                  hashtags: ['#Shorts', '#Viral', '#Podcast', '#Trending', '#Reels']
                },
                instagram_reels: {
                  title: `${cleanTitle.slice(0, 45)} 🔥`,
                  caption: `Did you know this? Let us know in the comments below! 👇\n\n#reels #viralvideos #podcastclips #fyp #trending`,
                  hashtags: ['#reels', '#viralvideos', '#explorepage', '#fyp', '#trending']
                },
                tiktok: {
                  title: `${cleanTitle.slice(0, 40)} 🤯`,
                  caption: `Wait till you hear the ending... 👀 #fyp #podcast #viral #foryoupage #mindblown`,
                  hashtags: ['#fyp', '#podcast', '#viral', '#foryoupage', '#mindblown']
                },
                linkedin: {
                  title: `Key Takeaway on ${category}: ${cleanTitle.slice(0, 50)}`,
                  commentary_post: `A powerful reflection from this discussion. In high-stakes environments, clear communication and retention define outcomes. What is your perspective?`,
                  hashtags: ['#Leadership', '#IndustryInsights', '#Strategy', '#Innovation']
                }
              },
              thumbnailConcepts: [
                { style: 'Curiosity Punchline', headline: firstWords.slice(0, 28).toUpperCase(), badge: 'MUST WATCH' },
                { style: 'Shocking Revelation', headline: 'NOBODY EXPECTED THIS', badge: 'SHOCKING' },
                { style: 'Mastery & Insight', headline: cleanTitle.slice(0, 26).toUpperCase(), badge: 'KEY INSIGHT' }
              ],
              brollConfig: [
                { triggerTime: 2.0, duration: 3.0, suggestedAsset: 'datacenter_tech.mp4', label: 'B-Roll Cutaway' }
              ],
              retentionOptimizations: {
                silenceTrimmingAvailable: true,
                silentGapsDetected: 0,
                loopFriendlyEndingScore: Math.round(75 + (endingImpact % 20)),
                recommendation: 'Clip opens with high energy and concludes on a decisive statement.'
              }
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
      transcript_segments: s.segments,
      virality_metrics: s.viralityMetrics,
      platform_metadata: s.platformMetadata,
      thumbnail_concepts: s.thumbnailConcepts,
      broll_config: s.brollConfig || [],
      retention_optimizations: s.retentionOptimizations
    }));
  }

  /**
   * Render vertical 9:16 clip using FFmpeg with smart reframing and burned animated captions
   */
  /**
   * Automatically detect the peak "hype" or climax window from transcript cues
   */
  static detectHypeWindow(segments: TranscriptSegment[], clipDuration: number): { start: number; end: number; reason: string } {
    const hypeKeywords = [
      'dollar', 'lakh', 'million', 'billion', 'thousand', 'hundred', 'bet', 'win', 'won', 'lost',
      'crazy', 'insane', 'unbelievable', 'shocking', 'died', 'survived', 'record', 'impossible',
      'huge', 'never', 'secret', 'truth', 'warning', 'danger', 'alert', '100', '1', '10', '50'
    ];

    let bestSegment: TranscriptSegment | null = null;
    let highestScore = -1;

    for (const seg of segments) {
      const text = seg.text.toLowerCase();
      let score = 0;
      if (text.includes('!')) score += 3;
      if (text.includes('?')) score += 1;
      if (/\d+/.test(text)) score += 4;
      for (const kw of hypeKeywords) {
        if (text.includes(kw)) score += 3;
      }
      if (score > highestScore) {
        highestScore = score;
        bestSegment = seg;
      }
    }

    if (bestSegment && highestScore > 0) {
      const segDur = Math.max(2.5, bestSegment.end - bestSegment.start);
      return {
        start: Math.max(0, bestSegment.start),
        end: Math.min(clipDuration, bestSegment.start + Math.min(4.0, segDur)),
        reason: `Hype peak: "${bestSegment.text.slice(0, 30)}..."`
      };
    }

    // Default to the dramatic climax around 65% of the clip duration
    const defaultStart = Math.max(1, clipDuration * 0.62);
    return {
      start: defaultStart,
      end: Math.min(clipDuration, defaultStart + 3.0),
      reason: 'Climax moment'
    };
  }

  /**
   * Fast face/person detector: checks whether a clip contains a single person or multiple people/crowd
   */
  static async checkIsSinglePerson(videoPath: string, startTime: number, duration: number): Promise<boolean> {
    return new Promise((resolve) => {
      const pythonExe = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const scriptPath = path.join(process.cwd(), 'scripts', 'detect_faces_in_clip.py');

      if (!fs.existsSync(pythonExe) || !fs.existsSync(scriptPath)) {
        return resolve(false); // Default to no-zoom if detector script is missing
      }

      const p = spawn(pythonExe, [scriptPath, videoPath, startTime.toString(), duration.toString()]);
      let out = '';
      p.stdout.on('data', (d) => { out += d.toString(); });
      p.on('close', () => {
        try {
          const res = JSON.parse(out);
          console.log(`[ViralClipper] Face count analysis for [${startTime}-${startTime + duration}s]: is_single=${res.is_single_person}, max_faces=${res.max_faces}, samples=${JSON.stringify(res.samples)}`);
          resolve(!!res.is_single_person);
        } catch {
          resolve(false);
        }
      });
      p.on('error', () => resolve(false));
    });
  }

  /**
   * Build smart camera tracking and zoom filter expression.
   * Strict rule: ONLY zooms during the specific hype moment IF and ONLY IF a single person is in frame.
   * Never loops or continuously zooms over crowd/multiple people.
   */
  static buildCameraZoomFilter(
    preset: string,
    intensity: number = 1.15,
    fps: number = 30,
    options: {
      isSinglePerson?: boolean;
      hypeStart?: number;
      hypeEnd?: number;
    } = {}
  ): string {
    // If not a single person (e.g. group, crowd, team), DO NOT ZOOM! Keep original wide framing.
    if (options.isSinglePerson === false) {
      console.log(`[ViralClipper] Multiple people / crowd detected in frame. Bypassing zoom to preserve full wide composition.`);
      return '';
    }

    if (!preset || preset === 'static_professional_frame' || preset === 'none') {
      return '';
    }

    const safeIntensity = Math.min(1.20, Math.max(1.06, intensity));
    const hypeS = options.hypeStart !== undefined ? options.hypeStart : 10.0;
    const hypeE = options.hypeEnd !== undefined ? options.hypeEnd : 13.5;

    // Smooth hype punch-in: 1.0x normal frame throughout, smoothly zooms in ONLY during the hype window for a single speaker
    return `zoompan=z='if(between(it,${hypeS.toFixed(2)},${hypeE.toFixed(2)}),min(zoom+0.015,${safeIntensity.toFixed(3)}),max(zoom-0.015,1.0))':d=1:x='iw/2-(iw/zoom/2)':y='(ih*0.38)-(ih/zoom*0.38)':s=1920x1080:fps=${fps}`;
  }

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

    let segments: TranscriptSegment[] = clip.transcript_segments ? JSON.parse(clip.transcript_segments) : [];
    const customStyle = clip.custom_style ? JSON.parse(clip.custom_style) : {};

    // Auto-fix: if target language is English ('en') or auto, and captions currently contain Devanagari Hindi characters,
    // automatically retrieve native English track or translate to English so rendered captions are in English!
    const rawSegmentsStr = clip.transcript_segments || '';
    const containsHindiChars = /[\u0900-\u097F]/.test(rawSegmentsStr);
    const requestedLang = clip.caption_language || 'en';

    if (requestedLang === 'en' && containsHindiChars) {
      console.log(`[ViralClipper] Clip ${clipId} has caption_language='en' but contains Hindi characters. Auto-switching to English...`);
      const nativeEn = this.getProjectLanguageSegments(clip.project_id, 'en', { start: clip.start_time, end: clip.end_time });
      if (nativeEn && nativeEn.length > 0) {
        segments = nativeEn;
        await runQuery('UPDATE clipper_clips SET caption_language = "en", transcript_segments = ? WHERE id = ?', [
          JSON.stringify(nativeEn), clipId
        ]);
      } else {
        const translated = await this.translateSegments(segments, 'en');
        if (translated && translated.length > 0) {
          segments = translated;
          await runQuery('UPDATE clipper_clips SET caption_language = "en", transcript_segments = ? WHERE id = ?', [
            JSON.stringify(translated), clipId
          ]);
        }
      }
    }

    // Deduplicate any overlapping or identical subtitle cues (cleaning legacy duplicate cues)
    const deduplicatedSegments: TranscriptSegment[] = [];
    for (const s of segments) {
      const prev = deduplicatedSegments[deduplicatedSegments.length - 1];
      if (prev) {
        if (prev.text.trim() === s.text.trim()) continue;
        if (prev.text.includes(s.text.trim()) && Math.abs(prev.start - s.start) < 1.2) continue;
        if (s.text.includes(prev.text.trim()) && Math.abs(prev.start - s.start) < 0.5) {
          // Replace previous shorter cue with full cue
          deduplicatedSegments[deduplicatedSegments.length - 1] = s;
          continue;
        }
      }
      deduplicatedSegments.push(s);
    }

    // Generate ASS Subtitles file adjusted to relative clip start time
    const clipStartTime = clip.start_time;
    const relativeSegments = deduplicatedSegments.map((s, idx) => {
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

    const aspect = clip.aspect_ratio || '9:16';
    let targetWidth = 1080;
    let targetHeight = 1920;
    if (aspect === '16:9') {
      targetWidth = 1920;
      targetHeight = 1080;
    } else if (aspect === '1:1') {
      targetWidth = 1080;
      targetHeight = 1080;
    }

    // Enrich custom style with hook title banner and watermark
    const enrichedCustomStyle = {
      ...customStyle,
      hookTitle: customStyle.showHookTitle !== false ? (customStyle.hookTitle || clip.hook) : null,
      watermarkText: customStyle.watermarkText || null
    };

    // Target dimensions for subtitles
    CaptionStudioService.generateAss(
      relativeSegments,
      clip.caption_template || 'word-pop',
      enrichedCustomStyle,
      targetWidth,
      targetHeight,
      assPath
    );

    const relAss = path.relative(process.cwd(), assPath).replace(/\\/g, '/');
    const escapedAss = relAss.replace(/:/g, '\\\\:');

    const duration = Math.max(1, clip.end_time - clip.start_time);

    // 1. Detect hype moment window from transcript keywords & punctuation
    const hypeWindow = ViralClipperService.detectHypeWindow(relativeSegments, duration);

    // 2. Run real-time computer vision face count check (Single Person vs Crowd/Multiple People)
    const isSinglePerson = await ViralClipperService.checkIsSinglePerson(inputVideoPath, clip.start_time, duration);

    // 3. Smart Camera Zoom: Zooms ONLY at the hype moment IF and ONLY IF a single person is in frame
    const cameraPreset = customStyle.cameraPreset || 'automatic_smart_zoom';
    const zoomIntensity = parseFloat(customStyle.zoomIntensity || '1.14');
    const cameraZoomFilter = ViralClipperService.buildCameraZoomFilter(cameraPreset, zoomIntensity, 30, {
      isSinglePerson,
      hypeStart: hypeWindow.start,
      hypeEnd: hypeWindow.end
    });

    // Build smart reframing filter graph
    let filterGraph = '';
    const mode = clip.reframing_mode || 'blur_background';
    const isComplex = true;

    if (aspect === '16:9') {
      const zoom169 = cameraZoomFilter ? `${cameraZoomFilter},` : '';
      filterGraph = `[0:v]${zoom169}scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,unsharp=5:5:0.5:5:5:0.0,subtitles='${escapedAss}'[outv]`;
    } else if (aspect === '1:1') {
      if (mode === 'center_crop') {
        const cropZoom = cameraZoomFilter ? `${cameraZoomFilter},scale=-1:1080:flags=lanczos` : 'scale=-1:1080:flags=lanczos';
        filterGraph = `[0:v]${cropZoom},crop=1080:1080:(iw-1080)/2:0,unsharp=5:5:0.5:5:5:0.0,subtitles='${escapedAss}'[outv]`;
      } else {
        const fgZoom = cameraZoomFilter ? `${cameraZoomFilter},scale=1080:-1:flags=lanczos,unsharp=5:5:0.6:5:5:0.0[fg]` : 'scale=1080:-1:flags=lanczos,unsharp=5:5:0.6:5:5:0.0[fg]';
        filterGraph = `[0:v]scale=1080:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1080,gblur=sigma=28:steps=2,eq=brightness=-0.14:contrast=1.06[bg];[0:v]${fgZoom};[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto,subtitles='${escapedAss}'[outv]`;
      }
    } else {
      // 9:16 Vertical Reel Formats
      if (mode === 'split_facecam') {
        // Gaming Facecam Layout: Gameplay 1140px on top, Webcam 780px on bottom with blurred backdrop
        filterGraph = `[0:v]scale=1080:1140:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1140:(iw-1080)/2:0[top];[0:v]scale=1080:780:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:780,gblur=sigma=24:steps=2,eq=brightness=-0.16[botbg];[0:v]scale=1080:780:force_original_aspect_ratio=decrease:flags=lanczos,unsharp=5:5:0.6:5:5:0.0[cam];[botbg][cam]overlay=(W-w)/2:(H-h)/2[bot];[top][bot]vstack=inputs=2[stacked];[stacked]subtitles='${escapedAss}'[outv]`;
      } else if (mode === 'split_screen') {
        // Two-Person Podcast Layout: 50% Top Speaker (960px), 50% Bottom Speaker (960px)
        filterGraph = `[0:v]crop=iw/2:ih:0:0,scale=1080:960:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:960[spk1];[0:v]crop=iw/2:ih:iw/2:0,scale=1080:960:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:960[spk2];[spk1][spk2]vstack=inputs=2[stacked];[stacked]subtitles='${escapedAss}'[outv]`;
      } else if (mode === 'center_crop') {
        const cropZoom = cameraZoomFilter ? `${cameraZoomFilter},scale=-1:1920:flags=lanczos` : 'scale=-1:1920:flags=lanczos';
        filterGraph = `[0:v]${cropZoom},crop=1080:1920:(iw-1080)/2:0,unsharp=5:5:0.5:5:5:0.0,subtitles='${escapedAss}'[outv]`;
      } else {
        // High quality single frame with Gaussian blurred background
        const fgZoom = cameraZoomFilter ? `${cameraZoomFilter},scale=1080:-1:flags=lanczos,unsharp=5:5:0.6:5:5:0.0[fg]` : 'scale=1080:-1:flags=lanczos,unsharp=5:5:0.6:5:5:0.0[fg]';
        filterGraph = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,gblur=sigma=28:steps=2,eq=brightness=-0.14:contrast=1.06[bg];[0:v]${fgZoom};[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto,subtitles='${escapedAss}'[outv]`;
      }
    }

    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-ss', clip.start_time.toString(),
        '-i', inputVideoPath,
        '-t', duration.toString(),
        '-avoid_negative_ts', 'make_zero',
        ...(isComplex ? ['-filter_complex', filterGraph, '-map', '[outv]', '-map', '0:a?'] : ['-vf', filterGraph]),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18',
        '-tune', 'film',
        '-pix_fmt', 'yuv420p',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-colorspace', 'bt709',
        '-c:a', 'aac',
        '-b:a', '320k',
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.95',
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

  /**
   * 1-Click Romanize Clip to creator-style Roman Hinglish
   */
  static async romanizeClip(clipId: string): Promise<any> {
    const clip = await getQuery<any>('SELECT * FROM clipper_clips WHERE id = ?', [clipId]);
    if (!clip) throw new Error('Clip not found');
    let segs = clip.transcript_segments;
    if (typeof segs === 'string') {
      try { segs = JSON.parse(segs); } catch (e) { segs = []; }
    }
    const romanized = romanizeSegments(segs);
    const romanHook = romanizeText(clip.hook || '');
    const romanTitle = romanizeText(clip.title || '');
    await runQuery(
      'UPDATE clipper_clips SET transcript_segments = ?, hook = ?, title = ?, caption_language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(romanized), romanHook, romanTitle, 'hi_roman', clipId]
    );
    this.broadcast({ clipId, status: 'updated', message: 'Converted to Roman Hinglish!' });
    return { success: true, segments: romanized, hook: romanHook, title: romanTitle };
  }

  /**
   * 1-Click Inject Viral Retention Emojis into Subtitles
   */
  static async injectEmojis(clipId: string): Promise<any> {
    const clip = await getQuery<any>('SELECT * FROM clipper_clips WHERE id = ?', [clipId]);
    if (!clip) throw new Error('Clip not found');
    let segs = clip.transcript_segments;
    if (typeof segs === 'string') {
      try { segs = JSON.parse(segs); } catch (e) { segs = []; }
    }
    const injected = injectViralEmojisIntoSegments(segs);
    await runQuery(
      'UPDATE clipper_clips SET transcript_segments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(injected), clipId]
    );
    this.broadcast({ clipId, status: 'updated', message: 'Injected viral emojis!' });
    return { success: true, segments: injected };
  }
}
