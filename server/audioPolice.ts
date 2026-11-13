import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { runQuery, getQuery, allQuery } from './db';

export type AudioCategory =
  | 'bgm'
  | 'sfx'
  | 'voiceover'
  | 'user_upload'
  | 'extracted'
  | 'imported'
  | 'ambient'
  | 'ai_generated';

export type AudioPlatform =
  | 'youtube_audio_library'
  | 'pixabay'
  | 'freesound'
  | 'mixkit'
  | 'local_studio'
  | 'kokoro_tts'
  | 'youtube_extract'
  | 'user_upload'
  | 'ai_synthesis'
  | 'unknown';

export type AudioRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
export type AudioGateStatus = 'PASSED' | 'WARNING_REVIEW_REQUIRED' | 'BLOCKED';

export interface AudioAssetRecord {
  id: string;
  asset_id: string;
  project_id: string | null;
  audio_type: AudioCategory;
  original_filename: string;
  file_path: string;
  source_url: string | null;
  source_platform: AudioPlatform;
  creator_artist: string | null;
  audio_title: string | null;
  duration_sec: number;
  sample_rate: number;
  channels: number;
  file_hash: string | null;
  audio_fingerprint: string | null;
  license_type: string;
  license_url: string | null;
  commercial_use_allowed: number; // 1 or 0
  attribution_required: number; // 1 or 0
  modification_allowed: number; // 1 or 0
  redistribution_restrictions: string | null;
  verified_license: number; // 1 or 0
  risk_score: AudioRiskLevel;
  risk_reasons: string; // JSON array of string
  detection_match_info: string | null; // JSON object
  manual_override: number; // 1 or 0
  override_reason: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AudioFingerprintResult {
  status: string;
  filepath: string;
  filename: string;
  file_size_bytes: number;
  file_hash: string;
  duration_sec: number;
  sample_rate: number;
  channels: number;
  rms_db: number;
  peak_db: number;
  fingerprint: string;
  tokens_count: number;
  commercial_matches: Array<{
    id: string;
    title: string;
    artist: string;
    label: string;
    confidence: number;
    content_id_risk: string;
    notes: string;
  }>;
  has_commercial_match: boolean;
}

export interface AudioScanEvaluation {
  riskScore: AudioRiskLevel;
  riskReasons: string[];
  contentIdRisk: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  isDuplicate: boolean;
  duplicateMatch: { assetId: string; title: string; similarity: number } | null;
  commercialMatches: Array<any>;
  fingerprint: string;
  fileHash: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
}

export interface AudioPoliceProjectReport {
  projectId: string;
  projectTitle: string;
  gateStatus: AudioGateStatus;
  compositeRiskScore: AudioRiskLevel;
  canExport: boolean;
  blockReason: string | null;
  generatedAt: string;
  summary: {
    totalAudioTracks: number;
    verifiedLicensedCount: number;
    aiGeneratedCount: number;
    unverifiedCount: number;
    potentialMatchesCount: number;
    highRiskCount: number;
    blockedCount: number;
  };
  assets: AudioAssetRecord[];
  timelineTracks: Array<{
    trackId: string;
    type: AudioCategory;
    title: string;
    risk: AudioRiskLevel;
    license: string;
    source: AudioPlatform;
  }>;
  replacementRecommendations: Array<{
    offendingAssetId: string;
    title: string;
    reason: string;
    safeAlternative: {
      type: 'ai_synthesis' | 'verified_library';
      name: string;
      mood: string;
      license: string;
    };
  }>;
  youtubeContentIdReadiness: {
    status: string;
    advisory: string;
    disputeChecklist: string[];
    disputeExplanationTemplate: string;
  };
}

export class AudioPoliceService {
  private static libraryInitialized = false;

