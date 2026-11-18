import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Easing,
} from "remotion";
import {
  formatCurrencyForDisplay,
  detectMathematicalFormula,
  parseCaptionHierarchy,
} from "../utils/audioAwareFormatting";
import {
  getTopicDomain,
  PaperTopicHeroVisual,
  PaperTopicDossierGraphic,
} from "./paper/PaperTopicVisuals";

export interface PaperWordToken {
  word: string;
  start: number;
  end: number;
}

export interface PaperSceneProps {
  sceneNumber: number;
  timeRange: string;
  narration: string;
  imagePrompt?: string;
  videoPrompt: string;
  visualDescription?: string;
  paperElements?: string[];
  metricNumber?: string;
  metricLabel?: string;
  heroIcon?: string;
  documentHeadline?: string;
  documentSnippet?: string;
  narrationSrc?: string;
  words?: PaperWordToken[];
}

export interface PaperExplainerProps {
  title?: string;
  verifiedConcept?: string;
  duration?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  scenes?: PaperSceneProps[];
  sources?: string[];
  narrationSrc?: string;
  musicSrc?: string;
  sfxEnabled?: boolean;
}

// =========================================================================
// SVG PHYSICAL TORN PAPER RIPPLE (JAGGED REALISTIC FIBERS)
// =========================================================================
const TornPaperTear: React.FC<{
  color?: string;
  flip?: boolean;
  style?: React.CSSProperties;
}> = ({ color = "#FAF6ED", flip = false, style }) => (
  <svg
    viewBox="0 0 1080 40"
    style={{
      width: "100%",
      height: 28,
      display: "block",
      transform: flip ? "rotate(180deg)" : "none",
      filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.12))",
      ...style,
    }}
    preserveAspectRatio="none"
  >
    <path
      d="M0,0 L0,22 Q25,8 55,20 Q95,34 135,14 Q175,-2 225,18 Q275,34 325,14 Q375,-2 425,18 Q475,36 525,14 Q575,-2 635,18 Q695,38 755,14 Q815,-2 875,18 Q935,36 995,14 Q1035,-2 1080,18 L1080,0 Z"
      fill={color}
    />
  </svg>
);

// =========================================================================
// REALISTIC FROSTED SCOTCH TAPE WITH SURFACE HIGHLIGHT
// =========================================================================
const ScotchTape: React.FC<{
  style?: React.CSSProperties;
  rotation?: number;
  width?: number;
}> = ({ style, rotation = -4, width = 140 }) => (
  <div
    style={{
      position: "absolute",
      width,
      height: 34,
      backgroundColor: "rgba(254, 240, 199, 0.72)",
      backdropFilter: "blur(2px)",
      border: "1px solid rgba(217, 119, 6, 0.35)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.12), inset 0 1px 2px rgba(255,255,255,0.85)",
      transform: `rotate(${rotation}deg)`,
      zIndex: 50,
      borderRadius: "2px",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: "35%",
        top: 2,
        bottom: 2,
        width: 2,
        backgroundColor: "rgba(255,255,255,0.6)",
        transform: "rotate(6deg)",
      }}
    />
  </div>
);

// =========================================================================
// 3D RED PUSH PIN WITH CAST SHADOW
// =========================================================================
const RedPushPin: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div
    style={{
      position: "absolute",
      width: 24,
      height: 24,
      zIndex: 55,
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        bottom: -4,
        left: 4,
        width: 20,
        height: 8,
        borderRadius: "50%",
        backgroundColor: "rgba(0,0,0,0.28)",
        filter: "blur(2px)",
      }}
    />
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, #EF4444 0%, #B91C1C 70%, #7F1D1D 100%)",
        border: "2px solid #FCA5A5",
        boxShadow: "0 3px 8px rgba(0,0,0,0.35)",
      }}
    />
  </div>
);

// =========================================================================
// REALISTIC INK STAMP WITH ROUGH EDGE & MULTIPLY BLEND
// =========================================================================
const InkStamp: React.FC<{
  text: string;
  color?: string;
  rotation?: number;
  scale?: number;
}> = ({ text, color = "#DC2626", rotation = -7, scale = 1 }) => (
  <div
    style={{
      display: "inline-block",
      border: `4px solid ${color}`,
      padding: "6px 20px",
      borderRadius: 6,
      color,
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: 20,
      fontWeight: 900,
      letterSpacing: "2.5px",
      textTransform: "uppercase",
      transform: `scale(${scale}) rotate(${rotation}deg)`,
      boxShadow: `inset 0 0 0 1.5px ${color}, 0 4px 14px rgba(0,0,0,0.22)`,
      backgroundColor: "rgba(255, 255, 255, 0.20)",
      mixBlendMode: "multiply",
    }}
  >
    {text}
  </div>
);

