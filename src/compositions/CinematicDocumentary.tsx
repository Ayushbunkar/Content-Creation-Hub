import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
  OffthreadVideo,
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
  | 'video_footage'
  | 'layered_parallax'
  | 'archival_document'
  | 'tactical_map'
  | 'data_metric'
  | 'cinematic_hook'
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
  subtitlesData?: {
    cues: SubtitleCueData[];
  };
  captionTemplate?: string;
  scenes?: CinematicSceneData[];
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

// ==========================================
// 1. PROCEDURAL FILM GRAIN & VIGNETTE OVERLAY
// ==========================================
const FilmPostProcessing: FC<{ width: number; height: number; frame: number }> = ({ width, height, frame }) => {
  const grainSeed = (frame % 12) * 8.3;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 90 }}>
      {/* 35mm Analog Film Grain Texture */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.12,
          mixBlendMode: 'screen',
        }}
      >
        <filter id="cinematicFilmGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.75"
            numOctaves={3}
            stitchTiles="stitch"
            seed={grainSeed}
          />
          <feColorMatrix type="matrix" values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  1 0 0 0 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cinematicFilmGrain)" />
      </svg>

      {/* 35mm Hollywood Cinema Color Grade & Contrast Tone */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 35%, rgba(251, 191, 36, 0.05) 0%, transparent 70%), linear-gradient(180deg, rgba(14, 165, 233, 0.04) 0%, rgba(2, 6, 23, 0.18) 100%)',
          mixBlendMode: 'color-dodge',
          pointerEvents: 'none',
        }}
      />

      {/* Atmospheric Cinematic Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 48%, rgba(4, 7, 13, 0.75) 86%, rgba(2, 4, 8, 0.96) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Cinematic Anamorphic Letterbox Matte Bars */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${Math.round(height * 0.05)}px`,
          backgroundColor: '#000000',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${Math.round(height * 0.05)}px`,
          backgroundColor: '#000000',
        }}
      />
    </AbsoluteFill>
  );
};

// ==========================================
// 2. PROCEDURAL FLOATING PARTICLES & LIGHT LEAKS
// ==========================================
const FloatingParticleField: FC<{ frame: number; type?: string }> = ({ frame, type = 'dust_motes' }) => {
  if (type === 'none') return null;

  const particles = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      x: ((i * 137.5) % 100),
      baseY: ((i * 73.1) % 100),
      size: (i % 3) + 2,
      speed: 0.15 + ((i % 5) * 0.06),
      opacity: 0.25 + ((i % 4) * 0.15),
    }));
  }, []);

  const flareX = interpolate(frame % 150, [0, 150], [-100, 110]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 40, overflow: 'hidden' }}>
      {/* Light Leak Flare */}
      {type === 'light_leaks' && (
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: `${flareX}%`,
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, rgba(245, 158, 11, 0.06) 45%, transparent 70%)',
            filter: 'blur(40px)',
            mixBlendMode: 'screen',
          }}
        />
      )}

      {/* Ambient Floating Dust Motes */}
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
              opacity: Math.max(0.05, Math.min(1, shimmer)),
              boxShadow: type === 'embers' ? '0 0 8px #f59e0b' : '0 0 6px rgba(255, 255, 255, 0.6)',
              filter: 'blur(0.5px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ==========================================
// 3. TACTICAL MILITARY HUD & VIEWFINDER OVERLAY
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

  const coords = activeScene?.coordinates || activeScene?.visualData?.coordinates || "26°34'12\"N // 56°15'08\"E";
  const badgeText = activeScene?.badge || (activeScene?.type === 'video_footage' ? '[Real Video Footage]' : '[Motion Graphics]');

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 80, padding: '36px 50px' }}>
      {/* Top Bar HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isBlink ? '#ef4444' : '#7f1d1d',
              boxShadow: isBlink ? '0 0 10px #ef4444' : 'none',
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '13px',
              fontWeight: 700,
              color: '#f8fafc',
              letterSpacing: '1px',
            }}
          >
            REC [{timecode}]
          </span>
          <span
            style={{
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              textTransform: 'uppercase',
            }}
          >
            {category || 'INTELLIGENCE BRIEFING'}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            {badgeText}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              color: '#94a3b8',
              letterSpacing: '1px',
            }}
          >
            LOC: {coords}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              padding: '2px 8px',
              borderRadius: '3px',
              letterSpacing: '1px',
            }}
          >
            DECLASSIFIED // SPECIAL ANALYSIS
          </span>
        </div>
      </div>

      {/* Viewfinder Corner Reticles */}
      <svg style={{ position: 'absolute', inset: '40px 50px', width: 'calc(100% - 100px)', height: 'calc(100% - 80px)' }}>
        <path d="M0,28 L0,0 L28,0" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
        <path d="M calc(100% - 28px),0 L 100%,0 L 100%,28" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
        <path d="M0,calc(100% - 28px) L0,100% L28,100%" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
        <path d="M calc(100% - 28px),100% L 100%,100% L 100%,calc(100% - 28px)" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
      </svg>
    </AbsoluteFill>
  );
};

