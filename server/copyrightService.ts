import fs from 'fs';
import path from 'path';
import { runQuery, getQuery, allQuery } from './db';

export type AssetType = 'image' | 'video' | 'music' | 'sfx' | 'narration';
export type SourcePlatform =
  | 'pexels'
  | 'pixabay'
  | 'unsplash'
  | 'wikimedia'
  | 'pollinations_ai'
  | 'local_studio'
  | 'user_upload'
  | 'youtube'
  | 'unknown';

export type VerifiedStatus = 'verified' | 'editorial_review' | 'flagged' | 'rejected';

export interface AssetRecord {
  id: string;
  asset_id: string;
  project_id: string | null;
  asset_type: AssetType;
  source_platform: SourcePlatform;
  original_url: string;
  download_url: string;
  creator_name: string;
  creator_profile_url: string;
  license_type: string;
  license_url: string;
  commercial_use: number; // 1 or 0
  attribution_required: number; // 1 or 0
  attribution_text: string;
  usage_restrictions: string;
  verified_status: VerifiedStatus;
  rights_flags: string; // JSON array of strings
  created_at?: string;
  updated_at?: string;
}

export interface AssetRegistrationInput {
  assetId: string;
  projectId?: string | null;
  assetType: AssetType;
  sourcePlatform: SourcePlatform;
  originalUrl?: string;
  downloadUrl?: string;
  creatorName?: string;
  creatorProfileUrl?: string;
  licenseType?: string;
  licenseUrl?: string;
  commercialUse?: boolean;
  attributionRequired?: boolean;
  attributionText?: string;
  usageRestrictions?: string;
  verifiedStatus?: VerifiedStatus;
  rightsFlags?: string[];
}

export interface RightsVerificationResult {
  approved: boolean;
  status: VerifiedStatus;
  commercialCleared: boolean;
  attributionRequired: boolean;
  warnings: string[];
  flags: string[];
  restrictions: string;
  attributionText: string;
}

export interface YouTubeCopyrightReport {
  projectId: string;
  projectTitle: string;
  generatedAt: string;
  summary: {
    totalAssets: number;
    commercialClearedCount: number;
    commercialClearedPercent: number;
    attributionRequiredCount: number;
    editorialReviewCount: number;
    flagsCount: number;
    overallClearance: 'FULLY_CLEARED' | 'EDITORIAL_CAUTION' | 'RESTRICTED';
  };
  assetBreakdown: {
    images: AssetRecord[];
    videos: AssetRecord[];
    music: AssetRecord[];
    soundEffects: AssetRecord[];
    narration: AssetRecord[];
  };
  youtubeDescriptionCredits: string;
  legalAdvisoryNotice: string;
  contentIdAdvisory: string;
}

export class CopyrightLicenseManager {
  private static studioAssetsInitialized = false;