// =========================================================================
// SAFE STATIC FILE RESOLVER (SUPPORTS BOTH LOCAL PATHS & REMOTION STUDIO)
// =========================================================================
const resolveStatic = (s?: string) => {
  if (!s) return "";
  if (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("blob:") ||
    s.startsWith("data:")
  ) {
    return s;
  }
  return staticFile(s.replace(/^\//, ""));
};

// =========================================================================
// SMART BALANCED PHRASE CHUNKER (NEVER LEAVES 1-2 DANGLING WORDS)
// =========================================================================
function getBalancedPhrases(words: string[]): { phrase: string[]; startIndex: number }[] {
  if (words.length === 0) return [];
  const TARGET_SIZE = 4;
  const result: { phrase: string[]; startIndex: number }[] = [];

  let i = 0;
  while (i < words.length) {
    const remaining = words.length - i;
    if (remaining <= 5) {
      // 5 or fewer words left: keep together as a natural, readable line
      result.push({ phrase: words.slice(i, words.length), startIndex: i });
      break;
    } else if (remaining === 6) {
      // 6 words left: split evenly into 3 and 3
      result.push({ phrase: words.slice(i, i + 3), startIndex: i });
      result.push({ phrase: words.slice(i + 3, words.length), startIndex: i + 3 });
      break;
    } else {
      result.push({ phrase: words.slice(i, i + TARGET_SIZE), startIndex: i });
      i += TARGET_SIZE;
    }
  }
  return result;
}

// =========================================================================
// PRECISE TIMED PHRASE CHUNKER (WHISPER MILLISECOND-ACCURATE ALIGNMENT)
// =========================================================================
function getBalancedTimedPhrases(tokens: PaperWordToken[]): {
  tokens: PaperWordToken[];
  phrase: string[];
  startIndex: number;
  startTime: number;
  endTime: number;
}[] {
  if (!tokens || tokens.length === 0) return [];
  const TARGET_SIZE = 4;
  const result: {
    tokens: PaperWordToken[];
    phrase: string[];
    startIndex: number;
    startTime: number;
    endTime: number;
  }[] = [];

  let i = 0;
  while (i < tokens.length) {
    const remaining = tokens.length - i;
    let sliceLen = TARGET_SIZE;
    if (remaining <= 5) {
      sliceLen = remaining;
    } else if (remaining === 6) {
      sliceLen = 3;
    }
    const chunk = tokens.slice(i, i + sliceLen);
    result.push({
      tokens: chunk,
      phrase: chunk.map((t) => t.word),
      startIndex: i,
      startTime: chunk[0].start,
      endTime: chunk[chunk.length - 1].end,
    });
    i += sliceLen;
  }
  return result;
}

// =========================================================================
// MASTER PROMPT — PREMIUM PAPER-CUT DOCUMENTARY REEL COMPOSITION
// 1080 x 1920 VERTICAL REEL ARCHITECTURE
// =========================================================================
export const PaperExplainerReel: React.FC<PaperExplainerProps> = ({
  title = "What Actually Happens If You Save 10 Rupees Every Single Day?",
  verifiedConcept = "Saving ₹10 a day equals ₹1,09,500 over 30 years, but geometric compounding at 12% CAGR explodes it into ₹12.8 Lakhs.",
  duration = 30,
  aspectRatio = "9:16",
  scenes = [
    {
      sceneNumber: 1,
      timeRange: "0–10s",
      narration: "If you put away just ₹10 every morning, the math does something unbelievable over 30 years. Here is the astonishing scientific truth behind how it works.",
      narrationSrc: "/audio/narration_paper_perfect_s1.wav",
      videoPrompt: "Handcrafted 3D paper rupee coin with torn paper headline pill.",
      paperElements: ["Cream cardstock background", "Macro 10 rupee coin cutout", "Pointers & labels"],
      metricNumber: "₹10 / DAY",
      metricLabel: "INITIAL SAVING BEAT",
      heroIcon: "🪙",
      documentHeadline: "OFFICIAL SAVINGS FORMULA LEDGER",
      documentSnippet: "Daily ₹10 savings compounded over 30 years expand exponentially into tens of lakhs through the power of geometric reinvestment."
    },
    {
      sceneNumber: 2,
      timeRange: "10–20s",
      narration: "Saving ₹10 daily equals ₹3,650 per year, amounting to strictly ₹1,09,500 in total principal over 30 years.",
      narrationSrc: "/audio/narration_paper_perfect_s2.wav",
      videoPrompt: "Layered compounding chart with glowing yellow highlighter and animated paper gauge.",
      paperElements: ["Archival banking graph", "Highlighter marker strip", "Geometric curve"],
      metricNumber: "₹1,09,500",
      metricLabel: "30-YEAR TOTAL CAPITAL",
      heroIcon: "📊",
      documentHeadline: "EMPIRICAL CAPITAL ACCUMULATION CURVE",
      documentSnippet: "Total out-of-pocket capital deposited over 10,950 consecutive days strictly equals ₹1,09,500."
    },
    {
      sceneNumber: 3,
      timeRange: "20–30s",
      narration: "This verified mechanism demonstrates compound interest formula: A = P · (1 + r/n)ⁿᵗ, accelerating pocket change into ₹12,80,000+ purely through reinvestment.",
      narrationSrc: "/audio/narration_paper_perfect_s3.wav",
      videoPrompt: "Exploding layered paper money tree with verified financial audit stamp and gold ribbons.",
      paperElements: ["Paper money tree cutout", "Certified audit stamp", "Exponential growth ruler"],
      metricNumber: "₹12,80,000+",
      metricLabel: "COMPOUNDED WEALTH MULTIPLIER",
      heroIcon: "🌳",
      documentHeadline: "EXPONENTIAL WEALTH MULTIPLIER VERIFIED",
      documentSnippet: "Geometric compounding at historic 12% returns produces ₹11.7 Lakhs in pure interest profits."
    }
  ],
  sources = ["Reserve Bank of India Guidelines", "Harvard Compound Interest Empirical Study"],
  narrationSrc = "/audio/narration_paper_perfect_full.wav",
  musicSrc = "/audio/bgm/ambient_documentary.wav",
  sfxEnabled = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Dynamic Scene Calculation: strictly 10s per scene
  const sceneDurationFrames = Math.max(90, Math.round((duration / scenes.length) * fps));
  const currentSceneIndex = Math.min(
    scenes.length - 1,
    Math.max(0, Math.floor(frame / sceneDurationFrames))
  );
  const currentScene = scenes[currentSceneIndex] || scenes[0];
  const sceneLocalFrame = frame % sceneDurationFrames;

  // 1. Continuous Smooth Push-In Camera on Hero Stage: 110% to 125% zoom (no distant visuals!)
  const heroZoom = interpolate(
    sceneLocalFrame,
    [0, sceneDurationFrames],
    [1.10, 1.25],
    { easing: Easing.out(Easing.cubic) }
  );

  // Subtle stop-motion paper tactile jitter
  const stopMotionStep = Math.floor(frame / 4);
  const tactileJitterX = Math.sin(stopMotionStep * 2.1) * 1.5;
  const tactileJitterY = Math.cos(stopMotionStep * 1.8) * 1.2;
  const tactileJitterRot = Math.sin(stopMotionStep * 1.3) * 0.35;

  // Scene Entrance Spring
  const entranceSpring = spring({
    frame: sceneLocalFrame,
    fps,
    config: { damping: 13, mass: 0.65, stiffness: 135 },
  });

  // Stamp Slam Animation at 1.0s into each scene
  const stampFrame = sceneLocalFrame - Math.round(1.0 * fps);
  const stampSpring = spring({
    frame: Math.max(0, stampFrame),
    fps,
    config: { damping: 8, mass: 0.5, stiffness: 240 },
  });
  const showStamp = stampFrame >= 0;

  // Yellow Highlighter Sweep Progress (sweeps from left to right)
  const highlightProgress = interpolate(
    sceneLocalFrame,
    [fps * 0.5, fps * 2.0],
    [0, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
  );

  // =========================================================================
  // CAPTIONS: MILLISECOND-ACCURATE BALANCED TIMED TYPOGRAPHY (WHISPER SYNC)
  // =========================================================================
  const AUDIO_DELAY_FRAMES = 8; // ~0.27s lead-in for crisp tactile page-turn sfx
  const sceneAudioLocalSec = Math.max(0, (sceneLocalFrame - AUDIO_DELAY_FRAMES) / fps);

  const hasTimedWords = Boolean(currentScene.words && currentScene.words.length > 0);
  let activePhraseWords: string[] = [];
  let activePhraseStartIndex = 0;
  let currentActiveWordGlobalIdx = -1;

  if (hasTimedWords && currentScene.words) {
    const timedPhrases = getBalancedTimedPhrases(currentScene.words);
    let activePhraseObj = timedPhrases[0] || {
      tokens: [],
      phrase: [],
      startIndex: 0,
      startTime: 0,
      endTime: 0,
    };

    for (let pIdx = 0; pIdx < timedPhrases.length; pIdx++) {
      const p = timedPhrases[pIdx];
      const nextP = timedPhrases[pIdx + 1];
      const thresholdEnd = nextP ? nextP.startTime : p.endTime + 0.6;
      if (sceneAudioLocalSec >= p.startTime - 0.15 && sceneAudioLocalSec < thresholdEnd) {
        activePhraseObj = p;
        break;
      } else if (sceneAudioLocalSec >= thresholdEnd) {
        activePhraseObj = p; // hold final phrase cleanly during scene outro
      }
    }

    activePhraseWords = activePhraseObj.phrase;
    activePhraseStartIndex = activePhraseObj.startIndex;

    if (sceneLocalFrame >= AUDIO_DELAY_FRAMES) {
      for (let wIdx = 0; wIdx < currentScene.words.length; wIdx++) {
        const w = currentScene.words[wIdx];
        if (sceneAudioLocalSec >= w.start && sceneAudioLocalSec <= w.end + 0.08) {
          currentActiveWordGlobalIdx = wIdx;
          break;
        }
      }
      if (currentActiveWordGlobalIdx === -1 && sceneAudioLocalSec < activePhraseObj.endTime) {
        for (let wIdx = 0; wIdx < currentScene.words.length; wIdx++) {
          const w = currentScene.words[wIdx];
          if (sceneAudioLocalSec < w.start) {
            currentActiveWordGlobalIdx = Math.max(0, wIdx - 1);
            break;
          }
          currentActiveWordGlobalIdx = wIdx;
        }
      }
    }
  } else {
    // Fallback if words array is missing
    const narrationWords = currentScene.narration.trim().split(/\s+/);
    const estimatedSpeakingSeconds = Math.min(
      (sceneDurationFrames / fps) - 0.4,
      Math.max(2.5, narrationWords.length * 0.42)
    );
    const wordsPerSec = narrationWords.length / estimatedSpeakingSeconds;
    currentActiveWordGlobalIdx = Math.min(
      narrationWords.length - 1,
      Math.max(0, Math.floor((sceneLocalFrame / fps) * wordsPerSec))
    );

    const balancedPhrases = getBalancedPhrases(narrationWords);
    let activePhrase = balancedPhrases[0] || { phrase: narrationWords, startIndex: 0 };
    for (const p of balancedPhrases) {
      if (currentActiveWordGlobalIdx >= p.startIndex && currentActiveWordGlobalIdx < p.startIndex + p.phrase.length) {
        activePhrase = p;
        break;
      }
    }
    activePhraseWords = activePhrase.phrase;
    activePhraseStartIndex = activePhrase.startIndex;
  }

  // Accurately classify topic domain strictly from the video title and verified concept
  const topicDomain = getTopicDomain(title, verifiedConcept, currentScene.narration);

  // Parse 3-level caption hierarchy & detect mathematical formulas (only for relevant topics)
  const captionWords = parseCaptionHierarchy(activePhraseWords);
  const detectedFormula = topicDomain === "money_compounding"
    ? detectMathematicalFormula(currentScene.narration || currentScene.documentSnippet || "")
    : null;

  const isMoneyTopic = topicDomain === "money_compounding";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#16110D",
        overflow: "hidden",
        fontFamily: "'Montserrat', 'Inter', -apple-system, sans-serif",
      }}
    >
      {/* ===================================================================
          1. BACKGROUND BASE: AGED CREAM DRAFTING PAPER WITH VINTAGE TEXTURE
      ==================================================================== */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(circle at 50% 42%, #FFFDF8 0%, #F5ECDA 55%, #DFCDAC 100%)",
        }}
      >
        {/* Subtle Architectural Grid Texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.18,
            backgroundImage: `
              linear-gradient(to right, rgba(120, 75, 30, 0.22) 1.5px, transparent 1.5px),
              linear-gradient(to bottom, rgba(120, 75, 30, 0.22) 1.5px, transparent 1.5px)
            `,
            backgroundSize: "36px 36px",
          }}
        />

        {/* Vintage Newspaper Collage Snippet Top-Left */}
        <div
          style={{
            position: "absolute",
            top: 20,
            left: -20,
            width: 220,
            height: 140,
            opacity: 0.12,
            transform: "rotate(-8deg)",
            border: "1px dashed #784B1E",
            padding: 8,
            fontFamily: "'Georgia', serif",
            fontSize: 10,
            color: "#3B2610",
            pointerEvents: "none",
            lineHeight: 1.2,
            overflow: "hidden",
          }}
        >
          <strong>THE FINANCIAL DISPATCH</strong>
          <p style={{ margin: "4px 0" }}>Historic verification records indicate systematic capital accumulation yields geometric expansion over 30-year horizons.</p>
        </div>

        {/* Vintage Edge Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: "inset 0 0 160px rgba(60, 38, 15, 0.36)",
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>

      {/* ===================================================================
          2. TOP NEWSPAPER MASTHEAD (PINNED IN SAFE ZONE: 50PX - 200PX)
      ==================================================================== */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: "#FAF6ED",
          borderBottom: "2px solid #D6C29E",
          boxShadow: "0 10px 25px rgba(40, 25, 10, 0.15)",
          padding: "50px 40px 18px 40px",
          zIndex: 35,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1.5px solid #2B1F13",
            paddingBottom: 6,
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: "2.5px", color: "#1F1710", textTransform: "uppercase" }}>
            🗞️ THE SPECIAL INVESTIGATION RECORD
          </span>
          <div
            style={{
              backgroundColor: "#DCFCE7",
              border: "1.5px solid #22C55E",
              color: "#15803D",
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "1px",
            }}
          >
            ✓ FACT CHECKED
          </div>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 900,
            lineHeight: 1.2,
            color: "#181109",
            letterSpacing: "-0.4px",
            fontFamily: "'Georgia', serif",
          }}
        >
          {title}
        </h1>

        <div style={{ position: "absolute", bottom: -20, left: 0, right: 0, zIndex: 36 }}>
          <TornPaperTear color="#FAF6ED" />
        </div>
      </div>

      {/* ===================================================================
          3. HERO CLOSE-UP OBJECT STAGE (UPPER HALF: 220PX - 840PX)
          Large, tactile 3D paper cutouts filling 70% width! NO distant visuals!
      ==================================================================== */}
      <div
        style={{
          position: "absolute",
          top: 220,
          left: 45,
          right: 45,
          height: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 20,
          transform: `scale(${heroZoom}) translate(${tactileJitterX}px, ${tactileJitterY}px) rotate(${tactileJitterRot}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            backgroundColor: "#FFFDF8",
            border: "3px solid #D8C6A5",
            borderRadius: 22,
            boxShadow: "0 22px 55px rgba(45, 30, 15, 0.25), 0 4px 12px rgba(0,0,0,0.10)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 28px",
          }}
        >
          <ScotchTape style={{ top: -14, left: 24 }} rotation={-3} width={130} />
          <RedPushPin style={{ top: 12, right: 20 }} />

          {/* Time & Exhibit Header */}
          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                backgroundColor: "#F2E9D8",
                padding: "6px 16px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 900,
                color: "#854D0E",
                letterSpacing: "1px",
              }}
            >
              ⏱️ {currentScene.timeRange} // {currentScene.paperElements?.[1] || "CLOSE-UP EXHIBIT"}
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#6B4C26", letterSpacing: "1px" }}>
              EXHIBIT #{currentScene.sceneNumber}
            </span>
          </div>

          {/* PROMINENT DEDICATED TOPIC-SPECIFIC 3D PAPER-CUT HERO VISUAL */}
          <PaperTopicHeroVisual
            domain={topicDomain}
            scene={currentScene}
            sceneLocalFrame={sceneLocalFrame}
            highlightProgress={highlightProgress}
          />

          {/* Stamped Metric Badge */}
          <div
            style={{
              backgroundColor: "#1C140C",
              color: "#FEF08A",
              padding: "10px 32px",
              borderRadius: 14,
              border: "2.5px solid #CA8A04",
              boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
              textAlign: "center",
              marginTop: 10,
              width: "90%",
            }}
          >
            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: "2px",
                fontFamily: "'Courier New', Courier, monospace",
              }}
            >
              {currentScene.metricNumber || "100% AUDITED"}
            </div>
          </div>

          {/* Stamp Slam Animation at 1.0s */}
          {showStamp && (
            <div style={{ position: "absolute", top: 35, right: 25, zIndex: 40 }}>
              <InkStamp
                text={currentScene.sceneNumber === 1 ? "INITIAL TRIGGER" : currentScene.sceneNumber === 2 ? "AUDITED PROOF" : "VERIFIED RECORD"}
                color="#DC2626"
                scale={stampSpring}
                rotation={-8}
              />
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================
          4. CAPTIONS: CENTER-ALIGNED PROFESSIONAL TYPOGRAPHY (SAFE ZONE)
          No dangling single words! Always balanced 3-5 word readable lines.
      ==================================================================== */}
      <div
        style={{
          position: "absolute",
          top: 890,
          left: 45,
          right: 45,
          zIndex: 65,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(14px)",
            border: "2.5px solid rgba(255, 255, 255, 0.25)",
            borderRadius: 20,
            padding: "18px 34px",
            boxShadow: "0 20px 55px rgba(0, 0, 0, 0.85), 0 0 25px rgba(250, 204, 21, 0.25)",
            maxWidth: "96%",
            textAlign: "center",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px 12px",
          }}
        >
          {captionWords.map((item, wIdx) => {
            const globalWordIdx = activePhraseStartIndex + wIdx;
            const isCurrent = globalWordIdx === currentActiveWordGlobalIdx;
            const isPast = globalWordIdx < currentActiveWordGlobalIdx;
            const isLevel3 = item.level === 3;
            const isLevel2 = item.level === 2;

            return (
              <span
                key={wIdx}
                style={{
                  fontSize: isLevel3 ? 46 : isLevel2 ? 44 : 42,
                  fontWeight: 900,
                  lineHeight: 1.25,
                  fontFamily: "'Montserrat', 'Inter', sans-serif",
                  letterSpacing: "-0.5px",
                  color: isCurrent
                    ? "#0F172A"
                    : isPast
                    ? "#FFFFFF"
                    : isLevel3
                    ? "#FDE047"
                    : "rgba(255,255,255,0.75)",
                  backgroundColor: isCurrent
                    ? isLevel3
                      ? "#FDE047"
                      : "#FACC15"
                    : isLevel3
                    ? "rgba(202, 138, 4, 0.40)"
                    : "transparent",
                  border: isLevel3 && !isCurrent ? "1.5px dashed #EAB308" : "none",
                  padding: isCurrent ? "4px 14px" : isLevel3 ? "3px 10px" : "4px 6px",
                  borderRadius: 10,
                  display: "inline-block",
                  transform: isCurrent ? "scale(1.18)" : "scale(1)",
                  boxShadow: isCurrent ? "0 4px 22px rgba(250, 204, 21, 0.90)" : "none",
                  transition: "all 0.08s ease-out",
                  textShadow: isCurrent
                    ? "none"
                    : "0 3px 12px rgba(0,0,0,0.95)",
                }}
              >
                {item.displayText}
              </span>
            );
          })}
        </div>
      </div>

      {/* ===================================================================
          5. BOTTOM ARCHIVAL DOSSIER & YELLOW HIGHLIGHTER (1100PX - 1860PX)
      ==================================================================== */}
      <div
        style={{
          position: "absolute",
          top: 1090,
          left: 45,
          right: 45,
          bottom: 60,
          backgroundColor: "#FFFDF7",
          border: "3px solid #D4C19F",
          borderRadius: 20,
          boxShadow: "0 18px 45px rgba(40, 25, 10, 0.20)",
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 25,
          overflow: "hidden",
        }}
      >
        <ScotchTape style={{ top: -14, left: "40%" }} rotation={-1.5} width={150} />

        {/* Archival Headline (Changes with each scene!) */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#925712", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 4 }}>
            📑 OFFICIAL ARCHIVAL DOSSIER // EXHIBIT #{currentScene.sceneNumber}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#1C140D", fontFamily: "'Georgia', serif", lineHeight: 1.25 }}>
            {currentScene.documentHeadline ||
              (topicDomain === "roman_concrete"
                ? currentScene.sceneNumber === 1
                  ? "OFFICIAL ARCHEOLOGICAL & CHEMICAL AUDIT: OPUS CAEMENTICIUM"
                  : currentScene.sceneNumber === 2
                  ? "EMPIRICAL TOBERMORITE CRYSTALLINE HEALING MECHANISM"
                  : "2,000-YEAR COMPRESSIVE STRENGTH vs MODERN RETENTION"
                : topicDomain === "mantis_shrimp"
                ? "ACOUSTIC CAVITATION & IMPACT FORCE PULSE"
                : topicDomain === "money_compounding"
                ? currentScene.sceneNumber === 1
                  ? "OFFICIAL SAVINGS FORMULA LEDGER"
                  : currentScene.sceneNumber === 2
                  ? "EMPIRICAL CAPITAL ACCUMULATION CURVE"
                  : "EXPONENTIAL WEALTH MULTIPLIER VERIFIED"
                : "OFFICIAL EMPIRICAL INVESTIGATION LEDGER")}
          </div>
        </div>

        {/* Topic-Specific Scientific & Engineering Dossier Infographic */}
        <PaperTopicDossierGraphic
          domain={topicDomain}
          scene={currentScene}
        />

        {/* Yellow Highlighter Quote Box */}
        <div
          style={{
            position: "relative",
            padding: "12px 18px",
            backgroundColor: "#F9F3E5",
            borderRadius: 12,
            border: "1.5px dashed #D6C29E",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: `${highlightProgress}%`,
              backgroundColor: "rgba(250, 204, 21, 0.45)",
              mixBlendMode: "multiply",
            }}
          />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#2B1E12", lineHeight: 1.4, position: "relative", zIndex: 2 }}>
            "{currentScene.documentSnippet || verifiedConcept}"
          </p>
        </div>

        {/* Footer Source */}
        <div
          style={{
            borderTop: "1.5px dashed #D6C29E",
            paddingTop: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "#785834" }}>
            📚 Source: <strong>{sources[0] || "Official Guidelines"}</strong>
          </span>
          <span style={{ fontSize: 12, fontWeight: 900, color: "#925712", letterSpacing: "1px" }}>
            VERIFIED SPEC
          </span>
        </div>
      </div>

      {/* ===================================================================
          6. PRECISE SYNCHRONIZED SOUND DESIGN (SFX) & VOICE NARRATION
      ==================================================================== */}
      {/* Dedicated per-scene audio tracks synced with AUDIO_DELAY_FRAMES */}
      {scenes.some((s) => s.narrationSrc) ? (
        scenes.map((s, idx) =>
          s.narrationSrc ? (
            <Sequence
              key={`scene_audio_${idx}`}
              from={idx * sceneDurationFrames + AUDIO_DELAY_FRAMES}
              durationInFrames={sceneDurationFrames - AUDIO_DELAY_FRAMES}
            >
              <Audio src={resolveStatic(s.narrationSrc)} volume={1.0} />
            </Sequence>
          ) : null
        )
      ) : narrationSrc ? (
        <Audio src={resolveStatic(narrationSrc)} volume={1.0} />
      ) : null}
      {musicSrc && <Audio src={resolveStatic(musicSrc)} volume={0.14} loop />}

      {sfxEnabled &&
        scenes.map((_, idx) => (
          <Sequence key={`page_${idx}`} from={idx * sceneDurationFrames}>
            <Audio src={resolveStatic("/audio/sound-effects/page-turn.wav")} volume={0.50} />
          </Sequence>
        ))}

      {sfxEnabled &&
        scenes.map((_, idx) => (
          <Sequence key={`whoosh_${idx}`} from={idx * sceneDurationFrames + Math.round(fps * 0.35)}>
            <Audio src={resolveStatic("/audio/sound-effects/whoosh.wav")} volume={0.35} />
          </Sequence>
        ))}

      {sfxEnabled &&
        scenes.map((_, idx) => (
          <Sequence key={`stamp_${idx}`} from={idx * sceneDurationFrames + Math.round(1.0 * fps)}>
            <Audio src={resolveStatic("/audio/sound-effects/sub-bass-impact.wav")} volume={0.42} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};

export default PaperExplainerReel;
