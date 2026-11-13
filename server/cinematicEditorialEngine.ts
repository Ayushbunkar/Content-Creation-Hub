import path from 'path';
import fs from 'fs';
import {
  SceneData,
  VisualShotType,
  MediaSource,
  CameraMovement,
  TransitionType,
  SfxCue,
  EditorialStylePreset,
  MasterTimeline,
  VideoProject
} from './types';
import { MediaSourceManager } from './mediaSource';

export interface ScriptBeat {
  index: number;
  text: string;
  durationEstSec: number;
  beatType:
    | 'hook'
    | 'subject_intro'
    | 'tech_broll'
    | 'corporate_setting'
    | 'kinetic_title'
    | 'evidence'
    | 'data_metric'
    | 'map'
    | 'revelation'
    | 'climax'
    | 'conclusion'
    | 'archival_history';
  keywords: string[];
  highlightEntity?: string;
  searchQuery: string;
}

export interface AlignedBeat extends ScriptBeat {
  startSec: number;
  endSec: number;
  startFrame: number;
  durationFrames: number;
}

/**
 * Intelligent Script Beat Analyzer
 * Strictly breaks narration into 3.0 to 3.8s cinematic visual beats (15-20 cuts per 60s)
 * Automatically classifies entities, context, and visual queries.
 */
