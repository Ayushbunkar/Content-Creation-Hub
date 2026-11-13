import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
  Img,
  staticFile,
} from "remotion";
import { AudioTrackGroup } from "../audio/AudioTrack";
import { FC, useMemo } from "react";

export interface SubtitleCueData {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
}

export type VisualShotType =
  | 'archival_photo'
  | 'person_intro'
  | 'newspaper_headline'
  | 'tactical_map'
  | 'data_metric'
  | 'investigative_evidence'
  | 'comparison_split'
  | 'layered_parallax'
  | 'cinematic_hook'
  | 'video_footage'
  | 'archival_document'
  | 'ai_video';

export type CameraMovement =
  | 'dolly_in'
  | 'dolly_out'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'aerial_zoom'
  | 'tracking_forward'
  | 'orbit'
  | 'static';

export interface CinematicSceneData {
  id: string;
  type: VisualShotType;
  badge?: string;
  mediaUrl?: string;
  cameraMovement?: CameraMovement;
  transition?: 'fade' | 'crossfade' | 'whip_pan' | 'zoom_in' | 'cut' | 'slide';
  title: string;
  subtitle?: string;
  location?: string;
  coordinates?: string;
  narration?: string;
  startFrame: number;
  durationFrames: number;
  layers?: {
    background?: string;
    middle?: string;
    foreground?: string;
    particles?: 'dust_motes' | 'embers' | 'light_leaks' | 'film_grain' | 'none';
  };
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
  archivalData?: {
    headline: string;
    publication: string;
    date: string;
    snippet: string;
    highlightPhrase?: string;
  };
  visualData?: {
    region?: string;
    targetName?: string;
    statNumber?: string;
    statLabel?: string;
    statSubtext?: string;
    coordinates?: string;
    highlightedEntities?: string[];
    routes?: Array<{ from: [number, number]; to: [number, number]; label?: string }>;
    markers?: Array<{ name: string; x: number; y: number; type?: 'chokepoint' | 'capital' | 'base' | 'port' }>;
  };
}

export interface CinematicDocumentaryProps {
  title?: string;
  subtitle?: string;
  category?: string;
  topic?: string;
  narrationSrc?: string;
  musicSrc?: string;
  subtitlesData?: { cues: SubtitleCueData[] };
  captionTemplate?: string;
  scenes?: CinematicSceneData[];
  durationInFrames?: number;
}

// ==========================================
// 1. CINEMATIC FILM POST-PROCESSING
// ==========================================
const FilmPostProcessing: FC<{ width: number; height: number; frame: number }> = ({ width, height, frame }) => {
  const grainOpacity = 0.05 + ((frame % 3) * 0.015);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 90 }}>
      {/* 35mm Fine Photographic Grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: grainOpacity,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)`,
          backgroundSize: '4px 4px',
          mixBlendMode: 'overlay',
        }}
      />

      {/* Cinematic Radial Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 48%, rgba(2, 6, 23, 0.75) 92%, #010409 100%)',
        }}
      />

      {/* Anamorphic Letterbox Matte Bars */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${Math.round(height * 0.045)}px`,
          backgroundColor: '#000000',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${Math.round(height * 0.045)}px`,
          backgroundColor: '#000000',
        }}
      />
    </AbsoluteFill>
  );
};

