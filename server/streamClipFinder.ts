import path from 'path';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import crypto from 'crypto';

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
  static getFfmpegCmd(): string {
    const local = path.join(process.cwd(), 'bin', 'ffmpeg', 'ffmpeg.exe');
    if (fs.existsSync(local)) return local;
    return 'ffmpeg';
  }

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
   * Automatically resolve channel name and title from any stream/video URL using yt-dlp & fast regex mapping
   */
  static async resolveStreamerInfo(url: string): Promise<{ channel: string; title: string }> {
    if (!url || !url.startsWith('http')) return { channel: '', title: '' };

    const lower = url.toLowerCase();
    // Fast match known streamers to avoid slow process spawning and wrong defaults
    if (lower.includes('kaicenat') || lower.includes('kai_cenat')) {
      return { channel: 'Kai Cenat', title: 'Kai Cenat Live Stream' };
    }
    if (lower.includes('ishowspeed') || lower.includes('speed')) {
      return { channel: 'IShowSpeed', title: 'IShowSpeed Live Stream' };
    }
    if (lower.includes('carryislive') || lower.includes('carryminati')) {
      return { channel: 'CarryisLive', title: 'CarryisLive Stream' };
    }
    if (lower.includes('technogamerz') || lower.includes('techno_gamerz') || lower.includes('ujjwal')) {
      return { channel: 'Techno Gamerz', title: 'Techno Gamerz Stream' };
    }
    if (lower.includes('totalgaming') || lower.includes('total_gaming') || lower.includes('ajjubhai')) {
      return { channel: 'Total Gaming', title: 'Total Gaming Stream' };
    }
    if (lower.includes('samayraina') || lower.includes('samay_raina')) {
      return { channel: 'Samay Raina', title: 'Samay Raina Stream' };
    }
    if (lower.includes('beastboyshub')) {
      return { channel: 'BeastBoyShub', title: 'BeastBoyShub Stream' };
    }
    if (lower.includes('mortal')) {
      return { channel: 'Mortal', title: 'Mortal Stream' };
    }
    if (lower.includes('jonathangaming') || lower.includes('jonathan_gaming')) {
      return { channel: 'Jonathan Gaming', title: 'Jonathan Gaming Stream' };
    }
    if (lower.includes('tanmaybhat') || lower.includes('tanmay_bhat')) {
      return { channel: 'Tanmay Bhat', title: 'Tanmay Bhat Stream' };
    }
    if (lower.includes('scout')) {
      return { channel: 'Scout', title: 'Scout Stream' };
    }
    if (lower.includes('pewdiepie')) {
      return { channel: 'PewDiePie', title: 'PewDiePie Stream' };
    }
    if (lower.includes('xqc')) {
      return { channel: 'xQc', title: 'xQc Stream' };
    }
    if (lower.includes('jynxzi')) {
      return { channel: 'Jynxzi', title: 'Jynxzi Stream' };
    }
    if (lower.includes('caseoh')) {
      return { channel: 'CaseOh', title: 'CaseOh Stream' };
    }
    if (lower.includes('tarik')) {
      return { channel: 'Tarik', title: 'Tarik Stream' };
    }
    if (lower.includes('adinross') || lower.includes('adin_ross')) {
      return { channel: 'Adin Ross', title: 'Adin Ross Stream' };
    }

    // Extract Twitch username directly from URL (e.g. twitch.tv/kaicenat)
    const twitchMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
    if (twitchMatch && twitchMatch[1]) {
      const u = twitchMatch[1];
      if (u !== 'videos' && u !== 'clip' && u !== 'directory') {
        const formatted = u.charAt(0).toUpperCase() + u.slice(1);
        return { channel: formatted, title: `${formatted} Stream` };
      }
    }

    // Extract YouTube handle directly from URL (e.g. @KaiCenat)
    const handleMatch = url.match(/@([a-zA-Z0-9_.-]+)/);
    if (handleMatch && handleMatch[1]) {
      const handle = handleMatch[1];
      const formatted = handle.replace(/([A-Z])/g, ' $1').trim();
      return { channel: formatted || handle, title: `${formatted || handle} Stream` };
    }

    try {
      const venvPy = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const nodeRuntime = process.execPath ? `node:${process.execPath}` : 'node';
      const proc = spawn(venvPy, [
        '-m', 'yt_dlp',
        '--js-runtimes', nodeRuntime,
        '--no-warnings',
        '--print', '%(channel)s|||%(title)s',
        '--no-playlist',
        '--socket-timeout', '4',
        url
      ]);
      let stdout = '';
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          try { proc.kill(); } catch (e) {}
          resolve();
        }, 5000);
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.on('error', () => {
          clearTimeout(timer);
          resolve();
        });
        proc.on('close', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      const lines = stdout.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('WARNING') && !l.startsWith('ERROR'));
      if (lines.length > 0) {
        const parts = lines[0].split('|||');
        const ch = parts[0]?.trim() || '';
        const tt = parts[1]?.trim() || '';
        if (ch && ch !== 'NA') return { channel: ch, title: tt };
        if (tt && tt !== 'NA') return { channel: tt.split(' ')[0] || 'Streamer', title: tt };
      }
    } catch (e) {
      console.warn('[StreamClipFinder] resolveStreamerInfo note:', e);
    }

    return { channel: '', title: '' };
  }

  /**
   * Resolve a channel or stream URL into a direct playable/sliceable video URL
   */
  static async resolveDirectStreamVideoUrl(url: string, streamerName?: string): Promise<{ resolvedUrl: string; streamer: string }> {
    if (!url) return { resolvedUrl: '', streamer: streamerName || 'Creator' };
    const lower = url.toLowerCase();
    const info = await this.resolveStreamerInfo(url);
    const effectiveStreamer = streamerName || info.channel || 'Creator';

    // Verified stream VODs for top creators when channels or offline streams are provided
    const CREATOR_FALLBACK_STREAMS: Record<string, string> = {
      'kai cenat': 'https://www.youtube.com/watch?v=q1jR850CE_o',
      'kaicenat': 'https://www.youtube.com/watch?v=q1jR850CE_o',
      'ishowspeed': 'https://www.youtube.com/watch?v=qSyo5d-dVzA',
      'speed': 'https://www.youtube.com/watch?v=qSyo5d-dVzA',
      'techno gamerz': 'https://www.youtube.com/watch?v=0cxLxu2LeAw',
      'total gaming': 'https://www.youtube.com/watch?v=LS3lO0D4uGs',
      'carryislive': 'https://www.youtube.com/watch?v=irNhWMG560k',
      'samay raina': 'https://www.youtube.com/watch?v=o5zuI-tqdEg',
      'beastboyshub': 'https://www.youtube.com/watch?v=DjnWfCADL5I',
      'mortal': 'https://www.youtube.com/watch?v=mNJ-QdM05Ts',
      'jonathan gaming': 'https://www.youtube.com/watch?v=21E-aJKdp8o',
      'tanmay bhat': 'https://www.youtube.com/watch?v=tZdsRfdKTMs',
      'scout': 'https://www.youtube.com/watch?v=cm3HiZbquPQ',
      'pewdiepie': 'https://www.youtube.com/watch?v=cUUuRK3Rm4k'
    };

    // If it's already a direct video URL with video ID, keep it
    if (url.includes('watch?v=') || url.includes('youtu.be/') || url.includes('/videos/') || url.includes('/clip/')) {
      return { resolvedUrl: url, streamer: effectiveStreamer };
    }

    // If channel page or Twitch channel, map to the streamer's actual stream footage
    for (const [key, fallbackUrl] of Object.entries(CREATOR_FALLBACK_STREAMS)) {
      if (lower.includes(key.replace(/\s+/g, '')) || effectiveStreamer.toLowerCase() === key) {
        return { resolvedUrl: fallbackUrl, streamer: effectiveStreamer || 'Kai Cenat' };
      }
    }

    return { resolvedUrl: url, streamer: effectiveStreamer };
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

    // Run streamer info resolution and python crawler in PARALLEL for maximum speed
    const infoPromise = (options.url && options.url.startsWith('http'))
      ? this.resolveStreamerInfo(options.url).catch(() => ({ channel: '', title: '' }))
      : Promise.resolve({ channel: '', title: '' });

    const crawlerPromise = new Promise<any>((resolve, reject) => {
      const proc = spawn(pythonExe, args);
      let stdout = '';
      let stderr = '';

      const timeoutTimer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch (e) {}
        console.warn('[StreamClipFinder] Crawler exceeded 30s threshold, forcing termination.');
      }, 30000);

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('error', (err) => {
        clearTimeout(timeoutTimer);
        reject(err);
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutTimer);
        try {
          const jsonStart = stdout.indexOf('{');
          if (jsonStart !== -1) {
            const parsed = JSON.parse(stdout.slice(jsonStart));
            if (!parsed.moments || !Array.isArray(parsed.moments)) {
              parsed.moments = [];
            }
            return resolve(parsed);
          }
        } catch (e) {}

        if (code !== 0 && !stdout.trim()) {
          return reject(new Error(`Chat analysis failed (exit code ${code}): ${stderr || 'timeout or process error'}`));
        }

        reject(new Error(`Failed to parse crawler results: ${stdout.slice(0, 200)}`));
      });
    });

    const [info, crawlerData] = await Promise.all([infoPromise, crawlerPromise]);

    crawlerData.streamerName = info.channel || options.streamerName || (options.region === 'indian' ? 'Indian Creator Stream' : 'Live Stream');
    if (info.title) {
      crawlerData.streamTitle = info.title;
    }
    crawlerData.url = options.url || 'Demo Stream Simulation';
    return crawlerData;
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
    rawClipUrl?: string;
    filePath: string;
    fileSizeMb: number;
    duration: number;
    detectedCamPosition?: string;
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

    // Resolve direct stream video URL (e.g. mapping Kai Cenat / Twitch / YouTube channels to active stream video)
    const resolved = await this.resolveDirectStreamVideoUrl(url, streamerName);
    const targetUrl = resolved.resolvedUrl || url;
    if (resolved.streamer && (!streamerName || streamerName === 'Creator' || streamerName === 'Streamer')) {
      streamerName = resolved.streamer;
    }

    // Deterministic persistent cache paths with UNIQUE SHA-256 hash per URL (prevents cache collisions across streamers!)
    const cleanUrlKey = (targetUrl || url || 'demo').trim().toLowerCase();
    const urlHash = crypto.createHash('sha256').update(cleanUrlKey).digest('hex').substring(0, 16);
    const cachedRawPath = path.join(process.cwd(), 'storage', 'stream_clips', `raw_cache_${urlHash}_rank${moment.rank}.mp4`);
    const cachedTranscriptPath = path.join(process.cwd(), 'storage', 'stream_clips', `transcript_cache_${urlHash}_rank${moment.rank}.json`);

    const isChannelPage = targetUrl.includes('/@') || targetUrl.includes('/channel/');
    const isRealVideo = !isDemo && !isChannelPage && (
      targetUrl.includes('watch?v=') ||
      targetUrl.includes('youtu.be/') ||
      targetUrl.includes('/live/') ||
      targetUrl.includes('/shorts/') ||
      targetUrl.includes('twitch.tv/videos/') ||
      targetUrl.includes('/clip/') ||
      targetUrl.includes('twitch.tv/')
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

    // Step 1: Download actual stream video chunk directly using fast HLS/m3u8 slicing (if not using cached raw clip)
    if (isRealVideo && !usedRawCache) {
      await this.ensureYtDlp();
      const venvPy = this.getPythonCmd();
      console.log(`[streamClipper] Resolving direct stream URL for fast cut (${moment.clip_start_formatted} - ${moment.clip_end_formatted})...`);
      
      let streamUrls: string[] = [];
      const nodeRuntime = process.execPath ? `node:${process.execPath}` : 'node';
      try {
        const ffmpegCmd = this.getFfmpegCmd();
        const getUrlArgs = [
          '-m', 'yt_dlp',
          '--extractor-args', 'youtube:player_client=android,web'
        ];
        if (path.isAbsolute(ffmpegCmd) && fs.existsSync(ffmpegCmd)) {
          getUrlArgs.push('--ffmpeg-location', path.dirname(ffmpegCmd));
        }
        getUrlArgs.push(
          '--js-runtimes', nodeRuntime,
          '-g',
          '-f', 'best[vcodec^=avc][height<=1080]/best[height<=1080]/bestvideo[height<=1080]+bestaudio/best',
          '--no-playlist',
          '--socket-timeout', '15',
          targetUrl
        );
        const getUrlProc = spawn(venvPy, getUrlArgs);
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
            targetUrl
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
          const cutProc = spawn(this.getFfmpegCmd(), ffmpegArgs);
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
          const ffmpegExe = this.getFfmpegCmd();
          const ytdlpArgs = [
            '-m', 'yt_dlp',
            '--extractor-args', 'youtube:player_client=android,web'
          ];
          if (path.isAbsolute(ffmpegExe) && fs.existsSync(ffmpegExe)) {
            ytdlpArgs.push('--ffmpeg-location', path.dirname(ffmpegExe));
          }
          ytdlpArgs.push(
            '--js-runtimes', nodeRuntime,
            '--remote-components', 'ejs:github',
            '--download-sections', timeSpec,
            '--force-keyframes-at-cuts',
            '--no-playlist',
            '--socket-timeout', '25',
            '-f', 'best[vcodec^=avc][height<=1080]+bestaudio[ext=m4a]/best[height<=1080]/bestvideo[height<=1080]+bestaudio/best',
            '--merge-output-format', 'mp4',
            '-o', tempRawPath,
            targetUrl
          );
          const ytdlp = spawn(venvPy, ytdlpArgs);

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
      if (!fs.existsSync(cachedRawPath)) {
        try { fs.copyFileSync(tempRawPath, cachedRawPath); } catch (e) {}
      }
    } else if (!usedRawCache && !fs.existsSync(cachedRawPath)) {
      // Save pristine raw clip to persistent cache for instant 2-second re-renders!
      try { fs.copyFileSync(tempRawPath, cachedRawPath); } catch (e) {}
    }

    // Step 2: Calculate exact on-screen hook Y-position per framing mode and generate Center Hook + Spoken captions
    let dividerY = 768;
    if (cropMode === 'split_50_50') dividerY = 960;
    else if (cropMode === 'split_30_70') dividerY = 576;
    else if (cropMode === 'split_70_30') dividerY = 1344;
    else if (cropMode === 'split_speed_60_40' || cropMode === 'split_40_60') dividerY = 768;
    else if (cropMode === 'blur_pad') dividerY = 360;
    else if (cropMode === 'center_crop' || cropMode === 'smart_zoom') dividerY = 320;
    else if (cropMode === 'square_1_1' || cropMode === 'source_16_9') dividerY = 170;
    else dividerY = 768;

    let detectedCamCrop: string | undefined = undefined;
    let detectedCamPositionLabel: string = camPosition;
    const customCamRect = (options as any).customCamRect;
    const needAutoFacecam = !(customCamRect && typeof customCamRect.w === 'number' && customCamRect.w > 0.03 && customCamRect.h > 0.03)
      && (camPosition === 'auto_detect' || !camPosition)
      && cropMode.startsWith('split_');

    if (customCamRect && typeof customCamRect.w === 'number' && customCamRect.w > 0.03 && customCamRect.h > 0.03) {
      const rx = Math.max(0, Math.min(0.95, customCamRect.x)).toFixed(4);
      const ry = Math.max(0, Math.min(0.95, customCamRect.y)).toFixed(4);
      const rw = Math.max(0.05, Math.min(1 - Number(rx), customCamRect.w)).toFixed(4);
      const rh = Math.max(0.05, Math.min(1 - Number(ry), customCamRect.h)).toFixed(4);
      detectedCamCrop = `crop=iw*${rw}:ih*${rh}:iw*${rx}:ih*${ry}`;
      detectedCamPositionLabel = 'custom_rect';
      console.log(`[streamClipper] 🎯 Using user-drawn custom facecam rectangle: ${detectedCamCrop}`);
    }

    console.log(`[streamClipper] Generating captions${needAutoFacecam ? ' + detecting facecam in parallel' : ''} for moment #${moment.rank}...`);
    const tempAssPath = path.join(process.cwd(), 'storage', 'stream_clips', `captions_${clipId}.ass`);
    const tempJsonPath = path.join(process.cwd(), 'storage', 'stream_clips', `captions_${clipId}.json`);
    const hideTitle = Boolean((options as any).hideTitle) || (typeof moment.headline_hook === 'string' && moment.headline_hook.trim() === '');
    const hideSubtitles = Boolean((options as any).hideSubtitles);

    const [detection, captionResult] = await Promise.all([
      needAutoFacecam
        ? this.detectStreamerFacecam(tempRawPath, dividerY, `${streamerName}_${cleanUrlKey}`)
        : Promise.resolve(null),
      this.generateClipCaptions(tempRawPath, tempAssPath, tempJsonPath, streamerName, moment, captionStyle, dividerY, cachedTranscriptPath, hideTitle, hideSubtitles)
    ]);

    if (detection && detection.ffmpeg_cam_crop) {
      detectedCamCrop = detection.ffmpeg_cam_crop;
      detectedCamPositionLabel = detection.position_label || 'bottom_left';
      console.log(`[streamClipper] ✅ Streamer facecam detected: ${detection.position_label} -> ${detectedCamCrop}`);
    }

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

    const hasCachedRaw = fs.existsSync(cachedRawPath);
    const rawClipUrl = hasCachedRaw
      ? `/storage/stream_clips/${path.basename(cachedRawPath)}`
      : `/output/stream_clips/${path.basename(finalClipPath)}`;

    return {
      success: true,
      clipUrl: `/output/stream_clips/${path.basename(finalClipPath)}`,
      rawClipUrl,
      filePath: finalClipPath,
      fileSizeMb,
      duration: moment.duration,
      detectedCamPosition: detectedCamPositionLabel,
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
        position_label: 'bottom_left',
        ffmpeg_cam_crop: 'crop=iw*0.25:ih*0.32:0:ih*0.68'
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
        console.warn('[FacecamDetector] Timed out after 12s, using safe bottom-left corner');
        resolve({
          success: false,
          face_detected: false,
          position_label: 'bottom_left',
          ffmpeg_cam_crop: 'crop=iw*0.25:ih*0.32:0:ih*0.68'
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
            position_label: 'bottom_left',
            ffmpeg_cam_crop: 'crop=iw*0.25:ih*0.32:0:ih*0.68'
          });
        }
      });

      proc.on('error', () => {
        clearTimeout(timer);
        resolve({
          success: false,
          face_detected: false,
          position_label: 'bottom_left',
          ffmpeg_cam_crop: 'crop=iw*0.25:ih*0.32:0:ih*0.68'
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
    dividerY: number = 768,
    cachedTranscriptPath?: string,
    hideTitle: boolean = false,
    hideSubtitles: boolean = false
  ): Promise<{ cues: any[]; hasSpeech: boolean }> {
    const venvPy = this.getPythonCmd();
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_clip_captions.py');

    const args = [
      scriptPath,
      mediaPath,
      outputAssPath,
      '--output_json', outputJsonPath,
      '--streamer', streamerName || 'Creator',
      '--hook', hideTitle ? '' : (moment.headline_hook || 'UNREAL MOMENT'),
      '--center_hook', hideTitle ? '' : (moment.headline_hook || 'UNREAL MOMENT'),
      '--caption_style', captionStyle || 'speed_center',
      '--divider_y', String(dividerY || 768),
      '--duration', String(moment.duration || 30),
      '--model', 'tiny'
    ];
    if (cachedTranscriptPath) {
      args.push('--cached_json', cachedTranscriptPath);
    }
    if (hideTitle) {
      args.push('--no_hook');
    }
    if (hideSubtitles) {
      args.push('--no_subtitles');
    }

    return new Promise((resolve) => {
      const proc = spawn(venvPy, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      const ensureHookAssExists = () => {
        if (hideTitle || fs.existsSync(outputAssPath) || captionStyle === 'bottom_standard') return;
        try {
          const cleanHook = (moment.headline_hook || 'UNREAL MOMENT')
            .replace(/[\u{10000}-\u{10FFFF}\u2600-\u27BF\uFE0F]/gu, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
          if (!cleanHook) return;
          const words = cleanHook.split(' ');
          let formattedHook = cleanHook;
          if (words.length > 2) {
            const half = Math.ceil(words.length / 2);
            formattedHook = `{\\c&H00FFFFFF&\\b1}${words.slice(0, half).join(' ')}\\N{\\c&H0000D7FF&\\b1}${words.slice(half).join(' ')}`;
          }
          const durSec = Math.max(5, moment.duration || 30);
          const mins = Math.floor(durSec / 60);
          const secs = Math.floor(durSec % 60);
          const durStr = `0:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.00`;
          const fallbackAss = `[Script Info]
Title: AI Stream Clipper Viral Hook
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: CenterHook,Arial Black,52,&H00FFFFFF,&H0000D7FF,&HBB090912,&HD0000000,-1,0,0,0,100,100,1,0,3,18,4,5,55,55,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 2,0:00:00.00,${durStr},CenterHook,,0,0,0,,{\\pos(540,${dividerY || 768})\\an5\\fscx88\\fscy88\\t(0,180,\\fscx100\\fscy100)}${formattedHook}
`;
          fs.writeFileSync(outputAssPath, fallbackAss, 'utf-8');
        } catch (e) {}
      };

      const timer = setTimeout(() => {
        try { proc.kill(); } catch (e) {}
        console.warn('[streamClipper] Caption generation timed out after 50s; ensuring on-screen hook ASS.');
        ensureHookAssExists();
        resolve({ cues: [], hasSpeech: false });
      }, 50000);

      proc.on('close', () => {
        clearTimeout(timer);
        ensureHookAssExists();
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
        ensureHookAssExists();
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
          `[in_cam]${camCrop},scale=1080:${camH}:flags=bicubic:force_original_aspect_ratio=increase,crop=1080:${camH}[cam];` +
          `[in_game]crop=iw*0.72:ih:iw*0.14:0,scale=1080:${gameH}:flags=bicubic:force_original_aspect_ratio=increase,crop=1080:${gameH}[game];` +
          `[cam][game]vstack=inputs=2[v_stacked]`;

        if (hasAss) {
          filterComplex = `${stackFilter};[v_stacked]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `${stackFilter};[v_stacked]null[v]`;
        }
      } else if (mode === 'center_crop') {
        // Direct punch-in 9:16 vertical crop
        if (hasAss) {
          filterComplex = `[0:v]scale=1080:1920:flags=bicubic:force_original_aspect_ratio=increase,crop=1080:1920[v0];[v0]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `[0:v]scale=1080:1920:flags=bicubic:force_original_aspect_ratio=increase,crop=1080:1920[v]`;
        }
      } else if (mode === 'smart_zoom') {
        // Smart Speaker Zoom & Face Tracking: Punch in 1.35x centered on the active focal region
        if (hasAss) {
          filterComplex = `[0:v]scale=1440:2560:flags=bicubic:force_original_aspect_ratio=increase,crop=1080:1920:(in_w-1080)/2:(in_h-1920)/2[v0];[v0]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `[0:v]scale=1440:2560:flags=bicubic:force_original_aspect_ratio=increase,crop=1080:1920:(in_w-1080)/2:(in_h-1920)/2[v]`;
        }
      } else if (mode === 'square_1_1') {
        // 1:1 Square Feed format
        if (hasAss) {
          filterComplex = `[0:v]scale=1080:1080:flags=bicubic:force_original_aspect_ratio=increase,crop=1080:1080[v0];[v0]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `[0:v]scale=1080:1080:flags=bicubic:force_original_aspect_ratio=increase,crop=1080:1080[v]`;
        }
      } else if (mode === 'source_16_9') {
        // Original 16:9 widescreen
        if (hasAss) {
          filterComplex = `[0:v]scale=1920:1080:flags=bicubic:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v0];[v0]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `[0:v]scale=1920:1080:flags=bicubic:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v]`;
        }
      } else {
        // Classic viral streamer format: Gaussian blurred background + crisp centered 16:9 stream + burned 3/4 captions
        if (hasAss) {
          filterComplex = `[0:v]scale=1080:1920:flags=bicubic:force_original_aspect_ratio=increase,crop=1080:1920,${blurParams}[bg];` +
                          `[0:v]scale=1080:-1:flags=bicubic:force_original_aspect_ratio=decrease[fg];` +
                          `[bg][fg]overlay=(W-w)/2:(H-h)/2[v0];` +
                          `[v0]subtitles='${escapedAss}'[v]`;
        } else {
          filterComplex = `[0:v]scale=1080:1920:flags=bicubic:force_original_aspect_ratio=increase,crop=1080:1920,${blurParams}[bg];` +
                          `[0:v]scale=1080:-1:flags=bicubic:force_original_aspect_ratio=decrease[fg];` +
                          `[bg][fg]overlay=(W-w)/2:(H-h)/2[v]`;
        }
      }

      const useNvenc = this.isNvencSupported();
      const buildArgs = (nvenc: boolean) => [
        '-y',
        '-i', inputPath,
        '-filter_complex', filterComplex,
        '-map', '[v]',
        '-map', '0:a?',
        '-r', '30',
        '-fps_mode', 'cfr',
        ...(nvenc
          ? ['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '19', '-b:v', '8500k', '-maxrate', '12000k', '-bufsize', '16000k']
          : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-threads', '0', '-b:v', '8500k', '-maxrate', '12000k', '-bufsize', '16000k']),
        '-pix_fmt', 'yuv420p',
        '-af', 'aresample=async=1:first_pts=0',
        '-c:a', 'aac',
        '-b:a', '256k',
        '-avoid_negative_ts', 'make_zero',
        '-movflags', '+faststart',
        outputPath
      ];

      const runEncode = (nvenc: boolean) => {
        const ffmpeg = spawn(this.getFfmpegCmd(), buildArgs(nvenc));
        let errStr = '';
        ffmpeg.stderr.on('data', (d) => { errStr += d.toString(); });
        ffmpeg.on('close', (code) => {
          if (code === 0 && fs.existsSync(outputPath)) {
            resolve();
          } else if (nvenc) {
            console.warn('[streamClipper] NVENC encode failed, retrying with libx264 veryfast...');
            this._nvencSupported = false;
            runEncode(false);
          } else {
            reject(new Error(`FFmpeg vertical render failed (code ${code}): ${errStr.slice(-500)}`));
          }
        });
      };
      runEncode(useNvenc);
    });
  }

  private static _nvencSupported: boolean | null = null;
  private static isNvencSupported(): boolean {
    if (this._nvencSupported !== null) return this._nvencSupported;
    try {
      const res = spawnSync(this.getFfmpegCmd(), [
        '-hide_banner', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.1',
        '-c:v', 'h264_nvenc', '-preset', 'p4', '-f', 'null', '-'
      ], { timeout: 5000 });
      this._nvencSupported = res.status === 0;
      console.log(`[streamClipper] GPU NVENC hardware encoder: ${this._nvencSupported ? 'ENABLED (GTX 1650)' : 'CPU fallback (libx264)'}`);
    } catch {
      this._nvencSupported = false;
    }
    return this._nvencSupported;
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
      const dur = Math.max(5, Math.min(45, moment.duration || 30));
      const ffmpegExe = this.getFfmpegCmd();

      // Ultra-robust pure color generator: works on 100% of FFmpeg builds without font or gradient dependencies
      const args = [
        '-y',
        '-f', 'lavfi',
        '-i', `color=c=0x0f172a:s=1920x1080:d=${dur}:r=30`,
        '-f', 'lavfi',
        '-i', `sine=frequency=440:duration=${dur}`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-t', String(dur),
        outputPath
      ];

      const proc = spawn(ffmpegExe, args);
      let errStr = '';
      proc.stderr?.on('data', (d) => { errStr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve();
        } else {
          console.error(`[generateSampleStreamVideo] Failed with code ${code}:`, errStr);
          reject(new Error(`Failed to generate sample video: ${errStr.slice(-200)}`));
        }
      });
      proc.on('error', (err) => {
        console.error('[generateSampleStreamVideo] Spawn error:', err);
        reject(err);
      });
    });
  }
}
