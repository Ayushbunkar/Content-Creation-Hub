import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { initDatabase, runQuery, getQuery, allQuery } from './db';
import { VideoProject, SceneData } from './types';
import { PipelineManager } from './pipeline';
import { CaptionStudioService } from './captionStudio';
import { MediaSourceManager, QualityChecker } from './mediaSource';
import { ViralClipperService } from './viralClipper';
import { DocumentaryResearchService } from './documentaryResearch';
import { DocumentaryNarrativeEngine } from './documentaryNarrative';
import { VideoEnhancerService } from './videoEnhancer';
import { CinematicEditorialEngine } from './cinematicEditorialEngine';
import { CopyrightLicenseManager } from './copyrightService';
import { AudioPoliceService } from './audioPolice';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Serve static frontend assets and generated project assets
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/output', express.static(path.join(process.cwd(), 'output')));
app.use('/storage', express.static(path.join(process.cwd(), 'storage')));

// WebSocket connections for real-time progress
const wsClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
});

PipelineManager.subscribe((update) => {
  const msg = JSON.stringify({ type: 'PIPELINE_UPDATE', data: update });
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
});

CaptionStudioService.subscribe((update) => {
  const msg = JSON.stringify({ type: 'CAPTION_STUDIO_UPDATE', data: update });
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
});

ViralClipperService.subscribe((update) => {
  const msg = JSON.stringify({ type: 'CLIPPER_UPDATE', data: update });
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
});

// ======================== API ROUTES ======================== //

