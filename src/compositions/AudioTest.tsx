import {
  Composition,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
  Sequence,
} from "remotion";
import { AudioTrack, AudioTrackGroup } from "../audio/AudioTrack";
import { AnimatedSubtitles } from "../subtitles/AnimatedSubtitles";
import { loadSubtitles, ParsedSubtitles } from "../subtitles/SubtitleParser";
import { AnimatedMap, Timeline, LocationLabel, AnimatedArrow } from "../visuals/DocumentaryVisuals";
import { Flag } from "../visuals/Flag";
import { SimpleCharacter } from "../visuals/CharacterIllustration";
import { FC, useEffect, useState } from "react";

// Test composition - 30 seconds at 30fps = 900 frames
const DURATION_FRAMES = 900;
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

// Simple world map SVG (simplified)
const WorldMapSVG = (
  <svg viewBox="0 0 1920 1080" style={{ width: "100%", height: "100%" }}>
    <defs>
      <clipPath id="mapClip">
        <rect x={0} y={0} width={1920} height={1080} />
      </clipPath>
    </defs>
    {/* Simplified continent shapes */}
    <g clipPath="url(#mapClip)" fill="#d4c4b0" stroke="#8b7355" strokeWidth={1}>
      {/* North America */}
      <path d="M200,150 L350,100 L450,120 L480,200 L420,280 L300,300 L200,250 Z" />
      {/* South America */}
      <path d="M300,320 L380,300 L420,380 L380,550 L280,580 L250,450 Z" />
      {/* Europe */}
      <path d="M750,120 L950,100 L980,180 L920,220 L800,200 L750,150 Z" />
      {/* Africa */}
      <path d="M820,200 L950,180 L1000,280 L980,450 L880,500 L780,380 Z" />
      {/* Asia */}
      <path d="M950,100 L1300,80 L1350,200 L1300,350 L1200,380 L1050,320 L980,250 L950,150 Z" />
      {/* Australia */}
      <path d="M1200,450 L1350,420 L1380,520 L1280,580 L1180,550 Z" />
      {/* Antarctica */}
      <path d="M400,650 L1500,650 L1500,750 L400,750 Z" fill="#e8f0f8" />
    </g>
    {/* Grid lines */}
    <g stroke="#b8a898" strokeWidth={0.5} opacity={0.5}>
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={0} y1={i * 108} x2={1920} y2={i * 108} />
      ))}
      {Array.from({ length: 18 }, (_, i) => (
        <line key={i} x1={i * 106.7} y1={0} x2={i * 106.7} y2={1080} />
      ))}
    </g>
  </svg>
);

// India map SVG (for regional focus)
const IndiaMapSVG = (
  <svg viewBox="0 0 1920 1080" style={{ width: "100%", height: "100%" }}>
    <g fill="#d4c4b0" stroke="#8b7355" strokeWidth={1.5}>
      {/* Simplified India outline */}
      <path d="M600,200 L700,180 L850,200 L950,300 L980,450 L900,600 L700,650 L550,580 L500,400 L520,250 Z" />
      {/* States (simplified) */}
      <path d="M600,220 L700,210 L750,300 L650,350 Z" fill="#c8b8a8" /> {/* J&K */}
      <path d="M700,250 L800,240 L820,350 L720,380 Z" fill="#c8b8a8" /> {/* Punjab */}
      <path d="M550,350 L650,340 L680,450 L580,480 Z" fill="#c8b8a8" /> {/* Rajasthan */}
      <path d="M700,350 L850,340 L880,480 L720,500 Z" fill="#c8b8a8" /> {/* Central */}
      <path d="M600,450 L750,440 L780,580 L620,620 Z" fill="#c8b8a8" /> {/* South */}
    </g>
  </svg>
);

interface AudioTestProps {
  /** Path to narration audio */
  narrationSrc?: string;
  /** Path to background music */
  musicSrc?: string;
  /** Path to SRT subtitles */
  subtitlesSrc?: string;
}

