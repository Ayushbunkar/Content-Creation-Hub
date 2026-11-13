import re

with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Navigation items list
nav_target = """                {[
                  { id: 'captions', label: 'Caption Studio', badge: 'New', icon: 'type' },"""

nav_replacement = """                {[
                  { id: 'clipper', label: 'AI Viral Clipper', badge: 'Viral 🔥', icon: 'scissors' },
                  { id: 'captions', label: 'Caption Studio', badge: 'Pro', icon: 'type' },"""

if nav_target in content:
    content = content.replace(nav_target, nav_replacement)
    print("1. Nav items updated successfully!")
else:
    print("WARNING: Nav target not found")

# 2. Update Header Title
header_target = "{currentTab === 'captions' ? 'Caption Studio — Video & Animated Subtitles' : currentTab.toUpperCase()}"
header_replacement = "{currentTab === 'clipper' ? 'AI Viral Clipper — YouTube & Podcast Auto-Shorts' : currentTab === 'captions' ? 'Caption Studio — Video & Animated Subtitles' : currentTab.toUpperCase()}"

if header_target in content:
    content = content.replace(header_target, header_replacement)
    print("2. Header title updated successfully!")
else:
    print("WARNING: Header target not found")

# 3. Add Clipper State & Handlers
state_target = "const [outputClips, setOutputClips] = useState([]);"

clipper_state_code = """const [outputClips, setOutputClips] = useState([]);

      // ================= AI VIRAL CLIPPER STATE ================= //
      const [clipperProjects, setClipperProjects] = useState([]);
      const [activeClipperProject, setActiveClipperProject] = useState(null);
      const [clipperClips, setClipperClips] = useState([]);
      const [selectedClip, setSelectedClip] = useState(null);
      const [clipperFilter, setClipperFilter] = useState('all'); // all, viral, category
      const [clipperCategoryFilter, setClipperCategoryFilter] = useState('all');

      // Clipper Input Form State
      const [clipperSourceType, setClipperSourceType] = useState('youtube'); // youtube, upload, local
      const [clipperUrl, setClipperUrl] = useState('');
      const [clipperTargetDuration, setClipperTargetDuration] = useState('30-60'); // 15-30, 30-60, 60-90
      const [clipperClipCount, setClipperClipCount] = useState(5);
      const [clipperLanguage, setClipperLanguage] = useState('auto');
      const [clipperSelectedLocal, setClipperSelectedLocal] = useState('');

      // Clipper Processing & Progress State
      const [isClipperBusy, setIsClipperBusy] = useState(false);
      const [clipperStage, setClipperStage] = useState(''); // downloading, extracting, transcribing, detecting, ready, rendering
      const [clipperProgress, setClipperProgress] = useState(0);
      const [clipperStatusMessage, setClipperStatusMessage] = useState('');
      const [clipperError, setClipperError] = useState(null);
      const [isBatchRendering, setIsBatchRendering] = useState(false);

      // Fetch all Clipper projects
      const fetchClipperProjects = async () => {
        try {
          const res = await fetch('/api/clipper/projects');
          const data = await res.json();
          setClipperProjects(data);
          if (data.length > 0 && !activeClipperProject) {
            loadClipperProject(data[0].id);
          }
        } catch (e) { console.error('Error fetching clipper projects:', e); }
      };

      // Load specific Clipper project and its clips
      const loadClipperProject = async (id) => {
        try {
          const res = await fetch(`/api/clipper/projects/${id}`);
          const data = await res.json();
          setActiveClipperProject(data);
          setClipperClips(data.clips || []);
          if (data.clips && data.clips.length > 0) {
            setSelectedClip(data.clips[0]);
          } else {
            setSelectedClip(null);
          }
          if (data.status === 'ready') {
            setIsClipperBusy(false);
            setClipperStage('ready');
          } else if (data.status === 'failed') {
            setIsClipperBusy(false);
            setClipperError(data.error_message || 'Processing failed');
          } else {
            setIsClipperBusy(true);
            setClipperStage(data.status);
            setClipperProgress(data.progress || 20);
          }
        } catch (e) { console.error('Error loading clipper project:', e); }
      };

      // Start new clipping project from YouTube URL or Local File
      const handleCreateClipperProject = async () => {
        if (clipperSourceType === 'youtube' && !clipperUrl.trim()) {
          alert('Please enter a valid YouTube or Podcast URL');
          return;
        }
        if (clipperSourceType === 'local' && !clipperSelectedLocal) {
          alert('Please select a local video from the list');
          return;
        }

        setIsClipperBusy(true);
        setClipperError(null);
        setClipperStage(clipperSourceType === 'youtube' ? 'downloading' : 'extracting');
        setClipperProgress(10);
        setClipperStatusMessage('Initializing source ingestion...');

        try {
          const body = {
            sourceType: clipperSourceType,
            url: clipperSourceType === 'youtube' ? clipperUrl.trim() : null,
            localPath: clipperSourceType === 'local' ? clipperSelectedLocal : null,
            targetDuration: clipperTargetDuration,
            clipCountTarget: parseInt(clipperClipCount, 10),
            language: clipperLanguage
          };

          const res = await fetch('/api/clipper/projects/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const data = await res.json();
          if (data.error) {
            setIsClipperBusy(false);
            setClipperError(data.error);
            alert('Clipper error: ' + data.error);
            return;
          }

          await fetchClipperProjects();
          if (data.id) {
            loadClipperProject(data.id);
          }
        } catch (err) {
          setIsClipperBusy(false);
          setClipperError(err.message);
          alert('Failed to start clipper: ' + err.message);
        }
      };

      // Upload local video for clipping
      const handleClipperFileUpload = (file) => {
        if (!file) return;
        setIsClipperBusy(true);
        setClipperError(null);
        setClipperStage('downloading');
        setClipperProgress(15);
        setClipperStatusMessage(`Uploading "${file.name}" to local studio...`);

        const xhr = new XMLHttpRequest();
        const url = `/api/clipper/upload?filename=${encodeURIComponent(file.name)}`;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 60);
            setClipperProgress(15 + pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              fetchClipperProjects();
              if (res.id) loadClipperProject(res.id);
            } catch (err) {
              setClipperError('Failed to parse upload response: ' + err.message);
              setIsClipperBusy(false);
            }
          } else {
            setClipperError('Upload failed with status ' + xhr.status);
            setIsClipperBusy(false);
          }
        };

        xhr.onerror = () => {
          setClipperError('Network error uploading video');
          setIsClipperBusy(false);
        };

        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(file);
      };

      // Update selected clip parameters
      const handleUpdateSelectedClip = async (updates) => {
        if (!selectedClip) return;
        try {
          const res = await fetch(`/api/clipper/clips/${selectedClip.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          });
          const data = await res.json();
          if (data.clip) {
            setSelectedClip(data.clip);
            setClipperClips(prev => prev.map(c => c.id === data.clip.id ? data.clip : c));
          }
        } catch (e) { console.error('Error updating clip:', e); }
      };

      // Render a single clip to vertical 9:16
      const handleRenderSingleClip = async (clipId) => {
        const id = clipId || selectedClip?.id;
        if (!id) return;
        setIsClipperBusy(true);
        setClipperStatusMessage('Rendering vertical 9:16 reel with smart reframing & animated captions...');
        try {
          const res = await fetch(`/api/clipper/clips/${id}/render`, { method: 'POST' });
          const data = await res.json();
          setIsClipperBusy(false);
          if (data.success && activeClipperProject) {
            loadClipperProject(activeClipperProject.id);
          } else if (data.error) {
            alert('Render failed: ' + data.error);
          }
        } catch (e) {
          setIsClipperBusy(false);
          alert('Render error: ' + e.message);
        }
      };

      // Batch render all clips
      const handleBatchRenderClips = async () => {
        if (!activeClipperProject) return;
        if (!confirm(`Batch render all ${clipperClips.length} clips to vertical 9:16 Reels?`)) return;
        setIsBatchRendering(true);
        setIsClipperBusy(true);
        setClipperStatusMessage(`Batch rendering ${clipperClips.length} clips in parallel...`);
        try {
          const res = await fetch(`/api/clipper/projects/${activeClipperProject.id}/batch-render`, { method: 'POST' });
          const data = await res.json();
          setIsBatchRendering(false);
          setIsClipperBusy(false);
          loadClipperProject(activeClipperProject.id);
          alert(`Batch render complete! ${data.results ? data.results.length : 0} vertical reels exported.`);
        } catch (e) {
          setIsBatchRendering(false);
          setIsClipperBusy(false);
          alert('Batch render error: ' + e.message);
        }
      };

      // 1-Click Bridge to open clip in Caption Studio
      const handleOpenClipInCaptionStudio = async (clipId) => {
        try {
          const res = await fetch(`/api/clipper/clips/${clipId}/open-in-caption-studio`, { method: 'POST' });
          const data = await res.json();
          if (data.captionProject) {
            await fetchCaptionProjects();
            selectCaptionProject(data.captionProject);
            setCurrentTab('captions');
          } else if (data.error) {
            alert('Could not bridge to Caption Studio: ' + data.error);
          }
        } catch (e) {
          alert('Error: ' + e.message);
        }
      };"""