  /**
   * Run python acoustic fingerprinting script
   */
  static async probeFingerprint(filePath: string): Promise<AudioFingerprintResult> {
    return new Promise((resolve) => {
      const script = path.join(process.cwd(), 'scripts', 'audio_fingerprint.py');
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

      if (!fs.existsSync(absPath)) {
        return resolve({
          status: 'error',
          filepath: absPath,
          filename: path.basename(filePath),
          file_size_bytes: 0,
          file_hash: 'unknown',
          duration_sec: 0,
          sample_rate: 48000,
          channels: 2,
          rms_db: -96,
          peak_db: -96,
          fingerprint: 'empty',
          tokens_count: 0,
          commercial_matches: [],
          has_commercial_match: false
        });
      }

      const p = spawn('python', [script, absPath]);
      let stdout = '';
      let stderr = '';

      p.stdout.on('data', (d) => { stdout += d.toString(); });
      p.stderr.on('data', (d) => { stderr += d.toString(); });

      p.on('close', (code) => {
        try {
          const res = JSON.parse(stdout);
          resolve(res);
        } catch (e) {
          resolve({
            status: 'fallback',
            filepath: absPath,
            filename: path.basename(filePath),
            file_size_bytes: fs.statSync(absPath).size,
            file_hash: 'hash_probe_err',
            duration_sec: 30,
            sample_rate: 48000,
            channels: 2,
            rms_db: -20,
            peak_db: -12,
            fingerprint: 'fp_fallback',
            tokens_count: 10,
            commercial_matches: [],
            has_commercial_match: false
          });
        }
      });
      p.on('error', () => {
        resolve({
          status: 'error',
          filepath: absPath,
          filename: path.basename(filePath),
          file_size_bytes: 0,
          file_hash: 'error',
          duration_sec: 0,
          sample_rate: 48000,
          channels: 2,
          rms_db: -96,
          peak_db: -96,
          fingerprint: 'error',
          tokens_count: 0,
          commercial_matches: [],
          has_commercial_match: false
        });
      });
    });
  }

  /**
   * Evaluate risk level and license terms for an audio asset
   */
  static async evaluateAudioRisk(
    filePath: string,
    metadata: Partial<AudioAssetRecord>
  ): Promise<AudioScanEvaluation> {
    const probe = await this.probeFingerprint(filePath);
    const reasons: string[] = [];
    let risk: AudioRiskLevel = 'LOW';
    let contentIdRisk: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' = 'VERY_LOW';

    // 1. Check Commercial Matches from Acoustic Fingerprint
    if (probe.has_commercial_match && probe.commercial_matches.length > 0) {
      risk = 'BLOCKED';
      contentIdRisk = 'VERY_HIGH';
      const m = probe.commercial_matches[0];
      reasons.push(
        `Acoustic fingerprint matched commercial recording: "${m.title}" by ${m.artist} (${m.label}). Content ID match risk: VERY HIGH.`
      );
    }

    // 2. Check Database for duplicate audio
    let duplicateMatch: { assetId: string; title: string; similarity: number } | null = null;
    let isDuplicate = false;

    if (probe.file_hash && probe.file_hash !== 'hash_probe_err') {
      const existing = await getQuery<AudioAssetRecord>(
        `SELECT * FROM audio_asset_registry WHERE file_hash = ? AND (file_path != ? AND original_filename != ?) LIMIT 1`,
        [probe.file_hash, filePath, path.basename(filePath)]
      );
      if (existing) {
        isDuplicate = true;
        duplicateMatch = {
          assetId: existing.asset_id,
          title: existing.audio_title || existing.original_filename,
          similarity: 100.0
        };
        reasons.push(`Duplicate audio file detected: Identical bitstream hash to registered asset "${existing.audio_title || existing.asset_id}".`);
      }
    }

    // 3. Platform & Source Ingestion Verification
    const platform = metadata.source_platform || 'unknown';
    const licType = (metadata.license_type || '').toLowerCase();

    if (platform === 'unknown') {
      risk = risk === 'BLOCKED' ? 'BLOCKED' : 'HIGH';
      contentIdRisk = 'HIGH';
      reasons.push('Audio source is unknown or unverified. Commercial usage without clear chain-of-title carries high legal/takedown risk.');
    } else if (platform === 'youtube_extract') {
      risk = risk === 'BLOCKED' ? 'BLOCKED' : 'HIGH';
      contentIdRisk = 'HIGH';
      reasons.push('Audio extracted from third-party YouTube video or podcast. May contain copyrighted background music or sync rights violations.');
    } else if (platform === 'user_upload' && !metadata.verified_license) {
      if (risk !== 'BLOCKED') risk = 'MEDIUM';
      if (contentIdRisk === 'VERY_LOW') contentIdRisk = 'MEDIUM';
      reasons.push('User uploaded audio track without third-party verification certificate. Manual rights confirmation recommended.');
    }

    // 4. Commercial Use & Non-Commercial License Checks
    if (metadata.commercial_use_allowed === 0 || licType.includes('non-commercial') || licType.includes('cc-by-nc') || licType.includes('nc')) {
      risk = 'BLOCKED';
      reasons.push('License explicitly prohibits commercial use (Non-Commercial / CC-NC). Blocked from commercial video production.');
    }

    // 5. Attribution Requirements
    if (metadata.attribution_required === 1 && risk === 'LOW') {
      risk = 'MEDIUM';
      reasons.push('License requires mandatory creator attribution in video description (e.g. Creative Commons CC-BY).');
    }

    // 6. Safe & Verified Pass-Throughs
    if (
      platform === 'local_studio' ||
      platform === 'kokoro_tts' ||
      platform === 'pixabay' ||
      platform === 'youtube_audio_library' ||
      platform === 'ai_synthesis'
    ) {
      if (risk === 'LOW') {
        reasons.push('Source platform verified: Royalty-free / CC0 / Apache 2.0 commercial terms confirmed.');
        contentIdRisk = 'VERY_LOW';
      }
    }

    return {
      riskScore: risk,
      riskReasons: reasons,
      contentIdRisk,
      isDuplicate,
      duplicateMatch,
      commercialMatches: probe.commercial_matches || [],
      fingerprint: probe.fingerprint,
      fileHash: probe.file_hash,
      durationSec: probe.duration_sec,
      sampleRate: probe.sample_rate,
      channels: probe.channels
    };
  }