const AudioTest: FC<AudioTestProps> = ({
  narrationSrc = "/audio/narration.wav",
  musicSrc = "/audio/background-music.wav",
  subtitlesSrc = "/subtitles.srt",
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  // Load subtitles
  const [subtitles, setSubtitles] = useState<ParsedSubtitles | null>(null);

  useEffect(() => {
    loadSubtitles(subtitlesSrc, fps).then(setSubtitles).catch(console.error);
  }, [subtitlesSrc, fps]);

  // Scene timing (in frames)
  const scenes = {
    title: { start: 0, end: 90 },           // 3 seconds
    mapIntro: { start: 90, end: 270 },       // 6 seconds
    narration: { start: 270, end: 630 },     // 12 seconds
    timeline: { start: 630, end: 810 },      // 6 seconds
    closing: { start: 810, end: 900 },       // 3 seconds
  };

  const currentScene = Object.entries(scenes).find(
    ([, { start, end }]) => frame >= start && frame < end
  )?.[0] || "closing";

  // Scene progress (0-1)
  const sceneProgress = (sceneName: string) => {
    const scene = scenes[sceneName as keyof typeof scenes];
    if (!scene) return 0;
    const progress = (frame - scene.start) / (scene.end - scene.start);
    return Math.max(0, Math.min(1, progress));
  };

  // Audio tracks
  const audioGroup = (
    <AudioTrackGroup
      narration={narrationSrc ? {
        src: narrationSrc,
        volume: 1.0,
        startFrom: scenes.narration.start,
        fadeIn: 15,
        fadeOut: 15,
        premountFor: fps,
      } : undefined}
      music={musicSrc ? {
        src: musicSrc,
        volume: 0.15,
        startFrom: 0,
        loop: true,
        fadeIn: 30,
        fadeOut: 30,
        premountFor: fps,
      } : undefined}
      soundEffects={[
        // Page turn at scene transitions
        {
          src: "/audio/sound-effects/page-turn.wav",
          volume: 0.3,
          startFrom: scenes.mapIntro.start,
        },
        {
          src: "/audio/sound-effects/page-turn.wav",
          volume: 0.3,
          startFrom: scenes.timeline.start,
        },
      ]}
    />
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#faf8f5" }}>
      {/* Background audio */}
      {audioGroup}

      {/* Scene: Title */}
      {frame >= scenes.title.start && frame < scenes.title.end && (
        <TitleScene progress={sceneProgress("title")} />
      )}

      {/* Scene: Map Introduction */}
      {frame >= scenes.mapIntro.start && frame < scenes.mapIntro.end && (
        <MapIntroScene progress={sceneProgress("mapIntro")} />
      )}

      {/* Scene: Narration with Map */}
      {frame >= scenes.narration.start && frame < scenes.narration.end && (
        <NarrationScene
          progress={sceneProgress("narration")}
          subtitles={subtitles}
        />
      )}

      {/* Scene: Timeline */}
      {frame >= scenes.timeline.start && frame < scenes.timeline.end && (
        <TimelineScene progress={sceneProgress("timeline")} />
      )}

      {/* Scene: Closing */}
      {frame >= scenes.closing.start && frame < scenes.closing.end && (
        <ClosingScene progress={sceneProgress("closing")} />
      )}

      {/* Debug info */}
      <DebugOverlay
        frame={frame}
        duration={durationInFrames}
        fps={fps}
        scene={currentScene}
        subtitles={subtitles}
      />
    </AbsoluteFill>
  );
};

// ===== Scene Components =====

const TitleScene: FC<{ progress: number }> = ({ progress }) => {
  const fadeIn = interpolate(progress, [0, 0.3], [0, 1], { extrapolateLeft: "clamp" });
  const fadeOut = interpolate(progress, [0.7, 1], [1, 0], { extrapolateRight: "clamp" });
  const opacity = fadeIn * fadeOut;
  const slideY = interpolate(progress, [0, 0.2, 0.8, 1], [50, 0, 0, -50], {
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `translateY(${slideY}px)`,
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      }}
    >
      <div style={{ textAlign: "center", padding: "0 100px" }}>
        <FlagIcon countryCode="IN" size={120} style={{ marginBottom: "20px", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }} />
        <h1
          style={{
            fontFamily: "'Noto Sans', 'SF Pro Display', sans-serif",
            fontSize: "72px",
            fontWeight: 700,
            color: "#fff",
            margin: "0 0 20px",
            letterSpacing: "2px",
            textShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          INDIA'S GEOPOLITICAL JOURNEY
        </h1>
        <div
          style={{
            width: "200px",
            height: "3px",
            background: "linear-gradient(90deg, #FF9933, #FFFFFF, #138808)",
            margin: "0 auto 30px",
            borderRadius: "2px",
          }}
        />
        <p
          style={{
            fontFamily: "'Noto Sans', sans-serif",
            fontSize: "28px",
            color: "rgba(255,255,255,0.8)",
            margin: 0,
            maxWidth: "800px",
          }}
        >
          From Independence to Global Power: A Documentary History
        </p>
      </div>
    </AbsoluteFill>
  );
};

const MapIntroScene: FC<{ progress: number }> = ({ progress }) => {
  const mapScale = interpolate(progress, [0, 0.5, 1], [0.5, 1.05, 1], {
    easing: Easing.out(Easing.cubic),
  });
  const mapOpacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f0ebe0",
      }}
    >
      <div
        style={{
          transform: `scale(${mapScale})`,
          transformOrigin: "center center",
          opacity: mapOpacity,
          filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.15))",
        }}
      >
        <AnimatedMap
          mapSvg={WorldMapSVG}
          width={1600}
          height={900}
          backgroundColor="transparent"
          camera={{
            x: 0.5,
            y: 0.45,
            zoom: interpolate(progress, [0, 1], [1.5, 1], { easing: Easing.out(Easing.quad) }),
            duration: 180,
          }}
          regions={[
            {
              id: "india",
              path: "M600,200 L700,180 L850,200 L950,300 L980,450 L900,600 L700,650 L550,580 L500,400 L520,250 Z",
              name: "India",
              color: "#c0392b",
              animation: "pulse",
              animationDelay: 60,
              animationDuration: 120,
            },
          ]}
          markers={[
            {
              id: "new-delhi",
              x: 0.42,
              y: 0.32,
              label: "New Delhi",
              type: "pin",
              color: "#e74c3c",
              size: 16,
              animation: "bounce",
              animationDelay: 90,
              animationDuration: 45,
            },
            {
              id: "mumbai",
              x: 0.38,
              y: 0.45,
              label: "Mumbai",
              type: "dot",
              color: "#3498db",
              size: 12,
              animation: "fade",
              animationDelay: 105,
              animationDuration: 30,
            },
            {
              id: "kolkata",
              x: 0.5,
              y: 0.4,
              label: "Kolkata",
              type: "dot",
              color: "#2ecc71",
              size: 12,
              animation: "fade",
              animationDelay: 120,
              animationDuration: 30,
            },
          ]}
        />
      </div>

      {/* Title overlay */}
      <div
        style={{
          position: "absolute",
          top: "60px",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: interpolate(progress, [0.3, 0.6], [0, 1], { extrapolateLeft: "clamp" }),
        }}
      >
        <h2 style={{ fontFamily: "'Noto Sans', sans-serif", fontSize: "36px", fontWeight: 600, color: "#1a1a2e", margin: "0 0 8px" }}>
          The Indian Subcontinent
        </h2>
        <p style={{ fontFamily: "'Noto Sans', sans-serif", fontSize: "18px", color: "#555", margin: 0 }}>
          Strategic location between East and West
        </p>
      </div>
    </AbsoluteFill>
  );
};

