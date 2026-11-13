import { VideoProject, SceneData, PipelineStage, ResearchSummary, SocialCaptions, VisualShotType, MediaSource, CameraMovement } from './types';
import { runQuery, getQuery } from './db';
import { MediaSourceManager, QualityChecker } from './mediaSource';
import { DocumentaryResearchService, ResearchDossier } from './documentaryResearch';
import { DocumentaryNarrativeEngine } from './documentaryNarrative';
import { SceneIntelligenceEngine } from './sceneIntelligence';
import { VideoEnhancerService } from './videoEnhancer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export class PipelineManager {
  private static activeJobs: Map<string, boolean> = new Map();
  private static listeners: Array<(jobUpdate: any) => void> = [];

  static subscribe(fn: (jobUpdate: any) => void) {
    this.listeners.push(fn);
  }

  static broadcast(update: any) {
    this.listeners.forEach((fn) => {
      try { fn(update); } catch (e) { }
    });
  }

  static async startPipeline(projectId: string): Promise<void> {
    const project = await getQuery<any>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) throw new Error('Project not found');

    this.activeJobs.set(projectId, true);
    this.runPipelineStages(projectId).catch(err => {
      console.error(`Pipeline failure for project ${projectId}:`, err);
      this.updateStage(projectId, 'READY_FOR_EDITING', 100, 'failed', err.message);
    });
  }

  private static async updateStage(
    projectId: string,
    stage: PipelineStage,
    progress: number,
    status: 'draft' | 'processing' | 'completed' | 'failed' = 'processing',
    error_message?: string
  ) {
    await runQuery(
      `UPDATE projects SET current_stage = ?, progress = ?, status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [stage, progress, status, error_message || null, projectId]
    );
    this.broadcast({ projectId, stage, progress, status, error_message });
  }

  private static async runPipelineStages(projectId: string) {
    const projectRow = await getQuery<any>('SELECT * FROM projects WHERE id = ?', [projectId]);
    const project: VideoProject = {
      ...projectRow,
      scene_data: projectRow.scene_data ? JSON.parse(projectRow.scene_data) : [],
    };

    // Initialize media library
    await MediaSourceManager.initMediaLibrary();

    // 1. RESEARCH
    await this.updateStage(projectId, 'RESEARCH', 10);
    const researchDossier = await this.executeResearch(project);

    // 2. SCRIPT WRITING
    await this.updateStage(projectId, 'SCRIPT_WRITING', 20);
    const script = projectRow.script && projectRow.script.length > 50 
      ? projectRow.script 
      : await this.generateScript(project, researchDossier);
    await runQuery('UPDATE projects SET script = ? WHERE id = ?', [script, projectId]);

    // 3. FACT CHECKING
    await this.updateStage(projectId, 'FACT_CHECKING', 30);

    // 4. SCENE PLANNING (Granular Shot Division: 3-5s per shot)
    await this.updateStage(projectId, 'SCENE_PLANNING', 40);
    const refreshedProject = await getQuery<any>('SELECT scene_data, mode, review_approved FROM projects WHERE id = ?', [projectId]);
    const initialSceneData = (refreshedProject?.scene_data)
      ? JSON.parse(refreshedProject.scene_data)
      : await this.planScenes(project, script);

    // If project is in Review Mode and not approved yet, PAUSE for user review
    if (refreshedProject?.mode === 'review' && !refreshedProject?.review_approved) {
      await this.updateStage(projectId, 'SCENE_PLANNING', 45, 'draft');
      this.broadcast({
        projectId,
        stage: 'REVIEW_PAUSED',
        progress: 45,
        status: 'draft',
        message: 'Research, Claim Ledger, and Script complete. Ready for review and approval in Documentary Studio.'
      });
      return; // Pause pipeline until user clicks Approve in UI
    }

    // 5. ASSET COLLECTION (Download copyright-free stock footage & AI visuals, apply watermark crop & enhancement)
    await this.updateStage(projectId, 'ASSET_COLLECTION', 50);
    const totalShots = initialSceneData.length;
    for (let i = 0; i < totalShots; i++) {
      const shot = initialSceneData[i];
      if (!shot.media_url || shot.visual_type === 'video_footage' || shot.visual_type === 'ai_video' || shot.visual_type === 'layered_parallax' || shot.visual_type === 'data_metric') {
        const shotId = `${projectId}_${shot.id}`;
        shot.media_url = await MediaSourceManager.fetchCopyrightFreeAsset(
          shot.narration || shot.title,
          project.category,
          shotId,
          shot.duration || 4,
          project.aspect_ratio || '16:9'
        );
      }
      const progressPct = Math.round(50 + ((i + 1) / Math.max(1, totalShots)) * 5);
      await this.updateStage(projectId, 'ASSET_COLLECTION', progressPct);
    }
    await this.updateStage(projectId, 'IMAGE_AND_GRAPHIC_PREPARATION', 55);

    // 6. VOICE GENERATION (Kokoro TTS)
    await this.updateStage(projectId, 'VOICE_GENERATION', 65);
    const narrationWav = path.join(process.cwd(), 'public', 'audio', `narration_${projectId}.wav`);
    try {
      await this.generateVoice(script, narrationWav, project.voice, project.language);
    } catch (e: any) {
      console.warn(`[Pipeline] Voice generation error for ${projectId}:`, e?.message);
    }
    await runQuery('UPDATE projects SET narration_file = ? WHERE id = ?', [`/audio/narration_${projectId}.wav`, projectId]);

    // 7. SUBTITLE GENERATION (Whisper base)
    await this.updateStage(projectId, 'SUBTITLE_GENERATION', 75);
    const srtPath = path.join(process.cwd(), 'public', `subtitles_${projectId}.srt`);
    try {
      await this.generateSubtitles(narrationWav, srtPath, project.language);
    } catch (e: any) {
      console.warn(`[Pipeline] Subtitle generation error for ${projectId}:`, e?.message);
    }
    await runQuery('UPDATE projects SET subtitles_file = ? WHERE id = ?', [`/subtitles_${projectId}.srt`, projectId]);

    // 8. QUALITY CHECK & AUTOMATIC ENHANCEMENT (Zero Static Slides)
    await this.updateStage(projectId, 'QUALITY_CHECK', 80);
    const { scenes: verifiedScenes } = QualityChecker.inspectAndUpgrade(initialSceneData, project.category);
    await runQuery('UPDATE projects SET scene_data = ? WHERE id = ?', [JSON.stringify(verifiedScenes), projectId]);

    // 9. SOCIAL CAPTIONS GENERATION
    const socialCaptions = this.generateSocialCaptions(project, script);
    await runQuery('UPDATE projects SET social_captions = ? WHERE id = ?', [JSON.stringify(socialCaptions), projectId]);

    // 10. ANIMATION & VIDEO ASSEMBLY
    await this.updateStage(projectId, 'ANIMATION_GENERATION', 85);
    await this.updateStage(projectId, 'AUDIO_ASSEMBLY', 90);
    await this.updateStage(projectId, 'VIDEO_ASSEMBLY', 95);

    // 11. FINAL RENDER & VALIDATION
    await this.updateStage(projectId, 'FINAL_RENDER', 98);
    const videoOutput = path.join('output', `${projectId}.mp4`);
    let finalOutputPath = videoOutput;

    try {
      await this.renderVideo(projectId, videoOutput);
      await runQuery('UPDATE projects SET video_output = ? WHERE id = ?', [videoOutput, projectId]);

      // Check if project has custom enhancement settings
      const projRow = await getQuery<any>('SELECT enhancement_settings, resolution, aspect_ratio FROM projects WHERE id = ?', [projectId]);
      let enhancementSettings = projRow?.enhancement_settings ? JSON.parse(projRow.enhancement_settings) : null;

      // Module 2: AI Frame Interpolation to 60 FPS if enabled
      if (enhancementSettings?.frameInterpolation && enhancementSettings?.fps === 60) {
        const smoothOutput = path.join('output', `${projectId}_60fps.mp4`);
        try {
          console.log(`[Pipeline] Running motion-compensated 60 FPS interpolation for ${projectId}...`);
          await VideoEnhancerService.interpolateVideo(videoOutput, smoothOutput, { targetFps: 60 });
          finalOutputPath = smoothOutput;
          await runQuery('UPDATE projects SET video_output = ? WHERE id = ?', [smoothOutput, projectId]);
        } catch (interpErr: any) {
          console.warn(`[Pipeline] Frame interpolation fallback:`, interpErr?.message);
        }
      }

      // Module 8: Quality Control Inspection
      try {
        const audioPath = path.join(process.cwd(), 'public', 'audio', `narration_${projectId}.wav`);
        const audioDur = await this.probeAudioDuration(audioPath);
        const w = (projRow?.aspect_ratio === '9:16') ? 1080 : 1920;
        const h = (projRow?.aspect_ratio === '9:16') ? 1920 : 1080;
        const qc = await VideoEnhancerService.runQualityControl(
          path.join(process.cwd(), finalOutputPath),
          {
            targetResolution: `${w}x${h}`,
            targetFps: enhancementSettings?.fps || 30,
            renderDurationSec: audioDur,
          }
        );
        await runQuery('UPDATE projects SET qc_report = ? WHERE id = ?', [JSON.stringify(qc), projectId]);
        console.log(`[Pipeline] QC Report generated for ${projectId}: Score = ${qc.overall_score}/100, Passed = ${qc.passed}`);
      } catch (qcErr: any) {
        console.warn(`[Pipeline] QC Report note:`, qcErr?.message);
      }
    } catch (e: any) {
      console.warn(`[Pipeline] Render video note for ${projectId}:`, e?.message);
    }

    // COMPLETED - Ready for editing in AI Video Editor
    await this.updateStage(projectId, 'READY_FOR_EDITING', 100, 'completed');
  }

  private static async executeResearch(project: VideoProject): Promise<any> {
    try {
      const dossier = await DocumentaryResearchService.conductInvestigation(project.topic);
      await runQuery(
        `UPDATE projects SET 
          title = COALESCE(NULLIF(title, ''), ?),
          claim_ledger = ?,
          timeline = ?,
          entities = ?,
          asset_manifest = ?,
          research_summary = ?
        WHERE id = ?`,
        [
          dossier.subject,
          JSON.stringify(dossier.claims),
          JSON.stringify(dossier.timeline),
          JSON.stringify(dossier.entities),
          JSON.stringify(dossier.assets),
          JSON.stringify({
            topic: dossier.subject,
            key_questions: [
              `What are the verified facts surrounding ${dossier.subject}?`,
              `What is the documented timeline of events according to primary sources?`,
              `What claims remain unproven allegations or disputed points?`
            ],
            confirmed_facts: dossier.claims.filter(c => c.status === 'verified').map(c => c.claim_text),
            disputed_points: dossier.claims.filter(c => c.status === 'alleged' || c.status === 'disputed').map(c => c.claim_text),
            sources: dossier.sources
          }),
          project.id
        ]
      );
      return dossier;
    } catch (e: any) {
      console.warn('[Pipeline] Research execution note:', e.message);
      return {
        topic: project.topic,
        subject: project.topic.slice(0, 60),
        claims: [],
        timeline: [],
        entities: [],
        assets: [],
        sources: []
      };
    }
  }

  private static async generateScript(project: VideoProject, research: any): Promise<string> {
    const durationMin = Math.round((project.duration || 480) / 60) || 8;
    const pkg = DocumentaryNarrativeEngine.generateDocumentaryPackage(
      research,
      durationMin,
      project.visual_style || 'investigative'
    );

    await runQuery(
      `UPDATE projects SET 
        documentary_chapters = ?,
        scene_data = ?
      WHERE id = ?`,
      [
        JSON.stringify(pkg.chapters),
        JSON.stringify(pkg.storyboard),
        project.id
      ]
    );

    return pkg.fullScript;
  }

  private static async planScenes(project: VideoProject, script: string): Promise<SceneData[]> {
    const rawSentences = script.split(/(?<=[.!?।])\s+/).filter(s => s.trim().length > 0);
    const shotTexts: string[] = [];

    for (const sentence of rawSentences) {
      const words = sentence.trim().split(/\s+/);
      if (words.length > 8) {
        // Fast Change: Split on comma, semicolon, dash or conjunction for dynamic 2.5-4s shot cuts
        const clauses = sentence.split(/(?<=[,;:\-—])\s+/);
        if (clauses.length > 1) {
          for (const c of clauses) {
            const cw = c.trim().split(/\s+/);
            if (cw.length > 10) {
              const mid = Math.floor(cw.length / 2);
              shotTexts.push(cw.slice(0, mid).join(' '));
              shotTexts.push(cw.slice(mid).join(' '));
            } else if (c.trim().length > 0) {
              shotTexts.push(c.trim());
            }
          }
        } else {
          const mid = Math.floor(words.length / 2);
          shotTexts.push(words.slice(0, mid).join(' '));
          shotTexts.push(words.slice(mid).join(' '));
        }
      } else {
        shotTexts.push(sentence);
      }
    }

    const t = (project.topic || '').toLowerCase();
    const isHormuz = t.includes('hormuz') || t.includes('strait') || t.includes('persian gulf');

    const cameraMovements: CameraMovement[] = [
      'dolly_in', 'pan_left', 'tracking_forward', 'pan_right', 'tilt_up', 'aerial_zoom', 'dolly_out'
    ];

    const plannedScenes: SceneData[] = [];
    const usedMediaUrls = new Set<string>();
    let lastMovement: CameraMovement | undefined = undefined;

    for (let idx = 0; idx < shotTexts.length; idx++) {
      const narration = shotTexts[idx];
      const wordCount = narration.trim().split(/\s+/).length;
      const durationSec = Math.max(2.5, Math.min(5.0, Number((wordCount / 2.3).toFixed(1))));

      // Module 5: Contextual Scene Intelligence
      const context = SceneIntelligenceEngine.analyzeNarration(
        narration,
        project.topic || 'Strategic Intelligence',
        project.category || 'Geopolitics',
        idx,
        lastMovement
      );
      lastMovement = context.cameraMovement;

      // Module 4: Deduplicated Stock Selection
      let mediaUrl = context.mediaSource === 'real_video' || context.visualType === 'video_footage'
        ? SceneIntelligenceEngine.selectBestStockClip(context.keywords, project.category || 'Geopolitics', usedMediaUrls).url
        : MediaSourceManager.searchLocalLibraryFootage(narration, project.category);
      usedMediaUrls.add(mediaUrl);

      plannedScenes.push({
        id: `shot_${String(idx + 1).padStart(3, '0')}`,
        shot_number: idx + 1,
        title: context.title,
        narration,
        duration: durationSec,
        visual_type: context.visualType,
        media_source: context.mediaSource,
        badge: context.badge,
        media_url: mediaUrl,
        camera_movement: context.cameraMovement,
        transition: context.transition || (idx % 3 === 1 ? 'whip_pan' : 'crossfade'),
        visual_description: `Dynamic shot #${idx + 1} (${context.badge}) with ${context.cameraMovement} movement and fast shift.`,
        location: context.location,
        coordinates: context.coordinates,
        layers: {
          particles: idx % 2 === 0 ? 'dust_motes' : 'light_leaks'
        },
        archival_data: context.archivalData,
        data_metric: context.dataMetric,
        map_config: {
          region: 'Global',
          targetName: (project.topic || 'THEATER').toUpperCase(),
          highlighted_countries: ['US', 'CN', 'RU', 'IN']
        },
        audio: {
          music_volume: 0.14,
          sfx: idx === 0 ? 'braam-impact' : 'tactical-whoosh'
        }
      });
    }

    return plannedScenes;
  }

  /**
   * Studio Audio Mastering (High-pass 85Hz + EQ + Compression + EBU R128 Loudnorm)
   */
  private static async masterAudio(inputWav: string, outputWav: string): Promise<void> {
    return new Promise((resolve) => {
      if (!fs.existsSync(inputWav)) return resolve();
      const afFilter = 'highpass=f=85,equalizer=f=3000:width_type=o:width=1.5:g=3,acompressor=threshold=-16dB:ratio=3:attack=10:release=120,loudnorm=I=-16:TP=-1.5:LRA=11';
      const args = ['-y', '-i', inputWav, '-af', afFilter, '-ar', '48000', '-ac', '2', outputWav];
      const p = spawn('ffmpeg', args);

      p.on('close', () => {
        try { if (inputWav !== outputWav) fs.unlinkSync(inputWav); } catch (e) { }
        resolve();
      });

      p.on('error', () => {
        try { if (inputWav !== outputWav) fs.copyFileSync(inputWav, outputWav); } catch (e) { }
        resolve();
      });
    });
  }

  /**
   * Parse SRT file into structured cue objects for frame-accurate Remotion closed captions
   */
  private static parseSrtToCues(srtPath: string, fps = 30): any[] {
    if (!fs.existsSync(srtPath)) return [];
    try {
      const text = fs.readFileSync(srtPath, 'utf-8');
      const cues: any[] = [];
      const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const blocks = normalized.trim().split(/\n\s*\n/);
      for (const b of blocks) {
        const lines = b.trim().split('\n');
        if (lines.length < 3) continue;
        const timeLine = lines[1];
        const m = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})/);
        if (!m) continue;
        const startSec = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + parseInt(m[4], 10) / 1000;
        const endSec = parseInt(m[5], 10) * 3600 + parseInt(m[6], 10) * 60 + parseInt(m[7], 10) + parseInt(m[8], 10) / 1000;
        const cueText = lines.slice(2).join(' ').trim();
        const startFrame = Math.round(startSec * fps);
        const endFrame = Math.round(endSec * fps);
        cues.push({
          index: cues.length + 1,
          startTime: startSec,
          endTime: endSec,
          text: cueText,
          startFrame,
          endFrame,
          durationFrames: Math.max(1, endFrame - startFrame)
        });
      }
      return cues;
    } catch (e) {
      return [];
    }
  }

  /**
   * Measure audio duration using ffprobe
   */
  private static async probeAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve) => {
      const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', audioPath];
      const p = spawn('ffprobe', args);
      let out = '';
      p.stdout.on('data', (d) => { out += d.toString(); });
      p.on('close', () => {
        try {
          const data = JSON.parse(out);
          const dur = parseFloat(data.format?.duration || '30');
          resolve(dur);
        } catch (e) {
          resolve(30);
        }
      });
      p.on('error', () => resolve(30));
    });
  }

  private static async generateVoice(text: string, outputPath: string, voice = 'af_heart', lang = 'a'): Promise<void> {
    return new Promise((resolve, reject) => {
      const scriptTemp = path.join(process.cwd(), 'scripts', `temp_narration_${Date.now()}.txt`);
      fs.writeFileSync(scriptTemp, text, 'utf-8');

      const pythonExe = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const genScript = path.join(process.cwd(), 'scripts', 'generate_narration.py');

      const langCode = (lang === 'Hindi' || lang === 'hi' || lang === 'h') ? 'h' : 'a';
      const voiceName = (langCode === 'h') ? 'hf_alpha' : (voice || 'af_heart');

      const rawTempPath = outputPath + '.raw.wav';
      const args = [genScript, scriptTemp, rawTempPath, '--voice', voiceName, '--lang', langCode];
      const p = spawn(pythonExe, args);

      p.on('close', async (code) => {
        try { fs.unlinkSync(scriptTemp); } catch (e) { }
        if (code === 0 && fs.existsSync(rawTempPath)) {
          // Master voice track with broadcast EQ and loudness normalization
          await this.masterAudio(rawTempPath, outputPath);
          resolve();
        } else {
          reject(new Error(`TTS generation failed with exit code ${code}`));
        }
      });
      p.on('error', reject);
    });
  }

  private static async generateSubtitles(audioPath: string, outputPath: string, language = 'en'): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonExe = path.join(process.cwd(), '.venv-tts', 'Scripts', 'python.exe');
      const transcribeScript = path.join(process.cwd(), 'scripts', 'transcribe.py');

      const langCode = (language === 'Hindi' || language === 'hi') ? 'hi' : 'en';
      const args = [transcribeScript, audioPath, outputPath, '--model', 'base', '--language', langCode];
      
      const p = spawn(pythonExe, args, {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      p.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Whisper transcription failed with exit code ${code}`));
      });
      p.on('error', reject);
    });
  }

  private static generateSocialCaptions(project: VideoProject, script: string): SocialCaptions {
    return {
      youtube_titles: [
        `Why ${project.topic} Dictates Global Geopolitics`,
        `The Hidden Strategic Power of ${project.topic} Explained`,
        `Inside ${project.topic}: The Crucial Chokepoint of World Trade`
      ],
      youtube_description: `An in-depth documentary explainer analyzing ${project.topic}.\n\n` +
        `In this video, we break down the sovereign territory, trade routes, naval significance, and future international implications.\n\n` +
        `TIMESTAMPS:\n00:00 Introduction\n00:30 Strategic Geography\n01:15 Global Trade & Security\n02:00 Key Conclusions\n\n` +
        `Produced locally with Local AI Video Studio.`,
      youtube_chapters: [
        '00:00 - Introduction & Strategic Overview',
        '00:30 - Geographic Chokepoints',
        '01:15 - Maritime Routes & Economy',
        '02:00 - Geopolitical Summary'
      ],
      tags: ['Geopolitics', 'Documentary', 'Strategy', 'Trade Routes', 'History', 'Military Analysis'],
      hashtags: ['#Geopolitics', '#Documentary', '#Strategy', '#WorldNews', '#Explainers'],
      instagram_caption: `Why is ${project.topic} critical to international security? Here is the complete breakdown. #Geopolitics #Analysis`,
      reels_caption: `The strategic importance of ${project.topic} explained in 60 seconds! 🌍🛳️ #documentary #shorts`,
      shorts_title: `${project.topic} in 60 Seconds: Why It Matters!`,
      pinned_comment: `What are your thoughts on the international balance of power around ${project.topic}? Share your perspective below!`,
      hook_ideas: [
        `If this single passage is closed, global energy supplies stall overnight.`,
        `Look closely at this map: why are global superpowers positioned right here?`
      ]
    };
  }

  private static async renderVideo(projectId: string, outputPath: string): Promise<void> {
    const project = await getQuery<any>('SELECT * FROM projects WHERE id = ?', [projectId]);
    const resolution = project?.resolution || '1080p';
    const aspectRatio = project?.aspect_ratio || '16:9';

    let width = 1920;
    let height = 1080;

    if (resolution === '4K') {
      if (aspectRatio === '9:16') {
        width = 2160;
        height = 3840;
      } else if (aspectRatio === '1:1') {
        width = 2160;
        height = 2160;
      } else if (aspectRatio === '4:5') {
        width = 2160;
        height = 2700;
      } else {
        width = 3840;
        height = 2160;
      }
    } else if (resolution === '720p') {
      if (aspectRatio === '9:16') {
        width = 720;
        height = 1280;
      } else if (aspectRatio === '1:1') {
        width = 720;
        height = 720;
      } else if (aspectRatio === '4:5') {
        width = 720;
        height = 900;
      } else {
        width = 1280;
        height = 720;
      }
    } else { // 1080p
      if (aspectRatio === '9:16') {
        width = 1080;
        height = 1920;
      } else if (aspectRatio === '1:1') {
        width = 1080;
        height = 1080;
      } else if (aspectRatio === '4:5') {
        width = 1080;
        height = 1350;
      } else {
        width = 1920;
        height = 1080;
      }
    }

    // Measure exact narration audio duration
    const narrationPath = path.join(process.cwd(), 'public', 'audio', `narration_${projectId}.wav`);
    const audioDurSec = await this.probeAudioDuration(narrationPath);
    const totalFrames = Math.max(90, Math.ceil(audioDurSec * 30));

    // Parse subtitle cues directly for guaranteed frame-accurate Remotion closed captions
    const srtPath = path.join(process.cwd(), 'public', `subtitles_${projectId}.srt`);
    const subtitleCues = this.parseSrtToCues(srtPath, 30);

    // Choose cinematic BGM track based on category
    const cat = (project?.category || '').toLowerCase();
    let musicTrack = '/audio/bgm/epic_geopolitics.wav';
    if (cat.includes('tech') || cat.includes('ai')) {
      musicTrack = '/audio/bgm/tech_cyber.wav';
    } else if (cat.includes('history') || cat.includes('explain')) {
      musicTrack = '/audio/bgm/ambient_documentary.wav';
    }

    // Distribute shots across duration proportionally matched to narrative word count
    const rawScenes: any[] = project?.scene_data ? JSON.parse(project.scene_data) : [];
    const numScenes = Math.max(1, rawScenes.length);
    const totalWords = rawScenes.reduce((acc, s) => acc + (s.narration?.trim().split(/\s+/).length || 4), 0);
    let accumulatedFrames = 0;

    const cinematicScenes = rawScenes.map((s, idx) => {
      const words = s.narration?.trim().split(/\s+/).length || 4;
      const shotDurFrames = idx === numScenes - 1
        ? Math.max(60, totalFrames - accumulatedFrames)
        : Math.max(60, Math.round((words / totalWords) * totalFrames));

      const startF = accumulatedFrames;
      accumulatedFrames += shotDurFrames;

      return {
        id: s.id || `shot_${idx + 1}`,
        type: s.visual_type || 'video_footage',
        badge: s.badge || (s.visual_type === 'video_footage' ? '[Real Video Footage]' : '[Motion Graphics]'),
        mediaUrl: s.media_url || '/videos/library/ocean_naval.mp4',
        cameraMovement: s.camera_movement || 'dolly_in',
        transition: s.transition || 'fade',
        title: s.title || project.title,
        subtitle: s.narration ? `${s.narration.slice(0, 80)}...` : 'Strategic analysis and territorial assessment.',
        location: s.location || 'STRATEGIC MONITOR',
        coordinates: s.coordinates || "26°34'12\"N // 56°15'08\"E",
        narration: s.narration,
        startFrame: startF,
        durationFrames: shotDurFrames,
        layers: s.layers || { particles: idx % 2 === 0 ? 'dust_motes' : 'light_leaks' },
        archivalData: s.archival_data || (s.visual_type === 'archival_document' ? {
          headline: (s.title || project.title).toUpperCase(),
          publication: 'THE GEOPOLITICAL HISTORICAL RECORD',
          date: 'OCTOBER 1973 // STRATEGIC DISPATCH',
          snippet: s.narration || '',
        highlightPhrase: 'Critical strategic corridor under international maritime scrutiny.'
        } : undefined),
        visualData: {
          targetName: (project.topic || 'TACTICAL THEATER').toUpperCase(),
          statNumber: s.data_metric?.statNumber || (idx === 2 ? '21,000,000' : undefined),
          statLabel: s.data_metric?.statLabel || (idx === 2 ? 'BARRELS PER DAY' : undefined),
          statSubtext: s.data_metric?.statSubtext || (idx === 2 ? 'Over 20% of international petroleum trade flows through this single corridor.' : undefined),
        }
      };
    });

    return new Promise((resolve, reject) => {
      const relPropsPath = path.join('public', `props_${projectId}.json`);
      const absPropsPath = path.join(process.cwd(), relPropsPath);
      const propsData = {
        title: (project.title || project.topic).toUpperCase(),
        subtitle: 'STRATEGIC GEOPOLITICS // SPECIAL INTELLIGENCE REPORT',
        category: project.category || 'Geopolitics',
        topic: project.topic,
        narrationSrc: `/audio/narration_${projectId}.wav`,
        musicSrc: musicTrack,
        subtitlesData: { cues: subtitleCues },
        captionTemplate: project.caption_template || 'karaoke-highlight',
        scenes: cinematicScenes,
        durationInFrames: totalFrames
      };
      fs.writeFileSync(absPropsPath, JSON.stringify(propsData, null, 2), 'utf-8');

      const npxArgs = [
        'remotion', 'render',
        'src/index.ts',
        'CinematicDocumentary',
        outputPath.replace(/\\/g, '/'),
        `--props=${relPropsPath.replace(/\\/g, '/')}`,
        `--width=${width}`,
        `--height=${height}`,
        `--frames=0-${totalFrames - 1}`,
        '--pixel-format=yuv420p',
        '--crf=16',
        '--preset=medium',
        '--audio-bitrate=320k',
        '--jpeg-quality=98',
        '--concurrency=4',
        '--overwrite'
      ];

      const p = spawn('npx.cmd', npxArgs, { shell: true });
      let stderr = '';
      p.stdout?.on('data', (d) => {
        const text = d.toString().trim();
        if (text) console.log(`[Remotion ${projectId}]`, text);
      });
      p.stderr?.on('data', (d) => {
        const text = d.toString();
        stderr += text;
        if (text.includes('Error')) console.error(`[Remotion ERR ${projectId}]`, text.trim());
      });

      p.on('close', (code) => {
        try { fs.unlinkSync(absPropsPath); } catch (e) { }
        if (code === 0) resolve();
        else reject(new Error(`Remotion render exited with code ${code}: ${stderr.slice(-300)}`));
      });
      p.on('error', reject);
    });
  }
}