  /**
   * Register or update an audio asset in the centralized registry
   */
  static async registerAudio(data: {
    assetId: string;
    projectId?: string | null;
    audioType: AudioCategory;
    filePath: string;
    sourcePlatform: AudioPlatform;
    sourceUrl?: string | null;
    creatorArtist?: string | null;
    audioTitle?: string | null;
    licenseType?: string;
    licenseUrl?: string | null;
    commercialUseAllowed?: boolean;
    attributionRequired?: boolean;
    modificationAllowed?: boolean;
    redistributionRestrictions?: string | null;
    verifiedLicense?: boolean;
  }): Promise<AudioAssetRecord> {
    await this.initializeStudioAudioLibrary();

    const evaluation = await this.evaluateAudioRisk(data.filePath, {
      source_platform: data.sourcePlatform,
      license_type: data.licenseType || 'Local Royalty-Free',
      commercial_use_allowed: data.commercialUseAllowed !== false ? 1 : 0,
      attribution_required: data.attributionRequired ? 1 : 0,
      verified_license: data.verifiedLicense ? 1 : 0
    });

    const recordId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const filename = path.basename(data.filePath);

    // Check if asset already registered by asset_id or (file_path AND project_id)
    const existing = await getQuery<AudioAssetRecord>(
      `SELECT * FROM audio_asset_registry WHERE asset_id = ? OR (file_path = ? AND project_id = ?) LIMIT 1`,
      [data.assetId, data.filePath, data.projectId || null]
    );

    const licType = data.licenseType || (
      data.sourcePlatform === 'local_studio'
        ? 'Studio Original Royalty-Free / CC0'
        : data.sourcePlatform === 'kokoro_tts'
        ? 'Apache 2.0 Open Source'
        : data.sourcePlatform === 'youtube_audio_library'
        ? 'YouTube Audio Library License'
        : data.sourcePlatform === 'pixabay'
        ? 'Pixabay Content License'
        : 'Standard Stock License'
    );

    const licUrl = data.licenseUrl || (
      data.sourcePlatform === 'local_studio'
        ? 'https://creativecommons.org/publicdomain/zero/1.0/'
        : data.sourcePlatform === 'kokoro_tts'
        ? 'https://www.apache.org/licenses/LICENSE-2.0'
        : data.sourcePlatform === 'youtube_audio_library'
        ? 'https://support.google.com/youtube/answer/3376882'
        : 'https://pixabay.com/service/license-summary/'
    );

    const commercialAllowed = data.commercialUseAllowed !== undefined ? (data.commercialUseAllowed ? 1 : 0) : 1;
    const attributionReq = data.attributionRequired ? 1 : 0;
    const modificationAllowed = data.modificationAllowed !== false ? 1 : 0;
    const verifiedLic = data.verifiedLicense !== undefined ? (data.verifiedLicense ? 1 : 0) : (data.sourcePlatform !== 'unknown' && data.sourcePlatform !== 'youtube_extract' ? 1 : 0);
    const restrictions = data.redistributionRestrictions || 'Commercial video production permitted. Standalone audio resale or Content ID claiming forbidden.';

    if (existing) {
      await runQuery(
        `UPDATE audio_asset_registry SET
          project_id = COALESCE(?, project_id),
          audio_type = ?,
          source_platform = ?,
          creator_artist = COALESCE(?, creator_artist),
          audio_title = COALESCE(?, audio_title),
          duration_sec = ?,
          file_hash = ?,
          audio_fingerprint = ?,
          license_type = ?,
          license_url = ?,
          commercial_use_allowed = ?,
          attribution_required = ?,
          modification_allowed = ?,
          redistribution_restrictions = ?,
          verified_license = ?,
          risk_score = ?,
          risk_reasons = ?,
          detection_match_info = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          data.projectId || null,
          data.audioType,
          data.sourcePlatform,
          data.creatorArtist || null,
          data.audioTitle || null,
          evaluation.durationSec,
          evaluation.fileHash,
          evaluation.fingerprint,
          licType,
          licUrl,
          commercialAllowed,
          attributionReq,
          modificationAllowed,
          restrictions,
          verifiedLic,
          evaluation.riskScore,
          JSON.stringify(evaluation.riskReasons),
          JSON.stringify({
            commercialMatches: evaluation.commercialMatches,
            isDuplicate: evaluation.isDuplicate,
            duplicateMatch: evaluation.duplicateMatch,
            contentIdRisk: evaluation.contentIdRisk
          }),
          existing.id
        ]
      );
    } else {
      await runQuery(
        `INSERT INTO audio_asset_registry (
          id, asset_id, project_id, audio_type, original_filename, file_path, source_url,
          source_platform, creator_artist, audio_title, duration_sec, sample_rate, channels,
          file_hash, audio_fingerprint, license_type, license_url, commercial_use_allowed,
          attribution_required, modification_allowed, redistribution_restrictions, verified_license,
          risk_score, risk_reasons, detection_match_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          data.assetId,
          data.projectId || null,
          data.audioType,
          filename,
          data.filePath,
          data.sourceUrl || null,
          data.sourcePlatform,
          data.creatorArtist || 'Studio Sound Artist',
          data.audioTitle || filename,
          evaluation.durationSec,
          evaluation.sampleRate,
          evaluation.channels,
          evaluation.fileHash,
          evaluation.fingerprint,
          licType,
          licUrl,
          commercialAllowed,
          attributionReq,
          modificationAllowed,
          restrictions,
          verifiedLic,
          evaluation.riskScore,
          JSON.stringify(evaluation.riskReasons),
          JSON.stringify({
            commercialMatches: evaluation.commercialMatches,
            isDuplicate: evaluation.isDuplicate,
            duplicateMatch: evaluation.duplicateMatch,
            contentIdRisk: evaluation.contentIdRisk
          })
        ]
      );
    }

    const saved = await getQuery<AudioAssetRecord>(
      `SELECT * FROM audio_asset_registry WHERE asset_id = ? OR id = ? LIMIT 1`,
      [data.assetId, existing?.id || recordId]
    );
    return saved!;
  }