const NarrationScene: FC<{ progress: number; subtitles: ParsedSubtitles | null }> = ({
  progress,
  subtitles,
}) => {
  // India map with animated regions
  const mapOpacity = interpolate(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#f5f0e8" }}>
      {/* Main map */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: mapOpacity,
        }}
      >
        <AnimatedMap
          mapSvg={IndiaMapSVG}
          width={1400}
          height={800}
          backgroundColor="transparent"
          regions={[
            { id: "jammu-kashmir", path: "M600,220 L700,210 L750,300 L650,350 Z", name: "Jammu & Kashmir", animation: "fill", animationDelay: 30 },
            { id: "punjab", path: "M700,250 L800,240 L820,350 L720,380 Z", name: "Punjab", animation: "fill", animationDelay: 60 },
            { id: "rajasthan", path: "M550,350 L650,340 L680,450 L580,480 Z", name: "Rajasthan", animation: "fill", animationDelay: 90 },
            { id: "central", path: "M700,350 L850,340 L880,480 L720,500 Z", name: "Central India", animation: "fill", animationDelay: 120 },
            { id: "south", path: "M600,450 L750,440 L780,580 L620,620 Z", name: "South India", animation: "fill", animationDelay: 150 },
          ]}
          markers={[
            { id: "delhi", x: 0.38, y: 0.25, label: "Delhi", type: "pin", color: "#e74c3c", size: 14, animation: "bounce", animationDelay: 180 },
            { id: "mumbai", x: 0.28, y: 0.45, label: "Mumbai", type: "dot", color: "#3498db", size: 10, animation: "fade", animationDelay: 200 },
            { id: "kolkata", x: 0.55, y: 0.38, label: "Kolkata", type: "dot", color: "#2ecc71", size: 10, animation: "fade", animationDelay: 220 },
            { id: "chennai", x: 0.4, y: 0.62, label: "Chennai", type: "dot", color: "#f39c12", size: 10, animation: "fade", animationDelay: 240 },
            { id: "bangalore", x: 0.37, y: 0.55, label: "Bengaluru", type: "dot", color: "#9b59b6", size: 10, animation: "fade", animationDelay: 260 },
          ]}
        />
      </div>

      {/* Side info panel */}
      <div
        style={{
          position: "absolute",
          right: "60px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "350px",
          opacity: interpolate(progress, [0, 0.2], [0, 1], { extrapolateLeft: "clamp" }),
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.95)",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            borderLeft: "4px solid #c0392b",
          }}
        >
          <FlagIcon countryCode="IN" size={60} style={{ marginBottom: "16px" }} />
          <h3 style={{ fontFamily: "'Noto Sans', sans-serif", fontSize: "22px", fontWeight: 600, color: "#1a1a2e", margin: "0 0 8px" }}>
            Republic of India
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontFamily: "'Noto Sans', sans-serif", fontSize: "14px", color: "#444" }}>
            <div><strong>Capital:</strong> New Delhi</div>
            <div><strong>Population:</strong> 1.43 Billion (2024)</div>
            <div><strong>Area:</strong> 3.287M km²</div>
            <div><strong>GDP:</strong> $3.73 Trillion</div>
            <div><strong>Independence:</strong> 15 Aug 1947</div>
          </div>
        </div>
      </div>

      {/* Animated subtitles at bottom */}
      {subtitles && (
        <AnimatedSubtitles
          subtitles={subtitles}
          animation="slide-up"
          animationDuration={20}
          style={{
            fontSize: 48,
            bottom: "12%",
            maxCharsPerLine: 48,
            maxLines: 2,
            backgroundColor: "rgba(26, 26, 46, 0.85)",
            backgroundPadding: 20,
            backgroundBorderRadius: 10,
          }}
        />
      )}

      {/* Location labels */}
      <LocationLabel
        x={760}
        y={280}
        text="Kashmir Region"
        animation="slide"
        animationDelay={60}
        animationDuration={40}
        style={{ backgroundColor: "rgba(192, 57, 43, 0.9)", color: "#fff", fontSize: 14 }}
      />
      <LocationLabel
        x={500}
        y={450}
        text="Thar Desert"
        animation="slide"
        animationDelay={100}
        animationDuration={40}
        style={{ backgroundColor: "rgba(230, 126, 34, 0.9)", color: "#fff", fontSize: 14 }}
      />
    </AbsoluteFill>
  );
};