// ==========================================
// 2. FLOATING PARTICLES & LIGHT LEAKS
// ==========================================
const FloatingParticleField: FC<{ frame: number; type?: string }> = ({ frame, type = 'dust_motes' }) => {
  if (type === 'none') return null;

  const particles = useMemo(() => {
    return Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      x: ((i * 137.5) % 100),
      baseY: ((i * 73.1) % 100),
      size: (i % 3) + 2,
      speed: 0.15 + ((i % 5) * 0.05),
      opacity: 0.25 + ((i % 4) * 0.15),
    }));
  }, []);

  const flareX = interpolate(frame % 140, [0, 140], [-80, 110]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 30, overflow: 'hidden' }}>
      {type === 'light_leaks' && (
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: `${flareX}%`,
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.14) 0%, rgba(245, 158, 11, 0.08) 50%, transparent 75%)',
            filter: 'blur(45px)',
            mixBlendMode: 'screen',
          }}
        />
      )}

      {particles.map((p) => {
        const currentY = (p.baseY - (frame * p.speed)) % 100;
        const normalizedY = currentY < 0 ? currentY + 100 : currentY;
        const shimmer = Math.sin((frame + p.id * 10) * 0.05) * 0.2 + p.opacity;

        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${normalizedY}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              borderRadius: '50%',
              backgroundColor: type === 'embers' ? '#f59e0b' : '#ffffff',
              opacity: Math.max(0.05, Math.min(0.9, shimmer)),
              boxShadow: type === 'embers' ? '0 0 8px #f59e0b' : '0 0 6px rgba(255, 255, 255, 0.5)',
              filter: 'blur(0.5px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ==========================================
// 3. TACTICAL VIEWFINDER & TIME-CODE OVERLAY
// ==========================================
const TacticalHudOverlay: FC<{
  frame: number;
  topic: string;
  category: string;
  activeScene?: CinematicSceneData;
}> = ({ frame, topic, category, activeScene }) => {
  const isBlink = Math.floor(frame / 20) % 2 === 0;
  const totalSecs = Math.floor(frame / 30);
  const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
  const s = (totalSecs % 60).toString().padStart(2, '0');
  const f = (frame % 30).toString().padStart(2, '0');
  const timecode = `00:${m}:${s}:${f}`;

  const coords = activeScene?.coordinates || "37°46'29\"N // 122°25'10\"W";
  const badgeText = activeScene?.badge || '[Documentary Record]';

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 75, padding: '34px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: isBlink ? '#ef4444' : '#7f1d1d',
              boxShadow: isBlink ? '0 0 10px #ef4444' : 'none',
            }}
          />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 700, color: '#f8fafc', letterSpacing: '1px' }}>
            REC [{timecode}]
          </span>
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)', textTransform: 'uppercase' }}>
            {badgeText}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#94a3b8', letterSpacing: '1px' }}>
            LOC: {coords}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#f59e0b', fontWeight: 800 }}>
            4K ARCHIVAL
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// 4. FAST SHIFT KINETIC TRANSITION WRAPPER
// ==========================================
const FastShiftSceneWrapper: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
  children: React.ReactNode;
}> = ({ scene, sceneFrame, durationFrames, children }) => {
  const sceneNum = typeof scene.id === 'number' ? scene.id : (parseInt(String(scene.id).replace(/\D/g, '') || '0', 10));
  const shiftMode = sceneNum % 4; // 0 = Punch Zoom, 1 = Whip Left, 2 = Whip Right, 3 = Tilt Drop

  // Kinetic camera punch on cut (Vox / Johnny Harris snap cut)
  const punchScale = interpolate(sceneFrame, [0, 5, 12], [shiftMode === 0 ? 1.08 : 1.05, 1.015, 1.0], {
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  let whipX = 0;
  let whipY = 0;
  if (shiftMode === 1) {
    whipX = interpolate(sceneFrame, [0, 7], [-40, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  } else if (shiftMode === 2) {
    whipX = interpolate(sceneFrame, [0, 7], [40, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  } else if (shiftMode === 3) {
    whipY = interpolate(sceneFrame, [0, 8], [-30, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  }

  const motionBlur = interpolate(sceneFrame, [0, 2, 6], [3.0, 1.0, 0], { extrapolateRight: 'clamp' });
  const flashOpacity = interpolate(sceneFrame, [0, 2, 5], [0.35, 0.12, 0], { extrapolateRight: 'clamp' });
  const chromaticShift = interpolate(sceneFrame, [0, 4], [2.0, 0], { extrapolateRight: 'clamp' });

  // Organic handheld float across shot
  const driftX = Math.sin(sceneFrame * 0.04 + sceneNum) * 3.5;
  const driftY = Math.cos(sceneFrame * 0.035 + sceneNum) * 2.5;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${punchScale}) translate(${whipX + driftX}px, ${whipY + driftY}px)`,
        filter: motionBlur > 0.1
          ? `blur(${motionBlur}px) ${chromaticShift > 0.3 ? `drop-shadow(${chromaticShift}px 0 rgba(239, 68, 68, 0.4)) drop-shadow(-${chromaticShift}px 0 rgba(56, 189, 248, 0.4))` : ''}`
          : undefined,
        transformOrigin: 'center center',
      }}
    >
      {children}

      {/* 35mm optical cut flash */}
      {flashOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            background: 'radial-gradient(circle at center, rgba(255, 250, 235, 0.45) 0%, rgba(245, 158, 11, 0.12) 50%, transparent 80%)',
            opacity: flashOpacity,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// Helper for subpixel Ken Burns transforms
const getCameraTransform = (movement: CameraMovement = 'dolly_in', sceneFrame: number, durationFrames: number) => {
  const p = interpolate(sceneFrame, [0, durationFrames], [0, 1], {
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    extrapolateRight: 'clamp',
  });

  switch (movement) {
    case 'dolly_in': return `scale(${interpolate(p, [0, 1], [1.02, 1.15])})`;
    case 'dolly_out': return `scale(${interpolate(p, [0, 1], [1.15, 1.02])})`;
    case 'pan_left': return `scale(1.10) translateX(${interpolate(p, [0, 1], [25, -25])}px)`;
    case 'pan_right': return `scale(1.10) translateX(${interpolate(p, [0, 1], [-25, 25])}px)`;
    case 'tilt_up': return `scale(1.10) translateY(${interpolate(p, [0, 1], [20, -20])}px)`;
    case 'tilt_down': return `scale(1.10) translateY(${interpolate(p, [0, 1], [-20, 20])}px)`;
    case 'tracking_forward': return `scale(${interpolate(p, [0, 1], [1.03, 1.12])}) translateY(${interpolate(p, [0, 1], [8, -6])}px)`;
    case 'aerial_zoom': return `scale(${interpolate(p, [0, 1], [1.18, 1.04])})`;
    default: return `scale(${interpolate(p, [0, 1], [1.02, 1.08])})`;
  }
};

const resolveMediaSrc = (url?: string, fallback = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=85') => {
  const raw = url || fallback;
  return (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:'))
    ? raw
    : staticFile(raw.replace(/^\//, ''));
};

// ==========================================
// 5. COMPONENT 1: PERSON INTRODUCTION
// ==========================================
const PersonIntroScene: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
}> = ({ scene, sceneFrame, durationFrames }) => {
  const transform = getCameraTransform(scene.cameraMovement || 'dolly_in', sceneFrame, durationFrames);
  const mediaSrc = resolveMediaSrc(scene.mediaUrl, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1920&q=85');

  const pData = scene.personData || {
    name: scene.title.toUpperCase(),
    title: scene.subtitle || 'STRATEGIC FIGURE // KEYNOTE DOSSIER',
    organization: scene.location || 'EXECUTIVE LEADERSHIP',
    location: 'EXECUTIVE INTELLIGENCE'
  };

  const nameEnter = interpolate(sceneFrame, [0, 14], [-40, 0], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });
  const opacity = interpolate(sceneFrame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#020617', overflow: 'hidden' }}>
      {/* High-Resolution Portrait with Ken Burns Push */}
      <div style={{ position: 'absolute', inset: 0, transform, transformOrigin: 'center 35%' }}>
        <Img
          src={mediaSrc}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.12) brightness(0.92) saturate(1.1)' }}
        />
      </div>

      {/* Dark Lower Gradient for Legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(2, 6, 23, 0.95) 0%, rgba(2, 6, 23, 0.6) 35%, transparent 70%)',
        }}
      />

      {/* Broadcast Lower-Third Nameplate */}
      <div
        style={{
          position: 'absolute',
          bottom: '80px',
          left: '60px',
          transform: `translateX(${nameEnter}px)`,
          opacity,
          zIndex: 45,
          maxWidth: '850px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ width: '4px', height: '18px', backgroundColor: '#f59e0b' }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, color: '#f59e0b', letterSpacing: '2px', textTransform: 'uppercase' }}>
            {pData.organization}
          </span>
        </div>

        <div
          style={{
            background: 'rgba(10, 17, 34, 0.92)',
            backdropFilter: 'blur(16px)',
            padding: '16px 24px',
            borderRadius: '10px',
            borderLeft: '4px solid #38bdf8',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.85)',
          }}
        >
          <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: '36px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            {pData.name}
          </h1>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#94a3b8', margin: '6px 0 0 0', letterSpacing: '0.5px' }}>
            {pData.title}
          </p>
        </div>
      </div>

      <FloatingParticleField frame={sceneFrame} type="dust_motes" />
    </AbsoluteFill>
  );
};

// ==========================================
// 6. COMPONENT 2: NEWSPAPER & HEADLINES
// ==========================================
const NewspaperHeadlineScene: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
}> = ({ scene, sceneFrame, durationFrames }) => {
  const news = scene.newspaperData || {
    headline: scene.title.toUpperCase(),
    publication: 'THE WALL STREET JOURNAL',
    date: 'NOVEMBER 2026 // SPECIAL INVESTIGATION',
    snippet: scene.narration || 'Developing corporate and geopolitical investigation commands international scrutiny.'
  };

  const camZoom = interpolate(sceneFrame, [0, durationFrames], [1.02, 1.12], { easing: Easing.out(Easing.quad) });
  const highlightWidth = interpolate(sceneFrame, [12, 45], [0, 100], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* Background Ambience */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.6) 0%, #030712 90%)' }} />

      {/* Newspaper Page Container */}
      <div
        style={{
          width: '940px',
          minHeight: '520px',
          backgroundColor: '#f5f0e6',
          backgroundImage: 'radial-gradient(#ded4c1 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          borderRadius: '4px',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9)',
          padding: '44px 56px',
          color: '#1a1815',
          transform: `scale(${camZoom})`,
          position: 'relative',
        }}
      >
        {/* Newspaper Masthead */}
        <div style={{ borderBottom: '3px double #1a1815', paddingBottom: '14px', marginBottom: '22px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>
            {news.publication}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#665e52', letterSpacing: '1.5px', marginTop: '4px' }}>
            WORLD EXCLUSIVE • {news.date || 'NOVEMBER 2026'}
          </div>
        </div>

        {/* Massive Headline */}
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '42px', fontWeight: 900, lineHeight: 1.15, margin: '0 0 20px 0', letterSpacing: '-0.5px' }}>
          {news.headline}
        </h1>

        {/* Article Excerpt */}
        <p style={{ fontFamily: "'Georgia', serif", fontSize: '19px', lineHeight: 1.6, color: '#2d2822', margin: '0 0 24px 0' }}>
          {news.snippet}
        </p>

        {/* Animated Yellow Highlighter Sweep */}
        <div style={{ position: 'relative', display: 'inline-block', margin: '6px 0' }}>
          <span
            style={{
              position: 'absolute',
              top: '2px',
              bottom: '2px',
              left: 0,
              width: `${highlightWidth}%`,
              backgroundColor: 'rgba(250, 204, 21, 0.7)',
              borderRadius: '2px',
              mixBlendMode: 'multiply',
              zIndex: 1,
            }}
          />
          <span style={{ position: 'relative', zIndex: 2, fontFamily: "'Georgia', serif", fontSize: '20px', fontWeight: 700, fontStyle: 'italic', color: '#0f172a' }}>
            "{scene.subtitle || news.headline}"
          </span>
        </div>

        {/* Stamp / Verification Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '36px',
            right: '48px',
            border: '3px solid #b91c1c',
            borderRadius: '4px',
            padding: '6px 16px',
            color: '#b91c1c',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '18px',
            fontWeight: 900,
            letterSpacing: '2px',
            transform: 'rotate(-8deg)',
          }}
        >
          VERIFIED DISPATCH
        </div>
      </div>

      <FloatingParticleField frame={sceneFrame} type="dust_motes" />
    </AbsoluteFill>
  );
};

// ==========================================
// 7. COMPONENT 3: ARCHIVAL & DOCUMENTARY PHOTOGRAPH
// ==========================================
const ArchivalPhotoScene: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
}> = ({ scene, sceneFrame, durationFrames }) => {
  const transform = getCameraTransform(scene.cameraMovement || 'dolly_in', sceneFrame, durationFrames);
  const mediaSrc = resolveMediaSrc(scene.mediaUrl);

  return (
    <AbsoluteFill style={{ backgroundColor: '#020617', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '-2%', transform, transformOrigin: 'center center' }}>
        <Img
          src={mediaSrc}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.15) brightness(0.92) saturate(1.12)' }}
        />
      </div>

      {/* Catalog & Date Badge in Corner */}
      <div style={{ position: 'absolute', bottom: '70px', right: '50px', zIndex: 40, display: 'flex', gap: '8px' }}>
        <div style={{ backgroundColor: 'rgba(10, 15, 26, 0.85)', backdropFilter: 'blur(8px)', padding: '6px 14px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#94a3b8', letterSpacing: '1px' }}>
            ARCHIVE LOG: [HISTORICAL RECORD]
          </span>
        </div>
      </div>

      <FloatingParticleField frame={sceneFrame} type="dust_motes" />
    </AbsoluteFill>
  );
};

// ==========================================
// 8. COMPONENT 4: TACTICAL VECTOR MAP
// ==========================================
const TacticalMapScene: FC<{ scene: CinematicSceneData; sceneFrame: number }> = ({ scene, sceneFrame }) => {
  const camZoom = interpolate(sceneFrame, [0, 240], [1.0, 1.12], { easing: Easing.out(Easing.quad) });
  const pulseRadius = (sceneFrame % 60) * 3.5;
  const pulseOpacity = interpolate(sceneFrame % 60, [0, 60], [0.9, 0]);
  const dashOffset = -(sceneFrame * 2.5);

  return (
    <AbsoluteFill style={{ backgroundColor: '#060a12', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${camZoom})`, transformOrigin: '55% 50%' }}>
        <svg viewBox="0 0 1920 1080" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#08101e" />
              <stop offset="100%" stopColor="#04070d" />
            </linearGradient>

            <pattern id="tacticalGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(56, 189, 248, 0.05)" strokeWidth="1" />
              <circle cx="30" cy="30" r="1" fill="rgba(56, 189, 248, 0.15)" />
            </pattern>
          </defs>

          <rect width="1920" height="1080" fill="url(#oceanGrad)" />
          <rect width="1920" height="1080" fill="url(#tacticalGrid)" />

          {/* Regional Landmass Contours */}
          <g fill="#162235" stroke="#253852" strokeWidth="1.5">
            <path d="M 520,180 L 740,160 L 980,180 L 1150,220 L 1320,320 L 1260,420 L 1120,440 L 960,420 L 820,380 L 680,320 L 560,260 Z" />
            <path d="M 500,480 L 720,490 L 880,510 L 980,560 L 1080,680 L 980,820 L 760,860 L 580,780 L 480,620 Z" />
            <path d="M 960,480 L 990,450 L 1020,480 L 980,520 Z" fill="#1e324a" stroke="#38bdf8" strokeWidth="2" />
          </g>

          {/* Glowing Corridors */}
          <path
            d="M 620,360 Q 820,410 980,455 T 1280,560"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="4"
            strokeDasharray="12 8"
            strokeDashoffset={dashOffset}
            style={{ filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.8))' }}
          />

          {/* Strategic Target Pulse Rings */}
          <circle cx="985" cy="455" r={pulseRadius} fill="none" stroke="#ef4444" strokeWidth="2" opacity={pulseOpacity} />
          <circle cx="985" cy="455" r="7" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 10px #ef4444)' }} />

          {/* Location Callout Pin */}
          <g transform="translate(1010, 430)">
            <rect x="0" y="0" width="200" height="34" rx="4" fill="rgba(15, 23, 42, 0.9)" stroke="#ef4444" strokeWidth="1.5" />
            <text x="12" y="22" fill="#ffffff" fontFamily="'JetBrains Mono', monospace" fontSize="13" fontWeight="bold">
              {scene.visualData?.targetName || 'STRATEGIC THEATER'}
            </text>
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// 9. COMPONENT 5: DATA METRICS & NUMBERS
// ==========================================
const DataMetricScene: FC<{ scene: CinematicSceneData; sceneFrame: number }> = ({ scene, sceneFrame }) => {
  const statVal = scene.visualData?.statNumber || "$3.2 TRILLION";
  const statLabel = scene.visualData?.statLabel || "GLOBAL ECONOMIC VALUATION";
  const statSub = scene.visualData?.statSubtext || scene.narration || "Disruptions at this level reverberate instantaneously across worldwide technology markets.";

  const barWidth = interpolate(sceneFrame, [10, 55], [0, 85], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });
  const bgSrc = resolveMediaSrc(scene.mediaUrl);
  const zoom = interpolate(sceneFrame, [0, 240], [1.02, 1.12], { easing: Easing.out(Easing.quad) });

  return (
    <AbsoluteFill style={{ backgroundColor: '#070b14', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* Darkened Photographic Backdrop */}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, filter: 'brightness(0.22) contrast(1.25) blur(2.5px) saturate(1.2)' }}>
        <Img src={bgSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      {/* Vignette & Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at center, transparent 30%, rgba(3, 7, 18, 0.92) 85%),
            linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 72px 72px, 72px 72px',
        }}
      />

      <div style={{ maxWidth: '1050px', textAlign: 'center', padding: '0 40px', zIndex: 10 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 800, color: '#38bdf8', letterSpacing: '3px', textTransform: 'uppercase', display: 'block', marginBottom: '16px' }}>
          GLOBAL STRATEGIC IMPACT METRIC
        </span>

        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '92px',
            fontWeight: 900,
            letterSpacing: '-2px',
            background: 'linear-gradient(135deg, #ffffff 40%, #f59e0b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.05,
            marginBottom: '14px',
            filter: 'drop-shadow(0 10px 35px rgba(245, 158, 11, 0.45))',
          }}
        >
          {statVal}
        </div>

        <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '24px', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 20px 0' }}>
          {statLabel}
        </h3>

        <div style={{ width: '600px', height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: '4px', margin: '0 auto 28px auto', overflow: 'hidden' }}>
          <div style={{ width: `${barWidth}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #f59e0b)', borderRadius: '4px', boxShadow: '0 0 16px rgba(245, 158, 11, 0.8)' }} />
        </div>

        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '18px', fontWeight: 400, color: '#cbd5e1', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
          {statSub}
        </p>
      </div>

      <FloatingParticleField frame={sceneFrame} type="embers" />
    </AbsoluteFill>
  );
};

// ==========================================
// 10. COMPONENT 6: INVESTIGATIVE EVIDENCE DOSSIER
// ==========================================
const InvestigativeEvidenceScene: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
}> = ({ scene, sceneFrame, durationFrames }) => {
  const doc = scene.archivalData || {
    headline: scene.title.toUpperCase(),
    publication: 'COUNTERINTELLIGENCE SPECIAL INQUIRY',
    date: 'TOP SECRET // DECLASSIFIED RECORD',
    snippet: scene.narration || 'Under sovereign protocol, corporate oversight and national security standards remain under formal review.',
    highlightPhrase: scene.subtitle || 'Classified Intelligence Review'
  };

  const camZoom = interpolate(sceneFrame, [0, durationFrames], [1.02, 1.10]);
  const highlightWidth = interpolate(sceneFrame, [15, 50], [0, 100], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' });
  const stampProgress = interpolate(sceneFrame, [22, 34], [0, 1], { easing: Easing.out(Easing.back(1.5)), extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0f17', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div
        style={{
          width: '920px',
          minHeight: '520px',
          backgroundColor: '#f4ede2',
          backgroundImage: 'radial-gradient(#e6dab8 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          borderRadius: '4px',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.85)',
          padding: '48px 56px',
          color: '#1a1815',
          transform: `scale(${camZoom})`,
          position: 'relative',
        }}
      >
        <div style={{ borderBottom: '3px double #1a1815', paddingBottom: '16px', marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 800, letterSpacing: '3px', textTransform: 'uppercase' }}>
            {doc.publication}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#665e52', letterSpacing: '1px', marginTop: '4px' }}>
            SPECIAL DISPATCH • {doc.date}
          </div>
        </div>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '38px', fontWeight: 900, lineHeight: 1.15, margin: '0 0 20px 0' }}>
          {doc.headline}
        </h1>

        <p style={{ fontFamily: "'Georgia', serif", fontSize: '18px', lineHeight: 1.6, color: '#2d2822', margin: '0 0 20px 0' }}>
          {doc.snippet}
        </p>

        {/* Redacted line visualization */}
        <div style={{ display: 'flex', gap: '8px', margin: '14px 0' }}>
          <span style={{ backgroundColor: '#1a1815', color: '#1a1815', padding: '2px 14px', borderRadius: '2px', userSelect: 'none' }}>CLASSIFIED REDACTION</span>
          <span style={{ backgroundColor: '#1a1815', color: '#1a1815', padding: '2px 28px', borderRadius: '2px', userSelect: 'none' }}>REDACTED</span>
        </div>

        {/* Rubber Stamp Slam */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '48px',
            transform: `scale(${interpolate(stampProgress, [0, 1], [2.2, 1.0])}) rotate(-12deg)`,
            opacity: stampProgress,
            border: '4px solid #b91c1c',
            borderRadius: '6px',
            padding: '8px 20px',
            color: '#b91c1c',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '22px',
            fontWeight: 900,
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}
        >
          DE-CLASSIFIED
        </div>
      </div>
      <FloatingParticleField frame={sceneFrame} type="dust_motes" />
    </AbsoluteFill>
  );
};

// ==========================================
// 11. COMPONENT 7: COMPARISON SPLIT SCREEN
// ==========================================
const ComparisonSplitScene: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
}> = ({ scene, sceneFrame, durationFrames }) => {
  const leftSrc = resolveMediaSrc(scene.comparisonData?.leftImage, 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1920&q=85');
  const rightSrc = resolveMediaSrc(scene.comparisonData?.rightImage, 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1920&q=85');

  const driftLeft = interpolate(sceneFrame, [0, durationFrames], [1.02, 1.08]);
  const driftRight = interpolate(sceneFrame, [0, durationFrames], [1.08, 1.02]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#020617', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      {/* Left Entity Side */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRight: '2px solid #38bdf8' }}>
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${driftLeft})` }}>
          <Img src={leftSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(2, 6, 23, 0.9) 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', bottom: '70px', left: '40px', zIndex: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 800, color: '#38bdf8', letterSpacing: '2px' }}>
            {scene.comparisonData?.leftLabel || 'UNITED STATES // ALLIES'}
          </span>
        </div>
      </div>

      {/* Right Entity Side */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderLeft: '2px solid #ef4444' }}>
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${driftRight})` }}>
          <Img src={rightSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(2, 6, 23, 0.9) 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', bottom: '70px', right: '40px', textAlign: 'right', zIndex: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 800, color: '#ef4444', letterSpacing: '2px' }}>
            {scene.comparisonData?.rightLabel || 'COMPETITIVE POWER // CHINA'}
          </span>
        </div>
      </div>

      <FloatingParticleField frame={sceneFrame} type="light_leaks" />
    </AbsoluteFill>
  );
};

// ==========================================
// 12. COMPONENT 8: 2.5D LAYERED PARALLAX
// ==========================================
const LayeredParallaxScene: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
}> = ({ scene, sceneFrame, durationFrames }) => {
  const bgZoom = interpolate(sceneFrame, [0, durationFrames], [1.02, 1.12]);
  const bgPan = interpolate(sceneFrame, [0, durationFrames], [0, -40]);
  const midDriftX = interpolate(sceneFrame, [0, durationFrames], [25, -15]);
  const midScale = interpolate(sceneFrame, [0, durationFrames], [1.02, 1.07]);
  const fgPanX = interpolate(sceneFrame, [0, durationFrames], [-50, 50]);

  const mediaSrc = resolveMediaSrc(scene.mediaUrl);

  return (
    <AbsoluteFill style={{ backgroundColor: '#060a12', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-8%',
          transform: `scale(${bgZoom}) translateX(${bgPan}px)`,
          filter: 'brightness(0.32) contrast(1.2) blur(2px) saturate(1.15)',
        }}
      >
        <Img src={mediaSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at center, transparent 35%, rgba(2, 6, 23, 0.88) 85%),
            linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 64px 64px, 64px 64px',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${midScale}) translateX(${midDriftX}px)`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: '920px',
            backgroundColor: 'rgba(10, 17, 34, 0.92)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderLeft: '5px solid #f59e0b',
            borderRadius: '14px',
            padding: '36px 48px',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(20px)',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 800, color: '#38bdf8', letterSpacing: '2px', textTransform: 'uppercase' }}>
              PARALLAX INTELLIGENCE DOSSIER // {scene.location || 'CONFIDENTIAL'}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              ARCHIVAL SUBJECT
            </span>
          </div>

          <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: '40px', fontWeight: 900, color: '#ffffff', margin: '0', lineHeight: 1.15, letterSpacing: '-0.5px' }}>
            {scene.title}
          </h1>

          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '18px', color: '#cbd5e1', margin: 0, lineHeight: 1.55 }}>
            {scene.narration}
          </p>
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${fgPanX}px)`, zIndex: 15 }}>
        <FloatingParticleField frame={sceneFrame} type="light_leaks" />
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// 13. COMPONENT 9: CINEMATIC OPENING HOOK
// ==========================================
const CinematicHookScene: FC<{ scene: CinematicSceneData; sceneFrame: number; topic: string }> = ({
  scene,
  sceneFrame,
  topic,
}) => {
  const zoom = interpolate(sceneFrame, [0, 240], [1.0, 1.12], { easing: Easing.out(Easing.quad) });
  const opacity = interpolate(sceneFrame, [0, 25], [0, 1], { easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ backgroundColor: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${zoom})`,
          backgroundImage: `
            radial-gradient(circle at center, rgba(30, 58, 138, 0.35) 0%, rgba(3, 7, 18, 0.95) 75%),
            linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 80px 80px, 80px 80px',
        }}
      />

      <div style={{ textAlign: 'center', zIndex: 10, padding: '0 80px', opacity }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.5)', padding: '6px 16px', borderRadius: '20px', marginBottom: '24px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 800, color: '#f59e0b', letterSpacing: '2px', textTransform: 'uppercase' }}>
            SPECIAL INVESTIGATIVE DOCUMENTARY
          </span>
        </div>

        <h1 style={{ fontFamily: "'Playfair Display', 'Cinzel', serif", fontSize: '66px', fontWeight: 900, color: '#f8fafc', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 16px 0', lineHeight: 1.15 }}>
          {topic}
        </h1>

        <div style={{ width: '180px', height: '3px', background: 'linear-gradient(90deg, transparent, #38bdf8, #f59e0b, transparent)', margin: '0 auto 24px auto', borderRadius: '2px' }} />

        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '20px', fontWeight: 500, color: '#cbd5e1', maxWidth: '900px', margin: '0 auto', lineHeight: 1.5 }}>
          Strategic Intelligence • Corporate Power • The Anatomy of Modern Geopolitics
        </p>
      </div>

      <FloatingParticleField frame={sceneFrame} type="light_leaks" />
    </AbsoluteFill>
  );
};

// ==========================================
// 14. CLOSED CAPTIONS (CC)
// ==========================================
const SubtitlesRenderer: FC<{ cues: SubtitleCueData[]; frame: number }> = ({ cues, frame }) => {
  const activeCue = useMemo(() => {
    return cues.find((c) => frame >= c.startFrame && frame <= c.endFrame);
  }, [cues, frame]);

  if (!activeCue) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 95,
        maxWidth: '85%',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          backgroundColor: 'rgba(10, 15, 26, 0.88)',
          backdropFilter: 'blur(10px)',
          padding: '12px 28px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.75)',
        }}
      >
        <span style={{ fontFamily: "'Inter', 'SF Pro Text', sans-serif", fontSize: '32px', fontWeight: 800, color: '#ffffff', lineHeight: 1.35, letterSpacing: '-0.3px', textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)' }}>
          {activeCue.text}
        </span>
      </div>
    </div>
  );
};

// ==========================================
// 15. MAIN REMOTION COMPOSITION
// ==========================================
export const CinematicDocumentary: FC<CinematicDocumentaryProps> = ({
  title = "SPECIAL INVESTIGATION",
  category = "Documentary",
  topic = "Documentary Production",
  narrationSrc = "/audio/narration.wav",
  musicSrc = "/audio/bgm/ambient_documentary.wav",
  subtitlesData,
  scenes = [],
}) => {
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const resolvedScenes: CinematicSceneData[] = useMemo(() => {
    if (scenes && scenes.length > 0) return scenes;
    return [
      {
        id: 'shot_001',
        type: 'cinematic_hook',
        title: title,
        startFrame: 0,
        durationFrames: durationInFrames,
      }
    ];
  }, [scenes, durationInFrames, title]);

  const activeScene = useMemo(() => {
    return resolvedScenes.find((s) => frame >= s.startFrame && frame < s.startFrame + s.durationFrames) || resolvedScenes[0];
  }, [resolvedScenes, frame]);

  const audioGroup = (
    <AudioTrackGroup
      narration={narrationSrc ? {
        src: narrationSrc,
        volume: 1.0,
        startFrom: 0,
        fadeIn: 10,
        fadeOut: 10,
        premountFor: fps,
      } : undefined}
      music={musicSrc ? {
        src: musicSrc,
        volume: 0.14,
        startFrom: 0,
        loop: true,
        fadeIn: 30,
        fadeOut: 30,
        premountFor: fps,
      } : undefined}
    />
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#020617', filter: 'contrast(1.06) saturate(1.08)' }}>
      {audioGroup}

      {/* Render Current Scene Based on Component Type */}
      {resolvedScenes.map((scene) => {
        const isCurrent = frame >= scene.startFrame && frame < scene.startFrame + scene.durationFrames;
        if (!isCurrent) return null;

        const currentSceneFrame = frame - scene.startFrame;
        const durFrames = scene.durationFrames;

        let sceneContent: React.ReactNode = null;

        switch (scene.type) {
          case 'person_intro':
            sceneContent = <PersonIntroScene scene={scene} sceneFrame={currentSceneFrame} durationFrames={durFrames} />;
            break;
          case 'newspaper_headline':
            sceneContent = <NewspaperHeadlineScene scene={scene} sceneFrame={currentSceneFrame} durationFrames={durFrames} />;
            break;
          case 'archival_photo':
          case 'video_footage':
            sceneContent = <ArchivalPhotoScene scene={scene} sceneFrame={currentSceneFrame} durationFrames={durFrames} />;
            break;
          case 'investigative_evidence':
          case 'archival_document':
            sceneContent = <InvestigativeEvidenceScene scene={scene} sceneFrame={currentSceneFrame} durationFrames={durFrames} />;
            break;
          case 'comparison_split':
            sceneContent = <ComparisonSplitScene scene={scene} sceneFrame={currentSceneFrame} durationFrames={durFrames} />;
            break;
          case 'data_metric':
            sceneContent = <DataMetricScene scene={scene} sceneFrame={currentSceneFrame} />;
            break;
          case 'layered_parallax':
            sceneContent = <LayeredParallaxScene scene={scene} sceneFrame={currentSceneFrame} durationFrames={durFrames} />;
            break;
          case 'tactical_map':
            sceneContent = <TacticalMapScene scene={scene} sceneFrame={currentSceneFrame} />;
            break;
          case 'cinematic_hook':
          default:
            sceneContent = <CinematicHookScene scene={scene} sceneFrame={currentSceneFrame} topic={topic} />;
            break;
        }

        return (
          <FastShiftSceneWrapper
            key={scene.id}
            scene={scene}
            sceneFrame={currentSceneFrame}
            durationFrames={durFrames}
          >
            {sceneContent}
          </FastShiftSceneWrapper>
        );
      })}

      {/* Tactical HUD Overlay */}
      <TacticalHudOverlay frame={frame} topic={topic} category={category} activeScene={activeScene} />

      {/* Subtitles Overlay */}
      {subtitlesData?.cues && subtitlesData.cues.length > 0 && (
        <SubtitlesRenderer cues={subtitlesData.cues} frame={frame} />
      )}

      {/* Post Processing: Film Grain, Letterbox, Vignette */}
      <FilmPostProcessing width={width} height={height} frame={frame} />
    </AbsoluteFill>
  );
};

export default CinematicDocumentary;