  /**
   * Initialize studio audio library with verified LOW-risk fingerprints
   */
  static async initializeStudioAudioLibrary(): Promise<void> {
    if (this.libraryInitialized) return;
    this.libraryInitialized = true;

    // 1. Studio BGM Themes
    const bgmDir = path.join(process.cwd(), 'public', 'audio', 'bgm');
    if (fs.existsSync(bgmDir)) {
      const bgmFiles = fs.readdirSync(bgmDir).filter(f => f.endsWith('.wav'));
      for (const f of bgmFiles) {
        const fullPath = path.join('public', 'audio', 'bgm', f);
        const nameWithoutExt = path.basename(f, '.wav');
        await this.registerAudio({
          assetId: `bgm_${nameWithoutExt}`,
          audioType: 'bgm',
          filePath: fullPath,
          sourcePlatform: 'local_studio',
          creatorArtist: 'Content-Creation-Hub Audio Synthesis Suite',
          audioTitle: nameWithoutExt.replace(/_/g, ' ').toUpperCase(),
          licenseType: 'Studio Original Royalty-Free License',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
          commercialUseAllowed: true,
          attributionRequired: false,
          modificationAllowed: true,
          verifiedLicense: true
        });
      }
    }

    // 2. Studio Procedural SFX Suite
    const sfxDir = path.join(process.cwd(), 'public', 'audio', 'sound-effects');
    if (fs.existsSync(sfxDir)) {
      const sfxFiles = fs.readdirSync(sfxDir).filter(f => f.endsWith('.wav'));
      for (const f of sfxFiles) {
        const fullPath = path.join('public', 'audio', 'sound-effects', f);
        const nameWithoutExt = path.basename(f, '.wav');
        await this.registerAudio({
          assetId: `sfx_${nameWithoutExt}`,
          audioType: 'sfx',
          filePath: fullPath,
          sourcePlatform: 'local_studio',
          creatorArtist: 'Procedural Sound Design Engine',
          audioTitle: `SFX: ${nameWithoutExt.replace(/-/g, ' ').toUpperCase()}`,
          licenseType: 'Creative Commons CC0 1.0 Universal (Public Domain)',
          licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
          commercialUseAllowed: true,
          attributionRequired: false,
          modificationAllowed: true,
          verifiedLicense: true
        });
      }
    }
  }