const TimelineScene: FC<{ progress: number }> = ({ progress }) => {
  const events = [
    { id: "1947", date: "1947", year: 1947, title: "Independence & Partition", color: "#c0392b" },
    { id: "1950", date: "1950", year: 1950, title: "Constitution Adopted", color: "#2980b9" },
    { id: "1962", date: "1962", year: 1962, title: "Sino-Indian War", color: "#e74c3c" },
    { id: "1971", date: "1971", year: 1971, title: "Bangladesh Liberation", color: "#27ae60" },
    { id: "1974", date: "1974", year: 1974, title: "First Nuclear Test", color: "#8e44ad" },
    { id: "1991", date: "1991", year: 1991, title: "Economic Liberalization", color: "#f39c12" },
    { id: "1998", date: "1998", year: 1998, title: "Pokhran-II Tests", color: "#8e44ad" },
    { id: "2014", date: "2014", year: 2014, title: "Modi Government", color: "#ff9933" },
    { id: "2023", date: "2023", year: 2023, title: "G20 Presidency", color: "#138808" },
  ];

  return (
    <AbsoluteFill style={{ background: "#faf8f5" }}>
      <div style={{ position: "absolute", top: "60px", left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Noto Sans', sans-serif", fontSize: "36px", fontWeight: 600, color: "#1a1a2e", margin: "0 0 8px" }}>
          Key Milestones
        </h2>
        <p style={{ fontFamily: "'Noto Sans', sans-serif", fontSize: "18px", color: "#666", margin: 0 }}>
          1947 — 2024
        </p>
      </div>

      <div style={{ position: "absolute", top: "160px", left: "50%", transform: "translateX(-50%)" }}>
        <Timeline
          events={events}
          yearRange={[1947, 2024]}
          orientation="horizontal"
          width={1600}
          height={300}
          animationDuration={40}
          staggerDelay={20}
          lineColor="#c0392b"
          lineWidth={4}
          yearMarkerInterval={10}
        />
      </div>

      {/* Arrow highlighting current period */}
      {progress > 0.5 && (
        <AnimatedArrow
          from={{ x: 800, y: 500 }}
          to={{ x: 1400, y: 500 }}
          color="#c0392b"
          strokeWidth={3}
          headSize={16}
          animation="draw"
          animationDuration={60}
          animationDelay={120}
          label="Modern Era"
          labelPosition={0.5}
          labelOffset={-40}
        />
      )}
    </AbsoluteFill>
  );
};

const ClosingScene: FC<{ progress: number }> = ({ progress }) => {
  const fadeIn = interpolate(progress, [0, 0.3], [0, 1], { extrapolateLeft: "clamp" });
  const scale = interpolate(progress, [0, 0.5, 1], [0.8, 1.02, 1], { easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeIn,
        transform: `scale(${scale})`,
        background: "linear-gradient(135deg, #0f3460 0%, #16213e 50%, #1a1a2e 100%)",
      }}
    >
      <Flag countryCode="IN" width={200} animation="wave" animationDuration={180} />
      <h1
        style={{
          fontFamily: "'Noto Sans', 'SF Pro Display', sans-serif",
          fontSize: "64px",
          fontWeight: 700,
          color: "#fff",
          margin: "30px 0 16px",
          textShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}
      >
        Thank You
      </h1>
      <div
        style={{
          width: "150px",
          height: "2px",
          background: "linear-gradient(90deg, #FF9933, #FFFFFF, #138808)",
          margin: "0 0 30px",
        }}
      />
      <p
        style={{
          fontFamily: "'Noto Sans', sans-serif",
          fontSize: "24px",
          color: "rgba(255,255,255,0.7)",
          margin: 0,
        }}
      >
        Produced with Remotion • Local Video Production System
      </p>
    </AbsoluteFill>
  );
};

// Debug overlay (only visible in development)
const DebugOverlay: FC<{
  frame: number;
  duration: number;
  fps: number;
  scene: string;
  subtitles: ParsedSubtitles | null;
}> = ({ frame, duration, fps, scene, subtitles }) => {
  if (process.env.NODE_ENV === "production") return null;

  const activeCue = subtitles ? subtitles.cues.find(c => frame >= c.startFrame && frame < c.endFrame) : null;

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        background: "rgba(0,0,0,0.8)",
        color: "#0f0",
        padding: "12px 16px",
        borderRadius: "6px",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: "12px",
        lineHeight: "1.6",
        zIndex: 1000,
        pointerEvents: "none",
        minWidth: "280px",
      }}
    >
      <div><strong>Frame:</strong> {frame} / {duration}</div>
      <div><strong>Time:</strong> { (frame / fps).toFixed(2) }s / { (duration / fps).toFixed(2) }s</div>
      <div><strong>FPS:</strong> {fps}</div>
      <div><strong>Scene:</strong> {scene}</div>
      <div><strong>Progress:</strong> { ((frame / duration) * 100).toFixed(1) }%</div>
      {activeCue && (
        <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #333" }}>
          <div><strong>Subtitle:</strong> {activeCue.index}</div>
          <div><strong>Text:</strong> {activeCue.text.substring(0, 50)}...</div>
          <div><strong>Time:</strong> {activeCue.startTime.toFixed(1)}s - {activeCue.endTime.toFixed(1)}s</div>
        </div>
      )}
    </div>
  );
};