// ==========================================
// 4. BROADCAST LOWER-THIRD SECTION HEADER
// ==========================================
const BroadcastLowerThird: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
}> = ({ scene, sceneFrame }) => {
  const enterProgress = interpolate(sceneFrame, [0, 18], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const slideX = interpolate(enterProgress, [0, 1], [-60, 0]);
  const opacity = enterProgress;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '75px',
        left: '50px',
        transform: `translateX(${slideX}px)`,
        opacity,
        zIndex: 85,
        maxWidth: '750px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ width: '4px', height: '18px', backgroundColor: '#38bdf8' }} />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#38bdf8',
            letterSpacing: '1.5px',
          }}
        >
          {scene.location || 'STRATEGIC ASSESSMENT'}
        </span>
      </div>

      <div
        style={{
          background: 'rgba(10, 15, 26, 0.92)',
          backdropFilter: 'blur(12px)',
          padding: '12px 20px',
          borderRadius: '8px',
          borderLeft: '4px solid #f59e0b',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
        }}
      >
        <h2
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '23px',
            fontWeight: 800,
            color: '#ffffff',
            margin: 0,
            letterSpacing: '-0.3px',
            lineHeight: 1.2,
          }}
        >
          {scene.title}
        </h2>
        {scene.subtitle && (
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '13px',
              fontWeight: 500,
              color: '#94a3b8',
              margin: '4px 0 0 0',
            }}
          >
            {scene.subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 4.5. FAST SHIFT & DYNAMIC PUNCH TRANSITION WRAPPER
// ==========================================
const FastShiftSceneWrapper: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
  children: React.ReactNode;
}> = ({ scene, sceneFrame, durationFrames, children }) => {
  // Deterministic transition style based on scene ID or type
  const sceneNum = typeof scene.id === 'number' ? scene.id : (parseInt(String(scene.id).replace(/\D/g, '') || '0', 10));
  const shiftMode = sceneNum % 4; // 0 = Zoom Punch, 1 = Whip Left, 2 = Whip Right, 3 = Cinematic Drop Tilt

  // 1. Kinetic Camera Punch on cut (Vox / Lemmino snap transition)
  const punchScale = interpolate(sceneFrame, [0, 5, 13], [shiftMode === 0 ? 1.09 : 1.06, 1.015, 1.0], {
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // 2. Multi-axis whip vector
  let whipX = 0;
  let whipY = 0;
  if (shiftMode === 1) {
    whipX = interpolate(sceneFrame, [0, 8], [-44, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  } else if (shiftMode === 2) {
    whipX = interpolate(sceneFrame, [0, 8], [44, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  } else if (shiftMode === 3) {
    whipY = interpolate(sceneFrame, [0, 9], [-32, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  }

  // 3. Directional Motion Blur simulation on whip cut
  const motionBlur = interpolate(sceneFrame, [0, 3, 7], [3.2, 1.0, 0], {
    extrapolateRight: 'clamp',
  });

  // 4. Optical 35mm splice light flash & chromatic pulse
  const flashOpacity = interpolate(sceneFrame, [0, 2, 6], [0.38, 0.15, 0], {
    extrapolateRight: 'clamp',
  });

  // 5. Continuous Organic Handheld Float across shot (Zero dead frames)
  const driftX = Math.sin(sceneFrame * 0.038 + sceneNum) * 3.8;
  const driftY = Math.cos(sceneFrame * 0.032 + sceneNum) * 2.6;
  const slowZoom = interpolate(sceneFrame, [0, durationFrames], [1.0, 1.045], {
    easing: Easing.out(Easing.quad),
  });

  // 6. Shutter angle / RGB chromatic aberration on cut
  const chromaticShift = interpolate(sceneFrame, [0, 4], [2.2, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${punchScale * slowZoom}) translate(${whipX + driftX}px, ${whipY + driftY}px)`,
        filter: motionBlur > 0.1 
          ? `blur(${motionBlur}px) ${chromaticShift > 0.3 ? `drop-shadow(${chromaticShift}px 0 rgba(239, 68, 68, 0.45)) drop-shadow(-${chromaticShift}px 0 rgba(56, 189, 248, 0.45))` : ''}` 
          : undefined,
        transformOrigin: 'center center',
      }}
    >
      {children}

      {/* Optical cut flash beam - 35mm splice flare */}
      {flashOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            background: shiftMode === 1 || shiftMode === 2
              ? 'linear-gradient(90deg, transparent 0%, rgba(255, 248, 220, 0.65) 50%, transparent 100%)'
              : 'radial-gradient(circle at center, rgba(255, 250, 235, 0.5) 0%, rgba(245, 158, 11, 0.15) 50%, transparent 80%)',
            opacity: flashOpacity,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ==========================================
// 5. PRIORITY 1: REAL VIDEO FOOTAGE SCENE
// ==========================================
const VideoFootageScene: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
}> = ({ scene, sceneFrame, durationFrames }) => {
  const movement = scene.cameraMovement || 'dolly_in';
  let transform = '';

  if (movement === 'dolly_in') {
    const scale = interpolate(sceneFrame, [0, durationFrames], [1.0, 1.12], { easing: Easing.out(Easing.quad) });
    transform = `scale(${scale})`;
  } else if (movement === 'dolly_out') {
    const scale = interpolate(sceneFrame, [0, durationFrames], [1.12, 1.0], { easing: Easing.out(Easing.quad) });
    transform = `scale(${scale})`;
  } else if (movement === 'pan_left') {
    const tx = interpolate(sceneFrame, [0, durationFrames], [30, -30]);
    transform = `scale(1.08) translateX(${tx}px)`;
  } else if (movement === 'pan_right') {
    const tx = interpolate(sceneFrame, [0, durationFrames], [-30, 30]);
    transform = `scale(1.08) translateX(${tx}px)`;
  } else if (movement === 'tilt_up') {
    const ty = interpolate(sceneFrame, [0, durationFrames], [20, -20]);
    transform = `scale(1.08) translateY(${ty}px)`;
  } else if (movement === 'aerial_zoom') {
    const scale = interpolate(sceneFrame, [0, durationFrames], [1.18, 1.02]);
    transform = `scale(${scale})`;
  } else {
    const scale = interpolate(sceneFrame, [0, durationFrames], [1.0, 1.08]);
    transform = `scale(${scale})`;
  }

  const rawSrc = scene.mediaUrl || '/videos/library/ocean_naval.mp4';
  const videoSrc = (rawSrc.startsWith('http://') || rawSrc.startsWith('https://') || rawSrc.startsWith('data:'))
    ? rawSrc
    : staticFile(rawSrc.replace(/^\//, ''));
  const isImage = /\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(rawSrc);

  return (
    <AbsoluteFill style={{ backgroundColor: '#020617', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `${transform} scale(1.06)`,
          transformOrigin: 'center center',
        }}
      >
        {isImage ? (
          <Img
            src={videoSrc}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'contrast(1.12) brightness(0.95) saturate(1.1)',
            }}
          />
        ) : (
          <OffthreadVideo
            src={videoSrc}
            onError={() => {}}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'contrast(1.12) brightness(0.95) saturate(1.1)',
            }}
          />
        )}
      </div>

      {/* Cinematic Depth Particle Field */}
      <FloatingParticleField frame={sceneFrame} type={scene.layers?.particles || 'dust_motes'} />
    </AbsoluteFill>
  );
};

// ==========================================
// 6. PRIORITY 3: LAYERED 2.5D PARALLAX SCENE
// ==========================================
const LayeredParallaxScene: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
}> = ({ scene, sceneFrame, durationFrames }) => {
  // 3-Plane Parallax Depth Speeds
  const bgZoom = interpolate(sceneFrame, [0, durationFrames], [1.02, 1.12]);
  const bgPan = interpolate(sceneFrame, [0, durationFrames], [0, -40]);

  const midDriftX = interpolate(sceneFrame, [0, durationFrames], [30, -15]);
  const midScale = interpolate(sceneFrame, [0, durationFrames], [1.02, 1.08]);

  const fgPanX = interpolate(sceneFrame, [0, durationFrames], [-60, 60]);

  const rawSrc = scene.mediaUrl || '/videos/library/ocean_naval.mp4';
  const mediaSrc = (rawSrc.startsWith('http://') || rawSrc.startsWith('https://') || rawSrc.startsWith('data:'))
    ? rawSrc
    : staticFile(rawSrc.replace(/^\//, ''));
  const isImage = /\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(rawSrc);

  return (
    <AbsoluteFill style={{ backgroundColor: '#060a12', overflow: 'hidden' }}>
      {/* Background Plane (Speed: 0.4x with cinematic blur & grade) */}
      <div
        style={{
          position: 'absolute',
          inset: '-8%',
          transform: `scale(${bgZoom}) translateX(${bgPan}px)`,
          filter: 'brightness(0.32) contrast(1.2) blur(2px) saturate(1.15)',
        }}
      >
        {isImage ? (
          <Img src={mediaSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <OffthreadVideo src={mediaSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>

      {/* Atmospheric Vignette & Tactical Grid Overlay */}
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

      {/* Middleground Plane (Speed: 1.0x with Depth Shadow & Framed Card) */}
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
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(20px)',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                fontWeight: 800,
                color: '#38bdf8',
                letterSpacing: '2px',
                textTransform: 'uppercase',
              }}
            >
              PARALLAX INTELLIGENCE DOSSIER // {scene.location || 'CONFIDENTIAL'}
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                color: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                padding: '3px 10px',
                borderRadius: '4px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              ARCHIVAL SUBJECT
            </span>
          </div>

          <h1
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '42px',
              fontWeight: 900,
              color: '#ffffff',
              margin: '0',
              lineHeight: 1.15,
              letterSpacing: '-0.5px',
            }}
          >
            {scene.title}
          </h1>

          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '18px',
              color: '#cbd5e1',
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            {scene.narration}
          </p>
        </div>
      </div>

      {/* Foreground Plane (Speed: 1.8x Floating Particles & Flares) */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${fgPanX}px)`, zIndex: 15 }}>
        <FloatingParticleField frame={sceneFrame} type="light_leaks" />
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// 7. ARCHIVAL HISTORICAL DOCUMENT SCENE
// ==========================================
const ArchivalDocumentScene: FC<{
  scene: CinematicSceneData;
  sceneFrame: number;
  durationFrames: number;
}> = ({ scene, sceneFrame, durationFrames }) => {
  const tiltY = interpolate(sceneFrame, [0, durationFrames], [-15, 10]);
  const camZoom = interpolate(sceneFrame, [0, durationFrames], [1.02, 1.1]);

  // Animated yellow highlighter sweep
  const highlightWidth = interpolate(sceneFrame, [15, 55], [0, 100], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Stamp bounce animation
  const stampProgress = interpolate(sceneFrame, [25, 38], [0, 1], {
    easing: Easing.out(Easing.back(1.5)),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stampScale = interpolate(stampProgress, [0, 1], [2.2, 1.0]);
  const stampOpacity = stampProgress;

  const doc = scene.archivalData || {
    headline: scene.title.toUpperCase(),
    publication: 'THE GEOPOLITICAL HISTORICAL RECORD',
    date: 'OCTOBER 1973 // STRATEGIC DISPATCH',
    snippet: scene.narration || 'Under sovereign protocol, territorial maritime transit passage remains contested across all superpowers.',
    highlightPhrase: scene.subtitle || 'Critical strategic corridor under international maritime scrutiny.'
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0c0f17',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background Mahogany Investigator Desk Texture */}
      <div
        style={{
          position: 'absolute',
          inset: '-5%',
          backgroundImage: `
            radial-gradient(circle at center, rgba(245, 158, 11, 0.15) 0%, rgba(3, 7, 18, 0.95) 80%),
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 80px 80px, 80px 80px',
        }}
      />

      {/* Aged Document Container */}
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
          transform: `scale(${camZoom}) translateY(${tiltY}px)`,
          position: 'relative',
        }}
      >
        {/* Document Masthead */}
        <div style={{ borderBottom: '3px double #1a1815', paddingBottom: '16px', marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 800, letterSpacing: '3px', textTransform: 'uppercase' }}>
            {doc.publication}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#665e52', letterSpacing: '1px', marginTop: '4px' }}>
            SPECIAL ARCHIVAL EDITION • {doc.date}
          </div>
        </div>

        {/* Main Headline */}
        <h1
          style={{
            fontFamily: "'Playfair Display', 'Times New Roman', serif",
            fontSize: '38px',
            fontWeight: 900,
            lineHeight: 1.15,
            margin: '0 0 20px 0',
            letterSpacing: '-0.5px',
          }}
        >
          {doc.headline}
        </h1>

        {/* Snippet Paragraph */}
        <p
          style={{
            fontFamily: "'Georgia', serif",
            fontSize: '18px',
            lineHeight: 1.6,
            color: '#2d2822',
            margin: '0 0 20px 0',
          }}
        >
          {doc.snippet}
        </p>

        {/* Highlighted Key Phrase */}
        <div style={{ position: 'relative', display: 'inline-block', margin: '8px 0' }}>
          <span
            style={{
              position: 'absolute',
              top: '2px',
              bottom: '2px',
              left: 0,
              width: `${highlightWidth}%`,
              backgroundColor: 'rgba(250, 204, 21, 0.65)',
              borderRadius: '2px',
              mixBlendMode: 'multiply',
              zIndex: 1,
            }}
          />
          <span
            style={{
              position: 'relative',
              zIndex: 2,
              fontFamily: "'Georgia', serif",
              fontSize: '20px',
              fontWeight: 700,
              fontStyle: 'italic',
              color: '#0f172a',
            }}
          >
            "{doc.highlightPhrase}"
          </span>
        </div>

        {/* Rubber Stamp Slam (DECLASSIFIED) */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '48px',
            transform: `scale(${stampScale}) rotate(-12deg)`,
            opacity: stampOpacity,
            border: '4px solid #b91c1c',
            borderRadius: '6px',
            padding: '8px 20px',
            color: '#b91c1c',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '22px',
            fontWeight: 900,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            maskImage: 'radial-gradient(circle, black 85%, transparent 100%)',
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
// 8. TACTICAL VECTOR MAP SCENE
// ==========================================
const TacticalMapScene: FC<{ scene: CinematicSceneData; sceneFrame: number }> = ({ scene, sceneFrame }) => {
  const camZoom = interpolate(sceneFrame, [0, 240], [1.0, 1.12], { easing: Easing.out(Easing.quad) });
  const pulseRadius = (sceneFrame % 60) * 3.5;
  const pulseOpacity = interpolate(sceneFrame % 60, [0, 60], [0.9, 0]);
  const dashOffset = -(sceneFrame * 2.5);

  return (
    <AbsoluteFill style={{ backgroundColor: '#060a12', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${camZoom})`,
          transformOrigin: '55% 50%',
        }}
      >
        {/* Real Satellite Topography Background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.35,
            mixBlendMode: 'screen',
            filter: 'contrast(1.25) brightness(0.7)',
          }}
        >
          <OffthreadVideo
            src={staticFile('videos/library/satellite_globe.mp4')}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <svg viewBox="0 0 1920 1080" style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}>
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

          {/* Bathymetric Depth Rings */}
          <g stroke="rgba(56, 189, 248, 0.15)" fill="none" strokeDasharray="4 6">
            <ellipse cx="980" cy="460" rx="140" ry="80" />
            <ellipse cx="980" cy="460" rx="280" ry="160" />
            <ellipse cx="980" cy="460" rx="440" ry="240" />
          </g>

          {/* Flowing Maritime Energy Shipping Lane */}
          <path
            d="M 620,360 Q 820,410 980,455 T 1280,560"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="4"
            strokeDasharray="12 8"
            strokeDashoffset={dashOffset}
            style={{ filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.8))' }}
          />

          {/* Counter Shipping Lane */}
          <path
            d="M 1260,540 Q 1040,465 970,445 T 600,340"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeDasharray="10 8"
            strokeDashoffset={-dashOffset}
            style={{ filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))' }}
          />

          {/* Strategic Target Pulse Rings */}
          <circle cx="985" cy="455" r={pulseRadius} fill="none" stroke="#ef4444" strokeWidth="2" opacity={pulseOpacity} />
          <circle cx="985" cy="455" r={pulseRadius * 0.6} fill="none" stroke="#ef4444" strokeWidth="1.5" opacity={pulseOpacity} />
          <circle cx="985" cy="455" r="7" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 10px #ef4444)' }} />

          {/* Location Callout Pin */}
          <g transform="translate(1010, 430)">
            <rect x="0" y="0" width="180" height="34" rx="4" fill="rgba(15, 23, 42, 0.9)" stroke="#ef4444" strokeWidth="1.5" />
            <text x="12" y="22" fill="#ffffff" fontFamily="'JetBrains Mono', monospace" fontSize="13" fontWeight="bold">
              {scene.visualData?.targetName || 'STRAIT CHOKEPOINT'}
            </text>
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// 9. DATA METRICS & STRATEGIC NUMBERS SCENE
// ==========================================
const DataMetricScene: FC<{ scene: CinematicSceneData; sceneFrame: number }> = ({ scene, sceneFrame }) => {
  const statVal = scene.visualData?.statNumber || "21,000,000";
  const statLabel = scene.visualData?.statLabel || "BARRELS OF OIL PER DAY";
  const statSub = scene.visualData?.statSubtext || "More than 20% of the world's petroleum supply passes through this single corridor.";

  const barWidth = interpolate(sceneFrame, [10, 60], [0, 85], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });

  const rawBg = scene.mediaUrl || '/videos/library/ocean_naval.mp4';
  const bgSrc = (rawBg.startsWith('http://') || rawBg.startsWith('https://') || rawBg.startsWith('data:'))
    ? rawBg
    : staticFile(rawBg.replace(/^\//, ''));
  const isImage = /\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(rawBg);
  const zoom = interpolate(sceneFrame, [0, 240], [1.02, 1.12], { easing: Easing.out(Easing.quad) });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#070b14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Cinematic Photorealistic Background under numbers */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          filter: 'brightness(0.22) contrast(1.25) blur(2.5px) saturate(1.2)',
        }}
      >
        {isImage ? (
          <Img src={bgSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <OffthreadVideo src={bgSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>

      {/* Dark Tactical Grid & Vignette Overlay */}
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
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            fontWeight: 800,
            color: '#38bdf8',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: '16px',
          }}
        >
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

        <h3
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '24px',
            fontWeight: 800,
            color: '#f8fafc',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            margin: '0 0 20px 0',
          }}
        >
          {statLabel}
        </h3>

        <div
          style={{
            width: '600px',
            height: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            borderRadius: '4px',
            margin: '0 auto 28px auto',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${barWidth}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #38bdf8, #f59e0b)',
              borderRadius: '4px',
              boxShadow: '0 0 16px rgba(245, 158, 11, 0.8)',
            }}
          />
        </div>

        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '18px',
            fontWeight: 400,
            color: '#cbd5e1',
            maxWidth: '800px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          {statSub}
        </p>
      </div>

      <FloatingParticleField frame={sceneFrame} type="embers" />
    </AbsoluteFill>
  );
};

// ==========================================
// 10. SCENE 1: CINEMATIC HOOK & TITLE INTRO
// ==========================================
const CinematicHookScene: FC<{ scene: CinematicSceneData; sceneFrame: number; topic: string }> = ({
  sceneFrame,
  topic,
}) => {
  const zoom = interpolate(sceneFrame, [0, 180], [1.0, 1.1], { easing: Easing.out(Easing.quad) });
  const tracking = interpolate(sceneFrame, [0, 90], [2, 8], { easing: Easing.out(Easing.cubic) });
  const opacity = interpolate(sceneFrame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#070b12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
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
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            padding: '6px 16px',
            borderRadius: '20px',
            marginBottom: '24px',
          }}
        >
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              fontWeight: 800,
              color: '#f59e0b',
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            GEOPOLITICAL INVESTIGATION & CHOKEPOINTS
          </span>
        </div>

        <h1
          style={{
            fontFamily: "'Playfair Display', 'Cinzel', serif",
            fontSize: '68px',
            fontWeight: 900,
            color: '#f8fafc',
            letterSpacing: `${tracking}px`,
            textTransform: 'uppercase',
            margin: '0 0 16px 0',
            lineHeight: 1.15,
            textShadow: '0 4px 30px rgba(0, 0, 0, 0.9)',
          }}
        >
          {topic}
        </h1>

        <div
          style={{
            width: '180px',
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #38bdf8, #f59e0b, transparent)',
            margin: '0 auto 24px auto',
            borderRadius: '2px',
          }}
        />

        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '20px',
            fontWeight: 500,
            color: '#cbd5e1',
            maxWidth: '900px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          Strategic Geography • Maritime Security • The Anatomy of Global Power
        </p>
      </div>

      <FloatingParticleField frame={sceneFrame} type="light_leaks" />
    </AbsoluteFill>
  );
};

// ==========================================
// 11. ROCK-SOLID CLOSED CAPTIONS OVERLAY
// ==========================================
const SubtitlesRenderer: FC<{
  cues: SubtitleCueData[];
  frame: number;
  template?: string;
}> = ({ cues, frame }) => {
  const activeCue = useMemo(() => {
    return cues.find((c) => frame >= c.startFrame && frame <= c.endFrame);
  }, [cues, frame]);

  if (!activeCue) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '12%',
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
        <span
          style={{
            fontFamily: "'Inter', 'SF Pro Text', sans-serif",
            fontSize: '34px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.35,
            letterSpacing: '-0.3px',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
          }}
        >
          {activeCue.text}
        </span>
      </div>
    </div>
  );
};

// ==========================================
// 12. MAIN EXPORTED REMOTION COMPOSITION
// ==========================================
export const CinematicDocumentary: FC<CinematicDocumentaryProps> = ({
  title = "THE STRAIT OF HORMUZ: THE WORLD'S DEADLIEST CHOKEPOINT",
  subtitle = "Strategic Geography • Maritime Routes • Global Energy Balance",
  category = "Geopolitics",
  topic = "Strait of Hormuz",
  narrationSrc = "/audio/narration.wav",
  musicSrc = "/audio/bgm/epic_geopolitics.wav",
  subtitlesData,
  captionTemplate = "karaoke-highlight",
  scenes = [],
}) => {
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const resolvedScenes: CinematicSceneData[] = useMemo(() => {
    if (scenes && scenes.length > 0) return scenes;

    const sceneDur = Math.floor(durationInFrames / 5);
    return [
      {
        id: 'scene_001',
        type: 'cinematic_hook',
        badge: '[Motion Graphics]',
        title: title,
        subtitle: subtitle,
        location: 'GLOBAL ARCHIVE',
        coordinates: "26°34'12\"N // 56°15'08\"E",
        startFrame: 0,
        durationFrames: sceneDur,
      },
      {
        id: 'scene_002',
        type: 'video_footage',
        badge: '[Real Video Footage]',
        mediaUrl: '/videos/library/ocean_naval.mp4',
        cameraMovement: 'dolly_in',
        title: 'Geographical Bottlenecks & Naval Corridors',
        subtitle: 'Enclosed between pivotal sovereign powers and narrow maritime straits.',
        location: 'PERSIAN GULF / ARABIAN SEA',
        coordinates: "26°34'12\"N // 56°15'08\"E",
        startFrame: sceneDur,
        durationFrames: sceneDur,
      },
      {
        id: 'scene_003',
        type: 'tactical_map',
        badge: '[Tactical Map]',
        title: 'Maritime Boundaries & Chokepoint Transit',
        subtitle: 'Naval choke lines regulating over twenty percent of petroleum transit.',
        location: 'THEATER MAP RADAR',
        coordinates: "26°34'12\"N // 56°15'08\"E",
        startFrame: sceneDur * 2,
        durationFrames: sceneDur,
      },
      {
        id: 'scene_004',
        type: 'archival_document',
        badge: '[Archival Document]',
        title: 'UN Convention On The Law Of The Sea',
        subtitle: 'Treaty article securing transit passage under sovereign surveillance.',
        location: 'LEGAL INTELLIGENCE DOSSIER',
        coordinates: "UNCLOS_TRANSIT // ARTICLE_38",
        startFrame: sceneDur * 3,
        durationFrames: sceneDur,
      },
      {
        id: 'scene_005',
        type: 'data_metric',
        badge: '[Data Metric]',
        title: 'Daily Petroleum Transit Scale',
        subtitle: 'Over 21,000,000 barrels per day flow through this single passage.',
        location: 'GLOBAL ENERGY METRIC',
        coordinates: "ENERGY_SECURITY // LEVEL_1",
        startFrame: sceneDur * 4,
        durationFrames: durationInFrames - sceneDur * 4,
        visualData: {
          statNumber: "21,000,000",
          statLabel: "BARRELS PER DAY",
          statSubtext: "Any sustained blockage sends instantaneous price shocks into worldwide commodity and financial markets.",
        },
      },
    ];
  }, [scenes, durationInFrames, title, subtitle, topic]);

  // Find active scene
  const activeScene = useMemo(() => {
    return resolvedScenes.find((s) => frame >= s.startFrame && frame < s.startFrame + s.durationFrames) || resolvedScenes[0];
  }, [resolvedScenes, frame]);

  const sceneFrame = frame - (activeScene?.startFrame || 0);

  // Audio setup with BGM
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
      {/* 1. Master Audio System */}
      {audioGroup}

      {/* 2. Dynamic Scene Layers with Fast Shift & Snappy Cuts */}
      {resolvedScenes.map((scene) => {
        const isCurrent = frame >= scene.startFrame && frame < scene.startFrame + scene.durationFrames;
        if (!isCurrent) return null;

        const currentSceneFrame = frame - scene.startFrame;
        const durFrames = scene.durationFrames;

        let sceneContent: React.ReactNode = null;
        if (scene.type === 'video_footage' || scene.type === 'ai_video') {
          sceneContent = (
            <VideoFootageScene
              scene={scene}
              sceneFrame={currentSceneFrame}
              durationFrames={durFrames}
            />
          );
        } else if (scene.type === 'layered_parallax') {
          sceneContent = (
            <LayeredParallaxScene
              scene={scene}
              sceneFrame={currentSceneFrame}
              durationFrames={durFrames}
            />
          );
        } else if (scene.type === 'archival_document') {
          sceneContent = (
            <ArchivalDocumentScene
              scene={scene}
              sceneFrame={currentSceneFrame}
              durationFrames={durFrames}
            />
          );
        } else if (scene.type === 'data_metric') {
          sceneContent = (
            <DataMetricScene
              scene={scene}
              sceneFrame={currentSceneFrame}
            />
          );
        } else if (scene.type === 'cinematic_hook') {
          sceneContent = (
            <CinematicHookScene
              scene={scene}
              sceneFrame={currentSceneFrame}
              topic={topic}
            />
          );
        } else {
          sceneContent = (
            <TacticalMapScene
              scene={scene}
              sceneFrame={currentSceneFrame}
            />
          );
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

      {/* 3. Broadcast Lower Third */}
      {activeScene && activeScene.type !== 'cinematic_hook' && (
        <BroadcastLowerThird scene={activeScene} sceneFrame={sceneFrame} />
      )}

      {/* 4. Tactical Military HUD Overlay */}
      <TacticalHudOverlay frame={frame} topic={topic} category={category} activeScene={activeScene} />

      {/* 5. Closed Captions (CC) */}
      {subtitlesData?.cues && subtitlesData.cues.length > 0 && (
        <SubtitlesRenderer cues={subtitlesData.cues} frame={frame} template={captionTemplate} />
      )}

      {/* 6. Cinematic Post-Processing: 35mm Grain, Vignette & Anamorphic Letterbox */}
      <FilmPostProcessing width={width} height={height} frame={frame} />
    </AbsoluteFill>
  );
};

export default CinematicDocumentary;
