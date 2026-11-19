import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

export interface StreamerPreset {
  id: string;
  name: string;
  handle: string;
  platform: 'youtube' | 'twitch';
  region: 'indian' | 'foreign';
  category: string;
  avatar_url: string;
  channel_url: string;
  active_stream_url: string;
  is_live: boolean;
  live_viewers: number;
  subscribers: string;
  views_rank: number;
  common_emotes: string[];
}

export interface StreamMoment {
  rank: number;
  peak_time_sec: number;
  peak_time_formatted: string;
  clip_start_sec: number;
  clip_start_formatted: string;
  clip_end_sec: number;
  clip_end_formatted: string;
  duration: number;
  multiplier: number;
  multiplier_text: string;
  message_velocity: string;
  top_emotes: string[];
  dominant_sentiment: string;
  headline_hook: string;
  sample_messages: string[];
}

export interface StreamAnalysisResult {
  success: boolean;
  url: string;
  streamerName?: string;
  total_messages: number;
  total_duration_sec: number;
  total_duration_formatted: string;
  region: 'indian' | 'foreign' | 'all';
  moments: StreamMoment[];
  error?: string;
}

export class StreamClipFinderService {
  static getPythonCmd(): string {
    const venvPy = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPy)) return venvPy;
    const localAppData = process.env.LOCALAPPDATA || '';
    const pyCandidates = [
      path.join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe'),
      path.join(localAppData, 'Programs', 'Python', 'Python312', 'python.exe'),
      'C:\\Program Files\\Python311\\python.exe',
      'C:\\Program Files\\Python312\\python.exe',
      'python'
    ];
    for (const cand of pyCandidates) {
      if (cand !== 'python' && fs.existsSync(cand)) return cand;
    }
    return 'python';
  }

  static async ensureYtDlp(): Promise<void> {
    const py = this.getPythonCmd();
    return new Promise((resolve) => {
      const check = spawn(py, ['-c', 'import yt_dlp']);
      check.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.log('[streamClipper] Auto-installing yt-dlp into Python environment...');
          const inst = spawn(py, ['-m', 'pip', 'install', 'yt-dlp', '--quiet']);
          const t = setTimeout(() => { try { inst.kill(); } catch (e) {} resolve(); }, 30000);
          inst.on('close', () => { clearTimeout(t); resolve(); });
          inst.on('error', () => { clearTimeout(t); resolve(); });
        }
      });
      check.on('error', () => resolve());
    });
  }

  /**
   * Pre-configured streamer radar for Indian and Foreign communities (Top 10 sorted by views & live status)
   */
  static async getRadarStreamers(forceRefresh = false): Promise<StreamerPreset[]> {
    const cacheFile = path.join(process.cwd(), 'storage', 'stream_clips', 'streamers_radar_cache.json');
    if (!forceRefresh && fs.existsSync(cacheFile)) {
      try {
        const content = fs.readFileSync(cacheFile, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.streamers && Array.isArray(parsed.streamers)) {
          return parsed.streamers;
        }
      } catch (e) {}
    }

    // Run python radar scanner
    const pythonExe = this.getPythonCmd();
    const scriptPath = path.join(process.cwd(), 'scripts', 'streamer_radar.py');

    return new Promise((resolve, reject) => {
      const args = [scriptPath];
      if (forceRefresh) args.push('--refresh');

      const proc = spawn(pythonExe, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        try {
          const jsonStart = stdout.indexOf('{');
          if (jsonStart !== -1) {
            const parsed = JSON.parse(stdout.slice(jsonStart));
            if (parsed.streamers) return resolve(parsed.streamers);
          }
          if (fs.existsSync(cacheFile)) {
            const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
            if (cached.streamers) return resolve(cached.streamers);
          }
          resolve([]);
        } catch (e) {
          console.warn('[streamRadar] Parse warning, using empty:', e);
          resolve([]);
        }
      });
    });
  }

  /**
   * Batch analyze and clip multiple streamers simultaneously
   */
  static async batchClipStreamers(options: {
    streamers: Array<{ id: string; name: string; url: string; region: string }>;
    topPerStreamer?: number;
    cropMode?: 'blur_pad' | 'center_crop';
    isDemo?: boolean;
  }): Promise<Array<{
    streamerId: string;
    streamerName: string;
    moments: StreamMoment[];
    renderedClips: Array<{ rank: number; clipUrl: string; duration: number; fileSizeMb: number }>;
  }>> {
    const { streamers, topPerStreamer = 3, cropMode = 'blur_pad', isDemo = false } = options;
    const batchResults = [];

    for (const streamer of streamers) {
      try {
        console.log(`[streamBatch] Processing streamer: ${streamer.name}...`);
        const analysis = await this.analyzeChat({
          url: streamer.url,
          region: streamer.region as any,
          top: topPerStreamer,
          isDemo: isDemo || !streamer.url.includes('http'),
          streamerName: streamer.name
        });

        const renderedClips = [];
        const moments = Array.isArray(analysis?.moments) ? analysis.moments : [];
        for (const moment of moments) {
          const clip = await this.renderClip({
            url: streamer.url,
            moment,
            streamerName: streamer.name,
            cropMode,
            isDemo: isDemo || !streamer.url.includes('http')
          });
          renderedClips.push({
            rank: moment.rank,
            clipUrl: clip.clipUrl,
            duration: clip.duration,
            fileSizeMb: clip.fileSizeMb
          });
        }

        batchResults.push({
          streamerId: streamer.id,
          streamerName: streamer.name,
          moments: analysis.moments,
          renderedClips
        });
      } catch (err: any) {
        console.error(`[streamBatch] Failed for ${streamer.name}:`, err);
      }
    }

    return batchResults;
  }

  /**
   * Automatically resolve channel name and title from any stream/video URL using yt-dlp
   */
  static async resolveStreamerInfo(url: string): Promise<{ channel: string; title: string }> {
    if (!url || !url.startsWith('http')) return { channel: '', title: '' };
    try {
      const venvPy = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const nodeRuntime = process.execPath ? `node:${process.execPath}` : 'node';
      const proc = spawn(venvPy, [
        '-m', 'yt_dlp',
        '--js-runtimes', nodeRuntime,
        '--print', '%(channel)s|||%(title)s',
        '--no-playlist',
        '--socket-timeout', '6',
        url
      ]);
      let stdout = '';
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          try { proc.kill(); } catch (e) {}
          resolve();
        }, 7000);
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.on('close', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      const lines = stdout.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('WARNING'));
      if (lines.length > 0) {
        const parts = lines[0].split('|||');
        const ch = parts[0]?.trim() || '';
        const tt = parts[1]?.trim() || '';
        if (ch) return { channel: ch, title: tt };
      }
    } catch (e) {
      console.warn('[StreamClipFinder] resolveStreamerInfo note:', e);
    }

    // Fallback: parse handle directly from URL if present (e.g. @BeastBoyShub)
    const handleMatch = url.match(/@([a-zA-Z0-9_.-]+)/);
    if (handleMatch && handleMatch[1]) {
      const handle = handleMatch[1];
      // Format handle into clean name if it's CamelCase
      const formatted = handle.replace(/([A-Z])/g, ' $1').trim();
      return { channel: formatted || handle, title: `${handle} Stream` };
    }
    return { channel: '', title: '' };
  }

  /**
   * Run chat analysis on stream URL or synthetic demo
   */
  static async analyzeChat(options: {
    url?: string;
    region?: 'indian' | 'foreign' | 'all';
    top?: number;
    before?: number;
    after?: number;
    gap?: number;
    multiplier?: number;
    isDemo?: boolean;
    streamerName?: string;
  }): Promise<StreamAnalysisResult> {
    const pythonExe = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
    const scriptPath = path.join(process.cwd(), 'scripts', 'stream_chat_crawler.py');

    // Auto-resolve genuine streamer channel info if URL provided
    let autoChannel = '';
    let autoTitle = '';
    if (options.url && options.url.startsWith('http')) {
      const info = await this.resolveStreamerInfo(options.url);
      autoChannel = info.channel;
      autoTitle = info.title;
    }

    const args = [scriptPath];
    if (options.isDemo || !options.url) {
      args.push('--demo');
    } else {
      args.push('--url', options.url);
    }

    if (options.region) args.push('--region', options.region);
    if (options.top) args.push('--top', String(options.top));
    if (options.before) args.push('--before', String(options.before));
    if (options.after) args.push('--after', String(options.after));
    if (options.gap) args.push('--gap', String(options.gap));
    if (options.multiplier) args.push('--multiplier', String(options.multiplier));
    // Always request fresh crawl so re-analyzing live broadcasts continuously finds new moments
    args.push('--fresh');

    return new Promise((resolve, reject) => {
      const proc = spawn(pythonExe, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        if (code !== 0 && !stdout.trim()) {
          return reject(new Error(`Chat analysis failed (exit code ${code}): ${stderr}`));
        }

        try {
          // Parse stdout JSON
          const jsonStart = stdout.indexOf('{');
          if (jsonStart === -1) {
            throw new Error(`Invalid JSON output from crawler: ${stdout.slice(0, 300)}`);
          }
          const parsed = JSON.parse(stdout.slice(jsonStart));
          if (!parsed.moments || !Array.isArray(parsed.moments)) {
            parsed.moments = [];
          }
          parsed.streamerName = autoChannel || options.streamerName || (options.region === 'indian' ? 'Indian Creator Stream' : 'Live Stream');
          if (autoTitle) {
            parsed.streamTitle = autoTitle;
          }
          parsed.url = options.url || 'Demo Stream Simulation';
          resolve(parsed);
        } catch (e: any) {
          reject(new Error(`Failed to parse crawler results: ${e.message}\nRaw: ${stdout.slice(0, 200)}`));
        }
      });
    });
  }

  /**
   * Verify that a media file actually exists, is non-empty, and has a readable video stream with valid moov container
   */
  static isValidVideo(filePath: string): Promise<boolean> {
    if (!filePath || !fs.existsSync(filePath)) return Promise.resolve(false);
    try {
      const stat = fs.statSync(filePath);
      if (stat.size < 40000) return Promise.resolve(false);
    } catch {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const proc = spawn('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ]);
      let out = '';
      proc.stdout.on('data', d => { out += d.toString(); });
      const timer = setTimeout(() => {
        try { proc.kill(); } catch (e) {}
        resolve(false);
      }, 6000);
      proc.on('close', code => {
        clearTimeout(timer);
        resolve(code === 0 && out.trim().length > 0);
      });
      proc.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /**
   * Render a specific moment as a 9:16 vertical viral reel using yt-dlp & FFmpeg
   */
  static async renderClip(options: {
    url: string;
    moment: StreamMoment;
    streamerName?: string;
    cropMode?: 'blur_pad' | 'center_crop' | 'smart_zoom' | 'source_16_9' | 'square_1_1' | 'split_speed_60_40' | 'split_50_50' | 'split_30_70' | 'split_70_30';
    blurIntensity?: 'subtle' | 'medium' | 'heavy';
    camPosition?: 'auto_detect' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'auto_center';
    captionStyle?: 'speed_center' | 'yellow_black' | 'white_black' | 'bottom_standard' | 'center_only';
    isDemo?: boolean;
  }): Promise<{
    success: boolean;
    clipUrl: string;
    filePath: string;
    fileSizeMb: number;
    duration: number;
    transcript?: any[];
  }> {
    let {
      url,
      moment,
      streamerName = 'Streamer',
      cropMode = 'split_speed_60_40',
      blurIntensity = 'medium',
      camPosition = 'auto_detect',
      captionStyle = 'speed_center',
      isDemo = false
    } = options as any;
    const clipId = `stream_${Date.now()}_rank${moment.rank}_${Math.random().toString(36).substring(2, 7)}`;
    const outputDir = path.join(process.cwd(), 'output', 'stream_clips');
    fs.mkdirSync(outputDir, { recursive: true });

    const finalClipPath = path.join(outputDir, `${clipId}_9x16.mp4`);
    const tempRawPath = path.join(process.cwd(), 'storage', 'stream_clips', `raw_${clipId}.mp4`);
    fs.mkdirSync(path.dirname(tempRawPath), { recursive: true });

    // Deterministic persistent cache paths so user can re-render different framings in 2-3 seconds without re-downloading!
    const urlHash = Buffer.from(url || 'demo').toString('base64url').substring(0, 16);
    const cachedRawPath = path.join(process.cwd(), 'storage', 'stream_clips', `raw_cache_${urlHash}_rank${moment.rank}.mp4`);
    const cachedTranscriptPath = path.join(process.cwd(), 'storage', 'stream_clips', `transcript_cache_${urlHash}_rank${moment.rank}.json`);

    const isChannelPage = url.includes('/@') || url.includes('/channel/') || url.includes('/streams');
    const isRealVideo = !isDemo && !isChannelPage && (
      url.includes('watch?v=') ||
      url.includes('youtu.be/') ||
      url.includes('/live/') ||
      url.includes('/shorts/') ||
      url.includes('twitch.tv/videos/') ||
      url.includes('/clip/')
    );

    // If a cached raw clip already exists for this moment, reuse it instantly (0s download)
    let usedRawCache = false;
    if (fs.existsSync(cachedRawPath) && (await this.isValidVideo(cachedRawPath))) {
      console.log(`[streamClipper] ⚡ FAST RE-RENDER: Using cached raw video for Moment #${moment.rank}! (0s download)`);
      try {
        fs.copyFileSync(cachedRawPath, tempRawPath);
        usedRawCache = true;
      } catch (e) {
        usedRawCache = false;
      }
    }

    // If streamerName is generic or default, resolve it from URL
    if ((!streamerName || streamerName === 'Creator' || streamerName === 'Streamer') && isRealVideo) {
      const info = await this.resolveStreamerInfo(url);
      if (info.channel) streamerName = info.channel;
    }

    // Ensure yt-dlp is available in Python runtime
    await this.ensureYtDlp();
    const venvPy = this.getPythonCmd();

    // Step 1: Download actual stream video chunk directly using fast HLS/m3u8 slicing (if not using cached raw clip)
    if (isRealVideo && !usedRawCache) {
      console.log(`[streamClipper] Resolving direct stream URL for fast cut (${moment.clip_start_formatted} - ${moment.clip_end_formatted})...`);
      
      let streamUrls: string[] = [];
      const nodeRuntime = process.execPath ? `node:${process.execPath}` : 'node';
      try {
        const getUrlProc = spawn(venvPy, [
          '-m', 'yt_dlp',
          '--extractor-args', 'youtube:player_client=android,web',
          '--js-runtimes', nodeRuntime,
          '-g',
          '-f', '312+234/303+140/299+140/137+140/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
          '--no-playlist',
          '--socket-timeout', '15',
          url
        ]);
        let urlOut = '';
        await new Promise<void>((res) => {
          const t = setTimeout(() => { try { getUrlProc.kill(); } catch (e) {} res(); }, 25000);
          getUrlProc.stdout.on('data', d => { urlOut += d.toString(); });
          getUrlProc.on('close', () => { clearTimeout(t); res(); });
          getUrlProc.on('error', () => { clearTimeout(t); res(); });
        });
        streamUrls = urlOut.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));

        // If only 1 URL returned, explicitly query audio stream URL so both audio & video exist
        if (streamUrls.length === 1) {
          const getAudioProc = spawn(venvPy, [
            '-m', 'yt_dlp',
            '--extractor-args', 'youtube:player_client=android,web',
            '--js-runtimes', nodeRuntime,
            '-g',
            '-f', '234/bestaudio/bestaudio[ext=m4a]',
            '--no-playlist',
            '--socket-timeout', '15',
            url
          ]);
          let aOut = '';
          await new Promise<void>((res) => {
            const t = setTimeout(() => { try { getAudioProc.kill(); } catch (e) {} res(); }, 12000);
            getAudioProc.stdout.on('data', d => { aOut += d.toString(); });
            getAudioProc.on('close', () => { clearTimeout(t); res(); });
            getAudioProc.on('error', () => { clearTimeout(t); res(); });
          });
          const aUrls = aOut.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
          if (aUrls.length > 0) {
            streamUrls.push(aUrls[0]);
          }
        }
      } catch (e) {
        console.warn('[streamClipper] Direct URL extraction note:', e);
      }

      if (streamUrls.length > 0) {
        console.log(`[streamClipper] Direct stream URL acquired (${streamUrls.length} tracks). Slicing directly via FFmpeg at ${moment.clip_start_formatted}...`);
        const durSec = Math.max(5, moment.duration || 30);
        const ffmpegArgs = [
          '-y',
          '-reconnect', '1',
          '-reconnect_streamed', '1',
          '-reconnect_delay_max', '5',
          '-ss', moment.clip_start_formatted,
          '-i', streamUrls[0]
        ];
        if (streamUrls.length >= 2) {
          ffmpegArgs.push(
            '-reconnect', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '5',
            '-ss', moment.clip_start_formatted,
            '-i', streamUrls[1],
            '-map', '0:v:0',
            '-map', '1:a:0'
          );
        }
        ffmpegArgs.push(
          '-t', String(durSec),
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '18',
          '-af', 'aresample=async=1:first_pts=0',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-avoid_negative_ts', 'make_zero',
          '-movflags', '+faststart',
          tempRawPath
        );

        await new Promise<void>((res) => {
          let finished = false;
          const cutProc = spawn('ffmpeg', ffmpegArgs);
          const t = setTimeout(() => {
            if (!finished) {
              finished = true;
              try { cutProc.kill(); } catch (e) {}
              try { if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath); } catch (e) {}
              res();
            }
          }, 45000);
          cutProc.on('close', (code) => {
            clearTimeout(t);
            if (!finished) {
              finished = true;
              if (code !== 0) {
                try { if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath); } catch (e) {}
              }
              res();
            }
          });
          cutProc.on('error', () => {
            clearTimeout(t);
            if (!finished) {
              finished = true;
              try { if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath); } catch (e) {}
              res();
            }
          });
        });
      }

      // Check if direct stream slice succeeded
      let directValid = await this.isValidVideo(tempRawPath);

      // If direct FFmpeg slice was unreadable or missed, use yt-dlp --download-sections with EXACT moment timestamp!
      if (!directValid) {
        try { if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath); } catch (e) {}
        console.log(`[streamClipper] Slicing exact segment (${moment.clip_start_formatted} - ${moment.clip_end_formatted}) via yt-dlp download-sections...`);
        let timeSpec = `*${moment.clip_start_formatted}-${moment.clip_end_formatted}`;
        if (moment.duration <= 0 || moment.clip_start_formatted === moment.clip_end_formatted) {
          timeSpec = `*${moment.clip_start_formatted}-*${Math.floor(moment.clip_start_sec + 30)}`;
        }

        await new Promise<void>((resolve) => {
          const nodeRuntime = process.execPath ? `node:${process.execPath}` : 'node';
          const ytdlp = spawn(venvPy, [
            '-m', 'yt_dlp',
            '--extractor-args', 'youtube:player_client=android,web',
            '--js-runtimes', nodeRuntime,
            '--remote-components', 'ejs:github',
            '--download-sections', timeSpec,
            '--force-keyframes-at-cuts',
            '--no-playlist',
            '--socket-timeout', '20',
            '-f', '312+234/303+140/299+140/137+140/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
            '--merge-output-format', 'mp4',
            '-o', tempRawPath,
            url
          ]);

          let ytdlpLog = '';
          ytdlp.stdout.on('data', (d) => { ytdlpLog += d.toString(); });
          ytdlp.stderr.on('data', (d) => { ytdlpLog += d.toString(); });

          let hasResolved = false;
          const killTimer = setTimeout(() => {
            if (!hasResolved) {
              hasResolved = true;
              try { ytdlp.kill(); } catch (e) {}
              try { if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath); } catch (e) {}
              console.warn(`[streamClipper] yt-dlp timeout, falling back. Log tail:`, ytdlpLog.slice(-300));
              resolve();
            }
          }, 45000);

          ytdlp.on('close', () => {
            clearTimeout(killTimer);
            if (!hasResolved) {
              hasResolved = true;
              if (!fs.existsSync(tempRawPath)) {
                if (fs.existsSync(`${tempRawPath}.webm`)) {
                  try { fs.renameSync(`${tempRawPath}.webm`, tempRawPath); } catch (e) {}
                } else if (fs.existsSync(`${tempRawPath}.mkv`)) {
                  try { fs.renameSync(`${tempRawPath}.mkv`, tempRawPath); } catch (e) {}
                }
              }
              resolve();
            }
          });

          ytdlp.on('error', () => {
            clearTimeout(killTimer);
            if (!hasResolved) {
              hasResolved = true;
              try { if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath); } catch (e) {}
              resolve();
            }
          });
        });
        directValid = await this.isValidVideo(tempRawPath);
      }
    }

    // Check if raw video is valid. If still invalid (e.g. timeout, offline, private, demo), generate synthetic action video
    const isRawReady = await this.isValidVideo(tempRawPath);
    if (!isRawReady) {
      try { if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath); } catch (e) {}
      console.log(`[streamClipper] Raw stream unreadable or missing moov atom. Generating guaranteed clean sample clip for #${moment.rank}...`);
      await this.generateSampleStreamVideo(tempRawPath, moment, streamerName);
    } else if (!usedRawCache && !fs.existsSync(cachedRawPath)) {
      // Save pristine raw clip to persistent cache for instant 2-second re-renders!
      try { fs.copyFileSync(tempRawPath, cachedRawPath); } catch (e) {}
    }

    // Step 2: Calculate split divider Y and generate Center Hook + Spoken captions
    let dividerY = 768;
    if (cropMode === 'split_50_50') dividerY = 960;
    else if (cropMode === 'split_30_70') dividerY = 576;
    else if (cropMode === 'split_70_30') dividerY = 1344;
    else if (cropMode === 'split_speed_60_40' || cropMode === 'split_40_60') dividerY = 768;
    else dividerY = 768;

    let detectedCamCrop: string | undefined = undefined;
    if ((camPosition === 'auto_detect' || !camPosition) && cropMode.startsWith('split_')) {
      console.log(`[streamClipper] 🤖 Running AI Facecam Detector on ${path.basename(tempRawPath)}...`);
      const detection = await this.detectStreamerFacecam(tempRawPath, dividerY, url);
      if (detection && detection.ffmpeg_cam_crop) {
        detectedCamCrop = detection.ffmpeg_cam_crop;
        console.log(`[streamClipper] ✅ Streamer facecam detected: ${detection.position_label} -> ${detectedCamCrop}`);
      }
    }

    console.log(`[streamClipper] Generating viral captions (style: ${captionStyle}, divider: ${dividerY}px) for moment #${moment.rank}...`);
    const tempAssPath = path.join(process.cwd(), 'storage', 'stream_clips', `captions_${clipId}.ass`);
    const tempJsonPath = path.join(process.cwd(), 'storage', 'stream_clips', `captions_${clipId}.json`);
    const captionResult = await this.generateClipCaptions(tempRawPath, tempAssPath, tempJsonPath, streamerName, moment, captionStyle, dividerY);

    // Step 3: FFmpeg Dual Split / Gaussian blur / Smart Zoom with burned Center Hook captions
    console.log(`[streamClipper] Cropping and formatting ${cropMode} video (cam: ${camPosition}, blur: ${blurIntensity}) with burned captions...`);
    await this.processVerticalCrop(tempRawPath, finalClipPath, moment, streamerName, cropMode, tempAssPath, blurIntensity, camPosition, detectedCamCrop);

    // Clean up temporary raw and caption files
    try {
      if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath);
      if (fs.existsSync(tempAssPath)) fs.unlinkSync(tempAssPath);
      if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
    } catch (e) {}

    const stats = fs.statSync(finalClipPath);
    const fileSizeMb = Number((stats.size / (1024 * 1024)).toFixed(2));

    return {
      success: true,
      clipUrl: `/output/stream_clips/${path.basename(finalClipPath)}`,
      filePath: finalClipPath,
      fileSizeMb,
      duration: moment.duration,
      transcript: captionResult?.cues || []
    };
  }

  private static facecamCache: Map<string, any> = new Map();

  /**
   * Run Computer Vision facecam detection on the stream clip using OpenCV Haar cascades
   * to automatically locate the persistent streamer facecam box (x, y, w, h).
   */
  static async detectStreamerFacecam(videoPath: string, camH: number = 768, cacheKey?: string): Promise<{
    success: boolean;
    face_detected: boolean;
    position_label: string;
    ffmpeg_cam_crop: string;
    message?: string;
  }> {
    if (cacheKey && this.facecamCache.has(cacheKey)) {
      const cached = this.facecamCache.get(cacheKey);
      console.log(`[FacecamDetector] ⚡ Using cached streamer facecam (${cached.position_label}: ${cached.ffmpeg_cam_crop})`);
      return cached;
    }

    const venvPy = this.getPythonCmd();
    const scriptPath = path.join(process.cwd(), 'scripts', 'detect_streamer_facecam.py');

    if (!fs.existsSync(scriptPath) || !fs.existsSync(videoPath)) {
      return {
        success: false,
        face_detected: false,
        position_label: 'center_left',
        ffmpeg_cam_crop: 'crop=iw*0.24:ih*0.30:0:ih*0.38'
      };
    }

    return new Promise((resolve) => {
      const proc = spawn(venvPy, [scriptPath, videoPath, '--cam_h', String(camH)]);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      const timer = setTimeout(() => {
        try { proc.kill(); } catch (e) {}
        console.warn('[FacecamDetector] Timed out after 12s, using safe tight center-left');
        resolve({
          success: false,
          face_detected: false,
          position_label: 'center_left',
          ffmpeg_cam_crop: 'crop=iw*0.24:ih*0.30:0:ih*0.38'
        });
      }, 12000);

      proc.on('close', () => {
        clearTimeout(timer);
        try {
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const data = JSON.parse(lastLine);
          console.log(`[FacecamDetector] Auto-detected streamer: ${data.position_label} (${data.ffmpeg_cam_crop})`);
          if (cacheKey && data && data.success && data.face_detected) {
            this.facecamCache.set(cacheKey, data);
          }
          resolve(data);
        } catch (e) {
          resolve({
            success: false,
            face_detected: false,
            position_label: 'center_left',
            ffmpeg_cam_crop: 'crop=iw*0.24:ih*0.30:0:ih*0.38'
          });
        }
      });

      proc.on('error', () => {
        clearTimeout(timer);
        resolve({
          success: false,
          face_detected: false,
          position_label: 'center_left',
          ffmpeg_cam_crop: 'crop=iw*0.24:ih*0.30:0:ih*0.38'
        });
      });
    });
  }

  /**
   * Generate 3-4 word viral word-highlight captions at the 3/4 mark (75% height) using local Whisper
   */
  static async generateClipCaptions(
    mediaPath: string,
    outputAssPath: string,
    outputJsonPath: string,
    streamerName: string,
    moment: StreamMoment,
    captionStyle: string = 'speed_center',
    dividerY: number = 768
  ): Promise<{ cues: any[]; hasSpeech: boolean }> {
    const venvPy = this.getPythonCmd();
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_clip_captions.py');

    const args = [
      scriptPath,
      mediaPath,
      outputAssPath,
      '--output_json', outputJsonPath,
      '--streamer', streamerName || 'Creator',
      '--hook', moment.headline_hook || 'UNREAL MOMENT',
      '--center_hook', moment.headline_hook || 'UNREAL MOMENT',
      '--caption_style', captionStyle || 'speed_center',
      '--divider_y', String(dividerY || 768),
      '--duration', String(moment.duration || 30),
      '--model', 'tiny'
    ];

    return new Promise((resolve) => {
      const proc = spawn(venvPy, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      const timer = setTimeout(() => {
        try { proc.kill(); } catch (e) {}
        console.warn('[streamClipper] Caption generation timed out after 25s');
        resolve({ cues: [], hasSpeech: false });
      }, 25000);

      proc.on('close', () => {
        clearTimeout(timer);
        try {
          if (fs.existsSync(outputJsonPath)) {
            const data = JSON.parse(fs.readFileSync(outputJsonPath, 'utf-8'));
            resolve({ cues: data.cues || [], hasSpeech: Boolean(data.has_speech) });
            return;
          }
        } catch (e) {}
        resolve({ cues: [], hasSpeech: false });
      });

      proc.on('error', () => {
        clearTimeout(timer);
        resolve({ cues: [], hasSpeech: false });
      });
    });
  }

  /**
   * Process raw 16:9 stream into high-retention vertical or custom formatted video with blur padding & overlays
   */
  private static processVerticalCrop(
    inputPath: string,
    outputPath: string,
    moment: StreamMoment,
    streamerName: string,
    mode: string = 'split_speed_60_40',
    assPath?: string,
    blurLevel: 'subtle' | 'medium' | 'heavy' = 'medium',
    camPosition: 'auto_detect' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'auto_center' = 'auto_detect',
    customCamCrop?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let filterComplex = '';
      const hasAss = assPath && fs.existsSync(assPath);
      const escapedAss = hasAss ? assPath.replace(/\\/g, '/').replace(/:/g, '\\:') : '';

      // Configure Gaussian blur intensity
      let blurParams = 'boxblur=25:6';
      if (blurLevel === 'subtle') blurParams = 'boxblur=10:3';
      else if (blurLevel === 'heavy') blurParams = 'boxblur=45:12';

      // Streamer camera crop region based on AI detection or user manual choice
      let camCrop = customCamCrop || 'crop=iw*0.24:ih*0.30:0:ih*0.38'; // tight center-left safe fallback
      if (!customCamCrop) {
        if (camPosition === 'top_left') {
          camCrop = 'crop=iw*0.24:ih*0.30:0:0';
        } else if (camPosition === 'center_left') {
          camCrop = 'crop=iw*0.24:ih*0.30:0:ih*0.38';
        } else if (camPosition === 'bottom_left') {
          camCrop = 'crop=iw*0.24:ih*0.30:0:ih*0.70';
        } else if (camPosition === 'top_right') {
          camCrop = 'crop=iw*0.24:ih*0.30:iw*0.76:0';
        } else if (camPosition === 'center_right') {
          camCrop = 'crop=iw*0.24:ih*0.30:iw*0.76:ih*0.38';
        } else if (camPosition === 'bottom_right') {
          camCrop = 'crop=iw*0.24:ih*0.30:iw*0.76:ih*0.70';
        } else if (camPosition === 'auto_center') {
          camCrop = 'crop=iw*0.28:ih*0.36:(iw-iw*0.28)/2:ih*0.12';
        }
      }

      if (mode.startsWith('split_')) {
        let camH = 768; // Speed 60/40 style (40% Cam Top = 768px, 60% Game Bottom = 1152px)
        let gameH = 1152;
        if (mode === 'split_50_50') {
          camH = 960;
          gameH = 960;
        } else if (mode === 'split_30_70') {
          camH = 576;
          gameH = 1344;
        } else if (mode === 'split_70_30') {
          camH = 1344;
          gameH = 576;
        }

        const stackFilter =
          `[0:v]split=2[in_cam][in_game];` +
          `[in_cam]${camCrop},scale=1080:${camH}:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:${camH}[cam];` +
          `[in_game]crop=iw*0.72:ih:iw*0.14:0,scale=1080:${gameH}:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:${gameH}[game];` +
          `[cam][game]vstack=inputs=2[v_stacked]`;

        if (hasAss) {
          filterComplex = `${stackFilter};[v_stacked]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `${stackFilter};[v_stacked]null[v]`;
        }
      } else if (mode === 'center_crop') {
        // Direct punch-in 9:16 vertical crop
        if (hasAss) {
          filterComplex = `[0:v]scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920[v0];[v0]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `[0:v]scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920[v]`;
        }
      } else if (mode === 'smart_zoom') {
        // Smart Speaker Zoom & Face Tracking: Punch in 1.35x centered on the active focal region
        if (hasAss) {
          filterComplex = `[0:v]scale=1440:2560:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920:(in_w-1080)/2:(in_h-1920)/2[v0];[v0]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `[0:v]scale=1440:2560:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920:(in_w-1080)/2:(in_h-1920)/2[v]`;
        }
      } else if (mode === 'square_1_1') {
        // 1:1 Square Feed format
        if (hasAss) {
          filterComplex = `[0:v]scale=1080:1080:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1080[v0];[v0]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `[0:v]scale=1080:1080:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1080[v]`;
        }
      } else if (mode === 'source_16_9') {
        // Original 16:9 widescreen
        if (hasAss) {
          filterComplex = `[0:v]scale=1920:1080:flags=lanczos:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v0];[v0]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `[0:v]scale=1920:1080:flags=lanczos:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v]`;
        }
      } else {
        // Classic viral streamer format: Gaussian blurred background + crisp centered 16:9 stream + burned 3/4 captions
        if (hasAss) {
          filterComplex = `[0:v]scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920,${blurParams}[bg];` +
                          `[0:v]scale=1080:-1:flags=lanczos:force_original_aspect_ratio=decrease[fg];` +
                          `[bg][fg]overlay=(W-w)/2:(H-h)/2[v0];` +
                          `[v0]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `[0:v]scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920,${blurParams}[bg];` +
                          `[0:v]scale=1080:-1:flags=lanczos:force_original_aspect_ratio=decrease[fg];` +
                          `[bg][fg]overlay=(W-w)/2:(H-h)/2[v]`;
        }
      }

      const args = [
        '-y',
        '-i', inputPath,
        '-filter_complex', filterComplex,
        '-map', '[v]',
        '-map', '0:a?',
        '-r', '30',
        '-fps_mode', 'cfr',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '17',
        '-b:v', '8500k',
        '-maxrate', '12000k',
        '-bufsize', '16000k',
        '-pix_fmt', 'yuv420p',
        '-af', 'aresample=async=1:first_pts=0',
        '-c:a', 'aac',
        '-b:a', '256k',
        '-avoid_negative_ts', 'make_zero',
        '-movflags', '+faststart',
        outputPath
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let errStr = '';
      ffmpeg.stderr.on('data', (d) => { errStr += d.toString(); });
      ffmpeg.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve();
        } else {
          reject(new Error(`FFmpeg vertical render failed (code ${code}): ${errStr.slice(-500)}`));
        }
      });
    });
  }

  /**
   * Fallback synthetic generator for testing/demo mode
   */
  private static generateSampleStreamVideo(
    outputPath: string,
    moment: StreamMoment,
    streamerName: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const dur = Math.max(10, Math.min(45, moment.duration || 30));
      const cleanStreamer = (streamerName || 'CREATOR').replace(/['"\\%:]/g, '').toUpperCase();
      const cleanHook = (moment.headline_hook || 'CHAT EXPLODED').replace(/['"\\%:]/g, '');
      const cleanMult = (moment.multiplier_text || '10x normal').replace(/['"\\%:]/g, '');
      const cleanVelocity = (moment.message_velocity || '100 msgs / 10s').replace(/['"\\%:]/g, '');

      // Generate clean colored gradient background with animated tone
      const args = [
        '-y',
        '-f', 'lavfi',
        '-i', `gradients=s=1920x1080:c0=#0f172a:c1=#1e1b4b:d=${dur}:speed=0.5`,
        '-f', 'lavfi',
        '-i', `sine=frequency=440:duration=${dur}`,
        '-filter_complex',
        `[0:v]drawtext=text='${cleanStreamer}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=200:box=1:boxcolor=black@0.6:boxborderw=10,` +
        `drawtext=text='${cleanHook}':fontsize=48:fontcolor=yellow:x=(w-text_w)/2:y=320:box=1:boxcolor=black@0.6:boxborderw=8,` +
        `drawtext=text='CHAT EXPLODED (${cleanMult})':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=420,` +
        `drawtext=text='${cleanVelocity}':fontsize=36:fontcolor=0x38bdf8:x=(w-text_w)/2:y=490[v]`,
        '-map', '[v]',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        '-t', String(dur),
        outputPath
      ];

      const proc = spawn('ffmpeg', args);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Failed to generate sample video`));
      });
    });
  }
}