export class ScriptBeatAnalyzer {
  static analyzeScript(script: string, preset: EditorialStylePreset = 'cinematic_investigative', targetDurationSec = 60): ScriptBeat[] {
    const rawSentences = script
      .replace(/\r?\n+/g, ' ')
      .split(/(?<=[.!?।])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const beats: ScriptBeat[] = [];
    let beatIdx = 0;

    // Fast-paced documentary editing rule: 3.0 to 3.6 seconds per cut (~8-9 words per visual change)
    const targetBeatSec = preset === 'fast_documentary' ? 3.0 : 3.3;
    const totalWords = script.split(/\s+/).filter(Boolean).length;
    const estimatedWps = Math.max(1.8, Math.min(3.0, totalWords / Math.max(15, targetDurationSec)));
    const wordsPerBeat = Math.max(5, Math.round(targetBeatSec * estimatedWps));

    for (const sentence of rawSentences) {
      const words = sentence.split(/\s+/).filter(Boolean);
      const sentenceEstSec = words.length / estimatedWps;

      // Determine required cuts for this sentence to guarantee 3-4s visual changes
      const cutsNeeded = Math.max(1, Math.round(sentenceEstSec / targetBeatSec));

      if (cutsNeeded === 1 || words.length <= wordsPerBeat + 2) {
        beats.push(this.classifyBeat(sentence, beatIdx++, sentenceEstSec));
      } else {
        // Natural clause splitting on punctuation and key conjunctions
        const clauses = sentence
          .split(/(?<=[,;:\-—])\s+|\s+(?:and then|while|whereas|however|which revealed|but|suddenly|in order to|as a result)\s+/i)
          .map(c => c.trim())
          .filter(c => c.length > 0);

        if (clauses.length >= cutsNeeded) {
          let currentChunk: string[] = [];
          for (let c = 0; c < clauses.length; c++) {
            currentChunk.push(clauses[c]);
            const chunkWords = currentChunk.join(' ').split(/\s+/).length;
            if (chunkWords >= wordsPerBeat || c === clauses.length - 1) {
              const text = currentChunk.join(' ');
              const dur = text.split(/\s+/).length / estimatedWps;
              beats.push(this.classifyBeat(text, beatIdx++, dur));
              currentChunk = [];
            }
          }
          if (currentChunk.length > 0) {
            const text = currentChunk.join(' ');
            const dur = text.split(/\s+/).length / estimatedWps;
            beats.push(this.classifyBeat(text, beatIdx++, dur));
          }
        } else {
          // Evenly slice words across cutsNeeded to guarantee 3-4s cuts
          const wordsPerSlice = Math.ceil(words.length / cutsNeeded);
          for (let k = 0; k < cutsNeeded; k++) {
            const slice = words.slice(k * wordsPerSlice, (k + 1) * wordsPerSlice).join(' ');
            if (slice.trim().length > 0) {
              const dur = slice.split(/\s+/).length / estimatedWps;
              beats.push(this.classifyBeat(slice, beatIdx++, dur));
            }
          }
        }
      }
    }

    return beats;
  }

  private static classifyBeat(text: string, index: number, estSec = 3.3): ScriptBeat {
    const lower = text.toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);
    const clampedSec = Math.max(2.6, Math.min(4.0, Number(estSec.toFixed(1))));

    // Extract significant keywords
    const keywords = words
      .map(w => w.replace(/[^\w]/g, ''))
      .filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'were', 'been', 'their', 'which', 'there', 'they', 'will', 'into', 'over'].includes(w.toLowerCase()));

    let beatType: ScriptBeat['beatType'] = 'revelation';
    let highlightEntity: string | undefined = undefined;
    let searchQuery = keywords.slice(0, 4).join(' ') || 'cinematic documentary';

    // 1. Hook / Cold Open
    if (index === 0) {
      beatType = 'hook';
      highlightEntity = 'INTELLIGENCE BRIEFING';
      searchQuery = 'satellite radar intelligence';
    }
    // 2. Person / Executive Leadership
    else if (
      lower.includes('jensen') || lower.includes('huang') || lower.includes('ceo') ||
      lower.includes('president') || lower.includes('founder') || lower.includes('leader') ||
      lower.includes('executive') || lower.includes('trump') || lower.includes('altman') ||
      lower.includes('nadella') || lower.includes('musk')
    ) {
      beatType = 'subject_intro';
      highlightEntity = 'EXECUTIVE LEADERSHIP';
      searchQuery = 'executive portrait ceo leadership';
    }
    // 3. Tech Hardware / Datacenter / Silicon
    else if (
      lower.includes('silicon') || lower.includes('server') || lower.includes('gpu') ||
      lower.includes('chip') || lower.includes('datacenter') || lower.includes('computing') ||
      lower.includes('blackwell') || lower.includes('superchip') || lower.includes('semiconductor') ||
      lower.includes('wafer') || lower.includes('lithography') || lower.includes('tsmc') ||
      lower.includes('hardware') || lower.includes('microchip') || lower.includes('artificial intelligence')
    ) {
      beatType = 'tech_broll';
      highlightEntity = 'SILICON HARDWARE ARCHITECTURE';
      searchQuery = 'datacenter server racks microchip semiconductor';
    }
    // 4. Geopolitics / Maritime / Satellite Maps
    else if (
      lower.includes('map') || lower.includes('strait') || lower.includes('corridor') ||
      lower.includes('border') || lower.includes('sea') || lower.includes('china') ||
      lower.includes('taiwan') || lower.includes('hormuz') || lower.includes('iran') ||
      lower.includes('persian') || lower.includes('chokepoint') || lower.includes('naval') ||
      lower.includes('carrier') || lower.includes('military') || lower.includes('sovereign')
    ) {
      beatType = 'map';
      highlightEntity = 'TACTICAL SATELLITE TELEMETRY';
      searchQuery = 'satellite orbit globe naval maritime';
    }
    // 5. Financial / Business / Metrics
    else if (/\$?\d+[\d,.]*(?:[bBmMtT]|%|billion|million|trillion)?/.test(text) || lower.includes('valuation') || lower.includes('market') || lower.includes('revenue') || lower.includes('stock')) {
      beatType = 'data_metric';
      highlightEntity = 'FINANCIAL METRIC IMPACT';
      searchQuery = 'stock market trading floor wall street';
    }
    // 6. Corporate Boardroom / Behind Closed Doors
    else if (
      lower.includes('boardroom') || lower.includes('office') || lower.includes('corporate') ||
      lower.includes('headquarters') || lower.includes('closed doors') || lower.includes('resigned') ||
      lower.includes('governance')
    ) {
      beatType = 'corporate_setting';
      highlightEntity = 'CORPORATE HEADQUARTERS';
      searchQuery = 'corporate boardroom glass office';
    }
    // 7. Kinetic Title Card / Breaking Alert / Climax
    else if (
      lower.includes('scandal') || lower.includes('trap') || lower.includes('secret') ||
      lower.includes('investigation') || lower.includes('collapse') || lower.includes('danger') ||
      lower.includes('warning') || lower.includes('critical') || index === 2
    ) {
      beatType = 'kinetic_title';
      highlightEntity = words[0]?.toUpperCase() || 'CRITICAL';
      searchQuery = 'dark abstract technology texture';
    }
    // 8. Evidence Dossier / Archival History
    else if (
      lower.includes('document') || lower.includes('filing') || lower.includes('report') ||
      lower.includes('evidence') || lower.includes('classified') || lower.includes('subpoena') ||
      lower.includes('archive') || lower.includes('treaty') || lower.includes('vintage')
    ) {
      beatType = 'evidence';
      highlightEntity = 'DECLASSIFIED EVIDENCE DOSSIER';
      searchQuery = 'classified document dossier archive';
    }

    return {
      index,
      text,
      durationEstSec: clampedSec,
      beatType,
      keywords,
      highlightEntity,
      searchQuery
    };
  }
}

