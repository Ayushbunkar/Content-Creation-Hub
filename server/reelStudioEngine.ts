import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { runQuery, getQuery, allQuery } from './db';
import { CaptionStudioService, MediaProbeInfo, TranscriptSegment, WordTimestamp } from './captionStudio';
import { SFX_CATALOG, BGM_CATALOG, SoundDesignSystem } from './soundDesignSystem';

export interface ReelProject {
  id: string;
  title: string;
  caption_project_id?: string;
  video_path: string;
  audio_path?: string;
  file_info?: MediaProbeInfo;
  aspect_ratio: '9:16' | '16:9' | '1:1';
  duration: number;
  preset: string;
  status: 'draft' | 'editing' | 'rendering' | 'ready' | 'failed';
  progress: number;
  error_message?: string;
  transcript_json?: any;
  timeline_data?: ReelTimeline;
  ai_edit_plan?: any;
  subject_mask_path?: string;
  mask_mode: 'ai' | 'manual';
  manual_mask_data?: any;
  exported_video?: string;
  created_at: string;
  updated_at: string;
}

export interface GlassCardItem {
  id: string;
  type: 'stat' | 'takeaway' | 'quote' | 'link' | 'fact';
  title: string;
  content: string;
  icon: string;
  startTime: number;
  endTime: number;
  posX: number; // percentage 0-100
  posY: number; // percentage 0-100
  width: number;
  height: number;
  blur: number;
  accentColor: string;
  animation: 'slide-left' | 'slide-right' | 'scale-spring' | 'blur-fade';
}

export interface CameraMoveItem {
  id: string;
  type: 'punch-zoom' | 'smooth-zoom' | 'zoom-out' | 'micro-zoom';
  startTime: number;
  duration: number;
  scale: number;
  anchorX: number; // 0-100
  anchorY: number; // 0-100
  easing: string;
}

export interface ScreenShakeItem {
  id: string;
  startTime: number;
  duration: number;
  intensity: number; // pixels 2-15
  reason: string;
}

export interface SfxCueItem {
  id: string;
  sfxId: string;
  name: string;
  src: string;
  startTime: number;
  volume: number;
}

export interface BehindHeadConfig {
  enabled: boolean;
  text: string;
  startTime: number;
  endTime: number;
  font: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  glowColor: string;
  shadow: boolean;
  depth: number;
  posX: number; // percentage
  posY: number; // percentage
  scale: number;
  rotation: number;
  opacity: number;
  maskMode: 'ai' | 'manual';
  maskPath?: string;
  fgPath?: string;
  feather: number;
  manualMask?: {
    x: number;
    y: number;
    width: number;
    height: number;
    feather: number;
  };
}

export interface ReelTimeline {
  videoTrack: {
    src: string;
    trimStart: number;
    trimEnd: number;
    volume: number;
  };
  behindHead: BehindHeadConfig;
  captionsTrack: Array<{
    id: string;
    start: number;
    end: number;
    text: string;
    words: Array<{
      word: string;
      start: number;
      end: number;
      isKeyword?: boolean;
      highlightColor?: string;
    }>;
  }>;
  captionStyle: {
    preset: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    color: string;
    highlightColor: string;
    position: 'bottom' | 'center' | 'top' | 'lower-third';
    verticalOffset?: number;
    animation: string;
    strokeWidth: number;
    strokeColor: string;
    bgBox: boolean;
  };
  glassCardsTrack: GlassCardItem[];
  cameraTrack: CameraMoveItem[];
  shakeTrack: ScreenShakeItem[];
  sfxTrack: SfxCueItem[];
  bgmTrack: {
    trackId: string;
    src: string;
    volume: number;
    duckingEnabled: boolean;
    duckingDb: number;
    fadeIn: number;
    fadeOut: number;
  };
  overlaysTrack: Array<{
    id: string;
    type: string;
    content: string;
    startTime: number;
    endTime: number;
    posX: number;
    posY: number;
    scale: number;
    opacity: number;
  }>;
  keyframes: Array<{
    elementId: string;
    property: string;
    time: number;
    value: any;
    easing: string;
  }>;
}

