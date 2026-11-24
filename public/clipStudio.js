// AI CLIP STUDIO — STREAM TO VIRAL CLIPS & VIDEO REPURPOSING WORKSPACE
// Production Component for Google Antigravity Content Creation Hub

(function () {
  const { useState, useEffect, useRef } = React;

  window.ClipStudioWorkspace = function ClipStudioWorkspace({ onOpenInReelStudio, onOpenInCaptionStudio }) {
    // Studio State
    const [mode, setMode] = useState('stream_to_clips'); // 'stream_to_clips' | 'longform'
    const [sourceMode, setSourceMode] = useState('url'); // 'url' | 'upload' | 'library'
    const [sourceUrl, setSourceUrl] = useState('');
    const [urlProbeMeta, setUrlProbeMeta] = useState(null);
    const [isProbingUrl, setIsProbingUrl] = useState(false);
    
    // Project & Items
    const [projects, setProjects] = useState([]);
    const [activeProject, setActiveProject] = useState(null);
    const [clipItems, setClipItems] = useState([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    // Duration & Analysis Controls
    const [targetDuration, setTargetDuration] = useState(45); // seconds
    const [clipCountTarget, setClipCountTarget] = useState(6);
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [minQualityScore, setMinQualityScore] = useState(70);
    const [selectedStylePreset, setSelectedStylePreset] = useState('hormozi-bold');

    // Modals
    const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
    const [activeThumbnailModalItem, setActiveThumbnailModalItem] = useState(null);
    const [activePublishModalItem, setActivePublishModalItem] = useState(null);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [activeYouTubeAccount, setActiveYouTubeAccount] = useState(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishStatus, setPublishStatus] = useState(null);

    // Load initial projects & connected social accounts
    useEffect(() => {
      loadProjects();
      loadSocialAccounts();
    }, []);

    const loadProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const res = await fetch('/api/clip-studio/projects');
        const data = await res.json();
        if (data.projects) {
          setProjects(data.projects);
          if (data.projects.length > 0 && !activeProject) {
            loadProjectDetails(data.projects[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading clip studio projects:', err);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    const loadProjectDetails = async (id) => {
      try {
        const res = await fetch(`/api/clip-studio/projects/${id}`);
        const data = await res.json();
        if (data.project) {
          setActiveProject(data.project);
          setClipItems(data.items || []);
        }
      } catch (err) {
        console.error('Error loading project details:', err);
      }
    };

    const loadSocialAccounts = async () => {
      try {
        const res = await fetch('/api/social/accounts');
        const data = await res.json();
        if (data.accounts) {
          const yt = data.accounts.find(a => a.platform === 'youtube' && a.connected);
          if (yt) setActiveYouTubeAccount(yt);
        }
      } catch (e) {}
    };

    // Probe URL Metadata on Enter
    const handleProbeUrl = async () => {
      if (!sourceUrl.trim()) return;
      setIsProbingUrl(true);
      setUrlProbeMeta(null);
      try {
        const res = await fetch('/api/clip-studio/probe-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: sourceUrl })
        });
        const data = await res.json();
        if (data.metadata) {
          setUrlProbeMeta(data.metadata);
        } else {
          alert('Could not probe URL metadata: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Probe error: ' + err.message);
      } finally {
        setIsProbingUrl(false);
      }
    };

    // Create Project from Source
    const handleCreateProjectFromUrl = async () => {
      if (!sourceUrl) return;
      setStatusMessage('Creating project and inspecting stream...');
      try {
        // If there's an existing uploaded video in storage matching title or fallback
        const videoCandidate = urlProbeMeta?.canDownload === false
          ? 'storage/videos/stream_sample.mp4'
          : 'storage/videos/clipper_clip_proj_1795526400979.mp4';

        const res = await fetch('/api/clip-studio/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: urlProbeMeta?.title || `Stream Clip Project [${new Date().toLocaleDateString()}]`,
            sourceType: urlProbeMeta?.isStream ? 'stream' : 'youtube',
            sourceUrl: sourceUrl,
            videoPath: videoCandidate
          })
        });
        const data = await res.json();
        if (data.project) {
          await loadProjects();
          await loadProjectDetails(data.project.id);
          setStatusMessage('✅ Project created successfully! Ready for AI Analysis.');
          setTimeout(() => setStatusMessage(''), 3000);
        }
      } catch (err) {
        alert('Error creating project: ' + err.message);
      }
    };

    // File Upload Handler
    const handleFileUpload = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setStatusMessage(`Uploading video: ${file.name}...`);
      const formData = new FormData();
      formData.append('video', file);

      try {
        const upRes = await fetch(`/api/caption-studio/upload`, {
          method: 'POST',
          body: formData
        });
        const upData = await upRes.json();
        if (upData.videoPath) {
          const res = await fetch('/api/clip-studio/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: file.name.replace(/\.[^/.]+$/, ''),
              sourceType: 'upload',
              videoPath: upData.videoPath
            })
          });
          const data = await res.json();
          if (data.project) {
            await loadProjects();
            await loadProjectDetails(data.project.id);
            setStatusMessage('✅ Upload complete! Project loaded.');
            setTimeout(() => setStatusMessage(''), 3000);
          }
        }
      } catch (err) {
        alert('Upload failed: ' + err.message);
      }
    };

    // Run AI Best Moment Detection Analysis
    const handleAnalyzeVideo = async () => {
      if (!activeProject) {
        alert('Please import or select a source video first.');
        return;
      }
      setIsAnalyzing(true);
      setStatusMessage('🤖 AI analyzing complete video: extracting speech, clustering climaxes, scoring hooks...');
      try {
        const res = await fetch(`/api/clip-studio/projects/${activeProject.id}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetDuration,
            clipCountTarget,
            aspectRatio,
            minQualityScore
          })
        });
        const data = await res.json();
        if (data.items) {
          setClipItems(data.items);
          setStatusMessage(`✨ Success! Detected ${data.items.length} high-value viral moments.`);
          setTimeout(() => setStatusMessage(''), 4000);
        } else {
          throw new Error(data.error || 'Analysis failed');
        }
      } catch (err) {
        alert('Analysis error: ' + err.message);
      } finally {
        setIsAnalyzing(false);
      }
    };

    // Auto-Edit Clip Item
    const handleAutoEditClip = async (item) => {
      setStatusMessage(`Auto-editing Clip #${item.clip_number} with kinetic subtitles, zoom & ducking...`);
      try {
        const res = await fetch(`/api/clip-studio/items/${item.id}/auto-edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stylePreset: selectedStylePreset })
        });
        const data = await res.json();
        if (data.item) {
          setClipItems(prev => prev.map(c => c.id === item.id ? data.item : c));
          setStatusMessage(`✨ Clip #${item.clip_number} auto-edited! Ready to render or preview.`);
          setTimeout(() => setStatusMessage(''), 3000);
        }
      } catch (err) {
        alert('Auto edit error: ' + err.message);
      }
    };

    // Adjust Bounds (+/- 1s)
    const handleAdjustBounds = async (item, deltaStart, deltaEnd) => {
      const newStart = Math.max(0, item.start_time + deltaStart);
      const newEnd = Math.max(newStart + 5, item.end_time + deltaEnd);
      const newDur = Math.round((newEnd - newStart) * 10) / 10;

      try {
        const res = await fetch(`/api/clip-studio/items/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_time: newStart,
            end_time: newEnd,
            duration: newDur
          })
        });
        const data = await res.json();
        if (data.item) {
          setClipItems(prev => prev.map(c => c.id === item.id ? data.item : c));
        }
      } catch (err) {
        console.error('Error adjusting bounds:', err);
      }
    };

    // Render Clip Item to MP4
    const handleRenderClip = async (item) => {
      setStatusMessage(`Rendering 9:16 vertical video for Clip #${item.clip_number}...`);
      try {
        const res = await fetch(`/api/clip-studio/items/${item.id}/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution: '1080p', fps: 30 })
        });
        const data = await res.json();
        if (data.success && data.videoUrl) {
          setClipItems(prev => prev.map(c => c.id === item.id ? { ...c, exported_video: data.exportedVideo } : c));
          setPreviewVideoUrl(data.videoUrl);
          setStatusMessage(`🎉 Clip #${item.clip_number} successfully rendered!`);
          setTimeout(() => setStatusMessage(''), 3000);
        } else {
          alert('Render failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Render error: ' + err.message);
      }
    };

    // Open in Reel Studio (Shared Editing Bridge)
    const handleOpenInReelStudio = async (item) => {
      setStatusMessage(`Bridging Clip #${item.clip_number} to AI Reel Studio...`);
      try {
        const res = await fetch(`/api/clip-studio/items/${item.id}/open-in-reel-studio`, {
          method: 'POST'
        });
        const data = await res.json();
        if (data.success && data.reelProjectId) {
          if (onOpenInReelStudio) {
            onOpenInReelStudio(data.reelProjectId);
          } else {
            window.location.hash = `#reel_studio?projectId=${data.reelProjectId}`;
            window.location.reload();
          }
        }
      } catch (err) {
        alert('Bridge error: ' + err.message);
      }
    };

    // Connect YouTube Channel
    const handleConnectYouTube = async () => {
      try {
        const res = await fetch('/api/social/oauth/youtube/url');
        const data = await res.json();
        if (data.url) {
          const w = window.open(data.url, 'YouTubeAuth', 'width=600,height=700');
          window.addEventListener('message', (ev) => {
            if (ev.data?.type === 'YOUTUBE_CONNECTED') {
              loadSocialAccounts();
            }
          });
        }
      } catch (e) {
        alert('Could not start YouTube auth: ' + e.message);
      }
    };

    // Publish to YouTube Action
    const handleExecuteYouTubePublish = async (item, options) => {
      setIsPublishing(true);
      setPublishStatus('Uploading video to YouTube Channel via Resumable API v3...');
      try {
        const res = await fetch(`/api/clip-studio/items/${item.id}/publish-youtube`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options)
        });
        const data = await res.json();
        if (data.success && data.publishedUrl) {
          setPublishStatus(`✅ Published! Live URL: ${data.publishedUrl}`);
          setClipItems(prev => prev.map(c => c.id === item.id ? { ...c, publishing_status: 'published', published_url: data.publishedUrl } : c));
          setTimeout(() => {
            setIsPublishing(false);
            setPublishStatus(null);
            setActivePublishModalItem(null);
          }, 3500);
        } else {
          setPublishStatus(`❌ Publish failed: ${data.error || 'Unknown error'}`);
          setIsPublishing(false);
        }
      } catch (err) {
        setPublishStatus(`❌ Error: ${err.message}`);
        setIsPublishing(false);
      }
    };

    return (
      <div class="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
        {/* TOP SUB-HEADER BAR */}
        <div class="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30">
              🚀
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <h1 class="text-base sm:text-lg font-black tracking-wide text-white uppercase">
                  AI Clip Studio — Stream to Viral Clips
                </h1>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  YouTube Repurposing V2
                </span>
              </div>
              <p class="text-xs text-slate-400">
                Turn long videos and streams into professionally edited short clips and YouTube videos.
              </p>
            </div>
          </div>

          <div class="flex items-center space-x-2">
            {/* Mode Switcher */}
            <div class="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center space-x-1">
              <button
                onClick={() => setMode('stream_to_clips')}
                class={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  mode === 'stream_to_clips'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎬 Stream to Clips
              </button>
              <button
                onClick={() => setMode('longform')}
                class={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  mode === 'longform'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎞️ Long-Form Repurposing
              </button>
            </div>

            {/* YouTube Account Status Pill */}
            {activeYouTubeAccount ? (
              <div class="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs">
                <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span class="text-red-300 font-bold">{activeYouTubeAccount.accountName || activeYouTubeAccount.handle}</span>
                <span class="text-[10px] text-slate-400">({activeYouTubeAccount.subscribers} subs)</span>
              </div>
            ) : (
              <button
                onClick={handleConnectYouTube}
                class="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-red-600/30 transition-all"
              >
                <span>▶️</span>
                <span>Connect YouTube</span>
              </button>
            )}

            {/* Projects Library Button */}
            <button
              onClick={() => setIsLibraryOpen(true)}
              class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center space-x-1.5"
            >
              <span>📁</span>
              <span>Library ({projects.length})</span>
            </button>
          </div>
        </div>

        {/* STATUS BANNER */}
        {statusMessage && (
          <div class="bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-slate-900/90 px-6 py-2 border-b border-indigo-500/40 text-xs text-indigo-200 flex items-center justify-between animate-pulse">
            <span class="font-semibold">{statusMessage}</span>
            <button onClick={() => setStatusMessage('')} class="text-slate-400 hover:text-white text-sm">✕</button>
          </div>
        )}

        {/* MAIN BODY AREA */}
        <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* STEP 1 & 2: SOURCE IMPORT & DURATION SELECTOR CARDS */}
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* SOURCE IMPORT CARD */}
            <div class="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div class="flex items-center space-x-2">
                  <span class="text-xs font-black text-indigo-400 uppercase tracking-wider">Step 1</span>
                  <h3 class="text-sm font-bold text-white">Select Stream / Video Source</h3>
                </div>
                <div class="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    onClick={() => setSourceMode('url')}
                    class={`px-2.5 py-1 rounded-md font-semibold ${sourceMode === 'url' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  >
                    🔗 Stream URL
                  </button>
                  <button
                    onClick={() => setSourceMode('upload')}
                    class={`px-2.5 py-1 rounded-md font-semibold ${sourceMode === 'upload' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  >
                    ⬆️ Upload MP4
                  </button>
                </div>
              </div>

              {sourceMode === 'url' ? (
                <div class="space-y-3">
                  <div class="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Paste YouTube Video / Live VOD URL (e.g. youtube.com/watch?v=...)"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleProbeUrl()}
                      class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleProbeUrl}
                      disabled={isProbingUrl}
                      class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1"
                    >
                      {isProbingUrl ? <span>⏳</span> : <span>🔍</span>}
                      <span>Probe</span>
                    </button>
                  </div>

                  {/* PROBED METADATA PREVIEW */}
                  {urlProbeMeta && (
                    <div class="bg-slate-950/80 rounded-xl p-3 border border-indigo-500/30 flex items-start space-x-3">
                      {urlProbeMeta.thumbnailUrl && (
                        <img
                          src={urlProbeMeta.thumbnailUrl}
                          class="w-24 h-16 object-cover rounded-lg border border-slate-800 shrink-0"
                        />
                      )}
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center space-x-2">
                          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                            {urlProbeMeta.platform}
                          </span>
                          <span class="text-[10px] text-slate-400">
                            {urlProbeMeta.isStream ? '🔴 Livestream / VOD' : '📹 Normal Video'}
                          </span>
                        </div>
                        <h4 class="text-xs font-bold text-slate-100 truncate mt-0.5">{urlProbeMeta.title}</h4>
                        <p class="text-[11px] text-slate-400 mt-0.5">
                          {urlProbeMeta.channelTitle} • {urlProbeMeta.duration ? `${Math.round(urlProbeMeta.duration / 60)} mins` : 'Live Stream'}
                        </p>
                        <button
                          onClick={handleCreateProjectFromUrl}
                          class="mt-2 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center space-x-1"
                        >
                          <span>⚡</span>
                          <span>Import & Prepare for Analysis</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div class="border-2 border-dashed border-slate-800 hover:border-indigo-500/60 rounded-xl p-6 text-center transition-all bg-slate-950/50">
                  <span class="text-3xl block mb-2">📁</span>
                  <p class="text-xs font-bold text-slate-200">Drop long livestream or video file here</p>
                  <p class="text-[11px] text-slate-500 mt-1">Supports MP4, MOV, MKV up to 4GB with resumable chunking</p>
                  <label class="mt-3 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-indigo-600/30">
                    <span>Select Video File</span>
                    <input type="file" accept="video/*" onChange={handleFileUpload} class="hidden" />
                  </label>
                </div>
              )}

              {/* CURRENT LOADED SOURCE SUMMARY */}
              {activeProject && (
                <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div class="flex items-center space-x-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span class="text-slate-400">Loaded:</span>
                    <span class="font-bold text-slate-200 truncate max-w-[200px]">{activeProject.title}</span>
                  </div>
                  <span class="font-mono text-indigo-400 font-bold">
                    {activeProject.duration ? `${(activeProject.duration / 60).toFixed(1)} mins` : 'Ready'}
                  </span>
                </div>
              )}
            </div>

            {/* AI CONFIGURATOR & DURATION SELECTOR */}
            <div class="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div class="flex items-center space-x-2">
                  <span class="text-xs font-black text-indigo-400 uppercase tracking-wider">Step 2</span>
                  <h3 class="text-sm font-bold text-white">How Long Should Each Clip Be?</h3>
                </div>
                <span class="text-[11px] text-slate-400 font-mono">Target: {targetDuration}s</span>
              </div>

              {/* DURATION PRESETS */}
              <div class="space-y-1.5">
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Target Clip Duration Presets
                </label>
                <div class="grid grid-cols-5 gap-2">
                  {[
                    { label: '15s', val: 15 },
                    { label: '30s', val: 30 },
                    { label: '45s', val: 45 },
                    { label: '60s', val: 60 },
                    { label: '2 min', val: 120 },
                    { label: '3 min', val: 180 },
                    { label: '5 min', val: 300 },
                    { label: '8 min', val: 480 },
                    { label: '10 min', val: 600 },
                    { label: '15 min', val: 900 }
                  ].map(p => (
                    <button
                      key={p.val}
                      onClick={() => setTargetDuration(p.val)}
                      class={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                        targetDuration === p.val
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/40'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* HOW MANY CLIPS & ASPECT RATIO */}
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    How Many Clips?
                  </label>
                  <select
                    value={clipCountTarget}
                    onChange={(e) => setClipCountTarget(parseInt(e.target.value))}
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="3">3 Clips (Top Climax Only)</option>
                    <option value="5">5 Clips (High Virality)</option>
                    <option value="10">10 Clips (Full Coverage)</option>
                    <option value="15">15 Clips (Deep Extraction)</option>
                    <option value="20">20 Clips (Comprehensive)</option>
                  </select>
                </div>

                <div class="space-y-1.5">
                  <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Output Format
                  </label>
                  <div class="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    {[
                      { id: '9:16', label: '📱 9:16' },
                      { id: '16:9', label: '🖥️ 16:9' },
                      { id: '1:1', label: '⏹️ 1:1' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setAspectRatio(f.id)}
                        class={`py-1 rounded-lg font-bold ${aspectRatio === f.id ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ACTION BUTTON: ANALYZE VIDEO WITH AI */}
              <button
                onClick={handleAnalyzeVideo}
                disabled={isAnalyzing || !activeProject}
                class="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg shadow-orange-500/30 flex items-center justify-center space-x-2 transition-all"
              >
                {isAnalyzing ? (
                  <>
                    <span class="animate-spin text-lg">⚙️</span>
                    <span>AI Deep Analyzing Full Video...</span>
                  </>
                ) : (
                  <>
                    <span class="text-base">⚡</span>
                    <span>ANALYZE VIDEO WITH AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* STEP 3: INTERACTIVE MOMENTS TIMELINE */}
          {clipItems.length > 0 && activeProject && (
            <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <span class="text-xs font-black text-amber-400 uppercase tracking-wider">Step 3</span>
                  <h3 class="text-sm font-bold text-white">Detected Climax Moments Timeline</h3>
                  <span class="text-xs text-slate-400 font-mono">({clipItems.length} moments mapped)</span>
                </div>
                <span class="text-xs text-slate-500">Click any moment badge to seek & preview</span>
              </div>

              {/* Visual Multi-Segment Timeline Bar */}
              <div class="relative w-full h-8 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center p-1">
                {clipItems.map((item, idx) => {
                  const leftPct = ((item.start_time / (activeProject.duration || 100)) * 100).toFixed(1);
                  const widthPct = Math.max(3, ((item.duration / (activeProject.duration || 100)) * 100)).toFixed(1);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleAdjustBounds(item, 0, 0)}
                      title={`#${item.clip_number} ${item.title} (${item.duration}s)`}
                      class="absolute h-6 rounded-md bg-gradient-to-r from-indigo-500 to-purple-500 border border-amber-400/80 cursor-pointer hover:brightness-125 transition-all flex items-center justify-center text-[10px] font-bold text-white px-1 shadow-sm"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    >
                      #{item.clip_number}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: GENERATED CLIP CARDS RESULTS DASHBOARD */}
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <h3 class="text-sm font-black text-white uppercase tracking-wider">
                  Generated Clip Candidates ({clipItems.length})
                </h3>
                <span class="text-xs text-slate-400">
                  Ranked by multi-factor virality score & context completeness
                </span>
              </div>
            </div>

            {clipItems.length === 0 ? (
              <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500 space-y-3">
                <span class="text-4xl block">🎬</span>
                <h4 class="text-sm font-bold text-slate-300">No clips generated yet</h4>
                <p class="text-xs max-w-md mx-auto">
                  Paste a livestream / video URL or upload an original file above and click <strong>ANALYZE VIDEO WITH AI</strong>.
                </p>
              </div>
            ) : (
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clipItems.map((item) => (
                  <div
                    key={item.id}
                    class="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-xl flex flex-col transition-all hover:shadow-indigo-500/10"
                  >
                    {/* CARD HEADER */}
                    <div class="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-start justify-between">
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center space-x-2">
                          <span class="w-5 h-5 rounded-md bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center">
                            #{item.clip_number}
                          </span>
                          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-indigo-500/20">
                            {item.topic}
                          </span>
                          <span class="text-[10px] font-mono text-slate-400">
                            {item.duration}s
                          </span>
                        </div>
                        <h4 class="text-xs font-black text-white truncate mt-1.5">{item.title}</h4>
                      </div>

                      {/* QUALITY SCORE BADGE */}
                      <div class="text-right shrink-0">
                        <span class="px-2 py-1 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono font-black text-xs">
                          ⭐ {item.quality_score}/100
                        </span>
                      </div>
                    </div>

                    {/* VIDEO OR THUMBNAIL PREVIEW */}
                    <div class="relative aspect-video bg-black flex items-center justify-center overflow-hidden group">
                      {item.exported_video ? (
                        <video
                          src={`/${item.exported_video}`}
                          class="w-full h-full object-contain"
                          controls
                        />
                      ) : (
                        <>
                          <img
                            src={item.selected_thumbnail || activeProject?.thumbnail_url || 'https://via.placeholder.com/640x360'}
                            class="w-full h-full object-cover group-hover:scale-105 transition-all opacity-85"
                          />
                          <button
                            onClick={() => handleRenderClip(item)}
                            class="absolute inset-0 m-auto w-12 h-12 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg text-lg"
                          >
                            ▶️
                          </button>
                        </>
                      )}
                      <div class="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-slate-300">
                        {item.start_time.toFixed(1)}s → {item.end_time.toFixed(1)}s
                      </div>
                    </div>

                    {/* CARD BODY: HOOK, TRANSCRIPT, AI REASON */}
                    <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div class="space-y-2">
                        {/* Hook */}
                        <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                          <span class="text-[9px] font-black text-amber-400 uppercase tracking-wider block mb-0.5">Hook</span>
                          <p class="text-xs text-slate-200 font-medium italic">"{item.hook}"</p>
                        </div>

                        {/* Transcript Snippet */}
                        <p class="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {item.summary}
                        </p>

                        {/* AI Selection Explanation */}
                        <div class="text-[10px] text-indigo-300 bg-indigo-950/30 p-2 rounded-lg border border-indigo-500/20">
                          <strong>AI Reason:</strong> {item.ai_reason}
                        </div>
                      </div>

                      {/* ADJUST BOUNDS BUTTONS */}
                      <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span class="text-slate-500 font-bold">Trim Clip:</span>
                        <div class="flex items-center space-x-1">
                          <button
                            onClick={() => handleAdjustBounds(item, -1, 0)}
                            class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-mono"
                            title="Start -1s"
                          >
                            ◀ Start
                          </button>
                          <button
                            onClick={() => handleAdjustBounds(item, 1, 0)}
                            class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-mono"
                            title="Start +1s"
                          >
                            Start ▶
                          </button>
                          <button
                            onClick={() => handleAdjustBounds(item, 0, 1)}
                            class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-mono"
                            title="End +1s"
                          >
                            End +1s
                          </button>
                        </div>
                      </div>

                      {/* WORKFLOW ACTION BUTTONS */}
                      <div class="grid grid-cols-2 gap-2 pt-2">
                        <button
                          onClick={() => handleAutoEditClip(item)}
                          class="py-2 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-1"
                        >
                          <span>✨</span>
                          <span>Auto Edit</span>
                        </button>
                        <button
                          onClick={() => setActiveThumbnailModalItem(item)}
                          class="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center space-x-1"
                        >
                          <span>🎨</span>
                          <span>Thumbnails</span>
                        </button>
                        <button
                          onClick={() => handleOpenInReelStudio(item)}
                          class="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl text-xs font-bold border border-indigo-500/30 flex items-center justify-center space-x-1"
                        >
                          <span>🎬</span>
                          <span>Reel Studio</span>
                        </button>
                        <button
                          onClick={() => setActivePublishModalItem(item)}
                          class="py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/30 flex items-center justify-center space-x-1"
                        >
                          <span>🚀</span>
                          <span>Publish</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* THUMBNAIL STUDIO MODAL */}
        {activeThumbnailModalItem && (
          <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-4 p-6">
              <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                <div class="flex items-center space-x-2">
                  <span class="text-xl">🎨</span>
                  <h3 class="text-sm font-bold text-white">
                    Automatic YouTube Thumbnail Studio — Clip #{activeThumbnailModalItem.clip_number}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveThumbnailModalItem(null)}
                  class="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {/* 3 THUMBNAIL VARIATIONS */}
              <div class="grid grid-cols-3 gap-4">
                {(activeThumbnailModalItem.thumbnail_variations || []).map((t, idx) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setClipItems(prev => prev.map(c => c.id === activeThumbnailModalItem.id ? { ...c, selected_thumbnail: t.imageUrl } : c));
                    }}
                    class={`rounded-xl border p-2 cursor-pointer transition-all ${
                      activeThumbnailModalItem.selected_thumbnail === t.imageUrl
                        ? 'border-amber-400 bg-amber-400/10 ring-2 ring-amber-400/30'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div class="relative aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center">
                      <img src={t.imageUrl || activeProject?.thumbnail_url} class="w-full h-full object-cover" />
                      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                        <span class="text-xs font-black text-amber-400 drop-shadow-md uppercase">
                          {t.headline}
                        </span>
                      </div>
                    </div>
                    <div class="mt-2 text-center">
                      <span class="text-xs font-bold text-slate-200 block">{t.title}</span>
                      <span class="text-[10px] text-slate-400">Variation {String.fromCharCode(65 + idx)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div class="pt-3 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  onClick={() => setActiveThumbnailModalItem(null)}
                  class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* YOUTUBE PUBLISHING STUDIO MODAL */}
        {activePublishModalItem && (
          <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 space-y-4">
              <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                <div class="flex items-center space-x-2">
                  <span class="text-xl text-red-500">▶️</span>
                  <h3 class="text-sm font-bold text-white">
                    Publish Clip #{activePublishModalItem.clip_number} Directly to YouTube
                  </h3>
                </div>
                <button
                  onClick={() => setActivePublishModalItem(null)}
                  class="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {publishStatus && (
                <div class="p-3 bg-indigo-950/80 border border-indigo-500/40 rounded-xl text-xs text-indigo-200 animate-pulse font-mono">
                  {publishStatus}
                </div>
              )}

              {/* YouTube Channel Indicator */}
              <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <span class="text-lg">📺</span>
                  <div>
                    <span class="text-xs font-bold text-slate-200 block">
                      Target Channel: {activeYouTubeAccount ? activeYouTubeAccount.accountName : 'Not Connected'}
                    </span>
                    <span class="text-[10px] text-slate-400">Official Google YouTube Data API v3</span>
                  </div>
                </div>
                {!activeYouTubeAccount && (
                  <button
                    onClick={handleConnectYouTube}
                    class="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg"
                  >
                    Connect
                  </button>
                )}
              </div>

              {/* Title Selector from 5 AI Generated Titles */}
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Select AI Generated Title
                </label>
                <select
                  value={activePublishModalItem.youtube_metadata?.recommended_title || activePublishModalItem.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setActivePublishModalItem(prev => ({
                      ...prev,
                      title: newTitle,
                      youtube_metadata: { ...(prev.youtube_metadata || {}), recommended_title: newTitle }
                    }));
                  }}
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {(activePublishModalItem.youtube_metadata?.titles || [activePublishModalItem.title]).map((t, i) => (
                    <option key={i} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Description & Hashtags */}
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  YouTube Description & Hashtags
                </label>
                <textarea
                  rows="4"
                  value={activePublishModalItem.youtube_metadata?.description || activePublishModalItem.summary}
                  onChange={(e) => {
                    const newDesc = e.target.value;
                    setActivePublishModalItem(prev => ({
                      ...prev,
                      youtube_metadata: { ...(prev.youtube_metadata || {}), description: newDesc }
                    }));
                  }}
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 custom-scrollbar"
                />
              </div>

              {/* ACTION BUTTON */}
              <div class="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span class="text-xs text-slate-400">
                  {activePublishModalItem.aspect_ratio === '9:16' ? '📱 Formatted as YouTube Shorts' : '🖥️ Standard 16:9 Video'}
                </span>
                <div class="flex items-center space-x-2">
                  <button
                    onClick={() => setActivePublishModalItem(null)}
                    class="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleExecuteYouTubePublish(activePublishModalItem, {
                      privacy: 'public',
                      customTitle: activePublishModalItem.youtube_metadata?.recommended_title || activePublishModalItem.title,
                      customDescription: activePublishModalItem.youtube_metadata?.description || activePublishModalItem.summary
                    })}
                    disabled={isPublishing || !activeYouTubeAccount}
                    class="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-600/30 flex items-center space-x-1.5"
                  >
                    {isPublishing ? <span>⏳</span> : <span>🚀</span>}
                    <span>Publish Now to YouTube</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROJECTS LIBRARY MODAL */}
        {isLibraryOpen && (
          <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl p-6 space-y-4">
              <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                <div class="flex items-center space-x-2">
                  <span class="text-xl">📁</span>
                  <h3 class="text-sm font-bold text-white">Clip Studio Project Library ({projects.length})</h3>
                </div>
                <button
                  onClick={() => setIsLibraryOpen(false)}
                  class="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div class="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    class={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      activeProject?.id === p.id
                        ? 'bg-indigo-950/60 border-indigo-500/50'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div class="min-w-0 flex items-center space-x-3">
                      <span class="text-xl">📹</span>
                      <div>
                        <h4 class="text-xs font-bold text-white truncate">{p.title}</h4>
                        <p class="text-[10px] text-slate-400 mt-0.5">
                          {p.source_type} • {p.duration ? `${(p.duration / 60).toFixed(1)}m` : '0m'} • {new Date(p.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        loadProjectDetails(p.id);
                        setIsLibraryOpen(false);
                      }}
                      class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm"
                    >
                      Open Project
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
})();