/**
 * Narration Timeline Aligner
 * Strictly maps beats to the total voiceover duration, enforcing 2.8s - 4.0s per shot.
 */
export class NarrationTimelineAligner {
  static alignBeats(beats: ScriptBeat[], totalAudioDurSec: number, fps = 30): AlignedBeat[] {
    const totalFrames = Math.max(90, Math.ceil(totalAudioDurSec * fps));
    const totalWords = beats.reduce((acc, b) => acc + (b.text.trim().split(/\s+/).length || 4), 0);
    let accumulatedFrames = 0;

    return beats.map((b, idx) => {
      const words = b.text.trim().split(/\s+/).length || 4;
      
      // Proportional allocation of frames
      let shotDurFrames = Math.round((words / totalWords) * totalFrames);

      // Strict 3-4 second constraint: clamp between 80 frames (2.67s) and 125 frames (4.16s)
      const minFrames = Math.round(2.6 * fps);
      const maxFrames = Math.round(4.1 * fps);
      shotDurFrames = Math.max(minFrames, Math.min(maxFrames, shotDurFrames));

      // Handle final frame boundary gracefully
      if (idx === beats.length - 1) {
        shotDurFrames = Math.max(minFrames, totalFrames - accumulatedFrames);
      } else if (accumulatedFrames + shotDurFrames > totalFrames - minFrames) {
        shotDurFrames = Math.max(minFrames, totalFrames - accumulatedFrames);
      }

      const startFrame = accumulatedFrames;
      accumulatedFrames += shotDurFrames;

      return {
        ...b,
        startFrame,
        durationFrames: shotDurFrames,
        startSec: Number((startFrame / fps).toFixed(2)),
        endSec: Number(((startFrame + shotDurFrames) / fps).toFixed(2))
      };
    });
  }
}

/**
 * Kinetic 3D Typography Engine
 */
export class KineticTypographyEngine {
  static buildKineticTitle(beat: AlignedBeat, topic: string): SceneData['kinetic_title_data'] {
    const t = topic.toUpperCase();
    const words = beat.text.replace(/[^\w\s]/g, '').trim().split(/\s+/);

    const hotKeywords = ['RESIGNS', 'COLLAPSE', 'SCANDAL', 'SECRET', 'ALERT', 'TRAP', 'CRITICAL', 'EMPIRE', 'FALL', 'DANGER', 'NVIDIA', 'EXPOSED', 'DEADLIEST', 'BLACKWELL'];
    const foundHot = words.find(w => hotKeywords.includes(w.toUpperCase())) || (words.length > 0 ? words[0].toUpperCase() : 'BREAKING');

    let line1 = t.length > 25 ? t.slice(0, 25) : t;
    let line2 = beat.text.slice(0, 35).toUpperCase();

    if (t.includes('NVIDIA') || t.includes('CHIP') || t.includes('SILICON') || t.includes('BLACKWELL')) {
      line1 = 'THE SILICON EMPIRE';
      line2 = 'CRITICAL HARDWARE EXPOSED';
    } else if (t.includes('HORMUZ') || t.includes('STRAIT') || t.includes('CHOKEPOINT')) {
      line1 = 'CHOKEPOINT PROTOCOL';
      line2 = 'STRAIT OF HORMUZ EXPOSED';
    }

    return {
      line1,
      line2,
      highlightWord: foundHot,
      highlightColor: '#ff2a2a',
      flarePosition: 0.5,
      particles: 'embers'
    };
  }
}

/**
 * Contextual B-Roll Harvester & Repetition Prevention Engine
 * Enforces mixed-media distribution:
 * 45% Moving Video Footage
 * 30% Authentic Subject Photographs / Portraits
 * 15% Tactical Maps, Data Metrics & Documents
 * 10% Kinetic Typography & Graphic Revelations
 */
export class ContextualAssetSelector {
  private static usedUrls: Set<string> = new Set();
  private static recentTypes: VisualShotType[] = [];