export const REEL_STYLE_PRESETS = [
  {
    id: 'hormozi-bold',
    name: 'Hormozi Viral Pop',
    category: 'Viral & Retention',
    font: 'Montserrat',
    fontSize: 72,
    fontWeight: '900',
    color: '#FFFFFF',
    highlightColor: '#00FF66',
    strokeWidth: 6,
    strokeColor: '#000000',
    animation: 'pop-bounce',
    desc: 'Punchy uppercase words with bright neon green/yellow keyword pops.'
  },
  {
    id: 'cinematic-doc',
    name: 'Cinematic Documentary',
    category: 'Documentary',
    font: 'Playfair Display',
    fontSize: 54,
    fontWeight: '700',
    color: '#F4F1EA',
    highlightColor: '#E2B874',
    strokeWidth: 2,
    strokeColor: '#121212',
    animation: 'fade-blur',
    desc: 'Elegant serif documentary titles with subtle letter tracking and warm gold emphasis.'
  },
  {
    id: 'modern-glass',
    name: 'Modern Glassmorphism',
    category: 'SaaS & Motion',
    font: 'Inter',
    fontSize: 58,
    fontWeight: '800',
    color: '#FFFFFF',
    highlightColor: '#60A5FA',
    strokeWidth: 2,
    strokeColor: 'rgba(255,255,255,0.2)',
    animation: 'slide-up',
    desc: 'Frosted glass backdrops with smooth glowing accents and clean sans-serif typography.'
  },
  {
    id: 'viral-high-energy',
    name: 'High-Energy Reels',
    category: 'Entertainment',
    font: 'Oswald',
    fontSize: 76,
    fontWeight: '900',
    color: '#FFFFFF',
    highlightColor: '#FFD700',
    strokeWidth: 5,
    strokeColor: '#000000',
    animation: 'karaoke-sweep',
    desc: 'Dynamic karaoke progression with fast camera punch zooms on speaker climax.'
  },
  {
    id: 'minimal-clean',
    name: 'Minimal Subtitles',
    category: 'Lifestyle & Vlog',
    font: 'Inter',
    fontSize: 48,
    fontWeight: '600',
    color: '#FFFFFF',
    highlightColor: '#FFFFFF',
    strokeWidth: 2,
    strokeColor: '#000000',
    animation: 'fade',
    desc: 'Understated clean subtitles with generous margins for aesthetic storytelling.'
  },
  {
    id: 'podcast-two-tone',
    name: 'Podcast Two-Tone',
    category: 'Interview & Podcast',
    font: 'Poppins',
    fontSize: 60,
    fontWeight: '800',
    color: '#E2E8F0',
    highlightColor: '#38BDF8',
    strokeWidth: 4,
    strokeColor: '#0F172A',
    animation: 'word-by-word',
    desc: 'Conversational duo-tone highlights optimized for split-screen and facecam clips.'
  },
  {
    id: 'educational-explainer',
    name: 'Educational & Explainer',
    category: 'Learning',
    font: 'Space Grotesk',
    fontSize: 56,
    fontWeight: '700',
    color: '#FFFFFF',
    highlightColor: '#F59E0B',
    strokeWidth: 3,
    strokeColor: '#18181B',
    animation: 'box-highlight',
    desc: 'Structured yellow-box highlight for definitions, key terms, and educational guides.'
  },
  {
    id: 'tech-ai',
    name: 'Tech & AI Silicon',
    category: 'Technology',
    font: 'Space Grotesk',
    fontSize: 62,
    fontWeight: '800',
    color: '#F8FAFC',
    highlightColor: '#06B6D4',
    strokeWidth: 4,
    strokeColor: '#083344',
    animation: 'glitch-pop',
    desc: 'Futuristic cyan cyber glow with tech badge telemetry and monospace tags.'
  },
  {
    id: 'storytelling-warm',
    name: 'Storytelling Memoir',
    category: 'Storytelling',
    font: 'Lora',
    fontSize: 52,
    fontWeight: '600',
    color: '#FFFBEB',
    highlightColor: '#F97316',
    strokeWidth: 2,
    strokeColor: '#292524',
    animation: 'fade-up',
    desc: 'Warm serif typography that respects emotional cadence and atmospheric pauses.'
  },
  {
    id: 'news-geopolitics',
    name: 'News & Geopolitics',
    category: 'News',
    font: 'Bebas Neue',
    fontSize: 78,
    fontWeight: '900',
    color: '#FFFFFF',
    highlightColor: '#EF4444',
    strokeWidth: 5,
    strokeColor: '#000000',
    animation: 'urgent-ticker',
    desc: 'Authoritative breaking-news ticker style with high-impact red alerts and bold all-caps.'
  },
  {
    id: 'bebas-impact',
    name: 'Bebas All-Caps Punch',
    category: 'Viral & Retention',
    font: 'Bebas Neue',
    fontSize: 82,
    fontWeight: '900',
    color: '#FFFFFF',
    highlightColor: '#EAB308',
    strokeWidth: 6,
    strokeColor: '#000000',
    animation: 'pop-scale',
    desc: 'Maximum size condensed letterforms that dominate mobile 9:16 vertical feeds.'
  },
  {
    id: 'typewriter-retro',
    name: 'Typewriter Mechanical',
    category: 'Creative',
    font: 'Courier New',
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    highlightColor: '#10B981',
    strokeWidth: 2,
    strokeColor: '#000000',
    animation: 'typewriter',
    desc: 'Char-by-char typewriter ticker with flashing green terminal cursor.'
  },
  {
    id: 'neon-glow',
    name: 'Electric Neon Glow',
    category: 'Nightlife & Gaming',
    font: 'Montserrat',
    fontSize: 66,
    fontWeight: '900',
    color: '#FFFFFF',
    highlightColor: '#EC4899',
    strokeWidth: 4,
    strokeColor: '#831843',
    animation: 'neon-pulse',
    desc: 'Electrifying neon magenta glow with luminous outer bloom.'
  },
  {
    id: 'yellow-karaoke',
    name: 'Smooth Yellow Karaoke',
    category: 'Music & Flow',
    font: 'Montserrat',
    fontSize: 64,
    fontWeight: '800',
    color: '#94A3B8',
    highlightColor: '#FFD700',
    strokeWidth: 3,
    strokeColor: '#000000',
    animation: 'smooth-karaoke',
    desc: 'Ultra-fluid karaoke fill that glides across spoken syllables in real time.'
  },
  {
    id: 'gradient-magic',
    name: 'Gradient Sunrise Flow',
    category: 'Design',
    font: 'Poppins',
    fontSize: 64,
    fontWeight: '800',
    color: '#FFFFFF',
    highlightColor: '#F43F5E',
    strokeWidth: 3,
    strokeColor: '#4C0519',
    animation: 'gradient-sweep',
    desc: 'Vibrant sunrise gradient transition with bouncy spring physics.'
  }
];

export class ReelStudioEngine {
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
   * Run Subject Segmentation using OpenCV GrabCut + Haar Cascade
   */
  static async segmentSubject(
    videoPath: string,
    timestamp: number,
    outputDir: string,
    customRect?: [number, number, number, number]
  ): Promise<any> {
    return new Promise((resolve) => {
      const venvPy = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const pythonExe = fs.existsSync(venvPy) ? venvPy : 'python';
      const scriptPath = path.join(process.cwd(), 'scripts', 'segment_subject.py');

      const args = [
        scriptPath,
        videoPath,
        '--time', timestamp.toFixed(3),
        '--outdir', outputDir,
        '--feather', '15'
      ];
      if (customRect && customRect.length === 4) {
        args.push('--rect', customRect.join(','));
      }

      const p = spawn(pythonExe, args);
      let stdout = '';
      let stderr = '';

      p.stdout.on('data', d => { stdout += d.toString(); });
      p.stderr.on('data', d => { stderr += d.toString(); });

      p.on('close', (code) => {
        try {
          const res = JSON.parse(stdout.trim());
          resolve(res);
        } catch {
          resolve({
            success: false,
            mode: 'manual',
            message: stderr || 'Segmentation script output invalid',
            fallback: true
          });
        }
      });
      p.on('error', (err) => {
        resolve({
          success: false,
          mode: 'manual',
          message: err.message,
          fallback: true
        });
      });
    });
  }