// 1. Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await allQuery('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(projects.map(p => ({
      ...p,
      scene_data: p.scene_data ? JSON.parse(p.scene_data) : [],
      social_captions: p.social_captions ? JSON.parse(p.social_captions) : null,
      research_summary: p.research_summary ? JSON.parse(p.research_summary) : null
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 2. Get single project
app.get('/api/projects/:id', async (req, res) => {
  try {
    const p = await getQuery('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    res.json({
      ...p,
      scene_data: p.scene_data ? JSON.parse(p.scene_data) : [],
      social_captions: p.social_captions ? JSON.parse(p.social_captions) : null,
      research_summary: p.research_summary ? JSON.parse(p.research_summary) : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 3. Create and trigger new project generation
app.post('/api/projects', async (req, res) => {
  try {
    const {
      title,
      category,
      topic,
      duration = 60,
      language = 'English',
      voice = 'af_heart',
      aspect_ratio = '16:9',
      resolution = '1080p',
      fps = 30,
      visual_style = 'documentary',
      caption_template = 'minimal-white'
    } = req.body;

    const id = `proj_${Date.now()}`;
    const projectTitle = title || `${topic.slice(0, 40)}`;

    await runQuery(`
      INSERT INTO projects (
        id, title, category, topic, duration, language, voice, aspect_ratio, resolution, fps, visual_style, caption_template, status, current_stage, progress
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', 'JOB_CREATED', 5)
    `, [id, projectTitle, category, topic, duration, language, voice, aspect_ratio, resolution, fps, visual_style, caption_template]);

    // Start background asynchronous execution
    PipelineManager.startPipeline(id);

    res.json({ id, message: 'Generation started successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 3b. Resume / retry project generation pipeline
app.post('/api/projects/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getQuery('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    PipelineManager.startPipeline(id);
    res.json({ id, message: 'Pipeline generation resumed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// =========================================================================
// DOCUMENTARY STUDIO: RESEARCH, FACT-CHECKING & PRODUCTION ROUTES
// =========================================================================

// 1. Live Research on any topic or person
app.post('/api/documentary/research', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic or person name is required' });
    }
    const dossier = await DocumentaryResearchService.conductInvestigation(topic);
    res.json(dossier);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create and start autonomous documentary production
app.post('/api/documentary/create', async (req, res) => {
  try {
    const {
      topic,
      duration = 480, // 8 minutes default
      language = 'English',
      voice = 'am_adam',
      visual_style = 'investigative',
      mode = 'one_click', // 'one_click' | 'review'
      aspect_ratio = '16:9',
      resolution = '1080p'
    } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const id = `doc_${Date.now()}`;
    const cleanTitle = topic.split('\n')[0].slice(0, 70);

    await runQuery(`
      INSERT INTO projects (
        id, title, category, topic, duration, language, voice, aspect_ratio, resolution, fps, visual_style, caption_template, status, current_stage, progress, mode, review_approved
      ) VALUES (?, ?, 'Documentary Studio', ?, ?, ?, ?, ?, ?, 30, ?, 'cinematic-editorial', 'processing', 'JOB_CREATED', 5, ?, 0)
    `, [id, cleanTitle, topic, duration, language, voice, aspect_ratio, resolution, visual_style, mode]);

    // Launch pipeline
    PipelineManager.startPipeline(id);

    res.json({ id, message: 'Documentary project created and research initiated successfully', mode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get complete documentary project dossier
app.get('/api/documentary/projects/:id', async (req, res) => {
  try {
    const p = await getQuery('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Documentary project not found' });

    res.json({
      ...p,
      claim_ledger: p.claim_ledger ? JSON.parse(p.claim_ledger) : [],
      timeline: p.timeline ? JSON.parse(p.timeline) : [],
      entities: p.entities ? JSON.parse(p.entities) : [],
      asset_manifest: p.asset_manifest ? JSON.parse(p.asset_manifest) : [],
      documentary_chapters: p.documentary_chapters ? JSON.parse(p.documentary_chapters) : [],
      scene_data: p.scene_data ? JSON.parse(p.scene_data) : [],
      research_summary: p.research_summary ? JSON.parse(p.research_summary) : null,
      social_captions: p.social_captions ? JSON.parse(p.social_captions) : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Approve script in Review Mode to proceed with narration & video rendering
app.post('/api/documentary/projects/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const p = await getQuery('SELECT * FROM projects WHERE id = ?', [id]);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    await runQuery(`
      UPDATE projects SET 
        review_approved = 1,
        status = 'processing',
        current_stage = 'ASSET_COLLECTION',
        progress = 50,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    PipelineManager.startPipeline(id);
    res.json({ id, message: 'Review approved. Proceeding with voice synthesis and video assembly.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update script and re-verify claims
app.put('/api/documentary/projects/:id/script', async (req, res) => {
  try {
    const { id } = req.params;
    const { script } = req.body;
    if (!script) return res.status(400).json({ error: 'Script text required' });

    await runQuery(`UPDATE projects SET script = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [script, id]);
    res.json({ message: 'Script updated successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Complete Deliverables Export Package
app.get('/api/documentary/projects/:id/export-package', async (req, res) => {
  try {
    const { id } = req.params;
    const p = await getQuery('SELECT * FROM projects WHERE id = ?', [id]);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    const claims = p.claim_ledger ? JSON.parse(p.claim_ledger) : [];
    const timeline = p.timeline ? JSON.parse(p.timeline) : [];
    const entities = p.entities ? JSON.parse(p.entities) : [];
    const assets = p.asset_manifest ? JSON.parse(p.asset_manifest) : [];
    const chapters = p.documentary_chapters ? JSON.parse(p.documentary_chapters) : [];

    // Construct markdown research report
    const reportMd = [
      `# INVESTIGATIVE DOCUMENTARY DOSSIER: ${p.title.toUpperCase()}`,
      `**Generated by Local AI Video Studio** | **Date:** ${new Date().toISOString().split('T')[0]}`,
      `**Duration:** ~${Math.round((p.duration || 480) / 60)} Minutes | **Resolution:** ${p.resolution} (${p.aspect_ratio})`,
      `\n---\n`,
      `## 1. INVESTIGATIVE TIMELINE`,
      timeline.map((t: any) => `- **${t.date}:** ${t.headline} — ${t.description} *(Source: ${t.source})*`).join('\n'),
      `\n## 2. STRUCTURED CLAIM LEDGER & FACT-CHECK RECORD`,
      claims.map((c: any, i: number) => {
        return `### Claim ${i + 1} [${c.status.toUpperCase()}] (Confidence: ${(c.confidence * 100).toFixed(0)}%)
- **Claim:** ${c.claim_text}
- **Excerpt:** "${c.excerpt}"
- **Safe Narration Wording:** "${c.safe_narration_wording}"
- **Sources:** ${c.sources?.map((s: any) => `[${s.publisher}](${s.url})`).join(', ')}
${c.limitations ? `- **Limitations:** ${c.limitations}` : ''}`;
      }).join('\n\n'),
      `\n## 3. IDENTIFIED ENTITIES`,
      entities.map((e: any) => `- **${e.name}** (${e.type.toUpperCase()}): ${e.description}`).join('\n'),
      `\n## 4. ASSET MANIFEST & LEGAL LICENSES`,
      assets.map((a: any) => `- **${a.name}** (${a.type}): Licensed under *${a.license}* by ${a.creator}. Attribution: \`${a.attribution_required}\``).join('\n'),
      `\n## 5. FULL BROADCAST NARRATION SCRIPT`,
      p.script || 'No script generated yet.'
    ].join('\n\n');

    res.json({
      project_id: p.id,
      title: p.title,
      video_url: p.video_output ? `/${p.video_output.replace(/\\/g, '/')}` : null,
      subtitles_srt: p.subtitles_file || null,
      narration_audio: p.narration_file || null,
      dossier_markdown: reportMd,
      claim_ledger: claims,
      timeline,
      entities,
      assets,
      chapters,
      script: p.script
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 4. Update project (for Editor changes: scenes, subtitles, music volume)
app.put('/api/projects/:id', async (req, res) => {
  try {
    const { title, scene_data, caption_template, script } = req.body;
    await runQuery(`
      UPDATE projects SET 
        title = COALESCE(?, title),
        scene_data = COALESCE(?, scene_data),
        caption_template = COALESCE(?, caption_template),
        script = COALESCE(?, script),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title || null, scene_data ? JSON.stringify(scene_data) : null, caption_template || null, script || null, req.params.id]);

    res.json({ message: 'Project updated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 5. Re-render project from editor
app.post('/api/projects/:id/render', async (req, res) => {
  try {
    const projectId = req.params.id;
    PipelineManager.startPipeline(projectId);
    res.json({ message: 'Re-rendering initiated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 5b. Get granular scenes for a project
app.get('/api/projects/:id/scenes', async (req, res) => {
  try {
    const p = await getQuery<any>('SELECT scene_data, category FROM projects WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    const scenes: SceneData[] = p.scene_data ? JSON.parse(p.scene_data) : [];
    res.json(scenes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 5c. Update individual shot/scene properties
app.put('/api/projects/:id/scenes/:sceneId', async (req, res) => {
  try {
    const { id, sceneId } = req.params;
    const updates = req.body;
    const p = await getQuery<any>('SELECT scene_data FROM projects WHERE id = ?', [id]);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    let scenes: SceneData[] = p.scene_data ? JSON.parse(p.scene_data) : [];
    const idx = scenes.findIndex(s => s.id === sceneId);
    if (idx === -1) return res.status(404).json({ error: 'Scene not found' });

    scenes[idx] = { ...scenes[idx], ...updates };
    await runQuery('UPDATE projects SET scene_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(scenes), id]);

    res.json({ message: 'Scene updated', scene: scenes[idx] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5d. Master Editorial Timeline (Cuts, Kinetic Typography & Sound Design)
app.get('/api/projects/:id/editorial-timeline', async (req, res) => {
  try {
    const p = await getQuery<any>('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    const timeline = CinematicEditorialEngine.composeMasterTimeline(
      p,
      p.script || '',
      p.duration || 120,
      (p.visual_style as any) || 'cinematic_investigative'
    );
    res.json(timeline);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 5d. Replace media for a specific shot
app.post('/api/projects/:id/scenes/:sceneId/replace-media', async (req, res) => {
  try {
    const { id, sceneId } = req.params;
    const { media_url, visual_type, badge, camera_movement } = req.body;
    const p = await getQuery<any>('SELECT scene_data FROM projects WHERE id = ?', [id]);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    let scenes: SceneData[] = p.scene_data ? JSON.parse(p.scene_data) : [];
    const idx = scenes.findIndex(s => s.id === sceneId);
    if (idx === -1) return res.status(404).json({ error: 'Scene not found' });

    if (media_url) scenes[idx].media_url = media_url;
    if (visual_type) scenes[idx].visual_type = visual_type;
    if (badge) scenes[idx].badge = badge;
    if (camera_movement) scenes[idx].camera_movement = camera_movement;

    await runQuery('UPDATE projects SET scene_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(scenes), id]);
    res.json({ message: 'Scene media replaced successfully', scene: scenes[idx] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 5e. Quality check & auto-upgrade static scenes
app.post('/api/projects/:id/quality-check', async (req, res) => {
  try {
    const p = await getQuery<any>('SELECT scene_data, category FROM projects WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    const rawScenes: SceneData[] = p.scene_data ? JSON.parse(p.scene_data) : [];
    const { scenes: upgradedScenes, report } = QualityChecker.inspectAndUpgrade(rawScenes, p.category);

    await runQuery('UPDATE projects SET scene_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(upgradedScenes), req.params.id]);
    res.json({ report, scenes: upgradedScenes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 5f. Get catalog of available library video assets
app.get('/api/media/library', (req, res) => {
  const assets = MediaSourceManager.getAvailableLibraryAssets();
  res.json(assets);
});

// 5g. Get list of all rendered output videos and project clips
app.get('/api/media/outputs', (req, res) => {
  try {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) return res.json([]);
    const files = fs.readdirSync(outputDir)
      .filter(f => /\.(mp4|mov|webm)$/i.test(f))
      .map(f => {
        const fullPath = path.join(outputDir, f);
        const stat = fs.statSync(fullPath);
        return {
          filename: f,
          url: `/output/${f}`,
          sizeMb: (stat.size / (1024 * 1024)).toFixed(1),
          modified: stat.mtime
        };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());
    res.json(files);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 5h. Directly open any local clip or rendered video into Caption Studio
app.post('/api/caption-studio/open-clip', async (req, res) => {
  try {
    const { clipUrl, title } = req.body;
    if (!clipUrl) return res.status(400).json({ error: 'clipUrl required' });

    const cleanUrl = String(clipUrl).replace(/^\//, '');
    const fullPath = path.join(process.cwd(), cleanUrl);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found on disk: ' + cleanUrl });
    }

    const filename = path.basename(fullPath);
    const projTitle = title || filename.replace(/_/g, ' ').replace(/\.[^/.]+$/, '');
    const projectId = 'clip_' + Date.now();

    const probeInfo = await CaptionStudioService.probeMedia(fullPath);

    // Look for existing srt file for instant subtitle loading
    let initialTranscript: any = null;
    const baseName = path.parse(filename).name;
    const candidateSrts = [
      path.join(process.cwd(), 'public', `subtitles_${baseName}.srt`),
      path.join(process.cwd(), 'public', `${baseName}.srt`),
      path.join(process.cwd(), 'output', `${baseName}.srt`),
    ];
    for (const srtPath of candidateSrts) {
      if (fs.existsSync(srtPath)) {
        try {
          const srtContent = fs.readFileSync(srtPath, 'utf-8');
          const blocks = srtContent.trim().split(/\n\s*\r?\n/);
          const segments = blocks.map((b, idx) => {
            const lines = b.trim().split(/\r?\n/);
            const timeMatch = lines[1]?.match(/(\d+:\d+:\d+,\d+)\s*-->\s*(\d+:\d+:\d+,\d+)/);
            const parseTs = (s: string) => {
              const [h, m, secMs] = s.split(':');
              const [sec, ms] = secMs.split(',');
              return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + parseInt(ms) / 1000;
            };
            const start = timeMatch ? parseTs(timeMatch[1]) : idx * 3;
            const end = timeMatch ? parseTs(timeMatch[2]) : (idx + 1) * 3;
            const text = lines.slice(2).join(' ').trim();
            const wordsList = text.split(/\s+/).filter(Boolean);
            const words = wordsList.map((w, wIdx) => {
              const wDuration = (end - start) / Math.max(1, wordsList.length);
              return {
                word: w,
                start: start + wIdx * wDuration,
                end: start + (wIdx + 1) * wDuration,
                score: 0.95
              };
            });
            return { id: idx, start, end, text, words };
          });
          initialTranscript = { segments };
          break;
        } catch (e) {}
      }
    }

    await runQuery(`
      INSERT INTO caption_projects (
        id, title, video_path, audio_path, file_info, transcript_json, language, model, status, progress, caption_template, custom_style, video_settings
      ) VALUES (?, ?, ?, ?, ?, ?, 'auto', 'base', ?, 100, 'minimal-white', ?, ?)
    `, [
      projectId,
      projTitle,
      cleanUrl,
      cleanUrl,
      JSON.stringify(probeInfo),
      initialTranscript ? JSON.stringify(initialTranscript) : null,
      initialTranscript ? 'ready' : 'uploaded',
      JSON.stringify({
        fontFamily: 'Inter',
        fontSize: 48,
        color: '#FFFFFF',
        highlightColor: '#FFD700',
        outlineWidth: 3,
        outlineColor: '#000000',
        alignment: 'center',
        verticalOffset: 80
      }),
      JSON.stringify({
        aspect_ratio: probeInfo.width < probeInfo.height ? '9:16' : '16:9',
        resolution: '1080p',
        trim_start: 0,
        trim_end: probeInfo.durationSeconds,
        original_volume: 1.0,
        bgm_volume: 0.15
      })
    ]);

    const created = await getQuery<any>('SELECT * FROM caption_projects WHERE id = ?', [projectId]);
    res.json({
      project: {
        ...created,
        file_info: probeInfo,
        transcript_json: initialTranscript,
        custom_style: JSON.parse(created.custom_style),
        video_settings: JSON.parse(created.video_settings)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 6. Curated Topics Discovery
app.get('/api/curated-topics', (req, res) => {
  res.json([
    {
      title: "Why the Strait of Hormuz is the World's Most Critical Chokepoint",
      category: "Geopolitics and Map Animation",
      explanation: "Over 20% of global petroleum transit flows through this 39km corridor, bordered by Iran and Oman.",
      hook: "If this one narrow waterway is blocked, global energy prices soar in 24 hours.",
      sources: ["https://www.eia.gov/international/overview/world"],
      freshness: "Verified 2026 Analysis"
    },
    {
      title: "How Fractional Reserve Banking Actually Works",
      category: "Finance and Economics",
      explanation: "An educational dive into liquidity, central banks, and money multiplier mechanics.",
      hook: "Did you know that when you deposit $1,000, the bank lends out $900 of it almost instantly?",
      sources: ["https://www.investopedia.com/terms/f/fractionalreservebanking.asp"],
      freshness: "Evergreen Educational"
    },
    {
      title: "The Mystery of the Mary Celeste: Solved by Modern Physics?",
      category: "True Crime and Mystery",
      explanation: "Exploring alcohol fumes and vacuum blast theories on the 1872 ghost ship mystery.",
      hook: "The crew vanished completely without touching the cargo or food on the table.",
      sources: ["https://www.history.com/news/what-happened-to-the-mary-celeste"],
      freshness: "Documentary Classic"
    },
    {
      title: "The Cognitive Architecture of Large Language Models",
      category: "AI, Technology and Innovation",
      explanation: "Explaining attention mechanisms, transformer architecture, and weights visually.",
      hook: "How does a mathematical tensor matrix generate human-like reasoning?",
      sources: ["https://arxiv.org/abs/1706.03762"],
      freshness: "Cutting-Edge AI"
    }
  ]);
});

// ======================== CAPTION STUDIO ROUTES ======================== //

// 1. Upload media (drag & drop or file picker)
app.post('/api/caption-studio/upload', async (req, res) => {
  try {
    const rawFilename = (req.query.filename as string) || `upload_${Date.now()}.mp4`;
    const cleanFilename = path.basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const projectId = `cap_${Date.now()}`;
    const uploadDir = path.join(process.cwd(), 'storage', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const targetPath = path.join(uploadDir, `${projectId}_${cleanFilename}`);
    const writeStream = fs.createWriteStream(targetPath);

    req.pipe(writeStream);

    writeStream.on('finish', async () => {
      try {
        // Validate media signature via ffprobe
        const probeInfo = await CaptionStudioService.probeMedia(targetPath);

        // Extract audio for Whisper transcription
        const audioDir = path.join(process.cwd(), 'storage', 'audio');
        if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
        const audioPath = path.join(audioDir, `${projectId}.wav`);
        await CaptionStudioService.extractAudio(targetPath, audioPath);

        const relVideoPath = path.relative(process.cwd(), targetPath).replace(/\\/g, '/');
        const relAudioPath = path.relative(process.cwd(), audioPath).replace(/\\/g, '/');
        const title = path.parse(cleanFilename).name.replace(/_/g, ' ');

        await runQuery(`
          INSERT INTO caption_projects (
            id, title, video_path, audio_path, file_info, language, model, status, progress, caption_template, custom_style, video_settings
          ) VALUES (?, ?, ?, ?, ?, 'auto', 'base', 'uploaded', 10, 'minimal-white', ?, ?)
        `, [
          projectId,
          title,
          relVideoPath,
          relAudioPath,
          JSON.stringify(probeInfo),
          JSON.stringify({
            fontFamily: 'Inter',
            fontSize: 48,
            color: '#FFFFFF',
            highlightColor: '#FFD700',
            outlineWidth: 3,
            outlineColor: '#000000',
            alignment: 'center',
            verticalOffset: 80
          }),
          JSON.stringify({
            aspect_ratio: probeInfo.width < probeInfo.height ? '9:16' : '16:9',
            resolution: '1080p',
            trim_start: 0,
            trim_end: probeInfo.durationSeconds,
            original_volume: 1.0,
            bgm_volume: 0.15
          })
        ]);

        const project = await getQuery('SELECT * FROM caption_projects WHERE id = ?', [projectId]);
        res.json({
          id: projectId,
          file_info: probeInfo,
          project: {
            ...project,
            file_info: probeInfo,
            custom_style: JSON.parse(project.custom_style),
            video_settings: JSON.parse(project.video_settings)
          }
        });
      } catch (err: any) {
        try { fs.unlinkSync(targetPath); } catch (e) { }
        res.status(400).json({ error: `Media validation failed: ${err.message}` });
      }
    });

    writeStream.on('error', (err) => {
      res.status(500).json({ error: `Upload stream failed: ${err.message}` });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 2. Trigger transcription
app.post(['/api/caption-studio/projects/:id/transcribe', '/api/caption-studio/:id/transcribe'], async (req, res) => {
  try {
    const { language = 'auto', model = 'base' } = req.body;
    CaptionStudioService.transcribeMedia(String(req.params.id), language, model).catch(console.error);
    res.json({ message: 'Transcription initiated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 3. List caption projects
app.get('/api/caption-studio/projects', async (req, res) => {
  try {
    const projects = await allQuery('SELECT * FROM caption_projects ORDER BY created_at DESC');
    res.json(projects.map(p => ({
      ...p,
      file_info: p.file_info ? JSON.parse(p.file_info) : null,
      transcript_json: p.transcript_json ? JSON.parse(p.transcript_json) : null,
      custom_style: p.custom_style ? JSON.parse(p.custom_style) : null,
      video_settings: p.video_settings ? JSON.parse(p.video_settings) : null
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 4. Get single caption project
app.get('/api/caption-studio/projects/:id', async (req, res) => {
  try {
    const p = await getQuery('SELECT * FROM caption_projects WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Caption project not found' });

    let transcriptData = p.transcript_json ? JSON.parse(p.transcript_json) : null;
    if (!transcriptData) {
      // Auto-fallback: look for existing SRT in public or storage
      const candidates = [
        path.join(process.cwd(), 'public', 'subtitles_ai_bubble.srt'),
        p.video_path ? path.join(process.cwd(), p.video_path.replace(/\.[^/.]+$/, '.srt')) : null,
        path.join(process.cwd(), 'storage', 'captions', `${p.id}.json`)
      ].filter(Boolean) as string[];

      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          try {
            if (cand.endsWith('.json')) {
              transcriptData = JSON.parse(fs.readFileSync(cand, 'utf-8'));
            } else if (cand.endsWith('.srt')) {
              const rawSrt = fs.readFileSync(cand, 'utf-8');
              const blocks = rawSrt.trim().split(/\r?\n\r?\n/);
              const segments = [];
              let idx = 1;
              for (const block of blocks) {
                const lines = block.split(/\r?\n/);
                if (lines.length >= 2) {
                  const timeMatch = lines[1]?.match(/(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)/);
                  if (timeMatch) {
                    const startSec = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
                    const endSec = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
                    const text = lines.slice(2).join(' ').trim();
                    const words = text.split(/\s+/).map((w, wI, arr) => {
                      const dur = Math.max(0.1, (endSec - startSec) / arr.length);
                      return {
                        word: w,
                        start: +(startSec + wI * dur).toFixed(2),
                        end: +(startSec + (wI + 1) * dur).toFixed(2),
                        score: 0.99
                      };
                    });
                    segments.push({ id: idx++, start: startSec, end: endSec, text, words });
                  }
                }
              }
              if (segments.length > 0) {
                transcriptData = { segments };
              }
            }
            if (transcriptData) {
              await runQuery('UPDATE caption_projects SET transcript_json = ? WHERE id = ?', [
                JSON.stringify(transcriptData),
                p.id
              ]);
              break;
            }
          } catch (e) { }
        }
      }
    }

    res.json({
      ...p,
      file_info: p.file_info ? JSON.parse(p.file_info) : null,
      transcript_json: transcriptData,
      custom_style: p.custom_style ? JSON.parse(p.custom_style) : null,
      video_settings: p.video_settings ? JSON.parse(p.video_settings) : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 5. Update caption project (transcript edits, styling, timing)
app.put('/api/caption-studio/projects/:id', async (req, res) => {
  try {
    const { title, transcript_json, caption_template, custom_style, video_settings } = req.body;
    await runQuery(`
      UPDATE caption_projects SET
        title = COALESCE(?, title),
        transcript_json = COALESCE(?, transcript_json),
        caption_template = COALESCE(?, caption_template),
        custom_style = COALESCE(?, custom_style),
        video_settings = COALESCE(?, video_settings),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title || null,
      transcript_json ? (typeof transcript_json === 'string' ? transcript_json : JSON.stringify(transcript_json)) : null,
      caption_template || null,
      custom_style ? (typeof custom_style === 'string' ? custom_style : JSON.stringify(custom_style)) : null,
      video_settings ? (typeof video_settings === 'string' ? video_settings : JSON.stringify(video_settings)) : null,
      req.params.id
    ]);
    res.json({ message: 'Project updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 6. Delete caption project
app.delete('/api/caption-studio/projects/:id', async (req, res) => {
  try {
    const p = await getQuery('SELECT * FROM caption_projects WHERE id = ?', [req.params.id]);
    if (p) {
      if (p.video_path) {
        try { fs.unlinkSync(path.join(process.cwd(), p.video_path)); } catch (e) { }
      }
      if (p.audio_path) {
        try { fs.unlinkSync(path.join(process.cwd(), p.audio_path)); } catch (e) { }
      }
      if (p.exported_video) {
        try { fs.unlinkSync(path.join(process.cwd(), p.exported_video)); } catch (e) { }
      }
      await runQuery('DELETE FROM caption_projects WHERE id = ?', [req.params.id]);
    }
    res.json({ message: 'Project deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 7. Duplicate caption project
app.post('/api/caption-studio/projects/:id/duplicate', async (req, res) => {
  try {
    const p = await getQuery('SELECT * FROM caption_projects WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    const newId = `cap_${Date.now()}`;
    await runQuery(`
      INSERT INTO caption_projects (
        id, title, video_path, audio_path, file_info, language, model, status, progress, transcript_json, caption_template, custom_style, video_settings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', 100, ?, ?, ?, ?)
    `, [
      newId,
      `${p.title} (Copy)`,
      p.video_path,
      p.audio_path,
      p.file_info,
      p.language,
      p.model,
      p.transcript_json,
      p.caption_template,
      p.custom_style,
      p.video_settings
    ]);

    res.json({ id: newId, message: 'Project duplicated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 8. Export captioned video
app.post(['/api/caption-studio/projects/:id/export', '/api/caption-studio/:id/export'], async (req, res) => {
  try {
    const options = req.body || {};
    CaptionStudioService.exportVideo(String(req.params.id), options).catch(console.error);
    res.json({ message: 'Export started' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 9. Auto-split long segments into punchy cards
app.post('/api/caption-studio/projects/:id/auto-split', async (req, res) => {
  try {
    const maxWords = parseInt(req.body.maxWords || '6', 10);
    const updated = await CaptionStudioService.autoSplitSegments(req.params.id, maxWords);
    res.json({ message: 'Transcript auto-split successfully', transcript: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 10. Dual batch export (16:9 + 9:16)
app.post('/api/caption-studio/projects/:id/batch-export', async (req, res) => {
  try {
    const resolution = req.body.resolution || '1080p';
    const bgmTrack = req.body.bgm_track;
    const bgmVolume = req.body.bgm_volume;
    const originalVolume = req.body.original_volume;

    // Start 16:9 then 9:16 asynchronously
    (async () => {
      try {
        await CaptionStudioService.exportVideo(req.params.id, {
          aspect_ratio: '16:9',
          resolution,
          bgm_track: bgmTrack,
          bgm_volume: bgmVolume,
          original_volume: originalVolume
        });
        await CaptionStudioService.exportVideo(req.params.id, {
          aspect_ratio: '9:16',
          resolution,
          bgm_track: bgmTrack,
          bgm_volume: bgmVolume,
          original_volume: originalVolume
        });
      } catch (e) {
        console.error('Batch export error:', e);
      }
    })();

    res.json({ message: 'Batch export started for 16:9 Landscape & 9:16 Vertical formats' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 11. List available BGM mood tracks
app.get('/api/audio/bgm-list', (req, res) => {
  const tracks = [
    { id: 'ambient_documentary', name: 'Ambient Documentary', description: 'Calm warm harmonic drone for explainer videos', path: '/audio/bgm/ambient_documentary.wav' },
    { id: 'epic_geopolitics', name: 'Epic Geopolitics', description: 'Deep resonant brass & suspenseful cinematic weight', path: '/audio/bgm/epic_geopolitics.wav' },
    { id: 'mystery_investigation', name: 'Mystery & Investigation', description: 'Suspenseful low-register ambient drone', path: '/audio/bgm/mystery_investigation.wav' },
    { id: 'tech_cyber', name: 'Tech & Cyber', description: 'Futuristic electronic chord sweep for AI & tech topics', path: '/audio/bgm/tech_cyber.wav' }
  ];
  res.json(tracks);
});

// 12. Export sidecar subtitle file (SRT, VTT, ASS, TXT, JSON)
app.get('/api/caption-studio/projects/:id/export-captions/:format', async (req, res) => {
  try {
    const { id, format } = req.params;
    const p = await getQuery('SELECT * FROM caption_projects WHERE id = ?', [id]);
    if (!p || !p.transcript_json) return res.status(404).json({ error: 'Transcript not found' });

    const transcript = JSON.parse(p.transcript_json);
    const segments = transcript.segments || [];

    const formatTimeSrt = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec - Math.floor(sec)) * 1000);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };

    const formatTimeVtt = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec - Math.floor(sec)) * 1000);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };

    if (format === 'srt') {
      let content = '';
      segments.forEach((seg: any) => {
        content += `${seg.id}\n${formatTimeSrt(seg.start)} --> ${formatTimeSrt(seg.end)}\n${seg.text}\n\n`;
      });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${p.title || 'subtitles'}.srt"`);
      return res.send(content);
    } else if (format === 'vtt') {
      let content = 'WEBVTT\n\n';
      segments.forEach((seg: any) => {
        content += `${seg.id}\n${formatTimeVtt(seg.start)} --> ${formatTimeVtt(seg.end)}\n${seg.text}\n\n`;
      });
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${p.title || 'subtitles'}.vtt"`);
      return res.send(content);
    } else if (format === 'txt') {
      const content = segments.map((s: any) => s.text).join('\n');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${p.title || 'transcript'}.txt"`);
      return res.send(content);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${p.title || 'transcript'}.json"`);
      return res.json(transcript);
    } else {
      res.status(400).json({ error: 'Unsupported format. Use srt, vtt, txt, or json' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// ==================== AI VIRAL CLIPPER API ROUTES ==================== //
// 1. Get all clipper projects
app.get('/api/clipper/projects', async (req, res) => {
  try {
    const projects = await allQuery(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM clipper_clips WHERE project_id = p.id) as clip_count,
        (SELECT COUNT(*) FROM clipper_clips WHERE project_id = p.id AND status = 'ready') as ready_clip_count
      FROM clipper_projects p 
      ORDER BY p.created_at DESC
    `);
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get single clipper project and its clips
app.get('/api/clipper/projects/:id', async (req, res) => {
  try {
    const project = await getQuery<any>('SELECT * FROM clipper_projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Clipper project not found' });

    const clips = await allQuery<any>('SELECT * FROM clipper_clips WHERE project_id = ? ORDER BY start_time ASC', [req.params.id]);

    res.json({
      ...project,
      transcript: project.transcript_json ? JSON.parse(project.transcript_json) : null,
      clips: clips.map(c => ({
        ...c,
        custom_style: c.custom_style ? JSON.parse(c.custom_style) : {},
        transcript_segments: c.transcript_segments ? JSON.parse(c.transcript_segments) : []
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create clipper project from YouTube URL, local path, or existing clip
app.post('/api/clipper/projects/create', async (req, res) => {
  try {
    const { sourceType, url, localPath, targetDuration, clipCountTarget, language } = req.body;
    const projectId = 'clip_proj_' + Date.now();

    let title = 'Clipping Project';
    let duration = 0;
    let thumbnailUrl = '';
    let videoPath = '';

    if (sourceType === 'youtube') {
      if (!url) return res.status(400).json({ error: 'YouTube URL is required' });
      const meta = await ViralClipperService.fetchUrlMetadata(url);
      title = meta.title;
      duration = meta.duration;
      thumbnailUrl = meta.thumbnail;
      videoPath = path.join('storage', 'videos', `clipper_${projectId}.mp4`);
    } else {
      if (!localPath) return res.status(400).json({ error: 'Local file path is required' });
      const full = path.isAbsolute(localPath) ? localPath : path.join(process.cwd(), String(localPath).replace(/^\//, ''));
      if (!fs.existsSync(full)) return res.status(404).json({ error: 'Local video file not found' });
      videoPath = path.relative(process.cwd(), full).replace(/\\/g, '/');
      title = path.basename(full).replace(/_/g, ' ').replace(/\.[^/.]+$/, '');
    }

    await runQuery(`
      INSERT INTO clipper_projects (
        id, title, source_type, source_url, video_path, thumbnail_url, duration,
        status, progress, target_duration, clip_count_target
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'downloading', 5, ?, ?)
    `, [
      projectId,
      title,
      sourceType || 'upload',
      url || null,
      videoPath,
      thumbnailUrl || null,
      duration || 0,
      targetDuration || '30-60',
      clipCountTarget || 5
    ]);

    ViralClipperService.processSource(projectId, {
      targetDuration: targetDuration || '30-60',
      clipCountTarget: clipCountTarget || 5,
      language: language || 'auto'
    }).catch(err => {
      console.error(`Clipper project ${projectId} background error:`, err);
    });

    const project = await getQuery('SELECT * FROM clipper_projects WHERE id = ?', [projectId]);
    res.json({ id: projectId, project });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Upload local long video file for clipping
app.post('/api/clipper/upload', async (req, res) => {
  try {
    const filename = String(req.query.filename || 'uploaded_video.mp4');
    const projectId = 'clip_proj_' + Date.now();
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    const videoDir = path.join(process.cwd(), 'storage', 'videos');
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

    const targetPath = path.join(videoDir, `clipper_${projectId}_${cleanFilename}`);
    const writeStream = fs.createWriteStream(targetPath);

    req.pipe(writeStream);

    writeStream.on('finish', async () => {
      try {
        const probeInfo = await CaptionStudioService.probeMedia(targetPath);
        const relPath = path.relative(process.cwd(), targetPath).replace(/\\/g, '/');
        const title = path.parse(cleanFilename).name.replace(/_/g, ' ');

        await runQuery(`
          INSERT INTO clipper_projects (
            id, title, source_type, source_url, video_path, duration, width, height, fps,
            status, progress, target_duration, clip_count_target
          ) VALUES (?, ?, 'upload', null, ?, ?, ?, ?, ?, 'ready', 0, '30-60', 5)
        `, [
          projectId,
          title,
          relPath,
          probeInfo.durationSeconds,
          probeInfo.width,
          probeInfo.height,
          probeInfo.fps
        ]);

        // Trigger processing immediately
        ViralClipperService.processSource(projectId, {
          targetDuration: '30-60',
          clipCountTarget: 5,
          language: 'auto'
        }).catch(console.error);

        const project = await getQuery('SELECT * FROM clipper_projects WHERE id = ?', [projectId]);
        res.json({ id: projectId, project });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    writeStream.on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Reprocess / detect viral clips with new parameters
app.post('/api/clipper/projects/:id/reprocess', async (req, res) => {
  try {
    const { targetDuration, clipCountTarget, language } = req.body;
    const projectId = String(req.params.id);

    ViralClipperService.processSource(projectId, {
      targetDuration,
      clipCountTarget,
      language
    }).catch(console.error);

    res.json({ success: true, message: 'Reprocessing started' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Update individual clip parameters
app.put('/api/clipper/clips/:clipId', async (req, res) => {
  try {
    const clipId = String(req.params.clipId);
    const clip = await getQuery<any>('SELECT * FROM clipper_clips WHERE id = ?', [clipId]);
    if (!clip) return res.status(404).json({ error: 'Clip not found' });

    const {
      title,
      hook,
      summary,
      start_time,
      end_time,
      category,
      reframing_mode,
      caption_template,
      caption_language,
      custom_style,
      transcript_segments
    } = req.body;

    const start = start_time !== undefined ? parseFloat(start_time) : clip.start_time;
    const end = end_time !== undefined ? parseFloat(end_time) : clip.end_time;
    const duration = Math.max(1, Math.round(end - start));

    await runQuery(`
      UPDATE clipper_clips SET
        title = COALESCE(?, title),
        hook = COALESCE(?, hook),
        summary = COALESCE(?, summary),
        start_time = ?,
        end_time = ?,
        duration = ?,
        category = COALESCE(?, category),
        reframing_mode = COALESCE(?, reframing_mode),
        caption_template = COALESCE(?, caption_template),
        caption_language = COALESCE(?, caption_language),
        custom_style = COALESCE(?, custom_style),
        transcript_segments = COALESCE(?, transcript_segments),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title !== undefined ? title : null,
      hook !== undefined ? hook : null,
      summary !== undefined ? summary : null,
      start,
      end,
      duration,
      category !== undefined ? category : null,
      reframing_mode !== undefined ? reframing_mode : null,
      caption_template !== undefined ? caption_template : null,
      caption_language !== undefined ? caption_language : null,
      custom_style ? JSON.stringify(custom_style) : null,
      transcript_segments ? JSON.stringify(transcript_segments) : null,
      clipId
    ]);

    const updated = await getQuery<any>('SELECT * FROM clipper_clips WHERE id = ?', [clipId]);
    res.json({
      clip: {
        ...updated,
        custom_style: updated.custom_style ? JSON.parse(updated.custom_style) : {},
        transcript_segments: updated.transcript_segments ? JSON.parse(updated.transcript_segments) : []
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Render single clip
app.post('/api/clipper/clips/:clipId/render', async (req, res) => {
  try {
    const clipId = String(req.params.clipId);
    const outputRel = await ViralClipperService.renderClip(clipId);
    res.json({ success: true, videoUrl: `/${outputRel}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Batch render all clips in a project
app.post('/api/clipper/projects/:id/batch-render', async (req, res) => {
  try {
    const projectId = String(req.params.id);
    const results = await ViralClipperService.batchRenderProject(projectId);
    res.json({ success: true, results: results.map(r => `/${r}`) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Export all rendered clips as ZIP
app.get('/api/clipper/projects/:id/export-zip', async (req, res) => {
  try {
    const projectId = String(req.params.id);
    const zipPath = await ViralClipperService.createProjectZip(projectId);
    res.download(zipPath, `clipper_${projectId}_reels.zip`);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Open clip in Caption Studio bridge
app.post('/api/clipper/clips/:clipId/open-in-caption-studio', async (req, res) => {
  try {
    const clipId = String(req.params.clipId);
    const clip = await getQuery<any>('SELECT * FROM clipper_clips WHERE id = ?', [clipId]);
    if (!clip) return res.status(404).json({ error: 'Clip not found' });

    const project = await getQuery<any>('SELECT * FROM clipper_projects WHERE id = ?', [clip.project_id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const capProjId = 'clip_cap_' + Date.now();
    const sourceVideo = clip.exported_video || project.video_path;
    const fullPath = path.isAbsolute(sourceVideo) ? sourceVideo : path.join(process.cwd(), sourceVideo);
    const probe = await CaptionStudioService.probeMedia(fullPath);

    const segments = clip.transcript_segments ? JSON.parse(clip.transcript_segments) : [];

    await runQuery(`
      INSERT INTO caption_projects (
        id, title, video_path, audio_path, file_info, transcript_json, language, model,
        status, progress, caption_template, custom_style, video_settings
      ) VALUES (?, ?, ?, ?, ?, ?, 'auto', 'base', 'ready', 100, ?, ?, ?)
    `, [
      capProjId,
      clip.title,
      sourceVideo,
      project.audio_path,
      JSON.stringify(probe),
      JSON.stringify({ segments }),
      clip.caption_template || 'word-pop',
      clip.custom_style || JSON.stringify({
        fontFamily: 'Inter',
        fontSize: 68,
        fontWeight: '800',
        color: '#FFFFFF',
        highlightColor: '#FFD700',
        outlineWidth: 5,
        outlineColor: '#000000',
        alignment: 'center',
        verticalOffset: 480
      }),
      JSON.stringify({
        aspect_ratio: '9:16',
        resolution: '1080p',
        trim_start: clip.start_time,
        trim_end: clip.end_time,
        original_volume: 1.0,
        bgm_volume: 0.15
      })
    ]);

    const created = await getQuery<any>('SELECT * FROM caption_projects WHERE id = ?', [capProjId]);
    res.json({
      captionProject: {
        ...created,
        file_info: probe,
        transcript_json: { segments },
        custom_style: JSON.parse(created.custom_style),
        video_settings: JSON.parse(created.video_settings)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Delete clipper project
app.delete('/api/clipper/projects/:id', async (req, res) => {
  try {
    const projectId = String(req.params.id);
    await runQuery('DELETE FROM clipper_clips WHERE project_id = ?', [projectId]);
    await runQuery('DELETE FROM clipper_projects WHERE id = ?', [projectId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// VIDEO QUALITY & CINEMATIC ENHANCEMENT API
// ==========================================

// 1. Analyze Image Quality (Resolution, compression, blur detection)
app.post('/api/enhancement/image-analyze', async (req, res) => {
  try {
    const { imagePath } = req.body;
    if (!imagePath) return res.status(400).json({ error: 'imagePath is required' });
    const fullPath = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Image file not found' });
    const metrics = await VideoEnhancerService.analyzeImageQuality(fullPath);
    res.json({ success: true, metrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Enhance Image (2x / 4x Super Resolution + Restoration)
app.post('/api/enhancement/image-enhance', async (req, res) => {
  try {
    const { imagePath, scale = 2, denoise = true, sharpen = true } = req.body;
    if (!imagePath) return res.status(400).json({ error: 'imagePath is required' });
    const fullPath = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Image file not found' });
    const result = await VideoEnhancerService.enhanceImage(fullPath, { scale, denoise, sharpen });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Frame Interpolation (24 / 30 / 60 FPS motion-compensated)
app.post('/api/enhancement/video-interpolate', async (req, res) => {
  try {
    const { videoPath, targetFps = 60 } = req.body;
    if (!videoPath) return res.status(400).json({ error: 'videoPath is required' });
    const fullPath = path.isAbsolute(videoPath) ? videoPath : path.join(process.cwd(), videoPath.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Video file not found' });
    
    const parsed = path.parse(fullPath);
    const outputPath = path.join(parsed.dir, `${parsed.name}_${targetFps}fps${parsed.ext}`);
    await VideoEnhancerService.interpolateVideo(fullPath, outputPath, targetFps);
    const webPath = outputPath.replace(process.cwd(), '').replace(/\\/g, '/');
    res.json({ success: true, outputPath: webPath, fps: targetFps });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Project QC Report
app.get('/api/projects/:id/qc-report', async (req, res) => {
  try {
    const projectId = String(req.params.id);
    const project = await getQuery<any>('SELECT qc_report, video_output, resolution, aspect_ratio FROM projects WHERE id = ?', [projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    if (project.qc_report) {
      return res.json({ success: true, report: JSON.parse(project.qc_report) });
    }

    // Generate fresh QC report if video exists
    if (project.video_output && fs.existsSync(path.join(process.cwd(), project.video_output))) {
      const w = project.aspect_ratio === '9:16' ? 1080 : 1920;
      const h = project.aspect_ratio === '9:16' ? 1920 : 1080;
      const qc = await VideoEnhancerService.runQualityControl(
        path.join(process.cwd(), project.video_output),
        {
          targetResolution: `${w}x${h}`,
          targetFps: 30,
          renderDurationSec: 120
        }
      );
      await runQuery('UPDATE projects SET qc_report = ? WHERE id = ?', [JSON.stringify(qc), projectId]);
      return res.json({ success: true, report: qc });
    }

    res.json({ success: false, message: 'Video not rendered yet or QC not available' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Apply Enhancement Settings to Project
app.post('/api/projects/:id/apply-enhancements', async (req, res) => {
  try {
    const projectId = String(req.params.id);
    const { enhancementSettings, colorProfile, renderPreset } = req.body;
    
    await runQuery(
      `UPDATE projects SET 
        enhancement_settings = COALESCE(?, enhancement_settings),
        color_profile = COALESCE(?, color_profile),
        render_preset = COALESCE(?, render_preset)
      WHERE id = ?`,
      [
        enhancementSettings ? JSON.stringify(enhancementSettings) : null,
        colorProfile || null,
        renderPreset || null,
        projectId
      ]
    );

    res.json({ success: true, message: 'Enhancement settings saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// COPYRIGHT & ASSET LICENSING MANAGEMENT SYSTEM ENDPOINTS
// =========================================================================

// 1. Get YouTube Copyright & Licensing Report for a Project
app.get('/api/projects/:id/copyright-report', async (req, res) => {
  try {
    const projectId = String(req.params.id);
    const proj = await getQuery<any>('SELECT copyright_report FROM projects WHERE id = ?', [projectId]);
    if (!proj) return res.status(404).json({ error: 'Project not found' });

    let report = proj.copyright_report ? JSON.parse(proj.copyright_report) : null;
    if (!report) {
      report = await CopyrightLicenseManager.generateYouTubeCopyrightReport(projectId);
    }

    const mdPath = path.join(process.cwd(), 'output', `${projectId}_copyright_report.md`);
    const markdown = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf-8') : '';

    res.json({ success: true, report, markdown });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Trigger fresh Copyright & Licensing Audit for a Project
app.post('/api/projects/:id/copyright-check', async (req, res) => {
  try {
    const projectId = String(req.params.id);
    const report = await CopyrightLicenseManager.generateYouTubeCopyrightReport(projectId);
    const mdPath = path.join(process.cwd(), 'output', `${projectId}_copyright_report.md`);
    const markdown = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf-8') : '';

    res.json({ success: true, report, markdown, message: 'Copyright audit completed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Query Persistent Asset Registry
app.get('/api/assets/registry', async (req, res) => {
  try {
    const { projectId, assetType, sourcePlatform, verifiedStatus } = req.query;
    let sql = 'SELECT * FROM asset_registry WHERE 1=1';
    const params: any[] = [];

    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(String(projectId));
    }
    if (assetType) {
      sql += ' AND asset_type = ?';
      params.push(String(assetType));
    }
    if (sourcePlatform) {
      sql += ' AND source_platform = ?';
      params.push(String(sourcePlatform));
    }
    if (verifiedStatus) {
      sql += ' AND verified_status = ?';
      params.push(String(verifiedStatus));
    }

    sql += ' ORDER BY created_at DESC LIMIT 200';
    const rows = await allQuery(sql, params);
    res.json({ success: true, assets: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Manually Register or Update Asset Licensing Metadata
app.post('/api/assets/register', async (req, res) => {
  try {
    const {
      assetId,
      projectId,
      assetType,
      sourcePlatform,
      originalUrl,
      downloadUrl,
      creatorName,
      creatorProfileUrl,
      licenseType,
      licenseUrl,
      commercialUse,
      attributionRequired,
      attributionText,
      usageRestrictions,
      verifiedStatus,
      rightsFlags
    } = req.body;

    if (!assetId || !assetType || !sourcePlatform) {
      return res.status(400).json({ error: 'assetId, assetType, and sourcePlatform are required fields.' });
    }

    const record = await CopyrightLicenseManager.registerAsset({
      assetId,
      projectId,
      assetType,
      sourcePlatform,
      originalUrl,
      downloadUrl,
      creatorName,
      creatorProfileUrl,
      licenseType,
      licenseUrl,
      commercialUse: commercialUse !== undefined ? !!commercialUse : true,
      attributionRequired: attributionRequired !== undefined ? !!attributionRequired : false,
      attributionText,
      usageRestrictions,
      verifiedStatus,
      rightsFlags
    });

    res.json({ success: true, asset: record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// AUDIO COPYRIGHT POLICE — INSPECTION & ENFORCEMENT ENDPOINTS
// =========================================================================

// 1. Get Centralized Audio Asset Registry with Filters
app.get('/api/audio-police/registry', async (req, res) => {
  try {
    const { projectId, audioType, sourcePlatform, riskScore } = req.query;
    let sql = 'SELECT * FROM audio_asset_registry WHERE 1=1';
    const params: any[] = [];

    if (projectId) {
      sql += ' AND (project_id = ? OR project_id IS NULL)';
      params.push(String(projectId));
    }
    if (audioType) {
      sql += ' AND audio_type = ?';
      params.push(String(audioType));
    }
    if (sourcePlatform) {
      sql += ' AND source_platform = ?';
      params.push(String(sourcePlatform));
    }
    if (riskScore) {
      sql += ' AND risk_score = ?';
      params.push(String(riskScore));
    }

    sql += ' ORDER BY created_at DESC LIMIT 300';
    const assets = await allQuery(sql, params);

    // Compute summary stats
    const total = assets.length;
    const verified = assets.filter(a => a.verified_license === 1).length;
    const aiGenerated = assets.filter(a => a.audio_type === 'ai_generated' || a.source_platform === 'ai_synthesis' || a.source_platform === 'kokoro_tts').length;
    const unverified = assets.filter(a => a.verified_license === 0).length;
    const highRisk = assets.filter(a => a.risk_score === 'HIGH').length;
    const blocked = assets.filter(a => a.risk_score === 'BLOCKED').length;

    res.json({
      success: true,
      stats: { total, verified, aiGenerated, unverified, highRisk, blocked },
      assets
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Run / Get Audio Copyright Police Pre-Export Gate Report for a Project
app.get('/api/audio-police/projects/:id/report', async (req, res) => {
  try {
    const projectId = String(req.params.id);
    const report = await AudioPoliceService.runProjectPreExportGate(projectId);
    const mdPath = path.join(process.cwd(), 'output', `${projectId}_audio_police_report.md`);
    const markdown = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf-8') : '';

    res.json({ success: true, report, markdown });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Trigger Live Pre-Export Gate Check
app.post('/api/audio-police/projects/:id/gate-check', async (req, res) => {
  try {
    const projectId = String(req.params.id);
    const report = await AudioPoliceService.runProjectPreExportGate(projectId);
    res.json({ success: true, report, message: 'Audio Copyright Police scan completed.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Smart Audio Replacement (Replaces High-Risk/Blocked track with pristine safe AI music)
app.post('/api/audio-police/replace', async (req, res) => {
  try {
    const { projectId, offendingAssetId, preferredMood } = req.body;
    if (!projectId || !offendingAssetId) {
      return res.status(400).json({ error: 'projectId and offendingAssetId are required.' });
    }

    const result = await AudioPoliceService.smartReplaceAudio(projectId, offendingAssetId, preferredMood);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Documented Manual Review Override (for creators with direct sync licenses)
app.post('/api/audio-police/override', async (req, res) => {
  try {
    const { assetId, projectId, reason } = req.body;
    if (!assetId || !projectId || !reason) {
      return res.status(400).json({ error: 'assetId, projectId, and reason are required.' });
    }

    await AudioPoliceService.applyManualOverride(assetId, projectId, reason);
    res.json({ success: true, message: 'Manual override logged with audit reason.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Generate Original AI Music On Demand
app.post('/api/audio-police/generate-ai-music', async (req, res) => {
  try {
    const { mood, durationSec, projectId } = req.body;
    const moodKey = mood || 'cinematic_documentary';
    const dur = durationSec || 30;
    const filename = `ai_synth_${moodKey}_${Date.now()}.wav`;
    const relPath = path.join('public', 'audio', 'bgm', filename);
    const absPath = path.join(process.cwd(), relPath);

    const script = path.join(process.cwd(), 'scripts', 'generate_ai_audio.py');
    await new Promise<void>((resolve, reject) => {
      const p = spawn('python', [script, 'music', moodKey, absPath, '--duration', String(dur)]);
      p.on('close', (code: number | null) => {
        if (code === 0 && fs.existsSync(absPath)) resolve();
        else reject(new Error(`AI generation exited with code ${code}`));
      });
      p.on('error', reject);
    });

    const record = await AudioPoliceService.registerAudio({
      assetId: `ai_music_${Date.now()}`,
      projectId: projectId || null,
      audioType: 'ai_generated',
      filePath: relPath,
      sourcePlatform: 'ai_synthesis',
      creatorArtist: 'Content-Creation-Hub AI Synthesis Engine',
      audioTitle: `AI Generated: ${moodKey.replace(/_/g, ' ').toUpperCase()}`,
      licenseType: 'Studio Original Royalty-Free / Creative Commons CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      commercialUseAllowed: true,
      attributionRequired: false,
      modificationAllowed: true,
      verifiedLicense: true
    });

    res.json({ success: true, asset: record, fileUrl: `/audio/bgm/${filename}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
async function main() {
  await initDatabase();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` LOCAL AI VIDEO STUDIO — PRODUCTION SERVER RUNNING`);
    console.log(` URL: http://127.0.0.1:${PORT} (and http://localhost:${PORT})`);
    console.log(` WebSocket: ws://127.0.0.1:${PORT}`);
    console.log(`=======================================================`);
  });
}

main().catch(console.error);