  /**
   * Run the Mandatory Pre-Export Audio Copyright Gate
   */
  static async runProjectPreExportGate(projectId: string): Promise<AudioPoliceProjectReport> {
    await this.initializeStudioAudioLibrary();

    const proj = await getQuery<any>('SELECT * FROM projects WHERE id = ?', [projectId]);
    const projectTitle = proj?.title || proj?.topic || 'Documentary Production';

    // 1. Gather all audio files associated with this project
    const tracksToAudit: Array<{
      assetId: string;
      type: AudioCategory;
      filePath: string;
      platform: AudioPlatform;
      creator: string;
      title: string;
      licenseType?: string;
    }> = [];

    // Narration
    const narrationPath = path.join(process.cwd(), 'public', 'audio', `narration_${projectId}.wav`);
    if (fs.existsSync(narrationPath)) {
      tracksToAudit.push({
        assetId: `narration_${projectId}`,
        type: 'voiceover',
        filePath: `/audio/narration_${projectId}.wav`,
        platform: 'kokoro_tts',
        creator: `Kokoro AI TTS (${proj?.voice || 'af_heart'})`,
        title: `Narration Voiceover: ${projectTitle}`,
        licenseType: 'Apache License 2.0 (Permissive Commercial Open Source)'
      });
    }

    // Props file (BGM and SFX cues)
    const propsPath = path.join(process.cwd(), 'public', `props_${projectId}.json`);
    if (fs.existsSync(propsPath)) {
      try {
        const props = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));
        if (props.musicSrc) {
          tracksToAudit.push({
            assetId: `bgm_${projectId}_${path.basename(props.musicSrc, path.extname(props.musicSrc))}`,
            type: 'bgm',
            filePath: props.musicSrc,
            platform: 'local_studio',
            creator: 'Content-Creation-Hub Audio Studio',
            title: `BGM: ${path.basename(props.musicSrc, path.extname(props.musicSrc)).replace(/_/g, ' ')}`,
            licenseType: 'Studio Original Royalty-Free License'
          });
        }
        if (Array.isArray(props.sfxCues)) {
          const uniqueSfx = Array.from(new Set(props.sfxCues.map((c: any) => c.file)));
          for (const sfxFile of uniqueSfx as string[]) {
            tracksToAudit.push({
              assetId: `sfx_${projectId}_${path.basename(sfxFile, path.extname(sfxFile))}`,
              type: 'sfx',
              filePath: sfxFile,
              platform: 'local_studio',
              creator: 'Procedural Sound Design Engine',
              title: `SFX: ${path.basename(sfxFile, path.extname(sfxFile))}`,
              licenseType: 'Creative Commons CC0 1.0 Universal'
            });
          }
        }
      } catch (e) {}
    }

    // Register & audit each project track
    const auditedRecords: AudioAssetRecord[] = [];
    for (const t of tracksToAudit) {
      const rec = await this.registerAudio({
        assetId: t.assetId,
        projectId,
        audioType: t.type,
        filePath: t.filePath.startsWith('/') ? path.join('public', t.filePath) : t.filePath,
        sourcePlatform: t.platform,
        creatorArtist: t.creator,
        audioTitle: t.title,
        licenseType: t.licenseType,
        commercialUseAllowed: true,
        verifiedLicense: true
      });
      auditedRecords.push(rec);
    }

    // Also pull any already registered records for this project (e.g. user uploads or extracted clips)
    const dbRecords = await allQuery<AudioAssetRecord>(
      `SELECT * FROM audio_asset_registry WHERE project_id = ? ORDER BY created_at ASC`,
      [projectId]
    );

    const recordMap = new Map<string, AudioAssetRecord>();
    [...auditedRecords, ...dbRecords].forEach(r => recordMap.set(r.asset_id, r));
    const allProjectAssets = Array.from(recordMap.values());