if state_target in content:
    content = content.replace(state_target, clipper_state_code)
    print("3. Clipper state & handlers added successfully!")
else:
    print("WARNING: State target not found")

# 4. Add fetchClipperProjects and WS listener in useEffect
ws_target = """            } else if (msg.type === 'CAPTION_STUDIO_UPDATE') {"""
ws_addition = """            } else if (msg.type === 'CLIPPER_UPDATE') {
              fetchClipperProjects();
              if (msg.data.stage) {
                setClipperStage(msg.data.stage);
                if (msg.data.progress) setClipperProgress(msg.data.progress);
                if (msg.data.message) setClipperStatusMessage(msg.data.message);
                if (msg.data.stage === 'ready' && activeClipperProject) {
                  loadClipperProject(activeClipperProject.id);
                  setIsClipperBusy(false);
                }
              }
              if (msg.data.status === 'ready' && activeClipperProject) {
                loadClipperProject(activeClipperProject.id);
              }
            } else if (msg.type === 'CAPTION_STUDIO_UPDATE') {"""

if ws_target in content:
    content = content.replace(ws_target, ws_addition)
    print("4. WebSocket CLIPPER_UPDATE listener added successfully!")
else:
    print("WARNING: WS target not found")

use_effect_target = """      useEffect(() => {
        fetchProjects();
        fetchCurated();
        fetchCaptionProjects();
        fetchOutputClips();"""

use_effect_replacement = """      useEffect(() => {
        fetchProjects();
        fetchCurated();
        fetchCaptionProjects();
        fetchOutputClips();
        fetchClipperProjects();"""

if use_effect_target in content:
    content = content.replace(use_effect_target, use_effect_replacement)
    print("5. fetchClipperProjects called in useEffect successfully!")
else:
    print("WARNING: useEffect target not found")

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Index.html core script patched successfully!")
