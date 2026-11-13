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
  beatType: 'hook' | 'subject_intro' | 'tech_broll' | 'corporate_setting' | 'kinetic_title' | 'evidence' | 'data_metric' | 'map' | 'revelation' | 'climax' | 'conclusion';
  keywords: string[];
  highlightEntity?: string;
}

export interface AlignedBeat extends ScriptBeat {
  startSec: number;
  endSec: number;
  startFrame: number;
  durationFrames: number;
}

export class ScriptBeatAnalyzer {
  static analyzeScript(script: string, preset: EditorialStylePreset = 'cinematic_investigative', targetDurationSec = 120): ScriptBeat[] {
    const rawSentences = script
      .replace(/\r?\n+/g, ' ')
      .split(/(?<=[.!?।])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const beats: ScriptBeat[] = [];
    let beatIdx = 0;

    for (const sentence of rawSentences) {
      const words = sentence.split(/\s+/);
      
      // Dynamic chunking based on preset
      const maxWordsPerBeat = preset === 'fast_documentary' ? 6 : (preset === 'cinematic_investigative' ? 7 : 9);

      if (words.length <= maxWordsPerBeat) {
        beats.push(this.classifyBeat(sentence, beatIdx++));
      } else {
        // Natural clause splitting on punctuation and conjunctions
        const clauses = sentence
          .split(/(?<=[,;:\-—])\s+|\s+(?:and then|while|whereas|however|which revealed|but|suddenly)\s+/i)
          .map(c => c.trim())
          .filter(c => c.length > 0);

        if (clauses.length > 1) {
          for (const c of clauses) {
            const cw = c.split(/\s+/);
            if (cw.length > maxWordsPerBeat + 3) {
              const mid = Math.floor(cw.length / 2);
              beats.push(this.classifyBeat(cw.slice(0, mid).join(' '), beatIdx++));
              beats.push(this.classifyBeat(cw.slice(mid).join(' '), beatIdx++));
            } else {
              beats.push(this.classifyBeat(c, beatIdx++));
            }
          }
        } else {
          for (let i = 0; i < words.length; i += maxWordsPerBeat) {
            const chunk = words.slice(i, i + maxWordsPerBeat).join(' ');
            if (chunk.length > 0) beats.push(this.classifyBeat(chunk, beatIdx++));
          }
        }
      }
    }

    return beats;
  }

  private static classifyBeat(text: string, index: number): ScriptBeat {
    const lower = text.toLowerCase();
    const words = text.split(/\s+/);
    const estSec = Math.max(1.6, Math.min(3.6, Number((words.length / 2.5).toFixed(1))));

    // Identify highlight entities and keywords
    const keywords = words
      .map(w => w.replace(/[^\w]/g, ''))
      .filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'were', 'been', 'their', 'which', 'there'].includes(w.toLowerCase()));

    let beatType: ScriptBeat['beatType'] = 'revelation';
    let highlightEntity: string | undefined = undefined;

    // Check specific narrative triggers matching the reference style
    if (index === 0) {
      beatType = 'subject_intro'; // Moody portrait of the main subject/CEO
    } else if (lower.includes('silicon') || lower.includes('server') || lower.includes('gpu') || lower.includes('chip') || lower.includes('datacenter') || lower.includes('computing') || lower.includes('artificial intelligence')) {
      beatType = 'tech_broll';
      highlightEntity = 'SILICON ARCHITECTURE';
    } else if (lower.includes('boardroom') || lower.includes('office') || lower.includes('corporate') || lower.includes('executive') || lower.includes('closed doors') || lower.includes('night') || lower.includes('building')) {
      beatType = 'corporate_setting';
      highlightEntity = 'EXECUTIVE BOARDROOM';
    } else if (lower.includes('resigns') || lower.includes('scandal') || lower.includes('trap') || lower.includes('secret') || lower.includes('investigation') || lower.includes('collapse') || lower.includes('danger') || index === 3) {
      beatType = 'kinetic_title'; // Giant 3D title card like in reference video!
      highlightEntity = words[0]?.toUpperCase() || 'BREAKING';
    } else if (/\$?\d+[\d,.]*(?:[bBmMtT]|%|billion|million|trillion)?/.test(text)) {
      beatType = 'data_metric';
    } else if (lower.includes('map') || lower.includes('strait') || lower.includes('corridor') || lower.includes('border') || lower.includes('sea') || lower.includes('china') || lower.includes('taiwan')) {
      beatType = 'map';
    } else if (lower.includes('document') || lower.includes('filing') || lower.includes('report') || lower.includes('evidence') || lower.includes('classified')) {
      beatType = 'evidence';
    } else if (index === 1) {
      beatType = 'hook';
    }