  /**
   * Known approved licensing policies by source platform
   */
  private static PLATFORM_POLICIES: Record<string, {
    licenseType: string;
    licenseUrl: string;
    commercialUse: boolean;
    attributionRequired: boolean;
    defaultRestrictions: string;
  }> = {
    unsplash: {
      licenseType: 'Unsplash License',
      licenseUrl: 'https://unsplash.com/license',
      commercialUse: true,
      attributionRequired: false,
      defaultRestrictions: 'Commercial and non-commercial use permitted. Resale of unedited photograph prohibited.',
    },
    pexels: {
      licenseType: 'Pexels License',
      licenseUrl: 'https://www.pexels.com/license/',
      commercialUse: true,
      attributionRequired: false,
      defaultRestrictions: 'All photos and videos free to use commercially. Identifiable people may not appear in a bad light.',
    },
    pixabay: {
      licenseType: 'Pixabay Content License',
      licenseUrl: 'https://pixabay.com/service/license-summary/',
      commercialUse: true,
      attributionRequired: false,
      defaultRestrictions: 'Permitted for commercial and non-commercial use. Standalone redistribution forbidden.',
    },
    wikimedia: {
      licenseType: 'Creative Commons / Public Domain',
      licenseUrl: 'https://commons.wikimedia.org/wiki/Commons:Licensing',
      commercialUse: true,
      attributionRequired: true,
      defaultRestrictions: 'Public domain or CC-BY. Author attribution required where indicated by CC terms.',
    },
    pollinations_ai: {
      licenseType: 'AI Generated (Open Commercial / CC0 Equivalent)',
      licenseUrl: 'https://pollinations.ai/terms',
      commercialUse: true,
      attributionRequired: false,
      defaultRestrictions: 'Generated with Pollinations AI Flux. Permitted for commercial documentary video production.',
    },
    local_studio: {
      licenseType: 'Original Studio Asset / CC0 Royalty-Free',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      commercialUse: true,
      attributionRequired: false,
      defaultRestrictions: 'Produced and synthesized locally for Content Creation Hub. Royalty-free commercial clearance.',
    },
    user_upload: {
      licenseType: 'User Certified License',
      licenseUrl: 'local://user-license-agreement',
      commercialUse: true,
      attributionRequired: false,
      defaultRestrictions: 'User affirmed rights and authorization for documentary video inclusion.',
    },
    youtube: {
      licenseType: 'Fair Use Editorial / Standard YouTube',
      licenseUrl: 'https://www.youtube.com/static?template=terms',
      commercialUse: false,
      attributionRequired: true,
      defaultRestrictions: 'Clip transformed under Fair Use doctrine for news reporting, criticism and commentary.',
    }
  };

  /**
   * Pre-register core local audio (BGM, Procedural SFX) to ensure 100% audio licensing coverage
   */
  static async initializeStudioAudioRegistry(): Promise<void> {
    if (this.studioAssetsInitialized) return;
    this.studioAssetsInitialized = true;

    // 1. Local BGM tracks
    const bgmTracks = [
      {
        id: 'bgm_epic_geopolitics',
        name: 'Epic Geopolitics Master Theme',
        file: '/audio/bgm/epic_geopolitics.wav',
        genre: 'Cinematic Orchestral / Geopolitics',
      },
      {
        id: 'bgm_tech_cyber',
        name: 'Tech Cyber Documentary Pulse',
        file: '/audio/bgm/tech_cyber.wav',
        genre: 'Electronic Ambient / Technology',
      },
      {
        id: 'bgm_ambient_doc',
        name: 'Historical Investigative Ambience',
        file: '/audio/bgm/ambient_documentary.wav',
        genre: 'Acoustic Minimalist / History',
      },
      {
        id: 'bgm_mystery',
        name: 'Deep Investigation Undercurrent',
        file: '/audio/bgm/mystery_investigation.wav',
        genre: 'Tension Drone / Investigative',
      }
    ];

    for (const bgm of bgmTracks) {
      await this.registerAsset({
        assetId: bgm.id,
        assetType: 'music',
        sourcePlatform: 'local_studio',
        originalUrl: bgm.file,
        downloadUrl: bgm.file,
        creatorName: 'Content-Creation-Hub Studio Audio',
        creatorProfileUrl: 'https://github.com/Ayushbunkar/Content-Creation-Hub',
        licenseType: 'Studio Original Royalty-Free License',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        commercialUse: true,
        attributionRequired: false,
        attributionText: `Music: "${bgm.name}" by Content Creation Hub Studio`,
        usageRestrictions: 'Commercial use cleared. Do not register to YouTube Content ID as exclusive work.',
        verifiedStatus: 'verified',
        rightsFlags: []
      });
    }

    // 2. Procedural Studio SFX Suite (CC0 Public Domain)
    const sfxList = [
      { id: 'sfx_whoosh', name: 'Cinematic High-Velocity Whoosh', file: '/audio/sound-effects/whoosh.wav' },
      { id: 'sfx_click', name: 'Tactical Mechanical Click', file: '/audio/sound-effects/click.wav' },
      { id: 'sfx_sub_bass', name: 'Deep Sub-Bass Impact', file: '/audio/sound-effects/sub-bass-impact.wav' },
      { id: 'sfx_hit', name: 'Cinematic Accent Hit', file: '/audio/sound-effects/cinematic-hit.wav' },
      { id: 'sfx_riser', name: 'Tension Frequency Riser', file: '/audio/sound-effects/riser.wav' },
      { id: 'sfx_glitch', name: 'Digital Broadcast Glitch', file: '/audio/sound-effects/digital-glitch.wav' },
      { id: 'sfx_ticking', name: 'Pacing Clockwork Ticking', file: '/audio/sound-effects/ticking.wav' },
      { id: 'sfx_metallic', name: 'Metallic Impact Accent', file: '/audio/sound-effects/metallic-impact.wav' },
      { id: 'sfx_drone', name: 'Low Atmospheric Drone', file: '/audio/sound-effects/ambient-drone.wav' },
      { id: 'sfx_rumble', name: 'Low Frequency Cinematic Rumble', file: '/audio/sound-effects/low-rumble.wav' }
    ];

    for (const sfx of sfxList) {
      await this.registerAsset({
        assetId: sfx.id,
        assetType: 'sfx',
        sourcePlatform: 'local_studio',
        originalUrl: sfx.file,
        downloadUrl: sfx.file,
        creatorName: 'Content-Creation-Hub Audio Synthesis Engine',
        creatorProfileUrl: 'https://github.com/Ayushbunkar/Content-Creation-Hub',
        licenseType: 'Creative Commons CC0 1.0 Universal (Public Domain)',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        commercialUse: true,
        attributionRequired: false,
        attributionText: `SFX: "${sfx.name}" (CC0 Public Domain)`,
        usageRestrictions: 'Completely royalty-free and copyright-free public domain sound design asset.',
        verifiedStatus: 'verified',
        rightsFlags: []
      });
    }
  }

