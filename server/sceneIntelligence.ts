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
  searchQuery: string;
  personData?: {
    name: string;
    title: string;
    organization?: string;
    location?: string;
  };
  newspaperData?: {
    headline: string;
    publication: string;
    date?: string;
    snippet?: string;
  };
  comparisonData?: {
    leftImage?: string;
    rightImage?: string;
    leftLabel?: string;
    rightLabel?: string;
  };
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
   * Fast-Paced Script Segmenter (1.5s - 2.5s per visual beat)
   * Splits script into granular, rhythmic visual beats matched to human documentary editing
   */
  static segmentScriptIntoBeats(script: string, targetDurationSec = 120): string[] {
    const rawSentences = script
      .replace(/\r?\n+/g, ' ')
      .split(/(?<=[.!?।])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const beats: string[] = [];

    for (const sentence of rawSentences) {
      const words = sentence.split(/\s+/);
      
      // If short sentence (under 8 words), keep as a single punchy beat (1.5-2.5s)
      if (words.length <= 8) {
        beats.push(sentence);
        continue;
      }

      // Split longer sentences on natural semantic pauses: commas, semicolons, colons, dashes, conjunctions
      const clauses = sentence
        .split(/(?<=[,;:\-—])\s+|\s+(?:and then|whereas|while|which led to|however|in contrast|as a result)\s+/i)
        .map(c => c.trim())
        .filter(c => c.length > 0);

      if (clauses.length > 1) {
        for (const c of clauses) {
          const cw = c.split(/\s+/);
          if (cw.length > 10) {
            // Further slice into 5-6 word visual cuts
            const mid = Math.floor(cw.length / 2);
            beats.push(cw.slice(0, mid).join(' '));
            beats.push(cw.slice(mid).join(' '));
          } else {
            beats.push(c);
          }
        }
      } else {
        // Chunk sentence into 6-7 word rapid visual beats
        const chunkSize = 6;
        for (let i = 0; i < words.length; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize).join(' ');
          if (chunk.length > 0) beats.push(chunk);
        }
      }
    }

    return beats;
  }

  /**
   * Deep semantic analysis of narration beat
   * Determines exact component, visual query, and camera dynamics
   */
  static analyzeNarration(
    narration: string,
    topic: string,
    category: string,
    index: number,
    previousMovement?: CameraMovement
  ): SemanticSceneContext {
    const text = narration.toLowerCase();
    const cleanTopic = topic.replace(/[^\w\s]/g, ' ').trim();

    // 1. Cinematic Opening Hook (Beat 0)
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
        keywords: [topic, 'headline', 'investigation'],
        searchQuery: `${cleanTopic} documentary photo`
      };
    }

    // Camera movement rotation for continuous cinematic motion
    const movements: CameraMovement[] = [
      'dolly_in', 'pan_left', 'dolly_out', 'pan_right', 'tilt_up', 'tracking_forward', 'tilt_down', 'aerial_zoom'
    ];
    const chosenMovement = movements.filter(m => m !== previousMovement)[index % movements.length] || 'dolly_in';

    // 2. Person Introduction (Key Leaders, CEOs, Founders, Politicians)
    const personKeywords = [
      'jensen huang', 'alice huang', 'lori huang', 'donald trump', 'trump', 'biden', 'xi jinping',
      'ceo', 'founder', 'president', 'executive', 'director', 'investigator', 'billionaire',
      'minister', 'official', 'spokesperson', 'chairman', 'leader', 'huang'
    ];
    const foundPerson = personKeywords.find(pk => text.includes(pk));

    if (foundPerson) {
      let personName = 'KEY LEADERSHIP';
      let personRole = 'STRATEGIC DECISION MAKER';
      let personOrg = cleanTopic.split(/\s+/)[0]?.toUpperCase() || 'EXECUTIVE';

      if (text.includes('jensen') || text.includes('jensen huang')) {
        personName = 'JENSEN HUANG';
        personRole = 'CO-FOUNDER & CHIEF EXECUTIVE OFFICER';
        personOrg = 'NVIDIA CORPORATION';
      } else if (text.includes('alice huang') || text.includes('huang le')) {
        personName = 'ALICE HUANG';
        personRole = 'FORMER EXECUTIVE // MEGASPEED';
        personOrg = 'MEGASPEED INTERNATIONAL';
      } else if (text.includes('lori huang')) {
        personName = 'LORI HUANG';
        personRole = 'FAMILY SPOUSE // PRIVATE ESTATE';
        personOrg = 'PERSONAL DOSSIER';
      } else if (text.includes('trump')) {
        personName = 'DONALD TRUMP';
        personRole = '47TH PRESIDENT OF THE UNITED STATES';
        personOrg = 'EXECUTIVE BRANCH // WASHINGTON D.C.';
      } else if (text.includes('xi jinping')) {
        personName = 'XI JINPING';
        personRole = 'PRESIDENT OF THE PEOPLES REPUBLIC OF CHINA';
        personOrg = 'BEIJING // STATE COUNCIL';
      } else {
        const words = narration.split(/\s+/);
        personName = words.slice(0, 3).join(' ').toUpperCase();
      }

      return {
        visualType: 'person_intro',
        mediaSource: 'photograph',
        badge: '[Person Dossier]',
        title: personName,
        location: personOrg,
        coordinates: "37°23'11\"N // 122°01'52\"W",
        cameraMovement: 'dolly_in',
        transition: 'whip_pan',
        keywords: [personName, 'portrait', 'official photo', personOrg],
        searchQuery: `${personName} official portrait photo`,
        personData: {
          name: personName,
          title: personRole,
          organization: personOrg,
          location: 'EXECUTIVE INTELLIGENCE'
        }
      };
    }

    // 3. Breaking News, Media Headlines & Leaks
    if (
      text.includes('reported') || text.includes('headline') || text.includes('press') ||
      text.includes('news') || text.includes('media') || text.includes('journal') ||
      text.includes('breaking') || text.includes('article') || text.includes('times') ||
      text.includes('bloomberg') || text.includes('reuters') || text.includes('post') ||
      text.includes('apolog') || text.includes('scandal') || text.includes('published') ||
      text.includes('allegation') || text.includes('leaked') || text.includes('statement')
    ) {
      const pubNames = ['THE WALL STREET JOURNAL', 'THE FINANCIAL TIMES', 'THE WASHINGTON POST', 'REUTERS INVESTIGATES', 'BLOOMBERG NEWS'];
      const chosenPub = pubNames[index % pubNames.length];
      const headlineSnippet = narration.length > 55 ? narration.slice(0, 52).toUpperCase() + '...' : narration.toUpperCase();

      return {
        visualType: 'newspaper_headline',
        mediaSource: 'archival',
        badge: '[Press Headline]',
        title: chosenPub,
        location: 'MEDIA WIRE // SPECIAL REPORT',
        coordinates: "40°42'46\"N // 74°00'22\"W",
        cameraMovement: 'tilt_up',
        transition: 'whip_pan',
        keywords: ['newspaper', 'headline', 'press', 'breaking news', cleanTopic],
        searchQuery: `${cleanTopic} news headline newspaper article`,
        newspaperData: {
          headline: headlineSnippet,
          publication: chosenPub,
          date: 'NOVEMBER 2026 // BREAKING INVESTIGATION',
          snippet: narration
        }
      };
    }

    // 4. Numerical Data, Economic Scale & Financial Charts
    const numberMatch = narration.match(/(\$?\d+(\.\d+)?\s*(trillion|billion|million|percent|%|barrels?|tons?|chips?|flops?))/i);
    if (
      numberMatch || text.includes('percent') || text.includes('valuation') ||
      text.includes('gdp') || text.includes('revenue') || text.includes('market cap') ||
      text.includes('cost') || text.includes('billion') || text.includes('trillion') ||
      text.includes('quarter') || text.includes('growth') || text.includes('stocks')
    ) {
      const statNum = numberMatch ? numberMatch[0].toUpperCase() : '$3.2 TRILLION';
      return {
        visualType: 'data_metric',
        mediaSource: 'motion_graphics',
        badge: '[Data Metric]',
        title: 'Global Economic Telemetry',
        location: 'COMMODITIES & FISCAL TELEMETRY',
        coordinates: "40°42'46\"N // 74°00'22\"W",
        cameraMovement: 'dolly_in',
        transition: 'whip_pan',
        keywords: ['finance', 'chart', 'market', 'datacenter', cleanTopic],
        searchQuery: `${cleanTopic} semiconductor financial chart market`,
        dataMetric: {
          statNumber: statNum,
          statLabel: 'GLOBAL ECONOMIC SCALE',
          statSubtext: narration.length > 85 ? narration.slice(0, 82) + '...' : narration
        }
      };
    }

    // 5. Declassified Evidence, Dossiers, Intelligence Treaties
    if (
      text.includes('treaty') || text.includes('convention') || text.includes('classified') ||
      text.includes('intelligence') || text.includes('fbi') || text.includes('mss') ||
      text.includes('investigation') || text.includes('court') || text.includes('inquiry') ||
      text.includes('document') || text.includes('memorandum') || text.includes('memo') ||
      text.includes('board') || text.includes('oversight') || text.includes('evidence')
    ) {
      return {
        visualType: 'investigative_evidence',
        mediaSource: 'archival',
        badge: '[Classified Evidence]',
        title: 'Declassified Intelligence File',
        location: 'NATIONAL SECURITY REVIEW',
        coordinates: "38°53'52\"N // 77°02'11\"W",
        cameraMovement: 'tilt_up',
        transition: 'whip_pan',
        keywords: ['classified', 'document', 'evidence', 'dossier', 'intelligence'],
        searchQuery: `${cleanTopic} official declassified document file`,
        archivalData: {
          headline: narration.length > 55 ? narration.slice(0, 52).toUpperCase() + '...' : narration.toUpperCase(),
          publication: 'COUNTERINTELLIGENCE SPECIAL INQUIRY',
          date: 'TOP SECRET // DECLASSIFIED RECORD',
          snippet: narration,
          highlightPhrase: narration.slice(0, 48)
        }
      };
    }

    // 6. Tactical Maps & Geopolitical Corridors
    if (
      text.includes('map') || text.includes('border') || text.includes('strait') ||
      text.includes('taiwan') || text.includes('china') || text.includes('singapore') ||
      text.includes('united states') || text.includes('beijing') || text.includes('washington') ||
      text.includes('hormuz') || text.includes('persian gulf') || text.includes('pacific') ||
      text.includes('ocean') || text.includes('sea') || text.includes('corridor') ||
      text.includes('chokepoint') || text.includes('territory') || text.includes('island') ||
      text.includes('supply chain') || text.includes('shipping') || text.includes('transit')
    ) {
      return {
        visualType: 'tactical_map',
        mediaSource: 'motion_graphics',
        badge: '[Tactical Map]',
        title: 'Strategic Geography & Corridors',
        location: 'THEATER COMMAND MAP',
        coordinates: "24°28'11\"N // 120°58'32\"E",
        cameraMovement: 'aerial_zoom',
        transition: 'whip_pan',
        keywords: ['satellite', 'map', 'geography', 'border', cleanTopic],
        searchQuery: `${cleanTopic} satellite map geography territory`
      };
    }

    // 7. Comparative Analysis (Split Screen)
    if (
      text.includes('versus') || text.includes(' vs ') || text.includes('contrast') ||
      text.includes('compared to') || text.includes('two sides') || text.includes('both') ||
      text.includes('between the two') || (index % 7 === 3)
    ) {
      return {
        visualType: 'comparison_split',
        mediaSource: 'photograph',
        badge: '[Comparative Analysis]',
        title: 'Bipolar Strategic Balance',
        location: 'GEOPOLITICAL POWER COMPARISON',
        coordinates: "39°54'15\"N // 116°24'27\"E",
        cameraMovement: 'pan_left',
        transition: 'whip_pan',
        keywords: ['comparison', 'geopolitics', cleanTopic],
        searchQuery: `${cleanTopic} comparative photograph`,
        comparisonData: {
          leftLabel: 'SOVEREIGN MANDATE',
          rightLabel: 'COMMERCIAL ASSET'
        }
      };
    }

    // 8. Layered 2.5D Parallax for Hardware, Architecture & Facilities
    if (
      text.includes('chip') || text.includes('blackwell') || text.includes('superchip') ||
      text.includes('gpu') || text.includes('silicon') || text.includes('architecture') ||
      text.includes('datacenter') || text.includes('supercomputer') || text.includes('server') ||
      (index % 5 === 2)
    ) {
      return {
        visualType: 'layered_parallax',
        mediaSource: 'motion_graphics',
        badge: '[2.5D Depth Parallax]',
        title: 'Advanced Silicon Architecture',
        location: 'HIGH-DENSITY HARDWARE MATRIX',
        coordinates: "37°23'11\"N // 122°01'52\"W",
        cameraMovement: 'tracking_forward',
        transition: 'whip_pan',
        keywords: ['chip', 'silicon', 'hardware', 'datacenter', cleanTopic],
        searchQuery: `${cleanTopic} microchip semiconductor hardware photograph`
      };
    }

    // 9. Authentic Archival / Documentary Photograph (Default Rhythm)
    const queryWords = narration
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 4)
      .join(' ');

    return {
      visualType: 'archival_photo',
      mediaSource: 'photograph',
      badge: '[Archival Photograph]',
      title: 'Historical & Strategic Record',
      location: 'DOCUMENTARY FIELD ARCHIVE',
      coordinates: "35°41'22\"N // 139°41'30\"E",
      cameraMovement: chosenMovement,
      transition: index % 3 === 0 ? 'whip_pan' : 'crossfade',
      keywords: [cleanTopic, queryWords],
      searchQuery: `${cleanTopic} ${queryWords} photograph`
    };
  }
}