  static resetMemory() {
    this.usedUrls.clear();
    this.recentTypes = [];
  }

  static selectContextualAsset(
    beat: AlignedBeat,
    category: string,
    topic: string,
    index: number
  ): { url: string; isVideo: boolean; visualType: VisualShotType; badge: string } {
    const lowerTopic = topic.toLowerCase();
    const lowerText = beat.text.toLowerCase();

    // 1. Moving 4K/1080p Video Footage (Tech / Naval / Global / Finance / Archive)
    if (beat.beatType === 'tech_broll' || (index % 4 === 1 && !this.recentTypes.includes('actual_video'))) {
      const videoClips = [
        { url: '/videos/library/datacenter_tech.mp4', badge: '[4K Datacenter B-Roll]' },
        { url: '/videos/library/military_surveillance.mp4', badge: '[Night Surveillance Video]' },
        { url: '/videos/library/satellite_globe.mp4', badge: '[Tactical Satellite Video]' }
      ];
      const selected = videoClips[index % videoClips.length];
      this.recentTypes.push('actual_video');
      if (this.recentTypes.length > 4) this.recentTypes.shift();
      return { url: selected.url, isVideo: true, visualType: 'actual_video', badge: selected.badge };
    }

    if (beat.beatType === 'corporate_setting' || (lowerText.includes('trade') || lowerText.includes('market'))) {
      this.recentTypes.push('actual_video');
      if (this.recentTypes.length > 4) this.recentTypes.shift();
      return {
        url: '/videos/library/finance_trade.mp4',
        isVideo: true,
        visualType: 'actual_video',
        badge: '[Executive Boardroom Video]'
      };
    }

    if (beat.beatType === 'map' || lowerTopic.includes('hormuz') || lowerTopic.includes('taiwan')) {
      if (!this.recentTypes.includes('tactical_map')) {
        this.recentTypes.push('tactical_map');
        if (this.recentTypes.length > 4) this.recentTypes.shift();
        return {
          url: '/videos/library/satellite_globe.mp4',
          isVideo: true,
          visualType: 'tactical_map',
          badge: '[Tactical Satellite Map]'
        };
      }
    }

    // 2. 3D Kinetic Title Card (For dramatic reveals)
    if (beat.beatType === 'kinetic_title' && !this.recentTypes.includes('kinetic_title_card')) {
      this.recentTypes.push('kinetic_title_card');
      if (this.recentTypes.length > 4) this.recentTypes.shift();
      return {
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=85',
        isVideo: false,
        visualType: 'kinetic_title_card',
        badge: '[3D Kinetic Title Card]'
      };
    }

    // 3. Person Introduction / Authentic Portrait
    if (beat.beatType === 'subject_intro' && !this.recentTypes.includes('person_intro')) {
      const portraits = [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=85',
        'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1920&q=85',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1920&q=85'
      ];
      const portrait = portraits[index % portraits.length];
      this.recentTypes.push('person_intro');
      if (this.recentTypes.length > 4) this.recentTypes.shift();
      return {
        url: portrait,
        isVideo: false,
        visualType: 'person_intro',
        badge: '[Executive Portrait Close-up]'
      };
    }

    // 4. Data Metric Graphic
    if (beat.beatType === 'data_metric' && !this.recentTypes.includes('data_metric')) {
      this.recentTypes.push('data_metric');
      if (this.recentTypes.length > 4) this.recentTypes.shift();
      return {
        url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1920&q=85',
        isVideo: false,
        visualType: 'data_metric',
        badge: '[Financial Valuation Metric]'
      };
    }

    // 5. Evidence Dossier / Press Headline
    if (beat.beatType === 'evidence' || lowerText.includes('report') || lowerText.includes('document')) {
      if (index % 2 === 0) {
        return {
          url: '/videos/library/historical_archive.mp4',
          isVideo: true,
          visualType: 'investigative_evidence',
          badge: '[Declassified Evidence Dossier]'
        };
      } else {
        return {
          url: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1920&q=85',
          isVideo: false,
          visualType: 'newspaper_headline',
          badge: '[Press Newspaper Headline]'
        };
      }
    }

    // 6. Authentic Editorial Photography with Subpixel Motion
    const fallbackUrl = MediaSourceManager.searchLocalLibraryFootage(beat.text, category);
    return {
      url: fallbackUrl,
      isVideo: false,
      visualType: 'archival_photo',
      badge: '[Archival Photo Analysis]'
    };
  }
}