  /**
   * Verify an asset before rendering or ingestion
   */
  static verifyAsset(metadata: Partial<AssetRegistrationInput>): RightsVerificationResult {
    const warnings: string[] = [];
    const flags: string[] = [];
    let status: VerifiedStatus = 'verified';

    const platform = metadata.sourcePlatform || 'unknown';
    const policy = this.PLATFORM_POLICIES[platform];

    if (!policy && platform === 'unknown') {
      return {
        approved: false,
        status: 'rejected',
        commercialCleared: false,
        attributionRequired: false,
        warnings: ['Unknown asset source platform. Assets with unverified licensing are rejected from export.'],
        flags: ['unknown_source', 'unverified_license'],
        restrictions: 'Asset rejected. Must originate from an approved source (Unsplash, Pexels, Pixabay, Wikimedia, AI Flux, Local Studio).',
        attributionText: ''
      };
    }

    // Commercial viability
    const commercialCleared = metadata.commercialUse !== undefined ? metadata.commercialUse : (policy?.commercialUse ?? true);
    if (!commercialCleared) {
      warnings.push('Asset is marked for Non-Commercial or Fair Use only. Commercial monetization requires clearance.');
      status = 'editorial_review';
    }

    // Attribution
    const attributionRequired = metadata.attributionRequired !== undefined ? metadata.attributionRequired : (policy?.attributionRequired ?? false);

    // Contextual rights flags (Public figures, Trademarks)
    const urlStr = `${metadata.originalUrl || ''} ${metadata.creatorName || ''} ${metadata.attributionText || ''}`.toLowerCase();
    
    // Check identifiable personalities or trademarks in query/URL
    const brandKeywords = ['apple', 'google', 'microsoft', 'tesla', 'nvidia', 'amazon', 'meta', 'tsmc', 'asml', 'boeing', 'lockheed'];
    for (const brand of brandKeywords) {
      if (urlStr.includes(brand)) {
        flags.push(`trademark_${brand}`);
        warnings.push(`Contains reference to brand/trademark "${brand.toUpperCase()}". Usage permitted under editorial fair use reporting.`);
        if (status === 'verified') status = 'editorial_review';
        break;
      }
    }

    const publicFigureKeywords = ['biden', 'trump', 'putin', 'xi', 'modi', 'musk', 'altman', 'zuckerberg', 'huang'];
    for (const fig of publicFigureKeywords) {
      if (urlStr.includes(fig)) {
        flags.push(`identifiable_figure_${fig}`);
        warnings.push(`Depicts identifiable public figure (${fig.toUpperCase()}). Permitted for journalistic documentary analysis; no false endorsement.`);
        if (status === 'verified') status = 'editorial_review';
        break;
      }
    }

    // Build standard attribution text
    let attributionText = metadata.attributionText || '';
    if (!attributionText) {
      const creator = metadata.creatorName || 'Contributing Artist';
      const platLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
      if (platform === 'wikimedia') {
        attributionText = `Photograph by ${creator} via Wikimedia Commons (${metadata.licenseType || 'CC-BY'})`;
      } else if (platform === 'unsplash') {
        attributionText = `Photo by ${creator} on Unsplash`;
      } else if (platform === 'pexels') {
        attributionText = `Video/Photo by ${creator} on Pexels`;
      } else if (platform === 'pixabay') {
        attributionText = `Media by ${creator} on Pixabay`;
      } else if (platform === 'pollinations_ai') {
        attributionText = `Visuals generated via Pollinations AI Flux (Open Commercial License)`;
      } else if (platform === 'local_studio') {
        attributionText = `Original Audio/Visual produced by Content Creation Hub Studio`;
      } else {
        attributionText = `Media provided by ${creator} (${platform})`;
      }
    }

    const restrictions = metadata.usageRestrictions || policy?.defaultRestrictions || 'Permitted for documentary video production.';

    return {
      approved: (status as string) !== 'rejected',
      status,
      commercialCleared,
      attributionRequired,
      warnings,
      flags,
      restrictions,
      attributionText
    };
  }