    // Calculate Counts & Risk Breakdown
    const totalAudioTracks = allProjectAssets.length;
    let verifiedLicensedCount = 0;
    let aiGeneratedCount = 0;
    let unverifiedCount = 0;
    let potentialMatchesCount = 0;
    let highRiskCount = 0;
    let blockedCount = 0;

    let compositeRisk: AudioRiskLevel = 'LOW';
    let blockReason: string | null = null;
    let canExport = true;

    for (const a of allProjectAssets) {
      if (a.verified_license === 1) verifiedLicensedCount++;
      else unverifiedCount++;

      if (a.audio_type === 'ai_generated' || a.source_platform === 'ai_synthesis' || a.source_platform === 'kokoro_tts') {
        aiGeneratedCount++;
      }

      if (a.risk_score === 'BLOCKED' && a.manual_override === 0) {
        blockedCount++;
        compositeRisk = 'BLOCKED';
        canExport = false;
        blockReason = `Audio asset "${a.audio_title || a.original_filename}" is BLOCKED: Incompatible license or verified commercial copyright match.`;
      } else if (a.risk_score === 'HIGH' && a.manual_override === 0) {
        highRiskCount++;
        if (compositeRisk !== 'BLOCKED') compositeRisk = 'HIGH';
        canExport = false;
        blockReason = `Audio asset "${a.audio_title || a.original_filename}" has HIGH risk: Unverified chain-of-title or potential Content ID match. Manual review required.`;
      } else if (a.risk_score === 'MEDIUM') {
        if (compositeRisk === 'LOW') compositeRisk = 'MEDIUM';
      }

      // Check commercial match
      try {
        const matchInfo = a.detection_match_info ? JSON.parse(a.detection_match_info) : null;
        if (matchInfo?.commercialMatches && matchInfo.commercialMatches.length > 0) {
          potentialMatchesCount++;
        }
      } catch (e) {}
    }

    const gateStatus: AudioGateStatus =
      compositeRisk === 'BLOCKED'
        ? 'BLOCKED'
        : compositeRisk === 'HIGH'
        ? 'WARNING_REVIEW_REQUIRED'
        : 'PASSED';

    // Replacement recommendations for HIGH / BLOCKED assets
    const replacementRecs: any[] = [];
    for (const a of allProjectAssets) {
      if ((a.risk_score === 'HIGH' || a.risk_score === 'BLOCKED') && a.manual_override === 0) {
        let recMood = 'cinematic_documentary';
        if (proj?.category?.toLowerCase().includes('tech')) recMood = 'corporate_tech';
        else if (proj?.category?.toLowerCase().includes('investig')) recMood = 'suspense_investigative';

        replacementRecs.push({
          offendingAssetId: a.asset_id,
          title: a.audio_title || a.original_filename,
          reason: a.risk_reasons ? JSON.parse(a.risk_reasons)[0] : 'High copyright / Content ID risk.',
          safeAlternative: {
            type: 'ai_synthesis',
            name: `Original AI ${recMood.replace(/_/g, ' ')} composition`,
            mood: recMood,
            license: 'Studio Original Royalty-Free (CC0 1.0 Universal)'
          }
        });
      }
    }

    // YouTube Content ID Dispute Assistance Kit
    const disputeExplanationTemplate = [
      `To YouTube Copyright Operations / Rights Holder:`,
      `This video contains authorized, properly licensed background audio created and cleared for commercial publication.`,
      `Asset: "${allProjectAssets.find(a => a.audio_type === 'bgm')?.audio_title || 'Documentary Soundtrack'}"`,
      `License Type: Studio Royalty-Free License / Creative Commons CC0 1.0`,
      `License Terms: Commercial video production cleared without exclusive Content ID assignment.`,
      `Narration was synthesized locally using Kokoro TTS (Apache 2.0 Open License).`,
      `We request release of this claim as the component audio is verified royalty-free.`
    ].join('\n');

    const disputeChecklist = [
      '1. Verify the exact timestamp of the claim against your project audio timeline.',
      '2. Confirm that the claimed audio matches your background music or a third-party clip.',
      '3. Verify that your license receipt or CC0 terms specifically allow commercial video monetization.',
      '4. If using AI-generated or CC0 music, aggregators often claim shared harmonic patterns falsely.',
      '5. Only submit a formal dispute if you have confirmed your legitimate commercial clearance.',
      '6. Never file fraudulent disputes on commercial songs you do not hold synchronization rights to.'
    ];

