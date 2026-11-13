with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

clipper_markup = """              {/* ===================== TAB 0: AI VIRAL CLIPPER ===================== */}
              {currentTab === 'clipper' && (
                <div class="max-w-7xl mx-auto space-y-6">

                  {/* Top Header & Project Switcher */}
                  <div class="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div class="flex items-center space-x-3">
                      <div>
                        <label class="block text-[11px] font-bold uppercase text-slate-400 mb-1">Active Clipper Project</label>
                        <select
                          value={activeClipperProject?.id || ''}
                          onChange={(e) => {
                            if (e.target.value) loadClipperProject(e.target.value);
                          }}
                          class="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-200 min-w-[240px]"
                        >
                          {clipperProjects.length === 0 && <option value="">No Ingested Videos</option>}
                          {clipperProjects.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.title} ({p.clip_count || 0} clips • {p.duration ? Math.round(p.duration) + 's' : 'Video'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {activeClipperProject && (
                        <div class="flex items-center space-x-2 pt-4">
                          <button
                            onClick={() => {
                              if (confirm('Reprocess this source with current duration and target clip count?')) {
                                fetch(`/api/clipper/projects/${activeClipperProject.id}/reprocess`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    targetDuration: clipperTargetDuration,
                                    clipCountTarget: parseInt(clipperClipCount, 10),
                                    language: clipperLanguage
                                  })
                                }).then(() => {
                                  setIsClipperBusy(true);
                                  setClipperStage('detecting');
                                  setClipperProgress(70);
                                });
                              }
                            }}
                            class="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 bg-indigo-950/60 border border-indigo-800 rounded"
                          >
                            🔄 Re-Detect Clips
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete project "${activeClipperProject.title}" and all its clips?`)) return;
                              await fetch(`/api/clipper/projects/${activeClipperProject.id}`, { method: 'DELETE' });
                              setActiveClipperProject(null);
                              setClipperClips([]);
                              setSelectedClip(null);
                              fetchClipperProjects();
                            }}
                            class="text-xs text-rose-400 hover:text-rose-300 font-medium px-2 py-1"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Batch Actions & Export Buttons */}
                    <div class="flex items-center space-x-3">
                      {clipperClips.length > 0 && (
                        <>
                          <button
                            onClick={handleBatchRenderClips}
                            disabled={isClipperBusy || isBatchRendering}
                            class="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs rounded-lg shadow-md transition disabled:opacity-50 flex items-center space-x-2"
                          >
                            <span>⚡ Batch Render All ({clipperClips.length})</span>
                          </button>

                          <a
                            href={activeClipperProject ? `/api/clipper/projects/${activeClipperProject.id}/export-zip` : '#'}
                            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-2"
                          >
                            <span>📦 Download All (ZIP)</span>
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* SOURCE INTAKE & CONFIGURATION CARD */}
                  <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                    <div class="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div>
                        <h3 class="text-base font-bold text-slate-100 flex items-center space-x-2">
                          <span class="text-indigo-400 text-lg">✂️</span>
                          <span>Source Ingestion & AI Viral Moment Configuration</span>
                        </h3>
                        <p class="text-xs text-slate-400 mt-1">Provide a YouTube link, podcast URL, or upload local long-form footage to extract multiple viral vertical Shorts.</p>
                      </div>

                      {/* Source Type Selector */}
                      <div class="flex bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
                        <button
                          onClick={() => setClipperSourceType('youtube')}
                          class={`px-3 py-1.5 rounded-lg transition ${clipperSourceType === 'youtube' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          🔴 YouTube / Online URL
                        </button>
                        <button
                          onClick={() => setClipperSourceType('upload')}
                          class={`px-3 py-1.5 rounded-lg transition ${clipperSourceType === 'upload' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          📁 Local Video Upload
                        </button>
                        <button
                          onClick={() => setClipperSourceType('local')}
                          class={`px-3 py-1.5 rounded-lg transition ${clipperSourceType === 'local' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          🎞️ Existing Project Clips ({outputClips.length})
                        </button>
                      </div>
                    </div>

                    {/* SOURCE INPUT AREA */}
                    {clipperSourceType === 'youtube' && (
                      <div class="space-y-4">
                        <div>
                          <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            YouTube or Podcast Video URL
                          </label>
                          <div class="flex items-center space-x-3">
                            <input
                              type="text"
                              value={clipperUrl}
                              onChange={(e) => setClipperUrl(e.target.value)}
                              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                              class="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
                            />
                            <button
                              onClick={handleCreateClipperProject}
                              disabled={isClipperBusy || !clipperUrl.trim()}
                              class="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2"
                            >
                              <span>⚡ Analyze & Extract Clips</span>
                            </button>
                          </div>
                          <p class="text-[11px] text-slate-500 mt-2">
                            * Respects copyright & access permissions. If platform blocks automated download, please use Local Video Upload below.
                          </p>
                        </div>
                      </div>
                    )}

                    {clipperSourceType === 'upload' && (
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleClipperFileUpload(e.dataTransfer.files[0]);
                          }
                        }}
                        class="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 bg-slate-950 text-center transition space-y-3 cursor-pointer"
                      >
                        <div class="text-3xl">📥</div>
                        <div>
                          <h4 class="text-sm font-bold text-slate-200">Drag & Drop Long Podcast or Video file here</h4>
                          <p class="text-xs text-slate-400 mt-0.5">Supports MP4, MOV, MKV, WEBM (Interviews, Podcasts, Webinars, Documentaries)</p>
                        </div>
                        <div>
                          <label class="cursor-pointer inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-md shadow-indigo-600/30 transition">
                            <span>Browse File from Computer</span>
                            <input
                              type="file"
                              accept=".mp4,.mov,.mkv,.webm"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleClipperFileUpload(e.target.files[0]);
                                }
                              }}
                              class="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {clipperSourceType === 'local' && (
                      <div class="space-y-4">
                        <div>
                          <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            Select Any Existing Video Clip
                          </label>
                          <div class="flex items-center space-x-3">
                            <select
                              value={clipperSelectedLocal}
                              onChange={(e) => setClipperSelectedLocal(e.target.value)}
                              class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none"
                            >
                              <option value="">Select from {outputClips.length} rendered videos & library assets...</option>
                              {outputClips.map(c => (
                                <option key={c.url} value={c.url}>
                                  {c.filename} ({c.sizeMb} MB)
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={handleCreateClipperProject}
                              disabled={isClipperBusy || !clipperSelectedLocal}
                              class="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition"
                            >
                              <span>⚡ Extract Viral Clips</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TUNING PARAMETERS */}
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
                      <div>
                        <label class="block text-xs font-bold text-slate-400 mb-1">Target Reel Duration</label>
                        <select
                          value={clipperTargetDuration}
                          onChange={(e) => setClipperTargetDuration(e.target.value)}
                          class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200"
                        >
                          <option value="15-30">15–30 Seconds (Punchy Viral Hooks)</option>
                          <option value="30-60">30–60 Seconds (Standard Reels — Recommended)</option>
                          <option value="60-90">60–90 Seconds (Deep Insights & Stories)</option>
                        </select>
                      </div>

                      <div>
                        <label class="block text-xs font-bold text-slate-400 mb-1">Target Number of Clips</label>
                        <select
                          value={clipperClipCount}
                          onChange={(e) => setClipperClipCount(e.target.value)}
                          class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200"
                        >
                          <option value="3">Extract Top 3 Clips</option>
                          <option value="5">Extract Top 5 Clips (Recommended)</option>
                          <option value="8">Extract Top 8 Clips</option>
                          <option value="10">Extract Top 10 Clips</option>
                        </select>
                      </div>

                      <div>
                        <label class="block text-xs font-bold text-slate-400 mb-1">Spoken Language / Model</label>
                        <select
                          value={clipperLanguage}
                          onChange={(e) => setClipperLanguage(e.target.value)}
                          class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200"
                        >
                          <option value="auto">Auto-Detect (English, Hindi, Hinglish)</option>
                          <option value="en">English (Pure)</option>
                          <option value="hi">Hindi / Hinglish</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* LIVE PROCESSING PIPELINE TRACKER */}
                  {(isClipperBusy || clipperError) && (
                    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 animate-pulse-glow">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                          <div class="w-3 h-3 rounded-full bg-amber-400 animate-ping"></div>
                          <h4 class="text-sm font-bold text-slate-200 uppercase tracking-wide">
                            AI Processing Pipeline: {clipperStage.toUpperCase()}
                          </h4>
                        </div>
                        <span class="text-xs font-mono font-bold text-indigo-400">{clipperProgress}%</span>
                      </div>

                      <div class="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
                        <div
                          class="bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, clipperProgress)}%` }}
                        ></div>
                      </div>

                      <p class="text-xs text-slate-400 font-mono">
                        {clipperStatusMessage || 'Processing long-form footage with Whisper and AI viral moment heuristics...'}
                      </p>

                      {clipperError && (
                        <div class="p-4 bg-rose-950/70 border border-rose-800 rounded-xl text-xs text-rose-300">
                          <strong>Error:</strong> {clipperError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* VIRAL CLIPS WORKSPACE (GRID & EDITOR) */}
                  {clipperClips.length > 0 && (
                    <div class="space-y-6">

                      {/* Filter & Summary Header */}
                      <div class="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                        <div class="flex items-center space-x-3">
                          <span class="text-sm font-bold text-slate-200">
                            {clipperClips.length} Viral Moments Extracted
                          </span>
                          <span class="text-xs px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full font-bold">
                            High Retention
                          </span>
                        </div>

                        {/* Filter Tabs */}
                        <div class="flex items-center space-x-2 text-xs">
                          <span class="text-slate-400 font-medium">Filter:</span>
                          <button
                            onClick={() => setClipperFilter('all')}
                            class={`px-3 py-1 rounded-lg font-semibold transition ${clipperFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                          >
                            All ({clipperClips.length})
                          </button>
                          <button
                            onClick={() => setClipperFilter('viral')}
                            class={`px-3 py-1 rounded-lg font-semibold transition ${clipperFilter === 'viral' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                          >
                            🔥 Top Viral (Score ≥ 88)
                          </button>
                        </div>
                      </div>

                      {/* CLIPS GRID */}
                      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {clipperClips
                          .filter(c => clipperFilter === 'viral' ? c.engagement_score >= 88 : true)
                          .map((clip, idx) => (
                            <div
                              key={clip.id}
                              class={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition hover:border-indigo-500/70 shadow-lg ${
                                selectedClip?.id === clip.id ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-800'
                              }`}
                            >
                              <div class="space-y-3">
                                {/* Score Badge & Category */}
                                <div class="flex items-center justify-between">
                                  <span class="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60 flex items-center space-x-1">
                                    <span>🔥</span>
                                    <span>{clip.engagement_score}/100 VIRAL</span>
                                  </span>
                                  <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-indigo-400">
                                    {clip.category}
                                  </span>
                                </div>

                                {/* Title & Hook */}
                                <div>
                                  <h4 class="font-bold text-sm text-slate-100 line-clamp-1">{clip.title}</h4>
                                  <p class="text-xs text-amber-300/90 italic mt-1 line-clamp-2">"{clip.hook}"</p>
                                </div>

                                {/* Timestamps & Duration */}
                                <div class="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
                                  <span>⏱️ {Math.round(clip.start_time)}s ➔ {Math.round(clip.end_time)}s</span>
                                  <span class="text-indigo-400 font-bold">{clip.duration}s duration</span>
                                </div>

                                {/* AI Selection Reason */}
                                <p class="text-[11px] text-slate-400 line-clamp-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                                  {clip.reason}
                                </p>
                              </div>

                              {/* Card Actions */}
                              <div class="pt-4 border-t border-slate-800 flex flex-wrap gap-2 items-center justify-between mt-3">
                                <button
                                  onClick={() => setSelectedClip(clip)}
                                  class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                                >
                                  <span>✏️ Edit & Preview</span>
                                </button>

                                <div class="flex items-center space-x-1.5">
                                  <button
                                    onClick={() => handleRenderSingleClip(clip.id)}
                                    disabled={isClipperBusy}
                                    class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/30 transition"
                                  >
                                    {clip.status === 'ready' ? '⚡ Re-Render' : '⚡ Render 9:16'}
                                  </button>

                                  <button
                                    onClick={() => handleOpenClipInCaptionStudio(clip.id)}
                                    title="Open in Caption Studio for detailed subtitle & style tuning"
                                    class="px-2.5 py-1.5 bg-slate-800 hover:bg-indigo-950 text-indigo-300 border border-slate-700 rounded-lg text-xs font-semibold transition"
                                  >
                                    🎨 Studio
                                  </button>

                                  {clip.exported_video && (
                                    <a
                                      href={`/${clip.exported_video}`}
                                      download
                                      class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition"
                                      title="Download rendered vertical MP4"
                                    >
                                      ⬇️
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* SELECTED CLIP INSPECTOR & SMART REFRAMING CONTROLS */}
                      {selectedClip && (
                        <div class="bg-slate-900 border-2 border-indigo-500/60 rounded-2xl p-6 space-y-6">
                          <div class="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                              <span class="text-[10px] font-black uppercase text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
                                Clip Inspector & Customizer
                              </span>
                              <h3 class="text-base font-bold text-slate-100 mt-1">{selectedClip.title}</h3>
                            </div>

                            <div class="flex items-center space-x-3">
                              <button
                                onClick={() => handleRenderSingleClip(selectedClip.id)}
                                disabled={isClipperBusy}
                                class="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-amber-600 hover:from-indigo-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg transition disabled:opacity-50 flex items-center space-x-2"
                              >
                                <span>⚡ Render Vertical 9:16 Reel</span>
                              </button>
                            </div>
                          </div>

                          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

                            {/* Video Preview Player */}
                            <div class="lg:col-span-5 space-y-3">
                              <div class="aspect-[9/16] bg-black rounded-xl overflow-hidden border border-slate-800 relative flex items-center justify-center max-h-[460px] mx-auto shadow-2xl">
                                {selectedClip.exported_video ? (
                                  <video
                                    src={`/${selectedClip.exported_video}`}
                                    controls
                                    class="w-full h-full object-cover"
                                  />
                                ) : activeClipperProject?.video_path ? (
                                  <video
                                    src={`/${activeClipperProject.video_path}#t=${selectedClip.start_time},${selectedClip.end_time}`}
                                    controls
                                    class="w-full h-full object-contain"
                                  />
                                ) : (
                                  <div class="text-xs text-slate-500">Video preview not available</div>
                                )}
                              </div>
                              <p class="text-center text-[11px] text-slate-500">
                                {selectedClip.exported_video ? '✅ Final Rendered 9:16 Video' : 'Source segment preview (Render to apply 9:16 reframing)'}
                              </p>
                            </div>

                            {/* Editing Controls */}
                            <div class="lg:col-span-7 space-y-5">

                              {/* Timestamps Trimming Controls */}
                              <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                                <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                  Trim & Timecode Fine-Tuning
                                </h4>
                                <div class="grid grid-cols-2 gap-4">
                                  <div>
                                    <label class="block text-[11px] font-bold text-slate-400 mb-1">
                                      Start Time: {selectedClip.start_time.toFixed(1)}s
                                    </label>
                                    <div class="flex items-center space-x-2">
                                      <button
                                        onClick={() => handleUpdateSelectedClip({ start_time: Math.max(0, selectedClip.start_time - 1) })}
                                        class="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs font-mono hover:bg-slate-700"
                                      >-1s</button>
                                      <button
                                        onClick={() => handleUpdateSelectedClip({ start_time: selectedClip.start_time + 1 })}
                                        class="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs font-mono hover:bg-slate-700"
                                      >+1s</button>
                                      <input
                                        type="number"
                                        step="0.5"
                                        value={selectedClip.start_time}
                                        onChange={(e) => handleUpdateSelectedClip({ start_time: parseFloat(e.target.value) || 0 })}
                                        class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 font-mono"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label class="block text-[11px] font-bold text-slate-400 mb-1">
                                      End Time: {selectedClip.end_time.toFixed(1)}s ({selectedClip.duration}s dur)
                                    </label>
                                    <div class="flex items-center space-x-2">
                                      <button
                                        onClick={() => handleUpdateSelectedClip({ end_time: Math.max(selectedClip.start_time + 5, selectedClip.end_time - 1) })}
                                        class="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs font-mono hover:bg-slate-700"
                                      >-1s</button>
                                      <button
                                        onClick={() => handleUpdateSelectedClip({ end_time: selectedClip.end_time + 1 })}
                                        class="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs font-mono hover:bg-slate-700"
                                      >+1s</button>
                                      <input
                                        type="number"
                                        step="0.5"
                                        value={selectedClip.end_time}
                                        onChange={(e) => handleUpdateSelectedClip({ end_time: parseFloat(e.target.value) || 0 })}
                                        class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 font-mono"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Smart Reframing Mode & Caption Template */}
                              <div class="grid grid-cols-2 gap-4">
                                <div>
                                  <label class="block text-xs font-bold text-slate-400 mb-1.5">
                                    9:16 Smart Reframing Treatment
                                  </label>
                                  <select
                                    value={selectedClip.reframing_mode || 'blur_background'}
                                    onChange={(e) => handleUpdateSelectedClip({ reframing_mode: e.target.value })}
                                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200"
                                  >
                                    <option value="blur_background">🎬 Blurred Studio Backdrop (Podcast Standard)</option>
                                    <option value="center_crop">🎯 Smart Center Crop (Full 9:16 Scale)</option>
                                    <option value="split_screen">👥 Split-Screen (Top & Bottom Interview)</option>
                                  </select>
                                </div>

                                <div>
                                  <label class="block text-xs font-bold text-slate-400 mb-1.5">
                                    Animated Caption Style
                                  </label>
                                  <select
                                    value={selectedClip.caption_template || 'word-pop'}
                                    onChange={(e) => handleUpdateSelectedClip({ caption_template: e.target.value })}
                                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200"
                                  >
                                    {CAPTION_TEMPLATES.map(t => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Transcript Subtitle Text Editor */}
                              <div class="space-y-2">
                                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                                  Transcript & Caption Text
                                </label>
                                <div class="max-h-48 overflow-y-auto space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800 custom-scrollbar text-xs">
                                  {selectedClip.transcript_segments && selectedClip.transcript_segments.map((seg, sIdx) => (
                                    <div key={sIdx} class="flex items-start space-x-2">
                                      <span class="text-[10px] font-mono text-indigo-400 pt-1 shrink-0">
                                        {seg.start ? seg.start.toFixed(1) : 0}s:
                                      </span>
                                      <input
                                        type="text"
                                        value={seg.text}
                                        onChange={(e) => {
                                          const updatedSegments = [...selectedClip.transcript_segments];
                                          updatedSegments[sIdx] = { ...updatedSegments[sIdx], text: e.target.value };
                                          handleUpdateSelectedClip({ transcript_segments: updatedSegments });
                                        }}
                                        class="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded px-2 py-1 text-slate-200 focus:outline-none"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>

                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                </div>
              )}
"""

target_pos = content.find("{/* ===================== TAB 1: CAPTION STUDIO ===================== */}")
if target_pos != -1:
    content = content[:target_pos] + clipper_markup + "\n              " + content[target_pos:]
    print("Clipper markup inserted successfully before Tab 1!")
else:
    print("WARNING: Tab 1 marker not found")

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Index.html markup patched successfully!")