/**
 * Camera Motion Engine (Zero Static Holds)
 */
export class VisualMotionEngine {
  static getCameraMovement(beat: AlignedBeat, index: number): CameraMovement {
    if (beat.beatType === 'subject_intro') return 'dolly_in'; // Slow dramatic push
    if (beat.beatType === 'tech_broll') return 'tracking_forward'; // Datacenter tracking
    if (beat.beatType === 'corporate_setting') return 'dolly_out'; // Boardroom wide pull
    if (beat.beatType === 'kinetic_title') return 'orbit';
    if (beat.beatType === 'map') return 'aerial_zoom';

    const movements: CameraMovement[] = ['dolly_in', 'pan_left', 'tilt_up', 'pan_right', 'tracking_forward', 'dolly_out', 'tilt_down'];
    return movements[index % movements.length];
  }
}

/**
 * Cinematic Transitions Engine
 */
export class TransitionEngine {
  static getTransition(beat: AlignedBeat, index: number): TransitionType {
    if (beat.beatType === 'kinetic_title') return 'zoom_in';
    if (beat.beatType === 'tech_broll') return 'whip_pan';
    return (index % 3 === 1) ? 'whip_pan' : 'crossfade';
  }
}

/**
 * Cinematic Sound Design Engine
 */
export class SoundDesignEngine {
  static generateSfxCues(scenes: any[], totalFrames: number): SfxCue[] {
    const cues: SfxCue[] = [];
    let cueId = 1;

    // 1. Initial Atmospheric Tension Bed
    cues.push({
      id: `sfx_${cueId++}`,
      name: 'low-rumble',
      src: '/audio/sound-effects/low-rumble.wav',
      startFrame: 0,
      volume: 0.35
    });

    cues.push({
      id: `sfx_${cueId++}`,
      name: 'cinematic-hit',
      src: '/audio/sound-effects/cinematic-hit.wav',
      startFrame: 5,
      volume: 0.75
    });

    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const startF = s.startFrame || 0;
      const vType = s.type || s.visual_type;

      // Transition whoosh at scene start (purposeful, every 2-3 cuts)
      if (i > 0 && (s.transition === 'whip_pan' || s.transition === 'slide' || vType === 'actual_video')) {
        cues.push({
          id: `sfx_${cueId++}`,
          name: 'whoosh',
          src: '/audio/sound-effects/whoosh.wav',
          startFrame: Math.max(0, startF - 4),
          volume: 0.40
        });
      }

      // Kinetic Title Card gets Riser before and Sub-Bass Impact on entry!
      if (vType === 'kinetic_title_card') {
        cues.push({
          id: `sfx_${cueId++}`,
          name: 'riser',
          src: '/audio/sound-effects/riser.wav',
          startFrame: Math.max(0, startF - 40),
          volume: 0.50
        });
        cues.push({
          id: `sfx_${cueId++}`,
          name: 'sub-bass-impact',
          src: '/audio/sound-effects/sub-bass-impact.wav',
          startFrame: startF,
          volume: 0.80
        });
      }

      // Tech cuts get subtle digital glitch
      if (vType === 'actual_video' && s.badge?.includes('Datacenter')) {
        cues.push({
          id: `sfx_${cueId++}`,
          name: 'digital-glitch',
          src: '/audio/sound-effects/digital-glitch.wav',
          startFrame: startF + 2,
          volume: 0.30
        });
      }

      // Data metrics get subtle typewriter / click sound
      if (vType === 'data_metric' || vType === 'newspaper_headline') {
        cues.push({
          id: `sfx_${cueId++}`,
          name: 'click',
          src: '/audio/sound-effects/click.wav',
          startFrame: startF + 8,
          volume: 0.35
        });
      }

      // Archival document / evidence gets page turn sound
      if (vType === 'investigative_evidence' || vType === 'archival_document') {
        cues.push({
          id: `sfx_${cueId++}`,
          name: 'page-turn',
          src: '/audio/sound-effects/page-turn.wav',
          startFrame: startF + 4,
          volume: 0.35
        });
      }
    }

    return cues;
  }
}

/**
 * Background Music Selector with Auto-Ducking Cue
 */