const FlagIcon: FC<{ countryCode: string; size?: number; style?: React.CSSProperties }> = ({
  countryCode,
  size = 64,
  style,
}) => {
  // Reuse flag definitions from Flag component
  const flagDef = (window as any).__FLAG_REGISTRY?.[countryCode.toUpperCase()];
  // Simplified inline for demo
  const h = size * 2 / 3;

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} style={{ display: "block", ...style }}>
      <rect x={0} y={0} width={size} height={h / 3} fill="#FF9933" />
      <rect x={0} y={h / 3} width={size} height={h / 3} fill="#FFFFFF" />
      <rect x={0} y={2 * h / 3} width={size} height={h / 3} fill="#138808" />
      <circle cx={size / 2} cy={h / 2} r={h / 6} fill="none" stroke="#000080" strokeWidth={Math.max(1, h / 90)} />
      {Array.from({ length: 24 }, (_, i) => (
        <line
          key={i}
          x1={size / 2}
          y1={h / 2}
          x2={size / 2 + (h / 6) * Math.cos(i * Math.PI / 12 - Math.PI / 2)}
          y2={h / 2 + (h / 6) * Math.sin(i * Math.PI / 12 - Math.PI / 2)}
          stroke="#000080"
          strokeWidth={Math.max(0.5, h / 180)}
        />
      ))}
    </svg>
  );
};

export { AudioTest };
export default AudioTest;

// Composition registration
export const AudioTestComposition: FC = () => (
  <Composition
    id="AudioTest"
    component={AudioTest}
    durationInFrames={DURATION_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={{
      narrationSrc: "/audio/narration.wav",
      musicSrc: "/audio/background-music.wav",
      subtitlesSrc: "/subtitles.srt",
    }}
  />
);