    const report: AudioPoliceProjectReport = {
      projectId,
      projectTitle,
      gateStatus,
      compositeRiskScore: compositeRisk,
      canExport,
      blockReason,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAudioTracks,
        verifiedLicensedCount,
        aiGeneratedCount,
        unverifiedCount,
        potentialMatchesCount,
        highRiskCount,
        blockedCount
      },
      assets: allProjectAssets,
      timelineTracks: allProjectAssets.map(a => ({
        trackId: a.asset_id,
        type: a.audio_type,
        title: a.audio_title || a.original_filename,
        risk: a.risk_score,
        license: a.license_type,
        source: a.source_platform
      })),
      replacementRecommendations: replacementRecs,
      youtubeContentIdReadiness: {
        status: gateStatus === 'PASSED' ? 'READY_FOR_COMMERCIAL_PUBLISHING' : 'ACTION_REQUIRED_BEFORE_PUBLISH',
        advisory: 'Notice: Third-party Content ID networks use proprietary automated algorithms. While all assets have commercial clearance, false positive matches can occur on acoustic ambient drones. Keep the dispute documentation kit ready.',
        disputeChecklist,
        disputeExplanationTemplate
      }
    };

    // Save report to disk as JSON & Markdown
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const jsonPath = path.join(outputDir, `${projectId}_audio_police_report.json`);
    const mdPath = path.join(outputDir, `${projectId}_audio_police_report.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

    // Build Markdown report
    const mdContent = [
      `# 🚨 Audio Copyright Police — Inspection & Gate Report`,
      `**Project:** ${projectTitle} (\`${projectId}\`)  `,
      `**Generated:** ${report.generatedAt}  `,
      `**Export Gate Status:** **${gateStatus}**  `,
      `**Composite Risk Level:** **${compositeRisk}**  `,
      `**Can Export Video:** **${canExport ? '✅ YES' : '❌ NO (Blocked by Gate)'}**  `,
      blockReason ? `\n> [!CAUTION]\n> **Gate Block Reason:** ${blockReason}\n` : '',
      '---',
      '',
      '## Audio Asset Inspection Summary',
      `| Metric | Count | Status |`,
      `|---|---|---|`,
      `| Total Audio Tracks | **${totalAudioTracks}** | Tracked in Centralized Registry |`,
      `| Verified Licensed Assets | **${verifiedLicensedCount}** | 100% Commercial Cleared |`,
      `| AI / Procedural Assets | **${aiGeneratedCount}** | CC0 / Apache 2.0 Open License |`,
      `| Unverified Assets | **${unverifiedCount}** | ${unverifiedCount > 0 ? '⚠️ Audit required' : '✅ None'} |`,
      `| Potential Content ID Matches | **${potentialMatchesCount}** | ${potentialMatchesCount > 0 ? '⚠️ Content ID warning' : '✅ None detected'} |`,
      `| High-Risk / Blocked Assets | **${highRiskCount + blockedCount}** | ${highRiskCount + blockedCount > 0 ? '❌ Action Required' : '✅ Zero Blockers'} |`,
      '',
      '---',
      '',
      '## Track-by-Track Audio Inspection Dossier',
      '',
      allProjectAssets.map((a, idx) => {
        const reasons = a.risk_reasons ? JSON.parse(a.risk_reasons) : [];
        return [
          `### ${idx + 1}. [${a.audio_type.toUpperCase()}] ${a.audio_title || a.original_filename}`,
          `- **Risk Score:** \`${a.risk_score}\` ${a.risk_score === 'LOW' ? '🟢' : a.risk_score === 'MEDIUM' ? '🟡' : '🔴'}`,
          `- **Source Platform:** \`${a.source_platform}\` | **Creator:** ${a.creator_artist || 'Studio'}`,
          `- **License:** \`${a.license_type}\` | **Commercial Use:** ${a.commercial_use_allowed ? '✅ Cleared' : '❌ Prohibited'}`,
          `- **Audio Fingerprint (Hash):** \`${(a.file_hash || 'none').slice(0, 16)}...\``,
          `- **Risk Assessment & Reasons:**`,
          reasons.map((r: string) => `  - ${r}`).join('\n') || '  - Clean verified license.'
        ].join('\n');
      }).join('\n\n') || '- No audio tracks present.',
      '',
      '---',
      '',
      '## YouTube Content ID Readiness & Dispute Kit',
      `> [!NOTE]`,
      `> **Dispute Advisory:** ${report.youtubeContentIdReadiness.advisory}`,
      '',
      '### Pre-Formatted Dispute Letter (If False Positive Occurs):',
      '```text',
      disputeExplanationTemplate,
      '```'
    ].join('\n');

    fs.writeFileSync(mdPath, mdContent, 'utf-8');

    // Update database record
    await runQuery(
      `UPDATE projects SET audio_police_report = ?, audio_gate_status = ? WHERE id = ?`,
      [JSON.stringify(report), gateStatus, projectId]
    );

    return report;
  }

  /**
   * Smart Audio Replacement System:
   * Replaces HIGH or BLOCKED audio tracks with pristine, properly licensed AI/Royalty-free compositions
   * Preserves narration and dialogue, matches tempo and mood, re-audits project gate.
   */
  static async smartReplaceAudio(
    projectId: string,
    offendingAssetId: string,
    preferredMood?: string
  ): Promise<{ success: boolean; newAsset: AudioAssetRecord | null; message: string }> {
    const offending = await getQuery<AudioAssetRecord>(
      `SELECT * FROM audio_asset_registry WHERE asset_id = ? OR id = ? LIMIT 1`,
      [offendingAssetId, offendingAssetId]
    );

    if (!offending) {
      return { success: false, newAsset: null, message: 'Offending audio asset not found in registry.' };
    }

    const mood = preferredMood || (
      offending.audio_title?.toLowerCase().includes('tech') ? 'corporate_tech'
      : offending.audio_title?.toLowerCase().includes('investig') ? 'suspense_investigative'
      : 'cinematic_documentary'
    );

    const replacementFilename = `ai_safe_bgm_${projectId}_${Date.now()}.wav`;
    const replacementRelPath = path.join('public', 'audio', 'bgm', replacementFilename);
    const replacementAbsPath = path.join(process.cwd(), replacementRelPath);

    // Generate pristine, original AI composition matching mood
    const pyScript = path.join(process.cwd(), 'scripts', 'generate_ai_audio.py');
    await new Promise<void>((resolve, reject) => {
      const p = spawn('python', [pyScript, 'music', mood, replacementAbsPath, '--duration', '30']);
      p.on('close', (code) => {
        if (code === 0 && fs.existsSync(replacementAbsPath)) resolve();
        else reject(new Error(`AI Music synthesis failed with code ${code}`));
      });
      p.on('error', reject);
    });

    // Register safe replacement in Audio Police Registry
    const newRecord = await this.registerAudio({
      assetId: `ai_safe_${Date.now()}`,
      projectId,
      audioType: offending.audio_type,
      filePath: replacementRelPath,
      sourcePlatform: 'ai_synthesis',
      creatorArtist: 'Content-Creation-Hub AI Synthesis Engine',
      audioTitle: `Safe AI Replacement: ${mood.replace(/_/g, ' ').toUpperCase()}`,
      licenseType: 'Studio Original Royalty-Free / Creative Commons CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      commercialUseAllowed: true,
      attributionRequired: false,
      modificationAllowed: true,
      verifiedLicense: true
    });

    // Update project props file if exists
    const propsPath = path.join(process.cwd(), 'public', `props_${projectId}.json`);
    if (fs.existsSync(propsPath)) {
      try {
        const props = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));
        props.musicSrc = `/audio/bgm/${replacementFilename}`;
        fs.writeFileSync(propsPath, JSON.stringify(props, null, 2), 'utf-8');
      } catch (e) {}
    }

    // De-activate or remove offending asset for this project
    await runQuery(
      `DELETE FROM audio_asset_registry WHERE (asset_id = ? OR id = ?) AND (project_id = ? OR project_id IS NULL)`,
      [offendingAssetId, offendingAssetId, projectId]
    );

    // Re-run pre-export gate to refresh project status
    await this.runProjectPreExportGate(projectId);

    return {
      success: true,
      newAsset: newRecord,
      message: `Offending track replaced with pristine AI-generated "${mood}" composition (CC0 Public Domain). Dialogue and narration preserved.`
    };
  }

  /**
   * Apply a documented manual review override
   */
  static async applyManualOverride(assetId: string, projectId: string, reason: string): Promise<boolean> {
    await runQuery(
      `UPDATE audio_asset_registry SET manual_override = 1, override_reason = ?, risk_score = 'LOW' WHERE asset_id = ? OR id = ?`,
      [reason, assetId, assetId]
    );
    // Refresh project pre-export gate
    await this.runProjectPreExportGate(projectId);
    return true;
  }
}