    return {
      index,
      text,
      durationEstSec: estSec,
      beatType,
      keywords,
      highlightEntity
    };
  }
}

export class NarrationTimelineAligner {
  static alignBeats(beats: ScriptBeat[], totalAudioDurSec: number, fps = 30): AlignedBeat[] {
    const totalWords = beats.reduce((acc, b) => acc + (b.text.trim().split(/\s+/).length || 4), 0);
    const totalFrames = Math.max(90, Math.ceil(totalAudioDurSec * fps));
    let accumulatedFrames = 0;

    return beats.map((b, idx) => {
      const words = b.text.trim().split(/\s+/).length || 4;
      const shotDurFrames = idx === beats.length - 1
        ? Math.max(40, totalFrames - accumulatedFrames)
        : Math.max(40, Math.round((words / totalWords) * totalFrames));

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

export class KineticTypographyEngine {
  static buildKineticTitle(beat: AlignedBeat, topic: string): SceneData['kinetic_title_data'] {
    const t = topic.toUpperCase();
    const words = beat.text.replace(/[^\w\s]/g, '').trim().split(/\s+/);
    
    // Choose urgent highlight word (red #ff2a2a)
    const hotKeywords = ['RESIGNS', 'COLLAPSE', 'SCANDAL', 'SECRET', 'ALERT', 'TRAP', 'CRITICAL', 'EMPIRE', 'FALL', 'DANGER', 'NVIDIA', 'EXPOSED', 'DEADLIEST'];
    const foundHot = words.find(w => hotKeywords.includes(w.toUpperCase())) || (words.length > 0 ? words[0].toUpperCase() : 'BREAKING');

    let line1 = t.length > 25 ? t.slice(0, 25) : t;
    let line2 = beat.text.slice(0, 35).toUpperCase();

    // Specific styling matching reference video: "THE SILICON TRAP // NVIDIA CEO RESIGNS"
    if (t.includes('NVIDIA') || t.includes('CHIP') || t.includes('SILICON')) {
      line1 = 'THE SILICON TRAP';
      line2 = 'NVIDIA CEO RESIGNS';
    } else if (t.includes('HORMUZ') || t.includes('STRAIT')) {
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

export class BrollSelector {
  static selectBroll(beat: AlignedBeat, category: string, topic: string): { url: string; isVideo: boolean; visualType: VisualShotType; badge: string } {
    const t = (topic + ' ' + beat.text).toLowerCase();

    // Real moving video clips matching reference video
    if (beat.beatType === 'tech_broll') {
      return {
        url: '/videos/library/datacenter_tech.mp4',
        isVideo: true,
        visualType: 'actual_video',
        badge: '[4K Datacenter B-Roll]'
      };
    }

    if (beat.beatType === 'corporate_setting') {
      return {
        url: '/videos/library/finance_trade.mp4',
        isVideo: true,
        visualType: 'actual_video',
        badge: '[Executive Boardroom Video]'
      };
    }

    if (beat.beatType === 'kinetic_title') {
      return {
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=85', // Dark atmospheric texture
        isVideo: false,
        visualType: 'kinetic_title_card',
        badge: '[3D Kinetic Title Card]'
      };
    }

    if (beat.beatType === 'map') {
      return {
        url: '/videos/library/satellite_globe.mp4',
        isVideo: true,
        visualType: 'tactical_map',
        badge: '[Tactical Satellite Map]'
      };
    }

    if (beat.beatType === 'subject_intro') {
      // High-resolution moody executive portrait (matches frame 01 of reference video!)
      return {
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=85',
        isVideo: false,
        visualType: 'person_intro',
        badge: '[Executive Portrait Close-up]'
      };
    }

    if (beat.beatType === 'evidence') {
      return {
        url: '/videos/library/historical_archive.mp4',
        isVideo: true,
        visualType: 'investigative_evidence',
        badge: '[Declassified Evidence Dossier]'
      };
    }

    // High quality editorial fallback
    const fallbackUrl = MediaSourceManager.searchLocalLibraryFootage(beat.text, category);
    return {
      url: fallbackUrl,
      isVideo: false,
      visualType: 'archival_photo',
      badge: '[Archival Photo Analysis]'
    };
  }
}

export class VisualMotionEngine {
  static getCameraMovement(beat: AlignedBeat, index: number): CameraMovement {
    if (beat.beatType === 'subject_intro') return 'dolly_in'; // Slow dramatic push
    if (beat.beatType === 'tech_broll') return 'tracking_forward'; // Datacenter tracking
    if (beat.beatType === 'corporate_setting') return 'dolly_out'; // Boardroom wide pull
    if (beat.beatType === 'kinetic_title') return 'orbit';

    const movements: CameraMovement[] = ['dolly_in', 'pan_left', 'tilt_up', 'pan_right', 'tracking_forward'];
    return movements[index % movements.length];
  }
}

export class TransitionEngine {
  static getTransition(beat: AlignedBeat, index: number): TransitionType {
    if (beat.beatType === 'kinetic_title') return 'zoom_in';
    if (beat.beatType === 'tech_broll') return 'whip_pan';
    return (index % 3 === 1) ? 'whip_pan' : 'crossfade';
  }
}

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

      // Transition whoosh at scene start
      if (i > 0 && (s.transition === 'whip_pan' || s.transition === 'slide' || vType === 'actual_video')) {
        cues.push({
          id: `sfx_${cueId++}`,
          name: 'whoosh',
          src: '/audio/sound-effects/whoosh.wav',
          startFrame: Math.max(0, startF - 5),
          volume: 0.45
        });
      }

      // Kinetic Title Card gets Riser before and Heavy Sub-Bass Hit on impact!
      if (vType === 'kinetic_title_card') {
        cues.push({
          id: `sfx_${cueId++}`,
          name: 'riser',
          src: '/audio/sound-effects/riser.wav',
          startFrame: Math.max(0, startF - 45),
          volume: 0.55
        });
        cues.push({
          id: `sfx_${cueId++}`,
          name: 'sub-bass-impact',
          src: '/audio/sound-effects/sub-bass-impact.wav',
          startFrame: startF,
          volume: 0.85
        });
      }

      // Tech datacenter cuts get subtle digital glitch
      if (vType === 'actual_video' && s.badge?.includes('Datacenter')) {
        cues.push({
          id: `sfx_${cueId++}`,
          name: 'digital-glitch',
          src: '/audio/sound-effects/digital-glitch.wav',
          startFrame: startF + 2,
          volume: 0.35
        });
      }

      // Data metrics get subtle typewriter / click sound
      if (vType === 'data_metric' || vType === 'newspaper_headline') {
        cues.push({
          id: `sfx_${cueId++}`,
          name: 'click',
          src: '/audio/sound-effects/click.wav',
          startFrame: startF + 10,
          volume: 0.35
        });
      }
    }

    return cues;
  }
}

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

export class CinematicEditorialEngine {
  /**
   * Unified Master Editorial Pipeline
   * Takes a project, script, and audio duration, and generates the complete synchronized MasterTimeline
   */
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

    // 1. Script Beat Analysis
    const beats = ScriptBeatAnalyzer.analyzeScript(script, preset, audioDurationSec);

    // 2. Narration Timeline Alignment
    const alignedBeats = NarrationTimelineAligner.alignBeats(beats, audioDurationSec, fps);

    // 3. Scene Planning & Asset Selection
    const scenes: SceneData[] = alignedBeats.map((b, idx) => {
      const broll = BrollSelector.selectBroll(b, project.category || 'Geopolitics', project.topic || '');
      const cameraMovement = VisualMotionEngine.getCameraMovement(b, idx);
      const transition = TransitionEngine.getTransition(b, idx);

      const kineticTitle = (broll.visualType === 'kinetic_title_card')
        ? KineticTypographyEngine.buildKineticTitle(b, project.topic || 'SPECIAL REPORT')
        : undefined;

      const personData = (broll.visualType === 'person_intro') ? {
        name: project.topic.split(/\s+/).slice(0, 3).join(' ').toUpperCase(),
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
        visual_type: broll.visualType,
        media_source: broll.isVideo ? 'real_video' : 'photograph',
        badge: broll.badge,
        media_url: broll.url,
        camera_movement: cameraMovement,
        transition,
        visual_description: `Cinematic beat #${idx + 1} (${broll.badge}) with ${cameraMovement} and synchronized audio SFX.`,
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