  /**
   * AI AUTO EDIT ("Auto Edit My Reel") Engine
   * Modular multi-track pipeline combining transcript analysis, audio cadence & visual anchors
   */
  static async analyzeAndGenerateAutoEditPlan(
    projectId: string,
    options: {
      preset?: string;
      aspectRatio?: '9:16' | '16:9' | '1:1';
      enableBehindHead?: boolean;
      enableGlassCards?: boolean;
      enableCameraZooms?: boolean;
      enableSfx?: boolean;
      enableBgm?: boolean;
    } = {}
  ): Promise<ReelTimeline> {
    const project = await getQuery<any>('SELECT * FROM reel_projects WHERE id = ?', [projectId]);
    if (!project) throw new Error('Reel project not found');

    const transcript = project.transcript_json ? (typeof project.transcript_json === 'string' ? JSON.parse(project.transcript_json) : project.transcript_json) : null;
    const rawSegments: TranscriptSegment[] = transcript?.segments || [];
    const duration = project.duration || 30;
    const presetId = options.preset || project.preset || 'hormozi-bold';
    const chosenPreset = REEL_STYLE_PRESETS.find(p => p.id === presetId) || REEL_STYLE_PRESETS[0];
    const enableBehindHead = options.enableBehindHead !== false;
    const enableGlassCards = options.enableGlassCards !== false;
    const enableCameraZooms = options.enableCameraZooms !== false;
    const enableSfx = options.enableSfx !== false;
    const enableBgm = options.enableBgm !== false;

    // High impact hook words dictionary
    const EMPHASIS_PATTERNS = [
      /\b(never|always|secret|truth|mistake|warning|stop|insane|crazy|money|dollar|\$|\d+%|\d+x|huge|free|free|danger|best|worst|first|billion|million|crore|lakh)\b/i,
      /\b(how to|why is|what if|this one|saved me|everyone|nobody|ruined|hack|shortcut)\b/i
    ];

    // 1. Build Captions Track with Keyword Emphasis & Word Timing
    const captionsTrack: ReelTimeline['captionsTrack'] = [];
    let detectedKeywords: Array<{ word: string; start: number; end: number; segmentIndex: number }> = [];

    rawSegments.forEach((seg, sIdx) => {
      const words = (seg.words || []).map(w => {
        const cleanWord = w.word.replace(/[^\w]/g, '');
        const isImpact = EMPHASIS_PATTERNS.some(pat => pat.test(cleanWord)) || cleanWord.length >= 7;
        if (isImpact) {
          detectedKeywords.push({ word: w.word, start: w.start, end: w.end, segmentIndex: sIdx });
        }
        return {
          word: w.word,
          start: w.start,
          end: w.end,
          isKeyword: isImpact,
          highlightColor: isImpact ? chosenPreset.highlightColor : undefined
        };
      });

      captionsTrack.push({
        id: `cap_seg_${sIdx + 1}`,
        start: seg.start,
        end: seg.end,
        text: seg.text,
        words
      });
    });

    // 2. Build Word-Behind-Head Climax Moment
    let behindHeadConfig: BehindHeadConfig = {
      enabled: false,
      text: 'AI REEL',
      startTime: 1.5,
      endTime: 4.8,
      font: chosenPreset.font || 'Montserrat',
      fontSize: 110,
      fontWeight: '900',
      color: '#FFFFFF',
      glowColor: chosenPreset.highlightColor || '#FFD700',
      shadow: true,
      depth: 18,
      posX: 50,
      posY: 38,
      scale: 1.0,
      rotation: 0,
      opacity: 0.95,
      maskMode: 'ai',
      feather: 15,
      manualMask: {
        x: 35,
        y: 20,
        width: 30,
        height: 45,
        feather: 12
      }
    };

    if (enableBehindHead) {
      // Find the strongest punchline or hook word in the first 8 seconds
      let climaxKeyword = detectedKeywords.find(k => k.start >= 1.0 && k.start <= 7.0) || detectedKeywords[0];
      let behindHeadText = climaxKeyword ? climaxKeyword.word.toUpperCase().replace(/[^\w\s]/g, '') : 'MIND BLOWN';
      if (!behindHeadText || behindHeadText.length < 3) behindHeadText = 'GAME CHANGER';

      const bhStart = climaxKeyword ? Math.max(0.5, climaxKeyword.start - 0.2) : 1.8;
      const bhEnd = Math.min(duration, bhStart + 3.2);

      behindHeadConfig.enabled = true;
      behindHeadConfig.text = behindHeadText;
      behindHeadConfig.startTime = +bhStart.toFixed(2);
      behindHeadConfig.endTime = +bhEnd.toFixed(2);

      // Perform AI subject segmentation at the climax moment
      const maskOutDir = path.join(process.cwd(), 'storage', 'masks');
      try {
        const segRes = await this.segmentSubject(
          path.join(process.cwd(), project.video_path),
          bhStart + 0.5,
          maskOutDir
        );
        if (segRes.success) {
          behindHeadConfig.maskPath = segRes.mask_path;
          behindHeadConfig.fgPath = segRes.fg_path;
          behindHeadConfig.maskMode = 'ai';
          if (segRes.face && segRes.face.head_center_x) {
            // Center text nicely around head anchor
            behindHeadConfig.posX = Math.round((segRes.face.head_center_x / segRes.width) * 100);
            behindHeadConfig.posY = Math.max(22, Math.round((segRes.face.head_center_y / segRes.height) * 100) - 8);
          }
        }
      } catch (segErr) {
        console.warn('[ReelStudio] Automatic subject segmentation note:', segErr);
      }
    }

    // 3. Build Glassmorphism Interface Cards (Factual, Stat, Quote or Takeaway)
    const glassCardsTrack: GlassCardItem[] = [];
    if (enableGlassCards) {
      // Look for statistics, numbers, percentages or key advice in the transcript
      let cardCount = 0;
      for (const seg of rawSegments) {
        if (cardCount >= 3) break;
        const text = seg.text;
        const numberMatch = text.match(/(\$?\d+(?:\.\d+)?[%xXkKmMbB]?|\b(?:step|rule|secret|tip)\s*#?\d+\b)/i);
        
        if (numberMatch && seg.start > 3.0 && seg.end < duration - 2) {
          const cardId = `glass_card_${cardCount + 1}`;
          glassCardsTrack.push({
            id: cardId,
            type: 'stat',
            title: numberMatch[0].toUpperCase(),
            content: text.slice(0, 48).trim() + (text.length > 48 ? '...' : ''),
            icon: numberMatch[0].includes('$') ? '💰' : numberMatch[0].includes('%') ? '📈' : '⚡',
            startTime: +(seg.start).toFixed(2),
            endTime: +(Math.min(seg.start + 3.8, seg.end + 0.5)).toFixed(2),
            posX: 50,
            posY: 76,
            width: 290,
            height: 94,
            blur: 16,
            accentColor: chosenPreset.highlightColor,
            animation: cardCount % 2 === 0 ? 'slide-left' : 'scale-spring'
          });
          cardCount++;
        }
      }

      // If no numbers found, create 1 clean takeaway card from middle of video
      if (glassCardsTrack.length === 0 && rawSegments.length >= 3) {
        const midSeg = rawSegments[Math.floor(rawSegments.length / 2)];
        glassCardsTrack.push({
          id: 'glass_card_1',
          type: 'takeaway',
          title: 'KEY TAKEAWAY',
          content: midSeg.text.slice(0, 52).trim() + '...',
          icon: '💡',
          startTime: +midSeg.start.toFixed(2),
          endTime: +(midSeg.start + 3.6).toFixed(2),
          posX: 50,
          posY: 76,
          width: 300,
          height: 96,
          blur: 16,
          accentColor: '#38BDF8',
          animation: 'slide-right'
        });
      }
    }

    // 4. Build Camera Zooms & Motion Track
    const cameraTrack: CameraMoveItem[] = [];
    if (enableCameraZooms) {
      // Punch zoom on top 2-3 climax keywords
      detectedKeywords.slice(0, 3).forEach((kw, idx) => {
        cameraTrack.push({
          id: `cam_zoom_${idx + 1}`,
          type: 'punch-zoom',
          startTime: Math.max(0, +(kw.start - 0.05).toFixed(2)),
          duration: 0.45,
          scale: 1.22,
          anchorX: 50,
          anchorY: 38,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        });
      });

      // Smooth slow dolly zoom during mid narrative
      if (duration > 15) {
        cameraTrack.push({
          id: 'cam_smooth_1',
          type: 'smooth-zoom',
          startTime: 8.0,
          duration: 4.5,
          scale: 1.12,
          anchorX: 50,
          anchorY: 42,
          easing: 'ease-out'
        });
      }
    }

    // 5. Build Screen Shake Track on High-Energy Impact Moments
    const shakeTrack: ScreenShakeItem[] = [];
    if (enableCameraZooms && detectedKeywords.length > 0) {
      const topKeyword = detectedKeywords[0];
      shakeTrack.push({
        id: 'shake_1',
        startTime: +topKeyword.start.toFixed(2),
        duration: 0.28,
        intensity: 5,
        reason: `Impact on keyword "${topKeyword.word}"`
      });
    }

    // 6. Build Synchronized Sound Effects (SFX) Track
    const sfxTrack: SfxCueItem[] = [];
    if (enableSfx) {
      // Whoosh on glass cards entrance
      glassCardsTrack.forEach((card, idx) => {
        sfxTrack.push({
          id: `sfx_card_${idx + 1}`,
          sfxId: 'whoosh',
          name: 'Whoosh Air Displacement',
          src: '/audio/sound-effects/whoosh.wav',
          startTime: card.startTime,
          volume: 0.45
        });
      });

      // Bass impact on behind-head climax word
      if (behindHeadConfig.enabled) {
        sfxTrack.push({
          id: 'sfx_bh_impact',
          sfxId: 'bass-impact',
          name: 'Resonant Bass Impact',
          src: '/audio/sound-effects/bass-impact.wav',
          startTime: behindHeadConfig.startTime,
          volume: 0.65
        });
      }

      // Crisp click / pop on second camera punch zoom
      if (cameraTrack.length > 1) {
        sfxTrack.push({
          id: 'sfx_zoom_click',
          sfxId: 'click',
          name: 'Tactile Interface Click',
          src: '/audio/sound-effects/click.wav',
          startTime: cameraTrack[1].startTime,
          volume: 0.40
        });
      }
    }

    // 7. Select & Configure Background Music (BGM) with Audio Ducking
    let bgmTrack: ReelTimeline['bgmTrack'] = {
      trackId: 'tech_cyber',
      src: '/audio/bgm/tech_cyber.wav',
      volume: 0.22,
      duckingEnabled: true,
      duckingDb: -14, // Lower by 14dB while speaking
      fadeIn: 1.0,
      fadeOut: 1.5
    };

    if (enableBgm) {
      const selected = SoundDesignSystem.selectBgm(project.title || chosenPreset.category);
      if (selected && selected.meta) {
        bgmTrack.trackId = selected.meta.id;
        bgmTrack.src = selected.trackPath;
      }
    }

    // Assemble Master Timeline Project Data
    const timelineData: ReelTimeline = {
      videoTrack: {
        src: '/' + project.video_path.replace(/\\/g, '/'),
        trimStart: 0,
        trimEnd: duration,
        volume: 1.0
      },
      behindHead: behindHeadConfig,
      captionsTrack,
      captionStyle: {
        preset: chosenPreset.id,
        fontFamily: chosenPreset.font,
        fontSize: chosenPreset.fontSize,
        fontWeight: chosenPreset.fontWeight,
        color: chosenPreset.color,
        highlightColor: chosenPreset.highlightColor,
        position: 'bottom',
        verticalOffset: 480,
        animation: chosenPreset.animation,
        strokeWidth: chosenPreset.strokeWidth,
        strokeColor: chosenPreset.strokeColor,
        bgBox: chosenPreset.id === 'educational-explainer'
      },
      glassCardsTrack,
      cameraTrack,
      shakeTrack,
      sfxTrack,
      bgmTrack,
      overlaysTrack: [],
      keyframes: []
    };

    // Persist AI Edit Plan in Database
    await runQuery(
      `UPDATE reel_projects SET 
        timeline_data = ?, 
        preset = ?,
        aspect_ratio = ?,
        status = 'editing',
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?`,
      [
        JSON.stringify(timelineData),
        chosenPreset.id,
        options.aspectRatio || project.aspect_ratio || '9:16',
        projectId
      ]
    );

    return timelineData;
  }

  /**
   * Production Video Rendering Engine
   * Exports full-fidelity MP4 using FFmpeg (with NVENC hardware acceleration and libx264 fallback)
   */
  static async renderExportVideo(
    projectId: string,
    options: {
      resolution?: '1080p' | '720p' | '4K';
      fps?: number;
      aspectRatio?: '9:16' | '16:9' | '1:1';
      qualityPreset?: 'ultra' | 'high' | 'balanced';
    } = {}
  ): Promise<string> {
    const project = await getQuery<any>('SELECT * FROM reel_projects WHERE id = ?', [projectId]);
    if (!project) throw new Error('Reel project not found');

    const timeline: ReelTimeline = project.timeline_data ? (typeof project.timeline_data === 'string' ? JSON.parse(project.timeline_data) : project.timeline_data) : null;
    if (!timeline) throw new Error('Timeline data not found for rendering');

    await runQuery("UPDATE reel_projects SET status = 'rendering', progress = 10, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [projectId]);
    this.broadcast({ projectId, status: 'rendering', progress: 10, message: 'Preparing timeline layers & subtitle scripts...' });

    const outputDir = path.join(process.cwd(), 'storage', 'videos');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const finalExportPath = path.join(outputDir, `reel_${projectId}_${Date.now()}.mp4`);

    const sourceVideo = path.join(process.cwd(), project.video_path);
    const aspectRatio = options.aspectRatio || project.aspect_ratio || '9:16';
    const resolution = options.resolution || '1080p';
    const fps = options.fps || 30;

    // Dimensions
    let width = 1080;
    let height = 1920;
    if (aspectRatio === '16:9') {
      width = 1920; height = 1080;
    } else if (aspectRatio === '1:1') {
      width = 1080; height = 1080;
    }

    // 1. Generate Advanced SubStation Alpha (.ass) Subtitles Script
    const captionsDir = path.join(process.cwd(), 'storage', 'captions');
    if (!fs.existsSync(captionsDir)) fs.mkdirSync(captionsDir, { recursive: true });
    const assSubtitlePath = path.join(captionsDir, `reel_${projectId}.ass`);

    this.generateAssSubtitles(timeline, assSubtitlePath, width, height);

    // 2. Prepare Background Music & Sound Effects Mix
    const audioDir = path.join(process.cwd(), 'storage', 'audio');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
    const mixedAudioPath = path.join(audioDir, `reel_audio_${projectId}.wav`);

    await this.mixAudioTracks(timeline, mixedAudioPath, project.duration || 30);

    // 3. Assemble FFmpeg Filtergraph
    // Features: Aspect Crop/Pad -> Camera Zooms -> Screen Shake -> Word-Behind-Head Compositing -> ASS Subtitles
    const filters: string[] = [];
    const inputArgs: string[] = ['-y', '-i', sourceVideo];
    let currentVTag = '0:v';

    // Framing: 9:16 Vertical Center Crop / Scale
    if (aspectRatio === '9:16') {
      filters.push(`[${currentVTag}]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[v_framed]`);
      currentVTag = 'v_framed';
    } else if (aspectRatio === '1:1') {
      filters.push(`[${currentVTag}]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080[v_framed]`);
      currentVTag = 'v_framed';
    } else {
      filters.push(`[${currentVTag}]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v_framed]`);
      currentVTag = 'v_framed';
    }

    // Word-Behind-Head Compositing (Layer 2 text -> Layer 3 foreground subject)
    const bh = timeline.behindHead;
    if (bh && bh.enabled && bh.fgPath && fs.existsSync(path.join(process.cwd(), bh.fgPath))) {
      const fgInputIdx = inputArgs.length / 2; // Index of next input
      inputArgs.push('-i', path.join(process.cwd(), bh.fgPath));

      // Draw large behind-head text during [bh.startTime, bh.endTime]
      const bhColor = bh.color ? bh.color.replace('#', '0x') : '0xFFFFFF';
      const cleanBhText = (bh.text || 'WORD').replace(/'/g, "\\'").replace(/:/g, '\\:');
      const textX = `(w-text_w)*${(bh.posX / 100).toFixed(2)}`;
      const textY = `(h-text_h)*${(bh.posY / 100).toFixed(2)}`;
      const enableClause = `between(t,${bh.startTime},${bh.endTime})`;

      filters.push(`[${currentVTag}]drawtext=text='${cleanBhText}':font='Montserrat':fontsize=${bh.fontSize || 96}:fontcolor=${bhColor}:shadowcolor=black@0.7:shadowx=6:shadowy=6:x=${textX}:y=${textY}:enable='${enableClause}'[v_with_bhtext]`);
      currentVTag = 'v_with_bhtext';

      // Overlay the transparent foreground subject cutout directly over the text!
      filters.push(`[${currentVTag}][${fgInputIdx}:v]overlay=0:0:enable='${enableClause}'[v_with_subject]`);
      currentVTag = 'v_with_subject';
    }

    // Burn ASS Subtitles
    const safeAss = assSubtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
    filters.push(`[${currentVTag}]ass='${safeAss}'[v_out]`);
    currentVTag = 'v_out';

    // Attach mixed audio
    const audioInputIdx = inputArgs.length / 2;
    inputArgs.push('-i', mixedAudioPath);

    // Build Full FFmpeg Command Line
    const filterComplexStr = filters.join(';');
    const cmdArgs = [
      ...inputArgs,
      '-filter_complex', filterComplexStr,
      '-map', `[${currentVTag}]`,
      '-map', `${audioInputIdx}:a`,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-t', `${project.duration || 30}`,
      '-r', `${fps}`,
      '-pix_fmt', 'yuv420p'
    ];

    // Hardware encoder check (NVIDIA NVENC)
    cmdArgs.push('-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '22', finalExportPath);

    this.broadcast({ projectId, status: 'rendering', progress: 40, message: 'Encoding 1080p master video via hardware encoder...' });

    return new Promise((resolve, reject) => {
      const p = spawn('ffmpeg', cmdArgs);
      let stderr = '';

      p.stderr.on('data', d => {
        stderr += d.toString();
        const match = d.toString().match(/time=(\d+:\d+:\d+\.\d+)/);
        if (match) {
          this.broadcast({ projectId, status: 'rendering', progress: 75, message: `Encoding frames: ${match[1]}` });
        }
      });

      p.on('close', async (code) => {
        if (code === 0 && fs.existsSync(finalExportPath)) {
          const relExport = path.relative(process.cwd(), finalExportPath).replace(/\\/g, '/');
          await runQuery(
            "UPDATE reel_projects SET status = 'ready', progress = 100, exported_video = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [relExport, projectId]
          );
          this.broadcast({ projectId, status: 'ready', progress: 100, exported_video: relExport });
          resolve(relExport);
        } else {
          // Fallback to CPU libx264 ultrafast if NVENC was rejected
          console.warn('[ReelStudio] Hardware NVENC failed, falling back to libx264 ultrafast...');
          const cpuArgs = [
            ...inputArgs,
            '-filter_complex', filterComplexStr,
            '-map', `[${currentVTag}]`,
            '-map', `${audioInputIdx}:a`,
            '-c:a', 'aac',
            '-b:a', '192k',
            '-t', `${project.duration || 30}`,
            '-r', `${fps}`,
            '-pix_fmt', 'yuv420p',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '22',
            finalExportPath
          ];

          const pCpu = spawn('ffmpeg', cpuArgs);
          pCpu.on('close', async (c2) => {
            if (c2 === 0 && fs.existsSync(finalExportPath)) {
              const relExport = path.relative(process.cwd(), finalExportPath).replace(/\\/g, '/');
              await runQuery(
                "UPDATE reel_projects SET status = 'ready', progress = 100, exported_video = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [relExport, projectId]
              );
              this.broadcast({ projectId, status: 'ready', progress: 100, exported_video: relExport });
              resolve(relExport);
            } else {
              const err = new Error(`FFmpeg export failed (exit code ${c2}): ${stderr.slice(-300)}`);
              await runQuery("UPDATE reel_projects SET status = 'failed', error_message = ? WHERE id = ?", [err.message, projectId]);
              this.broadcast({ projectId, status: 'failed', error: err.message });
              reject(err);
            }
          });
          pCpu.on('error', reject);
        }
      });
      p.on('error', reject);
    });
  }

  /**
   * Mix multi-track audio: Original voice + Ducked BGM + SFX Cues
   */
  private static async mixAudioTracks(timeline: ReelTimeline, outputPath: string, totalDuration: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const inputs: string[] = [];
      const filterSegments: string[] = [];
      let inputIndex = 0;

      // 1. Primary Speech Audio Track
      const primaryAudio = path.join(process.cwd(), timeline.videoTrack.src.replace(/^\//, ''));
      inputs.push('-i', primaryAudio);
      filterSegments.push(`[${inputIndex}:a]volume=${timeline.videoTrack.volume || 1.0}[a_voice]`);
      inputIndex++;

      let currentAudioMixCount = 1;
      let mixInputs = '[a_voice]';

      // 2. Background Music with Audio Ducking
      const bgm = timeline.bgmTrack;
      if (bgm && bgm.src) {
        const bgmPath = path.join(process.cwd(), 'public', bgm.src.replace(/^\//, ''));
        if (fs.existsSync(bgmPath)) {
          inputs.push('-stream_loop', '-1', '-i', bgmPath);
          const duckVol = bgm.duckingEnabled ? 0.12 : (bgm.volume || 0.25);
          filterSegments.push(`[${inputIndex}:a]volume=${duckVol}[a_bgm]`);
          mixInputs += '[a_bgm]';
          currentAudioMixCount++;
          inputIndex++;
        }
      }

      // 3. Sound Effects (Whoosh, Pop, Click, Impact)
      const sfx = timeline.sfxTrack || [];
      sfx.forEach((cue, idx) => {
        const sfxDiskPath = path.join(process.cwd(), 'public', cue.src.replace(/^\//, ''));
        if (fs.existsSync(sfxDiskPath) && cue.startTime < totalDuration) {
          inputs.push('-i', sfxDiskPath);
          const delayMs = Math.round(cue.startTime * 1000);
          filterSegments.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs},volume=${cue.volume || 0.5}[a_sfx_${idx}]`);
          mixInputs += `[a_sfx_${idx}]`;
          currentAudioMixCount++;
          inputIndex++;
        }
      });

      // Mix all audio channels with amix
      filterSegments.push(`${mixInputs}amix=inputs=${currentAudioMixCount}:duration=first:dropout_transition=2[a_mixed]`);

      const cmdArgs = [
        '-y',
        ...inputs,
        '-filter_complex', filterSegments.join(';'),
        '-map', '[a_mixed]',
        '-t', `${totalDuration}`,
        '-ac', '2',
        '-ar', '48000',
        outputPath
      ];

      const p = spawn('ffmpeg', cmdArgs);
      p.on('close', (code) => {
        if (code === 0) resolve();
        else {
          // Fallback to simple speech copy if mixing encountered filter error
          console.warn('[ReelStudio] Audio mixing filter error, falling back to original audio...');
          const fallback = spawn('ffmpeg', ['-y', '-i', primaryAudio, '-t', `${totalDuration}`, outputPath]);
          fallback.on('close', () => resolve());
          fallback.on('error', () => resolve());
        }
      });
      p.on('error', () => resolve());
    });
  }

  /**
   * Helper: Generate Advanced SubStation Alpha (.ass) format with styling and karaoke
   */
  private static generateAssSubtitles(
    timeline: ReelTimeline,
    outputPath: string,
    width: number,
    height: number
  ): void {
    const cs = timeline.captionStyle || {
      fontFamily: 'Montserrat',
      fontSize: 64,
      fontWeight: '800',
      color: '#FFFFFF',
      highlightColor: '#FFD700',
      strokeWidth: 4,
      strokeColor: '#000000',
      position: 'bottom',
      verticalOffset: 480
    };

    const toAssColor = (hex: string) => {
      if (!hex) return '&H00FFFFFF';
      const clean = hex.replace('#', '');
      if (clean.length === 6) {
        return `&H00${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}&`;
      }
      return '&H00FFFFFF&';
    };

    const primaryColor = toAssColor(cs.color || '#FFFFFF');
    const highlightColor = toAssColor(cs.highlightColor || '#FFD700');
    const outlineColor = toAssColor(cs.strokeColor || '#000000');

    // Alignment: 2 = bottom center, 5 = middle center, 8 = top center
    let alignment = 2;
    let marginV = 240;
    if (cs.position === 'center') {
      alignment = 5;
      marginV = 0;
    } else if (cs.position === 'top') {
      alignment = 8;
      marginV = 160;
    } else if (cs.position === 'lower-third') {
      alignment = 2;
      marginV = 360;
    }

    let ass = `[Script Info]
Title: AI Reel Studio Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${cs.fontFamily || 'Montserrat'},${cs.fontSize || 62},${primaryColor},${highlightColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,${cs.strokeWidth || 4},2,${alignment},60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const formatTs = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 100);
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    for (const seg of timeline.captionsTrack) {
      if (!seg.text || seg.start >= seg.end) continue;
      const startStr = formatTs(seg.start);
      const endStr = formatTs(seg.end);

      // Karaoke style highlighting if words present
      let lineText = '';
      if (seg.words && seg.words.length > 0) {
        lineText = seg.words.map(w => {
          if (w.isKeyword) {
            return `{\\c${highlightColor}\\b1}${w.word}{\\c${primaryColor}\\b0}`;
          }
          return w.word;
        }).join(' ');
      } else {
        lineText = seg.text;
      }

      // Word wrapping for vertical 9:16 reels
      if (width < height && lineText.length > 28 && !lineText.includes('\\N')) {
        const words = lineText.split(' ');
        const mid = Math.ceil(words.length / 2);
        lineText = words.slice(0, mid).join(' ') + '\\N' + words.slice(mid).join(' ');
      }

      const safeLine = lineText.replace(/\r?\n/g, '\\N');
      ass += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${safeLine}\n`;
    }

    fs.writeFileSync(outputPath, ass, 'utf-8');
  }

  static formatProjectRow(row: any): ReelProject {
    if (!row) return row;
    return {
      ...row,
      file_info: row.file_info ? (typeof row.file_info === 'string' ? JSON.parse(row.file_info) : row.file_info) : undefined,
      transcript_json: row.transcript_json ? (typeof row.transcript_json === 'string' ? JSON.parse(row.transcript_json) : row.transcript_json) : undefined,
      timeline_data: row.timeline_data ? (typeof row.timeline_data === 'string' ? JSON.parse(row.timeline_data) : row.timeline_data) : undefined,
      ai_edit_plan: row.ai_edit_plan ? (typeof row.ai_edit_plan === 'string' ? JSON.parse(row.ai_edit_plan) : row.ai_edit_plan) : undefined,
      manual_mask_data: row.manual_mask_data ? (typeof row.manual_mask_data === 'string' ? JSON.parse(row.manual_mask_data) : row.manual_mask_data) : undefined
    };
  }

  static async listProjects(): Promise<ReelProject[]> {
    const rows = await allQuery<any>('SELECT * FROM reel_projects ORDER BY updated_at DESC');
    return rows.map(r => this.formatProjectRow(r));
  }

  static async getProject(id: string): Promise<ReelProject | null> {
    const row = await getQuery<any>('SELECT * FROM reel_projects WHERE id = ?', [id]);
    if (!row) return null;
    return this.formatProjectRow(row);
  }

  static async createProject(data: {
    title?: string;
    videoPath?: string;
    captionProjectId?: string;
    aspectRatio?: '9:16' | '16:9' | '1:1';
    preset?: string;
    duration?: number;
  }): Promise<ReelProject> {
    const projectId = `reel_proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let title = data.title || 'Untitled Reel Project';
    let videoPath = data.videoPath || '';
    let audioPath = '';
    let fileInfo: any = null;
    let transcriptJson: any = null;
    let duration = data.duration || 0;
    const preset = data.preset || 'hormozi-bold';
    const aspectRatio = data.aspectRatio || '9:16';

    if (data.captionProjectId) {
      const capProj = await getQuery<any>('SELECT * FROM caption_projects WHERE id = ?', [data.captionProjectId]);
      if (capProj) {
        title = title === 'Untitled Reel Project' ? `${capProj.title} (Reel Studio)` : title;
        videoPath = capProj.video_path;
        audioPath = capProj.audio_path || '';
        fileInfo = capProj.file_info ? (typeof capProj.file_info === 'string' ? JSON.parse(capProj.file_info) : capProj.file_info) : null;
        transcriptJson = capProj.transcript_json ? (typeof capProj.transcript_json === 'string' ? JSON.parse(capProj.transcript_json) : capProj.transcript_json) : null;
        if (fileInfo && fileInfo.durationSeconds) {
          duration = fileInfo.durationSeconds;
        }
      }
    }

    if (videoPath && (!duration || !fileInfo)) {
      try {
        const absVideo = path.isAbsolute(videoPath) ? videoPath : path.join(process.cwd(), videoPath);
        if (fs.existsSync(absVideo)) {
          fileInfo = await CaptionStudioService.probeMedia(absVideo);
          duration = fileInfo.durationSeconds || duration;
        }
      } catch (e) {
        console.warn('[ReelStudio] Media probe note:', e);
      }
    }

    const initialTimeline: ReelTimeline = {
      videoTrack: {
        src: '/' + videoPath.replace(/\\/g, '/'),
        trimStart: 0,
        trimEnd: duration,
        volume: 1.0
      },
      behindHead: {
        enabled: false,
        text: 'BEHIND HEAD',
        startTime: 1.5,
        endTime: 4.5,
        font: 'Montserrat',
        fontSize: 100,
        fontWeight: '900',
        color: '#FFFFFF',
        glowColor: '#FFD700',
        shadow: true,
        depth: 18,
        posX: 50,
        posY: 38,
        scale: 1.0,
        rotation: 0,
        opacity: 0.95,
        maskMode: 'ai',
        feather: 15,
        manualMask: { x: 35, y: 20, width: 30, height: 45, feather: 12 }
      },
      captionsTrack: [],
      captionStyle: {
        preset,
        fontFamily: 'Montserrat',
        fontSize: 64,
        fontWeight: '900',
        color: '#FFFFFF',
        highlightColor: '#FFD700',
        position: 'bottom',
        verticalOffset: 480,
        animation: 'word-by-word',
        strokeWidth: 4,
        strokeColor: '#000000',
        bgBox: false
      },
      glassCardsTrack: [],
      cameraTrack: [],
      shakeTrack: [],
      sfxTrack: [],
      bgmTrack: {
        trackId: 'tech_cyber',
        src: '/audio/bgm/tech_cyber.wav',
        volume: 0.22,
        duckingEnabled: true,
        duckingDb: -14,
        fadeIn: 1.0,
        fadeOut: 1.5
      },
      overlaysTrack: [],
      keyframes: []
    };

    // If transcript segments exist from caption project, populate captionsTrack
    if (transcriptJson && transcriptJson.segments) {
      transcriptJson.segments.forEach((seg: any, idx: number) => {
        initialTimeline.captionsTrack.push({
          id: `cap_seg_${idx + 1}`,
          start: seg.start,
          end: seg.end,
          text: seg.text,
          words: (seg.words || []).map((w: any) => ({
            word: w.word,
            start: w.start,
            end: w.end,
            isKeyword: false
          }))
        });
      });
    }

    await runQuery(
      `INSERT INTO reel_projects (
        id, title, caption_project_id, video_path, audio_path, file_info,
        aspect_ratio, duration, preset, status, progress, transcript_json,
        timeline_data, mask_mode, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        projectId,
        title,
        data.captionProjectId || null,
        videoPath,
        audioPath,
        fileInfo ? JSON.stringify(fileInfo) : null,
        aspectRatio,
        duration,
        preset,
        'editing',
        0,
        transcriptJson ? JSON.stringify(transcriptJson) : null,
        JSON.stringify(initialTimeline),
        'ai'
      ]
    );

    const created = await this.getProject(projectId);
    this.broadcast({ type: 'project_created', project: created });
    return created!;
  }

  static async updateProject(id: string, updates: Partial<ReelProject>): Promise<ReelProject> {
    const existing = await this.getProject(id);
    if (!existing) throw new Error('Reel project not found');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.preset !== undefined) { fields.push('preset = ?'); values.push(updates.preset); }
    if (updates.aspect_ratio !== undefined) { fields.push('aspect_ratio = ?'); values.push(updates.aspect_ratio); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.progress !== undefined) { fields.push('progress = ?'); values.push(updates.progress); }
    if (updates.error_message !== undefined) { fields.push('error_message = ?'); values.push(updates.error_message); }
    if (updates.mask_mode !== undefined) { fields.push('mask_mode = ?'); values.push(updates.mask_mode); }
    if (updates.subject_mask_path !== undefined) { fields.push('subject_mask_path = ?'); values.push(updates.subject_mask_path); }
    if (updates.exported_video !== undefined) { fields.push('exported_video = ?'); values.push(updates.exported_video); }

    if (updates.timeline_data !== undefined) {
      fields.push('timeline_data = ?');
      values.push(typeof updates.timeline_data === 'string' ? updates.timeline_data : JSON.stringify(updates.timeline_data));
    }
    if (updates.ai_edit_plan !== undefined) {
      fields.push('ai_edit_plan = ?');
      values.push(typeof updates.ai_edit_plan === 'string' ? updates.ai_edit_plan : JSON.stringify(updates.ai_edit_plan));
    }
    if (updates.manual_mask_data !== undefined) {
      fields.push('manual_mask_data = ?');
      values.push(typeof updates.manual_mask_data === 'string' ? updates.manual_mask_data : JSON.stringify(updates.manual_mask_data));
    }
    if (updates.transcript_json !== undefined) {
      fields.push('transcript_json = ?');
      values.push(typeof updates.transcript_json === 'string' ? updates.transcript_json : JSON.stringify(updates.transcript_json));
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await runQuery(`UPDATE reel_projects SET ${fields.join(', ')} WHERE id = ?`, values);
    const updated = await this.getProject(id);
    this.broadcast({ type: 'project_updated', project: updated });
    return updated!;
  }

  static async deleteProject(id: string): Promise<boolean> {
    await runQuery('DELETE FROM reel_projects WHERE id = ?', [id]);
    this.broadcast({ type: 'project_deleted', projectId: id });
    return true;
  }

  static getPresets() {
    return REEL_STYLE_PRESETS;
  }

  static getCatalog() {
    return {
      sfx: SFX_CATALOG,
      bgm: BGM_CATALOG
    };
  }
}
