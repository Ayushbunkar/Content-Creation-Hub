import { VisualShotType, MediaSource, CameraMovement, TransitionType, SceneData } from './types';

export interface SemanticSceneContext {
  visualType: VisualShotType;
  mediaSource: MediaSource;
  badge: string;
  title: string;
  location: string;
  coordinates: string;
  cameraMovement: CameraMovement;
  transition: TransitionType;
  keywords: string[];
  historicalPeriod?: string;
  dataMetric?: {
    statNumber: string;
    statLabel: string;
    statSubtext: string;
  };
  archivalData?: {
    headline: string;
    publication: string;
    date: string;
    snippet: string;
    highlightPhrase: string;
  };
}

export class SceneIntelligenceEngine {
  /**
   * Deep semantic analysis of narration sentence
   * Extracts visual focus, entity relationships, timeline anchors, and statistics
   */
  static analyzeNarration(
    narration: string,
    topic: string,
    category: string,
    index: number,
    previousMovement?: CameraMovement
  ): SemanticSceneContext {
    const text = narration.toLowerCase();

    // 1. Hook / Opening scene
    if (index === 0) {
      return {
        visualType: 'cinematic_hook',
        mediaSource: 'motion_graphics',
        badge: '[Cinematic Hook]',
        title: topic.toUpperCase(),
        location: 'GLOBAL DOSSIER',
        coordinates: "37°46'29\"N // 122°25'10\"W",
        cameraMovement: 'dolly_in',
        transition: 'cut',
        keywords: ['hook', 'opening', 'investigation', topic]
      };
    }

    // 2. Numerical Data & Economic Scale Metrics
    const numberMatch = narration.match(/(\$?\d+(\.\d+)?\s*(trillion|billion|million|percent|%|barrels?|tons?))/i);
    if (numberMatch || text.includes('percent') || text.includes('valuation') || text.includes('gdp') || text.includes('revenue') || text.includes('inflation')) {
      const statNum = numberMatch ? numberMatch[0].toUpperCase() : '84.2%';
      return {
        visualType: 'data_metric',
        mediaSource: 'motion_graphics',
        badge: '[Data Metric]',
        title: 'Strategic Market Volume & Global Impact',
        location: 'COMMODITIES & FISCAL TELEMETRY',
        coordinates: "40°42'46\"N // 74°00'22\"W",
        cameraMovement: 'dolly_in',
        transition: 'whip_pan',
        keywords: ['finance', 'chart', 'metric', 'economics', 'data'],
        dataMetric: {
          statNumber: statNum,
          statLabel: 'GLOBAL ECONOMIC SCALE',
          statSubtext: narration.length > 80 ? narration.slice(0, 77) + '...' : narration
        }
      };
    }

    // 3. Declassified Treaties, Court Filings & Archival Documents
    if (
      text.includes('treaty') || text.includes('convention') || text.includes('law') ||
      text.includes('filing') || text.includes('unclos') || text.includes('memo') ||
      text.includes('classified') || text.includes('investigation') || text.includes('allegation') ||
      text.includes('court') || text.includes('dossier') || text.includes('intelligence')
    ) {
      return {
        visualType: 'archival_document',
        mediaSource: 'archival',
        badge: '[Archival Document]',
        title: 'Declassified Intelligence Record',
        location: 'DECLASSIFIED CORRIDOR',
        coordinates: "38°53'52\"N // 77°02'11\"W",
        cameraMovement: 'tilt_up',
        transition: 'whip_pan',
        keywords: ['document', 'archive', 'headline', 'paper', 'press'],
        archivalData: {
          headline: narration.length > 55 ? narration.slice(0, 52).toUpperCase() + '...' : narration.toUpperCase(),
          publication: 'THE INVESTIGATIVE CHRONICLE',
          date: 'DECLASSIFIED DISPATCH // HISTORICAL RECORD',
          snippet: narration,
          highlightPhrase: narration.slice(0, 48)
        }
      };
    }

    // 4. Tactical Maps, Border Boundaries & Nautical Corridors
    if (
      text.includes('map') || text.includes('border') || text.includes('strait') ||
      text.includes('chokepoint') || text.includes('passage') || text.includes('territory') ||
      text.includes('corridor') || text.includes('gulf') || text.includes('taiwan') ||
      text.includes('hormuz') || text.includes('peninsula') || text.includes('ocean') ||
      text.includes('sea') || text.includes('island') || text.includes('sovereign')
    ) {
      return {
        visualType: 'tactical_map',
        mediaSource: 'motion_graphics',
        badge: '[Tactical Map]',
        title: 'Geographic Chokepoint & Strategic Theater',
        location: 'OPERATIONAL MARITIME THEATER',
        coordinates: "26°34'12\"N // 56°15'08\"E",
        cameraMovement: 'aerial_zoom',
        transition: 'whip_pan',
        keywords: ['map', 'geography', 'border', 'territory', 'strait']
      };
    }

    // 5. Layered 2.5D Parallax for Historical Figures, Companies & Hardware
    if (
      text.includes('executive') || text.includes('founder') || text.includes('company') ||
      text.includes('nvidia') || text.includes('apple') || text.includes('pentagon') ||
      text.includes('president') || text.includes('minister') || text.includes('billionaire') ||
      (index % 4 === 2)
    ) {
      return {
        visualType: 'layered_parallax',
        mediaSource: 'motion_graphics',
        badge: '[2.5D Depth Parallax]',
        title: 'Institutional Power Structure',
        location: 'EXECUTIVE INTELLIGENCE',
        coordinates: "37°23'11\"N // 122°01'52\"W",
        cameraMovement: 'tracking_forward',
        transition: 'whip_pan',
        keywords: ['executive', 'institution', 'power', 'technology', 'leadership']
      };
    }

    // 6. Real High-Definition Stock Video Footage (Default Priority)
    const movements: CameraMovement[] = ['dolly_in', 'pan_left', 'dolly_out', 'pan_right', 'orbit'];
    const chosenMovement = movements.filter(m => m !== previousMovement)[index % 4] || 'dolly_in';

    return {
      visualType: 'video_footage',
      mediaSource: 'real_video',
      badge: '[Real Video Footage]',
      title: 'Operational Field Telemetry',
      location: 'FIELD OBSERVATION',
      coordinates: "35°41'22\"N // 139°41'30\"E",
      cameraMovement: chosenMovement,
      transition: index % 3 === 0 ? 'whip_pan' : 'crossfade',
      keywords: narration
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 4)
    };
  }

  /**
   * Intelligent Stock Footage Selector with Deduplication and Semantic Scoring
   */
  static selectBestStockClip(
    keywords: string[],
    category: string,
    usedUrls: Set<string>
  ): { url: string; badge: string; source: MediaSource } {
    const libraryPool: Array<{ tags: string[]; file: string; title: string }> = [
      {
        tags: ['naval', 'ocean', 'ship', 'carrier', 'sea', 'water', 'chokepoint', 'military', 'strait', 'gulf'],
        file: '/videos/library/ocean_naval.mp4',
        title: 'Naval Operations Footage'
      },
      {
        tags: ['chip', 'datacenter', 'silicon', 'tech', 'server', 'supercomputer', 'ai', 'nvidia', 'hardware', 'code'],
        file: '/videos/library/datacenter_tech.mp4',
        title: 'High-Density Datacenter Computing'
      },
      {
        tags: ['satellite', 'space', 'orbit', 'globe', 'earth', 'surveillance', 'geopolitics', 'border', 'radar'],
        file: '/videos/library/satellite_globe.mp4',
        title: 'Orbital Satellite Reconnaissance'
      },
      {
        tags: ['finance', 'trade', 'market', 'money', 'economy', 'stock', 'commodities', 'dollar', 'bank', 'wall street'],
        file: '/videos/library/finance_trade.mp4',
        title: 'Global Commodities & Financial Terminal'
      },
      {
        tags: ['history', 'archive', 'paper', 'black and white', 'retro', 'cold war', 'soviet', 'historical', 'old'],
        file: '/videos/library/historical_archive.mp4',
        title: 'Historical Press Archives'
      },
      {
        tags: ['surveillance', 'military', 'security', 'cctv', 'reconnaissance', 'defense', 'soldier', 'tactical'],
        file: '/videos/library/military_surveillance.mp4',
        title: 'Military Surveillance Feeds'
      }
    ];

    // Score candidates based on keyword matches
    const scored = libraryPool.map(item => {
      let score = 0;
      for (const kw of keywords) {
        if (item.tags.some(tag => kw.includes(tag) || tag.includes(kw))) {
          score += 15;
        }
      }
      if (usedUrls.has(item.file)) {
        score -= 25; // Deduplication penalty to avoid repeating clips
      }
      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const chosen = scored[0].item;
    usedUrls.add(chosen.file);

    return {
      url: chosen.file,
      badge: '[Real Video Footage]',
      source: 'real_video'
    };
  }
}
