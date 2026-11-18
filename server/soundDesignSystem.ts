import path from 'path';
import fs from 'fs';

export interface SfxMeta {
  id: string;
  name: string;
  filename: string;
  category: string;
  license: string;
  source: string;
  commercial_allowed: boolean;
  description: string;
}

export interface BgmMeta {
  id: string;
  title: string;
  filename: string;
  genre: string;
  mood: string;
  license: string;
  source: string;
  commercial_allowed: boolean;
  copyright_risk: 'zero' | 'low';
}

export const SFX_CATALOG: SfxMeta[] = [
  { id: 'whoosh', name: 'Whoosh', filename: 'whoosh.wav', category: 'movement', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Fast air displacement for dynamic camera and map sweeps' },
  { id: 'swish', name: 'Swish', filename: 'swish.wav', category: 'movement', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Subtle high-frequency card pass for fast transitions' },
  { id: 'click', name: 'Tactile Click', filename: 'click.wav', category: 'interface', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Crisp tactile switch for milestone nodes and data points' },
  { id: 'paper_movement', name: 'Paper Movement', filename: 'paper-movement.wav', category: 'tactile', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Textured flutter for paper-cut collage and archival assets' },
  { id: 'newspaper_impact', name: 'Newspaper Impact', filename: 'newspaper-impact.wav', category: 'editorial', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Heavy editorial stamp thump for newspaper headlines' },
  { id: 'camera_shutter', name: 'Camera Shutter', filename: 'camera-shutter.wav', category: 'mechanical', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Dual-blade shutter snap for person intros and archival photos' },
  { id: 'bass_impact', name: 'Bass Impact', filename: 'bass-impact.wav', category: 'impact', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Deep 48Hz resonant punch for critical statistics and claims' },
  { id: 'subtle_riser', name: 'Subtle Riser', filename: 'subtle-riser.wav', category: 'transition', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Crescendo build preceding chapter titles and reveals' },
  { id: 'cinematic_transition', name: 'Cinematic Transition', filename: 'cinematic-transition.wav', category: 'transition', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Dramatic hit with flanged tail for major chapter shifts' },
  { id: 'typing', name: 'Typing Sounds', filename: 'typing.wav', category: 'tactile', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Rapid teleprinter / mechanical keyboard data input' },
  { id: 'digital_interface', name: 'Digital Interface', filename: 'digital-interface.wav', category: 'interface', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Futuristic HUD telemetry ping for graphs and charts' },
  { id: 'ambient_sound', name: 'Ambient Atmospheric Drone', filename: 'ambient-sound.wav', category: 'atmosphere', license: 'CC0 Public Domain', source: 'Procedural Audio Synthesis', commercial_allowed: true, description: 'Low 110Hz tension drone maintaining cinematic presence' }
];

export const BGM_CATALOG: BgmMeta[] = [
  { id: 'epic_geopolitics', title: 'Epic Geopolitics & Sovereign Power', filename: 'epic_geopolitics.wav', genre: 'Cinematic Orchestral', mood: 'Serious, Grand, Tense', license: 'Royalty-Free Commercial', source: 'Procedural Studio Synthesis', commercial_allowed: true, copyright_risk: 'zero' },
  { id: 'tech_cyber', title: 'Silicon Frontier & Compute Core', filename: 'tech_cyber.wav', genre: 'Electronic Ambient', mood: 'Futuristic, Analytical', license: 'Royalty-Free Commercial', source: 'Procedural Studio Synthesis', commercial_allowed: true, copyright_risk: 'zero' },
  { id: 'ambient_documentary', title: 'Historical Inquiry & Archive', filename: 'ambient_documentary.wav', genre: 'Minimal Acoustic', mood: 'Reflective, Curious', license: 'Royalty-Free Commercial', source: 'Procedural Studio Synthesis', commercial_allowed: true, copyright_risk: 'zero' },
  { id: 'mystery_investigation', title: 'Corporate Whistleblower Dossier', filename: 'mystery_investigation.wav', genre: 'Dark Drone', mood: 'Suspenseful, Cold', license: 'Royalty-Free Commercial', source: 'Procedural Studio Synthesis', commercial_allowed: true, copyright_risk: 'zero' },
  { id: 'corporate_tech', title: 'Strategic Capital & Valuation', filename: 'corporate_tech_generated.wav', genre: 'Corporate Minimal', mood: 'Confident, Precise', license: 'Royalty-Free Commercial', source: 'Procedural Studio Synthesis', commercial_allowed: true, copyright_risk: 'zero' }
];

export interface SoundCueItem {
  id: string;
  name: string;
  src: string;
  startFrame: number;
  volume: number;
  rationale: string;
}

export class SoundDesignSystem {
  /**
   * Intelligently selects a copyright-safe BGM track matching documentary theme
   */
  static selectBgm(topicOrCategory: string): { trackPath: string; meta: BgmMeta } {
    const text = (topicOrCategory || '').toLowerCase();
    let chosen = BGM_CATALOG[0]; // epic_geopolitics default

    if (text.includes('tech') || text.includes('ai') || text.includes('silicon') || text.includes('nvidia') || text.includes('chip') || text.includes('asml') || text.includes('computing')) {
      chosen = BGM_CATALOG.find(b => b.id === 'tech_cyber') || chosen;
    } else if (text.includes('investigat') || text.includes('fraud') || text.includes('scandal') || text.includes('classified') || text.includes('crime')) {
      chosen = BGM_CATALOG.find(b => b.id === 'mystery_investigation') || chosen;
    } else if (text.includes('business') || text.includes('billionaire') || text.includes('finance') || text.includes('valuation') || text.includes('stock')) {
      chosen = BGM_CATALOG.find(b => b.id === 'corporate_tech') || chosen;
    } else if (text.includes('history') || text.includes('war') || text.includes('century') || text.includes('treaty') || text.includes('empire')) {
      chosen = BGM_CATALOG.find(b => b.id === 'ambient_documentary') || chosen;
    }

    return {
      trackPath: `/audio/bgm/${chosen.filename}`,
      meta: chosen
    };
  }

  /**
   * Maps on-screen events to exact frame-calibrated sound design cues
   */
  static generateSceneSfx(scenes: any[], fps = 30): SoundCueItem[] {
    const cues: SoundCueItem[] = [];
    let counter = 1;

    // Bed: subtle low ambient presence
    cues.push({
      id: `sfx_${counter++}`,
      name: 'ambient-sound',
      src: '/audio/sound-effects/ambient-sound.wav',
      startFrame: 0,
      volume: 0.25,
      rationale: 'Establishes continuous atmospheric presence'
    });

    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const startF = s.startFrame || (i * 90);
      const vType = s.type || s.visual_type || 'archival_photo';

      // 1. Paper-cut animation -> paper movement sound
      if (vType === 'paper_cut') {
        cues.push({
          id: `sfx_${counter++}`,
          name: 'paper-movement',
          src: '/audio/sound-effects/paper-movement.wav',
          startFrame: startF + 2,
          volume: 0.55,
          rationale: 'Tactile paper rustle on collage assembly'
        });
      }

      // 2. Fast map transition -> subtle whoosh or swish
      else if (vType === 'tactical_map' || s.map_config || s.mapConfig) {
        cues.push({
          id: `sfx_${counter++}`,
          name: 'whoosh',
          src: '/audio/sound-effects/whoosh.wav',
          startFrame: Math.max(0, startF - 3),
          volume: 0.45,
          rationale: 'Air displacement during strategic geographic repositioning'
        });
        cues.push({
          id: `sfx_${counter++}`,
          name: 'swish',
          src: '/audio/sound-effects/swish.wav',
          startFrame: startF + 15,
          volume: 0.35,
          rationale: 'Geodesic flight path sweep'
        });
      }

      // 3. Important statistic -> subtle bass impact
      else if (vType === 'data_metric' || s.data_metric || s.dataMetric) {
        cues.push({
          id: `sfx_${counter++}`,
          name: 'bass-impact',
          src: '/audio/sound-effects/bass-impact.wav',
          startFrame: startF + 3,
          volume: 0.70,
          rationale: 'Deep sub-bass impact emphasizing critical financial record'
        });
      }

      // 4. News headline -> newspaper or editorial impact sound
      else if (vType === 'newspaper_headline' || s.newspaper_data || s.newspaperData) {
        cues.push({
          id: `sfx_${counter++}`,
          name: 'newspaper-impact',
          src: '/audio/sound-effects/newspaper-impact.wav',
          startFrame: startF + 2,
          volume: 0.65,
          rationale: 'Heavy print press impact stamp on archival headline'
        });
      }

      // 5. New chapter -> cinematic transition + subtle riser
      else if (vType === 'chapter_title' || vType === 'kinetic_title_card' || i === 0) {
        if (startF > 30) {
          cues.push({
            id: `sfx_${counter++}`,
            name: 'subtle-riser',
            src: '/audio/sound-effects/subtle-riser.wav',
            startFrame: Math.max(0, startF - 35),
            volume: 0.40,
            rationale: 'Pre-chapter tension buildup'
          });
        }
        cues.push({
          id: `sfx_${counter++}`,
          name: 'cinematic-transition',
          src: '/audio/sound-effects/cinematic-transition.wav',
          startFrame: startF,
          volume: 0.75,
          rationale: 'Decisive thematic chapter boundary transition'
        });
      }

      // 6. Person Intro -> camera shutter
      else if (vType === 'person_intro' || s.person_data || s.personData) {
        cues.push({
          id: `sfx_${counter++}`,
          name: 'camera-shutter',
          src: '/audio/sound-effects/camera-shutter.wav',
          startFrame: startF + 4,
          volume: 0.50,
          rationale: 'Photographic capture sound on executive profile'
        });
      }

      // 7. Graph / Chart -> digital interface telemetry
      else if (vType === 'chart_graph') {
        cues.push({
          id: `sfx_${counter++}`,
          name: 'digital-interface',
          src: '/audio/sound-effects/digital-interface.wav',
          startFrame: startF + 5,
          volume: 0.40,
          rationale: 'Technical HUD data render ping'
        });
      }

      // 8. Animated Timeline -> tactile click
      else if (vType === 'timeline_event') {
        cues.push({
          id: `sfx_${counter++}`,
          name: 'click',
          src: '/audio/sound-effects/click.wav',
          startFrame: startF + 6,
          volume: 0.45,
          rationale: 'Milestone notch indicator click'
        });
      }

      // 9. Standard cuts with fast transitions
      else if (i > 0 && (s.transition === 'whip_pan' || s.transition === 'slide' || s.transition === 'zoom_in')) {
        cues.push({
          id: `sfx_${counter++}`,
          name: 'swish',
          src: '/audio/sound-effects/swish.wav',
          startFrame: Math.max(0, startF - 3),
          volume: 0.35,
          rationale: 'Whip transition motion accent'
        });
      }
    }

    return cues;
  }

  /**
   * Generates audio ducking profile:
   * Narration speech -> background music lowered to duckVolume (-18 dB, approx 0.12)
   * Pauses / Scene breaks -> background music swells to baseVolume (-8 dB, approx 0.35)
   */
  static calculateDuckingRanges(subtitleCues: Array<{ startFrame: number; endFrame: number }>): Array<{ start: number; end: number }> {
    return subtitleCues.map(c => ({
      start: Math.max(0, c.startFrame - 4),
      end: c.endFrame + 4
    }));
  }
}