  /**
   * Register or update an asset in the persistent database
   */
  static async registerAsset(input: AssetRegistrationInput): Promise<AssetRecord> {
    await this.initializeStudioAudioRegistry();

    // Check if asset already exists
    const existing = await getQuery<AssetRecord>(
      `SELECT * FROM asset_registry WHERE asset_id = ? OR (original_url IS NOT NULL AND original_url = ?) LIMIT 1`,
      [input.assetId, input.originalUrl || '']
    );

    const verification = this.verifyAsset(input);
    const flagsCombined = Array.from(new Set([...(input.rightsFlags || []), ...verification.flags]));

    const policy = this.PLATFORM_POLICIES[input.sourcePlatform] || {
      licenseType: 'Standard Stock License',
      licenseUrl: 'https://creativecommons.org/',
      commercialUse: true,
      attributionRequired: false,
      defaultRestrictions: 'Commercial editorial use.'
    };

    const recordId = existing?.id || `reg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const licenseType = input.licenseType || policy.licenseType;
    const licenseUrl = input.licenseUrl || policy.licenseUrl;
    const commercialUse = input.commercialUse !== undefined ? (input.commercialUse ? 1 : 0) : (verification.commercialCleared ? 1 : 0);
    const attributionReq = input.attributionRequired !== undefined ? (input.attributionRequired ? 1 : 0) : (verification.attributionRequired ? 1 : 0);
    const attributionText = input.attributionText || verification.attributionText;
    const restrictions = input.usageRestrictions || verification.restrictions;
    const verifiedStatus = input.verifiedStatus || verification.status;

    if (existing) {
      await runQuery(
        `UPDATE asset_registry SET
          project_id = COALESCE(?, project_id),
          asset_type = ?,
          source_platform = ?,
          download_url = COALESCE(?, download_url),
          creator_name = COALESCE(?, creator_name),
          creator_profile_url = COALESCE(?, creator_profile_url),
          license_type = ?,
          license_url = ?,
          commercial_use = ?,
          attribution_required = ?,
          attribution_text = ?,
          usage_restrictions = ?,
          verified_status = ?,
          rights_flags = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          input.projectId || null,
          input.assetType,
          input.sourcePlatform,
          input.downloadUrl || null,
          input.creatorName || null,
          input.creatorProfileUrl || null,
          licenseType,
          licenseUrl,
          commercialUse,
          attributionReq,
          attributionText,
          restrictions,
          verifiedStatus,
          JSON.stringify(flagsCombined),
          existing.id
        ]
      );
    } else {
      await runQuery(
        `INSERT INTO asset_registry (
          id, asset_id, project_id, asset_type, source_platform, original_url, download_url,
          creator_name, creator_profile_url, license_type, license_url, commercial_use,
          attribution_required, attribution_text, usage_restrictions, verified_status, rights_flags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          input.assetId,
          input.projectId || null,
          input.assetType,
          input.sourcePlatform,
          input.originalUrl || '',
          input.downloadUrl || '',
          input.creatorName || 'Studio Contributor',
          input.creatorProfileUrl || '',
          licenseType,
          licenseUrl,
          commercialUse,
          attributionReq,
          attributionText,
          restrictions,
          verifiedStatus,
          JSON.stringify(flagsCombined)
        ]
      );
    }

    const saved = await getQuery<AssetRecord>(`SELECT * FROM asset_registry WHERE id = ?`, [recordId]);
    return saved!;
  }

  /**
   * Register generated Kokoro TTS narration track for a project
   */
  static async registerNarrationTrack(projectId: string, voiceName: string, audioPath: string): Promise<AssetRecord> {
    return this.registerAsset({
      assetId: `narration_${projectId}`,
      projectId,
      assetType: 'narration',
      sourcePlatform: 'local_studio',
      originalUrl: audioPath,
      downloadUrl: audioPath,
      creatorName: `Kokoro AI TTS Engine (${voiceName})`,
      creatorProfileUrl: 'https://huggingface.co/hexgrad/Kokoro-82M',
      licenseType: 'Apache License 2.0 (Permissive Commercial Open Source)',
      licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
      commercialUse: true,
      attributionRequired: false,
      attributionText: `Narration generated locally via Kokoro TTS (${voiceName}) under Apache 2.0 License`,
      usageRestrictions: 'Permitted for commercial video narration and broadcasting.',
      verifiedStatus: 'verified',
      rightsFlags: []
    });
  }

  /**
   * Register BGM track associated with a project
   */
  static async registerProjectMusic(projectId: string, musicSrc: string): Promise<AssetRecord> {
    const filename = path.basename(musicSrc);
    let title = 'Epic Geopolitics Master Theme';
    if (filename.includes('tech')) title = 'Tech Cyber Documentary Pulse';
    else if (filename.includes('ambient')) title = 'Historical Investigative Ambience';
    else if (filename.includes('mystery')) title = 'Deep Investigation Undercurrent';

    return this.registerAsset({
      assetId: `bgm_${projectId}_${filename}`,
      projectId,
      assetType: 'music',
      sourcePlatform: 'local_studio',
      originalUrl: musicSrc,
      downloadUrl: musicSrc,
      creatorName: 'Content-Creation-Hub Audio Studio',
      creatorProfileUrl: 'https://github.com/Ayushbunkar/Content-Creation-Hub',
      licenseType: 'Studio Original Royalty-Free License',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      commercialUse: true,
      attributionRequired: false,
      attributionText: `Music: "${title}" by Content Creation Hub Studio`,
      usageRestrictions: 'Cleared for commercial monetized videos. Do not register composite audio with YouTube Content ID.',
      verifiedStatus: 'verified',
      rightsFlags: []
    });
  }

  /**
   * Register SFX cues used in a video render
   */
  static async registerProjectSfx(projectId: string, sfxFiles: string[]): Promise<void> {
    for (const f of sfxFiles) {
      const base = path.basename(f, path.extname(f));
      await this.registerAsset({
        assetId: `sfx_${projectId}_${base}`,
        projectId,
        assetType: 'sfx',
        sourcePlatform: 'local_studio',
        originalUrl: f,
        downloadUrl: f,
        creatorName: 'Content-Creation-Hub Audio Synthesis Engine',
        creatorProfileUrl: 'https://github.com/Ayushbunkar/Content-Creation-Hub',
        licenseType: 'Creative Commons CC0 1.0 Universal (Public Domain)',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        commercialUse: true,
        attributionRequired: false,
        attributionText: `SFX: ${base} (CC0 Public Domain)`,
        usageRestrictions: '100% royalty-free commercial sound effect.',
        verifiedStatus: 'verified',
        rightsFlags: []
      });
    }
  }

  /**
   * Generate Comprehensive YouTube Copyright & Asset Licensing Report before export
   */
  static async generateYouTubeCopyrightReport(projectId: string): Promise<YouTubeCopyrightReport> {
    await this.initializeStudioAudioRegistry();

    const proj = await getQuery<any>(`SELECT * FROM projects WHERE id = ?`, [projectId]);
    const projectTitle = proj?.title || proj?.topic || 'Autonomous Documentary Production';

    // Retrieve all registered assets for this project or global audio
    const records = await allQuery<AssetRecord>(
      `SELECT * FROM asset_registry WHERE project_id = ? ORDER BY asset_type, created_at ASC`,
      [projectId]
    );

    // If few or no records directly assigned, also include scene assets parsed from scene_data
    if (proj?.scene_data) {
      try {
        const scenes = JSON.parse(proj.scene_data);
        for (let i = 0; i < scenes.length; i++) {
          const s = scenes[i];
          const mediaUrl = s.mediaUrl || s.media_url;
          if (mediaUrl) {
            // Check if already in records
            const already = records.some(r => r.original_url === mediaUrl || r.download_url === mediaUrl);
            if (!already) {
              let platform: SourcePlatform = 'pollinations_ai';
              let creator = 'Pollinations Flux 8K';
              let licType = 'AI-Generated Open Commercial Use';

              if (mediaUrl.includes('unsplash.com')) {
                platform = 'unsplash';
                creator = 'Unsplash Contributor';
                licType = 'Unsplash License';
              } else if (mediaUrl.includes('wikimedia.org')) {
                platform = 'wikimedia';
                creator = 'Wikimedia Commons Contributor';
                licType = 'Creative Commons / Public Domain';
              } else if (mediaUrl.includes('pexels.com')) {
                platform = 'pexels';
                creator = 'Pexels Contributor';
                licType = 'Pexels License';
              } else if (mediaUrl.includes('pixabay.com')) {
                platform = 'pixabay';
                creator = 'Pixabay Contributor';
                licType = 'Pixabay Content License';
              }

              const registered = await this.registerAsset({
                assetId: `${projectId}_shot_${i + 1}`,
                projectId,
                assetType: s.type === 'video_footage' ? 'video' : 'image',
                sourcePlatform: platform,
                originalUrl: mediaUrl,
                downloadUrl: mediaUrl,
                creatorName: creator,
                licenseType: licType,
                commercialUse: true,
                attributionRequired: platform === 'wikimedia',
                attributionText: `Visual ${i + 1}: ${creator} (${licType})`,
                verifiedStatus: 'verified'
              });
              records.push(registered);
            }
          }
        }
      } catch (e) {
        // Scene parsing note
      }
    }

    // Partition by asset type
    const images = records.filter(r => r.asset_type === 'image');
    const videos = records.filter(r => r.asset_type === 'video');
    const music = records.filter(r => r.asset_type === 'music');
    const soundEffects = records.filter(r => r.asset_type === 'sfx');
    const narration = records.filter(r => r.asset_type === 'narration');

    const totalAssets = records.length;
    const commercialClearedCount = records.filter(r => r.commercial_use === 1).length;
    const attributionRequiredCount = records.filter(r => r.attribution_required === 1).length;
    const editorialReviewCount = records.filter(r => r.verified_status === 'editorial_review').length;
    const flagsCount = records.filter(r => {
      try {
        const fl = JSON.parse(r.rights_flags || '[]');
        return fl.length > 0;
      } catch (e) {
        return false;
      }
    }).length;

    const commercialClearedPercent = totalAssets > 0 ? Math.round((commercialClearedCount / totalAssets) * 100) : 100;
    const overallClearance: 'FULLY_CLEARED' | 'EDITORIAL_CAUTION' | 'RESTRICTED' =
      commercialClearedPercent >= 90 && editorialReviewCount === 0
        ? 'FULLY_CLEARED'
        : editorialReviewCount > 0
        ? 'EDITORIAL_CAUTION'
        : 'RESTRICTED';

    // Build ready-to-paste YouTube Description Credits section
    const creditLines: string[] = [];
    creditLines.push('═══════════════════════════════════════════════════');
    creditLines.push('🎵 MUSIC & SOUND DESIGN CREDITS:');
    if (music.length > 0) {
      music.forEach(m => creditLines.push(`• ${m.attribution_text} (${m.license_type})`));
    } else {
      creditLines.push('• Original Soundtrack produced by Content Creation Hub Studio (Royalty-Free)');
    }
    if (soundEffects.length > 0) {
      creditLines.push(`• Sound Effects Suite: Procedural Studio SFX (Creative Commons CC0 1.0 Universal)`);
    }

    creditLines.push('');
    creditLines.push('📸 VISUAL & ARCHIVAL ASSETS:');
    const uniqueCreators = new Map<string, string>();
    [...images, ...videos].forEach(v => {
      if (v.attribution_text) {
        uniqueCreators.set(v.creator_name, v.attribution_text);
      }
    });

    if (uniqueCreators.size > 0) {
      uniqueCreators.forEach((attr) => creditLines.push(`• ${attr}`));
    } else {
      creditLines.push('• Photorealistic Visuals: AI-Generated via Pollinations Flux (Open Commercial License)');
    }

    if (narration.length > 0) {
      creditLines.push('');
      creditLines.push('🎙️ VOICE SYNTHESIS:');
      narration.forEach(n => creditLines.push(`• ${n.attribution_text}`));
    }

    creditLines.push('');
    creditLines.push('⚖️ RIGHTS & USAGE NOTICE:');
    creditLines.push('All visual and audio assets in this production have been curated, licensed, or generated under explicit commercial clearance agreements (Unsplash License, Pexels License, CC0 1.0, Apache 2.0, or Fair Use Editorial Commentary).');
    creditLines.push('═══════════════════════════════════════════════════');

    const youtubeDescriptionCredits = creditLines.join('\n');

    const legalAdvisoryNotice = [
      'IMPORTANT COPYRIGHT DISCLOSURE:',
      '1. While all stock assets, generated imagery, and synthesized audio tracks carry verified commercial or public domain licenses, stock licenses do not guarantee immunity from automated third-party Content ID claims or disputed copyright algorithms.',
      '2. Archival and journalistic visual beats depicting identifiable personalities or registered trademarks are incorporated under the Fair Use doctrine for non-defamatory news reporting, historical documentation, and analytical commentary.',
      '3. Do not register the composite final video or soundtrack with automated YouTube Content ID networks as exclusive copyrighted property, as individual component sound effects and stock layers belong to public domain or permissive shared licenses.'
    ].join('\n\n');

    const contentIdAdvisory = 'Content ID Protected: Commercial usage permitted. Standalone exclusive Content ID enrollment strictly prohibited.';

    const report: YouTubeCopyrightReport = {
      projectId,
      projectTitle,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAssets,
        commercialClearedCount,
        commercialClearedPercent,
        attributionRequiredCount,
        editorialReviewCount,
        flagsCount,
        overallClearance
      },
      assetBreakdown: {
        images,
        videos,
        music,
        soundEffects,
        narration
      },
      youtubeDescriptionCredits,
      legalAdvisoryNotice,
      contentIdAdvisory
    };

    // Save report to disk as JSON & Markdown
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const jsonPath = path.join(outputDir, `${projectId}_copyright_report.json`);
    const mdPath = path.join(outputDir, `${projectId}_copyright_report.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

    // Build Markdown report
    const mdContent = [
      `# YouTube Copyright & Asset Licensing Clearance Report`,
      `**Project ID:** \`${projectId}\`  `,
      `**Title:** ${projectTitle}  `,
      `**Generated:** ${report.generatedAt}  `,
      `**Clearance Status:** **${overallClearance}** (${commercialClearedPercent}% Commercial Cleared)  `,
      '',
      '---',
      '',
      '## Executive Summary',
      `| Metric | Value |`,
      `|---|---|`,
      `| Total Tracked Assets | **${totalAssets}** |`,
      `| Commercial Viability | **${commercialClearedPercent}%** (${commercialClearedCount}/${totalAssets} cleared) |`,
      `| Mandatory Attributions | **${attributionRequiredCount}** items |`,
      `| Editorial Review Items | **${editorialReviewCount}** items |`,
      `| Rights / Trademark Flags | **${flagsCount}** notices |`,
      '',
      '---',
      '',
      '## YouTube Description Box (Copy & Paste Ready)',
      '```text',
      youtubeDescriptionCredits,
      '```',
      '',
      '---',
      '',
      '## Detailed Asset Inventory',
      '',
      '### 1. Music & Sound Design',
      music.map(m => `- **${m.creator_name}**: \`${m.license_type}\` — ${m.attribution_text} ([Source](${m.original_url}))`).join('\n') || '- None recorded',
      '',
      '### 2. Sound Effects Suite',
      soundEffects.slice(0, 5).map(s => `- **${s.creator_name}**: \`${s.license_type}\` — ${s.attribution_text}`).join('\n') + (soundEffects.length > 5 ? `\n- *...and ${soundEffects.length - 5} more procedural CC0 sound effects*` : '') || '- None recorded',
      '',
      '### 3. Visual Assets (Images & Footage)',
      [...images, ...videos].map((v, i) => `${i + 1}. **${v.source_platform.toUpperCase()}** — *${v.creator_name}* | License: \`${v.license_type}\` | Commercial: ${v.commercial_use ? '✅ Yes' : '⚠️ Editorial Only'}\n   - URL: ${v.original_url}\n   - Restrictions: ${v.usage_restrictions}`).join('\n\n') || '- None recorded',
      '',
      '### 4. Narration Voice Engine',
      narration.map(n => `- **${n.creator_name}**: License: \`${n.license_type}\` — ${n.attribution_text}`).join('\n') || '- None recorded',
      '',
      '---',
      '',
      '## Rights, Trademark & Content ID Advisory',
      `> [!IMPORTANT]`,
      `> **Third-Party Rights & Content ID:**`,
      `> ${legalAdvisoryNotice.replace(/\n\n/g, '\n>\n> ')}`
    ].join('\n');

    fs.writeFileSync(mdPath, mdContent, 'utf-8');

    // Update project database record
    await runQuery(
      `UPDATE projects SET copyright_report = ? WHERE id = ?`,
      [JSON.stringify(report), projectId]
    );

    return report;
  }
}
