import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
  Img,
  Video,
  OffthreadVideo,
  staticFile,
} from "remotion";
import { AudioTrackGroup, createDuckingVolume } from "../audio/AudioTrack";
import { FC, useMemo } from "react";
import { CinematicVectorMap, GLOBAL_GEO_CATALOG, GeoPin, GeoRoute } from "./maps/CinematicVectorMap";
import {
  PaperCutCollage,
  AnimatedTimeline,
  AnimatedChart,
  ChapterTitleAnim,
  ImageReveal,
  StatisticalCounter,
  DocumentarySplit,
  MOTION_PRESETS_REGISTRY,
} from "./motion/MotionPresets";
import { TitleSafeArea } from "./typography/DocumentaryTypography";

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
  | 'kinetic_title_card'
  | 'actual_video'
  | 'archival_document'
  | 'ai_video'
  | 'paper_cut'
  | 'timeline_event'
  | 'chart_graph'
  | 'chapter_title'
  | 'image_reveal';

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
  location?: string | { name?: string; coordinates?: any; source?: string };
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
    location?: string | { name?: string; coordinates?: any; source?: string };
  };
  kineticTitleData?: {
    line1: string;
    line2: string;
    highlightWord?: string;
    highlightColor?: string;
    flarePosition?: number;
    particles?: 'embers' | 'dust_motes' | 'digital_noise';
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
  sfxCues?: Array<{
    id: string;
    name: string;
    src: string;
    startFrame: number;
    volume: number;
  }>;
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
  let raw = url || fallback;
  if (raw.includes(':3001/public/')) {
    raw = raw.replace(/https?:\/\/[^/]+:3001\/public\//, '/');
  } else if (raw.includes(':3001/')) {
    raw = raw.replace(/https?:\/\/[^/]+:3001\//, '/');
  } else if (raw.includes(':3000/public/')) {
    raw = raw.replace(/https?:\/\/[^/]+:3000\/public\//, '/');
  } else if (raw.includes(':3000/')) {
    raw = raw.replace(/https?:\/\/[^/]+:3000\//, '/');
  }
  if (raw.startsWith('/public/')) {
    raw = raw.slice(7);
  } else if (raw.startsWith('public/')) {
    raw = raw.slice(6);
  }
  return (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:'))
    ? raw
    : staticFile(raw.replace(/^\//, ''));
};

const SmartMedia: FC<{
  src: string;
  style?: React.CSSProperties;
  className?: string;
}> = ({ src, style, className }) => {
  const isExplicitVideo = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(src);
  const isExplicitImage = /\.(jpg|jpeg|png|webp|svg|gif|bmp)(\?.*)?$/i.test(src);
  const isVideo = isExplicitVideo || (!isExplicitImage && src.includes('/videos/library/') && !src.includes('/cache/'));
  if (isVideo) {
    return <OffthreadVideo src={src} style={style} className={className} />;
  }
  return <Img src={src} style={style} className={className} />;
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
    organization: (typeof scene.location === 'object' ? scene.location?.name : scene.location) || 'EXECUTIVE LEADERSHIP',
    location: 'EXECUTIVE INTELLIGENCE'
  };

  const nameEnter = interpolate(sceneFrame, [0, 14], [-40, 0], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });
  const opacity = interpolate(sceneFrame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#020617', overflow: 'hidden' }}>
      {/* High-Resolution Portrait with Ken Burns Push */}
      <div style={{ position: 'absolute', inset: 0, transform, transformOrigin: 'center 35%' }}>
        <SmartMedia
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
        <SmartMedia
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
// 8. COMPONENT 4: TACTICAL VECTOR MAP (D3-GEO + NATURAL EARTH 110M)
// ==========================================
const TacticalMapScene: FC<{ scene: CinematicSceneData; sceneFrame: number }> = ({ scene, sceneFrame }) => {
  // Derive highlighted entities and pins dynamically from scene data
  const highlighted = scene.visualData?.highlightedEntities && scene.visualData.highlightedEntities.length > 0
    ? scene.visualData.highlightedEntities
    : ['United States of America', 'China', 'Taiwan'];

  // Map markers to GeoPins
  const pins: GeoPin[] | undefined = scene.visualData?.markers && scene.visualData.markers.length > 0
    ? scene.visualData.markers.map(m => {
        const match = GLOBAL_GEO_CATALOG[m.name.toLowerCase()];
        return {
          name: m.name,
          coord: match ? match.coord : [(m.x - 0.5) * 360, (0.5 - m.y) * 160],
          label: match?.label || m.type?.toUpperCase() || 'STRATEGIC SITE',
          type: m.type,
        };
      })
    : undefined;

  const routes: GeoRoute[] | undefined = scene.visualData?.routes && scene.visualData.routes.length > 0
    ? scene.visualData.routes.map(r => ({
        from: r.from,
        to: r.to,
        label: r.label || 'STRATEGIC TRANSIT CORRIDOR',
        type: 'flight',
      }))
    : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: '#060a12', overflow: 'hidden' }}>
      <CinematicVectorMap
        sceneFrame={sceneFrame}
        durationFrames={scene.durationFrames || 180}
        regionTitle={scene.visualData?.region || scene.title || 'GLOBAL STRATEGIC SURVEILLANCE'}
        highlightedCountries={highlighted}
        pins={pins}
        routes={routes}
        theme="tactical_navy"
        tacticalHud={true}
      />
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
        <SmartMedia src={bgSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
          <SmartMedia src={leftSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
          <SmartMedia src={rightSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
        <SmartMedia src={mediaSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
              PARALLAX INTELLIGENCE DOSSIER // {(typeof scene.location === 'object' ? scene.location?.name : scene.location) || 'CONFIDENTIAL'}
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
// 13B. COMPONENT: KINETIC TITLE CARD (Reference Video Style)
// ==========================================
const KineticTitleCardScene: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
  topic?: string;
}> = ({ scene, sceneFrame, durationFrames, topic }) => {
  const data = scene.kineticTitleData || {
    line1: 'THE SILICON TRAP',
    line2: 'NVIDIA CEO RESIGNS',
    highlightWord: 'NVIDIA',
    highlightColor: '#ff2a2a',
  };

  // Explosive impact entrance
  const scale = interpolate(sceneFrame, [0, 8, 25, durationFrames], [1.18, 0.98, 1.0, 1.05], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic)
  });

  const opacity = interpolate(sceneFrame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  
  // Specular lens flare sweep across text
  const flareX = interpolate(sceneFrame, [8, 35], [-30, 130], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Floating burning embers
  const embers = useMemo(() => {
    return Array.from({ length: 35 }).map((_, i) => ({
      left: `${(i * 17) % 100}%`,
      speed: 0.8 + ((i % 5) * 0.4),
      size: 3 + (i % 4),
      offset: (i * 23) % 100,
      color: i % 3 === 0 ? '#ff4500' : (i % 3 === 1 ? '#ffae19' : '#ff2a2a'),
    }));
  }, []);

  const line2Words = data.line2.split(/\s+/);

  return (
    <AbsoluteFill style={{ backgroundColor: '#030712', overflow: 'hidden' }}>
      {/* Dark textured grunge background with subtle vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, #111827 0%, #030712 85%)',
          opacity: 0.95
        }}
      />

      {/* Floating Ember Sparks */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        {embers.map((emb, idx) => {
          const yPos = (100 - ((sceneFrame * emb.speed + emb.offset) % 120));
          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: emb.left,
                top: `${yPos}%`,
                width: emb.size,
                height: emb.size,
                borderRadius: '50%',
                backgroundColor: emb.color,
                boxShadow: `0 0 10px ${emb.color}, 0 0 20px ${emb.color}`,
                opacity: 0.85
              }}
            />
          );
        })}
      </div>

      {/* Central 3D Kinetic Typography Container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scale})`,
          opacity,
          padding: '0 40px',
          textAlign: 'center',
          zIndex: 20
        }}
      >
        {/* Line 1: Bold Metallic Bevel 3D Header */}
        <div style={{ position: 'relative', overflow: 'hidden', padding: '10px 30px' }}>
          <h1
            style={{
              fontFamily: "'Montserrat', 'Inter', system-ui, sans-serif",
              fontSize: '88px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#ffffff',
              lineHeight: 1.05,
              margin: 0,
              textShadow: '0 6px 18px rgba(0,0,0,0.95), 0 1px 3px rgba(255,255,255,0.4)',
              WebkitTextStroke: '1px rgba(255,255,255,0.2)',
            }}
          >
            {data.line1}
          </h1>

          {/* Lens Flare Specular Gleam Sweep */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${flareX}%`,
              width: '100px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)',
              transform: 'skewX(-25deg)',
              pointerEvents: 'none',
              filter: 'blur(4px)'
            }}
          />
        </div>

        {/* Line 2: High-Alert Red Keyword Highlight ("NVIDIA" in red, rest in white) */}
        <div style={{ marginTop: '20px' }}>
          <h2
            style={{
              fontFamily: "'Montserrat', 'Inter', system-ui, sans-serif",
              fontSize: '60px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              lineHeight: 1.1,
              margin: 0,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '18px'
            }}
          >
            {line2Words.map((word, wIdx) => {
              const isHighlight = data.highlightWord && word.toUpperCase().includes(data.highlightWord.toUpperCase());
              return (
                <span
                  key={wIdx}
                  style={{
                    color: isHighlight ? (data.highlightColor || '#ff2a2a') : '#ffffff',
                    textShadow: isHighlight
                      ? '0 0 25px rgba(255,42,42,0.9), 0 0 50px rgba(255,42,42,0.6)'
                      : '0 4px 14px rgba(0,0,0,0.85)',
                  }}
                >
                  {word}
                </span>
              );
            })}
          </h2>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// 13C. COMPONENT: ACTUAL VIDEO FOOTAGE SCENE
// ==========================================
const ActualVideoScene: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
}> = ({ scene, sceneFrame, durationFrames }) => {
  const panScale = interpolate(sceneFrame, [0, durationFrames], [1.02, 1.12], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad)
  });

  const panX = interpolate(sceneFrame, [0, durationFrames], [0, -25], {
    extrapolateRight: 'clamp'
  });

  const rawUrl = scene.mediaUrl || '/videos/library/datacenter_tech.mp4';
  const resolvedSrc = resolveMediaSrc(rawUrl);

  const isImage = /\.(jpg|jpeg|png|webp|temp\.jpg)$/i.test(rawUrl);

  return (
    <AbsoluteFill style={{ backgroundColor: '#020617', overflow: 'hidden' }}>
      {isImage ? (
        <Img
          src={resolvedSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${panScale}) translate(${panX}px, 0px)`,
            filter: 'contrast(1.08) saturate(1.1) brightness(0.95)',
          }}
        />
      ) : (
        <OffthreadVideo
          src={resolvedSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${panScale}) translate(${panX}px, 0px)`,
            filter: 'contrast(1.08) saturate(1.1) brightness(0.95)',
          }}
          volume={0}
          onError={(e) => {
            console.warn('Video element playback warning:', e);
          }}
        />
      )}
      {/* Cinematic Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.65) 100%)',
          pointerEvents: 'none'
        }}
      />
    </AbsoluteFill>
  );
};

// ==========================================
// 14. CLOSED CAPTIONS (CC) — STRICT 1-LINE DYNAMIC DISPLAY & TYPOGRAPHY PRESETS
// ==========================================
const SubtitlesRenderer: FC<{ cues: SubtitleCueData[]; frame: number; template?: string }> = ({ cues, frame, template = 'modern-documentary' }) => {
  const activeCue = useMemo(() => {
    return cues.find((c) => frame >= c.startFrame && frame <= c.endFrame);
  }, [cues, frame]);

  if (!activeCue) return null;

  const cueRelativeFrame = frame - activeCue.startFrame;
  const popScale = interpolate(cueRelativeFrame, [0, 4], [0.94, 1.0], { extrapolateRight: 'clamp' });
  const popOpacity = interpolate(cueRelativeFrame, [0, 3], [0.5, 1.0], { extrapolateRight: 'clamp' });

  // Paced word chunking (maximum 5-6 words per view for instant mobile readability)
  const rawWords = activeCue.text.trim().split(/\s+/);
  const totalCueFrames = Math.max(1, activeCue.endFrame - activeCue.startFrame);
  const progressRatio = Math.min(1, Math.max(0, cueRelativeFrame / totalCueFrames));
  
  let displayText = activeCue.text;
  let activeWordIdx = 0;
  if (rawWords.length > 6) {
    activeWordIdx = Math.min(rawWords.length - 1, Math.floor(progressRatio * rawWords.length));
    const startIdx = Math.max(0, activeWordIdx - 2);
    const endIdx = Math.min(rawWords.length, startIdx + 5);
    displayText = rawWords.slice(startIdx, endIdx).join(' ');
  } else {
    activeWordIdx = Math.min(rawWords.length - 1, Math.floor(progressRatio * rawWords.length));
  }

  const wordsInDisplay = displayText.split(/\s+/);

  // 1. Minimal White (Broadcast standard)
  if (template === 'minimal-white') {
    return (
      <div style={{ position: 'absolute', bottom: '80px', left: '80px', right: '80px', textAlign: 'center', pointerEvents: 'none', zIndex: 95 }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '32px', fontWeight: 600, color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.85)' }}>
          {displayText}
        </span>
      </div>
    );
  }

  // 2. Bold Centered
  if (template === 'bold-centered') {
    return (
      <div style={{ position: 'absolute', bottom: '80px', left: '80px', right: '80px', textAlign: 'center', pointerEvents: 'none', zIndex: 95, transform: `scale(${popScale})` }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '42px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', textShadow: '0 4px 20px rgba(0,0,0,0.95), 0 0 30px rgba(0,0,0,0.8)' }}>
          {displayText}
        </span>
      </div>
    );
  }

  // 3. Karaoke / Yellow Highlight
  if (template === 'karaoke-highlight' || template === 'yellow-highlight') {
    return (
      <div style={{ position: 'absolute', bottom: '80px', left: '50%', transform: `translateX(-50%) scale(${popScale})`, opacity: popOpacity, zIndex: 95, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', gap: '10px', alignItems: 'center', backgroundColor: 'rgba(5, 9, 20, 0.92)', padding: '12px 28px', borderRadius: '12px', border: '1px solid rgba(234, 179, 8, 0.3)', backdropFilter: 'blur(12px)', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }}>
          {wordsInDisplay.map((w, wIdx) => {
            const isHighlight = (wIdx === activeWordIdx % wordsInDisplay.length) || (template === 'yellow-highlight' && wIdx % 3 === 0);
            return (
              <span
                key={wIdx}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '32px',
                  fontWeight: 800,
                  color: isHighlight ? '#facc15' : '#ffffff',
                  textShadow: isHighlight ? '0 0 16px rgba(250, 204, 21, 0.6)' : '0 2px 8px rgba(0,0,0,0.9)',
                  transform: isHighlight ? 'scale(1.06)' : 'scale(1.0)',
                  transition: 'transform 0.1s ease',
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // 4. Modern Documentary (Default)
  const fontSize = displayText.length > 36 ? '26px' : displayText.length > 28 ? '29px' : '32px';
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        left: '50%',
        transform: `translateX(-50%) scale(${popScale})`,
        opacity: popOpacity,
        zIndex: 95,
        maxWidth: '90%',
        textAlign: 'center',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(8, 12, 22, 0.92)',
          backdropFilter: 'blur(12px)',
          padding: '10px 24px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          boxShadow: '0 8px 36px rgba(0, 0, 0, 0.85), 0 0 20px rgba(0, 240, 255, 0.12)',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', 'Montserrat', -apple-system, sans-serif",
            fontSize,
            fontWeight: 800,
            color: '#FFFFFF',
            lineHeight: 1.2,
            letterSpacing: '-0.3px',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.95)',
            whiteSpace: 'nowrap',
          }}
        >
          {displayText}
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
  sfxCues = [],
  captionTemplate = "modern-box",
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

  // Audio ducking automation: lower BGM when narration is spoken (0.12 = -18dB), swell during pauses/chapter titles (0.35 = -9dB)
  const narrationRanges = useMemo(() => {
    if (!subtitlesData?.cues || subtitlesData.cues.length === 0) return [];
    return subtitlesData.cues.map((c) => ({
      start: c.startFrame,
      end: c.endFrame,
    }));
  }, [subtitlesData]);

  const duckingVolumeFn = useMemo(() => {
    if (narrationRanges.length === 0) return 0.16;
    return createDuckingVolume(narrationRanges, 0.35, 0.12, 12);
  }, [narrationRanges]);

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
        volume: duckingVolumeFn,
        startFrom: 0,
        loop: true,
        fadeIn: 30,
        fadeOut: 30,
        premountFor: fps,
      } : undefined}
      soundEffects={sfxCues?.map((cue, idx) => ({
        src: cue.src,
        startFrom: cue.startFrame,
        volume: cue.volume || 0.5,
        premountFor: fps,
      })) || []}
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
          case 'kinetic_title_card':
            sceneContent = <KineticTitleCardScene scene={scene} sceneFrame={currentSceneFrame} durationFrames={durFrames} topic={topic} />;
            break;
          case 'actual_video':
            sceneContent = <ActualVideoScene scene={scene} sceneFrame={currentSceneFrame} durationFrames={durFrames} />;
            break;
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
          case 'paper_cut':
            sceneContent = (
              <PaperCutCollage
                frame={currentSceneFrame}
                imageUrl={resolveMediaSrc(scene.mediaUrl)}
                headline={scene.title}
                category={scene.badge || 'VERIFIED RECORD'}
              />
            );
            break;
          case 'timeline_event':
            sceneContent = (
              <AnimatedTimeline
                frame={currentSceneFrame}
                events={[
                  { date: 'Phase 1', headline: scene.title, description: scene.narration },
                  { date: 'Phase 2', headline: 'Strategic Expansion', description: 'Institutional scaling and market integration.' },
                  { date: 'Phase 3', headline: 'Global Dominance', description: 'Modern defense and technological leadership.' }
                ]}
              />
            );
            break;
          case 'chart_graph':
            sceneContent = (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <AnimatedChart
                  frame={currentSceneFrame}
                  data={[
                    { label: 'Q1', value: 40 },
                    { label: 'Q2', value: 65 },
                    { label: 'Q3', value: 85 },
                    { label: 'Q4', value: 100 }
                  ]}
                />
              </div>
            );
            break;
          case 'chapter_title':
            sceneContent = (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <ChapterTitleAnim
                  frame={currentSceneFrame}
                  chapterNumber={scene.id?.replace(/[^0-9]/g, '') || 1}
                  chapterTitle={scene.title}
                  subtitle={scene.narration}
                />
              </div>
            );
            break;
          case 'image_reveal':
            sceneContent = (
              <ImageReveal
                frame={currentSceneFrame}
                imageUrl={resolveMediaSrc(scene.mediaUrl)}
                durationFrames={durFrames}
              />
            );
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

      {/* Subtitles Overlay with Configured Typography Preset */}
      {subtitlesData?.cues && subtitlesData.cues.length > 0 && (
        <SubtitlesRenderer cues={subtitlesData.cues} frame={frame} template={captionTemplate} />
      )}

      {/* Post Processing: Film Grain, Letterbox, Vignette */}
      <FilmPostProcessing width={width} height={height} frame={frame} />
    </AbsoluteFill>
  );
};

export default CinematicDocumentary;