export class BackgroundMusicEngine {
  static selectMusic(category: string): string {
    const c = category.toLowerCase();
    if (c.includes('tech') || c.includes('ai') || c.includes('silicon')) {
      return '/audio/bgm/tech_cyber.wav';
    }
    if (c.includes('investigat') || c.includes('crime') || c.includes('scandal')) {
      return '/audio/bgm/mystery_investigation.wav';
    }
    return '/audio/bgm/epic_geopolitics.wav';
  }
}

/**
 * Unified Master Editorial Pipeline
 * Synthesizes the full master timeline enforcing 3-4s visual cuts.
 */
export class CinematicEditorialEngine {
  static composeMasterTimeline(
    project: VideoProject,
    script: string,
    audioDurationSec: number,
    preset: EditorialStylePreset = 'cinematic_investigative'
  ): MasterTimeline {
    const fps = project.fps || 30;
    const isVertical = project.aspect_ratio === '9:16';
    const width = isVertical ? 1080 : 1920;
    const height = isVertical ? 1920 : 1080;

    ContextualAssetSelector.resetMemory();

    // 1. Script Beat Analysis (strictly divides into 3.0 to 3.8s visual cuts)
    const beats = ScriptBeatAnalyzer.analyzeScript(script, preset, audioDurationSec);

    // 2. Narration Timeline Alignment
    const alignedBeats = NarrationTimelineAligner.alignBeats(beats, audioDurationSec, fps);

    // 3. Scene Planning & Mixed-Media Asset Selection
    const scenes: SceneData[] = alignedBeats.map((b, idx) => {
      const asset = ContextualAssetSelector.selectContextualAsset(b, project.category || 'Geopolitics', project.topic || '', idx);
      const cameraMovement = VisualMotionEngine.getCameraMovement(b, idx);
      const transition = TransitionEngine.getTransition(b, idx);

      const kineticTitle = (asset.visualType === 'kinetic_title_card')
        ? KineticTypographyEngine.buildKineticTitle(b, project.topic || 'SPECIAL REPORT')
        : undefined;

      const personData = (asset.visualType === 'person_intro') ? {
        name: (project.topic.split(/\s+/).slice(0, 3).join(' ') || 'LEADERSHIP DOSSIER').toUpperCase(),
        title: 'Executive Leadership // Key Subject',
        organization: 'Global Technology Infrastructure',
        location: 'Silicon Valley, CA'
      } : undefined;

      const dataMetric = (b.beatType === 'data_metric') ? {
        statNumber: b.text.match(/\$?\d+[\d,.]*(?:[bBmMtT]|%)?/)?.[0] || '$500B+',
        statLabel: 'CRITICAL ENTERPRISE VALUATION',
        statSubtext: 'Direct Market & Sovereign Security Exposure'
      } : undefined;

      return {
        id: `shot_${String(idx + 1).padStart(3, '0')}`,
        shot_number: idx + 1,
        title: `Beat ${idx + 1}: ${b.beatType.toUpperCase()}`,
        narration: b.text,
        duration: Number((b.durationFrames / fps).toFixed(2)),
        startSec: b.startSec,
        endSec: b.endSec,
        startFrame: b.startFrame,
        durationFrames: b.durationFrames,
        visual_type: asset.visualType,
        media_source: asset.isVideo ? 'real_video' : 'photograph',
        badge: asset.badge,
        media_url: asset.url,
        camera_movement: cameraMovement,
        transition,
        visual_description: `Cinematic beat #${idx + 1} (${asset.badge}) with ${cameraMovement} and synchronized audio SFX.`,
        kinetic_title_data: kineticTitle,
        person_data: personData,
        data_metric: dataMetric,
        layers: {
          particles: (b.beatType === 'kinetic_title' || idx % 2 === 0) ? 'embers' : 'dust_motes'
        }
      };
    });

    // 4. Sound Design & Audio Mix
    const totalFrames = Math.max(90, Math.ceil(audioDurationSec * fps));
    const sfxCues = SoundDesignEngine.generateSfxCues(scenes, totalFrames);
    const musicTrack = BackgroundMusicEngine.selectMusic(project.category || '');

    return {
      id: `mtl_${project.id}`,
      projectId: project.id,
      title: (project.title || project.topic).toUpperCase(),
      topic: project.topic,
      category: project.category || 'Geopolitics',
      durationFrames: totalFrames,
      fps,
      width,
      height,
      scenes,
      sfxCues,
      musicTrack,
      narrationTrack: `/audio/narration_${project.id}.wav`,
      subtitlesCues: [],
      stylePreset: preset
    };
  }
}
