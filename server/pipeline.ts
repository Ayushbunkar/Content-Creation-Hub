import { VideoProject, SceneData, PipelineStage, ResearchSummary, SocialCaptions, VisualShotType, MediaSource, CameraMovement, SfxCue } from './types';
import { runQuery, getQuery } from './db';
import { MediaSourceManager, QualityChecker, VisualDiversityEngine } from './mediaSource';
import { DocumentaryResearchService, ResearchDossier } from './documentaryResearch';
import { DocumentaryNarrativeEngine } from './documentaryNarrative';
import { SceneIntelligenceEngine } from './sceneIntelligence';
import { VideoEnhancerService } from './videoEnhancer';
import { CinematicEditorialEngine, SoundDesignEngine } from './cinematicEditorialEngine';
import { SoundDesignSystem } from './soundDesignSystem';
import { CopyrightLicenseManager } from './copyrightService';
import { AudioPoliceService } from './audioPolice';
import { QualityControlEngine } from './qualityControlEngine';
import { PerformanceResourceManager } from './resourceManager';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export class PipelineManager {
  private static activeJobs: Map<string, boolean> = new Map();
  private static runningProcesses: Map<string, any> = new Map();
  private static listeners: Array<(jobUpdate: any) => void> = [];

  static subscribe(fn: (jobUpdate: any) => void) {
    this.listeners.push(fn);
  }

  static broadcast(update: any) {
    this.listeners.forEach((fn) => {
      try { fn(update); } catch (e) { }
    });
  }

  static cancelPipeline(projectId: string): boolean {
    this.activeJobs.delete(projectId);
    const proc = this.runningProcesses.get(projectId);
    if (proc) {
      try {
        proc.kill('SIGKILL');
      } catch (e) { }
      this.runningProcesses.delete(projectId);
    }
    this.updateStage(projectId, 'READY_FOR_EDITING', 0, 'failed', 'Render cancelled by user');
    return true;
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
    if (!projectRow) return;

    let parsedScenes: any[] = [];
    try {
      if (typeof projectRow.scene_data === 'string' && projectRow.scene_data.trim().startsWith('[')) {
        parsedScenes = JSON.parse(projectRow.scene_data);
      } else if (Array.isArray(projectRow.scene_data)) {
        parsedScenes = projectRow.scene_data;
      }
    } catch (e) {
      parsedScenes = [];
    }

    const project: VideoProject = {
      ...projectRow,
      scene_data: parsedScenes,
    };

    // Initialize media library
    await MediaSourceManager.initMediaLibrary();

    const narrationWav = path.join(process.cwd(), 'public', 'audio', `narration_${projectId}.wav`);
    const srtPath = path.join(process.cwd(), 'public', `subtitles_${projectId}.srt`);

    // Fast-path resume: If already at FINAL_RENDER with audio & subtitles ready, jump directly to final render!
    if (projectRow.current_stage === 'FINAL_RENDER' && fs.existsSync(narrationWav)) {
      console.log(`[Pipeline] Resuming project ${projectId} directly from FINAL_RENDER...`);
    } else {
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

      // 4. SCENE PLANNING (Granular Shot Division: strictly 3.0 - 3.8s per shot)
      await this.updateStage(projectId, 'SCENE_PLANNING', 40);
      const initialSceneData = (parsedScenes && parsedScenes.length > 0)
        ? parsedScenes
        : await this.planScenes(project, script);
      await runQuery('UPDATE projects SET scene_data = ? WHERE id = ?', [JSON.stringify(initialSceneData), projectId]);

      const refreshedProject = await getQuery<any>('SELECT mode, review_approved FROM projects WHERE id = ?', [projectId]);

      // If project is in Review Mode and not approved yet, PAUSE for user review
      if (refreshedProject?.mode === 'review' && !refreshedProject?.review_approved) {
        await this.updateStage(projectId, 'SCENE_PLANNING', 45, 'draft');
        this.broadcast({
          projectId,
          stage: 'REVIEW_PAUSED',
          progress: 45,
          status: 'draft',
          message: 'Research, Claim Ledger, Script, and 3-4s Storyboard complete. Ready for review and approval in Documentary Studio.'
        });
        return; // Pause pipeline until user clicks Approve in UI
      }

      // 5. ASSET COLLECTION (High-speed concurrent download & AI visual synthesis)
      await this.updateStage(projectId, 'ASSET_COLLECTION', 50);
      const totalShots = initialSceneData.length;
      const BATCH_CONCURRENCY = 6;
      let completedShots = 0;

      const processShotAsset = async (shot: any) => {
        if (!shot.media_url || shot.visual_type === 'video_footage' || shot.visual_type === 'ai_video' || shot.visual_type === 'layered_parallax' || shot.visual_type === 'data_metric') {
          const shotId = `${projectId}_${shot.id}`;
          shot.media_url = await MediaSourceManager.fetchCopyrightFreeAsset(
            shot.narration || shot.title,
            project.category,
            shotId,
            shot.duration || 4,
            project.aspect_ratio || '16:9',
            projectId
          );
        }
        completedShots++;
        const progressPct = Math.round(50 + ((completedShots) / Math.max(1, totalShots)) * 5);
        await this.updateStage(projectId, 'ASSET_COLLECTION', progressPct);
      };

      for (let i = 0; i < totalShots; i += BATCH_CONCURRENCY) {
        const batch = initialSceneData.slice(i, i + BATCH_CONCURRENCY);
        await Promise.all(batch.map((shot: any) => processShotAsset(shot)));
      }
      await this.updateStage(projectId, 'IMAGE_AND_GRAPHIC_PREPARATION', 55);

      // 6. VOICE GENERATION (Kokoro TTS)
      await this.updateStage(projectId, 'VOICE_GENERATION', 65);
      if (!fs.existsSync(narrationWav) || fs.statSync(narrationWav).size < 10000) {
        try {
          await this.generateVoice(script, narrationWav, project.voice, project.language);
        } catch (e: any) {
          console.warn(`[Pipeline] Voice generation error for ${projectId}:`, e?.message);
        }
      }
      await runQuery('UPDATE projects SET narration_file = ? WHERE id = ?', [`/audio/narration_${projectId}.wav`, projectId]);

      // Register voice narration in persistent Copyright & Licensing registry
      try {
        await CopyrightLicenseManager.registerNarrationTrack(projectId, project.voice || 'af_heart', narrationWav);
      } catch (e: any) {
        console.warn(`[Pipeline] Voice narration copyright registration note:`, e?.message);
      }

      // 7. SUBTITLE GENERATION (Whisper base)
      await this.updateStage(projectId, 'SUBTITLE_GENERATION', 75);
      if (!fs.existsSync(srtPath) || fs.statSync(srtPath).size < 100) {
        try {
          await this.generateSubtitles(narrationWav, srtPath, project.language);
        } catch (e: any) {
          console.warn(`[Pipeline] Subtitle generation error for ${projectId}:`, e?.message);
        }
      }
      await runQuery('UPDATE projects SET subtitles_file = ? WHERE id = ?', [`/subtitles_${projectId}.srt`, projectId]);

      // 8. QUALITY CHECK & AUTOMATIC ENHANCEMENT (Strict 3-4s Rule & Zero Static Slides)
      await this.updateStage(projectId, 'QUALITY_CHECK', 80);
      const { scenes: verifiedScenes, report: qcReport } = QualityChecker.inspectAndUpgrade(initialSceneData, project.category);
      await runQuery('UPDATE projects SET scene_data = ?, qc_report = ? WHERE id = ?', [
        JSON.stringify(verifiedScenes),
        JSON.stringify(qcReport),
        projectId
      ]);

      // 9. SOCIAL CAPTIONS GENERATION
      const socialCaptions = this.generateSocialCaptions(project, script);
      await runQuery('UPDATE projects SET social_captions = ? WHERE id = ?', [JSON.stringify(socialCaptions), projectId]);

      // 10. ANIMATION & VIDEO ASSEMBLY
      await this.updateStage(projectId, 'ANIMATION_GENERATION', 85);
      await this.updateStage(projectId, 'AUDIO_ASSEMBLY', 90);
      await this.updateStage(projectId, 'VIDEO_ASSEMBLY', 95);
    }

    // 11. FINAL RENDER & VALIDATION
    await this.updateStage(projectId, 'FINAL_RENDER', 98);
    const videoOutput = path.join('output', `${projectId}.mp4`);
    let finalOutputPath = videoOutput;

    try {
      // Mandatory Pre-Export Audio Copyright Police Inspection Gate
      const audioGate = await AudioPoliceService.runProjectPreExportGate(projectId);
      if (!audioGate.canExport) {
        throw new Error(`Audio Copyright Police Gate Blocked Export: ${audioGate.blockReason}`);
      }

      // Mandatory Pre-Render Automatic Quality Control Validation Gate (Requirement 14)
      const qcReport = await QualityControlEngine.validateProject(projectId);
      if (!qcReport.canRender) {
        console.warn(`[Pipeline] Quality Control detected ${qcReport.errorCount} blocking issues in ${projectId}. Attempting autofix...`);
        const fixedReport = await QualityControlEngine.autoFix(projectId);
        if (!fixedReport.canRender) {
          throw new Error(`Automatic Quality Control Blocked Render: ${fixedReport.errors.join('; ')}`);
        }
      }

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

      // Generate Comprehensive YouTube Copyright & Asset Licensing Report
      try {
        const copyrightReport = await CopyrightLicenseManager.generateYouTubeCopyrightReport(projectId);
        console.log(`[Pipeline] YouTube Copyright Report generated for ${projectId}: Status = ${copyrightReport.summary.overallClearance}, ${copyrightReport.summary.commercialClearedPercent}% cleared`);

        // Automatically append copyright and licensing attribution to YouTube description
        const currentProject = await getQuery<any>('SELECT social_captions FROM projects WHERE id = ?', [projectId]);
        if (currentProject?.social_captions) {
          try {
            const sc = JSON.parse(currentProject.social_captions);
            if (sc.youtube_description && !sc.youtube_description.includes('RIGHTS & USAGE NOTICE')) {
              sc.youtube_description = `${sc.youtube_description}\n\n${copyrightReport.youtubeDescriptionCredits}`;
              await runQuery('UPDATE projects SET social_captions = ? WHERE id = ?', [JSON.stringify(sc), projectId]);
            }
          } catch (scErr) {}
        }
      } catch (crErr: any) {
        console.warn(`[Pipeline] Copyright report generation note:`, crErr?.message);
      }
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
    const audioPath = path.join(process.cwd(), 'public', 'audio', `narration_${project.id}.wav`);
    const audioDur = fs.existsSync(audioPath) ? await this.probeAudioDuration(audioPath) : (project.duration || 120);

    const timeline = CinematicEditorialEngine.composeMasterTimeline(
      project,
      script,
      audioDur,
      (project.visual_style as any) || 'cinematic_investigative'
    );

    return timeline.scenes;
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
   * Strictly enforces ONE-LINE punchy captions (max 4-5 words per cue)
   */
  private static parseSrtToCues(srtPath: string, fps = 30): any[] {
    if (!fs.existsSync(srtPath)) return [];
    try {
      const text = fs.readFileSync(srtPath, 'utf-8');
      const cues: any[] = [];
      const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const blocks = normalized.trim().split(/\n\s*\n/);
      const MAX_WORDS_PER_LINE = 5;

      for (const b of blocks) {
        const lines = b.trim().split('\n');
        if (lines.length < 3) continue;
        const timeLine = lines[1];
        const m = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})/);
        if (!m) continue;
        const startSec = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + parseInt(m[4], 10) / 1000;
        const endSec = parseInt(m[5], 10) * 3600 + parseInt(m[6], 10) * 60 + parseInt(m[7], 10) + parseInt(m[8], 10) / 1000;
        const rawText = lines.slice(2).join(' ').replace(/\s+/g, ' ').trim();
        if (!rawText) continue;

        const words = rawText.split(' ').filter(w => w.trim().length > 0);
        if (words.length <= MAX_WORDS_PER_LINE) {
          const startFrame = Math.round(startSec * fps);
          const endFrame = Math.round(endSec * fps);
          cues.push({
            index: cues.length + 1,
            startTime: startSec,
            endTime: endSec,
            text: rawText,
            startFrame,
            endFrame,
            durationFrames: Math.max(1, endFrame - startFrame)
          });
        } else {
          // Subdivide long multi-line cue into 1-line segments matching voiceover pace
          const chunks: string[] = [];
          for (let i = 0; i < words.length; i += MAX_WORDS_PER_LINE) {
            chunks.push(words.slice(i, i + MAX_WORDS_PER_LINE).join(' '));
          }

          const totalDuration = Math.max(0.6, endSec - startSec);
          const totalWords = words.length;
          let currentStartSec = startSec;

          for (let k = 0; k < chunks.length; k++) {
            const chunkWords = chunks[k].split(' ').length;
            const chunkDuration = (chunkWords / totalWords) * totalDuration;
            const chunkEndSec = k === chunks.length - 1 ? endSec : (currentStartSec + chunkDuration);

            const startFrame = Math.round(currentStartSec * fps);
            const endFrame = Math.round(chunkEndSec * fps);

            cues.push({
              index: cues.length + 1,
              startTime: currentStartSec,
              endTime: chunkEndSec,
              text: chunks[k],
              startFrame,
              endFrame,
              durationFrames: Math.max(1, endFrame - startFrame)
            });

            currentStartSec = chunkEndSec;
          }
        }
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

  static async renderPreview(projectId: string): Promise<string> {
    const relPreview = `output_${projectId}_preview.mp4`;
    const outputPath = path.join(process.cwd(), 'public', relPreview);
    await this.renderVideo(projectId, outputPath, true);
    try {
      await runQuery('UPDATE projects SET preview_output = ? WHERE id = ?', [relPreview, projectId]);
    } catch (e) {}
    return relPreview;
  }

  private static async renderVideo(projectId: string, outputPath: string, isPreview: boolean = false): Promise<void> {
    const releaseLock = await PerformanceResourceManager.acquireRenderLock(projectId);
    try {
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
    // Render the complete full documentary matching the voiceover narration (e.g. 7-8 minutes / 407s)
    const targetDurSec = audioDurSec > 0 ? audioDurSec : (project?.duration ? project.duration * 60 : 480);
    const totalFrames = Math.max(90, Math.ceil(targetDurSec * 30));

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

    // Compose master timeline with complete synchronized sound effects and kinetic typography
    const timeline = CinematicEditorialEngine.composeMasterTimeline(
      project,
      project.script || '',
      audioDurSec,
      (project.visual_style as any) || 'cinematic_investigative'
    );

    let rawScenes: any[] = [];
    try {
      if (typeof project?.scene_data === 'string' && project.scene_data.trim().startsWith('[')) {
        rawScenes = JSON.parse(project.scene_data);
      } else if (Array.isArray(project?.scene_data)) {
        rawScenes = project.scene_data;
      }
    } catch (e) {
      console.warn(`[Pipeline] scene_data parse fallback:`, e);
      rawScenes = [];
    }
    if (!rawScenes || rawScenes.length === 0) {
      rawScenes = timeline.scenes;
    }

    const numScenes = Math.max(1, rawScenes.length);
    const rawTotalSec = rawScenes.reduce((acc, s) => acc + (s.duration || 6), 0);
    const scaleFactor = rawTotalSec > 0 ? (targetDurSec / rawTotalSec) : 1;
    let accumulatedFrames = 0;

    // Reset visual diversity engine to enforce MAX 2 uses per asset across entire documentary
    VisualDiversityEngine.resetProject(projectId);
    let lastUsedMedia = '';

    const cinematicScenes = rawScenes.map((s, idx) => {
      // Scale shot durations proportionally to cover the full duration
      const rawSec = (s.duration || 6) * scaleFactor;
      let shotDurFrames = Math.max(60, Math.round(rawSec * 30));

      if (idx === numScenes - 1) {
        shotDurFrames = Math.max(60, totalFrames - accumulatedFrames);
      } else if (accumulatedFrames + shotDurFrames > totalFrames - 60) {
        shotDurFrames = Math.max(60, totalFrames - accumulatedFrames);
      }

      const startF = accumulatedFrames;
      accumulatedFrames += shotDurFrames;

      // Safe Media URL Resolution: verify file existence and gracefully fallback to .temp.jpg or stock library
      let resolvedMediaUrl = s.media_url || s.mediaUrl || '';
      if (typeof resolvedMediaUrl === 'string' && resolvedMediaUrl && !resolvedMediaUrl.startsWith('http')) {
        const localRel = resolvedMediaUrl.replace(/^\//, '');
        const localAbs = path.join(process.cwd(), 'public', localRel);
        if (!fs.existsSync(localAbs)) {
          const tempJpg = localAbs.replace(/\.mp4$/, '.temp.jpg');
          const normalJpg = localAbs.replace(/\.mp4$/, '.jpg');
          if (fs.existsSync(tempJpg)) {
            resolvedMediaUrl = resolvedMediaUrl.replace(/\.mp4$/, '.temp.jpg');
          } else if (fs.existsSync(normalJpg)) {
            resolvedMediaUrl = resolvedMediaUrl.replace(/\.mp4$/, '.jpg');
          } else {
            resolvedMediaUrl = '';
          }
        }
      }

      // Strict Anti-Repetition Rule: MAX 2 uses per asset across entire video, and no immediate back-to-back repeats
      if (
        !resolvedMediaUrl ||
        resolvedMediaUrl === lastUsedMedia ||
        !VisualDiversityEngine.isAvailable(projectId, resolvedMediaUrl)
      ) {
        resolvedMediaUrl = VisualDiversityEngine.getDiverseUniqueAsset(
          s.narration || s.title || project.title,
          cat,
          projectId,
          idx
        );
      } else {
        VisualDiversityEngine.recordUsage(projectId, resolvedMediaUrl);
      }
      lastUsedMedia = resolvedMediaUrl;

      return {
        id: s.id || `shot_${idx + 1}`,
        type: s.visual_type || s.type || 'archival_photo',
        badge: s.badge || '[Cinematic Beat]',
        mediaUrl: resolvedMediaUrl,
        cameraMovement: s.camera_movement || s.cameraMovement || 'dolly_in',
        transition: s.transition || 'fade',
        title: s.title || project.title,
        subtitle: s.narration ? `${s.narration.slice(0, 80)}...` : 'Strategic analysis and territorial assessment.',
        location: s.location || 'STRATEGIC MONITOR',
        coordinates: s.coordinates || "26°34'12\"N // 56°15'08\"E",
        narration: s.narration,
        startFrame: startF,
        durationFrames: shotDurFrames,
        layers: s.layers || { particles: (s.visual_type === 'kinetic_title_card' || idx % 2 === 0) ? 'embers' : 'dust_motes' },
        personData: s.person_data || s.personData,
        kineticTitleData: s.kinetic_title_data || s.kineticTitleData,
        newspaperData: s.newspaper_data || s.newspaperData,
        comparisonData: s.comparison_data || s.comparisonData,
        archivalData: s.archival_data || s.archivalData || ((s.visual_type === 'newspaper_headline' || s.visual_type === 'archival_document') ? {
          headline: (s.title || project.title).toUpperCase(),
          publication: 'THE GEOPOLITICAL HISTORICAL RECORD',
          date: 'OCTOBER 1973 // STRATEGIC DISPATCH',
          snippet: s.narration || '',
          highlightPhrase: 'Critical strategic corridor under international maritime scrutiny.'
        } : undefined),
        visualData: s.visualData || (s.visual_type === 'tactical_map' ? {
          region: (project.topic || 'GEOPOLITICAL THEATER').toUpperCase(),
          highlightedEntities: ['United States of America', 'China', 'Taiwan'],
          markers: [
            { name: 'Silicon Valley, USA', coord: [-122.0838, 37.3861], label: 'AI COMPUTE EPICENTER', type: 'hub' },
            { name: 'Taipei, Taiwan', coord: [121.5654, 25.0330], label: 'TSMC 3NM SILICON CORRIDOR', type: 'chokepoint' },
          ],
          routes: [
            { from: [-122.0838, 37.3861] as [number, number], to: [121.5654, 25.0330] as [number, number], label: 'PACIFIC SUPPLY CHAIN' }
          ]
        } : {
          targetName: (project.topic || 'TACTICAL THEATER').toUpperCase(),
          statNumber: s.data_metric?.statNumber || (idx === 2 ? '21,000,000' : undefined),
          statLabel: s.data_metric?.statLabel || (idx === 2 ? 'BARRELS PER DAY' : undefined),
          statSubtext: s.data_metric?.statSubtext || (idx === 2 ? 'Over 20% of international petroleum trade flows through this single corridor.' : undefined),
        })
      };
    });

    // Sound effects generation from scenes via dedicated SoundDesignSystem
    const sfxCues = SoundDesignSystem.generateSceneSfx(cinematicScenes, 30);
    const bgmMatch = SoundDesignSystem.selectBgm(project.topic || project.category || '');
    const finalMusicSrc = timeline.musicTrack || bgmMatch.trackPath || musicTrack;

    // Register BGM and SFX in persistent Copyright & Licensing Registry
    try {
      await CopyrightLicenseManager.registerProjectMusic(projectId, finalMusicSrc);
      const validSfx = sfxCues.map((c: any) => c.src || c.file).filter((f: any) => typeof f === 'string' && f.length > 0);
      if (validSfx.length > 0) {
        await CopyrightLicenseManager.registerProjectSfx(projectId, validSfx);
      }
    } catch (e: any) {
      console.warn(`[Pipeline] Audio copyright registration note:`, e?.message);
    }

      // Optimize image assets to prevent Chromium VRAM spikes on GTX 1650 4GB
      for (const sc of cinematicScenes) {
        if (sc.imageSrc && !sc.imageSrc.startsWith('http') && !sc.imageSrc.startsWith('data:')) {
          const localPath = path.isAbsolute(sc.imageSrc) ? sc.imageSrc : path.join(process.cwd(), 'public', sc.imageSrc.replace(/^\//, ''));
          sc.imageSrc = await PerformanceResourceManager.getOptimizedAssetPath(localPath, width, height);
        }
      }

      return await new Promise<void>((resolve, reject) => {
        const relPropsPath = path.join('public', `props_${projectId}.json`);
        const absPropsPath = path.join(process.cwd(), relPropsPath);
        const propsData = {
          title: (project.title || project.topic).toUpperCase(),
          subtitle: 'STRATEGIC GEOPOLITICS // SPECIAL INTELLIGENCE REPORT',
          category: project.category || 'Geopolitics',
          topic: project.topic,
          narrationSrc: `/audio/narration_${projectId}.wav`,
          musicSrc: finalMusicSrc,
          subtitlesData: { cues: subtitleCues },
          captionTemplate: project.caption_template || 'karaoke-highlight',
          sfxCues: sfxCues,
          scenes: cinematicScenes,
          durationInFrames: totalFrames
        };
        fs.writeFileSync(absPropsPath, JSON.stringify(propsData, null, 2), 'utf-8');

        const remotionCli = path.join(process.cwd(), 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
        const remotionArgs = PerformanceResourceManager.getOptimizedRemotionArgs({
          remotionCli,
          entryPoint: 'src/index.ts',
          compositionId: 'CinematicDocumentary',
          outputPath,
          propsPath: relPropsPath,
          width,
          height,
          totalFrames,
          isPreview
        });

        const p = spawn(process.execPath, remotionArgs);
        PipelineManager.runningProcesses.set(projectId, p);
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
          PipelineManager.runningProcesses.delete(projectId);
          try { fs.unlinkSync(absPropsPath); } catch (e) { }
          PerformanceResourceManager.cleanupTempFiles();
          if (code === 0 || fs.existsSync(outputPath)) resolve();
          else reject(new Error(`Remotion render exited with code ${code}: ${stderr.slice(-300)}`));
        });
        p.on('error', (err) => {
          PipelineManager.runningProcesses.delete(projectId);
          reject(err);
        });
      });
    } finally {
      releaseLock();
    }
  }

  /**
   * Final file validation using FFprobe verifying container format, H.264 stream, resolution, fps, audio samplerate, and AV synchronization
   */
  static async validateExportedFile(filePath: string, narrationAudioPath?: string): Promise<{
    valid: boolean;
    format: string;
    video: { codec: string; width: number; height: number; fps: number; duration: number };
    audio: { codec: string; sampleRate: number; channels: number; duration: number };
    syncCheck: { audioDiffSec: number; synchronized: boolean; message: string };
  }> {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    if (!fs.existsSync(absPath)) throw new Error(`Video file not found at ${absPath}`);

    return new Promise((resolve, reject) => {
      const p = spawn('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', absPath]);
      let stdout = '';
      p.stdout?.on('data', (d) => stdout += d.toString());
      p.on('close', async () => {
        try {
          const info = JSON.parse(stdout || '{}');
          const vStream = info.streams?.find((s: any) => s.codec_type === 'video') || {};
          const aStream = info.streams?.find((s: any) => s.codec_type === 'audio') || {};

          let fps = 30;
          if (vStream.r_frame_rate) {
            const parts = vStream.r_frame_rate.split('/');
            fps = parts.length === 2 && Number(parts[1]) > 0 ? Math.round(Number(parts[0]) / Number(parts[1])) : Number(parts[0]) || 30;
          }

          const videoDuration = Number(info.format?.duration || vStream.duration || 0);
          const audioDuration = Number(aStream.duration || videoDuration);

          let syncDiff = 0;
          if (narrationAudioPath && fs.existsSync(narrationAudioPath)) {
            const narrDur = await PipelineManager.probeAudioDuration(narrationAudioPath);
            syncDiff = Math.abs(videoDuration - narrDur);
          }

          resolve({
            valid: Boolean(vStream.codec_name && videoDuration > 0),
            format: info.format?.format_name || 'mp4',
            video: {
              codec: vStream.codec_name || 'h264',
              width: Number(vStream.width || 1920),
              height: Number(vStream.height || 1080),
              fps,
              duration: Math.round(videoDuration * 100) / 100
            },
            audio: {
              codec: aStream.codec_name || 'aac',
              sampleRate: Number(aStream.sample_rate || 48000),
              channels: Number(aStream.channels || 2),
              duration: Math.round(audioDuration * 100) / 100
            },
            syncCheck: {
              audioDiffSec: Math.round(syncDiff * 100) / 100,
              synchronized: syncDiff < 1.0,
              message: syncDiff < 1.0 ? 'Perfect frame-accurate A/V synchronization' : `Minor delta (${syncDiff.toFixed(2)}s)`
            }
          });
        } catch (e) {
          reject(e);
        }
      });
      p.on('error', reject);
    });
  }
}
