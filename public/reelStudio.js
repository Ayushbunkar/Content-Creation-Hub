// ============================================================================
// AI REEL EDITING STUDIO — PRODUCTION WORKBENCH (public/reelStudio.js)
// Real-time 4-layer composition, Word-Behind-Head occlusion, Glassmorphism cards,
// 8-track interactive timeline, camera motion, audio ducking, and 1-click Auto Edit.
// ============================================================================

(function () {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  // 15 Professional Style Presets (synchronous fallback if metadata loading)
  const FALLBACK_PRESETS = [
    { id: 'hormozi-bold', name: 'Hormozi Bold Impact', category: 'Viral & Business', font: 'Montserrat', fontSize: 72, fontWeight: '900', color: '#FFFFFF', highlightColor: '#FFD700', strokeWidth: 5, strokeColor: '#000000', animation: 'word-pop', desc: 'Punchy capitalized keywords with heavy black outlines and golden yellow pop.' },
    { id: 'cinematic-doc', name: 'Cinematic Documentary', category: 'Documentary', font: 'Playfair Display', fontSize: 54, fontWeight: '700', color: '#F8FAFC', highlightColor: '#D97706', strokeWidth: 2, strokeColor: '#121212', animation: 'fade-blur', desc: 'Serif documentary titles with warm gold emphasis.' },
    { id: 'modern-glass', name: 'Modern Glassmorphism', category: 'SaaS & Motion', font: 'Inter', fontSize: 58, fontWeight: '800', color: '#FFFFFF', highlightColor: '#60A5FA', strokeWidth: 2, strokeColor: 'rgba(255,255,255,0.2)', animation: 'slide-up', desc: 'Frosted glass backdrops with clean modern typography.' },
    { id: 'viral-high-energy', name: 'High-Energy Reels', category: 'Entertainment', font: 'Oswald', fontSize: 76, fontWeight: '900', color: '#FFFFFF', highlightColor: '#FFD700', strokeWidth: 5, strokeColor: '#000000', animation: 'karaoke-sweep', desc: 'Dynamic karaoke progression with fast camera punch zooms.' },
    { id: 'minimal-clean', name: 'Minimal Subtitles', category: 'Lifestyle & Vlog', font: 'Inter', fontSize: 48, fontWeight: '600', color: '#FFFFFF', highlightColor: '#FFFFFF', strokeWidth: 2, strokeColor: '#000000', animation: 'fade', desc: 'Understated clean subtitles with generous margins.' },
    { id: 'podcast-two-tone', name: 'Podcast Two-Tone', category: 'Interview & Podcast', font: 'Poppins', fontSize: 60, fontWeight: '800', color: '#E2E8F0', highlightColor: '#38BDF8', strokeWidth: 4, strokeColor: '#0F172A', animation: 'word-by-word', desc: 'Conversational duo-tone highlights.' },
    { id: 'educational-explainer', name: 'Educational & Explainer', category: 'Learning', font: 'Space Grotesk', fontSize: 56, fontWeight: '700', color: '#FFFFFF', highlightColor: '#F59E0B', strokeWidth: 3, strokeColor: '#18181B', animation: 'box-highlight', desc: 'Yellow-box highlights for key definitions and insights.' },
    { id: 'tech-ai', name: 'Tech & AI Silicon', category: 'Technology', font: 'Space Grotesk', fontSize: 62, fontWeight: '800', color: '#F8FAFC', highlightColor: '#06B6D4', strokeWidth: 4, strokeColor: '#083344', animation: 'glitch-pop', desc: 'Futuristic cyan cyber glow with tech badge telemetry.' },
    { id: 'storytelling-warm', name: 'Storytelling Memoir', category: 'Storytelling', font: 'Playfair Display', fontSize: 52, fontWeight: '600', color: '#FFFBEB', highlightColor: '#F97316', strokeWidth: 2, strokeColor: '#292524', animation: 'fade-up', desc: 'Warm serif typography that respects emotional cadence.' },
    { id: 'news-breaking', name: 'News & Geopolitics', category: 'News', font: 'Roboto', fontSize: 58, fontWeight: '900', color: '#FFFFFF', highlightColor: '#EF4444', strokeWidth: 4, strokeColor: '#7F1D1D', animation: 'ticker-line', desc: 'Urgent red news headline styling with ticker bar.' },
    { id: 'bebas-punch', name: 'Bebas Tall Punch', category: 'Fitness & Motivation', font: 'Bebas Neue', fontSize: 88, fontWeight: '800', color: '#FFFFFF', highlightColor: '#A855F7', strokeWidth: 4, strokeColor: '#3B0764', animation: 'scale-bounce', desc: 'Tall, condensed uppercase titles with purple glow.' },
    { id: 'typewriter-retro', name: 'Typewriter Courier', category: 'Literary & Film', font: 'JetBrains Mono', fontSize: 46, fontWeight: '600', color: '#E2E8F0', highlightColor: '#10B981', strokeWidth: 1, strokeColor: '#042F2E', animation: 'typewriter', desc: 'Monospace typewriter animation with blinking cursor.' },
    { id: 'neon-cyberpunk', name: 'Neon Cyber Glow', category: 'Gaming & Cyber', font: 'Anton', fontSize: 74, fontWeight: '900', color: '#FFFFFF', highlightColor: '#EC4899', strokeWidth: 4, strokeColor: '#831843', animation: 'neon-pulse', desc: 'Electrifying neon magenta glow with outer bloom.' },
    { id: 'yellow-karaoke', name: 'Smooth Yellow Karaoke', category: 'Music & Flow', font: 'Montserrat', fontSize: 64, fontWeight: '800', color: '#94A3B8', highlightColor: '#FFD700', strokeWidth: 3, strokeColor: '#000000', animation: 'smooth-karaoke', desc: 'Ultra-fluid karaoke fill that glides across syllables.' },
    { id: 'gradient-magic', name: 'Gradient Sunrise Flow', category: 'Design', font: 'Poppins', fontSize: 64, fontWeight: '800', color: '#FFFFFF', highlightColor: '#F43F5E', strokeWidth: 3, strokeColor: '#4C0519', animation: 'gradient-sweep', desc: 'Vibrant sunrise gradient transition with bouncy spring.' }
  ];

  function ReelStudioWorkspace({
    project,
    onUpdateProject,
    onBackToProjects,
    presets = FALLBACK_PRESETS,
    audioCatalog = { sfx: {}, bgm: {} }
  }) {
    if (!project) {
      return (
        <div class="h-full flex items-center justify-center p-8 text-center text-slate-400">
          <div>
            <div class="text-4xl mb-3">🎬</div>
            <p class="text-sm font-semibold">Select or upload a video to open the AI Reel Editing Studio.</p>
          </div>
        </div>
      );
    }

    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(project.duration || 30);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isLooping, setIsLooping] = useState(false);

    // Active Tab & Tool selection
    const [activeTool, setActiveTool] = useState('styles'); // 'styles', 'behind_head', 'cards', 'motion', 'audio', 'layers'
    const [selectedTrackItem, setSelectedTrackItem] = useState(null); // { type, id, data }
    const [showSafeArea, setShowSafeArea] = useState(true);
    const [timelineZoom, setTimelineZoom] = useState(1); // 1x to 4x

    // Timeline Data (state mirror for responsive immediate UI updates)
    const [timeline, setTimeline] = useState(() => {
      const td = project.timeline_data || {};
      return {
        videoTrack: td.videoTrack || { src: '/' + (project.video_path || '').replace(/\\/g, '/'), trimStart: 0, trimEnd: project.duration || 30, volume: 1 },
        behindHead: td.behindHead || {
          enabled: false,
          text: 'AI REEL',
          startTime: 1.5,
          endTime: 4.5,
          font: 'Montserrat',
          fontSize: 100,
          fontWeight: '900',
          color: '#FFFFFF',
          glowColor: '#FFD700',
          shadow: true,
          depth: 18,
          posX: 50,
          posY: 38,
          scale: 1,
          rotation: 0,
          opacity: 0.95,
          maskMode: 'ai',
          feather: 15,
          manualMask: { x: 35, y: 20, width: 30, height: 45, feather: 12 }
        },
        captionsTrack: td.captionsTrack || [],
        captionStyle: td.captionStyle || {
          preset: project.preset || 'hormozi-bold',
          fontFamily: 'Montserrat',
          fontSize: 64,
          fontWeight: '900',
          color: '#FFFFFF',
          highlightColor: '#FFD700',
          position: 'bottom',
          verticalOffset: 480,
          animation: 'word-by-word',
          strokeWidth: 4,
          strokeColor: '#000000',
          bgBox: false
        },
        glassCardsTrack: td.glassCardsTrack || [],
        cameraTrack: td.cameraTrack || [],
        shakeTrack: td.shakeTrack || [],
        sfxTrack: td.sfxTrack || [],
        bgmTrack: td.bgmTrack || { trackId: 'tech_cyber', src: '/audio/bgm/tech_cyber.wav', volume: 0.22, duckingEnabled: true, duckingDb: -14, fadeIn: 1, fadeOut: 1.5 },
        overlaysTrack: td.overlaysTrack || [],
        keyframes: td.keyframes || []
      };
    });

    // Auto-save debouncer
    const saveTimeoutRef = useRef(null);
    const syncProjectToServer = useCallback((updatedTimeline, extraUpdates = {}) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const payload = {
            timeline_data: updatedTimeline,
            preset: updatedTimeline.captionStyle?.preset || project.preset,
            aspect_ratio: project.aspect_ratio || '9:16',
            ...extraUpdates
          };
          const res = await fetch(`/api/reel-studio/projects/${project.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success && onUpdateProject) {
            onUpdateProject(data.project);
          }
        } catch (e) {
          console.warn('[ReelStudio] Autosave failed:', e);
        }
      }, 700);
    }, [project.id, project.preset, project.aspect_ratio, onUpdateProject]);

    // Keep local timeline in sync when project changes
    useEffect(() => {
      if (project.timeline_data) {
        setTimeline(prev => ({
          ...prev,
          ...project.timeline_data
        }));
      }
      if (project.duration && project.duration > 0) {
        setDuration(project.duration);
      }
    }, [project.id]);

    // Playback loop and sync
    const togglePlay = () => {
      if (!videoRef.current) return;
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    };

    const handleTimeUpdate = () => {
      if (!videoRef.current) return;
      const t = videoRef.current.currentTime;
      setCurrentTime(t);
      if (duration && t >= duration && isLooping) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }
    };

    const seekTo = (seconds) => {
      const clamped = Math.max(0, Math.min(duration || 30, seconds));
      setCurrentTime(clamped);
      if (videoRef.current) {
        videoRef.current.currentTime = clamped;
      }
    };

    // Auto Edit State
    const [isAutoEditing, setIsAutoEditing] = useState(false);
    const handleRunAutoEdit = async () => {
      if (isAutoEditing) return;
      setIsAutoEditing(true);
      try {
        const res = await fetch(`/api/reel-studio/projects/${project.id}/auto-edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preset: timeline.captionStyle?.preset || project.preset,
            aspectRatio: project.aspect_ratio || '9:16',
            enableBehindHead: true,
            enableGlassCards: true,
            enableCameraZooms: true,
            enableSfx: true,
            enableBgm: true
          })
        });
        const data = await res.json();
        if (data.success && data.timeline) {
          setTimeline(data.timeline);
          if (data.project && onUpdateProject) {
            onUpdateProject(data.project);
          }
        }
      } catch (err) {
        alert('Auto Edit Error: ' + err.message);
      } finally {
        setIsAutoEditing(false);
      }
    };

    // Subject Segmentation
    const [isSegmenting, setIsSegmenting] = useState(false);
    const handleSegmentSubject = async () => {
      if (isSegmenting) return;
      setIsSegmenting(true);
      try {
        const res = await fetch(`/api/reel-studio/projects/${project.id}/segment-subject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timestamp: currentTime || 2.0
          })
        });
        const data = await res.json();
        if (data.success && data.fg_path) {
          const updatedTimeline = {
            ...timeline,
            behindHead: {
              ...timeline.behindHead,
              enabled: true,
              maskMode: 'ai',
              maskPath: data.mask_path,
              fgPath: data.fg_path,
              startTime: Math.max(0, +(currentTime - 0.2).toFixed(2)),
              endTime: Math.min(duration, +(currentTime + 3.2).toFixed(2))
            }
          };
          setTimeline(updatedTimeline);
          syncProjectToServer(updatedTimeline, { subject_mask_path: data.fg_path, mask_mode: 'ai' });
        } else {
          alert('Subject Segmentation: ' + (data.message || 'Face detection fallback applied.'));
        }
      } catch (err) {
        alert('Segmentation Error: ' + err.message);
      } finally {
        setIsSegmenting(false);
      }
    };

    // Render & Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportResolution, setExportResolution] = useState('1080p');
    const [exportFps, setExportFps] = useState(60);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportStage, setExportStage] = useState('');
    const [exportedUrl, setExportedUrl] = useState(project.exported_video || null);

    const handleStartExport = async () => {
      setIsExporting(true);
      setExportProgress(5);
      setExportStage('Initializing multi-track render engine...');
      try {
        const res = await fetch(`/api/reel-studio/projects/${project.id}/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resolution: exportResolution,
            fps: exportFps,
            aspectRatio: project.aspect_ratio || '9:16'
          })
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to start render');
        }
      } catch (err) {
        setIsExporting(false);
        alert('Export error: ' + err.message);
      }
    };

    // Compute active element states at currentTime
    const bh = timeline.behindHead || {};
    const isBhActive = bh.enabled && currentTime >= bh.startTime && currentTime <= bh.endTime;

    // Active caption segment
    const activeCaptionSeg = useMemo(() => {
      return (timeline.captionsTrack || []).find(s => currentTime >= s.start && currentTime <= s.end);
    }, [timeline.captionsTrack, currentTime]);

    // Active glass cards
    const activeGlassCards = useMemo(() => {
      return (timeline.glassCardsTrack || []).filter(c => currentTime >= c.startTime && currentTime <= c.endTime);
    }, [timeline.glassCardsTrack, currentTime]);

    // Active camera zoom
    const activeCameraZoom = useMemo(() => {
      return (timeline.cameraTrack || []).find(c => currentTime >= c.startTime && currentTime <= (c.startTime + c.duration));
    }, [timeline.cameraTrack, currentTime]);

    // Active screen shake
    const activeScreenShake = useMemo(() => {
      return (timeline.shakeTrack || []).find(s => currentTime >= s.startTime && currentTime <= (s.startTime + s.duration));
    }, [timeline.shakeTrack, currentTime]);

    // Selected style preset object
    const selectedPreset = useMemo(() => {
      const pid = timeline.captionStyle?.preset || project.preset || 'hormozi-bold';
      return presets.find(p => p.id === pid) || presets[0] || FALLBACK_PRESETS[0];
    }, [presets, timeline.captionStyle?.preset, project.preset]);

    // Apply camera transform to canvas viewport
    const cameraScale = activeCameraZoom ? activeCameraZoom.scale : 1.0;
    const cameraAnchorX = activeCameraZoom ? activeCameraZoom.anchorX : 50;
    const cameraAnchorY = activeCameraZoom ? activeCameraZoom.anchorY : 38;

    // Shake jitter transform
    const shakeTransform = activeScreenShake
      ? `translate(${(Math.random() - 0.5) * (activeScreenShake.intensity || 5)}px, ${(Math.random() - 0.5) * (activeScreenShake.intensity || 5)}px) rotate(${(Math.random() - 0.5) * 1}deg)`
      : 'none';

    // Aspect ratio container classes
    const aspect = project.aspect_ratio || '9:16';
    const canvasAspectClass = aspect === '16:9'
      ? 'w-full max-w-[640px] aspect-video'
      : aspect === '1:1'
      ? 'w-full max-w-[440px] aspect-square'
      : 'w-full max-w-[340px] aspect-[9/16]';

    return (
      <div class="flex flex-col h-screen bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
        
        {/* ================================================================= */}
        {/* 1. TOP STUDIO NAVIGATION & ACTION BAR                             */}
        {/* ================================================================= */}
        <header class="h-14 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between flex-shrink-0 z-40">
          <div class="flex items-center space-x-3">
            <button
              onClick={onBackToProjects}
              class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition"
              title="Return to Hub"
            >
              <span>← Hub</span>
            </button>

            <div class="h-5 w-px bg-slate-700/60" />

            {/* Editable Project Title */}
            <input
              type="text"
              value={project.title || ''}
              onChange={(e) => {
                const newTitle = e.target.value;
                onUpdateProject({ ...project, title: newTitle });
                syncProjectToServer(timeline, { title: newTitle });
              }}
              class="bg-transparent hover:bg-slate-800/50 focus:bg-slate-900 px-2 py-1 rounded-md text-xs font-extrabold text-slate-100 border border-transparent focus:border-indigo-500 max-w-[240px] truncate transition focus:outline-none"
              title="Click to rename reel"
            />

            {/* Aspect Ratio Selector Pills */}
            <div class="hidden md:flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
              {[
                { id: '9:16', label: '📱 9:16 Reel' },
                { id: '16:9', label: '🖥️ 16:9 Doc' },
                { id: '1:1',  label: '⏹️ 1:1 Square' }
              ].map(ar => (
                <button
                  key={ar.id}
                  onClick={() => {
                    onUpdateProject({ ...project, aspect_ratio: ar.id });
                    syncProjectToServer(timeline, { aspect_ratio: ar.id });
                  }}
                  class={`px-2 py-1 rounded transition ${
                    aspect === ar.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ar.label}
                </button>
              ))}
            </div>
          </div>

          {/* Center: Style Preset Quick Dropdown */}
          <div class="flex items-center space-x-2">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden lg:inline">Style:</span>
            <select
              value={timeline.captionStyle?.preset || project.preset || 'hormozi-bold'}
              onChange={(e) => {
                const newPresetId = e.target.value;
                const pObj = presets.find(p => p.id === newPresetId) || FALLBACK_PRESETS[0];
                const updatedTimeline = {
                  ...timeline,
                  captionStyle: {
                    ...timeline.captionStyle,
                    preset: newPresetId,
                    fontFamily: pObj.font,
                    fontSize: pObj.fontSize,
                    fontWeight: pObj.fontWeight,
                    color: pObj.color,
                    highlightColor: pObj.highlightColor,
                    strokeWidth: pObj.strokeWidth,
                    strokeColor: pObj.strokeColor,
                    animation: pObj.animation
                  }
                };
                setTimeline(updatedTimeline);
                syncProjectToServer(updatedTimeline, { preset: newPresetId });
              }}
              class="bg-slate-950 border border-slate-700/80 hover:border-indigo-500 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
            >
              {presets.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category})
                </option>
              ))}
            </select>
          </div>

          {/* Right Actions: Auto Edit & Export */}
          <div class="flex items-center space-x-2.5">
            {/* 1-Click Autonomous Auto-Edit Button */}
            <button
              onClick={handleRunAutoEdit}
              disabled={isAutoEditing}
              class={`px-3.5 py-1.5 rounded-xl font-black text-xs transition-all flex items-center space-x-1.5 shadow-lg active:scale-95 ${
                isAutoEditing
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-400 hover:to-pink-400 text-slate-950 font-black shadow-orange-500/20'
              }`}
              title="Automatically detect climax, word-behind-head, glass cards, camera punch zooms and ducked audio"
            >
              <span>{isAutoEditing ? '⚡ Auto-Editing Reel...' : '⚡ Auto Edit My Reel'}</span>
            </button>

            {/* Export Reel Modal Trigger */}
            <button
              onClick={() => setShowExportModal(true)}
              class="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-lg shadow-indigo-600/30 transition active:scale-95 flex items-center space-x-1.5"
            >
              <span>🎬 Export Reel</span>
            </button>
          </div>
        </header>

        {/* ================================================================= */}
        {/* 2. MAIN 3-COLUMN WORKBENCH (Left Tools, Center Canvas, Right Insp)*/}
        {/* ================================================================= */}
        <div class="flex-1 flex overflow-hidden">
          
          {/* --------------------------------------------------------------- */}
          {/* LEFT TOOL SHELF & PRESET LIBRARY                                */}
          {/* --------------------------------------------------------------- */}
          <aside class="w-80 bg-slate-900/95 border-r border-slate-800/80 flex flex-col flex-shrink-0 z-20">
            {/* Shelf Mode Switcher Tabs */}
            <div class="grid grid-cols-6 border-b border-slate-800 bg-slate-950/70 p-1 text-[11px] font-bold">
              {[
                { id: 'styles', label: 'Styles', icon: '🎨' },
                { id: 'behind_head', label: 'Occlude', icon: '👤' },
                { id: 'cards', label: 'Cards', icon: '🪟' },
                { id: 'motion', label: 'Motion', icon: '🎥' },
                { id: 'audio', label: 'Audio', icon: '🔊' },
                { id: 'layers', label: 'Layers', icon: '🥞' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  class={`flex flex-col items-center py-1.5 rounded-md transition ${
                    activeTool === t.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={t.label}
                >
                  <span class="text-sm">{t.icon}</span>
                  <span class="text-[9px] mt-0.5">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Tool Pane Content */}
            <div class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
              
              {/* TAB 1: 15 STYLE PRESETS */}
              {activeTool === 'styles' && (
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reel Presets ({presets.length})</span>
                    <span class="text-[10px] text-indigo-400 font-mono">Word-by-word synced</span>
                  </div>
                  <div class="space-y-2">
                    {presets.map(p => {
                      const isSelected = (timeline.captionStyle?.preset || project.preset) === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            const updatedTimeline = {
                              ...timeline,
                              captionStyle: {
                                ...timeline.captionStyle,
                                preset: p.id,
                                fontFamily: p.font,
                                fontSize: p.fontSize,
                                fontWeight: p.fontWeight,
                                color: p.color,
                                highlightColor: p.highlightColor,
                                strokeWidth: p.strokeWidth,
                                strokeColor: p.strokeColor,
                                animation: p.animation
                              }
                            };
                            setTimeline(updatedTimeline);
                            syncProjectToServer(updatedTimeline, { preset: p.id });
                          }}
                          class={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-950'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                          }`}
                        >
                          <div class="flex items-center justify-between mb-1.5">
                            <span class="text-xs font-bold text-slate-200">{p.name}</span>
                            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              {p.category}
                            </span>
                          </div>

                          {/* Live typography simulation chip */}
                          <div
                            class="px-3 py-1.5 rounded-lg bg-black/70 border border-slate-800 text-center font-bold tracking-wide text-xs truncate"
                            style={{
                              fontFamily: `${p.font}, sans-serif`,
                              color: p.color,
                              fontWeight: p.fontWeight || '800'
                            }}
                          >
                            <span>THE </span>
                            <span style={{ color: p.highlightColor }}>UNREAL </span>
                            <span>MOMENT</span>
                          </div>
                          <p class="text-[10px] text-slate-400 mt-1 line-clamp-1">{p.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: ADVANCED WORD-BEHIND-HEAD (OCCLUSION ENGINE) */}
              {activeTool === 'behind_head' && (
                <div class="space-y-3.5">
                  <div class="flex items-center justify-between pb-2 border-b border-slate-800">
                    <label class="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bh.enabled}
                        onChange={(e) => {
                          const updatedTimeline = {
                            ...timeline,
                            behindHead: { ...bh, enabled: e.target.checked }
                          };
                          setTimeline(updatedTimeline);
                          syncProjectToServer(updatedTimeline);
                        }}
                        class="accent-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span class="text-xs font-black text-slate-100">Enable Behind-Head Text</span>
                    </label>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Depth Layer 2
                    </span>
                  </div>

                  {bh.enabled && (
                    <div class="space-y-3">
                      <div>
                        <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Climax Hook Text
                        </label>
                        <input
                          type="text"
                          value={bh.text || ''}
                          onChange={(e) => {
                            const updatedTimeline = {
                              ...timeline,
                              behindHead: { ...bh, text: e.target.value.toUpperCase() }
                            };
                            setTimeline(updatedTimeline);
                            syncProjectToServer(updatedTimeline);
                          }}
                          class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-black text-amber-300 tracking-wider focus:outline-none focus:border-indigo-500"
                          placeholder="VIRAL / HOOK / CLIMAX"
                        />
                      </div>

                      {/* Segmentation Trigger */}
                      <div class="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl space-y-2">
                        <div class="flex items-center justify-between text-[11px]">
                          <span class="font-bold text-indigo-300">AI Subject Segmentation</span>
                          <span class="text-[10px] text-slate-400">OpenCV GrabCut</span>
                        </div>
                        <p class="text-[10px] text-slate-400">
                          Extracts speaker silhouette with feathered alpha edges at the current playhead ({currentTime.toFixed(1)}s).
                        </p>
                        <button
                          onClick={handleSegmentSubject}
                          disabled={isSegmenting}
                          class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center space-x-1.5"
                        >
                          <span>{isSegmenting ? '🤖 Extracting Subject Matte...' : '🎯 Auto-Segment Subject at Playhead'}</span>
                        </button>
                        {project.subject_mask_path && (
                          <div class="flex items-center space-x-1.5 text-[10px] text-emerald-400 font-bold pt-1">
                            <span>✅ Subject Matte Active ({project.mask_mode || 'ai'} mode)</span>
                          </div>
                        )}
                      </div>

                      {/* Timing Controls */}
                      <div class="grid grid-cols-2 gap-2">
                        <div>
                          <label class="block text-[10px] font-bold text-slate-400 mb-1">Start Time (s)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={bh.startTime}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updatedTimeline = {
                                ...timeline,
                                behindHead: { ...bh, startTime: val }
                              };
                              setTimeline(updatedTimeline);
                              syncProjectToServer(updatedTimeline);
                            }}
                            class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label class="block text-[10px] font-bold text-slate-400 mb-1">End Time (s)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={bh.endTime}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updatedTimeline = {
                                ...timeline,
                                behindHead: { ...bh, endTime: val }
                              };
                              setTimeline(updatedTimeline);
                              syncProjectToServer(updatedTimeline);
                            }}
                            class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>

                      {/* Font Size & Position */}
                      <div>
                        <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                          <span>Font Size: {bh.fontSize}px</span>
                          <span>Depth: {bh.depth || 18}px</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="160"
                          value={bh.fontSize}
                          onChange={(e) => {
                            const updatedTimeline = {
                              ...timeline,
                              behindHead: { ...bh, fontSize: parseInt(e.target.value) }
                            };
                            setTimeline(updatedTimeline);
                            syncProjectToServer(updatedTimeline);
                          }}
                          class="w-full accent-indigo-500"
                        />
                      </div>

                      {/* Color & Glow */}
                      <div class="grid grid-cols-2 gap-2">
                        <div>
                          <label class="block text-[10px] font-bold text-slate-400 mb-1">Text Color</label>
                          <input
                            type="color"
                            value={bh.color || '#FFFFFF'}
                            onChange={(e) => {
                              const updatedTimeline = {
                                ...timeline,
                                behindHead: { ...bh, color: e.target.value }
                              };
                              setTimeline(updatedTimeline);
                              syncProjectToServer(updatedTimeline);
                            }}
                            class="w-full h-8 bg-slate-950 border border-slate-700 rounded cursor-pointer p-0.5"
                          />
                        </div>
                        <div>
                          <label class="block text-[10px] font-bold text-slate-400 mb-1">Glow Rim Color</label>
                          <input
                            type="color"
                            value={bh.glowColor || '#FFD700'}
                            onChange={(e) => {
                              const updatedTimeline = {
                                ...timeline,
                                behindHead: { ...bh, glowColor: e.target.value }
                              };
                              setTimeline(updatedTimeline);
                              syncProjectToServer(updatedTimeline);
                            }}
                            class="w-full h-8 bg-slate-950 border border-slate-700 rounded cursor-pointer p-0.5"
                          />
                        </div>
                      </div>

                      {/* Position X & Y Sliders */}
                      <div>
                        <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                          <span>Horizontal (X): {bh.posX}%</span>
                          <span>Vertical (Y): {bh.posY}%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="90"
                          value={bh.posX}
                          onChange={(e) => {
                            const updatedTimeline = {
                              ...timeline,
                              behindHead: { ...bh, posX: parseInt(e.target.value) }
                            };
                            setTimeline(updatedTimeline);
                            syncProjectToServer(updatedTimeline);
                          }}
                          class="w-full accent-indigo-500 mb-2"
                        />
                        <input
                          type="range"
                          min="10"
                          max="90"
                          value={bh.posY}
                          onChange={(e) => {
                            const updatedTimeline = {
                              ...timeline,
                              behindHead: { ...bh, posY: parseInt(e.target.value) }
                            };
                            setTimeline(updatedTimeline);
                            syncProjectToServer(updatedTimeline);
                          }}
                          class="w-full accent-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: GLASSMORPHISM INTERFACE CARDS */}
              {activeTool === 'cards' && (
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Glass Cards ({timeline.glassCardsTrack?.length || 0})
                    </span>
                    <button
                      onClick={() => {
                        const newCard = {
                          id: `card_${Date.now()}`,
                          type: 'stat',
                          title: 'NEW STAT',
                          content: 'Key fact extracted from narrative',
                          icon: '⚡',
                          startTime: +(currentTime).toFixed(2),
                          endTime: +(currentTime + 3.5).toFixed(2),
                          posX: 50,
                          posY: 76,
                          width: 290,
                          height: 94,
                          blur: 16,
                          accentColor: '#38BDF8',
                          animation: 'slide-left'
                        };
                        const updatedTimeline = {
                          ...timeline,
                          glassCardsTrack: [...(timeline.glassCardsTrack || []), newCard]
                        };
                        setTimeline(updatedTimeline);
                        syncProjectToServer(updatedTimeline);
                        setSelectedTrackItem({ type: 'card', id: newCard.id, data: newCard });
                      }}
                      class="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition"
                    >
                      + Add Card
                    </button>
                  </div>

                  <div class="space-y-2">
                    {(timeline.glassCardsTrack || []).map((card, idx) => {
                      const isSelected = selectedTrackItem?.id === card.id;
                      return (
                        <div
                          key={card.id}
                          onClick={() => setSelectedTrackItem({ type: 'card', id: card.id, data: card })}
                          class={`p-3 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? 'bg-slate-900 border-indigo-500'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div class="flex items-center justify-between mb-1">
                            <span class="text-xs font-bold text-slate-100 flex items-center space-x-1.5">
                              <span>{card.icon}</span>
                              <span>{card.title}</span>
                            </span>
                            <span class="text-[10px] font-mono text-slate-400">
                              {card.startTime}s - {card.endTime}s
                            </span>
                          </div>
                          <p class="text-[11px] text-slate-300 line-clamp-1">{card.content}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: CAMERA & MOTION ENGINE */}
              {activeTool === 'motion' && (
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Camera Punch Zooms ({timeline.cameraTrack?.length || 0})
                    </span>
                    <button
                      onClick={() => {
                        const newZoom = {
                          id: `cam_${Date.now()}`,
                          type: 'punch-zoom',
                          startTime: +(currentTime).toFixed(2),
                          duration: 0.45,
                          scale: 1.25,
                          anchorX: 50,
                          anchorY: 38,
                          easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
                        };
                        const updatedTimeline = {
                          ...timeline,
                          cameraTrack: [...(timeline.cameraTrack || []), newZoom]
                        };
                        setTimeline(updatedTimeline);
                        syncProjectToServer(updatedTimeline);
                      }}
                      class="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition"
                    >
                      + Add Punch Zoom
                    </button>
                  </div>

                  <div class="space-y-2">
                    {(timeline.cameraTrack || []).map((zoom, idx) => (
                      <div
                        key={zoom.id}
                        class="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div class="flex items-center space-x-2">
                          <span class="text-indigo-400 font-bold">🔍 {zoom.scale}x Zoom</span>
                          <span class="text-[10px] font-mono text-slate-400">@ {zoom.startTime}s</span>
                        </div>
                        <button
                          onClick={() => {
                            const updatedTimeline = {
                              ...timeline,
                              cameraTrack: timeline.cameraTrack.filter(z => z.id !== zoom.id)
                            };
                            setTimeline(updatedTimeline);
                            syncProjectToServer(updatedTimeline);
                          }}
                          class="text-rose-400 hover:text-rose-300 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Screen Shake Impacts */}
                  <div class="pt-2 border-t border-slate-800">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Screen Shake Impacts ({timeline.shakeTrack?.length || 0})
                      </span>
                      <button
                        onClick={() => {
                          const newShake = {
                            id: `shake_${Date.now()}`,
                            startTime: +(currentTime).toFixed(2),
                            duration: 0.28,
                            intensity: 6,
                            reason: 'Impact moment'
                          };
                          const updatedTimeline = {
                            ...timeline,
                            shakeTrack: [...(timeline.shakeTrack || []), newShake]
                          };
                          setTimeline(updatedTimeline);
                          syncProjectToServer(updatedTimeline);
                        }}
                        class="px-2 py-1 rounded bg-pink-600 hover:bg-pink-500 text-white font-bold text-[10px] transition"
                      >
                        + Add Shake
                      </button>
                    </div>

                    <div class="space-y-2">
                      {(timeline.shakeTrack || []).map((shake) => (
                        <div
                          key={shake.id}
                          class="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <span class="text-pink-400 font-bold">💥 Shake ({shake.intensity}px) @ {shake.startTime}s</span>
                          <button
                            onClick={() => {
                              const updatedTimeline = {
                                ...timeline,
                                shakeTrack: timeline.shakeTrack.filter(s => s.id !== shake.id)
                              };
                              setTimeline(updatedTimeline);
                              syncProjectToServer(updatedTimeline);
                            }}
                            class="text-rose-400 hover:text-rose-300 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: AUDIO DESIGN & SPEECH DUCKING */}
              {activeTool === 'audio' && (
                <div class="space-y-4">
                  {/* BGM & Ducking */}
                  <div class="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-slate-100">🎵 Background Music Track</span>
                      <span class="text-[10px] font-mono text-indigo-400 font-bold">Auto-Ducked</span>
                    </div>

                    <select
                      value={timeline.bgmTrack?.trackId || 'tech_cyber'}
                      onChange={(e) => {
                        const trackId = e.target.value;
                        const updatedTimeline = {
                          ...timeline,
                          bgmTrack: {
                            ...timeline.bgmTrack,
                            trackId,
                            src: `/audio/bgm/${trackId}.wav`
                          }
                        };
                        setTimeline(updatedTimeline);
                        syncProjectToServer(updatedTimeline);
                      }}
                      class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="tech_cyber">Tech Cyber Momentum</option>
                      <option value="epic_geopolitics">Epic Geopolitics Tension</option>
                      <option value="ambient_documentary">Ambient Atmospheric Documentary</option>
                      <option value="mystery_investigation">Mystery Forensic Pulse</option>
                    </select>

                    <div>
                      <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                        <span>BGM Volume: {Math.round((timeline.bgmTrack?.volume || 0.22) * 100)}%</span>
                        <span>Speech Ducking: -14 dB</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={timeline.bgmTrack?.volume || 0.22}
                        onChange={(e) => {
                          const updatedTimeline = {
                            ...timeline,
                            bgmTrack: {
                              ...timeline.bgmTrack,
                              volume: parseFloat(e.target.value)
                            }
                          };
                          setTimeline(updatedTimeline);
                          syncProjectToServer(updatedTimeline);
                        }}
                        class="w-full accent-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Sound Effects Catalog */}
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Sound Effects ({timeline.sfxTrack?.length || 0})
                      </span>
                      <button
                        onClick={() => {
                          const newSfx = {
                            id: `sfx_${Date.now()}`,
                            sfxId: 'whoosh',
                            name: 'Whoosh Displacement',
                            src: '/audio/sound-effects/whoosh.wav',
                            startTime: +(currentTime).toFixed(2),
                            volume: 0.5
                          };
                          const updatedTimeline = {
                            ...timeline,
                            sfxTrack: [...(timeline.sfxTrack || []), newSfx]
                          };
                          setTimeline(updatedTimeline);
                          syncProjectToServer(updatedTimeline);
                        }}
                        class="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition"
                      >
                        + Add SFX
                      </button>
                    </div>

                    <div class="space-y-1.5">
                      {(timeline.sfxTrack || []).map(sfx => (
                        <div
                          key={sfx.id}
                          class="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div class="flex items-center space-x-1.5">
                            <span>🔊</span>
                            <span class="font-bold text-slate-200">{sfx.sfxId}</span>
                            <span class="text-[10px] font-mono text-slate-400">@ {sfx.startTime}s</span>
                          </div>
                          <button
                            onClick={() => {
                              const updatedTimeline = {
                                ...timeline,
                                sfxTrack: timeline.sfxTrack.filter(s => s.id !== sfx.id)
                              };
                              setTimeline(updatedTimeline);
                              syncProjectToServer(updatedTimeline);
                            }}
                            class="text-rose-400 hover:text-rose-300"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: 4-LAYER STACK COMPOSITING */}
              {activeTool === 'layers' && (
                <div class="space-y-3">
                  <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Composite Layer Stack
                  </span>
                  {[
                    { depth: 4, name: 'Layer 4: Captions & Glass Overlays', desc: 'Active word pop, frosted glass cards, kinetic HUD', color: 'border-cyan-500' },
                    { depth: 3, name: 'Layer 3: Subject Matte (Cutout)', desc: 'OpenCV GrabCut alpha cutout with feathered edges', color: 'border-emerald-500' },
                    { depth: 2, name: 'Layer 2: 3D Behind-Head Occlusion', desc: 'Large typography with 3D text shadow and outer rim glow', color: 'border-amber-500' },
                    { depth: 1, name: 'Layer 1: Background Video', desc: 'Primary 1080p source video track with camera framing', color: 'border-indigo-500' }
                  ].map(l => (
                    <div key={l.depth} class={`p-3 rounded-xl bg-slate-950/80 border-l-4 ${l.color} border-slate-800 space-y-1`}>
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-200">{l.name}</span>
                        <span class="text-[10px] text-slate-400">z-index: {l.depth * 10}</span>
                      </div>
                      <p class="text-[10px] text-slate-400">{l.desc}</p>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </aside>

          {/* --------------------------------------------------------------- */}
          {/* CENTER INTERACTIVE CANVA & VIDEO VIEWPORT                       */}
          {/* --------------------------------------------------------------- */}
          <main class="flex-1 flex flex-col bg-slate-950/90 relative overflow-hidden">
            
            {/* Viewport Top Bar */}
            <div class="h-9 px-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950 text-xs text-slate-400">
              <div class="flex items-center space-x-3">
                <span class="font-bold text-slate-300">Live 4-Layer Composite Preview</span>
                {isBhActive && (
                  <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    👤 Word-Behind-Head Active
                  </span>
                )}
                {activeCameraZoom && (
                  <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    📹 {activeCameraZoom.scale}x Punch Zoom
                  </span>
                )}
              </div>

              <div class="flex items-center space-x-2">
                <label class="flex items-center space-x-1.5 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={showSafeArea}
                    onChange={(e) => setShowSafeArea(e.target.checked)}
                    class="accent-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>9:16 Safe Areas</span>
                </label>
              </div>
            </div>

            {/* Centered Canvas Container */}
            <div class="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
              <div
                class={`${canvasAspectClass} relative bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-indigo-500/30 flex items-center justify-center`}
                style={{
                  transform: shakeTransform
                }}
              >
                {/* Visual Viewport Inner: Zoom & Transform Container */}
                <div
                  class="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center transition-transform"
                  style={{
                    transform: `scale(${cameraScale})`,
                    transformOrigin: `${cameraAnchorX}% ${cameraAnchorY}%`,
                    transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)'
                  }}
                >
                  {/* ======================================================= */}
                  {/* LAYER 1: PRIMARY BACKGROUND VIDEO                       */}
                  {/* ======================================================= */}
                  <video
                    ref={videoRef}
                    src={timeline.videoTrack?.src || ('/' + (project.video_path || '').replace(/\\/g, '/'))}
                    preload="auto"
                    playsInline
                    muted={isMuted}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={(e) => {
                      if (!project.duration) setDuration(e.target.duration);
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    class="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
                  />

                  {/* ======================================================= */}
                  {/* LAYER 2: 3D BEHIND-HEAD OCCLUSION TEXT                  */}
                  {/* ======================================================= */}
                  {isBhActive && (
                    <div
                      class="absolute z-20 pointer-events-none select-none text-center transition-all flex items-center justify-center"
                      style={{
                        left: `${bh.posX}%`,
                        top: `${bh.posY}%`,
                        transform: `translate(-50%, -50%) scale(${bh.scale || 1}) rotate(${bh.rotation || 0}deg)`,
                        width: '90%',
                        opacity: bh.opacity || 0.95
                      }}
                    >
                      <span
                        style={{
                          fontFamily: `${bh.font || 'Montserrat'}, sans-serif`,
                          fontSize: `${bh.fontSize || 100}px`,
                          fontWeight: bh.fontWeight || '900',
                          color: bh.color || '#FFFFFF',
                          lineHeight: '1.05',
                          textTransform: 'uppercase',
                          textShadow: bh.shadow
                            ? `0 4px 18px rgba(0,0,0,0.9), 0 0 25px ${bh.glowColor || '#FFD700'}`
                            : 'none',
                          WebkitTextStroke: '2px rgba(0,0,0,0.85)',
                          letterSpacing: '0.04em',
                          display: 'block'
                        }}
                      >
                        {bh.text}
                      </span>
                    </div>
                  )}

                  {/* ======================================================= */}
                  {/* LAYER 3: FOREGROUND SUBJECT MATTE (ALPHACUT TRANSPARENCY)*/}
                  {/* ======================================================= */}
                  {isBhActive && project.subject_mask_path && (
                    <img
                      src={project.subject_mask_path.startsWith('/') ? project.subject_mask_path : '/' + project.subject_mask_path.replace(/\\/g, '/')}
                      alt="Subject Foreground Matte"
                      class="absolute inset-0 w-full h-full object-cover z-30 pointer-events-none select-none"
                      style={{
                        filter: `blur(${bh.feather ? Math.round(bh.feather * 0.2) : 0}px)`
                      }}
                    />
                  )}

                  {/* Fallback Manual Anchor Feather if no AI mask generated */}
                  {isBhActive && !project.subject_mask_path && (
                    <div
                      class="absolute z-30 pointer-events-none rounded-full border-2 border-amber-400/30 bg-amber-400/5 backdrop-blur-sm"
                      style={{
                        left: `${(bh.manualMask?.x || 35)}%`,
                        top: `${(bh.manualMask?.y || 20)}%`,
                        width: `${(bh.manualMask?.width || 30)}%`,
                        height: `${(bh.manualMask?.height || 45)}%`
                      }}
                    />
                  )}

                  {/* ======================================================= */}
                  {/* LAYER 4: WORD-LEVEL KARAOKE CAPTIONS                    */}
                  {/* ======================================================= */}
                  {activeCaptionSeg && (
                    <div
                      class="absolute left-1/2 -translate-x-1/2 w-[88%] z-40 text-center pointer-events-none transition-all flex justify-center"
                      style={{
                        bottom: `${Math.round((timeline.captionStyle?.verticalOffset || 480) * 0.15)}px`
                      }}
                    >
                      <div
                        class="px-4 py-2 rounded-2xl max-w-full font-black shadow-2xl backdrop-blur-md break-words leading-tight"
                        style={{
                          backgroundColor: timeline.captionStyle?.bgBox ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.65)',
                          border: '1px solid rgba(255,255,255,0.18)',
                          fontFamily: `${timeline.captionStyle?.fontFamily || selectedPreset.font}, sans-serif`,
                          fontSize: `${Math.round((timeline.captionStyle?.fontSize || selectedPreset.fontSize) * 0.32)}px`,
                          color: timeline.captionStyle?.color || selectedPreset.color,
                          WebkitTextStroke: `${timeline.captionStyle?.strokeWidth || 3}px ${timeline.captionStyle?.strokeColor || '#000000'}`
                        }}
                      >
                        {(activeCaptionSeg.words && activeCaptionSeg.words.length > 0) ? (
                          activeCaptionSeg.words.map((w, wIdx) => {
                            const isKw = w.isKeyword || wIdx === 1;
                            return (
                              <span
                                key={wIdx}
                                class={isKw ? 'animate-word-pop inline-block' : 'inline-block'}
                                style={{
                                  color: isKw
                                    ? (timeline.captionStyle?.highlightColor || selectedPreset.highlightColor)
                                    : (timeline.captionStyle?.color || selectedPreset.color),
                                  margin: '0 3px'
                                }}
                              >
                                {w.word}
                              </span>
                            );
                          })
                        ) : (
                          <span>{activeCaptionSeg.text}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* LAYER 4: GLASSMORPHISM INTERFACE CARDS */}
                  {activeGlassCards.map((card) => (
                    <div
                      key={card.id}
                      class="absolute z-40 pointer-events-none transition-all"
                      style={{
                        left: `${card.posX}%`,
                        top: `${card.posY}%`,
                        transform: 'translate(-50%, -50%)',
                        width: '85%'
                      }}
                    >
                      <div
                        class="p-3.5 rounded-2xl shadow-2xl border flex items-center space-x-3 text-left"
                        style={{
                          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.90) 100%)',
                          backdropFilter: `blur(${card.blur || 16}px)`,
                          borderColor: card.accentColor ? `${card.accentColor}66` : 'rgba(255,255,255,0.2)'
                        }}
                      >
                        <div
                          class="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow"
                          style={{
                            background: card.accentColor ? `${card.accentColor}33` : 'rgba(56, 189, 248, 0.2)',
                            color: card.accentColor || '#38BDF8'
                          }}
                        >
                          {card.icon || '⚡'}
                        </div>
                        <div class="flex-1 min-w-0">
                          <div
                            class="text-[10px] font-black uppercase tracking-wider mb-0.5 truncate"
                            style={{ color: card.accentColor || '#38BDF8' }}
                          >
                            {card.title}
                          </div>
                          <p class="text-xs font-bold text-slate-100 leading-snug line-clamp-2">
                            {card.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* LAYER 4: 9:16 MOBILE SAFE AREA GUIDES */}
                  {showSafeArea && aspect === '9:16' && (
                    <div class="absolute inset-0 border-2 border-dashed border-red-500/40 pointer-events-none z-50">
                      {/* Top App Header Zone */}
                      <div class="absolute top-0 left-0 right-0 h-[12%] bg-red-500/10 border-b border-red-500/30 flex items-center justify-center">
                        <span class="text-[9px] font-bold text-red-300 uppercase tracking-widest">
                          Top UI Safe Margin
                        </span>
                      </div>

                      {/* Bottom Caption & Handle Zone */}
                      <div class="absolute bottom-0 left-0 right-0 h-[18%] bg-red-500/10 border-t border-red-500/30 flex items-center justify-center">
                        <span class="text-[9px] font-bold text-red-300 uppercase tracking-widest">
                          Bottom UI Safe Margin
                        </span>
                      </div>

                      {/* Right Action Rail Margin */}
                      <div class="absolute top-[12%] bottom-[18%] right-0 w-[14%] bg-red-500/5 border-l border-red-500/20 flex items-center justify-center">
                        <span class="text-[8px] font-bold text-red-400 rotate-90 uppercase tracking-widest">
                          Icons
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Big Hover Play/Pause Overlay */}
                <div
                  onClick={togglePlay}
                  class="absolute inset-0 z-50 flex items-center justify-center bg-black/20 hover:bg-black/30 cursor-pointer opacity-0 hover:opacity-100 transition"
                >
                  <div class="w-14 h-14 rounded-full bg-indigo-600/90 text-white flex items-center justify-center text-xl shadow-2xl backdrop-blur-sm transition transform hover:scale-110">
                    {isPlaying ? '⏸️' : '▶️'}
                  </div>
                </div>
              </div>
            </div>

            {/* Viewport Bottom Transport Controls */}
            <div class="h-12 border-t border-slate-800/80 bg-slate-950 px-4 flex items-center justify-between text-xs text-slate-300 flex-shrink-0 z-30">
              <div class="flex items-center space-x-3">
                <button
                  onClick={togglePlay}
                  class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center space-x-1.5 transition shadow"
                >
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  class="p-1.5 text-slate-400 hover:text-white"
                  title="Mute / Unmute"
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>

                <div class="font-mono text-xs text-slate-400">
                  <span class="text-indigo-400 font-bold">{currentTime.toFixed(1)}s</span> / {duration.toFixed(1)}s
                </div>
              </div>

              {/* Central Scrubber */}
              <input
                type="range"
                min="0"
                max={duration || 30}
                step="0.05"
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                class="flex-1 max-w-xl mx-4 accent-indigo-500 cursor-pointer"
              />

              <div class="flex items-center space-x-2">
                <button
                  onClick={() => setIsLooping(!isLooping)}
                  class={`px-2 py-1 rounded text-[11px] font-bold ${
                    isLooping ? 'bg-indigo-950 text-indigo-300 border border-indigo-700' : 'text-slate-400'
                  }`}
                  title="Loop Playback"
                >
                  🔁 Loop
                </button>
              </div>
            </div>
          </main>

          {/* --------------------------------------------------------------- */}
          {/* RIGHT CONTEXTUAL PROPERTY INSPECTOR                             */}
          {/* --------------------------------------------------------------- */}
          <aside class="w-72 bg-slate-900/95 border-l border-slate-800/80 flex flex-col flex-shrink-0 z-20">
            <div class="p-3.5 border-b border-slate-800 font-black text-xs text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Property Inspector</span>
              {selectedTrackItem && (
                <span class="text-[9px] px-2 py-0.5 rounded bg-indigo-600 text-white font-bold">
                  {selectedTrackItem.type}
                </span>
              )}
            </div>

            <div class="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-4 text-xs">
              
              {/* Selected Item Inspector: Caption Segment */}
              {selectedTrackItem?.type === 'caption' ? (
                <div class="space-y-3">
                  <span class="font-bold text-slate-200 block">Edit Spoken Segment</span>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-400 mb-1">Transcript Text</label>
                    <textarea
                      rows="3"
                      value={selectedTrackItem.data?.text || ''}
                      onChange={(e) => {
                        const newText = e.target.value;
                        const updatedCaptions = (timeline.captionsTrack || []).map(seg => {
                          if (seg.id === selectedTrackItem.id) {
                            return { ...seg, text: newText };
                          }
                          return seg;
                        });
                        const updatedTimeline = { ...timeline, captionsTrack: updatedCaptions };
                        setTimeline(updatedTimeline);
                        setSelectedTrackItem({ ...selectedTrackItem, data: { ...selectedTrackItem.data, text: newText } });
                        syncProjectToServer(updatedTimeline);
                      }}
                      class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 mb-1">Start (s)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedTrackItem.data?.start || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updatedCaptions = (timeline.captionsTrack || []).map(seg => {
                            if (seg.id === selectedTrackItem.id) return { ...seg, start: val };
                            return seg;
                          });
                          const updatedTimeline = { ...timeline, captionsTrack: updatedCaptions };
                          setTimeline(updatedTimeline);
                          syncProjectToServer(updatedTimeline);
                        }}
                        class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 mb-1">End (s)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedTrackItem.data?.end || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updatedCaptions = (timeline.captionsTrack || []).map(seg => {
                            if (seg.id === selectedTrackItem.id) return { ...seg, end: val };
                            return seg;
                          });
                          const updatedTimeline = { ...timeline, captionsTrack: updatedCaptions };
                          setTimeline(updatedTimeline);
                          syncProjectToServer(updatedTimeline);
                        }}
                        class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : selectedTrackItem?.type === 'card' ? (
                /* Selected Item Inspector: Glass Card */
                <div class="space-y-3">
                  <span class="font-bold text-slate-200 block">Edit Glassmorphism Card</span>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-400 mb-1">Card Title</label>
                    <input
                      type="text"
                      value={selectedTrackItem.data?.title || ''}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        const updatedCards = (timeline.glassCardsTrack || []).map(c => {
                          if (c.id === selectedTrackItem.id) return { ...c, title: newTitle };
                          return c;
                        });
                        const updatedTimeline = { ...timeline, glassCardsTrack: updatedCards };
                        setTimeline(updatedTimeline);
                        setSelectedTrackItem({ ...selectedTrackItem, data: { ...selectedTrackItem.data, title: newTitle } });
                        syncProjectToServer(updatedTimeline);
                      }}
                      class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs font-bold text-slate-100"
                    />
                  </div>

                  <div>
                    <label class="block text-[10px] font-bold text-slate-400 mb-1">Card Content</label>
                    <textarea
                      rows="2"
                      value={selectedTrackItem.data?.content || ''}
                      onChange={(e) => {
                        const newContent = e.target.value;
                        const updatedCards = (timeline.glassCardsTrack || []).map(c => {
                          if (c.id === selectedTrackItem.id) return { ...c, content: newContent };
                          return c;
                        });
                        const updatedTimeline = { ...timeline, glassCardsTrack: updatedCards };
                        setTimeline(updatedTimeline);
                        setSelectedTrackItem({ ...selectedTrackItem, data: { ...selectedTrackItem.data, content: newContent } });
                        syncProjectToServer(updatedTimeline);
                      }}
                      class="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-100"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 mb-1">Icon</label>
                      <input
                        type="text"
                        value={selectedTrackItem.data?.icon || '⚡'}
                        onChange={(e) => {
                          const newIcon = e.target.value;
                          const updatedCards = (timeline.glassCardsTrack || []).map(c => {
                            if (c.id === selectedTrackItem.id) return { ...c, icon: newIcon };
                            return c;
                          });
                          const updatedTimeline = { ...timeline, glassCardsTrack: updatedCards };
                          setTimeline(updatedTimeline);
                          syncProjectToServer(updatedTimeline);
                        }}
                        class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 mb-1">Accent Color</label>
                      <input
                        type="color"
                        value={selectedTrackItem.data?.accentColor || '#38BDF8'}
                        onChange={(e) => {
                          const newCol = e.target.value;
                          const updatedCards = (timeline.glassCardsTrack || []).map(c => {
                            if (c.id === selectedTrackItem.id) return { ...c, accentColor: newCol };
                            return c;
                          });
                          const updatedTimeline = { ...timeline, glassCardsTrack: updatedCards };
                          setTimeline(updatedTimeline);
                          syncProjectToServer(updatedTimeline);
                        }}
                        class="w-full h-8 bg-slate-950 border border-slate-700 rounded cursor-pointer p-0.5"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const updatedCards = (timeline.glassCardsTrack || []).filter(c => c.id !== selectedTrackItem.id);
                      const updatedTimeline = { ...timeline, glassCardsTrack: updatedCards };
                      setTimeline(updatedTimeline);
                      setSelectedTrackItem(null);
                      syncProjectToServer(updatedTimeline);
                    }}
                    class="w-full py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 rounded font-bold text-xs transition"
                  >
                    Delete Glass Card
                  </button>
                </div>
              ) : (
                /* Default Inspector: Master Typography & Vertical Offset */
                <div class="space-y-4">
                  <div>
                    <span class="font-bold text-slate-200 block mb-1">Global Caption Typography</span>
                    <p class="text-[10px] text-slate-400">Controls word-by-word font scaling and positioning.</p>
                  </div>

                  <div>
                    <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                      <span>Caption Size: {timeline.captionStyle?.fontSize || 64}px</span>
                    </div>
                    <input
                      type="range"
                      min="36"
                      max="96"
                      value={timeline.captionStyle?.fontSize || 64}
                      onChange={(e) => {
                        const updatedTimeline = {
                          ...timeline,
                          captionStyle: {
                            ...timeline.captionStyle,
                            fontSize: parseInt(e.target.value)
                          }
                        };
                        setTimeline(updatedTimeline);
                        syncProjectToServer(updatedTimeline);
                      }}
                      class="w-full accent-indigo-500"
                    />
                  </div>

                  <div>
                    <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                      <span>Vertical Height Offset</span>
                    </div>
                    <input
                      type="range"
                      min="200"
                      max="800"
                      value={timeline.captionStyle?.verticalOffset || 480}
                      onChange={(e) => {
                        const updatedTimeline = {
                          ...timeline,
                          captionStyle: {
                            ...timeline.captionStyle,
                            verticalOffset: parseInt(e.target.value)
                          }
                        };
                        setTimeline(updatedTimeline);
                        syncProjectToServer(updatedTimeline);
                      }}
                      class="w-full accent-indigo-500"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 mb-1">Base Color</label>
                      <input
                        type="color"
                        value={timeline.captionStyle?.color || '#FFFFFF'}
                        onChange={(e) => {
                          const updatedTimeline = {
                            ...timeline,
                            captionStyle: { ...timeline.captionStyle, color: e.target.value }
                          };
                          setTimeline(updatedTimeline);
                          syncProjectToServer(updatedTimeline);
                        }}
                        class="w-full h-8 bg-slate-950 border border-slate-700 rounded cursor-pointer p-0.5"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 mb-1">Highlight Color</label>
                      <input
                        type="color"
                        value={timeline.captionStyle?.highlightColor || '#FFD700'}
                        onChange={(e) => {
                          const updatedTimeline = {
                            ...timeline,
                            captionStyle: { ...timeline.captionStyle, highlightColor: e.target.value }
                          };
                          setTimeline(updatedTimeline);
                          syncProjectToServer(updatedTimeline);
                        }}
                        class="w-full h-8 bg-slate-950 border border-slate-700 rounded cursor-pointer p-0.5"
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>
          </aside>
        </div>

        {/* ================================================================= */}
        {/* 3. BOTTOM MULTI-TRACK TIMELINE (8 Synchronized Tracks)            */}
        {/* ================================================================= */}
        <footer class="h-56 border-t border-slate-800 bg-slate-900/95 flex flex-col flex-shrink-0 z-30 select-none">
          {/* Timeline Header & Transport Ruler */}
          <div class="h-8 border-b border-slate-800 bg-slate-950/80 px-4 flex items-center justify-between text-[11px] font-bold text-slate-400">
            <div class="flex items-center space-x-4">
              <span>⏱️ MULTI-TRACK TIMELINE ({duration.toFixed(1)}s)</span>
              <span class="text-indigo-400 font-mono">Playhead: {currentTime.toFixed(2)}s</span>
            </div>

            <div class="flex items-center space-x-2">
              <span class="text-[10px] uppercase">Zoom</span>
              <button
                onClick={() => setTimelineZoom(Math.max(1, timelineZoom - 0.5))}
                class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold"
              >
                -
              </button>
              <span class="font-mono text-xs">{timelineZoom}x</span>
              <button
                onClick={() => setTimelineZoom(Math.min(4, timelineZoom + 0.5))}
                class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold"
              >
                +
              </button>
            </div>
          </div>

          {/* 8-Track Scrollable Timeline Grid */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left - 96; // minus label column
              const totalW = (rect.width - 96) * timelineZoom;
              if (clickX >= 0 && totalW > 0) {
                const targetSec = (clickX / totalW) * duration;
                seekTo(targetSec);
              }
            }}
            class="flex-1 overflow-x-auto custom-scrollbar overflow-y-hidden p-2 space-y-1 relative cursor-pointer"
          >
            {/* Playhead Vertical Line */}
            <div
              class="absolute top-0 bottom-0 w-0.5 bg-rose-500 shadow-lg shadow-rose-500 z-50 pointer-events-none"
              style={{
                left: `${96 + (duration > 0 ? (currentTime / duration) * 100 * timelineZoom : 0)}%`
              }}
            >
              <div class="w-3 h-3 bg-rose-500 rounded-full -ml-[5px] -mt-1 shadow" />
            </div>

            {/* TRACK 1: VIDEO */}
            <div class="h-5 flex items-center text-[10px] space-x-2">
              <span class="w-24 text-slate-400 font-bold truncate">📹 Video</span>
              <div class="flex-1 h-4 bg-indigo-950/80 border border-indigo-700/60 rounded flex items-center px-2 text-indigo-300 font-bold">
                Main Video Source ({duration.toFixed(1)}s)
              </div>
            </div>

            {/* TRACK 2: BEHIND-HEAD TEXT */}
            <div class="h-5 flex items-center text-[10px] space-x-2">
              <span class="w-24 text-slate-400 font-bold truncate">👤 Behind Head</span>
              <div class="flex-1 h-4 bg-slate-950 relative rounded border border-slate-800">
                {bh.enabled && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTool('behind_head');
                      seekTo(bh.startTime);
                    }}
                    class="absolute top-0 bottom-0 bg-amber-600/90 border border-amber-400 rounded text-[9px] font-black text-slate-950 px-1.5 flex items-center truncate shadow"
                    style={{
                      left: `${(bh.startTime / duration) * 100}%`,
                      width: `${Math.max(4, ((bh.endTime - bh.startTime) / duration) * 100)}%`
                    }}
                  >
                    {bh.text}
                  </div>
                )}
              </div>
            </div>

            {/* TRACK 3: CAPTIONS */}
            <div class="h-5 flex items-center text-[10px] space-x-2">
              <span class="w-24 text-slate-400 font-bold truncate">💬 Captions</span>
              <div class="flex-1 h-4 bg-slate-950 relative rounded border border-slate-800 overflow-hidden">
                {(timeline.captionsTrack || []).map((seg) => (
                  <div
                    key={seg.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTrackItem({ type: 'caption', id: seg.id, data: seg });
                      seekTo(seg.start);
                    }}
                    class="absolute top-0 bottom-0 bg-purple-700/80 hover:bg-purple-600 border border-purple-500 rounded text-[8px] text-white px-1 flex items-center truncate cursor-pointer"
                    style={{
                      left: `${(seg.start / duration) * 100}%`,
                      width: `${Math.max(1.5, ((seg.end - seg.start) / duration) * 100)}%`
                    }}
                  >
                    {seg.text}
                  </div>
                ))}
              </div>
            </div>

            {/* TRACK 4: GLASS CARDS */}
            <div class="h-5 flex items-center text-[10px] space-x-2">
              <span class="w-24 text-slate-400 font-bold truncate">🪟 Cards</span>
              <div class="flex-1 h-4 bg-slate-950 relative rounded border border-slate-800">
                {(timeline.glassCardsTrack || []).map((card) => (
                  <div
                    key={card.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTrackItem({ type: 'card', id: card.id, data: card });
                      seekTo(card.startTime);
                    }}
                    class="absolute top-0 bottom-0 bg-sky-600/90 hover:bg-sky-500 border border-sky-400 rounded text-[8px] font-bold text-white px-1.5 flex items-center truncate cursor-pointer shadow"
                    style={{
                      left: `${(card.startTime / duration) * 100}%`,
                      width: `${Math.max(3, ((card.endTime - card.startTime) / duration) * 100)}%`
                    }}
                  >
                    {card.title}
                  </div>
                ))}
              </div>
            </div>

            {/* TRACK 5: CAMERA */}
            <div class="h-5 flex items-center text-[10px] space-x-2">
              <span class="w-24 text-slate-400 font-bold truncate">🎥 Camera</span>
              <div class="flex-1 h-4 bg-slate-950 relative rounded border border-slate-800">
                {(timeline.cameraTrack || []).map((cam) => (
                  <div
                    key={cam.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(cam.startTime);
                    }}
                    class="absolute top-0 bottom-0 bg-indigo-500 border border-indigo-300 rounded text-[8px] font-black text-white px-1 flex items-center truncate"
                    style={{
                      left: `${(cam.startTime / duration) * 100}%`,
                      width: `${Math.max(2, (cam.duration / duration) * 100)}%`
                    }}
                  >
                    {cam.scale}x
                  </div>
                ))}
              </div>
            </div>

            {/* TRACK 6: SHAKE */}
            <div class="h-5 flex items-center text-[10px] space-x-2">
              <span class="w-24 text-slate-400 font-bold truncate">💥 Shake</span>
              <div class="flex-1 h-4 bg-slate-950 relative rounded border border-slate-800">
                {(timeline.shakeTrack || []).map((s) => (
                  <div
                    key={s.id}
                    class="absolute top-0 bottom-0 bg-pink-500 rounded w-2 border border-pink-300"
                    style={{ left: `${(s.startTime / duration) * 100}%` }}
                    title={`Shake @ ${s.startTime}s`}
                  />
                ))}
              </div>
            </div>

            {/* TRACK 7: SFX */}
            <div class="h-5 flex items-center text-[10px] space-x-2">
              <span class="w-24 text-slate-400 font-bold truncate">🔊 SFX</span>
              <div class="flex-1 h-4 bg-slate-950 relative rounded border border-slate-800">
                {(timeline.sfxTrack || []).map((sfx) => (
                  <div
                    key={sfx.id}
                    class="absolute top-0 bottom-0 bg-emerald-600 rounded px-1 text-[8px] font-bold text-white flex items-center"
                    style={{ left: `${(sfx.startTime / duration) * 100}%` }}
                    title={`${sfx.sfxId} @ ${sfx.startTime}s`}
                  >
                    {sfx.sfxId}
                  </div>
                ))}
              </div>
            </div>

            {/* TRACK 8: BGM */}
            <div class="h-5 flex items-center text-[10px] space-x-2">
              <span class="w-24 text-slate-400 font-bold truncate">🎵 BGM</span>
              <div class="flex-1 h-4 bg-emerald-950/70 border border-emerald-700/60 rounded flex items-center px-2 text-[9px] text-emerald-300 font-bold">
                {timeline.bgmTrack?.trackId || 'Music'} (-14dB Speech Ducked)
              </div>
            </div>
          </div>
        </footer>

        {/* ================================================================= */}
        {/* 4. PRODUCTION EXPORT MODAL                                       */}
        {/* ================================================================= */}
        {showExportModal && (
          <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                <span class="text-sm font-black text-slate-100 uppercase tracking-wide">
                  🎬 Render & Export Reel
                </span>
                <button
                  onClick={() => setShowExportModal(false)}
                  class="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div class="space-y-3">
                {/* Resolution Selector */}
                <div>
                  <label class="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">Resolution</label>
                  <div class="grid grid-cols-3 gap-2">
                    {[
                      { id: '1080p', label: '1080p (Full HD)', desc: '1080x1920' },
                      { id: '720p',  label: '720p (Fast)',    desc: '720x1280' },
                      { id: '4K',    label: '4K (Ultra)',     desc: '2160x3840' }
                    ].map(r => (
                      <button
                        key={r.id}
                        onClick={() => setExportResolution(r.id)}
                        class={`p-2 rounded-xl border text-center transition ${
                          exportResolution === r.id
                            ? 'bg-indigo-600 text-white border-indigo-400 font-bold shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div class="text-xs font-bold">{r.label}</div>
                        <div class="text-[9px] text-slate-400">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Framerate */}
                <div>
                  <label class="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">Framerate</label>
                  <div class="grid grid-cols-2 gap-2">
                    {[30, 60].map(fps => (
                      <button
                        key={fps}
                        onClick={() => setExportFps(fps)}
                        class={`py-2 rounded-xl border text-center font-bold text-xs transition ${
                          exportFps === fps
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        {fps} FPS {fps === 60 ? '⚡ Ultra Smooth' : '(Standard)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Progress Bar if Exporting */}
                {isExporting && (
                  <div class="space-y-2 pt-2">
                    <div class="flex justify-between text-xs font-bold">
                      <span class="text-indigo-400 animate-pulse">{exportStage || 'Rendering...'}</span>
                      <span class="font-mono text-slate-300">{exportProgress}%</span>
                    </div>
                    <div class="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                      <div
                        class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300"
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Render Result Preview & Download Link */}
                {exportedUrl && !isExporting && (
                  <div class="p-3 bg-emerald-950/60 border border-emerald-700/60 rounded-xl space-y-2 text-center">
                    <span class="text-xs font-bold text-emerald-300 block">✅ Reel Render Complete!</span>
                    <a
                      href={exportedUrl}
                      download
                      class="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg transition"
                    >
                      ⬇️ Download Final Reel MP4
                    </a>
                  </div>
                )}
              </div>

              {/* Start Render Button */}
              <button
                onClick={handleStartExport}
                disabled={isExporting}
                class="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-black text-xs rounded-xl shadow-xl transition active:scale-95 disabled:opacity-50"
              >
                {isExporting ? '⏳ Multi-Layer Rendering in Progress...' : '🚀 Start Full Production Render'}
              </button>
            </div>
          </div>
        )}

      </div>
    );
  }

  // Expose component to global window scope so App can seamlessly render it
  window.ReelStudioWorkspace = ReelStudioWorkspace;
})();
